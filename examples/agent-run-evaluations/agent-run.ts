import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { trace, type Attributes } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  Client,
  runCorrelation,
  type EvaluationResultListResponse,
  type RunCorrelationContext,
  type RunTelemetryHook,
} from '@trustloopguard/sdk';

const AGENT_ID = 'cookbook-observed-agent';
const POLICY_ID = 'agent-run-no-denied-decisions';

interface RuntimeConfig {
  apiUrl: string;
  apiKey?: string;
  adminUserId?: string;
  workspaceId: string;
  environmentId: string;
}

interface Observability {
  emitSpan(
    name: string,
    context: RunCorrelationContext,
    attributes?: Attributes,
  ): void;
  hook: RunTelemetryHook;
  shutdown(): Promise<void>;
}

function configFromEnvironment(): RuntimeConfig {
  return {
    apiUrl: process.env.TLG_URL ?? 'http://127.0.0.1:8080',
    ...(process.env.TLG_API_KEY ? { apiKey: process.env.TLG_API_KEY } : {}),
    ...(process.env.TLG_ADMIN_USER_ID
      ? { adminUserId: process.env.TLG_ADMIN_USER_ID }
      : {}),
    workspaceId: process.env.TLG_WORKSPACE_ID ?? 'default',
    environmentId: process.env.TLG_ENVIRONMENT_ID ?? 'production',
  };
}

export function createWorkspaceFetch(
  config: RuntimeConfig,
  transport: typeof fetch = globalThis.fetch,
): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('x-featherlane-ai-workspace-id', config.workspaceId);
    headers.set('x-featherlane-ai-environment-id', config.environmentId);
    if (config.adminUserId) {
      headers.set('x-featherlane-ai-user-id', config.adminUserId);
    }
    if (config.apiKey) headers.set('authorization', `Bearer ${config.apiKey}`);
    return transport(input, { ...init, headers });
  };
}

function createObservability(config: RuntimeConfig): Observability {
  const headers: Record<string, string> = {
    'x-featherlane-ai-workspace-id': config.workspaceId,
    'x-featherlane-ai-environment-id': config.environmentId,
  };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  const exporter = new OTLPTraceExporter({
    url: `${config.apiUrl}/v1/otel/v1/traces`,
    headers,
  });
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'cookbook-observed-agent',
    }),
    spanProcessors: [
      new BatchSpanProcessor(exporter, {
        scheduledDelayMillis: 100,
        exportTimeoutMillis: 5_000,
      }),
    ],
  });
  provider.register();
  const tracer = trace.getTracer('trustloopguard-cookbook');

  const emitSpan = (
    name: string,
    context: RunCorrelationContext,
    attributes: Attributes = {},
  ): void => {
    const span = tracer.startSpan(name, {
      attributes: { ...context.attributes, ...attributes },
    });
    span.end();
  };

  return {
    emitSpan,
    hook: {
      bindRun(context) {
        emitSpan('agent.run.started', context, {
          'gen_ai.operation.name': 'invoke_agent',
        });
      },
      async forceFlush(context) {
        // The SDK adds featherlane.flush.id to this context, then sends the
        // same id in POST /v1/runs/{id}/finalize after this hook resolves.
        emitSpan('agent.telemetry.flush', context);
        await provider.forceFlush();
      },
    },
    shutdown: () => provider.shutdown(),
  };
}

async function configureAgent(client: Client): Promise<void> {
  await client.upsertAgent({
    agent_id: AGENT_ID,
    display_name: 'Cookbook observed agent',
    scope: { in_scope: ['order status'], out_of_scope: [] },
    authority: { can_promise: [], cannot_promise: [] },
    tone: { target: 'concise', forbidden: [] },
    knowledge_sources: [],
    escalation_triggers: [],
    workflow_requirements: [],
  });

  const policy = await readFile(
    new URL('./no-denied-decisions.yaml', import.meta.url),
    'utf8',
  );
  await client.upsertPolicy(policy);

  await client.putAgentEvaluationProfile(AGENT_ID, {
    enabled: true,
    capture_mode: 'durable',
    content_mode: 'metadata_only',
    quiet_period_ms: 250n,
    max_capture_wait_ms: 5_000n,
    on_incomplete: 'fail',
  });
  await client.putAgentEvaluationPolicyAssignments(AGENT_ID, {
    assignments: [
      { policy_id: POLICY_ID, weight: 1, critical: true, enabled: true },
    ],
  });
}

async function runAgent(
  client: Client,
  observability: Observability,
): Promise<string> {
  let completedRunId: string | undefined;

  await client.withRun(
    {
      agentId: AGENT_ID,
      kind: 'chat_session',
      externalId: `cookbook-${Date.now()}`,
      metadata: { example: 'agent-run-evaluations' },
    },
    async (run) => {
      completedRunId = run.id;

      const userTurn = await client.createRunEvent(run.id, {
        kind: 'user_turn',
        label: 'customer request',
        input_summary: 'Where is order 42?',
      });
      observability.emitSpan(
        'agent.user_turn',
        runCorrelation(run.id, AGENT_ID, userTurn.id),
        { 'gen_ai.operation.name': 'chat' },
      );

      const decision = await run.withEvent(
        {
          kind: 'tool_call',
          label: 'lookup_order',
          input_summary: 'order_id=42',
        },
        () =>
          client.guardToolCall({
            agentId: AGENT_ID,
            operation: 'lookup_order',
            parameters: { order_id: '42' },
            sideEffect: 'read',
          }),
      );
      if (decision.effect !== 'permit') {
        throw new Error(`lookup_order was not permitted: ${decision.reason}`);
      }

      const assistantTurn = await client.createRunEvent(run.id, {
        kind: 'assistant_turn',
        label: 'final answer',
        output_summary: 'Order 42 is in transit.',
      });
      observability.emitSpan(
        'agent.assistant_turn',
        runCorrelation(run.id, AGENT_ID, assistantTurn.id),
        { 'gen_ai.operation.name': 'chat' },
      );
    },
  );

  if (!completedRunId) throw new Error('Run did not start');
  return completedRunId;
}

export async function waitForEvaluation(
  client: Client,
  runId: string,
  timeoutMs = 15_000,
): Promise<EvaluationResultListResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const evaluation = await client.listRunEvaluations(runId);
    if (evaluation.results.length > 0) return evaluation;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for evaluation of Run ${runId}`);
}

async function main(): Promise<void> {
  const config = configFromEnvironment();
  const request = createWorkspaceFetch(config);
  const observability = createObservability(config);
  const client = new Client({
    baseUrl: config.apiUrl,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    fetchImpl: request,
    runTelemetry: observability.hook,
  });

  try {
    await configureAgent(client);
    const runId = await runAgent(client, observability);
    const evaluation = await waitForEvaluation(client, runId);
    const result = evaluation.results.at(-1);
    if (!result) throw new Error('Evaluation completed without a result');

    console.log(
      JSON.stringify(
        {
          runId,
          verdict: result.result.verdict,
          captureStatus: result.result.capture_status,
          findings: result.findings.map((finding) => ({
            policyId: finding.policy_id,
            status: finding.status,
            reason: finding.reason,
          })),
          dashboardUrl: `http://127.0.0.1:3000/runs/${runId}`,
        },
        null,
        2,
      ),
    );
  } finally {
    await observability.shutdown();
  }
}

const executedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === executedFile) {
  main().catch((error: Error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

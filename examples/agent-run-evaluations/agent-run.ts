import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { observability } from '@trustloopguard/sdk/observability';

const AGENT_ID = 'cookbook-observed-agent';
const DASHBOARD_URL = process.env['FEATHERLANE_AI_DASHBOARD_URL'] ?? 'http://127.0.0.1:3000';

export async function runObservedAgent(
  externalId = `cookbook-${Date.now()}`,
): Promise<{ runId: string; dashboardUrl: string }> {
  const observed = observability.init({ agentId: AGENT_ID });

  try {
    const { runId } = await observed.run(
      { externalId, kind: 'chat_session' },
      async (run) => {
        await run.event({
          kind: 'user_turn',
          input_summary: 'Where is order 42?',
        });

        const decision = await run.withEvent(
          {
            kind: 'tool_call',
            label: 'lookup_order',
            input_summary: 'order_id=42',
          },
          () =>
            run.client.guardToolCall({
              agentId: AGENT_ID,
              operation: 'lookup_order',
              parameters: { order_id: '42' },
              sideEffect: 'read',
            }),
        );
        if (decision.effect !== 'permit') {
          throw new Error(`lookup_order was not permitted: ${decision.reason}`);
        }

        await run.event({
          kind: 'assistant_turn',
          output_summary: 'Order 42 is in transit.',
        });
      },
    );

    return {
      runId,
      dashboardUrl: new URL(`/runs/${runId}`, DASHBOARD_URL).toString(),
    };
  } finally {
    await observed.shutdown();
  }
}

async function main(): Promise<void> {
  console.log(JSON.stringify(await runObservedAgent(), null, 2));
}

const executedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === executedFile) {
  main().catch((error: Error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

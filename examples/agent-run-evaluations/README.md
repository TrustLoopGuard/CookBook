# Observe and evaluate an agent Run

The integration has two concepts: initialize one observed agent, then wrap one
complete session in `run(...)`.

```ts
const observed = observability.init({ agentId: 'support-agent' });

await observed.run({ externalId: sessionId }, async (run) => {
  // Your agent code runs here. Existing OpenTelemetry spans are correlated
  // automatically; run.event(...) adds readable transcript steps.
});
```

When the callback finishes, the SDK flushes telemetry, finalizes the Run, and
lets the server trigger the policies already assigned to that agent. Application
code does not configure OpenTelemetry, attach correlation attributes, or poll
for evaluation results.

## One-time setup

1. Start Featherlane AI and open the dashboard.
2. Register the agent ID `cookbook-observed-agent`.
3. Import [`no-denied-decisions.yaml`](no-denied-decisions.yaml) and assign it
   to that agent under its evaluation settings.
4. Create a runtime API key for the same workspace and environment.

Policies and evaluation profiles belong to the control plane. They should not
be recreated by every running agent process.

## Run locally

Until the changes are released, use the source branches from
[FeatherlaneAI PR #476](https://github.com/ducnguyen67201/FeatherlaneAI/pull/476)
and [CookBook PR #3](https://github.com/TrustLoopGuard/CookBook/pull/3).

```bash
export FEATHERLANE_AI_URL=http://127.0.0.1:8080
export FEATHERLANE_AI_API_KEY=<runtime-api-key>
pnpm example:agent-run-evaluations
```

The command prints the Run ID and dashboard URL. Open that URL to inspect the
span waterfall, transcript, guard decisions, capture status, and post-run
evaluation result.

## What is automatic

`observability.init()` configures the OTLP exporter and Run correlation for the
process. Spans created by OpenTelemetry-instrumented frameworks or libraries
inside `observed.run(...)` receive the Run and agent identities automatically.
The SDK also emits Run, event, and flush spans for the waterfall.

The only boundary a generic integration must provide is when one session ends.
Framework adapters can supply that boundary automatically—for example, a
LiveKit adapter finalizes when its AgentSession closes.

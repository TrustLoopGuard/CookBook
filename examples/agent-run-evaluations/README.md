# Observe and evaluate a complete agent Run

This framework-independent example proves the complete lifecycle:

```text
agent + agent_id
  -> Run and ordered Run events
  -> guarded tool decision + OTLP spans
  -> durable telemetry flush
  -> terminal Run finalization
  -> immutable snapshot
  -> assigned post-run policy evaluation
```

Evaluation is not triggered by a span ending or by every model/tool call. It is
triggered only after the SDK finalizes the Run and the capture barrier closes.
The example emits a flush marker so the barrier does not have to guess when the
agent framework is done sending telemetry.

## 1. Start TrustLoopGuard locally

Until the agent Run evaluation changes are released, use the source branch from
[TrustLoopGuard PR #476](https://github.com/ducnguyen67201/FeatherlaneAI/pull/476).
From a directory containing sibling `TrustLoopGuard` and `CookBook` checkouts:

```bash
git -C TrustLoopGuard switch feat/agent-run-observability-post-run-evaluations
pnpm --dir TrustLoopGuard install --frozen-lockfile
pnpm --dir TrustLoopGuard --filter @featherlane-ai/sdk build

cd TrustLoopGuard
POSTGRES_PASSWORD=featherlane_ai \
TL_API_KEY=featherlane-ai-local-api-key \
docker compose up --build
```

The stack exposes the Rust API at `http://127.0.0.1:8080` and the dashboard at
`http://127.0.0.1:3000`. The Rust server runs storage migrations and starts the
durable evaluation worker automatically.

Open `http://127.0.0.1:3000`, create a local account, and complete the first
onboarding step to create a workspace. The example uses that owner's user ID
only for its repeatable control-plane setup. It does not create or print an API
key from the dashboard.

## 2. Run the observed agent

In another terminal:

```bash
cd CookBook
pnpm install --frozen-lockfile

export TLG_URL=http://127.0.0.1:8080
export TLG_API_KEY=featherlane-ai-local-api-key
export TLG_ADMIN_USER_ID="$(docker compose --project-directory ../TrustLoopGuard exec -T db \
  psql -U featherlane_ai -d featherlane_ai -Atc \
  "SELECT id FROM users ORDER BY created_at DESC LIMIT 1")"
export TLG_WORKSPACE_ID="$(docker compose --project-directory ../TrustLoopGuard exec -T db \
  psql -U featherlane_ai -d featherlane_ai -Atc \
  "SELECT workspace_id FROM workspace_members WHERE user_id = '$TLG_ADMIN_USER_ID' ORDER BY created_at DESC LIMIT 1")"
export TLG_ENVIRONMENT_ID=production

pnpm example:agent-run-evaluations
```

The command is safe to run repeatedly. It upserts the sample agent and policy,
replaces that agent's evaluation assignment, records a new Run, and prints its
verdict and dashboard URL. No model-provider key is required because the sample
uses the deterministic `run_metric` grader.

## Integration contract

Keep these identities distinct:

- `agent_id` selects the registered agent and its frozen evaluation-policy manifest.
- `run_id` groups one chat session, call, workflow, or background job.
- OTel trace/span IDs describe telemetry topology; they do not replace `run_id`.
- `featherlane.flush.id` proves the final OTLP batch was durably accepted.

For a real framework, wrap its lifecycle with `client.withRun(...)` or a framework
adapter such as `liveKitRun(...)`. Add `runCorrelation(...)` attributes to spans,
and connect the SDK `runTelemetry.forceFlush` hook to the framework's tracer
provider. Finalize exactly once from the framework's authoritative session-end
event. If controlled flushing is unavailable, omit the hook; the server uses the
profile's bounded quiet period and maximum capture wait.

The local example uses the internal development key to configure the agent and
policy, plus the local workspace owner's identity for authorization. In a
deployed environment, configure profiles and assignments through an
admin/dashboard identity, then remove that setup code and give the running agent
only its workspace-scoped runtime key.

# TrustLoopGuard CookBook

Small, runnable examples for adding TrustLoopGuard to existing agent
frameworks without rewriting their business logic.

## Framework examples

| Framework | Protected boundaries | Integration | Example |
| --- | --- | --- | --- |
| AG2 | Tool calls, final plain-text output | Async middleware | [Guard an AG2 sales agent](examples/ag2/README.md) |
| Agno | Tool calls, final plain-text output | Sync hooks | [Guard an Agno sales agent](examples/agno/README.md) |
| OpenAI Agents SDK | Local function tools, final output | Agent decorator + output guard | [Guard an OpenAI sales agent](examples/openai-agents/README.md) |
| Mastra | Resolved local tools, final output | Agent decorator + output guard | [Guard a Mastra sales agent](examples/mastra/README.md) |
| LiveKit Agents | Local function tools, pre-TTS text | Voice agent decorator | [Guard a LiveKit voice agent](examples/livekit/README.md) |

## Observability and post-run evaluation

The [agent Run + OpenTelemetry + post-run evaluation example](examples/agent-run-evaluations/README.md)
is framework-independent. It registers an agent, assigns an evaluation policy,
captures one complete Run with OTLP spans and a guarded tool decision, finalizes
the Run, and waits for the immutable evaluation result.

Every example uses the same flow:

1. Build the framework agent and its tools normally.
2. Attach one TrustLoopGuard adapter.
3. Keep calling the framework's normal agent API.

A local tool only runs when the guard decision permits it. The model-input path
remains framework-owned. Provider-hosted tools and remote execution hidden from
the application process require their own enforcement boundary.

## Prerequisites

- Python 3.10 or newer
- Node.js 24 or newer for the TypeScript examples
- pnpm 10 or newer for the TypeScript examples
- A running TrustLoopGuard API and API key
- An OpenAI API key for the demo agents

The examples require the TrustLoopGuard Python SDK changes in
[TrustLoopGuard PR #431](https://github.com/ducnguyen67201/TrustLoopGuard/pull/431).
Until a package containing those adapters is published, install the SDK from a
sibling TrustLoopGuard checkout:

```bash
python -m venv .venv
source .venv/bin/activate
git clone https://github.com/ducnguyen67201/TrustLoopGuard.git ../TrustLoopGuard
git -C ../TrustLoopGuard switch codex/python-agent-framework-integrations
python -m pip install -e "../TrustLoopGuard/sdks/python[ag2,agno]"
python -m pip install "ag2[openai]>=1.0.0b0,<1.1" "agno[openai]>=2.8.3,<3"
```

Then choose an example and follow its README.

The TypeScript examples currently link to a sibling TrustLoopGuard source
checkout so the CookBook and unreleased adapter changes can be tested together:

```bash
pnpm --dir ../TrustLoopGuard install --frozen-lockfile
pnpm --dir ../TrustLoopGuard --filter @trustloopguard/sdk build
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
```

After the next TypeScript SDK release, replace the local `file:` dependency in
`package.json` with the published `@trustloopguard/sdk` version.

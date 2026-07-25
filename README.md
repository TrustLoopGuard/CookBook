# TrustLoopGuard CookBook

Small, runnable examples for adding TrustLoopGuard to existing agent
frameworks without rewriting their business logic.

## Framework examples

| Framework | Protected boundaries | Integration | Example |
| --- | --- | --- | --- |
| AG2 | Model input, tool calls, model output | Async middleware | [Guard an AG2 sales agent](examples/ag2/README.md) |
| Agno | Tool calls, model output | Sync hooks | [Guard an Agno sales agent](examples/agno/README.md) |

Both examples use the same flow:

1. Build the framework agent and its tools normally.
2. Create a TrustLoopGuard client.
3. Attach one framework adapter.
4. Keep calling the framework's normal `ask` or `run` API.

For both frameworks, a tool only runs when the guard decision permits it.
Denied, deferred, or approval-pending calls are returned to the agent as normal
tool results so the framework loop can continue safely. AG2 middleware also
guards model input; Agno's current public input path remains framework-owned.

## Prerequisites

- Python 3.10 or newer
- A running TrustLoopGuard API and API key
- An OpenAI API key for the demo agents

The examples require a TrustLoopGuard Python SDK build containing the AG2 and
Agno adapters. Until that SDK version is published, install it from a sibling
TrustLoopGuard checkout:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e "../TrustLoopGuard/sdks/python[ag2,agno]"
python -m pip install "ag2[openai]>=1.0.0b0,<1.1" "agno[openai]>=2.8.3,<3"
```

Then choose an example and follow its README.

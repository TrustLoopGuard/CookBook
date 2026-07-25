# Guard an AG2 sales agent

This example adds TrustLoopGuard as outer AG2 middleware. The agent and tool
functions stay unchanged, and application code still calls `agent.ask(...)`.

## Install

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r examples/ag2/requirements.txt
```

The AG2 adapter is currently under review in
[TrustLoopGuard PR #431](https://github.com/ducnguyen67201/TrustLoopGuard/pull/431).
Until a package containing it is published, install the SDK from a sibling
checkout:

```bash
git clone https://github.com/ducnguyen67201/TrustLoopGuard.git ../TrustLoopGuard
git -C ../TrustLoopGuard switch codex/python-agent-framework-integrations
python -m pip install -e "../TrustLoopGuard/sdks/python[ag2]"
```

## Configure and run

```bash
export OPENAI_API_KEY="..."
export TRUSTLOOPGUARD_BASE_URL="http://localhost:8080"
export TRUSTLOOPGUARD_API_KEY="..."

python examples/ag2/guarded_sales_agent.py
```

The important integration is:

```python
guard_ag2(
    agent,
    client=trustloop,
    agent_id="cookbook-ag2-sales-agent",
    tool_side_effects={
        "lookup_inventory": SideEffectClass.read,
        "confirm_order": SideEffectClass.api_mutation,
    },
)
```

TrustLoopGuard middleware checks:

- every tool proposal before AG2 executes the tool;
- the final plain-text response before AG2 returns it to the application.

The model-input path remains framework-owned. The adapter does not claim to
authorize or rewrite input before AG2 sends it to the model.

`confirm_order` is explicitly marked as a mutating API action. If a policy
requires approval, the adapter waits for the TrustLoopGuard decision and only
executes the function after authorization. A denied or deferred call becomes a
safe AG2 tool result rather than an exception that breaks the agent loop.

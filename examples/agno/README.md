# Guard an Agno sales agent

This example adds TrustLoopGuard through Agno's native tool and post-run hooks.
The agent and tool functions stay unchanged, and application code still calls
`agent.run(...)`.

## Install

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r examples/agno/requirements.txt
```

For local SDK development, replace the TrustLoopGuard package with the sibling
checkout:

```bash
python -m pip install -e "../TrustLoopGuard/sdks/python[agno]"
```

## Configure and run

```bash
export OPENAI_API_KEY="..."
export TRUSTLOOPGUARD_BASE_URL="http://localhost:8080"
export TRUSTLOOPGUARD_API_KEY="..."

python examples/agno/guarded_sales_agent.py
```

The important integration is:

```python
guard_agno(
    agent,
    client=trustloop,
    agent_id="cookbook-agno-sales-agent",
    tool_side_effects={
        "lookup_inventory": SideEffectClass.read,
        "confirm_order": SideEffectClass.api_mutation,
    },
)
```

TrustLoopGuard hooks check every proposed tool call before Agno invokes the
function and check the final model output before Agno returns it. The Agno
model-input path currently remains framework-owned.

`confirm_order` is explicitly marked as a mutating API action. If a policy
requires approval, the adapter waits for the TrustLoopGuard decision and only
executes the function after authorization. A denied or deferred call becomes a
safe Agno tool result rather than an exception that breaks the agent loop.

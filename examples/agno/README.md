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

The Agno adapter is currently under review in
[TrustLoopGuard PR #431](https://github.com/ducnguyen67201/TrustLoopGuard/pull/431).
Until a package containing it is published, install the SDK from a sibling
checkout:

```bash
git clone https://github.com/ducnguyen67201/TrustLoopGuard.git ../TrustLoopGuard
git -C ../TrustLoopGuard switch codex/python-agent-framework-integrations
python -m pip install -e "../TrustLoopGuard/sdks/python[agno]"
```

## Configure and run

First, deploy the included
[`confirm-order-approval.yaml`](confirm-order-approval.yaml) policy to the same
workspace and environment as `TRUSTLOOPGUARD_API_KEY`:

1. Sign in to the TrustLoopGuard dashboard.
2. Select the workspace and environment associated with the runtime key.
3. Open **Policies**, create a policy from the YAML file, and enable it.

This setup is required for the approval demonstration. TrustLoopGuard permits a
tool call when no matching enforcement policy exists, so running the example
without this policy does **not** demonstrate human approval.

Then configure the clients and run the example:

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
    approval_timeout_s=300,
)
```

TrustLoopGuard hooks check every proposed tool call before Agno invokes the
function and check the final model output before Agno returns it. The Agno
model-input path currently remains framework-owned.

`confirm_order` is explicitly marked as a mutating API action. The shipped
policy returns `require_approval`, so the adapter waits up to five minutes for
an owner or admin to decide the request in the dashboard. The function prints
`Executing confirm_order after TrustLoopGuard authorization.` only after a
fresh permit and execution lease are issued.

Do not add Agno's `@approval` decorator or call `requirement.confirm()` /
`agent.continue_run()` in this example. Those APIs belong to Agno's separate
local approval system; automatically calling them makes the application
approve its own action and does not demonstrate TrustLoopGuard authorization.

A denied, expired, or still-pending request becomes a safe Agno tool result
without calling `confirm_order`.

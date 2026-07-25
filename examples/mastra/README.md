# Guard a Mastra sales agent

This example keeps Mastra's normal `Agent`, `createTool()`, and `generate()`
APIs. `guardAgent()` decorates tools returned through Mastra's execution
resolver, and `guard()` checks the completed final output before delivery.

## Configure and run

From the CookBook root:

```bash
export OPENAI_API_KEY="..."
export TLG_URL="http://localhost:8080"
export TLG_API_KEY="..."
export TLG_AGENT_ID="mastra-sales-agent"

node examples/mastra/guarded_sales_agent.ts \
  "Create a $2,000 invoice for Acme."
```

The integration is:

```ts
const agent = guardAgent(
  new Agent({ tools: { createInvoice } }),
  {
    agentId: AGENT_ID,
    tools: {
      inferMetadata: () => ({ side_effect: 'api_mutation' }),
    },
  },
);

const result = await agent.generate(input);
const reply = await outputGuard({ input, draft: result.text });
```

Tools resolved and executed locally are protected. Provider-hosted or remote
tools that do not expose a local Mastra `execute()` callback require an
explicit TrustLoopGuard boundary at their execution host.

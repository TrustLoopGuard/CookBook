# Guard an OpenAI Agents SDK sales agent

This example keeps the normal OpenAI `Agent`, `tool()`, and `run()` APIs.
`guardAgent()` authorizes each local function tool immediately before its
`execute()` callback, and `guard()` checks the completed final output before
the application prints it.

## Configure and run

From the CookBook root:

```bash
export OPENAI_API_KEY="..."
export TLG_URL="http://localhost:8080"
export TLG_API_KEY="..."
export TLG_AGENT_ID="openai-sales-agent"

node examples/openai-agents/guarded_sales_agent.ts \
  "Create a $2,000 invoice for Acme."
```

The integration is:

```ts
const agent = guardAgent(new Agent({ tools: [createInvoice] }), {
  agentId: AGENT_ID,
  tools: {
    inferMetadata: () => ({ side_effect: 'api_mutation' }),
  },
});

const result = await run(agent, input);
const reply = await outputGuard({ input, draft: String(result.finalOutput) });
```

This covers local function tools. OpenAI-hosted tools, handoffs, built-in
execution tools, and agent-as-tool calls do not expose this local `execute()`
boundary and are not claimed as protected by the decorator.

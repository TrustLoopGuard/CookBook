import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { GuardMode, guard, guardAgent } from '@trustloopguard/sdk';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const AGENT_ID = process.env.TLG_AGENT_ID ?? 'mastra-sales-agent';

export function createGuardedSalesAgent() {
  const createInvoice = createTool({
    id: 'create_invoice',
    description: 'Create an invoice after the customer accepts a quote.',
    inputSchema: z.object({
      customer: z.string(),
      amountUsd: z.number().positive(),
    }),
    outputSchema: z.object({
      invoiceId: z.string(),
      summary: z.string(),
    }),
    execute: async ({ customer, amountUsd }) => ({
      invoiceId: `inv-${Date.now()}`,
      summary: `Created invoice for ${customer} in the amount of $${amountUsd}.`,
    }),
  });

  return guardAgent(
    new Agent({
      id: 'guarded-sales-agent',
      name: 'Guarded sales agent',
      instructions:
        'Help customers with quotes. Create an invoice only after the customer explicitly accepts.',
      model: 'openai/gpt-5-mini',
      tools: { createInvoice },
    }),
    {
      agentId: AGENT_ID,
      tools: {
        inferMetadata: () => ({ side_effect: 'api_mutation' }),
      },
    },
  );
}

export async function askGuardedSalesAgent(input: string): Promise<string> {
  const result = await createGuardedSalesAgent().generate(input);
  const outputGuard = guard({
    agentId: AGENT_ID,
    channel: 'chat',
    mode: GuardMode.Rewrite,
    failClosed: true,
  });

  return await outputGuard({ input, draft: result.text });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input =
    process.argv.slice(2).join(' ') || 'Create a $2,000 invoice for Acme.';
  console.log(await askGuardedSalesAgent(input));
}

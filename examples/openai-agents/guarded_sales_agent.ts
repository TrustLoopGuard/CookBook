import { Agent, run, tool } from '@openai/agents';
import { GuardMode, guard, guardAgent } from '@trustloopguard/sdk';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const AGENT_ID = process.env.TLG_AGENT_ID ?? 'openai-sales-agent';

export function createGuardedSalesAgent() {
  const createInvoice = tool({
    name: 'create_invoice',
    description: 'Create an invoice after the customer accepts a quote.',
    parameters: z.object({
      customer: z.string(),
      amountUsd: z.number().positive(),
    }),
    execute: async ({ customer, amountUsd }) => {
      return `Created invoice for ${customer} in the amount of $${amountUsd}.`;
    },
  });

  return guardAgent(
    new Agent({
      name: 'Guarded sales agent',
      instructions:
        'Help customers with quotes. Create an invoice only after the customer explicitly accepts.',
      model: 'gpt-5-mini',
      tools: [createInvoice],
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
  const result = await run(createGuardedSalesAgent(), input);
  const draft =
    typeof result.finalOutput === 'string'
      ? result.finalOutput
      : String(result.finalOutput);
  const outputGuard = guard({
    agentId: AGENT_ID,
    channel: 'chat',
    mode: GuardMode.Rewrite,
    failClosed: true,
  });

  return await outputGuard({ input, draft });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input =
    process.argv.slice(2).join(' ') || 'Create a $2,000 invoice for Acme.';
  console.log(await askGuardedSalesAgent(input));
}

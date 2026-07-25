import { Agent, tool } from '@livekit/agents';
import {
  guardLiveKitAgent,
  liveKitRun,
} from '@trustloopguard/sdk';
import { z } from 'zod';

const AGENT_ID = process.env.TLG_AGENT_ID ?? 'livekit-support-agent';

export function createGuardedVoiceAgent(
  session: object,
  roomSid: string,
) {
  const issueRefund = tool({
    name: 'issue_refund',
    description: 'Issue a refund after confirming the order and amount.',
    parameters: z.object({
      orderId: z.string(),
      amountUsd: z.number().positive(),
    }),
    execute: async ({ orderId, amountUsd }) => {
      return `Refunded $${amountUsd} for order ${orderId}.`;
    },
  });

  const agent = Agent.create({
    instructions:
      'You are a concise support agent. Confirm the order and amount before issuing a refund.',
    tools: [issueRefund],
  });

  return guardLiveKitAgent(agent, {
    agentId: AGENT_ID,
    channel: 'voice',
    failClosed: true,
    run: liveKitRun(session, {
      externalId: roomSid,
      metadata: { integration: 'livekit' },
    }),
    tools: {
      inferMetadata: () => ({ side_effect: 'api_mutation' }),
    },
  });
}

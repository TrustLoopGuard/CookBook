import { describe, expect, it } from 'vitest';

import { createGuardedSalesAgent as createMastraAgent } from '../examples/mastra/guarded_sales_agent.js';
import { createGuardedSalesAgent as createOpenAiAgent } from '../examples/openai-agents/guarded_sales_agent.js';
import { createGuardedVoiceAgent } from '../examples/livekit/guarded_voice_agent.js';

class FakeLiveKitSession {
  on(_event: 'close', _listener: () => void): this {
    return this;
  }

  off(_event: 'close', _listener: () => void): this {
    return this;
  }
}

describe('TypeScript framework examples', () => {
  it('constructs the guarded OpenAI Agents SDK agent', () => {
    const agent = createOpenAiAgent();

    expect(agent.name).toBe('Guarded sales agent');
    expect(agent.tools).toHaveLength(1);
  });

  it('constructs the guarded Mastra agent', () => {
    const agent = createMastraAgent();

    expect(agent.name).toBe('Guarded sales agent');
  });

  it('constructs the guarded LiveKit voice agent', () => {
    const agent = createGuardedVoiceAgent(new FakeLiveKitSession(), 'RM_test');

    expect(agent.toolCtx.tools).toHaveLength(1);
  });
});

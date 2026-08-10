import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const guardToolCall = vi.fn(async () => ({
    effect: 'permit',
    reason: 'Policy permits the read-only lookup',
  }));
  const event = vi.fn(async () => undefined);
  const withEvent = vi.fn(async (_request, operation: () => Promise<object>) => operation());
  const run = vi.fn(async (_options, operation) => ({
    runId: '018f1111-1111-7111-8111-111111111111',
    value: await operation({
      id: '018f1111-1111-7111-8111-111111111111',
      client: { guardToolCall },
      event,
      withEvent,
    }),
  }));
  const shutdown = vi.fn(async () => undefined);
  const init = vi.fn(() => ({ client: { guardToolCall }, run, shutdown }));
  return { event, guardToolCall, init, run, shutdown, withEvent };
});

vi.mock('@trustloopguard/sdk/observability', () => ({
  observability: { init: sdk.init },
}));

import { runObservedAgent } from '../examples/agent-run-evaluations/agent-run.js';

describe('agent Run evaluation example', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the complete integration without exposing OpenTelemetry plumbing', async () => {
    const result = await runObservedAgent('cookbook-session-42');

    expect(sdk.init).toHaveBeenCalledWith({ agentId: 'cookbook-observed-agent' });
    expect(sdk.run).toHaveBeenCalledWith(
      { externalId: 'cookbook-session-42', kind: 'chat_session' },
      expect.any(Function),
    );
    expect(sdk.event).toHaveBeenCalledTimes(2);
    expect(sdk.withEvent).toHaveBeenCalledOnce();
    expect(sdk.guardToolCall).toHaveBeenCalledWith({
      agentId: 'cookbook-observed-agent',
      operation: 'lookup_order',
      parameters: { order_id: '42' },
      sideEffect: 'read',
    });
    expect(sdk.shutdown).toHaveBeenCalledOnce();
    expect(result).toEqual({
      runId: '018f1111-1111-7111-8111-111111111111',
      dashboardUrl:
        'http://127.0.0.1:3000/runs/018f1111-1111-7111-8111-111111111111',
    });
  });
});

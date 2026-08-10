import { describe, expect, it, vi } from 'vitest';

import { createWorkspaceFetch } from '../examples/agent-run-evaluations/agent-run.js';

describe('agent Run evaluation example', () => {
  it('adds trusted workspace context to local example requests', async () => {
    const transport = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true }),
    );
    const request = createWorkspaceFetch(
      {
        apiUrl: 'http://localhost:8080',
        apiKey: 'local-key',
        adminUserId: 'admin-user-1',
        workspaceId: 'workspace-1',
        environmentId: 'production',
      },
      transport,
    );

    await request('http://localhost:8080/v1/runs', { method: 'GET' });

    const headers = new Headers(transport.mock.calls[0]?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer local-key');
    expect(headers.get('x-featherlane-ai-user-id')).toBe('admin-user-1');
    expect(headers.get('x-featherlane-ai-workspace-id')).toBe('workspace-1');
    expect(headers.get('x-featherlane-ai-environment-id')).toBe('production');
  });
});

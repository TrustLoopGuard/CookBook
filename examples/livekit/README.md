# Guard a LiveKit voice agent

This example uses a standard LiveKit STT→LLM→TTS voice pipeline.
`guardLiveKitAgent()` provides three pieces with one decorator:

- authorization immediately before each local function tool executes;
- complete-response evaluation before text reaches the TTS node;
- one TrustLoopGuard `live_call` Run correlated to the LiveKit room SID.

## Configure and run

From the CookBook root:

```bash
export LIVEKIT_URL="..."
export LIVEKIT_API_KEY="..."
export LIVEKIT_API_SECRET="..."
export TLG_URL="http://localhost:8080"
export TLG_API_KEY="..."
export TLG_AGENT_ID="livekit-support-agent"

node examples/livekit/server.ts dev
```

The integration is intentionally small:

```ts
const agent = guardLiveKitAgent(liveKitAgent, {
  agentId: AGENT_ID,
  channel: 'voice',
  failClosed: true,
  run: liveKitRun(session, {
    externalId: roomSid,
  }),
});

await session.start({ agent, room });
```

Create one decorated agent per LiveKit session; do not share the same decorated
voice-agent instance across callers.

## Latency and coverage boundary

The adapter buffers the complete generated text before it invokes LiveKit's
original TTS node. That prevents an unsafe early chunk from being spoken, but
it increases time-to-first-audio by the remaining generation time plus the
TrustLoopGuard decision latency.

Direct speech-to-speech realtime models send audio through
`realtimeAudioOutputNode()`, not the text TTS node. This example does not claim
to guard that audio path. Use an STT→LLM→TTS pipeline when pre-speech text
enforcement is required.

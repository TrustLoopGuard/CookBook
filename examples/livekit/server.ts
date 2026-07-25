import {
  AgentSession,
  ServerOptions,
  cli,
  defineAgent,
  inference,
} from '@livekit/agents';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

import { createGuardedVoiceAgent } from './guarded_voice_agent.js';

dotenv.config({ path: '.env.local' });

export default defineAgent({
  entry: async (context) => {
    await context.connect();
    const session = new AgentSession({
      stt: new inference.STT({
        model: 'deepgram/nova-3',
        language: 'multi',
      }),
      tts: new inference.TTS({
        model: 'cartesia/sonic-3',
        voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
      }),
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
      },
    });
    const roomSid = await context.room.getSid();
    const agent = createGuardedVoiceAgent(session, roomSid);

    await session.start({ agent, room: context.room });
    session.generateReply({
      instructions: 'Greet the caller and ask how you can help.',
    });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: 'trustloopguard-support-agent',
    }),
  );
}

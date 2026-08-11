import { AgentServer, ServerOptions } from '@livekit/agents';
import { fileURLToPath } from 'node:url';

import { PROFILE_B_AGENT_NAME } from './profile-b-agent.mjs';

const AGENT_PATH = fileURLToPath(new URL('./profile-b-agent.mjs', import.meta.url));

export function createProfileBServerOptions({
  agent = AGENT_PATH,
  wsURL,
  apiKey,
  apiSecret,
} = {}) {
  return new ServerOptions({
    agent,
    agentName: PROFILE_B_AGENT_NAME,
    maxRetry: 0,
    shutdownProcessTimeout: 20_000,
    wsURL,
    apiKey,
    apiSecret,
    production: true,
  });
}

export function createProfileBAgentServer({ environment = process.env } = {}) {
  return new AgentServer(createProfileBServerOptions({
    wsURL: environment.LIVEKIT_URL,
    apiKey: environment.LIVEKIT_API_KEY,
    apiSecret: environment.LIVEKIT_API_SECRET,
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createProfileBAgentServer();
  await server.run();
}

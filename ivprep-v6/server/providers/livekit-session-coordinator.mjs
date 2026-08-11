import { randomBytes } from 'node:crypto';

import { NO_RETRY } from './provider-session-controller.mjs';

function opaqueName(prefix) {
  return `${prefix}-${randomBytes(12).toString('hex')}`;
}

export async function createLiveKitSessionCoordinator({ url, apiKey, apiSecret }) {
  if (!url?.startsWith('wss://') || !apiKey || !apiSecret) throw new Error('LiveKit server configuration is unavailable.');
  const livekit = await import('livekit-server-sdk');
  const httpUrl = url.replace(/^wss:/u, 'https:');
  const roomClient = new livekit.RoomServiceClient(httpUrl, apiKey, apiSecret);
  const dispatchClient = new livekit.AgentDispatchClient(httpUrl, apiKey, apiSecret);
  return Object.freeze({
    room: Object.freeze({
      async create() {
        const roomName = opaqueName('ivprep');
        await roomClient.createRoom({ name: roomName, emptyTimeout: 60, maxParticipants: 4 });
        return { roomName };
      },
      async delete({ roomName }) {
        await roomClient.deleteRoom(roomName);
      },
    }),
    dispatch: Object.freeze({
      async create({ roomName, reservationNonce, agentName }) {
        const created = await dispatchClient.createDispatch(roomName, agentName, {
          metadata: reservationNonce,
          restartPolicy: livekit.JobRestartPolicy.JRP_NEVER,
        });
        return { dispatchId: created.id };
      },
      async delete({ dispatchId }) {
        await dispatchClient.deleteDispatch(dispatchId);
      },
    }),
    retry: NO_RETRY,
  });
}

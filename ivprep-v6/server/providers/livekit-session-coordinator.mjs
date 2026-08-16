import { randomBytes } from 'node:crypto';

import { NO_RETRY } from './provider-session-controller.mjs';

async function withDeadline(operation, { timeoutMs, clock }) {
  let timer = null;
  const pending = Promise.resolve().then(operation);
  pending.catch(() => {});
  try {
    return await Promise.race([
      pending,
      new Promise((resolve, reject) => {
        timer = clock.setTimeout(() => reject(new Error('LiveKit operation timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer != null) clock.clearTimeout(timer);
  }
}

function opaqueName(prefix) {
  return `${prefix}-${randomBytes(12).toString('hex')}`;
}

export async function createLiveKitSessionCoordinator({
  url,
  apiKey,
  apiSecret,
  livekitModule = null,
  operationTimeoutMs = NO_RETRY.timeoutMs,
  clock = globalThis,
} = {}) {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { parsed = null; }
  if (!parsed || parsed.protocol !== 'wss:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !apiKey || !apiSecret) {
    throw new Error('LiveKit server configuration is unavailable.');
  }
  const livekit = livekitModule || await import('livekit-server-sdk');
  const httpUrl = url.replace(/^wss:/u, 'https:');
  const roomClient = new livekit.RoomServiceClient(httpUrl, apiKey, apiSecret);
  const dispatchClient = new livekit.AgentDispatchClient(httpUrl, apiKey, apiSecret);
  const bounded = (operation) => withDeadline(operation, {
    timeoutMs: Math.max(1, Math.min(NO_RETRY.timeoutMs, Number(operationTimeoutMs) || 0)),
    clock,
  });
  return Object.freeze({
    signalOrigin: parsed.origin,
    room: Object.freeze({
      async create() {
        const roomName = opaqueName('ivprep');
        await bounded(() => roomClient.createRoom({ name: roomName, emptyTimeout: 60, maxParticipants: 4 }));
        return { roomName };
      },
      async delete({ roomName }) {
        await bounded(() => roomClient.deleteRoom(roomName));
      },
    }),
    participant: Object.freeze({
      async issue({ roomName, participantIdentity, maxSeconds }) {
        if (!/^[A-Za-z0-9._:-]{1,120}$/u.test(String(roomName || ''))
          || !/^[A-Za-z0-9._:-]{1,120}$/u.test(String(participantIdentity || ''))
          || !Number.isInteger(maxSeconds)
          || maxSeconds < 1
          || maxSeconds > 59) {
          throw new Error('Scoped LiveKit participant authority is invalid.');
        }
        const token = new livekit.AccessToken(apiKey, apiSecret, {
          identity: participantIdentity,
          ttl: maxSeconds + 30,
        });
        token.addGrant({
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canPublishData: false,
          canSubscribe: true,
        });
        return {
          url: parsed.origin,
          token: await bounded(() => token.toJwt()),
          participantIdentity,
        };
      },
    }),
    dispatch: Object.freeze({
      async create({ roomName, reservationNonce, agentName, restartPolicy }) {
        if (restartPolicy !== 'JRP_NEVER' || !agentName || !/^[a-f0-9]{64}$/u.test(String(reservationNonce || ''))) {
          throw new Error('Explicit no-restart dispatch authority is required.');
        }
        const created = await bounded(() => dispatchClient.createDispatch(roomName, agentName, {
          metadata: reservationNonce,
          restartPolicy: livekit.JobRestartPolicy.JRP_NEVER,
        }));
        return { dispatchId: created.id };
      },
      async delete({ dispatchId, roomName }) {
        await bounded(() => dispatchClient.deleteDispatch(dispatchId, roomName));
      },
    }),
    retry: NO_RETRY,
  });
}

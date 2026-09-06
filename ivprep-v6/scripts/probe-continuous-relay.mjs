import WebSocket from 'ws';

const ORIGIN = process.env.IVPREP_PROBE_ORIGIN || 'http://127.0.0.1:8320';
const TIMEOUT_MS = 30_000;

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${payload.code || 'unknown'}`);
  return payload;
}

const started = await request('/api/alpha-sessions/start', {
  method: 'POST',
  body: {
    testIdentity: `synthetic-relay-${Date.now()}`,
    durationMinutes: 2,
    selectedInterviewer: 'senior-academic-pd-male',
    model: 'gpt-realtime-2.1',
    voice: 'cedar',
    avatar: null,
    behavior: 'direct-program-director',
    mode: 'voice-only',
  },
});

const summary = {
  exactModel: null,
  exactVoice: null,
  railReady: false,
  responseStarted: false,
  audioDeltaObserved: false,
  transcriptObserved: false,
  responseCancelled: false,
  relayInterruptAcknowledged: false,
  providerErrors: [],
  sessionClosed: false,
};

try {
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`${ORIGIN.replace(/^http/u, 'ws')}/api/conversation-rail`, { origin: ORIGIN });
    const timer = setTimeout(() => reject(new Error('Continuous relay probe timed out.')), TIMEOUT_MS);
    const finish = (error) => {
      clearTimeout(timer);
      if (socket.readyState < WebSocket.CLOSING) socket.close(1000, 'probe-complete');
      if (error) reject(error); else resolve();
    };
    socket.on('open', () => socket.send(JSON.stringify({
      type: 'start',
      alphaSessionId: started.session.id,
      model: 'gpt-realtime-2.1',
      voiceId: 'cedar',
      speed: 0.92,
      behaviorPresetId: 'direct-program-director',
      reasoningEffort: 'low',
      context: { specialty: 'Internal Medicine', interviewType: 'Residency interview', syntheticProbe: true },
    })));
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'rail_error') {
        summary.providerErrors.push(message.code || 'rail_error');
        finish(new Error(`Continuous relay returned ${message.code || 'rail_error'}.`));
        return;
      }
      if (message.type === 'rail_ready') {
        summary.railReady = true;
        summary.exactModel = message.health?.model || null;
        summary.exactVoice = message.health?.voiceId || null;
        socket.send(JSON.stringify({ type: 'input_text', text: 'A difficult experience taught me to ask for help earlier and communicate uncertainty directly.' }));
        return;
      }
      if (message.type === 'rail_interrupted') summary.relayInterruptAcknowledged = true;
      if (message.type !== 'rail_event') return;
      const event = message.event || {};
      if (event.type === 'response_started') summary.responseStarted = true;
      if (event.type === 'assistant_transcript_delta' && event.delta) summary.transcriptObserved = true;
      if (event.type === 'audio_delta' && event.delta) {
        summary.audioDeltaObserved = true;
        socket.send(JSON.stringify({ type: 'interrupt', itemId: event.itemId, playedMs: 40, cancel: true }));
      }
      if (event.type === 'response_cancelled') summary.responseCancelled = true;
      if (summary.responseCancelled && summary.relayInterruptAcknowledged) finish();
    });
    socket.on('error', finish);
  });
} finally {
  const ended = await request(`/api/alpha-sessions/${started.session.id}/end`, {
    method: 'POST', body: { terminationState: 'synthetic-probe-completed' },
  });
  summary.sessionClosed = ended.session?.state === 'ended';
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

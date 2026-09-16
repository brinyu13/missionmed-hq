import { createM1ViewModel } from './adapters/m1-view-model.mjs';

const origin = performance.now();
const clock = { now: () => Math.max(0, Math.round(performance.now() - origin)) };
const events = [];
const sessionId = `m1-${crypto.randomUUID()}`;
const model = createM1ViewModel({ sessionId, mediaId: `${sessionId}:media`, clock, eventSink: (event) => events.push(event), onChunk: async () => {} });

const elements = {
  video: document.querySelector('video'),
  start: document.querySelector('[data-start]'),
  stop: document.querySelector('[data-stop]'),
  status: document.querySelector('[data-status]'),
  signalList: document.querySelector('[data-signals]'),
  clock: document.querySelector('[data-clock]'),
};

function render(state) {
  elements.status.textContent = state.phase.replaceAll('_', ' ');
  elements.status.dataset.phase = state.phase;
  elements.start.disabled = !['idle', 'preflight'].includes(state.phase);
  elements.stop.disabled = state.phase !== 'live';
  elements.signalList.replaceChildren(...Object.entries(state.signals).map(([id, signal]) => {
    const row = document.createElement('li');
    const value = signal.last_sample?.value;
    row.innerHTML = `<span>${id}</span><strong>${value ? Object.values(value).filter((item) => item !== null).slice(0, 1)[0] ?? '—' : '—'}</strong><em data-availability="${signal.availability}">${signal.availability.replaceAll('_', ' ')}</em>`;
    return row;
  }));
  if (state.stream && elements.video.srcObject !== state.stream) { elements.video.srcObject = state.stream; elements.video.play().catch(() => {}); }
  if (!state.stream) elements.video.srcObject = null;
}

model.subscribe(render);
await model.preflight();
elements.start.addEventListener('click', () => model.start());
elements.stop.addEventListener('click', async () => { const result = await model.stop(); console.info('M1 local result', { media: result.media, event_count: events.length }); });
setInterval(() => { elements.clock.textContent = `${(clock.now() / 1000).toFixed(1)} s`; }, 100);

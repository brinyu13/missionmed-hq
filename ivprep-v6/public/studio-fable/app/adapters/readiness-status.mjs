// Room readiness lines: a presentation-only projection of the EXISTING readiness
// state the room already publishes (stage[data-preview-ready], the Connect button,
// the readiness note). It never admits capture itself and never enables Start.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CAMERA_WORDS = /camera|preview|frame|video|black|visible|render/i;
const MICROPHONE_WORDS = /microphone|\bmic\b|audio|input|sound|silent|muted/i;
const GLYPH = { ready: '✓', checking: '…', attention: '!', idle: '·' };

export function projectReadinessLines({ previewReady = false, checking = false, note = '', rechecked = false, mode = 'practice', liveInterviewAvailable = false } = {}) {
  const message = String(note || '').trim();
  const idle = rechecked ? 'Not confirmed · check the preview again' : 'Not connected yet';
  const row = (id, readyText, checkingText, attentionText, words) => {
    if (previewReady) return { id, state: 'ready', text: readyText };
    if (checking) return { id, state: 'checking', text: checkingText };
    if (message && words.test(message)) return { id, state: 'attention', text: attentionText };
    return { id, state: 'idle', text: idle };
  };
  const camera = row('camera', 'Camera visible', 'Checking camera…', 'Camera needs attention', CAMERA_WORDS);
  const microphone = row('microphone', 'Microphone ready', 'Checking microphone…', 'Microphone needs attention', MICROPHONE_WORDS);
  const interviewer = mode === 'mock'
    ? (liveInterviewAvailable === true ? { id: 'interviewer', state: 'ready', text: 'Interviewer joins when you start' } : { id: 'interviewer', state: 'attention', text: 'Live interviewer unavailable for this account' })
    : { id: 'interviewer', state: 'ready', text: 'Self practice · no interviewer' };
  return [camera, microphone, interviewer];
}

export function readinessLinesMarkup(lines = projectReadinessLines()) {
  return `<ul class="readiness-lines" id="readiness-lines" aria-label="Readiness">${lines.map(line => `<li data-readiness-line="${esc(line.id)}" data-state="${esc(line.state)}"><i aria-hidden="true">${GLYPH[line.state] || '·'}</i><span>${esc(line.text)}</span></li>`).join('')}</ul>`;
}

/**
 * Paint the three lines from the room's own DOM state and keep the readiness
 * device pickers open while the room is in its readiness phase.
 */
export function mountReadinessLines(host, { room, stage, note, connect, devices = null, mode = 'practice', liveInterviewAvailable = false, MutationObserverCtor = globalThis.MutationObserver } = {}) {
  if (!host || !stage || !connect) return () => {};
  const read = () => ({
    previewReady: stage.dataset?.previewReady === 'true',
    checking: connect.disabled === true && stage.dataset?.previewReady !== 'true',
    note: note?.hidden ? '' : (note?.textContent || ''),
    rechecked: /again/i.test(connect.textContent || ''),
    mode, liveInterviewAvailable,
  });
  const paint = () => {
    const lines = projectReadinessLines(read());
    for (const line of lines) {
      const row = host.querySelector?.(`[data-readiness-line="${line.id}"]`);
      if (!row) continue;
      if (row.dataset) row.dataset.state = line.state; else row.setAttribute?.('data-state', line.state);
      const glyph = row.querySelector?.('i'), text = row.querySelector?.('span');
      if (glyph) glyph.textContent = GLYPH[line.state] || '·';
      if (text) text.textContent = line.text;
    }
    if (devices && room?.dataset?.phase === 'readiness' && devices.open !== true) devices.open = true;
  };
  paint();
  let observer = null;
  if (typeof MutationObserverCtor === 'function') {
    observer = new MutationObserverCtor(paint);
    observer.observe(stage, { attributes: true, attributeFilter: ['data-preview-ready'] });
    observer.observe(connect, { attributes: true, attributeFilter: ['disabled'], childList: true, characterData: true, subtree: true });
    if (note) observer.observe(note, { attributes: true, attributeFilter: ['hidden'], childList: true, characterData: true, subtree: true });
    if (room) observer.observe(room, { attributes: true, attributeFilter: ['data-phase'] });
  }
  return () => { observer?.disconnect?.(); observer = null; };
}

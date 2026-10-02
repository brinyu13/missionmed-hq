// Display adapter inspired by the 3466C shared-clock recorder. No media ownership.
// Scalars only; observation clock is anchored to the actual recorder, not captions.
const scalar = value => Number.isFinite(value) ? Number(value.toFixed(2)) : null;
export class MeasurementTimeline {
  constructor() { this.reset(); }
  reset() { this.points = []; this.last = {}; this.truncated = false; }
  ingest(detail, metrics, atMs) {
    if (!['audio', 'vision'].includes(detail?.modality) || !Number.isFinite(atMs) || atMs < 0) return false;
    const lane = detail.modality === 'audio' ? 'voice' : 'delivery';
    if (atMs - (this.last[lane] ?? -Infinity) < 1000) return false;
    this.last[lane] = atMs;
    const point = { atMs: Math.round(atMs), lane };
    if (lane === 'voice') Object.assign(point, {
      level: metrics.VOICE_LEVEL?.available ? scalar(metrics.VOICE_LEVEL.dbfs) : null,
      pitch: metrics.PITCH?.available && metrics.PITCH.voiced ? scalar(metrics.PITCH.f0Hz) : null,
      speaking: detail.available === false ? null : detail.speaking === true,
    });
    else Object.assign(point, {
      facing: metrics.FRAMING?.available ? metrics.FRAMING.cameraFacing : null,
      hands: metrics.HANDS?.available ? Number(metrics.HANDS.left) + Number(metrics.HANDS.right) : null,
      movement: metrics.HANDS?.available ? metrics.HANDS.moving === true : null,
      mouth: metrics.FACE?.available ? metrics.FACE.smileActive : null,
      smile: metrics.FACE?.available ? metrics.FACE.smilePatternActive : null,
    });
    this.points.push(Object.freeze(point));
    if (this.points.length > 1800) { this.points.shift(); this.truncated = true; }
    return true;
  }
  snapshot() { return { schema: 'ivoc.measurement-timeline.v1', clock: 'recording-observed', sampleIntervalMs: 1000, truncated: this.truncated, points: [...this.points] }; }
}

export function timelineValueAt(points, lane, atMs) {
  const point = [...points].reverse().find(p => p.lane === lane && p.atMs <= atMs);
  return point && atMs - point.atMs <= 1800 ? point : null;
}

const LANES = [
  ['level', 'Voice level', 'voice', v => (v + 60) / 60],
  ['pitch', 'Pitch · Hz', 'voice', v => Math.log2(Math.max(50, v) / 50) / 4],
  ['speaking', 'Speech / silence', 'voice', v => Number(v)],
  ['facing', 'Head facing camera', 'delivery', v => Number(v)],
  ['hands', 'Hands in view', 'delivery', v => v / 2],
  ['movement', 'Hand-region movement', 'delivery', v => Number(v)],
  ['mouth', 'Mouth-corner elevation', 'delivery', v => Number(v)],
  ['smile', 'Qualified smile pattern', 'delivery', v => Number(v)],
];
const clock = ms => Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0');
const playbackBindings = new WeakMap();
export function renderMeasurementTimeline(host, snapshot, { playback = null, compact = false } = {}) {
  if (!host) return;
  playbackBindings.get(host)?.();
  playbackBindings.delete(host);
  const points = Array.isArray(snapshot?.points) ? snapshot.points : [];
  const end = Math.max(1000, ...points.map(p => p.atMs));
  const start = compact ? Math.max(0, end - 60000) : 0;
  const doc = host.ownerDocument;
  host.replaceChildren();
  const title = doc.createElement('div'); title.className = 'housing-title';
  title.textContent = 'Flight Recorder · ' + clock(start) + ' — ' + clock(end);
  const note = doc.createElement('p'); note.className = 'timeline-note';
  note.textContent = points.length
    ? 'Measured observations · gaps mean no evidence. Head orientation is not eye gaze. Mouth movement is not emotion.' + (snapshot.truncated ? ' Earlier samples omitted by the bounded history limit.' : '')
    : 'Your measured history will appear here. No readings are invented.';
  host.append(title, note);
  for (const [key, label, lane, scale] of LANES) {
    const row = doc.createElement('div'); row.className = 'timeline-row';
    const name = doc.createElement('span'); name.textContent = label;
    const track = doc.createElement('div'); track.className = 'timeline-track'; track.setAttribute('aria-label', label);
    const available = points.filter(p => p.lane === lane && p.atMs >= start && p[key] != null);
    if (!available.length) { track.textContent = 'Not measured'; track.classList.add('timeline-empty'); }
    for (const point of available) {
      const mark = doc.createElement(playback ? 'button' : 'span');
      mark.className = 'timeline-mark';
      const value = point[key];
      mark.title = label + ': ' + value + ' · ' + clock(point.atMs);
      mark.style.left = (100 * (point.atMs - start) / (end - start || 1)) + '%';
      mark.style.height = (4 + Math.max(0, Math.min(1, scale(value))) * 18) + 'px';
      if (playback) {
        mark.type = 'button'; mark.setAttribute('aria-label', mark.title);
        mark.addEventListener('click', () => { playback.currentTime = Math.max(0, point.atMs / 1000 - .5); });
      }
      track.append(mark);
    }
    row.append(name, track); host.append(row);
  }
  if (playback && points.length) {
    const cursors = [...host.querySelectorAll('.timeline-track')].map(track => {
      const cursor = doc.createElement('span'); cursor.className = 'timeline-playhead';
      cursor.setAttribute('aria-hidden', 'true'); track.append(cursor); return cursor;
    });
    const sync = () => {
      const atMs = playback.currentTime * 1000;
      for (const cursor of cursors) {
        cursor.hidden = atMs < start || atMs > end;
        cursor.style.left = (100 * Math.max(0, Math.min(1, (atMs - start) / (end - start || 1)))) + '%';
      }
      title.textContent = 'Flight Recorder · ' + clock(atMs) + ' / ' + clock(end);
    };
    playback.addEventListener('timeupdate', sync);
    playback.addEventListener('seeked', sync);
    playbackBindings.set(host, () => {
      playback.removeEventListener('timeupdate', sync);
      playback.removeEventListener('seeked', sync);
    });
    sync();
  }
}

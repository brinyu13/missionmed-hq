// Presentation adapter only. Never feed provider fragments into canonical
// answer ranges, coaching eligibility, media seeking, or conversation state.
export function buildLiveTranscriptReview(session) {
  const value = session?.liveTranscript;
  if (!session?.id || value?.sessionId !== session.id || value.schema !== 'ivoc.server-transcript-review.v1'
    || value.provenance !== 'SERVER_OBSERVED' || value.timingBasis !== 'PROVIDER_SESSION_APPROXIMATE'
    || value.speechBoundaries !== 'UNVERIFIED' || value.heardAudio !== 'UNVERIFIED'
    || value.candidateIdentity !== 'UNVERIFIED') return null;
  if (value.status === 'UNAVAILABLE') return value.reason === 'READ_UNAVAILABLE'
    ? { title: 'Conversation transcript', notice: 'The saved transcript could not be loaded. Your recording is still available; reopen this attempt to try again.', observations: [] }
    : null;
  if (value.status !== 'AVAILABLE' || !Array.isArray(value.observations)
    || !value.observations.length || value.observations.length > 4) return null;
  const observations = [];
  let bytes = 0;
  for (const observation of value.observations) {
    if (observation?.ordinal !== observations.length + 1 || !['PROVIDER_CLOSED', 'INCOMPLETE'].includes(observation.status)
      || !Array.isArray(observation.fragments) || observation.fragments.length > 8192) return null;
    const rows = [];
    for (let i = 0; i < observation.fragments.length; i++) {
      const fragment = observation.fragments[i];
      if (fragment?.sequence !== i + 2 || !['student', 'interviewer'].includes(fragment.speaker)
        || typeof fragment.text !== 'string' || new TextEncoder().encode(fragment.text).length > 16384
        || !Number.isSafeInteger(fragment.providerStartMs) || fragment.providerStartMs < 0
        || !Number.isSafeInteger(fragment.providerEndMs) || fragment.providerEndMs < fragment.providerStartMs
        || fragment.providerEndMs > 86400000) return null;
      bytes += new TextEncoder().encode(fragment.text).length;
      if (bytes > 2 * 1024 * 1024) return null;
      // Adjacent same-speaker fragments are grouped for reading only. Preserve
      // whitespace, repeats and arrival sequence, including full-duplex overlap.
      const prior = rows.at(-1);
      if (prior && prior.speaker === fragment.speaker && prior.text.length + fragment.text.length <= 4000) {
        prior.text += fragment.text;
        prior.providerStartMs = Math.min(prior.providerStartMs, fragment.providerStartMs);
        prior.providerEndMs = Math.max(prior.providerEndMs, fragment.providerEndMs);
      } else rows.push({ speaker: fragment.speaker, text: fragment.text,
        providerStartMs: fragment.providerStartMs, providerEndMs: fragment.providerEndMs });
    }
    observations.push({ ordinal: observation.ordinal, partial: observation.status !== 'PROVIDER_CLOSED', rows });
  }
  return { title: 'Conversation transcript',
    notice: 'Automatically transcribed; may contain errors. Times are approximate from the start of the AI connection, not the recording. Text is not a seek target or an answer score. Interrupted interviewer text may include words you did not hear; use the recording to confirm.',
    observations };
}

export function renderLiveTranscriptReview(host, model, { document, speakerLabel } = {}) {
  if (!host || !model || !document) return false;
  const node = (tag, className, text) => {
    const item = document.createElement(tag); item.className = className; item.textContent = text; return item;
  };
  host.replaceChildren(node('div', 'microcap', model.title), node('p', 'canon-muted', model.notice));
  for (const observation of model.observations) {
    host.append(node('p', 'microcap', `${model.observations.length > 1 ? `Connection ${observation.ordinal} · ` : ''}${observation.partial ? 'Partial transcript — capture did not finish cleanly' : 'Saved transcript fragments'}`));
    if (!observation.rows.length) { host.append(node('p', 'canon-muted', 'No speech text was saved for this connection.')); continue; }
    const list = node('div', 'long-rows', '');
    const more = node('button', 'btn btn-quiet', 'Show more transcript'); more.type = 'button';
    let cursor = 0;
    const appendPage = () => {
      for (const row of observation.rows.slice(cursor, cursor + 100)) {
        const item = node('div', 'long-row', '');
        const text = node('span', '', `${speakerLabel?.(row.speaker) || row.speaker} · ${row.text}`);
        text.style.whiteSpace = 'pre-wrap';
        item.append(node('strong', '', `≈ ${(row.providerStartMs / 1000).toFixed(1)}s`), text);
        list.append(item);
      }
      cursor += 100;
      more.hidden = cursor >= observation.rows.length;
    };
    more.addEventListener('click', appendPage);
    appendPage(); host.append(list, more);
  }
  return true;
}

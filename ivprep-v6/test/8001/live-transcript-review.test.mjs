import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildLiveTranscriptReview, renderLiveTranscriptReview } from '../../public/studio/live-transcript-review.mjs';
import { buildCandidateAnalysisState, persistedConversationTurns } from '../../public/studio/presentation-view-model.mjs';
const fragment = (sequence, speaker, text) => ({ sequence, speaker, text, providerStartMs: 500, providerEndMs: 900 });
const detail = (fragments = [fragment(2, 'interviewer', 'What'), fragment(3, 'interviewer', '  happened?'), fragment(4, 'student', ' I tried.')]) => ({
  id: 'session-1', liveTranscript: { schema: 'ivoc.server-transcript-review.v1', sessionId: 'session-1', status: 'AVAILABLE',
    provenance: 'SERVER_OBSERVED', timingBasis: 'PROVIDER_SESSION_APPROXIMATE', speechBoundaries: 'UNVERIFIED',
    heardAudio: 'UNVERIFIED', candidateIdentity: 'UNVERIFIED', observations: [{ ordinal: 1, status: 'PROVIDER_CLOSED', fragments }] },
});
test('groups display fragments without trimming, inventing turn completion or promoting coaching/seek evidence', () => {
  const session = detail(); const model = buildLiveTranscriptReview(session);
  assert.deepEqual(model.observations[0].rows.map(r => r.text), ['What  happened?', ' I tried.']);
  assert.match(model.notice, /not the recording/); assert.match(model.notice, /may include words you did not hear/);
  assert.deepEqual(persistedConversationTurns({ sessionDetail: session }), []);
  assert.equal(buildCandidateAnalysisState(session).available, false);
  assert.doesNotMatch(JSON.stringify(model), /canonical|seekMs|answerId|turnId/);
  assert.equal(session.liveTranscript.observations[0].fragments.length, 3);
});
test('mismatched identity, provenance, timing, inferred claims and malformed fragments cannot render', () => {
  for (const patch of [{ sessionId: 'foreign' }, { provenance: 'BROWSER_DECLARED' }, { timingBasis: 'RECORDING' },
    { speechBoundaries: 'VERIFIED' }, { heardAudio: 'VERIFIED' }, { candidateIdentity: 'VERIFIED' }]) {
    const session = detail(); Object.assign(session.liveTranscript, patch); assert.equal(buildLiveTranscriptReview(session), null);
  }
  for (const patch of [{ sequence: 5 }, { text: null }, { speaker: 'other' }, { providerStartMs: null }, { providerEndMs: -1 }]) {
    assert.equal(buildLiveTranscriptReview(detail([{ ...fragment(2, 'student', 'test'), ...patch }])), null);
  }
});
test('partial text is labeled and read failure is not an empty successful transcript', () => {
  const session = detail(); session.liveTranscript.observations[0].status = 'INCOMPLETE';
  assert.equal(buildLiveTranscriptReview(session).observations[0].partial, true);
  session.liveTranscript.status = 'UNAVAILABLE'; session.liveTranscript.reason = 'READ_UNAVAILABLE';
  assert.match(buildLiveTranscriptReview(session).notice, /could not be loaded/);
  session.liveTranscript.reason = 'NOT_CAPTURED'; assert.equal(buildLiveTranscriptReview(session), null);
});
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.listeners = {}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
test('actual renderer uses plain text, non-seekable rows and bounded expand-on-request pagination', () => {
  const doc = { createElement: tag => new Element(tag) }, host = new Element('div');
  const fragments = Array.from({ length: 201 }, (_, i) => fragment(i + 2, i % 2 ? 'student' : 'interviewer', '<img onerror=bad>'));
  renderLiveTranscriptReview(host, buildLiveTranscriptReview(detail(fragments)), { document: doc, speakerLabel: s => s === 'student' ? 'You' : 'Interviewer' });
  const list = host.children.find(c => c.className === 'long-rows');
  const more = host.children.at(-1);
  assert.equal(list.children.length, 100); assert.equal(more.hidden, false);
  assert.equal(list.children[0].tag, 'div'); assert.deepEqual(list.children[0].listeners, {});
  assert.equal(list.children[0].children[1].textContent, 'Interviewer · <img onerror=bad>');
  assert.equal(list.children[0].children[1].style.whiteSpace, 'pre-wrap');
  more.listeners.click(); assert.equal(list.children.length, 200);
  more.listeners.click(); assert.equal(list.children.length, 201); assert.equal(more.hidden, true);
});

test('actual Film Room retains earlier authorized transcript separately when server read fails or has no fragments', () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('function renderFilmRoomSpine('), source.indexOf('\nlet playbackReviewRequest'));
  for (const reason of ['READ_UNAVAILABLE', 'EMPTY_CAPTURE', 'NOT_CAPTURED']) {
    const session = detail([]);
    if (reason !== 'EMPTY_CAPTURE') Object.assign(session.liveTranscript, { status: 'UNAVAILABLE', reason });
    session.results = { payload: { liveConversation: { turns: [{ speaker: 'student', text: 'Earlier saved answer', startMs: 1000 }] } } };
    const host = new Element('div'), doc = { createElement: tag => new Element(tag) };
    const render = new Function('$', 'state', 'document', 'buildLiveTranscriptReview', 'renderLiveTranscriptReview',
      'persistedConversationTurns', 'buildCandidateAnalysisState', 'reviewTurnSpeakerLabel', `${fn}; return renderFilmRoomSpine;`)(
      selector => selector === '#filmroom-spine' ? host : null, { role: 'student' }, doc,
      buildLiveTranscriptReview, renderLiveTranscriptReview, persistedConversationTurns, buildCandidateAnalysisState, () => 'You');
    render(session);
    const all = node => [node, ...node.children.flatMap(all)];
    const nodes = all(host);
    assert.ok(nodes.some(n => n.textContent === 'You · Earlier saved answer'), reason);
    if (reason !== 'NOT_CAPTURED') assert.ok(nodes.some(n => /separate approximate recording offsets/u.test(n.textContent)), reason);
    if (reason === 'READ_UNAVAILABLE') assert.ok(nodes.some(n => /could not be loaded/u.test(n.textContent)));
    if (reason === 'EMPTY_CAPTURE') assert.ok(nodes.some(n => /No speech text was saved/u.test(n.textContent)));
  }
});

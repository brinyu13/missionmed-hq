import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('let vaultRenderId = 0;'), source.indexOf('/* ------------------------------------------------------------------ analytics mount */'));
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  setAttribute(name, value) { this[name] = value; }
}
const all = n => [n, ...n.children.flatMap(all)];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const detail = id => ({ id, recording: { id: `r-${id}`, status: 'saved' }, results: { payload: { analytics: { answerId: id } } } });
function harness({ readLibrary, readSession, sign, play } = {}) {
  const host = new Element('div');
  const events = [];
  const video = { pause: () => events.push('pause'), play: async () => { events.push('play'); return play?.(); },
    set src(value) { events.push(`src:${value}`); } };
  const rows = ['a', 'b'].map(id => ({ id, questionId: id, questionText: `Question ${id}`, state: 'complete', results: {}, recording: { id: `r-${id}`, status: 'saved' } }));
  const state = { view: 'vault', role: 'student', admission: { identity: { subject: 'wp:1' } },
    durableAvailable: true, vaultFilter: { query: '', evidence: 'all' }, lastSaved: null,
    durable: {
      library: async scope => { assert.equal(scope, 'own'); return readLibrary ? readLibrary() : { sessions: rows }; },
      api: { session: async id => { events.push(`read:${id}`); return readSession ? readSession(id) : detail(id); },
        abandonSession: async () => events.push('abandon') },
      playback: async id => { events.push(`sign:${id}`); return sign ? sign(id) : { url: `https://private.invalid/${id}` }; },
    },
    filmGroups: { ingestResult: () => events.push('analytics') },
  };
  const controls = new Function('state', '$', 'document', 'buildLongitudinalModel', 'presentFilmRoomAnalytics',
    'renderPostAnswer', 'renderContextEvidence', 'contextResultFromSessionSpine', 'renderFilmRoomSpine',
    `let adminReviewViewGeneration=0;
    const setView = view => { if(state.view!==view) adminReviewViewGeneration++; state.view=view; };
    ${code}; return { render: renderVault, navigate: setView, changeRole: role => { state.role=role; vaultActionId++; },
      refresh: renderVault };`)(state, selector => selector === '#vault-body' ? host : video,
    { createElement: tag => new Element(tag) }, () => ({}), value => value,
    () => events.push('results'), () => events.push('context'), value => value, () => events.push('spine'));
  return { state, rows, host, events, ...controls,
    buttons: label => all(host).filter(n => n.tag === 'button' && n.innerHTML?.includes(label)) };
}

test('actual Library Review retains latest selection when responses finish out of order', async () => {
  const a = deferred(), b = deferred();
  const h = harness({ readSession: id => (id === 'a' ? a : b).promise });
  await h.render();
  const [first, second] = h.buttons('Review answer');
  const pa = first.listeners.click(), pb = second.listeners.click();
  b.resolve(detail('b')); await pb;
  a.resolve(detail('a')); await pa;
  assert.equal(h.state.lastSaved.session.id, 'b');
  assert.equal(h.state.view, 'postanswer');
  assert.equal(h.events.filter(e => e === 'results').length, 1);
});

test('actual Library discards Review across navigation, role, actor, admission, durable, refresh and filter changes', async () => {
  for (const change of [h => h.navigate('home'), h => { h.navigate('home'); h.navigate('vault'); },
    h => h.changeRole('admin'), h => { h.changeRole('mentor'); h.changeRole('student'); },
    h => { h.state.admission.identity.subject = 'wp:2'; }, h => { h.state.admission = { identity: { subject: 'wp:1' } }; },
    h => { h.state.durable = { ...h.state.durable }; }, h => h.refresh(),
    h => { const input = all(h.host).find(n => n.tag === 'input'); input.value = 'Question b'; input.listeners.input(); },
  ]) {
    const pending = deferred(); const h = harness({ readSession: () => pending.promise });
    await h.render(); const completion = h.buttons('Review answer')[0].listeners.click();
    await change(h); pending.resolve(detail('a')); await completion;
    assert.equal(h.state.lastSaved, null);
    assert.ok(!h.events.includes('results'));
  }
});

test('actual Library load and stale detached controls cannot cross account boundaries', async () => {
  const pending = deferred(); const h = harness({ readLibrary: () => pending.promise });
  const render = h.render(); h.state.admission.identity.subject = 'wp:2';
  pending.resolve({ sessions: h.rows }); await render;
  assert.equal(h.buttons('Review answer').length, 0);
  const current = harness(); await current.render(); const old = current.buttons('Review answer')[0];
  await current.refresh(); await old.listeners.click();
  assert.equal(current.events.length, 0);
});

test('actual Library validates returned session/owner and recording identity before rendering or signing', async () => {
  for (const bad of [null, { ...detail('a'), id: 'foreign' }, { ...detail('a'), ownerSubject: 'wp:2' }]) {
    const h = harness({ readSession: async () => bad }); await h.render();
    const action = h.buttons('Review answer')[0]; await action.listeners.click();
    assert.equal(h.state.lastSaved, null); assert.match(action.innerHTML, /Unavailable/);
    assert.deepEqual(h.events, ['read:a']);
  }
  for (const recording of [null, { id: 'r-foreign', status: 'saved' }, { id: 'r-a', status: 'processing' }]) {
    const h = harness({ readSession: async () => ({ ...detail('a'), recording }) }); await h.render();
    await h.buttons('Play')[0].listeners.click();
    assert.equal(h.state.lastSaved, null); assert.deepEqual(h.events, ['read:a']);
  }
});

test('actual Library stale Play causes no media sink or navigation and shares Review action generation', async () => {
  const pending = deferred(); const h = harness({ sign: () => pending.promise }); await h.render();
  const obsolete = h.buttons('Play')[0].listeners.click();
  await Promise.resolve();
  await h.buttons('Review answer')[1].listeners.click();
  pending.resolve({ url: 'https://private.invalid/obsolete' }); await obsolete;
  assert.equal(h.state.lastSaved.session.id, 'b'); assert.equal(h.state.view, 'postanswer');
  assert.ok(!h.events.some(e => e === 'play' || e === 'pause' || e.startsWith('src:')));
});

test('actual Library navigates before Play wait; late play resolution cannot drag user back', async () => {
  const pending = deferred(); const h = harness({ play: () => pending.promise }); await h.render();
  const playing = h.buttons('Play')[0].listeners.click();
  for (let i=0;i<5;i++) await Promise.resolve();
  assert.equal(h.state.view, 'filmroom'); assert.equal(h.state.lastSaved.session.id, 'a');
  assert.ok(h.events.includes('src:https://private.invalid/r-a'));
  h.navigate('home'); pending.resolve(); await playing;
  assert.equal(h.state.view, 'home');
});

test('actual Library errors are bounded and stale rejections cannot replace current controls', async () => {
  const pending = deferred(); const h = harness({ readSession: () => pending.promise }); await h.render();
  const action = h.buttons('Review answer')[0]; const completion = action.listeners.click();
  h.navigate('home'); pending.reject(new Error('private diagnostic')); await completion;
  assert.equal(action.innerHTML, '<span>Review answer</span>');
  const fail = harness({ readSession: async () => { throw new Error('private diagnostic'); } }); await fail.render();
  const retry = fail.buttons('Review answer')[0]; await retry.listeners.click();
  assert.match(retry.innerHTML, /Unavailable/); assert.doesNotMatch(retry.title, /private diagnostic/);
  assert.equal(retry.disabled, false);
});

test('actual Library exposes normal Matrix sign-in recovery without internal authentication diagnostics', async () => {
  for (const message of ['ivprep_authentication_required', 'ivoc_authentication_required', 'private database diagnostic']) {
    const h = harness({ readLibrary: async () => { throw new Error(message); } });
    await h.render();
    const text = all(h.host).map(n => n.textContent || '').join(' ');
    assert.doesNotMatch(text, /ivprep_|ivoc_|private database/);
    const links = all(h.host).filter(n => n.tag === 'a');
    assert.equal(links.length, message.includes('authentication_required') ? 1 : 0);
    if (links.length) {
      assert.equal(links[0].href, 'https://missionmedinstitute.com/member-dashboard/');
      assert.match(text, /sign in again/i);
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/missionaccounts-auth.js', import.meta.url), 'utf8')).replaceAll('export ', '');
const start = Date.parse('2026-09-16T12:00:00Z');

function token(nowMs, claims = {}) {
  const body = { sub: 'student-fixture', wp_user_id: 17, student_id: 'student-fixture', app_role: 'student', exp: Math.floor(nowMs / 1000) + 3600, ...claims };
  return `fixture.${Buffer.from(JSON.stringify(body)).toString('base64url')}.fixture`;
}

function harness() {
  let nowMs = start;
  let mode = 'ok';
  let nextClaims = {};
  let timerId = 0;
  const timers = new Map();
  const locks = [];
  const credentials = [];
  const events = {};
  class FakeDate extends Date { static now() { return nowMs; } }
  const window = {
    addEventListener(name, fn) { events[name] = fn; },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, at: nowMs + Number(ms || 0) }); return id; },
    clearTimeout(id) { timers.delete(id); },
    location: { origin: 'https://missionmed.invalid', href: 'https://missionmed.invalid/missionaccounts/', assign() {}, reload() {} },
  };
  const fetcher = async url => {
    if (mode === 'offline') throw Object.assign(new Error('fixture network unavailable'), { code: 'network_error' });
    if (mode === 'denied') return new Response(JSON.stringify({ success: false, data: { code: 'session_revoked', state: 'session_ended', message: 'Session ended.' } }), { status: 401 });
    if (String(url).includes('admin-ajax')) return new Response(JSON.stringify({ success: true, data: { token_endpoint: 'https://missionmed.invalid/token', nonce: 'fixture' } }), { status: 200 });
    return new Response(JSON.stringify({ token: token(nowMs, nextClaims), expires_at: Math.floor(nowMs / 1000) + 3600 }), { status: 200 });
  };
  const context = vm.createContext({ window, document: { addEventListener() {}, visibilityState: 'visible' }, URL, AbortController, Blob, FormData, Response, Date: FakeDate, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout, atob, fetch: fetcher });
  const factory = vm.runInContext(`${source}\ncreateMissionAccountsAuthClient`, context);
  const auth = factory({ onLockout: (...args) => locks.push(args), onCredentialState: state => credentials.push({ ...state }) });
  auth.configure({ basePath: '/missionaccounts/' });
  return {
    auth, locks, credentials, events,
    jump(ms) { nowMs += ms; },
    elapsed() { return nowMs - start; },
    async runNextTimer() {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      assert.ok(next, 'a credential refresh must remain scheduled');
      const [id, timer] = next;
      timers.delete(id);
      nowMs = Math.max(nowMs, timer.at);
      timer.fn();
      for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
    },
    setMode(value) { mode = value; },
    setClaims(value) { nextClaims = value; },
  };
}

test('a stable principal can refresh beyond 24 hours without losing the rendered session', async () => {
  const h = harness();
  h.auth.setToken(token(start));
  for (let refresh = 0; refresh < 31; refresh += 1) {
    await h.runNextTimer();
    assert.equal(h.auth.canMutate, true);
    assert.equal(h.auth.credentialStatus, 'ready');
  }
  assert.ok(h.elapsed() >= 24 * 60 * 60 * 1000, 'scheduled refresh coverage must exceed 24 hours');
  assert.equal(h.locks.length, 0);
  assert.ok(h.auth.token);
});

test('transient refresh loss preserves the workspace, pauses mutations when stale, and recovers', async () => {
  const h = harness();
  h.auth.setToken(token(start, { exp: Math.floor(start / 1000) + 60 }));
  h.jump(61 * 1000);
  h.setMode('offline');
  await assert.rejects(h.auth.exchange({ background: true }), /network unavailable/);
  assert.equal(h.locks.length, 0);
  assert.ok(h.auth.token);
  assert.equal(h.auth.canMutate, false);
  assert.equal(h.auth.credentialStatus, 'stale');
  h.setMode('ok');
  await h.auth.exchange({ background: true });
  assert.equal(h.auth.canMutate, true);
  assert.equal(h.auth.credentialStatus, 'ready');
  assert.equal(h.locks.length, 0);
});

test('authoritative revocation and changed principal still clear private access', async () => {
  const denied = harness();
  denied.auth.setToken(token(start));
  denied.setMode('denied');
  await assert.rejects(denied.auth.exchange({ background: true }), error => error.status === 401);
  assert.equal(denied.auth.token, '');
  assert.equal(denied.locks.length, 1);
  const changed = harness();
  changed.auth.setToken(token(start));
  changed.setClaims({ sub: 'different-student', wp_user_id: 99, student_id: 'different-student' });
  await assert.rejects(changed.auth.exchange({ background: true }), error => error.code === 'session_changed');
  assert.equal(changed.auth.token, '');
  assert.equal(changed.locks.at(-1)[0], 'session_changed');
});

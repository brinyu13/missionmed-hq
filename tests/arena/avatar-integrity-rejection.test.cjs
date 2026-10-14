#!/usr/bin/env node
// MX-ARENA-AVATAR-20261013 r4 — builder regression for the legacy "Upload Your Photo"
// flow (uploadArenaAvatar in LIVE/arena.html).
//
// Proves, with spies and NO network/DB/providers, that every non-verified outcome
// produces ZERO persistence calls, ZERO activation calls, ZERO raw-photo fallback,
// never reaches the 'done' (Avatar Ready / Character Unlocked) step, and returns no
// avatar URL — while a fully verified response still persists once, activates once
// and reaches 'done'. It also proves the hash sent for comparison is the SHA-256 of
// the exact bytes appended to the multipart request.
//
// Usage: node tests/arena/avatar-integrity-rejection.test.cjs [--source LIVE/arena.html] [--report out.json]
// Complements (does not replace) the independent harness tests/arena/avatar-integrity-path.test.cjs.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const sourcePath = opt('--source') || path.resolve(__dirname, '../../LIVE/arena.html');
const html = fs.readFileSync(sourcePath, 'utf8');

function slice(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  const b = html.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error('source boundary not found: ' + startMarker);
  return html.slice(a, b);
}
// Exact source under test: uploadArenaAvatar + its adjacent r4 helpers, and the payload extractors.
const uploadSource = slice('  async function uploadArenaAvatar(file){', '\n  async function handleAvatarSubmit');
const extractors = slice('  function extractAvatarUrlFromPayload(', '\n  function stripAvatarUrl');
const shaSource = slice('  async function sha256HexOfBlob(', '\n  window.refreshArenaAvatarFeatureCard');

const USER = '00000000-0000-4000-8000-0000000000aa';
const NEW_ID = '00000000-0000-4000-8000-0000000000bb';
const PHOTO_BYTES = Buffer.from('fable-synthetic-reference-photo');
const PHOTO_SHA = crypto.createHash('sha256').update(PHOTO_BYTES).digest('hex');
const file = { size: PHOTO_BYTES.length, type: 'image/jpeg', name: 'ref.jpg', arrayBuffer: async () => Uint8Array.from(PHOTO_BYTES).buffer };
const GOOD_URL = 'https://cdn.example.invalid/avatars/generated/x.png';
const validPayload = () => ({ success: true, avatar_url: GOOD_URL, source_photo_sha256: PHOTO_SHA, source_photo_bytes: file.size, identity_conditioned: true, engine: 'identity_openai' });

function makeEnv(spec) {
  const spy = { persist: [], activate: [], rawFallback: [], steps: [], statuses: [], toasts: [], appendedPhoto: null, fetches: 0, hydrate: 0 };
  const ctx = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    URL, Number, Math, String, Array, Promise, isFinite,
    window: { crypto: spec.noCrypto ? undefined : crypto.webcrypto, MM_USER: {} },
    document: { getElementById: () => ({ removeAttribute() {}, style: {}, classList: { toggle() {} } }) },
    FormData: class { append(k, v) { if (k === 'photo') spy.appendedPhoto = v; } },
    AVATAR_API_ENDPOINT: spec.noEndpoint ? '' : 'https://avatar.example.invalid/api/avatar',
    ArenaUser: { id: USER, wpUserId: '1', username: 'synthetic', displayName: 'synthetic', activeAvatarId: '' },
    avatarState: { gender: 'male', file, step: 'ready', previewUrl: 'blob:x' },
    latestGeneratedAvatarUrl: 'https://stale.example.invalid/old.png',
    lockAvatarRequestLock: () => true,
    unlockAvatarRequestLock() { ctx.unlocked = true; },
    normalizeAvatarUploadInput: (f) => f,
    normalizeAvatarGender: (g) => g,
    createAvatarUuid: () => NEW_ID,
    isUuid: (x) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x),
    setAvatarStep: (s) => { spy.steps.push(s); ctx.avatarState.step = s; },
    setAvatarModalStatus: (m, t) => spy.statuses.push({ m, t }),
    showToast: (m, t) => spy.toasts.push({ m, t }),
    setAvatarResult: (u) => { ctx.latestGeneratedAvatarUrl = u || ''; },
    logAvatarSupabase() {},
    fetch: async () => {
      spy.fetches += 1;
      if (spec.networkError) throw new Error('synthetic network failure');
      return { ok: !spec.httpFail, status: spec.httpFail ? 503 : 200, json: async () => { if (spec.badJson) throw new SyntaxError('bad json'); return spec.payload; } };
    },
    uploadAvatarAssetToR2ViaBackend: async (...a) => { spy.rawFallback.push(a); return { avatar_url: 'https://cdn.example.invalid/raw.png', avatar_id: NEW_ID }; },
    persistAvatarRecord: async (r) => { spy.persist.push(r); return { success: true, record: { ...r } }; },
    persistActiveAvatarSelection: async (id) => { spy.activate.push(id); return true; },
    hydrateAvatarState: async () => { spy.hydrate += 1; return { active: { id: spy.persist[0] ? spy.persist[0].id : '', avatar_url: GOOD_URL, thumbnail_url: GOOD_URL } }; },
    getActiveAvatarRecord: () => null,
    applyResolvedAvatarResult: (url) => { spy.steps.push('done'); return url; },
  };
  vm.createContext(ctx);
  vm.runInContext(extractors + '\n' + shaSource + '\n' + uploadSource + '\n', ctx);
  return { ctx, spy };
}

const rejectedCases = [
  ['hash_mismatch', { payload: { ...validPayload(), source_photo_sha256: 'b'.repeat(64) } }],
  ['hash_missing', { payload: { ...validPayload(), source_photo_sha256: undefined } }],
  ['hash_malformed', { payload: { ...validPayload(), source_photo_sha256: 'zz' } }],
  ['identity_false', { payload: { ...validPayload(), identity_conditioned: false } }],
  ['identity_missing', { payload: { ...validPayload(), identity_conditioned: undefined } }],
  ['identity_string_true', { payload: { ...validPayload(), identity_conditioned: 'true' } }],
  ['bytes_mismatch', { payload: { ...validPayload(), source_photo_bytes: file.size + 1 } }],
  ['bytes_missing', { payload: { ...validPayload(), source_photo_bytes: undefined } }],
  ['success_false', { payload: { ...validPayload(), success: false } }],
  ['success_missing', { payload: { ...validPayload(), success: undefined } }],
  ['error_field_present', { payload: { ...validPayload(), error: 'provider said no' } }],
  ['url_missing', { payload: { ...validPayload(), avatar_url: undefined } }],
  ['url_http', { payload: { ...validPayload(), avatar_url: 'http://cdn.example.invalid/x.png' } }],
  ['url_garbage', { payload: { ...validPayload(), avatar_url: 'not a url' } }],
  ['payload_null', { payload: null }],
  ['payload_array', { payload: [] }],
  ['payload_string', { payload: 'ok' }],
  ['json_unparseable', { payload: null, badJson: true }],
  ['http_503', { payload: { success: false, message: 'down' }, httpFail: true }],
  ['network_error', { payload: null, networkError: true }],
  ['endpoint_missing', { payload: validPayload(), noEndpoint: true }],
  ['browser_crypto_unavailable', { payload: validPayload(), noCrypto: true }],
];

(async () => {
  const results = [];
  let failed = 0;
  for (const [name, spec] of rejectedCases) {
    const { ctx, spy } = makeEnv(spec);
    let result, threw = null;
    try { result = await ctx.uploadArenaAvatar(file); } catch (e) { threw = String(e); }
    const violations = [];
    if (threw) violations.push('threw: ' + threw);
    if (spy.persist.length) violations.push('persistAvatarRecord called ' + spy.persist.length + 'x');
    if (spy.activate.length) violations.push('persistActiveAvatarSelection called ' + spy.activate.length + 'x');
    if (spy.rawFallback.length) violations.push('raw-photo fallback called');
    if (spy.hydrate) violations.push('hydrate called');
    if (spy.steps.includes('done')) violations.push("'done' (Avatar Ready) step reached");
    if (spy.toasts.some((t) => t.t === 'success') || spy.statuses.some((s) => s.t === 'success')) violations.push('success message emitted');
    if (result && result.avatar_url) violations.push('avatar_url returned');
    if (!result || result.rejected !== true) violations.push('result not flagged rejected');
    if (ctx.avatarState.step !== 'preview') violations.push('not returned to preview step (was ' + ctx.avatarState.step + ')');
    if (ctx.latestGeneratedAvatarUrl) violations.push('stale generated URL retained');
    if (!ctx.avatarState.file) violations.push('photo discarded');
    if (!ctx.unlocked) violations.push('request lock not released');
    const last = spy.statuses[spy.statuses.length - 1];
    if (!last || last.t !== 'error' || !/try again/i.test(last.m) || !/different photo/i.test(last.m)) violations.push('recovery guidance missing');
    if (spec.noCrypto || spec.noEndpoint) { if (spy.fetches) violations.push('provider request made despite local precondition failure'); }
    if (violations.length) failed += 1;
    results.push({ name, status: violations.length ? 'FAIL' : 'PASS', persist: spy.persist.length, activate: spy.activate.length, rawFallback: spy.rawFallback.length, fetches: spy.fetches, reason: result && result.reason, violations });
  }
  // Control: fully verified response persists once, activates once, reaches 'done'.
  {
    const { ctx, spy } = makeEnv({ payload: validPayload() });
    const result = await ctx.uploadArenaAvatar(file);
    const violations = [];
    if (spy.persist.length !== 1) violations.push('persist count ' + spy.persist.length);
    if (spy.activate.length !== 1) violations.push('activate count ' + spy.activate.length);
    if (spy.rawFallback.length) violations.push('raw fallback called');
    if (!spy.steps.includes('done')) violations.push("'done' not reached");
    if (result.avatar_url !== GOOD_URL) violations.push('wrong url returned: ' + result.avatar_url);
    if (spy.persist[0] && spy.persist[0].avatar_url !== GOOD_URL) violations.push('persisted wrong url');
    if (spy.activate[0] !== NEW_ID) violations.push('activated wrong id');
    // The hash compared against the server must be the SHA-256 of the exact bytes appended to the request.
    const appended = spy.appendedPhoto;
    const appendedSha = crypto.createHash('sha256').update(Buffer.from(await appended.arrayBuffer())).digest('hex');
    if (appendedSha !== PHOTO_SHA) violations.push('hash basis is not the appended photo');
    if (violations.length) failed += 1;
    results.push({ name: 'control_verified_response', status: violations.length ? 'FAIL' : 'PASS', persist: spy.persist.length, activate: spy.activate.length, violations });
  }
  // Control: uppercase server hash is accepted (same bytes), thumbnail passthrough.
  {
    const { ctx, spy } = makeEnv({ payload: { ...validPayload(), source_photo_sha256: PHOTO_SHA.toUpperCase(), thumbnail_url: 'https://cdn.example.invalid/t.png' } });
    const result = await ctx.uploadArenaAvatar(file);
    const ok = spy.persist.length === 1 && spy.activate.length === 1 && result.avatar_url === GOOD_URL && spy.persist[0].thumbnail_url === 'https://cdn.example.invalid/t.png';
    if (!ok) failed += 1;
    results.push({ name: 'control_uppercase_hash_and_thumbnail', status: ok ? 'PASS' : 'FAIL', persist: spy.persist.length, activate: spy.activate.length });
  }
  const report = {
    utc: new Date().toISOString(), sourcePath, sourceSha256: crypto.createHash('sha256').update(html).digest('hex'),
    uploadFunctionSha256: crypto.createHash('sha256').update(uploadSource).digest('hex'),
    scope: 'Exact uploadArenaAvatar (+ r4 helpers, payload extractors, sha256HexOfBlob) in a VM with spies; no network, providers, DB or production writes.',
    total: results.length, passed: results.length - failed, failed, results,
  };
  if (opt('--report')) fs.writeFileSync(opt('--report'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, failedCases: results.filter((r) => r.status === 'FAIL').map((r) => r.name + ': ' + (r.violations || []).join('; ')) }, null, 2));
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });

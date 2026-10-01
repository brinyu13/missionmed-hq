import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPolicyWrite, buildAdminCreditWrite, createCreditAttemptKeys, mountAdminControls, buildMentorPriorityWrite, mountAdminMentorControls } from '../../public/studio/admin-controls.mjs';
import { IvocApi } from '../../public/ivoc-standalone/app/api.mjs';

const config = {
  version: 3, analyticsConfigVersion: 'ivoc.analytics.v1', brainPackVersion: 'gpt-live-1:marin', aisRulesVersion: '2026-09-18.1',
  pressureDefaults: { defaultFollowUpIntensity: 1, defaultPressureEnabled: false, maxFollowUpsPerAnswer: 2 },
  proactiveBudgetOverrides: { maxProactivePerSession: 3, maxReactivePerAnswer: 1, maxApplicationProbesPerAnswer: 1 },
  credits: { defaultAllowanceSeconds: 0, maxOverrideSeconds: 36000, resetPeriodDays: 30 },
};
const values = { intensity: '2', pressure: true, followUps: '3', proactive: '4', reactive: '2', application: '1', reason: 'Bounded policy update' };
const key = 'f401da3f-c517-4cee-9a60-1e8133c3a1cc';

test('policy edits preserve pinned versions and allowance policy and use current CAS version', () => {
  const result = buildAdminPolicyWrite(config, values);
  assert.equal(result.expectedVersion, 3);
  for (const field of ['analyticsConfigVersion', 'brainPackVersion', 'aisRulesVersion']) assert.equal(result[field], config[field]);
  assert.deepEqual(result.credits, config.credits);
  assert.equal(result.pressureDefaults.defaultFollowUpIntensity, 2);
  assert.equal(config.pressureDefaults.defaultFollowUpIntensity, 1);
  for (const invalid of ['', '-1', '4', '1.5', 'NaN']) assert.throws(() => buildAdminPolicyWrite(config, { ...values, intensity: invalid }));
  assert.throws(() => buildAdminPolicyWrite(config, { ...values, reason: 'x' }));
});

test('credit subject and expected version come from selected account; consume is never exposed', () => {
  const account = { subjectId: 'wp:142', version: 8 };
  const result = buildAdminCreditWrite(account, { action: 'set_override', seconds: '180', reason: 'Requested coaching allowance', subjectId: 'wp:1', expectedVersion: 99 }, key);
  assert.equal(result.subjectId, 'wp:142'); assert.equal(result.expectedVersion, 8);
  assert.equal(result.amountSeconds, 180);
  assert.throws(() => buildAdminCreditWrite(account, { action: 'consume', seconds: 1, reason: 'Invalid client action' }, key));
  assert.throws(() => buildAdminCreditWrite(account, { action: 'set_allowance', seconds: 1, reason: 'x' }, key));
  assert.throws(() => buildAdminCreditWrite(account, { action: 'set_allowance', seconds: 1, reason: 'Valid reason' }, 'bad'));
  assert.equal(buildAdminCreditWrite(account, { action: 'reset', seconds: 123, reason: 'Reset period' }, key).amountSeconds, 0);
});

test('ambiguous unchanged credit retry retains identity; changed subject/version/value gets fresh identity', () => {
  let sequence = 0; const keys = createCreditAttemptKeys(() => `key-${++sequence}`);
  const input = { subjectId: 'wp:1', version: 11, seconds: '0' };
  assert.equal(keys.forInput(input), keys.forInput({ ...input }));
  assert.equal(keys.forInput({ ...input, subjectId: 'wp:142' }), 'key-2');
  assert.equal(keys.forInput({ ...input, version: 12 }), 'key-3');
  keys.clear(); assert.equal(keys.forInput(input), 'key-4');
});

// Minimal DOM contract, not a browser/visual acceptance substitute.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.attrs = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  remove() { this.removed = true; }
}
function descendants(root) { return [root, ...root.children.flatMap(descendants)]; }
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('policy conflict invalidates overview; reopened controls use the refreshed version', async () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    let cached = config; const versions = [];
    const open = (current, conflict) => {
      const configHost = new Element('div'); const creditHost = new Element('div');
      const controls = mountAdminControls({ configHost, creditHost, config: current,
        initialSubject: { subject: 'wp:1' }, isCurrent: () => true,
        onConfigConflict: () => { cached = null; }, onConfigSaved: (saved) => { cached = saved; },
        durable: {
          adminCredits: async () => ({ account: { subjectId: 'wp:1', version: 11 } }),
          saveAdminConfig: async (input) => {
            versions.push(input.expectedVersion);
            if (conflict) throw Object.assign(new Error('conflict'), { status: 409 });
            return { ...current, version: current.version + 1 };
          },
        },
      });
      const elements = descendants(configHost);
      elements.find((node) => node.attrs['aria-label'] === 'Policy change reason').value = 'Required policy correction';
      return { controls, submit: () => elements.find((node) => node.tag === 'form').listeners.submit({ preventDefault() {} }) };
    };
    const first = open(cached, true); await first.submit();
    assert.equal(cached, null); first.controls.destroy();
    const refreshed = { ...config, version: 4 };
    const second = open(refreshed, false); await second.submit(); second.controls.destroy();
    assert.deepEqual(versions, [3, 4]); assert.equal(cached.version, 5);
  } finally { globalThis.document = previous; }
});

test('late credit reads cannot replace another student or render after role exit', async () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const reads = new Map(); let active = true;
    const creditHost = new Element('div');
    const controls = mountAdminControls({ configHost: new Element('div'), creditHost, config,
      initialSubject: { subject: 'wp:1' }, isCurrent: () => active, onConfigSaved() {}, onConfigConflict() {},
      durable: { adminCredits: (subject) => { const read = deferred(); reads.set(subject, read); return read.promise; } },
    });
    const selected = controls.selectSubject('wp:142', 'Selected student');
    reads.get('wp:142').resolve({ account: { subjectId: 'wp:142', version: 8, balanceSeconds: 900, consumedSeconds: 0 } });
    await selected;
    reads.get('wp:1').resolve({ account: { subjectId: 'wp:1', version: 11 } });
    await Promise.resolve();
    assert.match(creditHost.children[0].textContent, /wp:142/);
    const late = controls.selectSubject('wp:1'); active = false; controls.destroy();
    reads.get('wp:1').resolve({ account: { subjectId: 'wp:1', version: 11 } }); await late;
    assert.deepEqual(creditHost.children, []);
  } finally { globalThis.document = previous; }
});

test('Admin client delegates same-origin authenticated CSRF writes to exact existing endpoints', async () => {
  const previous = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({}) }; };
  try {
    const api = new IvocApi(); api.csrfToken = 'unit-fixture-only';
    await api.saveAdminConfig({ expectedVersion: 3 }); await api.adminCredits('wp:142'); await api.saveAdminCredits({ subjectId: 'wp:142' });
    await api.adminMentorPriorities('wp:142'); await api.saveAdminMentorPriorities({ subjectId: 'wp:142', expectedVersion: 0 });
    assert.deepEqual(calls.map((call) => call.url), ['/api/ivoc/v1/admin/config', '/api/ivoc/v1/admin/credits?subjectId=wp%3A142', '/api/ivoc/v1/admin/credits', '/api/ivoc/v1/admin/mentor-priorities?subjectId=wp%3A142', '/api/ivoc/v1/admin/mentor-priorities']);
    for (const call of calls) assert.equal(call.options.credentials, 'same-origin');
    for (const call of [calls[0], calls[2], calls[4]]) { assert.equal(call.options.method, 'PUT'); assert.equal(call.options.headers['X-MMHQ-CSRF'], 'unit-fixture-only'); }
  } finally { globalThis.fetch = previous; }
});

test('mentor write retains ordered IDs, selected subject, version and explicit private-note visibility', () => {
  const snapshot = { subjectId: 'wp:142', version: 2 };
  const input = buildMentorPriorityWrite(snapshot, {
    priorities: [{ id: 'leadership', text: 'Lead with your actual contribution.' }, { id: 'blank', text: '' }],
    mentorNotes: [{ id: 'private', text: 'Admin-only instructional note.', visibility: 'mentor_only' }, { id: 'shared', text: 'Use a concrete example.', visibility: 'shared' }],
  });
  assert.equal(input.subjectId, 'wp:142'); assert.equal(input.expectedVersion, 2);
  assert.deepEqual(input.priorities, [{ id: 'leadership', text: 'Lead with your actual contribution.' }]);
  assert.equal(input.mentorNotes[0].visibility, 'mentor_only');
  assert.throws(() => buildMentorPriorityWrite(snapshot, { priorities: [], mentorNotes: [{ id: 'bad', text: 'Valid note', visibility: 'public' }] }));
  assert.throws(() => buildMentorPriorityWrite(snapshot, { priorities: Array(4).fill({ id: 'p', text: 'Priority' }), mentorNotes: [] }));
});

test('mentor editor rejects stale subject reads and removes private notes on role exit', async () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const host = new Element('section'); const reads = new Map();
    const controls = mountAdminMentorControls({ host, isCurrent: () => true, actorSubject: 'wp:1', onOwnSaved() {},
      durable: { adminMentorPriorities: (subject) => { const read = deferred(); reads.set(subject, read); return read.promise; } },
    });
    const old = controls.selectSubject('wp:1'); const selected = controls.selectSubject('wp:142', 'Selected student');
    reads.get('wp:142').resolve({ subjectId: 'wp:142', version: 0, priorities: [], mentorNotes: [{ id: 'private', text: 'Private authorized note', visibility: 'mentor_only' }] });
    await selected;
    reads.get('wp:1').resolve({ subjectId: 'wp:1', version: 2, priorities: [], mentorNotes: [] }); await old;
    assert.match(host.children[0].textContent, /Selected student/);
    assert(descendants(host).some((element) => element.value === 'Private authorized note'));
    controls.destroy(); assert.deepEqual(host.children, []);
  } finally { globalThis.document = previous; }
});

test('successful mentor save with failed readback never claims refreshed state', async () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const host = new Element('section'); let reads = 0; let saved = 0;
    const controls = mountAdminMentorControls({ host, isCurrent: () => true, actorSubject: 'wp:1', onOwnSaved() {},
      durable: {
        adminMentorPriorities: async () => {
          if (++reads > 1) throw new Error('readback unavailable');
          return { subjectId: 'wp:142', version: 0, priorities: [], mentorNotes: [] };
        },
        saveAdminMentorPriorities: async () => { ++saved; return { version: 1 }; },
      },
    });
    await controls.selectSubject('wp:142');
    await descendants(host).find((element) => element.tag === 'form').listeners.submit({ preventDefault() {} });
    assert.equal(saved, 1);
    assert.match(host.children.map((element) => element.textContent).join(' '), /saved; refresh unavailable/);
    assert.doesNotMatch(host.children.map((element) => element.textContent).join(' '), /saved and refreshed/);
    controls.destroy();
  } finally { globalThis.document = previous; }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const ownershipSource = readFileSync(path.join(root, 'missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js'), 'utf8');
const serverSource = readFileSync(path.join(root, 'missionmed-hq/server.mjs'), 'utf8');
const demoStudents = [
  { id: 'amara', name: 'Amara Okafor', initials: 'AO', country: 'Nigeria', specialty: 'Internal Medicine', risk: 'medium' },
  { id: 'raj', name: 'Raj Patel', initials: 'RP', country: 'India', specialty: 'Family Medicine', risk: 'low' },
];
const persistedDomains = [
  'mmc.mentor_memory', 'mmc.private_notes', 'mmc.action_items', 'mmc.goals',
  'mmc.coaching_sessions', 'mmc.session_artifacts', 'mmc.open_loops', 'mmc.intelligence_snapshots',
];
const persistedState = {
  memory: [{
    id: 'memory_server_006', studentId: 'amara', category: 'coaching', title: 'Server read adapter',
    content: 'Immutable server-projected memory.', sensitive: false, verified: true, source: 'v1-read-adapter', createdAt: '2026-07-15',
  }],
};
const requests = [];

function createRuntime() {
  const storage = new Map();
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    fetch: async (url, options = {}) => {
      const method = options.method || 'GET';
      requests.push({ url: String(url), method });
      assert.equal(String(url), '/api/mmc/persistence');
      assert.equal(method, 'GET', 'The historical client must not submit a v1 whole-state write.');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          status: 'VERIFIED',
          mode: 'v1-read-adapter-only',
          csrfToken: 'csrf_006_read_adapter',
          localStorageFallback: false,
          persistedDomains,
          state: JSON.parse(JSON.stringify(persistedState)),
        }),
      };
    },
  };
  const context = vm.createContext({ window, fetch: window.fetch, console, setTimeout, clearTimeout });
  vm.runInContext(ownershipSource, context, { filename: 'mmc-ownership-layer.js' });
  return { window, runtime: window.MMCOwnershipLayer.createRuntime({ demoStudents, activeMentorId: 'mentor-brian' }) };
}

const first = createRuntime();
assert.equal(await first.runtime.hydratePersistence(), true);
let summary = first.runtime.validationSummary();
assert.equal(summary.persistence.status, 'read_only');
assert.equal(summary.persistence.mode, 'v1-read-adapter-only');
assert.equal(summary.persistence.writeMode, 'sealed');
assert.equal(summary.productionIntegration, false);
assert.equal(summary.schemaPersistenceEnabled, false);
assert.equal(summary.launchReadiness.status, 'TRUST_KERNEL_UI_REVIEW_ONLY');
assert.ok(first.runtime.getStudentBundle('amara').memory.some((entry) => entry.content === 'Immutable server-projected memory.'));

first.runtime.quickCapture({ studentId: 'amara', type: 'Note', content: 'Local-only unsaved 006 note' });
const flush = await first.runtime.flushPersistence();
summary = first.runtime.validationSummary();
assert.equal(flush.status, 'SEALED');
assert.equal(summary.persistence.status, 'unsaved');
assert.equal(summary.persistence.lastSavedAt, null);
assert.match(summary.persistence.error, /v1 whole-state writer is sealed/u);
assert.ok(first.runtime.getStudentBundle('amara').memory.some((entry) => entry.content.includes('Local-only unsaved 006 note')));
assert.equal(first.window.localStorage.getItem('mmc.ownership.local.v1'), null);

const second = createRuntime();
await second.runtime.hydratePersistence();
assert.equal(second.runtime.getStudentBundle('amara').memory.some((entry) => entry.content.includes('Local-only unsaved 006 note')), false,
  'A local-only change must not masquerade as persisted after reload.');
const exported = first.runtime.exportPilotSnapshot();
assert.equal(exported.status, 'TRUST_KERNEL_UI_REVIEW_ONLY');
assert.equal(exported.productionHydration, false);
assert.equal(exported.localStorageFallbackEnabled, false);
assert.deepEqual(new Set(requests.map((entry) => entry.method)), new Set(['GET']));

const handler = serverSource.slice(serverSource.indexOf('async function handleMmcPersistenceRoute'), serverSource.indexOf('function isSpaRoute'));
assert.match(handler, /mmc_v1_whole_state_writer_sealed/u);
assert.doesNotMatch(handler, /saveMmcPersistenceState/u);
assert.match(handler, /validateCsrf\(request, session\)/u);

const insertHelper = serverSource.slice(
  serverSource.indexOf('async function insertMmcRow'),
  serverSource.indexOf('async function updateMmcRow'),
);
const updateHelper = serverSource.slice(
  serverSource.indexOf('async function updateMmcRow'),
  serverSource.indexOf('function stripMmcCreateOnlyFields'),
);
for (const helper of [insertHelper, updateHelper]) {
  assert.match(helper, /whole-state persistence writer is permanently sealed/u);
  assert.doesNotMatch(helper, /fetchMmcSupabase/u,
    'Dormant v1 mutation helpers must not retain a database write path.');
}

console.log('MMC v1 read-adapter and v2 command-boundary integration validation passed');

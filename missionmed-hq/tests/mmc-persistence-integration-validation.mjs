import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const ownershipSource = readFileSync(path.join(rootDir, 'missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js'), 'utf8');
const appSource = readFileSync(path.join(rootDir, 'missionmed-hq/public/mmc-private/src/app.js'), 'utf8');
const indexSource = readFileSync(path.join(rootDir, 'missionmed-hq/public/mmc-private/index.html'), 'utf8');
const persistedDomains = [
  'mmc.mentor_memory',
  'mmc.private_notes',
  'mmc.action_items',
  'mmc.goals',
  'mmc.coaching_sessions',
  'mmc.session_artifacts',
  'mmc.open_loops',
  'mmc.intelligence_snapshots',
];
const demoStudents = [
  { id: 'amara', name: 'Amara Okafor', initials: 'AO', country: 'Nigeria', specialty: 'Internal Medicine', risk: 'medium' },
  { id: 'raj', name: 'Raj Patel', initials: 'RP', country: 'India', specialty: 'Family Medicine', risk: 'low' },
];

let persistedState = {};
const requests = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRuntime() {
  const storage = new Map();
  const window = {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    fetch: async (url, options = {}) => {
      const method = options.method || 'GET';
      requests.push({ url: String(url), method });
      assert.equal(String(url), '/api/mmc/persistence', 'MMC ownership runtime must call only the same-origin persistence endpoint.');
      if (method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            status: 'VERIFIED',
            mode: 'mmc-schema',
            csrfToken: 'csrf-vm',
            localStorageFallback: false,
            persistedDomains,
            state: clone(persistedState),
          }),
        };
      }
      assert.equal(method, 'POST');
      assert.equal(options.headers['X-MMHQ-CSRF'], 'csrf-vm', 'MMC persistence writes must include the CSRF token returned by GET.');
      const payload = JSON.parse(options.body || '{}');
      persistedState = clone(payload.state || {});
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          status: 'VERIFIED',
          mode: 'mmc-schema',
          writeCount: 8,
          localStorageFallback: false,
          persistedDomains,
          state: clone(persistedState),
        }),
      };
    },
  };
  const context = vm.createContext({ window, fetch: window.fetch, console, setTimeout, clearTimeout });
  vm.runInContext(ownershipSource, context, { filename: 'mmc-ownership-layer.js' });
  return {
    window,
    runtime: window.MMCOwnershipLayer.createRuntime({ demoStudents, activeMentorId: 'mentor-brian' }),
  };
}

assert.match(indexSource, /data-testid="profile-save-goal"/u, 'MMC profile workflow must expose the additive Save Goal control.');
assert.match(indexSource, /data-testid="pilot-readiness-panel"/u, 'MMC private alpha must expose pilot readiness status.');
assert.match(indexSource, /data-testid="resume-session"/u, 'MMC private alpha must expose session recovery.');
assert.match(indexSource, /data-testid="export-alpha-snapshot"/u, 'MMC private alpha must expose snapshot export.');
assert.match(appSource, /function saveProfileGoal/u, 'MMC app must expose the profile goal UI handler.');
assert.match(appSource, /function exportPilotSnapshot/u, 'MMC app must expose local pilot snapshot export.');
assert.match(appSource, /function recoverSession/u, 'MMC app must expose session recovery.');
assert.match(appSource, /flushPersistence:\s*flushOwnershipPersistence/u, 'MMC app must expose a validation flush for schema persistence.');

const first = createRuntime();
await first.runtime.hydratePersistence();
assert.equal(first.runtime.getLaunchReadiness().status, 'PRIVATE_ALPHA_LAUNCH_READY', 'Connected persistence plus pilot fixtures should be alpha ready.');
first.runtime.quickCapture({ studentId: 'amara', type: 'Note', content: 'MMC-021 persistent private note' });
first.runtime.createGoal({ studentId: 'amara', title: 'MMC-021 persistent coaching goal' });
first.runtime.quickCapture({ studentId: 'amara', type: 'Action', content: 'MMC-021 persistent action item' });
first.runtime.quickCapture({ studentId: 'amara', type: 'Memory', content: 'MMC-021 persistent mentor memory' });
first.runtime.startSession('amara');
first.runtime.addSessionItem({ studentId: 'amara', type: 'Promise', content: 'Promise captured during the live session' });
first.runtime.endSession('MMC-021 persistent private session note');
first.runtime.savePostSession({ summary: 'MMC-021 persistent session summary', privateNotes: 'MMC-100 post-session private note', studentVisible: false });
await first.runtime.flushPersistence();
const exportedSnapshot = first.runtime.exportPilotSnapshot();

assert.ok(persistedState.memory.some((item) => item.content.includes('persistent private note')), 'Private note did not enter persisted state.');
assert.ok(persistedState.memory.some((item) => item.content.includes('persistent mentor memory')), 'Mentor memory did not enter persisted state.');
assert.ok(persistedState.memory.some((item) => item.content.includes('post-session private note')), 'Post-session private note did not enter persisted state.');
assert.ok(persistedState.goals.some((item) => item.title.includes('persistent coaching goal')), 'Goal did not enter persisted state.');
assert.ok(persistedState.tasks.some((item) => item.title.includes('persistent action item')), 'Task did not enter persisted state.');
assert.ok(persistedState.promises.some((item) => item.title.includes('Promise captured during the live session')), 'Promise did not enter persisted state.');
assert.ok(persistedState.sessions.some((item) => item.summary.includes('persistent session summary')), 'Session did not enter persisted state.');
assert.ok(persistedState.sessionArtifacts.length > 0, 'Session artifact did not enter persisted state.');
assert.ok(persistedState.openLoops.length > 0, 'Open loops were not included in persistence sync.');
assert.ok(persistedState.intelligenceSnapshots.length > 0, 'Intelligence snapshots were not included in persistence sync.');
assert.equal(exportedSnapshot.status, 'PRIVATE_ALPHA_LAUNCH_READY_CANDIDATE', 'Pilot snapshot did not expose launch status.');
assert.equal(exportedSnapshot.productionHydration, false, 'Pilot snapshot must not claim production hydration.');
assert.equal(exportedSnapshot.localStorageFallbackEnabled, false, 'Pilot snapshot must keep localStorage fallback disabled.');
assert.equal(first.window.localStorage.getItem('mmc.ownership.local.v1'), null, 'Old ownership localStorage key must not be used.');

const second = createRuntime();
await second.runtime.hydratePersistence();
const summary = second.runtime.validationSummary();
const bundle = second.runtime.getStudentBundle('amara');
assert.equal(summary.localStorageEnabled, false, 'Persisted ownership domains must not use localStorage fallback.');
assert.equal(summary.localStorageFallbackEnabled, false, 'Persisted ownership domains must keep localStorage fallback disabled.');
assert.equal(summary.persistence.status, 'connected', 'MMC schema persistence should report connected with the mocked endpoint.');
assert.equal(summary.launchReadiness.status, 'PRIVATE_ALPHA_LAUNCH_READY', 'Reloaded runtime should remain alpha ready.');
assert.ok(bundle.memory.some((item) => item.content.includes('persistent private note')), 'Reload did not hydrate private note from persistence.');
assert.ok(bundle.memory.some((item) => item.content.includes('persistent mentor memory')), 'Reload did not hydrate mentor memory from persistence.');
assert.ok(bundle.memory.some((item) => item.content.includes('post-session private note')), 'Reload did not hydrate post-session private note from persistence.');
assert.ok(bundle.goals.some((item) => item.title.includes('persistent coaching goal')), 'Reload did not hydrate goal from persistence.');
assert.ok(bundle.tasks.some((item) => item.title.includes('persistent action item')), 'Reload did not hydrate task from persistence.');
assert.ok(bundle.promises.length > 0, 'Reload did not hydrate promise from persistence.');
assert.ok(bundle.sessions.some((item) => item.summary.includes('persistent session summary')), 'Reload did not hydrate session from persistence.');

second.runtime.startSession('raj');
second.runtime.addSessionItem({ studentId: 'raj', type: 'Memory', content: 'Interrupted launch-day session memory' });
await second.runtime.flushPersistence();

const third = createRuntime();
await third.runtime.hydratePersistence();
assert.equal(third.runtime.validationSummary().recoverableSession.studentId, 'raj', 'Reload should detect recoverable active session.');
const recovered = third.runtime.recoverLatestSession('raj');
assert.equal(recovered.studentId, 'raj', 'Session recovery should restore the interrupted student.');
assert.ok(third.runtime.getActiveSession(), 'Recovered session should become active in the runtime.');
assert.ok(requests.every((request) => request.url === '/api/mmc/persistence'), 'Unexpected request escaped MMC persistence endpoint.');

console.log('MMC persistence integration validation passed');

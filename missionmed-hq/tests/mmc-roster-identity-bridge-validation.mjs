import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const ownershipSource = readFileSync(path.join(rootDir, 'missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js'), 'utf8');
const appSource = readFileSync(path.join(rootDir, 'missionmed-hq/public/mmc-private/src/app.js'), 'utf8');
const serverSource = readFileSync(path.join(rootDir, 'missionmed-hq/server.mjs'), 'utf8');

assert.match(serverSource, /function mapMmcIdentityReferenceRow/u, 'Server persistence read model must expose identity reference projection.');
assert.match(serverSource, /function mapMmcRosterStudentRow/u, 'Server persistence read model must expose roster student projection.');
assert.match(serverSource, /identityReferenceCanEnterRoster/u, 'Server must gate roster promotion.');
assert.match(serverSource, /primaryAnchorType === 'mmc_fixture_student'/u, 'Server must exclude fixture identities from roster bridge.');
assert.match(serverSource, /'identity_references'/u, 'Server must read identity references through existing MMC persistence context.');
assert.doesNotMatch(serverSource.match(/async function loadMmcPersistenceState[\s\S]*?function emptyMmcPersistenceState/u)?.[0] || '', /insertMmcRow|updateMmcRow|upsertMmcRow/u, 'MMC roster bridge GET must remain read-only.');

assert.match(ownershipSource, /rosterStudentCanEnterSelector/u, 'Ownership runtime must gate roster selector entry.');
assert.match(ownershipSource, /primaryAnchorType === "mmc_fixture_student"/u, 'Ownership runtime must block fixture identities from roster bridge.');
assert.match(ownershipSource, /getRosterStudents/u, 'Ownership runtime must expose roster bridge students.');
assert.match(appSource, /leadingStudents\.some/u, 'Meeting Intelligence filter must keep active roster student visible even when appended after demo students.');

const requests = [];
const context = {
  window: {},
  console,
  fetch: async (url, options = {}) => {
    requests.push({ url, options });
    assert.equal(url, '/api/mmc/persistence', 'Roster bridge must use only the same-origin MMC persistence endpoint.');
    return {
      ok: true,
      json: async () => ({
        ok: true,
        status: 'VERIFIED',
        mode: 'mmc-schema',
        csrfToken: 'csrf-roster',
        persistedDomains: [],
        state: {
          identityReferences: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              studentId: 'ignacio-anzola',
              studentName: 'Ignacio Anzola',
              referenceStatus: 'verified',
              primaryAnchorType: 'missionmed_roster_student',
              primaryAnchorHash: 'missionmed-roster:ignacio-anzola',
              confidence: 0.94,
              reviewStatus: 'verified',
              verificationMethod: 'staging-roster-proof',
              canonicalStudentIdentity: true,
              metadata: {
                student_id: 'ignacio-anzola',
                student_name: 'Ignacio Anzola',
                canonical_student_identity: true,
                school: 'MissionMed verified roster',
                specialty: 'Internal Medicine',
                status: 'Active',
                last_meeting: 'Jun 5, 2026'
              }
            },
            {
              id: '22222222-2222-4222-8222-222222222222',
              studentId: 'unsafe-review',
              studentName: 'Unsafe Review',
              referenceStatus: 'unverified',
              primaryAnchorType: 'mmc_reviewed_subject',
              primaryAnchorHash: 'unsafe-review',
              confidence: 0.52,
              reviewStatus: 'unreviewed',
              canonicalStudentIdentity: false,
              metadata: { student_id: 'unsafe-review', student_name: 'Unsafe Review' }
            },
            {
              id: '33333333-3333-4333-8333-333333333333',
              studentId: 'amara',
              studentName: 'Amara Okafor',
              referenceStatus: 'verified',
              primaryAnchorType: 'mmc_fixture_student',
              primaryAnchorHash: 'amara',
              confidence: 1,
              reviewStatus: 'verified',
              canonicalStudentIdentity: false,
              metadata: { student_id: 'amara', student_name: 'Amara Okafor' }
            }
          ],
          assignments: [
            {
              id: 'assignment-ignacio',
              mentorId: 'mentor-brian',
              subjectRefId: '11111111-1111-4111-8111-111111111111',
              studentId: 'ignacio-anzola',
              status: 'active',
              reviewStatus: 'verified'
            },
            {
              id: 'assignment-unsafe',
              mentorId: 'mentor-brian',
              subjectRefId: '22222222-2222-4222-8222-222222222222',
              studentId: 'unsafe-review',
              status: 'active',
              reviewStatus: 'verified'
            }
          ],
          rosterStudents: [
            {
              id: 'ignacio-anzola',
              name: 'Ignacio Anzola',
              initials: 'IA',
              program: 'match',
              session: 'private',
              specialty: 'Internal Medicine',
              risk: 'medium',
              status: 'Active',
              lastMeeting: 'Jun 5, 2026',
              canonicalStudentIdentity: true,
              mmcRosterIdentity: {
                status: 'VERIFIED',
                subjectRefId: '11111111-1111-4111-8111-111111111111',
                assignmentId: 'assignment-ignacio',
                primaryAnchorType: 'missionmed_roster_student',
                confidence: 0.94
              }
            },
            {
              id: 'unsafe-review',
              name: 'Unsafe Review',
              initials: 'UR',
              mmcRosterIdentity: {
                status: 'VERIFIED',
                subjectRefId: '22222222-2222-4222-8222-222222222222',
                assignmentId: 'assignment-unsafe',
                primaryAnchorType: 'mmc_reviewed_subject',
                confidence: 0.52
              }
            },
            {
              id: 'amara',
              name: 'Amara Okafor',
              initials: 'AO',
              mmcRosterIdentity: {
                status: 'VERIFIED',
                subjectRefId: '33333333-3333-4333-8333-333333333333',
                assignmentId: 'assignment-amara',
                primaryAnchorType: 'mmc_fixture_student',
                confidence: 1
              }
            }
          ],
          sessions: [
            {
              id: 'session-ignacio-proof',
              studentId: 'ignacio-anzola',
              title: 'Ignacio verified roster readback',
              summary: 'Real analysis readback session',
              status: 'complete',
              startedAt: '2026-06-05T17:05:00Z'
            }
          ],
          intelligenceSnapshots: [
            {
              id: 'snapshot-ignacio-proof',
              studentId: 'ignacio-anzola',
              snapshotType: 'meeting_intelligence',
              summary: { summary: 'Ignacio meeting intelligence persisted.' },
              confidenceScore: 0.91
            }
          ],
          memory: [],
          tasks: [],
          promises: [],
          goals: [],
          sessionArtifacts: [],
          openLoops: []
        }
      })
    };
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(ownershipSource, context, { filename: 'mmc-ownership-layer.js' });

const demoStudents = [
  { id: 'amara', name: 'Amara Okafor', initials: 'AO' },
  { id: 'raj', name: 'Raj Patel', initials: 'RP' }
];
const runtime = context.window.MMCOwnershipLayer.createRuntime({ demoStudents, activeMentorId: 'mentor-brian' });
assert.equal(runtime.getRosterStudents().length, 0, 'Roster bridge must not expose students before persistence readback.');
await runtime.hydratePersistence();
const hydrated = runtime.hydrateDirectory(demoStudents);
assert.ok(hydrated.some((student) => student.id === 'ignacio-anzola'), 'Verified Ignacio roster identity must appear in selectable directory.');
assert.equal(hydrated.filter((student) => student.id === 'amara').length, 1, 'Fixture identity bridge must not duplicate Amara.');
assert.equal(hydrated.some((student) => student.id === 'unsafe-review'), false, 'Unverified reviewed subject must not enter selector.');
const ignacio = hydrated.find((student) => student.id === 'ignacio-anzola');
assert.equal(ignacio.canonicalStudentIdentity, true, 'Ignacio bridge row should carry canonical identity flag from verified source.');
assert.equal(ignacio.mmcOwned.assignedToMentor, true, 'Ignacio must be mentor-assigned after bridge hydration.');
assert.equal(runtime.getStudentBundle('ignacio-anzola').student.name, 'Ignacio Anzola', 'Bridge student must hydrate profile/readback bundle.');
assert.ok(runtime.getStudentBundle('ignacio-anzola').sessions.length >= 1, 'Bridge student must expose persisted meeting history.');
assert.equal(runtime.validationSummary().rosterIdentityBridge.status, 'VERIFIED', 'Validation summary must report verified roster identity bridge.');
assert.ok(requests.every((request) => request.url === '/api/mmc/persistence'), 'No external roster requests are allowed.');

console.log('MMC-505 roster identity bridge validation passed');

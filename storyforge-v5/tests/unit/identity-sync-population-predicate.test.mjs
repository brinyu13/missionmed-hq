import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.join(here, '..', 'fixtures', 'wp-identity-sync-harness.php');

// The canonical shape emitted by mmhq_cam_build_entitlement() in production.
function camEntitlement(overrides = {}) {
  return {
    product: 'cam',
    source: 'wordpress_learndash_handoff',
    verified: true,
    trusted: true,
    active: true,
    status: 'active',
    course_ids: ['3893'],
    program_tier: '',
    restricted: false,
    revoked: false,
    current_access_verified: true,
    purchase_verified: false,
    purchase_match_found: false,
    enrollment_verified: true,
    authority_mode: 'learndash_current_access',
    revocation_checked: true,
    expires_at: '',
    ...overrides,
  };
}

// The approved Session A welcome batch is dispatched by a scheduled system
// process, so sent_by is recorded as 0 for every legitimate member.
function approvedAttestationMeta(overrides = {}) {
  return {
    _mmed_welcome_email_sent_at_360elite: '2026-06-02 12:19:52',
    _mmed_welcome_email_sent_by_360elite: '0',
    _mmed_welcome_email_subject_360elite: 'Welcome to the 360 Match Mentorship Program, Dr. Example!',
    _mmed_welcome_email_source_360elite: 'manual_session_a_batch',
    ...overrides,
  };
}

async function exportPopulation(users) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sf-identity-sync-'));
  const snapshotPath = path.join(dir, 'snapshot.json');
  const fixturePath = path.join(dir, 'fixtures.json');
  try {
    await writeFile(fixturePath, JSON.stringify({ path: snapshotPath, users }));
    const { stdout } = await run('php', [harness, fixturePath]);
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
    const eligible = snapshot.users.filter((row) => row.eligible);
    return {
      summary: JSON.parse(stdout.trim().split('\n').at(-1)),
      snapshot,
      eligibleUsernames: eligible.map((row) => row.username).sort(),
      evidenceFor: (username) => snapshot.users
        .find((row) => row.username === username)?.entitlement?.population_evidence,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const POPULATION = [
  // A legitimate Session A student: current 360 course access, no matched
  // WooCommerce order, carrying the approved manual welcome attestation.
  {
    id: 141,
    username: 'session_a_student',
    native_role: 'student',
    entitlement: camEntitlement(),
    meta: approvedAttestationMeta(),
  },
  // A legitimate 360 student who bought through WooCommerce.
  {
    id: 122,
    username: 'verified_purchase_student',
    native_role: 'student',
    entitlement: camEntitlement({
      purchase_verified: true,
      purchase_match_found: true,
      authority_mode: 'learndash_and_woocommerce',
    }),
    meta: {},
  },
  // Bulk-added to the 360 LearnDash course with no qualifying enrollment truth.
  {
    id: 300,
    username: 'bulk_course_access_only',
    native_role: 'student',
    entitlement: camEntitlement(),
    meta: {},
  },
  // A registered user with no 360 entitlement at all.
  {
    id: 301,
    username: 'registered_user',
    native_role: 'student',
    entitlement: camEntitlement({
      active: false,
      status: 'not_eligible',
      course_ids: [],
      enrollment_verified: false,
      authority_mode: '',
    }),
    meta: {},
  },
  // Attested from an unapproved batch, so not part of the 360 population.
  {
    id: 85,
    username: 'manual_test_account',
    native_role: 'student',
    entitlement: camEntitlement(),
    meta: approvedAttestationMeta({ _mmed_welcome_email_source_360elite: 'manual_test' }),
  },
  // Revoked 360 access must stay out of the administrator population.
  {
    id: 302,
    username: 'revoked_student',
    native_role: 'student',
    entitlement: camEntitlement({ revoked: true, active: false, status: 'revoked' }),
    meta: approvedAttestationMeta(),
  },
  // Administrators and mentors are never part of the student population.
  {
    id: 107,
    username: 'founder_admin',
    native_role: 'admin',
    entitlement: camEntitlement({ source: 'wordpress_admin_capability' }),
    meta: {},
  },
];

test('the approved Session A attestation survives a system-recorded actor', async () => {
  const result = await exportPopulation(POPULATION);

  // B1-515R3 required the attestation actor to be a logged-in user (sent_by > 0).
  // The approved batch records actor 0, so that rejected every legitimate member
  // and collapsed the administrator population to the single WooCommerce buyer.
  assert.ok(
    result.eligibleUsernames.includes('session_a_student'),
    'a legitimate Session A student must remain in the 360 population',
  );
  assert.equal(
    result.evidenceFor('session_a_student'),
    'approved_manual_360_attestation',
  );
});

test('the 360 population excludes accounts without qualifying enrollment truth', async () => {
  const result = await exportPopulation(POPULATION);

  assert.deepEqual(result.eligibleUsernames, [
    'session_a_student',
    'verified_purchase_student',
  ]);
  assert.equal(result.summary.eligible_students, 2);
  assert.equal(result.summary.users_scanned, POPULATION.length);
  assert.equal(result.evidenceFor('verified_purchase_student'), 'verified_purchase');

  // No qualifying evidence exists at all for these accounts.
  for (const excluded of [
    'bulk_course_access_only',
    'registered_user',
    'manual_test_account',
    'founder_admin',
  ]) {
    assert.equal(result.evidenceFor(excluded), 'none', `${excluded} must carry no population evidence`);
  }

  // Revoked access is excluded even though its attestation is still on record:
  // population_evidence reports what evidence exists, eligibility decides access.
  assert.equal(result.evidenceFor('revoked_student'), 'approved_manual_360_attestation');
  assert.ok(!result.eligibleUsernames.includes('revoked_student'));
});

test('an attestation missing its recorded actor is not qualifying evidence', async () => {
  const meta = approvedAttestationMeta();
  delete meta._mmed_welcome_email_sent_by_360elite;
  const result = await exportPopulation([
    { ...POPULATION[0], username: 'unrecorded_attestation', meta },
  ]);
  assert.deepEqual(result.eligibleUsernames, []);
});

test('a future-dated attestation is not qualifying evidence', async () => {
  const result = await exportPopulation([
    {
      ...POPULATION[0],
      username: 'future_attestation',
      meta: approvedAttestationMeta({ _mmed_welcome_email_sent_at_360elite: '2099-01-01 00:00:00' }),
    },
  ]);
  assert.deepEqual(result.eligibleUsernames, []);
});

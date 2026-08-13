import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../../scripts/run-postgres-tests.sh', import.meta.url),
  'utf8',
);

const expectedB1514Train = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
  '20260810240000_b1_514_v2_ra_lifecycle_completion.sql',
  '20260810250000_b1_514_v21_authored_segment_writes.sql',
  '20260810260000_b1_514_guest_voice_contributions.sql',
  '20260810270000_b1_514_request_delivery_attempts.sql',
  '20260810280000_b1_514_guest_voice_cleanup_recovery.sql',
];

const expectedB1515Train = [
  '20260812120000_b1_515_v201_reviews_collections_peer.sql',
  '20260813120000_b1_515r_admin_subject_masterkey.sql',
  '20260813130000_b1_515r_action_center_contribution_review.sql',
  '20260813140000_b1_515r_arena_avatar_directory_groups.sql',
];

function bashArray(name) {
  const match = source.match(new RegExp(`${name}=\\(\\n(?<body>[\\s\\S]*?)\\n\\)`));
  assert.ok(match?.groups?.body, `${name} array is missing`);
  return [...match.groups.body.matchAll(/"([^"]+\.sql)"/g)].map((entry) => entry[1]);
}

test('PostgreSQL runner applies the exact ordered B1-514 train before legacy matrices', async () => {
  assert.deepEqual(bashArray('b1_514_migrations'), expectedB1514Train);
  const migrationDirectory = new URL('../../infra/postgres/migrations/', import.meta.url);
  const discovered = (await readdir(migrationDirectory))
    .filter((name) => /^20260810\d+_b1_514_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  assert.deepEqual(discovered, expectedB1514Train);

  const apply = source.indexOf('for migration in "${b1_514_migrations[@]}"');
  const authorization = source.indexOf('tests/postgres/authorization_matrix.sql');
  const conformance = source.indexOf('tests/postgres/b1_503_conformance_matrix.sql');
  assert.ok(apply > 0, 'B1-514 apply loop is missing');
  assert.ok(apply < authorization, 'B1-514 train must precede the authorization matrix');
  assert.ok(authorization < conformance, 'legacy matrix ordering changed');
  assert.match(source, /B1-514 migration train differs from the exact ordered allowlist/);
});

test('PostgreSQL runner applies the exact ordered B1-515 train after B1-514', () => {
  assert.deepEqual(bashArray('b1_515_migrations'), expectedB1515Train);
  const b1514 = source.indexOf('for migration in "${b1_514_migrations[@]}"');
  const b1515 = source.indexOf('for migration in "${b1_515_migrations[@]}"');
  const authorization = source.indexOf('tests/postgres/authorization_matrix.sql');
  assert.ok(b1515 > b1514);
  assert.ok(b1515 < authorization);
});

test('PostgreSQL runner seeds both canonical governed libraries before legacy matrices', () => {
  const inspiration = source.indexOf('scripts/seed-inspiration-prompts.mjs');
  const contributors = source.indexOf('scripts/seed-contributor-prompts.mjs');
  const authorization = source.indexOf('tests/postgres/authorization_matrix.sql');
  assert.ok(inspiration > 0 && contributors > inspiration);
  assert.ok(contributors < authorization);
  assert.match(source, /STORYFORGE_DATABASE_URL="postgresql:\/\/postgres@127\.0\.0\.1:\$SF_PG_PORT\/storyforge\?sslmode=disable"/);
});

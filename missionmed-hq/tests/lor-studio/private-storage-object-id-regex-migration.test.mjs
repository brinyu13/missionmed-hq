import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DR133_ARTIFACTS,
  DR133_SUCCESSOR_STAGES,
  expectedDr133SuccessorSentinel,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';

const PREDECESSOR = new URL(
  '../../scripts/lor-studio/migrations/20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.sql',
  import.meta.url,
);
const MIGRATION = new URL(
  '../../scripts/lor-studio/migrations/20260826011900_f2_lor_1012_live_production_private_storage_object_id_regex.sql',
  import.meta.url,
);
const ROLLBACK = new URL(
  '../../scripts/lor-studio/rollbacks/20260826011900_f2_lor_1012_live_production_private_storage_object_id_regex.rollback.sql',
  import.meta.url,
);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const PREDECESSOR_FRAGMENT =
  "    OR candidate_object_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$'";
const SUCCESSOR_FRAGMENT = [
  '    OR pg_catalog.length(candidate_object_id) NOT BETWEEN 1 AND 300',
  "    OR candidate_object_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'",
].join('\n');
const FUNCTION_HASHES = Object.freeze({
  put: Object.freeze({
    predecessor: '0007cdc60ee8c18a0c62aebf7661eba160f8e6de6d69e9a339cdadff517b8bc2',
    sourceTransform: '7fe923c7456c4012149c2f01fdc9bbb84e80feb092e648c16de36a78cf18e49d',
    successor: 'c6df77935587bb0b8e344273aff916db9fe4590f8833afc266a94317eb8958cb',
  }),
  get: Object.freeze({
    predecessor: 'afe336d992bfe9e66b230ff7c87add9805370ae5581c26be1000a3138c6992ca',
    sourceTransform: '285d512e22be7b279e19b3360f59db363db3db56b841106b8c85ed5e5fc0efef',
    successor: '2d7e6ca11ee0499361ce065cc6557eea82d65764a4b81ed89707599d8c2eebaf',
  }),
});

function functionBody(source, tag) {
  const delimiter = `$${tag}$`;
  const opening = `AS ${delimiter}`;
  const start = source.indexOf(opening);
  const end = source.indexOf(`${delimiter};`, start + opening.length);
  assert.notEqual(start, -1, tag);
  assert.notEqual(end, -1, tag);
  return source.slice(start + opening.length, end);
}

test('successor repairs only the PostgreSQL-incompatible object-id repetition bound', async () => {
  const predecessor = await readFile(PREDECESSOR, 'utf8');
  const migration = await readFile(MIGRATION, 'utf8');
  const putBody = functionBody(predecessor, 'put_encrypted_storage');
  const getBody = functionBody(predecessor, 'get_encrypted_storage');

  assert.equal(putBody.split(PREDECESSOR_FRAGMENT).length - 1, 1);
  assert.equal(getBody.split(PREDECESSOR_FRAGMENT).length - 1, 1);
  assert.equal(sha256(putBody), FUNCTION_HASHES.put.predecessor);
  assert.equal(sha256(getBody), FUNCTION_HASHES.get.predecessor);
  assert.equal(
    sha256(putBody.replace(PREDECESSOR_FRAGMENT, SUCCESSOR_FRAGMENT)),
    FUNCTION_HASHES.put.sourceTransform,
  );
  assert.equal(
    sha256(getBody.replace(PREDECESSOR_FRAGMENT, SUCCESSOR_FRAGMENT)),
    FUNCTION_HASHES.get.sourceTransform,
  );

  assert.match(
    migration,
    /Depends on: 20260826011700_f2_lor_1012_live_production_mentor_assignment_commands\.sql/u,
  );
  assert.match(
    migration,
    /pg_catalog\.length\(object_id\) BETWEEN 1 AND 300[\s\S]*?object_id ~ '\^\[A-Za-z0-9\]\[A-Za-z0-9_\.:-\]\*\$'/u,
  );
  assert.match(migration, /policy_count IS DISTINCT FROM 155/u);
  assert.match(migration, /app_execute_count IS DISTINCT FROM 33/u);
  assert.match(migration, /privateStorageObjectIdRegex=20260826011900/u);
  for (const { predecessor, successor } of Object.values(FUNCTION_HASHES)) {
    for (const hash of [predecessor, successor]) {
      assert.match(migration, new RegExp(hash, 'u'));
    }
  }
});

test('rollback is exact, drift-fenced, data-custody-safe, and contains no broad destruction', async () => {
  const rollback = await readFile(ROLLBACK, 'utf8');
  assert.match(rollback, /EXISTS \(SELECT 1 FROM lor_studio\.private_artifact_versions\)/u);
  assert.match(
    rollback,
    /ADD CONSTRAINT private_artifact_versions_identifiers CHECK \([\s\S]*?object_id ~ '\^\[A-Za-z0-9\]\[A-Za-z0-9_\.:-\]\{0,299\}\$'/u,
  );
  assert.match(
    rollback,
    /suffix text := '\|privateStorageObjectIdRegex=20260826011900'/u,
  );
  assert.match(rollback, /policy_count IS DISTINCT FROM 155/u);
  assert.doesNotMatch(rollback, /\bCASCADE\b|\bDROP\s+OWNED\b|\bREASSIGN\s+OWNED\b/iu);
  assert.doesNotMatch(rollback, /EXECUTE\s+pg_catalog\.format\([^)]*DROP/iu);
  for (const { predecessor, successor } of Object.values(FUNCTION_HASHES)) {
    for (const hash of [predecessor, successor]) {
      assert.match(rollback, new RegExp(hash, 'u'));
    }
  }
});

test('runner and artifact ledgers retain the repair as an ordered no-count-change successor', async () => {
  const migrationBytes = await readFile(MIGRATION);
  const rollbackBytes = await readFile(ROLLBACK);
  const forward = DR133_ARTIFACTS.find(
    (artifact) => artifact.id === 'private-storage-object-id-regex',
  );
  const reverse = DR133_ARTIFACTS.find(
    (artifact) => artifact.id === 'private-storage-object-id-regex-rollback',
  );
  assert.equal(forward.sha256, sha256(migrationBytes));
  assert.equal(reverse.sha256, sha256(rollbackBytes));
  assert.deepEqual(DR133_SUCCESSOR_STAGES.find(
    ({ id }) => id === 'private-storage-object-id-regex',
  ), {
    id: 'private-storage-object-id-regex',
    rollbackId: 'private-storage-object-id-regex-rollback',
    sentinelSuffix: 'privateStorageObjectIdRegex=20260826011900',
  });
  assert.match(
    expectedDr133SuccessorSentinel(),
    /\|mentorAssignmentCommands=20260826011700\|privateStorageObjectIdRegex=20260826011900\|facultyScopeDurableVerification=20260830073256$/u,
  );
});

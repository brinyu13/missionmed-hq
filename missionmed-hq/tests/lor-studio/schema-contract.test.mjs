import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptDirectory = path.resolve(testDirectory, '..', '..', 'scripts', 'lor-studio');

test('schema contract remains design-only until the exact target and ledger are ratified', async () => {
  const contract = JSON.parse(await readFile(path.join(scriptDirectory, 'schema-design.contract.json'), 'utf8'));
  assert.equal(contract.status, 'DESIGN_ONLY_NOT_EXECUTABLE');
  assert.equal(contract.targetProject, null);
  assert.equal(contract.targetEnvironment, null);
  assert.equal(contract.targetSchema, null);
  assert.equal(contract.migrationLedger, null);
  assert.equal(contract.migrationFileAuthorized, false);
  assert.equal(contract.rootSupabaseMigrationAuthorized, false);
  assert.ok(contract.proposedRelations.includes('recommendation_cases'));
  assert.ok(contract.proposedRelations.includes('faculty_private_content'));
  assert.ok(contract.requiredSecurityProperties.some((item) => item.includes('never present in a student projection')));
});

test('schema SQL hard-stops and contains no executable DDL', async () => {
  const sql = await readFile(path.join(scriptDirectory, 'schema-design.sql'), 'utf8');
  assert.match(sql, /RAISE EXCEPTION 'F2-LOR-1009 schema design is non-executable/u);
  for (const line of sql.split(/\r?\n/u)) {
    if (/\b(create|alter|drop|truncate|insert|update|delete|grant|revoke)\b/iu.test(line)) {
      assert.match(line, /^\s*--/u, `DDL/DML must remain commented: ${line}`);
    }
  }
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));

test("runtime RLS verifier requires least privilege and hostile two-subject denial", async () => {
  const source = await fs.readFile(path.resolve(here, "../tools/verify-runtime-rls.mjs"), "utf8");
  assert.match(source, /rolsuper AS "superuser"/);
  assert.match(source, /rolbypassrls AS "bypassRls"/);
  assert.match(source, /pg_has_role\(current_user, 'rise_app_runtime', 'MEMBER'\)/);
  assert.match(source, /relrowsecurity AS "rlsEnabled"/);
  assert.match(source, /relforcerowsecurity AS "rlsForced"/);
  assert.match(source, /acl\.grantee = 0/);
  assert.match(source, /crossRead\.rowCount === 0/);
  assert.match(source, /crossUpdate\.rowCount === 0/);
  assert.match(source, /crossDelete\.rowCount === 0/);
  assert.match(source, /error\?\.code === "42501"/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
});

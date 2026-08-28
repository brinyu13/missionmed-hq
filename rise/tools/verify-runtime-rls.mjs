#!/usr/bin/env node

import pg from "pg";
import { pathToFileURL } from "node:url";
import { buildDatabasePoolConfiguration } from "../adapters/postgres-runtime.mjs";

const { Pool } = pg;
const SUBJECT_A = "a".repeat(64);
const SUBJECT_B = "b".repeat(64);

export async function verifyRuntimeRls({ pool }) {
  const client = await pool.connect();
  let rolledBack = false;
  try {
    await client.query("BEGIN");
    const role = (await client.query(`
      SELECT current_user AS "currentUser", session_user AS "sessionUser",
             rolsuper AS "superuser", rolbypassrls AS "bypassRls",
             pg_has_role(current_user, 'rise_app_runtime', 'MEMBER') AS "runtimeMember"
      FROM pg_roles WHERE rolname = current_user
    `)).rows[0];
    const tableSecurity = (await client.query(`
      SELECT c.relrowsecurity AS "rlsEnabled", c.relforcerowsecurity AS "rlsForced"
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'rise_runtime' AND c.relname = 'student_program_states'
    `)).rows[0];
    const publicAcl = (await client.query(`
      SELECT
        NOT EXISTS (
          SELECT 1 FROM pg_namespace n,
          LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
          WHERE n.nspname = 'rise_runtime' AND acl.grantee = 0 AND acl.privilege_type = 'USAGE'
        ) AS "publicSchemaDenied",
        NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace,
          LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
          WHERE n.nspname = 'rise_runtime' AND c.relname = 'student_program_states'
            AND acl.grantee = 0 AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        ) AS "publicTableDenied"
    `)).rows[0];
    const program = (await client.query(`
      SELECT release_id AS "releaseId", program_specialty_id AS "programSpecialtyId"
      FROM rise_runtime.registry_programs ORDER BY program_specialty_id LIMIT 1
    `)).rows[0];
    if (!program) throw new Error("runtime RLS verification requires one canonical registry program");

    await client.query("SELECT set_config('rise.subject_key', $1, true)", [SUBJECT_A]);
    await client.query(`
      INSERT INTO rise_runtime.student_program_states
        (subject_key, release_id, program_specialty_id, state, notes)
      VALUES ($1, $2, $3, 'SAVED', 'runtime-role-proof-a')
    `, [SUBJECT_A, program.releaseId, program.programSpecialtyId]);

    await client.query("SELECT set_config('rise.subject_key', $1, true)", [SUBJECT_B]);
    await client.query(`
      INSERT INTO rise_runtime.student_program_states
        (subject_key, release_id, program_specialty_id, state, notes)
      VALUES ($1, $2, $3, 'SAVED', 'runtime-role-proof-b')
    `, [SUBJECT_B, program.releaseId, program.programSpecialtyId]);

    await client.query("SELECT set_config('rise.subject_key', $1, true)", [SUBJECT_A]);
    const ownRead = await client.query(
      "SELECT 1 FROM rise_runtime.student_program_states WHERE subject_key = $1 AND program_specialty_id = $2",
      [SUBJECT_A, program.programSpecialtyId],
    );
    const crossRead = await client.query(
      "SELECT 1 FROM rise_runtime.student_program_states WHERE subject_key = $1 AND program_specialty_id = $2",
      [SUBJECT_B, program.programSpecialtyId],
    );
    const crossUpdate = await client.query(
      "UPDATE rise_runtime.student_program_states SET notes = 'forbidden' WHERE subject_key = $1 AND program_specialty_id = $2",
      [SUBJECT_B, program.programSpecialtyId],
    );
    const crossDelete = await client.query(
      "DELETE FROM rise_runtime.student_program_states WHERE subject_key = $1 AND program_specialty_id = $2",
      [SUBJECT_B, program.programSpecialtyId],
    );
    await client.query("SAVEPOINT mismatch_insert");
    let mismatchedInsertDenied = false;
    try {
      await client.query(`
        INSERT INTO rise_runtime.student_program_states
          (subject_key, release_id, program_specialty_id, state, notes)
        VALUES ($1, $2, $3, 'SAVED', 'forbidden')
      `, ["c".repeat(64), program.releaseId, program.programSpecialtyId]);
    } catch (error) {
      mismatchedInsertDenied = error?.code === "42501";
      await client.query("ROLLBACK TO SAVEPOINT mismatch_insert");
    }
    await client.query("ROLLBACK");
    rolledBack = true;

    const checks = {
      loginIsLeastPrivilege: role?.currentUser === "rise_app_login" && role?.superuser === false && role?.bypassRls === false,
      runtimeMembership: role?.runtimeMember === true,
      rlsEnabledAndForced: tableSecurity?.rlsEnabled === true && tableSecurity?.rlsForced === true,
      publicAccessDenied: publicAcl?.publicSchemaDenied === true && publicAcl?.publicTableDenied === true,
      ownReadAllowed: ownRead.rowCount === 1,
      crossReadDenied: crossRead.rowCount === 0,
      crossUpdateDenied: crossUpdate.rowCount === 0,
      crossDeleteDenied: crossDelete.rowCount === 0,
      mismatchedInsertDenied,
      syntheticRowsRolledBack: true,
    };
    return {
      ok: Object.values(checks).every(Boolean),
      currentUser: role?.currentUser,
      sessionUser: role?.sessionUser,
      checks,
    };
  } finally {
    if (!rolledBack) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    client.release();
  }
}

async function main() {
  const pool = new Pool(buildDatabasePoolConfiguration());
  try {
    const receipt = await verifyRuntimeRls({ pool });
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    if (!receipt.ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

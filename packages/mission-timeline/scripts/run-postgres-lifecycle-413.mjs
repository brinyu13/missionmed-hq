import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const evidenceRoot = "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/413";
const postgresEvidence = join(evidenceRoot, "postgres");
const host = process.env.D1_413_PGHOST || "127.0.0.1";
const port = process.env.D1_413_PGPORT || "55413";
const user = process.env.D1_413_PGUSER || process.env.USER || "brianb";
const primary = process.env.D1_413_PGDATABASE || "d1_413_primary";
const restored = "d1_413_restore";
const baseMigration = join(packageRoot, "database/migrations/202607150001_timeline_v1.sql");
const baseDownMigration = join(packageRoot, "database/migrations/202607150001_timeline_v1.down.sql");
const correctiveMigration = join(packageRoot, "database/migrations/202607150002_timeline_v1_413_hardening.sql");
const correctiveDownMigration = join(packageRoot, "database/migrations/202607150002_timeline_v1_413_hardening.down.sql");
const seed = join(packageRoot, "database/disposable/seed_413.sql");
const dumpPath = join(postgresEvidence, "d1_413_seeded_backup.dump");

if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !primary.startsWith('d1_413_') || !restored.startsWith('d1_413_')) {
  throw new Error("Refusing non-local or non-disposable PostgreSQL target");
}

mkdirSync(postgresEvidence, { recursive: true });

function run(command, args, { allowFailure = false } = {}) {
  const started = performance.now();
  const result = spawnSync(command, args, { encoding: "utf8", cwd: packageRoot });
  const record = {
    command: `${command} ${args.join(" ")}`,
    exitCode: result.status,
    durationMs: Number((performance.now() - started).toFixed(2)),
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
  if (!allowFailure && result.status !== 0) throw new Error(JSON.stringify(record));
  return record;
}

function psql(database, sql) {
  return run("psql", ["-h", host, "-p", port, "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql]);
}

function psqlFile(database, path) {
  return run("psql", ["-h", host, "-p", port, "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-f", path]);
}

function tableCounts(database) {
  const tables = psql(database, "select table_name from information_schema.tables where table_schema='timeline' order by table_name").stdout.split("\n").filter(Boolean);
  return Object.fromEntries(tables.map((table) => [table, Number(psql(database, `select count(*) from timeline.${table}`).stdout)]));
}

function semanticSnapshot(database) {
  const sql = String.raw`
    select jsonb_build_object(
      'schema', jsonb_build_object(
        'comment', obj_description(n.oid, 'pg_namespace'),
        'tables', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', c.relname,
            'kind', c.relkind,
            'rls', c.relrowsecurity,
            'force_rls', c.relforcerowsecurity
          ) order by c.relname)
          from pg_class c
          where c.relnamespace = n.oid and c.relkind in ('r', 'p')
        ), '[]'::jsonb),
        'columns', coalesce((
          select jsonb_agg(jsonb_build_object(
            'table', c.relname,
            'position', a.attnum,
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'not_null', a.attnotnull,
            'default', pg_get_expr(ad.adbin, ad.adrelid)
          ) order by c.relname, a.attnum)
          from pg_class c
          join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
          where c.relnamespace = n.oid and c.relkind in ('r', 'p')
        ), '[]'::jsonb),
        'indexes', coalesce((
          select jsonb_agg(jsonb_build_object('table', tablename, 'name', indexname, 'definition', indexdef) order by tablename, indexname)
          from pg_indexes where schemaname = 'timeline'
        ), '[]'::jsonb)
      ),
      'policies', coalesce((
        select jsonb_agg(jsonb_build_object(
          'table', tablename,
          'name', policyname,
          'permissive', permissive,
          'roles', roles,
          'command', cmd,
          'using', qual,
          'check', with_check
        ) order by tablename, policyname)
        from pg_policies where schemaname = 'timeline'
      ), '[]'::jsonb),
      'functions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', p.proname,
          'arguments', pg_get_function_identity_arguments(p.oid),
          'result', pg_get_function_result(p.oid),
          'language', l.lanname,
          'volatility', p.provolatile,
          'security_definer', p.prosecdef,
          'config', p.proconfig,
          'definition', pg_get_functiondef(p.oid)
        ) order by p.proname, pg_get_function_identity_arguments(p.oid))
        from pg_proc p join pg_language l on l.oid = p.prolang
        where p.pronamespace = n.oid
      ), '[]'::jsonb),
      'constraints', coalesce((
        select jsonb_agg(jsonb_build_object(
          'table', c.relname,
          'name', con.conname,
          'type', con.contype,
          'deferrable', con.condeferrable,
          'initially_deferred', con.condeferred,
          'validated', con.convalidated,
          'definition', pg_get_constraintdef(con.oid, true)
        ) order by c.relname, con.conname)
        from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.connamespace = n.oid
      ), '[]'::jsonb)
    )
    from pg_namespace n where n.nspname = 'timeline'
  `;
  return JSON.parse(psql(database, sql).stdout);
}

function writeJson(name, value) {
  const path = join(evidenceRoot, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

const reset = psqlFile(primary, baseDownMigration);
const initialBaseUp = psqlFile(primary, baseMigration);
const initialSeed = psqlFile(primary, seed);
const initialCorrectiveUp = psqlFile(primary, correctiveMigration);
const correctedVersion = psql(primary, "select timeline.schema_version()").stdout;
if (correctedVersion !== "d1-timeline-db-413.2") throw new Error(`Unexpected corrected schema version: ${correctedVersion}`);

const primarySemantic = semanticSnapshot(primary);
const primaryCounts = tableCounts(primary);
const backup = run("pg_dump", ["-h", host, "-p", port, "-U", user, "-d", primary, "-Fc", "-f", dumpPath]);
const dumpSha256 = createHash("sha256").update(readFileSync(dumpPath)).digest("hex");

run("dropdb", ["-h", host, "-p", port, "-U", user, "--if-exists", restored]);
run("createdb", ["-h", host, "-p", port, "-U", user, restored]);
const restore = run("pg_restore", ["-h", host, "-p", port, "-U", user, "-d", restored, "--exit-on-error", dumpPath]);
const restoredCounts = tableCounts(restored);
const restoredSemantic = semanticSnapshot(restored);
const semanticMatches = Object.fromEntries(
  ["schema", "policies", "functions", "constraints"].map((key) => [key, JSON.stringify(primarySemantic[key]) === JSON.stringify(restoredSemantic[key])]),
);
const countMatch = JSON.stringify(primaryCounts) === JSON.stringify(restoredCounts);
const restoreMatch = countMatch && Object.values(semanticMatches).every(Boolean);

const dependencyReview = {
  backupExists: true,
  backupSha256: dumpSha256,
  restoredDatabaseValidated: restoreMatch,
  semanticMatches,
  productionDataPresent: false,
  safeToExerciseDownMigration: restoreMatch,
};
if (!dependencyReview.safeToExerciseDownMigration) throw new Error("Semantic backup/restore gate failed before down migration");

const correctiveDown = psqlFile(primary, correctiveDownMigration);
const versionAfterCorrectiveDown = psql(primary, "select timeline.schema_version()").stdout;
if (versionAfterCorrectiveDown !== "d1-timeline-db-413.1") throw new Error("Corrective down migration did not restore 413.1");
const baseDown = psqlFile(primary, baseDownMigration);
const schemaAfterDown = Number(psql(primary, "select count(*) from pg_namespace where nspname='timeline'").stdout);
if (schemaAfterDown !== 0) throw new Error("Down migration left timeline schema behind");

const reappliedBase = psqlFile(primary, baseMigration);
const reappliedSeed = psqlFile(primary, seed);
const reappliedCorrective = psqlFile(primary, correctiveMigration);
const schemaVersion = psql(primary, "select timeline.schema_version()").stdout;
const tableCount = Number(psql(primary, "select count(*) from information_schema.tables where table_schema='timeline'").stdout);
const rlsCount = Number(psql(primary, "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='timeline' and c.relkind='r' and c.relrowsecurity").stdout);
const forceRlsCount = Number(psql(primary, "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='timeline' and c.relkind='r' and c.relforcerowsecurity").stdout);
const policyCount = Number(psql(primary, "select count(*) from pg_policies where schemaname='timeline'").stdout);
const reapplySemanticMatch = JSON.stringify(semanticSnapshot(primary)) === JSON.stringify(restoredSemantic);

const rlsRun = run("node", ["scripts/run-rls-matrix-413.mjs"]);
const rlsResult = JSON.parse(readFileSync(join(evidenceRoot, "rls_matrix_413.json"), "utf8"));
const repositoryRun = run("node", ["--import", "tsx", "scripts/run-postgres-repository-integration-413.mjs"]);
const repositoryResult = JSON.parse(readFileSync(join(evidenceRoot, "postgres_repository_integration_413.json"), "utf8"));

const backupRestoreResult = {
  schemaVersion: "d1-backup-restore-result-413.2",
  generatedAt: new Date().toISOString(),
  target: { host, port: Number(port), primary, restored, disposable: true },
  dump: { path: dumpPath, sha256: dumpSha256, bytes: readFileSync(dumpPath).byteLength },
  backup,
  restore,
  primaryCounts,
  restoredCounts,
  countMatch,
  semanticMatches,
  restoreMatch,
  dependencyReview,
  status: restoreMatch ? "PASS" : "FAIL",
};
const downResult = {
  schemaVersion: "d1-migration-down-result-413.2",
  generatedAt: new Date().toISOString(),
  target: { host, port: Number(port), database: primary, disposable: true },
  dependencyReview,
  commands: { correctiveDown, baseDown },
  timelineVersionAfterCorrectiveDown: versionAfterCorrectiveDown,
  schemaCountAfterDown: schemaAfterDown,
  status: schemaAfterDown === 0 && versionAfterCorrectiveDown === "d1-timeline-db-413.1" ? "PASS" : "FAIL",
};
const upResult = {
  schemaVersion: "d1-migration-up-result-413.2",
  generatedAt: new Date().toISOString(),
  target: { host, port: Number(port), database: primary, disposable: true },
  initialCommands: { reset, base: initialBaseUp, seed: initialSeed, corrective: initialCorrectiveUp },
  reapplyCommands: { base: reappliedBase, seed: reappliedSeed, corrective: reappliedCorrective },
  timelineSchemaVersion: schemaVersion,
  protectedTables: tableCount,
  rlsEnabledTables: rlsCount,
  forceRlsTables: forceRlsCount,
  policies: policyCount,
  reapplySemanticMatch,
  rlsRun,
  repositoryRun,
  coreRlsRerun: rlsResult.summary,
  repositoryIntegration: repositoryResult.summary,
  status: schemaVersion === "d1-timeline-db-413.2"
    && tableCount === 19
    && rlsCount === 19
    && forceRlsCount === 19
    && reapplySemanticMatch
    && rlsResult.summary.failed === 0
    && repositoryResult.summary.failed === 0 ? "PASS" : "FAIL",
};

const paths = [
  writeJson("backup_restore_result_413.json", backupRestoreResult),
  writeJson("migration_down_result_413.json", downResult),
  writeJson("migration_up_result_413.json", upResult),
];
process.stdout.write(`${JSON.stringify({ backupRestore: backupRestoreResult.status, down: downResult.status, up: upResult.status, rls: rlsResult.summary, repository: repositoryResult.summary, backupSha256: dumpSha256 })}\n${paths.join("\n")}\n`);
if ([backupRestoreResult.status, downResult.status, upResult.status].includes("FAIL")) process.exitCode = 1;

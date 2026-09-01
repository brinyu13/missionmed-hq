import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function safetyError(message) {
  return new Error(`HomeBase release safety failed: ${message}`);
}

function readRequired(file, label) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') throw safetyError(`${label} is missing.`);
    throw error;
  }
}

function executableSql(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\r\n]*/g, '');
}

export function assertHomeBaseReleaseSafety({ packageDir } = {}) {
  if (!packageDir) throw safetyError('a HomeBase package directory is required.');
  const migrationDir = path.join(packageDir, 'infra', 'postgres', 'migrations');
  const foundationFile = path.join(migrationDir, '20260901120000_hb_360a_001_homebase_foundation.sql');
  const seedFile = path.join(migrationDir, '20260901121000_hb_360a_001_session_a_seed.sql');
  const foundation = executableSql(readRequired(foundationFile, 'the HomeBase foundation migration'));
  const seed = executableSql(readRequired(seedFile, 'the Session A seed migration'));
  const app = readRequired(path.join(packageDir, 'server', 'app.mjs'), 'the HomeBase API');
  const config = readRequired(path.join(packageDir, 'server', 'config.mjs'), 'the HomeBase configuration');

  if (/\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA|DATABASE)\b/i.test(`${foundation}\n${seed}`)) {
    throw safetyError('forward-only migrations may not drop or truncate data structures.');
  }
  const tables = [...foundation.matchAll(/CREATE\s+TABLE\s+public\.(hb_[a-z0-9_]+)/gi)]
    .map((match) => match[1]);
  if (tables.length < 10 || new Set(tables).size !== tables.length) {
    throw safetyError('the isolated HomeBase schema is incomplete or contains duplicate table definitions.');
  }
  for (const table of tables) {
    if (!foundation.toLowerCase().includes(`alter table public.${table} enable row level security`)) {
      throw safetyError(`${table} does not enable row-level security.`);
    }
  }
  if (!/360-session-a/i.test(seed)) {
    throw safetyError('the bounded Session A seed is missing.');
  }
  if (!app.includes("url.pathname === '/api/class-progress'")
      || !app.includes('classProgressStudentView')
      || !app.includes('identity_match_needs_review')) {
    throw safetyError('Class Progress privacy or identity-review gates are missing.');
  }
  if (!config.includes('HOMEBASE_DEV_AUTH is forbidden in provider environments')) {
    throw safetyError('provider fixture-auth denial is missing.');
  }

  return Object.freeze({
    ok: true,
    gate: 'homebase-isolation-roster-class-progress',
    migrations: [path.relative(packageDir, foundationFile), path.relative(packageDir, seedFile)],
    tables: tables.length,
  });
}

const executedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === executedPath) {
  const packageDir = path.resolve(path.dirname(process.argv[1]), '..');
  console.log(JSON.stringify(assertHomeBaseReleaseSafety({ packageDir }), null, 2));
}

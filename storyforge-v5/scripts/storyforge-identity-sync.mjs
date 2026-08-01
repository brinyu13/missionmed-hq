import { chmod, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const WRITE_STATUSES = new Set(['NEEDS_BOTH', 'NEEDS_POSTGRES_ROW_ONLY']);
const WP_WRITE_STATUSES = new Set(['NEEDS_BOTH', 'NEEDS_WORDPRESS_UUID_ONLY']);
const BLOCKING_STATUSES = new Set([
  'CONFLICTING_WORDPRESS_UUID',
  'CONFLICTING_POSTGRES_IDENTITY',
  'DUPLICATE_WORDPRESS_ID',
  'DUPLICATE_UUID',
  'INVALID_ACCOUNT',
]);

function normalizedUuid(value) {
  const uuid = String(value ?? '').trim().toLowerCase();
  return UUID_PATTERN.test(uuid) ? uuid : '';
}

function countBy(values, key) {
  const counts = new Map();
  for (const value of values) {
    const item = key(value);
    if (item === '') continue;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

export function classifyIdentityMappings(snapshot, databaseRows, {
  createUuid = () => crypto.randomUUID(),
  roster = [],
} = {}) {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.users)) {
    throw new Error('invalid WordPress identity snapshot');
  }
  const users = snapshot.users;
  const wpIdCounts = countBy(users, (row) => String(Number(row.wp_user_id) || ''));
  const wpUuidCounts = countBy(users, (row) => normalizedUuid(row.storyforge_uuid_raw));
  const dbById = new Map();
  const dbByWp = new Map();
  for (const raw of databaseRows) {
    const row = {
      ...raw,
      id: normalizedUuid(raw.id),
      wp_user_id: Number(raw.wp_user_id),
    };
    if (!row.id || !Number.isSafeInteger(row.wp_user_id) || row.wp_user_id < 1) {
      throw new Error('invalid PostgreSQL sf_users identity row');
    }
    if (dbById.has(row.id) || dbByWp.has(row.wp_user_id)) {
      throw new Error('duplicate PostgreSQL sf_users identity row');
    }
    dbById.set(row.id, row);
    dbByWp.set(row.wp_user_id, row);
  }

  const entries = users.map((raw) => {
    const wpUserId = Number(raw.wp_user_id);
    const username = String(raw.username ?? '');
    const email = String(raw.email ?? '').trim().toLowerCase();
    const displayName = String(raw.display_name ?? '').trim();
    const rawUuid = String(raw.storyforge_uuid_raw ?? '').trim().toLowerCase();
    const wpUuid = normalizedUuid(rawUuid);
    const base = {
      wp_user_id: wpUserId,
      username,
      email,
      display_name: displayName,
      eligible: raw.eligible === true,
      status: 'INELIGIBLE',
      storyforge_uuid: wpUuid,
      apply_wordpress: false,
      apply_postgres: false,
    };
    if (raw.eligible !== true) return base;
    if (
      !Number.isSafeInteger(wpUserId)
      || wpUserId < 1
      || username === ''
      || displayName === ''
      || raw.native_role !== 'student'
      || (rawUuid !== '' && wpUuid === '')
    ) {
      return { ...base, status: 'INVALID_ACCOUNT' };
    }
    if ((wpIdCounts.get(String(wpUserId)) ?? 0) > 1) {
      return { ...base, status: 'DUPLICATE_WORDPRESS_ID' };
    }
    if (wpUuid && (wpUuidCounts.get(wpUuid) ?? 0) > 1) {
      return { ...base, status: 'DUPLICATE_UUID' };
    }

    const byWp = dbByWp.get(wpUserId);
    const byUuid = wpUuid ? dbById.get(wpUuid) : undefined;
    if (wpUuid) {
      if (byUuid && byUuid.wp_user_id !== wpUserId) {
        return { ...base, status: 'CONFLICTING_WORDPRESS_UUID' };
      }
      if (byWp && byWp.id !== wpUuid) {
        return { ...base, status: 'CONFLICTING_POSTGRES_IDENTITY' };
      }
      if (byUuid && byWp) {
        return { ...base, status: 'ALREADY_VALID' };
      }
      return {
        ...base,
        status: 'NEEDS_POSTGRES_ROW_ONLY',
        apply_postgres: true,
      };
    }
    if (byWp) {
      return {
        ...base,
        status: 'NEEDS_WORDPRESS_UUID_ONLY',
        storyforge_uuid: byWp.id,
        apply_wordpress: true,
      };
    }
    const created = normalizedUuid(createUuid());
    if (!created || dbById.has(created) || wpUuidCounts.has(created)) {
      throw new Error('UUID generator produced an invalid or colliding identity');
    }
    dbById.set(created, { id: created, wp_user_id: wpUserId });
    return {
      ...base,
      status: 'NEEDS_BOTH',
      storyforge_uuid: created,
      apply_wordpress: true,
      apply_postgres: true,
    };
  });

  const counts = Object.fromEntries([
    'ALREADY_VALID',
    'NEEDS_WORDPRESS_UUID_ONLY',
    'NEEDS_POSTGRES_ROW_ONLY',
    'NEEDS_BOTH',
    'CONFLICTING_WORDPRESS_UUID',
    'CONFLICTING_POSTGRES_IDENTITY',
    'DUPLICATE_WORDPRESS_ID',
    'DUPLICATE_UUID',
    'INELIGIBLE',
    'INVALID_ACCOUNT',
  ].map((status) => [status, entries.filter((entry) => entry.status === status).length]));
  const blockingConflicts = [...BLOCKING_STATUSES]
    .reduce((total, status) => total + counts[status], 0);

  const rosterResults = roster.map((item, index) => {
    const username = String(item.username ?? '').trim();
    const normalizedUsername = username.toLowerCase();
    const email = String(item.email ?? '').trim().toLowerCase();
    const matches = entries.filter((entry) => (
      (normalizedUsername !== '' && entry.username.toLowerCase() === normalizedUsername)
      || (email !== '' && entry.email === email)
    ));
    return {
      label: String(item.label ?? `R${String(index + 1).padStart(2, '0')}`),
      resolved: matches.length === 1,
      entitled: matches.length === 1 && matches[0].eligible,
      status: matches.length === 1 ? matches[0].status : 'INVALID_ACCOUNT',
    };
  });

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    authority: snapshot.authority,
    course_id: snapshot.course_id,
    entries,
    summary: {
      users_scanned: entries.length,
      entitled_students: entries.filter((entry) => entry.eligible).length,
      database_rows: databaseRows.length,
      ...counts,
      blocking_conflicts: blockingConflicts,
      roster_supplied: rosterResults.length,
      roster_resolved: rosterResults.filter((row) => row.resolved).length,
      roster_entitled: rosterResults.filter((row) => row.entitled).length,
    },
    roster: rosterResults,
  };
}

export async function applyPostgresPlan(plan, client) {
  if (!plan || plan.version !== 1 || !Array.isArray(plan.entries)) {
    throw new Error('invalid identity plan');
  }
  if (Number(plan.summary?.blocking_conflicts) !== 0) {
    throw new Error('identity plan contains blocking conflicts');
  }
  const actions = plan.entries.filter((entry) => entry.apply_postgres);
  await client.query('BEGIN');
  try {
    for (const entry of actions) {
      if (!WRITE_STATUSES.has(entry.status) || !normalizedUuid(entry.storyforge_uuid)) {
        throw new Error('identity plan contains an invalid PostgreSQL action');
      }
      const existing = await client.query(
        `SELECT id::text, wp_user_id
           FROM public.sf_users
          WHERE id = $1::uuid OR wp_user_id = $2
          FOR SHARE`,
        [entry.storyforge_uuid, entry.wp_user_id],
      );
      if (existing.rows.length > 0) {
        const exact = existing.rows.length === 1
          && normalizedUuid(existing.rows[0].id) === entry.storyforge_uuid
          && Number(existing.rows[0].wp_user_id) === entry.wp_user_id;
        if (!exact) throw new Error('PostgreSQL identity changed after dry run');
        continue;
      }
      await client.query(
        `INSERT INTO public.sf_users (id, wp_user_id, display_name, role, eligible, cohort)
         VALUES ($1::uuid, $2, $3, 'student', true, NULL)
         ON CONFLICT DO NOTHING`,
        [entry.storyforge_uuid, entry.wp_user_id, entry.display_name],
      );
      const verified = await client.query(
        `SELECT id::text, wp_user_id
           FROM public.sf_users
          WHERE id = $1::uuid OR wp_user_id = $2
          FOR SHARE`,
        [entry.storyforge_uuid, entry.wp_user_id],
      );
      const exact = verified.rows.length === 1
        && normalizedUuid(verified.rows[0].id) === entry.storyforge_uuid
        && Number(verified.rows[0].wp_user_id) === entry.wp_user_id;
      if (!exact) throw new Error('PostgreSQL identity changed during apply');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return { checked: actions.length, inserted_or_preserved: actions.length };
}

export async function verifyPostgresPlan(plan, client) {
  const targets = plan.entries.filter((entry) => entry.eligible && !BLOCKING_STATUSES.has(entry.status));
  let verified = 0;
  for (const entry of targets) {
    const result = await client.query(
      `SELECT id::text, wp_user_id, role, eligible
         FROM public.sf_users
        WHERE id = $1::uuid OR wp_user_id = $2`,
      [entry.storyforge_uuid, entry.wp_user_id],
    );
    if (
      result.rows.length !== 1
      || normalizedUuid(result.rows[0].id) !== entry.storyforge_uuid
      || Number(result.rows[0].wp_user_id) !== entry.wp_user_id
      || result.rows[0].role !== 'student'
      || result.rows[0].eligible !== true
    ) {
      throw new Error('PostgreSQL identity verification failed');
    }
    verified++;
  }
  return { verified };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writePrivateJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

function parseArgs(argv) {
  const result = new Map();
  for (let index = 3; index < argv.length; index += 2) {
    result.set(argv[index], argv[index + 1]);
  }
  return result;
}

async function main() {
  const action = process.argv[2];
  const args = parseArgs(process.argv);
  const snapshotPath = args.get('--wp-snapshot');
  const planPath = args.get('--plan');
  const rosterPath = args.get('--roster');
  const connectionString = process.env.STORYFORGE_DATABASE_URL;
  if (!['dry-run', 'apply-postgres', 'verify-postgres'].includes(action)) {
    throw new Error('action must be dry-run, apply-postgres, or verify-postgres');
  }
  if (!connectionString) throw new Error('STORYFORGE_DATABASE_URL is required');

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    if (action === 'dry-run') {
      if (!snapshotPath || !planPath) throw new Error('--wp-snapshot and --plan are required');
      const snapshot = await readJson(snapshotPath);
      const roster = rosterPath ? await readJson(rosterPath) : [];
      const db = await client.query(
        `SELECT id::text, wp_user_id, display_name, role, eligible, cohort
           FROM public.sf_users
          ORDER BY wp_user_id, id`,
      );
      const plan = classifyIdentityMappings(snapshot, db.rows, { roster });
      await writePrivateJson(planPath, plan);
      process.stdout.write(`${JSON.stringify(plan.summary)}\n`);
      if (plan.summary.blocking_conflicts !== 0) process.exitCode = 2;
      return;
    }
    if (!planPath) throw new Error('--plan is required');
    const plan = await readJson(planPath);
    const result = action === 'apply-postgres'
      ? await applyPostgresPlan(plan, client)
      : await verifyPostgresPlan(plan, client);
    process.stdout.write(`${JSON.stringify({ ok: true, action, ...result })}\n`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

export { BLOCKING_STATUSES, UUID_PATTERN, WP_WRITE_STATUSES };

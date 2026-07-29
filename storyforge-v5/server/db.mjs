import pg from 'pg';
import { config } from './config.mjs';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function healthCheck() {
  const result = await pool.query('select current_database() as database, version() as version');
  return result.rows[0];
}

export async function withIdentity(identity, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(
      `SELECT
         set_config('request.jwt.claim.sub', $1, true),
         set_config('request.jwt.claim.app_role', $2, true),
         set_config('request.jwt.claim.storyforge_eligible', $3, true),
         set_config('request.jwt.claim.wp_user_id', $4, true)`,
      [
        identity.sub,
        identity.role,
        identity.eligible ? 'true' : 'false',
        String(identity.wpUserId),
      ],
    );
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function withServiceTransaction(operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE storyforge_app');
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function appendAudit(client, {
  action,
  entityType,
  entityId = null,
  surface,
  studentId = null,
  storyId = null,
  previousValue = null,
  newValue = null,
}) {
  try {
    const result = await client.query(
      `SELECT public.sf_append_voice_audit(
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb
       ) AS id`,
      [
        action,
        entityType,
        entityId,
        surface,
        studentId,
        storyId,
        previousValue == null ? null : JSON.stringify(previousValue),
        newValue == null ? null : JSON.stringify(newValue),
      ],
    );
    return result.rows[0]?.id ?? null;
  } catch (cause) {
    if (
      action === 'unauthorized_denied'
      && cause?.code === '42501'
      && /live identity required/i.test(String(cause?.message || ''))
    ) {
      return null;
    }
    if (cause?.code !== '42501') throw cause;
    const error = new Error('The StoryForge audit writer is unavailable.', { cause });
    error.code = 'audit_writer_unavailable';
    error.status = 503;
    throw error;
  }
}

export async function appendServiceAudit(client, {
  action,
  entityType,
  entityId = null,
  studentId = null,
  storyId = null,
  previousValue = null,
  newValue = null,
}) {
  try {
    const result = await client.query(
      `SELECT public.sf_append_voice_audit_service(
         $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb
       ) AS id`,
      [
        action,
        entityType,
        entityId,
        studentId,
        storyId,
        previousValue == null ? null : JSON.stringify(previousValue),
        newValue == null ? null : JSON.stringify(newValue),
      ],
    );
    return result.rows[0]?.id ?? null;
  } catch (cause) {
    if (cause?.code !== '42501') throw cause;
    const error = new Error('The StoryForge service audit writer is unavailable.', { cause });
    error.code = 'audit_writer_unavailable';
    error.status = 503;
    throw error;
  }
}

export async function closePool() {
  await pool.end();
}

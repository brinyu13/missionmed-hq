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

export async function withIdentity(identity, operation, { adminMode = false } = {}) {
  if (adminMode && identity?.wordpressAdmin !== true) {
    const error = new Error('Signed WordPress administrator authority is required.');
    error.code = 'admin_required';
    error.status = 403;
    throw error;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(
      `SELECT
         set_config('request.jwt.claim.sub', $1, true),
         set_config('request.jwt.claim.app_role', $2, true),
         set_config('request.jwt.claim.homebase_eligible', $3, true),
         set_config('request.jwt.claim.wp_user_id', $4, true),
         set_config('request.jwt.claim.wordpress_admin', $5, true),
         set_config('request.jwt.claim.admin_mode', $6, true)`,
      [
        identity.sub,
        identity.role,
        identity.eligible ? 'true' : 'false',
        String(identity.wpUserId),
        identity.wordpressAdmin ? 'true' : 'false',
        adminMode ? 'true' : 'false',
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
    await client.query('SET LOCAL ROLE homebase_app');
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

export async function appendActivity(client, {
  action,
  entityType,
  entityId = null,
  sessionId = null,
  enrollmentId = null,
  actorRole = 'system',
  actorName = '',
  actorSub = null,
  summary = '',
  studentVisible = true,
  previousValue = null,
  newValue = null,
}) {
  const result = await client.query(
    `INSERT INTO public.hb_activity
       (action, entity_type, entity_id, session_id, enrollment_id,
        actor_role, actor_name, actor_sub, summary, student_visible,
        previous_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
     RETURNING id`,
    [
      action,
      entityType,
      entityId,
      sessionId,
      enrollmentId,
      actorRole,
      actorName,
      actorSub,
      summary,
      studentVisible,
      previousValue == null ? null : JSON.stringify(previousValue),
      newValue == null ? null : JSON.stringify(newValue),
    ],
  );
  return result.rows[0]?.id ?? null;
}

export async function closePool() {
  await pool.end();
}

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

export async function closePool() {
  await pool.end();
}

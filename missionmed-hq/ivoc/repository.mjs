const TABLES = Object.freeze([
  'ivoc_sessions',
  'ivoc_recordings',
  'ivoc_results',
  'ivoc_reviews',
  'ivoc_preferences',
  'ivoc_access_log',
  'ivoc_session_contracts',
  'ivoc_timeline_events',
  'ivoc_conversation_turns',
  'ivoc_answer_segments',
  'ivoc_coaching_evidence',
  'ivoc_question_catalog',
  'ivoc_context_packs',
  'ivoc_mentor_priority_sets',
  'ivoc_admin_config_versions',
  'ivoc_credit_accounts',
  'ivoc_credit_events',
  'ivoc_answer_asset_versions',
]);

const RPCS = Object.freeze([
  'ivoc_write_question_version',
  'ivoc_write_mentor_priorities',
  'ivoc_write_admin_config',
  'ivoc_mutate_user_credits',
  'ivoc_write_answer_asset',
]);

function requireConfig(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`ivoc_${name}_missing`);
  return normalized;
}

export function createIvocRepository({ baseUrl, serviceRoleKey, fetchImpl = fetch } = {}) {
  const root = requireConfig(baseUrl, 'supabase_url').replace(/\/+$/u, '');
  const key = requireConfig(serviceRoleKey, 'service_role_key');

  async function request(tablePath, { method = 'GET', body, prefer = '', signal } = {}) {
    const table = String(tablePath || '').split(/[?&]/u, 1)[0];
    if (!TABLES.includes(table)) throw new Error('ivoc_table_not_allowed');
    const response = await fetchImpl(`${root}/rest/v1/${tablePath}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error('ivoc_persistence_failed');
      error.status = response.status;
      error.detail = payload?.code || payload?.message || null;
      throw error;
    }
    return payload;
  }

  const single = async (path) => (await request(path))?.[0] || null;
  const insert = async (table, body) => (await request(`${table}?select=*`, {
    method: 'POST', body, prefer: 'return=representation',
  }))?.[0] || null;
  const insertMany = async (table, body) => request(`${table}?select=*`, {
    method: 'POST', body, prefer: 'return=representation',
  });
  const upsert = async (table, conflict, body) => (await request(
    `${table}?on_conflict=${encodeURIComponent(conflict)}&select=*`,
    { method: 'POST', body, prefer: 'resolution=merge-duplicates,return=representation' },
  ))?.[0] || null;
  const update = async (path, body) => (await request(path, {
    method: 'PATCH', body, prefer: 'return=representation',
  }))?.[0] || null;
  const rpc = async (name, body) => {
    if (!RPCS.includes(name)) throw new Error('ivoc_rpc_not_allowed');
    const response = await fetchImpl(`${root}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json', apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error('ivoc_persistence_failed');
      error.status = response.status;
      error.detail = payload?.message || payload?.code || null;
      throw error;
    }
    return Array.isArray(payload) ? payload[0] || null : payload;
  };

  return Object.freeze({ request, single, insert, insertMany, upsert, update, rpc });
}

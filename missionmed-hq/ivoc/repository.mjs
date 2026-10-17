const TABLES = Object.freeze([
  'ivoc_sessions',
  'ivoc_recordings',
  'ivoc_results',
  'ivoc_reviews',
  'ivoc_preferences',
  'ivoc_access_log',
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
  const update = async (path, body) => (await request(path, {
    method: 'PATCH', body, prefer: 'return=representation',
  }))?.[0] || null;

  return Object.freeze({ request, single, insert, update });
}


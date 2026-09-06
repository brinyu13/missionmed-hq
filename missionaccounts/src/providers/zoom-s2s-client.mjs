import { createHash } from 'node:crypto';

const TOKEN_URL = 'https://zoom.us/oauth/token';
const DEFAULT_API_BASE = 'https://api.zoom.us/v2';
const REPORT_SCOPE_GROUPS = Object.freeze([
  Object.freeze(['report:read:admin', 'report:read:user:admin']),
  Object.freeze(['report:read:admin', 'report:read:list_meeting_participants:admin']),
]);

function zoomError(message, status = 502, code = null) {
  return Object.assign(new Error(message), { status, provider: 'zoom', providerCode: code });
}

function nonempty(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw zoomError(`Zoom ${label} is required`, 503);
  return normalized;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function trustedApiBase(value) {
  const url = new URL(value || DEFAULT_API_BASE);
  if (url.protocol !== 'https:' || !(url.hostname === 'api.zoom.us' || url.hostname.endsWith('.zoom.us'))) {
    throw zoomError('Zoom returned an untrusted API origin');
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
}

function versionedApiBase(value) {
  const trusted = trustedApiBase(value || DEFAULT_API_BASE);
  return /\/v2$/.test(trusted) ? trusted : `${trusted}/v2`;
}

function encodeMeetingUuid(value) {
  const uuid = nonempty(value, 'meeting UUID');
  const encoded = encodeURIComponent(uuid);
  return uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(encoded) : encoded;
}

function dateOnly(value) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw zoomError('Zoom report window is invalid', 400);
  return parsed.toISOString().slice(0, 10);
}

function reportSegments(from, to) {
  const first = new Date(`${dateOnly(from)}T00:00:00.000Z`);
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const inclusiveEnd = new Date(toMs > fromMs ? toMs - 1 : toMs);
  const last = new Date(`${dateOnly(inclusiveEnd)}T00:00:00.000Z`);
  const segments = [];
  let cursor = first;
  while (cursor <= last) {
    const endOfMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const end = endOfMonth < last ? endOfMonth : last;
    segments.push({ from: cursor.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
    cursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
  }
  return segments;
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1_000, 30_000);
  return Math.min(250 * (2 ** attempt), 2_000);
}

function normalizeRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) throw zoomError('Zoom meeting rules are required', 503);
  const normalized = new Map();
  for (const rule of rules) {
    const meetingId = nonempty(rule?.meeting_id, 'meeting rule ID').replace(/\s+/g, '');
    const step = String(rule?.step || '').trim();
    if (!/^\d{9,11}$/.test(meetingId) || !['s1', 's23'].includes(step)) {
      throw zoomError('Zoom meeting rules require a numeric meeting_id and step s1 or s23', 503);
    }
    if (normalized.has(meetingId)) throw zoomError('Zoom meeting rules contain a duplicate meeting_id', 503);
    normalized.set(meetingId, Object.freeze({ meeting_id: meetingId, step }));
  }
  return normalized;
}

export function parseZoomMeetingRules(value) {
  if (!String(value || '').trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw zoomError('Zoom meeting rules JSON is invalid', 503);
  }
  return [...normalizeRules(parsed).values()];
}

export class ZoomS2SClient {
  constructor({
    accountId,
    clientId,
    clientSecret,
    hostUserId,
    meetingRules,
    fetchImpl = fetch,
    now = () => new Date(),
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    requestTimeoutMs = 15_000,
  } = {}) {
    this.accountId = nonempty(accountId, 'account ID');
    this.clientId = nonempty(clientId, 'client ID');
    this.clientSecret = nonempty(clientSecret, 'client secret');
    this.hostUserId = nonempty(hostUserId, 'host user ID');
    this.rules = normalizeRules(meetingRules);
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.sleep = sleep;
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1_000 || requestTimeoutMs > 30_000) {
      throw zoomError('Zoom request timeout must be from 1000 through 30000 milliseconds', 503);
    }
    this.requestTimeoutMs = requestTimeoutMs;
    this.token = null;
  }

  async fetchResponse(url, options, label) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await this.fetchImpl(url, { ...options, signal: controller.signal });
    } catch {
      throw zoomError(`Zoom ${label} network request failed`, 503);
    } finally {
      clearTimeout(timeout);
    }
  }

  async requestToken() {
    const body = new URLSearchParams({ grant_type: 'account_credentials', account_id: this.accountId });
    const response = await this.fetchResponse(TOKEN_URL, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    }, 'OAuth');
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw zoomError('Zoom OAuth token request failed', response.status, result?.code || null);
    const accessToken = nonempty(result.access_token, 'access token');
    const expiresIn = Number(result.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn < 60) throw zoomError('Zoom OAuth token expiry is invalid');
    const grantedScopes = new Set(String(result.scope || '').split(/\s+/).filter(Boolean));
    if (!REPORT_SCOPE_GROUPS.every(group => group.some(scope => grantedScopes.has(scope)))) {
      throw zoomError('Zoom OAuth app is missing the required meeting-report scopes', 403);
    }
    this.token = {
      value: accessToken,
      apiBase: versionedApiBase(result.api_url || DEFAULT_API_BASE),
      expiresAt: this.now().getTime() + expiresIn * 1_000,
    };
    return this.token;
  }

  async accessToken() {
    if (this.token && this.token.expiresAt - this.now().getTime() > 60_000) return this.token;
    return this.requestToken();
  }

  async request(path, { query = {} } = {}) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await this.accessToken();
      const url = new URL(`${token.apiBase}/${String(path).replace(/^\//, '')}`);
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      }
      let response;
      try {
        response = await this.fetchResponse(url, {
          headers: { authorization: `Bearer ${token.value}`, accept: 'application/json' },
        }, 'report');
      } catch (error) {
        if (attempt < 2) {
          await this.sleep(Math.min(250 * (2 ** attempt), 2_000));
          continue;
        }
        throw error;
      }
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result;
      if (response.status === 401 && attempt === 0) {
        this.token = null;
        continue;
      }
      if (response.status === 429 && attempt < 2) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }
      throw zoomError('Zoom report request failed', response.status, result?.code || null);
    }
    throw zoomError('Zoom report request exhausted retries');
  }

  async paginated(path, { query, field }) {
    const rows = [];
    let nextPageToken = '';
    do {
      const result = await this.request(path, { query: { ...query, page_size: 300, next_page_token: nextPageToken } });
      const page = result[field];
      if (!Array.isArray(page)) throw zoomError(`Zoom ${field} response is invalid`);
      rows.push(...page);
      nextPageToken = String(result.next_page_token || '');
    } while (nextPageToken);
    return rows;
  }

  async listCompletedMeetings({ from, to }) {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    const rows = [];
    for (const segment of reportSegments(from, to)) {
      const result = await this.paginated(`report/users/${encodeURIComponent(this.hostUserId)}/meetings`, {
        query: segment,
        field: 'meetings',
      }).catch(async error => {
        if (!/Zoom meetings response is invalid/.test(error.message)) throw error;
        return this.paginated(`report/users/${encodeURIComponent(this.hostUserId)}/meetings`, {
          query: segment,
          field: 'summaries',
        });
      });
      rows.push(...result);
    }
    return rows.flatMap(row => {
      const meetingId = String(row.meeting_id ?? row.id ?? '').replace(/\s+/g, '');
      const rule = this.rules.get(meetingId);
      if (!rule) return [];
      const instanceId = String(row.meeting_uuid ?? row.uuid ?? '').trim();
      const startsAt = String(row.meeting_start_time ?? row.start_time ?? '').trim();
      if (!instanceId || !startsAt) throw zoomError('Zoom meeting report is missing its instance or start time');
      const startsAtMs = Date.parse(startsAt);
      if (!Number.isFinite(startsAtMs)) throw zoomError('Zoom meeting report has an invalid start time');
      if (startsAtMs < fromMs || startsAtMs >= toMs) return [];
      return [{
        provider_meeting_id: meetingId,
        provider_instance_id: instanceId,
        starts_at: startsAt,
        step: rule.step,
        state: 'candidate',
        participant_count: Number(row.participants ?? row.participants_count ?? 0),
        topic: String(row.meeting_topic ?? row.topic ?? ''),
        provider_payload: row,
      }];
    });
  }

  async listParticipants({ meeting }) {
    const meetingUuid = meeting?.provider_instance_id;
    const participants = await this.paginated(`report/meetings/${encodeMeetingUuid(meetingUuid)}/participants`, {
      query: { include_fields: 'registrant_id' },
      field: 'participants',
    });
    return participants.map(row => {
      const joinTime = String(row.join_time || '').trim() || null;
      const leaveTime = String(row.leave_time || '').trim() || null;
      const participantId = String(row.participant_user_id || row.id || row.registrant_id || '').trim() || null;
      const displayName = String(row.name || row.user_name || '').trim() || 'Unidentified Zoom attendee';
      const stableTuple = JSON.stringify([
        String(meetingUuid), participantId, String(row.email || '').trim().toLowerCase(),
        displayName, joinTime, leaveTime,
      ]);
      return {
        provider_source_id: `zoom:${sha256(stableTuple)}`,
        participant_source_id: participantId,
        display_name: displayName,
        joined_at: joinTime,
        left_at: leaveTime,
        duration_seconds: row.duration == null ? null : Number(row.duration),
        email: String(row.email || '').trim() || null,
        provider_payload: row,
      };
    });
  }
}

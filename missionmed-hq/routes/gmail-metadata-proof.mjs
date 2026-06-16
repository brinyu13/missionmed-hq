import crypto from 'node:crypto';

const METADATA_PROOF_PATH = '/api/integrations/gmail/metadata-proof';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GMAIL_API_ROOT = 'https://gmail.googleapis.com/gmail/v1';
const EXPECTED_SERVICE_ACCOUNT_EMAIL = 'missionmed-gmail-sync@missionmed-communications-sync.iam.gserviceaccount.com';
const REQUEST_TIMEOUT_MS = 8_000;

const STATIC_ALLOWED_MAILBOXES = new Set([
  'clinicals@missionmedinstitute.com',
  'drj@missionmedinstitute.com',
  'drbrian@missionmedinstitute.com',
]);

export function isGmailMetadataProofPath(pathname = '') {
  return normalizePath(pathname) === METADATA_PROOF_PATH;
}

export async function handleGmailMetadataProofRoute(request, response, url, context = {}) {
  if (!isGmailMetadataProofPath(url.pathname)) {
    return false;
  }

  const headers = context.authHeaders || {};
  if (request.method !== 'GET') {
    sendJson(response, 405, {
      ok: false,
      error: 'method_not_allowed',
      message: 'Gmail metadata proof only supports GET.',
      allowed_methods: ['GET'],
    }, { ...headers, Allow: 'GET' });
    return true;
  }

  const mailbox = normalizeMailbox(url.searchParams.get('mailbox'));
  if (!mailbox) {
    sendJson(response, 400, {
      ok: false,
      error: 'gmail_mailbox_required',
      message: 'Provide one allowlisted mailbox for metadata proof.',
      allowed_mailboxes: Array.from(getConfiguredAllowedMailboxes()),
    }, headers);
    return true;
  }

  const allowedMailboxes = getConfiguredAllowedMailboxes();
  if (!allowedMailboxes.has(mailbox)) {
    sendJson(response, 403, {
      ok: false,
      error: 'gmail_mailbox_not_allowed',
      message: 'Gmail metadata proof is limited to allowlisted MissionMed mailboxes.',
      allowed_mailboxes: Array.from(allowedMailboxes),
    }, headers);
    return true;
  }

  const config = readGmailDwdConfig();
  if (!config.ok) {
    sendJson(response, config.httpStatus, {
      ok: false,
      error: config.error,
      message: config.message,
      missing: config.missing,
      invalid: config.invalid,
      proof_mode: 'metadata_only',
      gmail_messages_read: false,
      gmail_writes: false,
    }, headers);
    return true;
  }

  const proof = await runMetadataProof({
    mailbox,
    credentials: config.credentials,
    scopes: config.scopes,
  });

  if (!proof.ok) {
    sendJson(response, proof.httpStatus || 502, {
      ok: false,
      error: proof.error || 'gmail_metadata_proof_failed',
      message: proof.message || 'Gmail metadata proof failed.',
      mailbox,
      provider_status: proof.providerStatus || null,
      proof_mode: 'metadata_only',
      gmail_messages_read: false,
      gmail_writes: false,
    }, headers);
    return true;
  }

  sendJson(response, 200, {
    ok: true,
    proof_mode: 'metadata_only',
    auth_model: 'domain_wide_delegation',
    scope: GMAIL_READONLY_SCOPE,
    mailbox: proof.mailbox,
    profile: proof.profile,
    labels: proof.labels,
    gmail_messages_read: false,
    gmail_writes: false,
    supabase_writes: false,
    live_email_sent: false,
  }, headers);
  return true;
}

export function readGmailDwdConfig() {
  const invalid = [];
  const missing = [];

  const authModel = String(process.env.MISSIONMED_GMAIL_AUTH_MODEL || '').trim().toLowerCase();
  if (authModel !== 'domain_wide_delegation') {
    invalid.push('MISSIONMED_GMAIL_AUTH_MODEL');
  }

  const scopes = parseScopes(process.env.GOOGLE_GMAIL_SCOPES || GMAIL_READONLY_SCOPE);
  if (scopes.length !== 1 || scopes[0] !== GMAIL_READONLY_SCOPE) {
    invalid.push('GOOGLE_GMAIL_SCOPES');
  }

  const rawJson = String(process.env.GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON || '').trim();
  if (!rawJson) {
    missing.push('GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON');
  }

  if (missing.length || invalid.length) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'gmail_setup_required',
      message: 'Gmail metadata proof requires Railway-only DWD configuration before any Gmail API call can run.',
      missing,
      invalid,
    };
  }

  let credentials;
  try {
    credentials = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      httpStatus: 503,
      error: 'gmail_service_account_json_invalid',
      message: 'Gmail service account JSON is not parseable. Re-enter it as a Railway secret.',
      invalid: ['GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON'],
    };
  }

  const clientEmail = normalizeMailbox(credentials?.client_email);
  const configuredEmail = normalizeMailbox(process.env.GOOGLE_GMAIL_SERVICE_ACCOUNT_EMAIL);
  if (clientEmail !== EXPECTED_SERVICE_ACCOUNT_EMAIL || (configuredEmail && configuredEmail !== clientEmail)) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'gmail_service_account_mismatch',
      message: 'Gmail service account identity does not match the authorized MissionMed DWD client.',
      invalid: ['GOOGLE_GMAIL_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON'],
    };
  }

  const privateKey = normalizePrivateKey(credentials?.private_key);
  if (!privateKey) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'gmail_service_account_private_key_missing',
      message: 'Gmail service account JSON is missing a private key.',
      invalid: ['GOOGLE_GMAIL_SERVICE_ACCOUNT_JSON'],
    };
  }

  return {
    ok: true,
    scopes,
    credentials: {
      clientEmail,
      privateKey,
    },
  };
}

async function runMetadataProof({ mailbox, credentials, scopes }) {
  const tokenResult = await mintDelegatedAccessToken({ mailbox, credentials, scopes });
  if (!tokenResult.ok) return tokenResult;

  const profileResult = await googleGetJson(`${GMAIL_API_ROOT}/users/${encodeURIComponent(mailbox)}/profile`, tokenResult.accessToken);
  if (!profileResult.ok) return profileResult;

  const labelsResult = await googleGetJson(`${GMAIL_API_ROOT}/users/${encodeURIComponent(mailbox)}/labels`, tokenResult.accessToken);
  if (!labelsResult.ok) return labelsResult;

  const labels = Array.isArray(labelsResult.data?.labels) ? labelsResult.data.labels : [];
  const systemLabelIds = labels
    .filter((label) => String(label?.type || '') === 'system')
    .map((label) => sanitizeToken(label?.id, 60))
    .filter(Boolean)
    .sort();

  return {
    ok: true,
    mailbox: normalizeMailbox(profileResult.data?.emailAddress) || mailbox,
    profile: {
      emailAddress: normalizeMailbox(profileResult.data?.emailAddress) || mailbox,
      historyId: sanitizeToken(profileResult.data?.historyId, 80),
    },
    labels: {
      count: labels.length,
      system_count: systemLabelIds.length,
      custom_count: Math.max(0, labels.length - systemLabelIds.length),
      system_label_ids: systemLabelIds,
      custom_label_names_returned: false,
    },
  };
}

export async function mintDelegatedAccessToken({ mailbox, credentials, scopes }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: credentials.clientEmail,
    scope: scopes.join(' '),
    aud: GOOGLE_TOKEN_URL,
    exp: issuedAt + 3600,
    iat: issuedAt,
    sub: mailbox,
  };

  const assertion = signJwt({ alg: 'RS256', typ: 'JWT' }, claims, credentials.privateKey);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const result = await postFormJson(GOOGLE_TOKEN_URL, body);
  if (!result.ok) return result;

  const accessToken = String(result.data?.access_token || '').trim();
  if (!accessToken) {
    return {
      ok: false,
      httpStatus: 502,
      error: 'gmail_access_token_missing',
      message: 'Google did not return an access token for metadata proof.',
    };
  }

  return { ok: true, accessToken };
}

function signJwt(header, claims, privateKey) {
  const encodedHeader = base64urlJson(header);
  const encodedClaims = base64urlJson(claims);
  const input = `${encodedHeader}.${encodedClaims}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${input}.${signature}`;
}

async function postFormJson(url, body) {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return providerError(response.status, data, 'gmail_access_token_failed');
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      httpStatus: 502,
      error: 'gmail_access_token_request_failed',
      message: 'Google token request failed before metadata proof could run.',
      reason: safeErrorMessage(error),
    };
  }
}

export async function googleGetJson(url, accessToken) {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return providerError(response.status, data, 'gmail_metadata_request_failed');
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      httpStatus: 502,
      error: 'gmail_metadata_request_failed',
      message: 'Gmail metadata request failed.',
      reason: safeErrorMessage(error),
    };
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function providerError(status, data, fallbackError) {
  return {
    ok: false,
    httpStatus: status === 401 || status === 403 ? 403 : 502,
    providerStatus: status,
    error: fallbackError,
    message: sanitizeProviderMessage(data?.error_description || data?.error?.message || data?.error || 'Gmail metadata proof provider call failed.'),
  };
}

export function getConfiguredAllowedMailboxes() {
  const configured = String(process.env.MISSIONMED_GMAIL_ALLOWED_MAILBOXES || '')
    .split(',')
    .map(normalizeMailbox)
    .filter(Boolean);
  const allowlisted = configured.length ? configured : Array.from(STATIC_ALLOWED_MAILBOXES);
  return new Set(allowlisted.filter((mailbox) => STATIC_ALLOWED_MAILBOXES.has(mailbox)));
}

function parseScopes(value) {
  return String(value || '')
    .split(/[,\s]+/u)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function normalizePath(value) {
  return String(value || '').replace(/\/+$/u, '') || '/';
}

export function normalizeMailbox(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/gu, '\n').trim();
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function sanitizeToken(value, maxLength) {
  return String(value || '').replace(/[^A-Za-z0-9_.@:-]/gu, '').slice(0, maxLength);
}

function sanitizeProviderMessage(value) {
  return String(value || '')
    .replace(/ya29\.[A-Za-z0-9._-]+/gu, '[redacted_token]')
    .replace(/-----BEGIN [^-]+-----[\s\S]+?-----END [^-]+-----/gu, '[redacted_private_key]')
    .slice(0, 300);
}

function safeErrorMessage(error) {
  if (error?.name === 'AbortError') return 'request_timeout';
  return sanitizeProviderMessage(error instanceof Error ? error.message : String(error || 'unknown_error'));
}

export function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload, null, 2));
}

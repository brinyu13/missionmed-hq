import http from 'node:http';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { analyzeSafTranscript } from './saf_analyzer.mjs';
import { selectDbocQuestion } from './question_selector.mjs';
import { buildDeliveryInsights, computeDeliveryMetricsFromWav, computeDeliveryMetricsSafeFallback } from './worker_metrics.mjs';

const { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } = crypto;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC_ROOT = path.join(__dirname, 'public');
const PROJECT_ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(__dirname, '.env');
const ENV_LOCAL_FILE = path.join(__dirname, '.env.local');
const INTERNAL_REQUEST_ORIGIN = 'http://internal.invalid';
const WORDPRESS_AUTH_REDIRECT_ACTION = 'mmac_hq_auth_redirect';
const RUNTIME_ENV = String(process.env.NODE_ENV || 'development').trim().toLowerCase() || 'development';
const IS_PRODUCTION = RUNTIME_ENV === 'production';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const FILE_ENV = IS_PRODUCTION ? {} : loadEnvFiles([ENV_FILE, ENV_LOCAL_FILE]);
const WP_LOGIN_PATH = process.env.MMHQ_WP_LOGIN_PATH || '/login';

const PORT = Number(process.env.PORT) || 4173;
const CONFIGURED_SESSION_SECRET = (process.env.MMHQ_SESSION_SECRET || '').trim();

const SESSION_SECRET =
  CONFIGURED_SESSION_SECRET ||
  crypto.randomBytes(32).toString('hex');

const OPERATOR_SCOPES = {
  brian: {
    operator: 'brian',
    assignee: 'brian',
    owner_name: 'Brian',
    division: 'mission_residency',
    division_label: 'Mission Residency',
    is_all: true,
    aliases: ['brian', 'dr brian', 'dr. brian', 'brianb', 'bolante'],
  },
  dr_j: {
    operator: 'dr_j',
    assignee: 'dr_j',
    owner_name: 'Dr. J',
    division: 'usmle_drills',
    division_label: 'USMLE Drills',
    is_all: false,
    aliases: ['dr j', 'dr. j', 'dr_j', 'usmle', 'exam prep', 'examprep'],
  },
  phil: {
    operator: 'phil',
    assignee: 'phil',
    owner_name: 'Phil',
    division: 'usce',
    division_label: 'Mission USCE',
    is_all: false,
    aliases: ['phil', 'usce', 'clinicals'],
  },
};

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const CONFIG = {
  port: PORT,
  runtimeEnv: RUNTIME_ENV,
  isProduction: IS_PRODUCTION,
  hqBaseUrl: resolveHqBaseUrl(),
  publicBaseUrl: resolvePublicBaseUrl(),
  allowedOrigin: String(envValue('MMHQ_ALLOWED_ORIGIN', '')).trim(),
  authRequired: resolveAuthRequired(),
  sessionCookieName: envValue('MMHQ_SESSION_COOKIE', 'mmhq_session'),
  sessionTtlSeconds: Math.max(600, Number(envValue('MMHQ_SESSION_TTL_SECONDS', '28800'))),
  sessionSecret: SESSION_SECRET,
  sessionSecretConfigured: Boolean(SESSION_SECRET),
  wpBase: sanitizeServiceUrl(envValue('MMHQ_WP_BASE', 'https://missionmedinstitute.com')),
  wpNamespace: String(envValue('MMHQ_WP_NAMESPACE', 'missionmed-command-center/v1')).replace(/^\/+|\/+$/gu, ''),
  wpUsername: envValue('MMHQ_WP_USERNAME', ''),
  wpAppPassword: envValue('MMHQ_WP_APP_PASSWORD', ''),
  wpBearerToken: envValue('MMHQ_WP_BEARER_TOKEN', ''),
  wpAuthEndpoint: envValue('MMHQ_WP_AUTH_ENDPOINT', '/wp-json/missionmed-command-center/v1/auth/token/'),
  wpAllowedRoles: splitCsv(envValue('MMHQ_ALLOWED_WP_ROLES', 'administrator')),
  stripeSecretKey: envValue('MMHQ_STRIPE_SECRET_KEY', ''),
  stripeConnectClientId: envValue('MMHQ_STRIPE_CONNECT_CLIENT_ID', ''),
  stripeConnectRedirectUri: sanitizeServiceUrl(envValue('MMHQ_STRIPE_CONNECT_REDIRECT_URI', '')),
  stripeConnectScope: String(envValue('MMHQ_STRIPE_CONNECT_SCOPE', 'read_write')).trim() || 'read_write',
  supabaseUrl: sanitizeServiceUrl(envValue('MMHQ_SUPABASE_URL', '')),
  supabaseKey: String(envValue('MMHQ_SUPABASE_KEY', '')).trim(),
  supabaseAnonKey: envValue('MMHQ_SUPABASE_ANON_KEY', ''),
  supabaseServiceRoleKey: envValue('MMHQ_SUPABASE_SERVICE_ROLE_KEY', ''),
  supabaseLegacyKeysPresent: hasConfiguredEnv('MMHQ_SUPABASE_SERVICE_ROLE_KEY') || hasConfiguredEnv('MMHQ_SUPABASE_ANON_KEY'),
  cieBase: sanitizeServiceUrl(envValue('MMHQ_CIE_BASE', '')),
  mediaUploadBase: sanitizeServiceUrl(envValue('MMHQ_MEDIA_UPLOAD_BASE', '')) || sanitizeServiceUrl(envValue('MMHQ_CIE_BASE', '')),
  mediaPipelineBase: sanitizeServiceUrl(envValue('MMHQ_MEDIA_PIPELINE_BASE', 'http://127.0.0.1:8001')),
  mediaDropZoneRoot: String(envValue('MMHQ_MEDIA_DROP_ZONE_ROOT', '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE')).trim(),
  cieBearerToken: envValue('MMHQ_CIE_BEARER_TOKEN', ''),
  openaiApiKey: envValue('OPENAI_API_KEY', '') || envValue('MMHQ_OPENAI_API_KEY', ''),
  mediaEmbeddingModel: String(envValue('MMHQ_MEDIA_EMBEDDING_MODEL', 'text-embedding-3-small')).trim() || 'text-embedding-3-small',
  mediaSemanticRpc: String(envValue('MMHQ_MEDIA_SEMANTIC_RPC', 'match_media_transcript_chunks')).trim() || 'match_media_transcript_chunks',
  mediaAllowFallback: envFlag('MMHQ_MEDIA_ALLOW_FALLBACK', false),
  studioBase: sanitizeServiceUrl(envValue('MMHQ_STUDIO_BASE', '')) || sanitizeServiceUrl(envValue('MMHQ_CIE_BASE', '')),
  studioBearerToken: envValue('MMHQ_STUDIO_BEARER_TOKEN', '') || envValue('MMHQ_CIE_BEARER_TOKEN', ''),
  mediaRegistryUrl: resolveMediaRegistryUrl(),
};

const AUTH_ALLOWED_SUPABASE_PROJECT = 'fglyvdykwgbuivikqoah';
const AUTH_FORBIDDEN_SUPABASE_PROJECT = 'plgndqcplokwiuimwhzh';
const AUTH_BOOTSTRAP_PASSWORD_SALT = String(envValue('MMHQ_SUPABASE_PASSWORD_SALT', 'missionmed-bootstrap-salt')).trim() || 'missionmed-bootstrap-salt';
const AUTH_WORDPRESS_COOKIE_PREFIXES = ['wordpress_logged_in_', 'wordpress_sec_'];

const HQ_CACHE = new Map();
const HQ_CACHE_TTL_MS = 5 * 60 * 1000;
const VIDEO_WORKFLOW_CACHE_TTL_MS = 3 * 60 * 1000;
const MEDIA_REGISTRY_CACHE_TTL_MS = 3 * 60 * 1000;
const DBOC_TRANSCRIBE_QUEUE = [];
const DBOC_TRANSCRIBE_HISTORY = [];
const DBOC_TRANSCRIBE_EVENTS = [];
const DBOC_TRANSCRIBE_STATUS_BY_RESPONSE = new Map();
const DBOC_TRANSCRIBE_WORKER_POLL_MS = 5_000;
const DBOC_TRANSCRIBE_RETRY_BACKOFF_MS = [5_000, 15_000, 45_000];
const DBOC_ENCODE_QUEUE = [];
const DBOC_ENCODE_EVENTS = [];
const DBOC_ENCODE_STATUS_BY_RESPONSE = new Map();
const DBOC_ENCODE_WORKER_POLL_MS = 5_000;
const DBOC_ENCODE_RETRY_BACKOFF_MS = [5_000, 15_000];
const DBOC_METRICS_QUEUE = [];
const DBOC_METRICS_EVENTS = [];
const DBOC_METRICS_STATUS_BY_RESPONSE = new Map();
const DBOC_METRICS_WORKER_POLL_MS = 5_000;
const DBOC_METRICS_RETRY_BACKOFF_MS = [5_000, 15_000];
const DBOC_PIPELINE_SAFE_MODE = envFlag('MMHQ_DBOC_PIPELINE_SAFE_MODE', true);
const DBOC_TRANSCRIBE_SAFE_MODE = envFlag('MMHQ_DBOC_TRANSCRIBE_SAFE_MODE', true);
let dbocTranscribeWorkerBusy = false;
let dbocTranscribeWorkerTimer = null;
let dbocEncodeWorkerBusy = false;
let dbocEncodeWorkerTimer = null;
let dbocMetricsWorkerBusy = false;
let dbocMetricsWorkerTimer = null;
const MEDIA_FALLBACK_STORE_PATH = path.join(__dirname, 'data', 'media_system_fallback.json');
const MEDIA_SUBMISSION_STORE_PATH = path.join(__dirname, 'data', 'media_submissions.json');
const MEDIA_UPLOAD_MAX_BYTES = Math.max(1_000_000, Number(envValue('MMHQ_MEDIA_UPLOAD_MAX_BYTES', String(2 * 1024 * 1024 * 1024))));

const REQUIRED_ENV_VARIABLES = [
  { key: 'PORT', description: 'Railway-assigned HTTP port' },
  { key: 'MMHQ_WP_BASE', description: 'WordPress bridge base URL' },
  { key: 'MMHQ_CIE_BASE', description: 'Media Engine / CIE base URL' },
  { key: 'MMHQ_SESSION_SECRET', description: 'Required HQ session secret' },
  { key: 'MMHQ_SUPABASE_URL', description: 'Supabase base URL' },
  { key: 'MMHQ_SUPABASE_KEY', description: 'Required Supabase server key' },
];

const STARTUP_VALIDATION = buildEnvValidation();

const SESSION_KEY = buildSessionKey(SESSION_SECRET);
assertStartupConfiguration();

const server = http.createServer(async (request, response) => {
  const startedAt = Date.now();
  let pathname = '/';

  response.on('finish', () => {
    logRequest(request, response, pathname, Date.now() - startedAt);
  });

  try {
    const url = new URL(request.url || '/', getRequestOrigin(request));
    pathname = decodeURIComponent(url.pathname);

    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if ((pathname === '/hq' || pathname === '/hq/') && request.method === 'GET') {
      const hasHandoffToken = String(url.searchParams.get('token') || '').trim() !== '';
      const session = readSessionFromRequest(request);

      if (!session && !hasHandoffToken) {
        sendRedirect(response, '/api/auth/start');
        return;
      }
    }

    if (request.method === 'GET' && (
      pathname === '/email' ||
      pathname === '/email/' ||
      pathname === '/email/email_inbox.html'
    )) {
      const filePath = path.join(__dirname, 'public', 'email', 'email_inbox.html');

      try {
        const html = readFileSync(filePath, 'utf-8');
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(html);
      } catch (err) {
        console.error('EMAIL LOAD ERROR:', err);
        response.writeHead(500);
        response.end('FAILED TO LOAD EMAIL UI');
      }
      return;
    }

    if (pathname.startsWith('/api/')) {
      const session = authenticateApiRequest(request);
      await handleApiRoute(request, response, url, { session });
      return;
    }

    await serveStatic(response, pathname);
  } catch (error) {
    handleServerError(response, error);
  }
});

server.on('error', (err) => {
  console.error('FATAL START ERROR:', err);
});

try {
  console.log('STARTING SERVER...');
  console.log('PORT:', PORT);
  console.log('STATIC ROOT:', STATIC_ROOT);
  console.log('RUNTIME __dirname:', __dirname);
  const emailPath = path.resolve(__dirname, 'public/email/email_inbox.html');
  const publicDirPath = path.join(__dirname, 'public');
  const emailDirPath = path.join(publicDirPath, 'email');
  console.log('RESOLVED EMAIL PATH:', emailPath);
  console.log('FILE EXISTS:', existsSync(emailPath));
  console.log('PUBLIC DIR EXISTS:', existsSync(publicDirPath));
  console.log('EMAIL DIR EXISTS:', existsSync(emailDirPath));
  console.log('PUBLIC DIR CONTENTS:', existsSync(publicDirPath) ? readdirSync(publicDirPath) : []);
  console.log('EMAIL DIR CONTENTS:', existsSync(emailDirPath) ? readdirSync(emailDirPath) : []);
  console.log('EMAIL PATH:', path.join(__dirname, 'public', 'email', 'email_inbox.html'));
  startDbocTranscribeWorker();
  startDbocEncodeWorker();
  startDbocMetricsWorker();
  server.listen(PORT, '0.0.0.0', () => {
    console.log('HQ server running on port:', PORT);
  });
} catch (err) {
  console.error('FATAL START ERROR:', err);
}

function getCachedValue(key) {
  const cached = HQ_CACHE.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    HQ_CACHE.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue(key, value, ttlMs = HQ_CACHE_TTL_MS) {
  HQ_CACHE.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

function clearCachedValue(key) {
  HQ_CACHE.delete(key);
}

function invalidateDerivedCaches() {
  for (const key of [
    'hq:summary',
    'hq:notifications',
    'hq:tasks',
    'hq:medmail',
    'hq:payments',
    'hq:video-workflow',
    'hq:task-capabilities',
    'hq:courses',
    'hq:lesson-video-scan',
  ]) {
    clearCachedValue(key);
  }
}

function envValue(key, fallback) {
  if (process.env[key] !== undefined) {
    return process.env[key];
  }

  if (FILE_ENV[key] !== undefined) {
    return FILE_ENV[key];
  }

  return fallback;
}

function envFlag(key, fallback) {
  const value = String(envValue(key, fallback ? 'true' : 'false')).trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  return !['0', 'false', 'no', 'off'].includes(value);
}

function resolveAuthRequired() {
  // Production HQ always requires authenticated access.
  if (IS_PRODUCTION) {
    return true;
  }

  return envFlag('MMHQ_AUTH_REQUIRED', true);
}

function hasConfiguredEnv(key) {
  if (process.env[key] !== undefined) {
    return String(process.env[key]).trim() !== '';
  }

  if (FILE_ENV[key] !== undefined) {
    return String(FILE_ENV[key]).trim() !== '';
  }

  return false;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const contents = readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/gu)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/gu, '');

    if (key) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function loadEnvFiles(filePaths = []) {
  return filePaths.reduce((accumulator, filePath) => ({
    ...accumulator,
    ...loadEnvFile(filePath),
  }), {});
}

function parsePort(value, fallback = 4173) {
  const parsed = Number(String(value || '').trim());
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  return fallback;
}

function resolvePort() {
  const processPort = parsePort(process.env.PORT, null);
  if (processPort !== null) {
    return processPort;
  }

  if (IS_PRODUCTION) {
    return null;
  }

  return 4173;
}

function normalizeHostedBaseUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return '';
  }

  const absolute = candidate.startsWith('http://') || candidate.startsWith('https://')
    ? candidate
    : `https://${candidate}`;

  return sanitizeHostedReference(absolute).replace(/\/+$/gu, '');
}

function resolvePublicBaseUrl() {
  for (const candidate of [
    process.env.MMHQ_PUBLIC_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RAILWAY_STATIC_URL,
  ]) {
    const normalized = normalizeHostedBaseUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function resolveHqBaseUrl() {
  for (const candidate of [
    process.env.HQ_BASE_URL,
    process.env.MMHQ_PUBLIC_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RAILWAY_STATIC_URL,
  ]) {
    const normalized = normalizeHostedBaseUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function sanitizeServiceUrl(value, options = {}) {
  const allowLocalhost = options.allowLocalhost ?? !IS_PRODUCTION;
  const candidate = String(value || '').trim().replace(/\/+$/gu, '');
  if (!candidate) {
    return '';
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    if (!allowLocalhost && isLocalhostHostname(parsed.hostname)) {
      return '';
    }
    return parsed.toString().replace(/\/+$/gu, '');
  } catch {
    return '';
  }
}

function sanitizeHostedReference(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return '';
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function resolveMediaRegistryUrl() {
  const primary = sanitizeServiceUrl(envValue('MMHQ_MEDIA_REGISTRY_URL', ''));
  if (primary) {
    return primary;
  }

  return '';
}

function isDisallowedLocalServiceUrl(key) {
  const raw = String(envValue(key, '') || '').trim();
  if (!raw || !IS_PRODUCTION) {
    return false;
  }

  try {
    return isLocalhostHostname(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function buildSessionKey(secret) {
  const value = String(secret || '').trim();
  if (!value) {
    return null;
  }
  return createHash('sha256').update(value).digest();
}

function assertStartupConfiguration() {
  if (!CONFIG.isProduction) return;

  const warnings = [];

  if (!Number.isInteger(CONFIG.port)) {
    warnings.push('PORT missing');
  }

  if (!SESSION_SECRET) {
    warnings.push('SESSION SECRET missing');
  }

  if (!CONFIG.wpBase) {
    warnings.push('WP BASE missing');
  }

  if (!CONFIG.cieBase) {
    warnings.push('CIE BASE missing');
  }

  if (!CONFIG.studioBase) {
    warnings.push('STUDIO BASE missing');
  }

  if (!CONFIG.supabaseUrl) {
    warnings.push('SUPABASE URL missing');
  }

  if (!getSupabaseToken()) {
    warnings.push('SUPABASE KEY missing (checked MMHQ_SUPABASE_KEY, MMHQ_SUPABASE_SERVICE_ROLE_KEY, MMHQ_SUPABASE_ANON_KEY)');
  } else if (!CONFIG.supabaseKey && (CONFIG.supabaseServiceRoleKey || CONFIG.supabaseAnonKey)) {
    console.log('[CONFIG]', `MMHQ_SUPABASE_KEY not set — using fallback key (mode: ${getSupabaseAuthMode()})`);
  }

  if (warnings.length > 0) {
    console.warn('[CONFIG WARNING]', warnings);
  }
}

function getHqAccessMode(request = null) {
  return CONFIG.authRequired ? 'token-session' : 'open';
}

function getSessionSecretMode() {
  return Boolean(SESSION_SECRET) ? 'persistent-env-secret' : 'missing-env-secret';
}

function getSupabaseAuthMode() {
  if (CONFIG.supabaseKey) {
    return 'mmhq-supabase-key';
  }
  if (CONFIG.supabaseServiceRoleKey) {
    return 'service-role-fallback';
  }
  if (CONFIG.supabaseAnonKey) {
    return 'anon-key-fallback';
  }
  return 'missing';
}

function getMediaAuthMode() {
  return CONFIG.cieBearerToken ? 'bearer' : 'missing-bearer';
}

function getStudioAuthMode() {
  return CONFIG.studioBearerToken ? 'bearer' : 'public-or-bearer';
}

function getWordPressServiceCredentialMode() {
  if (CONFIG.wpBearerToken) {
    return 'bearer';
  }
  if (CONFIG.wpUsername && CONFIG.wpAppPassword) {
    return 'app-password';
  }
  return 'none';
}

function getHeaderAuthorizationValue(headers = {}) {
  return String(headers.Authorization || headers.authorization || '').trim();
}

function getWordPressServiceAuthorization(session = null) {
  return getHeaderAuthorizationValue(getWordPressServiceHeaders(session));
}

function getCieEndpointSource() {
  return hasConfiguredEnv('MMHQ_CIE_BASE') ? 'MMHQ_CIE_BASE' : 'not configured';
}

function getStudioEndpointSource() {
  if (hasConfiguredEnv('MMHQ_STUDIO_BASE')) {
    return 'MMHQ_STUDIO_BASE';
  }
  if (CONFIG.cieBase) {
    return 'MMHQ_CIE_BASE fallback';
  }
  return 'not configured';
}

function buildStripeRuntimeState(hasStoredData = false) {
  const missingEnv = [];

  if (!CONFIG.stripeSecretKey) {
    missingEnv.push('MMHQ_STRIPE_SECRET_KEY');
  }

  const configured = missingEnv.length === 0;

  return {
    configured,
    configuration_state: configured ? 'configured' : 'missing-config',
    missing_env: missingEnv,
    live_refresh_enabled: configured,
    data_mode: configured ? 'live' : (hasStoredData ? 'stored-only' : 'missing-config'),
  };
}
// force redeploy Tue Mar 31 11:47:41 EDT 2026

function buildActiveEndpoints(request = null) {
  return {
    hq_base: getHqBaseForRequest(request) || (CONFIG.publicBaseUrl || 'derived per request'),
    wordpress_base: CONFIG.wpBase || 'not configured',
    wordpress_auth_exchange: resolveWordPressAuthEndpoint() || 'not configured',
    supabase_rpc: CONFIG.supabaseUrl ? `${CONFIG.supabaseUrl}/rest/v1/rpc` : 'not configured',
    cie_base: CONFIG.cieBase || 'not configured',
    cie_source: getCieEndpointSource(),
    media_registry: CONFIG.mediaRegistryUrl || 'not configured',
    studio_base: CONFIG.studioBase || 'not configured',
    studio_source: getStudioEndpointSource(),
  };
}

function buildAuthDebugSnapshot(session = null, request = null) {
  return {
    request: session ? 'authenticated-session' : 'anonymous-request',
    hq: getHqAccessMode(request),
    session_secret: getSessionSecretMode(),
    wordpress: getBridgeHealthWordPressMode(session),
    supabase: getSupabaseAuthMode(),
    media_engine: getMediaAuthMode(),
    studio: getStudioAuthMode(),
  };
}

function buildEnvValidation() {
  const required = REQUIRED_ENV_VARIABLES.map((item) => ({
    ...item,
    configured: item.key === 'PORT'
      ? Number.isInteger(PORT)
      : hasConfiguredEnv(item.key),
  }));

  const missing = required.filter((item) => !item.configured);
  const invalid = [];
  const warnings = [];

  for (const key of ['MMHQ_WP_BASE', 'MMHQ_CIE_BASE', 'MMHQ_STUDIO_BASE', 'MMHQ_MEDIA_REGISTRY_URL']) {
    if (isDisallowedLocalServiceUrl(key)) {
      invalid.push({
        key,
        description: `${key} points at localhost and is ignored when NODE_ENV=production.`,
      });
    }
  }

  if (hasConfiguredEnv('MMHQ_MMVS_REGISTRY_PATH')) {
    warnings.push('MMHQ_MMVS_REGISTRY_PATH is deprecated and ignored. The live HQ shell uses MMHQ_CIE_BASE for Media Engine requests.');
  }

  if (hasConfiguredEnv('MMHQ_MMVS_REGISTRY_URL')) {
    warnings.push('MMHQ_MMVS_REGISTRY_URL is deprecated and ignored. The live HQ shell uses MMHQ_CIE_BASE for Media Engine requests.');
  }

  if (hasConfiguredEnv('MMHQ_MEDIA_REGISTRY_URL')) {
    warnings.push('MMHQ_MEDIA_REGISTRY_URL is deprecated for live HQ routes and does not replace MMHQ_CIE_BASE. Keep it blank unless you are explicitly testing legacy registry helpers.');
  }

  if (!CONFIG.wpBearerToken && !(CONFIG.wpUsername && CONFIG.wpAppPassword)) {
    warnings.push('WordPress bridge has no bearer token or app-password fallback configured. Live auth exchange will depend on the upstream token endpoint.');
  }

  if (!SESSION_SECRET) {
    warnings.push('MMHQ_SESSION_SECRET is missing. HQ token exchange is disabled until the secret is configured.');
  }

  if (CONFIG.supabaseLegacyKeysPresent) {
    warnings.push('MMHQ_SUPABASE_SERVICE_ROLE_KEY and MMHQ_SUPABASE_ANON_KEY are ignored. Set MMHQ_SUPABASE_KEY explicitly.');
  }

  if (!CONFIG.stripeSecretKey) {
    warnings.push('MMHQ_STRIPE_SECRET_KEY is not set. Stripe live-refresh, OAuth callback, and real-time account status are disabled. Set it from the Stripe Dashboard → Developers → API keys.');
  }

  if ((CONFIG.stripeSecretKey && !CONFIG.stripeConnectClientId) || (!CONFIG.stripeSecretKey && CONFIG.stripeConnectClientId)) {
    warnings.push('Stripe Connect OAuth is only partially configured. Add both MMHQ_STRIPE_SECRET_KEY and MMHQ_STRIPE_CONNECT_CLIENT_ID to enable onboarding.');
  }

  if (!CONFIG.cieBase) {
    warnings.push('Media Engine is running without a live bridge. Configure MMHQ_CIE_BASE with the hosted CIE base URL.');
  }

  if (!CONFIG.cieBearerToken) {
    warnings.push('MMHQ_CIE_BEARER_TOKEN is not set. HQ cannot call protected CIE /api/* routes until this bearer token matches CIE_API_TOKEN.');
  }

  if (!CONFIG.studioBase) {
    warnings.push('Studio bridge is not configured. Set MMHQ_STUDIO_BASE, or let it fall back from MMHQ_CIE_BASE by configuring that hosted URL.');
  }

  return {
    status: missing.length || invalid.length ? 'degraded' : 'ok',
    missing,
    invalid,
    warnings,
    required,
  };
}

function logStartupConfiguration() {
  const auth = buildAuthDebugSnapshot();
  const endpoints = buildActiveEndpoints();

  console.log(`MissionMed HQ listening on port ${CONFIG.port}`);
  console.log(`MissionMed HQ public URL: ${CONFIG.hqBaseUrl || CONFIG.publicBaseUrl || 'derived from Railway ingress / request host'}`);
  console.log(`MissionMed HQ runtime: env=${CONFIG.runtimeEnv} | env-source=${CONFIG.isProduction ? 'process-env-only' : 'process-env-plus-local-env-files'}`);
  console.log(`MissionMed HQ auth mode: hq=${auth.hq} | session-secret=${auth.session_secret} | wordpress=${auth.wordpress} | supabase=${auth.supabase}`);
  console.log(`MissionMed HQ active endpoints: wp=${endpoints.wordpress_base} | wp-auth=${endpoints.wordpress_auth_exchange} | supabase-rpc=${endpoints.supabase_rpc} | cie=${endpoints.cie_base} (${endpoints.cie_source}) | studio=${endpoints.studio_base} (${endpoints.studio_source})`);

  if (STARTUP_VALIDATION.missing.length) {
    console.warn(`MissionMed HQ env validation: missing ${STARTUP_VALIDATION.missing.length} required variable(s).`);
    for (const item of STARTUP_VALIDATION.missing) {
      console.warn(`- ${item.key}: ${item.description}`);
    }
    console.warn('MissionMed HQ will return explicit bridge errors for affected live routes until the missing values are configured.');
  } else {
    console.log('MissionMed HQ env validation: all required variables are configured.');
  }

  if (STARTUP_VALIDATION.invalid.length) {
    console.warn(`MissionMed HQ env validation: rejected ${STARTUP_VALIDATION.invalid.length} localhost-only production endpoint(s).`);
    for (const item of STARTUP_VALIDATION.invalid) {
      console.warn(`- ${item.key}: ${item.description}`);
    }
  }

  if (STARTUP_VALIDATION.warnings.length) {
    for (const warning of STARTUP_VALIDATION.warnings) {
      console.warn(`MissionMed HQ env warning: ${warning}`);
    }
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/gu, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader || '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((accumulator, chunk) => {
      const equalsIndex = chunk.indexOf('=');
      if (equalsIndex === -1) {
        return accumulator;
      }

      const key = chunk.slice(0, equalsIndex).trim();
      const value = chunk.slice(equalsIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function extractBearerToken(authorizationHeader = '') {
  const match = String(authorizationHeader || '').trim().match(/^Bearer\s+(.+)$/iu);
  return match ? String(match[1] || '').trim() : '';
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Number(options.maxAge) || 0)}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function shouldUseSecureCookies(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').toLowerCase();
  const host = String(request.headers.host || '').toLowerCase();

  if (forwardedProto === 'https') {
    return true;
  }

  return !host.includes('localhost') && !host.includes('127.0.0.1');
}

function getRequestOrigin(request) {
  const protocol = String(request.headers['x-forwarded-proto'] || '').trim() || (shouldUseSecureCookies(request) ? 'https' : 'http');
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').trim() || new URL(INTERNAL_REQUEST_ORIGIN).host;
  return `${protocol}://${host}`;
}

function getHqBaseForRequest(request = null) {
  if (CONFIG.hqBaseUrl) {
    return CONFIG.hqBaseUrl;
  }

  if (request) {
    return getRequestOrigin(request);
  }

  return '';
}

function isLocalhostHostname(hostname = '') {
  return LOCALHOST_HOSTNAMES.has(String(hostname || '').trim().toLowerCase());
}

function isLocalhostRequest(request) {
  try {
    return isLocalhostHostname(new URL(getRequestOrigin(request)).hostname);
  } catch {
    return false;
  }
}

function createEncryptedPayloadToken(payload) {
  if (!SESSION_KEY) {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', SESSION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}.${base64UrlEncode(tag)}`;
}

function readEncryptedPayloadToken(token) {
  if (!SESSION_KEY) {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  const iv = base64UrlDecode(parts[1]);
  const ciphertext = base64UrlDecode(parts[2]);
  const tag = base64UrlDecode(parts[3]);
  const decipher = createDecipheriv('aes-256-gcm', SESSION_KEY, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

function createEncryptedSession(payload) {
  return createEncryptedPayloadToken(payload);
}

function readEncryptedSession(token) {
  const payload = readEncryptedPayloadToken(token);

  if (!payload?.expiresAt || Number.isNaN(new Date(payload.expiresAt).getTime())) {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  return payload;
}

function createSessionRecord(user, authContext = {}, authSource) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONFIG.sessionTtlSeconds * 1000);

  return {
    version: 1,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    csrfToken: base64UrlEncode(randomBytes(18)),
    authSource,
    wpAuthorization: String(authContext.wpAuthorization || '').trim(),
    user,
  };
}

function readSessionFromRequest(request) {
  const bearerToken = extractBearerToken(request.headers.authorization || request.headers.Authorization || '');
  if (bearerToken) {
    try {
      return readEncryptedSession(bearerToken);
    } catch {
      return null;
    }
  }

  const cookies = parseCookies(request.headers.cookie || '');
  const token = cookies[CONFIG.sessionCookieName];

  if (!token) {
    return null;
  }

  try {
    return readEncryptedSession(token);
  } catch {
    return null;
  }
}

function buildSessionCookie(request, session) {
  return serializeCookie(CONFIG.sessionCookieName, createEncryptedSession(session), {
    httpOnly: true,
    maxAge: CONFIG.sessionTtlSeconds,
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(request),
  });
}

function clearSessionCookie(request) {
  return serializeCookie(CONFIG.sessionCookieName, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(request),
  });
}

function buildWordPressAuthRedirectUrl(returnTo = '') {
  if (!CONFIG.wpBase) {
    return '';
  }

  const target = new URL('/wp-admin/admin-post.php', CONFIG.wpBase);
  target.searchParams.set('action', WORDPRESS_AUTH_REDIRECT_ACTION);

  if (returnTo) {
    target.searchParams.set('return_to', returnTo);
  }

  return target.toString();
}

function getLoginHints(request = null) {
  const hqBase = getHqBaseForRequest(request);
  const hqEntryUrl = hqBase ? new URL('/api/auth/session', hqBase).toString() : '';
  const sessionPersistence = Boolean(SESSION_SECRET) ? 'persistent' : 'missing-env-secret';

  return {
    auth_required: CONFIG.authRequired,
    session_transport: 'bearer-token',
    session_persistence: sessionPersistence,
    auth_start_url: '/api/auth/start',
    wordpress_login_url: CONFIG.wpBase ? `${CONFIG.wpBase}${WP_LOGIN_PATH}` : '',
    wordpress_handoff_url: buildWordPressAuthRedirectUrl(hqEntryUrl),
    wordpress_hq_entry_url: hqEntryUrl,
    wordpress_token_exchange_url: resolveWordPressAuthEndpoint(),
    app_password_exchange_available: Boolean(CONFIG.wpBase),
  };
}

function buildSessionPayload(session = null, request = null) {
  const accessToken = session && Boolean(SESSION_SECRET)
    ? createEncryptedSession(session)
    : '';

  if (!session) {
    return {
      authenticated: false,
      authRequired: CONFIG.authRequired,
      sessionPersistent: Boolean(SESSION_SECRET),
      authMode: buildAuthDebugSnapshot(null, request),
      activeEndpoints: buildActiveEndpoints(request),
      login: getLoginHints(request),
      accessToken: '',
    };
  }

  return {
    authenticated: true,
    authRequired: CONFIG.authRequired,
    sessionPersistent: Boolean(SESSION_SECRET),
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      dbocUserId: session.supabaseUserId || session.user.id,
      login: session.user.login,
      displayName: session.user.displayName,
      email: session.user.email,
      roles: session.user.roles,
      scope: session.user.scope,
      authSource: session.authSource,
    },
    accessToken,
    authMode: buildAuthDebugSnapshot(session, request),
    activeEndpoints: buildActiveEndpoints(request),
    login: getLoginHints(request),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let totalSize = 0;

  for await (const chunk of request) {
    totalSize += chunk.length;
    if (totalSize > 262144) {
      console.warn('[CONFIG WARNING]', 'removed fatal error');
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }
}

async function readMultipartFormData(request) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Expected multipart/form-data request.');
  }

  const webRequest = new Request(`${getRequestOrigin(request)}${request.url || '/'}`, {
    method: request.method || 'POST',
    headers: request.headers,
    body: Readable.toWeb(request),
    duplex: 'half',
  });

  return webRequest.formData();
}

function sanitizeUploadFilename(filename = '') {
  const base = path.basename(String(filename || '').trim() || 'upload.mp4');
  const safe = base
    .replace(/[^\w.\-]+/gu, '_')
    .replace(/_+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  return safe || 'upload.mp4';
}

function normalizeSubmissionType(value) {
  return normalizeMediaString(value)
    .toLowerCase()
    .replace(/[^\w]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

function normalizeMediaSubmissionStoreShape(value = {}) {
  const uploads = Array.isArray(value?.uploads) ? value.uploads : [];
  return {
    version: 1,
    uploads: uploads
      .map((row) => ({
        video_id: sanitizeMediaIdentifier(row?.video_id),
        file_sha256: normalizeMediaString(row?.file_sha256).toLowerCase(),
        size_bytes: Math.max(0, Math.floor(coerceNumber(row?.size_bytes, 0))),
        file_name: normalizeMediaString(row?.file_name),
        student_name: normalizeMediaString(row?.student_name),
        submitted_by_user_id: normalizeMediaString(row?.submitted_by_user_id),
        course: normalizeMediaString(row?.course),
        session_type: normalizeMediaString(row?.session_type),
        submission_type: normalizeSubmissionType(row?.submission_type || row?.session_type),
        date: normalizeMediaString(row?.date),
        division: normalizeMediaDivision(row?.division || 'other'),
        category: normalizeMediaSubcategory(row?.category),
        pipeline_mode: normalizeMediaString(row?.pipeline_mode || 'process'),
        created_at: normalizeMediaString(row?.created_at),
        updated_at: normalizeMediaString(row?.updated_at),
      }))
      .filter((row) => row.video_id),
  };
}

function loadMediaSubmissionStore() {
  try {
    if (!existsSync(MEDIA_SUBMISSION_STORE_PATH)) {
      return normalizeMediaSubmissionStoreShape({});
    }
    const raw = JSON.parse(readFileSync(MEDIA_SUBMISSION_STORE_PATH, 'utf8'));
    return normalizeMediaSubmissionStoreShape(raw);
  } catch (error) {
    console.warn('MissionMed HQ media submissions: failed to load store:', error instanceof Error ? error.message : error);
    return normalizeMediaSubmissionStoreShape({});
  }
}

function saveMediaSubmissionStore(store) {
  mkdirSync(path.dirname(MEDIA_SUBMISSION_STORE_PATH), { recursive: true });
  writeFileSync(MEDIA_SUBMISSION_STORE_PATH, `${JSON.stringify(normalizeMediaSubmissionStoreShape(store), null, 2)}\n`, 'utf8');
}

function getMediaSubmissionMetadata(videoId) {
  const safeVideoId = sanitizeMediaIdentifier(videoId);
  if (!safeVideoId) {
    return null;
  }
  const store = loadMediaSubmissionStore();
  return store.uploads.find((row) => row.video_id === safeVideoId) || null;
}

function applyMediaSubmissionMetadata(rawItem = {}) {
  const videoId = sanitizeMediaIdentifier(rawItem?.id || rawItem?.video_id || rawItem?.mmvc_id);
  if (!videoId) {
    return rawItem;
  }
  const submission = getMediaSubmissionMetadata(videoId);
  if (!submission) {
    return rawItem;
  }

  return {
    ...rawItem,
    student_name: submission.student_name || rawItem.student_name || rawItem?.metadata?.student_name,
    submitted_by_user_id: submission.submitted_by_user_id || rawItem.submitted_by_user_id || rawItem?.metadata?.submitted_by_user_id,
    course: submission.course || rawItem.course || rawItem?.metadata?.course,
    session_type: submission.session_type || rawItem.session_type || rawItem?.metadata?.session_type,
    submission_type: submission.submission_type || rawItem.submission_type || rawItem?.metadata?.submission_type,
    date: submission.date || rawItem.date || rawItem?.metadata?.date,
  };
}

function extractPipelineVideoId(payload = {}) {
  return sanitizeMediaIdentifier(
    payload?.entry?.id
    || payload?.entry?.video_id
    || payload?.asset_id
    || payload?.id
    || payload?.video_id,
  );
}

function ensureLocalDropZoneRoot() {
  const dropZoneRoot = path.resolve(CONFIG.mediaDropZoneRoot || '');
  if (!dropZoneRoot || dropZoneRoot === path.sep || !existsSync(dropZoneRoot)) {
    throw new Error(`Drop-zone root is unavailable: ${dropZoneRoot || '(empty)'}`);
  }
  return dropZoneRoot;
}

function resolveDropZonePlacement(division, category, safeFilename, fileHash) {
  const dropZoneRoot = ensureLocalDropZoneRoot();
  const normalizedDivision = normalizeMediaDivision(division);
  const normalizedCategory = normalizeMediaSubcategory(category);
  const hashPrefix = String(fileHash || '').slice(0, 12) || randomUUID().slice(0, 12);
  const extension = path.extname(safeFilename || '').toLowerCase() || '.mp4';
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const targetName = `GMT${y}${m}${d}-${hh}${mm}${ss}_Recording_${hashPrefix}${extension}`;

  let zoneName = 'MISSION_RESIDENCY';
  let targetDir = path.join(dropZoneRoot, 'MISSION_RESIDENCY');

  if (normalizedDivision === 'usmle') {
    zoneName = 'USMLE';
    targetDir = path.join(dropZoneRoot, 'usmle');
    const usmleFolderMap = {
      DRJ_DRILLS: 'DRJ_DRILLS',
      DRJ_RAW: 'DRJ_DRILLS',
      DRJ_UNSORTED: 'DRJ_DRILLS',
      OTHER: 'GENERAL',
      OTHER_SOURCES: 'GENERAL',
    };
    const mapped = usmleFolderMap[normalizedCategory] || 'GENERAL';
    targetDir = path.join(targetDir, mapped);
  } else if (normalizedDivision === 'mission_residency') {
    const residencyFolderMap = {
      TESTIMONIALS: 'TESTIMONIALS',
      I_MATCHED: 'MATCH_DAY',
      FOUNDATION: 'LIVE_SESSION',
      MOCK_IV: 'LIVE_SESSION',
      ONE_ON_ONE: 'LIVE_SESSION',
      RX_REPLAY: 'LIVE_SESSION',
      STRATEGY: 'LIVE_SESSION',
    };
    const mapped = residencyFolderMap[normalizedCategory] || 'LIVE_SESSION';
    targetDir = path.join(targetDir, mapped);
  } else if (normalizedDivision === 'usce') {
    zoneName = 'MISSION_RESIDENCY';
    targetDir = path.join(dropZoneRoot, 'MISSION_RESIDENCY', 'GENERAL');
  }

  mkdirSync(targetDir, { recursive: true });
  const absolutePath = path.join(targetDir, targetName);
  return {
    zoneName,
    absolutePath,
    fileName: targetName,
    relativeDropZonePath: path.relative(dropZoneRoot, absolutePath).replace(/\\/gu, '/'),
  };
}

function archiveStaleHqDropZoneFiles(zoneName, keepAbsolutePath) {
  const dropZoneRoot = ensureLocalDropZoneRoot();
  const zoneRoot = zoneName === 'USMLE'
    ? path.join(dropZoneRoot, 'usmle')
    : path.join(dropZoneRoot, 'MISSION_RESIDENCY');
  if (!existsSync(zoneRoot)) {
    return 0;
  }

  const keepPath = path.resolve(keepAbsolutePath);
  const archiveRoot = path.join(dropZoneRoot, '_ARCHIVE', zoneName, new Date().toISOString().slice(0, 10));
  mkdirSync(archiveRoot, { recursive: true });

  const stack = [zoneRoot];
  let archived = 0;
  const hqRecordingRe = /^GMT\d{8}-\d{6}_Recording_/u;
  while (stack.length) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!absolute.includes(`${path.sep}_ARCHIVE${path.sep}`)) {
          stack.push(absolute);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (path.resolve(absolute) === keepPath) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi'].includes(ext)) {
        continue;
      }
      if (!hqRecordingRe.test(entry.name)) {
        continue;
      }
      const targetPath = path.join(archiveRoot, entry.name);
      try {
        renameSync(absolute, targetPath);
      } catch {
        try {
          copyFileSync(absolute, targetPath);
          unlinkSync(absolute);
        } catch {
          continue;
        }
      }
      archived += 1;
    }
  }
  return archived;
}

async function triggerDropZonePipeline(zoneName) {
  if (!CONFIG.mediaPipelineBase) {
    return {
      ok: false,
      status: 400,
      error: 'MMHQ_MEDIA_PIPELINE_BASE must be configured to trigger drop-zone ingestion.',
    };
  }

  const response = await fetchJson(`${CONFIG.mediaPipelineBase}/ingestion/drop-zones`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      drop_zones: [zoneName],
      commit: true,
    }),
    timeoutMs: 300000,
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status || 502,
      error: response.error || 'Drop-zone ingestion failed.',
      payload: response.data || null,
    };
  }

  return {
    ok: true,
    payload: response.data || {},
  };
}

async function fetchPipelineVideoById(videoId) {
  const normalizedVideoId = sanitizeMediaIdentifier(videoId);
  if (!normalizedVideoId || !CONFIG.mediaPipelineBase) {
    return null;
  }
  const response = await fetchJson(`${CONFIG.mediaPipelineBase}/videos`, {
    headers: { Accept: 'application/json' },
    timeoutMs: 15000,
  });
  if (!response.ok) {
    return null;
  }
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.find((row) => sanitizeMediaIdentifier(row?.id || row?.video_id) === normalizedVideoId) || null;
}

async function fetchPipelineTranscriptById(videoId) {
  const normalizedVideoId = sanitizeMediaIdentifier(videoId);
  if (!normalizedVideoId || !CONFIG.mediaPipelineBase) {
    return null;
  }
  const response = await fetchJson(`${CONFIG.mediaPipelineBase}/transcripts/${encodeURIComponent(normalizedVideoId)}`, {
    headers: { Accept: 'application/json' },
    timeoutMs: 15000,
  });
  if (!response.ok) {
    return null;
  }
  return response.data || null;
}

async function uploadMediaSubmission(request, session = null) {
  let formData;
  try {
    formData = await readMultipartFormData(request);
  } catch (error) {
    return buildValidationError('invalid_multipart', error instanceof Error ? error.message : 'Invalid multipart payload.');
  }

  const file = formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return buildValidationError('file_required', 'Provide a video file in the `file` field.');
  }

  const sessionUserId = getMediaUserId(session);
  const requestUserId = sanitizeMediaIdentifier(formData.get('user_id'));
  const effectiveUserId = sessionUserId || requestUserId;
  if (!effectiveUserId) {
    return buildApiError(403, 'media_user_identity_required', 'No authenticated HQ user identity found for media upload action.', {
      bridge: 'media_upload',
    });
  }

  const studentName = normalizeMediaString(formData.get('student_name'));
  const submittedByUserId = normalizeMediaString(formData.get('user_id') || effectiveUserId);
  const course = normalizeMediaString(formData.get('course'));
  const sessionType = normalizeMediaString(formData.get('session_type'));
  const submissionType = normalizeSubmissionType(sessionType || formData.get('submission_type'));
  const date = normalizeMediaString(formData.get('date'));
  const division = normalizeMediaDivision(formData.get('division') || 'other');
  const category = normalizeMediaCategoryForDivision(
    formData.get('category'),
    division,
    { title: String(file.name || ''), topics: [sessionType] },
  );
  const safeFilename = sanitizeUploadFilename(file.name || 'upload.mp4');
  const extension = path.extname(safeFilename).toLowerCase();
  const allowedExtensions = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi']);
  if (!allowedExtensions.has(extension)) {
    return buildValidationError('unsupported_file_type', 'Only common video formats are accepted (.mp4, .mov, .m4v, .mkv, .webm, .avi).');
  }

  let fileBuffer;
  try {
    fileBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return buildValidationError('file_read_failed', 'The uploaded file could not be read.');
  }

  if (!fileBuffer.length) {
    return buildValidationError('empty_file', 'Uploaded video file is empty.');
  }
  if (fileBuffer.length > MEDIA_UPLOAD_MAX_BYTES) {
    return buildValidationError(
      'file_too_large',
      `Uploaded file exceeds the max size (${Math.round(MEDIA_UPLOAD_MAX_BYTES / (1024 * 1024))} MB).`,
    );
  }

  const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
  const sizeBytes = fileBuffer.length;
  const existingStore = loadMediaSubmissionStore();
  const duplicate = existingStore.uploads.find(
    (row) => row.file_sha256 === fileHash && Number(row.size_bytes || 0) === sizeBytes && row.video_id,
  );
  if (duplicate) {
    return {
      mode: 'live',
      bridge: 'media_upload',
      data: {
        duplicate: true,
        video_id: duplicate.video_id,
        student_name: duplicate.student_name,
        submission_type: duplicate.submission_type || duplicate.session_type,
      },
    };
  }

  let placement;
  try {
    placement = resolveDropZonePlacement(division, category, safeFilename, fileHash);
  } catch (error) {
    return buildApiError(500, 'drop_zone_unavailable', error instanceof Error ? error.message : 'Drop-zone path is unavailable.', {
      bridge: 'media_upload',
      target: CONFIG.mediaDropZoneRoot,
    });
  }

  const dropZonePath = placement.absolutePath;
  writeFileSync(dropZonePath, fileBuffer);
  const archivedCount = archiveStaleHqDropZoneFiles(placement.zoneName, dropZonePath);

  let pipelineEndpointUsed = '/ingestion/drop-zones';
  let pipelinePayload = null;
  let videoId = '';

  const dropZoneResponse = await triggerDropZonePipeline(placement.zoneName);
  if (!dropZoneResponse.ok) {
    return buildBridgeError('media_upload', dropZoneResponse.error || 'Media pipeline trigger failed.', targetLabel(CONFIG.mediaPipelineBase), {
      bridge: 'media_upload',
      drop_zone: placement.zoneName,
    });
  }

  pipelinePayload = dropZoneResponse.payload || {};
  const pipelineItems = Array.isArray(pipelinePayload.items) ? pipelinePayload.items : [];
  const committedIds = Array.isArray(pipelinePayload?.registry?.committed_ids)
    ? pipelinePayload.registry.committed_ids.map((value) => sanitizeMediaIdentifier(value)).filter(Boolean)
    : [];
  if (committedIds.length === 1) {
    videoId = committedIds[0];
  }
  const matchedItem = pipelineItems.find((item) => {
    const selectedPath = String(item?.selected_video_path || '').replace(/\\/gu, '/');
    return selectedPath.endsWith(placement.fileName);
  }) || null;
  if (!videoId && matchedItem) {
    videoId = sanitizeMediaIdentifier(matchedItem.asset_id || matchedItem.id);
  }
  if (!videoId) {
    const fallbackItem = pipelineItems.find((item) => sanitizeMediaIdentifier(item?.asset_id || item?.id));
    videoId = sanitizeMediaIdentifier(fallbackItem?.asset_id || fallbackItem?.id);
  }

  if (!videoId) {
    return buildApiError(502, 'pipeline_missing_video_id', 'Media pipeline completed but no committed video_id was returned.', {
      bridge: 'media_upload',
      drop_zone: placement.zoneName,
      file: placement.fileName,
    });
  }

  const videoEntry = await fetchPipelineVideoById(videoId);
  const transcriptPayload = await fetchPipelineTranscriptById(videoId);
  const transcriptChunks = Array.isArray(transcriptPayload?.transcript_chunks) ? transcriptPayload.transcript_chunks : [];
  const hasTranscript = Boolean(normalizeMediaString(transcriptPayload?.transcript)) || transcriptChunks.length > 0;
  const hasCloudVideoPath = Boolean(normalizeMediaString(videoEntry?.cloud_video_path || videoEntry?.playback_url));
  const hasThumbnail = Boolean(normalizeMediaString(videoEntry?.thumbnail_url));

  const now = new Date().toISOString();
  const nextStore = loadMediaSubmissionStore();
  const existingByVideo = nextStore.uploads.find((row) => row.video_id === videoId);
  const row = {
    video_id: videoId,
    file_sha256: fileHash,
    size_bytes: sizeBytes,
    file_name: safeFilename,
    student_name: studentName,
    submitted_by_user_id: submittedByUserId,
    course,
    session_type: sessionType,
    submission_type: submissionType || normalizeSubmissionType(sessionType),
    date: date || normalizeMediaString(videoEntry?.date) || now.slice(0, 10),
    division,
    category,
    pipeline_mode: 'drop_zone',
    created_at: existingByVideo?.created_at || now,
    updated_at: now,
  };

  if (existingByVideo) {
    Object.assign(existingByVideo, row);
  } else {
    nextStore.uploads.push(row);
  }
  saveMediaSubmissionStore(nextStore);

  return {
    mode: 'live',
    bridge: 'media_upload',
    data: {
      duplicate: false,
      pipeline_endpoint: pipelineEndpointUsed,
      drop_zone_path: placement.relativeDropZonePath,
      drop_zone: placement.zoneName,
      video_id: videoId,
      student_name: row.student_name,
      submission_type: row.submission_type || row.session_type,
      course: row.course,
      date: row.date,
      verification: {
        upload_to_drop_zone: true,
        pipeline_triggered: true,
        staged_files_archived: archivedCount,
        registry_updated: hasCloudVideoPath,
        transcript_available: hasTranscript,
        transcript_chunks: transcriptChunks.length,
        thumbnail_available: hasThumbnail,
      },
    },
  };
}

function isMutationMethod(method = 'GET') {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
}

function validateCsrf(request, session) {
  if (!session) {
    return false;
  }

  const csrfHeader = String(request.headers['x-mmhq-csrf'] || '').trim();
  return csrfHeader !== '' && csrfHeader === session.csrfToken;
}

function authenticateApiRequest(request) {
  return readSessionFromRequest(request);
}

function requireAuthenticatedApiSession(request, response, session) {
  if (CONFIG.authRequired && !session) {
    sendJson(response, 401, {
      error: 'authentication_required',
      message: 'MissionMed HQ requires a valid WordPress token exchange before protected routes can load.',
      login: getLoginHints(request),
    });
    return false;
  }

  if (isMutationMethod(request.method) && CONFIG.authRequired && !validateCsrf(request, session)) {
    sendJson(response, 403, {
      error: 'csrf_validation_failed',
      message: 'Missing or invalid CSRF token.',
    });
    return false;
  }

  return true;
}

function handleServerError(response, error) {
  sendJson(response, 500, {
    error: 'internal_error',
    message: error instanceof Error ? error.message : 'Unexpected server error.',
  });
}

async function handleApiRoute(request, response, url, context) {
  const { pathname, searchParams } = url;
  const { session } = context;
  const authHeaders = buildCorsHeaders(request);

  if (pathname === '/api/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'missionmed-hq',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, buildCorsHeaders(request));
    response.end();
    return;
  }

  if (pathname === '/api/auth/start') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    const hqBase = getHqBaseForRequest(request);
    const hqEntryUrl = hqBase ? new URL('/api/auth/session', hqBase).toString() : '';
    const redirectUrl = buildWordPressAuthRedirectUrl(hqEntryUrl);

    if (!redirectUrl) {
      sendJson(response, 503, {
        error: 'wordpress_login_not_configured',
        message: 'WordPress login redirect is not configured yet. Set MMHQ_WP_BASE.',
        login: getLoginHints(request),
      });
      return;
    }

    sendRedirect(response, redirectUrl);
    return;
  }

  if (pathname === '/api/bridge/health') {
    try {
      const health = await getBridgeHealth?.(session, request);
      sendJson(response, 200, health || { status: 'unknown' });
    } catch (err) {
      sendJson(response, 200, {
        status: 'degraded',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (pathname === '/api/auth/session') {
    const handoffToken = String(searchParams.get('token') || '').trim();

    if (!session && handoffToken) {
      const exchange = await exchangeWordPressAuth({ token: handoffToken }, request);
      if (!exchange.ok || !exchange.session) {
        sendJson(response, exchange.status || 401, {
          error: 'auth_exchange_failed',
          message: exchange.error || 'WordPress authentication failed.',
          login: getLoginHints(request),
        }, authHeaders);
        return;
      }

      const bootstrap = await bootstrapSupabaseSessionFromWordPressSession(exchange.session);
      if (!bootstrap.ok) {
        sendJson(response, bootstrap.status || 502, {
          error: bootstrap.error || 'supabase_bootstrap_failed',
          message: bootstrap.message || 'Supabase bootstrap failed.',
        }, authHeaders);
        return;
      }

      sendJson(
        response,
        200,
        buildSessionPayload(bootstrap.session || exchange.session, request),
        {
          ...authHeaders,
          'Set-Cookie': buildSessionCookie(request, bootstrap.session || exchange.session),
        },
      );
      return;
    }

    sendJson(response, 200, buildSessionPayload(session, request), authHeaders);
    return;
  }

  if (pathname === '/api/auth/validate-wp') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    let payload = {};
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      }, authHeaders);
      return;
    }

    const grantType = String(payload?.grant_type || 'wp_cookie').trim();
    if (!['wp_cookie', 'wp_assertion'].includes(grantType)) {
      sendJson(response, 400, {
        error: 'invalid_grant',
        message: 'grant_type must be one of: wp_cookie, wp_assertion.',
      }, authHeaders);
      return;
    }

    let wpUser = null;

    if (grantType === 'wp_cookie') {
      const cookieHeader = getRequestCookieHeader(request);
      const cookieValidation = await fetchWordPressUserFromCookieHeader(cookieHeader);
      if (!cookieValidation.ok) {
        sendJson(response, cookieValidation.status || 401, {
          error: cookieValidation.error || 'wordpress_session_invalid',
          message: cookieValidation.detail || 'WordPress cookie validation failed.',
        }, authHeaders);
        return;
      }
      wpUser = normalizeWordPressIdentityUser(cookieValidation.user || {});
    }

    if (grantType === 'wp_assertion') {
      const assertion = String(payload?.assertion || payload?.token || '').trim();
      if (!assertion) {
        sendJson(response, 400, {
          error: 'assertion_missing',
          message: 'assertion is required for wp_assertion grant.',
        }, authHeaders);
        return;
      }

      const exchangeUrl = resolveWordPressAuthEndpoint();
      if (!exchangeUrl) {
        sendJson(response, 503, {
          error: 'wordpress_auth_endpoint_missing',
          message: 'MMHQ_WP_AUTH_ENDPOINT is not configured.',
        }, authHeaders);
        return;
      }

      const assertionExchange = await fetchJson(exchangeUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${assertion}`,
        },
        timeoutMs: 8_000,
      });

      if (!assertionExchange.ok) {
        sendJson(response, assertionExchange.status === 400 ? 401 : (assertionExchange.status || 503), {
          error: 'wp_assertion_invalid',
          message: assertionExchange.error || 'WordPress assertion validation failed.',
        }, authHeaders);
        return;
      }

      wpUser = normalizeWordPressIdentityUser(assertionExchange.data?.user || {}, {
        token: assertionExchange.data?.token,
      });
    }

    if (!wpUser || !Number(wpUser.id || 0)) {
      sendJson(response, 401, {
        error: 'wordpress_session_invalid',
        message: 'WordPress identity could not be resolved.',
      }, authHeaders);
      return;
    }

    if (!isAuthorizedWordPressUser(wpUser)) {
      sendJson(response, 403, {
        error: 'wp_role_mismatch',
        message: 'WordPress account is not authorized.',
      }, authHeaders);
      return;
    }

    const canonicalIdentity = toCanonicalIdentity(wpUser, grantType);
    if (!canonicalIdentity.email) {
      sendJson(response, 422, {
        error: 'wp_identity_missing_email',
        message: 'WordPress account email is required for bootstrap.',
      }, authHeaders);
      return;
    }

    sendJson(response, 200, canonicalIdentity, authHeaders);
    return;
  }

  if (pathname === '/api/auth/exchange') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    if (!SESSION_SECRET) {
      sendJson(response, 503, {
        error: 'session_secret_missing',
        message: 'MMHQ_SESSION_SECRET must be configured before HQ authentication can be enabled.',
        login: getLoginHints(request),
      }, authHeaders);
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      }, authHeaders);
      return;
    }

    const exchange = await exchangeWordPressAuth(payload, request);
    if (!exchange.ok) {
      sendJson(response, exchange.status || 401, {
        error: 'auth_exchange_failed',
        message: exchange.error || 'WordPress authentication failed.',
        login: getLoginHints(request),
      }, authHeaders);
      return;
    }

    sendJson(
      response,
      200,
      buildSessionPayload(exchange.session, request),
      {
        ...authHeaders,
        'Set-Cookie': buildSessionCookie(request, exchange.session),
      },
    );
    return;
  }

  if (pathname === '/api/auth/bootstrap') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    const authSession = session || readSessionFromRequest(request);
    const bootstrap = await bootstrapSupabaseSessionFromWordPressSession(authSession);
    if (!bootstrap.ok) {
      sendJson(response, bootstrap.status || 502, {
        error: bootstrap.error || 'supabase_bootstrap_failed',
        message: bootstrap.message || 'Supabase bootstrap failed.',
      }, authHeaders);
      return;
    }

    sendJson(response, 200, bootstrap.payload || {}, {
      ...authHeaders,
      'Set-Cookie': buildSessionCookie(request, bootstrap.session || authSession),
    });
    return;
  }

  if (pathname === '/api/auth/logout') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    if (session && !validateCsrf(request, session)) {
      sendJson(response, 403, {
        error: 'csrf_validation_failed',
        message: 'Missing or invalid CSRF token.',
      }, authHeaders);
      return;
    }

    sendJson(
      response,
      200,
      {
        authenticated: false,
        authRequired: CONFIG.authRequired,
        sessionPersistent: Boolean(SESSION_SECRET),
        login: getLoginHints(request),
      },
      {
        ...authHeaders,
        'Set-Cookie': clearSessionCookie(request),
      },
    );
    return;
  }

  if (pathname === '/api/stripe/oauth/callback') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    await handleStripeConnectCallback(request, response, searchParams, session);
    return;
  }

  // ── Email Engine data (public read) ──────────────────────────
  // The /email UI is served without auth, so its data endpoint
  // must also be reachable without a WordPress session.  The
  // underlying Supabase RPC uses a service-role key, so data
  // is still access-controlled at the database layer.
  if (pathname === '/api/hq/medmail' || pathname === '/api/hq/emails') {
    sendRoutePayload(response, await getHqMedMail(session));
    return;
  }

  if (!requireAuthenticatedApiSession(request, response, session)) {
    return;
  }

  if (pathname.startsWith('/api/dboc/')) {
    await handleDbocRoute(request, response, url, session);
    return;
  }

  if (pathname === '/api/bootstrap') {
    sendRoutePayload(response, {
      auth: buildSessionPayload(session, request),
      health: await getBridgeHealth(session, request),
    });
    return;
  }

  if (pathname === '/api/hq/summary') {
    sendRoutePayload(response, await getHqSummary(session, request));
    return;
  }

  if (pathname === '/api/hq/students') {
    sendRoutePayload(response, await getStudents(searchParams, session));
    return;
  }

  if (pathname === '/api/hq/leads') {
    sendRoutePayload(response, await getSupabaseLeads(session));
    return;
  }

  if (pathname === '/api/hq/notifications') {
    sendRoutePayload(response, await getHqNotifications(session));
    return;
  }

  if (pathname === '/api/hq/tasks') {
    if (request.method === 'GET') {
      sendRoutePayload(response, await getSupabaseTasks(session, searchParams));
      return;
    }

    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['GET', 'POST']);
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }

    sendRoutePayload(response, await createSupabaseTask(payload, session));
    return;
  }

  if (pathname.startsWith('/api/hq/tasks/')) {
    if (request.method !== 'PATCH') {
      sendMethodNotAllowed(response, ['PATCH']);
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }

    const taskId = pathname.replace('/api/hq/tasks/', '');
    sendRoutePayload(response, await updateSupabaseTask(taskId, payload, session));
    return;
  }

  // /api/hq/medmail and /api/hq/emails are now handled above the
  // auth gate (Email Engine public-read path).  See comment above.

  if (pathname === '/api/hq/payments/overview') {
    sendRoutePayload(response, await getHqPaymentsOverview(searchParams, session));
    return;
  }

  if (pathname === '/api/hq/payments/exceptions') {
    sendRoutePayload(response, await getHqPaymentExceptions(searchParams, session));
    return;
  }

  if (pathname === '/api/hq/payments/stripe-accounts') {
    sendRoutePayload(response, await getHqPaymentStripeAccounts(searchParams, session));
    return;
  }

  if (pathname === '/api/hq/payments') {
    sendRoutePayload(response, await getHqPayments(searchParams, session));
    return;
  }

  if (pathname === '/api/hq/video-workflow') {
    sendRoutePayload(response, await getVideoWorkflow(session));
    return;
  }

  if (pathname === '/api/stripe/connect/start') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    await handleStripeConnectStart(request, response, searchParams, session);
    return;
  }

  if (pathname === '/api/stripe/status') {
    const payload = await getStripeStatusEndpoint(searchParams, session);
    sendJson(response, payload.httpStatus || 200, payload);
    return;
  }

  if (pathname === '/api/wp/students' || pathname === '/api/students') {
    sendRoutePayload(response, await getStudents(searchParams, session));
    return;
  }

  if (pathname.startsWith('/api/wp/students/') || pathname.startsWith('/api/students/')) {
    const studentId = pathname.replace('/api/wp/students/', '').replace('/api/students/', '');
    sendRoutePayload(response, await getStudentDetail(studentId, session));
    return;
  }

  if (pathname === '/api/wp/tasks') {
    sendRoutePayload(response, await getWordPressTasks(session));
    return;
  }

  if (pathname === '/api/wp/payments') {
    sendRoutePayload(response, await getWordPressPayments(searchParams, session));
    return;
  }

  if (pathname === '/api/wp/payments/overview') {
    sendRoutePayload(response, await getWordPressPaymentsOverview(session));
    return;
  }

  if (pathname === '/api/wp/payments/stripe-accounts') {
    sendRoutePayload(response, await getWordPressStripeAccounts(session));
    return;
  }

  if (pathname === '/api/wp/payments/exceptions') {
    sendRoutePayload(response, await getWordPressPaymentExceptions(session));
    return;
  }

  if (pathname === '/api/wp/payments/refunds') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }

    sendRoutePayload(response, await createWordPressPaymentRefund(payload, session));
    return;
  }

  if (pathname === '/api/wp/emails' || pathname === '/api/emails') {
    sendRoutePayload(response, await getEmails(session));
    return;
  }

  if (pathname === '/api/supabase/leads') {
    sendRoutePayload(response, await getSupabaseLeads(session));
    return;
  }

  if (pathname === '/api/supabase/leads/summary') {
    sendRoutePayload(response, await getSupabaseLeadsSummary(session));
    return;
  }

  if (pathname === '/api/media/health') {
    sendRoutePayload(response, await getMediaHealth());
    return;
  }

  if (pathname === '/api/media/search') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }
    sendRoutePayload(response, await searchMedia(searchParams, session));
    return;
  }

  if (pathname === '/api/media/unified/stats') {
    sendRoutePayload(response, await getMediaStats());
    return;
  }

  if (pathname === '/api/media/unified') {
    sendRoutePayload(response, await getMediaList(searchParams));
    return;
  }

  if (pathname === '/api/media/list') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }
    sendRoutePayload(response, await getMediaList(searchParams));
    return;
  }

  if (pathname.startsWith('/api/media/unified/')) {
    const mediaId = pathname.replace('/api/media/unified/', '');
    sendRoutePayload(response, await getMediaDetail(mediaId));
    return;
  }

  if (pathname === '/api/media/user-state') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }
    sendRoutePayload(response, await getMediaUserState(searchParams, session));
    return;
  }

  if (pathname === '/api/media/favorite') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }
    sendRoutePayload(response, await updateMediaFavorite(payload, session));
    return;
  }

  if (pathname === '/api/media/rate') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }
    sendRoutePayload(response, await updateMediaRating(payload, session));
    return;
  }

  if (pathname === '/api/media/tag/add') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }
    sendRoutePayload(response, await addMediaTag(payload, session));
    return;
  }

  if (pathname === '/api/media/tag/remove') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }
    sendRoutePayload(response, await removeMediaTag(payload, session));
    return;
  }

  if (pathname === '/api/media/tags') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }
    sendRoutePayload(response, await getMediaTags(searchParams, session));
    return;
  }

  if (pathname === '/api/media/video-tags') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }
    sendRoutePayload(response, await getMediaVideoTags(searchParams, session));
    return;
  }

  if (pathname === '/api/media/playlist/create') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }
    sendRoutePayload(response, await createMediaPlaylist(payload, session));
    return;
  }

  if (pathname === '/api/media/playlist/add') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }
    sendRoutePayload(response, await addMediaPlaylistItems(payload, session));
    return;
  }

  if (pathname === '/api/media/playlists') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }
    sendRoutePayload(response, await getMediaPlaylists(session));
    return;
  }

  if (pathname === '/api/media/clip/create') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }
    sendRoutePayload(response, await createMediaClip(payload, session));
    return;
  }

  if (pathname === '/api/media/clips') {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }
    sendRoutePayload(response, await getMediaClips(searchParams, session));
    return;
  }

  if (pathname === '/api/media/upload') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }
    sendRoutePayload(response, await uploadMediaSubmission(request, session));
    return;
  }

  if (pathname === '/api/studio/workspace') {
    sendRoutePayload(response, await getStudioWorkspace());
    return;
  }

  if (pathname === '/api/studio/sessions') {
    if (request.method !== 'POST') {
      sendMethodNotAllowed(response, ['POST']);
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_body',
        message: error instanceof Error ? error.message : 'Invalid JSON body.',
      });
      return;
    }

    sendRoutePayload(response, await createStudioSession(payload));
    return;
  }

  sendJson(response, 404, {
    error: 'not_found',
    message: `No route matched ${pathname}.`,
  });
}

// SPA frontend routes — these are client-side routes that all resolve to index.html.
// Matches the locked navigation structure: Home, Payments, Students, MedMail, Leads,
// Media Engine, Studio, Settings (MR-HQ-001).
const SPA_FRONTEND_ROUTES = new Set([
  '/hq/email',
  '/studio',
  '/media-engine',
  '/medmail',
  '/leads',
  '/payments',
  '/students',
  '/settings',
  '/hq',
]);

function isSpaRoute(pathname) {
  const normalized = pathname.replace(/\/+$/u, '') || '/';
  return normalized === '/' || SPA_FRONTEND_ROUTES.has(normalized);
}

async function serveStatic(response, pathname) {
  if (pathname.startsWith('/08_AI_SYSTEM/')) {
    const aiSystemPath = path.normalize(path.join(PROJECT_ROOT_DIR, pathname));
    const aiSystemRoot = path.join(PROJECT_ROOT_DIR, '08_AI_SYSTEM');
    if (!aiSystemPath.startsWith(aiSystemRoot)) {
      sendJson(response, 403, { error: 'forbidden', message: 'Path is outside the allowed AI system directory.' });
      return;
    }

    try {
      const details = await stat(aiSystemPath);
      if (details.isDirectory()) {
        await serveStatic(response, path.join(pathname, 'index.html'));
        return;
      }
      const extension = path.extname(aiSystemPath);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      });
      createReadStream(aiSystemPath).pipe(response);
      return;
    } catch {
      sendJson(response, 404, { error: 'not_found', message: `Asset ${pathname} was not found.` });
      return;
    }
  }

  // SPA routing: all known frontend routes serve index.html so the client-side
  // router can handle them. This prevents 404s when navigating directly to
  // /studio, /media-engine, etc.
  const requestedPath = isSpaRoute(pathname) ? '/index.html' : pathname;
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 403, { error: 'forbidden', message: 'Path is outside the public directory.' });
    return;
  }

  try {
    const details = await stat(absolutePath);

    if (details.isDirectory()) {
      await serveStatic(response, path.join(requestedPath, 'index.html'));
      return;
    }

    const extension = path.extname(absolutePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    });

    createReadStream(absolutePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: 'not_found', message: `Asset ${requestedPath} was not found.` });
  }
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...buildCorsHeaders(),
    ...extraHeaders,
  });

  response.end(JSON.stringify(payload, null, 2));
}

function sendRoutePayload(response, payload, extraHeaders = {}) {
  if (payload && typeof payload === 'object' && Number.isInteger(payload.httpStatus)) {
    const { httpStatus, ...body } = payload;
    sendJson(response, httpStatus, body, extraHeaders);
    return;
  }

  sendJson(response, 200, payload, extraHeaders);
}

function buildApiError(statusCode, code, message, details = {}) {
  return {
    ok: false,
    error: code,
    message,
    httpStatus: statusCode,
    ...details,
  };
}

function buildValidationError(code, message, details = {}) {
  return buildApiError(400, code, message, details);
}

function buildNotFoundError(code, message, details = {}) {
  return buildApiError(404, code, message, details);
}

function buildBridgeError(bridge, message, target = '', details = {}) {
  return buildApiError(503, `${bridge}_unavailable`, message || `${bridge} is unavailable.`, {
    bridge,
    mode: 'offline',
    target,
    ...details,
  });
}

function buildConfigError(bridge, message, target = '', details = {}) {
  return buildApiError(400, `${bridge}_not_configured`, message || `${bridge} is not configured.`, {
    bridge,
    mode: 'offline',
    target,
    ...details,
  });
}

function buildBridgeErrorFromResult(bridge, result, target = '', details = {}) {
  if (Number(result?.status || 0) === 400) {
    return buildConfigError(bridge, result?.error || `${bridge} is not configured.`, target, details);
  }

  return buildBridgeError(bridge, result?.error || `${bridge} is unavailable.`, target, details);
}

function logRequest(request, response, pathname, durationMs) {
  console.log([
    'MissionMed HQ request',
    `${String(request.method || 'GET').toUpperCase()} ${pathname}`,
    `status=${response.statusCode}`,
    `duration_ms=${durationMs}`,
  ].join(' | '));
}

function buildCorsHeaders(request = null) {
  const requestOrigin = String(request?.headers?.origin || '').trim();
  const fallbackOrigin = CONFIG.allowedOrigin || requestOrigin || 'https://missionmedinstitute.com';
  const allowedOrigin = fallbackOrigin === '*' ? (requestOrigin || 'https://missionmedinstitute.com') : fallbackOrigin;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-MMHQ-CSRF',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function sendRedirect(response, location, statusCode = 302, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    Location: location,
    ...extraHeaders,
  });
  response.end();
}

function sendMethodNotAllowed(response, methods) {
  sendJson(response, 405, {
    error: 'method_not_allowed',
    message: `Allowed methods: ${methods.join(', ')}`,
  }, {
    Allow: methods.join(', '),
  });
}

function normalizeDbocUserId(value) {
  return String(value ?? '').trim();
}

function getDbocSessionUserId(session = null) {
  const supabaseUserId = normalizeDbocUserId(session?.supabaseUserId);
  if (supabaseUserId) {
    return supabaseUserId;
  }
  return normalizeDbocUserId(session?.user?.id);
}

function dbocLog(method, pathname, userId, statusCode) {
  console.log(`[DBOC] ${String(method || 'GET').toUpperCase()} ${pathname} user=${userId || 'unknown'} status=${statusCode}`);
}

function sendDbocJson(response, request, pathname, userId, statusCode, payload, extraHeaders = {}) {
  sendJson(response, statusCode, payload, extraHeaders);
  dbocLog(request?.method, pathname, userId, statusCode);
}

function sendDbocMethodNotAllowed(response, request, pathname, userId, methods) {
  sendDbocJson(response, request, pathname, userId, 405, {
    error: 'method_not_allowed',
    message: `Allowed methods: ${methods.join(', ')}`,
  }, {
    Allow: methods.join(', '),
  });
}

async function readDbocJsonBodyOrRespond(request, response, pathname, userId) {
  try {
    return await readJsonBody(request);
  } catch {
    sendDbocJson(response, request, pathname, userId, 400, { error: 'invalid_body' });
    return null;
  }
}

function normalizeDbocTranscriptionStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized === 'queued' || normalized === 'processing' || normalized === 'completed' || normalized === 'failed') {
    return normalized;
  }
  return '';
}

function setDbocTranscriptionStatus(responseId, status) {
  const normalizedResponseId = String(responseId || '').trim();
  const normalizedStatus = normalizeDbocTranscriptionStatus(status);
  if (!normalizedResponseId || !normalizedStatus) {
    return;
  }
  DBOC_TRANSCRIBE_STATUS_BY_RESPONSE.set(normalizedResponseId, normalizedStatus);
}

function emitDbocTranscriptionEvent(eventType, payload = {}) {
  const event = {
    type: String(eventType || '').trim() || 'unknown',
    at: new Date().toISOString(),
    response_id: String(payload.response_id || '').trim() || null,
    job_id: String(payload.job_id || '').trim() || null,
    status: normalizeDbocTranscriptionStatus(payload.status || '') || null,
    error: String(payload.error || '').trim() || null,
  };
  DBOC_TRANSCRIBE_EVENTS.push(event);
  if (DBOC_TRANSCRIBE_EVENTS.length > 500) {
    DBOC_TRANSCRIBE_EVENTS.splice(0, DBOC_TRANSCRIBE_EVENTS.length - 500);
  }
  console.log(`[DBOC] transcription_event type=${event.type} response_id=${event.response_id || 'unknown'} status=${event.status || 'n/a'}`);
}

function isDbocColumnMissing(errorMessage = '', columnName = '') {
  const column = String(columnName || '').toLowerCase().trim();
  if (!column) {
    return false;
  }
  const msg = String(errorMessage || '').toLowerCase();
  if (!msg.includes(column)) {
    return false;
  }
  return msg.includes('column') || msg.includes('schema cache') || msg.includes('not found') || msg.includes('unknown');
}

function isDbocTranscriptionStatusColumnMissing(errorMessage = '') {
  return isDbocColumnMissing(errorMessage, 'transcription_status');
}

function isDbocQuestionIdColumnMissing(errorMessage = '') {
  return isDbocColumnMissing(errorMessage, 'question_id');
}

function isDbocModeColumnMissing(errorMessage = '') {
  return isDbocColumnMissing(errorMessage, 'mode');
}

function isDbocVideoUrlColumnMissing(errorMessage = '') {
  return isDbocColumnMissing(errorMessage, 'video_url');
}

async function updateDbocResponseTranscriptionStatus(job = {}, status = '') {
  const responseId = String(job.response_id || '').trim();
  const nextStatus = normalizeDbocTranscriptionStatus(status);
  if (!responseId || !nextStatus) {
    return;
  }

  setDbocTranscriptionStatus(responseId, nextStatus);

  const workerSession = {
    wpAuthorization: String(job.wp_authorization || '').trim(),
  };

  const updateResult = await fetchSupabaseTable(
    `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
        ...buildDbocSupabaseHeaders(workerSession, true),
      },
      body: JSON.stringify({ transcription_status: nextStatus }),
      timeoutMs: 15000,
    },
  );

  if (!updateResult.ok && !isDbocTranscriptionStatusColumnMissing(updateResult.error)) {
    throw new Error(updateResult.error || 'transcription_status_update_failed');
  }
}

function deriveDbocTranscriptionStatus(item = {}) {
  const responseId = String(item.id || item.response_id || '').trim();
  const fromDb = normalizeDbocTranscriptionStatus(item.transcription_status);
  if (fromDb) {
    return fromDb;
  }
  if (responseId) {
    const inQueue = DBOC_TRANSCRIBE_QUEUE.find((job) => String(job?.response_id || '').trim() === responseId);
    const queuedStatus = normalizeDbocTranscriptionStatus(inQueue?.status || '');
    if (queuedStatus) {
      return queuedStatus;
    }
    const inMemory = normalizeDbocTranscriptionStatus(DBOC_TRANSCRIBE_STATUS_BY_RESPONSE.get(responseId));
    if (inMemory) {
      return inMemory;
    }
  }
  if (String(item.transcript_text || '').trim()) {
    return 'completed';
  }
  return '';
}

function getDbocTranscribeRetryDelayMs(attemptNumber = 1) {
  const index = Math.max(0, Number(attemptNumber || 1) - 1);
  if (index < DBOC_TRANSCRIBE_RETRY_BACKOFF_MS.length) {
    return DBOC_TRANSCRIBE_RETRY_BACKOFF_MS[index];
  }
  return DBOC_TRANSCRIBE_RETRY_BACKOFF_MS[DBOC_TRANSCRIBE_RETRY_BACKOFF_MS.length - 1] || 45_000;
}

function getReadyDbocTranscribeJob() {
  const now = Date.now();
  return DBOC_TRANSCRIBE_QUEUE.find((job) => {
    if (!job || normalizeDbocTranscriptionStatus(job.status) !== 'queued') {
      return false;
    }
    const nextRetryAt = Number(job.next_retry_at_ms || 0);
    return !nextRetryAt || nextRetryAt <= now;
  }) || null;
}

function recordDbocTranscribeHistory(job = {}) {
  const copy = {
    job_id: String(job.job_id || '').trim(),
    response_id: String(job.response_id || '').trim(),
    status: String(job.status || '').trim(),
    queued_at: job.queued_at || null,
    processing_at: job.processing_at || null,
    completed_at: job.completed_at || null,
    failed_at: job.failed_at || null,
    attempts: Number(job.attempts || 0),
    error: String(job.error || '').trim() || null,
  };
  DBOC_TRANSCRIBE_HISTORY.push(copy);
  if (DBOC_TRANSCRIBE_HISTORY.length > 200) {
    DBOC_TRANSCRIBE_HISTORY.splice(0, DBOC_TRANSCRIBE_HISTORY.length - 200);
  }
}

function removeDbocTranscribeJob(jobId = '') {
  const normalized = String(jobId || '').trim();
  if (!normalized) {
    return;
  }
  const index = DBOC_TRANSCRIBE_QUEUE.findIndex((job) => String(job?.job_id || '').trim() === normalized);
  if (index >= 0) {
    DBOC_TRANSCRIBE_QUEUE.splice(index, 1);
  }
}

async function fetchDbocVideoForTranscription(videoUrl) {
  const sourceUrl = String(videoUrl || '').trim();
  if (!sourceUrl) {
    throw new Error('video_url_required');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`video_fetch_failed_${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = String(response.headers.get('content-type') || '').trim();
    return {
      videoBuffer: Buffer.from(arrayBuffer),
      videoContentType: contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractDbocAudioPlaceholder(videoBuffer, videoContentType = '') {
  return {
    audioBuffer: Buffer.isBuffer(videoBuffer) ? videoBuffer : Buffer.from(videoBuffer || ''),
    audioContentType: String(videoContentType || '').trim() || 'audio/mp4',
  };
}

function buildDbocMockTranscript(job = {}, audioBuffer = Buffer.alloc(0)) {
  const responseId = String(job.response_id || '').trim() || 'unknown';
  const videoUrl = String(job.video_url || '').trim() || 'unknown';
  const size = Buffer.isBuffer(audioBuffer) ? audioBuffer.length : 0;
  const stamp = new Date().toISOString();
  return `[MOCK_WHISPER] response_id=${responseId} bytes=${size} source=${videoUrl} generated_at=${stamp}`;
}

async function transcribeDbocAudio(job = {}, audioBuffer = Buffer.alloc(0), audioContentType = 'audio/mp4') {
  const openAiKey = String(CONFIG.openaiApiKey || '').trim();
  const useMock = !openAiKey;

  if (useMock) {
    return buildDbocMockTranscript(job, audioBuffer);
  }

  try {
    if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
      throw new Error('runtime_formdata_unsupported');
    }

    const form = new FormData();
    const fileBlob = new Blob([audioBuffer], { type: String(audioContentType || '').trim() || 'audio/mp4' });
    form.append('model', 'whisper-1');
    form.append('file', fileBlob, 'dboc_audio.mp4');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
        },
        body: form,
        signal: controller.signal,
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`whisper_http_${response.status}:${raw.slice(0, 220)}`);
      }
      if (!raw.trim()) {
        throw new Error('whisper_empty_response');
      }
      try {
        const parsed = JSON.parse(raw);
        const text = String(parsed?.text || '').trim();
        if (!text) {
          throw new Error('whisper_empty_transcript');
        }
        return text;
      } catch {
        return raw.trim();
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (DBOC_TRANSCRIBE_SAFE_MODE) {
      return buildDbocMockTranscript(job, audioBuffer);
    }
    throw error;
  }
}

async function persistDbocTranscript(job = {}, transcriptText = '') {
  const responseId = String(job.response_id || '').trim();
  if (!responseId) {
    throw new Error('response_id_required_for_persist');
  }
  const text = String(transcriptText || '').trim();
  if (!text) {
    throw new Error('transcript_text_required_for_persist');
  }

  const workerSession = {
    wpAuthorization: String(job.wp_authorization || '').trim(),
  };

  const updateResult = await fetchSupabaseTable(
    `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
        ...buildDbocSupabaseHeaders(workerSession, true),
      },
      body: JSON.stringify({ transcript_text: text, transcription_status: 'completed' }),
      timeoutMs: 15000,
    },
  );

  if (!updateResult.ok && isDbocTranscriptionStatusColumnMissing(updateResult.error)) {
    const fallbackResult = await fetchSupabaseTable(
      `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
          ...buildDbocSupabaseHeaders(workerSession, true),
        },
        body: JSON.stringify({ transcript_text: text }),
        timeoutMs: 15000,
      },
    );
    if (!fallbackResult.ok) {
      throw new Error(fallbackResult.error || 'transcript_persist_failed');
    }
    setDbocTranscriptionStatus(responseId, 'completed');
    return;
  }

  if (!updateResult.ok) {
    throw new Error(updateResult.error || 'transcript_persist_failed');
  }

  setDbocTranscriptionStatus(responseId, 'completed');
}

async function processDbocTranscribeJob(job = null) {
  if (!job) {
    return;
  }

  job.status = 'processing';
  job.processing_at = new Date().toISOString();
  job.attempts = Number(job.attempts || 0) + 1;
  setDbocTranscriptionStatus(job.response_id, 'processing');
  emitDbocTranscriptionEvent('processing', {
    response_id: job.response_id,
    job_id: job.job_id,
    status: 'processing',
  });

  try {
    await updateDbocResponseTranscriptionStatus(job, 'processing');
    const videoResult = await fetchDbocVideoForTranscription(job.video_url);
    const audioResult = await extractDbocAudioPlaceholder(videoResult.videoBuffer, videoResult.videoContentType);
    const transcriptText = await transcribeDbocAudio(job, audioResult.audioBuffer, audioResult.audioContentType);
    await persistDbocTranscript(job, transcriptText);
    try {
      await persistDbocSafAnalysis(String(job.response_id || '').trim(), transcriptText, {
        wpAuthorization: String(job.wp_authorization || '').trim(),
      });
    } catch (safError) {
      console.warn('[DBOC] transcription_saf_auto_failed', safError instanceof Error ? safError.message : safError);
    }
    maybeQueueDbocMetricsAfterTranscription(job);

    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    setDbocTranscriptionStatus(job.response_id, 'completed');
    recordDbocTranscribeHistory(job);
    emitDbocTranscriptionEvent('completed', {
      response_id: job.response_id,
      job_id: job.job_id,
      status: 'completed',
    });
    removeDbocTranscribeJob(job.job_id);
    console.log(`[DBOC] transcription_completed job=${job.job_id} response_id=${job.response_id}`);
  } catch (error) {
    job.error = error instanceof Error ? error.message : 'transcription_failed';
    const maxAttempts = 3;

    if (Number(job.attempts || 0) < maxAttempts) {
      const currentAttempt = Number(job.attempts || 0);
      const retryDelayMs = getDbocTranscribeRetryDelayMs(currentAttempt);
      job.status = 'queued';
      job.next_retry_at_ms = Date.now() + retryDelayMs;
      setDbocTranscriptionStatus(job.response_id, 'queued');
      try {
        await updateDbocResponseTranscriptionStatus(job, 'queued');
      } catch (statusError) {
        console.warn('[DBOC] transcription_retry_status_persist_failed', statusError instanceof Error ? statusError.message : statusError);
      }
      emitDbocTranscriptionEvent('retry_scheduled', {
        response_id: job.response_id,
        job_id: job.job_id,
        status: 'queued',
        error: job.error,
      });
      console.warn(
        `[DBOC] transcription_retry_scheduled job=${job.job_id} response_id=${job.response_id} attempts=${job.attempts}/${maxAttempts} retry_in_ms=${retryDelayMs} error=${job.error}`,
      );
      return;
    }

    job.status = 'failed';
    job.failed_at = new Date().toISOString();
    setDbocTranscriptionStatus(job.response_id, 'failed');
    try {
      await updateDbocResponseTranscriptionStatus(job, 'failed');
    } catch (statusError) {
      console.warn('[DBOC] transcription_failed_status_persist', statusError instanceof Error ? statusError.message : statusError);
    }
    recordDbocTranscribeHistory(job);
    emitDbocTranscriptionEvent('failed', {
      response_id: job.response_id,
      job_id: job.job_id,
      status: 'failed',
      error: job.error,
    });
    removeDbocTranscribeJob(job.job_id);
    console.error(`[DBOC] transcription_failed job=${job.job_id} response_id=${job.response_id} error=${job.error}`);
  }
}

async function runDbocTranscribeWorkerTick() {
  if (dbocTranscribeWorkerBusy) {
    return;
  }

  const nextJob = getReadyDbocTranscribeJob();
  if (!nextJob) {
    return;
  }

  dbocTranscribeWorkerBusy = true;
  try {
    await processDbocTranscribeJob(nextJob);
  } finally {
    dbocTranscribeWorkerBusy = false;
  }
}

function startDbocTranscribeWorker() {
  if (dbocTranscribeWorkerTimer) {
    return;
  }

  dbocTranscribeWorkerTimer = setInterval(() => {
    void runDbocTranscribeWorkerTick();
  }, DBOC_TRANSCRIBE_WORKER_POLL_MS);

  if (typeof dbocTranscribeWorkerTimer.unref === 'function') {
    dbocTranscribeWorkerTimer.unref();
  }
}

function normalizeDbocEncodeStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized === 'queued' || normalized === 'processing' || normalized === 'completed' || normalized === 'failed' || normalized === 'encode_failed') {
    return normalized;
  }
  return '';
}

function setDbocEncodeStatus(responseId, status) {
  const normalizedResponseId = String(responseId || '').trim();
  const normalizedStatus = normalizeDbocEncodeStatus(status);
  if (!normalizedResponseId || !normalizedStatus) {
    return;
  }
  DBOC_ENCODE_STATUS_BY_RESPONSE.set(normalizedResponseId, normalizedStatus);
}

function emitDbocEncodeEvent(eventType, payload = {}) {
  const event = {
    type: String(eventType || '').trim() || 'unknown',
    at: new Date().toISOString(),
    response_id: String(payload.response_id || '').trim() || null,
    job_id: String(payload.job_id || '').trim() || null,
    status: normalizeDbocEncodeStatus(payload.status || '') || null,
    error: String(payload.error || '').trim() || null,
    codec: String(payload.codec || '').trim() || null,
  };
  DBOC_ENCODE_EVENTS.push(event);
  if (DBOC_ENCODE_EVENTS.length > 500) {
    DBOC_ENCODE_EVENTS.splice(0, DBOC_ENCODE_EVENTS.length - 500);
  }
  console.log(`[DBOC] encode_event type=${event.type} response_id=${event.response_id || 'unknown'} status=${event.status || 'n/a'}`);
}

function isDbocEncodeStatusColumnMissing(errorMessage = '') {
  return isDbocColumnMissing(errorMessage, 'encode_status');
}

function isDbocVideoDurationSecondsColumnMissing(errorMessage = '') {
  return isDbocColumnMissing(errorMessage, 'video_duration_seconds');
}

async function updateDbocResponseEncodeStatus(job = {}, status = '') {
  const responseId = String(job.response_id || '').trim();
  const nextStatus = normalizeDbocEncodeStatus(status);
  if (!responseId || !nextStatus) {
    return;
  }

  setDbocEncodeStatus(responseId, nextStatus);

  const workerSession = {
    wpAuthorization: String(job.wp_authorization || '').trim(),
  };

  const updateResult = await fetchSupabaseTable(
    `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
        ...buildDbocSupabaseHeaders(workerSession, true),
      },
      body: JSON.stringify({ encode_status: nextStatus }),
      timeoutMs: 15000,
    },
  );

  if (!updateResult.ok && !isDbocEncodeStatusColumnMissing(updateResult.error)) {
    throw new Error(updateResult.error || 'encode_status_update_failed');
  }
}

function getDbocEncodeRetryDelayMs(attemptNumber = 1) {
  const index = Math.max(0, Number(attemptNumber || 1) - 1);
  if (index < DBOC_ENCODE_RETRY_BACKOFF_MS.length) {
    return DBOC_ENCODE_RETRY_BACKOFF_MS[index];
  }
  return DBOC_ENCODE_RETRY_BACKOFF_MS[DBOC_ENCODE_RETRY_BACKOFF_MS.length - 1] || 15_000;
}

function getReadyDbocEncodeJob() {
  const now = Date.now();
  return DBOC_ENCODE_QUEUE.find((job) => {
    if (!job || normalizeDbocEncodeStatus(job.status) !== 'queued') {
      return false;
    }
    const nextRetryAt = Number(job.next_retry_at_ms || 0);
    return !nextRetryAt || nextRetryAt <= now;
  }) || null;
}

function removeDbocEncodeJob(jobId = '') {
  const normalized = String(jobId || '').trim();
  if (!normalized) {
    return;
  }
  const index = DBOC_ENCODE_QUEUE.findIndex((job) => String(job?.job_id || '').trim() === normalized);
  if (index >= 0) {
    DBOC_ENCODE_QUEUE.splice(index, 1);
  }
}

function runDbocExecFile(command, args = [], timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || stdout || error.message || 'execution_failed').trim().slice(0, 500);
        reject(new Error(`${command}_failed:${detail}`));
        return;
      }
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    });
  });
}

function sanitizeDbocPathSegment(value = '', fallback = 'unknown') {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/gu, '_').replace(/^_+|_+$/gu, '');
  return normalized || fallback;
}

function buildDbocNormalizedVideoUrl(job = {}) {
  const base = String(CONFIG.mediaUploadBase || 'https://cdn.missionmedinstitute.com').replace(/\/+$/u, '');
  const userSegment = sanitizeDbocPathSegment(job.user_id, 'unknown-user');
  const responseSegment = sanitizeDbocPathSegment(job.response_id, 'unknown-response');
  return `${base}/dboc-iv/${userSegment}/${responseSegment}.mp4`;
}

function resolveDbocInputExtension(videoUrl = '') {
  try {
    const parsed = new URL(String(videoUrl || '').trim());
    const ext = path.extname(parsed.pathname || '').trim().toLowerCase();
    if (ext && ext.length <= 10) {
      return ext;
    }
  } catch {
    // Keep default extension.
  }
  return '.webm';
}

function writeDbocTempVideoInput(job = {}, videoBuffer = Buffer.alloc(0)) {
  const jobSegment = sanitizeDbocPathSegment(job.job_id, randomUUID());
  const tempDir = path.join(tmpdir(), 'dboc-encode', jobSegment);
  mkdirSync(tempDir, { recursive: true });

  const inputExt = resolveDbocInputExtension(job.video_url);
  const inputPath = path.join(tempDir, `input${inputExt}`);
  const outputPath = path.join(tempDir, 'output.mp4');
  writeFileSync(inputPath, Buffer.isBuffer(videoBuffer) ? videoBuffer : Buffer.from(videoBuffer || ''));
  return { tempDir, inputPath, outputPath };
}

function cleanupDbocEncodeTempPaths(paths = {}) {
  const tempDir = String(paths.tempDir || '').trim();
  if (!tempDir) {
    return;
  }
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('[DBOC] encode_temp_cleanup_failed', error instanceof Error ? error.message : error);
  }
}

async function detectDbocVideoCodec(inputPath = '') {
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name',
    '-of',
    'default=nokey=1:noprint_wrappers=1',
    inputPath,
  ];
  const output = await runDbocExecFile('ffprobe', args, 30_000);
  const codec = String(output.stdout || '').split(/\r?\n/u).map((line) => line.trim()).find(Boolean) || '';
  return codec.toLowerCase() || 'unknown';
}

async function detectDbocVideoDurationSeconds(inputPath = '') {
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nokey=1:noprint_wrappers=1',
    inputPath,
  ];
  const output = await runDbocExecFile('ffprobe', args, 30_000);
  const raw = String(output.stdout || '').split(/\r?\n/u).map((line) => line.trim()).find(Boolean) || '0';
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

async function transcodeDbocVideoToMp4(inputPath = '', outputPath = '', preset = 'medium') {
  const args = [
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-crf',
    '23',
    '-preset',
    preset,
    outputPath,
  ];
  await runDbocExecFile('ffmpeg', args, 120_000);
}

async function uploadDbocEncodedVideo(job = {}, outputPath = '') {
  const finalVideoUrl = buildDbocNormalizedVideoUrl(job);
  if (DBOC_PIPELINE_SAFE_MODE) {
    return {
      final_video_url: finalVideoUrl,
      upload_mode: 'safe_mode',
    };
  }

  const outputBuffer = readFileSync(outputPath);
  const uploadResult = await fetchJson(finalVideoUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(outputBuffer.length),
    },
    body: outputBuffer,
    timeoutMs: 45_000,
  });

  if (!uploadResult.ok) {
    throw new Error(uploadResult.error || 'encode_upload_failed');
  }

  return {
    final_video_url: finalVideoUrl,
    upload_mode: 'direct_put',
  };
}

async function persistDbocEncodedVideo(job = {}, finalVideoUrl = '', durationSeconds = 0) {
  const responseId = String(job.response_id || '').trim();
  const safeVideoUrl = String(finalVideoUrl || '').trim();
  if (!responseId || !safeVideoUrl) {
    throw new Error('encode_persist_required_fields_missing');
  }

  const workerSession = {
    wpAuthorization: String(job.wp_authorization || '').trim(),
  };

  const roundedDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.round(durationSeconds * 1000) / 1000
    : null;
  const primaryPayload = {
    video_url: safeVideoUrl,
    encode_status: 'completed',
    ...(roundedDuration ? { video_duration_seconds: roundedDuration } : {}),
  };

  const updateResult = await fetchSupabaseTable(
    `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
        ...buildDbocSupabaseHeaders(workerSession, true),
      },
      body: JSON.stringify(primaryPayload),
      timeoutMs: 15000,
    },
  );

  if (!updateResult.ok) {
    const missingEncodeStatus = isDbocEncodeStatusColumnMissing(updateResult.error);
    const missingDuration = isDbocVideoDurationSecondsColumnMissing(updateResult.error);
    if (!missingEncodeStatus && !missingDuration) {
      throw new Error(updateResult.error || 'encode_persist_failed');
    }

    const fallbackResult = await fetchSupabaseTable(
      `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
          ...buildDbocSupabaseHeaders(workerSession, true),
        },
        body: JSON.stringify({ video_url: safeVideoUrl }),
        timeoutMs: 15000,
      },
    );
    if (!fallbackResult.ok) {
      throw new Error(fallbackResult.error || 'encode_persist_fallback_failed');
    }
  }

  setDbocEncodeStatus(responseId, 'completed');
}

function maybeQueueDbocTranscriptionAfterEncode(job = {}, finalVideoUrl = '') {
  const responseId = String(job.response_id || '').trim();
  if (!responseId || !String(finalVideoUrl || '').trim()) {
    return;
  }
  if (Boolean(job.has_transcript)) {
    return;
  }

  const existingQueueJob = DBOC_TRANSCRIBE_QUEUE.find((item) => String(item?.response_id || '').trim() === responseId);
  if (existingQueueJob) {
    return;
  }

  const currentStatus = normalizeDbocTranscriptionStatus(DBOC_TRANSCRIBE_STATUS_BY_RESPONSE.get(responseId));
  if (currentStatus === 'queued' || currentStatus === 'processing' || currentStatus === 'completed') {
    return;
  }

  const transcribeJobId = randomUUID();
  DBOC_TRANSCRIBE_QUEUE.push({
    job_id: transcribeJobId,
    response_id: responseId,
    video_url: String(finalVideoUrl || '').trim(),
    user_id: String(job.user_id || '').trim(),
    wp_authorization: String(job.wp_authorization || '').trim(),
    status: 'queued',
    queued_at: new Date().toISOString(),
    attempts: 0,
  });
  setDbocTranscriptionStatus(responseId, 'queued');
  emitDbocTranscriptionEvent('queued', {
    response_id: responseId,
    job_id: transcribeJobId,
    status: 'queued',
  });
  void updateDbocResponseTranscriptionStatus({
    response_id: responseId,
    wp_authorization: String(job.wp_authorization || '').trim(),
  }, 'queued').catch((error) => {
    console.warn('[DBOC] transcription_auto_queue_status_persist_failed', error instanceof Error ? error.message : error);
  });
  void runDbocTranscribeWorkerTick();
}

function maybeQueueDbocMetricsAfterEncode(job = {}, finalVideoUrl = '') {
  const queued = enqueueDbocMetricsJob({
    responseId: String(job.response_id || '').trim(),
    videoUrl: String(finalVideoUrl || '').trim(),
    userId: String(job.user_id || '').trim(),
    wpAuthorization: String(job.wp_authorization || '').trim(),
    mode: String(job.mode || '').trim(),
    force: false,
  });
  if (queued) {
    void runDbocMetricsWorkerTick();
  }
}

function maybeQueueDbocMetricsAfterTranscription(job = {}) {
  const queued = enqueueDbocMetricsJob({
    responseId: String(job.response_id || '').trim(),
    videoUrl: String(job.video_url || '').trim(),
    userId: String(job.user_id || '').trim(),
    wpAuthorization: String(job.wp_authorization || '').trim(),
    mode: String(job.mode || '').trim(),
    force: true,
  });
  if (queued) {
    void runDbocMetricsWorkerTick();
  }
}

async function processDbocEncodeJob(job = null) {
  if (!job) {
    return;
  }

  job.status = 'processing';
  job.processing_at = new Date().toISOString();
  job.attempts = Number(job.attempts || 0) + 1;
  setDbocEncodeStatus(job.response_id, 'processing');
  emitDbocEncodeEvent('processing', {
    response_id: job.response_id,
    job_id: job.job_id,
    status: 'processing',
  });

  let tempPaths = null;
  try {
    await updateDbocResponseEncodeStatus(job, 'processing');

    const videoResult = await fetchDbocVideoForTranscription(job.video_url);
    tempPaths = writeDbocTempVideoInput(job, videoResult.videoBuffer);

    let detectedCodec = 'unknown';
    try {
      detectedCodec = await detectDbocVideoCodec(tempPaths.inputPath);
    } catch (codecError) {
      if (!DBOC_PIPELINE_SAFE_MODE) {
        throw codecError;
      }
      detectedCodec = 'unknown';
      console.warn('[DBOC] encode_codec_detection_fallback', codecError instanceof Error ? codecError.message : codecError);
    }

    if (detectedCodec === 'h264') {
      copyFileSync(tempPaths.inputPath, tempPaths.outputPath);
    } else {
      try {
        await transcodeDbocVideoToMp4(tempPaths.inputPath, tempPaths.outputPath, 'medium');
      } catch (firstError) {
        console.warn('[DBOC] encode_transcode_retry_fast', firstError instanceof Error ? firstError.message : firstError);
        await transcodeDbocVideoToMp4(tempPaths.inputPath, tempPaths.outputPath, 'fast');
      }
    }

    let durationSeconds = 0;
    try {
      durationSeconds = await detectDbocVideoDurationSeconds(tempPaths.outputPath);
    } catch (durationError) {
      if (!DBOC_PIPELINE_SAFE_MODE) {
        throw durationError;
      }
      console.warn('[DBOC] encode_duration_detection_fallback', durationError instanceof Error ? durationError.message : durationError);
    }

    const uploadResult = await uploadDbocEncodedVideo(job, tempPaths.outputPath);
    const finalVideoUrl = String(uploadResult.final_video_url || '').trim();
    await persistDbocEncodedVideo(job, finalVideoUrl, durationSeconds);
    maybeQueueDbocMetricsAfterEncode(job, finalVideoUrl);
    maybeQueueDbocTranscriptionAfterEncode(job, finalVideoUrl);

    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    setDbocEncodeStatus(job.response_id, 'completed');
    emitDbocEncodeEvent('completed', {
      response_id: job.response_id,
      job_id: job.job_id,
      status: 'completed',
      codec: detectedCodec,
    });
    removeDbocEncodeJob(job.job_id);
    console.log(`[DBOC] encode_completed job=${job.job_id} response_id=${job.response_id} codec=${detectedCodec} mode=${uploadResult.upload_mode}`);
  } catch (error) {
    job.error = error instanceof Error ? error.message : 'encode_failed';
    const maxAttempts = 2;

    if (Number(job.attempts || 0) < maxAttempts) {
      const currentAttempt = Number(job.attempts || 0);
      const retryDelayMs = getDbocEncodeRetryDelayMs(currentAttempt);
      job.status = 'queued';
      job.next_retry_at_ms = Date.now() + retryDelayMs;
      setDbocEncodeStatus(job.response_id, 'queued');
      try {
        await updateDbocResponseEncodeStatus(job, 'queued');
      } catch (statusError) {
        console.warn('[DBOC] encode_retry_status_persist_failed', statusError instanceof Error ? statusError.message : statusError);
      }
      emitDbocEncodeEvent('retry_scheduled', {
        response_id: job.response_id,
        job_id: job.job_id,
        status: 'queued',
        error: job.error,
      });
      console.warn(
        `[DBOC] encode_retry_scheduled job=${job.job_id} response_id=${job.response_id} attempts=${job.attempts}/${maxAttempts} retry_in_ms=${retryDelayMs} error=${job.error}`,
      );
      return;
    }

    job.status = 'failed';
    job.failed_at = new Date().toISOString();
    setDbocEncodeStatus(job.response_id, 'encode_failed');
    try {
      await updateDbocResponseEncodeStatus(job, 'encode_failed');
    } catch (statusError) {
      console.warn('[DBOC] encode_failed_status_persist', statusError instanceof Error ? statusError.message : statusError);
    }
    emitDbocEncodeEvent('failed', {
      response_id: job.response_id,
      job_id: job.job_id,
      status: 'encode_failed',
      error: job.error,
    });
    removeDbocEncodeJob(job.job_id);
    console.error(`[DBOC] encode_failed job=${job.job_id} response_id=${job.response_id} error=${job.error}`);
  } finally {
    cleanupDbocEncodeTempPaths(tempPaths || {});
  }
}

async function runDbocEncodeWorkerTick() {
  if (dbocEncodeWorkerBusy) {
    return;
  }

  const nextJob = getReadyDbocEncodeJob();
  if (!nextJob) {
    return;
  }

  dbocEncodeWorkerBusy = true;
  try {
    await processDbocEncodeJob(nextJob);
  } finally {
    dbocEncodeWorkerBusy = false;
  }
}

function startDbocEncodeWorker() {
  if (dbocEncodeWorkerTimer) {
    return;
  }

  dbocEncodeWorkerTimer = setInterval(() => {
    void runDbocEncodeWorkerTick();
  }, DBOC_ENCODE_WORKER_POLL_MS);

  if (typeof dbocEncodeWorkerTimer.unref === 'function') {
    dbocEncodeWorkerTimer.unref();
  }
}

function normalizeDbocMetricsStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (normalized === 'queued' || normalized === 'processing' || normalized === 'completed' || normalized === 'failed') {
    return normalized;
  }
  return '';
}

function setDbocMetricsStatus(responseId, status) {
  const normalizedResponseId = String(responseId || '').trim();
  const normalizedStatus = normalizeDbocMetricsStatus(status);
  if (!normalizedResponseId || !normalizedStatus) {
    return;
  }
  DBOC_METRICS_STATUS_BY_RESPONSE.set(normalizedResponseId, normalizedStatus);
}

function emitDbocMetricsEvent(eventType, payload = {}) {
  const event = {
    type: String(eventType || '').trim() || 'unknown',
    at: new Date().toISOString(),
    response_id: String(payload.response_id || '').trim() || null,
    job_id: String(payload.job_id || '').trim() || null,
    status: normalizeDbocMetricsStatus(payload.status || '') || null,
    error: String(payload.error || '').trim() || null,
  };
  DBOC_METRICS_EVENTS.push(event);
  if (DBOC_METRICS_EVENTS.length > 500) {
    DBOC_METRICS_EVENTS.splice(0, DBOC_METRICS_EVENTS.length - 500);
  }
  console.log(`[DBOC] metrics_event type=${event.type} response_id=${event.response_id || 'unknown'} status=${event.status || 'n/a'}`);
}

function getDbocMetricsRetryDelayMs(attemptNumber = 1) {
  const index = Math.max(0, Number(attemptNumber || 1) - 1);
  if (index < DBOC_METRICS_RETRY_BACKOFF_MS.length) {
    return DBOC_METRICS_RETRY_BACKOFF_MS[index];
  }
  return DBOC_METRICS_RETRY_BACKOFF_MS[DBOC_METRICS_RETRY_BACKOFF_MS.length - 1] || 15_000;
}

function getReadyDbocMetricsJob() {
  const now = Date.now();
  return DBOC_METRICS_QUEUE.find((job) => {
    if (!job || normalizeDbocMetricsStatus(job.status) !== 'queued') {
      return false;
    }
    const nextRetryAt = Number(job.next_retry_at_ms || 0);
    return !nextRetryAt || nextRetryAt <= now;
  }) || null;
}

function removeDbocMetricsJob(jobId = '') {
  const normalized = String(jobId || '').trim();
  if (!normalized) {
    return;
  }
  const index = DBOC_METRICS_QUEUE.findIndex((job) => String(job?.job_id || '').trim() === normalized);
  if (index >= 0) {
    DBOC_METRICS_QUEUE.splice(index, 1);
  }
}

function enqueueDbocMetricsJob({ responseId = '', videoUrl = '', userId = '', wpAuthorization = '', mode = '', force = false } = {}) {
  const safeResponseId = String(responseId || '').trim();
  const safeVideoUrl = String(videoUrl || '').trim();
  if (!safeResponseId || !safeVideoUrl) {
    return null;
  }

  const existingQueued = DBOC_METRICS_QUEUE.find((job) => {
    if (String(job?.response_id || '').trim() !== safeResponseId) {
      return false;
    }
    const status = normalizeDbocMetricsStatus(job.status);
    return status === 'queued' || status === 'processing';
  });
  if (existingQueued) {
    return existingQueued;
  }

  const currentStatus = normalizeDbocMetricsStatus(DBOC_METRICS_STATUS_BY_RESPONSE.get(safeResponseId));
  if (currentStatus === 'completed' && !force) {
    return null;
  }

  const job = {
    job_id: randomUUID(),
    response_id: safeResponseId,
    video_url: safeVideoUrl,
    user_id: String(userId || '').trim(),
    wp_authorization: String(wpAuthorization || '').trim(),
    mode: String(mode || '').trim().toLowerCase() || 'quick_rep',
    status: 'queued',
    queued_at: new Date().toISOString(),
    attempts: 0,
  };
  DBOC_METRICS_QUEUE.push(job);
  setDbocMetricsStatus(safeResponseId, 'queued');
  emitDbocMetricsEvent('queued', {
    response_id: safeResponseId,
    job_id: job.job_id,
    status: 'queued',
  });
  return job;
}

async function fetchDbocResponseRowForMetrics(job = {}) {
  const responseId = String(job.response_id || '').trim();
  if (!responseId) {
    throw new Error('metrics_response_id_required');
  }
  const workerSession = {
    wpAuthorization: String(job.wp_authorization || '').trim(),
  };
  const result = await fetchSupabaseTable(
    `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id,user_id,transcript_text,video_url,session_id&limit=1`,
    { headers: buildDbocSupabaseHeaders(workerSession) },
  );
  if (!result.ok) {
    throw new Error(result.error || 'metrics_response_lookup_failed');
  }
  const row = Array.isArray(result.data) ? (result.data[0] || null) : null;
  if (!row) {
    throw new Error('metrics_response_not_found');
  }
  return row;
}

async function fetchDbocSessionModeForMetrics(job = {}, sessionId = '') {
  const safeSessionId = String(sessionId || '').trim();
  if (!safeSessionId) {
    return String(job.mode || '').trim().toLowerCase() || 'quick_rep';
  }
  const workerSession = {
    wpAuthorization: String(job.wp_authorization || '').trim(),
  };
  const result = await fetchSupabaseTable(
    `dboc_iv_sessions?id=eq.${encodeURIComponent(safeSessionId)}&select=mode&limit=1`,
    { headers: buildDbocSupabaseHeaders(workerSession) },
  );
  if (!result.ok) {
    return String(job.mode || '').trim().toLowerCase() || 'quick_rep';
  }
  const row = Array.isArray(result.data) ? (result.data[0] || null) : null;
  return String(row?.mode || job.mode || '').trim().toLowerCase() || 'quick_rep';
}

async function extractDbocMetricsAudio(inputPath = '', outputPath = '') {
  const args = [
    '-y',
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    outputPath,
  ];
  await runDbocExecFile('ffmpeg', args, 120_000);
}

async function persistDbocMetrics(job = {}, metrics = {}) {
  const responseId = String(job.response_id || '').trim();
  if (!responseId) {
    throw new Error('metrics_response_id_required');
  }
  const workerSession = {
    wpAuthorization: String(job.wp_authorization || '').trim(),
  };
  const payload = {
    response_id: responseId,
    pitch_sd: Number(metrics.pitch_sd || 0),
    volume_rms: Number(metrics.volume_rms || 0),
    wpm: Number(metrics.wpm || 0),
    filler_count: Number(metrics.filler_count || 0),
    pause_count: Number(metrics.pause_count || 0),
  };

  const existing = await fetchSupabaseTable(
    `dboc_iv_response_metrics?response_id=eq.${encodeURIComponent(responseId)}&select=id&limit=1`,
    { headers: buildDbocSupabaseHeaders(workerSession) },
  );
  if (!existing.ok) {
    throw new Error(existing.error || 'metrics_lookup_failed');
  }

  const existingRow = Array.isArray(existing.data) ? (existing.data[0] || null) : null;
  let persistResult;
  if (existingRow?.id) {
    persistResult = await fetchSupabaseTable(
      `dboc_iv_response_metrics?id=eq.${encodeURIComponent(String(existingRow.id))}`,
      {
        method: 'PATCH',
        headers: buildDbocSupabaseHeaders(workerSession, true),
        body: JSON.stringify(payload),
        timeoutMs: 15000,
      },
    );
  } else {
    persistResult = await fetchSupabaseTable('dboc_iv_response_metrics', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
        ...buildDbocSupabaseHeaders(workerSession, true),
      },
      body: JSON.stringify(payload),
      timeoutMs: 15000,
    });
  }

  if (!persistResult.ok) {
    throw new Error(persistResult.error || 'metrics_persist_failed');
  }
}

async function processDbocMetricsJob(job = null) {
  if (!job) {
    return;
  }

  job.status = 'processing';
  job.processing_at = new Date().toISOString();
  job.attempts = Number(job.attempts || 0) + 1;
  setDbocMetricsStatus(job.response_id, 'processing');
  emitDbocMetricsEvent('processing', {
    response_id: job.response_id,
    job_id: job.job_id,
    status: 'processing',
  });

  let tempPaths = null;
  try {
    const row = await fetchDbocResponseRowForMetrics(job);
    const transcriptText = String(row.transcript_text || '').trim();
    const mode = await fetchDbocSessionModeForMetrics(job, row.session_id);
    const sourceVideoUrl = String(job.video_url || row.video_url || '').trim();
    if (!sourceVideoUrl) {
      throw new Error('metrics_video_url_required');
    }

    let metrics;
    let durationSeconds = 0;
    try {
      const videoResult = await fetchDbocVideoForTranscription(sourceVideoUrl);
      tempPaths = writeDbocTempVideoInput(job, videoResult.videoBuffer);
      durationSeconds = await detectDbocVideoDurationSeconds(tempPaths.inputPath).catch(() => 0);
      const audioPath = tempPaths.outputPath.replace(/\\.mp4$/u, '.wav');
      await extractDbocMetricsAudio(tempPaths.inputPath, audioPath);
      const wavBuffer = readFileSync(audioPath);
      metrics = computeDeliveryMetricsFromWav(wavBuffer, transcriptText, durationSeconds);
    } catch (audioError) {
      if (!DBOC_PIPELINE_SAFE_MODE) {
        throw audioError;
      }
      console.warn('[DBOC] metrics_audio_fallback', audioError instanceof Error ? audioError.message : audioError);
      metrics = computeDeliveryMetricsSafeFallback(transcriptText, durationSeconds);
    }

    const deliveryInsights = buildDeliveryInsights(metrics, mode);
    await persistDbocMetrics(job, metrics);

    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    setDbocMetricsStatus(job.response_id, 'completed');
    emitDbocMetricsEvent('completed', {
      response_id: job.response_id,
      job_id: job.job_id,
      status: 'completed',
    });
    removeDbocMetricsJob(job.job_id);
    console.log(`[DBOC] metrics_completed job=${job.job_id} response_id=${job.response_id} insights=${deliveryInsights.length}`);
  } catch (error) {
    job.error = error instanceof Error ? error.message : 'metrics_failed';
    const maxAttempts = 3;

    if (Number(job.attempts || 0) < maxAttempts) {
      const retryDelayMs = getDbocMetricsRetryDelayMs(job.attempts);
      job.status = 'queued';
      job.next_retry_at_ms = Date.now() + retryDelayMs;
      setDbocMetricsStatus(job.response_id, 'queued');
      emitDbocMetricsEvent('retry_scheduled', {
        response_id: job.response_id,
        job_id: job.job_id,
        status: 'queued',
        error: job.error,
      });
      console.warn(`[DBOC] metrics_retry_scheduled job=${job.job_id} response_id=${job.response_id} retry_in_ms=${retryDelayMs} error=${job.error}`);
      return;
    }

    job.status = 'failed';
    job.failed_at = new Date().toISOString();
    setDbocMetricsStatus(job.response_id, 'failed');
    emitDbocMetricsEvent('failed', {
      response_id: job.response_id,
      job_id: job.job_id,
      status: 'failed',
      error: job.error,
    });
    removeDbocMetricsJob(job.job_id);
    console.error(`[DBOC] metrics_failed job=${job.job_id} response_id=${job.response_id} error=${job.error}`);
  } finally {
    cleanupDbocEncodeTempPaths(tempPaths || {});
  }
}

async function runDbocMetricsWorkerTick() {
  if (dbocMetricsWorkerBusy) {
    return;
  }

  const nextJob = getReadyDbocMetricsJob();
  if (!nextJob) {
    return;
  }

  dbocMetricsWorkerBusy = true;
  try {
    await processDbocMetricsJob(nextJob);
  } finally {
    dbocMetricsWorkerBusy = false;
  }
}

function startDbocMetricsWorker() {
  if (dbocMetricsWorkerTimer) {
    return;
  }

  dbocMetricsWorkerTimer = setInterval(() => {
    void runDbocMetricsWorkerTick();
  }, DBOC_METRICS_WORKER_POLL_MS);

  if (typeof dbocMetricsWorkerTimer.unref === 'function') {
    dbocMetricsWorkerTimer.unref();
  }
}

function sanitizeDbocFilename(filename) {
  const cleaned = String(filename || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  return cleaned || 'upload.mp4';
}

function buildDbocInFilter(values = []) {
  const safeValues = values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .map((value) => value.replace(/[^a-zA-Z0-9_-]/gu, ''));

  return safeValues.length ? `in.(${safeValues.join(',')})` : '';
}

function buildDbocSupabaseHeaders(session = null, includeContentType = false) {
  const headers = {};
  void session;
  // Supabase auth headers are injected by fetchSupabaseTable(). Forwarding
  // WordPress tokens here causes Supabase JWT verification failures.

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Profile'] = 'public';
  }

  return headers;
}

function dbocEnsureUserMatch(inputUserId, sessionUserId) {
  const expected = normalizeDbocUserId(sessionUserId);
  const received = normalizeDbocUserId(inputUserId);
  return Boolean(expected && received && expected === received);
}

function dbocComputeSafAnalysis(transcriptText) {
  return analyzeSafTranscript(transcriptText);
}

function buildDbocVaultSummary(transcriptText = '') {
  const compact = String(transcriptText || '').replace(/\s+/gu, ' ').trim();
  if (!compact) {
    return 'Answer submitted';
  }
  if (compact.length <= 280) {
    return compact;
  }
  return `${compact.slice(0, 277)}...`;
}

async function upsertDbocAnswerVaultEntry({ userId = '', questionId = '', transcriptText = '', feedbackText = '', session = null } = {}) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    throw new Error('vault_user_id_required');
  }

  const safeQuestionId = String(questionId || '').trim();
  let category = null;
  if (safeQuestionId) {
    const categoryLookup = await fetchSupabaseTable(
      `dboc_iv_questions?id=eq.${encodeURIComponent(safeQuestionId)}&select=category&limit=1`,
      { headers: buildDbocSupabaseHeaders(session) },
    );
    if (categoryLookup.ok) {
      const row = Array.isArray(categoryLookup.data) ? (categoryLookup.data[0] || null) : null;
      category = String(row?.category || '').trim() || null;
    }
  }

  const payload = {
    user_id: safeUserId,
    question_id: safeQuestionId || null,
    summary: buildDbocVaultSummary(transcriptText),
    notes: String(feedbackText || '').trim() || null,
    category,
  };

  if (safeQuestionId) {
    const existingVault = await fetchSupabaseTable(
      `dboc_iv_answer_vault?user_id=eq.${encodeURIComponent(safeUserId)}&question_id=eq.${encodeURIComponent(safeQuestionId)}&select=id&order=created_at.desc&limit=1`,
      { headers: buildDbocSupabaseHeaders(session) },
    );
    if (!existingVault.ok) {
      throw new Error(existingVault.error || 'vault_lookup_failed');
    }

    const existingRow = Array.isArray(existingVault.data) ? (existingVault.data[0] || null) : null;
    if (existingRow?.id) {
      const updateVault = await fetchSupabaseTable(
        `dboc_iv_answer_vault?id=eq.${encodeURIComponent(String(existingRow.id))}&select=id`,
        {
          method: 'PATCH',
          headers: {
            Prefer: 'return=representation',
            ...buildDbocSupabaseHeaders(session, true),
          },
          body: JSON.stringify(payload),
        },
      );
      if (!updateVault.ok) {
        throw new Error(updateVault.error || 'vault_update_failed');
      }
      return;
    }
  }

  const insertVault = await fetchSupabaseTable('dboc_iv_answer_vault?select=id', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
      ...buildDbocSupabaseHeaders(session, true),
    },
    body: JSON.stringify(payload),
  });
  if (!insertVault.ok) {
    throw new Error(insertVault.error || 'vault_insert_failed');
  }
}

async function persistDbocSafAnalysis(responseId = '', transcriptText = '', session = null, options = {}) {
  const safeResponseId = String(responseId || '').trim();
  const safeTranscript = String(transcriptText || '').trim();
  if (!safeResponseId) {
    throw new Error('saf_response_id_required');
  }
  if (!safeTranscript) {
    throw new Error('saf_transcript_required');
  }

  const localSession = {
    wpAuthorization: String(session?.wpAuthorization || options.wpAuthorization || '').trim(),
  };

  const analysis = dbocComputeSafAnalysis(safeTranscript);
  const persistPayload = {
    response_id: safeResponseId,
    s_score: Number(analysis.s_score || 0),
    a_reasons: Number(analysis.a_reasons || 0),
    f_focus: Number(analysis.f_focus || 0),
    e_closing: Number(analysis.e_closing || 0),
    feedback_text: String(analysis.feedback_text || '').trim(),
  };

  const existing = await fetchSupabaseTable(
    `dboc_iv_saf_analysis?response_id=eq.${encodeURIComponent(safeResponseId)}&select=id&limit=1`,
    { headers: buildDbocSupabaseHeaders(localSession) },
  );
  if (!existing.ok) {
    throw new Error(existing.error || 'saf_lookup_failed');
  }

  const existingRow = Array.isArray(existing.data) ? (existing.data[0] || null) : null;
  let persistResult;
  if (existingRow?.id) {
    persistResult = await fetchSupabaseTable(`dboc_iv_saf_analysis?id=eq.${encodeURIComponent(String(existingRow.id))}`, {
      method: 'PATCH',
      headers: buildDbocSupabaseHeaders(localSession, true),
      body: JSON.stringify(persistPayload),
      timeoutMs: 15000,
    });
  } else {
    persistResult = await fetchSupabaseTable('dboc_iv_saf_analysis', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
        ...buildDbocSupabaseHeaders(localSession, true),
      },
      body: JSON.stringify(persistPayload),
      timeoutMs: 15000,
    });
  }

  if (!persistResult.ok) {
    throw new Error(persistResult.error || 'saf_persist_failed');
  }

  return {
    ...analysis,
    persisted: true,
  };
}

function buildDbocUploadUrl(userId, filename) {
  const nowMs = Date.now();
  const expiresAtMs = nowMs + (60 * 60 * 1000);
  const safeFilename = sanitizeDbocFilename(filename);
  const objectKey = `dboc-iv/${normalizeDbocUserId(userId)}/${nowMs}_${safeFilename}`;
  const base = String(CONFIG.mediaUploadBase || 'https://cdn.missionmedinstitute.com').replace(/\/+$/u, '');
  const signature = createHash('sha256')
    .update(`${objectKey}:${expiresAtMs}:${SESSION_SECRET}`)
    .digest('hex');

  return {
    signed_url: `${base}/${objectKey}?x-dboc-signature=${signature}&x-dboc-expires=${expiresAtMs}`,
    expires_at: new Date(expiresAtMs).toISOString(),
  };
}

function toIsoDateKey(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function computeDbocStreak(rows = []) {
  const uniqueDays = [...new Set(rows.map((row) => toIsoDateKey(row?.created_at)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));

  if (!uniqueDays.length) {
    return 0;
  }

  let streak = 1;
  let current = new Date(`${uniqueDays[0]}T00:00:00.000Z`);
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const next = new Date(`${uniqueDays[index]}T00:00:00.000Z`);
    const deltaDays = Math.round((current.getTime() - next.getTime()) / (24 * 60 * 60 * 1000));
    if (deltaDays === 1) {
      streak += 1;
      current = next;
      continue;
    }
    break;
  }

  return streak;
}

function deriveDbocSafOverall(saf = null) {
  if (!saf || typeof saf !== 'object') {
    return null;
  }
  const values = [
    Number(saf.s_score || 0),
    Number(saf.a_reasons || 0),
    Number(saf.f_focus || 0),
    Number(saf.e_closing || 0),
  ];
  const present = values.filter((value) => value === 10).length;
  const nonMissing = values.filter((value) => value > 0).length;
  if (present === 4 || (present === 3 && nonMissing === 4)) {
    return 'strong';
  }
  if (nonMissing >= 2) {
    return 'developing';
  }
  return 'missing';
}

async function fetchDbocResponsesByUser(userId = '', session = null, limit = 1000) {
  const safeUserId = normalizeDbocUserId(userId);
  if (!safeUserId) {
    return { ok: false, error: 'user_id required', data: [] };
  }

  const safeLimit = Math.max(1, Math.min(2000, Number(limit || 1000)));
  const base = `dboc_iv_responses?user_id=eq.${encodeURIComponent(safeUserId)}&order=created_at.desc&limit=${safeLimit}`;
  const variants = [
    'id,session_id,question_id,mode,video_url,transcription_status,transcript_text,submitted_at,created_at',
    'id,session_id,question_id,mode,video_url,transcript_text,submitted_at,created_at',
    'id,session_id,video_url,transcription_status,transcript_text,submitted_at,created_at',
    'id,session_id,video_url,transcript_text,submitted_at,created_at',
    'id,session_id,transcription_status,transcript_text,submitted_at,created_at',
    'id,session_id,transcript_text,submitted_at,created_at',
  ];

  let lastResult = { ok: false, error: 'responses_lookup_failed', data: [] };
  for (const select of variants) {
    const result = await fetchSupabaseTable(`${base}&select=${select}`, {
      headers: buildDbocSupabaseHeaders(session),
    });
    if (result.ok) {
      return result;
    }
    lastResult = result;
    const msg = String(result.error || '').toLowerCase();
    const isSafeFallback =
      isDbocTranscriptionStatusColumnMissing(msg)
      || isDbocQuestionIdColumnMissing(msg)
      || isDbocModeColumnMissing(msg)
      || isDbocVideoUrlColumnMissing(msg);
    if (!isSafeFallback) {
      return result;
    }
  }
  return lastResult;
}

function deriveDbocMissSkillFromSaf(saf = null) {
  if (!saf || typeof saf !== 'object') {
    return '';
  }
  const s = Number(saf.s_score || 0);
  const a = Number(saf.a_reasons || 0);
  const f = Number(saf.f_focus || 0);
  const e = Number(saf.e_closing || 0);
  if (s < 10) {
    return 'Opening';
  }
  if (a < 10) {
    return 'Career Fit';
  }
  if (f < 10) {
    return 'Storytelling';
  }
  if (e < 10) {
    return 'Closing';
  }
  return '';
}

function computeDbocConsecutiveSkillMiss(timelineRows = []) {
  if (!Array.isArray(timelineRows) || !timelineRows.length) {
    return { skill_tag: '', count: 0 };
  }
  let streakSkill = '';
  let streakCount = 0;
  for (let index = timelineRows.length - 1; index >= 0; index -= 1) {
    const row = timelineRows[index];
    const overall = String(row?.saf_overall || '').trim().toLowerCase();
    if (overall === 'strong') {
      break;
    }
    const skill = deriveDbocMissSkillFromSaf(row?.saf_scores || null);
    if (!skill) {
      break;
    }
    if (!streakSkill) {
      streakSkill = skill;
      streakCount = 1;
      continue;
    }
    if (skill !== streakSkill) {
      break;
    }
    streakCount += 1;
  }
  return {
    skill_tag: streakSkill,
    count: streakCount,
  };
}

function mapDbocGoldAnswer(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const transcript = String(raw.transcript_text || raw.transcript || raw.answer_text || '').trim();
  const coachingNotes = String(raw.coaching_notes || raw.notes || raw.dr_brian_notes || '').trim();
  return {
    id: raw.id || null,
    question_id: raw.question_id || null,
    video_url: String(raw.video_url || raw.audio_url || '').trim() || null,
    transcript_text: transcript || null,
    coaching_notes: coachingNotes || null,
    saf_breakdown: {
      start_simple: String(raw.start_excerpt || raw.s_example || '').trim() || null,
      add_reasons: String(raw.reasons_excerpt || raw.a_example || '').trim() || null,
      focus_example: String(raw.focus_excerpt || raw.f_example || '').trim() || null,
      end_strong: String(raw.end_excerpt || raw.e_example || '').trim() || null,
    },
  };
}

async function fetchDbocTeachingVideoSuggestion(skillTag = '', questionId = '', session = null) {
  const headers = buildDbocSupabaseHeaders(session);
  const normalizedSkill = String(skillTag || '').trim();
  const normalizedQuestionId = String(questionId || '').trim();

  if (normalizedSkill) {
    const skillResult = await fetchSupabaseTable(
      `dboc_iv_teaching_videos?skill_tag=eq.${encodeURIComponent(normalizedSkill)}&select=*&order=created_at.desc&limit=1`,
      { headers },
    );
    if (skillResult.ok && Array.isArray(skillResult.data) && skillResult.data[0]) {
      return skillResult.data[0];
    }
  }

  if (!normalizedQuestionId) {
    return null;
  }
  const questionResult = await fetchSupabaseTable(
    `dboc_iv_teaching_videos?question_id=eq.${encodeURIComponent(normalizedQuestionId)}&select=*&order=created_at.desc&limit=1`,
    { headers },
  );
  if (!questionResult.ok || !Array.isArray(questionResult.data)) {
    return null;
  }
  return questionResult.data[0] || null;
}

async function refreshDbocUserProgress(userId = '', session = null) {
  const safeUserId = normalizeDbocUserId(userId);
  if (!safeUserId) {
    return;
  }

  const headers = buildDbocSupabaseHeaders(session);
  const responsesResult = await fetchSupabaseTable(
    `dboc_iv_responses?user_id=eq.${encodeURIComponent(safeUserId)}&select=id,session_id,created_at,submitted_at&order=created_at.desc&limit=1000`,
    { headers },
  );
  if (!responsesResult.ok) {
    throw new Error(responsesResult.error || 'progress_refresh_responses_failed');
  }
  const responses = Array.isArray(responsesResult.data) ? responsesResult.data : [];

  const sessionIds = responses.map((row) => String(row.session_id || '').trim()).filter(Boolean);
  const sessionsFilter = buildDbocInFilter(sessionIds);
  const sessionsResult = sessionsFilter
    ? await fetchSupabaseTable(`dboc_iv_sessions?id=${sessionsFilter}&select=id,question_id`, { headers })
    : { ok: true, data: [] };
  if (!sessionsResult.ok) {
    throw new Error(sessionsResult.error || 'progress_refresh_sessions_failed');
  }
  const sessions = Array.isArray(sessionsResult.data) ? sessionsResult.data : [];

  const questionIds = sessions.map((row) => String(row.question_id || '').trim()).filter(Boolean);
  const questionsFilter = buildDbocInFilter(questionIds);
  const questionsResult = questionsFilter
    ? await fetchSupabaseTable(`dboc_iv_questions?id=${questionsFilter}&select=id,category`, { headers })
    : { ok: true, data: [] };
  if (!questionsResult.ok) {
    throw new Error(questionsResult.error || 'progress_refresh_questions_failed');
  }
  const questions = Array.isArray(questionsResult.data) ? questionsResult.data : [];

  const sessionById = new Map(sessions.map((row) => [String(row.id || '').trim(), row]));
  const questionById = new Map(questions.map((row) => [String(row.id || '').trim(), row]));
  const categories = new Set();
  for (const response of responses) {
    const sessionRow = sessionById.get(String(response.session_id || '').trim());
    const questionRow = questionById.get(String(sessionRow?.question_id || '').trim());
    const category = String(questionRow?.category || '').trim();
    if (category) {
      categories.add(category);
    }
  }

  const payload = {
    user_id: safeUserId,
    total_reps: responses.length,
    categories_covered: [...categories],
    last_rep_at: responses[0]?.submitted_at || responses[0]?.created_at || null,
  };

  const existing = await fetchSupabaseTable(
    `dboc_iv_user_progress?user_id=eq.${encodeURIComponent(safeUserId)}&select=id&limit=1`,
    { headers },
  );
  if (!existing.ok) {
    throw new Error(existing.error || 'progress_refresh_lookup_failed');
  }

  const existingRow = Array.isArray(existing.data) ? (existing.data[0] || null) : null;
  let persistResult;
  if (existingRow?.id) {
    persistResult = await fetchSupabaseTable(
      `dboc_iv_user_progress?id=eq.${encodeURIComponent(String(existingRow.id))}`,
      {
        method: 'PATCH',
        headers: buildDbocSupabaseHeaders(session, true),
        body: JSON.stringify(payload),
        timeoutMs: 15000,
      },
    );
  } else {
    persistResult = await fetchSupabaseTable('dboc_iv_user_progress', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
        ...buildDbocSupabaseHeaders(session, true),
      },
      body: JSON.stringify(payload),
      timeoutMs: 15000,
    });
  }

  if (!persistResult.ok) {
    throw new Error(persistResult.error || 'progress_refresh_persist_failed');
  }
}

async function handleDbocRoute(request, response, url, session) {
  const { pathname, searchParams } = url;
  const sessionUserId = getDbocSessionUserId(session);

  if (!sessionUserId) {
    sendDbocJson(response, request, pathname, 'unknown', 401, { error: 'unauthorized' });
    return;
  }

  try {
    if (pathname === '/api/dboc/questions/select') {
      if (request.method !== 'POST' && request.method !== 'GET') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['GET', 'POST']);
        return;
      }

      let payload = {};
      if (request.method === 'POST') {
        payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
        if (!payload) {
          return;
        }
      } else {
        payload = {
          mode: searchParams.get('mode') || '',
          category: searchParams.get('category') || '',
          user_id: searchParams.get('user_id') || '',
        };
      }
      const mode = String(payload.mode || '').trim();
      const category = String(payload.category || '').trim();
      const userId = normalizeDbocUserId(payload.user_id);

      if (!mode) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'mode required' });
        return;
      }
      if (!userId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'user_id required' });
        return;
      }
      if (!dbocEnsureUserMatch(userId, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const selection = await selectDbocQuestion({
        mode,
        category,
        userId,
        fetchSupabaseTable,
        headers: buildDbocSupabaseHeaders(session),
      });
      const question = selection?.question || null;
      if (!question) {
        sendDbocJson(response, request, pathname, sessionUserId, 200, {
          question_id: null,
          text: null,
          category: category || null,
          teaching_video_url: null,
          selection_debug: selection?.debug || null,
        });
        return;
      }

      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        question_id: question.id,
        text: question.text || '',
        category: question.category || null,
        teaching_video_url: question.teaching_video_url || null,
        selection_debug: selection?.debug || null,
      });
      return;
    }

    if (pathname === '/api/dboc/sessions/create') {
      if (request.method !== 'POST') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['POST']);
        return;
      }

      const payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
      if (!payload) {
        return;
      }
      const userId = normalizeDbocUserId(payload.user_id);
      const questionId = String(payload.question_id || '').trim();
      const mode = String(payload.mode || '').trim();

      if (!userId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'user_id required' });
        return;
      }
      if (!questionId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'question_id required' });
        return;
      }
      if (!mode) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'mode required' });
        return;
      }
      if (!dbocEnsureUserMatch(userId, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const insertPayload = {
        user_id: userId,
        question_id: questionId,
        mode,
        status: 'active',
      };

      const createResponse = await fetchSupabaseTable('dboc_iv_sessions?select=id,status', {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
          ...buildDbocSupabaseHeaders(session, true),
        },
        body: JSON.stringify(insertPayload),
      });

      if (!createResponse.ok) {
        throw new Error(createResponse.error || 'session_create_failed');
      }

      const created = Array.isArray(createResponse.data) ? (createResponse.data[0] || null) : null;
      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        session_id: created?.id || null,
        status: 'active',
      });
      return;
    }

    if (pathname === '/api/dboc/responses/submit') {
      if (request.method !== 'POST') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['POST']);
        return;
      }

      const payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
      if (!payload) {
        return;
      }
      const sessionId = String(payload.session_id || '').trim();
      const videoUrl = String(payload.video_url || '').trim();
      const transcriptText = typeof payload.transcript_text === 'string' ? payload.transcript_text : null;

      if (!sessionId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'session_id required' });
        return;
      }
      if (!videoUrl) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'video_url required' });
        return;
      }

      const sessionLookup = await fetchSupabaseTable(
        `dboc_iv_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,user_id,question_id,mode&limit=1`,
        { headers: buildDbocSupabaseHeaders(session) },
      );

      if (!sessionLookup.ok) {
        throw new Error(sessionLookup.error || 'session_lookup_failed');
      }

      const sessionRow = Array.isArray(sessionLookup.data) ? (sessionLookup.data[0] || null) : null;
      if (!sessionRow) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'session_id invalid' });
        return;
      }

      if (!dbocEnsureUserMatch(sessionRow.user_id, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const insertPayload = {
        session_id: sessionId,
        user_id: sessionUserId,
        question_id: String(payload.question_id || sessionRow.question_id || '').trim() || null,
        mode: String(payload.mode || sessionRow.mode || '').trim().toLowerCase() || null,
        video_url: videoUrl,
        transcript_text: transcriptText,
        submitted_at: new Date().toISOString(),
      };

      const postResponsePayload = async (payloadToInsert) => fetchSupabaseTable('dboc_iv_responses?select=id', {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
          ...buildDbocSupabaseHeaders(session, true),
        },
        body: JSON.stringify(payloadToInsert),
      });

      let submitResponse = await postResponsePayload(insertPayload);
      if (!submitResponse.ok) {
        const errorMessage = String(submitResponse.error || '').toLowerCase();
        const fallbackNeeded = isDbocQuestionIdColumnMissing(errorMessage) || isDbocModeColumnMissing(errorMessage);
        if (fallbackNeeded) {
          const fallbackPayload = {
            session_id: sessionId,
            user_id: sessionUserId,
            video_url: videoUrl,
            transcript_text: transcriptText,
            submitted_at: insertPayload.submitted_at,
          };
          submitResponse = await postResponsePayload(fallbackPayload);
        }
      }

      if (!submitResponse.ok) {
        throw new Error(submitResponse.error || 'response_submit_failed');
      }

      const submitted = Array.isArray(submitResponse.data) ? (submitResponse.data[0] || null) : null;
      void refreshDbocUserProgress(sessionUserId, session).catch((error) => {
        console.warn('[DBOC] progress_refresh_failed', error instanceof Error ? error.message : error);
      });
      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        response_id: submitted?.id || null,
        status: 'submitted',
      });
      return;
    }

    if (pathname === '/api/dboc/transcribe') {
      if (request.method !== 'POST') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['POST']);
        return;
      }

      const payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
      if (!payload) {
        return;
      }

      const responseId = String(payload.response_id || '').trim();
      const videoUrl = String(payload.video_url || '').trim();

      if (!responseId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id required' });
        return;
      }
      if (!videoUrl) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'video_url required' });
        return;
      }

      const responseLookup = await fetchSupabaseTable(
        `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id,user_id,session_id&limit=1`,
        { headers: buildDbocSupabaseHeaders(session) },
      );
      if (!responseLookup.ok) {
        throw new Error(responseLookup.error || 'transcribe_response_lookup_failed');
      }

      const responseRow = Array.isArray(responseLookup.data) ? (responseLookup.data[0] || null) : null;
      if (!responseRow) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id invalid' });
        return;
      }
      if (!dbocEnsureUserMatch(responseRow.user_id, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      let sessionMode = 'quick_rep';
      const linkedSessionId = String(responseRow.session_id || '').trim();
      if (linkedSessionId) {
        const modeLookup = await fetchSupabaseTable(
          `dboc_iv_sessions?id=eq.${encodeURIComponent(linkedSessionId)}&select=mode&limit=1`,
          { headers: buildDbocSupabaseHeaders(session) },
        );
        if (modeLookup.ok) {
          const modeRow = Array.isArray(modeLookup.data) ? (modeLookup.data[0] || null) : null;
          sessionMode = String(modeRow?.mode || '').trim().toLowerCase() || 'quick_rep';
        }
      }

      const jobId = randomUUID();
      DBOC_TRANSCRIBE_QUEUE.push({
        job_id: jobId,
        response_id: responseId,
        video_url: videoUrl,
        user_id: sessionUserId,
        wp_authorization: String(session?.wpAuthorization || '').trim(),
        status: 'queued',
        queued_at: new Date().toISOString(),
        attempts: 0,
        mode: sessionMode,
      });
      setDbocTranscriptionStatus(responseId, 'queued');
      emitDbocTranscriptionEvent('queued', {
        response_id: responseId,
        job_id: jobId,
        status: 'queued',
      });
      void updateDbocResponseTranscriptionStatus({
        response_id: responseId,
        wp_authorization: String(session?.wpAuthorization || '').trim(),
      }, 'queued').catch((error) => {
        console.warn('[DBOC] transcription_queue_status_persist_failed', error instanceof Error ? error.message : error);
      });

      void runDbocTranscribeWorkerTick();

      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        job_id: jobId,
        status: 'queued',
      });
      return;
    }

    if (pathname === '/api/dboc/encode') {
      if (request.method !== 'POST') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['POST']);
        return;
      }

      const payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
      if (!payload) {
        return;
      }

      const responseId = String(payload.response_id || '').trim();
      const videoUrlFromPayload = String(payload.video_url || '').trim();

      if (!responseId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id required' });
        return;
      }

      const responseLookup = await fetchSupabaseTable(
        `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id,user_id,video_url,transcript_text,session_id&limit=1`,
        { headers: buildDbocSupabaseHeaders(session) },
      );
      if (!responseLookup.ok) {
        throw new Error(responseLookup.error || 'encode_response_lookup_failed');
      }

      const responseRow = Array.isArray(responseLookup.data) ? (responseLookup.data[0] || null) : null;
      if (!responseRow) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id invalid' });
        return;
      }
      if (!dbocEnsureUserMatch(responseRow.user_id, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const videoUrl = videoUrlFromPayload || String(responseRow.video_url || '').trim();
      if (!videoUrl) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'video_url required' });
        return;
      }

      let sessionMode = 'quick_rep';
      const linkedSessionId = String(responseRow.session_id || '').trim();
      if (linkedSessionId) {
        const modeLookup = await fetchSupabaseTable(
          `dboc_iv_sessions?id=eq.${encodeURIComponent(linkedSessionId)}&select=mode&limit=1`,
          { headers: buildDbocSupabaseHeaders(session) },
        );
        if (modeLookup.ok) {
          const modeRow = Array.isArray(modeLookup.data) ? (modeLookup.data[0] || null) : null;
          sessionMode = String(modeRow?.mode || '').trim().toLowerCase() || 'quick_rep';
        }
      }

      const existingJob = DBOC_ENCODE_QUEUE.find((job) => {
        if (String(job?.response_id || '').trim() !== responseId) {
          return false;
        }
        const status = normalizeDbocEncodeStatus(job.status);
        return status === 'queued' || status === 'processing';
      });

      if (existingJob) {
        sendDbocJson(response, request, pathname, sessionUserId, 200, {
          job_id: existingJob.job_id,
          status: normalizeDbocEncodeStatus(existingJob.status) || 'queued',
        });
        return;
      }

      const jobId = randomUUID();
      DBOC_ENCODE_QUEUE.push({
        job_id: jobId,
        response_id: responseId,
        video_url: videoUrl,
        user_id: sessionUserId,
        wp_authorization: String(session?.wpAuthorization || '').trim(),
        status: 'queued',
        queued_at: new Date().toISOString(),
        attempts: 0,
        mode: sessionMode,
        has_transcript: Boolean(String(responseRow.transcript_text || '').trim()),
      });
      setDbocEncodeStatus(responseId, 'queued');
      emitDbocEncodeEvent('queued', {
        response_id: responseId,
        job_id: jobId,
        status: 'queued',
      });
      void updateDbocResponseEncodeStatus({
        response_id: responseId,
        wp_authorization: String(session?.wpAuthorization || '').trim(),
      }, 'queued').catch((error) => {
        console.warn('[DBOC] encode_queue_status_persist_failed', error instanceof Error ? error.message : error);
      });

      void runDbocEncodeWorkerTick();

      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        job_id: jobId,
        status: 'queued',
      });
      return;
    }

    if (pathname === '/api/dboc/metrics') {
      if (request.method !== 'POST') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['POST']);
        return;
      }

      const payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
      if (!payload) {
        return;
      }
      const responseId = String(payload.response_id || '').trim();
      const videoUrlFromPayload = String(payload.video_url || '').trim();
      const force = Boolean(payload.force);

      if (!responseId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id required' });
        return;
      }

      const responseLookup = await fetchSupabaseTable(
        `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id,user_id,video_url,session_id&limit=1`,
        { headers: buildDbocSupabaseHeaders(session) },
      );
      if (!responseLookup.ok) {
        throw new Error(responseLookup.error || 'metrics_response_lookup_failed');
      }
      const responseRow = Array.isArray(responseLookup.data) ? (responseLookup.data[0] || null) : null;
      if (!responseRow) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id invalid' });
        return;
      }
      if (!dbocEnsureUserMatch(responseRow.user_id, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      let sessionMode = 'quick_rep';
      const sessionId = String(responseRow.session_id || '').trim();
      if (sessionId) {
        const sessionLookup = await fetchSupabaseTable(
          `dboc_iv_sessions?id=eq.${encodeURIComponent(sessionId)}&select=mode&limit=1`,
          { headers: buildDbocSupabaseHeaders(session) },
        );
        if (sessionLookup.ok) {
          const sessionRow = Array.isArray(sessionLookup.data) ? (sessionLookup.data[0] || null) : null;
          sessionMode = String(sessionRow?.mode || sessionMode).trim().toLowerCase() || 'quick_rep';
        }
      }

      const videoUrl = videoUrlFromPayload || String(responseRow.video_url || '').trim();
      if (!videoUrl) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'video_url required' });
        return;
      }

      const existingJob = DBOC_METRICS_QUEUE.find((job) => {
        if (String(job?.response_id || '').trim() !== responseId) {
          return false;
        }
        const status = normalizeDbocMetricsStatus(job.status);
        return status === 'queued' || status === 'processing';
      });
      if (existingJob) {
        sendDbocJson(response, request, pathname, sessionUserId, 200, {
          job_id: existingJob.job_id,
          status: normalizeDbocMetricsStatus(existingJob.status) || 'queued',
        });
        return;
      }

      const queuedJob = enqueueDbocMetricsJob({
        responseId,
        videoUrl,
        userId: sessionUserId,
        wpAuthorization: String(session?.wpAuthorization || '').trim(),
        mode: sessionMode,
        force,
      });

      const currentStatus = normalizeDbocMetricsStatus(DBOC_METRICS_STATUS_BY_RESPONSE.get(responseId));
      if (!queuedJob) {
        sendDbocJson(response, request, pathname, sessionUserId, 200, {
          job_id: null,
          status: currentStatus || 'completed',
        });
        return;
      }

      void runDbocMetricsWorkerTick();
      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        job_id: queuedJob.job_id,
        status: 'queued',
      });
      return;
    }

    if (pathname === '/api/dboc/responses/list') {
      if (request.method !== 'GET') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['GET']);
        return;
      }

      const userId = normalizeDbocUserId(searchParams.get('user_id') || '');
      if (!userId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'user_id required' });
        return;
      }
      if (!dbocEnsureUserMatch(userId, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const responsesResult = await fetchDbocResponsesByUser(userId, session, 1000);
      if (!responsesResult.ok) {
        throw new Error(responsesResult.error || 'responses_list_failed');
      }

      const responses = Array.isArray(responsesResult.data) ? responsesResult.data : [];
      if (!responses.length) {
        sendDbocJson(response, request, pathname, sessionUserId, 200, []);
        return;
      }

      const responseIds = responses.map((row) => row.id).filter(Boolean);
      const sessionIds = responses.map((row) => row.session_id).filter(Boolean);

      const sessionsFilter = buildDbocInFilter(sessionIds);
      const responseFilter = buildDbocInFilter(responseIds);

      const sessionsResult = sessionsFilter
        ? await fetchSupabaseTable(`dboc_iv_sessions?id=${sessionsFilter}&select=id,question_id,mode`, { headers: buildDbocSupabaseHeaders(session) })
        : { ok: true, data: [] };
      if (!sessionsResult.ok) {
        throw new Error(sessionsResult.error || 'responses_session_join_failed');
      }

      const sessions = Array.isArray(sessionsResult.data) ? sessionsResult.data : [];
      const responseQuestionIds = responses.map((row) => String(row.question_id || '').trim()).filter(Boolean);
      const questionIds = [
        ...new Set([
          ...sessions.map((row) => String(row.question_id || '').trim()).filter(Boolean),
          ...responseQuestionIds,
        ]),
      ];
      const questionsFilter = buildDbocInFilter(questionIds);

      const questionsResult = questionsFilter
        ? await fetchSupabaseTable(`dboc_iv_questions?id=${questionsFilter}&select=id,text`, { headers: buildDbocSupabaseHeaders(session) })
        : { ok: true, data: [] };
      if (!questionsResult.ok) {
        throw new Error(questionsResult.error || 'responses_question_join_failed');
      }

      const metricsResult = responseFilter
        ? await fetchSupabaseTable(
          `dboc_iv_response_metrics?response_id=${responseFilter}&select=response_id,pitch_sd,volume_rms,wpm,filler_count,pause_count`,
          { headers: buildDbocSupabaseHeaders(session) },
        )
        : { ok: true, data: [] };
      if (!metricsResult.ok) {
        throw new Error(metricsResult.error || 'responses_metrics_join_failed');
      }

      const safResult = responseFilter
        ? await fetchSupabaseTable(
          `dboc_iv_saf_analysis?response_id=${responseFilter}&select=response_id,s_score,a_reasons,f_focus,e_closing,feedback_text`,
          { headers: buildDbocSupabaseHeaders(session) },
        )
        : { ok: true, data: [] };
      if (!safResult.ok) {
        throw new Error(safResult.error || 'responses_saf_join_failed');
      }

      const sessionById = new Map(sessions.map((row) => [row.id, row]));
      const questionById = new Map((Array.isArray(questionsResult.data) ? questionsResult.data : []).map((row) => [row.id, row]));
      const metricsByResponseId = new Map((Array.isArray(metricsResult.data) ? metricsResult.data : []).map((row) => [row.response_id, row]));
      const safByResponseId = new Map((Array.isArray(safResult.data) ? safResult.data : []).map((row) => [row.response_id, row]));

      const output = responses.map((item) => {
        const linkedSession = sessionById.get(item.session_id) || {};
        const resolvedQuestionId = String(item.question_id || linkedSession.question_id || '').trim();
        const linkedQuestion = questionById.get(resolvedQuestionId) || {};
        const metrics = metricsByResponseId.get(item.id) || null;
        const saf = safByResponseId.get(item.id) || null;
        const resolvedMode = String(item.mode || linkedSession.mode || '').trim().toLowerCase();

        return {
          response_id: item.id,
          question_id: resolvedQuestionId || null,
          question_text: linkedQuestion.text || '',
          mode: resolvedMode || '',
          transcription_status: deriveDbocTranscriptionStatus(item) || null,
          metrics_status: normalizeDbocMetricsStatus(DBOC_METRICS_STATUS_BY_RESPONSE.get(item.id)) || null,
          transcript_text: String(item.transcript_text || '').trim() || null,
          video_url: String(item.video_url || '').trim() || null,
          saf_scores: saf ? {
            s_score: saf.s_score ?? 0,
            a_reasons: saf.a_reasons ?? 0,
            f_focus: saf.f_focus ?? 0,
            e_closing: saf.e_closing ?? 0,
            feedback_text: saf.feedback_text || '',
          } : null,
          saf_overall: deriveDbocSafOverall(saf),
          metrics: metrics ? {
            pitch_sd: metrics.pitch_sd ?? null,
            volume_rms: metrics.volume_rms ?? null,
            wpm: metrics.wpm ?? null,
            filler_count: metrics.filler_count ?? null,
            pause_count: metrics.pause_count ?? null,
          } : null,
          delivery_insights: metrics ? buildDeliveryInsights(metrics, resolvedMode || '') : [],
          submitted_at: item.submitted_at || item.created_at || null,
        };
      });

      sendDbocJson(response, request, pathname, sessionUserId, 200, output);
      return;
    }

    if (pathname === '/api/dboc/upload-url') {
      if (request.method !== 'POST') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['POST']);
        return;
      }

      const payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
      if (!payload) {
        return;
      }
      const userId = normalizeDbocUserId(payload.user_id);
      const filename = String(payload.filename || '').trim();

      if (!userId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'user_id required' });
        return;
      }
      if (!filename) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'filename required' });
        return;
      }
      if (!dbocEnsureUserMatch(userId, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const signed = buildDbocUploadUrl(userId, filename);
      sendDbocJson(response, request, pathname, sessionUserId, 200, signed);
      return;
    }

    if (pathname === '/api/dboc/saf/analyze') {
      if (request.method !== 'POST') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['POST']);
        return;
      }

      const payload = await readDbocJsonBodyOrRespond(request, response, pathname, sessionUserId);
      if (!payload) {
        return;
      }
      const responseId = String(payload.response_id || '').trim();
      const transcriptText = String(payload.transcript_text || '').trim();

      if (!responseId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id required' });
        return;
      }
      if (!transcriptText) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'transcript_text required' });
        return;
      }

      let responseLookup = await fetchSupabaseTable(
        `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id,user_id,question_id,session_id&limit=1`,
        { headers: buildDbocSupabaseHeaders(session) },
      );

      if (!responseLookup.ok) {
        const errorMessage = String(responseLookup.error || '').toLowerCase();
        if (isDbocQuestionIdColumnMissing(errorMessage)) {
          responseLookup = await fetchSupabaseTable(
            `dboc_iv_responses?id=eq.${encodeURIComponent(responseId)}&select=id,user_id,session_id&limit=1`,
            { headers: buildDbocSupabaseHeaders(session) },
          );
        }
      }

      if (!responseLookup.ok) {
        throw new Error(responseLookup.error || 'response_lookup_failed');
      }

      const responseRow = Array.isArray(responseLookup.data) ? (responseLookup.data[0] || null) : null;
      if (!responseRow) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'response_id invalid' });
        return;
      }
      if (!dbocEnsureUserMatch(responseRow.user_id, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      let resolvedQuestionId = String(responseRow.question_id || '').trim();
      if (!resolvedQuestionId) {
        const linkedSessionId = String(responseRow.session_id || '').trim();
        if (linkedSessionId) {
          const sessionLookup = await fetchSupabaseTable(
            `dboc_iv_sessions?id=eq.${encodeURIComponent(linkedSessionId)}&select=question_id&limit=1`,
            { headers: buildDbocSupabaseHeaders(session) },
          );
          if (sessionLookup.ok) {
            const sessionRow = Array.isArray(sessionLookup.data) ? (sessionLookup.data[0] || null) : null;
            resolvedQuestionId = String(sessionRow?.question_id || '').trim();
          }
        }
      }

      const analysis = await persistDbocSafAnalysis(responseId, transcriptText, session);
      await upsertDbocAnswerVaultEntry({
        userId: String(responseRow.user_id || '').trim(),
        questionId: resolvedQuestionId,
        transcriptText,
        feedbackText: String(analysis?.feedback_text || '').trim(),
        session,
      });
      sendDbocJson(response, request, pathname, sessionUserId, 200, analysis);
      return;
    }

    if (pathname === '/api/dboc/progress/get') {
      if (request.method !== 'GET') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['GET']);
        return;
      }

      const userId = normalizeDbocUserId(searchParams.get('user_id') || '');
      if (!userId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'user_id required' });
        return;
      }
      if (!dbocEnsureUserMatch(userId, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const progressResult = await fetchSupabaseTable(
        `dboc_iv_user_progress?user_id=eq.${encodeURIComponent(userId)}&select=total_reps,categories_covered,last_rep_at&limit=1`,
        { headers: buildDbocSupabaseHeaders(session) },
      );
      if (!progressResult.ok) {
        throw new Error(progressResult.error || 'progress_get_failed');
      }

      const progressRow = Array.isArray(progressResult.data) ? (progressResult.data[0] || null) : null;

      const responseHistory = await fetchSupabaseTable(
        `dboc_iv_responses?user_id=eq.${encodeURIComponent(userId)}&select=created_at&order=created_at.desc&limit=365`,
        { headers: buildDbocSupabaseHeaders(session) },
      );
      if (!responseHistory.ok) {
        throw new Error(responseHistory.error || 'progress_history_failed');
      }

      const responseRows = Array.isArray(responseHistory.data) ? responseHistory.data : [];
      const streak = computeDbocStreak(responseRows);

      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        total_reps: Number(progressRow?.total_reps ?? responseRows.length ?? 0),
        categories_covered: Array.isArray(progressRow?.categories_covered) ? progressRow.categories_covered : [],
        last_rep_at: progressRow?.last_rep_at || responseRows[0]?.created_at || null,
        streak,
      });
      return;
    }

    if (pathname === '/api/dboc/vault/timeline') {
      if (request.method !== 'GET') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['GET']);
        return;
      }

      const userId = normalizeDbocUserId(searchParams.get('user_id') || '');
      const questionId = String(searchParams.get('question_id') || '').trim();
      if (!userId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'user_id required' });
        return;
      }
      if (!questionId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'question_id required' });
        return;
      }
      if (!dbocEnsureUserMatch(userId, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      const allResponsesResult = await fetchDbocResponsesByUser(userId, session, 2000);
      if (!allResponsesResult.ok) {
        throw new Error(allResponsesResult.error || 'vault_timeline_responses_failed');
      }
      const allResponses = Array.isArray(allResponsesResult.data) ? allResponsesResult.data : [];

      const responseSessionIds = allResponses.map((row) => String(row.session_id || '').trim()).filter(Boolean);
      const sessionsFilter = buildDbocInFilter(responseSessionIds);
      const sessionsResult = sessionsFilter
        ? await fetchSupabaseTable(`dboc_iv_sessions?id=${sessionsFilter}&select=id,question_id,mode`, { headers: buildDbocSupabaseHeaders(session) })
        : { ok: true, data: [] };
      if (!sessionsResult.ok) {
        throw new Error(sessionsResult.error || 'vault_timeline_sessions_failed');
      }
      const sessionById = new Map((Array.isArray(sessionsResult.data) ? sessionsResult.data : []).map((row) => [String(row.id || '').trim(), row]));

      const filtered = allResponses.filter((row) => {
        const directQuestionId = String(row.question_id || '').trim();
        if (directQuestionId && directQuestionId === questionId) {
          return true;
        }
        const sessionRow = sessionById.get(String(row.session_id || '').trim()) || null;
        return String(sessionRow?.question_id || '').trim() === questionId;
      });

      if (!filtered.length) {
        sendDbocJson(response, request, pathname, sessionUserId, 200, {
          question_id: questionId,
          timeline: [],
          then_vs_now: null,
          gold_answer: {
            locked: true,
            reason: 'record_at_least_one_answer',
            data: null,
          },
          teaching_suggestion: null,
        });
        return;
      }

      const responseIds = filtered.map((row) => String(row.id || '').trim()).filter(Boolean);
      const responseFilter = buildDbocInFilter(responseIds);

      const metricsResult = responseFilter
        ? await fetchSupabaseTable(
          `dboc_iv_response_metrics?response_id=${responseFilter}&select=response_id,pitch_sd,volume_rms,wpm,filler_count,pause_count`,
          { headers: buildDbocSupabaseHeaders(session) },
        )
        : { ok: true, data: [] };
      if (!metricsResult.ok) {
        throw new Error(metricsResult.error || 'vault_timeline_metrics_failed');
      }
      const safResult = responseFilter
        ? await fetchSupabaseTable(
          `dboc_iv_saf_analysis?response_id=${responseFilter}&select=response_id,s_score,a_reasons,f_focus,e_closing,feedback_text`,
          { headers: buildDbocSupabaseHeaders(session) },
        )
        : { ok: true, data: [] };
      if (!safResult.ok) {
        throw new Error(safResult.error || 'vault_timeline_saf_failed');
      }

      const metricsByResponse = new Map((Array.isArray(metricsResult.data) ? metricsResult.data : []).map((row) => [String(row.response_id || '').trim(), row]));
      const safByResponse = new Map((Array.isArray(safResult.data) ? safResult.data : []).map((row) => [String(row.response_id || '').trim(), row]));

      const timeline = filtered
        .map((row) => {
          const sessionRow = sessionById.get(String(row.session_id || '').trim()) || null;
          const responseId = String(row.id || '').trim();
          const saf = safByResponse.get(responseId) || null;
          const metrics = metricsByResponse.get(responseId) || null;
          const resolvedMode = String(row.mode || sessionRow?.mode || '').trim().toLowerCase();
          return {
            response_id: responseId || null,
            session_id: String(row.session_id || '').trim() || null,
            question_id: questionId,
            mode: resolvedMode || null,
            video_url: String(row.video_url || '').trim() || null,
            transcript_text: String(row.transcript_text || '').trim() || null,
            saf_scores: saf ? {
              s_score: saf.s_score ?? 0,
              a_reasons: saf.a_reasons ?? 0,
              f_focus: saf.f_focus ?? 0,
              e_closing: saf.e_closing ?? 0,
              feedback_text: saf.feedback_text || '',
            } : null,
            saf_overall: deriveDbocSafOverall(saf),
            metrics: metrics ? {
              pitch_sd: metrics.pitch_sd ?? null,
              volume_rms: metrics.volume_rms ?? null,
              wpm: metrics.wpm ?? null,
              filler_count: metrics.filler_count ?? null,
              pause_count: metrics.pause_count ?? null,
            } : null,
            delivery_insights: metrics ? buildDeliveryInsights(metrics, resolvedMode || '') : [],
            submitted_at: row.submitted_at || row.created_at || null,
          };
        })
        .sort((left, right) => new Date(left.submitted_at || 0).getTime() - new Date(right.submitted_at || 0).getTime());

      const first = timeline[0] || null;
      const latest = timeline[timeline.length - 1] || null;
      let improvement = null;
      if (first && latest && first.saf_overall && latest.saf_overall && first.saf_overall !== latest.saf_overall) {
        improvement = `Improved from ${first.saf_overall} to ${latest.saf_overall}`;
      }

      let goldAnswer = {
        locked: false,
        reason: null,
        data: null,
      };
      try {
        const goldResult = await fetchSupabaseTable(
          `dboc_iv_gold_answers?question_id=eq.${encodeURIComponent(questionId)}&select=*&order=created_at.desc&limit=1`,
          { headers: buildDbocSupabaseHeaders(session) },
        );
        if (goldResult.ok && Array.isArray(goldResult.data) && goldResult.data[0]) {
          goldAnswer.data = mapDbocGoldAnswer(goldResult.data[0]);
        }
      } catch (error) {
        console.warn('[DBOC] vault_timeline_gold_lookup_failed', error instanceof Error ? error.message : error);
      }

      const missStreak = computeDbocConsecutiveSkillMiss(timeline);
      let teachingSuggestion = null;
      if (missStreak.skill_tag && missStreak.count >= 3) {
        const teachingRow = await fetchDbocTeachingVideoSuggestion(missStreak.skill_tag, questionId, session);
        if (teachingRow) {
          teachingSuggestion = {
            skill_tag: missStreak.skill_tag,
            miss_count: missStreak.count,
            title: String(teachingRow.title || '').trim() || 'Quick tip video',
            video_url: String(teachingRow.video_url || '').trim() || null,
            duration_sec: Number(teachingRow.duration_sec || teachingRow.duration_seconds || teachingRow.duration || 0) || null,
            message: `Having trouble with ${missStreak.skill_tag}? Here's a quick tip:`,
          };
        }
      }

      sendDbocJson(response, request, pathname, sessionUserId, 200, {
        question_id: questionId,
        timeline: [...timeline].sort((left, right) => new Date(right.submitted_at || 0).getTime() - new Date(left.submitted_at || 0).getTime()),
        then_vs_now: first && latest ? {
          first,
          latest,
          improvement,
        } : null,
        gold_answer: goldAnswer,
        teaching_suggestion: teachingSuggestion,
      });
      return;
    }

    if (pathname === '/api/dboc/vault/get') {
      if (request.method !== 'GET') {
        sendDbocMethodNotAllowed(response, request, pathname, sessionUserId, ['GET']);
        return;
      }

      const userId = normalizeDbocUserId(searchParams.get('user_id') || '');
      const category = String(searchParams.get('category') || searchParams.get('category_filter') || '').trim();

      if (!userId) {
        sendDbocJson(response, request, pathname, sessionUserId, 400, { error: 'user_id required' });
        return;
      }
      if (!dbocEnsureUserMatch(userId, sessionUserId)) {
        sendDbocJson(response, request, pathname, sessionUserId, 401, { error: 'unauthorized' });
        return;
      }

      let vaultPath = `dboc_iv_answer_vault?user_id=eq.${encodeURIComponent(userId)}&select=question_id,summary,notes,category,created_at&order=created_at.desc`;
      if (category) {
        vaultPath += `&category=eq.${encodeURIComponent(category)}`;
      }

      const vaultResult = await fetchSupabaseTable(vaultPath, {
        headers: buildDbocSupabaseHeaders(session),
      });
      if (!vaultResult.ok) {
        throw new Error(vaultResult.error || 'vault_get_failed');
      }

      const rows = Array.isArray(vaultResult.data) ? vaultResult.data : [];
      sendDbocJson(response, request, pathname, sessionUserId, 200, rows.map((row) => ({
        question_id: row.question_id || null,
        summary: row.summary || '',
        notes: row.notes || '',
        category: row.category || null,
        created_at: row.created_at || null,
      })));
      return;
    }

    sendDbocJson(response, request, pathname, sessionUserId, 404, {
      error: 'not_found',
      message: `No DBOC route matched ${pathname}.`,
    });
  } catch (error) {
    console.error('[DBOC] route_error', pathname, error);
    sendDbocJson(response, request, pathname, sessionUserId, 500, { error: 'internal_error' });
  }
}

async function fetchJson(target, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 6000);

  try {
    const response = await fetch(target, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: extractRemoteError(data, text, response.status),
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      status: 503,
      error: error instanceof Error ? error.message : 'Network error.',
    };
  }
}

function extractRemoteError(data, text, status) {
  if (data && typeof data === 'object') {
    const parts = [
      data.message,
      data.error_description,
      data.error?.message,
      data.error,
      data.detail,
      data.msg,
      data.code && data.msg ? `${data.code}: ${data.msg}` : '',
      typeof data.raw === 'string' ? data.raw.slice(0, 300) : '',
    ];
    const first = parts.find((value) => String(value || '').trim() !== '');
    return first ? String(first).trim() : `Request failed with HTTP ${status}.`;
  }

  return String(text || `Request failed with HTTP ${status}.`);
}

function logDataBridge(label, details = {}) {
  const parts = [`MissionMed HQ data: ${label}`];

  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    parts.push(`${key}=${value}`);
  }

  console.log(parts.join(' | '));
}

function logDataResolution(label, payload) {
  logDataBridge(label, {
    mode: payload?.mode || 'unknown',
    bridge: payload?.bridge || 'unknown',
    transport: payload?.transport || '',
    target: payload?.target || '',
    items: Array.isArray(payload?.items) ? payload.items.length : undefined,
    student: payload?.student?.id || '',
    error: payload?.error || '',
  });

  return payload;
}

function getWordPressAuthMode(session = null) {
  if (session?.authSource) {
    return session.authSource;
  }
  if (CONFIG.wpBearerToken) {
    return 'bearer';
  }
  if (CONFIG.wpUsername && CONFIG.wpAppPassword) {
    return 'app-password';
  }
  return 'anonymous';
}

function getWordPressHeaders(session = null) {
  if (session?.wpAuthorization) {
    return {
      Authorization: session.wpAuthorization,
    };
  }

  if (CONFIG.wpBearerToken) {
    return {
      Authorization: `Bearer ${CONFIG.wpBearerToken}`,
    };
  }

  if (CONFIG.wpUsername && CONFIG.wpAppPassword) {
    return {
      Authorization: `Basic ${Buffer.from(`${CONFIG.wpUsername}:${CONFIG.wpAppPassword}`).toString('base64')}`,
    };
  }

  return {};
}

function getWordPressServiceHeaders(session = null) {
  if (CONFIG.wpBearerToken) {
    return {
      Authorization: `Bearer ${CONFIG.wpBearerToken}`,
    };
  }

  if (CONFIG.wpUsername && CONFIG.wpAppPassword) {
    return {
      Authorization: `Basic ${Buffer.from(`${CONFIG.wpUsername}:${CONFIG.wpAppPassword}`).toString('base64')}`,
    };
  }

  return getWordPressHeaders(session);
}

function buildWordPressUrl(relativePath, searchParams = null) {
  const base = `${CONFIG.wpBase}/wp-json/${CONFIG.wpNamespace}${relativePath}`;
  if (!searchParams || [...searchParams.keys()].length === 0) {
    return base;
  }
  return `${base}?${searchParams.toString()}`;
}

function buildWordPressCoreUrl(relativePath, searchParams = null) {
  const base = `${CONFIG.wpBase}/wp-json${relativePath}`;
  if (!searchParams || [...searchParams.keys()].length === 0) {
    return base;
  }
  return `${base}?${searchParams.toString()}`;
}

async function fetchWordPress(relativePath, searchParams = null, session = null, options = {}) {
  if (!CONFIG.wpBase) {
    return {
      ok: false,
      status: 400,
      error: 'MMHQ_WP_BASE is not configured.',
    };
  }

  return fetchJson(buildWordPressUrl(relativePath, searchParams), {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...getWordPressHeaders(session),
      ...(options.headers || {}),
    },
    body: options.body,
    timeoutMs: 6500,
  });
}

async function fetchWordPressService(relativePath, searchParams = null, session = null, options = {}) {
  if (!CONFIG.wpBase) {
    return {
      ok: false,
      status: 400,
      error: 'MMHQ_WP_BASE is not configured.',
    };
  }

  return fetchJson(buildWordPressUrl(relativePath, searchParams), {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...getWordPressServiceHeaders(session),
      ...(options.headers || {}),
    },
    body: options.body,
    timeoutMs: 6500,
  });
}

async function fetchWordPressCore(relativePath, searchParams = null, authorization = '') {
  if (!CONFIG.wpBase) {
    return {
      ok: false,
      status: 400,
      error: 'MMHQ_WP_BASE is not configured.',
    };
  }

  const headers = {
    Accept: 'application/json',
  };

  if (authorization) {
    headers.Authorization = authorization;
  }

  return fetchJson(buildWordPressCoreUrl(relativePath, searchParams), {
    headers,
    timeoutMs: 6500,
  });
}

function getSupabaseToken() {
  return CONFIG.supabaseKey || CONFIG.supabaseServiceRoleKey || CONFIG.supabaseAnonKey;
}

function getSupabaseRpcHeaders({ includeContentType = false } = {}) {
  const token = getSupabaseToken();
  const headers = {
    Accept: 'application/json',
    'Accept-Profile': 'public',
    apikey: token,
    Authorization: `Bearer ${token}`,
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Profile'] = 'public';
  }

  return headers;
}

async function fetchSupabaseRpc(functionName, payload = {}) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return {
      ok: false,
      status: 400,
      error: 'Supabase bridge is not configured.',
    };
  }

  return fetchJson(`${CONFIG.supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: getSupabaseRpcHeaders({ includeContentType: true }),
    body: JSON.stringify(payload),
    timeoutMs: 6500,
  });
}

async function supabaseFetch(functionName, payload = {}) {
  return fetchSupabaseRpc(functionName, payload);
}

function getCieHeaders() {
  const headers = {
    Accept: 'application/json',
  };

  if (CONFIG.cieBearerToken) {
    headers.Authorization = `Bearer ${CONFIG.cieBearerToken}`;
  }

  return headers;
}

async function fetchCie(relativePath, options = {}) {
  if (!CONFIG.cieBase) {
    return {
      ok: false,
      status: 400,
      error: 'CIE bridge is not configured.',
    };
  }

  if (!CONFIG.cieBearerToken) {
    const requestUrl = `${CONFIG.cieBase}${relativePath}`;
    console.error(`[MMHQ-CIE-AUTH-ERROR] request_url=${requestUrl} status=400 auth_header_present=no code=token_missing detail=MMHQ_CIE_BEARER_TOKEN is not configured`);
    return {
      ok: false,
      status: 400,
      error: 'MMHQ_CIE_BEARER_TOKEN is not configured. Set it to the same value as CIE_API_TOKEN.',
    };
  }

  const requestUrl = `${CONFIG.cieBase}${relativePath}`;
  const headers = {
    ...getCieHeaders(),
    ...(options.headers || {}),
    Authorization: `Bearer ${CONFIG.cieBearerToken}`,
  };
  const authHeaderPresent = Boolean(getHeaderAuthorizationValue(headers));
  console.log(`[MMHQ-CIE-DEBUG] request_url=${requestUrl} auth_header_present=${authHeaderPresent ? 'yes' : 'no'}`);

  const result = await fetchJson(requestUrl, {
    method: options.method || 'GET',
    headers,
    body: options.body,
    timeoutMs: options.timeoutMs || 5000,
  });

  const authErrorCode = normalizeMediaString(result?.data?.error || '');
  if (!result.ok && (result.status === 401 || result.status === 403 || authErrorCode.startsWith('auth_'))) {
    let hint = 'Verify HQ->CIE auth configuration.';
    if (authErrorCode === 'auth_token_invalid') {
      hint = 'Token mismatch. MMHQ_CIE_BEARER_TOKEN must exactly match CIE_API_TOKEN.';
    } else if (authErrorCode === 'auth_header_missing') {
      hint = 'Authorization header missing or malformed.';
    } else if (authErrorCode === 'auth_config_missing') {
      hint = 'CIE_API_TOKEN is missing on the CIE backend service.';
    }
    console.error(`[MMHQ-CIE-AUTH-ERROR] request_url=${requestUrl} status=${result.status || 0} auth_header_present=${authHeaderPresent ? 'yes' : 'no'} code=${authErrorCode || 'unknown'} detail=${result.error || 'Request failed'} hint=${hint}`);
  }

  return result;
}

function getStudioHeaders() {
  const headers = {
    Accept: 'application/json',
  };

  if (CONFIG.studioBearerToken) {
    headers.Authorization = `Bearer ${CONFIG.studioBearerToken}`;
  }

  return headers;
}

async function fetchStudio(relativePath, options = {}) {
  if (!CONFIG.studioBase) {
    return {
      ok: false,
      status: 400,
      error: 'Studio bridge is not configured.',
    };
  }

  return fetchJson(`${CONFIG.studioBase}${relativePath}`, {
    method: options.method || 'GET',
    headers: {
      ...getStudioHeaders(),
      ...(options.headers || {}),
    },
    body: options.body,
    timeoutMs: options.timeoutMs || 6500,
  });
}

function targetLabel(url) {
  if (!url) {
    return '';
  }

  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function resolveWordPressAuthEndpoint() {
  if (!CONFIG.wpBase || !CONFIG.wpAuthEndpoint) {
    return '';
  }

  if (CONFIG.wpAuthEndpoint.startsWith('http://') || CONFIG.wpAuthEndpoint.startsWith('https://')) {
    return CONFIG.wpAuthEndpoint;
  }

  const normalized = CONFIG.wpAuthEndpoint.startsWith('/') ? CONFIG.wpAuthEndpoint : `/${CONFIG.wpAuthEndpoint}`;
  return `${CONFIG.wpBase}${normalized}`;
}

function getSupabaseProjectRef(supabaseUrl = '') {
  try {
    const hostname = new URL(String(supabaseUrl || '')).hostname;
    const [projectRef = ''] = hostname.split('.');
    return String(projectRef || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function isAuthSupabaseProjectAllowed() {
  const ref = getSupabaseProjectRef(CONFIG.supabaseUrl);
  if (!ref) {
    return {
      ok: false,
      code: 'supabase_project_missing',
      message: 'MMHQ_SUPABASE_URL is not configured.',
    };
  }

  if (ref === AUTH_FORBIDDEN_SUPABASE_PROJECT) {
    return {
      ok: false,
      code: 'supabase_project_forbidden',
      message: `Deprecated Supabase project ${AUTH_FORBIDDEN_SUPABASE_PROJECT} is forbidden.`,
    };
  }

  if (ref !== AUTH_ALLOWED_SUPABASE_PROJECT) {
    return {
      ok: false,
      code: 'supabase_project_mismatch',
      message: `Supabase project mismatch. Expected ${AUTH_ALLOWED_SUPABASE_PROJECT}, found ${ref}.`,
    };
  }

  return {
    ok: true,
    ref,
  };
}

function getRequestCookieHeader(request = null) {
  const raw = request?.headers?.cookie || request?.headers?.Cookie || '';
  return String(raw || '').trim();
}

function hasWordPressSessionCookie(cookieHeader = '') {
  const normalized = String(cookieHeader || '');
  return AUTH_WORDPRESS_COOKIE_PREFIXES.some((prefix) => normalized.includes(prefix));
}

async function fetchWordPressUserFromCookieHeader(cookieHeader = '') {
  if (!CONFIG.wpBase) {
    return {
      ok: false,
      status: 503,
      error: 'wordpress_base_missing',
      detail: 'MMHQ_WP_BASE is not configured.',
    };
  }

  if (!hasWordPressSessionCookie(cookieHeader)) {
    return {
      ok: false,
      status: 401,
      error: 'wordpress_session_missing',
      detail: 'WordPress session cookie is missing.',
    };
  }

  const wpUser = await fetchJson(`${CONFIG.wpBase}/wp-json/wp/v2/users/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: cookieHeader,
    },
    timeoutMs: 8_000,
  });

  if (!wpUser.ok) {
    return {
      ok: false,
      status: wpUser.status === 401 ? 401 : 503,
      error: wpUser.status === 401 ? 'wordpress_session_invalid' : 'wordpress_validation_failed',
      detail: wpUser.error || 'WordPress user validation failed.',
    };
  }

  return {
    ok: true,
    status: 200,
    user: wpUser.data || {},
  };
}

function normalizeWordPressIdentityUser(user = {}, fallback = {}) {
  const normalized = normalizeWordPressUser(user);
  return {
    ...normalized,
    token: String(fallback.token || '').trim(),
  };
}

function toCanonicalIdentity(wordPressUser, source = 'wp_cookie') {
  const user = normalizeWordPressIdentityUser(wordPressUser);
  return {
    sub: `wp:${user.id}`,
    wp_user_id: Number(user.id || 0),
    email: String(user.email || '').trim(),
    roles: Array.isArray(user.roles) ? user.roles : [],
    source,
    issued_at: new Date().toISOString(),
  };
}

function deriveAuthBootstrapPassword(wpUserId, email) {
  return createHash('sha256')
    .update(`${AUTH_BOOTSTRAP_PASSWORD_SALT}:${wpUserId}:${String(email || '').toLowerCase()}`)
    .digest('hex');
}

function isSupabaseEmailProviderDisabled(detail = '') {
  const message = String(detail || '').toLowerCase();
  return message.includes('email_provider_disabled') || message.includes('email logins are disabled');
}

function extractMagicLinkTokenHash(payload = {}) {
  const directHash = String(payload?.hashed_token || payload?.properties?.hashed_token || payload?.data?.hashed_token || '').trim();
  if (directHash) return directHash;

  const actionLink = String(payload?.action_link || payload?.properties?.action_link || payload?.data?.action_link || '').trim();
  if (!actionLink) return '';

  try {
    const parsed = new URL(actionLink);
    return String(parsed.searchParams.get('token_hash') || '').trim();
  } catch {
    return '';
  }
}

async function signInSupabaseAuthUser(email, password) {
  const authApiKey = CONFIG.supabaseAnonKey || CONFIG.supabaseKey || CONFIG.supabaseServiceRoleKey;
  if (!CONFIG.supabaseUrl || !authApiKey) {
    return {
      ok: false,
      status: 503,
      error: 'supabase_not_configured',
      detail: 'Supabase auth token endpoint is not configured.',
    };
  }

  const signIn = await fetchJson(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: authApiKey,
    },
    body: JSON.stringify({ email, password }),
    timeoutMs: 9_000,
  });

  if (!signIn.ok) {
    return {
      ok: false,
      status: signIn.status || 502,
      error: 'supabase_signin_failed',
      detail: signIn.error || 'Supabase sign-in failed.',
    };
  }

  const accessToken = String(signIn.data?.access_token || '').trim();
  const refreshToken = String(signIn.data?.refresh_token || '').trim();
  if (!accessToken || !refreshToken) {
    return {
      ok: false,
      status: 502,
      error: 'supabase_tokens_missing',
      detail: 'Supabase sign-in succeeded but no session tokens were returned.',
    };
  }

  return {
    ok: true,
    status: 200,
    session: signIn.data,
  };
}

async function mintSupabaseSessionViaAdminMagicLink(email) {
  const adminToken = CONFIG.supabaseServiceRoleKey || CONFIG.supabaseKey;
  const authApiKey = CONFIG.supabaseAnonKey || CONFIG.supabaseKey || CONFIG.supabaseServiceRoleKey;

  if (!CONFIG.supabaseUrl || !adminToken || !authApiKey) {
    return {
      ok: false,
      status: 503,
      error: 'supabase_magiclink_not_configured',
      detail: 'Supabase magic-link bootstrap is not configured.',
    };
  }

  const generate = await fetchJson(`${CONFIG.supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: adminToken,
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      type: 'magiclink',
      email,
    }),
    timeoutMs: 9_000,
  });

  if (!generate.ok) {
    return {
      ok: false,
      status: generate.status || 502,
      error: 'supabase_magiclink_generate_failed',
      detail: generate.error || 'Supabase magic-link generation failed.',
    };
  }

  const tokenHash = extractMagicLinkTokenHash(generate.data || {});
  if (!tokenHash) {
    return {
      ok: false,
      status: 502,
      error: 'supabase_magiclink_token_missing',
      detail: 'Supabase magic-link response did not include token_hash.',
    };
  }

  const verify = await fetchJson(`${CONFIG.supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: authApiKey,
    },
    body: JSON.stringify({
      type: 'magiclink',
      token_hash: tokenHash,
    }),
    timeoutMs: 9_000,
  });

  if (!verify.ok) {
    return {
      ok: false,
      status: verify.status || 502,
      error: 'supabase_magiclink_verify_failed',
      detail: verify.error || 'Supabase magic-link verification failed.',
    };
  }

  const accessToken = String(verify.data?.access_token || '').trim();
  const refreshToken = String(verify.data?.refresh_token || '').trim();
  if (!accessToken || !refreshToken) {
    return {
      ok: false,
      status: 502,
      error: 'supabase_magiclink_tokens_missing',
      detail: 'Supabase magic-link verification succeeded but no session tokens were returned.',
    };
  }

  return {
    ok: true,
    status: 200,
    source: 'auth_bootstrap_magiclink',
    session: verify.data,
  };
}

async function findSupabaseAuthUserByEmail(email, adminToken) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: true, status: 200, user: null };
  }

  const perPage = 200;
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page += 1) {
    const query = `page=${page}&per_page=${perPage}&email=${encodeURIComponent(normalizedEmail)}`;
    const listUsers = await fetchJson(`${CONFIG.supabaseUrl}/auth/v1/admin/users?${query}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: adminToken,
        Authorization: `Bearer ${adminToken}`,
      },
      timeoutMs: 9_000,
    });

    if (!listUsers.ok) {
      return {
        ok: false,
        status: listUsers.status || 502,
        error: 'supabase_user_lookup_failed',
        detail: listUsers.error || 'Unable to list Supabase auth users.',
      };
    }

    const users = Array.isArray(listUsers.data?.users) ? listUsers.data.users : [];
    const matched = users.find((entry) => String(entry?.email || '').trim().toLowerCase() === normalizedEmail) || null;
    if (matched) {
      return { ok: true, status: 200, user: matched };
    }

    if (users.length < perPage) break;
  }

  return { ok: true, status: 200, user: null };
}

async function updateSupabaseAuthUserById(userId, payload, adminToken) {
  const normalizedId = String(userId || '').trim();
  if (!normalizedId) {
    return {
      ok: false,
      status: 422,
      error: 'supabase_user_update_invalid_id',
      detail: 'Supabase auth user id is required for update.',
    };
  }

  const updateUser = await fetchJson(`${CONFIG.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(normalizedId)}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: adminToken,
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload || {}),
    timeoutMs: 9_000,
  });

  if (!updateUser.ok) {
    return {
      ok: false,
      status: updateUser.status || 502,
      error: 'supabase_user_update_failed',
      detail: updateUser.error || 'Unable to update Supabase auth user.',
    };
  }

  return { ok: true, status: 200 };
}

async function ensureSupabaseAuthUser(email, password, session = null) {
  const adminToken = CONFIG.supabaseServiceRoleKey || CONFIG.supabaseKey;
  if (!CONFIG.supabaseUrl || !adminToken) {
    return {
      ok: false,
      status: 503,
      error: 'supabase_admin_unavailable',
      detail: 'Supabase admin user management credentials are not configured.',
    };
  }

  const metadata = {
    wp_user_id: Number(session?.user?.id || 0) || null,
    subject: Number(session?.user?.id || 0) ? `wp:${Number(session.user.id)}` : null,
    roles: Array.isArray(session?.user?.roles) ? session.user.roles : [],
    source: 'railway_auth_bootstrap',
    updated_at: new Date().toISOString(),
  };

  const existingLookup = await findSupabaseAuthUserByEmail(email, adminToken);
  if (!existingLookup.ok) {
    return {
      ok: false,
      status: existingLookup.status || 502,
      error: existingLookup.error || 'supabase_user_lookup_failed',
      detail: existingLookup.detail || 'Unable to resolve Supabase auth user.',
    };
  }

  if (existingLookup.user?.id) {
    const syncExisting = await updateSupabaseAuthUserById(existingLookup.user.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    }, adminToken);

    if (!syncExisting.ok) {
      return {
        ok: false,
        status: syncExisting.status || 502,
        error: syncExisting.error || 'supabase_user_sync_failed',
        detail: syncExisting.detail || 'Unable to sync Supabase auth user credentials.',
      };
    }

    return { ok: true, status: 200 };
  }

  const createUser = await fetchJson(`${CONFIG.supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: adminToken,
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
    timeoutMs: 9_000,
  });

  if (createUser.ok) {
    return { ok: true, status: 200 };
  }

  const message = String(createUser.error || '').toLowerCase();
  if (
    createUser.status === 409 ||
    createUser.status === 422 ||
    message.includes('already') ||
    message.includes('duplicate') ||
    message.includes('registered')
  ) {
    const retryLookup = await findSupabaseAuthUserByEmail(email, adminToken);
    if (retryLookup.ok && retryLookup.user?.id) {
      const syncRetry = await updateSupabaseAuthUserById(retryLookup.user.id, {
        password,
        email_confirm: true,
        user_metadata: metadata,
      }, adminToken);
      if (syncRetry.ok) {
        return { ok: true, status: 200 };
      }
      return {
        ok: false,
        status: syncRetry.status || 502,
        error: syncRetry.error || 'supabase_user_sync_failed',
        detail: syncRetry.detail || 'Unable to sync Supabase auth user after duplicate create.',
      };
    }

    return {
      ok: false,
      status: retryLookup.status || 502,
      error: retryLookup.error || 'supabase_user_lookup_failed',
      detail: retryLookup.detail || 'Supabase auth user was not found after duplicate create response.',
    };
  }

  return {
    ok: false,
    status: createUser.status || 502,
    error: 'supabase_user_ensure_failed',
    detail: createUser.error || 'Unable to create or resolve Supabase auth user.',
  };
}

async function exchangeWordPressAuth(payload = {}, request = null) {
  const cookieHeader = getRequestCookieHeader(request);
  const wpToken = String(payload.wpToken || payload.token || payload.bearerToken || '').trim();

  if (!wpToken && hasWordPressSessionCookie(cookieHeader)) {
    const cookieValidation = await fetchWordPressUserFromCookieHeader(cookieHeader);
    if (!cookieValidation.ok) {
      return {
        ok: false,
        status: cookieValidation.status || 401,
        error: cookieValidation.detail || 'WordPress session validation failed.',
      };
    }

    const wpUser = normalizeWordPressIdentityUser(cookieValidation.user || {});
    if (!isAuthorizedWordPressUser(wpUser)) {
      return {
        ok: false,
        status: 403,
        error: 'This WordPress account is not authorized for MissionMed HQ.',
      };
    }

    return {
      ok: true,
      status: 200,
      session: createSessionRecord(
        {
          id: wpUser.id,
          login: wpUser.login,
          displayName: wpUser.displayName,
          email: wpUser.email,
          roles: wpUser.roles,
          scope: wpUser.scope || resolveOperatorScope(wpUser),
        },
        {
          wpAuthorization: getWordPressServiceAuthorization(),
        },
        'wordpress-cookie',
      ),
    };
  }

  if (!CONFIG.wpBase) {
    return {
      ok: false,
      status: 400,
      error: 'MMHQ_WP_BASE must be configured before HQ authentication can be enabled.',
    };
  }

  const exchangeUrl = resolveWordPressAuthEndpoint();
  if (!exchangeUrl) {
    return {
      ok: false,
      status: 400,
      error: 'MMHQ_WP_AUTH_ENDPOINT must be configured before HQ authentication can be enabled.',
    };
  }

  if (!wpToken) {
    return {
      ok: false,
      status: 400,
      error: 'A signed WordPress HQ token is required. Start from the WordPress login handoff to continue.',
    };
  }

  const exchange = await fetchJson(exchangeUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${wpToken}`,
    },
    timeoutMs: 6500,
  });

  if (!exchange.ok) {
    return {
      ok: false,
      status: exchange.status === 400 ? 401 : exchange.status,
      error: exchange.error || 'WordPress authentication failed.',
    };
  }

  const issuedToken = String(exchange.data?.token || '').trim();
  if (!issuedToken) {
    return {
      ok: false,
      status: 502,
      error: 'WordPress authentication succeeded but no HQ token was returned.',
    };
  }

  const wpUser = normalizeWordPressUser(exchange.data?.user || {});
  if (!isAuthorizedWordPressUser(wpUser)) {
    return {
      ok: false,
      status: 403,
      error: 'This WordPress account is not authorized for MissionMed HQ.',
    };
  }

  return {
    ok: true,
    status: 200,
    session: createSessionRecord(
      {
        id: wpUser.id,
        login: wpUser.login,
        displayName: wpUser.displayName,
        email: wpUser.email,
        roles: wpUser.roles,
        scope: wpUser.scope || resolveOperatorScope(wpUser),
      },
      {
        wpAuthorization: `Bearer ${issuedToken}`,
      },
      'wordpress-token',
    ),
  };
}

async function bootstrapSupabaseSessionFromWordPressSession(authSession = null) {
  if (!authSession || !authSession.user) {
    return {
      ok: false,
      status: 401,
      error: 'wordpress_session_missing',
      message: 'WordPress session required before Supabase bootstrap.',
    };
  }

  const projectCheck = isAuthSupabaseProjectAllowed();
  if (!projectCheck.ok) {
    return {
      ok: false,
      status: 503,
      error: projectCheck.code,
      message: projectCheck.message,
    };
  }

  const wpUser = normalizeWordPressIdentityUser(authSession.user || {});
  if (!Number(wpUser.id || 0)) {
    return {
      ok: false,
      status: 401,
      error: 'wordpress_session_missing',
      message: 'WordPress session identity is invalid.',
    };
  }

  const email = String(wpUser.email || '').trim().toLowerCase();
  if (!email) {
    return {
      ok: false,
      status: 422,
      error: 'wordpress_identity_incomplete',
      message: 'WordPress identity is missing email.',
    };
  }

  const password = deriveAuthBootstrapPassword(wpUser.id, email);
  let signInResult = await signInSupabaseAuthUser(email, password);
  if (!signInResult.ok) {
    const reason = String(signInResult.detail || signInResult.error || '').toLowerCase();
    const shouldEnsureUser =
      signInResult.status === 400 ||
      signInResult.status === 401 ||
      reason.includes('invalid') ||
      reason.includes('credentials') ||
      reason.includes('not found') ||
      reason.includes('email');

    if (shouldEnsureUser) {
      const ensureUser = await ensureSupabaseAuthUser(email, password, authSession);
      if (!ensureUser.ok) {
        return {
          ok: false,
          status: 502,
          error: 'supabase_user_unresolved',
          message: ensureUser.detail || ensureUser.error || 'Unable to resolve Supabase auth user.',
        };
      }

      signInResult = await signInSupabaseAuthUser(email, password);
    }
  }

  if (!signInResult.ok) {
    if (isSupabaseEmailProviderDisabled(signInResult.detail || signInResult.error)) {
      const magicLinkSession = await mintSupabaseSessionViaAdminMagicLink(email);
      if (magicLinkSession.ok) {
        signInResult = magicLinkSession;
      } else {
        signInResult = {
          ok: false,
          status: magicLinkSession.status || signInResult.status || 502,
          error: magicLinkSession.error || signInResult.error || 'supabase_bootstrap_failed',
          detail: magicLinkSession.detail || signInResult.detail || signInResult.error || 'Supabase bootstrap failed.',
        };
      }
    }
  }

  if (!signInResult.ok) {
    return {
      ok: false,
      status: 502,
      error: 'supabase_bootstrap_failed',
      message: signInResult.detail || signInResult.error || 'Supabase bootstrap failed.',
    };
  }

  const sessionData = signInResult.session || {};
  const supabaseUserId = String(sessionData?.user?.id || '').trim();
  const refreshedSession = supabaseUserId
    ? { ...authSession, supabaseUserId }
    : authSession;

  return {
    ok: true,
    status: 200,
    payload: {
      access_token: String(sessionData.access_token || '').trim(),
      refresh_token: String(sessionData.refresh_token || '').trim(),
      expires_in: Number(sessionData.expires_in || 3600),
      token_type: String(sessionData.token_type || 'bearer'),
      user: sessionData.user || null,
      subject: `wp:${wpUser.id}`,
      source: String(signInResult.source || 'auth_bootstrap'),
    },
    session: refreshedSession,
  };
}

function normalizeWordPressUser(user) {
  return {
    id: Number(user?.id || 0),
    login: String(user?.login || user?.user_login || user?.slug || user?.username || user?.name || '').trim(),
    displayName: String(user?.name || user?.display_name || '').trim() || 'WordPress User',
    email: String(user?.email || '').trim(),
    roles: Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toLowerCase()) : [],
    capabilities: user?.capabilities || user?.extra_capabilities || {},
    scope: user?.scope || null,
  };
}

function isAuthorizedWordPressUser(user) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.some((role) => CONFIG.wpAllowedRoles.includes(String(role).toLowerCase()))) {
    return true;
  }

  return Boolean(user.capabilities?.manage_options);
}

function resolveOperatorScope(user) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes('administrator') || user.capabilities?.manage_options) {
    return { ...OPERATOR_SCOPES.brian };
  }

  const haystack = `${user.login || ''} ${user.displayName || ''} ${user.email || ''}`.toLowerCase();
  for (const scope of Object.values(OPERATOR_SCOPES)) {
    if (scope.aliases.some((alias) => haystack.includes(alias))) {
      return { ...scope };
    }
  }

  return {
    operator: 'restricted',
    assignee: 'restricted',
    owner_name: user.displayName || 'Restricted Operator',
    division: 'restricted',
    division_label: 'Restricted Scope',
    is_all: false,
  };
}

function getSessionScope(session = null) {
  return session?.user?.scope || { ...OPERATOR_SCOPES.brian };
}

function resolveStripeOwnerKey(candidate, session = null) {
  const scope = getSessionScope(session);
  const requested = String(candidate || '').trim().toLowerCase();
  const hasRequestedOwner = requested && Object.prototype.hasOwnProperty.call(OPERATOR_SCOPES, requested);

  if (!scope.is_all) {
    if (!Object.prototype.hasOwnProperty.call(OPERATOR_SCOPES, scope.operator || '')) {
      console.warn('[CONFIG WARNING]', 'removed fatal error');
    }
    if (hasRequestedOwner && requested !== scope.operator) {
      console.warn('[CONFIG WARNING]', 'removed fatal error');
    }
    return scope.operator;
  }

  return hasRequestedOwner ? requested : 'brian';
}

function maskStripeAccountId(accountId) {
  const value = String(accountId || '').trim();
  if (!value) {
    return '';
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 9)}…${value.slice(-3)}`;
}

function normalizeStripeRequirements(requirements) {
  if (!Array.isArray(requirements)) {
    return [];
  }

  return [...new Set(requirements.map((item) => String(item || '').trim()).filter(Boolean))];
}

function mapStripeReadiness(status, requirementsDue = []) {
  if (status === 'active') {
    return 'ready';
  }

  if (status === 'charges_only' || status === 'pending' || status === 'restricted' || requirementsDue.length) {
    return 'attention';
  }

  return 'blocked';
}

function describeStripeStatus(status, requirementsDue = []) {
  if (status === 'active') {
    return 'Ready for payments and payouts.';
  }

  if (status === 'charges_only') {
    return requirementsDue.length
      ? 'Payments can run, but Stripe still needs additional information before payouts unlock.'
      : 'Payments can run, but payouts are still pending Stripe verification.';
  }

  if (status === 'restricted') {
    return requirementsDue.length
      ? 'Stripe needs additional information before this account can accept payments normally.'
      : 'Stripe has restricted this account until outstanding issues are resolved.';
  }

  if (status === 'pending') {
    return 'Stripe onboarding started, but setup is not complete yet.';
  }

  if (status === 'deauthorized') {
    return 'The Stripe connection is no longer active and must be reconnected.';
  }

  return 'No Stripe account connected yet.';
}

function buildStripeStatusFromAccount(account) {
  const requirements = account?.requirements || {};
  const currentlyDue = normalizeStripeRequirements(requirements.currently_due);
  const pastDue = normalizeStripeRequirements(requirements.past_due);
  const requirementsDue = normalizeStripeRequirements([...currentlyDue, ...pastDue]);
  const disabledReason = String(requirements.disabled_reason || '').trim();
  const chargesEnabled = Boolean(account?.charges_enabled);
  const payoutsEnabled = Boolean(account?.payouts_enabled);
  const detailsSubmitted = Boolean(account?.details_submitted);

  let status = 'pending';
  if (disabledReason.includes('rejected')) {
    status = 'deauthorized';
  } else if (chargesEnabled && payoutsEnabled) {
    status = 'active';
  } else if (chargesEnabled) {
    status = 'charges_only';
  } else if (requirementsDue.length || disabledReason) {
    status = detailsSubmitted ? 'restricted' : 'pending';
  } else if (detailsSubmitted) {
    status = 'restricted';
  }

  return {
    status,
    readiness: mapStripeReadiness(status, requirementsDue),
    can_receive: chargesEnabled,
    action_required: status !== 'active' || requirementsDue.length > 0,
    requirements_due: requirementsDue,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    disabled_reason: disabledReason,
    livemode: Boolean(account?.livemode),
    message: describeStripeStatus(status, requirementsDue),
  };
}

function normalizeStoredStripeStatus(detail = {}) {
  const rawAccountId = String(detail.account_id || '').trim();
  const requirementsDue = normalizeStripeRequirements(detail.requirements_due);
  const status = String(detail.status || (rawAccountId ? 'pending' : 'not_connected')).trim() || 'not_connected';
  const canReceive = Boolean(detail.can_receive);

  return {
    owner_key: String(detail.owner_key || '').trim(),
    owner_name: String(detail.owner_name || '').trim(),
    division: String(detail.division || '').trim(),
    division_label: String(detail.division_label || '').trim(),
    user_id: Number(detail.user_id || 0),
    connected: Boolean(rawAccountId || detail.connected),
    status,
    readiness: String(detail.readiness || mapStripeReadiness(status, requirementsDue)).trim(),
    can_receive: canReceive,
    action_required: Boolean(detail.action_required) || (status !== 'active' && Boolean(rawAccountId)) || requirementsDue.length > 0,
    account_id: rawAccountId ? maskStripeAccountId(rawAccountId) : maskStripeAccountId(detail.account_id_masked),
    account_id_masked: rawAccountId ? maskStripeAccountId(rawAccountId) : maskStripeAccountId(detail.account_id_masked),
    requirements_due: requirementsDue,
    last_updated: detail.last_updated || null,
    message: String(detail.message || describeStripeStatus(status, requirementsDue)).trim(),
    charges_enabled: Boolean(detail.charges_enabled),
    payouts_enabled: Boolean(detail.payouts_enabled),
    details_submitted: Boolean(detail.details_submitted),
    disabled_reason: String(detail.disabled_reason || '').trim(),
    livemode: Boolean(detail.livemode),
    _raw_account_id: rawAccountId,
  };
}

function shouldPersistStripeStatus(stored, refreshed) {
  const current = JSON.stringify({
    status: stored.status || '',
    requirements_due: normalizeStripeRequirements(stored.requirements_due),
    charges_enabled: Boolean(stored.charges_enabled),
    payouts_enabled: Boolean(stored.payouts_enabled),
    details_submitted: Boolean(stored.details_submitted),
    disabled_reason: String(stored.disabled_reason || ''),
    livemode: Boolean(stored.livemode),
  });

  const next = JSON.stringify({
    status: refreshed.status || '',
    requirements_due: normalizeStripeRequirements(refreshed.requirements_due),
    charges_enabled: Boolean(refreshed.charges_enabled),
    payouts_enabled: Boolean(refreshed.payouts_enabled),
    details_submitted: Boolean(refreshed.details_submitted),
    disabled_reason: String(refreshed.disabled_reason || ''),
    livemode: Boolean(refreshed.livemode),
  });

  return current !== next;
}

function shouldMarkStripeDeauthorized(errorMessage = '') {
  const normalized = String(errorMessage || '').toLowerCase();
  return normalized.includes('no such account') || normalized.includes('not connected to your platform');
}

function buildStripeConnectState(ownerKey, session) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  return createEncryptedPayloadToken({
    kind: 'stripe_connect',
    ownerKey,
    userId: Number(session?.user?.id || 0),
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

function readStripeConnectState(token, session) {
  const payload = readEncryptedPayloadToken(token);

  if (payload?.kind !== 'stripe_connect') {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  if (!payload?.expiresAt || Number.isNaN(new Date(payload.expiresAt).getTime()) || new Date(payload.expiresAt).getTime() <= Date.now()) {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  if (!session || Number(payload.userId || 0) !== Number(session?.user?.id || 0)) {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  if (!Object.prototype.hasOwnProperty.call(OPERATOR_SCOPES, payload.ownerKey || '')) {
    console.warn('[CONFIG WARNING]', 'removed fatal error');
  }

  return payload;
}

function getStripeConnectMissingConfig() {
  const missing = [];
  if (!CONFIG.stripeSecretKey) {
    missing.push('MMHQ_STRIPE_SECRET_KEY');
  }
  if (!CONFIG.stripeConnectClientId) {
    missing.push('MMHQ_STRIPE_CONNECT_CLIENT_ID');
  }
  return missing;
}

function resolveStripeConnectRedirectUri(request) {
  return CONFIG.stripeConnectRedirectUri || `${getRequestOrigin(request)}/api/stripe/oauth/callback`;
}

function buildStripeReturnUrl(request, params = {}) {
  const url = new URL('/', getRequestOrigin(request));
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  url.hash = 'payments';
  return url.toString();
}

async function exchangeStripeAuthorizationCode(code) {
  if (!CONFIG.stripeSecretKey) {
    return {
      ok: false,
      status: 400,
      error: 'Stripe secret key is not configured.',
    };
  }

  return fetchJson('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code || ''),
      client_secret: CONFIG.stripeSecretKey,
    }).toString(),
    timeoutMs: 10000,
  });
}

async function fetchStripeConnectedAccount(accountId) {
  if (!CONFIG.stripeSecretKey) {
    return {
      ok: false,
      status: 400,
      error: 'Stripe secret key is not configured.',
    };
  }

  return fetchJson(`https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${CONFIG.stripeSecretKey}`,
    },
    timeoutMs: 10000,
  });
}

async function getStoredStripeOwnerDetail(ownerKey, session = null) {
  return fetchWordPressService('/payments/stripe-accounts/detail', new URLSearchParams({ owner_key: ownerKey }), session);
}

async function persistStoredStripeOwnerDetail(payload, session = null) {
  return fetchWordPressService('/payments/stripe-accounts/link', null, session, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function getStripeStatusPayload(ownerKey, session = null, options = {}) {
  const response = await getStoredStripeOwnerDetail(ownerKey, session);
  if (!response.ok) {
    const runtime = buildStripeRuntimeState(false);
    return {
      owner_key: ownerKey,
      connected: false,
      status: 'not_connected',
      readiness: 'blocked',
      can_receive: false,
      action_required: false,
      account_id: '',
      account_id_masked: '',
      requirements_due: [],
      last_updated: null,
      message: 'Stripe status could not be loaded from WordPress.',
      mode: 'error',
      configuration_state: runtime.configuration_state,
      missing_env: runtime.missing_env,
      live_refresh_enabled: runtime.live_refresh_enabled,
      error: response.error,
    };
  }

  const stored = normalizeStoredStripeStatus(response.data);
  const rawAccountId = stored._raw_account_id;
  const runtime = buildStripeRuntimeState(Boolean(rawAccountId));

  if (!rawAccountId || options.refreshLive === false || !CONFIG.stripeSecretKey) {
    return {
      ...stored,
      mode: rawAccountId ? runtime.data_mode : 'not_connected',
      configuration_state: runtime.configuration_state,
      missing_env: runtime.missing_env,
      live_refresh_enabled: runtime.live_refresh_enabled,
    };
  }

  const live = await fetchStripeConnectedAccount(rawAccountId);
  if (live.ok) {
    const derived = buildStripeStatusFromAccount(live.data);
    const refreshed = {
      ...stored,
      ...derived,
      connected: true,
      account_id: maskStripeAccountId(rawAccountId),
      account_id_masked: maskStripeAccountId(rawAccountId),
      last_updated: new Date().toISOString(),
      mode: 'live',
      configuration_state: runtime.configuration_state,
      missing_env: runtime.missing_env,
      live_refresh_enabled: runtime.live_refresh_enabled,
      _raw_account_id: rawAccountId,
    };

    if (options.persist !== false && shouldPersistStripeStatus(stored, refreshed)) {
      await persistStoredStripeOwnerDetail({
        owner_key: ownerKey,
        stripe_account_id: rawAccountId,
        status: refreshed.status,
        requirements_due: refreshed.requirements_due,
        charges_enabled: refreshed.charges_enabled,
        payouts_enabled: refreshed.payouts_enabled,
        details_submitted: refreshed.details_submitted,
        disabled_reason: refreshed.disabled_reason,
        livemode: refreshed.livemode,
        last_updated: refreshed.last_updated,
      }, session);
    }

    return refreshed;
  }

  if (shouldMarkStripeDeauthorized(live.error)) {
    const disconnected = {
      ...stored,
      status: 'deauthorized',
      readiness: 'blocked',
      can_receive: false,
      action_required: true,
      requirements_due: stored.requirements_due,
      message: describeStripeStatus('deauthorized'),
      mode: 'stored-fallback',
      configuration_state: runtime.configuration_state,
      missing_env: runtime.missing_env,
      live_refresh_enabled: runtime.live_refresh_enabled,
      error: live.error,
    };

    if (options.persist !== false) {
      await persistStoredStripeOwnerDetail({
        owner_key: ownerKey,
        stripe_account_id: rawAccountId,
        status: disconnected.status,
        requirements_due: disconnected.requirements_due,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: stored.details_submitted,
        disabled_reason: stored.disabled_reason,
        livemode: stored.livemode,
        last_updated: new Date().toISOString(),
      }, session);
    }

    return disconnected;
  }

  return {
    ...stored,
    mode: 'stored-fallback',
    configuration_state: runtime.configuration_state,
    missing_env: runtime.missing_env,
    live_refresh_enabled: runtime.live_refresh_enabled,
    error: live.error,
  };
}

function getBridgeHealthWordPressMode(session = null) {
  if (session?.wpAuthorization) {
    return session.authSource || 'wordpress-token';
  }

  return getWordPressAuthMode();
}

async function getBridgeHealth(session = null, request = null) {
  const [wp, supabase, media, studio] = await Promise.all([
    probeWordPress(session, request),
    probeSupabase(),
    probeMedia(),
    probeStudio(),
  ]);
  const stripeRuntime = buildStripeRuntimeState(false);

  return {
    generatedAt: new Date().toISOString(),
    auth: {
      required: CONFIG.authRequired,
      session_persistent: Boolean(SESSION_SECRET),
      mode: session ? 'authenticated' : 'anonymous',
      hq_mode: getHqAccessMode(request),
      wordpress_mode: getBridgeHealthWordPressMode(session),
      supabase_mode: getSupabaseAuthMode(),
    },
    validation: STARTUP_VALIDATION,
    debug: {
      endpoints: buildActiveEndpoints(request),
      auth: buildAuthDebugSnapshot(session, request),
    },
    services: {
      wordpress: wp,
      supabase,
      stripe: {
        configured: stripeRuntime.configured,
        mode: stripeRuntime.data_mode,
        configuration_state: stripeRuntime.configuration_state,
        missing_env: stripeRuntime.missing_env,
        live_refresh_enabled: stripeRuntime.live_refresh_enabled,
        required_env: ['MMHQ_STRIPE_SECRET_KEY'],
        note: stripeRuntime.configured
          ? 'Stripe secret key is configured. Live refresh and OAuth callback are available.'
          : 'MMHQ_STRIPE_SECRET_KEY is not set. Stripe can report stored WordPress mappings, but live refresh and OAuth callback stay disabled until the key is configured.',
      },
      media_engine: media,
      studio,
    },
  };
}

async function probeWordPress(session = null, request = null) {
  if (!CONFIG.wpBase) {
    return {
      configured: false,
      online: false,
      mode: 'offline',
      auth: getBridgeHealthWordPressMode(session),
      target: '',
      note: 'Set MMHQ_WP_BASE to enable the Admin Engine bridge.',
      required_env: ['MMHQ_WP_BASE'],
    };
  }

  const [response, authRoute, coreAppPassword, protectedRoute] = await Promise.all([
    fetchWordPress('/health', null, session),
    probeWordPressAuthRoute(),
    probeWordPressCoreAppPasswordAuth(),
    probeWordPressProtectedRouteAuth(),
  ]);
  const serviceCredentialMode = getWordPressServiceCredentialMode();
  const serviceCredentialsConfigured = serviceCredentialMode !== 'none';
  const allowedHosts = Array.isArray(authRoute?.data?.allowed_hosts)
    ? authRoute.data.allowed_hosts.map((host) => String(host).toLowerCase())
    : [];
  const requestHostname = request && !isLocalhostRequest(request)
    ? new URL(getRequestOrigin(request)).hostname.toLowerCase()
    : '';
  const hostAllowed = !requestHostname || allowedHosts.length === 0 || allowedHosts.includes(requestHostname);
  const authRouteReachable = isWordPressAuthRouteReachable(authRoute) && hostAllowed;
  const authRouteMessage = !hostAllowed
    ? `WordPress auth handoff does not allow the current HQ host (${requestHostname}).`
    : (authRoute?.data?.message || authRoute.error);
  const bridgeAuthenticated = Boolean(response.ok && response.data?.authenticated);
  const healthEndpointMissing = !response.ok && response.status === 404;
  const protectedRouteReachable = Boolean(
    protectedRoute.attempted
    && Number.isInteger(protectedRoute.status)
    && protectedRoute.status > 0
    && protectedRoute.status < 500,
  );
  const protectedRouteRejected = protectedRoute.attempted && !protectedRoute.ok;
  const pluginAuthMismatch = Boolean(
    serviceCredentialMode === 'app-password'
    && coreAppPassword.attempted
    && coreAppPassword.valid
    && protectedRouteRejected
    && [401, 403].includes(protectedRoute.status),
  );
  const coreAppPasswordInvalid = Boolean(
    serviceCredentialMode === 'app-password'
    && coreAppPassword.attempted
    && !coreAppPassword.valid,
  );
  const bridgeReachable = response.ok || healthEndpointMissing || protectedRouteReachable;
  const fullyReady = authRouteReachable && response.ok && (!serviceCredentialsConfigured || protectedRoute.ok || bridgeAuthenticated);

  let actionRequired = 'none';
  let note = '';

  if (!authRouteReachable && bridgeReachable) {
    actionRequired = 'fix_auth_handoff';
    note = `Admin Engine REST bridge is reachable, but HQ auth exchange is not ready: ${authRouteMessage}`;
  } else if (pluginAuthMismatch) {
    actionRequired = 'deploy_updated_rest_file';
    note = 'WordPress core accepts the configured app password, but the production plugin still rejects the same credentials on protected routes. Deploy the updated missionmed-command-center REST file to remove stale auth handling and enable /health.';
  } else if (coreAppPasswordInvalid) {
    actionRequired = 'regenerate_app_password';
    note = 'WordPress core rejects the configured app password. Regenerate MMHQ_WP_APP_PASSWORD in WordPress Admin → Users → claude-connector → Application Passwords.';
  } else if (healthEndpointMissing && protectedRoute.ok) {
    actionRequired = 'deploy_health_endpoint';
    note = 'Protected Admin Engine routes authenticate successfully, but /health is not deployed yet. Deploy the updated missionmed-command-center plugin to enable full bridge health probing.';
  } else if (healthEndpointMissing) {
    actionRequired = 'deploy_health_endpoint';
    note = 'The Admin Engine REST namespace is reachable, but /health is not deployed yet. Deploy the updated missionmed-command-center plugin to expose the public health probe.';
  } else if (response.ok && !bridgeAuthenticated && serviceCredentialsConfigured) {
    actionRequired = 'verify_service_auth';
    note = 'The /health route is live, but it did not mark the configured service credentials as authenticated.';
  } else if (fullyReady) {
    note = 'Admin Engine REST bridge and HQ auth exchange are reachable.';
  } else if (authRouteReachable) {
    actionRequired = 'verify_bridge';
    note = `HQ auth exchange is reachable, but the Admin Engine REST bridge failed: ${response.error || protectedRoute.error || 'unknown bridge failure'}`;
  } else {
    actionRequired = 'verify_bridge';
    note = authRouteMessage || response.error || protectedRoute.error || 'WordPress bridge could not be probed.';
  }

  return {
    configured: true,
    online: bridgeReachable && authRouteReachable,
    mode: fullyReady ? 'live' : (bridgeReachable || authRouteReachable ? 'mixed' : 'offline'),
    auth: getBridgeHealthWordPressMode(session),
    target: targetLabel(CONFIG.wpBase),
    action_required: actionRequired,
    required_env: ['MMHQ_WP_BASE'],
    health_endpoint: {
      deployed: response.ok,
      reachable: response.ok || healthEndpointMissing,
      status: Number(response.status || 0),
      authenticated: bridgeAuthenticated,
    },
    auth_route: {
      reachable: authRouteReachable,
      status: Number(authRoute?.status || 0),
      host_allowed: hostAllowed,
      allowed_hosts: allowedHosts,
      current_host: requestHostname,
    },
    service_credentials: {
      configured: serviceCredentialsConfigured,
      mode: serviceCredentialMode,
      core_app_password: coreAppPassword,
      protected_route: protectedRoute,
    },
    note,
  };
}

async function probeWordPressCoreAppPasswordAuth() {
  if (getWordPressServiceCredentialMode() !== 'app-password') {
    return {
      attempted: false,
      valid: null,
      status: 0,
      note: 'App-password core probe not required for the current WordPress service auth mode.',
    };
  }

  const response = await fetchWordPressCore(
    '/wp/v2/users/me',
    new URLSearchParams({
      context: 'edit',
      _fields: 'id,slug,name',
    }),
    getWordPressServiceAuthorization(),
  );

  if (response.ok) {
    return {
      attempted: true,
      valid: true,
      status: Number(response.status || 200),
      user_login: response.data?.slug || '',
      note: 'WordPress core accepted the configured app password.',
    };
  }

  return {
    attempted: true,
    valid: false,
    status: Number(response.status || 0),
    error: response.error || 'WordPress core rejected the configured app password.',
    note: 'WordPress core rejected the configured app password.',
  };
}

async function probeWordPressProtectedRouteAuth() {
  if (getWordPressServiceCredentialMode() === 'none') {
    return {
      attempted: false,
      ok: false,
      status: 0,
      note: 'No dedicated WordPress service credentials are configured for protected-route probing.',
    };
  }

  const response = await fetchWordPressService('/students', new URLSearchParams({ limit: '1' }));

  return {
    attempted: true,
    ok: response.ok,
    status: Number(response.status || 0),
    code: String(response.data?.code || '').trim(),
    error: response.error || '',
    note: response.ok
      ? 'Protected Admin Engine route accepted the configured service credentials.'
      : (response.error || 'Protected Admin Engine route rejected the configured service credentials.'),
  };
}

async function probeWordPressAuthRoute() {
  const exchangeUrl = resolveWordPressAuthEndpoint();
  if (!exchangeUrl) {
    return {
      ok: false,
      status: 400,
      error: 'WordPress auth exchange URL is not configured.',
    };
  }

  return fetchJson(exchangeUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    timeoutMs: 6500,
  });
}

function isWordPressAuthRouteReachable(result) {
  return Boolean(result?.ok && result?.data?.route_registered) || [400, 401, 403, 405].includes(Number(result?.status || 0));
}

async function probeSupabase() {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return {
      configured: false,
      online: false,
      mode: 'offline',
      target: '',
      note: 'Set MMHQ_SUPABASE_URL and MMHQ_SUPABASE_KEY to enable live HQ RPC reads.',
    };
  }

  const probes = await Promise.all([
    fetchSupabaseRpc('mmac_cc_list_students', {
      p_search: null,
      p_status: null,
      p_assigned_to: null,
    }),
    fetchSupabaseRpc('mmac_cc_list_email_queue', {
      p_assigned_to: null,
      p_limit: 1,
    }),
    fetchSupabaseRpc('mmac_cc_list_leads', {
      p_assigned_to: null,
      p_limit: 1,
    }),
  ]);

  const probeLabels = ['Students', 'MedMail', 'Leads'];
  const passing = probes
    .map((result, index) => (result.ok ? probeLabels[index] : null))
    .filter(Boolean);
  const failing = probes
    .map((result, index) => (!result.ok ? `${probeLabels[index]}: ${result.error}` : null))
    .filter(Boolean);

  let mode = 'offline';
  let note = failing[0] || 'Supabase RPC probe failed.';

  if (passing.length === probeLabels.length) {
    mode = 'live';
    note = 'Supabase RPC bridge is reachable for Students, MedMail, and Leads.';
  } else if (passing.length) {
    mode = 'mixed';
    note = `Supabase RPC bridge is partial. Live: ${passing.join(', ')}. Failed: ${failing.join(' | ')}`;
  }

  const result = {
    configured: true,
    online: passing.length > 0,
    mode,
    auth: getSupabaseAuthMode(),
    target: targetLabel(CONFIG.supabaseUrl),
    note,
  };

  logDataBridge('supabase-probe', {
    mode,
    target: result.target,
    note,
  });

  return result;
}

function normalizeMediaRegistryPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object');
  }

  if (Array.isArray(payload?.items)) {
    return payload.items.filter((item) => item && typeof item === 'object');
  }

  if (Array.isArray(payload?.videos)) {
    return payload.videos.filter((item) => item && typeof item === 'object');
  }

  if (Array.isArray(payload?.entries)) {
    return payload.entries.filter((item) => item && typeof item === 'object');
  }

  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items.filter((item) => item && typeof item === 'object');
  }

  return null;
}

async function fetchMediaRegistry(options = {}) {
  const cacheKey = 'media:registry';
  if (!options.force) {
    const cached = getCachedValue(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!CONFIG.mediaRegistryUrl) {
    return {
      ok: false,
      error: 'Media Engine registry URL is not configured.',
    };
  }

  const response = await fetchJson(CONFIG.mediaRegistryUrl, {
    headers: {
      Accept: 'application/json',
    },
    timeoutMs: options.timeoutMs || 6500,
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: response.error || 'Media Engine registry request failed.',
    };
  }

  const data = normalizeMediaRegistryPayload(response.data);
  if (!data) {
    return {
      ok: false,
      error: 'Media Engine registry response did not contain an array payload.',
    };
  }

  return setCachedValue(cacheKey, {
    ok: true,
    data,
  }, MEDIA_REGISTRY_CACHE_TTL_MS);
}

async function probeMedia() {
  if (!CONFIG.cieBase) {
    return {
      configured: false,
      online: false,
      mode: 'offline',
      auth: getMediaAuthMode(),
      target: '',
      source: getCieEndpointSource(),
      required_env: ['MMHQ_CIE_BASE'],
      note: 'Set MMHQ_CIE_BASE to enable the live Media Engine bridge.',
    };
  }

  const cie = await fetchCie('/api/health');

  if (cie.ok) {
    return {
      configured: Boolean(CONFIG.cieBase),
      online: true,
      mode: 'live',
      auth: getMediaAuthMode(),
      target: targetLabel(CONFIG.cieBase),
      source: getCieEndpointSource(),
      required_env: ['MMHQ_CIE_BASE'],
      note: 'Unified Media Engine bridge reachable.',
    };
  }

  return {
    configured: Boolean(CONFIG.cieBase),
    online: false,
    mode: 'offline',
    auth: getMediaAuthMode(),
    target: targetLabel(CONFIG.cieBase),
    source: getCieEndpointSource(),
    required_env: ['MMHQ_CIE_BASE'],
    note: cie.error || 'Unified Media Engine bridge is unavailable.',
  };
}

async function probeStudio() {
  if (!CONFIG.studioBase) {
    return {
      configured: false,
      online: false,
      mode: 'offline',
      auth: getStudioAuthMode(),
      target: '',
      source: getStudioEndpointSource(),
      required_env: ['MMHQ_CIE_BASE', 'MMHQ_STUDIO_BASE'],
      note: 'Set MMHQ_STUDIO_BASE, or let Studio fall back from MMHQ_CIE_BASE, before using live Studio routes.',
    };
  }

  const health = await fetchStudio('/api/health');

  return {
    configured: Boolean(CONFIG.studioBase),
    online: health.ok,
    mode: health.ok ? 'live' : 'offline',
    auth: getStudioAuthMode(),
    target: targetLabel(CONFIG.studioBase),
    source: getStudioEndpointSource(),
    required_env: ['MMHQ_CIE_BASE', 'MMHQ_STUDIO_BASE'],
    note: health.ok
      ? `Studio health endpoint reachable via ${getStudioEndpointSource()}.`
      : (health.error || 'Studio bridge is unavailable.'),
  };
}

function normalizeDivisionSlug(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');

  const map = {
    mission_residency: 'mission_residency',
    residency: 'mission_residency',
    usmle: 'usmle_drills',
    usmle_drills: 'usmle_drills',
    examprep: 'usmle_drills',
    mission_usce: 'usce',
    usce: 'usce',
    clinicals: 'usce',
    other: 'other',
    general: 'other',
  };

  return map[normalized] || normalized || 'other';
}

function formatDivisionLabel(value) {
  const division = normalizeDivisionSlug(value);
  const labels = {
    mission_residency: 'Mission Residency',
    usmle_drills: 'USMLE Drills',
    usce: 'Mission USCE',
    other: 'Other',
    restricted: 'Restricted Scope',
  };
  return labels[division] || division.replace(/_/gu, ' ');
}

function formatAssigneeLabel(value) {
  const map = {
    brian: 'Brian',
    dr_j: 'Dr. J',
    phil: 'Phil',
    system: 'System',
    unassigned: 'Unassigned',
    restricted: 'Restricted',
  };

  return map[String(value || '').toLowerCase()] || 'Unassigned';
}

function normalizeAmountValue(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAmount(value, currency = 'usd') {
  const amount = normalizeAmountValue(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function inferServiceCategory(programTier, subject = '') {
  const haystack = `${programTier || ''} ${subject || ''}`.toLowerCase();
  if (haystack.includes('usce') || haystack.includes('clinical')) {
    return 'Mission USCE';
  }
  if (haystack.includes('usmle') || haystack.includes('drill')) {
    return 'USMLE Drills';
  }
  if (haystack.includes('interview')) {
    return 'Interview Prep';
  }
  return 'Mission Residency';
}

function normalizeTaskStatusBucket(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['done', 'complete', 'completed', 'verified', 'cancelled', 'canceled', 'closed'].includes(normalized)) {
    return 'done';
  }
  if (normalized === 'in_progress') {
    return 'in_progress';
  }
  return 'todo';
}

function mapTaskStatusForWrite(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'todo') {
    return 'open';
  }
  if (normalized === 'done') {
    return 'complete';
  }
  return normalized;
}

function describeTaskPriority(priority) {
  const numeric = Number(priority || 3);
  if (numeric <= 1) {
    return 'Critical';
  }
  if (numeric === 2) {
    return 'High';
  }
  if (numeric === 3) {
    return 'Standard';
  }
  return 'Low';
}

function inferTaskLinkedEntityType(row = {}, metadata = {}) {
  const explicit = String(
    metadata.linked_entity_type
    || metadata.entity_type
    || metadata.anchor_type
    || metadata.thread_type
    || '',
  ).trim().toLowerCase();

  if (explicit) {
    return explicit;
  }

  if (metadata.thread_id || metadata.email_id) {
    return 'email';
  }
  if (metadata.payment_id || metadata.order_id) {
    return 'payment';
  }
  if (metadata.video_id || metadata.course_id) {
    return 'video';
  }
  if (row.lead_id) {
    return 'lead';
  }
  if (row.student_id) {
    return 'student';
  }
  return 'general';
}

function deriveTaskLinkedEntityLabel(linkedEntityType, row = {}, metadata = {}) {
  if (metadata.linked_entity_label) {
    return String(metadata.linked_entity_label);
  }

  if (linkedEntityType === 'email') {
    return metadata.thread_subject || metadata.subject || row.person_name || 'MedMail thread';
  }

  if (linkedEntityType === 'payment') {
    return metadata.payment_label || metadata.product_name || row.person_name || 'Payment';
  }

  if (linkedEntityType === 'video') {
    return metadata.video_title || metadata.course_title || row.title || 'Video workflow';
  }

  return row.person_name || row.title || 'Linked entity';
}

function getWordPressCoreAuthorization(session = null) {
  return getWordPressServiceHeaders(session).Authorization || '';
}

function scopeFiltersForSupabase(session = null) {
  const scope = getSessionScope(session);
  return {
    scope,
    assignedTo: scope.is_all ? null : scope.assignee,
    division: scope.is_all ? null : scope.division,
  };
}

function transformStudentRow(row) {
  const nextAction = row.next_due_at ? `Task due ${row.next_due_at}` : '';
  const division = normalizeDivisionSlug(row.division || row.program_tier);
  const assignee = String(row.assigned_to || 'unassigned');

  return {
    id: row.student_id || row.id || '',
    full_name: row.full_name || '',
    preferred_name: row.preferred_name || '',
    email: row.email || '',
    phone: row.phone || '',
    program_tier: row.program_tier || division,
    division,
    division_label: formatDivisionLabel(division),
    student_status: row.student_status || '',
    funnel_stage: row.funnel_stage || '',
    assigned_to: assignee,
    assigned_to_label: formatAssigneeLabel(assignee),
    risk_level: row.risk_level || 'none',
    medical_school: row.medical_school || '',
    match_cycle_year: row.match_cycle_year || null,
    last_activity_at: row.last_activity_at || row.last_event_at || '',
    open_task_count: Number(row.open_task_count || 0),
    open_alert_count: Number(row.open_alert_count || 0),
    latest_payment_status: row.latest_payment_status || '',
    latest_payment_amount: row.latest_payment_amount ? formatAmount(row.latest_payment_amount) : '',
    latest_lead_score: row.latest_lead_score ?? null,
    latest_lead_score_text: row.latest_lead_score_summary || '',
    next_action: nextAction,
  };
}

function transformTaskRow(row) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const statusValue = String(row.task_status || 'open');
  const priority = Number(row.priority || 3);
  const linkedEntityType = inferTaskLinkedEntityType(row, metadata);

  return {
    id: row.task_id || row.id || '',
    student_id: row.student_id || '',
    lead_id: row.lead_id || '',
    person_name: row.person_name || '',
    title: row.title || '',
    description: row.description || '',
    assigned_to: row.assigned_to || 'unassigned',
    created_by: row.created_by || 'system',
    priority,
    priority_label: describeTaskPriority(priority),
    task_status: statusValue,
    status_bucket: normalizeTaskStatusBucket(statusValue),
    auto_generated: Boolean(row.auto_generated),
    due_at: row.due_at || '',
    due_date: row.due_at || '',
    completed_at: row.completed_at || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
    source_system: row.source_system || '',
    source_record_id: row.source_record_id || '',
    metadata,
    linked_entity_type: linkedEntityType,
    linked_entity_label: deriveTaskLinkedEntityLabel(linkedEntityType, row, metadata),
  };
}

function transformPaymentRow(row, studentLookup = {}) {
  const student = row.student_id ? studentLookup[row.student_id] || {} : {};
  const division = normalizeDivisionSlug(row.division || row.program_tier || student.division || student.program_tier);
  const assignee = String(row.assigned_to || row.owner || student.assigned_to || 'unassigned');
  const currency = String(row.currency || 'USD').toUpperCase();
  const amountValue = normalizeAmountValue(row.amount || row.amount_value);
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};

  return {
    id: row.payment_id || row.id || '',
    payment_id: row.payment_id || row.id || '',
    student_id: row.student_id || '',
    person_name: row.person_name || student.full_name || 'Unknown',
    division,
    division_label: formatDivisionLabel(division),
    assigned_to: assignee,
    assigned_to_label: formatAssigneeLabel(assignee),
    product_name: metadata.product_name || row.product_name || row.product_title || 'Mapped WooCommerce product',
    order_id: Number(metadata.order_id || row.order_id || 0),
    processor_name: row.processor_name || 'stripe',
    stripe_account: row.stripe_account || '',
    payment_type: row.payment_type || 'charge',
    payment_status: row.payment_status || 'pending',
    amount_value: amountValue,
    amount: formatAmount(amountValue, currency),
    currency,
    payment_at: row.payment_at || '',
    payment_at_display: row.payment_at || '',
  };
}

function transformEmailRow(row) {
  const assignee = String(row.assigned_to || 'brian');
  return {
    id: row.email_draft_id || row.id || '',
    student_id: row.student_id || '',
    person_name: row.person_name || '',
    subject: row.subject || '',
    preview_text: row.preview_text || '',
    draft_status: row.draft_status || 'draft',
    ai_confidence: row.ai_confidence ?? '',
    ai_model: row.ai_model || '',
    assigned_to: assignee,
    assigned_to_label: formatAssigneeLabel(assignee),
    service_category: inferServiceCategory(row.program_tier, row.subject),
    created_at: row.created_at || '',
    sent_at: row.sent_at || '',
  };
}

function buildStudentDetailPayload(detail) {
  const student = transformStudentRow(detail.student || {});
  const studentLookup = student.id ? { [student.id]: student } : {};
  const tasks = Array.isArray(detail.tasks) ? detail.tasks.map(transformTaskRow) : [];
  const payments = Array.isArray(detail.payments) ? detail.payments.map((row) => transformPaymentRow(row, studentLookup)) : [];
  const emails = Array.isArray(detail.emails) ? detail.emails.map(transformEmailRow) : [];
  const alerts = Array.isArray(detail.alerts) ? detail.alerts : [];
  const notes = Array.isArray(detail.notes) ? detail.notes : [];
  const timeline = Array.isArray(detail.timeline) ? detail.timeline : [];
  const profile = detail.profile || {};

  return {
    mode: 'live',
    bridge: 'supabase',
    student,
    details: {
      overview: {
        headline: deriveStudentHeadline(student, alerts),
        next_action: deriveStudentNextAction(student, tasks),
        lead_source: profile.lead_source || 'Unknown',
        intake_summary: profile.intake_summary || 'No intake summary yet.',
      },
      alerts: alerts.map((alert) => ({
        severity: alert.severity || 'info',
        title: alert.alert_type || 'Alert',
        message: alert.message || '',
      })),
      notes: notes.map((note) => ({
        id: note.id || '',
        author: note.author || 'system',
        created: note.created_at || '',
        content: note.content || '',
        pinned: Boolean(note.pinned),
      })),
      timeline: timeline.map((event) => ({
        time: event.occurred_at || '',
        type: event.event_type || 'system.event',
        text: event.payload?.description || event.payload?.summary || event.payload?.title || event.event_type || '',
      })),
    },
    tasks,
    payments,
    emails,
  };
}

function deriveStudentHeadline(student, alerts) {
  const highestAlert = alerts.find((alert) => alert.severity === 'critical') || alerts[0];
  if (highestAlert?.message) {
    return highestAlert.message;
  }
  if (student.latest_lead_score_text) {
    return student.latest_lead_score_text;
  }
  return student.next_action || 'Student profile';
}

function deriveStudentNextAction(student, tasks) {
  const openTask = tasks.find((task) => ['open', 'in_progress'].includes(task.task_status));
  if (openTask?.title) {
    return openTask.title;
  }
  return student.next_action || 'Review the profile and decide the next operator action.';
}

function mapLeadStage(funnelStage, leadStatus, score) {
  const stage = String(funnelStage || '').toLowerCase();
  const status = String(leadStatus || '').toLowerCase();
  const numericScore = Number(score || 0);

  if (status.includes('enrolled') || stage.includes('enrolled')) {
    return 'ENROLLED';
  }
  if (stage.includes('payment') || stage.includes('enrollment') || numericScore >= 85) {
    return 'ENROLLMENT_READY';
  }
  if (numericScore >= 70) {
    return 'HIGH_PROBABILITY';
  }
  if (stage.includes('consider')) {
    return 'CONSIDERING';
  }
  if (stage.includes('engag')) {
    return 'ENGAGED';
  }
  return 'NEW_INQUIRY';
}

function inferLeadService(lead) {
  const haystack = `${lead.lead_source || ''} ${lead.intake_summary || ''}`.toLowerCase();
  if (haystack.includes('usce') || haystack.includes('rotation')) {
    return 'Mission USCE';
  }
  if (haystack.includes('usmle') || haystack.includes('step')) {
    return 'USMLE Drills';
  }
  if (haystack.includes('interview')) {
    return 'Interview Prep';
  }
  return 'Mission Residency';
}

function transformLeadRow(row) {
  const assignee = String(row.assigned_to || 'unassigned');
  const score = Number(row.latest_lead_score ?? row.score ?? 0);
  const confidence = Number(row.latest_lead_score_confidence ?? row.confidence ?? 0);

  return {
    id: row.lead_id || row.id || '',
    name: row.full_name || row.email || 'Unknown lead',
    email: row.email || '',
    stage: mapLeadStage(row.funnel_stage, row.lead_status, score),
    service: inferLeadService(row),
    owner: formatAssigneeLabel(assignee),
    score,
    confidence,
    source: row.lead_source || 'Unknown',
    summary: row.latest_lead_score_summary || row.summary || row.intake_summary || 'No summary available yet.',
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function filterSupabaseRowsByScope(rows, session = null, field = 'assigned_to') {
  const { assignedTo } = scopeFiltersForSupabase(session);
  if (!assignedTo) {
    return rows;
  }
  return rows.filter((row) => String(row?.[field] || '').toLowerCase() === assignedTo);
}

async function getStudents(searchParams, session) {
  return logDataResolution('students', await getSupabaseStudents(searchParams, session));
}

async function getStudentDetail(studentId, session) {
  return logDataResolution(`student-detail:${studentId}`, await getSupabaseStudentDetail(studentId, session));
}

async function getEmails(session) {
  return logDataResolution('medmail', await getSupabaseEmails(session));
}

async function getSupabaseStudents(searchParams, session) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return buildBridgeError('supabase', 'Supabase bridge is not configured.', targetLabel(CONFIG.supabaseUrl));
  }

  const search = String(searchParams.get('search') || '').trim();
  const status = String(searchParams.get('status') || '').trim();
  const { assignedTo } = scopeFiltersForSupabase(session);

  const response = await fetchSupabaseRpc('mmac_cc_list_students', {
    p_search: search || null,
    p_status: status || null,
    p_assigned_to: assignedTo || null,
  });

  if (!response.ok) {
    return buildBridgeError('supabase', response.error, targetLabel(CONFIG.supabaseUrl));
  }

  const items = Array.isArray(response.data) ? response.data.map(transformStudentRow) : [];
  return {
    mode: 'live',
    bridge: 'supabase',
    transport: 'rpc:mmac_cc_list_students',
    items,
  };
}

async function getSupabaseStudentDetail(studentId, session) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return buildBridgeError('supabase', 'Supabase bridge is not configured.', targetLabel(CONFIG.supabaseUrl));
  }

  const response = await fetchSupabaseRpc('mmac_cc_get_student_detail', {
    p_student_id: studentId,
  });

  if (!response.ok || response.data?.error === 'student_not_found') {
    return response.data?.error === 'student_not_found'
      ? buildNotFoundError('student_not_found', 'Student was not found in Supabase.', { student_id: studentId })
      : buildBridgeError('supabase', response.error || 'Student detail could not be loaded.', targetLabel(CONFIG.supabaseUrl));
  }

  const payload = buildStudentDetailPayload(response.data || {});
  payload.transport = 'rpc:mmac_cc_get_student_detail';
  const { assignedTo } = scopeFiltersForSupabase(session);
  if (assignedTo && payload.student?.assigned_to !== assignedTo) {
    return buildApiError(403, 'student_forbidden', 'You do not have access to this student.', {
      student_id: studentId,
    });
  }

  return payload;
}

async function getSupabaseEmails(session) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return buildBridgeError('supabase', 'Supabase bridge is not configured.', targetLabel(CONFIG.supabaseUrl));
  }

  const { assignedTo } = scopeFiltersForSupabase(session);
  const response = await fetchSupabaseRpc('mmac_cc_list_email_queue', {
    p_assigned_to: assignedTo || null,
    p_limit: 80,
  });
  if (!response.ok) {
    return buildBridgeError('supabase', response.error, targetLabel(CONFIG.supabaseUrl));
  }

  const items = Array.isArray(response.data) ? response.data.map(transformEmailRow) : [];
  return {
    mode: 'live',
    bridge: 'supabase',
    transport: 'rpc:mmac_cc_list_email_queue',
    items,
  };
}

function resolveScopedTaskAssignee(candidate, session = null) {
  const scope = getSessionScope(session);
  const normalized = String(candidate || '').trim().toLowerCase();

  if (!scope.is_all) {
    return scope.assignee;
  }

  if (!normalized) {
    return scope.assignee || 'brian';
  }

  const known = Object.values(OPERATOR_SCOPES).find((entry) => (
    entry.assignee === normalized || entry.operator === normalized
  ));

  return known?.assignee || normalized;
}

function normalizeTaskPriorityValue(value) {
  const numeric = Number(value || 3);
  if (!Number.isFinite(numeric)) {
    return 3;
  }
  return Math.min(4, Math.max(1, Math.round(numeric)));
}

function buildTaskCounts(items = []) {
  return {
    total: items.length,
    todo: items.filter((item) => item.status_bucket === 'todo').length,
    in_progress: items.filter((item) => item.status_bucket === 'in_progress').length,
    done: items.filter((item) => item.status_bucket === 'done').length,
    overdue: items.filter((item) => (
      item.status_bucket !== 'done'
      && item.due_at
      && new Date(item.due_at).getTime() < Date.now()
    )).length,
  };
}

async function getTaskCapabilities() {
  const cached = getCachedValue('hq:task-capabilities');
  if (cached) {
    return structuredClone(cached);
  }

  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return {
      studentAnchors: false,
      linkedAnchors: false,
      updates: false,
      message: 'Supabase RPC bridge is not configured.',
    };
  }

  const probe = await fetchSupabaseRpc('mmac_cc_create_task_linked', {
    p_title: 'MissionMed HQ capability probe',
  });

  const capability = {
    studentAnchors: true,
    linkedAnchors: false,
    updates: true,
    message: 'Student-linked tasks are available.',
  };

  if (probe.ok && probe.data?.error === 'missing_task_anchor') {
    capability.linkedAnchors = true;
    capability.message = 'Lead-linked and metadata-preserving task creation is available.';
  } else if (!probe.ok) {
    capability.message = String(probe.error || 'Linked task anchors are not yet available in this runtime.');
  }

  return structuredClone(setCachedValue('hq:task-capabilities', capability));
}

function filterTaskItems(items = [], searchParams = null, session = null) {
  const requestedAssignee = String(searchParams?.get?.('assigned_to') || '').trim().toLowerCase();
  const requestedStatus = String(searchParams?.get?.('status') || '').trim().toLowerCase();
  const requestedPriority = String(searchParams?.get?.('priority') || '').trim();
  const requestedEntity = String(searchParams?.get?.('entity') || '').trim().toLowerCase();
  const requestedQuery = String(searchParams?.get?.('q') || '').trim().toLowerCase();
  const scope = getSessionScope(session);

  return items.filter((item) => {
    if (!scope.is_all && item.assigned_to !== scope.assignee) {
      return false;
    }

    if (requestedAssignee && item.assigned_to !== resolveScopedTaskAssignee(requestedAssignee, session)) {
      return false;
    }

    if (requestedStatus && item.status_bucket !== requestedStatus && item.task_status !== requestedStatus) {
      return false;
    }

    if (requestedPriority && String(item.priority) !== requestedPriority) {
      return false;
    }

    if (requestedEntity && item.linked_entity_type !== requestedEntity) {
      return false;
    }

    if (requestedQuery) {
      const haystack = `${item.title} ${item.description} ${item.person_name} ${item.linked_entity_label}`.toLowerCase();
      if (!haystack.includes(requestedQuery)) {
        return false;
      }
    }

    return true;
  });
}

async function getSupabaseTasks(session = null, searchParams = new URLSearchParams()) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return buildBridgeError('supabase', 'Supabase bridge is not configured.', targetLabel(CONFIG.supabaseUrl));
  }

  const scope = getSessionScope(session);
  const requestedAssignee = scope.is_all
    ? (String(searchParams.get('assigned_to') || '').trim() ? resolveScopedTaskAssignee(searchParams.get('assigned_to'), session) : null)
    : scope.assignee;
  const requestedStudentId = String(searchParams.get('student_id') || '').trim() || null;
  const requestedStatus = mapTaskStatusForWrite(searchParams.get('status'));
  const rawResponse = await fetchSupabaseRpc('mmac_cc_list_tasks', {
    p_student_id: requestedStudentId,
    p_status: requestedStatus,
    p_assigned_to: requestedAssignee || null,
  });

  if (!rawResponse.ok) {
    return buildBridgeError('supabase', rawResponse.error, targetLabel(CONFIG.supabaseUrl));
  }

  const allItems = Array.isArray(rawResponse.data) ? rawResponse.data.map(transformTaskRow) : [];
  const items = filterTaskItems(allItems, searchParams, session);
  const assignees = [...new Set(allItems.map((item) => item.assigned_to).filter(Boolean))].map((value) => ({
    value,
    label: formatAssigneeLabel(value),
  }));
  const payload = {
    mode: 'live',
    bridge: 'supabase',
    transport: 'rpc:mmac_cc_list_tasks',
    capabilities: await getTaskCapabilities(),
    counts: buildTaskCounts(items),
    assignees,
    items,
  };

  return logDataResolution('hq-tasks', payload);
}

function buildTaskDescriptionWithContext(payload = {}) {
  const description = String(payload.description || '').trim();
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const contextLines = [];

  if (metadata.thread_subject) {
    contextLines.push(`Thread: ${metadata.thread_subject}`);
  }
  if (metadata.payment_label) {
    contextLines.push(`Payment: ${metadata.payment_label}`);
  }
  if (metadata.note) {
    contextLines.push(String(metadata.note));
  }

  if (!contextLines.length) {
    return description || null;
  }

  return [description, ...contextLines]
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function extractTaskMutationRow(data) {
  if (data?.task) {
    return data.task;
  }
  return data;
}

async function createSupabaseTask(payload = {}, session = null) {
  const title = String(payload.title || '').trim();
  if (!title) {
    return buildValidationError('missing_title', 'Tasks require a title.');
  }

  const capabilities = await getTaskCapabilities();
  const studentId = String(payload.student_id || '').trim() || null;
  const leadId = String(payload.lead_id || '').trim() || null;
  const assignee = resolveScopedTaskAssignee(payload.assigned_to, session);
  const createdBy = String(session?.user?.login || payload.created_by || session?.user?.displayName || 'hq').trim().toLowerCase();
  const dueAt = String(payload.due_at || payload.due_date || '').trim() || null;
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const wantsLinkedMetadata = Boolean(leadId || Object.keys(metadata).length || payload.source_record_id || payload.source_system);
  let response;

  if (capabilities.linkedAnchors && (leadId || wantsLinkedMetadata)) {
    response = await fetchSupabaseRpc('mmac_cc_create_task_linked', {
      p_student_id: studentId,
      p_lead_id: leadId,
      p_title: title,
      p_description: buildTaskDescriptionWithContext(payload),
      p_assigned_to: assignee,
      p_created_by: createdBy,
      p_priority: normalizeTaskPriorityValue(payload.priority),
      p_due_at: dueAt,
      p_source_system: String(payload.source_system || 'hq').trim() || 'hq',
      p_source_record_id: String(payload.source_record_id || '').trim() || null,
      p_metadata: metadata,
    });
  } else if (studentId) {
    response = await fetchSupabaseRpc('mmac_cc_create_task', {
      p_student_id: studentId,
      p_title: title,
      p_description: buildTaskDescriptionWithContext(payload),
      p_assigned_to: assignee,
      p_created_by: createdBy,
      p_priority: normalizeTaskPriorityValue(payload.priority),
      p_due_at: dueAt,
    });
  } else {
    return buildValidationError(
      'missing_anchor',
      capabilities.linkedAnchors
        ? 'This task needs a lead or student anchor before it can be created.'
        : 'Lead-linked task creation is not available in the live database.',
      { capabilities },
    );
  }

  if (!response.ok || response.data?.error) {
    return buildApiError(502, response.data?.error || 'task_create_failed', response.data?.error || response.error || 'Task creation failed.', {
      bridge: 'supabase',
      capabilities,
    });
  }

  invalidateDerivedCaches();

  return {
    mode: 'live',
    bridge: 'supabase',
    capabilities,
    message: 'Task created.',
    task: transformTaskRow(extractTaskMutationRow(response.data)),
  };
}

async function updateSupabaseTask(taskId, payload = {}, session = null) {
  const resolvedTaskId = String(taskId || '').trim();
  if (!resolvedTaskId) {
    return buildValidationError('missing_task_id', 'Task ID is required.');
  }

  const assignee = payload.assigned_to ? resolveScopedTaskAssignee(payload.assigned_to, session) : null;
  const response = await fetchSupabaseRpc('mmac_cc_update_task', {
    p_task_id: resolvedTaskId,
    p_task_status: mapTaskStatusForWrite(payload.task_status || payload.status_bucket || payload.status),
    p_assigned_to: assignee,
    p_priority: payload.priority !== undefined ? normalizeTaskPriorityValue(payload.priority) : null,
  });

  if (!response.ok || response.data?.error) {
    return buildApiError(502, response.data?.error || 'task_update_failed', response.data?.error || response.error || 'Task update failed.', {
      bridge: 'supabase',
    });
  }

  invalidateDerivedCaches();

  return {
    mode: 'live',
    bridge: 'supabase',
    message: 'Task updated.',
    task: transformTaskRow(extractTaskMutationRow(response.data)),
  };
}

function normalizeMedMailThreadSubject(subject = '') {
  let normalized = String(subject || '').trim();
  while (/^(re|fw|fwd):\s*/iu.test(normalized)) {
    normalized = normalized.replace(/^(re|fw|fwd):\s*/iu, '').trim();
  }
  return normalized || 'No subject';
}

function classifyMedMailItem(email = {}) {
  const haystack = `${email.subject || ''} ${email.preview_text || ''}`.toLowerCase();
  const labels = [];

  if (/(payment|invoice|installment|refund|stripe|zelle|card)/u.test(haystack)) {
    labels.push('payment');
  }
  if (/(enrollment|join|mentorship|program|course|account)/u.test(haystack)) {
    labels.push('enrollment');
  }
  if (/(usce|clinical|rotation|clinicals)/u.test(haystack)) {
    labels.push('clinicals');
  }
  if (/(usmle|step|exam prep|drill)/u.test(haystack)) {
    labels.push('usmle');
  }
  if (/(error|access|login|password)/u.test(haystack)) {
    labels.push('account');
  }

  if (!labels.length) {
    labels.push('general');
  }

  return {
    labels,
    primary: labels[0],
  };
}

function buildMedMailFollowUp(email = {}, classification = { primary: 'general' }) {
  const baseTime = email.sent_at || email.created_at;
  if (!baseTime) {
    return {
      state: 'unknown',
      due_at: '',
      label: 'No follow-up date available.',
    };
  }

  const dueAt = new Date(baseTime);
  const followUpDays = classification.primary === 'payment'
    ? 3
    : classification.primary === 'enrollment'
      ? 5
      : 7;
  dueAt.setUTCDate(dueAt.getUTCDate() + followUpDays);
  const diffMs = dueAt.getTime() - Date.now();
  const diffDays = Math.ceil(Math.abs(diffMs) / 86400000);

  if (diffMs < 0) {
    return {
      state: 'overdue',
      due_at: dueAt.toISOString(),
      label: `Follow-up overdue by ${Math.max(diffDays, 1)} day${diffDays === 1 ? '' : 's'}.`,
    };
  }

  if (diffMs < 2 * 86400000) {
    return {
      state: 'due_soon',
      due_at: dueAt.toISOString(),
      label: 'Follow-up due within 48 hours.',
    };
  }

  return {
    state: 'scheduled',
    due_at: dueAt.toISOString(),
    label: `Follow-up due ${dueAt.toLocaleDateString('en-US')}.`,
  };
}

function firstNameFromDisplayName(value = '') {
  return String(value || '').trim().split(/\s+/u).filter(Boolean)[0] || 'there';
}

function buildMedMailSuggestedReplyPlaceholder(email = {}, classification = { primary: 'general' }) {
  const name = firstNameFromDisplayName(email.person_name);

  if (classification.primary === 'payment') {
    return `Hi ${name},\n\nFollowing up on your payment thread so we can keep everything moving on schedule. Please send the update you have, and we will confirm the next step from HQ.\n\nBest,\nMissionMed HQ`;
  }

  if (classification.primary === 'enrollment') {
    return `Hi ${name},\n\nFollowing up on your enrollment questions. Please reply with the latest update you need help with, and we will route the right next step for you.\n\nBest,\nMissionMed HQ`;
  }

  return `Hi ${name},\n\nFollowing up on this MissionMed thread. Please send your latest update, and we will take it from there.\n\nBest,\nMissionMed HQ`;
}

function enrichMedMailQueue(items = []) {
  const threadMap = new Map();
  const enrichedItems = items.map((email) => {
    const classification = classifyMedMailItem(email);
    const normalizedSubject = normalizeMedMailThreadSubject(email.subject);
    const threadId = `${email.student_id || email.person_name || 'unknown'}:${normalizedSubject.toLowerCase()}`;
    const followUp = buildMedMailFollowUp(email, classification);
    const enriched = {
      ...email,
      thread_id: threadId,
      thread_subject: normalizedSubject,
      classification_labels: classification.labels,
      classification_primary: classification.primary,
      follow_up: followUp,
      suggested_reply_placeholder: buildMedMailSuggestedReplyPlaceholder(email, classification),
    };

    const existingThread = threadMap.get(threadId) || {
      id: threadId,
      subject: normalizedSubject,
      person_name: email.person_name || 'Unknown contact',
      student_id: email.student_id || '',
      classification_primary: classification.primary,
      classification_labels: [...classification.labels],
      latest_at: email.sent_at || email.created_at || '',
      items: [],
    };

    existingThread.items.push(enriched);
    existingThread.latest_at = [existingThread.latest_at, email.sent_at, email.created_at]
      .filter(Boolean)
      .sort()
      .at(-1) || existingThread.latest_at;
    existingThread.classification_labels = [...new Set([
      ...existingThread.classification_labels,
      ...classification.labels,
    ])];

    if (followUp.state === 'overdue') {
      existingThread.follow_up_state = 'overdue';
      existingThread.follow_up_due_at = followUp.due_at;
      existingThread.follow_up_label = followUp.label;
    } else if (!existingThread.follow_up_state) {
      existingThread.follow_up_state = followUp.state;
      existingThread.follow_up_due_at = followUp.due_at;
      existingThread.follow_up_label = followUp.label;
    }

    threadMap.set(threadId, existingThread);
    return enriched;
  });

  const threads = [...threadMap.values()]
    .map((thread) => ({
      ...thread,
      item_count: thread.items.length,
      preview_text: thread.items[0]?.preview_text || '',
    }))
    .sort((left, right) => new Date(right.latest_at || 0).getTime() - new Date(left.latest_at || 0).getTime());

  return { items: enrichedItems, threads };
}

async function getHqMedMail(session = null) {
  const scope = getSessionScope(session);
  const cacheKey = `hq:medmail:${scope.assignee || 'all'}:${scope.is_all ? 'all' : scope.division}`;
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return structuredClone(cached);
  }

  const response = await getEmails(session);
  if (response?.httpStatus) {
    return response;
  }
  const { items, threads } = enrichMedMailQueue(response.items || []);
  const payload = {
    mode: response.mode,
    bridge: response.bridge,
    transport: response.transport,
    metrics: {
      items: items.length,
      threads: threads.length,
      overdue_follow_ups: items.filter((item) => item.follow_up?.state === 'overdue').length,
      sent: items.filter((item) => item.draft_status === 'sent').length,
    },
    items,
    threads,
  };

  return structuredClone(setCachedValue(cacheKey, logDataResolution('hq-medmail', payload)));
}

function getRenderableWordPressTitle(value) {
  if (value && typeof value === 'object') {
    return value.rendered || value.raw || '';
  }
  return String(value || '');
}

async function fetchAllWordPressCoreItems(relativePath, options = {}) {
  const {
    session = null,
    perPage = 100,
    maxPages = 5,
    query = {},
  } = options;

  const allItems = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    params.set('per_page', String(perPage));
    params.set('page', String(page));

    const response = await fetchWordPressCore(relativePath, params, getWordPressCoreAuthorization(session));
    if (!response.ok) {
      if (page === 1) {
        return response;
      }
      break;
    }

    const pageItems = Array.isArray(response.data) ? response.data : [];
    allItems.push(...pageItems);
    if (pageItems.length < perPage) {
      break;
    }
  }

  return {
    ok: true,
    status: 200,
    data: allItems,
  };
}

function buildWordPressAdminEditUrl(postId) {
  if (!CONFIG.wpBase || !postId) {
    return '';
  }

  const url = new URL('/wp-admin/post.php', CONFIG.wpBase);
  url.searchParams.set('post', String(postId));
  url.searchParams.set('action', 'edit');
  return url.toString();
}

function guessCourseDivision(course) {
  const title = getRenderableWordPressTitle(course?.title).toLowerCase();
  const id = Number(course?.id || 0);

  if ([3893, 5227, 3646].includes(id) || /(mission residency|interview prep|match mentorship|360 match)/u.test(title)) {
    return 'mission_residency';
  }
  if (/(usmle|examprep|team drilling|drilling|tutoring|step)/u.test(title)) {
    return 'usmle_drills';
  }
  if (/(clinical|clinicals|rotation|usce)/u.test(title)) {
    return 'usce';
  }
  return 'other';
}

async function getCourseCatalog(session = null) {
  const cached = getCachedValue('hq:courses');
  if (cached) {
    return structuredClone(cached);
  }

  const response = await fetchAllWordPressCoreItems('/wp/v2/sfwd-courses', {
    session,
    perPage: 50,
    maxPages: 2,
    query: {
      context: 'edit',
      _fields: 'id,slug,link,title,modified',
    },
  });

  if (!response.ok) {
    return buildBridgeError('wordpress_core', response.error || 'Course catalog could not be loaded.', targetLabel(CONFIG.wpBase));
  }

  const items = response.data.map((course) => ({
    id: Number(course.id || 0),
    slug: String(course.slug || '').trim(),
    title: getRenderableWordPressTitle(course.title),
    link: course.link || '',
    modified: course.modified || '',
    division_guess: guessCourseDivision(course),
    edit_url: buildWordPressAdminEditUrl(course.id),
  }));

  const payload = {
    mode: 'live',
    bridge: 'wordpress-core',
    transport: 'wp/v2/sfwd-courses',
    items,
  };

  return structuredClone(setCachedValue('hq:courses', payload));
}

function extractCourseSlugFromLessonLink(link = '') {
  try {
    const parsed = new URL(link);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const courseIndex = parts.findIndex((part) => part === 'courses');
    return courseIndex >= 0 ? parts[courseIndex + 1] || '' : '';
  } catch {
    return '';
  }
}

function extractVideoShortcodeIds(content = '') {
  const matches = [];
  const pattern = /\[(?:mmi_video|mm_video|mmed_video)\b[^\]]*\bid=["']([^"']+)["'][^\]]*\]/giu;
  let current = pattern.exec(String(content || ''));

  while (current) {
    if (current[1]) {
      matches.push(String(current[1]).trim());
    }
    current = pattern.exec(String(content || ''));
  }

  return [...new Set(matches.filter(Boolean))];
}

async function getLessonVideoScan(session = null) {
  const cached = getCachedValue('hq:lesson-video-scan');
  if (cached) {
    return structuredClone(cached);
  }

  const courses = await getCourseCatalog(session);
  if (courses?.httpStatus) {
    return courses;
  }
  const courseBySlug = new Map((courses.items || []).map((course) => [course.slug, course]));
  const response = await fetchAllWordPressCoreItems('/wp/v2/sfwd-lessons', {
    session,
    perPage: 50,
    maxPages: 4,
    query: {
      context: 'edit',
      _fields: 'id,slug,link,title,modified,content',
    },
  });

  if (!response.ok) {
    return buildBridgeError('wordpress_core', response.error || 'Lesson video scan could not be loaded.', targetLabel(CONFIG.wpBase));
  }

  const byVideoId = new Map();
  const items = response.data.map((lesson) => {
    const courseSlug = extractCourseSlugFromLessonLink(lesson.link);
    const course = courseBySlug.get(courseSlug) || null;
    const videoIds = extractVideoShortcodeIds(lesson.content?.raw || '');
    const item = {
      id: Number(lesson.id || 0),
      slug: String(lesson.slug || '').trim(),
      title: getRenderableWordPressTitle(lesson.title),
      link: lesson.link || '',
      modified: lesson.modified || '',
      course_id: course?.id || 0,
      course_slug: courseSlug,
      course_title: course?.title || 'Unknown course',
      edit_url: buildWordPressAdminEditUrl(lesson.id),
      video_ids: videoIds,
    };

    for (const videoId of videoIds) {
      const bucket = byVideoId.get(videoId) || {
        video_id: videoId,
        lessons: [],
        courses: new Map(),
        latest_modified: '',
      };

      bucket.lessons.push({
        id: item.id,
        title: item.title,
        course_id: item.course_id,
        course_title: item.course_title,
        link: item.link,
        edit_url: item.edit_url,
        modified: item.modified,
      });

      if (item.course_id) {
        bucket.courses.set(item.course_id, {
          id: item.course_id,
          title: item.course_title,
          slug: item.course_slug,
          edit_url: course?.edit_url || '',
          link: course?.link || '',
        });
      }

      bucket.latest_modified = [bucket.latest_modified, item.modified].filter(Boolean).sort().at(-1) || bucket.latest_modified;
      byVideoId.set(videoId, bucket);
    }

    return item;
  });

  const payload = {
    mode: 'live',
    bridge: 'wordpress-core',
    items,
    by_video_id: Object.fromEntries([...byVideoId.entries()].map(([videoId, bucket]) => [
      videoId,
      {
        video_id: videoId,
        lesson_count: bucket.lessons.length,
        lessons: bucket.lessons.sort((left, right) => new Date(right.modified || 0).getTime() - new Date(left.modified || 0).getTime()),
        courses: [...bucket.courses.values()],
        latest_modified: bucket.latest_modified,
      },
    ])),
  };

  return structuredClone(setCachedValue('hq:lesson-video-scan', payload, VIDEO_WORKFLOW_CACHE_TTL_MS));
}

function matchSuggestedCourses(haystack = '', division = '', courses = []) {
  const normalizedDivision = normalizeDivisionSlug(division);
  const searchable = String(haystack || '').toLowerCase();

  return [...courses]
    .map((course) => {
      let score = 0;
      if (course.division_guess === normalizedDivision) {
        score += 20;
      }
      if (searchable && searchable.includes(course.title.toLowerCase())) {
        score += 30;
      }
      if (normalizedDivision === 'mission_residency' && /(interview|match|residency)/u.test(course.title.toLowerCase()) && /(interview|match|residency)/u.test(searchable)) {
        score += 12;
      }
      if (normalizedDivision === 'usmle_drills' && /(usmle|exam|drill|tutoring|step)/u.test(course.title.toLowerCase()) && /(usmle|exam|drill|tutoring|step)/u.test(searchable)) {
        score += 12;
      }
      if (normalizedDivision === 'usce' && /(clinical|rotation|usce)/u.test(course.title.toLowerCase()) && /(clinical|rotation|usce)/u.test(searchable)) {
        score += 12;
      }
      return { ...course, score };
    })
    .filter((course) => course.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

async function getVideoWorkflow(session = null) {
  const cached = getCachedValue('hq:video-workflow');
  if (cached) {
    return structuredClone(cached);
  }

  const [courses, lessonScan, studioWorkspace, mediaList] = await Promise.all([
    getCourseCatalog(session),
    getLessonVideoScan(session),
    getStudioWorkspace(),
    getMediaList(new URLSearchParams({ page_size: '200' })),
  ]);

  const issuePayloads = [courses, lessonScan, studioWorkspace, mediaList]
    .filter((payload) => payload && typeof payload === 'object' && Number.isInteger(payload.httpStatus));

  if (issuePayloads.length) {
    return buildApiError(503, 'video_workflow_unavailable', 'Video workflow could not be loaded from live services.', {
      bridge: 'video_workflow',
      issues: issuePayloads.map((payload) => ({
        bridge: payload.bridge || '',
        error: payload.error,
        message: payload.message,
      })),
    });
  }

  const mediaItems = mediaList.data?.items || [];
  const byVideoId = lessonScan.by_video_id || {};
  const publishedIds = new Set(Object.keys(byVideoId));
  const courseItems = courses.items || [];

  const assetItems = mediaItems.map((item) => {
    const videoUsage = byVideoId[item.id] || null;
    const courseMatches = videoUsage?.courses || [];
    const suggestedCourses = matchSuggestedCourses(
      `${item.title} ${item.category} ${(item.tags || []).join(' ')}`,
      item.division,
      courseItems,
    );

    return {
      id: item.id,
      type: 'asset',
      title: item.title,
      division: normalizeDivisionSlug(item.division),
      division_label: formatDivisionLabel(item.division),
      category: item.category || 'General',
      source: item.source,
      shortcode: `[mmi_video id="${item.id}"]`,
      edit_url: '',
      status_bucket: publishedIds.has(item.id)
        ? 'published'
        : String(item.status || '').toLowerCase() === 'active'
          ? 'ready'
          : 'draft',
      linked_courses: courseMatches,
      linked_lessons: videoUsage?.lessons || [],
      linked_lesson_count: videoUsage?.lesson_count || 0,
      latest_published_at: videoUsage?.latest_modified || '',
      suggested_courses: suggestedCourses,
      transcript_excerpt: item.transcript_excerpt || '',
      duration_label: item.duration_label || '',
    };
  });

  const draftProjects = (studioWorkspace.projects || []).map((project) => ({
    id: project.id,
    type: 'studio_project',
    title: project.name,
    division: 'other',
    division_label: 'Studio',
    category: 'Studio Draft',
    source: 'studio',
    shortcode: '',
    edit_url: studioWorkspace.status?.launch_url || '',
    status_bucket: 'draft',
    linked_courses: [],
    linked_lessons: [],
    linked_lesson_count: 0,
    latest_published_at: '',
    suggested_courses: matchSuggestedCourses(project.name, '', courseItems),
    transcript_excerpt: `${project.clip_count || 0} clips in timeline`,
    duration_label: '',
  }));

  const items = [...draftProjects, ...assetItems]
    .sort((left, right) => new Date(right.latest_published_at || 0).getTime() - new Date(left.latest_published_at || 0).getTime());
  const payload = {
    mode: 'live',
    bridge: 'video_workflow',
    metrics: {
      draft: items.filter((item) => item.status_bucket === 'draft').length,
      ready: items.filter((item) => item.status_bucket === 'ready').length,
      published: items.filter((item) => item.status_bucket === 'published').length,
      lessons_with_video: lessonScan.items?.filter((item) => item.video_ids.length).length || 0,
      courses: courseItems.length,
    },
    courses: courseItems,
    items,
    recent_publications: items
      .filter((item) => item.status_bucket === 'published' && item.latest_published_at)
      .sort((left, right) => new Date(right.latest_published_at || 0).getTime() - new Date(left.latest_published_at || 0).getTime())
      .slice(0, 6),
    studio: {
      status: studioWorkspace.status,
      projects: studioWorkspace.projects || [],
      exportQueue: studioWorkspace.exportQueue || [],
    },
  };

  return structuredClone(setCachedValue('hq:video-workflow', payload, VIDEO_WORKFLOW_CACHE_TTL_MS));
}

async function getSupabasePaymentsData(session = null) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return buildBridgeError('supabase', 'Supabase bridge is not configured.', targetLabel(CONFIG.supabaseUrl));
  }

  const [paymentRows, studentsResponse] = await Promise.all([
    fetchSupabaseRpc('mmac_cc_list_payments', {
      p_student_id: null,
    }),
    getSupabaseStudents(new URLSearchParams(), session),
  ]);

  if (!paymentRows.ok) {
    return buildBridgeError('supabase', paymentRows.error || 'Payments could not be loaded from Supabase.', targetLabel(CONFIG.supabaseUrl));
  }

  const studentLookup = Object.fromEntries((studentsResponse.items || []).map((student) => [student.id, student]));
  const transformed = Array.isArray(paymentRows.data) ? paymentRows.data.map((row) => transformPaymentRow(row, studentLookup)) : [];
  const scope = getSessionScope(session);
  const items = transformed.filter((payment) => (
    scope.is_all ? true : payment.assigned_to === scope.assignee
  ));

  return {
    mode: 'live',
    bridge: 'supabase',
    transport: 'rpc:mmac_cc_list_payments',
    items,
  };
}

async function buildStripeAccountsFromPayments(payments = [], session = null) {
  const scope = getSessionScope(session);
  const owners = Object.values(OPERATOR_SCOPES).filter((entry) => (scope.is_all ? true : entry.operator === scope.operator));
  const groupedPayments = owners.map((entry) => {
    const ownerPayments = payments
      .filter((payment) => payment.assigned_to === entry.assignee)
      .sort((left, right) => new Date(right.payment_at || 0).getTime() - new Date(left.payment_at || 0).getTime());
    return { entry, ownerPayments };
  });

  const items = await Promise.all(groupedPayments.map(async ({ entry, ownerPayments }) => {
    const recentAccountId = ownerPayments.find((payment) => payment.stripe_account)?.stripe_account || '';
    const storedStatus = await getStripeStatusPayload(entry.operator, session, { persist: false });

    if (storedStatus.mode !== 'error' || storedStatus.account_id_masked) {
      return {
        owner_key: entry.operator,
        owner_name: entry.owner_name,
        division: entry.division,
        division_label: entry.division_label,
        connected: Boolean(storedStatus.connected),
        status: storedStatus.status || 'unknown',
        readiness: storedStatus.readiness || 'attention',
        can_receive: Boolean(storedStatus.can_receive),
        last_updated: storedStatus.last_updated || null,
        message: storedStatus.message || 'Stripe status available from stored mapping.',
        account_id: storedStatus.account_id || '',
        account_id_masked: storedStatus.account_id_masked || '',
        requirements_due: storedStatus.requirements_due || [],
        action_required: Boolean(storedStatus.action_required),
        issues: storedStatus.error ? [storedStatus.error] : [],
        source: storedStatus.mode,
      };
    }

    if (recentAccountId && CONFIG.stripeSecretKey) {
      const live = await fetchStripeConnectedAccount(recentAccountId);
      if (live.ok) {
        const derived = buildStripeStatusFromAccount(live.data);
        return {
          owner_key: entry.operator,
          owner_name: entry.owner_name,
          division: entry.division,
          division_label: entry.division_label,
          connected: true,
          status: derived.status,
          readiness: derived.readiness,
          can_receive: Boolean(derived.can_receive),
          last_updated: ownerPayments[0]?.payment_at || null,
          message: derived.message,
          account_id: maskStripeAccountId(recentAccountId),
          account_id_masked: maskStripeAccountId(recentAccountId),
          requirements_due: derived.requirements_due,
          action_required: Boolean(derived.action_required),
          issues: [],
          source: 'payment-history',
        };
      }
    }

    return {
      owner_key: entry.operator,
      owner_name: entry.owner_name,
      division: entry.division,
      division_label: entry.division_label,
      connected: false,
      status: recentAccountId ? 'unknown' : 'unavailable',
      readiness: recentAccountId ? 'attention' : 'blocked',
      can_receive: false,
      last_updated: ownerPayments[0]?.payment_at || null,
      message: recentAccountId
        ? 'Stripe account was seen in payment history, but live status could not be confirmed.'
        : 'No recent Stripe account mapping is available for this owner.',
      account_id: recentAccountId ? maskStripeAccountId(recentAccountId) : '',
      account_id_masked: recentAccountId ? maskStripeAccountId(recentAccountId) : '',
      requirements_due: [],
      action_required: false,
      issues: [],
      source: recentAccountId ? 'payment-history' : 'unavailable',
    };
  }));

  return items;
}

function enrichPaymentWithEnrollment(payment, courses = [], stripeAccounts = []) {
  const metadata = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
  const lineItems = Array.isArray(metadata.line_items) ? metadata.line_items : [];
  const lineItemNames = lineItems.map((item) => item.name || '').join(' ');
  const directCourseIds = {
    3575: 3893,
    3576: 5227,
    3577: 3646,
  };
  const directCourses = lineItems
    .map((item) => courses.find((course) => course.id === directCourseIds[Number(item.product_id || 0)]))
    .filter(Boolean);
  const suggestedCourses = matchSuggestedCourses(
    `${payment.product_name || ''} ${lineItemNames}`,
    payment.division,
    courses,
  );
  const stripeAccount = stripeAccounts.find((item) => item.owner_key === payment.assigned_to) || null;

  return {
    ...payment,
    billing_email: metadata.billing?.email || '',
    billing_phone: metadata.billing?.phone || '',
    line_items: lineItems,
    transaction_id: metadata.transaction_id || metadata.processor_payment_id || payment.processor_payment_id || '',
    order_id: Number(metadata.order_id || payment.order_id || 0),
    enrollment_linkage: {
      state: directCourses.length
        ? 'mapped'
        : suggestedCourses.length
          ? 'suggested'
          : 'unmapped',
      direct_courses: directCourses,
      suggested_courses: suggestedCourses,
    },
    stripe_status: stripeAccount,
  };
}

async function getHqPayments(searchParams = new URLSearchParams(), session = null) {
  const scope = getSessionScope(session);
  const cacheKey = `hq:payments:${scope.assignee || 'all'}:${scope.is_all ? 'all' : scope.division}`;
  const cached = getCachedValue(cacheKey);
  if (cached) {
    const cachedItems = structuredClone(cached);
    const filteredItems = cachedItems.items.filter((payment) => {
      const requestedDivision = String(searchParams.get('division') || '').trim().toLowerCase();
      const requestedStatus = String(searchParams.get('status') || '').trim().toLowerCase();
      if (requestedDivision && payment.division !== requestedDivision) {
        return false;
      }
      if (requestedStatus && String(payment.payment_status || '').toLowerCase() !== requestedStatus) {
        return false;
      }
      return true;
    });
    cachedItems.items = filteredItems;
    return cachedItems;
  }

  const [paymentsResponse, coursesResponse] = await Promise.all([
    getSupabasePaymentsData(session),
    getCourseCatalog(session),
  ]);

  if (paymentsResponse?.httpStatus) {
    return paymentsResponse;
  }
  if (coursesResponse?.httpStatus) {
    return coursesResponse;
  }

  const stripeAccounts = await buildStripeAccountsFromPayments(paymentsResponse.items || [], session);
  const courses = coursesResponse.items || [];
  const enrichedItems = (paymentsResponse.items || []).map((payment) => enrichPaymentWithEnrollment(payment, courses, stripeAccounts));

  const divisions = enrichedItems.reduce((accumulator, payment) => {
    const current = accumulator.get(payment.division) || {
      division: payment.division,
      division_label: payment.division_label,
      transaction_count: 0,
      failed_count: 0,
      total_amount_value: 0,
      total_amount_display: '$0',
    };

    current.transaction_count += 1;
    if (!['succeeded', 'active', 'complete'].includes(String(payment.payment_status || '').toLowerCase())) {
      current.failed_count += 1;
    }
    current.total_amount_value += Number(payment.amount_value || 0);
    current.total_amount_display = formatAmount(current.total_amount_value, payment.currency || 'usd');
    accumulator.set(payment.division, current);
    return accumulator;
  }, new Map());

  const payload = {
    mode: paymentsResponse.mode,
    bridge: paymentsResponse.bridge,
    items: enrichedItems,
    cards: [
      { label: 'Transactions', value: enrichedItems.length },
      { label: 'Captured Revenue', value: formatAmount(enrichedItems.filter((item) => item.payment_status === 'succeeded').reduce((sum, item) => sum + Number(item.amount_value || 0), 0)) },
      { label: 'Needs Review', value: enrichedItems.filter((item) => item.payment_status !== 'succeeded').length },
      { label: 'Mapped Enrollments', value: enrichedItems.filter((item) => item.enrollment_linkage.state === 'mapped').length },
    ],
    divisions: [...divisions.values()],
    stripe_accounts: stripeAccounts,
    exceptions: {
      failed_payments: enrichedItems.filter((item) => item.payment_status !== 'succeeded'),
      missing_enrollments: enrichedItems.filter((item) => item.payment_status === 'succeeded' && item.enrollment_linkage.state === 'unmapped'),
    },
    course_catalog: courses,
    refunds: {
      backend_ready: false,
      mode: 'ui_only',
      message: 'Refund execution still depends on a confirmed live backend route.',
    },
  };

  const cachedPayload = structuredClone(setCachedValue(cacheKey, logDataResolution('hq-payments', payload)));
  const requestedDivision = String(searchParams.get('division') || '').trim().toLowerCase();
  const requestedStatus = String(searchParams.get('status') || '').trim().toLowerCase();
  cachedPayload.items = cachedPayload.items.filter((payment) => {
    if (requestedDivision && payment.division !== requestedDivision) {
      return false;
    }
    if (requestedStatus && String(payment.payment_status || '').toLowerCase() !== requestedStatus) {
      return false;
    }
    return true;
  });

  return cachedPayload;
}

async function getHqPaymentsOverview(searchParams = new URLSearchParams(), session = null) {
  const payments = await getHqPayments(searchParams, session);
  if (payments?.httpStatus) {
    return payments;
  }

  const items = payments.items || [];
  const stripeAccounts = payments.stripe_accounts || [];

  return {
    mode: payments.mode,
    bridge: payments.bridge,
    cards: payments.cards || [],
    divisions: payments.divisions || [],
    meta: {
      transaction_count: items.length,
      failed_transactions: items.filter((item) => item.payment_status !== 'succeeded').length,
      stripe_accounts: stripeAccounts.length,
      mapped_enrollments: items.filter((item) => item.enrollment_linkage?.state === 'mapped').length,
    },
  };
}

async function getHqPaymentStripeAccounts(searchParams = new URLSearchParams(), session = null) {
  const payments = await getHqPayments(searchParams, session);
  if (payments?.httpStatus) {
    return payments;
  }

  return {
    mode: payments.mode,
    bridge: payments.bridge,
    items: payments.stripe_accounts || [],
  };
}

async function getHqPaymentExceptions(searchParams = new URLSearchParams(), session = null) {
  const payments = await getHqPayments(searchParams, session);
  if (payments?.httpStatus) {
    return payments;
  }

  const stripeAccounts = (payments.stripe_accounts || []).filter((account) => (
    Boolean(account.action_required)
    || Array.isArray(account.issues) && account.issues.length > 0
    || Array.isArray(account.requirements_due) && account.requirements_due.length > 0
  ));

  return {
    mode: payments.mode,
    bridge: payments.bridge,
    summary: {
      total: (payments.exceptions?.failed_payments || []).length + (payments.exceptions?.missing_enrollments || []).length,
    },
    failed_payments: payments.exceptions?.failed_payments || [],
    missing_enrollments: payments.exceptions?.missing_enrollments || [],
    stripe_accounts: stripeAccounts,
  };
}

async function getHqNotifications(session = null) {
  const cached = getCachedValue('hq:notifications');
  if (cached) {
    return structuredClone(cached);
  }

  const [tasks, payments, medmail, leads, videoWorkflow] = await Promise.all([
    getSupabaseTasks(session, new URLSearchParams()),
    getHqPayments(new URLSearchParams(), session),
    getHqMedMail(session),
    getSupabaseLeads(session),
    getVideoWorkflow(session),
  ]);

  const corePayloads = [tasks, payments, medmail, leads];
  const coreIssues = corePayloads
    .filter((payload) => payload && typeof payload === 'object' && Number.isInteger(payload.httpStatus));

  if (coreIssues.length) {
    return buildApiError(503, 'notifications_unavailable', 'Notifications could not be loaded from live services.', {
      bridge: 'hq_notifications',
      issues: coreIssues.map((payload) => ({
        bridge: payload.bridge || '',
        error: payload.error,
        message: payload.message,
      })),
    });
  }

  const videoUnavailable = videoWorkflow && typeof videoWorkflow === 'object' && Number.isInteger(videoWorkflow.httpStatus);

  const items = [];

  for (const lead of (leads.items || []).slice(0, 2)) {
    items.push({
      id: `lead:${lead.id}:${lead.updated_at}`,
      type: 'lead',
      title: 'Lead signal requires review',
      body: `${lead.name} is in ${lead.stage.replace(/_/gu, ' ').toLowerCase()} with score ${lead.score}.`,
      created_at: lead.updated_at,
      tone: lead.score >= 70 ? 'success' : 'info',
      route: '#leads',
    });
  }

  for (const payment of (payments.items || []).filter((item) => item.payment_status !== 'succeeded').slice(0, 2)) {
    items.push({
      id: `payment:${payment.id}:${payment.payment_at}`,
      type: 'payment',
      title: 'Payment needs operator attention',
      body: `${payment.person_name} has a ${payment.payment_status} payment for ${payment.amount}.`,
      created_at: payment.payment_at,
      tone: 'warning',
      route: '#payments',
    });
  }

  for (const task of (tasks.items || []).filter((item) => item.status_bucket !== 'done' && item.due_at).slice(0, 3)) {
    const isOverdue = new Date(task.due_at).getTime() < Date.now();
    items.push({
      id: `task:${task.id}:${task.updated_at || task.due_at}`,
      type: 'task',
      title: isOverdue ? 'Task deadline overdue' : 'Task deadline approaching',
      body: `${task.title} for ${task.linked_entity_label || task.person_name || 'MissionMed HQ'} is due ${task.due_at}.`,
      created_at: task.updated_at || task.due_at,
      tone: isOverdue ? 'critical' : 'warning',
      route: '#home',
    });
  }

  for (const thread of (medmail.threads || []).filter((item) => item.follow_up_state === 'overdue').slice(0, 2)) {
    items.push({
      id: `medmail:${thread.id}:${thread.latest_at}`,
      type: 'medmail',
      title: 'MedMail follow-up overdue',
      body: `${thread.subject} needs a follow-up for ${thread.person_name}.`,
      created_at: thread.latest_at,
      tone: 'warning',
      route: '#medmail',
    });
  }

  if (!videoUnavailable && videoWorkflow.metrics?.ready) {
    items.push({
      id: `video:ready:${videoWorkflow.metrics.ready}`,
      type: 'video',
      title: 'Ready videos waiting on course linkage',
      body: `${videoWorkflow.metrics.ready} ready video assets are not yet published in LearnDash lessons.`,
      created_at: new Date().toISOString(),
      tone: 'info',
      route: '#media-engine',
    });
  }

  const degradedBridges = [];
  if (videoUnavailable) {
    degradedBridges.push({ bridge: videoWorkflow.bridge || 'video_workflow', error: videoWorkflow.error, message: videoWorkflow.message });
  }

  const payload = {
    mode: degradedBridges.length ? 'degraded' : 'live',
    generated_at: new Date().toISOString(),
    issues: degradedBridges,
    counts: {
      total: items.length,
      tasks_due: tasks.counts?.overdue || 0,
      failed_payments: (payments.exceptions?.failed_payments || []).length,
      medmail_follow_ups: medmail.metrics?.overdue_follow_ups || 0,
    },
    items: items
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
      .slice(0, 12),
  };

  return structuredClone(setCachedValue('hq:notifications', logDataResolution('hq-notifications', payload), 60 * 1000));
}

async function getStripeStatusEndpoint(searchParams, session = null) {
  try {
    const ownerKey = resolveStripeOwnerKey(searchParams.get('owner'), session);
    const status = await getStripeStatusPayload(ownerKey, session);
    return {
      connected: Boolean(status.connected),
      account_id: status.account_id || '',
      requirements_due: normalizeStripeRequirements(status.requirements_due),
      status: status.status || 'not_connected',
      can_receive: Boolean(status.can_receive),
      action_required: Boolean(status.action_required),
      owner_key: status.owner_key || ownerKey,
      owner_name: status.owner_name || '',
      division: status.division || '',
      division_label: status.division_label || '',
      last_updated: status.last_updated || null,
      mode: status.mode || 'stored',
      configuration_state: status.configuration_state || 'configured',
      missing_env: Array.isArray(status.missing_env) ? status.missing_env : [],
      live_refresh_enabled: Boolean(status.live_refresh_enabled),
      message: status.message || describeStripeStatus(status.status, status.requirements_due),
    };
  } catch (error) {
    return {
      httpStatus: error instanceof Error && error.message === 'forbidden_owner' ? 403 : 400,
      error: error instanceof Error ? error.message : 'stripe_status_failed',
      message: error instanceof Error && error.message === 'forbidden_owner'
        ? 'You do not have access to that Stripe account.'
        : 'Stripe status could not be resolved.',
      connected: false,
      account_id: '',
      requirements_due: [],
    };
  }
}

async function handleStripeConnectStart(request, response, searchParams, session) {
  const missing = getStripeConnectMissingConfig();
  if (missing.length) {
    sendRedirect(response, buildStripeReturnUrl(request, {
      stripe_error: 'config_missing',
      stripe_owner: searchParams.get('owner') || '',
    }));
    return;
  }

  let ownerKey;
  try {
    ownerKey = resolveStripeOwnerKey(searchParams.get('owner'), session);
  } catch {
    sendRedirect(response, buildStripeReturnUrl(request, { stripe_error: 'forbidden_owner' }));
    return;
  }

  const authorizeUrl = new URL('https://connect.stripe.com/oauth/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', CONFIG.stripeConnectClientId);
  authorizeUrl.searchParams.set('scope', CONFIG.stripeConnectScope);
  authorizeUrl.searchParams.set('redirect_uri', resolveStripeConnectRedirectUri(request));
  authorizeUrl.searchParams.set('state', buildStripeConnectState(ownerKey, session));

  sendRedirect(response, authorizeUrl.toString());
}

async function handleStripeConnectCallback(request, response, searchParams, session) {
  let state;
  try {
    state = readStripeConnectState(searchParams.get('state') || '', session);
  } catch {
    sendRedirect(response, buildStripeReturnUrl(request, { stripe_error: 'invalid_state' }));
    return;
  }

  const ownerKey = state.ownerKey;
  const stripeError = String(searchParams.get('error') || '').trim();
  if (stripeError) {
    sendRedirect(response, buildStripeReturnUrl(request, {
      stripe_error: stripeError,
      stripe_owner: ownerKey,
    }));
    return;
  }

  const code = String(searchParams.get('code') || '').trim();
  if (!code) {
    sendRedirect(response, buildStripeReturnUrl(request, {
      stripe_error: 'missing_code',
      stripe_owner: ownerKey,
    }));
    return;
  }

  const exchange = await exchangeStripeAuthorizationCode(code);
  if (!exchange.ok) {
    sendRedirect(response, buildStripeReturnUrl(request, {
      stripe_error: 'token_exchange_failed',
      stripe_owner: ownerKey,
    }));
    return;
  }

  const stripeAccountId = String(exchange.data?.stripe_user_id || '').trim();
  if (!stripeAccountId) {
    sendRedirect(response, buildStripeReturnUrl(request, {
      stripe_error: 'missing_account_id',
      stripe_owner: ownerKey,
    }));
    return;
  }

  const account = await fetchStripeConnectedAccount(stripeAccountId);
  if (!account.ok) {
    sendRedirect(response, buildStripeReturnUrl(request, {
      stripe_error: 'account_lookup_failed',
      stripe_owner: ownerKey,
    }));
    return;
  }

  const derived = buildStripeStatusFromAccount(account.data);
  const persist = await persistStoredStripeOwnerDetail({
    owner_key: ownerKey,
    stripe_account_id: stripeAccountId,
    status: derived.status,
    requirements_due: derived.requirements_due,
    charges_enabled: derived.charges_enabled,
    payouts_enabled: derived.payouts_enabled,
    details_submitted: derived.details_submitted,
    disabled_reason: derived.disabled_reason,
    livemode: Boolean(account.data?.livemode),
    last_updated: new Date().toISOString(),
  }, session);

  if (!persist.ok) {
    sendRedirect(response, buildStripeReturnUrl(request, {
      stripe_error: 'mapping_store_failed',
      stripe_owner: ownerKey,
    }));
    return;
  }

  sendRedirect(response, buildStripeReturnUrl(request, {
    stripe: derived.action_required ? 'action_required' : 'connected',
    stripe_owner: ownerKey,
  }));
}

async function getWordPressStudents(searchParams, session = null) {
  const response = await fetchWordPress('/students', searchParams, session);
  return response.ok
    ? response.data
    : buildBridgeError('wordpress', response.error || 'WordPress students endpoint is unavailable.', targetLabel(CONFIG.wpBase));
}

async function getWordPressStudentDetail(studentId, session = null) {
  const response = await fetchWordPress(`/students/${studentId}`, null, session);
  if (response.ok) {
    return response.data;
  }
  if (response.status === 404) {
    return buildNotFoundError('student_not_found', 'Student was not found in WordPress.', {
      student_id: studentId,
    });
  }
  return buildBridgeError('wordpress', response.error || 'WordPress student detail endpoint is unavailable.', targetLabel(CONFIG.wpBase), {
    student_id: studentId,
  });
}

async function getWordPressTasks(session = null) {
  const response = await fetchWordPress('/tasks', null, session);
  return response.ok
    ? response.data
    : buildBridgeError('wordpress', response.error || 'WordPress tasks endpoint is unavailable.', targetLabel(CONFIG.wpBase));
}

async function getWordPressPayments(searchParams, session = null) {
  const response = await fetchWordPress('/payments', null, session);

  if (!response.ok) {
    return buildBridgeError('wordpress', response.error || 'WordPress payments endpoint is unavailable.', targetLabel(CONFIG.wpBase));
  }

  const items = Array.isArray(response.data?.items) ? response.data.items : [];
  const division = String(searchParams.get('division') || '').trim().toLowerCase();
  const status = String(searchParams.get('status') || '').trim().toLowerCase();

  const filtered = items.filter((payment) => {
    if (division && String(payment.division || '').toLowerCase() !== division) {
      return false;
    }
    if (status && String(payment.payment_status || '').toLowerCase() !== status) {
      return false;
    }
    return true;
  });

  return {
    ...response.data,
    items: filtered,
  };
}

async function getWordPressPaymentsOverview(session = null) {
  const response = await fetchWordPress('/payments/overview', null, session);
  return response.ok
    ? response.data
    : buildBridgeError('wordpress', response.error || 'WordPress payments overview endpoint is unavailable.', targetLabel(CONFIG.wpBase));
}

async function getWordPressStripeAccounts(session = null) {
  const response = await fetchWordPressService('/payments/stripe-accounts', null, session);
  if (!response.ok) {
    return buildBridgeError('wordpress', response.error || 'WordPress Stripe accounts endpoint is unavailable.', targetLabel(CONFIG.wpBase));
  }

  const scope = getSessionScope(session);
  const items = (Array.isArray(response.data?.items) ? response.data.items : []).filter((item) => (
    scope.is_all ? true : String(item.owner_key || '').trim() === scope.operator
  ));
  if (!items.length) {
    return response.data;
  }

  const enriched = await Promise.all(items.map(async (item) => {
    const ownerKey = String(item.owner_key || '').trim();
    if (!ownerKey) {
      return item;
    }

    const status = await getStripeStatusPayload(ownerKey, session);
    if (status.mode === 'error' && !status.owner_name && !status.division_label) {
      return {
        ...item,
        account_id: item.account_id || '',
        account_id_masked: item.account_id_masked || '',
        requirements_due: Array.isArray(item.requirements_due) ? item.requirements_due : [],
        action_required: Boolean(item.action_required),
      };
    }

    const mergedIssues = normalizeStripeRequirements([
      ...(Array.isArray(item.issues) ? item.issues : []),
      ...(status.error ? [status.error] : []),
      ...normalizeStripeRequirements(status.requirements_due).map((requirement) => `Requirement due: ${requirement.replace(/[._]/gu, ' ')}`),
    ]);

    return {
      ...item,
      connected: Boolean(status.connected),
      status: status.status || item.status || 'not_connected',
      readiness: status.readiness || item.readiness || 'blocked',
      can_receive: Boolean(status.can_receive),
      action_required: Boolean(status.action_required),
      account_id: status.account_id || '',
      account_id_masked: status.account_id_masked || status.account_id || '',
      requirements_due: normalizeStripeRequirements(status.requirements_due),
      last_updated: status.last_updated || item.last_updated || null,
      message: status.message || item.message || '',
      issues: mergedIssues,
    };
  }));

  return {
    ...response.data,
    items: enriched,
  };
}

async function getWordPressPaymentExceptions(session = null) {
  const response = await fetchWordPress('/payments/exceptions', null, session);
  return response.ok
    ? response.data
    : buildBridgeError('wordpress', response.error || 'WordPress payment exceptions endpoint is unavailable.', targetLabel(CONFIG.wpBase));
}

async function createWordPressPaymentRefund(payload, session = null) {
  const response = await fetchWordPress('/payments/refunds', null, session, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  if (!response.ok) {
    return buildApiError(502, 'wordpress_refund_failed', response.error || 'Refund could not be completed from HQ.', {
      bridge: 'wordpress',
      target: targetLabel(CONFIG.wpBase),
    });
  }

  return response.data;
}

async function getWordPressEmails(session = null) {
  const response = await fetchWordPress('/emails', null, session);
  return response.ok
    ? response.data
    : buildBridgeError('wordpress', response.error || 'WordPress email endpoint is unavailable.', targetLabel(CONFIG.wpBase));
}

async function getSupabaseLeads(session = null) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return buildBridgeError('supabase', 'Supabase bridge is not configured.', targetLabel(CONFIG.supabaseUrl));
  }

  const { assignedTo } = scopeFiltersForSupabase(session);
  const response = await fetchSupabaseRpc('mmac_cc_list_leads', {
    p_assigned_to: assignedTo || null,
    p_limit: 60,
  });

  if (!response.ok) {
    return buildBridgeError('supabase', response.error || 'Leads could not be loaded from Supabase.', targetLabel(CONFIG.supabaseUrl));
  }

  const items = Array.isArray(response.data) ? response.data.map(transformLeadRow) : [];

  return logDataResolution('leads', {
    mode: 'live',
    bridge: 'supabase',
    transport: 'rpc:mmac_cc_list_leads',
    items,
  });
}

async function getSupabaseLeadsSummary(session = null) {
  const response = await getSupabaseLeads(session);
  if (response?.httpStatus) {
    return response;
  }

  const stageCounts = response.items.reduce((accumulator, item) => {
    accumulator[item.stage] = (accumulator[item.stage] || 0) + 1;
    return accumulator;
  }, {});

  const averageScore = response.items.length
    ? Math.round(response.items.reduce((sum, item) => sum + Number(item.score || 0), 0) / response.items.length)
    : 0;

  return logDataResolution('leads-summary', {
    mode: 'live',
    bridge: response.bridge || 'supabase',
    transport: response.transport || 'rpc:mmac_cc_list_leads',
    metrics: {
      total: response.items.length,
      high_probability: response.items.filter((item) => Number(item.score || 0) >= 70).length,
      stage_counts: stageCounts,
      average_score: averageScore,
    },
    topLeads: [...response.items].sort((left, right) => Number(right.score || 0) - Number(left.score || 0)).slice(0, 4),
    items: response.items,
  });
}

const MEDIA_SORT_OPTIONS = new Set([
  'newest',
  'oldest',
  'longest',
  'shortest',
  'highest_rated',
  'alphabetical',
  'relevance',
]);

const MEDIA_CONTENT_TYPE_MAP = {
  testimonial: 'testimonial',
  teaching: 'teaching',
  strategy: 'strategy',
  emotional: 'emotional',
  clinical: 'clinical',
};

const MEDIA_CANONICAL_DIVISION_LABELS = {
  mission_residency: 'Mission Residency',
  usmle: 'USMLE',
  usce: 'USCE',
  other: 'Other',
};

const MEDIA_CANONICAL_CATEGORIES = {
  mission_residency: new Set([
    'TESTIMONIALS',
    'FOUNDATION',
    'MOCK_IV',
    'ONE_ON_ONE',
    'RX_REPLAY',
    'STRATEGY',
  ]),
  usmle: new Set([
    'DRJ_DRILLS',
    'DRJ_RAW',
    'OTHER',
  ]),
};

function isMissingSupabaseTableError(response, tableName = '') {
  if (response?.ok) {
    return false;
  }

  const message = String(response?.error || '').trim();
  if (!message) {
    return false;
  }

  const tableFragment = tableName
    ? `'public.${tableName}'`
    : "'public.";

  return message.includes('Could not find the table')
    && message.includes(tableFragment);
}

function isMediaFallbackEnabled() {
  return !CONFIG.isProduction && Boolean(CONFIG.mediaAllowFallback);
}

function buildMediaSchemaNotInitializedError(tableName = '', bridge = 'media_engine') {
  return buildApiError(
    503,
    'media_schema_not_initialized',
    'Media system schema not initialized',
    {
      bridge,
      mode: 'offline',
      target: targetLabel(CONFIG.supabaseUrl),
      table: tableName,
      required_action: 'Execute missionmed-hq/sql/media_system_schema.sql against Supabase.',
    },
  );
}

function createEmptyMediaFallbackStore() {
  return {
    user_state: [],
    tags: [],
    video_tags: [],
    user_video_tags: [],
    playlists: [],
    playlist_items: [],
    clips: [],
  };
}

function normalizeMediaFallbackStoreShape(value = {}) {
  const fallback = createEmptyMediaFallbackStore();
  return {
    user_state: Array.isArray(value.user_state) ? value.user_state : fallback.user_state,
    tags: Array.isArray(value.tags) ? value.tags : fallback.tags,
    video_tags: Array.isArray(value.video_tags) ? value.video_tags : fallback.video_tags,
    user_video_tags: Array.isArray(value.user_video_tags) ? value.user_video_tags : fallback.user_video_tags,
    playlists: Array.isArray(value.playlists) ? value.playlists : fallback.playlists,
    playlist_items: Array.isArray(value.playlist_items) ? value.playlist_items : fallback.playlist_items,
    clips: Array.isArray(value.clips) ? value.clips : fallback.clips,
  };
}

function loadMediaFallbackStore() {
  if (!existsSync(MEDIA_FALLBACK_STORE_PATH)) {
    return createEmptyMediaFallbackStore();
  }

  try {
    const raw = JSON.parse(readFileSync(MEDIA_FALLBACK_STORE_PATH, 'utf8'));
    return normalizeMediaFallbackStoreShape(raw);
  } catch {
    return createEmptyMediaFallbackStore();
  }
}

function saveMediaFallbackStore(store) {
  mkdirSync(path.dirname(MEDIA_FALLBACK_STORE_PATH), { recursive: true });
  writeFileSync(
    MEDIA_FALLBACK_STORE_PATH,
    JSON.stringify(normalizeMediaFallbackStoreShape(store), null, 2),
    'utf8',
  );
}

function updateMediaFallbackStore(mutator) {
  const current = loadMediaFallbackStore();
  const cloned = JSON.parse(JSON.stringify(current));
  const nextValue = mutator(cloned) || cloned;
  const normalized = normalizeMediaFallbackStoreShape(nextValue);
  saveMediaFallbackStore(normalized);
  return normalized;
}

function normalizeMediaString(value) {
  return String(value || '').trim();
}

function normalizeMediaLower(value) {
  return normalizeMediaString(value).toLowerCase();
}

function coerceNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeMediaLower(value);
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseCommaList(value) {
  const raw = normalizeMediaString(value);
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => normalizeMediaString(item))
    .filter(Boolean);
}

function chunkList(values = [], size = 100) {
  const normalizedSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < values.length; index += normalizedSize) {
    chunks.push(values.slice(index, index + normalizedSize));
  }
  return chunks;
}

function sanitizeMediaIdentifier(value) {
  const normalized = normalizeMediaString(value);
  return normalized.replace(/[^\w\-:.]/gu, '_');
}

function getMediaUserId(session = null) {
  const userId = sanitizeMediaIdentifier(session?.user?.id);
  if (userId) {
    return userId;
  }
  const login = sanitizeMediaIdentifier(session?.user?.login);
  if (login) {
    return login;
  }
  const email = sanitizeMediaIdentifier(session?.user?.email);
  if (email) {
    return email;
  }
  return '';
}

function requireMediaUserId(session = null) {
  const userId = getMediaUserId(session);
  if (!userId) {
    if (!CONFIG.authRequired) {
      return 'hq-public';
    }
    return buildApiError(403, 'media_user_identity_required', 'No authenticated HQ user identity found for media actions.', {
      bridge: 'media_engine',
    });
  }
  return userId;
}

function hasSemanticSearchConfig() {
  return Boolean(CONFIG.openaiApiKey && CONFIG.supabaseUrl && getSupabaseToken() && CONFIG.mediaSemanticRpc);
}

function normalizeMediaDivision(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/gu, '_');

  if (!normalized) {
    return 'other';
  }

  const map = {
    mission_residency: 'mission_residency',
    residency: 'mission_residency',
    missionresidency: 'mission_residency',
    usmle: 'usmle',
    usmle_drills: 'usmle',
    usmle_drill: 'usmle',
    dr_j_drills: 'usmle',
    drj_drills: 'usmle',
    dr_j: 'usmle',
    drj: 'usmle',
    exam_prep: 'usmle',
    examprep: 'usmle',
    mission_usce: 'usce',
    usce: 'usce',
    clinicals: 'usce',
    clinical: 'usce',
    other: 'other',
    general: 'other',
  };

  return map[normalized] || 'other';
}

function formatMediaDivisionLabel(division) {
  return MEDIA_CANONICAL_DIVISION_LABELS[normalizeMediaDivision(division)] || 'Other';
}

function normalizeMediaSubcategory(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  return normalized;
}

function normalizeMediaCategoryForDivision(rawCategory, division, rawItem = {}) {
  const canonicalDivision = normalizeMediaDivision(division);
  const category = String(rawCategory || '').trim();
  const explicitCategory = normalizeMediaSubcategory(category);
  const normalizedCategory = category.toLowerCase();
  const title = normalizeMediaLower(rawItem.title);
  const tags = normalizeMediaTags(rawItem).join(' ').toLowerCase();
  const haystack = `${normalizedCategory} ${title} ${tags}`;

  if (canonicalDivision === 'mission_residency') {
    if (/(testimonial|matched|match_day|match day|success_story)/u.test(haystack)) {
      return 'TESTIMONIALS';
    }
    if (/(foundation|bootcamp|basics|fundamental)/u.test(haystack)) {
      return 'FOUNDATION';
    }
    if (/(mock[_\s-]*iv|mock[_\s-]*interview)/u.test(haystack)) {
      return 'MOCK_IV';
    }
    if (/(one[_\s-]*on[_\s-]*one|1on1|1[_\s-]*on[_\s-]*1)/u.test(haystack)) {
      return 'ONE_ON_ONE';
    }
    if (/(rx[_\s-]*replay|replay)/u.test(haystack)) {
      return 'RX_REPLAY';
    }
    if (/(strategy|interview|roadmap|plan|prep)/u.test(haystack)) {
      return 'STRATEGY';
    }
    if (explicitCategory) {
      return explicitCategory;
    }
    return 'STRATEGY';
  }

  if (canonicalDivision === 'usmle') {
    if (/(dr[_\s-]*j[_\s-]*drills|drj[_\s-]*drills|drills|qbank|question[_\s-]*bank)/u.test(haystack)) {
      return 'DRJ_DRILLS';
    }
    if (/(other[_\s-]*sources?|other[_\s-]*source|[^a-z]other[^a-z]?)/u.test(` ${haystack} `)) {
      return 'OTHER';
    }
    if (/(drj[_\s-]*raw|dr[_\s-]*j[_\s-]*raw|raw|unsorted)/u.test(haystack)) {
      return 'DRJ_RAW';
    }
    if (explicitCategory) {
      return explicitCategory;
    }
    return 'OTHER';
  }

  if (canonicalDivision === 'usce') {
    const normalized = normalizeMediaSubcategory(category) || 'CLINICALS';
    return normalized || 'CLINICALS';
  }

  const normalized = normalizeMediaSubcategory(category);
  return normalized || 'GENERAL';
}

function normalizeTranscriptChunkRows(rows = []) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const text = normalizeMediaString(row?.text || row?.chunk_text || row?.transcript || '');
      const startTime = coerceNumber(row?.start_time, 0);
      const endTime = Math.max(startTime, coerceNumber(row?.end_time, startTime));
      if (!text) {
        return null;
      }
      return {
        text,
        start_time: startTime,
        end_time: endTime,
      };
    })
    .filter(Boolean);
}

function normalizeMediaSource(rawItem = {}) {
  const existing = normalizeMediaLower(rawItem.source);
  if (existing) {
    if (['upload', 'zoom', 'manual', 'legacy'].includes(existing)) {
      return existing;
    }
    if (existing.includes('zoom')) {
      return 'zoom';
    }
    if (existing.includes('legacy')) {
      return 'legacy';
    }
    if (existing.includes('manual')) {
      return 'manual';
    }
  }

  const videoPath = normalizeMediaLower(rawItem.video_path);
  const title = normalizeMediaLower(rawItem.title);
  if (videoPath.includes('zoom') || title.includes('zoom')) {
    return 'zoom';
  }
  if (videoPath.includes('legacy') || title.includes('legacy')) {
    return 'legacy';
  }
  return 'upload';
}

function normalizeMediaContentType(rawItem = {}) {
  const existing = normalizeMediaLower(rawItem.content_type);
  if (existing && MEDIA_CONTENT_TYPE_MAP[existing]) {
    return MEDIA_CONTENT_TYPE_MAP[existing];
  }

  const category = normalizeMediaLower(rawItem.category);
  const title = normalizeMediaLower(rawItem.title);
  const topics = (Array.isArray(rawItem.topics) ? rawItem.topics : [])
    .map((topic) => normalizeMediaLower(topic))
    .filter(Boolean)
    .join(' ');
  const haystack = `${category} ${title} ${topics}`;

  if (/(testimonial|matched|match day)/u.test(haystack)) {
    return 'testimonial';
  }
  if (/(strategy|interview|prep|plan)/u.test(haystack)) {
    return 'strategy';
  }
  if (/(teach|lesson|drill|step|usmle|education)/u.test(haystack)) {
    return 'teaching';
  }
  if (/(emotion|story|reflection|journey|fear|gratitude)/u.test(haystack)) {
    return 'emotional';
  }
  if (/(clinical|usce|rotation|patient)/u.test(haystack)) {
    return 'clinical';
  }
  return 'teaching';
}

function normalizeMediaTags(rawItem = {}) {
  const tags = [
    ...(Array.isArray(rawItem.topics) ? rawItem.topics : []),
    ...(Array.isArray(rawItem.tags) ? rawItem.tags : []),
    ...((rawItem.metadata?.tags || []).map((tag) => (typeof tag === 'string' ? tag : tag?.tag)).filter(Boolean)),
  ]
    .map((tag) => normalizeMediaString(tag))
    .filter(Boolean);
  return [...new Set(tags)];
}

function deriveMediaSnippet(rawItem = {}, query = '') {
  const sources = [
    rawItem.snippet,
    rawItem.transcript_excerpt,
    rawItem.enrichment_summary,
    rawItem.notes,
    normalizeMediaTags(rawItem).join(' · '),
  ]
    .map((value) => normalizeMediaString(value))
    .filter(Boolean);

  const text = sources.find(Boolean) || '';
  if (!text) {
    return '';
  }
  if (!query) {
    return text.length > 220 ? `${text.slice(0, 217)}...` : text;
  }

  const loweredText = text.toLowerCase();
  const loweredQuery = query.toLowerCase();
  const index = loweredText.indexOf(loweredQuery);
  if (index < 0) {
    return text.length > 220 ? `${text.slice(0, 217)}...` : text;
  }
  const start = Math.max(0, index - 72);
  const end = Math.min(text.length, start + 220);
  const snippet = text.slice(start, end).trim();
  return `${start > 0 ? '...' : ''}${snippet}${end < text.length ? '...' : ''}`;
}

function normalizeMediaResultItem(rawItem = {}, query = '') {
  const enrichedItem = applyMediaSubmissionMetadata(rawItem);
  const id = normalizeMediaString(enrichedItem.id || enrichedItem.video_id || enrichedItem.mmvc_id);
  const playbackUrl = sanitizeHostedReference(enrichedItem.playback_url || enrichedItem.cloud_video_path || enrichedItem.video_url || '');
  const thumbnailUrl = sanitizeHostedReference(enrichedItem.thumbnail_url || enrichedItem.preview_image || '') || '';
  const durationSeconds = coerceNumber(enrichedItem.duration, 0);
  const startTime = coerceNumber(enrichedItem.start_time, 0);
  const endTime = coerceNumber(enrichedItem.end_time, durationSeconds > 0 ? durationSeconds : startTime);
  const snippet = deriveMediaSnippet(enrichedItem, query);
  const division = normalizeMediaDivision(enrichedItem.division || enrichedItem.cie_division || '');
  const category = normalizeMediaCategoryForDivision(enrichedItem.category, division, enrichedItem);
  const subcategory = normalizeMediaSubcategory(enrichedItem.subcategory || '');
  const transcriptChunks = normalizeTranscriptChunkRows(enrichedItem.transcript_chunks || enrichedItem.chunks || []);
  const transcriptText = normalizeMediaString(enrichedItem.transcript || enrichedItem.transcript_text || '');
  const hasTranscript = Boolean(transcriptText || transcriptChunks.length);
  const metadata = enrichedItem.metadata && typeof enrichedItem.metadata === 'object' ? enrichedItem.metadata : {};
  const studentName = normalizeMediaString(
    enrichedItem.student_name || metadata.student_name || metadata.student || '',
  );
  const submittedByUserId = normalizeMediaString(
    enrichedItem.submitted_by_user_id || enrichedItem.user_id || metadata.submitted_by_user_id || metadata.user_id || '',
  );
  const course = normalizeMediaString(enrichedItem.course || metadata.course || '');
  const sessionType = normalizeMediaString(enrichedItem.session_type || metadata.session_type || '');
  const submissionType = normalizeSubmissionType(enrichedItem.submission_type || metadata.submission_type || sessionType);

  return {
    id,
    video_id: id,
    title: normalizeMediaString(enrichedItem.title || id || 'Untitled media'),
    division,
    division_label: formatMediaDivisionLabel(division),
    category,
    subcategory,
    status: normalizeMediaString(enrichedItem.status || 'active'),
    date: normalizeMediaString(enrichedItem.date || enrichedItem.created_at || enrichedItem.updated_at || ''),
    duration: durationSeconds,
    playback_url: playbackUrl || '',
    thumbnail_url: thumbnailUrl || '',
    snippet,
    start_time: startTime,
    end_time: Math.max(endTime, startTime),
    score: coerceNumber(enrichedItem.score, 0),
    transcript_available: hasTranscript,
    transcript: transcriptText,
    transcript_chunks: transcriptChunks,
    favorite: normalizeBoolean(enrichedItem.favorite, false),
    rating: Math.max(0, Math.min(5, Math.round(coerceNumber(enrichedItem.rating, 0)))),
    tags: normalizeMediaTags(enrichedItem),
    content_type: normalizeMediaContentType(enrichedItem),
    source: normalizeMediaSource(enrichedItem),
    student_name: studentName,
    submitted_by_user_id: submittedByUserId,
    course,
    session_type: sessionType,
    submission_type: submissionType,
  };
}

async function fetchSupabaseTable(path, options = {}) {
  if (!CONFIG.supabaseUrl || !getSupabaseToken()) {
    return {
      ok: false,
      status: 400,
      error: 'Supabase bridge is not configured.',
    };
  }

  return fetchJson(`${CONFIG.supabaseUrl}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      ...getSupabaseRpcHeaders({ includeContentType: Boolean(options.body) }),
      ...(options.headers || {}),
    },
    body: options.body,
    timeoutMs: options.timeoutMs || 7000,
  });
}

async function fetchUnifiedListPage(page = 1, pageSize = 200, filters = {}) {
  const query = new URLSearchParams();
  query.set('page', String(Math.max(1, Number(page) || 1)));
  query.set('page_size', String(Math.max(1, Math.min(200, Number(pageSize) || 200))));
  for (const key of ['division', 'category', 'status']) {
    const value = normalizeMediaString(filters[key]);
    if (value) {
      query.set(key, value);
    }
  }

  const response = await fetchCie(`/api/unified?${query.toString()}`);
  if (!response.ok) {
    return {
      ok: false,
      error: buildBridgeErrorFromResult('media_engine', response, targetLabel(CONFIG.cieBase), {
        source: getCieEndpointSource(),
        required_env: ['MMHQ_CIE_BASE'],
      }),
    };
  }

  const payload = response.data || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    ok: true,
    items,
    total: Number(payload.total || items.length || 0),
    totalPages: Math.max(1, Number(payload.total_pages || 1)),
  };
}

async function fetchUnifiedItems(filters = {}) {
  const firstPage = await fetchUnifiedListPage(1, 200, filters);
  if (!firstPage.ok) {
    return firstPage;
  }

  const allItems = [...firstPage.items];
  const maxPages = Math.min(firstPage.totalPages, 10);
  for (let page = 2; page <= maxPages; page += 1) {
    const nextPage = await fetchUnifiedListPage(page, 200, filters);
    if (!nextPage.ok) {
      return nextPage;
    }
    allItems.push(...nextPage.items);
  }

  return {
    ok: true,
    items: allItems,
  };
}

async function fetchPipelineVideoList() {
  if (!CONFIG.mediaPipelineBase) {
    return [];
  }
  const response = await fetchJson(`${CONFIG.mediaPipelineBase}/videos`, {
    headers: { Accept: 'application/json' },
    timeoutMs: 15000,
  });
  if (!response.ok) {
    return [];
  }
  return Array.isArray(response.data) ? response.data : [];
}

async function mergeSubmissionBackfillItems(items = []) {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => applyMediaSubmissionMetadata(item));
  const existingIds = new Set(
    normalizedItems.map((item) => sanitizeMediaIdentifier(item?.id || item?.video_id)).filter(Boolean),
  );

  const submissionStore = loadMediaSubmissionStore();
  const missingSubmissionIds = submissionStore.uploads
    .map((row) => sanitizeMediaIdentifier(row.video_id))
    .filter(Boolean)
    .filter((videoId) => !existingIds.has(videoId));
  if (!missingSubmissionIds.length) {
    return normalizedItems;
  }

  const pipelineRows = await fetchPipelineVideoList();
  if (!pipelineRows.length) {
    return normalizedItems;
  }

  const pipelineById = new Map(
    pipelineRows.map((row) => [sanitizeMediaIdentifier(row?.id || row?.video_id), row]),
  );

  const merged = [...normalizedItems];
  for (const videoId of missingSubmissionIds) {
    const row = pipelineById.get(videoId);
    if (!row) {
      continue;
    }
    merged.push(applyMediaSubmissionMetadata(row));
  }
  return merged;
}

function tokenizeMediaQuery(value) {
  return normalizeMediaLower(value).split(/\s+/u).map((token) => token.trim()).filter(Boolean);
}

function keywordScoreForItem(item, query) {
  const tokens = tokenizeMediaQuery(query);
  if (!tokens.length) {
    return 0;
  }

  const haystack = [
    item.title,
    item.category,
    item.subcategory,
    item.division,
    item.snippet,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .join(' ')
    .toLowerCase();

  if (!haystack.trim()) {
    return 0;
  }

  let tokenHits = 0;
  for (const token of tokens) {
    if (token && haystack.includes(token)) {
      tokenHits += 1;
    }
  }
  if (!tokenHits) {
    return 0;
  }

  const phraseBonus = haystack.includes(query.toLowerCase()) ? 1 : 0;
  return (tokenHits / tokens.length) + phraseBonus;
}

function compareMediaBySort(sort, left, right) {
  const l = left || {};
  const r = right || {};
  const leftRating = coerceNumber(l.rating, 0);
  const rightRating = coerceNumber(r.rating, 0);
  const leftDuration = coerceNumber(l.duration, 0);
  const rightDuration = coerceNumber(r.duration, 0);
  const leftDate = new Date(l.date || 0).getTime() || 0;
  const rightDate = new Date(r.date || 0).getTime() || 0;
  const leftTitle = normalizeMediaLower(l.title);
  const rightTitle = normalizeMediaLower(r.title);
  const leftScore = coerceNumber(l.score, 0);
  const rightScore = coerceNumber(r.score, 0);

  switch (sort) {
    case 'newest':
      return rightDate - leftDate || rightScore - leftScore;
    case 'oldest':
      return leftDate - rightDate || rightScore - leftScore;
    case 'longest':
      return rightDuration - leftDuration || rightScore - leftScore;
    case 'shortest':
      return leftDuration - rightDuration || rightScore - leftScore;
    case 'highest_rated':
      return rightRating - leftRating || rightScore - leftScore;
    case 'alphabetical':
      return leftTitle.localeCompare(rightTitle, 'en-US') || rightScore - leftScore;
    default:
      return rightScore - leftScore;
  }
}

async function fetchMediaUserStateRows(userId, videoIds = []) {
  if (!videoIds.length) {
    return { ok: true, rows: [] };
  }

  const rows = [];
  for (const idChunk of chunkList(videoIds, 80)) {
    const query = new URLSearchParams();
    query.set('select', 'video_id,favorite,rating,updated_at');
    query.set('user_id', `eq.${userId}`);
    query.set('video_id', `in.(${idChunk.map((id) => sanitizeMediaIdentifier(id)).join(',')})`);
    const response = await fetchSupabaseTable(`media_user_state?${query.toString()}`);
    if (!response.ok) {
      if (isMissingSupabaseTableError(response, 'media_user_state')) {
        if (!isMediaFallbackEnabled()) {
          return buildMediaSchemaNotInitializedError('media_user_state', 'media_user_state');
        }

        console.warn('[MEDIA_FALLBACK]', 'media_user_state');
        const fallback = loadMediaFallbackStore();
        const idSet = new Set(idChunk.map((id) => sanitizeMediaIdentifier(id)).filter(Boolean));
        const fallbackRows = fallback.user_state
          .filter((row) => normalizeMediaString(row.user_id) === userId)
          .filter((row) => idSet.has(sanitizeMediaIdentifier(row.video_id)))
          .map((row) => ({
            video_id: sanitizeMediaIdentifier(row.video_id),
            favorite: normalizeBoolean(row.favorite, false),
            rating: Math.max(0, Math.min(5, Math.round(coerceNumber(row.rating, 0)))),
            updated_at: normalizeMediaString(row.updated_at),
          }));
        rows.push(...fallbackRows);
        continue;
      }

      return response;
    }
    rows.push(...(Array.isArray(response.data) ? response.data : []));
  }

  return {
    ok: true,
    rows,
  };
}

function mergeMediaUserState(items = [], rows = []) {
  const stateById = new Map();
  for (const row of rows) {
    const videoId = normalizeMediaString(row.video_id);
    if (!videoId) {
      continue;
    }
    stateById.set(videoId, {
      favorite: normalizeBoolean(row.favorite, false),
      rating: Math.max(0, Math.min(5, Math.round(coerceNumber(row.rating, 0)))),
      updated_at: normalizeMediaString(row.updated_at),
    });
  }

  return items.map((item) => {
    const state = stateById.get(item.video_id);
    if (!state) {
      return item;
    }
    return {
      ...item,
      favorite: state.favorite,
      rating: state.rating,
      user_state_updated_at: state.updated_at,
    };
  });
}

async function createQueryEmbedding(query) {
  if (!hasSemanticSearchConfig()) {
    return {
      ok: false,
      status: 400,
      error: 'Semantic search is not configured.',
    };
  }

  const response = await fetchJson('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.mediaEmbeddingModel,
      input: query,
    }),
    timeoutMs: 9000,
  });

  if (!response.ok) {
    return response;
  }

  const embedding = response.data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || !embedding.length) {
    return {
      ok: false,
      status: 502,
      error: 'OpenAI embedding response did not include an embedding vector.',
    };
  }

  return {
    ok: true,
    embedding,
  };
}

async function fetchSemanticMatches(query, allowedVideoIds = [], matchCount = 120) {
  if (!hasSemanticSearchConfig()) {
    return { ok: true, rows: [], enabled: false };
  }

  const embeddingResponse = await createQueryEmbedding(query);
  if (!embeddingResponse.ok) {
    return embeddingResponse;
  }

  const rpcResponse = await fetchSupabaseRpc(CONFIG.mediaSemanticRpc, {
    query_embedding: embeddingResponse.embedding,
    match_count: Math.max(1, Number(matchCount) || 120),
  });
  if (!rpcResponse.ok) {
    return rpcResponse;
  }

  const allowed = new Set(allowedVideoIds.map((id) => normalizeMediaString(id)).filter(Boolean));
  const rows = (Array.isArray(rpcResponse.data) ? rpcResponse.data : [])
    .map((row) => ({
      video_id: normalizeMediaString(row.video_id),
      chunk_text: normalizeMediaString(row.chunk_text),
      start_time: coerceNumber(row.start_time, 0),
      end_time: coerceNumber(row.end_time, 0),
      similarity: coerceNumber(row.similarity || row.score, 0),
    }))
    .filter((row) => row.video_id && (!allowed.size || allowed.has(row.video_id)));

  return {
    ok: true,
    rows,
    enabled: true,
  };
}

function mergeKeywordAndSemanticResults(items = [], query, semanticRows = []) {
  const byId = new Map(items.map((item) => [item.video_id, { ...item }]));
  const semanticByVideo = new Map();

  for (const row of semanticRows) {
    if (!row.video_id) {
      continue;
    }
    const current = semanticByVideo.get(row.video_id);
    if (!current || row.similarity > current.similarity) {
      semanticByVideo.set(row.video_id, row);
    }
  }

  const merged = [];
  for (const item of items) {
    const keywordScore = keywordScoreForItem(item, query);
    const semantic = semanticByVideo.get(item.video_id);
    const semanticScore = semantic ? semantic.similarity : 0;

    if (query && keywordScore <= 0 && semanticScore <= 0) {
      continue;
    }

    const hybridScore = semantic && keywordScore
      ? (semanticScore * 0.55) + (keywordScore * 0.45)
      : (semanticScore || keywordScore);

    const snippet = semantic?.chunk_text || item.snippet || deriveMediaSnippet(item, query);
    const startTime = semantic ? semantic.start_time : coerceNumber(item.start_time, 0);
    const endTime = semantic ? Math.max(semantic.end_time, startTime) : Math.max(coerceNumber(item.end_time, 0), startTime);

    merged.push({
      ...item,
      snippet,
      start_time: startTime,
      end_time: endTime,
      score: Number(hybridScore.toFixed(4)),
      keyword_score: Number(keywordScore.toFixed(4)),
      semantic_score: Number(semanticScore.toFixed(4)),
      match_type: semantic && keywordScore ? 'hybrid' : (semantic ? 'semantic' : 'keyword'),
    });
  }

  return merged;
}

function parseMediaSearchFilters(searchParams) {
  const requestedSort = normalizeMediaLower(searchParams.get('sort'));
  const sort = MEDIA_SORT_OPTIONS.has(requestedSort) ? requestedSort : '';
  const requestedDivision = normalizeMediaString(searchParams.get('division'));
  const requestedCategory = normalizeMediaString(searchParams.get('category'));
  const canonicalDivision = requestedDivision ? normalizeMediaDivision(requestedDivision) : '';
  const canonicalCategory = requestedCategory
    ? normalizeMediaCategoryForDivision(
      requestedCategory,
      canonicalDivision || requestedDivision || 'other',
      { category: requestedCategory, title: requestedCategory, topics: [requestedCategory] },
    )
    : '';
  return {
    q: normalizeMediaString(searchParams.get('q')),
    division: canonicalDivision,
    category: canonicalCategory,
    subcategory: normalizeMediaSubcategory(searchParams.get('subcategory')),
    studentName: normalizeMediaString(searchParams.get('student_name')),
    submissionType: normalizeSubmissionType(searchParams.get('submission_type')),
    status: normalizeMediaString(searchParams.get('status')),
    ratingThreshold: Math.max(0, Math.min(5, coerceNumber(searchParams.get('rating_threshold'), 0))),
    favoritesOnly: normalizeBoolean(searchParams.get('favorites_only'), false),
    sort: sort || (normalizeMediaString(searchParams.get('q')) ? 'relevance' : 'newest'),
    page: Math.max(1, Math.floor(coerceNumber(searchParams.get('page'), 1))),
    pageSize: Math.max(1, Math.min(120, Math.floor(coerceNumber(searchParams.get('page_size'), 40)))),
  };
}

async function searchMedia(searchParams, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const filters = parseMediaSearchFilters(searchParams);
  const unifiedResponse = await fetchUnifiedItems({
    status: filters.status,
  });
  if (!unifiedResponse.ok) {
    return unifiedResponse.error;
  }

  const withSubmissionBackfill = await mergeSubmissionBackfillItems(unifiedResponse.items);
  let items = withSubmissionBackfill.map((item) => normalizeMediaResultItem(item, filters.q));
  if (filters.division) {
    items = items.filter((item) => normalizeMediaDivision(item.division) === filters.division);
  }
  if (filters.category) {
    items = items.filter((item) => item.category === filters.category);
  }
  if (filters.subcategory) {
    items = items.filter((item) => normalizeMediaSubcategory(item.subcategory) === filters.subcategory);
  }
  if (filters.studentName) {
    const filterNeedle = normalizeMediaLower(filters.studentName);
    items = items.filter((item) => normalizeMediaLower(item.student_name).includes(filterNeedle));
  }
  if (filters.submissionType) {
    items = items.filter((item) => normalizeSubmissionType(item.submission_type || item.session_type) === filters.submissionType);
  }

  const videoIds = items.map((item) => item.video_id).filter(Boolean);
  if (videoIds.length) {
    const userStateResponse = await fetchMediaUserStateRows(userId, videoIds);
    if (!userStateResponse.ok) {
      if (userStateResponse.error === 'media_schema_not_initialized') {
        return userStateResponse;
      }
      return buildBridgeError('supabase', userStateResponse.error || 'Unable to load media user state.', targetLabel(CONFIG.supabaseUrl), {
        bridge: 'media_user_state',
      });
    }
    items = mergeMediaUserState(items, userStateResponse.rows);
  }

  if (filters.favoritesOnly) {
    items = items.filter((item) => Boolean(item.favorite));
  }
  if (filters.ratingThreshold > 0) {
    items = items.filter((item) => coerceNumber(item.rating, 0) >= filters.ratingThreshold);
  }

  let semanticRows = [];
  let semanticEnabled = false;
  let semanticError = null;
  if (filters.q) {
    const semanticResponse = await fetchSemanticMatches(filters.q, items.map((item) => item.video_id), Math.max(120, filters.pageSize * 6));
    if (semanticResponse.ok) {
      semanticRows = semanticResponse.rows;
      semanticEnabled = Boolean(semanticResponse.enabled);
    } else {
      semanticError = semanticResponse.error || 'Semantic search unavailable.';
    }
  }

  let rankedItems = filters.q
    ? mergeKeywordAndSemanticResults(items, filters.q, semanticRows)
    : items.map((item) => ({
      ...item,
      score: 0,
      keyword_score: 0,
      semantic_score: 0,
      match_type: 'browse',
    }));

  rankedItems.sort((left, right) => compareMediaBySort(filters.sort, left, right));

  const total = rankedItems.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const pagedItems = rankedItems.slice(start, start + filters.pageSize).map((item) => ({
    video_id: item.video_id,
    id: item.video_id,
    title: item.title,
    thumbnail_url: item.thumbnail_url,
    playback_url: item.playback_url,
    snippet: item.snippet,
    start_time: item.start_time,
    end_time: item.end_time,
    score: item.score,
    division: item.division,
    division_label: item.division_label,
    category: item.category,
    subcategory: item.subcategory,
    duration: item.duration,
    date: item.date,
    transcript_available: Boolean(item.transcript_available),
    favorite: item.favorite,
    rating: item.rating,
    tags: item.tags,
    content_type: item.content_type,
    source: item.source,
    student_name: item.student_name,
    submitted_by_user_id: item.submitted_by_user_id,
    course: item.course,
    session_type: item.session_type,
    submission_type: item.submission_type,
    match_type: item.match_type,
  }));

  const mode = semanticRows.length && filters.q
    ? 'hybrid'
    : (filters.q ? 'keyword' : 'browse');

  return {
    mode: 'live',
    bridge: 'media_engine',
    data: {
      query: filters.q,
      mode,
      page,
      page_size: filters.pageSize,
      total,
      total_pages: totalPages,
      sort: filters.sort,
      filters: {
        division: filters.division,
        category: filters.category,
        subcategory: filters.subcategory,
        student_name: filters.studentName,
        submission_type: filters.submissionType,
        rating_threshold: filters.ratingThreshold,
        favorites_only: filters.favoritesOnly,
      },
      semantic: {
        enabled: semanticEnabled,
        error: semanticError,
        rows: semanticRows.length,
      },
      items: pagedItems,
    },
  };
}

async function getMediaHealth() {
  const response = await fetchCie('/api/health');

  if (!response.ok) {
    return buildBridgeErrorFromResult('media_engine', response, targetLabel(CONFIG.cieBase), {
      source: getCieEndpointSource(),
      required_env: ['MMHQ_CIE_BASE'],
    });
  }

  return {
    mode: 'live',
    bridge: 'media_engine',
    data: response.data,
    sources: {
      cie: {
        configured: Boolean(CONFIG.cieBase),
        online: true,
        target: targetLabel(CONFIG.cieBase),
        error: null,
      },
      semantic: {
        configured: hasSemanticSearchConfig(),
        rpc: CONFIG.mediaSemanticRpc,
      },
    },
  };
}

async function getMediaStats() {
  const response = await fetchCie('/api/unified/stats');
  if (!response.ok) {
    return buildBridgeErrorFromResult('media_engine', response, targetLabel(CONFIG.cieBase), {
      source: getCieEndpointSource(),
      required_env: ['MMHQ_CIE_BASE'],
    });
  }

  return {
    mode: 'live',
    bridge: 'media_engine',
    data: response.data,
  };
}

async function getMediaList(searchParams) {
  const query = new URLSearchParams();
  for (const key of ['q', 'division', 'category', 'status', 'page', 'page_size']) {
    const value = searchParams.get(key);
    if (value) {
      query.set(key, value);
    }
  }

  const response = await fetchCie(`/api/unified${query.toString() ? `?${query.toString()}` : ''}`);
  if (!response.ok) {
    return buildBridgeErrorFromResult('media_engine', response, targetLabel(CONFIG.cieBase), {
      source: getCieEndpointSource(),
      required_env: ['MMHQ_CIE_BASE'],
    });
  }

  const payload = response.data && typeof response.data === 'object' ? { ...response.data } : { items: [] };
  const currentItems = Array.isArray(payload.items) ? payload.items : [];
  payload.items = await mergeSubmissionBackfillItems(currentItems);
  payload.total = Number(payload.total || payload.items.length);
  payload.total_pages = Math.max(1, Number(payload.total_pages || 1));

  return {
    mode: 'live',
    bridge: 'media_engine',
    data: payload,
  };
}

async function fetchTranscriptChunksForVideo(videoId) {
  const normalizedVideoId = sanitizeMediaIdentifier(videoId);
  if (!normalizedVideoId) {
    return {
      ok: true,
      transcript: '',
      transcript_chunks: [],
    };
  }

  const query = new URLSearchParams();
  query.set('select', 'chunk_text,start_time,end_time');
  query.set('video_id', `eq.${normalizedVideoId}`);
  query.set('order', 'start_time.asc');
  query.set('limit', '600');

  const response = await fetchSupabaseTable(`media_transcript_chunks?${query.toString()}`);
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_transcript_chunks')) {
      return {
        ok: true,
        transcript: '',
        transcript_chunks: [],
      };
    }
    return response;
  }

  const transcriptChunks = normalizeTranscriptChunkRows(response.data || []);
  return {
    ok: true,
    transcript: transcriptChunks.map((chunk) => chunk.text).join('\n\n'),
    transcript_chunks: transcriptChunks,
  };
}

async function getMediaDetail(mediaId) {
  const response = await fetchCie(`/api/unified/${mediaId}`);
  let sourceItem = response.ok ? (response.data || {}) : null;
  if (!sourceItem) {
    sourceItem = await fetchPipelineVideoById(mediaId);
  }
  if (!sourceItem) {
    return buildBridgeErrorFromResult('media_engine', response, targetLabel(CONFIG.cieBase), {
      source: getCieEndpointSource(),
      required_env: ['MMHQ_CIE_BASE'],
      media_id: mediaId,
    });
  }

  const item = normalizeMediaResultItem(sourceItem, '');
  const transcriptResult = await fetchTranscriptChunksForVideo(item.video_id);
  if (transcriptResult.ok) {
    const transcriptText = item.transcript || transcriptResult.transcript || '';
    const transcriptChunks = item.transcript_chunks?.length
      ? item.transcript_chunks
      : transcriptResult.transcript_chunks;
    item.transcript = transcriptText;
    item.transcript_chunks = transcriptChunks;
    item.transcript_available = Boolean(transcriptText || transcriptChunks.length);
  }
  if ((!item.transcript || !item.transcript_chunks?.length) && CONFIG.mediaPipelineBase) {
    const pipelineTranscript = await fetchPipelineTranscriptById(item.video_id);
    if (pipelineTranscript && typeof pipelineTranscript === 'object') {
      const transcriptText = normalizeMediaString(pipelineTranscript.transcript || item.transcript || '');
      const transcriptChunks = normalizeTranscriptChunkRows(pipelineTranscript.transcript_chunks || item.transcript_chunks || []);
      item.transcript = transcriptText;
      item.transcript_chunks = transcriptChunks;
      item.transcript_available = Boolean(transcriptText || transcriptChunks.length);
    }
  }

  return {
    mode: 'live',
    bridge: 'media_engine',
    data: item,
  };
}

async function getMediaUserState(searchParams, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const query = new URLSearchParams();
  query.set('select', 'video_id,favorite,rating,updated_at');
  query.set('user_id', `eq.${userId}`);

  const videoIds = [
    ...parseCommaList(searchParams.get('video_ids')),
    ...parseCommaList(searchParams.get('video_id')),
  ].map((value) => sanitizeMediaIdentifier(value)).filter(Boolean);
  if (videoIds.length) {
    query.set('video_id', `in.(${videoIds.join(',')})`);
  }
  query.set('order', 'updated_at.desc');

  const response = await fetchSupabaseTable(`media_user_state?${query.toString()}`);
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_user_state')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_user_state', 'media_user_state');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_user_state');
      const fallback = loadMediaFallbackStore();
      const requestedIds = new Set(videoIds.map((value) => sanitizeMediaIdentifier(value)).filter(Boolean));
      const items = fallback.user_state
        .filter((row) => normalizeMediaString(row.user_id) === userId)
        .filter((row) => !requestedIds.size || requestedIds.has(sanitizeMediaIdentifier(row.video_id)))
        .sort((left, right) => new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime())
        .map((row) => ({
          video_id: sanitizeMediaIdentifier(row.video_id),
          favorite: normalizeBoolean(row.favorite, false),
          rating: Math.max(0, Math.min(5, Math.round(coerceNumber(row.rating, 0)))),
          updated_at: normalizeMediaString(row.updated_at),
        }));

      return {
        mode: 'live',
        bridge: 'media_user_state',
        data: {
          user_id: userId,
          items,
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to load media user state.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_user_state',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_user_state',
    data: {
      user_id: userId,
      items: Array.isArray(response.data) ? response.data : [],
    },
  };
}

function normalizeVideoIdList(payload = {}) {
  const fromList = Array.isArray(payload.video_ids) ? payload.video_ids : [];
  const fromSingle = payload.video_id ? [payload.video_id] : [];
  const fromCsv = parseCommaList(payload.video_ids_csv || payload.video_ids || '');
  return [...new Set([...fromList, ...fromSingle, ...fromCsv]
    .map((value) => sanitizeMediaIdentifier(value))
    .filter(Boolean))];
}

async function updateMediaFavorite(payload = {}, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const videoIds = normalizeVideoIdList(payload);
  if (!videoIds.length) {
    return buildValidationError('video_id_required', 'Provide video_id or video_ids for favorite updates.');
  }

  const favorite = normalizeBoolean(payload.favorite, true);
  const now = new Date().toISOString();
  const rows = videoIds.map((videoId) => ({
    user_id: userId,
    video_id: videoId,
    favorite,
    updated_at: now,
  }));

  const response = await fetchSupabaseTable('media_user_state', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_user_state')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_user_state', 'media_user_state');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_user_state');
      const fallback = updateMediaFallbackStore((store) => {
        for (const row of rows) {
          const index = store.user_state.findIndex(
            (candidate) => normalizeMediaString(candidate.user_id) === row.user_id
              && sanitizeMediaIdentifier(candidate.video_id) === sanitizeMediaIdentifier(row.video_id),
          );
          if (index >= 0) {
            store.user_state[index] = {
              ...store.user_state[index],
              favorite: row.favorite,
              updated_at: row.updated_at,
            };
          } else {
            store.user_state.push({
              user_id: row.user_id,
              video_id: sanitizeMediaIdentifier(row.video_id),
              favorite: row.favorite,
              rating: 0,
              updated_at: row.updated_at,
            });
          }
        }
        return store;
      });

      const updated = rows.map((row) => {
        const existing = fallback.user_state.find(
          (candidate) => normalizeMediaString(candidate.user_id) === row.user_id
            && sanitizeMediaIdentifier(candidate.video_id) === sanitizeMediaIdentifier(row.video_id),
        );
        return {
          user_id: row.user_id,
          video_id: sanitizeMediaIdentifier(row.video_id),
          favorite: normalizeBoolean(existing?.favorite, row.favorite),
          rating: Math.max(0, Math.min(5, Math.round(coerceNumber(existing?.rating, 0)))),
          updated_at: normalizeMediaString(existing?.updated_at || row.updated_at),
        };
      });

      return {
        mode: 'live',
        bridge: 'media_user_state',
        data: {
          user_id: userId,
          updated,
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to update favorites.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_user_state',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_user_state',
    data: {
      user_id: userId,
      updated: Array.isArray(response.data) ? response.data : rows,
    },
  };
}

async function updateMediaRating(payload = {}, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const videoId = sanitizeMediaIdentifier(payload.video_id);
  if (!videoId) {
    return buildValidationError('video_id_required', 'Provide video_id for rating updates.');
  }

  const rating = Math.max(1, Math.min(5, Math.round(coerceNumber(payload.rating, 0))));
  if (!rating) {
    return buildValidationError('rating_required', 'Rating must be an integer from 1 to 5.');
  }

  const row = {
    user_id: userId,
    video_id: videoId,
    rating,
    updated_at: new Date().toISOString(),
  };

  const response = await fetchSupabaseTable('media_user_state', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_user_state')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_user_state', 'media_user_state');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_user_state');
      const fallback = updateMediaFallbackStore((store) => {
        const index = store.user_state.findIndex(
          (candidate) => normalizeMediaString(candidate.user_id) === row.user_id
            && sanitizeMediaIdentifier(candidate.video_id) === sanitizeMediaIdentifier(row.video_id),
        );
        if (index >= 0) {
          store.user_state[index] = {
            ...store.user_state[index],
            rating: row.rating,
            updated_at: row.updated_at,
          };
        } else {
          store.user_state.push({
            user_id: row.user_id,
            video_id: sanitizeMediaIdentifier(row.video_id),
            favorite: false,
            rating: row.rating,
            updated_at: row.updated_at,
          });
        }
        return store;
      });

      const updated = fallback.user_state.find(
        (candidate) => normalizeMediaString(candidate.user_id) === row.user_id
          && sanitizeMediaIdentifier(candidate.video_id) === sanitizeMediaIdentifier(row.video_id),
      ) || row;

      return {
        mode: 'live',
        bridge: 'media_user_state',
        data: {
          user_id: userId,
          updated: {
            user_id: row.user_id,
            video_id: sanitizeMediaIdentifier(updated.video_id),
            favorite: normalizeBoolean(updated.favorite, false),
            rating: Math.max(0, Math.min(5, Math.round(coerceNumber(updated.rating, row.rating)))),
            updated_at: normalizeMediaString(updated.updated_at || row.updated_at),
          },
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to update rating.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_user_state',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_user_state',
    data: {
      user_id: userId,
      updated: Array.isArray(response.data) ? response.data[0] : row,
    },
  };
}

function normalizeTagName(value) {
  return normalizeMediaString(value).replace(/\s+/gu, ' ');
}

async function resolveSystemTagId(tagName, userId) {
  const upsert = await fetchSupabaseTable('media_tags', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{
      name: tagName,
      type: 'system',
      created_by: userId,
    }]),
  });
  if (!upsert.ok) {
    if (isMissingSupabaseTableError(upsert, 'media_tags')) {
      if (!isMediaFallbackEnabled()) {
        const schemaError = buildMediaSchemaNotInitializedError('media_tags', 'media_tags');
        return {
          ok: false,
          status: schemaError.httpStatus,
          error: schemaError.message,
          code: schemaError.error,
        };
      }

      console.warn('[MEDIA_FALLBACK]', 'media_tags');
      const fallback = updateMediaFallbackStore((store) => {
        const existing = store.tags.find(
          (tag) => normalizeTagName(tag.name) === tagName
            && normalizeMediaLower(tag.type || 'system') === 'system',
        );
        if (!existing) {
          store.tags.push({
            id: randomUUID(),
            name: tagName,
            type: 'system',
            created_by: userId,
            created_at: new Date().toISOString(),
          });
        }
        return store;
      });
      const resolved = fallback.tags.find(
        (tag) => normalizeTagName(tag.name) === tagName
          && normalizeMediaLower(tag.type || 'system') === 'system',
      );
      return resolved?.id
        ? { ok: true, tagId: resolved.id }
        : {
          ok: false,
          status: 404,
          error: `System tag '${tagName}' could not be resolved.`,
        };
    }

    return upsert;
  }

  const created = Array.isArray(upsert.data) ? upsert.data[0] : null;
  if (created?.id) {
    return {
      ok: true,
      tagId: created.id,
    };
  }

  const lookupQuery = new URLSearchParams();
  lookupQuery.set('select', 'id,name,type');
  lookupQuery.set('name', `eq.${tagName}`);
  lookupQuery.set('type', 'eq.system');
  const lookup = await fetchSupabaseTable(`media_tags?${lookupQuery.toString()}`);
  if (!lookup.ok) {
    return lookup;
  }
  const tag = Array.isArray(lookup.data) ? lookup.data[0] : null;
  if (!tag?.id) {
    return {
      ok: false,
      status: 404,
      error: `System tag '${tagName}' could not be resolved.`,
    };
  }
  return {
    ok: true,
    tagId: tag.id,
  };
}

async function addMediaTag(payload = {}, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const tagName = normalizeTagName(payload.tag_name || payload.name);
  if (!tagName) {
    return buildValidationError('tag_name_required', 'Provide tag_name for tag assignment.');
  }

  const type = normalizeMediaLower(payload.type || 'user');
  const videoIds = normalizeVideoIdList(payload);
  if (!videoIds.length) {
    return buildValidationError('video_id_required', 'Provide at least one video_id for tag assignment.');
  }

  if (type === 'system') {
    const tagResolution = await resolveSystemTagId(tagName, userId);
    if (!tagResolution.ok) {
      if (tagResolution.code === 'media_schema_not_initialized') {
        return buildMediaSchemaNotInitializedError('media_tags', 'media_tags');
      }
      return buildBridgeError('supabase', tagResolution.error || 'Unable to resolve system tag.', targetLabel(CONFIG.supabaseUrl), {
        bridge: 'media_tags',
      });
    }

    const rows = videoIds.map((videoId) => ({
      video_id: videoId,
      tag_id: tagResolution.tagId,
    }));
    const response = await fetchSupabaseTable('media_video_tags', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
    });
    if (!response.ok) {
      if (isMissingSupabaseTableError(response, 'media_video_tags') || isMissingSupabaseTableError(response, 'media_tags')) {
        if (!isMediaFallbackEnabled()) {
          return buildMediaSchemaNotInitializedError('media_video_tags', 'media_video_tags');
        }

        console.warn('[MEDIA_FALLBACK]', 'media_video_tags');
        updateMediaFallbackStore((store) => {
          for (const row of rows) {
            const exists = store.video_tags.some(
              (candidate) => sanitizeMediaIdentifier(candidate.video_id) === sanitizeMediaIdentifier(row.video_id)
                && normalizeMediaString(candidate.tag_id) === normalizeMediaString(row.tag_id),
            );
            if (!exists) {
              store.video_tags.push({
                video_id: sanitizeMediaIdentifier(row.video_id),
                tag_id: row.tag_id,
              });
            }
          }
          return store;
        });

        return {
          mode: 'live',
          bridge: 'media_tags',
          data: {
            type: 'system',
            tag_name: tagName,
            assigned_video_ids: videoIds,
          },
        };
      }

      return buildBridgeError('supabase', response.error || 'Unable to assign system tags.', targetLabel(CONFIG.supabaseUrl), {
        bridge: 'media_video_tags',
      });
    }

    return {
      mode: 'live',
      bridge: 'media_tags',
      data: {
        type: 'system',
        tag_name: tagName,
        assigned_video_ids: videoIds,
      },
    };
  }

  const rows = videoIds.map((videoId) => ({
    user_id: userId,
    video_id: videoId,
    tag_name: tagName,
  }));
  const response = await fetchSupabaseTable('media_user_video_tags', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_user_video_tags')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_user_video_tags', 'media_user_video_tags');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_user_video_tags');
      updateMediaFallbackStore((store) => {
        for (const row of rows) {
          const exists = store.user_video_tags.some(
            (candidate) => normalizeMediaString(candidate.user_id) === row.user_id
              && sanitizeMediaIdentifier(candidate.video_id) === sanitizeMediaIdentifier(row.video_id)
              && normalizeTagName(candidate.tag_name) === row.tag_name,
          );
          if (!exists) {
            store.user_video_tags.push({
              user_id: row.user_id,
              video_id: sanitizeMediaIdentifier(row.video_id),
              tag_name: row.tag_name,
              created_at: new Date().toISOString(),
            });
          }
        }
        return store;
      });

      return {
        mode: 'live',
        bridge: 'media_tags',
        data: {
          type: 'user',
          user_id: userId,
          tag_name: tagName,
          assigned_video_ids: videoIds,
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to assign user tags.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_user_video_tags',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_tags',
    data: {
      type: 'user',
      user_id: userId,
      tag_name: tagName,
      assigned_video_ids: videoIds,
    },
  };
}

async function removeMediaTag(payload = {}, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const tagName = normalizeTagName(payload.tag_name || payload.name);
  const videoIds = normalizeVideoIdList(payload);
  if (!tagName || !videoIds.length) {
    return buildValidationError('tag_remove_invalid', 'Provide tag_name and video_id/video_ids for tag removal.');
  }

  const type = normalizeMediaLower(payload.type || 'user');

  if (type === 'system') {
    const tagLookup = new URLSearchParams();
    tagLookup.set('select', 'id');
    tagLookup.set('name', `eq.${tagName}`);
    tagLookup.set('type', 'eq.system');
    const tagResponse = await fetchSupabaseTable(`media_tags?${tagLookup.toString()}`);
    if (!tagResponse.ok) {
      if (isMissingSupabaseTableError(tagResponse, 'media_tags')) {
        if (!isMediaFallbackEnabled()) {
          return buildMediaSchemaNotInitializedError('media_tags', 'media_tags');
        }

        console.warn('[MEDIA_FALLBACK]', 'media_tags');
        const beforeStore = loadMediaFallbackStore();
        const systemTag = beforeStore.tags.find(
          (candidate) => normalizeTagName(candidate.name) === tagName
            && normalizeMediaLower(candidate.type || 'system') === 'system',
        );
        const beforeCount = systemTag?.id
          ? beforeStore.video_tags.filter(
            (row) => normalizeMediaString(row.tag_id) === normalizeMediaString(systemTag.id)
              && videoIds.includes(sanitizeMediaIdentifier(row.video_id)),
          ).length
          : 0;

        const fallbackResult = updateMediaFallbackStore((store) => {
          const tag = store.tags.find(
            (candidate) => normalizeTagName(candidate.name) === tagName
              && normalizeMediaLower(candidate.type || 'system') === 'system',
          );
          if (!tag?.id) {
            return store;
          }

          store.video_tags = store.video_tags.filter((row) => {
            const sameTag = normalizeMediaString(row.tag_id) === normalizeMediaString(tag.id);
            const sameVideo = videoIds.includes(sanitizeMediaIdentifier(row.video_id));
            return !(sameTag && sameVideo);
          });
          return store;
        });

        const updatedTag = fallbackResult.tags.find(
          (candidate) => normalizeTagName(candidate.name) === tagName
            && normalizeMediaLower(candidate.type || 'system') === 'system',
        );
        const afterCount = updatedTag?.id
          ? fallbackResult.video_tags.filter(
            (row) => normalizeMediaString(row.tag_id) === normalizeMediaString(updatedTag.id)
              && videoIds.includes(sanitizeMediaIdentifier(row.video_id)),
          ).length
          : 0;

        return {
          mode: 'live',
          bridge: 'media_tags',
          data: {
            type: 'system',
            tag_name: tagName,
            removed: Math.max(0, beforeCount - afterCount),
          },
        };
      }

      return buildBridgeError('supabase', tagResponse.error || 'Unable to lookup system tag.', targetLabel(CONFIG.supabaseUrl), {
        bridge: 'media_tags',
      });
    }
    const tagId = Array.isArray(tagResponse.data) ? tagResponse.data[0]?.id : null;
    if (!tagId) {
      return {
        mode: 'live',
        bridge: 'media_tags',
        data: {
          removed: 0,
          type: 'system',
          tag_name: tagName,
          video_ids: videoIds,
        },
      };
    }

    const deleteResponse = await fetchSupabaseTable(
      `media_video_tags?tag_id=eq.${tagId}&video_id=in.(${videoIds.join(',')})`,
      {
        method: 'DELETE',
        headers: {
          Prefer: 'return=representation',
        },
      },
    );
    if (!deleteResponse.ok) {
      if (isMissingSupabaseTableError(deleteResponse, 'media_video_tags')) {
        if (!isMediaFallbackEnabled()) {
          return buildMediaSchemaNotInitializedError('media_video_tags', 'media_video_tags');
        }

        console.warn('[MEDIA_FALLBACK]', 'media_video_tags');
        const beforeStore = loadMediaFallbackStore();
        const beforeCount = beforeStore.video_tags.length;
        const afterStore = updateMediaFallbackStore((store) => {
          store.video_tags = store.video_tags.filter((row) => {
            const sameTag = normalizeMediaString(row.tag_id) === normalizeMediaString(tagId);
            const sameVideo = videoIds.includes(sanitizeMediaIdentifier(row.video_id));
            return !(sameTag && sameVideo);
          });
          return store;
        });
        return {
          mode: 'live',
          bridge: 'media_tags',
          data: {
            type: 'system',
            tag_name: tagName,
            removed: Math.max(0, beforeCount - afterStore.video_tags.length),
          },
        };
      }

      return buildBridgeError('supabase', deleteResponse.error || 'Unable to remove system tag mapping.', targetLabel(CONFIG.supabaseUrl), {
        bridge: 'media_video_tags',
      });
    }

    return {
      mode: 'live',
      bridge: 'media_tags',
      data: {
        type: 'system',
        tag_name: tagName,
        removed: Array.isArray(deleteResponse.data) ? deleteResponse.data.length : 0,
      },
    };
  }

  const deleteResponse = await fetchSupabaseTable(
    `media_user_video_tags?user_id=eq.${userId}&tag_name=eq.${encodeURIComponent(tagName)}&video_id=in.(${videoIds.join(',')})`,
    {
      method: 'DELETE',
      headers: {
        Prefer: 'return=representation',
      },
    },
  );
  if (!deleteResponse.ok) {
    if (isMissingSupabaseTableError(deleteResponse, 'media_user_video_tags')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_user_video_tags', 'media_user_video_tags');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_user_video_tags');
      const beforeStore = loadMediaFallbackStore();
      const beforeCount = beforeStore.user_video_tags.length;
      const afterStore = updateMediaFallbackStore((store) => {
        store.user_video_tags = store.user_video_tags.filter((row) => {
          const sameUser = normalizeMediaString(row.user_id) === userId;
          const sameTag = normalizeTagName(row.tag_name) === tagName;
          const sameVideo = videoIds.includes(sanitizeMediaIdentifier(row.video_id));
          return !(sameUser && sameTag && sameVideo);
        });
        return store;
      });
      return {
        mode: 'live',
        bridge: 'media_tags',
        data: {
          type: 'user',
          user_id: userId,
          tag_name: tagName,
          removed: Math.max(0, beforeCount - afterStore.user_video_tags.length),
        },
      };
    }

    return buildBridgeError('supabase', deleteResponse.error || 'Unable to remove user tag mapping.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_user_video_tags',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_tags',
    data: {
      type: 'user',
      user_id: userId,
      tag_name: tagName,
      removed: Array.isArray(deleteResponse.data) ? deleteResponse.data.length : 0,
    },
  };
}

async function getMediaTags(searchParams, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const systemResponse = await fetchSupabaseTable('media_tags?select=id,name,type,created_by,created_at&order=name.asc');
  const userResponse = await fetchSupabaseTable(`media_user_video_tags?select=tag_name,video_id,created_at&user_id=eq.${userId}&order=created_at.desc`);
  if (!systemResponse.ok || !userResponse.ok) {
    if (isMissingSupabaseTableError(systemResponse, 'media_tags') || isMissingSupabaseTableError(userResponse, 'media_user_video_tags')) {
      if (!isMediaFallbackEnabled()) {
        const missingTable = isMissingSupabaseTableError(systemResponse, 'media_tags')
          ? 'media_tags'
          : 'media_user_video_tags';
        const bridge = missingTable === 'media_tags' ? 'media_tags' : 'media_user_video_tags';
        return buildMediaSchemaNotInitializedError(missingTable, bridge);
      }

      console.warn('[MEDIA_FALLBACK]', 'media_tags');
      const fallback = loadMediaFallbackStore();
      const systemTags = fallback.tags
        .map((row) => ({
          id: row.id,
          name: normalizeTagName(row.name),
          type: normalizeMediaLower(row.type || 'system') || 'system',
          created_by: normalizeMediaString(row.created_by),
          created_at: normalizeMediaString(row.created_at),
        }))
        .filter((row) => row.name);
      const userTags = [...new Set(
        fallback.user_video_tags
          .filter((row) => normalizeMediaString(row.user_id) === userId)
          .map((row) => normalizeTagName(row.tag_name))
          .filter(Boolean),
      )];
      const allTags = [...new Set([
        ...systemTags.map((row) => row.name),
        ...userTags,
      ])].sort((left, right) => left.localeCompare(right, 'en-US'));

      return {
        mode: 'live',
        bridge: 'media_tags',
        data: {
          user_id: userId,
          system_tags: systemTags,
          user_tags: userTags,
          all_tags: allTags,
        },
      };
    }

    const message = systemResponse.ok
      ? (userResponse.error || 'Unable to load user tags.')
      : (systemResponse.error || 'Unable to load system tags.');
    const bridge = systemResponse.ok ? 'media_user_video_tags' : 'media_tags';
    return buildBridgeError('supabase', message, targetLabel(CONFIG.supabaseUrl), { bridge });
  }

  const userTags = [...new Set((Array.isArray(userResponse.data) ? userResponse.data : []).map((row) => normalizeTagName(row.tag_name)).filter(Boolean))];
  const systemTags = (Array.isArray(systemResponse.data) ? systemResponse.data : [])
    .map((row) => ({
      id: row.id,
      name: normalizeTagName(row.name),
      type: normalizeMediaLower(row.type || 'system') || 'system',
      created_by: normalizeMediaString(row.created_by),
      created_at: normalizeMediaString(row.created_at),
    }))
    .filter((row) => row.name);

  const allTags = [...new Set([
    ...systemTags.map((row) => row.name),
    ...userTags,
  ])].sort((left, right) => left.localeCompare(right, 'en-US'));

  return {
    mode: 'live',
    bridge: 'media_tags',
    data: {
      user_id: userId,
      system_tags: systemTags,
      user_tags: userTags,
      all_tags: allTags,
    },
  };
}

async function getMediaVideoTags(searchParams, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const videoIds = [
    ...parseCommaList(searchParams.get('video_ids')),
    ...parseCommaList(searchParams.get('video_id')),
  ].map((value) => sanitizeMediaIdentifier(value)).filter(Boolean);
  if (!videoIds.length) {
    return buildValidationError('video_id_required', 'Provide video_id or video_ids to load video tags.');
  }

  const userTagResponse = await fetchSupabaseTable(
    `media_user_video_tags?select=video_id,tag_name,created_at&user_id=eq.${userId}&video_id=in.(${videoIds.join(',')})`,
  );
  const systemMapResponse = await fetchSupabaseTable(`media_video_tags?select=video_id,tag_id&video_id=in.(${videoIds.join(',')})`);
  if (!userTagResponse.ok || !systemMapResponse.ok) {
    if (isMissingSupabaseTableError(userTagResponse, 'media_user_video_tags') || isMissingSupabaseTableError(systemMapResponse, 'media_video_tags')) {
      if (!isMediaFallbackEnabled()) {
        const missingTable = isMissingSupabaseTableError(userTagResponse, 'media_user_video_tags')
          ? 'media_user_video_tags'
          : 'media_video_tags';
        const bridge = missingTable === 'media_video_tags' ? 'media_video_tags' : 'media_user_video_tags';
        return buildMediaSchemaNotInitializedError(missingTable, bridge);
      }

      console.warn('[MEDIA_FALLBACK]', 'media_video_tags');
      const fallback = loadMediaFallbackStore();
      const tagsById = new Map(
        fallback.tags.map((row) => [normalizeMediaString(row.id), normalizeTagName(row.name)]),
      );
      const result = {};
      for (const videoId of videoIds) {
        result[videoId] = {
          video_id: videoId,
          system: [],
          user: [],
          all: [],
        };
      }

      for (const row of fallback.video_tags) {
        const key = sanitizeMediaIdentifier(row.video_id);
        const tagName = tagsById.get(normalizeMediaString(row.tag_id));
        if (!result[key] || !tagName) {
          continue;
        }
        result[key].system.push(tagName);
      }

      for (const row of fallback.user_video_tags) {
        const key = sanitizeMediaIdentifier(row.video_id);
        if (!result[key] || normalizeMediaString(row.user_id) !== userId) {
          continue;
        }
        const tagName = normalizeTagName(row.tag_name);
        if (tagName) {
          result[key].user.push(tagName);
        }
      }

      for (const key of Object.keys(result)) {
        result[key].system = [...new Set(result[key].system)];
        result[key].user = [...new Set(result[key].user)];
        result[key].all = [...new Set([...result[key].system, ...result[key].user])];
      }

      return {
        mode: 'live',
        bridge: 'media_tags',
        data: {
          user_id: userId,
          items: Object.values(result),
        },
      };
    }

    const message = userTagResponse.ok
      ? (systemMapResponse.error || 'Unable to load system video tag links.')
      : (userTagResponse.error || 'Unable to load user video tags.');
    const bridge = userTagResponse.ok ? 'media_video_tags' : 'media_user_video_tags';
    return buildBridgeError('supabase', message, targetLabel(CONFIG.supabaseUrl), { bridge });
  }

  const tagIds = [...new Set((Array.isArray(systemMapResponse.data) ? systemMapResponse.data : []).map((row) => row.tag_id).filter(Boolean))];
  let tagsById = new Map();
  if (tagIds.length) {
    const tagsResponse = await fetchSupabaseTable(`media_tags?select=id,name,type&id=in.(${tagIds.join(',')})`);
    if (!tagsResponse.ok) {
      if (isMissingSupabaseTableError(tagsResponse, 'media_tags')) {
        if (!isMediaFallbackEnabled()) {
          return buildMediaSchemaNotInitializedError('media_tags', 'media_tags');
        }

        console.warn('[MEDIA_FALLBACK]', 'media_tags');
        const fallback = loadMediaFallbackStore();
        tagsById = new Map(fallback.tags.map((row) => [row.id, row]));
      } else {
        return buildBridgeError('supabase', tagsResponse.error || 'Unable to load tag definitions.', targetLabel(CONFIG.supabaseUrl), {
          bridge: 'media_tags',
        });
      }
    }
    if (tagsResponse.ok) {
      tagsById = new Map((Array.isArray(tagsResponse.data) ? tagsResponse.data : []).map((row) => [row.id, row]));
    }
  }

  const result = {};
  for (const videoId of videoIds) {
    result[videoId] = {
      video_id: videoId,
      system: [],
      user: [],
      all: [],
    };
  }

  for (const row of Array.isArray(systemMapResponse.data) ? systemMapResponse.data : []) {
    const entry = result[row.video_id];
    const tag = tagsById.get(row.tag_id);
    const tagName = normalizeTagName(tag?.name);
    if (!entry || !tagName) {
      continue;
    }
    entry.system.push(tagName);
  }

  for (const row of Array.isArray(userTagResponse.data) ? userTagResponse.data : []) {
    const entry = result[row.video_id];
    const tagName = normalizeTagName(row.tag_name);
    if (!entry || !tagName) {
      continue;
    }
    entry.user.push(tagName);
  }

  for (const key of Object.keys(result)) {
    const systemTags = [...new Set(result[key].system)];
    const userTags = [...new Set(result[key].user)];
    result[key].system = systemTags;
    result[key].user = userTags;
    result[key].all = [...new Set([...systemTags, ...userTags])];
  }

  return {
    mode: 'live',
    bridge: 'media_tags',
    data: {
      user_id: userId,
      items: Object.values(result),
    },
  };
}

async function createMediaPlaylist(payload = {}, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const name = normalizeMediaString(payload.name);
  if (!name) {
    return buildValidationError('playlist_name_required', 'Provide playlist name.');
  }

  const row = {
    user_id: userId,
    name,
    description: normalizeMediaString(payload.description || ''),
    updated_at: new Date().toISOString(),
  };
  const response = await fetchSupabaseTable('media_playlists', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify([row]),
  });
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_playlists')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_playlists', 'media_playlists');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_playlists');
      const created = {
        id: randomUUID(),
        user_id: userId,
        name,
        description: normalizeMediaString(payload.description || ''),
        created_at: new Date().toISOString(),
        updated_at: row.updated_at,
      };
      updateMediaFallbackStore((store) => {
        store.playlists.push(created);
        return store;
      });
      return {
        mode: 'live',
        bridge: 'media_playlists',
        data: {
          playlist: created,
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to create playlist.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_playlists',
    });
  }

  const playlist = Array.isArray(response.data) ? response.data[0] : row;
  return {
    mode: 'live',
    bridge: 'media_playlists',
    data: {
      playlist,
    },
  };
}

async function addMediaPlaylistItems(payload = {}, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const playlistId = normalizeMediaString(payload.playlist_id);
  if (!playlistId) {
    return buildValidationError('playlist_id_required', 'Provide playlist_id for playlist add.');
  }

  const videoIds = normalizeVideoIdList(payload);
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems.length
    ? rawItems.map((item, index) => ({
      playlist_id: playlistId,
      video_id: sanitizeMediaIdentifier(item.video_id || item.id),
      start_time: item.start_time === undefined ? null : coerceNumber(item.start_time, 0),
      end_time: item.end_time === undefined ? null : coerceNumber(item.end_time, 0),
      position: Math.max(0, Math.floor(coerceNumber(item.position, index))),
      added_by: userId,
    })).filter((item) => item.video_id)
    : videoIds.map((videoId, index) => ({
      playlist_id: playlistId,
      video_id: videoId,
      start_time: null,
      end_time: null,
      position: index,
      added_by: userId,
    }));

  if (!items.length) {
    return buildValidationError('playlist_items_required', 'Provide video_ids or items for playlist add.');
  }

  const response = await fetchSupabaseTable('media_playlist_items', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(items),
  });
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_playlist_items') || isMissingSupabaseTableError(response, 'media_playlists')) {
      if (!isMediaFallbackEnabled()) {
        const missingTable = isMissingSupabaseTableError(response, 'media_playlist_items')
          ? 'media_playlist_items'
          : 'media_playlists';
        const bridge = missingTable === 'media_playlist_items' ? 'media_playlist_items' : 'media_playlists';
        return buildMediaSchemaNotInitializedError(missingTable, bridge);
      }

      console.warn('[MEDIA_FALLBACK]', 'media_playlist_items');
      const fallbackRows = items.map((item) => ({
        id: randomUUID(),
        playlist_id: normalizeMediaString(item.playlist_id),
        video_id: sanitizeMediaIdentifier(item.video_id),
        start_time: item.start_time,
        end_time: item.end_time,
        position: item.position,
        added_by: userId,
        created_at: new Date().toISOString(),
      }));
      updateMediaFallbackStore((store) => {
        for (const row of fallbackRows) {
          const exists = store.playlist_items.some(
            (candidate) => normalizeMediaString(candidate.playlist_id) === row.playlist_id
              && sanitizeMediaIdentifier(candidate.video_id) === row.video_id,
          );
          if (!exists) {
            store.playlist_items.push(row);
          }
        }
        const playlist = store.playlists.find((entry) => normalizeMediaString(entry.id) === playlistId);
        if (playlist) {
          playlist.updated_at = new Date().toISOString();
        }
        return store;
      });

      return {
        mode: 'live',
        bridge: 'media_playlists',
        data: {
          playlist_id: playlistId,
          items: fallbackRows,
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to add playlist items.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_playlist_items',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_playlists',
    data: {
      playlist_id: playlistId,
      items: Array.isArray(response.data) ? response.data : items,
    },
  };
}

async function getMediaPlaylists(session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const playlistResponse = await fetchSupabaseTable(`media_playlists?select=*&user_id=eq.${userId}&order=updated_at.desc`);
  if (!playlistResponse.ok) {
    if (isMissingSupabaseTableError(playlistResponse, 'media_playlists')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_playlists', 'media_playlists');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_playlists');
      const fallback = loadMediaFallbackStore();
      const playlists = fallback.playlists
        .filter((row) => normalizeMediaString(row.user_id) === userId)
        .sort((left, right) => new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime())
        .map((playlist) => ({
          ...playlist,
          items: fallback.playlist_items
            .filter((row) => normalizeMediaString(row.playlist_id) === normalizeMediaString(playlist.id))
            .sort((left, right) => Number(left.position || 0) - Number(right.position || 0)),
        }));

      return {
        mode: 'live',
        bridge: 'media_playlists',
        data: { user_id: userId, playlists },
      };
    }

    return buildBridgeError('supabase', playlistResponse.error || 'Unable to load playlists.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_playlists',
    });
  }
  const playlists = Array.isArray(playlistResponse.data) ? playlistResponse.data : [];
  if (!playlists.length) {
    return {
      mode: 'live',
      bridge: 'media_playlists',
      data: { user_id: userId, playlists: [] },
    };
  }

  const ids = playlists.map((row) => sanitizeMediaIdentifier(row.id)).filter(Boolean);
  const itemsResponse = await fetchSupabaseTable(`media_playlist_items?select=*&playlist_id=in.(${ids.join(',')})&order=position.asc,created_at.asc`);
  if (!itemsResponse.ok) {
    if (isMissingSupabaseTableError(itemsResponse, 'media_playlist_items')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_playlist_items', 'media_playlist_items');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_playlist_items');
      const fallback = loadMediaFallbackStore();
      const playlistsWithItems = playlists.map((playlist) => ({
        ...playlist,
        items: fallback.playlist_items
          .filter((row) => normalizeMediaString(row.playlist_id) === normalizeMediaString(playlist.id))
          .sort((left, right) => Number(left.position || 0) - Number(right.position || 0)),
      }));
      return {
        mode: 'live',
        bridge: 'media_playlists',
        data: {
          user_id: userId,
          playlists: playlistsWithItems,
        },
      };
    }

    return buildBridgeError('supabase', itemsResponse.error || 'Unable to load playlist items.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_playlist_items',
    });
  }
  const items = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
  const byPlaylist = new Map();
  for (const row of items) {
    const key = normalizeMediaString(row.playlist_id);
    if (!key) {
      continue;
    }
    if (!byPlaylist.has(key)) {
      byPlaylist.set(key, []);
    }
    byPlaylist.get(key).push(row);
  }

  return {
    mode: 'live',
    bridge: 'media_playlists',
    data: {
      user_id: userId,
      playlists: playlists.map((playlist) => ({
        ...playlist,
        items: byPlaylist.get(normalizeMediaString(playlist.id)) || [],
      })),
    },
  };
}

async function createMediaClip(payload = {}, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const videoId = sanitizeMediaIdentifier(payload.video_id);
  if (!videoId) {
    return buildValidationError('video_id_required', 'Provide video_id for clip creation.');
  }

  const startTime = coerceNumber(payload.start_time, 0);
  const endTime = Math.max(startTime, coerceNumber(payload.end_time, startTime));
  const tags = Array.isArray(payload.tags) ? payload.tags.map((tag) => normalizeTagName(tag)).filter(Boolean) : [];
  const row = {
    video_id: videoId,
    start_time: startTime,
    end_time: endTime,
    title: normalizeMediaString(payload.title || `Clip ${startTime.toFixed(2)}-${endTime.toFixed(2)}`),
    tags,
    created_by: userId,
  };

  const response = await fetchSupabaseTable('media_clips', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify([row]),
  });
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_clips')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_clips', 'media_clips');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_clips');
      const clip = {
        id: randomUUID(),
        ...row,
        created_at: new Date().toISOString(),
      };
      updateMediaFallbackStore((store) => {
        store.clips.push(clip);
        return store;
      });
      return {
        mode: 'live',
        bridge: 'media_clips',
        data: {
          clip,
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to create clip.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_clips',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_clips',
    data: {
      clip: Array.isArray(response.data) ? response.data[0] : row,
    },
  };
}

async function getMediaClips(searchParams, session = null) {
  const userId = requireMediaUserId(session);
  if (typeof userId !== 'string') {
    return userId;
  }

  const query = new URLSearchParams();
  query.set('select', '*');
  query.set('created_by', `eq.${userId}`);
  const videoId = sanitizeMediaIdentifier(searchParams.get('video_id'));
  if (videoId) {
    query.set('video_id', `eq.${videoId}`);
  }
  query.set('order', 'created_at.desc');
  query.set('limit', String(Math.max(1, Math.min(200, Math.floor(coerceNumber(searchParams.get('limit'), 100))))));

  const response = await fetchSupabaseTable(`media_clips?${query.toString()}`);
  if (!response.ok) {
    if (isMissingSupabaseTableError(response, 'media_clips')) {
      if (!isMediaFallbackEnabled()) {
        return buildMediaSchemaNotInitializedError('media_clips', 'media_clips');
      }

      console.warn('[MEDIA_FALLBACK]', 'media_clips');
      const fallback = loadMediaFallbackStore();
      const limit = Math.max(1, Math.min(200, Math.floor(coerceNumber(searchParams.get('limit'), 100))));
      const items = fallback.clips
        .filter((row) => normalizeMediaString(row.created_by) === userId)
        .filter((row) => !videoId || sanitizeMediaIdentifier(row.video_id) === videoId)
        .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
        .slice(0, limit);

      return {
        mode: 'live',
        bridge: 'media_clips',
        data: {
          user_id: userId,
          items,
        },
      };
    }

    return buildBridgeError('supabase', response.error || 'Unable to load clips.', targetLabel(CONFIG.supabaseUrl), {
      bridge: 'media_clips',
    });
  }

  return {
    mode: 'live',
    bridge: 'media_clips',
    data: {
      user_id: userId,
      items: Array.isArray(response.data) ? response.data : [],
    },
  };
}

async function getStudioWorkspace() {
  if (!CONFIG.studioBase) {
    return buildConfigError('studio', 'Set MMHQ_STUDIO_BASE, or let Studio fall back from MMHQ_CIE_BASE, before loading the Studio workspace.', targetLabel(CONFIG.studioBase), {
      source: getStudioEndpointSource(),
      required_env: ['MMHQ_CIE_BASE', 'MMHQ_STUDIO_BASE'],
    });
  }

  const [health, assets, timelines, collections, exports] = await Promise.all([
    probeStudio(),
    getMediaList(new URLSearchParams({ page_size: '6' })),
    fetchStudio('/api/timeline/timelines'),
    fetchStudio('/api/collections'),
    fetchStudio('/api/export/history'),
  ]);

  const errors = [];
  if (!health.online) {
    errors.push(health.note || 'Studio health check failed.');
  }
  if (assets?.httpStatus) {
    errors.push(assets.message || assets.error || 'Media assets could not be loaded.');
  }
  if (!timelines.ok) {
    errors.push(timelines.error || 'Studio timelines could not be loaded.');
  }
  if (!collections.ok) {
    errors.push(collections.error || 'Studio collections could not be loaded.');
  }
  if (!exports.ok) {
    errors.push(exports.error || 'Studio export history could not be loaded.');
  }

  if (errors.length) {
    return buildApiError(503, 'studio_unavailable', 'Studio workspace could not be loaded from live services.', {
      bridge: 'studio',
      target: targetLabel(CONFIG.studioBase),
      issues: errors,
    });
  }

  const projects = timelines.ok
    ? (timelines.data?.timelines || []).map((timeline) => ({
      id: `timeline_${timeline.id}`,
      timeline_id: timeline.id,
      name: timeline.name,
      owner: 'Studio',
      clip_count: Number(timeline.block_count || 0),
      status: Number(timeline.block_count || 0) > 0 ? 'active' : 'draft',
      updated_at: timeline.updated_at,
      total_duration_ms: timeline.total_duration_ms || 0,
    }))
    : [];

  const exportQueue = exports.ok
    ? (exports.data?.history || []).map((item, index) => ({
      id: item.timeline_id || `export_${index + 1}`,
      title: item.timeline_name || item.output_filename || 'Studio export',
      target: item.download_url || item.output_filename || 'MP4',
      status: item.success ? 'ready' : item.phase || 'review',
      created_at: item.completed_at || item.started_at || '',
    }))
    : [];

  const recentSessions = timelines.ok
    ? projects.slice(0, 5).map((project) => ({
      user: 'Studio',
      action: `${project.name} updated`,
      time: project.updated_at,
    }))
    : [];

  const collectionItems = collections.ok ? collections.data?.collections || [] : [];

  return {
    mode: 'live',
    bridge: 'studio',
    status: {
      connected: true,
      mode: 'live',
      message: 'Studio workspace connected.',
      launch_url: CONFIG.studioBase ? `${CONFIG.studioBase}/studio` : '',
    },
    projects,
    assets: assets.data?.items || [],
    collections: collectionItems,
    exportQueue,
    recentSessions,
  };
}

async function createStudioSession(payload) {
  if (!CONFIG.studioBase) {
    return buildConfigError('studio', 'Set MMHQ_STUDIO_BASE, or let Studio fall back from MMHQ_CIE_BASE, before creating studio sessions.', targetLabel(CONFIG.studioBase), {
      source: getStudioEndpointSource(),
      required_env: ['MMHQ_CIE_BASE', 'MMHQ_STUDIO_BASE'],
    });
  }

  const name = String(payload.name || '').trim() || 'Untitled Timeline';
  const response = await fetchStudio('/api/timeline/timelines', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    return buildApiError(502, 'studio_session_create_failed', response.error || 'Studio session creation failed.', {
      bridge: 'studio',
      target: targetLabel(CONFIG.studioBase),
    });
  }

  return {
    mode: 'live',
    bridge: 'studio',
    message: 'Studio session created.',
    item: response.data?.timeline || response.data,
  };
}

async function getHqSummary(session, request = null) {
  const [health, students, tasks, emails, payments, leadsSummary, mediaStats] = await Promise.all([
    getBridgeHealth(session, request),
    getStudents(new URLSearchParams(), session),
    getSupabaseTasks(session, new URLSearchParams()),
    getEmails(session),
    getHqPayments(new URLSearchParams(), session),
    getSupabaseLeadsSummary(session),
    getMediaStats(),
  ]);

  const corePayloads = [students, tasks, emails, payments, leadsSummary];
  const coreIssues = corePayloads
    .filter((payload) => payload && typeof payload === 'object' && Number.isInteger(payload.httpStatus));
  if (coreIssues.length) {
    return buildApiError(503, 'summary_unavailable', 'HQ summary could not be loaded from live services.', {
      bridge: 'hq_summary',
      issues: coreIssues.map((payload) => ({
        bridge: payload.bridge || '',
        error: payload.error,
        message: payload.message,
      })),
    });
  }

  const mediaUnavailable = mediaStats && typeof mediaStats === 'object' && Number.isInteger(mediaStats.httpStatus);
  const degradedBridges = [];
  if (mediaUnavailable) {
    degradedBridges.push({ bridge: mediaStats.bridge || 'media_engine', error: mediaStats.error, message: mediaStats.message });
  }

  const studentItems = students.items || [];
  const taskItems = tasks.items || [];
  const emailItems = emails.items || [];
  const leadItems = leadsSummary.topLeads || [];
  const paymentCards = payments.cards || [];
  const mediaSummary = mediaUnavailable ? {} : (mediaStats.data || {});

  return {
    generatedAt: new Date().toISOString(),
    mode: degradedBridges.length ? 'degraded' : 'live',
    issues: degradedBridges,
    metrics: {
      students: studentItems.length,
      openTasks: taskItems.filter((task) => ['open', 'in_progress'].includes(task.task_status)).length,
      emailDrafts: emailItems.length,
      leadWatchlist: leadsSummary.metrics?.high_probability || leadItems.length,
      capturedRevenue: paymentCards.find((card) => card.label === 'Captured Revenue')?.value || '$0',
      mediaReady: mediaSummary.ready_videos || mediaSummary.total || 0,
    },
    studentsNeedingAction: [...studentItems]
      .sort((left, right) => ((right.open_alert_count || 0) + (right.open_task_count || 0)) - ((left.open_alert_count || 0) + (left.open_task_count || 0)))
      .slice(0, 3),
    tasks: [...taskItems].slice(0, 6),
    emailQueue: [...emailItems].slice(0, 4),
    leadWatchlist: [...leadItems].slice(0, 4),
    paymentCards,
    mediaSummary,
    bridges: health.services,
  };
}

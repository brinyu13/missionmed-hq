import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRawBody, readJsonBody, parseJsonBody } from './http/body.mjs';
import { StripeGateway } from './payments/stripe.mjs';
import { authenticate, requireRole } from './security/auth.mjs';
import { PreviewStore, SupabaseRestStore } from './storage/supabase-rest.mjs';

const modulePath = fileURLToPath(import.meta.url);
const here = path.dirname(modulePath);
const defaultPublicDir = path.resolve(here, '../public');

function environmentConfig() {
  const production = process.env.NODE_ENV === 'production';
  return {
    production,
    localAuth: process.env.MISSIONACCOUNTS_AUTH_MODE === 'local',
    issuer: process.env.MISSIONACCOUNTS_JWT_ISSUER || 'https://missionmedinstitute.com',
    audience: process.env.MISSIONACCOUNTS_JWT_AUDIENCE || 'missionaccounts',
    jwksUrl: process.env.MISSIONACCOUNTS_JWKS_URL || 'https://missionmedinstitute.com/wp-json/missionmed/v1/jwks',
    features: {
      examPlans: process.env.MISSIONACCOUNTS_EXAM_PLANS === '1',
      compDays: process.env.MISSIONACCOUNTS_COMP_DAYS === '1',
      autoBilling: process.env.MISSIONACCOUNTS_AUTO_BILLING === '1',
      zoomSync: process.env.MISSIONACCOUNTS_ZOOM_SYNC === '1',
    },
  };
}

function environmentStore() {
  return process.env.MISSIONACCOUNTS_SUPABASE_URL && process.env.MISSIONACCOUNTS_SUPABASE_SERVICE_KEY
    ? new SupabaseRestStore({ url: process.env.MISSIONACCOUNTS_SUPABASE_URL, serviceKey: process.env.MISSIONACCOUNTS_SUPABASE_SERVICE_KEY })
    : new PreviewStore();
}

function environmentStripeGateway() {
  return new StripeGateway({
    secretKey: process.env.MISSIONACCOUNTS_STRIPE_SECRET_KEY,
    webhookSecret: process.env.MISSIONACCOUNTS_STRIPE_WEBHOOK_SECRET,
    apiVersion: process.env.MISSIONACCOUNTS_STRIPE_API_VERSION || '',
    mode: process.env.MISSIONACCOUNTS_STRIPE_MODE || 'disabled',
  });
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function mime(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream';
}

function requestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function requestIdFor(request) {
  const requestId = String(request.headers['idempotency-key'] || request.headers['x-request-id'] || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(requestId)) {
    throw requestError('A valid Idempotency-Key header is required');
  }
  return requestId;
}

function requireFeature(config, feature) {
  if (!config.features?.[feature]) throw requestError('This MissionAccounts capability is not enabled', 503);
}

export function createMissionAccountsServer({
  config = environmentConfig(),
  store = environmentStore(),
  stripeGateway = environmentStripeGateway(),
  publicDir = defaultPublicDir,
} = {}) {
  async function studentContext(identity) {
    const student = await store.studentByMatrixUser(identity.userId);
    if (!student) throw requestError('MissionAccounts record not found', 404);
    return student;
  }

  async function receiveStripeWebhook(request, response) {
    const rawBody = await readRawBody(request);
    stripeGateway.verifyWebhook(rawBody, request.headers['stripe-signature']);
    const event = parseJsonBody(rawBody);
    if (!event?.id || !event?.type || !event?.data?.object) throw requestError('Stripe event is incomplete');
    const result = await store.recordProviderEvent({
      provider: 'stripe',
      eventId: event.id,
      providerObjectId: event.data.object.id || null,
      eventType: event.type,
      payload: event,
      signatureVerified: true,
    });
    return json(response, 200, { received: true, duplicate: result.status === 'duplicate' });
  }

  async function handleApi(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json(response, 200, {
        status: 'ok',
        app: 'missionaccounts',
        mode: store instanceof PreviewStore ? 'preview' : 'configured',
        route_enabled: false,
        auto_billing_enabled: Boolean(config.features?.autoBilling),
        zoom_sync_enabled: Boolean(config.features?.zoomSync),
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/webhooks/stripe') {
      return receiveStripeWebhook(request, response);
    }

    const identity = await authenticate(request, config);
    if (request.method === 'GET' && url.pathname === '/api/session') {
      return json(response, 200, {
        authenticated: true,
        mode: identity.roles.includes('student') ? 'student' : 'admin',
        capabilities: {
          exam_plans: Boolean(config.features?.examPlans),
          comp_days: Boolean(config.features?.compDays),
          auto_billing: Boolean(config.features?.autoBilling),
          zoom_sync: Boolean(config.features?.zoomSync),
        },
      });
    }
    if (request.method === 'GET' && url.pathname === '/api/me') {
      const student = await studentContext(identity);
      const [attendance, billing, payment_method] = await Promise.all([
        store.attendanceForStudent(student.id, url.searchParams.get('cycle')),
        store.billingForStudent(student.id),
        store.paymentMethodForStudent(student.id),
      ]);
      return json(response, 200, { student, attendance, billing, payment_method });
    }
    if (request.method === 'POST' && url.pathname === '/api/me/exam-plan') {
      requireRole(identity, ['student']);
      requireFeature(config, 'examPlans');
      const student = await studentContext(identity);
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      if (!['s1', 's2', 's3'].includes(body.step) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.exam_on || ''))) {
        throw requestError('Exam plan requires step s1, s2, or s3 and exam_on as YYYY-MM-DD');
      }
      const result = await store.submitExamPlan({
        studentId: student.id,
        step: body.step,
        examOn: body.exam_on,
        actorId: identity.userId,
        actorRole: 'student',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    const compRoute = request.method === 'POST'
      ? url.pathname.match(/^\/api\/admin\/students\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/comp$/i)
      : null;
    if (compRoute) {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      requireFeature(config, 'compDays');
      const body = await readJsonBody(request, { limitBytes: 16_384 });
      const allowance = Number(body.allowance);
      const joinedOn = body.joined_on == null || body.joined_on === '' ? null : String(body.joined_on);
      const reason = String(body.reason || '').trim();
      if (!Number.isInteger(allowance) || allowance < 0 || allowance > 365) throw requestError('Comp allowance must be an integer from 0 through 365');
      if (joinedOn && !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) throw requestError('joined_on must be YYYY-MM-DD');
      if (!reason || reason.length > 2_000) throw requestError('A comp-day reason is required');
      const result = await store.setCompAllowance({
        studentId: compRoute[1],
        allowance,
        joinedOn,
        reason,
        applyRetroactively: body.apply_retroactively === true,
        actorId: identity.userId,
        actorRole: identity.roles.includes('founder') ? 'founder' : 'missionaccounts_admin',
        requestId: requestIdFor(request),
      });
      return json(response, result.duplicate ? 200 : 201, result);
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/health') {
      requireRole(identity, ['missionaccounts_admin', 'founder']);
      return json(response, 200, await store.adminHealth());
    }
    return json(response, 404, { code: 'NOT_FOUND', message: 'MissionAccounts endpoint not found' });
  }

  async function serveStatic(response, pathname) {
    const requested = pathname === '/' || pathname === '/missionaccounts' || pathname === '/missionaccounts/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(publicDir, requested);
    if (!file.startsWith(`${publicDir}${path.sep}`) || !existsSync(file)) return json(response, 404, { code: 'NOT_FOUND' });
    response.writeHead(200, { 'content-type': mime(file), 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'" });
    createReadStream(file).pipe(response);
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
      if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
      else await serveStatic(response, url.pathname);
    } catch (error) {
      const status = Number(error.status) || 500;
      json(response, status, { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_DENIED', message: config.production && status === 500 ? 'MissionAccounts request failed' : error.message });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const config = environmentConfig();
  const server = createMissionAccountsServer({ config });
  const port = Number(process.env.PORT || 4179);
  const host = config.production ? '0.0.0.0' : '127.0.0.1';
  server.listen(port, host, () => console.log(`MissionAccounts server listening on http://${host}:${port}`));
}

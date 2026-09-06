import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate, requireRole } from './security/auth.mjs';
import { PreviewStore, SupabaseRestStore } from './storage/supabase-rest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../public');
const production = process.env.NODE_ENV === 'production';
const localAuth = process.env.MISSIONACCOUNTS_AUTH_MODE === 'local';
const config = {
  production,
  localAuth,
  issuer: process.env.MISSIONACCOUNTS_JWT_ISSUER || 'https://missionmedinstitute.com',
  audience: process.env.MISSIONACCOUNTS_JWT_AUDIENCE || 'missionaccounts',
  jwksUrl: process.env.MISSIONACCOUNTS_JWKS_URL || 'https://missionmedinstitute.com/wp-json/missionmed/v1/jwks',
};
const store = process.env.MISSIONACCOUNTS_SUPABASE_URL && process.env.MISSIONACCOUNTS_SUPABASE_SERVICE_KEY
  ? new SupabaseRestStore({ url: process.env.MISSIONACCOUNTS_SUPABASE_URL, serviceKey: process.env.MISSIONACCOUNTS_SUPABASE_SERVICE_KEY })
  : new PreviewStore();

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function mime(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream';
}

async function identityFor(request) {
  return authenticate(request, config);
}

async function studentContext(identity) {
  const student = await store.studentByMatrixUser(identity.userId);
  if (!student) throw Object.assign(new Error('MissionAccounts record not found'), { status: 404 });
  return student;
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json(response, 200, { status: 'ok', app: 'missionaccounts', mode: store instanceof PreviewStore ? 'preview' : 'configured', route_enabled: false, auto_billing_enabled: false, zoom_sync_enabled: false });
  }
  const identity = await identityFor(request);
  if (request.method === 'GET' && url.pathname === '/api/session') {
    return json(response, 200, { authenticated: true, mode: identity.roles.includes('student') ? 'student' : 'admin', capabilities: { exam_plans: false, comp_days: false, auto_billing: false, zoom_sync: false } });
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

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
    else await serveStatic(response, url.pathname);
  } catch (error) {
    const status = Number(error.status) || 500;
    json(response, status, { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_DENIED', message: production && status === 500 ? 'MissionAccounts request failed' : error.message });
  }
});

const port = Number(process.env.PORT || 4179);
server.listen(port, '127.0.0.1', () => console.log(`MissionAccounts local server listening on http://127.0.0.1:${port}`));

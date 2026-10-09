const EXACT_PATHS = new Set([
  '/health',
  '/api/health',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/integrations/gmail/sync-preview',
  '/api/usce/health',
  '/api/usce/student/status',
]);

const PATH_PREFIXES = [
  '/api/usce/admin/',
  '/api/usce/public/',
  '/api/usce/offer/',
];

export function isUsceGatewayPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return false;
  if (EXACT_PATHS.has(pathname)) return true;
  return PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}


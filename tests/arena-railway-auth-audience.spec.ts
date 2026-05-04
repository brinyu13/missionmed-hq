import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const hqServer = readFileSync(resolve(root, 'missionmed-hq/server.mjs'), 'utf8');

function functionBodyFrom(source: string, name: string): string {
  const marker = `function ${name}`;
  let start = source.indexOf(marker);
  if (start === -1) {
    start = source.indexOf(`async ${marker}`);
  }
  assert.notEqual(start, -1, `Expected ${name} to exist`);

  const signatureEnd = source.indexOf(')', start);
  const open = signatureEnd === -1 ? source.indexOf('{', start) : source.indexOf('{', signatureEnd);
  assert.notEqual(open, -1, `Expected ${name} to have a function body`);

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Could not parse ${name} body`);
}

test('Railway handoff preserves Arena audience and learner sessions cannot enter HQ APIs', () => {
  const buildSessionUrl = functionBodyFrom(hqServer, 'buildHqAuthSessionUrl');
  const loginHints = functionBodyFrom(hqServer, 'getLoginHints');
  const sessionHandler = hqServer.slice(
    hqServer.indexOf("if (pathname === '/api/auth/session')"),
    hqServer.indexOf("if (pathname === '/api/auth/validate-wp')"),
  );
  const exchange = functionBodyFrom(hqServer, 'exchangeWordPressAuth');
  const parseHandoff = functionBodyFrom(hqServer, 'parseWordPressHandoffToken');
  const requireSession = functionBodyFrom(hqServer, 'requireAuthenticatedApiSession');
  const privilegedUser = functionBodyFrom(hqServer, 'isPrivilegedWordPressUser');
  const sessionCookie = functionBodyFrom(hqServer, 'buildSessionCookie');

  assert.match(hqServer, /AUTH_LEARNER_AUDIENCES\s*=\s*new Set\(\['arena', 'stat', 'daily', 'drills'\]\)/);
  assert.match(buildSessionUrl, /hqEntry\.searchParams\.set\('audience', normalizedAudience\)/);
  assert.match(loginHints, /audience:\s*normalizeAuthAudience\(audience\)/);
  assert.match(loginHints, /wordpress_handoff_url:\s*buildWordPressAuthRedirectUrl\(hqEntryUrl\)/);
  assert.match(sessionHandler, /authAudience\s*=\s*normalizeAuthAudience\(searchParams\.get\('audience'\)/);
  assert.match(sessionHandler, /exchangeWordPressAuth\(\{\s*token:\s*handoffToken,\s*audience:\s*authAudience\s*\}/);
  assert.match(sessionHandler, /withAuthSessionHandoffFragment\(finalRedirect,\s*handoffToken\)/);
  assert.match(exchange, /isAuthorizedForAuthAudience\(wpUser,\s*authAudience\)/);
  assert.match(exchange, /authAudience,/);
  assert.doesNotMatch(parseHandoff, /isAuthorizedWordPressUser/);
  assert.match(requireSession, /isPrivilegedWordPressUser\(normalizeWordPressIdentityUser\(session\.user \|\| \{\}\)\)/);
  assert.match(requireSession, /hq_role_required/);
  assert.match(privilegedUser, /administrator/);
  assert.match(privilegedUser, /manage_options/);
  assert.match(sessionCookie, /sameSitePolicy\s*=\s*secureCookie\s*\?\s*'None'\s*:\s*'Lax'/);
});

test('USCE protected routes reject learner auth sessions before admin RPC access', () => {
  const requireUsceSession = functionBodyFrom(hqServer, 'requireUsceUserSession');
  const handleUsceRoute = functionBodyFrom(hqServer, 'handleUsceRoute');

  assert.match(requireUsceSession, /authentication_required/);
  assert.match(requireUsceSession, /isPrivilegedWordPressUser\(normalizeWordPressIdentityUser\(session\.user \|\| \{\}\)\)/);
  assert.match(requireUsceSession, /hq_role_required/);

  assert.ok(
    handleUsceRoute.indexOf('requireUsceUserSession') < handleUsceRoute.indexOf('getUscePublicIntakeAdminList'),
    'Expected USCE admin intake list to run only after the protected USCE session gate',
  );
});

test('Supabase bootstrap syncs the auth user before sign-in and avoids rate-limit loops', () => {
  const bootstrap = functionBodyFrom(hqServer, 'bootstrapSupabaseSessionFromWordPressSession');
  const lookup = functionBodyFrom(hqServer, 'findSupabaseAuthUserByEmail');

  assert.match(lookup, /admin\/users\?email=\$\{encodeURIComponent\(normalizedEmail\)\}/);
  assert.match(lookup, /const maxPages = 50/);
  assert.match(bootstrap, /preflightEnsureUser\s*=\s*await ensureSupabaseAuthUser\(email,\s*password,\s*authSession\)/);
  assert.match(bootstrap, /let signInResult = await signInSupabaseAuthUser\(email,\s*password\)/);
  assert.ok(
    bootstrap.indexOf('preflightEnsureUser') < bootstrap.indexOf('let signInResult = await signInSupabaseAuthUser'),
    'Expected Supabase user sync to run before first password sign-in',
  );
  assert.match(bootstrap, /!isSupabaseRateLimitError\(signInResult\.detail \|\| signInResult\.error \|\| ''\)/);
  assert.match(bootstrap, /status:\s*isSupabaseRateLimitError\(composedMessage\)\s*\?\s*429\s*:\s*502/);
});

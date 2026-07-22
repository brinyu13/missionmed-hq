import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveMmcAuthenticatedRole } from '../../../lib/mmc/trust/session-principal.mjs';

assert.equal(resolveMmcAuthenticatedRole({
  roles: ['administrator'], capabilities: {},
}), 'admin');
assert.equal(resolveMmcAuthenticatedRole({
  roles: ['subscriber'], capabilities: { manage_options: true },
}), 'admin');
assert.equal(resolveMmcAuthenticatedRole({
  roles: ['hq_admin'], capabilities: {},
}), 'admin');

for (const role of ['hq_operator', 'operator']) {
  assert.equal(resolveMmcAuthenticatedRole({ roles: [role], capabilities: {} }), 'operator',
    `${role} must remain an operator rather than being promoted to admin.`);
}

assert.equal(resolveMmcAuthenticatedRole({ roles: ['mentor'], capabilities: {} }), 'mentor');
assert.equal(resolveMmcAuthenticatedRole({ roles: ['configured_private_role'], capabilities: {} }), 'mentor',
  'An allowlisted private-route role must not implicitly become an MMC administrator.');
assert.equal(resolveMmcAuthenticatedRole({ roles: ['OPERATOR'], capabilities: {} }), 'operator',
  'Role matching must be normalized without changing privilege.');
assert.equal(resolveMmcAuthenticatedRole({
  roles: [{ toString: () => 'administrator' }], capabilities: {},
}), 'mentor', 'Non-string role values must never gain authority through coercion.');

const serverSource = readFileSync(path.join(process.cwd(), 'missionmed-hq/server.mjs'), 'utf8');
const resolverStart = serverSource.indexOf('function resolveMmcRoleForSession');
const resolverEnd = serverSource.indexOf('function buildMmcPrincipal', resolverStart);
assert.ok(resolverStart > -1 && resolverEnd > resolverStart, 'Server MMC role resolver was not found.');
const resolverSource = serverSource.slice(resolverStart, resolverEnd);
assert.match(resolverSource, /resolveMmcAuthenticatedRole\(user\)/u,
  'The shared server must derive the v2 role through the least-privilege authenticated-user resolver.');
assert.doesNotMatch(resolverSource, /hq_operator[^\n]+admin|operator[^\n]+admin/u,
  'The server resolver must not promote operator roles to admin.');

console.log(JSON.stringify({
  result: 'MMC shared-server principal role validation passed',
  administratorRemainsAdmin: true,
  operatorIsNotAdmin: true,
  unknownAllowedRoleDefaultsToMentor: true,
  serverUsesLeastPrivilegeResolver: true,
}, null, 2));

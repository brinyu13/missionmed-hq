import { READ_ROLES, ROLES, WRITE_ROLES } from './contracts.mjs';

export class AuthorizationError extends Error {
  constructor(code, statusCode = 403) {
    super(code);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function normalizeActor(actor) {
  if (!actor || typeof actor !== 'object') {
    throw new AuthorizationError('authentication_required', 401);
  }
  const id = String(actor.id || '').trim();
  const roles = [...new Set((Array.isArray(actor.roles) ? actor.roles : [])
    .map((role) => String(role || '').trim())
    .filter((role) => ROLES.includes(role)))];
  if (!id || !roles.length) {
    throw new AuthorizationError('authentication_required', 401);
  }
  return Object.freeze({ id, roles });
}

export function requireAnyRole(actorInput, permittedRoles) {
  const actor = normalizeActor(actorInput);
  const permitted = new Set(permittedRoles);
  if (!actor.roles.some((role) => permitted.has(role))) {
    throw new AuthorizationError('role_not_permitted');
  }
  return actor;
}

export function requireRead(actorInput) {
  return requireAnyRole(actorInput, READ_ROLES);
}

export function requireWrite(actorInput) {
  return requireAnyRole(actorInput, WRITE_ROLES);
}

export function requireRole(actorInput, role) {
  return requireAnyRole(actorInput, [role, 'platform_admin']);
}

export function localDemoActor(request, enabled) {
  const remote = request.socket?.remoteAddress || '';
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (!enabled || !loopback) {
    throw new AuthorizationError('production_identity_adapter_required', 401);
  }
  return Object.freeze({
    id: 'reviewer_local_demo',
    roles: ['platform_admin', 'editorial_reviewer', 'read_only'],
  });
}

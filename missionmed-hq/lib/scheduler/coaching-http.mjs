import { createCoachingService } from './coaching.mjs';
import { getSchedulerActor, assertSchedulerMutationIdentity } from './auth.mjs';
import { createSchedulerRepository } from './persistence.mjs';

const PREFIX = '/api/scheduler/coaching/';
const PATHS = new Set(['service', 'packages', 'appointments', 'availability-approval']);
const deny = (code, status = 403) => { const e = new Error(code); e.code = code; e.status = status; throw e; };

/** Dedicated bounded reader preserves exact HMAC bytes. Never logs payloads. */
async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] || ''))) deny('coaching_json_required', 415);
  const parts = []; let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 32768) deny('coaching_payload_too_large', 413);
    parts.push(buffer);
  }
  return Buffer.concat(parts).toString('utf8');
}

/** Native route seam only. Does not install a parallel scheduler or mailer. */
export async function handleCoachingHttp(request, response, url, context = {}) {
  if (!url.pathname.startsWith(PREFIX)) return false;
  const headers = { ...(context.authHeaders || {}), 'Cache-Control': 'no-store' };
  const send = (status, body) => context.sendJson(response, status, body, headers);
  const action = url.pathname.slice(PREFIX.length);
  if (!PATHS.has(action)) { send(404, { error: 'coaching_route_not_found' }); return true; }
  const env = context.env || process.env;
  try {
    if (env.MMED_COACHING_ENABLED !== '1') deny('coaching_disabled', 503);
    const repository = context.repository || createSchedulerRepository();
    if (!repository.status().service_role_configured) deny('coaching_private_persistence_required', 503);
    const actorResolver = async session => {
      const result = getSchedulerActor(session, 'student');
      if (!result.ok) deny('coaching_authentication_required', result.status);
      if (!assertSchedulerMutationIdentity(result.actor, repository.status()).ok) deny('coaching_confirmed_identity_required');
      if (!Number.isSafeInteger(result.actor.wpUserId)) deny('coaching_exact_identity_required');
      return result.actor;
    };
    const service = createCoachingService({
      rpcClient: repository.rpc.bind(repository), enabled: true, secret: env.MMED_COACHING_WOO_SECRET,
      resolveNativeActor: actorResolver,
      verifyFounderActor: async session => {
        const actor = await actorResolver(session);
        const founderId = Number(env.MMED_COACHING_FOUNDER_WP_ID);
        return { userId: actor.userId, isFounder: actor.isAdmin && Number.isSafeInteger(founderId)
          && founderId > 0 && actor.wpUserId === founderId };
      },
    });
    if (action === 'service') {
      if (request.method !== 'POST') deny('coaching_method_not_allowed', 405);
      const result = await service.canonicalWooEnvelope({ rawBody: await readBody(request),
        timestamp: request.headers['x-mmed-coaching-timestamp'], nonce: request.headers['x-mmed-coaching-nonce'],
        signature: request.headers['x-mmed-coaching-signature'] });
      send(200, result); return true;
    }
    // Session comes only from the existing server-owned authenticated exchange.
    await actorResolver(context.session);
    if (action === 'packages') {
      if (request.method !== 'GET') deny('coaching_method_not_allowed', 405);
      send(200, { ok: true, data: await service.readModel(context.session) }); return true;
    }
    if (request.method !== 'POST') deny('coaching_method_not_allowed', 405);
    if (typeof context.validateCsrf !== 'function' || !context.validateCsrf(request, context.session)) deny('coaching_csrf_required');
    let payload;
    try { payload = JSON.parse(await readBody(request)); } catch (e) { if (e.status) throw e; deny('coaching_invalid_json', 400); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) deny('coaching_invalid_payload', 400);
    const result = action === 'appointments' ? await service.mutateAppointment(context.session, payload)
      : await service.approveAvailability(context.session, payload);
    send(200, { ok: true, data: result });
  } catch (error) {
    // Never serialize SQL details, financial evidence or customer payloads.
    const code = /^coaching_[a-z_]+$/.test(error?.code || '') ? error.code : 'coaching_request_requires_review';
    const status = [400,401,403,404,405,413,415,503].includes(error?.status) ? error.status : 409;
    send(status, { error: code });
  }
  return true;
}

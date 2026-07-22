import {
  MMC_JSON_SECURITY_HEADERS,
  assertMmcCsrf,
} from '../lib/mmc/trust/security.mjs';
import { handleMmcV2Route, isMmcV2Path } from './mmc/index.mjs';

const PIPELINE_PREFIX = '/api/mmc/coaching-pipeline';

export function isMmcCoachingPipelinePath(pathname = '') {
  const normalized = String(pathname || '').replace(/\/+$/u, '') || '/';
  return isMmcV2Path(normalized)
    || normalized === PIPELINE_PREFIX
    || normalized.startsWith(`${PIPELINE_PREFIX}/`);
}

export async function handleMmcCoachingPipelineRoute(request, response, url, deps = {}) {
  if (isMmcV2Path(url.pathname)) {
    await handleMmcV2Route(request, response, url, deps);
    return;
  }

  const pathname = url.pathname.replace(/\/+$/u, '') || PIPELINE_PREFIX;
  const route = pathname.slice(PIPELINE_PREFIX.length) || '/';
  const method = String(request.method || 'GET').toUpperCase();
  const headers = { ...(deps.authHeaders || {}), ...MMC_JSON_SECURITY_HEADERS };

  if (!deps.isAuthorizedMmcPrivateSession?.(deps.session)) {
    deps.sendJson(response, 403, {
      ok: false,
      error: 'mmc_private_forbidden',
      message: 'MMC coaching pipeline requires the private MMC route-specific authorization model.',
    }, headers);
    return;
  }

  // Every legacy mutation still passes the CSRF boundary before receiving the
  // permanent seal response. No provider, filesystem, worker, or persistence
  // adapter is imported into this compatibility module.
  try {
    assertMmcCsrf(request, deps.session);
  } catch (error) {
    deps.sendJson(response, error.statusCode || 403, {
      ok: false,
      status: 'SEALED',
      error: error.code || 'CSRF_VALIDATION_FAILED',
      message: error.publicMessage || 'The legacy MMC mutation request was denied.',
    }, headers);
    return;
  }

  if ((route === '/' || route === '/status') && method === 'GET') {
    deps.sendJson(response, 200, buildLegacySealStatus(), headers);
    return;
  }

  deps.sendJson(response, 410, {
    ok: false,
    status: 'SEALED',
    error: 'mmc_legacy_pipeline_sealed',
    message: 'The legacy MMC coaching pipeline is sealed; use the gated CAM v2 API contract.',
    replacement: MMC_V2_PREFIX_FOR_STATUS,
  }, headers);
}

const MMC_V2_PREFIX_FOR_STATUS = '/api/mmc/v2';

function buildLegacySealStatus() {
  return {
    ok: false,
    status: 'SEALED',
    mode: 'legacy-coaching-pipeline',
    authority: 'CAM_V2',
    mutationEnabled: false,
    providerAccessEnabled: false,
    filesystemAccessEnabled: false,
    replacement: MMC_V2_PREFIX_FOR_STATUS,
  };
}

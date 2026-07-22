import crypto from 'node:crypto';

import { MmcCommandKernel } from '../../lib/mmc/commands/command-kernel.mjs';
import { ENVIRONMENT, FRESHNESS, SECTION_STATE, buildQueryEnvelope } from '../../lib/mmc/contracts/state-contract.mjs';
import { canonicalUuid } from '../../lib/mmc/contracts/uuid-contract.mjs';
import {
  MMC_JSON_SECURITY_HEADERS,
  MmcHttpError,
  assertExactRequestOrigin,
  assertMmcCsrf,
  deriveMmcPrincipal,
  readBoundedJsonBody,
  safeMmcErrorPayload,
} from '../../lib/mmc/trust/security.mjs';
import { handleMmcMentorRoute, isMmcMentorPath } from './mentor.mjs';

export const MMC_V2_PREFIX = '/api/mmc/v2';
const LOCAL_KERNEL_ENVIRONMENTS = new Set(['FIXTURE', 'LOCAL']);
const defaultCommandKernel = new MmcCommandKernel();

export function isMmcV2Path(pathname = '') {
  const normalized = String(pathname || '').replace(/\/+$/u, '') || '/';
  return normalized === MMC_V2_PREFIX || normalized.startsWith(`${MMC_V2_PREFIX}/`);
}

export async function handleMmcV2Route(request, response, url, deps = {}) {
  if (isMmcMentorPath(url?.pathname)) {
    await handleMmcMentorRoute(request, response, url, deps);
    return;
  }
  const correlationId = `corr_${crypto.randomUUID()}`;
  const headers = { ...(deps.authHeaders || {}), ...MMC_JSON_SECURITY_HEADERS };
  const send = (status, payload) => deps.sendJson(response, status, payload, headers);

  try {
    if (!deps.isAuthorizedMmcPrivateSession?.(deps.session)) {
      throw new MmcHttpError(403, 'MMC_PRIVATE_FORBIDDEN', 'MMC v2 requires the private route authorization model.');
    }

    if (!deps.v2Config && !flag(process.env.MMHQ_MMC_V2_GATEWAY_ENABLED)) {
      throw new MmcHttpError(503, 'MMC_V2_GATEWAY_DISABLED', 'The MMC v2 gateway is disabled by default.');
    }
    const config = resolveV2Config(deps.v2Config);
    if (!config.gatewayEnabled) {
      throw new MmcHttpError(503, 'MMC_V2_GATEWAY_DISABLED', 'The MMC v2 gateway is disabled by default.');
    }

    const sourcePrincipal = typeof deps.buildMmcPrincipal === 'function'
      ? deps.buildMmcPrincipal(deps.session)
      : deps.session?.mmcPrincipal;
    const derivedPrincipal = deriveMmcPrincipal({
      sourcePrincipal,
      tenantId: config.tenantId,
      environment: config.environment,
      capabilities: deps.v2Capabilities || [],
    });
    const principalId = canonicalUuid(derivedPrincipal.id);
    if (!principalId) {
      throw new MmcHttpError(401, 'MMC_V2_PRINCIPAL_UUID_REQUIRED',
        'The durable MMC v2 principal binding must use a canonical UUID.');
    }
    const principal = principalId === derivedPrincipal.id
      ? derivedPrincipal
      : Object.freeze({ ...derivedPrincipal, id: principalId });
    const pathname = url.pathname.replace(/\/+$/u, '') || MMC_V2_PREFIX;
    const route = pathname.slice(MMC_V2_PREFIX.length) || '/';
    const method = String(request.method || 'GET').toUpperCase();
    const cutover = describeCutover(deps.cutoverAuthority, config);

    if ((route === '/' || route === '/status') && method === 'GET') {
      send(200, buildStatus(config, principal, cutover, correlationId));
      return;
    }

    if (route === '/commands' && method === 'POST') {
      if (!config.commandEnabled) {
        throw new MmcHttpError(503, 'MMC_V2_COMMANDS_DISABLED', 'The MMC v2 command plane is disabled.');
      }
      if (!config.inMemoryKernelEnabled || !LOCAL_KERNEL_ENVIRONMENTS.has(config.environment)) {
        throw new MmcHttpError(503, 'MMC_V2_DURABLE_PERSISTENCE_REQUIRED',
          'The local in-memory kernel cannot serve this environment; durable v2 persistence is required.');
      }
      if (principal.role !== 'admin') {
        throw new MmcHttpError(403, 'MMC_V2_ASSIGNMENT_AUTHZ_UNAVAILABLE',
          'Mentor commands remain disabled until the current assignment authorization adapter is active.');
      }
      assertMmcCsrf(request, deps.session);
      assertExactRequestOrigin(request, config.approvedOrigins);
      const payload = await readBoundedJsonBody(request, { maxBytes: config.maxJsonBytes });
      const commandId = canonicalUuid(payload?.commandId);
      const targetId = canonicalUuid(payload?.targetId);
      if (!commandId) {
        throw new MmcHttpError(422, 'MMC_V2_COMMAND_UUID_REQUIRED',
          'Durable MMC v2 commands must use canonical UUID identifiers.');
      }
      if (!targetId) {
        throw new MmcHttpError(422, 'MMC_V2_TARGET_UUID_REQUIRED',
          'Durable MMC v2 command targets must use canonical UUID identifiers.');
      }
      const canonicalPayload = commandId === payload.commandId && targetId === payload.targetId
        ? payload
        : { ...payload, commandId, targetId };
      const kernel = deps.commandKernel || defaultCommandKernel;
      if (typeof deps.cutoverAuthority?.runV2Command !== 'function') {
        throw new MmcHttpError(503, 'MMC_V2_CUTOVER_AUTHORITY_REQUIRED',
          'A durable single-writer cutover authority is required for v2 commands.');
      }
      const result = await deps.cutoverAuthority.runV2Command({
        tenantId: config.tenantId,
        environment: config.environment,
        commandId: canonicalPayload?.commandId,
      }, { principal }, () => kernel.execute(canonicalPayload, { principal, correlationId }));
      send(200, result);
      return;
    }

    throw new MmcHttpError(404, 'MMC_V2_ROUTE_NOT_FOUND', 'The MMC v2 route was not found.');
  } catch (error) {
    const safe = safeMmcErrorPayload(error, { correlationId });
    send(safe.statusCode, safe.payload);
  }
}

function buildStatus(config, principal, cutover, correlationId) {
  const commandsAuthoritative = config.commandEnabled
    && cutover.state === 'V2_WRITER'
    && cutover.featureGates.commands === true;
  return buildQueryEnvelope({
    data: {
      apiVersion: 'v2',
      authority: 'CAM_V2',
      persistence: config.inMemoryKernelEnabled ? 'LOCAL_IN_MEMORY_FOUNDATION' : 'DURABLE_ADAPTER_REQUIRED',
      principalRole: principal.role,
      writerState: cutover.state,
      featurePlanes: {
        reads: false,
        commands: commandsAuthoritative,
        ingest: false,
        aiProposal: false,
        operationalPromotion: false,
        studentPublication: false,
      },
    },
    meta: {
      environment: ENVIRONMENT[config.environment],
      asOf: new Date().toISOString(),
      freshness: FRESHNESS.CURRENT,
      sections: {
        trust_kernel: SECTION_STATE.AVAILABLE,
        read_api: SECTION_STATE.UNAVAILABLE,
        cutover_authority: cutover.state === 'UNAVAILABLE' ? SECTION_STATE.UNAVAILABLE : SECTION_STATE.AVAILABLE,
        durable_persistence: config.inMemoryKernelEnabled ? SECTION_STATE.PARTIAL : SECTION_STATE.UNAVAILABLE,
        provider_integrations: SECTION_STATE.UNAVAILABLE,
      },
      correlationId,
    },
  });
}

function describeCutover(authority, config) {
  if (typeof authority?.snapshot !== 'function' || typeof authority?.assertScope !== 'function') {
    return Object.freeze({ state: 'UNAVAILABLE', featureGates: Object.freeze({ commands: false }) });
  }
  try {
    authority.assertScope(config.tenantId, config.environment);
    const snapshot = authority.snapshot();
    return Object.freeze({
      state: String(snapshot.state || 'UNAVAILABLE'),
      featureGates: Object.freeze({ ...(snapshot.featureGates || {}) }),
    });
  } catch {
    return Object.freeze({ state: 'SCOPE_MISMATCH', featureGates: Object.freeze({ commands: false }) });
  }
}

function resolveV2Config(injected = null) {
  const source = injected || {
    gatewayEnabled: flag(process.env.MMHQ_MMC_V2_GATEWAY_ENABLED),
    commandEnabled: flag(process.env.MMHQ_MMC_V2_COMMANDS_ENABLED),
    inMemoryKernelEnabled: flag(process.env.MMHQ_MMC_V2_LOCAL_IN_MEMORY_KERNEL_ENABLED),
    tenantId: process.env.MMHQ_MMC_V2_TENANT_ID,
    environment: process.env.MMHQ_MMC_V2_ENVIRONMENT,
    approvedOrigins: splitCsv(process.env.MMHQ_MMC_V2_APPROVED_ORIGINS),
    maxJsonBytes: Number(process.env.MMHQ_MMC_V2_MAX_JSON_BYTES || 64 * 1024),
  };
  const environment = String(source.environment || '').trim().toUpperCase();
  if (!['FIXTURE', 'LOCAL', 'STAGING', 'LIVE'].includes(environment)) {
    throw new MmcHttpError(503, 'MMC_V2_ENVIRONMENT_UNAVAILABLE', 'The MMC v2 environment binding is unavailable.');
  }
  const tenantId = canonicalUuid(source.tenantId);
  if (!tenantId) {
    throw new MmcHttpError(503, 'MMC_V2_TENANT_UNAVAILABLE', 'The MMC v2 tenant binding is unavailable.');
  }
  const maxJsonBytes = Number(source.maxJsonBytes);
  return Object.freeze({
    gatewayEnabled: source.gatewayEnabled === true,
    commandEnabled: source.commandEnabled === true,
    inMemoryKernelEnabled: source.inMemoryKernelEnabled === true,
    tenantId,
    environment,
    approvedOrigins: Object.freeze(Array.isArray(source.approvedOrigins) ? [...source.approvedOrigins] : []),
    maxJsonBytes: Number.isSafeInteger(maxJsonBytes) ? Math.max(1024, Math.min(256 * 1024, maxJsonBytes)) : 64 * 1024,
  });
}

function flag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function splitCsv(value) {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

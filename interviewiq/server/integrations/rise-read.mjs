import { createHash } from 'node:crypto';
import { AppError } from '../errors.mjs';

// Existing RISE generic read routes only. This is not the IVOC projection and
// does not create an IIQ delegation, export a cookie, reserve a job or publish.
const OWNER_ORIGIN = 'https://missionmed-rise-production.up.railway.app';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/;
const COOKIE = /^mmhq_session=[A-Za-z0-9%._~+/=-]{16,8192}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const FIELDS = new Map([
  ['research.curriculum', 'Curriculum'], ['research.culture', 'Culture'],
  ['research.fellowship_inventory', 'Fellowships'], ['research.outcomes', 'Outcomes'],
  ['research.structure', 'Training structure'], ['research.interview_format', 'Interview format'],
  ['research.program_differentiators', 'Program differentiators'],
]);
const PUBLISHED = new Set(['STUDENT_VISIBLE', 'PRIVATE_BETA']);
const error = (code, status = 503) => new AppError(status, code,
  'Current RISE information is unavailable. Your saved interview remains safe.');
const text = (value, maximum) => typeof value === 'string' && value.length <= maximum
  && !/[\u0000-\u001f\u007f]/u.test(value) ? value.trim() : '';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const date = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
  ? new Date(value).toISOString() : null;

function identity(value, expectedId) {
  if (!value || !ID.test(value.programSpecialtyId || '') || !ID.test(value.id || '')
      || (expectedId && value.programSpecialtyId !== expectedId)
      || !text(value.display?.programName, 240)) throw error('rise_response_invalid', 502);
  const acgme = Array.isArray(value.identifiers)
    ? value.identifiers.find(item => item?.namespace === 'ACGME_PROGRAM')?.value : null;
  return Object.freeze({
    id: value.programSpecialtyId, registryProgramId: value.id,
    name: text(value.display.programName, 240), specialty: text(value.designation, 160),
    institution: text(value.display.institution, 240), city: text(value.display.city, 120),
    state: text(value.display.state, 80), programType: text(value.programType, 160),
    // The inspected generic owner record has no authoritative track/timezone.
    track: '', zone: null, acgmeId: /^\d{10}$/.test(String(acgme || '')) ? String(acgme) : null,
    fact_ids: Object.freeze([]),
  });
}
function release(value) {
  if (!ID.test(value || '') || !value.startsWith('rise_registry_')) throw error('rise_response_invalid', 502);
  return value;
}
function sourceUrl(value) {
  if (!text(value, 2048)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port
        || !url.hostname.includes('.') || /(^localhost$|\.(?:local|internal|invalid)$)/i.test(url.hostname)
        || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')
        || [...url.searchParams.keys()].some(key => /^(?:token|key|api_key|secret|password|authorization|session)$/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}
function summary(value) {
  const items = Array.isArray(value) ? value : [value];
  if (items.length > 30) return null;
  const parts = items.map(item => typeof item === 'string' ? item : item?.summary)
    .map(item => text(item, 600)).filter(Boolean).slice(0, 2);
  const result = parts.join(' ');
  // Do not project named people from a generic object or invent a flattening of
  // provider-specific records. Empty/unsupported structures remain unknown.
  return result && result.length <= 1200 && !/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3},?\s+(?:MD|DO|PhD|MBBS)\b/u.test(result)
    ? result : null;
}
export function minimizeRiseProfile(raw, expectedId) {
  const registryReleaseId = release(raw?.registryReleaseId);
  const program = identity(raw?.program, expectedId);
  const current = raw?.research?.currentFacts;
  if (!Array.isArray(current) || current.length > 1000) throw error('rise_response_invalid', 502);
  const facts = [];
  const unknowns = [];
  const pending = raw?.research?.pendingEvidence?.fields;
  if (pending != null && (!Array.isArray(pending) || pending.length > 1000)) throw error('rise_response_invalid', 502);
  for (const [field, label] of FIELDS) {
    const values = current.filter(fact => fact?.field === field && PUBLISHED.has(fact.publicationState)
      && (fact.knowledge?.state == null || fact.knowledge.state === 'known'));
    const supported = values.map(fact => {
      const content = summary(fact.canonicalValue ?? fact.knowledge?.value);
      const retrievedAt = date(fact.retrievedAt);
      const inputUrls = Array.isArray(fact.sourceUrls) ? fact.sourceUrls : [fact.sourceUrl];
      const urls = [...new Set(inputUrls.slice(0, 12).map(sourceUrl).filter(Boolean))];
      if (!content || !retrievedAt || !urls.length) return null;
      return { field, label, summary: content, sources: urls.map(url => ({ url, retrievedAt })) };
    }).filter(Boolean);
    if (!supported.length) {
      unknowns.push({ field, label, state: 'unknown', reason: (pending || []).some(item => item?.field === field)
        ? 'owner_review_pending' : 'no_supported_current_summary' });
      continue;
    }
    const distinct = new Map(supported.map(fact => [fact.summary, fact]));
    if (distinct.size > 1) {
      unknowns.push({ field, label, state: 'conflict', reason: 'multiple_owner_current_summaries' });
      continue;
    }
    const value = [...distinct.values()][0];
    facts.push(Object.freeze({ id: `rise:${digest([registryReleaseId, program.id, value]).slice(0, 32)}`,
      ...value, status: 'supported', textKind: 'owner_canonical_summary_not_verbatim_quote' }));
  }
  return Object.freeze({ program, registryReleaseId, facts: Object.freeze(facts), unknowns: Object.freeze(unknowns),
    owner: 'rise', sourceVersion: `rise-read:${digest([registryReleaseId, program.id, facts, unknowns])}` });
}

async function boundedJson(response, maximum) {
  if (!response.ok) throw error(response.status === 401 || response.status === 403 ? 'rise_access_denied' : 'rise_owner_unavailable',
    response.status === 401 || response.status === 403 ? 403 : 503);
  if (response.redirected || String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json'
      || Number(response.headers.get('content-length') || 0) > maximum) throw error('rise_response_invalid', 502);
  const reader = response.body?.getReader();
  if (!reader) throw error('rise_response_invalid', 502);
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maximum) throw error('rise_response_invalid', 502);
      chunks.push(Buffer.from(next.value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw error('rise_response_invalid', 502); }
}

/**
 * resolveOwnerSession is a trusted server dependency, never browser input. It
 * must independently derive a current HQ RISE owner cookie for this WP subject.
 * IIQ currently has no such resolver: default off, no credential minting here.
 */
export function createRiseReadAdapter({ enabled = false, origin = OWNER_ORIGIN,
  resolveOwnerSession = null, fetchImpl = fetch, now = Date.now, timeoutMs = 4000 } = {}) {
  if (origin !== OWNER_ORIGIN || typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs)
      || timeoutMs < 250 || timeoutMs > 10000) throw error('rise_adapter_configuration_invalid');
  const available = enabled === true && typeof resolveOwnerSession === 'function';
  async function get(actor, pathname, query = {}) {
    if (!available) throw error('rise_owner_transport_pending');
    if (!UUID.test(actor?.id || '') || !Number.isSafeInteger(actor?.wpUserId) || actor.wpUserId < 1
        || actor.eligible !== true || !['student', 'admin'].includes(actor.role)) throw error('rise_access_denied', 403);
    let session;
    try { session = await resolveOwnerSession(actor); }
    catch { throw error('rise_owner_transport_pending'); }
    const current = now();
    if (session?.authenticated !== true || session.subject !== `wp:${actor.wpUserId}` || session.audience !== 'rise'
        || !COOKIE.test(session.cookie || '') || !Number.isSafeInteger(session.validatedAt)
        || session.validatedAt < current - 5000 || session.validatedAt > current + 2000
        || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= current) throw error('rise_access_denied', 403);
    const url = new URL(pathname, origin);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    try {
      return await boundedJson(await fetchImpl(url, { method: 'GET', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json', Cookie: session.cookie }, signal: AbortSignal.timeout(timeoutMs) }), 524288);
    } catch (failure) {
      if (failure instanceof AppError) throw failure;
      throw error('rise_owner_unavailable');
    }
  }
  async function profile(actor, programId) {
    if (!ID.test(programId || '')) throw error('rise_program_invalid', 400);
    return get(actor, `/api/rise/v1/program-specialties/${encodeURIComponent(programId)}`);
  }
  return Object.freeze({
    available,
    async searchPrograms(actor, q = '', { page = 1 } = {}) {
      if (typeof q !== 'string' || q.length > 256 || /[\u0000-\u001f\u007f]/u.test(q)
          || !Number.isSafeInteger(page) || page < 1 || page > 10000) throw error('rise_search_invalid', 400);
      const raw = await get(actor, '/api/rise/v1/programs', { q: q.trim(), page, pageSize: 12 });
      const registryReleaseId = release(raw?.registryReleaseId);
      if (!Array.isArray(raw.records) || raw.records.length > 12 || raw.page !== page || raw.pageSize !== 12
          || !Number.isSafeInteger(raw.total) || raw.total < 0 || raw.total > 120000) throw error('rise_response_invalid', 502);
      const programs = raw.records.map(record => identity(record));
      if (new Set(programs.map(program => program.id)).size !== programs.length) throw error('rise_response_invalid', 502);
      return Object.freeze({ programs: Object.freeze(programs), registryReleaseId, page, total: raw.total, totalPages: Math.max(1, Math.ceil(raw.total / 12)) });
    },
    async getProgram(actor, programId) {
      const raw = await profile(actor, programId); release(raw?.registryReleaseId);
      return identity(raw?.program, programId);
    },
    async getProgramEvidence(actor, programId) { return minimizeRiseProfile(await profile(actor, programId), programId); },
    async readResearchState(actor, programId) {
      if (!ID.test(programId || '')) throw error('rise_program_invalid', 400);
      const raw = await get(actor, `/api/rise/v1/program-specialties/${encodeURIComponent(programId)}/research`);
      if (!raw || typeof raw.eligibility !== 'object' || !Array.isArray(raw.records) || raw.records.length > 100) throw error('rise_response_invalid', 502);
      // Preserve owner decisions without leaking quotas, provider config, source
      // payloads or a different subject's records. No POST/spend method exists.
      return Object.freeze({ owner: 'rise', available: true, jobs: Object.freeze(raw.records
        .filter(row => row?.programSpecialtyId === programId)
        .map(row => ({ id: text(row.id, 180), status: text(row.status, 80), updatedAt: date(row.updatedAt) }))
        .filter(row => row.id && row.status)) });
    },
  });
}

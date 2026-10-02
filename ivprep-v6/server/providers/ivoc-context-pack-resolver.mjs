import { buildLiveInterviewInstructions, normalizeLiveInterviewContext } from './openai-live-session.mjs';
import { validateSourceBoundPriorIvocPack } from '../../../missionmed-hq/ivoc/application-intelligence.mjs';
import { hashValue } from '../../../ivoc/intelligence/index.mjs';

const MAX_ACTOR_BLOCK_BYTES = 6 * 1024;
const MAX_ACTOR_INSTRUCTIONS_BYTES = 64 * 1024;

function exactSubject(value) {
  const subject = String(value || '').trim();
  return /^wp:[1-9][0-9]{0,19}$/u.test(subject) ? subject : null;
}

function exactUuid(value) {
  const id = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id) ? id : null;
}

function exactPackVersion(value) {
  const version = String(value || '').trim();
  return /^[0-9a-f]{64}$/u.test(version) ? version : null;
}

function boundedActorBlock(value) {
  const block = String(value || '');
  return block.startsWith('AUTHORIZED APPLICATION CONTEXT\n')
    && Buffer.byteLength(block, 'utf8') <= MAX_ACTOR_BLOCK_BYTES
    ? block
    : null;
}

export function createIvocContextPackResolver({ rest } = {}) {
  if (!rest || typeof rest.table !== 'function') {
    throw new TypeError('IVOC context-pack storage is required.');
  }
  return async function resolveIvocContextPack({ subject, sessionId } = {}) {
    const owner = exactSubject(subject);
    const session = exactUuid(sessionId);
    if (!owner || !session) throw new TypeError('IVOC context-pack identity is invalid.');
    const rows = await rest.table(
      'ivoc_context_packs',
      `?session_id=eq.${encodeURIComponent(session)}&owner_subject=eq.${encodeURIComponent(owner)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block,source_receipts&limit=1`,
    );
    const row = Array.isArray(rows) && rows.length === 1 ? structuredClone(rows[0]) : null;
    // Older longitudinal evidence can contain interviewer speech mislabeled as
    // the candidate. Never send a pre-rendered block derived from that evidence
    // to either the native interviewer or the inactive Actor seam.
    const repository = {
      request: path => { const at = path.indexOf('?'); return rest.table(path.slice(0, at), path.slice(at)); },
      single: async path => { const at = path.indexOf('?'); const rows = await rest.table(path.slice(0, at), path.slice(at));
        return Array.isArray(rows) && rows.length === 1 ? rows[0] : null; },
    };
    if (!await validateSourceBoundPriorIvocPack({ repository, actor: owner, sessionId: session, sourceReceipts: row?.source_receipts })) return null;
    if (row.source_receipts.some(receipt => receipt.projection_type === 'ivoc.longitudinal_summary')) {
      const again = await rest.table('ivoc_context_packs',
        `?session_id=eq.${encodeURIComponent(session)}&owner_subject=eq.${encodeURIComponent(owner)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block,source_receipts&limit=1`);
      if (!Array.isArray(again) || again.length !== 1 || hashValue(row) !== hashValue(again[0])) return null;
    }
    const packId = exactUuid(row?.pack_id);
    const packVersion = exactPackVersion(row?.pack_version);
    const actorBlock = boundedActorBlock(row?.actor_block);
    if (!packId || !packVersion || !actorBlock) return null;
    return Object.freeze({
      receipt: `ctxpack:${packId}@${packVersion}`,
      actorBlock,
    });
  };
}

/**
 * Inactive, server-internal preparation seam; not a provider/job authorization.
 * The injected reader must load canonical ownership/state and project persisted
 * session settings into the existing native context shape, returning exactly
 * { ownerSubject, sessionId, state, context }. No production reader is wired here.
 * Callers must establish subject/session authority outside any client payload.
 */
export function createIvocActorInstructionResolver({ rest, readSessionContext } = {}) {
  if (typeof readSessionContext !== 'function') {
    throw new TypeError('A server-owned IVOC session-context reader is required.');
  }
  const resolvePack = createIvocContextPackResolver({ rest });
  return async function resolveIvocActorInstructions(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).sort().join(',') !== 'sessionId,subject'
        || typeof input.subject !== 'string' || typeof input.sessionId !== 'string') {
      throw new TypeError('IVOC Actor instruction identity is invalid.');
    }
    const subject = exactSubject(input.subject);
    const sessionId = exactUuid(input.sessionId);
    if (!subject || !sessionId || subject !== input.subject || sessionId !== input.sessionId) {
      throw new TypeError('IVOC Actor instruction identity is invalid.');
    }
    const session = await readSessionContext(Object.freeze({ subject, sessionId }));
    if (!session || typeof session !== 'object' || Array.isArray(session)
        || Object.keys(session).sort().join(',') !== 'context,ownerSubject,sessionId,state'
        || session.ownerSubject !== subject || session.sessionId !== sessionId || session.state !== 'active') {
      throw new TypeError('The active owned IVOC session context is unavailable.');
    }
    // Normalize before asynchronous pack lookup so later reader-side mutation
    // cannot change the already validated role, style, pressure or question order.
    const context = normalizeLiveInterviewContext(session.context);
    const actorContext = await resolvePack({ subject, sessionId });
    if (!actorContext) throw new TypeError('The active IVOC Actor context pack is unavailable.');
    const instructions = buildLiveInterviewInstructions(context, actorContext);
    if (Buffer.byteLength(instructions, 'utf8') > MAX_ACTOR_INSTRUCTIONS_BYTES) {
      throw new TypeError('IVOC Actor instructions exceed the bounded output limit.');
    }
    return Object.freeze({ receipt: actorContext.receipt, instructions });
  };
}

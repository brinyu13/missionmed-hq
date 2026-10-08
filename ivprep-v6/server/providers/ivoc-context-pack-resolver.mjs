import {programActorBlockIsCurrent} from '../../../ivoc/intelligence/pack/serialize.mjs';
import { buildLiveInterviewInstructions, normalizeLiveInterviewContext } from './openai-live-session.mjs';
import { validateSourceBoundPriorIvocPack } from '../../../missionmed-hq/ivoc/application-intelligence.mjs';
import { hashValue } from '../../../ivoc/intelligence/index.mjs';
import { createLiveContext, normalizePracticeFocus } from '../../public/studio/live-context-adapter.mjs';
import {projectInterviewPolicy,normalizeFollowUpRequest} from '../../public/capabilities/interview-policy.mjs';
import {interviewerPreferenceRequest} from '../../public/capabilities/interviewer-preferences.mjs';

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

export function createIvocContextPackResolver({ rest, now=Date.now } = {}) {
  if (!rest || typeof rest.table !== 'function') {
    throw new TypeError('IVOC context-pack storage is required.');
  }
  return async function resolveIvocContextPack({ subject, sessionId } = {}) {
    const owner = exactSubject(subject);
    const session = exactUuid(sessionId);
    if (!owner || !session) throw new TypeError('IVOC context-pack identity is invalid.');
    const rows = await rest.table(
      'ivoc_context_packs',
      `?session_id=eq.${encodeURIComponent(session)}&owner_subject=eq.${encodeURIComponent(owner)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block,source_receipts,pack&limit=1`,
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
        `?session_id=eq.${encodeURIComponent(session)}&owner_subject=eq.${encodeURIComponent(owner)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block,source_receipts,pack&limit=1`);
      if (!Array.isArray(again) || again.length !== 1 || hashValue(row) !== hashValue(again[0])) return null;
    }
    const packId = exactUuid(row?.pack_id);
    const packVersion = exactPackVersion(row?.pack_version);
    const actorBlock = boundedActorBlock(row?.actor_block);
    if (!packId || !packVersion || !actorBlock) return null;
    const policyRows = await rest.table('ivoc_admin_config_versions','?select=version,schema_name,pressure_defaults&order=version.desc&limit=1');
    const interviewPolicy = Array.isArray(policyRows) && policyRows.length === 1 ? projectInterviewPolicy(policyRows[0]) : null;
    if (!interviewPolicy) return null;
    if(!programActorBlockIsCurrent(row,now()))return null;
    return Object.freeze({
      receipt: `ctxpack:${packId}@${packVersion}`,
      actorBlock,
      interviewPolicy,
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

function storedInterviewContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_ACTOR_INSTRUCTIONS_BYTES
      || !['Full IV Simulation', 'Guided Mock IV Practice', 'Individual Question'].includes(value.goal)
      || !['Program Director', 'Associate Program Director', 'Faculty', 'Chief Resident'].includes(value.interviewer)
      || !['MissionMed', 'Webex', 'Zoom', 'Teams'].includes(value.environment)
      || typeof value.pressurePractice !== 'boolean'
      || !Number.isInteger(value.targetQuestions) || value.targetQuestions < 1 || value.targetQuestions > 30
      || !Array.isArray(value.questionIds) || value.questionIds.length > 30
      || value.questionIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/u.test(id))
      || (value.interviewerStyle != null && !['Dove', 'Peacock', 'Owl', 'Eagle'].includes(value.interviewerStyle))) {
    throw new TypeError('The stored IVOC interview setup is invalid.');
  }
  const focus = normalizePracticeFocus(value.practiceFocus);
  // Persisted visual environment is not an Analytics visibility authority. The
  // room still owns that display setting; this inactive path cannot change it.
  // Program/application content comes only from the separately authorized pack.
  return normalizeLiveInterviewContext(createLiveContext({
    wizard: {
      goal: value.goal, interviewer: value.interviewer, environment: value.environment,
      pressurePractice: value.pressurePractice,
      ...normalizeFollowUpRequest(value),
      ...interviewerPreferenceRequest(value),
      ...(value.interviewerStyle != null ? { interviewerStyle: value.interviewerStyle } : {}),
      ...(focus ? { focus } : {}),
    },
    interviewSet: value.questionIds.map(question_id => ({ question_id })),
    targetQuestions: value.targetQuestions,
  }));
}

/**
 * GET-only, inactive preparation of the Actor's instructions from saved setup.
 * This is NOT admission, a provider dispatch, or authority to publish audio.
 * A future caller must supply authenticated server identity and recheck its
 * independent activation/admission gate before dispatching any provider work.
 */
export function createStoredIvocActorInstructionResolver({ rest } = {}) {
  const resolvePack = createIvocContextPackResolver({ rest });
  return async function resolveStoredIvocActorInstructions(input) {
    // Per-call custody prevents concurrent subjects from sharing a snapshot.
    let first;
    let identity;
    const readOwned = async ({ subject, sessionId }) => {
      const rows = await rest.table('ivoc_sessions',
        `?id=eq.${encodeURIComponent(sessionId)}&owner_subject=eq.${encodeURIComponent(subject)}&state=eq.active&select=id,owner_subject,state,context&limit=1`);
      const row = Array.isArray(rows) && rows.length === 1 ? structuredClone(rows[0]) : null;
      if (!row || row.id !== sessionId || row.owner_subject !== subject || row.state !== 'active') {
        throw new TypeError('The active owned IVOC session context is unavailable.');
      }
      return { ownerSubject: subject, sessionId, state: row.state, context: row.context };
    };
    const resolve = createIvocActorInstructionResolver({ rest, readSessionContext: async authorized => {
      identity = authorized;
      first = await readOwned(authorized);
      return { ...first, context: storedInterviewContext(first.context) };
    } });
    // The existing resolver rejects extended/malformed identity before any read.
    const output = await resolve(input);
    const pack = await resolvePack(identity);
    if (!pack || pack.receipt !== output.receipt
        || buildLiveInterviewInstructions(storedInterviewContext(first.context), pack) !== output.instructions) {
      throw new TypeError('The active IVOC Actor context pack changed during preparation.');
    }
    if (hashValue(first) !== hashValue(await readOwned(identity))) {
      throw new TypeError('The owned IVOC session changed during preparation.');
    }
    return output;
  };
}

import { canonicalJson, sha256Hex } from '../../ivoc/intelligence/index.mjs';
import { assembleContextPack, contextReceiptRef } from '../../ivoc/intelligence/pack/assemble.mjs';

const CONTEXT_PACK_SCHEMA = 'ivoc.interview_context_pack.v1';

function safeText(value, maximum = 200) {
  return String(value || '').trim().slice(0, maximum);
}

function practiceGoal(row) {
  const goal = String(row?.context?.goal || '').toLowerCase();
  if (goal.includes('guided')) return 'guided_mock';
  if (goal.includes('individual') || row?.session_type === 'question') return 'individual_question';
  return 'full_simulation';
}

function environment(row) {
  const value = String(row?.context?.environment || '').toLowerCase();
  if (value.includes('webex')) return 'webex_sim';
  if (value.includes('zoom')) return 'zoom_sim';
  if (value.includes('teams')) return 'teams_sim';
  if (value.includes('studio')) return 'live_mock_studio';
  return 'missionmed';
}

function selectedQuestionIds(row) {
  const candidates = [
    row?.question_id,
    ...(Array.isArray(row?.context?.questionIds) ? row.context.questionIds : []),
    ...(Array.isArray(row?.context?.questionPool) ? row.context.questionPool : []),
  ];
  return [...new Set(candidates.map((value) => safeText(value, 120)).filter(Boolean))].sort();
}

function poolSnapshotRef(row) {
  const questionIds = selectedQuestionIds(row);
  const basis = questionIds.length ? questionIds : [`session-type:${safeText(row?.session_type, 40) || 'question'}`];
  return `pool:${sha256Hex(canonicalJson(basis))}`;
}

function programRef(row) {
  return safeText(row?.context?.programRef || row?.context?.programId || row?.context?.program?.id, 200) || null;
}

function initialContract(row, actor, receipt) {
  const goal = practiceGoal(row);
  const targetAsked = Math.max(1, Math.trunc(Number(row?.context?.targetQuestions) || 1));
  return {
    session_id: row.id,
    schema_version: 1,
    actor_subject: actor,
    role_context: 'student',
    practice_goal: goal,
    pressure_modifier: goal === 'individual_question' ? false : row?.context?.pressurePractice === true,
    transport_profile: 'none',
    environment: environment(row),
    selection_policy: 'system',
    follow_up_intensity: row?.context?.pressurePractice === true ? 2 : 1,
    target_asked_count: targetAsked,
    target_duration_s: null,
    interviewer_config_ref: `interviewer:${safeText(row?.context?.interviewer, 120) || safeText(row?.interviewer_provider, 80) || 'missionmed-static'}`,
    question_pool_ref: poolSnapshotRef(row),
    analytics_config_version: safeText(row?.analytics_schema, 80) || 'ivoc.analytics.v1',
    contract_state: 'ready_check',
    state_version: 0,
    clock: { origin: 'capture_owner', started_at_wall: new Date(row.started_at).toISOString() },
    context_receipts: [receipt],
  };
}

export async function readSessionContextReceipts(repository, sessionId) {
  const row = await repository.single(
    `ivoc_session_contracts?session_id=eq.${encodeURIComponent(sessionId)}&select=context_receipts&limit=1`,
  );
  const receipts = Array.isArray(row?.context_receipts) ? row.context_receipts : [];
  return [...new Set(receipts.filter((value) => typeof value === 'string' && value.startsWith('ctxpack:')))];
}

export function createIvocApplicationIntelligence({ repository, now = () => Date.now(), projectionProvider = async () => [] } = {}) {
  if (!repository) throw new TypeError('ivoc_application_intelligence_repository_required');

  return Object.freeze({
    async prepareSession({ actor, sessionRow }) {
      if (!actor || !sessionRow?.id) throw new TypeError('ivoc_application_intelligence_session_required');
      const projections = await projectionProvider({ actor, session: sessionRow });
      if (!Array.isArray(projections)) throw new TypeError('ivoc_application_intelligence_projection_invalid');
      const builtAt = new Date(now()).toISOString();
      const pack = assembleContextPack({
        subject_id: actor,
        projections,
        program_ref: programRef(sessionRow),
        pool_snapshot_ref: poolSnapshotRef(sessionRow),
        practice_goal: practiceGoal(sessionRow),
        now: builtAt,
      });
      const receipt = contextReceiptRef(pack);
      await repository.upsert('ivoc_context_packs', 'session_id,pack_version', {
        session_id: sessionRow.id,
        pack_id: pack.pack_id,
        owner_subject: actor,
        schema_name: CONTEXT_PACK_SCHEMA,
        schema_version: 1,
        pack_version: pack.pack_version,
        rules_version: pack.rules_version,
        practice_goal: pack.practice_goal,
        program_ref: pack.program?.program_ref || null,
        pool_snapshot_ref: pack.pool_snapshot_ref,
        source_receipts: pack.inputs,
        pack,
        actor_block: pack.actor_block,
        built_at: pack.built_at,
        invalidated_at: null,
        invalidation_reason: null,
      });
      await repository.upsert('ivoc_session_contracts', 'session_id', initialContract(sessionRow, actor, receipt));
      return Object.freeze({ receipt, packId: pack.pack_id, packVersion: pack.pack_version });
    },

    async getActorContext({ actor, sessionId }) {
      if (!actor || !sessionId) throw new TypeError('ivoc_application_intelligence_session_required');
      const row = await repository.single(
        `ivoc_context_packs?session_id=eq.${encodeURIComponent(sessionId)}&owner_subject=eq.${encodeURIComponent(actor)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block&limit=1`,
      );
      if (!row) return null;
      return Object.freeze({
        receipt: contextReceiptRef({ pack_id: row.pack_id, pack_version: row.pack_version }),
        actorBlock: row.actor_block,
      });
    },
  });
}

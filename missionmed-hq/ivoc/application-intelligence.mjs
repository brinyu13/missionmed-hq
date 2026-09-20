import { canonicalJson, hashValue, sha256Hex } from '../../ivoc/intelligence/index.mjs';
import { assembleContextPack, contextReceiptRef } from '../../ivoc/intelligence/pack/assemble.mjs';

const CONTEXT_PACK_SCHEMA = 'ivoc.interview_context_pack.v1';
const LONGITUDINAL_DIMENSION = 'semantic.coaching_pattern';
const LONGITUDINAL_FACETS = Object.freeze(['structure', 'evidence', 'specificity', 'concision']);
const LONGITUDINAL_POLARITIES = Object.freeze(['strength', 'weakness']);
const MIN_LONGITUDINAL_CONFIDENCE = 0.65;

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

function initialContract(row, actor, receipt, adminConfig = null) {
  const goal = practiceGoal(row);
  const targetAsked = Math.max(1, Math.trunc(Number(row?.context?.targetQuestions) || 1));
  const configuredFollowUp = Number(adminConfig?.pressure_defaults?.default_follow_up_intensity);
  const defaultFollowUp = Number.isSafeInteger(configuredFollowUp) && configuredFollowUp >= 0 && configuredFollowUp <= 3
    ? configuredFollowUp : 1;
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
    follow_up_intensity: row?.context?.pressurePractice === true ? Math.max(2, defaultFollowUp) : defaultFollowUp,
    target_asked_count: targetAsked,
    target_duration_s: null,
    interviewer_config_ref: `interviewer:${safeText(row?.context?.interviewer, 120) || safeText(row?.interviewer_provider, 80) || 'missionmed-static'}`,
    question_pool_ref: poolSnapshotRef(row),
    analytics_config_version: safeText(adminConfig?.analytics_config_version, 80)
      || safeText(row?.analytics_schema, 80) || 'ivoc.analytics.v1',
    admin_config_version: Number.isSafeInteger(adminConfig?.version) ? adminConfig.version : 1,
    brain_pack_version: safeText(adminConfig?.brain_pack_version, 80) || 'gpt-live-1:marin',
    ais_rules_version: safeText(adminConfig?.ais_rules_version, 80) || '2026-09-18.1',
    contract_state: 'ready_check',
    state_version: 0,
    clock: { origin: 'capture_owner', started_at_wall: new Date(row.started_at).toISOString() },
    context_receipts: [receipt],
  };
}

function mentorPriorityProjection(row) {
  const priorities = Array.isArray(row?.priorities) ? row.priorities : [];
  const mentorNotes = Array.isArray(row?.mentor_notes) ? row.mentor_notes : [];
  if (!row?.subject_id || !Number.isSafeInteger(row?.version) || (!priorities.length && !mentorNotes.length)) return null;
  const producedAt = new Date(row.created_at).toISOString();
  const sourceVersion = `mp-v${row.version}`;
  const payload = {
    top3: priorities.map((item) => ({
      id: item.id,
      text: item.text,
      rank: item.rank,
      set_by: row.set_by,
      set_at: producedAt,
    })),
    mentor_notes: mentorNotes.map((item) => ({
      id: item.id,
      text: item.text,
      visibility: item.visibility,
    })),
  };
  const receiptHash = hashValue({
    subject_id: row.subject_id,
    source_version: sourceVersion,
    payload,
  });
  return Object.freeze({
    projection_id: `ivoc-mentor-priorities:${row.subject_id}`,
    owner_app: 'ivoc',
    projection_type: 'ivoc.mentor_priorities',
    schema_version: '1',
    subject_id: row.subject_id,
    source_version: sourceVersion,
    produced_at: producedAt,
    authorization: { basis: 'admin', scope: ['top3', 'mentor_notes'] },
    minimization: { fields_included: ['top3', 'mentor_notes'] },
    payload,
    source_receipt: {
      owner_ref: `ivoc:${row.subject_id}@${sourceVersion}`,
      hash: receiptHash,
    },
    revocation: { revocable: true },
  });
}

function validIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function evidenceScoreValue(value) {
  const numeric = Number(value && typeof value === 'object' ? value.value : value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function longitudinalProjection(rows, subjectId) {
  if (!/^wp:[1-9][0-9]{0,19}$/u.test(String(subjectId || '')) || !Array.isArray(rows)) return null;
  const groups = new Map();
  for (const row of rows) {
    const facet = String(row?.interpretation?.facet || '').toLowerCase();
    const polarity = String(row?.interpretation?.polarity || '').toLowerCase();
    const confidence = Number(row?.confidence);
    const score = evidenceScoreValue(row?.score);
    const createdAt = validIso(row?.created_at);
    const evidenceId = safeText(row?.evidence_id, 160);
    const sessionId = safeText(row?.session_id, 120);
    if (row?.subject_id !== subjectId || row?.dimension !== LONGITUDINAL_DIMENSION
      || !LONGITUDINAL_FACETS.includes(facet) || !LONGITUDINAL_POLARITIES.includes(polarity)
      || !Number.isFinite(confidence) || confidence < MIN_LONGITUDINAL_CONFIDENCE
      || !Number.isFinite(score) || score < MIN_LONGITUDINAL_CONFIDENCE
      || !Array.isArray(row?.refs) || !row.refs.length || !evidenceId || !sessionId || !createdAt
      || !Number.isSafeInteger(row?.version) || row.version < 1) continue;
    const key = `${polarity}:${facet}`;
    const group = groups.get(key) || { facet, polarity, sessions: new Set(), evidence: new Set(), producedAt: createdAt };
    group.sessions.add(sessionId);
    group.evidence.add(evidenceId);
    if (createdAt > group.producedAt) group.producedAt = createdAt;
    groups.set(key, group);
  }
  const recurring = { weaknesses: [], strengths: [] };
  let producedAt = null;
  for (const group of [...groups.values()].sort((a, b) => `${a.polarity}:${a.facet}`.localeCompare(`${b.polarity}:${b.facet}`))) {
    if (group.sessions.size < 2) continue;
    const item = {
      facet: group.facet,
      sessions: [...group.sessions].sort(),
      evidence_refs: [...group.evidence].sort(),
    };
    recurring[group.polarity === 'weakness' ? 'weaknesses' : 'strengths'].push(item);
    if (!producedAt || group.producedAt > producedAt) producedAt = group.producedAt;
  }
  if (!recurring.weaknesses.length && !recurring.strengths.length) return null;
  const payload = { recurring };
  const sourceVersion = `long-${hashValue(payload).slice(0, 16)}`;
  return Object.freeze({
    projection_id: `ivoc-longitudinal:${subjectId}`,
    owner_app: 'ivoc',
    projection_type: 'ivoc.longitudinal_summary',
    schema_version: '1',
    subject_id: subjectId,
    source_version: sourceVersion,
    produced_at: producedAt,
    authorization: { basis: 'owner_policy', scope: ['recurring'] },
    minimization: { fields_included: ['recurring'] },
    payload,
    source_receipt: {
      owner_ref: `ivoc:${subjectId}@${sourceVersion}`,
      hash: hashValue({ subject_id: subjectId, source_version: sourceVersion, payload }),
    },
    revocation: { revocable: true },
  });
}

async function readLongitudinalProjection(repository, actor, currentSessionId = null) {
  if (typeof repository.request !== 'function') return null;
  const saved = await repository.request(
    `ivoc_sessions?owner_subject=eq.${encodeURIComponent(actor)}&state=eq.saved&select=id&order=ended_at.desc&limit=50`,
  );
  const sessionIds = [...new Set((saved || []).map((row) => safeText(row?.id, 120)).filter(Boolean))]
    .filter((id) => id !== currentSessionId);
  if (sessionIds.length < 2) return null;
  const evidence = await repository.request(
    `ivoc_coaching_evidence?subject_id=eq.${encodeURIComponent(actor)}&session_id=in.(${sessionIds.join(',')})`
      + `&dimension=eq.${LONGITUDINAL_DIMENSION}`
      + '&select=evidence_id,session_id,subject_id,dimension,refs,interpretation,score,confidence,limitations,version,created_at'
      + '&order=created_at.desc&limit=200',
  );
  return longitudinalProjection(evidence, actor);
}

export function createIvocProjectionProvider({ repository } = {}) {
  if (!repository) throw new TypeError('ivoc_projection_repository_required');
  return async function projectionProvider({ actor, session = null } = {}) {
    if (!/^wp:[1-9][0-9]{0,19}$/u.test(String(actor || ''))) return [];
    const [row, priorIvoc] = await Promise.all([
      repository.single(
        `ivoc_mentor_priority_sets?subject_id=eq.${encodeURIComponent(actor)}&select=*&order=version.desc&limit=1`,
      ),
      readLongitudinalProjection(repository, actor, safeText(session?.id, 120) || null),
    ]);
    return [mentorPriorityProjection(row), priorIvoc].filter(Boolean);
  };
}

export async function readSessionContextReceipts(repository, sessionId) {
  const row = await repository.single(
    `ivoc_session_contracts?session_id=eq.${encodeURIComponent(sessionId)}&select=context_receipts&limit=1`,
  );
  const receipts = Array.isArray(row?.context_receipts) ? row.context_receipts : [];
  return [...new Set(receipts.filter((value) => typeof value === 'string' && value.startsWith('ctxpack:')))];
}

export function createIvocApplicationIntelligence({ repository, now = () => Date.now(), projectionProvider = null } = {}) {
  if (!repository) throw new TypeError('ivoc_application_intelligence_repository_required');
  const resolveProjections = projectionProvider || createIvocProjectionProvider({ repository });

  return Object.freeze({
    async prepareSession({ actor, sessionRow }) {
      if (!actor || !sessionRow?.id) throw new TypeError('ivoc_application_intelligence_session_required');
      const [projections, adminConfig] = await Promise.all([
        resolveProjections({ actor, session: sessionRow }),
        repository.single('ivoc_admin_config_versions?select=*&order=version.desc&limit=1'),
      ]);
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
      await repository.upsert('ivoc_session_contracts', 'session_id', initialContract(sessionRow, actor, receipt, adminConfig));
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

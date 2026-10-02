import { canonicalJson, hashValue, sha256Hex, sourceReceiptFromProjection } from '../../ivoc/intelligence/index.mjs';
import { assembleContextPack, contextReceiptRef } from '../../ivoc/intelligence/pack/assemble.mjs';
import { projectSelfPracticeAnalysis } from './self-practice-analysis.mjs';

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

function requestsFileVaultContext(row) {
  const selected = Array.isArray(row?.context?.contextSources) ? row.context.contextSources : [];
  return selected.some((value) => ['cv', 'file vault'].includes(String(value || '').trim().toLowerCase()));
}

function requestsStoryForgeContext(row) {
  const selected = Array.isArray(row?.context?.contextSources) ? row.context.contextSources : [];
  return selected.some((value) => String(value || '').trim().toLowerCase() === 'storyforge');
}

function requestsRiseContext(row) {
  const selected = Array.isArray(row?.context?.contextSources) ? row.context.contextSources : [];
  return selected.some((value) => ['rise', 'program'].includes(String(value || '').trim().toLowerCase()));
}

function poolSnapshotRef(row) {
  const questionIds = selectedQuestionIds(row);
  const basis = questionIds.length ? questionIds : [`session-type:${safeText(row?.session_type, 40) || 'question'}`];
  return `pool:${sha256Hex(canonicalJson(basis))}`;
}

function programRef(row) {
  return safeText(row?.context?.programRef || row?.context?.programId || row?.context?.program?.id, 200) || null;
}

function programReleaseRef(row) {
  return safeText(row?.context?.programReleaseId || row?.context?.program?.registryReleaseId, 256) || null;
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

const ownedSubject = value => typeof value === 'string' && /^wp:[1-9][0-9]{0,19}$/u.test(value);
const sessionIdentity = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const selectedPriorIvoc = session => Array.isArray(session?.context?.contextSources) && session.context.contextSources.includes('Prior IVOC');
const SOURCE_BOUND_PRIOR_POLICY = 'self-practice-source-bound-prior-v1';
const snapshot = value => structuredClone(value);

/** Server-owned rows only; legacy evidence tables and raw media are never read. */
export async function readSourceBoundLongitudinalProjection({ repository, actor, session } = {}) {
  if (!ownedSubject(actor) || !sessionIdentity(session?.id) || session.owner_subject !== actor
    || session.state !== 'active' || !selectedPriorIvoc(session)) return null;
  const current = snapshot(session);
  const fetched = await repository.request(`ivoc_sessions?owner_subject=eq.${encodeURIComponent(actor)}&state=eq.saved&id=neq.${current.id}&select=*&order=ended_at.desc,id.asc&limit=50`);
  const sessions = snapshot(Array.isArray(fetched) ? fetched.slice(0, 50) : []).filter(row => sessionIdentity(row?.id)
    && row.id !== current.id && row.owner_subject === actor && row.state === 'saved');
  const unique = sessions.filter(row => sessions.filter(other => other.id === row.id).length === 1);
  if (unique.length < 2) return null;
  const ids = unique.map(row => row.id).sort().join(',');
  const [results, recordings] = await Promise.all([
    repository.request(`ivoc_results?session_id=in.(${ids})&owner_subject=eq.${encodeURIComponent(actor)}&candidate_analysis=not.is.null&select=session_id,owner_subject,candidate_analysis`).then(snapshot),
    repository.request(`ivoc_recordings?session_id=in.(${ids})&owner_subject=eq.${encodeURIComponent(actor)}&status=eq.saved&select=*`).then(snapshot),
  ]);
  if (!Array.isArray(results) || !Array.isArray(recordings)) return null;
  const groups = new Map(); const sources = new Map();
  for (const row of unique) {
    const candidates = results.filter(result => result?.session_id === row.id && result.owner_subject === actor);
    if (candidates.length !== 1) continue;
    const envelope = candidates[0].candidate_analysis;
    const parents = recordings.filter(recording => recording?.id === envelope?.receipt?.replayRecordingId);
    const stems = recordings.filter(recording => recording?.id === envelope?.receipt?.sourceRecordingId);
    if (parents.length !== 1 || stems.length !== 1) continue;
    const projection = projectSelfPracticeAnalysis({ candidateAnalysis: envelope, session: row,
      parentRecording: parents[0], sourceRecording: stems[0] });
    if (!projection.available || projection.result.analysis.status !== 'AVAILABLE') continue;
    // Reuse the existing conservative recurrence floor only at analysis level.
    // These uncalibrated AI estimates are neither individual pattern scores nor
    // source/speaker identity proof; source validation above is independent.
    const quality = projection.result.analysis;
    if (!Number.isFinite(quality.score) || !Number.isFinite(quality.coverage)
      || quality.score < MIN_LONGITUDINAL_CONFIDENCE || quality.coverage < MIN_LONGITUDINAL_CONFIDENCE) continue;
    sources.set(row.id, { sessionId: row.id, envelopeHash: hashValue(envelope), createdAt: projection.receipt.createdAt });
    for (const evidence of projection.spine.evidence.filter(item => item.dimension === LONGITUDINAL_DIMENSION)) {
      const { facet, polarity } = evidence.interpretation;
      if (!LONGITUDINAL_FACETS.includes(facet) || !LONGITUDINAL_POLARITIES.includes(polarity) || !evidence.refs.length) continue;
      const key = `${polarity}:${facet}`;
      const group = groups.get(key) || { facet, polarity, sessions: new Set(), evidence: new Set() };
      group.sessions.add(row.id); group.evidence.add(evidence.id); groups.set(key, group);
    }
  }
  const recurring = { weaknesses: [], strengths: [] }; const contributors = new Set();
  for (const [, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (group.sessions.size < 2) continue;
    const sessions = [...group.sessions].sort(); sessions.forEach(id => contributors.add(id));
    recurring[group.polarity === 'weakness' ? 'weaknesses' : 'strengths'].push({
      facet: group.facet, sessions, evidence_refs: [...group.evidence].sort() });
  }
  if (!contributors.size) return null;
  if (hashValue(session) !== hashValue(current)) return null;
  const provenance = [...contributors].sort().map(id => sources.get(id));
  const payload = { recurring };
  const sourceHash = hashValue({ policy: SOURCE_BOUND_PRIOR_POLICY, subject_id: actor, payload, contributors: provenance });
  const sourceVersion = `source-bound-long-${sourceHash.slice(0, 32)}`;
  return Object.freeze({ projection_id: `ivoc-longitudinal:${actor}`, owner_app: 'ivoc', projection_type: 'ivoc.longitudinal_summary',
    schema_version: '1', subject_id: actor, source_version: sourceVersion,
    produced_at: provenance.map(source => source.createdAt).sort().at(-1),
    authorization: { basis: 'owner_policy', scope: ['recurring'] },
    minimization: { fields_included: ['recurring'], fields_excluded_reason: {
      transcript_text: 'Only cited AI-draft execution facets are aggregated; no raw transcript or media is included.',
      analysis_quality: 'Analysis-level AI estimates are a conservative filter, not calibration, per-pattern scores, or speaker identity proof.',
      biometric_identity: 'Separate mic custody remains client-declared, not biometric identity or acoustic isolation proof.' } },
    payload, source_receipt: { owner_ref: `ivoc:${actor}@${sourceVersion}`, hash: sourceHash }, revocation: { revocable: true } });
}

/** Shared HQ/native/Actor gate. No longitudinal receipt is grandfathered in. */
export async function validateSourceBoundPriorIvocPack({ repository, actor, sessionId, sourceReceipts } = {}) {
  if (!Array.isArray(sourceReceipts) || sourceReceipts.some(receipt => !receipt || typeof receipt !== 'object'
    || typeof receipt.projection_type !== 'string')) return false;
  const prior = sourceReceipts.filter(receipt => receipt.projection_type === 'ivoc.longitudinal_summary');
  if (!prior.length) return true;
  if (!ownedSubject(actor) || !sessionIdentity(sessionId) || prior.length !== 1) return false;
  if (prior[0].owner_app !== 'ivoc' || prior[0].projection_id !== `ivoc-longitudinal:${actor}`
    || !/^source-bound-long-[0-9a-f]{32}$/u.test(prior[0].source_version || '')
    || !/^[0-9a-f]{64}$/u.test(prior[0].source_receipt_hash || '')
    || prior[0].authorization_basis !== 'owner_policy' || prior[0].degraded) return false;
  const path = `ivoc_sessions?id=eq.${sessionId}&owner_subject=eq.${encodeURIComponent(actor)}&select=id,owner_subject,state,context&limit=1`;
  const current = snapshot(await repository.single(path));
  if (!current || current.id !== sessionId || current.owner_subject !== actor || current.state !== 'active' || !selectedPriorIvoc(current)) return false;
  const projection = await readSourceBoundLongitudinalProjection({ repository, actor, session: current });
  if (!projection || hashValue(prior[0]) !== hashValue(sourceReceiptFromProjection(projection))) return false;
  const again = snapshot(await repository.single(path));
  if (hashValue(current) !== hashValue(again)) return false;
  const rechecked = await readSourceBoundLongitudinalProjection({ repository, actor, session: again });
  return Boolean(rechecked && hashValue(projection) === hashValue(rechecked));
}

export function createIvocProjectionProvider({ repository, fileVaultSource = null, storyForgeSource = null, riseSource = null } = {}) {
  if (!repository) throw new TypeError('ivoc_projection_repository_required');
  return async function projectionProvider({ actor, session = null, authorization = null, sessionCookie = null } = {}) {
    if (!/^wp:[1-9][0-9]{0,19}$/u.test(String(actor || ''))) return [];
    const needsFileVault = requestsFileVaultContext(session);
    const needsStoryForge = requestsStoryForgeContext(session);
    const needsRise = requestsRiseContext(session);
    if (needsFileVault && !fileVaultSource?.read) {
      throw new TypeError('ivoc_file_vault_projection_unavailable');
    }
    if (needsStoryForge && !storyForgeSource?.read) {
      throw new TypeError('ivoc_storyforge_projection_unavailable');
    }
    if (needsRise && !riseSource?.read) throw new TypeError('ivoc_rise_projection_unavailable');
    const selectedProgram = programRef(session);
    const registryReleaseId = programReleaseRef(session);
    if (needsRise && (!selectedProgram || !registryReleaseId)) {
      throw new TypeError('ivoc_rise_program_selection_required');
    }
    const [row, priorIvoc, fileVaultCv, storyForgeStories, riseProgram] = await Promise.all([
      repository.single(
        `ivoc_mentor_priority_sets?subject_id=eq.${encodeURIComponent(actor)}&select=*&order=version.desc&limit=1`,
      ),
      readSourceBoundLongitudinalProjection({ repository, actor, session }),
      needsFileVault
        ? fileVaultSource.read({ actor, sessionId: safeText(session?.id, 120), authorization })
        : null,
      needsStoryForge
        ? storyForgeSource.read({ actor, sessionId: safeText(session?.id, 120), authorization })
        : null,
      needsRise
        ? riseSource.read({
          actor, sessionId: safeText(session?.id, 120), sessionCookie,
          programId: selectedProgram, registryReleaseId,
        })
        : null,
    ]);
    if (needsFileVault && !fileVaultCv) throw new TypeError('ivoc_file_vault_projection_unavailable');
    if (needsStoryForge && !storyForgeStories) throw new TypeError('ivoc_storyforge_projection_unavailable');
    if (needsRise && !riseProgram) throw new TypeError('ivoc_rise_projection_unavailable');
    return [fileVaultCv, storyForgeStories, riseProgram, mentorPriorityProjection(row), priorIvoc].filter(Boolean);
  };
}

export async function readSessionContextReceipts(repository, sessionId) {
  const row = await repository.single(
    `ivoc_session_contracts?session_id=eq.${encodeURIComponent(sessionId)}&select=context_receipts&limit=1`,
  );
  const receipts = Array.isArray(row?.context_receipts) ? row.context_receipts : [];
  return [...new Set(receipts.filter((value) => typeof value === 'string' && value.startsWith('ctxpack:')))];
}

export function createIvocApplicationIntelligence({
  repository,
  now = () => Date.now(),
  projectionProvider = null,
  fileVaultSource = null,
  storyForgeSource = null,
  riseSource = null,
} = {}) {
  if (!repository) throw new TypeError('ivoc_application_intelligence_repository_required');
  const resolveProjections = projectionProvider || createIvocProjectionProvider({
    repository, fileVaultSource, storyForgeSource, riseSource,
  });

  return Object.freeze({
    async prepareSession({ actor, sessionRow, authorization = null, sessionCookie = null }) {
      if (!actor || !sessionRow?.id) throw new TypeError('ivoc_application_intelligence_session_required');
      const [projections, adminConfig] = await Promise.all([
        resolveProjections({ actor, session: sessionRow, authorization, sessionCookie }),
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
        `ivoc_context_packs?session_id=eq.${encodeURIComponent(sessionId)}&owner_subject=eq.${encodeURIComponent(actor)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block,source_receipts&limit=1`,
      );
      if (!row) return null;
      // An already prepared pack can predate the read-side quarantine. Do not
      // reuse its rendered actor block, or try to remove guessed text from it.
      const saved = snapshot(row);
      if (!await validateSourceBoundPriorIvocPack({ repository, actor, sessionId, sourceReceipts: saved.source_receipts })) return null;
      if (saved.source_receipts.some(receipt => receipt.projection_type === 'ivoc.longitudinal_summary')) {
        const again = await repository.single(`ivoc_context_packs?session_id=eq.${encodeURIComponent(sessionId)}&owner_subject=eq.${encodeURIComponent(actor)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block,source_receipts&limit=1`);
        if (hashValue(saved) !== hashValue(again)) return null;
      }
      return Object.freeze({
        receipt: contextReceiptRef({ pack_id: saved.pack_id, pack_version: saved.pack_version }),
        actorBlock: saved.actor_block,
      });
    },
  });
}

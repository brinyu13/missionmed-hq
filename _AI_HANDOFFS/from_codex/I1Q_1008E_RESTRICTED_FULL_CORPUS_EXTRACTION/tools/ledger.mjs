import {
  ARTIFACT_FINAL_STATES,
  ARTIFACT_PROCESSING_LEDGER_SCHEMA_VERSION,
  OBSERVED_NODES_COUNT,
  OBSERVED_TRANSCRIPT_COUNT,
  PARSER_VERSION,
  PASS_DEFINITIONS,
  REQUIRED_PASS_CELL_COUNT,
} from './constants.mjs';
import {
  contentAddressedEnvelope,
  deterministicId,
  stableHash,
  verifyContentAddressedEnvelope,
} from './canonical.mjs';

const SHA256 = /^[a-f0-9]{64}$/u;
const ALIAS = /^(?:opaque_)?(?:source|artifact|run|occurrence|concept|review|receipt|cluster)(?:_sha256)?_[A-Za-z0-9_-]{8,}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,127}$/u;
const JOURNAL_SCHEMA = 'missionmed.i1q.1008e.restricted_run_journal.v1';
const LEDGER_SCHEMA = ARTIFACT_PROCESSING_LEDGER_SCHEMA_VERSION;
const PREDECESSOR_COMMIT = '9af94d976572b20540d006084ef2c34eb3b3b9a5';
const REQUIRED_SPECIALIST_VERIFICATION_CELL_COUNT = OBSERVED_TRANSCRIPT_COUNT * 2;
const REQUIRED_SPECIALIST_ROLE_REVIEW_COUNT = OBSERVED_TRANSCRIPT_COUNT * 4;
const COMPLETE_PASS_STATES = new Set(['COMPLETE', 'COMPLETE_WITH_FINDINGS']);
const BLOCKED_PASS_STATES = new Set(['PARTIAL_WITH_PROVEN_BLOCKER', 'FAILED_WITH_PROVEN_BLOCKER']);
const VALID_PASS_STATES = new Set([
  'NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'COMPLETE_WITH_FINDINGS',
  'PARTIAL_WITH_PROVEN_BLOCKER', 'FAILED_WITH_PROVEN_BLOCKER',
]);

function requiredString(value, code) {
  if (typeof value !== 'string' || !value) throw new TypeError(code);
  return value;
}

function safeErrorCode(value) {
  return value === null || (typeof value === 'string' && SAFE_CODE.test(value));
}

function journalHeader(journal) {
  return {
    schema_version: journal.schema_version,
    extraction_run_id: journal.extraction_run_id,
    run_contract_hash: journal.run_contract_hash,
    roster_root: journal.roster_root,
  };
}

export function createRunJournal({ extractionRunId, runContractHash, rosterRoot }) {
  requiredString(extractionRunId, 'journal_run_id_invalid');
  if (!SHA256.test(runContractHash) || !SHA256.test(rosterRoot)) {
    throw new TypeError('journal_contract_hash_invalid');
  }
  const base = {
    schema_version: JOURNAL_SCHEMA,
    extraction_run_id: extractionRunId,
    run_contract_hash: runContractHash,
    roster_root: rosterRoot,
  };
  return { ...base, journal_header_hash: stableHash(base), events: [] };
}

function journalEventIdentity(event) {
  return stableHash({
    artifact_alias: event.artifact_alias,
    phase: event.phase,
    pass_id: event.pass_id,
    attempt_number: event.attempt_number,
  });
}

export function appendJournalEvent(journal, eventInput) {
  if (validateJournal(journal).length > 0) throw new TypeError('journal_invalid');
  const prior = journal.events.at(-1)?.event_hash ?? null;
  const event = {
    sequence: journal.events.length,
    extraction_run_id: journal.extraction_run_id,
    journal_header_hash: journal.journal_header_hash,
    artifact_alias: requiredString(eventInput.artifact_alias, 'journal_artifact_alias_invalid'),
    phase: requiredString(eventInput.phase, 'journal_phase_invalid'),
    pass_id: eventInput.pass_id ?? null,
    attempt_number: Number(eventInput.attempt_number ?? 1),
    prior_event_hash: prior,
    input_hash: requiredString(eventInput.input_hash, 'journal_input_hash_invalid'),
    rules_hash: requiredString(eventInput.rules_hash, 'journal_rules_hash_invalid'),
    parser_hash: requiredString(eventInput.parser_hash, 'journal_parser_hash_invalid'),
    state_transition: requiredString(eventInput.state_transition, 'journal_transition_invalid'),
    controlled_error_class: eventInput.controlled_error_class ?? null,
    safe_diagnostic_hash: eventInput.safe_diagnostic_hash ?? null,
    recovery_action: eventInput.recovery_action ?? null,
    output_shard_hash: eventInput.output_shard_hash ?? null,
  };
  if (!Number.isSafeInteger(event.attempt_number) || event.attempt_number < 1) {
    throw new TypeError('journal_attempt_invalid');
  }
  for (const key of ['input_hash', 'rules_hash', 'parser_hash']) {
    if (!SHA256.test(event[key])) throw new TypeError('journal_hash_invalid');
  }
  for (const key of ['safe_diagnostic_hash', 'output_shard_hash']) {
    if (event[key] !== null && !SHA256.test(event[key])) throw new TypeError('journal_hash_invalid');
  }
  if (!safeErrorCode(event.controlled_error_class)) throw new TypeError('journal_error_code_invalid');
  const identity = journalEventIdentity(event);
  const existing = journal.events.find((candidate) => candidate.event_identity === identity);
  if (existing) {
    const comparable = { ...event, sequence: existing.sequence, prior_event_hash: existing.prior_event_hash };
    const claimed = { ...existing };
    delete claimed.event_hash;
    delete claimed.event_identity;
    if (stableHash(comparable) !== stableHash(claimed)) throw new TypeError('journal_idempotency_conflict');
    return journal;
  }
  const eventHash = stableHash(event);
  return {
    ...journal,
    events: [...journal.events, { ...event, event_identity: identity, event_hash: eventHash }],
  };
}

export function validateJournal(journal) {
  const errors = [];
  if (!journal || journal.schema_version !== JOURNAL_SCHEMA || !Array.isArray(journal.events)) {
    return ['journal_envelope_invalid'];
  }
  if (!SHA256.test(journal.run_contract_hash ?? '') || !SHA256.test(journal.roster_root ?? '')) {
    errors.push('journal_header_input_invalid');
  }
  const expectedHeader = stableHash(journalHeader(journal));
  if (journal.journal_header_hash !== expectedHeader) errors.push('journal_header_hash_invalid');
  const identities = new Set();
  let previous = null;
  journal.events.forEach((event, index) => {
    if (event.sequence !== index) errors.push(`event_${index}:sequence_invalid`);
    if (event.prior_event_hash !== previous) errors.push(`event_${index}:chain_invalid`);
    if (event.journal_header_hash !== journal.journal_header_hash) {
      errors.push(`event_${index}:header_binding_invalid`);
    }
    const identity = journalEventIdentity(event);
    if (event.event_identity !== identity || identities.has(identity)) {
      errors.push(`event_${index}:identity_invalid_or_duplicate`);
    }
    identities.add(identity);
    const payload = { ...event };
    const claimed = payload.event_hash;
    delete payload.event_hash;
    delete payload.event_identity;
    if (!SHA256.test(claimed ?? '') || stableHash(payload) !== claimed) {
      errors.push(`event_${index}:hash_invalid`);
    }
    previous = claimed;
  });
  return errors;
}

function structuredBlocker(entry, evidenceBinding) {
  return {
    root_cause: requiredString(entry.blocker_root_cause, 'ledger_blocker_root_cause_required'),
    attempted_recovery_methods: Array.isArray(entry.recovery_methods) && entry.recovery_methods.length > 0
      ? [...new Set(entry.recovery_methods)] : (() => { throw new TypeError('ledger_recovery_required'); })(),
    alternate_safe_methods_exhausted: true,
    evidence_receipt_bindings: [evidenceBinding],
    resumable_next_step: requiredString(entry.resumable_next_step, 'ledger_resume_step_required'),
  };
}

function normalizePassReceipt(input, definition, artifactAlias) {
  const receipt = input ?? {};
  const status = receipt.status ?? 'NOT_STARTED';
  if (!VALID_PASS_STATES.has(status)) throw new TypeError('ledger_pass_status_invalid');
  if (receipt.pass_id !== undefined && receipt.pass_id !== definition.pass_id) {
    throw new TypeError('ledger_duplicate_or_misaligned_pass');
  }
  const complete = COMPLETE_PASS_STATES.has(status);
  const blocked = BLOCKED_PASS_STATES.has(status);
  const safeReceiptBinding = deterministicId(
    'receipt', artifactAlias, definition.pass_id, receipt.proposal_root ?? stableHash([]),
  );
  const blocker = blocked ? structuredBlocker({
    blocker_root_cause: receipt.blocker_root_cause ?? 'PASS_FAILED_WITH_PROVEN_BLOCKER',
    recovery_methods: receipt.recovery_methods ?? ['RESUME_FROM_LAST_VALID_CHECKPOINT'],
    resumable_next_step: receipt.resumable_next_step ?? `Resume ${definition.pass_id}.`,
  }, receipt.evidence_receipt_id ?? safeReceiptBinding) : null;
  return {
    pass_id: definition.pass_id,
    pass_name: definition.name,
    status: complete ? 'COMPLETE' : status,
    completion_scope: receipt.completion_scope ?? 'AUTOMATED_PASS_EXECUTION_COMPLETE',
    independent_verification_status: receipt.independent_verification_status
      ?? (['PASS_7', 'PASS_8'].includes(definition.pass_id)
        ? 'PENDING_SPECIALIST_REVIEW' : 'PENDING_INDEPENDENT_AUDIT'),
    attempt_count: Number(receipt.attempt_count ?? (status === 'NOT_STARTED' ? 0 : 1)),
    candidate_count: Number(receipt.proposals_emitted ?? receipt.candidate_count ?? 0),
    quarantine_count: Number(receipt.quarantine_count ?? 0),
    rejection_count: Number(receipt.rejection_count ?? 0),
    error_count: Number(receipt.error_count ?? 0),
    safe_receipt_binding: safeReceiptBinding,
    records_inspected: Number(receipt.records_inspected ?? 0),
    proposal_root: receipt.proposal_root ?? stableHash([]),
    specialist_verification_cell_root: receipt.specialist_verification_cell_root ?? null,
    specialist_verification_receipt_root: receipt.specialist_verification_receipt_root ?? null,
    finalization_input_root: receipt.finalization_input_root ?? null,
    blocker,
  };
}

function contentEnvelopeWithoutExtra(value) {
  return contentAddressedEnvelope(value);
}

function normalizeArtifactEntry(entry, rosterPosition) {
  const passInputs = new Map();
  for (const receipt of entry.pass_receipts ?? []) {
    if (!receipt?.pass_id || passInputs.has(receipt.pass_id)) {
      throw new TypeError('ledger_duplicate_or_misaligned_pass');
    }
    passInputs.set(receipt.pass_id, receipt);
  }
  const extractionPasses = PASS_DEFINITIONS.map((definition) => (
    normalizePassReceipt(passInputs.get(definition.pass_id), definition, entry.artifact_alias)
  ));
  const allComplete = extractionPasses.every((receipt) => receipt.status === 'COMPLETE');
  const hasBlockedPass = extractionPasses.some((receipt) => BLOCKED_PASS_STATES.has(receipt.status));
  const quarantineCount = Number(entry.quarantine_count ?? 0);
  const inferredStatus = allComplete
    ? (quarantineCount > 0 ? 'COMPLETE_WITH_QUARANTINE' : 'COMPLETE')
    : (hasBlockedPass ? 'PARTIAL_WITH_PROVEN_BLOCKER' : 'PARTIAL_WITH_PROVEN_BLOCKER');
  const finalStatus = entry.final_artifact_status ?? inferredStatus;
  if (!ARTIFACT_FINAL_STATES.includes(finalStatus)) throw new TypeError('ledger_final_state_invalid');
  if (['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(finalStatus) && !allComplete) {
    throw new TypeError('ledger_false_complete_state');
  }
  const evidenceBinding = entry.evidence_receipt_id
    ?? deterministicId('receipt', entry.artifact_alias, 'artifact-processing');
  const blocker = ['PARTIAL_WITH_PROVEN_BLOCKER', 'FAILED_WITH_PROVEN_BLOCKER'].includes(finalStatus)
    ? structuredBlocker(entry, evidenceBinding) : null;
  const nodesAvailable = entry.nodes_retrieval_status !== 'NOT_AVAILABLE'
    && (entry.nodes_record_count ?? 0) > 0;
  const specialistCells = extractionPasses.filter((receipt) => (
    ['PASS_7', 'PASS_8'].includes(receipt.pass_id)
      && receipt.independent_verification_status === 'VERIFIED'
      && SHA256.test(receipt.specialist_verification_cell_root ?? '')
  )).length;
  const pass9 = extractionPasses.find((receipt) => receipt.pass_id === 'PASS_9');
  const specialistReceiptRoot = entry.specialist_review_receipt_root
    ?? pass9?.specialist_verification_receipt_root ?? null;
  const pass9FinalizationRoot = entry.pass_9_finalization_root
    ?? pass9?.finalization_input_root ?? null;
  const specialistRoleReviewCount = Number(entry.specialist_role_review_count ?? 0);
  const independentStatus = entry.independent_verification_status ?? 'PENDING';
  const specialistVerified = specialistCells === 2
    && specialistRoleReviewCount === 4
    && SHA256.test(specialistReceiptRoot ?? '')
    && SHA256.test(pass9FinalizationRoot ?? '')
    && pass9?.independent_verification_status === 'VERIFIED';
  if (independentStatus === 'VERIFIED' && !specialistVerified) {
    throw new TypeError('ledger_false_independent_verification');
  }
  return contentEnvelopeWithoutExtra({
    roster_position: rosterPosition,
    source_alias: entry.source_alias,
    artifact_alias: entry.artifact_alias,
    transcript_retrieval_status: entry.transcript_retrieval_status ?? 'RETRIEVED',
    transcript_hash_status: entry.transcript_hash_status ?? 'VERIFIED',
    transcript_hash_binding: entry.transcript_hash_binding
      ?? stableHash(['transcript', entry.artifact_alias]),
    nodes_retrieval_status: nodesAvailable ? 'RETRIEVED' : 'NOT_AVAILABLE',
    nodes_hash_status: nodesAvailable ? 'VERIFIED' : 'NOT_AVAILABLE',
    nodes_hash_binding: nodesAvailable
      ? (entry.nodes_hash_binding ?? stableHash(['nodes', entry.source_alias])) : null,
    parser_selected: entry.parser_selected,
    parser_version: entry.parser_version ?? PARSER_VERSION,
    segment_count: Number(entry.segment_count ?? 0),
    nodes_record_count: nodesAvailable ? Number(entry.nodes_record_count) : null,
    extraction_passes: extractionPasses,
    speaker_classification_status: allComplete
      ? (quarantineCount > 0 ? 'COMPLETE_WITH_QUARANTINE' : 'COMPLETE') : 'PARTIAL_WITH_PROVEN_BLOCKER',
    medical_classification_status: allComplete
      ? (quarantineCount > 0 ? 'COMPLETE_WITH_QUARANTINE' : 'COMPLETE') : 'PARTIAL_WITH_PROVEN_BLOCKER',
    privacy_classification_status: allComplete
      ? (quarantineCount > 0 ? 'COMPLETE_WITH_QUARANTINE' : 'COMPLETE') : 'PARTIAL_WITH_PROVEN_BLOCKER',
    candidate_count: Number(entry.candidate_count ?? extractionPasses.find(
      (receipt) => receipt.pass_id === 'PASS_9',
    )?.candidate_count ?? 0),
    quarantine_count: quarantineCount,
    rejection_count: Number(entry.rejection_count ?? 0),
    parser_error_count: Number(entry.parser_error_count ?? 0),
    retry_count: Number(entry.retry_count ?? 0),
    final_artifact_status: finalStatus,
    independent_verification_status: independentStatus,
    specialist_verification_cell_count: specialistCells,
    specialist_role_review_count: specialistRoleReviewCount,
    specialist_review_receipt_root: specialistReceiptRoot,
    pass_9_finalization_root: pass9FinalizationRoot,
    blocker,
  });
}

export function buildArtifactLedger({ extractionRunId, artifactEntries, observedCohort = true }) {
  if (!Array.isArray(artifactEntries)) throw new TypeError('ledger_entries_invalid');
  const artifacts = [...artifactEntries]
    .sort((left, right) => left.source_alias.localeCompare(right.source_alias))
    .map((entry, index) => normalizeArtifactEntry(entry, index + 1));
  const completeCells = artifacts.reduce((sum, artifact) => sum + artifact.extraction_passes
    .filter((receipt) => receipt.status === 'COMPLETE').length, 0);
  const blockedCells = artifacts.reduce((sum, artifact) => sum + artifact.extraction_passes
    .filter((receipt) => BLOCKED_PASS_STATES.has(receipt.status)).length, 0);
  const expectedCells = observedCohort ? REQUIRED_PASS_CELL_COUNT : artifacts.length * PASS_DEFINITIONS.length;
  const stateCounts = Object.fromEntries(ARTIFACT_FINAL_STATES.map((state) => [
    state, artifacts.filter((artifact) => artifact.final_artifact_status === state).length,
  ]));
  const specialistCellCount = artifacts.reduce(
    (sum, artifact) => sum + artifact.specialist_verification_cell_count, 0,
  );
  const specialistRoleReviewCount = artifacts.reduce(
    (sum, artifact) => sum + artifact.specialist_role_review_count, 0,
  );
  const specialistReceiptRoots = artifacts.map(
    (artifact) => artifact.specialist_review_receipt_root,
  ).filter((root) => SHA256.test(root ?? ''));
  const specialistComplete = specialistCellCount === REQUIRED_SPECIALIST_VERIFICATION_CELL_COUNT
    && specialistRoleReviewCount === REQUIRED_SPECIALIST_ROLE_REVIEW_COUNT
    && specialistReceiptRoots.length === OBSERVED_TRANSCRIPT_COUNT
    && new Set(specialistReceiptRoots).size === OBSERVED_TRANSCRIPT_COUNT
    && artifacts.every((artifact) => artifact.independent_verification_status === 'VERIFIED');
  const automatedComplete = completeCells === expectedCells && blockedCells === 0;
  return contentAddressedEnvelope({
    schema_version: LEDGER_SCHEMA,
    extraction_run_id: extractionRunId,
    extraction_complete: automatedComplete && specialistComplete,
    predecessor_commit: PREDECESSOR_COMMIT,
    roster_receipt_binding: deterministicId(
      'receipt', extractionRunId, artifacts.map((artifact) => artifact.source_alias),
    ),
    observed_cohort_invariants: {
      invariant_basis: 'I1Q-1008D_VERIFIED_OBSERVED_COHORT',
      transcript_artifact_count: observedCohort ? OBSERVED_TRANSCRIPT_COUNT : artifacts.length,
      nodes_artifact_count: observedCohort ? OBSERVED_NODES_COUNT : artifacts.filter(
        (artifact) => artifact.nodes_retrieval_status === 'RETRIEVED',
      ).length,
      transcript_and_nodes_count: observedCohort ? OBSERVED_TRANSCRIPT_COUNT : artifacts.filter(
        (artifact) => artifact.nodes_retrieval_status === 'RETRIEVED',
      ).length,
      nodes_only_artifact_count: observedCohort ? 2 : 0,
      required_passes_per_transcript: PASS_DEFINITIONS.length,
      required_pass_cell_count: expectedCells,
    },
    processing_summary: {
      artifact_entry_count: artifacts.length,
      required_pass_cell_count: expectedCells,
      pass_cells_accounted_count: completeCells + blockedCells,
      pass_cells_complete_count: completeCells,
      pass_cells_with_proven_blocker_count: blockedCells,
      unaccounted_pass_cell_count: expectedCells - completeCells - blockedCells,
      artifact_final_state_counts: stateCounts,
      coverage_state: completeCells === expectedCells
        ? (stateCounts.COMPLETE_WITH_QUARANTINE > 0 ? 'COMPLETE_WITH_QUARANTINE' : 'COMPLETE')
        : 'PARTIAL_WITH_PROVEN_BLOCKER',
    },
    finalization_summary: {
      automated_pass_cell_count: completeCells,
      required_specialist_verification_cell_count: REQUIRED_SPECIALIST_VERIFICATION_CELL_COUNT,
      completed_specialist_verification_cell_count: specialistCellCount,
      required_specialist_role_review_count: REQUIRED_SPECIALIST_ROLE_REVIEW_COUNT,
      completed_specialist_role_review_count: specialistRoleReviewCount,
      verified_specialist_receipt_set_root: specialistComplete
        ? stableHash([...specialistReceiptRoots].sort()) : null,
      status: specialistComplete ? 'VERIFIED' : 'PENDING_SPECIALIST_REVIEW',
    },
    artifact_set_root: stableHash(artifacts.map((artifact) => ({
      artifact_alias: artifact.artifact_alias, content_hash: artifact.content_hash,
    }))),
    artifacts,
  });
}

function validatePassReceipt(receipt, definition) {
  return receipt
    && receipt.pass_id === definition.pass_id
    && receipt.pass_name === definition.name
    && receipt.status === 'COMPLETE'
    && receipt.completion_scope === 'AUTOMATED_PASS_EXECUTION_COMPLETE'
    && ['PENDING_SPECIALIST_REVIEW', 'PENDING_INDEPENDENT_AUDIT', 'VERIFIED'].includes(
      receipt.independent_verification_status,
    )
    && Number.isSafeInteger(receipt.attempt_count)
    && receipt.attempt_count >= 1
    && Number.isSafeInteger(receipt.records_inspected)
    && receipt.records_inspected >= 0
    && Number.isSafeInteger(receipt.candidate_count)
    && receipt.candidate_count >= 0
    && SHA256.test(receipt.proposal_root ?? '')
    && (receipt.specialist_verification_cell_root === null
      || SHA256.test(receipt.specialist_verification_cell_root ?? ''))
    && (receipt.specialist_verification_receipt_root === null
      || SHA256.test(receipt.specialist_verification_receipt_root ?? ''))
    && (receipt.finalization_input_root === null
      || SHA256.test(receipt.finalization_input_root ?? ''))
    && typeof receipt.safe_receipt_binding === 'string';
}

export function validateCoverage(ledger, {
  requireObservedCohort = false,
  requireFinalization = false,
} = {}) {
  const errors = [];
  if (!verifyContentAddressedEnvelope(ledger)) errors.push('ledger_content_hash_invalid');
  if (ledger?.schema_version !== LEDGER_SCHEMA || !Array.isArray(ledger?.artifacts)) {
    return { result: 'fail', errors: ['ledger_envelope_invalid'], metrics: null };
  }
  const expectedArtifacts = requireObservedCohort
    ? OBSERVED_TRANSCRIPT_COUNT : ledger.observed_cohort_invariants?.transcript_artifact_count;
  if (requireObservedCohort && ledger.predecessor_commit !== PREDECESSOR_COMMIT) {
    errors.push('predecessor_commit_mismatch');
  }
  if (ledger.artifacts.length !== expectedArtifacts) errors.push('transcript_artifact_denominator_mismatch');
  const expectedSetRoot = stableHash(ledger.artifacts.map((artifact) => ({
    artifact_alias: artifact.artifact_alias, content_hash: artifact.content_hash,
  })));
  if (ledger.artifact_set_root !== expectedSetRoot) errors.push('artifact_set_root_invalid');
  const seenSources = new Set();
  const seenArtifacts = new Set();
  let completePassCells = 0;
  let specialistVerificationCells = 0;
  let specialistRoleReviews = 0;
  for (const [index, artifact] of ledger.artifacts.entries()) {
    if (!verifyContentAddressedEnvelope(artifact)) errors.push(`artifact_${index}:content_hash_invalid`);
    if (!ALIAS.test(artifact.source_alias ?? '') || seenSources.has(artifact.source_alias)) {
      errors.push(`artifact_${index}:source_alias_invalid_or_duplicate`);
    }
    if (!ALIAS.test(artifact.artifact_alias ?? '') || seenArtifacts.has(artifact.artifact_alias)) {
      errors.push(`artifact_${index}:artifact_alias_invalid_or_duplicate`);
    }
    seenSources.add(artifact.source_alias);
    seenArtifacts.add(artifact.artifact_alias);
    if (!ARTIFACT_FINAL_STATES.includes(artifact.final_artifact_status)) {
      errors.push(`artifact_${index}:final_state_invalid`);
    }
    if (!Array.isArray(artifact.extraction_passes) || artifact.extraction_passes.length !== 9) {
      errors.push(`artifact_${index}:pass_count_invalid`);
      continue;
    }
    const seenPasses = new Set();
    for (const definition of PASS_DEFINITIONS) {
      const receipts = artifact.extraction_passes.filter((item) => item.pass_id === definition.pass_id);
      if (receipts.length !== 1 || seenPasses.has(definition.pass_id)
          || !validatePassReceipt(receipts[0], definition)) {
        errors.push(`artifact_${index}:${definition.pass_id}:incomplete_or_duplicate`);
      } else {
        completePassCells += 1;
        seenPasses.add(definition.pass_id);
      }
    }
    const completeArtifact = completePassCells >= (index + 1) * PASS_DEFINITIONS.length;
    if (['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(artifact.final_artifact_status)
        && !completeArtifact) errors.push(`artifact_${index}:false_complete_state`);
    if (['PARTIAL_WITH_PROVEN_BLOCKER', 'FAILED_WITH_PROVEN_BLOCKER'].includes(
      artifact.final_artifact_status,
    ) && (!artifact.blocker || artifact.blocker.attempted_recovery_methods.length === 0
      || artifact.blocker.alternate_safe_methods_exhausted !== true
      || artifact.blocker.evidence_receipt_bindings.length === 0
      || !artifact.blocker.resumable_next_step)) {
      errors.push(`artifact_${index}:blocker_evidence_incomplete`);
    }
    const pass7 = artifact.extraction_passes.find((receipt) => receipt.pass_id === 'PASS_7');
    const pass8 = artifact.extraction_passes.find((receipt) => receipt.pass_id === 'PASS_8');
    const pass9 = artifact.extraction_passes.find((receipt) => receipt.pass_id === 'PASS_9');
    const verifiedCells = [pass7, pass8].filter((receipt) => (
      receipt?.independent_verification_status === 'VERIFIED'
        && SHA256.test(receipt.specialist_verification_cell_root ?? '')
    )).length;
    specialistVerificationCells += verifiedCells;
    specialistRoleReviews += Number(artifact.specialist_role_review_count ?? 0);
    const artifactSpecialistVerified = verifiedCells === 2
      && artifact.specialist_verification_cell_count === 2
      && artifact.specialist_role_review_count === 4
      && artifact.independent_verification_status === 'VERIFIED'
      && pass9?.independent_verification_status === 'VERIFIED'
      && SHA256.test(artifact.specialist_review_receipt_root ?? '')
      && pass9?.specialist_verification_receipt_root === artifact.specialist_review_receipt_root
      && SHA256.test(artifact.pass_9_finalization_root ?? '')
      && pass9?.finalization_input_root === artifact.pass_9_finalization_root;
    if (artifact.independent_verification_status === 'VERIFIED' && !artifactSpecialistVerified) {
      errors.push(`artifact_${index}:false_specialist_verification`);
    }
  }
  const expectedCells = expectedArtifacts * PASS_DEFINITIONS.length;
  if (completePassCells !== expectedCells) errors.push('pass_cell_denominator_mismatch');
  if (ledger.processing_summary?.pass_cells_complete_count !== completePassCells
      || ledger.processing_summary?.required_pass_cell_count !== expectedCells) {
    errors.push('processing_summary_mismatch');
  }
  const requiredSpecialistCells = expectedArtifacts * 2;
  const requiredRoleReviews = expectedArtifacts * 4;
  const specialistRoots = ledger.artifacts.map(
    (artifact) => artifact.specialist_review_receipt_root,
  ).filter((root) => SHA256.test(root ?? ''));
  const finalizationComplete = specialistVerificationCells === requiredSpecialistCells
    && specialistRoleReviews === requiredRoleReviews
    && specialistRoots.length === expectedArtifacts
    && new Set(specialistRoots).size === expectedArtifacts
    && ledger.artifacts.every((artifact) => artifact.independent_verification_status === 'VERIFIED');
  const expectedReceiptSetRoot = finalizationComplete
    ? stableHash([...specialistRoots].sort()) : null;
  if (ledger.finalization_summary?.automated_pass_cell_count !== completePassCells
      || ledger.finalization_summary?.required_specialist_verification_cell_count
        !== requiredSpecialistCells
      || ledger.finalization_summary?.completed_specialist_verification_cell_count
        !== specialistVerificationCells
      || ledger.finalization_summary?.required_specialist_role_review_count
        !== requiredRoleReviews
      || ledger.finalization_summary?.completed_specialist_role_review_count
        !== specialistRoleReviews
      || ledger.finalization_summary?.verified_specialist_receipt_set_root
        !== expectedReceiptSetRoot
      || ledger.finalization_summary?.status
        !== (finalizationComplete ? 'VERIFIED' : 'PENDING_SPECIALIST_REVIEW')) {
    errors.push('finalization_summary_mismatch');
  }
  const expectedExtractionComplete = completePassCells === expectedCells && finalizationComplete;
  if (ledger.extraction_complete !== expectedExtractionComplete) {
    errors.push('false_extraction_complete_state');
  }
  if (requireFinalization && !expectedExtractionComplete) errors.push('specialist_finalization_pending');
  return {
    result: errors.length === 0 ? 'pass' : 'fail',
    errors,
    metrics: {
      artifact_count: ledger.artifacts.length,
      pass_count: PASS_DEFINITIONS.length,
      complete_pass_cells: completePassCells,
      expected_pass_cells: expectedCells,
      specialist_verification_cells: specialistVerificationCells,
      expected_specialist_verification_cells: requiredSpecialistCells,
      specialist_role_reviews: specialistRoleReviews,
      expected_specialist_role_reviews: requiredRoleReviews,
      extraction_complete: expectedExtractionComplete,
    },
  };
}

export function journalDeterminismRoot(journal) {
  if (validateJournal(journal).length > 0) throw new TypeError('journal_invalid');
  return stableHash({
    journal_header_hash: journal.journal_header_hash,
    events: journal.events.map((event) => ({
      event_identity: event.event_identity,
      event_hash: event.event_hash,
    })),
  });
}

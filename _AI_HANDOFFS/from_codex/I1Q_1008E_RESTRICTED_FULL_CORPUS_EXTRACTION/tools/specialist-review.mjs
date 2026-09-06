#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentAddressedEnvelope,
  stableHash,
  verifyContentAddressedEnvelope,
} from './canonical.mjs';

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKTREE_ROOT_FROM_MODULE = resolve(MODULE_ROOT, '../../..');
const SHA256 = /^[a-f0-9]{64}$/u;
const REVIEWER_ID = /^reviewer_[A-Za-z0-9_-]{8,128}$/u;
const PACKET_SCHEMA = 'missionmed.i1q1008e.restricted_specialist_review_packet.v1';
const ROLE_RECEIPT_SCHEMA = 'missionmed.i1q1008e.restricted_specialist_role_review.v1';
const CELL_SCHEMA = 'missionmed.i1q1008e.restricted_specialist_verification_cell.v1';
const FINALIZATION_SCHEMA = 'missionmed.i1q1008e.restricted_pass9_finalization_binding.v1';
export const SPECIALIST_REVIEW_RECEIPT_SCHEMA =
  'missionmed.i1q1008e.restricted_specialist_review_receipt.v1';
export const SPECIALIST_FINALIZER_AUTHORITY_SCHEMA =
  'missionmed.i1q1008e.restricted_specialist_finalizer_authority_binding.v1';

export const SPECIALIST_ROLE_CONTRACT = Object.freeze({
  OSLER: Object.freeze({
    pass_id: 'PASS_7',
    authority_scope: 'MEDICAL_CONTENT_RISK_REVIEW_NO_RELEASE_AUTHORITY',
  }),
  ASSESSMENT_SCIENCE: Object.freeze({
    pass_id: 'PASS_7',
    authority_scope: 'ASSESSMENT_SCIENCE_REVIEW_NO_FINAL_APPROVAL_AUTHORITY',
  }),
  TURING: Object.freeze({
    pass_id: 'PASS_8',
    authority_scope: 'DETERMINISTIC_PIPELINE_REVIEW_NO_RELEASE_AUTHORITY',
  }),
  ENGINEERING: Object.freeze({
    pass_id: 'PASS_8',
    authority_scope: 'ENGINEERING_INTEGRITY_REVIEW_NO_RELEASE_AUTHORITY',
  }),
});

const REQUIRED_ROLES = Object.freeze(Object.keys(SPECIALIST_ROLE_CONTRACT));
const FINALIZER_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'combined_submission_root', 'role_batch_roots',
  'role_evidence_roots', 'packet_set_root', 'finalizer_contract_root',
]);
const FINAL_DISPOSITIONS = new Set(['VERIFIED_NO_BLOCKER', 'VERIFIED_WITH_FINDINGS']);
const ALL_DISPOSITIONS = new Set([
  ...FINAL_DISPOSITIONS,
  'FAILED_WITH_PROVEN_BLOCKER',
  'PENDING',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function requireHash(value, code) {
  if (!SHA256.test(value ?? '')) throw new TypeError(code);
  return value;
}

function requireString(value, code) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(code);
  return value;
}

function passRoot(packet, passId) {
  const root = packet.automated_pass_roots?.[passId];
  return requireHash(root, 'specialist_packet_pass_root_invalid');
}

function finalDisposition(dispositions) {
  if (dispositions.includes('FAILED_WITH_PROVEN_BLOCKER')) return 'FAILED_WITH_PROVEN_BLOCKER';
  if (dispositions.includes('PENDING')) return 'PENDING';
  if (dispositions.includes('VERIFIED_WITH_FINDINGS')) return 'VERIFIED_WITH_FINDINGS';
  return 'VERIFIED_NO_BLOCKER';
}

function normalizeFindings(findings) {
  if (!Array.isArray(findings)) throw new TypeError('specialist_findings_invalid');
  return structuredClone(findings);
}

function containsBlockerFinding(findings) {
  return findings.some((finding) => (
    finding?.severity === 'BLOCKER' || finding?.disposition === 'BLOCKER'
  ));
}

function validateFinalizerAuthorityBinding(binding) {
  if (!exactKeys(binding, FINALIZER_AUTHORITY_KEYS)
      || binding.schema_version !== SPECIALIST_FINALIZER_AUTHORITY_SCHEMA
      || !SHA256.test(binding.combined_submission_root ?? '')
      || !SHA256.test(binding.packet_set_root ?? '')
      || !SHA256.test(binding.finalizer_contract_root ?? '')
      || !exactKeys(binding.role_batch_roots, REQUIRED_ROLES)
      || !exactKeys(binding.role_evidence_roots, REQUIRED_ROLES)
      || !Object.values(binding.role_batch_roots).every((root) => SHA256.test(root ?? ''))
      || !Object.values(binding.role_evidence_roots).every((root) => SHA256.test(root ?? ''))) {
    throw new TypeError('specialist_finalizer_authority_binding_invalid');
  }
  return structuredClone(binding);
}

export function buildSpecialistReviewPacket({
  extractionRunId,
  runContractHash,
  sourceAlias,
  artifactAlias,
  transcriptHash,
  nodesHash,
  occurrenceShardHash,
  passShardHash,
  processingReceiptHash,
  passReceipts,
}) {
  const roots = Object.fromEntries(['PASS_7', 'PASS_8', 'PASS_9'].map((passId) => {
    const matches = (passReceipts ?? []).filter((receipt) => receipt.pass_id === passId);
    if (matches.length !== 1) throw new TypeError('specialist_packet_pass_receipt_invalid');
    return [passId, requireHash(matches[0].proposal_root, 'specialist_packet_pass_root_invalid')];
  }));
  for (const value of [runContractHash, transcriptHash, occurrenceShardHash, passShardHash,
    processingReceiptHash]) requireHash(value, 'specialist_packet_input_hash_invalid');
  if (nodesHash !== null) requireHash(nodesHash, 'specialist_packet_input_hash_invalid');
  const artifactInputRoot = stableHash({
    transcript_hash: transcriptHash,
    nodes_hash: nodesHash,
    occurrence_shard_hash: occurrenceShardHash,
    pass_shard_hash: passShardHash,
    processing_receipt_hash: processingReceiptHash,
  });
  return contentAddressedEnvelope({
    schema_version: PACKET_SCHEMA,
    extraction_run_id: requireString(extractionRunId, 'specialist_packet_run_invalid'),
    run_contract_hash: runContractHash,
    source_alias: requireString(sourceAlias, 'specialist_packet_source_invalid'),
    artifact_alias: requireString(artifactAlias, 'specialist_packet_artifact_invalid'),
    artifact_input_root: artifactInputRoot,
    automated_pass_roots: roots,
    required_role_contract: SPECIALIST_ROLE_CONTRACT,
    specialist_verification_cell_denominator: 2,
    specialist_role_review_denominator: 4,
    release_or_final_approval_authority: false,
  });
}

function pass7InputRoot(packet) {
  return stableHash({
    review_packet_root: packet.content_hash,
    artifact_input_root: packet.artifact_input_root,
    pass_id: 'PASS_7',
    automated_proposal_root: passRoot(packet, 'PASS_7'),
  });
}

function pass8InputRoot(packet, pass7Cell) {
  return stableHash({
    review_packet_root: packet.content_hash,
    artifact_input_root: packet.artifact_input_root,
    pass_id: 'PASS_8',
    automated_proposal_root: passRoot(packet, 'PASS_8'),
    pass_7_verification_cell_root: pass7Cell.content_hash,
    pass_7_findings_root: pass7Cell.findings_root,
  });
}

function buildRoleReceipt(packet, submission, inputRoot) {
  const contract = SPECIALIST_ROLE_CONTRACT[submission?.specialist_role];
  if (!contract) throw new TypeError('specialist_role_invalid');
  if (!REVIEWER_ID.test(submission.reviewer_instance_id ?? '')) {
    throw new TypeError('specialist_reviewer_identity_invalid');
  }
  if (!ALL_DISPOSITIONS.has(submission.disposition)) {
    throw new TypeError('specialist_disposition_invalid');
  }
  const findings = normalizeFindings(submission.findings);
  const disposition = containsBlockerFinding(findings)
    ? 'FAILED_WITH_PROVEN_BLOCKER' : submission.disposition;
  return contentAddressedEnvelope({
    schema_version: ROLE_RECEIPT_SCHEMA,
    extraction_run_id: packet.extraction_run_id,
    run_contract_hash: packet.run_contract_hash,
    source_alias: packet.source_alias,
    artifact_alias: packet.artifact_alias,
    review_packet_root: packet.content_hash,
    artifact_input_root: packet.artifact_input_root,
    pass_id: contract.pass_id,
    specialist_role: submission.specialist_role,
    reviewer_instance_id: submission.reviewer_instance_id,
    authority_scope: contract.authority_scope,
    review_input_root: inputRoot,
    findings,
    findings_root: stableHash(findings),
    disposition,
    no_release_or_final_approval_authority: true,
  });
}

function buildVerificationCell(packet, passId, inputRoot, roleReceipts) {
  const expectedRoles = REQUIRED_ROLES.filter(
    (role) => SPECIALIST_ROLE_CONTRACT[role].pass_id === passId,
  );
  const byRole = new Map(roleReceipts.map((receipt) => [receipt.specialist_role, receipt]));
  if (byRole.size !== expectedRoles.length || expectedRoles.some((role) => !byRole.has(role))) {
    throw new TypeError('specialist_cell_roles_invalid');
  }
  const ordered = expectedRoles.map((role) => byRole.get(role));
  const findingsRoot = stableHash(ordered.map((receipt) => ({
    specialist_role: receipt.specialist_role,
    findings_root: receipt.findings_root,
    disposition: receipt.disposition,
  })));
  return contentAddressedEnvelope({
    schema_version: CELL_SCHEMA,
    extraction_run_id: packet.extraction_run_id,
    run_contract_hash: packet.run_contract_hash,
    source_alias: packet.source_alias,
    artifact_alias: packet.artifact_alias,
    review_packet_root: packet.content_hash,
    pass_id: passId,
    automated_proposal_root: passRoot(packet, passId),
    specialist_input_root: inputRoot,
    required_roles: expectedRoles,
    role_receipt_roots: ordered.map((receipt) => receipt.content_hash),
    findings_root: findingsRoot,
    disposition: finalDisposition(ordered.map((receipt) => receipt.disposition)),
  });
}

export function buildSpecialistReviewReceipt(packet, submissions, authorityBinding) {
  if (!verifyContentAddressedEnvelope(packet) || packet.schema_version !== PACKET_SCHEMA) {
    throw new TypeError('specialist_packet_invalid');
  }
  if (!Array.isArray(submissions) || submissions.length !== REQUIRED_ROLES.length) {
    throw new TypeError('specialist_submission_count_invalid');
  }
  const submissionByRole = new Map();
  const reviewers = new Set();
  for (const submission of submissions) {
    if (!SPECIALIST_ROLE_CONTRACT[submission?.specialist_role]
        || submissionByRole.has(submission.specialist_role)) {
      throw new TypeError('specialist_submission_roles_invalid');
    }
    if (!REVIEWER_ID.test(submission.reviewer_instance_id ?? '')
        || reviewers.has(submission.reviewer_instance_id)) {
      throw new TypeError('specialist_reviewer_identity_not_distinct');
    }
    reviewers.add(submission.reviewer_instance_id);
    submissionByRole.set(submission.specialist_role, submission);
  }
  const finalizerAuthorityBinding = validateFinalizerAuthorityBinding(authorityBinding);
  const p7Input = pass7InputRoot(packet);
  const p7Roles = ['OSLER', 'ASSESSMENT_SCIENCE'].map((role) => (
    buildRoleReceipt(packet, submissionByRole.get(role), p7Input)
  ));
  const pass7Cell = buildVerificationCell(packet, 'PASS_7', p7Input, p7Roles);
  const p8Input = pass8InputRoot(packet, pass7Cell);
  const p8Roles = ['TURING', 'ENGINEERING'].map((role) => (
    buildRoleReceipt(packet, submissionByRole.get(role), p8Input)
  ));
  const pass8Cell = buildVerificationCell(packet, 'PASS_8', p8Input, p8Roles);
  const allRoleReceipts = [...p7Roles, ...p8Roles];
  const pass9InputRoot = stableHash({
    review_packet_root: packet.content_hash,
    artifact_input_root: packet.artifact_input_root,
    pass_id: 'PASS_9',
    automated_proposal_root: passRoot(packet, 'PASS_9'),
    pass_7_verification_cell_root: pass7Cell.content_hash,
    pass_8_verification_cell_root: pass8Cell.content_hash,
    pass_7_findings_root: pass7Cell.findings_root,
    pass_8_findings_root: pass8Cell.findings_root,
  });
  const disposition = finalDisposition(allRoleReceipts.map((receipt) => receipt.disposition));
  const pass9Finalization = contentAddressedEnvelope({
    schema_version: FINALIZATION_SCHEMA,
    extraction_run_id: packet.extraction_run_id,
    run_contract_hash: packet.run_contract_hash,
    source_alias: packet.source_alias,
    artifact_alias: packet.artifact_alias,
    review_packet_root: packet.content_hash,
    pass_id: 'PASS_9',
    automated_proposal_root: passRoot(packet, 'PASS_9'),
    pass_7_verification_cell_root: pass7Cell.content_hash,
    pass_8_verification_cell_root: pass8Cell.content_hash,
    specialist_findings_root: stableHash([
      pass7Cell.findings_root,
      pass8Cell.findings_root,
    ]),
    finalization_input_root: pass9InputRoot,
    disposition,
    release_or_final_approval_performed: false,
  });
  return contentAddressedEnvelope({
    schema_version: SPECIALIST_REVIEW_RECEIPT_SCHEMA,
    extraction_run_id: packet.extraction_run_id,
    run_contract_hash: packet.run_contract_hash,
    source_alias: packet.source_alias,
    artifact_alias: packet.artifact_alias,
    review_packet_root: packet.content_hash,
    artifact_input_root: packet.artifact_input_root,
    finalizer_authority_binding: finalizerAuthorityBinding,
    role_reviews: allRoleReceipts,
    pass_7_verification_cell: pass7Cell,
    pass_8_verification_cell: pass8Cell,
    pass_9_finalization_binding: pass9Finalization,
    specialist_verification_cell_count: 2,
    specialist_role_review_count: 4,
    disposition,
    no_release_or_final_approval_authority: true,
  });
}

function comparableRoleSubmission(receipt) {
  return {
    specialist_role: receipt.specialist_role,
    reviewer_instance_id: receipt.reviewer_instance_id,
    findings: receipt.findings,
    disposition: receipt.disposition,
  };
}

export function validateSpecialistReviewReceipt(receipt, packet, {
  requireFinal = true,
  expectedAuthorityBinding = null,
} = {}) {
  const errors = [];
  if (!verifyContentAddressedEnvelope(packet) || packet?.schema_version !== PACKET_SCHEMA) {
    return { valid: false, errors: ['review_packet_invalid'] };
  }
  if (!verifyContentAddressedEnvelope(receipt)
      || receipt?.schema_version !== SPECIALIST_REVIEW_RECEIPT_SCHEMA) {
    return { valid: false, errors: ['review_receipt_envelope_invalid'] };
  }
  const expectedBindings = [
    ['extraction_run_id', packet.extraction_run_id],
    ['run_contract_hash', packet.run_contract_hash],
    ['source_alias', packet.source_alias],
    ['artifact_alias', packet.artifact_alias],
    ['review_packet_root', packet.content_hash],
    ['artifact_input_root', packet.artifact_input_root],
  ];
  for (const [key, expected] of expectedBindings) {
    if (receipt[key] !== expected) errors.push(`${key}_binding_mismatch`);
  }
  let receiptAuthorityBinding;
  try {
    receiptAuthorityBinding = validateFinalizerAuthorityBinding(
      receipt.finalizer_authority_binding,
    );
  } catch {
    errors.push('finalizer_authority_binding_invalid');
  }
  if (expectedAuthorityBinding === null) {
    errors.push('finalizer_authority_binding_not_authoritatively_supplied');
  } else {
    try {
      const expected = validateFinalizerAuthorityBinding(expectedAuthorityBinding);
      if (stableHash(expected) !== stableHash(receiptAuthorityBinding)) {
        errors.push('finalizer_authority_binding_mismatch');
      }
    } catch {
      errors.push('expected_finalizer_authority_binding_invalid');
    }
  }
  if (!Array.isArray(receipt.role_reviews) || receipt.role_reviews.length !== 4) {
    errors.push('role_review_count_invalid');
    return { valid: false, errors };
  }
  const reviewers = receipt.role_reviews.map((item) => item.reviewer_instance_id);
  if (new Set(reviewers).size !== 4) errors.push('reviewer_identity_not_distinct');
  let rebuilt;
  try {
    rebuilt = buildSpecialistReviewReceipt(
      packet,
      receipt.role_reviews.map(comparableRoleSubmission),
      receiptAuthorityBinding,
    );
  } catch (error) {
    errors.push(error?.message ?? 'review_receipt_rebuild_failed');
    return { valid: false, errors: [...new Set(errors)].sort() };
  }
  if (stableHash(rebuilt) !== stableHash(receipt)) errors.push('review_receipt_binding_mismatch');
  for (const role of receipt.role_reviews) {
    if (!verifyContentAddressedEnvelope(role)) errors.push('role_receipt_hash_invalid');
    if (role.findings_root !== stableHash(role.findings)) errors.push('findings_root_invalid');
    const contract = SPECIALIST_ROLE_CONTRACT[role.specialist_role];
    if (!contract || role.pass_id !== contract.pass_id
        || role.authority_scope !== contract.authority_scope) errors.push('role_authority_invalid');
    if (containsBlockerFinding(role.findings ?? [])
        && role.disposition !== 'FAILED_WITH_PROVEN_BLOCKER') {
      errors.push('blocker_finding_disposition_mismatch');
    }
    if (requireFinal && !FINAL_DISPOSITIONS.has(role.disposition)) {
      errors.push('role_disposition_not_final');
    }
  }
  for (const cell of [receipt.pass_7_verification_cell, receipt.pass_8_verification_cell]) {
    if (!verifyContentAddressedEnvelope(cell)) errors.push('verification_cell_hash_invalid');
    if (requireFinal && !FINAL_DISPOSITIONS.has(cell?.disposition)) {
      errors.push('verification_cell_not_final');
    }
  }
  if (!verifyContentAddressedEnvelope(receipt.pass_9_finalization_binding)) {
    errors.push('pass9_finalization_hash_invalid');
  }
  if (requireFinal && !FINAL_DISPOSITIONS.has(receipt.disposition)) {
    errors.push('receipt_disposition_not_final');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (raw === '--dry-run' || raw === '--self-test') options.dryRun = true;
    else if (raw === '--help' || raw === '-h') options.help = true;
    else throw new TypeError('specialist_argument_rejected');
  }
  return options;
}

function syntheticSubmissions(disposition = 'VERIFIED_NO_BLOCKER') {
  return REQUIRED_ROLES.map((specialistRole, index) => ({
    specialist_role: specialistRole,
    reviewer_instance_id: `reviewer_fixture_${String(index + 1).padStart(4, '0')}`,
    findings: [],
    disposition,
  }));
}

function syntheticPacket() {
  return buildSpecialistReviewPacket({
    extractionRunId: 'run_fixture_0001',
    runContractHash: 'a'.repeat(64),
    sourceAlias: 'source_fixture_0001',
    artifactAlias: 'artifact_fixture_0001',
    transcriptHash: 'b'.repeat(64),
    nodesHash: 'c'.repeat(64),
    occurrenceShardHash: 'd'.repeat(64),
    passShardHash: 'e'.repeat(64),
    processingReceiptHash: 'f'.repeat(64),
    passReceipts: ['PASS_7', 'PASS_8', 'PASS_9'].map((passId, index) => ({
      pass_id: passId, proposal_root: String(index + 1).repeat(64),
    })),
  });
}

function syntheticAuthorityBinding() {
  return {
    schema_version: SPECIALIST_FINALIZER_AUTHORITY_SCHEMA,
    combined_submission_root: '4'.repeat(64),
    role_batch_roots: Object.fromEntries(REQUIRED_ROLES.map((role, index) => [
      role, String(index + 5).repeat(64),
    ])),
    role_evidence_roots: Object.fromEntries(REQUIRED_ROLES.map((role, index) => [
      role, String.fromCharCode(97 + index).repeat(64),
    ])),
    packet_set_root: '1'.repeat(64),
    finalizer_contract_root: '2'.repeat(64),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write([
      'I1Q-1008E specialist review receipt assembler',
      'Usage: node tools/specialist-review.mjs --dry-run',
      'Live assembly is disabled. Use finalize-specialist-role-batches.mjs exclusively.',
    ].join('\n') + '\n');
    return;
  }
  if (options.dryRun) {
    const packet = syntheticPacket();
    const authorityBinding = syntheticAuthorityBinding();
    const receipt = buildSpecialistReviewReceipt(
      packet, syntheticSubmissions(), authorityBinding,
    );
    const validation = validateSpecialistReviewReceipt(receipt, packet, {
      requireFinal: true,
      expectedAuthorityBinding: authorityBinding,
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'dry_run', result: validation.valid ? 'pass' : 'fail',
      network_requests: 0, file_writes: 0,
      specialist_verification_cell_count: receipt.specialist_verification_cell_count,
      specialist_role_review_count: receipt.specialist_role_review_count,
    })}\n`);
    if (!validation.valid) process.exitCode = 1;
    return;
  }
  throw new TypeError('specialist_live_assembly_disabled');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    process.stderr.write(`${JSON.stringify({ result: 'fail', error_code: 'specialist_review_rejected' })}\n`);
    process.exitCode = 1;
  });
}

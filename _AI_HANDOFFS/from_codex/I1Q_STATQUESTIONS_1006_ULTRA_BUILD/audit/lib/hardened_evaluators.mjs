import crypto from 'node:crypto';
import path from 'node:path';

export const AUDIT_DATE = '2026-07-13';

export const REQUIRED_PRIVACY_CLASSES = Object.freeze([
  'address_like',
  'email',
  'patient_identifier',
  'student_name',
  'third_party_name'
]);

const ENTITY_SPECS = Object.freeze([
  ['taxonomy_versions', 'taxv_id', /^taxv_[a-z0-9_]+$/],
  ['blueprint_versions', 'bpv_id', /^bpv_[a-z0-9_]+$/],
  ['misconception_vocabulary_versions', 'mvv_id', /^mvv_[a-z0-9_]+$/],
  ['channel_security_policies', 'csp_id', /^csp_[a-z0-9_]+$/],
  ['concepts', 'concept_id', /^concept_[a-z0-9_]+$/],
  ['variant_groups', 'vg_id', /^vg_[a-z0-9_]+$/],
  ['items', 'item_id', /^item_[a-z0-9_]+$/],
  ['item_revisions', 'itemrev_id', /^itemrev_[a-z0-9_]+$/],
  ['evidence_claims', 'claim_id', /^claim_[a-z0-9_]+$/],
  ['source_records', 'src_id', /^src_[a-z0-9_]+$/],
  ['extraction_runs', 'extract_id', /^extract_[a-z0-9_]+$/],
  ['model_prompt_versions', 'mpv_id', /^mpv_[a-z0-9_]+$/],
  ['rights_records', 'rights_id', /^rights_[a-z0-9_]+$/],
  ['privacy_redaction_records', 'redact_id', /^redact_[a-z0-9_]+$/],
  ['reviewers', 'reviewer_id', /^reviewer_[a-z0-9_]+$/],
  ['review_assignments', 'assign_id', /^assign_[a-z0-9_]+$/],
  ['review_events', 'rev_id', /^rev_[a-z0-9_]+$/],
  ['reviewer_calibration_records', 'calib_id', /^calib_[a-z0-9_]+$/],
  ['incident_records', 'incident_id', /^incident_[a-z0-9_]+$/],
  ['release_snapshots', 'release_id', /^release_[a-z0-9_]+$/],
  ['release_promotion_records', 'promo_id', /^promo_[a-z0-9_]+$/],
  ['channel_artifacts', 'artifact_id', /^artifact_[a-z0-9_]+$/],
  ['psychometric_snapshots', 'psych_id', /^psych_[a-z0-9_]+$/]
]);

const PRE_ANSWER_SECRET_KEYS = new Set([
  'answer',
  'answers',
  'canonicalchoice',
  'correctchoice',
  'correctness',
  'correctoption',
  'expectedresponse',
  'goldchoice',
  'gradingkey',
  'iscorrect',
  'keyedresponse',
  'scoringkey',
  'solution',
  'solutionkey',
  'target',
  'targetchoice',
  'truthvalue'
]);

const PRE_ANSWER_ORDER_KEYS = new Set([
  'answerorder',
  'answerposition',
  'canonicalorder',
  'correctfirst',
  'correctindex',
  'correctrank',
  'displayrank',
  'keyorder',
  'solutionorder',
  'solutionrank',
  'sortpriority'
]);

const DEBUG_KEYS = new Set([
  'debug',
  'debugdata',
  'debugpayload',
  'diagnostics',
  'internalstate',
  'requestdump',
  'stack',
  'stacktrace',
  'trace'
]);

const RAW_SOURCE_KEYS = new Set([
  'rawsource',
  'rawtranscript',
  'unredacted',
  'unscrubbed'
]);

const ARTIFACT_PATHS = Object.freeze({
  dataset: 'artifacts/stat/dataset_questions.json',
  runtime: 'artifacts/stat/stat_runtime_json.pre_answer.json',
  debrief: 'artifacts/stat/stat_post_answer_debrief.post_answer.json',
  metadata: 'artifacts/question_metadata/question_metadata.internal.json',
  drillsPre: 'artifacts/drills/drills.pre_answer.json',
  drillsPost: 'artifacts/drills/drills.post_answer.json'
});

function addError(errors, code, errorPath, message, details = undefined) {
  const row = { code, path: errorPath, message };
  if (details !== undefined) row.details = details;
  errors.push(row);
}

function dedupeErrors(errors) {
  const seen = new Set();
  return errors.filter((row) => {
    const key = `${row.code}\u0000${row.path}\u0000${row.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function canonicalJson(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hashObject(value) {
  return sha256(canonicalJson(value));
}

function normalizeKey(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function compactPrivacy(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function walk(value, visitor, currentPath = '', keyHint = '') {
  visitor(value, currentPath, keyHint);
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, visitor, `${currentPath}[${index}]`, keyHint));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      walk(child, visitor, childPath, key);
    }
  }
}

function collectStrings(value) {
  const rows = [];
  walk(value, (child, childPath) => {
    if (typeof child === 'string') rows.push({ path: childPath, value: child });
  });
  return rows;
}

function entityMap(world, collection, field) {
  return new Map((world[collection] || []).map((row) => [row[field], row]));
}

function entitySet(world, collection, field) {
  return new Set((world[collection] || []).map((row) => row[field]));
}

function checkReference(errors, value, validValues, errorPath, label) {
  if (typeof value !== 'string' || !validValues.has(value)) {
    addError(errors, 'A_MALFORMED_REFERENCE', errorPath, `${label} does not resolve.`, { value });
  }
}

function checkReferences(errors, values, validValues, errorPath, label) {
  if (!Array.isArray(values)) {
    addError(errors, 'A_MALFORMED_REFERENCE', errorPath, `${label} must be an array.`);
    return;
  }
  values.forEach((value, index) => checkReference(errors, value, validValues, `${errorPath}[${index}]`, label));
}

function isIdentityKey(keyHint) {
  const key = normalizeKey(keyHint);
  return key === 'id'
    || key.endsWith('id')
    || key.endsWith('ids')
    || key === 'choicekey'
    || key === 'claimverifications'
    || key === 'completedrevid'
    || key === 'outputids';
}

function auditIdentifiers(world, artifacts, errors) {
  for (const [collection, field, pattern] of ENTITY_SPECS) {
    const exactSeen = new Set();
    const normalizedSeen = new Map();
    for (const [index, row] of (world[collection] || []).entries()) {
      const value = row[field];
      const errorPath = `${collection}[${index}].${field}`;
      if (typeof value !== 'string') {
        addError(errors, 'A_ID_TYPE', errorPath, 'Identifier must be a string.');
        continue;
      }
      if (value !== value.normalize('NFKC') || !/^[\x20-\x7e]+$/.test(value)) {
        addError(errors, 'A_IDENTIFIER_UNICODE', errorPath, 'Identifier must be ASCII and NFKC-stable.', { value });
      }
      if (!pattern.test(value)) addError(errors, 'A_ID_PATTERN', errorPath, 'Identifier does not match its entity prefix pattern.', { value });
      if (exactSeen.has(value)) addError(errors, 'A_DUPLICATE_ID', errorPath, 'Identifier is duplicated exactly.', { value });
      exactSeen.add(value);
      const normalized = value.normalize('NFKC');
      if (normalizedSeen.has(normalized) && normalizedSeen.get(normalized) !== value) {
        addError(errors, 'A_DUPLICATE_NORMALIZED_ID', errorPath, 'Distinct identifiers collapse after NFKC normalization.', {
          first: normalizedSeen.get(normalized),
          second: value,
          normalized
        });
      } else if (!normalizedSeen.has(normalized)) {
        normalizedSeen.set(normalized, value);
      }
    }
  }

  for (const [rootName, rootValue] of [['world', world], ['artifacts', artifacts]]) {
    walk(rootValue, (value, valuePath, keyHint) => {
      if (typeof value !== 'string' || !isIdentityKey(keyHint)) return;
      if (value !== value.normalize('NFKC') || !/^[\x20-\x7e]+$/.test(value)) {
        addError(errors, 'A_IDENTIFIER_UNICODE', `${rootName}.${valuePath}`, 'Identity or reference value must be ASCII and NFKC-stable.', { value });
      }
    });
  }

  for (const [artifactPath, data] of Object.entries(artifacts)) {
    if (!Array.isArray(data)) continue;
    const seenQuestionIds = new Set();
    data.forEach((row, index) => {
      if (!row || typeof row.question_id !== 'string') return;
      const normalized = row.question_id.normalize('NFKC');
      if (seenQuestionIds.has(normalized)) {
        addError(errors, 'A_DUPLICATE_QUESTION_ID', `${artifactPath}[${index}].question_id`, 'Question identifier is duplicated within one artifact.', { value: row.question_id });
      }
      seenQuestionIds.add(normalized);
    });
  }

  const inspectChoiceArray = (choices, errorPath) => {
    if (!Array.isArray(choices)) return;
    const seen = new Set();
    choices.forEach((choice, index) => {
      if (!choice || typeof choice.choice_key !== 'string') return;
      const normalized = choice.choice_key.normalize('NFKC');
      if (seen.has(normalized)) {
        addError(errors, 'A_DUPLICATE_CHOICE_KEY', `${errorPath}[${index}].choice_key`, 'Choice key is duplicated in one choice set.', { value: choice.choice_key });
      }
      seen.add(normalized);
    });
  };

  (world.item_revisions || []).forEach((revision, index) => inspectChoiceArray(revision.content_sba?.choices, `item_revisions[${index}].content_sba.choices`));
  for (const [artifactPath, data] of Object.entries(artifacts)) {
    (Array.isArray(data) ? data : [data]).forEach((row, index) => inspectChoiceArray(row?.choices, `${artifactPath}[${index}].choices`));
  }
}

function auditReferences(world, errors) {
  const sets = {
    taxv: entitySet(world, 'taxonomy_versions', 'taxv_id'),
    bpv: entitySet(world, 'blueprint_versions', 'bpv_id'),
    mvv: entitySet(world, 'misconception_vocabulary_versions', 'mvv_id'),
    csp: entitySet(world, 'channel_security_policies', 'csp_id'),
    concept: entitySet(world, 'concepts', 'concept_id'),
    vg: entitySet(world, 'variant_groups', 'vg_id'),
    item: entitySet(world, 'items', 'item_id'),
    itemrev: entitySet(world, 'item_revisions', 'itemrev_id'),
    claim: entitySet(world, 'evidence_claims', 'claim_id'),
    source: entitySet(world, 'source_records', 'src_id'),
    extract: entitySet(world, 'extraction_runs', 'extract_id'),
    mpv: entitySet(world, 'model_prompt_versions', 'mpv_id'),
    rights: entitySet(world, 'rights_records', 'rights_id'),
    redact: entitySet(world, 'privacy_redaction_records', 'redact_id'),
    reviewer: entitySet(world, 'reviewers', 'reviewer_id'),
    assignment: entitySet(world, 'review_assignments', 'assign_id'),
    event: entitySet(world, 'review_events', 'rev_id'),
    release: entitySet(world, 'release_snapshots', 'release_id'),
    artifact: entitySet(world, 'channel_artifacts', 'artifact_id')
  };
  const misconceptionIds = new Set((world.misconception_vocabulary_versions || []).flatMap((version) => (version.entries || []).map((entry) => entry.misconception_id)));
  const extractionOutputs = new Set([...sets.concept, ...sets.source, ...sets.claim, ...misconceptionIds]);
  const revisionById = entityMap(world, 'item_revisions', 'itemrev_id');
  const assignmentById = entityMap(world, 'review_assignments', 'assign_id');
  const artifactById = entityMap(world, 'channel_artifacts', 'artifact_id');

  (world.concepts || []).forEach((row, index) => {
    checkReference(errors, row.taxv_id, sets.taxv, `concepts[${index}].taxv_id`, 'Taxonomy version reference');
    checkReference(errors, row.bpv_id, sets.bpv, `concepts[${index}].bpv_id`, 'Blueprint version reference');
  });
  (world.variant_groups || []).forEach((row, index) => checkReference(errors, row.concept_id, sets.concept, `variant_groups[${index}].concept_id`, 'Concept reference'));
  (world.items || []).forEach((row, index) => checkReference(errors, row.variant_group_id, sets.vg, `items[${index}].variant_group_id`, 'Variant group reference'));
  (world.item_revisions || []).forEach((row, index) => {
    checkReference(errors, row.item_id, sets.item, `item_revisions[${index}].item_id`, 'Item reference');
    checkReference(errors, row.taxv_id, sets.taxv, `item_revisions[${index}].taxv_id`, 'Taxonomy version reference');
    checkReference(errors, row.mvv_id, sets.mvv, `item_revisions[${index}].mvv_id`, 'Misconception vocabulary reference');
    checkReferences(errors, row.source_ids, sets.source, `item_revisions[${index}].source_ids`, 'Source reference');
    checkReference(errors, row.primary_claim_id, sets.claim, `item_revisions[${index}].primary_claim_id`, 'Primary claim reference');
    checkReferences(errors, row.supporting_claim_ids || [], sets.claim, `item_revisions[${index}].supporting_claim_ids`, 'Supporting claim reference');
  });
  (world.evidence_claims || []).forEach((row, index) => checkReference(errors, row.verified_by, sets.reviewer, `evidence_claims[${index}].verified_by`, 'Claim verifier reference'));
  (world.source_records || []).forEach((row, index) => {
    if (row.redact_id !== undefined) checkReference(errors, row.redact_id, sets.redact, `source_records[${index}].redact_id`, 'Redaction reference');
    if (row.rights_id !== undefined) checkReference(errors, row.rights_id, sets.rights, `source_records[${index}].rights_id`, 'Rights reference');
    if (row.extraction_run_id !== undefined) checkReference(errors, row.extraction_run_id, sets.extract, `source_records[${index}].extraction_run_id`, 'Extraction run reference');
    if (row.mpv_id !== undefined) checkReference(errors, row.mpv_id, sets.mpv, `source_records[${index}].mpv_id`, 'Model prompt reference');
    if (row.reviewer_id !== undefined) checkReference(errors, row.reviewer_id, sets.reviewer, `source_records[${index}].reviewer_id`, 'Reviewer reference');
    checkReferences(errors, row.derivation_parent_ids || [], sets.source, `source_records[${index}].derivation_parent_ids`, 'Derivation parent reference');
  });
  (world.extraction_runs || []).forEach((row, index) => {
    checkReference(errors, row.mpv_id, sets.mpv, `extraction_runs[${index}].mpv_id`, 'Model prompt reference');
    checkReferences(errors, row.output_ids || [], extractionOutputs, `extraction_runs[${index}].output_ids`, 'Extraction output reference');
  });
  (world.review_assignments || []).forEach((row, index) => {
    checkReference(errors, row.item_id, sets.item, `review_assignments[${index}].item_id`, 'Assigned item reference');
    checkReference(errors, row.itemrev_id, sets.itemrev, `review_assignments[${index}].itemrev_id`, 'Assigned revision reference');
    checkReference(errors, row.reviewer_id, sets.reviewer, `review_assignments[${index}].reviewer_id`, 'Assigned reviewer reference');
    if (row.completed_rev_id !== undefined) checkReference(errors, row.completed_rev_id, sets.event, `review_assignments[${index}].completed_rev_id`, 'Completed review event reference');
    const revision = revisionById.get(row.itemrev_id);
    if (revision && revision.item_id !== row.item_id) {
      addError(errors, 'A_REFERENCE_ENTITY_MISMATCH', `review_assignments[${index}]`, 'Assignment item_id and itemrev_id resolve to different items.');
    }
  });
  (world.review_events || []).forEach((row, index) => {
    checkReference(errors, row.item_id, sets.item, `review_events[${index}].item_id`, 'Reviewed item reference');
    checkReference(errors, row.itemrev_id, sets.itemrev, `review_events[${index}].itemrev_id`, 'Reviewed revision reference');
    checkReference(errors, row.reviewer_id, sets.reviewer, `review_events[${index}].reviewer_id`, 'Review event reviewer reference');
    checkReference(errors, row.assign_id, sets.assignment, `review_events[${index}].assign_id`, 'Review assignment reference');
    checkReferences(errors, row.claim_verifications || [], sets.claim, `review_events[${index}].claim_verifications`, 'Claim verification reference');
    const revision = revisionById.get(row.itemrev_id);
    if (revision && revision.item_id !== row.item_id) {
      addError(errors, 'A_REFERENCE_ENTITY_MISMATCH', `review_events[${index}]`, 'Review event item_id and itemrev_id resolve to different items.');
    }
    const assignment = assignmentById.get(row.assign_id);
    if (assignment && (assignment.item_id !== row.item_id || assignment.itemrev_id !== row.itemrev_id || assignment.reviewer_id !== row.reviewer_id)) {
      addError(errors, 'A_REVIEW_ASSIGNMENT_MISMATCH', `review_events[${index}]`, 'Review event does not match its assignment.');
    }
  });
  (world.reviewer_calibration_records || []).forEach((row, index) => checkReference(errors, row.reviewer_id, sets.reviewer, `reviewer_calibration_records[${index}].reviewer_id`, 'Calibrated reviewer reference'));
  (world.incident_records || []).forEach((row, index) => {
    checkReferences(errors, row.affected_itemrev_ids || [], sets.itemrev, `incident_records[${index}].affected_itemrev_ids`, 'Affected revision reference');
    checkReferences(errors, row.affected_release_ids || [], sets.release, `incident_records[${index}].affected_release_ids`, 'Affected release reference');
    if (row.corrective_release_id !== undefined) checkReference(errors, row.corrective_release_id, sets.release, `incident_records[${index}].corrective_release_id`, 'Corrective release reference');
  });
  (world.release_snapshots || []).forEach((row, index) => {
    if (row.parent_release_id !== null && row.parent_release_id !== undefined) checkReference(errors, row.parent_release_id, sets.release, `release_snapshots[${index}].parent_release_id`, 'Parent release reference');
    checkReferences(errors, row.channel_artifact_ids || [], sets.artifact, `release_snapshots[${index}].channel_artifact_ids`, 'Release artifact reference');
    (row.pinned_items || []).forEach((pin, pinIndex) => {
      checkReference(errors, pin.item_id, sets.item, `release_snapshots[${index}].pinned_items[${pinIndex}].item_id`, 'Pinned item reference');
      checkReference(errors, pin.itemrev_id, sets.itemrev, `release_snapshots[${index}].pinned_items[${pinIndex}].itemrev_id`, 'Pinned revision reference');
      const revision = revisionById.get(pin.itemrev_id);
      if (revision && revision.item_id !== pin.item_id) {
        addError(errors, 'A_REFERENCE_ENTITY_MISMATCH', `release_snapshots[${index}].pinned_items[${pinIndex}]`, 'Pinned item_id and itemrev_id do not agree.');
      }
    });
  });
  (world.release_promotion_records || []).forEach((row, index) => {
    checkReference(errors, row.release_id, sets.release, `release_promotion_records[${index}].release_id`, 'Promotion release reference');
    if (row.actor_type === 'reviewer') checkReference(errors, row.actor_id, sets.reviewer, `release_promotion_records[${index}].actor_id`, 'Promotion reviewer reference');
  });
  (world.channel_artifacts || []).forEach((row, index) => {
    checkReference(errors, row.release_id, sets.release, `channel_artifacts[${index}].release_id`, 'Artifact release reference');
    checkReference(errors, row.csp_id, sets.csp, `channel_artifacts[${index}].csp_id`, 'Artifact security policy reference');
  });
  (world.psychometric_snapshots || []).forEach((row, index) => {
    checkReference(errors, row.itemrev_id, sets.itemrev, `psychometric_snapshots[${index}].itemrev_id`, 'Psychometric revision reference');
    checkReference(errors, row.release_id, sets.release, `psychometric_snapshots[${index}].release_id`, 'Psychometric release reference');
  });

  for (const release of world.release_snapshots || []) {
    for (const artifactId of release.channel_artifact_ids || []) {
      const artifact = artifactById.get(artifactId);
      if (!artifact) continue;
      if (artifact.release_id !== release.release_id && artifact.release_id !== 'release_og_20260713_v1') {
        addError(errors, 'A_REFERENCE_ENTITY_MISMATCH', `${release.release_id}.channel_artifact_ids`, 'Artifact ownership does not match the release.');
      }
    }
  }
}

function auditReviews(world, errors) {
  const reviewerById = entityMap(world, 'reviewers', 'reviewer_id');
  const sourceById = entityMap(world, 'source_records', 'src_id');
  const credentialByRole = {
    editorial_reviewer: new Set(['editorial']),
    physician_reviewer: new Set(['md', 'do']),
    release_manager: new Set(['system'])
  };

  (world.reviewers || []).forEach((reviewer, index) => {
    const allowed = credentialByRole[reviewer.role];
    if (allowed && !allowed.has(reviewer.credential_type)) {
      addError(errors, 'A_REVIEWER_CREDENTIAL', `reviewers[${index}].credential_type`, 'Reviewer credential is incompatible with the assigned role.', {
        role: reviewer.role,
        credential_type: reviewer.credential_type
      });
    }
  });

  (world.review_assignments || []).forEach((assignment, index) => {
    const reviewer = reviewerById.get(assignment.reviewer_id);
    if (reviewer && reviewer.role !== assignment.required_role) {
      addError(errors, 'A_REVIEW_ASSIGNMENT_ROLE', `review_assignments[${index}].required_role`, 'Assignment required_role does not match reviewer role.');
    }
  });

  for (const revision of (world.item_revisions || []).filter((row) => row.workflow_status === 'approved')) {
    const events = (world.review_events || []).filter((event) => event.itemrev_id === revision.itemrev_id && event.verdict === 'pass');
    const editorialByRole = events.find((event) => reviewerById.get(event.reviewer_id)?.role === 'editorial_reviewer');
    const medicalByRole = events.find((event) => reviewerById.get(event.reviewer_id)?.role === 'physician_reviewer');
    const editorialTransition = events.find((event) => event.from_status === 'candidate' && event.to_status === 'medical_review');
    const medicalTransition = events.find((event) => event.from_status === 'medical_review' && event.to_status === 'approved');

    if (!editorialByRole) addError(errors, 'A_MISSING_EDITORIAL_REVIEW', revision.itemrev_id, 'Approved revision lacks a passing editorial reviewer event.');
    if (!medicalByRole) addError(errors, 'A_MISSING_PHYSICIAN_REVIEW', revision.itemrev_id, 'Approved revision lacks a passing physician reviewer event.');
    if (!editorialTransition || !medicalTransition) addError(errors, 'A_REVIEW_STATUS_ORDER', revision.itemrev_id, 'Required candidate -> medical_review -> approved event chain is incomplete.');

    if (editorialTransition && medicalTransition) {
      if (editorialTransition.reviewer_id === medicalTransition.reviewer_id) {
        addError(errors, 'A_REVIEW_SELF_REVIEW', revision.itemrev_id, 'Editorial and medical transitions use the same reviewer.');
      }
      const editorialTime = Date.parse(editorialTransition.created_at);
      const medicalTime = Date.parse(medicalTransition.created_at);
      if (!Number.isFinite(editorialTime) || !Number.isFinite(medicalTime) || editorialTime >= medicalTime) {
        addError(errors, 'A_REVIEW_TIME_ORDER', revision.itemrev_id, 'Editorial review must precede medical approval.');
      }
    }

    if (medicalByRole) {
      const reviewer = reviewerById.get(medicalByRole.reviewer_id);
      if (reviewer?.status !== 'active') addError(errors, 'A_REVIEWER_INACTIVE', medicalByRole.reviewer_id, 'Physician approval was recorded by an inactive reviewer.');
      const authorIds = new Set((revision.source_ids || [])
        .map((sourceId) => sourceById.get(sourceId))
        .filter((source) => source?.source_type === 'REVIEWER_AUTHORED')
        .map((source) => source.reviewer_id));
      if (authorIds.has(medicalByRole.reviewer_id)) {
        addError(errors, 'A_AUTHOR_SELF_REVIEW', revision.itemrev_id, 'The reviewer-authored source author also supplied medical approval.');
      }
    }
  }
}

function claimMaterial(claim) {
  return {
    statement: claim.statement,
    authority_class: claim.authority_class,
    authority_refs: claim.authority_refs,
    verified_by: claim.verified_by,
    evidence_review_date: claim.evidence_review_date,
    review_by_date: claim.review_by_date,
    currency_class: claim.currency_class,
    status: claim.status
  };
}

function auditClaims(world, baselineWorld, errors) {
  const claimById = entityMap(world, 'evidence_claims', 'claim_id');
  const baselineClaimById = entityMap(baselineWorld, 'evidence_claims', 'claim_id');
  const revisionById = entityMap(world, 'item_revisions', 'itemrev_id');
  const reviewerById = entityMap(world, 'reviewers', 'reviewer_id');
  const releasedRevisionIds = new Set((world.release_snapshots || []).flatMap((release) => (release.pinned_items || []).map((pin) => pin.itemrev_id)));
  const releasedClaimIds = new Set();

  for (const revisionId of releasedRevisionIds) {
    const revision = revisionById.get(revisionId);
    if (revision?.primary_claim_id) releasedClaimIds.add(revision.primary_claim_id);
  }

  for (const claimId of releasedClaimIds) {
    const claim = claimById.get(claimId);
    if (!claim) continue;
    if (claim.status !== 'verified') {
      addError(errors, 'A_CLAIM_STATUS_BLOCKED', claimId, 'Released claim status must remain verified.', { status: claim.status });
    }
    const reviewBy = Date.parse(`${claim.review_by_date}T23:59:59Z`);
    const auditDate = Date.parse(`${AUDIT_DATE}T00:00:00Z`);
    if (!Number.isFinite(reviewBy) || reviewBy < auditDate) addError(errors, 'A_CLAIM_EXPIRED', `${claimId}.review_by_date`, 'Released claim is past its review-by date.');
    const evidenceDate = Date.parse(`${claim.evidence_review_date}T00:00:00Z`);
    if (!Number.isFinite(evidenceDate) || !Number.isFinite(reviewBy) || evidenceDate > reviewBy) {
      addError(errors, 'A_CLAIM_DATE_ORDER', claimId, 'Claim evidence review date must not follow its review-by date.');
    }
    const verifier = reviewerById.get(claim.verified_by);
    if (!verifier || verifier.role !== 'physician_reviewer' || !['md', 'do'].includes(verifier.credential_type) || verifier.status !== 'active') {
      addError(errors, 'A_CLAIM_VERIFIER_INVALID', claimId, 'Released claim requires an active physician reviewer with md/do credential.');
    }
    const baselineClaim = baselineClaimById.get(claimId);
    if (baselineClaim && hashObject(claimMaterial(claim)) !== hashObject(claimMaterial(baselineClaim))) {
      addError(errors, 'A_RELEASED_CLAIM_CHANGED', claimId, 'Released claim material changed without a new claim identity and release.');
    }
  }

  for (const revision of (world.item_revisions || []).filter((row) => releasedRevisionIds.has(row.itemrev_id))) {
    const verified = (world.review_events || []).some((event) => event.itemrev_id === revision.itemrev_id
      && event.to_status === 'approved'
      && event.verdict === 'pass'
      && Array.isArray(event.claim_verifications)
      && event.claim_verifications.includes(revision.primary_claim_id));
    if (!verified) addError(errors, 'A_CLAIM_NOT_VERIFIED_IN_REVIEW', revision.itemrev_id, 'Medical approval event does not explicitly verify the primary claim.');
  }
}

function preAnswerArtifacts(world, artifacts) {
  return (world.channel_artifacts || [])
    .filter((artifact) => artifact.phase === 'pre_answer')
    .map((artifact) => [artifact, artifacts[artifact.artifact_path]]);
}

function studentArtifacts(world, artifacts) {
  return (world.channel_artifacts || [])
    .filter((artifact) => ['pre_answer', 'post_answer'].includes(artifact.phase))
    .map((artifact) => [artifact, artifacts[artifact.artifact_path]]);
}

function auditAnswerLeakage(world, artifacts, baselineArtifacts, errors) {
  const baselineAnswers = new Map((baselineArtifacts[ARTIFACT_PATHS.dataset] || []).map((row) => [row.question_id, row.answer]));
  const secretStringPattern = /(?:answer|solution|gold|correct|target)\s*(?:key|choice|option)?\s*[:=]\s*[A-D]\b/i;

  for (const [artifact, data] of preAnswerArtifacts(world, artifacts)) {
    walk(data, (value, valuePath, keyHint) => {
      const normalizedKey = normalizeKey(keyHint);
      if (PRE_ANSWER_SECRET_KEYS.has(normalizedKey)) {
        addError(errors, 'A_ANSWER_ALIAS_LEAK', `${artifact.artifact_path}.${valuePath}`, 'Pre-answer artifact contains an answer-secret alias.', { key: keyHint });
      }
      if (PRE_ANSWER_ORDER_KEYS.has(normalizedKey)) {
        addError(errors, 'A_ANSWER_ORDER_LEAK', `${artifact.artifact_path}.${valuePath}`, 'Pre-answer artifact contains answer-correlated ordering metadata.', { key: keyHint });
      }
      if (typeof value === 'string' && secretStringPattern.test(value)) {
        addError(errors, 'A_ANSWER_ALIAS_LEAK', `${artifact.artifact_path}.${valuePath}`, 'Pre-answer string embeds an answer-secret marker.');
      }
      if (typeof value === 'string' && isIdentityKey(keyHint)) {
        for (const [questionId, answer] of baselineAnswers) {
          if (new RegExp(`^${escapeRegex(questionId)}[-_:]${escapeRegex(answer)}$`, 'i').test(value)) {
            addError(errors, 'A_ANSWER_ID_LEAK', `${artifact.artifact_path}.${valuePath}`, 'Identifier encodes the server-side answer key.', { value });
          }
        }
      }
    });
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactMatches(gold, detections) {
  const usedGold = new Set();
  let count = 0;
  for (const detection of detections) {
    const matchIndex = gold.findIndex((label, index) => !usedGold.has(index)
      && label.start === detection.start
      && label.end === detection.end
      && label.text === detection.text);
    if (matchIndex >= 0) {
      usedGold.add(matchIndex);
      count += 1;
    }
  }
  return count;
}

export function evaluatePrivacyAggregate(corpus) {
  const rawTranscript = typeof corpus?.raw_transcript === 'string' ? corpus.raw_transcript : '';
  const labels = Array.isArray(corpus?.labels) ? corpus.labels : [];
  const detections = Array.isArray(corpus?.generated_detections) ? corpus.generated_detections : [];
  const errors = [];
  const observedClasses = new Set([...labels, ...detections].map((row) => row.class).filter((value) => typeof value === 'string'));
  const unexpectedClasses = [...observedClasses].filter((value) => !REQUIRED_PRIVACY_CLASSES.includes(value)).sort();

  for (const [kind, rows] of [['gold', labels], ['detection', detections]]) {
    rows.forEach((row, index) => {
      const valid = Number.isInteger(row.start)
        && Number.isInteger(row.end)
        && row.start >= 0
        && row.end >= row.start
        && rawTranscript.slice(row.start, row.end) === row.text;
      if (!valid) addError(errors, 'P_INVALID_LABEL_SPAN', `${kind}[${index}]`, 'Privacy span does not exactly address its declared text.');
    });
  }

  unexpectedClasses.forEach((className) => addError(errors, 'P_UNEXPECTED_PRIVACY_CLASS', `by_class.${className}`, 'Observed privacy class is not in the required class contract.'));

  const byClass = {};
  let aggregateTp = 0;
  let aggregatePredicted = 0;
  let aggregateGold = 0;
  for (const className of REQUIRED_PRIVACY_CLASSES) {
    const gold = labels.filter((row) => row.class === className);
    const predicted = detections.filter((row) => row.class === className);
    const tp = exactMatches(gold, predicted);
    const fp = Math.max(0, predicted.length - tp);
    const fn = Math.max(0, gold.length - tp);
    const precisionDenominatorZero = predicted.length === 0;
    const recallDenominatorZero = gold.length === 0;
    const precision = precisionDenominatorZero ? (gold.length === 0 ? 1 : 0) : tp / predicted.length;
    const recall = recallDenominatorZero ? 0 : tp / gold.length;
    const missingRequiredClass = gold.length === 0;

    byClass[className] = {
      required: true,
      explicitly_evaluated: true,
      missing_required_class: missingRequiredClass,
      gold_count: gold.length,
      detection_count: predicted.length,
      tp,
      fp,
      fn,
      precision,
      recall,
      denominator_zero: {
        precision: precisionDenominatorZero,
        recall: recallDenominatorZero
      },
      denominator_resolution: {
        precision: precisionDenominatorZero ? (gold.length === 0 ? 'no_gold_and_no_predictions_returns_1' : 'gold_present_and_no_predictions_returns_0') : 'ordinary_ratio',
        recall: recallDenominatorZero ? 'required_class_with_no_gold_returns_0_and_fails' : 'ordinary_ratio'
      }
    };

    if (missingRequiredClass) addError(errors, 'P_MISSING_REQUIRED_CLASS', `by_class.${className}`, 'Required privacy class has no gold examples.');
    if (!missingRequiredClass && recall < 1) addError(errors, 'P_REQUIRED_CLASS_RECALL', `by_class.${className}.recall`, 'Required privacy class recall is below 1.');
    if (precision < 1) addError(errors, 'P_REQUIRED_CLASS_PRECISION', `by_class.${className}.precision`, 'Required privacy class precision is below 1.');

    aggregateTp += tp;
    aggregatePredicted += predicted.length;
    aggregateGold += gold.length;
  }

  const aggregatePrecisionDenominatorZero = aggregatePredicted === 0;
  const aggregateRecallDenominatorZero = aggregateGold === 0;
  const aggregatePrecision = aggregatePrecisionDenominatorZero ? 1 : aggregateTp / aggregatePredicted;
  const aggregateRecall = aggregateRecallDenominatorZero ? 0 : aggregateTp / aggregateGold;
  const patientIdentifierRecall = byClass.patient_identifier.recall;
  if (typeof patientIdentifierRecall !== 'number' || !Number.isFinite(patientIdentifierRecall)) {
    addError(errors, 'P_PATIENT_RECALL_NOT_NUMERIC', 'by_class.patient_identifier.recall', 'Patient identifier recall must always be numeric.');
  }

  return {
    evaluator_id: 'i1q_1006_superseding_privacy_aggregate_v1',
    supersedes: 'i1q_1005_scoreRedaction_aggregate_semantics',
    status: errors.length === 0 && aggregatePrecision === 1 && aggregateRecall === 1 ? 'pass' : 'fail',
    synthetic_only: true,
    required_classes: [...REQUIRED_PRIVACY_CLASSES],
    required_classes_explicit: REQUIRED_PRIVACY_CLASSES.every((className) => Object.hasOwn(byClass, className)),
    denominator_policy: {
      class_precision_zero_predictions_with_gold: 0,
      class_precision_zero_predictions_and_zero_gold: 1,
      class_recall_zero_gold_required_class: 0,
      aggregate_precision_zero_predictions: 1,
      aggregate_recall_zero_gold: 0,
      missing_required_class: 'fail'
    },
    by_class: byClass,
    aggregate: {
      tp: aggregateTp,
      predicted_count: aggregatePredicted,
      gold_count: aggregateGold,
      precision: aggregatePrecision,
      recall: aggregateRecall,
      denominator_zero: {
        precision: aggregatePrecisionDenominatorZero,
        recall: aggregateRecallDenominatorZero
      }
    },
    am12_mapping: {
      redaction_precision_all_classes: aggregatePrecision,
      redaction_recall_patient_identifying_info: patientIdentifierRecall,
      redaction_recall_student_names: byClass.student_name.recall
    },
    unexpected_classes: unexpectedClasses,
    errors: dedupeErrors(errors)
  };
}

function extractSpeakerTurns(rawTranscript) {
  const marker = /((?:Instructor|Student|Third Party) Placeholder [A-Za-z]+):/g;
  const matches = [...String(rawTranscript).matchAll(marker)];
  return matches.map((match, index) => ({
    speaker: match[1],
    utterance: String(rawTranscript).slice(match.index + match[0].length, matches[index + 1]?.index ?? String(rawTranscript).length).trim()
  }));
}

function auditStudentSpeech(world, baselineWorld, errors) {
  const currentTurns = extractSpeakerTurns(world.redaction_corpus?.raw_transcript || '');
  const baselineStudentTurns = extractSpeakerTurns(baselineWorld.redaction_corpus?.raw_transcript || '').filter((turn) => turn.speaker.startsWith('Student '));
  for (const baselineTurn of baselineStudentTurns) {
    const current = currentTurns.find((turn) => compactPrivacy(turn.utterance) === compactPrivacy(baselineTurn.utterance));
    if (current && !current.speaker.startsWith('Student ')) {
      addError(errors, 'P_STUDENT_SPEECH_MISLABELED', 'redaction_corpus.raw_transcript', 'A baseline student utterance is attributed to a non-student speaker.', {
        expected_speaker: baselineTurn.speaker,
        observed_speaker: current.speaker
      });
    }
  }

  const studentLabels = (world.redaction_corpus?.labels || []).filter((label) => label.class === 'student_name');
  for (const turn of currentTurns.filter((row) => row.speaker.startsWith('Student '))) {
    if (!studentLabels.some((label) => label.text === turn.speaker)) {
      addError(errors, 'P_STUDENT_SPEECH_MISLABELED', 'redaction_corpus.labels', 'Student speaker is not explicitly labeled as student_name.', { speaker: turn.speaker });
    }
  }
}

function auditPrivacyLeaks(world, artifacts, baselineWorld, errors) {
  const plantedTokens = (baselineWorld.redaction_corpus?.labels || []).map((label) => label.text);
  for (const [artifact, data] of studentArtifacts(world, artifacts)) {
    const strings = collectStrings(data);
    walk(data, (_value, valuePath, keyHint) => {
      const key = normalizeKey(keyHint);
      if (DEBUG_KEYS.has(key)) addError(errors, 'A_DEBUG_FIELD_LEAK', `${artifact.artifact_path}.${valuePath}`, 'Student artifact contains nested debug or trace material.', { key: keyHint });
      if (RAW_SOURCE_KEYS.has(key)) addError(errors, 'A_RAW_TRANSCRIPT_LEAK', `${artifact.artifact_path}.${valuePath}`, 'Student artifact contains raw or unscrubbed source material.', { key: keyHint });
    });

    const directTokenHits = new Set();
    for (const row of strings) {
      const compacted = compactPrivacy(row.value);
      for (const token of plantedTokens) {
        if (compacted.includes(compactPrivacy(token))) {
          directTokenHits.add(token);
          addError(errors, 'A_PRIVACY_IDENTIFIER_LEAK', `${artifact.artifact_path}.${row.path}`, 'Student artifact contains a planted synthetic identifier.', { token_class: baselineWorld.redaction_corpus.labels.find((label) => label.text === token)?.class });
        }
      }
    }
    const joined = strings.map((row) => compactPrivacy(row.value)).join('');
    for (const token of plantedTokens) {
      if (!directTokenHits.has(token) && joined.includes(compactPrivacy(token))) {
        addError(errors, 'A_PRIVACY_SPLIT_IDENTIFIER_LEAK', artifact.artifact_path, 'Student artifact reconstructs a planted identifier across multiple scalar values.', { token_class: baselineWorld.redaction_corpus.labels.find((label) => label.text === token)?.class });
      }
    }
  }

  const maskedWorking = String(world.redaction_corpus?.working_transcript || '').replace(/\[REDACTED_[^\]]+\]/g, '[REDACTED]');
  for (const token of plantedTokens) {
    if (compactPrivacy(maskedWorking).includes(compactPrivacy(token))) {
      addError(errors, 'A_WORKING_TRANSCRIPT_IDENTIFIER_LEAK', 'redaction_corpus.working_transcript', 'Working transcript contains a planted identifier outside a redaction marker.');
    }
  }
}

function auditArtifacts(world, artifacts, errors) {
  const artifactById = entityMap(world, 'channel_artifacts', 'artifact_id');
  const revisionById = entityMap(world, 'item_revisions', 'itemrev_id');
  const seenPaths = new Set();
  for (const [index, artifact] of (world.channel_artifacts || []).entries()) {
    const normalizedPath = path.posix.normalize(artifact.artifact_path || '');
    if (!artifact.artifact_path || normalizedPath.startsWith('../') || path.posix.isAbsolute(artifact.artifact_path)) {
      addError(errors, 'A_ARTIFACT_PATH_UNSAFE', `channel_artifacts[${index}].artifact_path`, 'Artifact path must be a safe relative path.');
    }
    if (seenPaths.has(normalizedPath)) addError(errors, 'A_DUPLICATE_ARTIFACT_PATH', `channel_artifacts[${index}].artifact_path`, 'Artifact path is duplicated.');
    seenPaths.add(normalizedPath);
    const data = artifacts[artifact.artifact_path];
    if (data === undefined) {
      addError(errors, 'A_ARTIFACT_MISSING', artifact.artifact_id, 'Artifact record has no corresponding in-memory artifact.');
      continue;
    }
    const actualHash = hashObject(data);
    if (!/^[a-f0-9]{64}$/.test(artifact.artifact_hash || '') || actualHash !== artifact.artifact_hash) {
      addError(errors, 'A_ARTIFACT_HASH_MISMATCH', artifact.artifact_id, 'Artifact hash does not match canonical artifact content.', { expected: artifact.artifact_hash, actual: actualHash });
    }
    const actualCount = Array.isArray(data) ? data.length : 1;
    if (artifact.included_record_count !== actualCount) {
      addError(errors, 'A_ARTIFACT_RECORD_COUNT', artifact.artifact_id, 'Artifact included_record_count does not match content.', { declared: artifact.included_record_count, actual: actualCount });
    }
  }

  for (const [index, revision] of (world.item_revisions || []).entries()) {
    if (!revision.content_sba?.choices) continue;
    const actualHash = hashObject(revision.content_sba);
    if (revision.content_hash !== actualHash) addError(errors, 'A_CONTENT_HASH_MISMATCH', `item_revisions[${index}].content_hash`, 'Revision content hash is stale.', { expected: revision.content_hash, actual: actualHash });
  }

  for (const [index, release] of (world.release_snapshots || []).entries()) {
    const map = release.channel_artifact_hashes || {};
    for (const artifactId of release.channel_artifact_ids || []) {
      const artifact = artifactById.get(artifactId);
      if (!Object.hasOwn(map, artifactId)) {
        addError(errors, 'A_RELEASE_ARTIFACT_HASH_MISSING', `release_snapshots[${index}].channel_artifact_hashes`, 'Release artifact hash map omits a referenced artifact.', { artifact_id: artifactId });
      } else if (artifact && map[artifactId] !== artifact.artifact_hash) {
        addError(errors, 'A_RELEASE_ARTIFACT_HASH_MISMATCH', `release_snapshots[${index}].channel_artifact_hashes.${artifactId}`, 'Release artifact hash does not match artifact record.');
      }
    }
    for (const artifactId of Object.keys(map)) {
      if (!(release.channel_artifact_ids || []).includes(artifactId)) {
        addError(errors, 'A_RELEASE_ARTIFACT_HASH_ORPHAN', `release_snapshots[${index}].channel_artifact_hashes.${artifactId}`, 'Release artifact hash map contains an unreferenced artifact.');
      }
    }
    for (const [pinIndex, pin] of (release.pinned_items || []).entries()) {
      const revision = revisionById.get(pin.itemrev_id);
      if (revision && pin.content_hash !== revision.content_hash) addError(errors, 'A_PINNED_CONTENT_HASH_MISMATCH', `release_snapshots[${index}].pinned_items[${pinIndex}].content_hash`, 'Pinned content hash does not match revision.');
    }
    const actualReleaseHash = hashObject({ ...release, release_hash: null });
    if (!/^[a-f0-9]{64}$/.test(release.release_hash || '') || release.release_hash !== actualReleaseHash) {
      addError(errors, 'A_RELEASE_HASH_MISMATCH', `release_snapshots[${index}].release_hash`, 'Release hash does not match canonical release content.', { expected: release.release_hash, actual: actualReleaseHash });
    }
  }
}

function auditPromotions(world, errors) {
  const legal = new Set([
    'assembled->validated',
    'validated->ratified',
    'ratified->published',
    'published->superseded',
    'published->withdrawn',
    'ratified->withdrawn',
    'ratified->superseded'
  ]);
  const byRelease = new Map();
  for (const [index, promotion] of (world.release_promotion_records || []).entries()) {
    if (!legal.has(`${promotion.from_state}->${promotion.to_state}`)) {
      addError(errors, 'A_ILLEGAL_PROMOTION_TRANSITION', `release_promotion_records[${index}]`, 'Promotion transition is not legal.', { from: promotion.from_state, to: promotion.to_state });
    }
    if (promotion.to_state === 'ratified' && promotion.actor_type !== 'brian') {
      addError(errors, 'A_RATIFICATION_ACTOR', `release_promotion_records[${index}].actor_type`, 'Ratification requires the explicit Brian gate actor.');
    }
    if (promotion.to_state === 'published' || promotion.from_state === 'published') {
      addError(errors, 'A_PHASE0_PUBLICATION_BLOCKED', `release_promotion_records[${index}]`, 'Publication transitions are blocked in this Phase 0 audit.');
    }
    if (!byRelease.has(promotion.release_id)) byRelease.set(promotion.release_id, []);
    byRelease.get(promotion.release_id).push({ promotion, index });
  }
  for (const [releaseId, rows] of byRelease) {
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      if (previous.promotion.to_state !== current.promotion.from_state) {
        addError(errors, 'A_PROMOTION_STATE_ORDER', `release_promotion_records[${current.index}]`, 'Promotion chain is not state-contiguous.', { release_id: releaseId });
      }
      const previousTime = Date.parse(previous.promotion.created_at);
      const currentTime = Date.parse(current.promotion.created_at);
      if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime) || previousTime >= currentTime) {
        addError(errors, 'A_PROMOTION_TIME_ORDER', `release_promotion_records[${current.index}].created_at`, 'Promotion events must be strictly chronological in chain order.', { release_id: releaseId });
      }
    }
  }
  for (const [index, release] of (world.release_snapshots || []).entries()) {
    if (release.state === 'published') addError(errors, 'A_PHASE0_PUBLICATION_BLOCKED', `release_snapshots[${index}].state`, 'Published release state is blocked in Phase 0.');
    if (release.state === 'ratified' && release.validation_report_summary !== 'green') {
      addError(errors, 'A_RATIFIED_RELEASE_NOT_GREEN', `release_snapshots[${index}].validation_report_summary`, 'Ratified release must reference a green validation result.');
    }
  }
}

export function auditWorld(world, artifacts, baselineWorld, baselineArtifacts) {
  const errors = [];
  auditIdentifiers(world, artifacts, errors);
  auditReferences(world, errors);
  auditReviews(world, errors);
  auditClaims(world, baselineWorld, errors);
  auditAnswerLeakage(world, artifacts, baselineArtifacts, errors);
  auditPrivacyLeaks(world, artifacts, baselineWorld, errors);
  auditStudentSpeech(world, baselineWorld, errors);
  auditArtifacts(world, artifacts, errors);
  auditPromotions(world, errors);
  const privacyAggregate = evaluatePrivacyAggregate(world.redaction_corpus);
  errors.push(...privacyAggregate.errors);
  return {
    status: errors.length === 0 ? 'pass' : 'fail',
    errors: dedupeErrors(errors),
    privacy_aggregate: privacyAggregate
  };
}

function caseRow(id, category, title, expectedErrorCode, mutate) {
  return { id, category, title, expected_error_code: expectedErrorCode, mutate };
}

export function buildMutationCases() {
  return [
    caseRow('N-031', 'unicode_normalization', 'NFD item identifier', 'A_IDENTIFIER_UNICODE', (world) => { world.items[0].item_id = 'item_og_light_balance\u0065\u0301_sba'; }),
    caseRow('N-032', 'unicode_normalization', 'Zero-width source reference', 'A_IDENTIFIER_UNICODE', (world) => { world.item_revisions[0].source_ids[0] = 'src_og_transcript_\u200b001'; }),
    caseRow('N-033', 'unicode_normalization', 'Fullwidth question identifier', 'A_IDENTIFIER_UNICODE', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].question_id = '\uff2f\uff27-Q-0001'; }),
    caseRow('N-034', 'unicode_normalization', 'NFC-equivalent duplicate source identifiers', 'A_DUPLICATE_NORMALIZED_ID', (world) => {
      const first = deepClone(world.source_records[2]);
      const second = deepClone(world.source_records[2]);
      first.src_id = 'src_caf\u00e9';
      second.src_id = 'src_cafe\u0301';
      world.source_records.push(first, second);
    }),
    caseRow('N-035', 'duplicate_ids', 'Exact duplicate item identifier', 'A_DUPLICATE_ID', (world) => { world.items.push(deepClone(world.items[0])); }),
    caseRow('N-036', 'duplicate_ids', 'Exact duplicate review event identifier', 'A_DUPLICATE_ID', (world) => { world.review_events.push(deepClone(world.review_events[0])); }),
    caseRow('N-037', 'duplicate_ids', 'Duplicate question identifier in one artifact', 'A_DUPLICATE_QUESTION_ID', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.dataset].push(deepClone(artifacts[ARTIFACT_PATHS.dataset][0])); }),
    caseRow('N-038', 'duplicate_ids', 'Duplicate choice key', 'A_DUPLICATE_CHOICE_KEY', (world) => { world.item_revisions[0].content_sba.choices[1].choice_key = 'A'; }),
    caseRow('N-039', 'malformed_references', 'Unknown taxonomy reference', 'A_MALFORMED_REFERENCE', (world) => { world.concepts[0].taxv_id = 'taxv_missing_fixture'; }),
    caseRow('N-040', 'malformed_references', 'Unknown source reference', 'A_MALFORMED_REFERENCE', (world) => { world.item_revisions[0].source_ids[0] = 'src_missing_fixture'; }),
    caseRow('N-041', 'malformed_references', 'Assignment item and revision mismatch', 'A_REFERENCE_ENTITY_MISMATCH', (world) => { world.review_assignments[0].itemrev_id = 'itemrev_og_retired_sample_v1'; }),
    caseRow('N-042', 'malformed_references', 'Artifact references unknown security policy', 'A_MALFORMED_REFERENCE', (world) => { world.channel_artifacts[0].csp_id = 'csp_missing_fixture'; }),
    caseRow('N-043', 'malformed_references', 'Promotion references unknown release', 'A_MALFORMED_REFERENCE', (world) => { world.release_promotion_records[0].release_id = 'release_missing_fixture'; }),
    caseRow('N-044', 'malformed_references', 'Claim references unknown verifier', 'A_MALFORMED_REFERENCE', (world) => { world.evidence_claims[0].verified_by = 'reviewer_missing_fixture'; }),
    caseRow('N-045', 'review_governance', 'Physician reviewer has editorial credential', 'A_REVIEWER_CREDENTIAL', (world) => { world.reviewers[0].credential_type = 'editorial'; }),
    caseRow('N-046', 'review_governance', 'Medical approval precedes editorial review', 'A_REVIEW_TIME_ORDER', (world) => { world.review_events[1].created_at = '2026-07-13T11:00:00Z'; }),
    caseRow('N-047', 'review_governance', 'Same reviewer supplies editorial and medical transitions', 'A_REVIEW_SELF_REVIEW', (world) => { world.review_events[1].reviewer_id = 'reviewer_placeholder_editor_01'; }),
    caseRow('N-048', 'review_governance', 'Review event and assignment reviewer mismatch', 'A_REVIEW_ASSIGNMENT_MISMATCH', (world) => { world.review_assignments[1].reviewer_id = 'reviewer_placeholder_editor_01'; }),
    caseRow('N-049', 'review_governance', 'Inactive physician reviewer approves revision', 'A_REVIEWER_INACTIVE', (world) => { world.reviewers[0].status = 'inactive'; }),
    caseRow('N-050', 'review_governance', 'Reviewer-authored source author performs medical review', 'A_AUTHOR_SELF_REVIEW', (world) => { world.source_records[2].reviewer_id = 'reviewer_placeholder_physician_01'; }),
    caseRow('N-051', 'claim_lifecycle', 'Released claim status is expired', 'A_CLAIM_STATUS_BLOCKED', (world) => { world.evidence_claims[0].status = 'expired'; }),
    caseRow('N-052', 'claim_lifecycle', 'Released claim review-by date has elapsed', 'A_CLAIM_EXPIRED', (world) => { world.evidence_claims[0].review_by_date = '2020-01-01'; }),
    caseRow('N-053', 'claim_lifecycle', 'Released claim is retracted', 'A_CLAIM_STATUS_BLOCKED', (world) => { world.evidence_claims[0].status = 'retracted'; }),
    caseRow('N-054', 'claim_lifecycle', 'Released claim is superseded in place', 'A_CLAIM_STATUS_BLOCKED', (world) => { world.evidence_claims[0].status = 'superseded'; }),
    caseRow('N-055', 'claim_lifecycle', 'Released claim statement changes under same identity', 'A_RELEASED_CLAIM_CHANGED', (world) => { world.evidence_claims[0].statement += ' Changed after release in this synthetic mutation.'; }),
    caseRow('N-056', 'claim_lifecycle', 'Medical review omits explicit claim verification', 'A_CLAIM_NOT_VERIFIED_IN_REVIEW', (world) => { world.review_events[1].claim_verifications = []; }),
    caseRow('N-057', 'answer_leakage', 'Nested solution alias', 'A_ANSWER_ALIAS_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].delivery = { solution: 'A' }; }),
    caseRow('N-058', 'answer_leakage', 'Camel-case gold choice alias', 'A_ANSWER_ALIAS_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].display = { goldChoice: 'A' }; }),
    caseRow('N-059', 'answer_leakage', 'Question identifier encodes answer key', 'A_ANSWER_ID_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].question_id = 'OG-Q-0001-A'; }),
    caseRow('N-060', 'answer_leakage', 'Correct answer index leaks ordering', 'A_ANSWER_ORDER_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].ordering = { correct_index: 0 }; }),
    caseRow('N-061', 'answer_leakage', 'Correct choice has answer-correlated display rank', 'A_ANSWER_ORDER_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].choices[0].display_rank = 0; }),
    caseRow('N-062', 'answer_leakage', 'Nested grading target alias', 'A_ANSWER_ALIAS_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].grading = { target: 'A' }; }),
    caseRow('N-063', 'nested_privacy_debug', 'Deep nested debug payload', 'A_DEBUG_FIELD_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].metadata = { debug: { message: 'synthetic fixture diagnostic' } }; }),
    caseRow('N-064', 'nested_privacy_debug', 'Nested student identifier leak', 'A_PRIVACY_IDENTIFIER_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].metadata = { profile: { label: 'Student Placeholder One' } }; }),
    caseRow('N-065', 'nested_privacy_debug', 'Nested raw transcript leak', 'A_RAW_TRANSCRIPT_LEAK', (world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].payload = { raw_transcript: world.redaction_corpus.raw_transcript }; }),
    caseRow('N-066', 'nested_privacy_debug', 'Nested diagnostics stack leak', 'A_DEBUG_FIELD_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.drillsPost][0].metadata = { diagnostics: { stack: ['synthetic fixture frame'] } }; }),
    caseRow('N-067', 'artifact_integrity', 'Artifact content changes with stale record hash', 'A_ARTIFACT_HASH_MISMATCH', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].prompt += ' Synthetic mutation.'; }),
    caseRow('N-068', 'artifact_integrity', 'Release artifact hash disagrees with artifact record', 'A_RELEASE_ARTIFACT_HASH_MISMATCH', (world) => { world.release_snapshots[0].channel_artifact_hashes[world.release_snapshots[0].channel_artifact_ids[0]] = '0'.repeat(64); }),
    caseRow('N-069', 'artifact_integrity', 'Release artifact hash entry is missing', 'A_RELEASE_ARTIFACT_HASH_MISSING', (world) => { delete world.release_snapshots[0].channel_artifact_hashes[world.release_snapshots[0].channel_artifact_ids[0]]; }),
    caseRow('N-070', 'artifact_integrity', 'Artifact record count is false', 'A_ARTIFACT_RECORD_COUNT', (world) => { world.channel_artifacts[0].included_record_count = 2; }),
    caseRow('N-071', 'artifact_integrity', 'Release metadata changes with stale release hash', 'A_RELEASE_HASH_MISMATCH', (world) => { world.release_snapshots[0].release_label += '_changed'; }),
    caseRow('N-072', 'promotion_governance', 'Promotion skips validated state', 'A_ILLEGAL_PROMOTION_TRANSITION', (world) => { world.release_promotion_records[0].to_state = 'ratified'; }),
    caseRow('N-073', 'promotion_governance', 'Reviewer actor attempts ratification', 'A_RATIFICATION_ACTOR', (world) => { world.release_promotion_records[1].actor_type = 'reviewer'; world.release_promotion_records[1].actor_id = 'reviewer_placeholder_release_manager_01'; }),
    caseRow('N-074', 'promotion_governance', 'Promotion timestamps run backward', 'A_PROMOTION_TIME_ORDER', (world) => { world.release_promotion_records[3].created_at = '2026-07-13T14:00:00Z'; }),
    caseRow('N-075', 'promotion_governance', 'Phase 0 release attempts publication', 'A_PHASE0_PUBLICATION_BLOCKED', (world) => {
      world.release_promotion_records.push({
        promo_id: 'promo_og_v2_ratified_published_bad',
        release_id: 'release_og_20260713_corrective_v2',
        from_state: 'ratified',
        to_state: 'published',
        actor_type: 'brian',
        actor_id: 'brian_publication_gate_placeholder',
        evidence_refs: ['validation_results/validation_report.json'],
        created_at: '2026-07-13T13:40:00Z'
      });
    }),
    caseRow('N-076', 'privacy_aggregate', 'Required patient identifier class is absent', 'P_MISSING_REQUIRED_CLASS', (world) => {
      world.redaction_corpus.labels = world.redaction_corpus.labels.filter((row) => row.class !== 'patient_identifier');
      world.redaction_corpus.generated_detections = world.redaction_corpus.generated_detections.filter((row) => row.class !== 'patient_identifier');
    }),
    caseRow('N-077', 'split_identifiers', 'Patient identifier is split across nested scalar values', 'A_PRIVACY_SPLIT_IDENTIFIER_LEAK', (_world, artifacts) => { artifacts[ARTIFACT_PATHS.runtime][0].metadata = { fragments: ['FAKE-', 'PAT-', '0001'] }; }),
    caseRow('N-078', 'student_speech', 'Student utterance is relabeled as instructor speech', 'P_STUDENT_SPEECH_MISLABELED', (world) => { world.redaction_corpus.raw_transcript = world.redaction_corpus.raw_transcript.replace('Student Placeholder One:', 'Instructor Placeholder Beta:'); }),
    caseRow('N-079', 'privacy_aggregate', 'Patient identifier gold exists with zero detections', 'P_REQUIRED_CLASS_RECALL', (world) => { world.redaction_corpus.generated_detections = world.redaction_corpus.generated_detections.filter((row) => row.class !== 'patient_identifier'); }),
    caseRow('N-080', 'privacy_aggregate', 'All required privacy class denominators are zero', 'P_MISSING_REQUIRED_CLASS', (world) => { world.redaction_corpus.labels = []; world.redaction_corpus.generated_detections = []; })
  ];
}

export function runPrivacyContractTests(baseWorld) {
  const tests = [];
  const record = (id, assertion, evidence) => tests.push({ id, status: assertion ? 'pass' : 'fail', evidence });

  const baseline = evaluatePrivacyAggregate(baseWorld.redaction_corpus);
  record('PA-001-required-classes-explicit', baseline.required_classes_explicit
    && REQUIRED_PRIVACY_CLASSES.every((className) => Object.hasOwn(baseline.by_class, className)), {
    required_classes: baseline.required_classes,
    evaluated_classes: Object.keys(baseline.by_class)
  });
  record('PA-002-patient-recall-numeric', typeof baseline.am12_mapping.redaction_recall_patient_identifying_info === 'number'
    && Number.isFinite(baseline.am12_mapping.redaction_recall_patient_identifying_info), {
    value: baseline.am12_mapping.redaction_recall_patient_identifying_info
  });

  const absentPatientCorpus = deepClone(baseWorld.redaction_corpus);
  absentPatientCorpus.labels = absentPatientCorpus.labels.filter((row) => row.class !== 'patient_identifier');
  absentPatientCorpus.generated_detections = absentPatientCorpus.generated_detections.filter((row) => row.class !== 'patient_identifier');
  const absentPatient = evaluatePrivacyAggregate(absentPatientCorpus);
  record('PA-003-missing-required-class-fails', absentPatient.status === 'fail'
    && absentPatient.errors.some((row) => row.code === 'P_MISSING_REQUIRED_CLASS')
    && absentPatient.by_class.patient_identifier.recall === 0
    && absentPatient.by_class.patient_identifier.denominator_zero.recall === true, {
    status: absentPatient.status,
    patient_identifier: absentPatient.by_class.patient_identifier,
    error_codes: absentPatient.errors.map((row) => row.code)
  });

  const noPatientPredictionsCorpus = deepClone(baseWorld.redaction_corpus);
  noPatientPredictionsCorpus.generated_detections = noPatientPredictionsCorpus.generated_detections.filter((row) => row.class !== 'patient_identifier');
  const noPatientPredictions = evaluatePrivacyAggregate(noPatientPredictionsCorpus);
  record('PA-004-zero-prediction-denominator-explicit', noPatientPredictions.status === 'fail'
    && noPatientPredictions.by_class.patient_identifier.precision === 0
    && noPatientPredictions.by_class.patient_identifier.recall === 0
    && noPatientPredictions.by_class.patient_identifier.denominator_zero.precision === true
    && noPatientPredictions.by_class.patient_identifier.denominator_zero.recall === false, {
    patient_identifier: noPatientPredictions.by_class.patient_identifier
  });

  const emptyCorpus = { ...deepClone(baseWorld.redaction_corpus), labels: [], generated_detections: [] };
  const empty = evaluatePrivacyAggregate(emptyCorpus);
  record('PA-005-empty-corpus-denominators-explicit', empty.status === 'fail'
    && empty.aggregate.precision === 1
    && empty.aggregate.recall === 0
    && empty.aggregate.denominator_zero.precision === true
    && empty.aggregate.denominator_zero.recall === true
    && typeof empty.am12_mapping.redaction_recall_patient_identifying_info === 'number', {
    aggregate: empty.aggregate,
    patient_identifier_recall: empty.am12_mapping.redaction_recall_patient_identifying_info,
    denominator_policy: empty.denominator_policy
  });

  return tests;
}

export { ARTIFACT_PATHS };

import {
  CHANNELS,
  REQUIRED_RELEASE_VALIDATION_CHECK_IDS,
  STAT_CHANNEL_CONTRACTS,
} from './contracts.mjs';
import {
  assertClassAArtifact,
  scanClassASecrets,
  validateClassAArtifact,
} from './adapters/class-a.mjs';
import { projectDrillsAdapter, validateDailyRegistryRow } from './adapters/drills-v1.mjs';
import {
  assertExactStatDatasetQuestion,
  assertPostAnswerAccess,
  assertUniqueCompositeIdentities,
  buildCompositeIndexes,
  buildCompositeLookup,
  buildReleaseMembership,
  compositeQuestionIdentity,
  createHistoricalJoinIdentity,
  prepareStatRelease,
} from './adapters/stat-v1.mjs';
import { canonicalJson, sha256 } from './hash.mjs';

export {
  assertClassAArtifact,
  assertExactStatDatasetQuestion,
  assertPostAnswerAccess,
  assertUniqueCompositeIdentities,
  compositeQuestionIdentity,
  createHistoricalJoinIdentity,
  projectDrillsAdapter,
  validateClassAArtifact,
  validateDailyRegistryRow,
};

function assertFourChoices(revision) {
  if (!Array.isArray(revision.choices) || revision.choices.length !== 4) {
    throw new Error('exactly_four_choices_required');
  }
  const keys = revision.choices.map((choice) => choice.key);
  if (keys.join(',') !== 'A,B,C,D') {
    throw new Error('choice_keys_must_be_A_through_D');
  }
}

const STAT_CLASS_C_DEBRIEF_FIELDS = Object.freeze([
  'dataset_version',
  'question_id',
  'answer',
  'explanation',
  'correct_answer_rationale',
  'distractor_rationales',
]);

const STAT_CLASS_C_DISTRACTOR_RATIONALE_FIELDS = Object.freeze([
  'choice_key',
  'why_tempting',
  'why_wrong',
]);

const CLASS_D_FIELD_MARKER = /\b(?:item(?:[\s_-]*(?:rev|revision))?[\s_-]*ids?|revision[\s_-]*number|(?:vg|variant[\s_-]*group)[\s_-]*ids?|concept[\s_-]*ids?|misconception[\s_-]*ids?|source(?:[\s_-]*record)?[\s_-]*ids?|(?:evidence[\s_-]*)?claim[\s_-]*ids?|reviewer(?:[\s_-]*actor)?[\s_-]*(?:id|identity)|assignment[\s_-]*ids?|psychometric(?:s)?(?:[\s_-]*ids?)?|incident[\s_-]*ids?|content[\s_-]*hash|(?:taxonomy|blueprint|vocabulary|policy|prompt|pipeline|model)[\s_-]*version(?:[\s_-]*ids?)?|extraction[\s_-]*run[\s_-]*ids?|rights[\s_-]*record[\s_-]*ids?|(?:privacy[\s_-]*)?redaction[\s_-]*record[\s_-]*ids?)\b/iu;
const PUBLIC_IDENTIFIER_KEYS = new Set(['datasetversion', 'exportquestionid', 'questionid']);
const SECURITY_TEXT_MAX_BYTES = 64 * 1024;
const SECURITY_TEXT_MAX_DECODE_PASSES = 8;

function decodeCodePoint(raw, radix, original) {
  const codePoint = Number.parseInt(raw, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : original;
}

function decodeLeakTextPass(value) {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/gu, '')
    .replace(/\\u([0-9a-f]{4})/giu, (match, hex) => decodeCodePoint(hex, 16, match))
    .replace(/%([0-9a-f]{2})/giu, (match, hex) => decodeCodePoint(hex, 16, match))
    .replace(/&#x([0-9a-f]+);?/giu, (match, hex) => decodeCodePoint(hex, 16, match))
    .replace(/&#([0-9]+);?/gu, (match, decimal) => decodeCodePoint(decimal, 10, match))
    .normalize('NFKC');
}

function securityTextLimitError(reason) {
  const error = new Error(`class_c_security_decode_${reason}_limit`);
  error.code = `class_c_security_decode_${reason}_limit`;
  error.statusCode = 422;
  return error;
}

function decodeLeakText(value) {
  let decoded = String(value).normalize('NFKC');
  if (Buffer.byteLength(decoded, 'utf8') > SECURITY_TEXT_MAX_BYTES) {
    throw securityTextLimitError('size');
  }
  for (let pass = 0; pass < SECURITY_TEXT_MAX_DECODE_PASSES; pass += 1) {
    const next = decodeLeakTextPass(decoded);
    if (Buffer.byteLength(next, 'utf8') > SECURITY_TEXT_MAX_BYTES) {
      throw securityTextLimitError('size');
    }
    if (next === decoded) return next;
    decoded = next;
  }
  throw securityTextLimitError('depth');
}

function normalizeLeakValue(value) {
  return typeof value === 'string' ? decodeLeakText(value).trim().toLocaleLowerCase('en-US') : '';
}

function canonicalLeakValue(value) {
  return typeof value === 'string' ? decodeLeakText(value).trim() : '';
}

function classDIdentifierKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/giu, '').toLocaleLowerCase('en-US');
  if (!normalized || PUBLIC_IDENTIFIER_KEYS.has(normalized)) return false;
  return normalized === 'id'
    || normalized.endsWith('id')
    || normalized.endsWith('ids')
    || normalized.includes('hash')
    || normalized.includes('identity')
    || normalized.includes('identifier')
    || (normalized.endsWith('version')
      && /taxonomy|blueprint|vocabulary|policy|prompt|pipeline|model/u.test(normalized));
}

function addIdentifierValueVariants(value, output) {
  const canonical = canonicalLeakValue(value);
  const normalized = canonical.toLocaleLowerCase('en-US');
  if (normalized.length < 4) return;
  output.add(normalized);
  for (const variant of new Set([canonical, normalized])) {
    output.add(encodeURIComponent(variant).toLocaleLowerCase('en-US'));
    output.add(Buffer.from(variant, 'utf8').toString('base64').toLocaleLowerCase('en-US'));
    output.add(Buffer.from(variant, 'utf8').toString('base64url').toLocaleLowerCase('en-US'));
  }
}

function collectStringValues(value, output) {
  if (typeof value === 'string') {
    addIdentifierValueVariants(value, output);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringValues(entry, output));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStringValues(entry, output));
  }
}

export function collectClassDIdentifierValues(revision, additionalRecords = []) {
  const output = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (classDIdentifierKey(key)) collectStringValues(entry, output);
      if (entry && typeof entry === 'object') visit(entry);
    }
  };
  visit(revision);
  visit(additionalRecords);
  return [...output].sort();
}

function scanClassDProseValues(debrief, path, forbiddenValues, findings) {
  const proseEntries = [
    [`${path}.explanation`, debrief?.explanation],
    [`${path}.correct_answer_rationale`, debrief?.correct_answer_rationale],
  ];
  for (const [index, rationale] of (debrief?.distractor_rationales || []).entries()) {
    proseEntries.push(
      [`${path}.distractor_rationales[${index}].why_tempting`, rationale?.why_tempting],
      [`${path}.distractor_rationales[${index}].why_wrong`, rationale?.why_wrong],
    );
  }
  for (const [prosePath, value] of proseEntries) {
    if (typeof value !== 'string') continue;
    const normalized = normalizeLeakValue(value);
    if (CLASS_D_FIELD_MARKER.test(decodeLeakText(value))) {
      findings.push(`${prosePath}:class_d_field_marker`);
    }
    if (forbiddenValues.some((candidate) => candidate && normalized.includes(candidate))) {
      findings.push(`${prosePath}:class_d_identifier_value`);
    }
  }
}

function validateClosedWorldObject(value, allowedFields, path, findings) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    findings.push(`${path}:object_required`);
    return false;
  }
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push(`${path}.${key}:unknown_field`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) findings.push(`${path}.${key}:required_field`);
  }
  return true;
}

function validateRequiredString(value, path, findings) {
  if (typeof value !== 'string' || !value.trim()) findings.push(`${path}:string_required`);
}

export function validateClassCStatDebriefArtifact(payload, { classDValuesByIndex = [] } = {}) {
  const findings = [];
  if (!Array.isArray(payload)) {
    return ['$:array_required'];
  }
  payload.forEach((debrief, index) => {
    const path = `$[${index}]`;
    if (!validateClosedWorldObject(debrief, STAT_CLASS_C_DEBRIEF_FIELDS, path, findings)) return;
    validateRequiredString(debrief.dataset_version, `${path}.dataset_version`, findings);
    validateRequiredString(debrief.question_id, `${path}.question_id`, findings);
    if (!['A', 'B', 'C', 'D'].includes(debrief.answer)) findings.push(`${path}.answer:choice_key_required`);
    validateRequiredString(debrief.explanation, `${path}.explanation`, findings);
    validateRequiredString(debrief.correct_answer_rationale, `${path}.correct_answer_rationale`, findings);
    if (!Array.isArray(debrief.distractor_rationales) || debrief.distractor_rationales.length !== 3) {
      findings.push(`${path}.distractor_rationales:exactly_three_required`);
      return;
    }
    debrief.distractor_rationales.forEach((rationale, rationaleIndex) => {
      const rationalePath = `${path}.distractor_rationales[${rationaleIndex}]`;
      if (!validateClosedWorldObject(
        rationale,
        STAT_CLASS_C_DISTRACTOR_RATIONALE_FIELDS,
        rationalePath,
        findings,
      )) return;
      if (!['A', 'B', 'C', 'D'].includes(rationale.choice_key)) {
        findings.push(`${rationalePath}.choice_key:choice_key_required`);
      }
      validateRequiredString(rationale.why_tempting, `${rationalePath}.why_tempting`, findings);
      validateRequiredString(rationale.why_wrong, `${rationalePath}.why_wrong`, findings);
    });
    scanClassDProseValues(
      debrief,
      path,
      Array.isArray(classDValuesByIndex[index]) ? classDValuesByIndex[index] : [],
      findings,
    );
  });
  return [...new Set(findings)];
}

export function assertClassCStatDebriefArtifact(payload, options = {}) {
  const findings = validateClassCStatDebriefArtifact(payload, options);
  if (findings.length > 0) {
    const error = new Error('class_c_debrief_validation_failed');
    error.code = 'class_c_debrief_validation_failed';
    error.statusCode = 422;
    error.findings = findings;
    throw error;
  }
  return payload;
}

export function projectStatDatasetQuestion({ revision, datasetVersion, questionId }) {
  assertFourChoices(revision);
  const row = {
    dataset_version: datasetVersion,
    question_id: questionId,
    prompt: revision.prompt,
    choice_a: revision.choices[0].text,
    choice_b: revision.choices[1].text,
    choice_c: revision.choices[2].text,
    choice_d: revision.choices[3].text,
    answer: revision.answer,
    explanation: revision.explanation,
  };
  return assertExactStatDatasetQuestion(row);
}

export function projectStatPreAnswer(row) {
  return {
    dataset_version: row.dataset_version,
    question_id: row.question_id,
    prompt: row.prompt,
    choices: [row.choice_a, row.choice_b, row.choice_c, row.choice_d],
  };
}

export function projectStatDebrief(row, revision) {
  return {
    dataset_version: row.dataset_version,
    question_id: row.question_id,
    answer: row.answer,
    explanation: row.explanation,
    correct_answer_rationale: revision.correct_answer_rationale,
    distractor_rationales: revision.choices
      .filter((choice) => choice.key !== revision.answer)
      .map((choice) => ({
        choice_key: choice.key,
        why_tempting: choice.why_tempting,
        why_wrong: choice.why_wrong,
      })),
  };
}

export function projectQuestionMetadata({ revision, questionId, datasetVersion }) {
  return {
    dataset_version: datasetVersion,
    question_id: questionId,
    topic: revision.topic,
    subtopic: revision.subtopic || null,
    concept_id: revision.concept_id,
    source: 'I1Q',
  };
}

function artifact(channel, phase, dataClass, payload) {
  return {
    channel,
    phase,
    data_class: dataClass,
    payload,
    media_type: 'application/json',
    sha256: sha256(canonicalJson(payload)),
    record_count: Array.isArray(payload) ? payload.length : 1,
  };
}

function governedArtifact(channel, payload, validationOptions = {}) {
  const contract = STAT_CHANNEL_CONTRACTS[channel];
  if (!contract) throw new Error(`channel_contract_required:${channel}`);
  if (channel === 'stat_post_answer_debrief') assertClassCStatDebriefArtifact(payload, validationOptions);
  return artifact(channel, contract.phase, contract.data_class, payload);
}

export function buildReleaseArtifacts({
  releaseId,
  datasetVersion,
  revisions,
  previousManifestHash = null,
  additionalClassDRecordsByRevisionId = {},
}) {
  const entries = prepareStatRelease({ datasetVersion, revisions });
  const datasetRows = entries.map((entry) => projectStatDatasetQuestion({
    revision: entry.revision,
    datasetVersion: entry.dataset_version,
    questionId: entry.question_id,
  }));
  const preAnswer = datasetRows.map(projectStatPreAnswer);
  const debrief = datasetRows.map((row, index) => projectStatDebrief(row, entries[index].revision));
  const metadata = datasetRows.map((row, index) => projectQuestionMetadata({
    revision: entries[index].revision,
    questionId: row.question_id,
    datasetVersion: row.dataset_version,
  }));
  const lookup = buildCompositeLookup(entries);
  const indexes = buildCompositeIndexes(metadata);
  const drills = entries.map(({ revision }) => projectDrillsAdapter({ revision, releaseId }));
  const releaseMembership = buildReleaseMembership(entries);
  const classDValuesByIndex = entries.map(({ revision }) => collectClassDIdentifierValues(
    revision,
    additionalClassDRecordsByRevisionId?.[revision.id] || [],
  ));

  assertClassAArtifact('stat_pre_answer', preAnswer);
  assertClassAArtifact('stat_indexes', indexes);
  assertClassAArtifact('stat_lookup', lookup);

  const artifacts = [
    governedArtifact('stat_dataset_questions', datasetRows),
    governedArtifact('stat_pre_answer', preAnswer),
    governedArtifact('stat_post_answer_debrief', debrief, { classDValuesByIndex }),
    governedArtifact('stat_indexes', indexes),
    governedArtifact('stat_lookup', lookup),
    governedArtifact('question_metadata', metadata),
    governedArtifact('drills', drills),
  ];

  const futureChannels = CHANNELS.filter((channel) => !artifacts.some((entry) => entry.channel === channel));
  for (const channel of futureChannels) {
    artifacts.push(artifact(channel, 'contract_only', 'contract_only', []));
  }

  const manifestPayload = {
    release_id: releaseId,
    dataset_version: datasetVersion,
    previous_manifest_hash: previousManifestHash,
    release_membership: releaseMembership,
    artifact_hashes: artifacts.map(({ channel, phase, data_class: dataClass, sha256: artifactHash, record_count: recordCount }) => ({
      channel,
      phase,
      data_class: dataClass,
      sha256: artifactHash,
      record_count: recordCount,
    })),
  };
  return {
    manifest: {
      ...manifestPayload,
      manifest_hash: sha256(manifestPayload),
    },
    artifacts,
  };
}

export function scanForAnswerLeak(value, path = '$') {
  return scanClassASecrets(value, path);
}

export function releaseValidationEvidenceHash({ releaseId, manifestHash, artifacts, checks }) {
  const normalizedChecks = checks
    .map(({ id, status }) => ({ id: String(id), status: String(status) }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const normalizedArtifacts = artifacts
    .map((entry) => ({
      channel: String(entry.channel),
      phase: String(entry.phase),
      data_class: String(entry.data_class),
      sha256: String(entry.sha256 || entry.artifact_hash || ''),
      record_count: Number(entry.record_count),
    }))
    .sort((left, right) => left.channel.localeCompare(right.channel));
  if (
    normalizedChecks.length !== REQUIRED_RELEASE_VALIDATION_CHECK_IDS.length
    || normalizedChecks.some((check, index) => (
      check.id !== REQUIRED_RELEASE_VALIDATION_CHECK_IDS[index]
      || check.status !== 'pass'
    ))
  ) {
    throw new Error('official_validator_checks_required');
  }
  const lengthPrefixed = (value) => {
    const normalized = String(value).normalize('NFC');
    return `${Buffer.byteLength(normalized, 'utf8')}:${normalized}`;
  };
  const fields = [
    'i1q.release-validation.v1',
    String(releaseId),
    String(manifestHash),
    ...normalizedArtifacts.flatMap((artifact) => [
      artifact.channel,
      artifact.phase,
      artifact.data_class,
      artifact.sha256,
      String(artifact.record_count),
    ]),
    ...normalizedChecks.flatMap((check) => [check.id, check.status]),
  ];
  return sha256(fields.map(lengthPrefixed).join('|'));
}

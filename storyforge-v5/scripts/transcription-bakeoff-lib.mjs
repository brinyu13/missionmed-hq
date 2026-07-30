import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const bakeoffSchemaVersion = 1;
export const bakeoffNormalizationVersion = 'b1-506-standard-v1';

const sha256Pattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const sourceKinds = new Set(['human', 'tts']);
const requiredAccentGroups = Object.freeze([
  'south_asian',
  'west_african',
  'east_asian',
  'latin_american',
  'middle_eastern',
  'north_american',
]);
const requiredMedicalTerms = Object.freeze([
  'enoxaparin',
  'metoprolol',
  'lasix',
  'troponin',
  'whipple',
  'paracentesis',
  'anastomosis',
  'cbc',
  'nstemi',
  'pea',
  'or',
  'icu',
]);
const requiredSpecialties = Object.freeze([
  'internal_medicine',
  'emergency_medicine',
  'obstetrics_gynecology',
  'surgery',
  'pediatrics',
  'psychiatry',
]);
const requiredCoverageTags = Object.freeze([
  'lab_values',
  'spoken_numbers',
]);
const consentBases = new Set([
  'new_consenting_adult',
  'existing_corpus_verified_consent',
  'not_applicable_tts',
]);
const requiredConditions = Object.freeze([
  'quiet',
  'laptop_microphone',
  'iphone_product_capture',
  'android_product_capture',
  'ward_noise',
  'whisper',
]);
const maxTranscriptBytes = 256 * 1024;
const maxTranscriptWords = 2_000;
const maxAudioBytes = 25 * 1024 * 1024;
const maxConsentBytes = 1024 * 1024;
const maxEvidenceJsonBytes = 2 * 1024 * 1024;
const provenanceArtifactFields = Object.freeze([
  'adapterSource',
  'configurationReceipt',
  'productionAccountRegionReceipt',
  'rawRunReceipt',
]);

export class BakeoffEvidenceError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'BakeoffEvidenceError';
    this.code = code;
  }
}

function fail(code, message, options = {}) {
  throw new BakeoffEvidenceError(code, message, options);
}

function record(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNonnegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function safeArtifact(artifact, label) {
  if (!record(artifact)) fail('invalid_artifact', `${label} must be an artifact object.`);
  rejectUnknownKeys(artifact, ['path', 'sha256'], label);
  const relativePath = String(artifact.path || '');
  if (
    !relativePath
    || path.isAbsolute(relativePath)
    || relativePath.includes('\0')
    || relativePath.split(/[\\/]/).includes('..')
  ) {
    fail('unsafe_artifact_path', `${label} must use a bounded relative path.`);
  }
  if (!sha256Pattern.test(String(artifact.sha256 || ''))) {
    fail('invalid_artifact_hash', `${label} must pin a lowercase SHA-256.`);
  }
}

function rejectUnknownKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail('unknown_evidence_field', `${label} contains an unknown field.`);
  }
}

function requireId(value, label) {
  const id = String(value || '');
  if (!idPattern.test(id)) fail('invalid_evidence_id', `${label} is invalid.`);
  return id;
}

function rounded(value, places = 6) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(places));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (record(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeBakeoffText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value) {
  const normalized = normalizeBakeoffText(value);
  return normalized ? normalized.split(' ') : [];
}

export function alignBakeoffWords(referenceText, hypothesisText) {
  const reference = words(referenceText);
  const hypothesis = words(hypothesisText);
  if (!reference.length) {
    fail('empty_reference_text', 'A verified reference transcript is empty.');
  }
  if (reference.length > maxTranscriptWords || hypothesis.length > maxTranscriptWords) {
    fail('transcript_word_limit', 'A transcript exceeds the scorer word limit.');
  }
  const matrix = Array.from(
    { length: reference.length + 1 },
    () => new Uint32Array(hypothesis.length + 1),
  );

  for (let row = 0; row <= reference.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= hypothesis.length; column += 1) {
    matrix[0][column] = column;
  }
  for (let row = 1; row <= reference.length; row += 1) {
    for (let column = 1; column <= hypothesis.length; column += 1) {
      const substitution = matrix[row - 1][column - 1]
        + (reference[row - 1] === hypothesis[column - 1] ? 0 : 1);
      const deletion = matrix[row - 1][column] + 1;
      const insertion = matrix[row][column - 1] + 1;
      matrix[row][column] = Math.min(substitution, deletion, insertion);
    }
  }

  const operations = [];
  let row = reference.length;
  let column = hypothesis.length;
  while (row > 0 || column > 0) {
    if (
      row > 0
      && column > 0
      && reference[row - 1] === hypothesis[column - 1]
      && matrix[row][column] === matrix[row - 1][column - 1]
    ) {
      operations.push({
        kind: 'equal',
        referenceIndex: row - 1,
        hypothesisIndex: column - 1,
      });
      row -= 1;
      column -= 1;
      continue;
    }

    const substitution = row > 0 && column > 0
      ? matrix[row - 1][column - 1] + 1
      : Number.POSITIVE_INFINITY;
    const deletion = row > 0
      ? matrix[row - 1][column] + 1
      : Number.POSITIVE_INFINITY;
    const insertion = column > 0
      ? matrix[row][column - 1] + 1
      : Number.POSITIVE_INFINITY;
    const current = matrix[row][column];

    if (substitution === current && substitution <= deletion && substitution <= insertion) {
      operations.push({
        kind: 'substitute',
        referenceIndex: row - 1,
        hypothesisIndex: column - 1,
      });
      row -= 1;
      column -= 1;
    } else if (deletion === current && deletion <= insertion) {
      operations.push({
        kind: 'delete',
        referenceIndex: row - 1,
        hypothesisIndex: null,
      });
      row -= 1;
    } else {
      operations.push({
        kind: 'insert',
        referenceIndex: null,
        referenceBoundary: row,
        hypothesisIndex: column - 1,
      });
      column -= 1;
    }
  }

  operations.reverse();
  const counts = {
    referenceWords: reference.length,
    hypothesisWords: hypothesis.length,
    substitutions: operations.filter((item) => item.kind === 'substitute').length,
    deletions: operations.filter((item) => item.kind === 'delete').length,
    insertions: operations.filter((item) => item.kind === 'insert').length,
  };
  return Object.freeze({
    ...counts,
    errors: counts.substitutions + counts.deletions + counts.insertions,
    operations: Object.freeze(operations),
    reference: Object.freeze(reference),
  });
}

function locateTerm(referenceWords, termWords, occurrence) {
  let observed = 0;
  for (let start = 0; start <= referenceWords.length - termWords.length; start += 1) {
    if (termWords.every((word, offset) => referenceWords[start + offset] === word)) {
      observed += 1;
      if (observed === occurrence) return { start, end: start + termWords.length };
    }
  }
  return null;
}

export function scoreBakeoffTranscript(referenceText, hypothesisText, medicalTerms = []) {
  const alignment = alignBakeoffWords(referenceText, hypothesisText);
  const byReferenceIndex = new Map();
  for (const operation of alignment.operations) {
    if (operation.referenceIndex !== null) {
      byReferenceIndex.set(operation.referenceIndex, operation.kind);
    }
  }

  let medicalRecalled = 0;
  let medicalSubstituted = 0;
  for (const tag of medicalTerms) {
    const term = words(tag?.term);
    if (!term.length) fail('invalid_medical_term', 'Medical terms must contain words.');
    const occurrence = Number(tag?.occurrence);
    if (!Number.isInteger(occurrence) || occurrence < 1) {
      fail('invalid_medical_term', 'Medical terms require a positive occurrence.');
    }
    const span = locateTerm(alignment.reference, term, occurrence);
    if (!span) {
      fail(
        'medical_term_missing_from_reference',
        'A tagged medical term is absent from its verified reference.',
      );
    }
    const kinds = [];
    for (let index = span.start; index < span.end; index += 1) {
      kinds.push(byReferenceIndex.get(index));
    }
    const hasInternalInsertion = alignment.operations.some((operation) => (
      operation.kind === 'insert'
      && operation.referenceBoundary > span.start
      && operation.referenceBoundary < span.end
    ));
    if (kinds.every((kind) => kind === 'equal') && !hasInternalInsertion) {
      medicalRecalled += 1;
    }
    if (kinds.some((kind) => kind === 'substitute')) medicalSubstituted += 1;
  }

  return Object.freeze({
    referenceWords: alignment.referenceWords,
    hypothesisWords: alignment.hypothesisWords,
    substitutions: alignment.substitutions,
    deletions: alignment.deletions,
    insertions: alignment.insertions,
    errors: alignment.errors,
    medicalExpected: medicalTerms.length,
    medicalRecalled,
    medicalSubstituted,
  });
}

export function validateBakeoffManifest(manifest) {
  if (!record(manifest) || manifest.schemaVersion !== bakeoffSchemaVersion) {
    fail('invalid_corpus_manifest', 'Corpus manifest schemaVersion must be 1.');
  }
  rejectUnknownKeys(manifest, ['schemaVersion', 'passages'], 'Corpus manifest');
  if (!Array.isArray(manifest.passages) || manifest.passages.length !== 40) {
    fail('invalid_corpus_manifest', 'The governed corpus must contain exactly 40 passages.');
  }

  const ids = new Set();
  const accentGroups = new Set();
  const conditions = new Set();
  const whisperGroups = new Set();
  const audioArtifacts = new Set();
  const referenceArtifacts = new Set();
  const coveredMedicalTerms = new Set();
  const coveredSpecialties = new Set();
  const coveredTags = new Set();
  for (const passage of manifest.passages) {
    if (!record(passage)) fail('invalid_corpus_manifest', 'Every passage must be an object.');
    const id = requireId(passage.id, 'Passage id');
    rejectUnknownKeys(passage, [
      'id',
      'sourceKind',
      'consentBasis',
      'consentArtifact',
      'accentScorable',
      'accentGroup',
      'durationMs',
      'conditions',
      'medicalTerms',
      'specialties',
      'coverageTags',
      'audio',
      'reference',
      'referenceVerified',
    ], `Passage ${id}`);
    if (ids.has(id)) fail('invalid_corpus_manifest', 'Passage ids must be unique.');
    ids.add(id);
    if (!sourceKinds.has(passage.sourceKind)) {
      fail('invalid_corpus_manifest', `Passage ${id} has an invalid source kind.`);
    }
    if (!consentBases.has(passage.consentBasis)) {
      fail('invalid_corpus_manifest', `Passage ${id} has an invalid consent basis.`);
    }
    if (passage.sourceKind === 'tts') {
      if (passage.accentScorable !== false || passage.consentBasis !== 'not_applicable_tts') {
        fail('invalid_corpus_manifest', `TTS passage ${id} cannot enter accent scoring.`);
      }
    } else {
      if (passage.consentBasis === 'not_applicable_tts') {
        fail('invalid_corpus_manifest', `Human passage ${id} requires recorded consent.`);
      }
      safeArtifact(passage.consentArtifact, `Passage ${id} consent`);
    }
    if (!finiteNonnegative(passage.durationMs)
      || Number(passage.durationMs) < 30_000
      || Number(passage.durationMs) > 90_000) {
      fail('invalid_corpus_manifest', `Passage ${id} must be 30 to 90 seconds.`);
    }
    if (!Array.isArray(passage.conditions) || passage.conditions.length === 0) {
      fail('invalid_corpus_manifest', `Passage ${id} requires capture conditions.`);
    }
    for (const condition of passage.conditions) {
      if (!requiredConditions.includes(condition)) {
        fail('invalid_corpus_manifest', `Passage ${id} has an unknown condition.`);
      }
      if (passage.sourceKind === 'human') conditions.add(condition);
    }
    if (!Array.isArray(passage.medicalTerms) || passage.medicalTerms.length === 0) {
      fail('invalid_corpus_manifest', `Passage ${id} requires medical-term tags.`);
    }
    const passageTerms = new Set();
    for (const medicalTerm of passage.medicalTerms) {
      if (!record(medicalTerm)) {
        fail('invalid_corpus_manifest', `Passage ${id} has invalid medical-term tags.`);
      }
      rejectUnknownKeys(medicalTerm, ['term', 'occurrence'], `Passage ${id} medical term`);
      const normalized = normalizeBakeoffText(medicalTerm?.term);
      const occurrence = Number(medicalTerm?.occurrence);
      const tagKey = `${normalized}\0${occurrence}`;
      if (
        !normalized
        || !Number.isInteger(occurrence)
        || occurrence < 1
        || passageTerms.has(tagKey)
      ) {
        fail('invalid_corpus_manifest', `Passage ${id} has invalid medical-term tags.`);
      }
      passageTerms.add(tagKey);
      coveredMedicalTerms.add(normalized);
    }
    if (!Array.isArray(passage.specialties) || passage.specialties.length === 0) {
      fail('invalid_corpus_manifest', `Passage ${id} requires specialty coverage.`);
    }
    for (const specialty of passage.specialties) {
      if (!requiredSpecialties.includes(specialty)) {
        fail('invalid_corpus_manifest', `Passage ${id} has an unknown specialty.`);
      }
      coveredSpecialties.add(specialty);
    }
    if (!Array.isArray(passage.coverageTags) || passage.coverageTags.length === 0) {
      fail('invalid_corpus_manifest', `Passage ${id} requires coverage tags.`);
    }
    for (const coverageTag of passage.coverageTags) {
      if (!requiredCoverageTags.includes(coverageTag)) {
        fail('invalid_corpus_manifest', `Passage ${id} has an unknown coverage tag.`);
      }
      coveredTags.add(coverageTag);
    }
    safeArtifact(passage.audio, `Passage ${id} audio`);
    safeArtifact(passage.reference, `Passage ${id} reference`);
    for (const [artifactKind, artifactValue, registry] of [
      ['audio', passage.audio, audioArtifacts],
      ['reference', passage.reference, referenceArtifacts],
    ]) {
      const pathKey = `path:${artifactValue.path}`;
      const hashKey = `hash:${artifactValue.sha256}`;
      if (registry.has(pathKey) || registry.has(hashKey)) {
        fail('invalid_corpus_manifest', `Passage ${artifactKind} artifacts must be unique.`);
      }
      registry.add(pathKey);
      registry.add(hashKey);
    }
    if (passage.referenceVerified !== true) {
      fail('invalid_corpus_manifest', `Passage ${id} reference is not hand-verified.`);
    }
    if (passage.accentScorable === true) {
      if (passage.sourceKind !== 'human') {
        fail('invalid_corpus_manifest', `Passage ${id} accent source must be human.`);
      }
      const accentGroup = requireId(passage.accentGroup, `Passage ${id} accent group`);
      accentGroups.add(accentGroup);
      if (passage.conditions.includes('whisper')) whisperGroups.add(accentGroup);
    }
  }
  if (accentGroups.size < 6) {
    fail('invalid_corpus_manifest', 'The corpus requires at least six human accent groups.');
  }
  for (const accentGroup of requiredAccentGroups) {
    if (!accentGroups.has(accentGroup)) {
      fail('invalid_corpus_manifest', `The corpus is missing the ${accentGroup} accent group.`);
    }
  }
  for (const condition of requiredConditions) {
    if (!conditions.has(condition)) {
      fail('invalid_corpus_manifest', `The corpus is missing the ${condition} condition.`);
    }
  }
  for (const accentGroup of accentGroups) {
    if (!whisperGroups.has(accentGroup)) {
      fail('invalid_corpus_manifest', 'Every scored accent group requires a whisper take.');
    }
  }
  for (const medicalTerm of requiredMedicalTerms) {
    if (!coveredMedicalTerms.has(medicalTerm)) {
      fail('invalid_corpus_manifest', `The corpus is missing the ${medicalTerm} term.`);
    }
  }
  for (const specialty of requiredSpecialties) {
    if (!coveredSpecialties.has(specialty)) {
      fail('invalid_corpus_manifest', `The corpus is missing ${specialty} coverage.`);
    }
  }
  for (const coverageTag of requiredCoverageTags) {
    if (!coveredTags.has(coverageTag)) {
      fail('invalid_corpus_manifest', `The corpus is missing ${coverageTag} coverage.`);
    }
  }
  return true;
}

export function validateBakeoffCandidateRuns(candidateRuns, manifest) {
  if (!record(candidateRuns) || candidateRuns.schemaVersion !== bakeoffSchemaVersion) {
    fail('invalid_candidate_runs', 'Candidate runs schemaVersion must be 1.');
  }
  rejectUnknownKeys(
    candidateRuns,
    ['schemaVersion', 'candidateId', 'samples', 'provenance'],
    'Candidate runs',
  );
  requireId(candidateRuns.candidateId, 'Candidate id');
  if (!Array.isArray(candidateRuns.samples)) {
    fail('invalid_candidate_runs', 'Candidate samples must be an array.');
  }
  const passageIds = new Set(manifest.passages.map((passage) => passage.id));
  const seen = new Set();
  const transcriptPaths = new Set();
  for (const sample of candidateRuns.samples) {
    if (!record(sample) || !passageIds.has(sample.passageId)) {
      fail('invalid_candidate_runs', 'A candidate sample references an unknown passage.');
    }
    rejectUnknownKeys(sample, [
      'passageId',
      'run',
      'transcript',
      'firstTextMs',
      'finalTextMs',
      'segmentCalls',
      'failedAfterRetryCalls',
      'costUsd',
    ], 'Candidate sample');
    if (![1, 2, 3].includes(sample.run)) {
      fail('invalid_candidate_runs', 'Every sample run must be 1, 2, or 3.');
    }
    const key = `${sample.passageId}:${sample.run}`;
    if (seen.has(key)) fail('invalid_candidate_runs', 'Candidate samples must be unique.');
    seen.add(key);
    safeArtifact(sample.transcript, `Sample ${key} transcript`);
    if (transcriptPaths.has(sample.transcript.path)) {
      fail('invalid_candidate_runs', 'Every candidate run requires its own transcript artifact.');
    }
    transcriptPaths.add(sample.transcript.path);
    for (const field of ['firstTextMs', 'finalTextMs', 'costUsd']) {
      if (!finiteNonnegative(sample[field])) {
        fail('invalid_candidate_runs', `Sample ${key} has invalid ${field}.`);
      }
    }
    if (!Number.isInteger(sample.segmentCalls) || sample.segmentCalls < 1) {
      fail('invalid_candidate_runs', `Sample ${key} has invalid segmentCalls.`);
    }
    if (
      !Number.isInteger(sample.failedAfterRetryCalls)
      || sample.failedAfterRetryCalls < 0
      || sample.failedAfterRetryCalls > sample.segmentCalls
    ) {
      fail('invalid_candidate_runs', `Sample ${key} has invalid failure accounting.`);
    }
  }
  if (seen.size !== manifest.passages.length * 3) {
    fail('invalid_candidate_runs', 'Every passage requires exactly three candidate runs.');
  }
  const provenance = candidateRuns.provenance;
  if (!record(provenance) || !/^[a-f0-9]{40}$/.test(String(provenance.sourceCommit || ''))) {
    fail('invalid_candidate_runs', 'Candidate provenance must pin the source commit.');
  }
  rejectUnknownKeys(
    provenance,
    ['sourceCommit', ...provenanceArtifactFields],
    'Candidate provenance',
  );
  for (const field of provenanceArtifactFields) {
    safeArtifact(provenance[field], `Candidate provenance ${field}`);
  }
  return true;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(fraction * ordered.length) - 1)];
}

function textValue(collection, key, code) {
  const value = collection instanceof Map ? collection.get(key) : collection?.[key];
  if (typeof value !== 'string') fail(code, 'A verified transcript artifact is missing.');
  return value;
}

export function scoreBakeoffEvidence({
  manifest,
  candidateRuns,
  referenceTextByPassage,
  transcriptTextBySample,
  rawInputDigests = {},
}) {
  validateBakeoffManifest(manifest);
  validateBakeoffCandidateRuns(candidateRuns, manifest);

  const passages = new Map(manifest.passages.map((passage) => [passage.id, passage]));
  const total = {
    referenceWords: 0,
    errors: 0,
    substitutions: 0,
    deletions: 0,
    insertions: 0,
    medicalExpected: 0,
    medicalRecalled: 0,
    medicalSubstituted: 0,
    recordingMs: 0,
    costUsd: 0,
    segmentCalls: 0,
    failedAfterRetryCalls: 0,
  };
  const accent = new Map();
  const firstText = [];
  const finalText = [];

  for (const sample of candidateRuns.samples) {
    const passage = passages.get(sample.passageId);
    const score = scoreBakeoffTranscript(
      textValue(referenceTextByPassage, sample.passageId, 'missing_reference_text'),
      textValue(
        transcriptTextBySample,
        `${sample.passageId}:${sample.run}`,
        'missing_candidate_transcript',
      ),
      passage.medicalTerms,
    );
    for (const field of [
      'referenceWords',
      'errors',
      'substitutions',
      'deletions',
      'insertions',
      'medicalExpected',
      'medicalRecalled',
      'medicalSubstituted',
    ]) {
      total[field] += score[field];
    }
    total.recordingMs += Number(passage.durationMs);
    total.costUsd += Number(sample.costUsd);
    total.segmentCalls += sample.segmentCalls;
    total.failedAfterRetryCalls += sample.failedAfterRetryCalls;
    firstText.push(Number(sample.firstTextMs));
    finalText.push(Number(sample.finalTextMs));

    if (passage.accentScorable === true) {
      const group = accent.get(passage.accentGroup) || { referenceWords: 0, errors: 0 };
      group.referenceWords += score.referenceWords;
      group.errors += score.errors;
      accent.set(passage.accentGroup, group);
    }
  }

  const accentRows = [...accent.entries()]
    .map(([accentGroup, counts]) => ({
      accentGroup,
      referenceWords: counts.referenceWords,
      errors: counts.errors,
      wer: rounded(counts.errors / counts.referenceWords),
    }))
    .sort((left, right) => left.accentGroup.localeCompare(right.accentGroup));
  const accentReferenceWords = accentRows.reduce((sum, row) => sum + row.referenceWords, 0);
  const accentErrors = accentRows.reduce((sum, row) => sum + row.errors, 0);
  const accentMeanWer = accentReferenceWords ? accentErrors / accentReferenceWords : 0;
  const maxAccentWer = accentRows.length ? Math.max(...accentRows.map((row) => row.wer)) : 0;
  const artifactDigest = (artifacts) => sha256(
    [...artifacts]
      .map((artifactValue) => `${artifactValue.path}\0${artifactValue.sha256}`)
      .sort()
      .join('\n'),
  );
  const inputDigests = {
    corpusManifestCanonicalSha256: sha256(stableJson(manifest)),
    candidateRunsCanonicalSha256: sha256(stableJson(candidateRuns)),
    audioArtifactSetSha256: artifactDigest(
      manifest.passages.map((passage) => passage.audio),
    ),
    referenceArtifactSetSha256: artifactDigest(
      manifest.passages.map((passage) => passage.reference),
    ),
    consentArtifactSetSha256: artifactDigest(
      manifest.passages
        .filter((passage) => passage.sourceKind === 'human')
        .map((passage) => passage.consentArtifact),
    ),
    transcriptArtifactSetSha256: artifactDigest(
      candidateRuns.samples.map((sample) => sample.transcript),
    ),
  };
  for (const [key, value] of Object.entries(rawInputDigests)) {
    if (!sha256Pattern.test(String(value || ''))) {
      fail('invalid_input_digest', 'A raw input digest is invalid.');
    }
    inputDigests[key] = value;
  }
  const provenance = {
    sourceCommit: candidateRuns.provenance.sourceCommit,
  };
  for (const field of provenanceArtifactFields) {
    provenance[`${field}Sha256`] = candidateRuns.provenance[field].sha256;
  }
  const corpusAudioMs = manifest.passages.reduce(
    (sum, passage) => sum + Number(passage.durationMs),
    0,
  );
  const metricsUsableForActivation = manifest.passages.every(
    (passage) => passage.sourceKind === 'human'
      && passage.consentBasis !== 'not_applicable_tts'
      && passage.consentArtifact,
  );

  return Object.freeze({
    schemaVersion: bakeoffSchemaVersion,
    normalizationVersion: bakeoffNormalizationVersion,
    candidateId: candidateRuns.candidateId,
    evidenceStatus: 'raw_metrics_only_no_cutover_verdict',
    authorityStatus: 'b1_506a_scoring_semantics_binding',
    metricsUsableForActivation,
    provenance: Object.freeze(provenance),
    inputDigests: Object.freeze(inputDigests),
    aggregation: Object.freeze({
      wordErrorRate: 'micro_average_edit_counts',
      accentMean: 'micro_average_accent_eligible_words',
      percentile: 'nearest_rank',
    }),
    nonAuthoritativeChoices: Object.freeze([
      'unicode_nfkc_lowercase_punctuation_and_symbol_removal',
      'medical_terms_are_exact_normalized_contiguous_spans',
      'accent_mean_is_word_weighted_across_accent_eligible_rows',
      'p95_uses_nearest_rank',
    ]),
    corpus: Object.freeze({
      passages: manifest.passages.length,
      samples: candidateRuns.samples.length,
      accentGroups: accentRows.length,
      corpusAudioMinutes: rounded(corpusAudioMs / 60_000),
      evaluatedAudioMinutes: rounded(total.recordingMs / 60_000),
    }),
    counts: Object.freeze(total),
    metrics: Object.freeze({
      wer: rounded(total.errors / total.referenceWords),
      medicalRecall: total.medicalExpected
        ? rounded(total.medicalRecalled / total.medicalExpected)
        : null,
      medicalSubstitutionRate: total.medicalExpected
        ? rounded(total.medicalSubstituted / total.medicalExpected)
        : null,
      accentDegradationPoints: rounded((maxAccentWer - accentMeanWer) * 100),
      firstTextP95Ms: percentile(firstText, 0.95),
      finalTextP95Ms: percentile(finalText, 0.95),
      failureAfterRetryRate: rounded(
        total.failedAfterRetryCalls / total.segmentCalls,
      ),
      costPerRecordingMinuteUsd: rounded(
        total.costUsd / (total.recordingMs / 60_000),
      ),
    }),
    accent: Object.freeze(accentRows),
  });
}

async function readJsonEvidence(filePath, code) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size > maxEvidenceJsonBytes) {
      fail(code, 'Evidence JSON is not a bounded regular file.');
    }
    const bytes = await readFile(filePath);
    return {
      data: JSON.parse(bytes.toString('utf8')),
      sha256: sha256(bytes),
    };
  } catch (error) {
    fail(code, 'Evidence JSON could not be read or parsed.', { cause: error });
  }
}

async function readVerifiedArtifact(
  baseDir,
  artifact,
  label,
  { encoding = null, maxBytes } = {},
) {
  safeArtifact(artifact, label);
  let bytes;
  try {
    const realBase = await realpath(baseDir);
    const realArtifact = await realpath(path.resolve(baseDir, artifact.path));
    if (
      realArtifact !== realBase
      && !realArtifact.startsWith(`${realBase}${path.sep}`)
    ) {
      fail('artifact_outside_evidence_root', `${label} leaves its evidence root.`);
    }
    const artifactStat = await stat(realArtifact);
    if (!artifactStat.isFile()) {
      fail('artifact_not_regular_file', `${label} is not a regular file.`);
    }
    if (artifactStat.size > maxBytes) {
      fail('artifact_size_limit', `${label} exceeds its evidence size limit.`);
    }
    bytes = await readFile(realArtifact);
  } catch (error) {
    if (error instanceof BakeoffEvidenceError) throw error;
    throw new BakeoffEvidenceError(
      'artifact_read_failed',
      `${label} could not be read.`,
      { cause: error },
    );
  }
  const observed = createHash('sha256').update(bytes).digest('hex');
  if (observed !== artifact.sha256) {
    fail('artifact_hash_mismatch', `${label} does not match its pinned SHA-256.`);
  }
  return encoding ? bytes.toString(encoding) : bytes;
}

export async function loadAndScoreBakeoff(manifestPath, candidateRunsPath) {
  const manifestEvidence = await readJsonEvidence(
    manifestPath,
    'corpus_manifest_unreadable',
  );
  const candidateEvidence = await readJsonEvidence(
    candidateRunsPath,
    'candidate_runs_unreadable',
  );
  const manifest = manifestEvidence.data;
  const candidateRuns = candidateEvidence.data;
  validateBakeoffManifest(manifest);
  validateBakeoffCandidateRuns(candidateRuns, manifest);

  const referenceTextByPassage = new Map();
  for (const passage of manifest.passages) {
    await readVerifiedArtifact(
      path.dirname(manifestPath),
      passage.audio,
      `Passage ${passage.id} audio`,
      { maxBytes: maxAudioBytes },
    );
    if (passage.sourceKind === 'human') {
      await readVerifiedArtifact(
        path.dirname(manifestPath),
        passage.consentArtifact,
        `Passage ${passage.id} consent`,
        { maxBytes: maxConsentBytes },
      );
    }
    referenceTextByPassage.set(
      passage.id,
      await readVerifiedArtifact(
        path.dirname(manifestPath),
        passage.reference,
        `Passage ${passage.id} reference`,
        { encoding: 'utf8', maxBytes: maxTranscriptBytes },
      ),
    );
  }

  const transcriptTextBySample = new Map();
  for (const sample of candidateRuns.samples) {
    const key = `${sample.passageId}:${sample.run}`;
    transcriptTextBySample.set(
      key,
      await readVerifiedArtifact(
        path.dirname(candidateRunsPath),
        sample.transcript,
        `Sample ${key} transcript`,
        { encoding: 'utf8', maxBytes: maxTranscriptBytes },
      ),
    );
  }
  for (const field of provenanceArtifactFields) {
    await readVerifiedArtifact(
      path.dirname(candidateRunsPath),
      candidateRuns.provenance[field],
      `Candidate provenance ${field}`,
      { maxBytes: maxConsentBytes },
    );
  }

  return scoreBakeoffEvidence({
    manifest,
    candidateRuns,
    referenceTextByPassage,
    transcriptTextBySample,
    rawInputDigests: {
      corpusManifestFileSha256: manifestEvidence.sha256,
      candidateRunsFileSha256: candidateEvidence.sha256,
    },
  });
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  alignBakeoffWords,
  bakeoffNormalizationVersion,
  loadAndScoreBakeoff,
  normalizeBakeoffText,
  scoreBakeoffEvidence,
  scoreBakeoffTranscript,
  validateBakeoffCandidateRuns,
  validateBakeoffManifest,
} from '../../scripts/transcription-bakeoff-lib.mjs';

const accents = [
  'south_asian',
  'west_african',
  'east_asian',
  'latin_american',
  'middle_eastern',
  'north_american',
];
const conditions = [
  'quiet',
  'laptop_microphone',
  'iphone_product_capture',
  'android_product_capture',
  'ward_noise',
  'whisper',
];
const artifact = (name) => ({
  path: `${name}.txt`,
  sha256: createHash('sha256').update(name).digest('hex'),
});
const digest = (value) => createHash('sha256').update(value).digest('hex');
const governedTerms = [
  'enoxaparin',
  'metoprolol',
  'Lasix',
  'troponin',
  'Whipple',
  'paracentesis',
  'anastomosis',
  'CBC',
  'NSTEMI',
  'PEA',
  'OR',
  'ICU',
];
const specialties = [
  'internal_medicine',
  'emergency_medicine',
  'obstetrics_gynecology',
  'surgery',
  'pediatrics',
  'psychiatry',
];
const coverageTags = ['lab_values', 'spoken_numbers'];

function fixture() {
  const passages = Array.from({ length: 40 }, (_, index) => {
    const accentGroup = accents[index % accents.length];
    return {
      id: `passage_${String(index + 1).padStart(2, '0')}`,
      sourceKind: 'human',
      consentBasis: 'new_consenting_adult',
      consentArtifact: artifact(`consent_${accentGroup}`),
      accentScorable: true,
      accentGroup,
      durationMs: 60_000,
      conditions: [
        conditions[index % conditions.length],
        ...(index < accents.length ? ['whisper'] : []),
      ],
      medicalTerms: [
        { term: governedTerms[index % governedTerms.length], occurrence: 1 },
        { term: governedTerms[(index + 1) % governedTerms.length], occurrence: 1 },
      ],
      specialties: [specialties[index % specialties.length]],
      coverageTags: [coverageTags[index % coverageTags.length]],
      audio: artifact(`audio_${index + 1}`),
      reference: artifact(`reference_${index + 1}`),
      referenceVerified: true,
    };
  });
  const manifest = { schemaVersion: 1, passages };
  const samples = passages.flatMap((passage) => [1, 2, 3].map((run) => ({
    passageId: passage.id,
    run,
    transcript: artifact(`${passage.id}_run_${run}`),
    firstTextMs: 4_000 + run,
    finalTextMs: 2_000 + run,
    segmentCalls: 4,
    failedAfterRetryCalls: 0,
    costUsd: 0.004,
  })));
  return {
    manifest,
    candidateRuns: {
      schemaVersion: 1,
      candidateId: 'candidate_a',
      samples,
      provenance: {
        sourceCommit: 'c'.repeat(40),
        adapterSource: artifact('provenance_adapter_source'),
        configurationReceipt: artifact('provenance_configuration_receipt'),
        productionAccountRegionReceipt: artifact('provenance_account_region_receipt'),
        rawRunReceipt: artifact('provenance_raw_run_receipt'),
      },
    },
  };
}

test('normalization and word alignment are deterministic and content-only', () => {
  assert.equal(
    normalizeBakeoffText('  NSTEMI—Whipple’s  2.1! '),
    'nstemi whipple s 2 1',
  );
  const alignment = alignBakeoffWords(
    'The patient needs Whipple surgery',
    'The person needs wipple surgery today',
  );
  assert.deepEqual({
    referenceWords: alignment.referenceWords,
    substitutions: alignment.substitutions,
    deletions: alignment.deletions,
    insertions: alignment.insertions,
  }, {
    referenceWords: 5,
    substitutions: 2,
    deletions: 0,
    insertions: 1,
  });
});

test('medical scoring separates exact recall, substitution, and deletion', () => {
  const score = scoreBakeoffTranscript(
    'Whipple metoprolol paracentesis',
    'wipple metoprolol',
    [
      { term: 'Whipple', occurrence: 1 },
      { term: 'metoprolol', occurrence: 1 },
      { term: 'paracentesis', occurrence: 1 },
    ],
  );
  assert.deepEqual(score, {
    referenceWords: 3,
    hypothesisWords: 2,
    substitutions: 1,
    deletions: 1,
    insertions: 0,
    errors: 2,
    medicalExpected: 3,
    medicalRecalled: 1,
    medicalSubstituted: 1,
  });
});

test('a word inserted inside a multiword medical term prevents exact recall', () => {
  const score = scoreBakeoffTranscript(
    'The patient had myocardial infarction',
    'The patient had myocardial acute infarction',
    [{ term: 'myocardial infarction', occurrence: 1 }],
  );
  assert.equal(score.medicalExpected, 1);
  assert.equal(score.medicalRecalled, 0);
  assert.equal(score.medicalSubstituted, 0);
});

test('medical tags bind scoring to the requested repeated-term occurrence', () => {
  const score = scoreBakeoffTranscript(
    'CBC improved and CBC declined',
    'CBC improved and cbcx declined',
    [{ term: 'CBC', occurrence: 2 }],
  );
  assert.equal(score.medicalExpected, 1);
  assert.equal(score.medicalRecalled, 0);
  assert.equal(score.medicalSubstituted, 1);
});

test('the governed manifest rejects synthetic accent evidence', () => {
  const { manifest } = fixture();
  manifest.passages[0] = {
    ...manifest.passages[0],
    sourceKind: 'tts',
    consentBasis: 'not_applicable_tts',
  };
  assert.throws(
    () => validateBakeoffManifest(manifest),
    (error) => error.code === 'invalid_corpus_manifest',
  );
});

test('candidate evidence requires exactly three runs for every passage', () => {
  const { manifest, candidateRuns } = fixture();
  candidateRuns.samples.pop();
  assert.throws(
    () => validateBakeoffCandidateRuns(candidateRuns, manifest),
    (error) => error.code === 'invalid_candidate_runs',
  );
});

test('candidate metrics reject coerced zeros and provenance rejects extra fields', () => {
  const coerced = fixture();
  coerced.candidateRuns.samples[0].costUsd = null;
  assert.throws(
    () => validateBakeoffCandidateRuns(coerced.candidateRuns, coerced.manifest),
    (error) => error.code === 'invalid_candidate_runs',
  );

  const extra = fixture();
  extra.candidateRuns.provenance.privateNote = 'must never reach output';
  assert.throws(
    () => validateBakeoffCandidateRuns(extra.candidateRuns, extra.manifest),
    (error) => error.code === 'unknown_evidence_field',
  );
});

test('empty and unbounded transcripts fail closed before quadratic scoring', () => {
  assert.throws(
    () => alignBakeoffWords('', 'hypothesis'),
    (error) => error.code === 'empty_reference_text',
  );
  assert.throws(
    () => alignBakeoffWords(
      Array.from({ length: 2_001 }, () => 'reference').join(' '),
      'hypothesis',
    ),
    (error) => error.code === 'transcript_word_limit',
  );
});

test('the governed corpus rejects duplicate artifacts and missing fixed accent groups', () => {
  const duplicate = fixture().manifest;
  duplicate.passages[1].audio = duplicate.passages[0].audio;
  assert.throws(
    () => validateBakeoffManifest(duplicate),
    (error) => error.code === 'invalid_corpus_manifest',
  );

  const missingAccent = fixture().manifest;
  for (const passage of missingAccent.passages) {
    if (passage.accentGroup === 'south_asian') passage.accentGroup = 'other_group';
  }
  assert.throws(
    () => validateBakeoffManifest(missingAccent),
    (error) => error.code === 'invalid_corpus_manifest',
  );
});

test('the scorer emits raw aggregate metrics without inventing a cutover verdict', () => {
  const { manifest, candidateRuns } = fixture();
  const referenceTextByPassage = new Map();
  const transcriptTextBySample = new Map();
  for (const passage of manifest.passages) {
    const text = `${passage.medicalTerms.map((tag) => tag.term).join(' ')} handoff`;
    referenceTextByPassage.set(passage.id, text);
    for (const run of [1, 2, 3]) {
      transcriptTextBySample.set(`${passage.id}:${run}`, text);
    }
  }
  const score = scoreBakeoffEvidence({
    manifest,
    candidateRuns,
    referenceTextByPassage,
    transcriptTextBySample,
  });
  assert.equal(score.normalizationVersion, bakeoffNormalizationVersion);
  assert.equal(score.evidenceStatus, 'raw_metrics_only_no_cutover_verdict');
  assert.equal(score.authorityStatus, 'fable_confirmation_required_for_scoring_semantics');
  assert.equal(score.corpus.passages, 40);
  assert.equal(score.corpus.samples, 120);
  assert.equal(score.corpus.accentGroups, 6);
  assert.equal(score.corpus.corpusAudioMinutes, 40);
  assert.equal(score.corpus.evaluatedAudioMinutes, 120);
  assert.equal(score.metrics.wer, 0);
  assert.equal(score.metrics.medicalRecall, 1);
  assert.equal(score.metrics.medicalSubstitutionRate, 0);
  assert.equal(score.metrics.accentDegradationPoints, 0);
  assert.equal(score.metrics.firstTextP95Ms, 4_003);
  assert.equal(score.metrics.finalTextP95Ms, 2_003);
  assert.equal(score.metrics.failureAfterRetryRate, 0);
  assert.equal(score.metrics.costPerRecordingMinuteUsd, 0.004);
  assert.equal(score.metricsUsableForActivation, false);
  assert.equal(score.provenance.sourceCommit, 'c'.repeat(40));
  assert.equal(
    score.provenance.adapterSourceSha256,
    candidateRuns.provenance.adapterSource.sha256,
  );
  assert.equal('adapterSource' in score.provenance, false);
  assert.match(score.inputDigests.corpusManifestCanonicalSha256, /^[a-f0-9]{64}$/);
  assert.match(score.inputDigests.transcriptArtifactSetSha256, /^[a-f0-9]{64}$/);
  assert.ok(score.nonAuthoritativeChoices.length >= 4);
  assert.equal('verdict' in score, false);
});

test('the file loader pins raw inputs and rejects a changed transcript artifact', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'storyforge-bakeoff-'));
  try {
    const { manifest, candidateRuns } = fixture();
    const written = new Set();
    const writeArtifact = async (artifactValue, content) => {
      const target = path.join(root, artifactValue.path);
      if (!written.has(target)) {
        await writeFile(target, content);
        written.add(target);
      }
      artifactValue.sha256 = digest(content);
    };
    for (const passage of manifest.passages) {
      const reference = `${passage.medicalTerms.map((tag) => tag.term).join(' ')} handoff ${passage.id}`;
      await writeArtifact(passage.audio, `synthetic-audio-${passage.id}`);
      await writeArtifact(passage.reference, reference);
      await writeArtifact(
        passage.consentArtifact,
        `content-free-consent-receipt-${passage.accentGroup}`,
      );
    }
    for (const sample of candidateRuns.samples) {
      const passage = manifest.passages.find((item) => item.id === sample.passageId);
      await writeArtifact(
        sample.transcript,
        `${passage.medicalTerms.map((tag) => tag.term).join(' ')} handoff ${passage.id}`,
      );
    }
    for (const provenanceArtifact of [
      candidateRuns.provenance.adapterSource,
      candidateRuns.provenance.configurationReceipt,
      candidateRuns.provenance.productionAccountRegionReceipt,
      candidateRuns.provenance.rawRunReceipt,
    ]) {
      await writeArtifact(provenanceArtifact, `receipt-${provenanceArtifact.path}`);
    }
    const manifestPath = path.join(root, 'corpus.json');
    const candidatePath = path.join(root, 'candidate.json');
    await writeFile(manifestPath, JSON.stringify(manifest));
    await writeFile(candidatePath, JSON.stringify(candidateRuns));

    const score = await loadAndScoreBakeoff(manifestPath, candidatePath);
    assert.match(score.inputDigests.corpusManifestFileSha256, /^[a-f0-9]{64}$/);
    assert.match(score.inputDigests.candidateRunsFileSha256, /^[a-f0-9]{64}$/);

    await writeFile(
      path.join(root, candidateRuns.samples[0].transcript.path),
      'changed transcript',
    );
    await assert.rejects(
      loadAndScoreBakeoff(manifestPath, candidatePath),
      (error) => error.code === 'artifact_hash_mismatch',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

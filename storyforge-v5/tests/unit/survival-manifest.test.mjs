import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SURVIVAL_SCHEMA,
  childSummary,
  compareSurvivalManifests,
  resolvedAudioObjectKeys,
  safeDifferenceReport,
  sha256,
  sortedSetHash,
} from '../../scripts/survival-manifest-lib.mjs';

function story(overrides = {}) {
  const revision = childSummary([{ id: 'revision-a', bodyHash: sha256('private revision') }]);
  return {
    owner: { studentId: 'student-a', wpBindingHash: sha256('107') },
    core: {
      titleHash: sha256('Title'), originalTextHash: sha256('Original'), workingHash: sha256('Working'),
      lessonHash: sha256('Lesson'), categories: sortedSetHash(['leadership']),
      intendedUses: sortedSetHash(['iv']), rowVersion: '3',
    },
    visibility: { columnPresent: false, value: null },
    review: { reviewedAt: null },
    submission: { submittedAt: null, lastSubmittedAt: null },
    transcripts: childSummary([{ id: 'transcript-a', hash: sha256('transcript') }]),
    audio: {
      count: 1,
      rows: {
        'story_audio:audio-a': {
          rowHash: sha256('audio row'), objectKeyHash: sha256('private/key'),
          recordedSize: 12, required: true, exists: true, actualSize: 12,
        },
      },
    },
    children: { sf_story_revisions: revision },
    v2Assertions: { generatedVersionRows: 0 },
    ...overrides,
  };
}

function manifest(value = story()) {
  return {
    schema: SURVIVAL_SCHEMA,
    capture: {
      phase: 'pre', release: 'R1', candidateSha256: sha256('migration'), generatedAt: 'ignored',
      databaseSystemHash: sha256('database-system'), fullVisibility: true, objectVerification: 'required_pass',
    },
    global: {
      sf_users: { count: 1, idsHash: sha256('[student-a]') },
      sf_stories: { count: 1, idsHash: sha256('[story-a]') },
      sf_audit_events: { count: 2, idsHash: sha256('[1,2]') },
    },
    ledger: { count: 1, rows: { '20260101': sha256('ledger-a') } },
    stories: { 'story-a': value },
  };
}

function postManifest(value = story()) {
  const result = manifest(value);
  result.capture = { ...result.capture, phase: 'post', generatedAt: 'later' };
  return result;
}

test('identical protected state passes despite capture timestamp and phase', () => {
  assert.deepEqual(compareSurvivalManifests(manifest(), postManifest()), { pass: true, differences: [] });
});

test('absent visibility to SQL NULL passes but widening fails', () => {
  const nullable = story({ visibility: { columnPresent: true, value: null } });
  assert.equal(compareSurvivalManifests(manifest(), postManifest(nullable)).pass, true);
  const widened = story({ visibility: { columnPresent: true, value: 'mentor_visible' } });
  assert.equal(compareSurvivalManifests(manifest(), postManifest(widened)).pass, false);
});

test('story loss, owner drift, core mutation, transcript loss, and synthesized version fail', () => {
  const missing = postManifest();
  missing.stories = {};
  for (const changed of [
    missing,
    postManifest(story({ owner: { studentId: 'student-b', wpBindingHash: sha256('107') } })),
    postManifest(story({ core: { ...story().core, workingHash: sha256('changed') } })),
    postManifest(story({ transcripts: childSummary([]) })),
    postManifest(story({ v2Assertions: { generatedVersionRows: 1 } })),
  ]) assert.equal(compareSurvivalManifests(manifest(), changed).pass, false);
});

test('pre child rows must survive exactly while append-only additions are allowed', () => {
  const appended = childSummary([
    { id: 'revision-a', bodyHash: sha256('private revision') },
    { id: 'revision-b', bodyHash: sha256('new revision') },
  ]);
  assert.equal(compareSurvivalManifests(manifest(), postManifest(story({ children: { sf_story_revisions: appended } }))).pass, true);
  assert.equal(compareSurvivalManifests(manifest(), postManifest(story({ children: { sf_story_revisions: childSummary([]) } }))).pass, false);
  const mutated = childSummary([{ id: 'revision-a', bodyHash: sha256('mutated') }]);
  assert.equal(compareSurvivalManifests(manifest(), postManifest(story({ children: { sf_story_revisions: mutated } }))).pass, false);
});

test('story or user additions fail, while protected append-only global counts may rise', () => {
  const addedAudit = postManifest();
  addedAudit.global.sf_audit_events = { count: 3, idsHash: sha256('[1,2,3]') };
  assert.equal(compareSurvivalManifests(manifest(), addedAudit).pass, true);
  const addedStory = postManifest();
  addedStory.stories['story-b'] = story({ owner: { studentId: 'student-b', wpBindingHash: sha256('108') } });
  addedStory.global.sf_stories = { count: 2, idsHash: sha256('[story-a,story-b]') };
  assert.equal(compareSurvivalManifests(manifest(), addedStory).pass, false);
});

test('active object HEAD is mandatory and size must match in both manifests', () => {
  for (const change of [
    { exists: false, actualSize: null },
    { exists: true, actualSize: 11 },
    { required: true, exists: null, actualSize: null },
  ]) {
    const changed = story();
    changed.audio.rows['story_audio:audio-a'] = { ...changed.audio.rows['story_audio:audio-a'], ...change };
    assert.equal(compareSurvivalManifests(manifest(), postManifest(changed)).pass, false);
  }
  const preBroken = manifest();
  preBroken.stories['story-a'].audio.rows['story_audio:audio-a'].exists = false;
  const postBroken = postManifest();
  postBroken.stories['story-a'].audio.rows['story_audio:audio-a'].exists = false;
  assert.equal(compareSurvivalManifests(preBroken, postBroken).pass, false);
});

test('database identity, full visibility, and object-verification modes are enforced', () => {
  const wrongDatabase = postManifest();
  wrongDatabase.capture.databaseSystemHash = sha256('other');
  assert.equal(compareSurvivalManifests(manifest(), wrongDatabase).pass, false);
  const filtered = postManifest();
  filtered.capture.fullVisibility = false;
  assert.equal(compareSurvivalManifests(manifest(), filtered).pass, false);
  const noHead = postManifest();
  noHead.capture.objectVerification = 'test_only_not_requested';
  assert.equal(compareSurvivalManifests(manifest(), noHead).pass, false);
});

test('ledger additions require an exact expected row hash', () => {
  const after = postManifest();
  after.ledger.rows['20260102'] = sha256('ledger-b');
  after.ledger.count = 2;
  assert.equal(compareSurvivalManifests(manifest(), after).pass, false);
  assert.equal(compareSurvivalManifests(manifest(), after, {
    expectedLedgerAdditions: [['20260102', sha256('ledger-b')]],
  }).pass, true);
});

test('difference report contains only identifiers, fields, reasons, and hashes', () => {
  const changed = story({ core: { ...story().core, workingHash: sha256('changed private prose') } });
  const safe = safeDifferenceReport(compareSurvivalManifests(manifest(), postManifest(changed)));
  assert.equal(safe.pass, false);
  assert.doesNotMatch(JSON.stringify(safe), /changed private prose|Working|Original|Lesson/);
  assert.deepEqual(Object.keys(safe.differences[0]).sort(), [
    'afterHash', 'beforeHash', 'field', 'reason', 'rowKey', 'storyId', 'table',
  ]);
});

test('NULL differs from empty and Unicode, CRLF, sets, and rows hash deterministically', () => {
  assert.notEqual(sha256(null), sha256(''));
  assert.notEqual(sha256('é'), sha256('e'));
  assert.notEqual(sha256('line\r\n'), sha256('line\n'));
  assert.deepEqual(sortedSetHash(['b', 'a', 'a']), sortedSetHash(['a', 'b']));
  assert.deepEqual(childSummary([{ id: 'b' }, { id: 'a' }]), childSummary([{ id: 'a' }, { id: 'b' }]));
});

test('permanent audio verification follows the canonical runtime playback keys', () => {
  assert.deepEqual(resolvedAudioObjectKeys({
    objectKey: 'storyforge-audio/student/story/asset',
    contentType: 'audio/webm',
    assemblyExecutor: 'concat',
  }), ['storyforge-audio/student/story/asset.webm']);
  assert.deepEqual(resolvedAudioObjectKeys({
    objectKey: 'storyforge-audio/student/story/asset',
    contentType: 'audio/ogg',
    assemblyExecutor: 'copy',
    segmentCount: 2,
  }), [
    'storyforge-audio/student/story/asset/seg-00000.ogg',
    'storyforge-audio/student/story/asset/seg-00001.ogg',
  ]);
  assert.deepEqual(resolvedAudioObjectKeys({
    objectKey: 'storyforge-audio/student/story/legacy.webm',
    contentType: 'audio/webm',
    assemblyExecutor: '',
  }), ['storyforge-audio/student/story/legacy.webm']);
  assert.throws(() => resolvedAudioObjectKeys({
    objectKey: 'storyforge-audio/student/story/asset',
    contentType: 'audio/webm',
    assemblyExecutor: 'copy',
    segmentCount: 0,
  }), /segment manifest/);
});

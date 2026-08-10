import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SURVIVAL_SCHEMA,
  childSummary,
  compareSurvivalManifests,
  safeDifferenceReport,
  sha256,
  sortedSetHash,
} from '../../scripts/survival-manifest-lib.mjs';

function story(overrides = {}) {
  return {
    ownerId: 'student-a',
    ownerWordPressBindingHash: sha256('107'),
    titleHash: sha256('Title'),
    originalHash: sha256('Original'),
    workingHash: sha256('Working'),
    lessonHash: sha256('Lesson'),
    studentPriority: 4,
    categories: sortedSetHash(['leadership']),
    intendedUses: sortedSetHash(['iv']),
    review: { status: 'private' },
    visibility: null,
    submission: { submittedAt: null, lastSubmittedAt: null },
    timestamps: { createdAt: '2026-01-01T00:00:00.000Z' },
    rowVersion: '3',
    transcripts: { count: 1, hash: sha256('transcript') },
    audioAssets: { count: 1, hash: sha256('audio'), items: [{ id: 'audio-a' }] },
    children: { sf_story_revisions: childSummary([{ id: 'revision-a', body: 'private' }]) },
    ...overrides,
  };
}

function manifest(value = story()) {
  return {
    schema: SURVIVAL_SCHEMA,
    generatedAt: 'ignored',
    globals: { sf_users: '1', sf_stories: '1' },
    stories: { 'story-a': value },
  };
}

test('identical manifests pass even when snapshot timestamps differ', () => {
  const before = manifest();
  const after = { ...manifest(), generatedAt: 'later' };
  assert.deepEqual(compareSurvivalManifests(before, after), { pass: true, differences: [] });
});

test('story loss, owner drift, visibility widening, audio loss, and child changes fail', () => {
  const missing = manifest();
  missing.stories = {};
  for (const changed of [
    missing,
    manifest(story({ ownerId: 'student-b' })),
    manifest(story({ visibility: 'mentor_visible' })),
    manifest(story({ audioAssets: { count: 0, hash: sha256('none'), items: [] } })),
    manifest(story({ children: { sf_story_revisions: childSummary([]) } })),
  ]) {
    const result = compareSurvivalManifests(manifest(), changed);
    assert.equal(result.pass, false);
    assert.ok(result.differences.length >= 1);
  }
});

test('new stories and global count changes fail during a frozen cutover', () => {
  const after = manifest();
  after.stories['story-b'] = story({ ownerId: 'student-b' });
  after.globals.sf_stories = '2';
  const result = compareSurvivalManifests(manifest(), after);
  assert.equal(result.pass, false);
  assert.ok(result.differences.some((item) => item.field === 'unexpected_story_added'));
  assert.ok(result.differences.some((item) => item.field === 'globals'));
});

test('difference report contains only ids, field names, and hashes', () => {
  const result = compareSurvivalManifests(manifest(), manifest(story({ workingHash: sha256('changed private prose') })));
  const safe = safeDifferenceReport(result);
  assert.equal(safe.pass, false);
  assert.doesNotMatch(JSON.stringify(safe), /changed private prose|Working|Original|Lesson/);
  assert.deepEqual(Object.keys(safe.differences[0]).sort(), ['afterHash', 'beforeHash', 'field', 'storyId']);
});

test('set and child hashing are deterministic across ordering', () => {
  assert.deepEqual(sortedSetHash(['b', 'a', 'a']), sortedSetHash(['a', 'b']));
  assert.deepEqual(childSummary([{ id: 'b' }, { id: 'a' }]), childSummary([{ id: 'a' }, { id: 'b' }]));
});

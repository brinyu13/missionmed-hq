import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf('\nfunction ', start + 10);
  const nextAsync = source.indexOf('\nasync function ', start + 10);
  const endings = [next, nextAsync].filter((value) => value > start);
  return source.slice(start, endings.length ? Math.min(...endings) : source.length);
}

test('B1-511 frontend preserves exact category and intended-use authority', () => {
  for (const label of [
    'Clinical',
    'Personal',
    'Research',
    'Leadership',
    'Teaching',
    'Volunteer / Service',
    'Adversity / Challenge',
    'Teamwork',
    'Communication',
    'Ethics / Professionalism',
    'Other',
  ]) assert.match(source, new RegExp(`label: '${label.replace('/', '\\/')}'`));

  for (const [id, label] of [
    ['ps', 'Personal Statement'],
    ['iv', 'Interview Set'],
    ['letter', 'Letter of Recommendation'],
    ['myeras_experiences', 'MyERAS Experiences'],
    ['myeras_most_impactful', 'MyERAS Most Impactful'],
    ['later', 'Someday / Fellowship'],
  ]) assert.match(source, new RegExp(`id: '${id}', label: '${label.replace('/', '\\/')}'`));

  for (const legacyLabel of [
    'Personal statement', 'Interview set', 'Letter conversations', 'Someday / fellowship',
  ]) assert.match(source, new RegExp(`label: '${legacyLabel.replace('/', '\\/')}'`));
  assert.match(source, /state\.capabilities\?\.taxonomy \? 'Where this story could be used' : 'Where it could serve'/);

  assert.match(source, /themes: asArray\(raw\.themes\)/);
  assert.match(source, /categories: asArray\(firstDefined\(raw\.categories, raw\.story_categories\)\)/);
});

test('Library defaults to stable student priority order with unrated last', () => {
  assert.match(source, /sort: 'priority'/);
  const filtered = functionSource('filteredStories');
  assert.match(filtered, /if \(left !== right\) return right - left/);
  assert.match(filtered, /String\(b\.updatedAt\)\.localeCompare\(String\(a\.updatedAt\)\) \|\| a\.id\.localeCompare\(b\.id\)/);
  assert.match(filtered, /filter\.sort === 'priority' \? 'new' : filter\.sort/);
  assert.match(source, /Sort: priority 5→1/);
});

test('inline priority and star mutations are row-only and version checked', () => {
  const priority = functionSource('updateLibraryPriority');
  assert.doesNotMatch(priority, /withBusy|loadStories|renderRoute|renderShell/);
  assert.match(priority, /expectedVersion: story\.rowVersion/);
  assert.match(priority, /unwrapStory\(\{ \.\.\.optimistic, \.\.\.\(result\?\.story \|\| result\) \}\)/);
  assert.match(priority, /reorderLibraryRowsStable/);
  assert.match(priority, /focus\(\{ preventScroll: true \}\)/);
  assert.match(priority, /replaceStoryInState\(previous\)/);

  const star = functionSource('toggleStar');
  assert.match(star, /libraryRow/);
  assert.match(star, /expectedVersion: story\.rowVersion/);
  assert.match(star, /replaceStoryInState\(previous\)/);
});

test('search is debounced, composition-safe, and does not remount per character', () => {
  assert.match(source, /window\.setTimeout\(\(\) => \{\s*renderLibraryRowsOnly\(\)/);
  assert.match(source, /\}, 200\)/);
  assert.match(source, /compositionstart/);
  assert.match(source, /compositionend/);
  assert.match(source, /aria-controls="libSearchSuggestions"/);
  assert.match(source, /role="option"/);
  assert.match(source, /aria-activedescendant/);
  const rowsOnly = functionSource('renderLibraryRowsOnly');
  assert.doesNotMatch(rowsOnly, /renderShell|renderRoute|main\.innerHTML/);
});

test('all new frontend capabilities default closed', () => {
  for (const capability of ['submissionReview', 'taxonomy', 'inlinePriority', 'storySearch', 'mentorNotes', 'mentorNotesRead']) {
    assert.match(source, new RegExp(`${capability}: false`));
    assert.match(source, new RegExp(`${capability}: Boolean\\(session\\?\\.capabilities\\?\\.${capability}\\)`));
  }
});

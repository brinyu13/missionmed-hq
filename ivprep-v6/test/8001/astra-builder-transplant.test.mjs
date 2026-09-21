import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../..', import.meta.url);
const [html, js, css, viewModel] = await Promise.all([
  readFile(new URL('public/studio/index.html', root), 'utf8'),
  readFile(new URL('public/studio/studio.mjs', root), 'utf8'),
  readFile(new URL('public/studio/studio.css', root), 'utf8'),
  readFile(new URL('public/studio/presentation-view-model.mjs', root), 'utf8'),
]);

test('builder binds the recovered candidate.2 presentation authority', () => {
  assert.match(js, /dedb726bde521a135bec2286ad4cd5a877a68fc7ecd6144fde16b76bc9c09ac4/);
  for (const text of ['Full IV Simulation', 'Guided Mock IV Practice', 'Individual Question']) assert.match(js, new RegExp(text));
  assert.match(css, /\.canon-purpose-card/);
});

test('each canonical step owns a distinct renderer instead of the rejected generic option loop', () => {
  const renderers = [
    ['goal', 'renderGoalStep'],
    ['questions', 'renderQuestionStep'],
    ['interviewer', 'renderInterviewerStep'],
    ['program', 'renderProgramStep'],
    ['environment', 'renderEnvironmentStep'],
  ];
  for (const [key, renderer] of renderers) {
    assert.match(js, new RegExp(`step\\.key === '${key}'\\) ${renderer}\\(content\\)`));
  }
  assert.match(js, /else renderReadinessStep\(content\)/);
  assert.doesNotMatch(js, /for \(const option of step\.options\)/);
  assert.doesNotMatch(js, /options:\s*\['Core 10',\s*'Behavioral questions'/);
});

test('question pool preserves progressive category to section to question exploration', () => {
  for (const text of ['QUESTION_CATEGORIES', 'questionCategory', 'questionSection', 'Choose specific questions']) assert.match(js, new RegExp(text));
  assert.match(css, /\.canon-pool-browser/);
  assert.match(html, /Your Question Pool/);
});

test('the remaining four steps retain distinct Astra compositions', () => {
  for (const text of ['Program Director', 'Faculty', 'Chief Resident', 'Dove', 'Peacock', 'Owl', 'Eagle']) assert.match(js, new RegExp(text));
  for (const text of ['Program name', 'Specialty', 'State', 'Program type']) assert.match(js, new RegExp(text));
  for (const text of ['MissionMed', 'Webex', 'Zoom', 'Teams', 'StoryForge', 'RISE', 'File Vault', 'Prior IVOC']) assert.match(js + viewModel, new RegExp(text));
  for (const text of ['Framing', 'Face / head', 'Hands / gestures', 'Volume', 'Pace', 'Pitch', 'Pauses', 'Transcript', 'Recording']) assert.match(js, new RegExp(text));
});

test('student-facing shell does not expose rejected engineering seam language', () => {
  assert.doesNotMatch(html + js, /RISE seam|StoryForge context seam|context seams/i);
  assert.match(js, /All specialties/);
  assert.match(js, /contextSources: \[\]/);
  assert.doesNotMatch(js, /summary\.innerHTML/);
});

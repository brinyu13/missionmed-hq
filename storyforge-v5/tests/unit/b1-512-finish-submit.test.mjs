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

const completionMissing = Function(
  'firstDefined',
  `${functionSource('storyCompletionMissing')}; return storyCompletionMissing;`,
)((...values) => values.find((value) => value !== undefined && value !== null));

test('Finish It uses only the accepted 40-word and Learning Lesson completion contract', () => {
  const words39 = Array.from({ length: 39 }, (_, index) => `word${index}`).join(' ');
  const words40 = `${words39} word39`;

  assert.deepEqual(completionMissing({ text: words39, lesson: 'A durable lesson.' }, 'finish').map(({ id }) => id), ['text']);
  assert.deepEqual(completionMissing({ text: words40, lesson: '' }, 'finish').map(({ id }) => id), ['lesson']);
  assert.deepEqual(completionMissing({ text: words39, lesson: '' }, 'finish').map(({ id }) => id), ['text', 'lesson']);
  assert.deepEqual(completionMissing({ text: words40, lesson: 'A durable lesson.' }, 'finish'), []);
});

test('review submission keeps the server contract at three durable text characters', () => {
  assert.deepEqual(completionMissing({ text: 'ab', lesson: 'Optional here.' }, 'submit').map(({ id }) => id), ['text']);
  assert.deepEqual(completionMissing({ text: 'abc', lesson: '' }, 'submit'), []);
  const submit = functionSource('submitCurrentStory');
  assert.match(submit, /storyCompletionMissing\(story, 'submit'\)/);
  assert.doesNotMatch(submit, /categories|uses|studentScore|priority/);
  assert.match(source, /Save the Working version before submitting/);
});

test('Finish It is a distinct open intent while normal Story Detail entry stays unchanged', () => {
  assert.match(source, /data-open-story="\$\{attr\(story\.id\)\}" data-completion-guidance="finish"/);
  assert.match(source, /openStory\(button\.dataset\.openStory, button\.dataset\.completionGuidance \|\| null\)/);
  assert.match(source, /async function openStory\(id, completionIntent = null\)/);
  assert.match(source, /state\.storyTab = completionIntent \? 'working'/);
});

test('guidance is accessible, non-color-only, and clears without rerendering on input', () => {
  assert.match(source, /Please complete the items highlighted below\./);
  assert.match(source, /This will help you and your mentor understand and develop your story\./);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /b1512IncompleteIcon/);
  assert.match(source, /data-completion-help="text"/);
  assert.match(source, /data-completion-help="lesson"/);

  const refresh = functionSource('updateStoryCompletionGuidance');
  assert.doesNotMatch(refresh, /renderStoryRoom|renderShell|innerHTML\s*=/);
  assert.match(refresh, /focus\(\{ preventScroll: true \}\)/);
  assert.match(refresh, /scrollIntoView\(\{ block: 'center', inline: 'nearest', behavior: 'auto' \}\)/);
  assert.doesNotMatch(refresh, /setTimeout|setInterval|smooth/);
});

test('guidance never leaks to the next overlay and draft save remains available', () => {
  assert.match(functionSource('clearOverlays'), /state\.storyCompletionIntent = null/);
  assert.match(functionSource('closeOverlay'), /state\.storyCompletionIntent = null/);
  assert.match(source, /<button class="btnSave" type="submit">Save working version<\/button>/);
  assert.match(functionSource('studentReviewAction'), /Submitting makes this story available to an authorized reviewer/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const appUrl = new URL('../../public/app.js', import.meta.url);

function extractFunction(source, name) {
  const declaration = `function ${name}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${name} must remain implemented in the real browser bundle`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`could not isolate ${name} from the browser bundle`);
}

async function productionMerge() {
  const source = await readFile(appUrl, 'utf8');
  const declaration = extractFunction(source, 'mergeVoiceTranscript');
  return vm.runInNewContext(`(${declaration})`, Object.create(null));
}

test('voice overlap merge reproduces the pause/resume boundary without duplicate words', async () => {
  const merge = await productionMerge();
  assert.equal(
    merge(
      'I asked the resident to prepare for rapid sequence intubation.',
      'Rapid sequence intubation before the transfer began.',
    ),
    'I asked the resident to prepare for rapid sequence intubation. before the transfer began.',
  );
});

test('voice overlap merge is case and punctuation insensitive but preserves provider text', async () => {
  const merge = await productionMerge();
  assert.equal(
    merge(
      'The family repeated the plan: controller in the morning, rescue in the backpack.',
      'RESCUE in the backpack — and call us before returning.',
    ),
    'The family repeated the plan: controller in the morning, rescue in the backpack. — and call us before returning.',
  );
  assert.equal(
    merge('I started vancomycin.', 'I started vancomycin.'),
    'I started vancomycin.',
  );
});

test('voice overlap merge keeps typed text byte-for-byte and appends only new finalized words', async () => {
  const merge = await productionMerge();
  const typed = 'Typed before speaking — keep this exact punctuation. ';
  assert.equal(
    merge(typed, 'Then I called the family.'),
    `${typed}Then I called the family.`,
  );
  assert.equal(merge(typed, '   '), typed);
});

test('voice overlap merge removes every possible tail overlap through the 30-word bound', async () => {
  const merge = await productionMerge();
  const words = Array.from({ length: 40 }, (_, index) => `word${index}`);
  for (let overlap = 1; overlap <= 30; overlap += 1) {
    const current = words.join(' ');
    const incoming = `${words.slice(-overlap).join(' ')} final`;
    assert.equal(
      merge(current, incoming),
      `${current} final`,
      `overlap length ${overlap}`,
    );
  }
});

test('voice overlap merge deliberately ignores overlaps older than the 30-word tail', async () => {
  const merge = await productionMerge();
  const currentWords = Array.from({ length: 35 }, (_, index) => `term${index}`);
  const current = currentWords.join(' ');
  const incoming = `${currentWords.join(' ')} continued`;
  assert.equal(merge(current, incoming), `${current} ${incoming}`);
});

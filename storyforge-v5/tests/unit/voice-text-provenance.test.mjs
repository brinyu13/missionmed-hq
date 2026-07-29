import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const appUrl = new URL('../../public/app.js', import.meta.url);

function extractFunction(source, name) {
  const declaration = `function ${name}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${name} must remain implemented in the browser bundle`);
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
  assert.fail(`could not isolate ${name}`);
}

async function browserProvenance() {
  const source = await readFile(appUrl, 'utf8');
  const context = vm.createContext({
    asArray: (value) => (Array.isArray(value) ? value : []),
    firstDefined: (...values) => values.find((value) => value !== undefined && value !== null),
    voiceState: {
      trackedText: '',
      voiceSpans: [],
      pendingEdit: null,
    },
  });
  [
    'normalizeVoiceSpans',
    'trackVoiceTextEdit',
    'appendVoiceText',
    'findVoiceTermIndex',
    'replaceVoiceText',
    'removeVoiceText',
  ].forEach((name) => {
    vm.runInContext(extractFunction(source, name), context);
  });
  return {
    context,
    appendVoiceText: vm.runInContext('appendVoiceText', context),
    trackVoiceTextEdit: vm.runInContext('trackVoiceTextEdit', context),
    replaceVoiceText: vm.runInContext('replaceVoiceText', context),
    removeVoiceText: vm.runInContext('removeVoiceText', context),
  };
}

test('discard provenance removes transcript text but preserves typing before and after it byte-for-byte', async () => {
  const browser = await browserProvenance();
  const body = { value: 'Typed before recording.' };
  browser.context.voiceState.trackedText = body.value;
  assert.equal(browser.appendVoiceText(body, 'Spoken clinical detail.'), true);
  const withLaterTyping = `${body.value} Typed while the microphone was active.`;
  browser.trackVoiceTextEdit(withLaterTyping);
  body.value = withLaterTyping;
  assert.equal(
    browser.removeVoiceText(body.value, browser.context.voiceState.voiceSpans),
    'Typed before recording. Typed while the microphone was active.',
  );
});

test('a terminology correction remains voice-derived and is removed with its take', async () => {
  const browser = await browserProvenance();
  const body = { value: 'Typed context.' };
  browser.context.voiceState.trackedText = body.value;
  browser.appendVoiceText(body, 'whipple procedure');
  assert.equal(browser.replaceVoiceText(body, 'whipple', 'Whipple'), true);
  assert.equal(body.value, 'Typed context. Whipple procedure');
  assert.equal(
    browser.removeVoiceText(body.value, browser.context.voiceState.voiceSpans),
    'Typed context.',
  );
});

test('replacing the editor content makes the replacement typed content, never voice content', async () => {
  const browser = await browserProvenance();
  const body = { value: '' };
  browser.appendVoiceText(body, 'Provider transcript.');
  browser.context.voiceState.pendingEdit = {
    previous: body.value,
    start: 0,
    end: body.value.length,
    inputType: 'insertText',
  };
  browser.trackVoiceTextEdit('My fully rewritten story.');
  assert.deepEqual(
    JSON.parse(JSON.stringify(browser.context.voiceState.voiceSpans)),
    [],
  );
  assert.equal(
    browser.removeVoiceText('My fully rewritten story.', browser.context.voiceState.voiceSpans),
    'My fully rewritten story.',
  );
});

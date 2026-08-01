import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const appUrl = new URL('../../public/app.js', import.meta.url);

function extractFunction(source, name) {
  const declaration = `function ${name}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${name} must remain in the production browser bundle`);
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

async function productionGreetingSelector() {
  const source = await readFile(appUrl, 'utf8');
  const declaration = extractFunction(source, 'firstName');
  return {
    firstName: vm.runInNewContext(`(${declaration})`, Object.create(null)),
    source,
  };
}

test('uses the authenticated WordPress first_name exactly without reinterpretation', async () => {
  const { firstName } = await productionGreetingSelector();
  assert.equal(firstName({ first_name: 'Brian', display_name: 'brinyu' }), 'Brian');
  assert.equal(firstName({ first_name: 'Afthab', display_name: 'foxygirl1' }), 'Afthab');
  assert.equal(firstName({ first_name: 'Dr', display_name: 'brinyu' }), 'Dr');
  assert.equal(firstName({ first_name: ' Mary Ann ', display_name: 'ignored' }), ' Mary Ann ');
});

test('falls back only when first_name is absent or blank', async () => {
  const { firstName } = await productionGreetingSelector();
  assert.equal(firstName({ first_name: '   ', display_name: 'Brian Bolante' }), 'Brian');
  assert.equal(firstName({ first_name: null, display_name: '', username: 'brinyu' }), 'brinyu');
  assert.equal(firstName({ first_name: {}, display_name: '  ', username: 'foxygirl1' }), 'foxygirl1');
  assert.equal(firstName({ first_name: '', display_name: '', email: 'brian@example.test' }), 'there');
  assert.equal(firstName({ first_name: undefined, display_name: undefined }), 'there');
});

test('preserves the existing time-of-day branch and escaped text-rendering path', async () => {
  const { source } = await productionGreetingSelector();
  assert.match(source, /hour < 12 \? 'Good morning' : hour < 18 \? 'Good afternoon' : 'Good evening'/u);
  assert.match(source, /\$\{greeting\}, <em>\$\{esc\(firstName\(\)\)\}<\/em>\./u);
  assert.doesNotMatch(extractFunction(source, 'firstName'), /email/u);
});

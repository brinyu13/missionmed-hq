'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const assets = path.join(root, 'wp-content/plugins/missionmed-hub/assets');
const names = fs.readdirSync(assets).filter((name) => /^v1-study-loader\.[a-f0-9]{16}\.js$/.test(name));
assert.deepStrictEqual(names.length, 1, 'exactly one content-addressed V1 loader must exist');
const manifestNames = fs.readdirSync(assets).filter((name) => /^v1-study-release\.[a-f0-9]{16}\.json$/.test(name));
assert.deepStrictEqual(manifestNames.length, 1, 'exactly one content-addressed V1 release manifest must exist');

const name = names[0];
const source = fs.readFileSync(path.join(assets, name), 'utf8');
const digest = crypto.createHash('sha256').update(source).digest('hex');
assert.strictEqual(name, `v1-study-loader.${digest.slice(0, 16)}.js`, 'filename prefix must match complete bytes');

const manifestName = manifestNames[0];
const manifestSource = fs.readFileSync(path.join(assets, manifestName), 'utf8');
const releaseDigest = crypto.createHash('sha256').update(manifestSource).digest('hex');
const manifest = JSON.parse(manifestSource);
assert.strictEqual(manifestName, `v1-study-release.${releaseDigest.slice(0, 16)}.json`, 'manifest filename prefix must match complete bytes');
assert.deepStrictEqual(manifest.javascript, { asset: name, sha256: digest }, 'manifest binds exact executable loader bytes');

const releasePhp = fs.readFileSync(path.join(root, 'wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-release.php'), 'utf8');
function phpConstant(constantName) {
  const match = releasePhp.match(new RegExp(`const\\s+${constantName}\\s*=\\s*'([^']+)'`));
  assert(match, `${constantName} must exist in PHP release descriptor`);
  return match[1];
}
assert.strictEqual(phpConstant('LOADER_ASSET'), name, 'PHP descriptor names the executable loader');
assert.strictEqual(phpConstant('LOADER_SHA256'), digest, 'PHP descriptor binds executable loader bytes');
assert.strictEqual(phpConstant('MANIFEST_ASSET'), manifestName, 'PHP descriptor names the canonical manifest');
assert.strictEqual(phpConstant('RELEASE_SHA256'), releaseDigest, 'PHP descriptor binds canonical manifest bytes');

function execute(overrides = {}, existingWindow = null) {
  const events = existingWindow ? existingWindow.__events : [];
  const config = Object.assign({
    contract_version: 1,
    mode: 'V1_ACTIVE_READ_WRITE',
    entitlement: { allowed: true },
    exposure: { allowed: true },
    reader: { allowed: true, version: '1' },
    writer: { allowed: true },
    release: { id: 'V1-STUDY-SCHEDULE-8010C', digest: releaseDigest, asset_digest: digest },
  }, overrides);

  const window = existingWindow || {
    MMED_OS: { study_schedule_v1: config },
    __events: events,
    __fetches: 0,
    CustomEvent: function CustomEvent(type, options) {
      this.type = type;
      this.detail = options.detail;
    },
    dispatchEvent(event) {
      this.__events.push(event);
    },
    fetch() {
      this.__fetches += 1;
      throw new Error('8010C must not fetch');
    },
    location: { hash: '#study' },
  };
  if (existingWindow) window.MMED_OS.study_schedule_v1 = config;

  const document = {
    currentScript: { src: `https://example.invalid/assets/${name}` },
    createElement() {
      throw new Error('8010C must not create DOM nodes');
    },
  };
  const context = vm.createContext({ window, document });
  vm.runInContext(source, context, { filename: name });
  return window;
}

const valid = execute();
assert.strictEqual(valid.__events.length, 1, 'valid immutable config dispatches exactly one event');
assert.strictEqual(valid.__events[0].type, 'mmed:v1-study:bootstrap');
assert.strictEqual(valid.__events[0].detail.release.digest, releaseDigest);
assert.strictEqual(valid.__events[0].detail.release.asset_digest, digest);
assert.strictEqual(valid.__fetches, 0, 'valid loader performs no fetch');
assert.strictEqual(valid.location.hash, '#study', 'valid loader does not alter Matrix navigation');
execute({}, valid);
assert.strictEqual(valid.__events.length, 1, 're-execution is idempotent for the same digest');

const assetMismatch = execute({ release: { id: 'V1-STUDY-SCHEDULE-8010C', digest: releaseDigest, asset_digest: '0'.repeat(64) } });
assert.strictEqual(assetMismatch.__events.length, 0, 'asset digest mismatch dispatches no event');
const malformedRelease = execute({ release: { id: 'V1-STUDY-SCHEDULE-8010C', digest: 'invalid', asset_digest: digest } });
assert.strictEqual(malformedRelease.__events.length, 0, 'malformed release digest dispatches no event');
const hidden = execute({ mode: 'V1_HIDDEN_NO_TRUTH', exposure: { allowed: false }, reader: { allowed: false, version: null } });
assert.strictEqual(hidden.__events.length, 0, 'hidden configuration dispatches no event');
const denied = execute({ entitlement: { allowed: false } });
assert.strictEqual(denied.__events.length, 0, 'denied entitlement dispatches no event');

assert.strictEqual(/\bfetch\s*\(/.test(source), false, 'loader source contains no fetch call');
assert.strictEqual(/localStorage|sessionStorage|history\.|location\.hash\s*=/.test(source), false, 'loader source contains no storage or router mutation');

console.log('V1 Study Schedule 8010C loader isolation: ok');

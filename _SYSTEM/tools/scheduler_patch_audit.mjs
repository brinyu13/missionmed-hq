#!/usr/bin/env node
/**
 * scheduler_patch_audit.mjs — MX-APPT-5002B
 *
 * The adapter (assets/scheduler-mount.js) applies byte-exact string patches to the
 * Scheduler bundle before eval(). Before MX-APPT-5002 a patch that stopped matching
 * returned the input unchanged with no log, no counter and no assertion, so a single
 * whitespace change upstream could silently revert a behaviour fix.
 *
 * This tool runs the REAL patch pass against a given bundle and reports, per patch:
 *   id · expected count · actual count · PASS/FAIL · required
 *
 * Exit codes:  0 = all required patches PASS   1 = a required patch FAILED   2 = usage/IO error
 *
 * Usage:
 *   node scheduler_patch_audit.mjs                          # audit canonical source
 *   node scheduler_patch_audit.mjs --bundle <file>
 *   node scheduler_patch_audit.mjs --live                   # audit the live CDN bundle
 *   node scheduler_patch_audit.mjs --emit-expectations      # print the JS table for the adapter
 *   node scheduler_patch_audit.mjs --quiet                  # exit code only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADAPTER = path.join(ROOT, 'wp-content/plugins/missionmed-hub/assets/scheduler-mount.js');
const CANONICAL = path.join(ROOT, 'LIVE/scheduler/scheduler_v1.html');
const EXPECT_FILE = path.join(ROOT, '_SYSTEM/tools/scheduler_patch_expectations.json');
const LIVE_URL = 'https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler_v1.html';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const QUIET = has('--quiet');
const EMIT = has('--emit-expectations');

function die(msg, code = 2) { console.error(`[patch-audit] ${msg}`); process.exit(code); }

/** Stable identity for a patch: first non-empty line of the search text + its byte length. */
function patchKey(search) {
  const s = String(search);
  const head = (s.split('\n').find((l) => l.trim()) || '').trim().slice(0, 60);
  return `${head}/${s.length}`;
}

async function loadBundle() {
  if (has('--live')) {
    const res = await fetch(LIVE_URL);
    if (!res.ok) die(`could not fetch live bundle: HTTP ${res.status}`);
    return { text: await res.text(), label: LIVE_URL };
  }
  const file = val('--bundle') || CANONICAL;
  if (!fs.existsSync(file)) die(`bundle not found: ${file}`);
  return { text: fs.readFileSync(file, 'utf8'), label: file };
}

function extractSchedulerScript(html) {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  const main = scripts.filter((s) => s.includes('window.MMEDScheduler = scheduler')).pop();
  if (!main) die('bundle contains no scheduler script block');
  return main.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
}

/** Load the adapter, swap in an instrumented replaceSchedulerText, expose rewriteSchedulerScript. */
function loadInstrumentedAdapter(hits) {
  if (!fs.existsSync(ADAPTER)) die(`adapter not found: ${ADAPTER}`);
  let src = fs.readFileSync(ADAPTER, 'utf8');

  // Match the function however it is currently written (pre- or post-assertion-wrapper).
  const re = /function replaceSchedulerText\(text, search, replacement\) \{[\s\S]*?\n\t\}/;
  if (!re.test(src)) die('could not locate replaceSchedulerText in the adapter');
  src = src.replace(re, `function replaceSchedulerText(text, search, replacement) {
\t\tvar n = text.split(search).length - 1;
\t\tglobalThis.__hits.push({ key: globalThis.__patchKey(search), n: n });
\t\treturn n === 0 ? text : text.split(search).join(replacement);
\t}`);

  src = src.replace(/\}\(\)\);\s*$/, 'globalThis.__rw = rewriteSchedulerScript;\n}());');
  if (!/globalThis.__rw/.test(src)) die('could not expose rewriteSchedulerScript');

  globalThis.__hits = hits;
  globalThis.__patchKey = patchKey;
  globalThis.window = { MMEDScheduler: {} };
  globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    head: { appendChild() {} }, body: { classList: { contains: () => false } },
    dispatchEvent() {}, readyState: 'complete'
  };
  globalThis.CustomEvent = function () {};
  (0, eval)(src);
  return globalThis.__rw;
}

const { text: html, label } = await loadBundle();
const hits = [];
const rewrite = loadInstrumentedAdapter(hits);
rewrite(extractSchedulerScript(html));

let expectations = {};
/**
 * Which expectations apply depends on which bundle this is. The adapter has to keep working
 * against the legacy CDN artifact AND the canonical source, and a patch whose behaviour was
 * folded into the source is correctly a no-op there while still being required on legacy.
 */
const sourceRev = (html.match(/MMED_SCHEDULER_SOURCE_REV\s*=\s*"([^"]+)"/) || [])[1] || 'legacy';
let profileName = sourceRev;

if (fs.existsSync(EXPECT_FILE)) {
  const table = JSON.parse(fs.readFileSync(EXPECT_FILE, 'utf8'));
  if (table.profiles) {
    const declaredProfile = table.profiles[sourceRev];
    const profile = declaredProfile && declaredProfile.extends
      ? table.profiles[declaredProfile.extends]
      : declaredProfile;
    if (!profile && !EMIT) {
      die(`no expectations profile for source revision "${sourceRev}". Add one to ${path.relative(ROOT, EXPECT_FILE)}.`, 2);
    }
    expectations = (profile && profile.patches) || {};
  } else {
    expectations = table.patches || {};
    profileName = '(unprofiled)';
  }
}

const results = hits.map((h, i) => {
  const spec = expectations[h.key];
  const expected = spec ? spec.expected : null;
  const required = spec ? spec.required !== false : false;
  const id = spec ? spec.id : `P${String(i + 1).padStart(2, '0')}-UNREGISTERED`;
  const status = expected === null ? 'UNREGISTERED' : (h.n === expected ? 'PASS' : 'FAIL');
  return { id, key: h.key, expected, actual: h.n, status, required };
});

if (EMIT) {
  const out = { _comment: 'Generated by scheduler_patch_audit.mjs --emit-expectations. expected=0 means a deliberate no-op (dual-variant fallback, or upstream already contains the patched form).', patches: {} };
  results.forEach((r, i) => {
    out.patches[r.key] = {
      id: r.id.endsWith('UNREGISTERED') ? `P${String(i + 1).padStart(2, '0')}` : r.id,
      expected: r.actual,
      required: true
    };
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const requiredFailures = results.filter((r) => r.required && r.status !== 'PASS');
const unregistered = results.filter((r) => r.status === 'UNREGISTERED');

if (!QUIET) {
  console.log(`[patch-audit] bundle:  ${label}`);
  console.log(`[patch-audit] adapter: ${path.relative(ROOT, ADAPTER)}`);
  console.log(`[patch-audit] profile: ${profileName}\n`);
  console.log('status        exp  act  id');
  console.log('────────────  ───  ───  ──────────────────────────────────────────');
  for (const r of results) {
    console.log(
      `${r.status.padEnd(12)}  ${String(r.expected ?? '?').padStart(3)}  ${String(r.actual).padStart(3)}  ${r.id}`
    );
  }
  console.log(`\npatches=${results.length}  pass=${results.filter(r => r.status === 'PASS').length}  ` +
              `fail=${results.filter(r => r.status === 'FAIL').length}  unregistered=${unregistered.length}`);
  if (unregistered.length) {
    console.log('\n[patch-audit] UNREGISTERED patches found. Regenerate the expectations table:');
    console.log('  node _SYSTEM/tools/scheduler_patch_audit.mjs --emit-expectations > _SYSTEM/tools/scheduler_patch_expectations.json');
  }
  if (requiredFailures.length) {
    console.log('\n[patch-audit] REQUIRED PATCH FAILURES:');
    for (const r of requiredFailures) console.log(`  ${r.id}  expected ${r.expected}, got ${r.actual}\n    ${r.key}`);
  }
}

process.exit(requiredFailures.length ? 1 : 0);

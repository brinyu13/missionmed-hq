#!/usr/bin/env node
/**
 * scheduler_adapter_parity.mjs — MX-APPT-5002
 *
 * Proves that a change to assets/scheduler-mount.js did not alter the script the
 * student actually executes. Runs the real patch pass from two adapter versions over
 * the same bundle and compares the rewritten output byte-for-byte.
 *
 * This is the V1 regression proof for any adapter edit: instrumentation, logging and
 * assertions must be observationally invisible to the shipped Scheduler.
 *
 * Exit codes: 0 = byte-identical   1 = output differs   2 = usage/IO error
 *
 * Usage:
 *   node scheduler_adapter_parity.mjs --before <adapter.js> [--after <adapter.js>] [--bundle <file>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_AFTER = path.join(ROOT, 'wp-content/plugins/missionmed-hub/assets/scheduler-mount.js');
const DEFAULT_BUNDLE = path.join(ROOT, 'LIVE/scheduler/scheduler_v1.html');

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };

const beforePath = val('--before');
const afterPath = val('--after') || DEFAULT_AFTER;
const bundlePath = val('--bundle') || DEFAULT_BUNDLE;

function die(msg) { console.error(`[parity] ${msg}`); process.exit(2); }
if (!beforePath) die('--before <adapter.js> is required');
for (const p of [beforePath, afterPath, bundlePath]) {
  if (!fs.existsSync(p)) die(`not found: ${p}`);
}

function extractSchedulerScript(html) {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  const main = scripts.filter((s) => s.includes('window.MMEDScheduler = scheduler')).pop();
  if (!main) die('bundle contains no scheduler script block');
  return main.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
}

/** Evaluate an adapter in a throwaway global sandbox and return its rewriteSchedulerScript. */
function loadRewriter(adapterFile) {
  let src = fs.readFileSync(adapterFile, 'utf8');
  src = src.replace(/\}\(\)\);\s*$/, 'globalThis.__rw = rewriteSchedulerScript;\n}());');
  if (!/globalThis.__rw/.test(src)) die(`could not expose rewriteSchedulerScript in ${adapterFile}`);

  // Console is silenced: the post-change adapter logs a patch-audit line and that must
  // not be mistaken for a behavioural difference. Output bytes are what is compared.
  const realConsole = globalThis.console;
  globalThis.console = { log() {}, info() {}, warn() {}, error() {} };
  globalThis.window = { MMED_OS: {}, location: { search: '' } };
  globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    head: { appendChild() {} }, body: { classList: { contains: () => false } },
    dispatchEvent() {}, readyState: 'complete'
  };
  globalThis.CustomEvent = function () {};
  globalThis.__rw = undefined;
  (0, eval)(src);
  const rw = globalThis.__rw;
  globalThis.console = realConsole;
  return rw;
}

const script = extractSchedulerScript(fs.readFileSync(bundlePath, 'utf8'));
const before = loadRewriter(beforePath)(script);
const after = loadRewriter(afterPath)(script);

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const hb = sha(before);
const ha = sha(after);

console.log(`[parity] bundle : ${path.relative(ROOT, bundlePath)}`);
console.log(`[parity] before : ${beforePath}`);
console.log(`[parity]          ${before.length} bytes  sha256 ${hb}`);
console.log(`[parity] after  : ${afterPath}`);
console.log(`[parity]          ${after.length} bytes  sha256 ${ha}`);

if (hb === ha) {
  console.log('\n[parity] PASS — rewritten scheduler script is byte-identical. V1 behaviour unchanged.');
  process.exit(0);
}

console.log('\n[parity] FAIL — rewritten output differs.');
const min = Math.min(before.length, after.length);
let i = 0;
while (i < min && before[i] === after[i]) i += 1;
console.log(`[parity] first divergence at byte ${i}`);
console.log(`[parity]   before: ${JSON.stringify(before.slice(i, i + 160))}`);
console.log(`[parity]   after : ${JSON.stringify(after.slice(i, i + 160))}`);
process.exit(1);

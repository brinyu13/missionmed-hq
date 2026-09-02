#!/usr/bin/env node
/**
 * scheduler_grid_benchmark.mjs — MX-APPT-5002D
 *
 * Measures weekGridMarkup(), the Scheduler's hot path, against real slot data.
 *
 * Unlike the MX-APPT-5001 prototype benchmark, nothing here is hand-copied. Both the BEFORE
 * and AFTER code are extracted from a real bundle *after* the adapter's patch pass has run,
 * so what is timed is what a student's browser actually executes. That matters: several
 * adapter patches change the very functions being measured, so timing the raw bundle source
 * would overstate the row count and mismeasure the baseline.
 *
 * Usage:
 *   node scheduler_grid_benchmark.mjs --before <legacy.html> --after <canonical.html>
 *   node scheduler_grid_benchmark.mjs --before <legacy.html>          # baseline only
 *   node scheduler_grid_benchmark.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADAPTER = path.join(ROOT, 'wp-content/plugins/missionmed-hub/assets/scheduler-mount.js');
const CANONICAL = path.join(ROOT, 'LIVE/scheduler/scheduler_v1.html');

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const JSON_OUT = argv.includes('--json');

const BEFORE_FILE = val('--before');
const AFTER_FILE = val('--after') || CANONICAL;

function die(msg) { console.error(`[bench] ${msg}`); process.exit(2); }

/* ------------------------------------------------------------------ extraction */

function extractSchedulerScript(html) {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  const main = scripts.filter((s) => s.includes('window.MMEDScheduler = scheduler')).pop();
  if (!main) die('bundle contains no scheduler script block');
  return main.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
}

/** Run the adapter's real patch pass so we measure post-patch code. */
function applyAdapterPatches(scriptText) {
  let src = fs.readFileSync(ADAPTER, 'utf8');
  src = src.replace(/\}\(\)\);\s*$/, 'globalThis.__rw = rewriteSchedulerScript;\n}());');
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
  if (!rw) die('could not load the adapter patch pass');
  return rw(scriptText);
}

/** Pull `function NAME(...) { ... }` out of a script by brace matching. */
function extractFunction(script, name) {
  const marker = `function ${name}(`;
  const start = script.indexOf(marker);
  if (start === -1) return null;
  const open = script.indexOf('{', start);
  if (open === -1) return null;
  let depth = 0;
  let inString = null;
  for (let i = open; i < script.length; i += 1) {
    const ch = script[i];
    const prev = script[i - 1];
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return script.slice(start, i + 1);
    }
  }
  return null;
}

const NEEDED = [
  'weekGridMarkup', 'weekDays', 'weekLabel', 'matrixTimeRows', 'matrixTimeLabel',
  'slotForMatrixCell', 'buildSlotIndex', 'matrixSlotReserved', 'sortedSlots', 'slotStart',
  'slotKey', 'localDateKey', 'easternTimeKey', 'dateInputValue', 'escapeHTML', 'escapeAttr'
];

/** Build a runnable module exposing weekGridMarkup over a mutable `scheduler.state`. */
function buildHarness(script) {
  const parts = [];
  const rev = (script.match(/MMED_SCHEDULER_SOURCE_REV\s*=\s*"([^"]+)"/) || [])[1] || 'legacy';

  parts.push('var EASTERN_TIMEZONE = "America/New_York";');
  // Hoisted formatters exist only in the canonical source; define them either way so the
  // extracted canonical functions resolve. The legacy functions never reference them.
  for (const decl of [
    'var EASTERN_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: EASTERN_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });',
    'var EASTERN_TIME_FORMAT = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });',
    'var EASTERN_DAY_LABEL_FORMAT = new Intl.DateTimeFormat([], { weekday: "short", month: "short", day: "numeric", timeZone: EASTERN_TIMEZONE });'
  ]) parts.push(decl);

  parts.push('var scheduler = { state: { slots: [], date: "2026-09-09", selectedSlotKey: "" } };');

  const found = [];
  for (const name of NEEDED) {
    const fn = extractFunction(script, name);
    if (fn) { parts.push(fn); found.push(name); }
  }
  if (!found.includes('weekGridMarkup')) die('weekGridMarkup not found in this bundle');

  parts.push('return { weekGridMarkup: weekGridMarkup, matrixTimeRows: matrixTimeRows, state: scheduler.state };');
  // eslint-disable-next-line no-new-func
  const factory = new Function(parts.join('\n\n'));
  return { api: factory(), rev, found };
}

/* ------------------------------------------------------------------ fixture */

/**
 * Real live slot shape, captured 2026-09-01 from GET /api/scheduler/availability: 15-minute
 * starts, ISO-8601 UTC, one provider. Spread over Mon-Fri and a 12-hour publishable day so
 * that even the 200-slot case lands in 200 distinct grid cells rather than stacking.
 */
function makeSlots(n) {
  const out = [];
  const STEPS_PER_DAY = 48;                    // 12:00Z-24:00Z at 15-minute starts
  const base = Date.UTC(2026, 8, 7, 12, 0, 0); // Mon 2026-09-07 12:00Z
  for (let i = 0; out.length < n; i += 1) {
    const day = Math.floor(i / STEPS_PER_DAY) % 5;
    const step = i % STEPS_PER_DAY;
    const start = base + day * 86400000 + step * 15 * 60000;
    out.push({
      startAt: new Date(start).toISOString(),
      endAt: new Date(start + 30 * 60000).toISOString(),
      providerId: '00000000-0000-4000-8000-000000000202',
      resourceId: null,
      appointmentTypeId: '00000000-0000-4000-8000-000000000510',
      timezone: 'America/New_York',
      available: true
    });
    if (i > n * 8) break;
  }
  return out.slice(0, n);
}

function bench(fn, iters) {
  fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i += 1) fn();
  return Number(process.hrtime.bigint() - t0) / 1e6 / iters;
}

/* ------------------------------------------------------------------ run */

if (!BEFORE_FILE) die('--before <bundle.html> is required');
for (const p of [BEFORE_FILE, AFTER_FILE]) if (!fs.existsSync(p)) die(`not found: ${p}`);

const variants = [];
for (const [label, file] of [['BEFORE', BEFORE_FILE], ['AFTER', AFTER_FILE]]) {
  const patched = applyAdapterPatches(extractSchedulerScript(fs.readFileSync(file, 'utf8')));
  const { api, rev } = buildHarness(patched);
  variants.push({ label, file, rev, api });
}

const COUNTS = [24, 60, 108, 200];
const ITERS = { 24: 40, 60: 25, 108: 15, 200: 8 };
const rows = [];

for (const n of COUNTS) {
  const row = { slots: n };
  for (const v of variants) {
    v.api.state.slots = makeSlots(n);
    const html = v.api.weekGridMarkup();
    const rowCount = v.api.matrixTimeRows(undefined).length;
    const openCount = (html.match(/sos-sched-open-slot/g) || []).length;
    row[v.label] = {
      ms: bench(() => v.api.weekGridMarkup(), ITERS[n]),
      rows: rowCount,
      openSlots: openCount,
      rev: v.rev
    };
  }
  rows.push(row);
}

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

console.log('MX-APPT-5002D — weekGridMarkup() benchmark (post-adapter-patch, as executed)');
console.log(`BEFORE: ${path.basename(variants[0].file)}  rev=${variants[0].rev}`);
console.log(`AFTER : ${path.basename(variants[1].file)}  rev=${variants[1].rev}`);
console.log(`node ${process.version}\n`);
console.log('slots │ rows │  BEFORE ms │   AFTER ms │  speedup │ <=16ms │ parity');
console.log('──────┼──────┼────────────┼────────────┼──────────┼────────┼───────');
for (const r of rows) {
  const b = r.BEFORE, a = r.AFTER;
  const parity = b.openSlots === a.openSlots ? `ok(${a.openSlots})` : `DIFF ${b.openSlots}/${a.openSlots}`;
  console.log(
    `${String(r.slots).padStart(5)} │ ${String(b.rows).padStart(4)} │ ` +
    `${b.ms.toFixed(2).padStart(10)} │ ${a.ms.toFixed(3).padStart(10)} │ ` +
    `${(b.ms / a.ms).toFixed(0).padStart(7)}x │ ${(a.ms <= 16 ? 'PASS' : 'FAIL').padStart(6)} │ ${parity}`
  );
}
console.log('\nparity = number of bookable slot buttons rendered; identical means the fix is');
console.log('behaviour-preserving, not just faster.');

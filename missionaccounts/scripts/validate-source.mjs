import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = process.env.MISSIONACCOUNTS_5000B_LEDGER || '/Users/brianb/MissionMed/_REPORTS/EXAMPREP/DrJ_Billing_Rescue_2026/MX-EXAMPREP-5000B_Reconciled_Ledger.json';
const graphPath = process.env.MISSIONACCOUNTS_5000B_IDENTITY || '/Users/brianb/MissionMed/_REPORTS/EXAMPREP/DrJ_Billing_Rescue_2026/MX-EXAMPREP-5000B_Identity_Graph.json';
const expected = {
  ledger: '6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108',
  graph: 'c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee',
};

async function load(file, digest) {
  const bytes = await readFile(file);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== digest) throw new Error(`source hash mismatch for ${path.basename(file)}: ${actual}`);
  return { data: JSON.parse(bytes), actual, byte_count: bytes.byteLength };
}

const [ledger, graph] = await Promise.all([load(ledgerPath, expected.ledger), load(graphPath, expected.graph)]);
const cycleRows = new Map();
for (const row of ledger.data.human_cycle_summaries) {
  const dates = [...new Set(row.session_dates)];
  const amount = dates.length >= 16 ? 300 : dates.length * 25;
  const existing = cycleRows.get(row.cycle) || { people: 0, events: 0, days: 0, same_day_reductions: 0, amount: 0 };
  existing.people += 1;
  existing.events += row.attendance;
  existing.days += dates.length;
  existing.same_day_reductions += row.attendance - dates.length;
  existing.amount += amount;
  cycleRows.set(row.cycle, existing);
}

const report = {
  ticket: 'MX-MISSIONACCOUNTS-5301P',
  status: 'SOURCE_VALIDATED_NOT_IMPORTED',
  generated_at: ledger.data.generated_at,
  artifacts: {
    reconciled_ledger: { sha256: ledger.actual, byte_count: ledger.byte_count },
    identity_graph: { sha256: graph.actual, byte_count: graph.byte_count },
  },
  controls: {
    attendance_events: ledger.data.reconciled_attendance_ledger.length,
    human_cycle_rows: ledger.data.human_cycle_summaries.length,
    identity_nodes: graph.data.nodes.length,
    applied_merge_groups: ledger.data.applied_merge_groups.length,
    unresolved_relationships: ledger.data.unresolved_relationships.length,
    cycles: Object.fromEntries(cycleRows),
    total_amount: [...cycleRows.values()].reduce((sum, cycle) => sum + cycle.amount, 0),
  },
  privacy: 'No names, emails, aliases, meeting IDs, or participant records are written to this report.',
};

const required = {
  attendance_events: 3941,
  human_cycle_rows: 498,
  total_amount: 77075,
  'Cycle 1': { events: 1295, days: 1072, same_day_reductions: 223, amount: 25425 },
  'Cycle 2': { events: 1390, days: 1141, same_day_reductions: 249, amount: 26575 },
  'Cycle 3': { events: 1256, days: 1051, same_day_reductions: 205, amount: 25075 },
};
if (report.controls.attendance_events !== required.attendance_events || report.controls.human_cycle_rows !== required.human_cycle_rows || report.controls.total_amount !== required.total_amount) {
  throw new Error(`5000B global controls failed: ${JSON.stringify(report.controls)}`);
}
for (const cycle of ['Cycle 1', 'Cycle 2', 'Cycle 3']) {
  for (const [key, value] of Object.entries(required[cycle])) {
    if (report.controls.cycles[cycle]?.[key] !== value) throw new Error(`${cycle} ${key} expected ${value}, got ${report.controls.cycles[cycle]?.[key]}`);
  }
}

await mkdir(path.join(appRoot, 'evidence'), { recursive: true });
await writeFile(path.join(appRoot, 'evidence', 'source-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.controls, null, 2));

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const defaultSource = '/Users/brianb/MissionMed/_PROTOTYPES/MISSIONACCOUNTS/MX-MISSIONACCOUNTS-5300A/MX-MISSIONACCOUNTS-5300A_CANON_StoryForge_Prototype.html';
const source = process.env.MISSIONACCOUNTS_CANON_PATH || defaultSource;
const expected = '3cd77871f4cb1bc70d71a87d2fa9fe0f85604969e4cbe94d44aa9816386a82d8';
const bytes = await readFile(source);
const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== expected) throw new Error(`5300A canon hash mismatch: expected ${expected}, got ${actual}`);

const runtimeTag = '\n<script type="module" src="./missionaccounts-runtime.js"></script>\n';
const html = bytes.toString('utf8').replace('</body>', `${runtimeTag}</body>`);
const privateDataMatch = html.match(/<script id="xpData" type="application\/json">([\s\S]*?)<\/script>/);
if (!privateDataMatch) throw new Error('Founder canon private data payload was not found');
const privateData = JSON.parse(privateDataMatch[1]);
const scopedData = {
  meta: {
    ticket: 'MX-MISSIONACCOUNTS-5301P',
    source: 'authenticated-role-scoped-runtime',
    controls: {
      sessions: 0,
      humans: 0,
      events: 0,
      groups: 0,
      clusters: 0,
      unresolved_nodes: 0,
      per_cycle: {},
    },
  },
  cycles: [
    { key: 'june', src: 'Cycle 1', label: 'June Cycle', start: '2026-06-08', end: '2026-07-13', sessions: 0, humans: 0, events: 0, full: 0, per: 0, amount: 0, s1: 0, s23: 0, s1_sessions: 0, s23_sessions: 0, days: 0 },
    { key: 'july', src: 'Cycle 2', label: 'July Cycle', start: '2026-07-14', end: '2026-08-11', sessions: 0, humans: 0, events: 0, full: 0, per: 0, amount: 0, s1: 0, s23: 0, s1_sessions: 0, s23_sessions: 0, days: 0 },
    { key: 'august', src: 'Cycle 3', label: 'August Cycle', start: '2026-08-12', end: '2026-09-04', sessions: 0, humans: 0, events: 0, full: 0, per: 0, amount: 0, s1: 0, s23: 0, s1_sessions: 0, s23_sessions: 0, days: 0 },
  ],
  sessions: [],
  students: [],
  events: [],
  groups: [],
  clusters: [],
  devices: [],
  distinct: [],
  excluded: [],
  review_meeting: null,
};
const gate = `<style id="missionaccounts-runtime-gate-style">
html[data-missionaccounts-build="production"] #missionaccountsRuntimeGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#0a0d14;color:#f4ead7;font:600 15px/1.5 system-ui,sans-serif;text-align:center}
html[data-missionaccounts-build="production"][data-missionaccounts-runtime="ready"] #missionaccountsRuntimeGate{display:none}
</style><div id="missionaccountsRuntimeGate" role="status" aria-live="polite">Opening your authorized MissionAccounts workspace…</div>`;
let productionHtml = html
  .replace('<html lang="en">', '<html lang="en" data-missionaccounts-build="production">')
  .replace(/<script id="xpData" type="application\/json">[\s\S]*?<\/script>/, `<script id="xpData" type="application/json">${JSON.stringify(scopedData)}</script>`)
  .replace('<body>', `<body>${gate}`)
  .replace(
    "function load(){ try{ const raw=localStorage.getItem(WS_KEY); if(!raw) return fresh(); const o=JSON.parse(raw); const w=Object.assign(fresh(), o); migrate(w); return w; }catch(e){ return fresh(); } }",
    "function load(){ if(document.documentElement.dataset.missionaccountsBuild==='production') return fresh(); try{ const raw=localStorage.getItem(WS_KEY); if(!raw) return fresh(); const o=JSON.parse(raw); const w=Object.assign(fresh(), o); migrate(w); return w; }catch(e){ return fresh(); } }",
  )
  .replace(
    "function save(){ try{ localStorage.setItem(WS_KEY, JSON.stringify(WS)); }catch(e){} }",
    "function save(){ if(document.documentElement.dataset.missionaccountsBuild==='production') return; try{ localStorage.setItem(WS_KEY, JSON.stringify(WS)); }catch(e){} }",
  )
  .replace(
    "function meStudent(){ if(WS.meStudent==null){ const s=D.students.find(x=>x.n==='Ahunna Nzerem'); WS.meStudent=s?s.i:0; } return model().eff[model().canonOf(WS.meStudent)]; }",
    "function meStudent(){ if(WS.meStudent==null){ WS.meStudent=D.students[0]?.i??0; } return model().eff[model().canonOf(WS.meStudent)]; }",
  );
if (!productionHtml.includes('data-missionaccounts-build="production"')) throw new Error('Production build marker was not injected');
if (!productionHtml.includes('authenticated-role-scoped-runtime')) throw new Error('Production scoped data placeholder was not injected');
if (productionHtml.includes('MX-EXAMPREP-5000B_Reconciled_Ledger.json')) throw new Error('Production shell still contains private historical data');
const leakedStudentNames = privateData.students
  .map(student => String(student.n || ''))
  .filter(name => name.length >= 4 && productionHtml.includes(name));
if (leakedStudentNames.length) throw new Error(`Production shell still contains student names: ${leakedStudentNames.join(', ')}`);
await mkdir(path.join(appRoot, 'public'), { recursive: true });
await writeFile(path.join(appRoot, 'public', 'index.html'), html);
await writeFile(path.join(appRoot, 'public', 'index.production.html'), productionHtml);
await writeFile(path.join(appRoot, 'public', 'canon-manifest.json'), JSON.stringify({
  ticket: 'MX-MISSIONACCOUNTS-5301P',
  source,
  source_sha256: actual,
  generated_at: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`Materialized Founder canon ${actual} (${bytes.byteLength} bytes) with a role-scoped production shell`);

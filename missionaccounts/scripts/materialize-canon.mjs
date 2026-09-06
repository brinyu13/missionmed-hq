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
html[data-missionaccounts-build="production"][data-missionaccounts-runtime="authenticated-readonly"] #missionaccountsRuntimeGate{display:none}
html[data-missionaccounts-build="production"] [data-reset],html[data-missionaccounts-build="production"] [data-export]{display:none!important}
</style><div id="missionaccountsRuntimeGate" role="status" aria-live="polite">Opening your authorized MissionAccounts workspace…</div>`;
const bootstrapRouteGuard = `<script id="missionaccounts-bootstrap-route-guard">(()=>{const requested=location.hash;if(requested&&requested!=='#/'&&requested!=='#'){window.__MISSIONACCOUNTS_REQUESTED_HASH=requested;history.replaceState(null,'',location.pathname+location.search+'#/');}})();</script>`;
const canonicalBodyOpen = '<body data-lens="admin" data-context="xp" class="is-booting">';
if (!html.includes(canonicalBodyOpen)) throw new Error('Founder canon body seam is missing');
let productionHtml = html
  .replace('<html lang="en">', '<html lang="en" data-missionaccounts-build="production">')
  .replace(/<script id="xpData" type="application\/json">[\s\S]*?<\/script>/, `<script id="xpData" type="application/json">${JSON.stringify(scopedData)}</script>`)
  .replace(canonicalBodyOpen, `${canonicalBodyOpen}${gate}${bootstrapRouteGuard}`)
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
const productionCopyReplacements = [
  ['<title>MissionAccounts · MX-MISSIONACCOUNTS-5300A canon prototype</title>', '<title>MissionAccounts · MissionMed Institute</title>'],
  ['<meta name="description" content="MX-MISSIONACCOUNTS-5300A — MissionAccounts, the Exam Prep attendance · billing · exam-progress Matrix app. StoryForge-family 1:1 port (opening sequence, command home) on the Founder-approved 5200P-CANON baseline, hydrated with the real MX-EXAMPREP-5000B reconciled Dr J Live Drills data. Prototype only: no backend, no Stripe, no Zoom, no production. Corrected billing rule: one $25 charge per calendar day.">', '<meta name="description" content="MissionAccounts — the authenticated MissionMed Exam Prep attendance, billing, and exam-progress Matrix application. One $25 charge maximum per calendar day.">'],
  ['<meta name="mx-ticket" content="MX-MISSIONACCOUNTS-5300A">', '<meta name="mx-ticket" content="MX-MISSIONACCOUNTS-5301P">'],
  ['aria-label="Prototype review controls"', 'aria-label="Administrative view controls"'],
  ['Prototype · view as', 'View as'],
  ['title="Preview as a different student (prototype only)"', 'title="Preview as a different authorized student"'],
  ['Prototype — your decisions are saved in this browser only', 'MissionAccounts · server-authoritative record'],
  ['Working prototype state', 'Server-authoritative state'],
  ['Prototype: nothing is sent from here.', 'Nothing is sent automatically from here.'],
  ["Prototype control — record the Founder's decision:", 'Founder-approved rule — read-only in production:'],
  ['Prototype review control only. A real student signs in and only ever sees their own record.', 'Administrative preview only. A student signs in and only ever sees their own authorized record.'],
  ['entries · stored only in this browser', 'entries in this session · durable audit remains on the server'],
  ['Prototype — Final terms to be approved before production.', 'Final terms are not approved; automatic billing remains disabled.'],
];
for (const [needle, replacement] of productionCopyReplacements) {
  if (!productionHtml.includes(needle)) throw new Error(`Production truthfulness seam missing: ${needle}`);
  productionHtml = productionHtml.replaceAll(needle, replacement);
}
const originalRuntimeExport = `render(); showOpeningExperience();
window.__XP = {D, WS:()=>WS, model, cycleStats, render, decide, addCorr, undoCorr, setPM, setAuth, setContact, editSheet, otherSheet, paymentSheet, authSheet, resetSheet, applyTheme, setTheme, submitExam, decideExam, markPassed, withdrawExam, setComp, setRule, recordRuleDecision, graceWindows, basisOf, ORIG_TOTAL, migrate, touch, decideIdent, examView, examSheet, examDecideSheet, passedSheet, compSheet, showOpeningExperience, skipOpening, cmdRoute, meStudent, accountState, suggestionFor, unitsOf};`;
const authoritativeRuntimeExport = `function hydrateAuthoritative(nextD,nextWS,idMaps){
  if(document.documentElement.dataset.missionaccountsBuild!=='production') throw new Error('Authoritative hydration is production-only');
  if(!nextD||!Array.isArray(nextD.cycles)||!Array.isArray(nextD.students)||!Array.isArray(nextD.sessions)||!Array.isArray(nextD.events)) throw new Error('Authoritative MissionAccounts model is incomplete');
  const nextCycles=new Map(nextD.cycles.map(c=>[c.key,c]));
  CY.forEach(c=>{ const next=nextCycles.get(c.key); if(!next) throw new Error('Authoritative cycle is missing: '+c.key); Object.assign(c,next,{name:next.label.replace(' Cycle',' 2026')}); });
  ['sessions','students','events','groups','clusters','devices','distinct','excluded'].forEach(key=>{ D[key].splice(0,D[key].length,...(nextD[key]||[])); });
  D.meta=nextD.meta||{}; D.review_meeting=nextD.review_meeting||null; D.id_maps=idMaps||{};
  WS=Object.assign(fresh(),nextWS||{}); migrate(WS);
  Object.keys(ORIG_TOTAL).forEach(key=>delete ORIG_TOTAL[key]);
  D.cycles.forEach(c=>{ ORIG_TOTAL[c.key]=D.students.reduce((total,student)=>total+(student.c[c.key]?writtenRule(student.c[c.key].att):0),0); });
  CACHE=null; CACHE_REV=-1; REV++; render();
  return {students:D.students.length,sessions:D.sessions.length,events:D.events.length,lens:WS.lens};
}
render(); showOpeningExperience();
window.__XP = {D, WS:()=>WS, model, cycleStats, render, decide, addCorr, undoCorr, setPM, setAuth, setContact, editSheet, otherSheet, paymentSheet, authSheet, resetSheet, applyTheme, setTheme, submitExam, decideExam, markPassed, withdrawExam, setComp, setRule, recordRuleDecision, graceWindows, basisOf, ORIG_TOTAL, migrate, touch, decideIdent, examView, examSheet, examDecideSheet, passedSheet, compSheet, showOpeningExperience, skipOpening, cmdRoute, meStudent, accountState, suggestionFor, unitsOf, hydrateAuthoritative};`;
productionHtml = productionHtml.replace(originalRuntimeExport, authoritativeRuntimeExport);
if (!productionHtml.includes('function hydrateAuthoritative(nextD,nextWS,idMaps)')) throw new Error('Authoritative canon hydration seam was not injected');
const zoomHealthHelper = `function missionAccountsZoomHealth(){
  const h=D.meta.integration_health||{};
  const z=h.latest_zoom_sync||null;
  const state=z&&z.state?z.state:'not_connected';
  const stamp=z&&(z.finished_at||z.started_at)?Date.parse(z.finished_at||z.started_at):NaN;
  const sessions=Number(z&&z.stats&&z.stats.sessions||0);
  const rows=Number(z&&z.stats&&z.stats.source_rows||0);
  return {
    stateLabel:state==='ok'?'Healthy':state==='failed'?'Failed':state==='running'?'Running':'Not connected',
    stateChip:state==='ok'?'approved':state==='failed'?'review':state==='running'?'future':'none',
    readiness:h.zoom_sync_enabled===true&&h.zoom_provider_configured===true?'Provider configured':h.zoom_provider_configured===true?'Configured · sync disabled':'Ready for integration',
    readinessChip:h.zoom_sync_enabled===true&&h.zoom_provider_configured===true?'approved':'future',
    last:Number.isFinite(stamp)?fmtStamp(stamp):'—',
    next:'— · scheduler not registered',
    health:state==='ok'?('Last run persisted '+sessions+' classes · '+rows+' source rows'):state==='failed'?('Failed · '+(z.error||'review required')):state==='running'?'Run in progress':'— · no runs yet',
    exceptions:Number(h.open_integration_exceptions||0),
  };
}
`;
productionHtml = productionHtml.replace('/* ---------------- ADVANCED ---------------- */', `${zoomHealthHelper}/* ---------------- ADVANCED ---------------- */`);
const staticZoomState = `<div class="zoomPort"><div class="zState"><span class="chip none">Not connected</span><span class="chip future">Ready for integration</span></div>`;
const dynamicZoomState = `<div class="zoomPort"><div class="zState"><span class="chip \${missionAccountsZoomHealth().stateChip}">\${esc(missionAccountsZoomHealth().stateLabel)}</span><span class="chip \${missionAccountsZoomHealth().readinessChip}">\${esc(missionAccountsZoomHealth().readiness)}</span></div>`;
if (!productionHtml.includes(staticZoomState)) throw new Error('Canonical Zoom integration state surface is missing');
productionHtml = productionHtml.replace(staticZoomState, dynamicZoomState);
const staticZoomFacts = `<div class="kv" style="margin-top:12px"><span class="k">Last sync</span><span class="v">—</span><span class="k">Next sync</span><span class="v">— · daily, once authorized</span><span class="k">Health</span><span class="v">— · no runs yet</span><span class="k">Review exceptions</span><span class="v"><a class="linkish" href="#/review">\${model().openClusters.length+openDevices().length} open name / attendee questions</a></span><span class="k">Source of the data shown today</span><span class="v">MX-EXAMPREP-5000B reconciled ledger (one-time reconstruction)</span></div>`;
const dynamicZoomFacts = `<div class="kv" style="margin-top:12px"><span class="k">Last sync</span><span class="v">\${esc(missionAccountsZoomHealth().last)}</span><span class="k">Next sync</span><span class="v">\${esc(missionAccountsZoomHealth().next)}</span><span class="k">Health</span><span class="v">\${esc(missionAccountsZoomHealth().health)}</span><span class="k">Review exceptions</span><span class="v">\${missionAccountsZoomHealth().exceptions} integration exception\${missionAccountsZoomHealth().exceptions===1?'':'s'} · <a class="linkish" href="#/review">\${model().openClusters.length+openDevices().length} open identity question\${model().openClusters.length+openDevices().length===1?'':'s'}</a></span><span class="k">Source of the data shown today</span><span class="v">MX-EXAMPREP-5000B reconciled ledger (one-time reconstruction)</span></div>`;
if (!productionHtml.includes(staticZoomFacts)) throw new Error('Canonical Zoom integration facts surface is missing');
productionHtml = productionHtml.replace(staticZoomFacts, dynamicZoomFacts);
const productionActionGuards = [
  ["function decide(si, k, t, amt, note){", "function decide(si, k, t, amt, note){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('billing-decision',{si,k,t,amt,note});"],
  ["function addCorr(si, type, fields){", "function addCorr(si, type, fields){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('attendance-correction',{si,type,fields});"],
  ["function undoCorr(id){", "function undoCorr(id){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('attendance-correction-reversal',{id});"],
  ["function setContact(si, email, phone){", "function setContact(si, email, phone){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('student-contact',{si,email,phone});"],
  ["function setPM(si, state){", "function setPM(si, state){ if(document.documentElement.dataset.missionaccountsBuild==='production') return state==='none'?window.MissionAccountsRuntime.dispatch('payment-remove',{si}):window.MissionAccountsRuntime.dispatch('payment-setup',{si,mode:'add'});"],
  ["function setAuth(si, state){", "function setAuth(si, state){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch(state==='authorized'?'billing-authorization':'billing-authorization-revoke',{si});"],
  ["function paymentSheet(si, mode){", "function paymentSheet(si, mode){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('payment-setup',{si,mode});"],
  ["function authSheet(si){", "function authSheet(si){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('billing-authorization',{si});"],
  ["function resetSheet(){", "function resetSheet(){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('unsupported',{message:'Server-authoritative MissionAccounts records cannot be reset in the browser.'});"],
  ["function setPolicy(k, v){", "function setPolicy(k, v){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('cycle-policy',{k,value:v});"],
  ["function submitExam(si, step, date, by){", "function submitExam(si, step, date, by){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch(by==='admin'?'admin-exam-submit':'student-exam-submit',{si,step,date});"],
  ["function decideExam(si, action, note, newDate){", "function decideExam(si, action, note, newDate){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('exam-transition',{si,action,note,newDate});"],
  ["function markPassed(si, by){", "function markPassed(si, by){ if(document.documentElement.dataset.missionaccountsBuild==='production') return by==='student'?window.MissionAccountsRuntime.dispatch('student-passed',{si}):window.MissionAccountsRuntime.dispatch('exam-transition',{si,action:'passed',note:'Passed'});"],
  ["function withdrawExam(si){", "function withdrawExam(si){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('student-exam-withdraw',{si});"],
  ["function setComp(si, allowance, joined, reason, retro){", "function setComp(si, allowance, joined, reason, retro){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('comp',{si,allowance,joined,reason,retro});"],
  ["function recordRuleDecision(mode, note){", "function recordRuleDecision(mode, note){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('unsupported',{message:'The Founder rule decision is locked and read-only.'});"],
  ["function decideIdent(cl, d, canon){", "function decideIdent(cl, d, canon){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('unsupported',{message:'Identity adjudication is not enabled yet.'});"],
  ["function decideDevice(dv, d, si){", "function decideDevice(dv, d, si){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('unsupported',{message:'Device identity adjudication is not enabled yet.'});"],
  ["function markReady(si,k,v){", "function markReady(si,k,v){ if(document.documentElement.dataset.missionaccountsBuild==='production') return window.MissionAccountsRuntime.dispatch('invoice-readiness',{si,k,v});"],
];
for (const [needle, replacement] of productionActionGuards) {
  if (!productionHtml.includes(needle)) throw new Error(`Production action seam missing: ${needle}`);
  productionHtml = productionHtml.replace(needle, replacement);
}
const studentViewHead = "function viewMe(sub){ const e=meStudent(); const cyclesWith=CYK.filter(k=>e.c[k]); const latest=cyclesWith[cyclesWith.length-1];";
const productionStudentViewHead = `${studentViewHead} if(document.documentElement.dataset.missionaccountsBuild==='production'&&!latest&&!['billing','exam'].includes(sub)) sub='billing';`;
if (!productionHtml.includes(studentViewHead)) throw new Error('Canonical student empty-state seam is missing');
productionHtml = productionHtml.replace(studentViewHead, productionStudentViewHead);
const reportRouteAutoOpen = "main.innerHTML=html; main.scrollTop=0; bind(main); if(top==='me' && r.q.report==='1'){ setTimeout(reportSheet,50); }";
const productionReportRouteAutoOpen = "main.innerHTML=html; main.scrollTop=0; bind(main); if(top==='me' && r.q.report==='1'){ history.replaceState(null,'',location.pathname+location.search+'#/me'); setTimeout(reportSheet,50); }";
if (!productionHtml.includes(reportRouteAutoOpen)) throw new Error('Canonical report auto-open seam is missing');
productionHtml = productionHtml.replace(reportRouteAutoOpen, productionReportRouteAutoOpen);
productionHtml = productionHtml.replace(
  'Tell Dr J what looks wrong. In the real app this goes to her review list.',
  'Tell Dr J what looks wrong. This goes to her private review list.',
);
const productionAsyncHandlers = [
  [
    "root.querySelectorAll('[data-save-contact]').forEach(b=>b.onclick=()=>{ const si=+b.dataset.saveContact; const em=$('#emailIn').value; if(em && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(em)){ toast('That email does not look right yet.'); $('#emailIn').focus(); return; } setContact(si, em, $('#phoneIn')?$('#phoneIn').value:''); render(); toast(em?'Email saved. The invoice can now be marked ready.':'Email cleared.'); });",
    "root.querySelectorAll('[data-save-contact]').forEach(b=>b.onclick=async()=>{ const si=+b.dataset.saveContact; const em=$('#emailIn').value; if(em && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(em)){ toast('That email does not look right yet.'); $('#emailIn').focus(); return; } const saved=await setContact(si, em, $('#phoneIn')?$('#phoneIn').value:''); if(saved===false)return; render(); toast(em?'Email saved. The invoice can now be marked ready.':'Email cleared.'); });",
  ],
  [
    "root.querySelectorAll('[data-ready]').forEach(b=>b.onclick=()=>{ const [si,k,v]=b.dataset.ready.split('|'); markReady(+si,k,v==='1'); render(); toast(v==='1'?'Marked Ready to send (prototype state).':'Removed from Ready.'); });",
    "root.querySelectorAll('[data-ready]').forEach(b=>b.onclick=async()=>{ const [si,k,v]=b.dataset.ready.split('|'); const saved=await markReady(+si,k,v==='1'); if(saved===false)return; render(); toast(v==='1'?'Marked Ready to send.':'Removed from Ready.'); });",
  ],
  [
    "root.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{ const [si,mode]=b.dataset.pay.split('|'); if(mode==='remove'){ setPM(+si,'none'); render(); toast('Payment method removed (prototype).'); } else paymentSheet(+si,mode); });",
    "root.querySelectorAll('[data-pay]').forEach(b=>b.onclick=async()=>{ const [si,mode]=b.dataset.pay.split('|'); if(mode==='remove'){ await window.MissionAccountsRuntime.dispatch('payment-remove',{si:+si}); } else await paymentSheet(+si,mode); });",
  ],
  [
    "root.querySelectorAll('[data-auth-off]').forEach(b=>b.onclick=()=>{ setAuth(+b.dataset.authOff,'none'); render(); toast('Automatic billing turned off.'); });",
    "root.querySelectorAll('[data-auth-off]').forEach(b=>b.onclick=async()=>{ await window.MissionAccountsRuntime.dispatch('billing-authorization-revoke',{si:+b.dataset.authOff}); });",
  ],
  [
    "$('#rGo').onclick=()=>{ const t=$('#rTxt').value.trim(); if(!t){ $('#rTxt').focus(); return; } logIt('report',`${e.n} reported: ${t}`); touch(); closeSheet(); toast('Sent to Dr J. (Prototype: recorded in working history.)'); };",
    "$('#rGo').onclick=async()=>{ const t=$('#rTxt').value.trim(); if(!t){ $('#rTxt').focus(); return; } if(document.documentElement.dataset.missionaccountsBuild==='production'){ const saved=await window.MissionAccountsRuntime.dispatch('attendance-issue-report',{issueText:t}); if(saved===false)return; closeSheet(); render(); toast('Sent to Dr J for review.'); return; } logIt('report',`${e.n} reported: ${t}`); touch(); closeSheet(); toast('Sent to Dr J. (Prototype: recorded in working history.)'); };",
  ],
];
for (const [needle, replacement] of productionAsyncHandlers) {
  if (!productionHtml.includes(needle)) throw new Error('Production asynchronous action handler is missing');
  productionHtml = productionHtml.replace(needle, replacement);
}
productionHtml = productionHtml.replace('unitsOf, hydrateAuthoritative};', 'unitsOf, hydrateAuthoritative, toast};');
if (!productionHtml.includes("MissionAccountsRuntime.dispatch('billing-decision'")) throw new Error('Production action bus was not injected');
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

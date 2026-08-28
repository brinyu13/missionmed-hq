#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const riseRoot = path.resolve(here, "..");
const workspaceRoot = path.resolve(riseRoot, "..");
const lockedHtmlPath = path.join(
  workspaceRoot,
  "_UI_LOCKS/RISE_FABLE_5002_FOUNDER_APPROVED/source/RISE_NEXTGEN_FABLE_FOUNDER_SHELL.html",
);
const expectedSha256 = "1e1a16aa630449c9e763a04f6f720b51df0afa46822044de165687d7f8758987";
const webDirectory = path.join(riseRoot, "web");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function replaceExact(value, search, replacement, label = search.slice(0, 60)) {
  const count = value.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}; found ${count}`);
  return value.replace(search, replacement);
}

function replaceRange(value, start, end, replacement, label) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Could not locate ${label}`);
  return `${value.slice(0, startIndex)}${replacement}${value.slice(endIndex)}`;
}

function runtimePrelude() {
  return `/* Generated from the founder-approved Fable 5002 shell. Do not edit directly. */
'use strict';

const UNKNOWN_DOMAINS = Object.freeze({
  roster: 'NOT_YET_VERIFIED', leadership: 'NOT_YET_VERIFIED', requirements: 'NOT_YET_VERIFIED',
  visa: 'NOT_YET_VERIFIED', salary: 'NOT_YET_VERIFIED', fellowship: 'NOT_YET_VERIFIED', outcomes: 'NOT_YET_VERIFIED',
});

async function riseFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (globalThis.__RISE_RUNTIME__?.session?.csrfToken && options.method && options.method !== 'GET') {
    headers.set('X-RISE-CSRF', globalThis.__RISE_RUNTIME__.session.csrfToken);
  }
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || \`RISE request failed (\${response.status})\`);
    error.code = body?.error?.code || 'RISE_REQUEST_FAILED';
    error.status = response.status;
    error.details = body?.error?.details;
    if (response.status === 401 && body?.error?.details?.loginUrl) location.assign(body.error.details.loginUrl);
    throw error;
  }
  return body;
}

function identifier(record, namespace) {
  return (record.identifiers || []).find(item => item.namespace === namespace)?.value || null;
}

function shortSpecialty(designation) {
  const known = { 'Internal Medicine': 'IM', 'Family Medicine': 'FM', Pediatrics: 'PEDS', Neurology: 'NEURO', Psychiatry: 'PSYCH' };
  return known[designation] || designation.split(/\\s|\\//).filter(Boolean).map(word => word[0]).join('').slice(0, 6).toUpperCase();
}

function toFableProgram(record) {
  const evidenceCount = Number(record.evidence?.knownEvidenceLabeledClaims ?? record.evidence?.knownClaims ?? 0);
  return {
    id: record.programSpecialtyId,
    legacyId: null,
    acgme: identifier(record, 'ACGME_PROGRAM'),
    name: record.display?.programName || 'Unnamed program',
    inst: record.display?.institution || record.display?.programName || 'Institution not published',
    hospital: record.display?.hospital || null,
    city: record.display?.city || 'Location not published',
    state: record.display?.state || '',
    spec: shortSpecialty(record.designation || 'Program'),
    specName: record.designation || 'Specialty not published',
    track: record.entryFormat || 'Not published',
    url: record.officialUrl || null,
    tier: null,
    officialFacts: evidenceCount,
    depth: evidenceCount ? 'registry' : 'identity',
    verified: record.source?.retrievedAt || record.source?.sourceUpdatedAt || null,
    type: record.programType || 'Not published',
    positions: 'Not published',
    abim: { state: 'NOT_PUBLISHED' },
    domains: { ...UNKNOWN_DOMAINS },
    soap: [],
    aliases: [],
    maturity: 'CANONICAL_IDENTITY_ONLY',
    demo: false,
    rich: null,
  };
}

const MATRIX_PROFILE_LABELS = Object.freeze({
  primary_specialty: 'Specialty of choice', medical_school: 'Medical school', medical_school_country: 'Medical school country',
  graduation_year: 'Graduation year', is_img: 'IMG status', step1_status: 'Step 1 / Level 1 status',
  step1_score: 'Step 1 / Level 1 score', step2_status: 'Step 2 CK / Level 2 status',
  step2_score: 'Step 2 CK / Level 2 score', visa_status: 'Visa / citizenship', usce_months: 'USCE months',
  current_location: 'Application-season location', match_cycle: 'Match cycle', phone_mobile: 'Phone / mobile',
  first_name: 'First name', last_name: 'Last name',
});

function profileFromMatrix(payload) {
  if (payload?.unavailable) {
    return {
      name: 'Student', demo: false, available: false, facts: [], completeness: 0,
      missing: [], missingKeys: [], raw: {},
      unavailableMessage: payload.message || 'Matrix profile integration is unavailable',
    };
  }
  const raw = payload?.profile && typeof payload.profile === 'object' ? payload.profile : {};
  const factKeys = ['primary_specialty', 'medical_school', 'medical_school_country', 'graduation_year', 'is_img', 'step1_status', 'step1_score', 'step2_status', 'step2_score', 'visa_status', 'usce_months', 'current_location', 'match_cycle'];
  const facts = factKeys.filter(key => raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '')
    .map(key => [MATRIX_PROFILE_LABELS[key], String(raw[key])]);
  const missingKeys = Array.isArray(payload?.required_fields)
    ? payload.required_fields.filter(key => !raw[key])
    : ['first_name', 'last_name', 'phone_mobile', 'primary_specialty'].filter(key => !raw[key]);
  const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || 'Student';
  const progress = Number(payload?.progress);
  return {
    name,
    demo: false,
    available: true,
    facts,
    completeness: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0,
    missing: missingKeys.map(key => MATRIX_PROFILE_LABELS[key] || key.replaceAll('_', ' ')),
    missingKeys,
    raw,
  };
}

async function loadAllPrograms() {
  const catalog = await riseFetch('/api/rise/v1/programs/catalog');
  return {
    records: [...(catalog.records || [])],
    registryReleaseId: catalog.registryReleaseId,
    total: catalog.total,
  };
}

async function loadRuntime() {
  const session = await riseFetch('/api/rise/v1/session');
  const matrixProfileRequest = riseFetch('/api/rise/v1/me/profile').catch(error => ({
    unavailable: true,
    message: error?.message || 'Matrix profile integration is unavailable',
  }));
  const [status, registry, savedResult, matrixProfile] = await Promise.all([
    riseFetch('/api/rise/v1/status'),
    loadAllPrograms(),
    riseFetch('/api/rise/v1/me/programs'),
    matrixProfileRequest,
  ]);
  const saved = new Map((savedResult.records || []).map(record => [record.programSpecialtyId, {
    state: record.state,
    notes: record.notes || '',
  }]));
  return {
    session,
    status,
    saved,
    persistence: savedResult.persistence || 'unavailable',
    data: {
      meta: {
        build: status.buildId,
        corpus: registry.registryReleaseId,
        generated: new Date().toISOString().slice(0, 10),
        programCount: registry.total,
        soapJoined: 0,
      },
      profile: profileFromMatrix(matrixProfile),
      programs: registry.records.map(toFableProgram),
    },
  };
}

let runtime;
try {
  runtime = await loadRuntime();
} catch (error) {
  document.body.classList.remove('is-booting');
  const main = document.querySelector('#main');
  if (main) main.innerHTML = \`<div class="view"><p class="eyebrow">RISE unavailable</p><h1 class="h1">We could not load your <em>verified data</em></h1><p class="sub">\${String(error.message).replace(/[&<>\"']/g, '')}</p></div>\`;
  throw error;
}
globalThis.__RISE_RUNTIME__ = runtime;
const D = runtime.data;
`;
}

function transformCore(source) {
  let core = replaceExact(source, "'use strict';\nconst D = window.RISE_DATA;\n", "", "founder data binding");
  core = replaceRange(
    core,
    "/* seed a completed + a running campaign (simulated history) */",
    "/* ---------------- program index ---------------- */",
    "/* Campaign state is loaded only from an authorized research backend. */\n\n",
    "simulated campaign seed",
  );
  core = core.replace("role: 'student',                    // 'student' | 'admin'", "role: runtime.session.role === 'admin' || runtime.session.role === 'operator' ? 'admin' : 'student',\n  canAdmin: runtime.session.capabilities.includes('rise:operator'),");
  core = core.replace("member: false,                      // entitlement preview toggle", "member: runtime.session.capabilities.includes('rise:premium'),");
  core = core.replace("saved: new Map(),                   // id -> {state:'SAVED'|'APPLIED'|'INTERVIEWING'|'RANKED', notes:''}", "saved: runtime.saved,");
  core = core.replace("updating: new Set(),                // program ids currently \"Updating\" via simulated campaign", "updating: new Set(),                // program ids currently updating from an authorized research job");
  core = replaceRange(
    core,
    "function hashN(s)",
    "const tierHue =",
    `/* ---------------- fit engine ---------------- */
const fitCache = new Map();
function computeFit(p) {
  if (fitCache.has(p.id)) return fitCache.get(p.id);
  const f = { tier: null, line: 'Needs more verified data — fit is not forced', reasons: [], rep: false, counts: null, known: false };
  fitCache.set(p.id, f);
  return f;
}
`,
    "representative fit engine",
  );
  core = core.replace("const d = new Date(p.verified), now = new Date('2026-08-25');", "const d = p.verified ? new Date(p.verified) : new Date(0), now = new Date();");
  core = core.replaceAll("p.acgme || '— (demo)'", "p.acgme || 'Not published'");
  core = core.replaceAll("p.acgme || '— demo'", "p.acgme || 'Not published'");
  core = core.replace(
    "Evidence-backed differentiators appear here after deep research. This program is at <b>registry depth</b>: identity, official site${p.abim.passRate ? ', ABIM' : ''}${p.soap.length ? ' and SOAP history' : ''} are verified; the narrative layers are pending.",
    "Evidence-backed differentiators appear here after deep research. This release has the canonical identity; narrative layers remain pending until source-located evidence is published.",
  );
  core = core.replace("IMGs are 61% of 28 identified residents · Caribbean 21% · US-DO 14% <span class=\"demoTag\">Demo</span>", "Representative roster composition removed");
  core = core.replace("  if (p.demo) return `<span class=\"sig\"><b>IMG 61%</b><span style=\"color:var(--dim)\"> of 28</span></span>`;\n", "");
  core = core.replace("  if (p.demo) return `<span class=\"sig\"><b>J-1 · H-1B</b></span>`;\n", "");
  core = core.replace("['Visa', ps.map(p => p.demo ? 'J-1 · H-1B published (demo)' : p.rich && p.rich.visa ? p.rich.visa.filter(v => /J-1|H-1B/.test(v.c)).map(v => `${v.c}: ${v.state === 'meets' ? 'published' : 'listed, sponsorship not published'}`).join(' · ') : 'Not published')],", "['Visa', ps.map(p => p.rich && p.rich.visa ? p.rich.visa.filter(v => /J-1|H-1B/.test(v.c)).map(v => `${v.c}: ${v.state === 'meets' ? 'published' : 'listed, sponsorship not published'}`).join(' · ') : 'Not published')],");
  core = core.replace("['IMG / DO evidence', ps.map(p => p.demo ? 'IMG 61% of 28 identified (demo)' : p.rich && p.rich.roster ? 'IMG, US-DO and Caribbean examples on official records; % gated by denominator' : 'Roster not yet researched')],", "['IMG / DO evidence', ps.map(p => p.rich && p.rich.roster ? 'IMG, US-DO and Caribbean examples on official records; % gated by denominator' : 'Roster not yet researched')],");
  core = core.replace("High-intensity, reasoning-first interviews (demo).", "Interview evidence is not published.");
  core = core.replace("Season: October–January per the current page. Format for this cycle: not published. Signaling: an older page says signaling Upstate signals preferred interest — current treatment not confirmed.", "Interview format and signaling are not yet verified for this program.");
  core = core.replace("<p class=\"sub\" style=\"font-size:14.5px\">Additional official records name residents such as Fakhri Awawdeh, Andrew Guido, Katey Kellogg, Nicolas Ciminelli and Daniel Henry (DO) and many MBBS residents from Pakistan, India, Nepal, Bangladesh, Jordan and Lebanon. These pages establish representation, not a complete denominator.</p>", "");
  core = core.replace("Where each leader trained — medical school, residency, fellowship — with the same-system pattern. Recovered so far: 1 of 8 histories (Viren Kaul: residency here — YES).", "Where each leader trained — medical school, residency, fellowship — shown only for source-located records.");
  core = core.replace("return `<span class=\"tierChip ${f.tier}\" title=\"${f.rep ? 'Representative preview for the demo profile' : 'Computed from verified requirements'}\">${f.tier === 'gold' ? 'Gold Fit' : 'Silver Fit'}${f.rep ? '<span class=\"repDot\" title=\"representative\"></span>' : ''}</span>`;", "return `<span class=\"tierChip ${f.tier}\" title=\"Computed from verified requirements\">${f.tier === 'gold' ? 'Gold Fit' : 'Silver Fit'}</span>`;");
  core = core.replace("const tries = ['Which New York programs fit me?', 'Does SUNY Upstate sponsor H-1B?', 'SOAP programs in Florida'];", "const tries = ['Which New York programs fit me?', 'Show programs with published visa evidence', 'Programs with verified SOAP history'];");
  core = core.replace("No Gold Fit yet for the demo profile.", "No Gold Fit is issued until verified profile and program evidence support it.");
  core = core.replace(
    "<div class=\"covNote\">Verified fit currently covers the deep-research corpus (SUNY Upstate gold dossier + 18 enriched programs). Tiers marked <span class=\"repDot\"></span> are representative previews; real fit rules run on verified requirements only.</div>",
    "<div class=\"covNote\">Fit tiers are withheld until canonical profile facts and current, source-located program requirements are both available.</div>",
  );
  core = core.replace(
    "<div class=\"drbRow\"><b>Brookdale IM</b> “Fischer-style interviews reward candidates who narrate their reasoning. Prep with speed drills, not memorized answers.” <button class=\"go\" onclick=\"openProgram('demo-brookdale','overview','home')\">Open File →</button></div>",
    "<div class=\"drbRow\"><b>No verified program note yet.</b> Program-specific guidance appears only when it is bound to canonical evidence.</div>",
  );
  core = core.replace(
    "'150 programs verified in the SOL56 wave · SUNY Upstate gold dossier ingested · SOAP 2026 joined for 25 programs'",
    "`${D.meta.programCount} canonical program identities loaded · deep research and SOAP coverage shown only when published by the active registry release`",
  );
  core = core.replace("savedArr.length ? `Alumni counts unlock at your ${savedArr.length} saved program${savedArr.length > 1 ? 's' : ''}` : '495 alumni · 27 specialties'", "'Integration unavailable'");
  core = replaceRange(
    core,
    "window.doorAlumni = () =>",
    "/* ============ FIND PROGRAMS",
    `window.doorAlumni = () => unlockSheet('Alumni Connections', 'No authorized ACTN/alumni integration is configured for this release. No connections are inferred or displayed.');
window.doorLetter = () => unlockSheet('Letter of Interest', 'No authorized production generation service is configured. Applicant or program facts are never invented.');
window.doorBridge = () => unlockSheet('Match Bridge', 'No canonical production Match Bridge service is configured for this release.');

`,
    "unavailable premium integrations",
  );
  core = core.replace(
    "Deep research covers the SUNY Upstate gold dossier + 18 enriched programs so far — growing weekly. Registry rows show honestly what isn’t verified yet.",
    "Canonical identities are live in this release. Deep research remains unknown until current evidence is published by the active registry.",
  );
  core = replaceRange(
    core,
    "function unlockSheet(what, summary)",
    "window.unlockSheet = unlockSheet;",
    `function unlockSheet(what, summary) {
  openModal(\`
    <div class="mKicker">✦ Membership depth</div>
    <div class="mTitle">\${esc(what)}</div>
    <div class="mSum">\${summary}</div>
    <div class="mSum" style="margin-top:8px">Entitlement verification is unavailable for this release, so access fails closed.</div>
    <div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>
    <div class="mFoot">No preview toggle and no inferred membership mapping.</div>\`);
}
`,
    "membership preview",
  );
  core = core.replace("window.unlockSheet = unlockSheet;", "window.unlockSheet = unlockSheet;");
  core = replaceRange(
    core,
    "function toggleSave(id, ev)",
    "window.toggleSave = toggleSave;",
    `async function persistProgramState(id) {
  const record = state.saved.get(id);
  if (!record) {
    await riseFetch('/api/rise/v1/me/programs/' + encodeURIComponent(id), { method: 'DELETE' });
    return;
  }
  await riseFetch('/api/rise/v1/me/programs/' + encodeURIComponent(id), {
    method: 'PUT', body: JSON.stringify({ state: record.state, notes: record.notes }),
  });
}
async function toggleSave(id, ev) {
  if (ev) ev.stopPropagation();
  const previous = state.saved.has(id) ? { ...state.saved.get(id) } : null;
  if (previous) { state.saved.delete(id); toast('Removed from My Programs'); }
  else { state.saved.set(id, { state: 'SAVED', notes: '' }); toast('Saved to My Programs'); }
  rerender();
  try { await persistProgramState(id); }
  catch (error) {
    if (previous) state.saved.set(id, previous); else state.saved.delete(id);
    rerender(); toast('Could not sync My Programs — no change was saved.');
  }
}
`,
    "in-memory save action",
  );
  core = core.replace("window.toggleSave = toggleSave;", "window.toggleSave = toggleSave;");
  core = core.replace(
    "const base = r.split('/')[0] || 'home';\n  if ((base === 'admin') !== (state.role === 'admin')) { state.role = base === 'admin' ? 'admin' : 'student'; }",
    "const base = r.split('/')[0] || 'home';\n  if (base === 'admin' && !state.canAdmin) { toast('Admin access is not available for this account.'); nav('home'); return; }\n  if ((base === 'admin') !== (state.role === 'admin')) { state.role = base === 'admin' ? 'admin' : 'student'; }",
  );
  core = core.replace(
    "<button class=\"roleSwitch\" onclick=\"switchRole()\">${state.role === 'admin' ? 'Exit admin preview' : 'Admin preview'}</button>",
    "${state.canAdmin ? `<button class=\"roleSwitch\" onclick=\"switchRole()\">${state.role === 'admin' ? 'View student experience' : 'Admin tools'}</button>` : ''}",
  );
  core = core.replace("<div class=\"identity\"><span>Ignacio · Demo profile</span></div>", "<div class=\"identity\"><span>${esc(D.profile.name)} · ${D.profile.available ? 'Matrix profile' : 'Profile unavailable'}</span></div>");
  core = core.replace("function switchRole() {\n  if (state.role === 'admin')", "function switchRole() {\n  if (!state.canAdmin) { toast('Admin access is not available for this account.'); return; }\n  if (state.role === 'admin')");
  core = replaceRange(
    core,
    "function cvSheet()",
    "/* ---------- MY PROGRAMS ---------- */",
    `function cvSheet() {
  openModal(\`<div class="mKicker">Use my CV</div><div class="mTitle">File Vault connection unavailable</div><div class="mSum">No production-safe CV selection or upload contract is authorized for this RISE release. The approved seam remains visible and locked; no file is uploaded or interpreted.</div><div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>\`);
}
window.cvSheet = cvSheet;

/* ---------- MY PROGRAMS ---------- */
`,
    "simulated CV extraction",
  );
  core = core.replace(
    "window.cycleMyState = (id, ev) => {\n  ev.stopPropagation();\n  const rec = state.saved.get(id); if (!rec) return;\n  rec.state = MY_STATES[(MY_STATES.indexOf(rec.state) + 1) % MY_STATES.length];\n  rerender();\n};",
    "window.cycleMyState = async (id, ev) => {\n  ev.stopPropagation();\n  const rec = state.saved.get(id); if (!rec) return;\n  const previous = rec.state;\n  rec.state = MY_STATES[(MY_STATES.indexOf(rec.state) + 1) % MY_STATES.length];\n  rerender();\n  try { await persistProgramState(id); } catch { rec.state = previous; rerender(); toast('Could not sync the program state.'); }\n};\nwindow.updateProgramNotes = async (id, value) => {\n  const rec = state.saved.get(id); if (!rec) return;\n  const previous = rec.notes; rec.notes = value;\n  try { await persistProgramState(id); } catch { rec.notes = previous; toast('Could not sync these notes.'); }\n};",
  );
  core = core.replace("Notes stay on this device in the founder shell.", "Notes are stored by the configured RISE persistence adapter.");
  core = core.replace(/oninput="state\.saved\.get\('\$\{p\.id\}'\)\.notes=this\.value"/g, "onchange=\"updateProgramNotes('${p.id}',this.value)\"");
  core = core.replace("const head = `<div class=\"adminBanner\"><b>Admin preview</b><span>Research runs are <b>simulated</b> in the founder shell — no Parallel calls, no spend, nothing reaches students without review.</span></div>`;", "const head = `<div class=\"adminBanner\"><b>Admin command center</b><span>The research factory is <b>not authorized</b> for this release. Preview and paid submission fail closed.</span></div>`;");
  core = core.replace(/RISE turns it into Parallel Ultra tasks, previews the cost, runs, normalizes, and queues everything for review before ingest\./g, "RISE will resolve scope, processor and cost only after the production research adapter is authorized.");
  core = core.replace(/<span>Parallel Ultra tasks<\/span>/g, "<span>tasks · processor unavailable</span>");
  core = core.replace(/<span>estimated cost · \$\{pv\.tasks\} × \$\$\{UNIT_COST\.toFixed\(2\)\}<\/span>/g, "<span>cost unavailable until server preview</span>");
  core = core.replace("<div class=\"pvLine\"><span class=\"n cost\">$${pv.cost.toFixed(2)}</span><span>cost unavailable until server preview</span></div>", "<div class=\"pvLine\"><span class=\"n cost\">—</span><span>cost unavailable until server preview</span></div>");
  core = core.replace("<div class=\"kv\"><span class=\"k\">Unit cost</span><span class=\"v\">$${UNIT_COST.toFixed(2)} / Parallel Ultra task (config)</span></div>", "<div class=\"kv\"><span class=\"k\">Processor & unit cost</span><span class=\"v\">Unavailable · server preview required</span></div>");
  core = core.replace(/<button class="runBtn" \$\{pv\.tasks === 0 \|\| !adminDraft\.families\.size \? 'disabled' : ''\} onclick="runCampaign\(\)">⚗ Run research<\/button>/g, "<button class=\"runBtn\" disabled>⚗ Run research</button>");
  core = core.replace("<p class=\"simNote\">Simulated in the founder shell. You’ll be able to pause or stop at any time. Nothing reaches students until reviewed.</p>", "<p class=\"simNote\">Disabled until a bounded server-side preview, processor route, cost estimate and explicit paid-submit confirmation are authorized.</p>");
  core = replaceRange(
    core,
    "window.parseNL = q =>",
    "/* ---------- run + queue simulation ---------- */",
    `window.parseNL = q => {
  if (!q || !q.trim()) return;
  $('#nlDraft').innerHTML = \`<div class="previewCard" style="margin-bottom:18px">
    <div class="stepNum">Draft from your sentence — confirmation remains required</div>
    <div class="pillRow" style="margin-top:6px"><span class="pill">Request: \${esc(q.trim())}</span><span class="pill">Scope: unavailable</span><span class="pill">Processor: unavailable</span></div>
    <div class="pvLine"><span class="n">—</span><span>task count and cost require an authorized server preview</span></div>
    <div class="mActs" style="margin-top:12px"><button class="mBtn pri" disabled>Run research</button><button class="mBtn sec" onclick="$('#nlDraft').innerHTML=''">Discard</button></div>
    <div class="mFoot">Natural language never submits paid work directly. This release has no research adapter, so the flow stops here.</div>
  </div>\`;
};

`,
    "client-only natural-language research simulation",
  );
  core = replaceRange(
    core,
    "let simTimer = null;",
    "function viewQueue()",
    `window.runCampaign = () => toast('Research submission is disabled: no authorized factory adapter or server cost preview.');

/* ---------- queue ---------- */
`,
    "simulated research runner",
  );
  core = replaceRange(
    core,
    "function viewQueue()",
    "/* ---------- review queue + change detection",
    `function viewQueue() {
  return \`<p class="eyebrow" style="color:var(--admin)">Queue</p><h1 class="h1">Task <em>monitor</em></h1><div class="emptyLib"><div class="big">No authorized research queue is connected.</div>Queued, running, returned, normalizing, QA, ingested, partial and failed states will appear only from the canonical research backend.</div>\`;
}

`,
    "simulated research queue",
  );
  core = core.replace("No live campaign in this session yet. The SOL56 wave (150 tasks, $45.00) completed on 2026-08-10.", "No authorized research queue is connected to this release.");
  core = replaceRange(
    core,
    "const REVIEW_ITEMS = [",
    "];\nfunction viewReview()",
    "const REVIEW_ITEMS = [",
    "embedded review fixtures",
  );
  core = core.replace("${REVIEW_ITEMS.map(r => {", "${REVIEW_ITEMS.length ? REVIEW_ITEMS.map(r => {");
  core = core.replace("    }).join('')}`;\n}\nwindow.reviewDecide", "    }).join('') : `<div class=\"emptyLib\"><div class=\"big\">No authorized review queue is connected.</div>Research changes cannot be accepted, rejected, or ingested from this release.</div>`}`;\n}\nwindow.reviewDecide");
  core = core.replace("window.reviewDecide = (id, msg) => { state.reviewDone.add(id); renderMain('admin/review'); renderShell(); toast(msg + ' (simulated).'); };", "window.reviewDecide = () => toast('Review decisions are disabled until the canonical research backend is connected.');");
  core = replaceRange(
    core,
    "function viewReview()",
    "window.reviewDecide =",
    `function viewReview() {
  return \`<p class="eyebrow" style="color:var(--admin)">Review</p><h1 class="h1">Nothing ships <em>unreviewed</em></h1><div class="emptyLib"><div class="big">No authorized review queue is connected.</div>Research changes cannot be accepted, rejected, or ingested from this release.</div>\`;
}
`,
    "embedded review-card behavior",
  );
  core = core.replace("This is your canonical Matrix profile rendered in RISE — there is no separate RISE profile truth. Edits here write back through the Matrix profile service; Matrix updates RISE and RISE updates Matrix.", "This is your canonical Matrix profile rendered in RISE — there is no separate RISE profile truth. Approved edits write through the server adapter and are re-read from Matrix.");
  core = core.replace("Founder shell: a labeled <b>demo profile</b>. The Matrix profile service contract is Human Gate 3 in the 5001 package.", "Canonical Matrix values only. No representative applicant facts are shown.");
  core = core.replace("Founder shell — profile editing writes to Matrix in the real build.", "Open the canonical Matrix editor for fields not supported by the bounded RISE update form.");
  core = core.replace("<div class=\"pHead\"><h2 class=\"h2\">Applicant <em>facts</em></h2></div>", "<div class=\"pHead\"><h2 class=\"h2\">Applicant <em>facts</em></h2>${prof.available ? '<button class=\"pMore\" onclick=\"editMatrixProfile()\">Update ▸</button>' : ''}</div>");
  core = core.replace("Canonical Matrix values only. No representative applicant facts are shown.", "${prof.available ? 'Canonical Matrix values only. No representative applicant facts are shown.' : 'Matrix profile integration is unavailable. RISE will not create or display a second profile truth.'}");
  core = core.replace("${prof.missing.map(m => `<button class=\"missChip\" onclick=\"toast('Open the canonical Matrix editor for fields not supported by the bounded RISE update form.')\">+ ${esc(m)}</button>`).join('')}", "${prof.missing.map((m, i) => `<button class=\"missChip\" onclick=\"editMatrixProfile('${esc(prof.missingKeys[i] || '')}')\">+ ${esc(m)}</button>`).join('')}");
  core = core.replace(
    "/* ---------- MY PROGRAMS ---------- */",
    `window.editMatrixProfile = (focusField = '') => {
  if (!D.profile.available) { toast('Matrix profile integration is unavailable.'); return; }
  const p = D.profile.raw || {};
  const fields = [
    ['first_name','First name','text'], ['last_name','Last name','text'], ['phone_mobile','Phone/mobile','tel'],
    ['current_location','Application-season location','text'], ['medical_school','Medical school','text'],
    ['step1_score','Step 1 / Level 1 score','number'], ['step2_score','Step 2 CK / Level 2 score','number'],
    ['usce_months','USCE months','number']
  ];
  openModal(\`<div class="mKicker">Canonical Matrix profile</div><div class="mTitle">Update approved fields</div>
    <div class="mSum">These edits go through RISE to Matrix and are re-read from the canonical owner. Specialty, visa and other controlled fields remain in the full Matrix editor.</div>
    <form id="matrixProfileForm" onsubmit="saveMatrixProfile(event)">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:18px 0">\${fields.map(([key,label,type]) => \`<label style="display:flex;flex-direction:column;gap:6px;color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase"><span>\${esc(label)}</span><input name="\${key}" type="\${type}" value="\${esc(p[key] ?? '')}" style="width:100%;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);padding:11px 12px" \${focusField === key ? 'autofocus' : ''}></label>\`).join('')}</div>
      <div class="mActs"><button class="mBtn pri" type="submit">Save to Matrix</button><button class="mBtn sec" type="button" onclick="location.assign('/member-dashboard/#profile')">Open full Matrix profile</button><button class="mBtn sec" type="button" onclick="closeModal()">Cancel</button></div>
    </form>\`);
};
window.saveMatrixProfile = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const profile = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value).trim()]));
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    const result = await riseFetch('/api/rise/v1/me/profile', { method: 'POST', body: JSON.stringify({ profile, mark_complete: false }) });
    Object.assign(D.profile, profileFromMatrix(result));
    closeModal(); rerender(); toast('Matrix profile updated and re-read.');
  } catch (error) {
    form.querySelector('button[type="submit"]').disabled = false;
    toast(error.message || 'Matrix profile update failed.');
  }
};

/* ---------- MY PROGRAMS ---------- */`,
  );
  core = core.replace(
    "<div class=\"sumStat\"><span class=\"n\"><em>150</em></span><span class=\"l\">SOL56 wave</span></div>\n      <div class=\"sumStat\"><span class=\"n\">18</span><span class=\"l\">Enriched (Tier A)</span></div>\n      <div class=\"sumStat\"><span class=\"n\">1</span><span class=\"l\">Gold dossier</span></div>\n      <div class=\"sumStat\"><span class=\"n\">25</span><span class=\"l\">SOAP 2026 joins</span></div>\n      <div class=\"sumStat\"><span class=\"n\">1,504</span><span class=\"l\">IM/FM identities (W1, pending ingest)</span></div>",
    "<div class=\"sumStat\"><span class=\"n\"><em>${D.meta.programCount}</em></span><span class=\"l\">Canonical identities</span></div>\n      <div class=\"sumStat\"><span class=\"n\">0</span><span class=\"l\">Published deep dossiers</span></div>\n      <div class=\"sumStat\"><span class=\"n\">0</span><span class=\"l\">Published SOAP joins</span></div>\n      <div class=\"sumStat\"><span class=\"n\">—</span><span class=\"l\">Research adapter unavailable</span></div>",
  );
  core = core.replace("SOL56-150 research matrix (MissionMed)", "Canonical registry source");
  core = core.replace(
    "/* ============ boot ============ */",
    () => "Object.assign(globalThis, { state, D, $, $$, adminDraft, FAMILIES, byId, fitCache, renderMain, renderShell, openFileFor });\n\n/* ============ boot ============ */",
  );
  core = core.replace("document.addEventListener('DOMContentLoaded', init);", "if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();");
  core = core.replaceAll("Founder shell", "Production wiring");
  core = core.replaceAll("founder shell", "production wiring");
  return `${runtimePrelude()}\n${core}`;
}

async function main() {
  const lockedBytes = await fs.readFile(lockedHtmlPath);
  const actualSha256 = sha256(lockedBytes);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Fable UI lock hash mismatch: expected ${expectedSha256}, received ${actualSha256}`);
  }
  const source = lockedBytes.toString("utf8");
  const styleMatch = source.match(/<style>\n([\s\S]*?)\n<\/style>/);
  const scripts = [...source.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)];
  if (!styleMatch || scripts.length !== 2) throw new Error("Unexpected locked-shell structure");
  const styles = `${styleMatch[1].replace(/\n+$/, "")}\n`;

  let html = source
    .replace(styleMatch[0], '<link rel="stylesheet" href="/rise/assets/styles">')
    .replace(scripts[0][0], "")
    .replace(scripts[1][0], '<script type="module" src="/rise/assets/app"></script>')
    .replace("<title>RISE · MissionMed Intelligence — Founder Shell (P1-RISE-5002)</title>", "<title>RISE · MissionMed Intelligence</title>")
    .replace("Founder Shell 5002 · Real corpus + demo profile", "Founder-approved Fable 5002 · Production data");

  const app = transformCore(scripts[1][1]);
  const forbidden = ["demo-brookdale", "Ignacio", "Representative preview", "window.RISE_DATA", "state.campaigns.push"];
  for (const term of forbidden) {
    if (html.includes(term) || app.includes(term)) throw new Error(`Generated student bundle retains forbidden demo seam: ${term}`);
  }
  await fs.mkdir(webDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(webDirectory, "index.html"), html),
    fs.writeFile(path.join(webDirectory, "styles.css"), styles),
    fs.writeFile(path.join(webDirectory, "app.js"), app),
  ]);
  process.stdout.write(`${JSON.stringify({ source: lockedHtmlPath, sha256: actualSha256, outputs: ["web/index.html", "web/styles.css", "web/app.js"] })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
});

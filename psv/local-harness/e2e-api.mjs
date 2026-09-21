// API-level end-to-end checks against the local WordPress + stub RISE/AI. LOCAL HARNESS ONLY.
import fs from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import zlib from 'node:zlib';

const BASE = 'http://127.0.0.1:8088';
const HARNESS_ROOT = process.env.MMPS_HARNESS_ROOT || '/home/claude/wpdev';
const SITE = `${HARNESS_ROOT}/site`;
const HARNESS = `${HARNESS_ROOT}/harness`;
const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail && !cond ? '  -> ' + detail : '')); };

class Session {
  constructor() { this.jar = {}; this.nonce = ''; }
  cookie() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '); }
  absorb(res) { for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (v === 'deleted' || v === '+') delete this.jar[k]; else this.jar[k] = v; } }
  async raw(path, opts = {}) { const res = await fetch(BASE + path, { redirect: 'manual', ...opts, headers: { Cookie: this.cookie(), ...(opts.headers || {}) } }); this.absorb(res); return res; }
  async login(user, pass) {
    await this.raw('/wp-login.php');
    const body = new URLSearchParams({ log: user, pwd: pass, 'wp-submit': 'Log In', redirect_to: BASE + '/', testcookie: '1' });
    this.jar.wordpress_test_cookie = 'WP%20Cookie%20check';
    const res = await this.raw('/wp-login.php', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return res.status === 302 && Object.keys(this.jar).some(k => k.startsWith('wordpress_logged_in'));
  }
  async page() { const res = await this.raw('/?mmed_ps_proto=1'); const html = await res.text(); const m = html.match(/<script type="application\/json" id="mmps-config">(.*?)<\/script>/s); if (m) this.nonce = JSON.parse(m[1]).nonce; return { res, html, config: m ? JSON.parse(m[1]) : null }; }
  async wpNonce() { const res = await this.raw('/wp-admin/admin-ajax.php?action=rest-nonce'); this.nonce = (await res.text()).trim(); return this.nonce; }
  async api(method, path, body, headers = {}) {
    const res = await this.raw('/wp-json/mmed-ps-proto/v1' + path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { ...(this.nonce ? { 'X-WP-Nonce': this.nonce } : {}), 'Content-Type': 'application/json', Origin: BASE, ...headers } });
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
	async upload(path, fields, fileName, text, mime = 'text/markdown') {
		const form = new FormData();
		for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
		form.append('file', new Blob([text], { type: mime }), fileName);
		const res = await this.raw('/wp-json/mmed-ps-proto/v1' + path, { method: 'POST', body: form, headers: { ...(this.nonce ? { 'X-WP-Nonce': this.nonce } : {}), Origin: BASE, Accept: 'application/json' } });
		const body = await res.text(); let json = null; try { json = JSON.parse(body); } catch {}
		return { status: res.status, json, text: body, headers: res.headers };
	}
}
const php = (code) => { const f = `${HARNESS}/.snippet.php`; fs.writeFileSync(f, `<?php $_SERVER['HTTP_HOST']='127.0.0.1:8088';$_SERVER['REQUEST_URI']='/';require '${SITE}/wp-load.php';` + code); return execSync('php ' + f + ' 2>/dev/null', { encoding: 'utf8' }); };
const aiLog = async () => (await fetch('http://127.0.0.1:4012/__log')).json();
const aiMode = async (m) => fetch('http://127.0.0.1:4012/__mode?m=' + m);
const flags = (extra) => fs.writeFileSync(`${SITE}/harness-flags.php`, `<?php\ndefine( 'MMED_PS_PROTO_OPENAI_API_KEY', 'local-stub-not-a-real-key' );\n${extra}\n`);
const concurrentWorker = (jobUuid, waitMs = 0) => new Promise((resolve) => setTimeout(() => {
  const child = spawn('php', [`${HARNESS}/concurrent-worker.php`, jobUuid], { env: { ...process.env, MMPS_HARNESS_ROOT: HARNESS_ROOT } });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('close', code => { let json = null; try { json = JSON.parse(stdout); } catch {} resolve({ code, json, stdout, stderr }); });
}, waitMs));

// ---------- 0. baseline fingerprints (blast radius) ----------
const before = php(`global $wpdb; echo json_encode(array('fv'=>$wpdb->get_var('SELECT COUNT(*) FROM '.MMED_File_Vault::table_name()),'fvsum'=>md5(json_encode($wpdb->get_results('SELECT * FROM '.MMED_File_Vault::table_name()))),'posts'=>$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts}"),'users'=>$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->users}"),'usermeta'=>$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key NOT LIKE 'session_tokens' AND meta_key NOT LIKE '%user-settings%'")));`);
const B = JSON.parse(before);
const initialLibraryCount = Number(php(`global $wpdb; echo $wpdb->get_var('SELECT COUNT(*) FROM '.$wpdb->prefix.'mmed_ps_proto_library WHERE user_id=3');`));

// ---------- 1. anonymous ----------
const anon = new Session();
let p = await anon.page();
ok('anon: page URL serves the normal site, not the prototype', p.res.status === 200 && !p.html.includes('mmps-app'));
let r = await anon.api('GET', '/bootstrap');
ok('anon: REST answers 404 rest_no_route', r.status === 404 && r.json.code === 'rest_no_route');
const nsIndex = await anon.raw('/wp-json/mmed-ps-proto/v1'); const restIndex = await (await anon.raw('/wp-json/')).text();
ok('anon: the REST namespace does not exist publicly (no index, not listed)', nsIndex.status === 404 && !restIndex.includes('mmed-ps-proto'));

// ---------- 2. logged-in, not entitled ----------
const student = new Session();
ok('student login', await student.login('student', 'Student-Local-1!'));
p = await student.page();
ok('student: page URL serves the normal site', !p.html.includes('mmps-app') && !p.html.includes('mmps-config'));
await student.wpNonce();
r = await student.api('GET', '/bootstrap');
ok('student (valid nonce): REST answers 404', r.status === 404 && r.json.code === 'rest_no_route', r.text.slice(0, 120));
const nsStudent = await student.raw('/wp-json/mmed-ps-proto/v1', { headers: { 'X-WP-Nonce': student.nonce } });
ok('student: the REST namespace is not listed either', nsStudent.status === 404);
let hub = await (await student.raw('/member-dashboard/')).text();
ok('student: Hub page renders File Vault stage, no Program-Specific PS script', hub.includes('fv-canary') && !hub.includes('mmps-entry'));

// ---------- 3. current 360 member ----------
const t = new Session();
ok('tester login', await t.login('tester', 'Tester-Local-1!'));
p = await t.page();
ok('current 360 member: Program-Specific PS renders with config + strict CSP', p.html.includes('id="mmps-app"') && !!p.config && /default-src 'none'/.test(p.res.headers.get('content-security-policy') || '') && /no-store/.test(p.res.headers.get('cache-control') || ''));
ok('tester: page has no inline script or style (CSP-safe)', !/<script(?![^>]*(src=|application\/json))/.test(p.html) && !/ style="/.test(p.html.replace(/<noscript>.*?<\/noscript>/s, '')));
hub = await (await t.raw('/member-dashboard/')).text();
ok('current 360 member: Hub gets the PSV launcher while File Vault stays intact', hub.includes('mmps-entry.js') && hub.includes('fv-canary') && hub.includes('window.mmpsEntry='));
r = await t.api('GET', '/bootstrap');
ok('bootstrap ok', r.status === 200 && r.json.provider.provider === 'openai-responses' && r.json.provider.store === false && r.json.rise.configured === true, r.text.slice(0, 200));
ok('bootstrap: normal entitled-member real-ROOT production is active', r.json.gate.mode === 'members' && r.json.provider.realRootAllowed === true);
ok('bootstrap: no-store header on REST', /no-store/.test(r.headers.get('cache-control') || ''));
ok('bootstrap: File Vault readable through reflection-checked bridge', r.json.fileVault.available === true);

// ---------- 4. RISE session requirement ----------
r = await t.api('GET', '/rise/my-programs');
ok('RISE: no session cookie -> 409 session required', r.status === 409 && r.json.code === 'mmps_rise_session_required');
t.jar.mmhq_rise_session = 'expired';
r = await t.api('GET', '/rise/my-programs');
ok('RISE: upstream 401 -> 409 session required', r.status === 409);
t.jar.mmhq_rise_session = 'good-session';
r = await t.api('GET', '/rise/my-programs');
const list = r.json.programs;
ok('RISE: my list retrieved, Gold first then priority', r.status === 200 && list[0].programSpecialtyId === 'ps_deep_001' && list[1].programSpecialtyId === 'ps_thin_002' && list[2].programSpecialtyId === 'ps_ess_003', JSON.stringify(list.map(x => x.programSpecialtyId)));
ok('RISE: private notes never leave RISE', !r.text.includes('PRIVATE NOTE') && !r.text.includes('another private note'));
ok('RISE: default tiers (Gold/top -> DEEP, priority 30 -> ESSENTIAL)', list[0].defaultTier === 'DEEP' && list[1].defaultTier === 'DEEP' && list[2].defaultTier === 'ESSENTIAL');
ok('RISE: evidence labels differ', list[0].evidenceQuality.label === 'DEEP_READY' && list[1].evidenceQuality.label === 'ONE_DEEP_FACT' && list[2].evidenceQuality.label === 'ESSENTIAL_ONLY', JSON.stringify(list.map(x => x.evidenceQuality)));
ok('RISE: unknown program on the list is reported, not fatal', list[3].error === 'mmps_rise_not_found');
const riseLog = await (await fetch('http://127.0.0.1:4011/__log')).json();
ok('RISE transport: GET only, cookie renamed to mmhq_session, forwarded host set', riseLog.every(x => x.method === 'GET') && riseLog.some(x => /mmhq_session=good-session/.test(x.cookie) && !/wordpress_logged_in/.test(x.cookie) && x.xfh === '127.0.0.1'));
r = await t.api('GET', '/rise/bundle?id=ps_deep_001');
const deepB = r.json.bundle;
ok('bundle: schema + hash + transport', deepB.schema === 'missionmed.rise.program-evidence-bundle.v1' && /^[a-f0-9]{64}$/.test(deepB.bundleSha256) && deepB.transport === 'FILE_VAULT_SESSION_FORWARDED_GET_V1');
ok('bundle: PD from current research leadership beats registry; associate PD ignored', deepB.essential.programDirector.value.name === 'Dr. Marisol Ventresca');
const codes = deepB.exclusions.map(e => e.code);
ok('bundle: exclusions recorded (second person, planned + affiliated fellowship, peer source)', ['SECOND_PERSON_TEXT', 'FELLOWSHIP_NOT_AVAILABLE', 'FELLOWSHIP_AFFILIATED_ONLY', 'PEER_SOURCE'].every(c => codes.includes(c)), JSON.stringify(codes));
ok('bundle: no peer or second-person text in facts', !JSON.stringify(deepB.deepFacts).match(/Peer said|You will love/));
r = await t.api('GET', '/rise/search?q=harborview');
ok('search finds a program not on the list', r.status === 200 && r.json.programs[0].programSpecialtyId === 'ps_dirty_004');
r = await t.api('GET', '/rise/bundle?id=ps_dirty_004');
const dcodes = r.json.bundle.exclusions.map(e => e.code);
ok('bundle(dirty): terminal, stale, conflict, absence, no-source all excluded; 1 usable fact', ['TERMINAL_STATE', 'STALE', 'CONFLICT', 'ABSENCE_ROW', 'NO_SOURCE'].every(c => dcodes.includes(c)) && r.json.bundle.deepFacts.length === 1 && !r.json.bundle.essential.programDirector, JSON.stringify(dcodes));
r = await t.api('GET', '/rise/bundle?id=ps_ess_003');
ok('bundle(essential): stale registry PD is absent, not guessed', !r.json.bundle.essential.programDirector && !!r.json.bundle.essential.programType);

// ---------- 5. ROOT from File Vault ----------
r = await t.api('GET', '/root-candidates');
const cands = r.json.candidates;
ok('FV candidates: own PS versions only (no CV, no other student)', cands.length === 4 && cands.every(c => c.fileId === 1), JSON.stringify(cands.map(c => [c.fileId, c.versionNumber, c.usable])));
ok('FV candidates: unverified version not usable', cands.find(c => c.versionNumber === 2).usable === false);
r = await t.api('POST', '/roots', { source: 'FILE_VAULT', specialtyLabel: 'Internal Medicine', fileId: 1, versionNumber: 1 });
ok('FV ROOT v1 read + parsed', r.status === 200 && r.json.root.paragraphs.length === 6 && r.json.root.paragraphs[0].startsWith('FILE VAULT COPY') && r.json.root.isSynthetic === false && /^[a-f0-9]{64}$/.test(r.json.root.sourceSha256), r.text.slice(0, 200));
const realRoot = r.json.root;
r = await t.api('POST', '/roots', { source: 'FILE_VAULT', specialtyLabel: 'Internal Medicine', fileId: 1, versionNumber: 2 });
ok('FV ROOT v2 (not verified clean) refused', r.status === 422);
r = await t.api('POST', '/roots', { source: 'FILE_VAULT', specialtyLabel: 'Internal Medicine', fileId: 1, versionNumber: 3 });
ok('FV ROOT v3 (tracked changes) refused', r.status >= 400 && r.json.code === 'mmps_docx_tracked_changes', r.text.slice(0, 160));
r = await t.api('POST', '/roots', { source: 'FILE_VAULT', specialtyLabel: 'Internal Medicine', fileId: 1, versionNumber: 4 });
ok('FV ROOT v4 (storage hash mismatch) refused', r.status === 502 && r.json.code === 'mmps_root_hash');
r = await t.api('POST', '/roots', { source: 'FILE_VAULT', specialtyLabel: 'Internal Medicine', fileId: 3, versionNumber: 1 });
ok('FV ROOT of ANOTHER student refused (owner scoped)', r.status === 404 && r.json.code === 'mmps_root_not_found');
r = await t.api('PUT', `/roots/${realRoot.id}/region`, { mode: 'REPLACE_PARAGRAPH', paragraphIndex: 4 });
ok('region confirmed on real ROOT', r.status === 200 && r.json.root.region.mode === 'REPLACE_PARAGRAPH');
const aiBefore = (await aiLog()).length;
r = await t.api('POST', '/generate', { rootId: realRoot.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
const realRootGeneration = r.json;
const realRootAi = (await aiLog()).at(-1);
const realRootPayload = JSON.parse(JSON.parse(realRootAi.raw).input[1].content);
ok('normal production: entitled member can generate from confirmed File Vault real ROOT', r.status === 200 && r.json.status === 'OK' && r.json.candidates.length === 5 && (await aiLog()).length === aiBefore + 1);
ok('normal production: provider receives every ROOT paragraph as context while protected output remains byte-equal', realRootPayload.root_context_mode === 'READ_ONLY_COMPLETE_STATEMENT' && realRootPayload.root_paragraphs.length === realRoot.paragraphs.length && realRootPayload.root_paragraphs.every(Boolean) && realRootGeneration.paragraphs.every((x, i) => i === 4 || x === realRoot.paragraphs[i]) && realRootGeneration.rootIntegrity.ok === true);

// ---------- 5a. direct owner-scoped ROOT upload ----------
const directText = 'Direct upload opening paragraph.\n\nDirect upload middle paragraph.\n\nDirect upload closing paragraph.';
r = await t.upload('/roots/upload', { specialtyLabel: 'Internal Medicine' }, 'direct-root.txt', directText, 'text/plain');
const uploadedRoot = r.json && r.json.root;
ok('direct TXT upload creates an owner-scoped real ROOT', r.status === 200 && uploadedRoot.sourceKind === 'UPLOADED' && uploadedRoot.isSynthetic === false && uploadedRoot.paragraphs.length === 3 && /^[a-f0-9]{64}$/.test(uploadedRoot.sourceSha256), r.text.slice(0, 200));
r = await t.upload('/roots/upload', { specialtyLabel: 'Internal Medicine' }, 'direct-root.pdf', '%PDF-ambiguous', 'application/pdf');
ok('direct upload rejects unsupported PDF extraction', r.status === 415 && r.json.code === 'mmps_root_upload_type', r.text.slice(0, 160));
await t.api('PUT', `/roots/${uploadedRoot.id}/region`, { mode: 'REPLACE_PARAGRAPH', paragraphIndex: 1 });
const aiBeforeUpload = (await aiLog()).length;
r = await t.api('POST', '/generate', { rootId: uploadedRoot.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
ok('normal production: direct-upload real ROOT can generate after explicit region confirmation', r.status === 200 && r.json.rootIntegrity.ok === true && r.json.paragraphs.every((x, i) => i === 1 || x === uploadedRoot.paragraphs[i]) && (await aiLog()).length === aiBeforeUpload + 1);

// ---------- 6. synthetic ROOT, region, prefs ----------
r = await t.api('POST', '/roots', { source: 'SYNTHETIC', specialtyLabel: 'Internal Medicine' });
const root = r.json.root;
ok('synthetic ROOT created; program paragraph detected', r.status === 200 && root.isSynthetic === true && r.json.detection.proposedIndex === 4, JSON.stringify(r.json.detection));
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
ok('generate before region confirm -> 409', r.status === 409 && r.json.code === 'mmps_region_required');
r = await t.api('PUT', `/roots/${root.id}/region`, { mode: 'REPLACE_PARAGRAPH', paragraphIndex: 0 });
ok('opening paragraph can never be the region', r.status === 422);
r = await t.api('PUT', `/roots/${root.id}/region`, { mode: 'REPLACE_PARAGRAPH', paragraphIndex: 4 });
ok('region stored with hashes + normalization rule', r.json.root.region.paragraphHashes.length === 6 && r.json.root.region.normalizationRule.includes('sha256'));
r = await t.api('PUT', `/roots/${root.id}/prefs`, { categories: { fellowship: { on: true, terms: ['Cardiology'] }, research: { on: true, terms: ['Quality improvement'] }, population: { on: true, terms: ['Safety-net hospital'] }, other: { on: false, terms: ['<script>x</script>'] } }, location: { on: true, states: ['NY', 'New York'], reason: 'my clinical rotations were in western New York', mayMention: true } });
ok('prefs saved + sanitized', r.status === 200 && r.json.root.prefs.categories.fellowship.terms[0] === 'Cardiology' && !JSON.stringify(r.json.root.prefs).includes('<script>'));

// ---------- 7. generation ----------
const others = ['ps_deep_001', 'ps_thin_002', 'ps_ess_003'];
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL', otherProgramIds: others });
const ess = r.json;
ok('ESSENTIAL output succeeds', r.status === 200 && ess.status === 'OK' && ess.tierEffective === 'ESSENTIAL' && ess.canApprove === true, r.text.slice(0, 300));
ok('ESSENTIAL: five distinct choices with an explicit recommended default', ess.candidates.length === 5 && new Set(ess.candidates.map(c => c.candidateId)).size === 5 && ess.selectedCandidateId === ess.recommendedCandidateId && ess.candidates.filter(c => c.isRecommended).length === 1);
ok('ESSENTIAL: only identity facts supplied; no PD (stale)', ess.facts.every(f => f.category === 'identity') && !ess.facts.some(f => f.label === 'Program director'));
ok('ESSENTIAL: full PS reconstructed, protected paragraphs byte-equal to ROOT', ess.paragraphs.length === 6 && ess.paragraphs.every((x, i) => i === 4 || x === root.paragraphs[i]) && ess.paragraphs[4] !== root.paragraphs[4] && ess.rootIntegrity.ok === true && ess.rootIntegrity.protectedParagraphs === 5);
ok('ESSENTIAL: structured output has run id, strategy, facts used, provenance', /^[a-f0-9-]{36}$/.test(ess.runId) && !!ess.strategy && ess.validation.factsUsed.length >= 1 && ess.facts.every(f => f.provenance && f.provenance.origin));
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_deep_001', tier: 'DEEP', otherProgramIds: others });
const deep = r.json;
ok('DEEP output succeeds with verified deep facts', r.status === 200 && deep.status === 'OK' && deep.tierEffective === 'DEEP', r.text.slice(0, 400));
const deepSupplied = deep.facts.filter(f => f.category !== 'identity');
ok('DEEP: 2-3 deep facts, preference-matched (cardiology fellowship chosen; planned GI never)', deepSupplied.length >= 2 && deepSupplied.length <= 3 && deepSupplied.some(f => /Cardiovascular/.test(f.text)) && !deepSupplied.some(f => /Gastro|Nephro/.test(f.text)), JSON.stringify(deepSupplied.map(f => f.label)));
ok('DEEP: every program_fact segment cites supplied fact ids', deep.segments.filter(s => s.kind === 'program_fact').every(s => s.fact_ids.length && s.fact_ids.every(id => deep.facts.some(f => f.factId === id))));
ok('DEEP: deep facts carry https sources', deepSupplied.every(f => /^https:\/\//.test(f.provenance.sourceUrl)));
const callsBefore = (await aiLog()).length;
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_thin_002', tier: 'DEEP', otherProgramIds: others });
ok('unsupported DEEP -> Research Needed, AI never called, nothing invented', r.status === 200 && r.json.status === 'RESEARCH_NEEDED' && r.json.tierEffective === 'DEEP_RESEARCH_NEEDED' && !r.json.replacement && (await aiLog()).length === callsBefore, r.text.slice(0, 300));
r = await t.api('POST', '/research-prompt', { programSpecialtyId: 'ps_thin_002' });
ok('M4 research prompt: optimized exact artifact contract with program data only', r.json.planned === false && r.json.ingestion === 'QUARANTINE_AVAILABLE_RISE_OWNER_REQUIRED' && r.json.schema === 'missionmed.rise.research-artifact.v1' && r.json.prompt.includes('FACT-001') && r.json.prompt.includes('Riverbend') && !/Corridor|Émile|glucometer/.test(r.json.prompt));
const researchedAt = new Date().toISOString().slice(0, 10);
const validResearch = `---\nschema: missionmed.rise.research-artifact.v1\nprogram_specialty_id: ps_thin_002\nacgme_id: 1403821002\nprogram_name: Riverbend Community Hospital Internal Medicine Residency\nresearched_at: ${researchedAt}\nresearch_agent: Astra Research Test\n---\n# MissionMed Program Research Evidence\n\n## Evidence records\n### FACT-001\n- field: research.curriculum\n- claim: The official curriculum page describes a longitudinal ambulatory experience integrated throughout residency training.\n- source_url: https://im.ps-thin-002.example.org/curriculum\n- source_type: PROGRAM_OFFICIAL\n- accessed_at: ${researchedAt}\n\n### FACT-002\n- field: research.facilities_patient_population\n- claim: The sponsoring institution page identifies Riverbend Community Hospital as the primary inpatient training site.\n- source_url: https://im.ps-thin-002.example.org/sites\n- source_type: SPONSOR_OFFICIAL\n- accessed_at: ${researchedAt}\n`;
const rejectedResearch = validResearch.replace('1403821002', '9999999999').replace('The official curriculum page', 'Applicant email student@example.com says the official curriculum page');
r = await t.upload('/research-artifacts', { programSpecialtyId: 'ps_thin_002', rootId: root.id }, 'unsafe.md', rejectedResearch);
ok('M4 upload: unsafe or identity-mismatched artifact is retained only as rejected quarantine', r.status === 200 && r.json.artifact.status === 'QUARANTINED_REJECTED' && r.json.riseHydrated === false && r.json.artifact.validation.errors.some(e => e.code === 'APPLICANT_DATA') && r.json.artifact.validation.errors.some(e => e.code === 'IDENTITY_ACGME_ID'));
const rejectedArtifact = r.json.artifact;
r = await t.api('GET', `/research-artifacts/${rejectedArtifact.artifactUuid}/download?inline=1`);
ok('M4 quarantine: rejected artifact cannot be exported as an owner handoff', r.status === 409 && r.json.code === 'mmps_research_not_validated');
r = await t.upload('/research-artifacts', { programSpecialtyId: 'ps_thin_002', rootId: root.id }, 'riverbend-evidence.md', validResearch);
ok('M4 upload: valid artifact is validated but remains pending the RISE owner', r.status === 200 && r.json.artifact.status === 'VALIDATED_PENDING_RISE_OWNER' && r.json.riseHydrated === false && r.json.artifact.validation.factCount === 2 && r.json.artifact.validation.errors.length === 0, r.text.slice(0, 300));
const validArtifact = r.json.artifact;
r = await t.api('GET', `/research-artifacts/${validArtifact.artifactUuid}/download?inline=1`);
ok('M4 owner handoff: validated artifact exports byte-for-byte by owner-scoped route', r.status === 200 && r.json.bytes === Buffer.byteLength(validResearch) && r.json.sha256 === validArtifact.sha256);
const callsAfterResearchUpload = (await aiLog()).length;
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_thin_002', tier: 'DEEP', otherProgramIds: others });
ok('M4 authority boundary: quarantined upload cannot hydrate generation or bypass RISE', r.status === 200 && r.json.status === 'RESEARCH_NEEDED' && (await aiLog()).length === callsAfterResearchUpload);
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_deep_001', tier: 'DEEP', otherProgramIds: others });
ok('regenerate creates a fresh validated five-choice run without overwriting the prior run', r.json.runId !== deep.runId && r.json.candidates.length === 5 && deep.candidates.length === 5 && r.json.canApprove === true, deep.runId + ' -> ' + r.json.runId);

await aiMode('hallucinate-once');
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_deep_001', tier: 'DEEP', otherProgramIds: others });
ok('hallucination on attempt 1 is caught, revised on attempt 2', r.json.status === 'OK' && r.json.validation.attempts === 2 && !/Whitmore|42 residents/.test(r.json.replacement), JSON.stringify(r.json.validation).slice(0, 300));
await aiMode('hallucinate-always');
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_deep_001', tier: 'DEEP', otherProgramIds: others });
const bad = r.json; const bcodes = bad.validation.blocking.map(f => f.code);
ok('persistent hallucination -> NEEDS_ATTENTION with precise flags', bad.status === 'NEEDS_ATTENTION' && bad.canApprove === false && ['UNSUPPORTED_NUMBER', 'UNSUPPORTED_NAME', 'FACT_WITHOUT_EVIDENCE', 'ABSENCE_OR_COMPARISON'].every(c => bcodes.includes(c)), JSON.stringify(bcodes));
r = await t.api('POST', '/library', { runId: bad.runId, status: 'APPROVED' });
ok('a flagged run cannot be saved', r.status === 409 && r.json.code === 'mmps_run_not_savable');
await aiMode('good');

// identifier minimisation (tester is "Émile Corridor"; ROOT A says "walking the corridor")
const lastDeepAi = (await aiLog()).filter(x => !x.revision).at(-1);
ok('AI request: bearer auth, store:false, strict schema, configured model', lastDeepAi.auth && lastDeepAi.store === false && lastDeepAi.strict === true && lastDeepAi.model === 'gpt-5.6-terra');
ok('AI payload: signed-in user\'s name tokens are redacted (unicode-safe, case-insensitive) before leaving the site', !/corridor|Émile/i.test(JSON.parse(lastDeepAi.raw).input[1].content) && lastDeepAi.raw.includes('[[APPLICANT_'));
ok('protected ROOT text is untouched by redaction', deep.paragraphs[0].includes('walking the corridor'));
ok('AI payload: no WordPress ids, emails or RISE notes', !/tester@example|PRIVATE NOTE|wordpress_logged_in/.test(lastDeepAi.raw));

// pasted text is ALWAYS a real statement, whatever the client claims
r = await t.api('POST', '/roots', { source: 'PASTED', specialtyLabel: 'Internal Medicine', isSynthetic: true, text: root.paragraphs.join('\n\n') });
ok('pasted ROOT is stored as non-synthetic even when the client claims otherwise', r.status === 200 && r.json.root.isSynthetic === false);
const pasted = r.json.root;
await t.api('PUT', `/roots/${pasted.id}/region`, { mode: 'REPLACE_PARAGRAPH', paragraphIndex: 4 });
const aiBeforePaste = (await aiLog()).length;
r = await t.api('POST', '/generate', { rootId: pasted.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
ok('normal production: pasted real ROOT generates only after region confirmation', r.status === 200 && r.json.rootIntegrity.ok === true && r.json.paragraphs.every((x, i) => i === 4 || x === pasted.paragraphs[i]) && (await aiLog()).length === aiBeforePaste + 1);

// second synthetic voice + INSERT mode
r = await t.api('POST', '/roots', { source: 'SYNTHETIC', syntheticKey: 'fm' });
const fm = r.json.root;
ok('synthetic ROOT B (Family Medicine voice) carries its own specialty', r.status === 200 && fm.isSynthetic === true && fm.specialtyLabel === 'Family Medicine' && r.json.detection.proposedIndex === 4);
await t.api('PUT', `/roots/${fm.id}/region`, { mode: 'INSERT_BEFORE', paragraphIndex: 5 });
r = await t.api('POST', '/generate', { rootId: fm.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
ok('INSERT mode: 7 paragraphs, all 6 ROOT paragraphs unchanged', r.json.status === 'OK' && r.json.paragraphs.length === 7 && r.json.rootIntegrity.ok && r.json.paragraphs[6] === fm.paragraphs[5], r.text.slice(0, 300));

// a run can only be saved against the region it was written for
const stale = r.json;
await t.api('PUT', `/roots/${fm.id}/region`, { mode: 'REPLACE_PARAGRAPH', paragraphIndex: 2 });
r = await t.api('POST', '/library', { runId: stale.runId, status: 'APPROVED' });
ok('region changed after generation -> save refused (409)', r.status === 409 && r.json.code === 'mmps_region_changed', r.text.slice(0, 200));

// preferences that match nothing never pull in a fellowship the student did not name
r = await t.api('POST', '/roots', { source: 'SYNTHETIC', syntheticKey: 'im' });
const r2 = r.json.root;
await t.api('PUT', `/roots/${r2.id}/region`, { mode: 'REPLACE_PARAGRAPH', paragraphIndex: 4 });
await t.api('PUT', `/roots/${r2.id}/prefs`, { categories: { research: { on: true, terms: ['Quality improvement'] } } });
r = await t.api('POST', '/generate', { rootId: r2.id, programSpecialtyId: 'ps_deep_001', tier: 'DEEP' });
ok('DEEP without a named fellowship: no fellowship fact is supplied', r.json.tierEffective === 'DEEP' && !r.json.facts.some(f => f.category === 'fellowship') && r.json.facts.some(f => /quality improvement/i.test(f.text)), JSON.stringify((r.json.facts || []).map(f => f.label)));

// ---------- 8. save, library, download ----------
const chosenDeep = deep.candidates.find(c => !c.isRecommended && c.canApprove);
const exactFixture = Buffer.from(chosenDeep.replacement, 'utf8').toString('base64');
php(`MMPS_Similarity::store(2,'10000000-0000-4000-8000-000000000001',MMPS_Similarity::fingerprint(base64_decode('${exactFixture}')));`);
r = await t.api('POST', '/library', { runId: deep.runId, candidateId: chosenDeep.candidateId, status: 'APPROVED' });
ok('M5 exact cross-student protection blocks verbatim reuse without exposing matched prose or identity', r.status === 409 && r.json.code === 'mmps_cross_student_exact' && !/student@example|user_id|10000000-0000/.test(r.text));
php(`global $wpdb; $wpdb->delete($wpdb->prefix.'mmed_ps_proto_similarity_buckets',array('doc_uuid'=>'10000000-0000-4000-8000-000000000001')); $wpdb->delete($wpdb->prefix.'mmed_ps_proto_similarity_fingerprints',array('doc_uuid'=>'10000000-0000-4000-8000-000000000001'));`);
const nearText = chosenDeep.replacement.replace(/\b([A-Za-z]+)([.!?])$/, 'reflection$2');
const nearFixture = Buffer.from(nearText, 'utf8').toString('base64');
php(`MMPS_Similarity::store(2,'20000000-0000-4000-8000-000000000002',MMPS_Similarity::fingerprint(base64_decode('${nearFixture}')));`);
r = await t.api('POST', '/library', { runId: deep.runId, candidateId: chosenDeep.candidateId, status: 'APPROVED' });
ok('M5 near-duplicate protection requests an opaque quality review without showing other prose', r.status === 409 && r.json.code === 'mmps_similarity_review' && ['MODERATE','HIGH'].includes(r.json.data.similarity) && !r.text.includes(nearText));
r = await t.api('POST', '/library', { runId: deep.runId, candidateId: chosenDeep.candidateId, status: 'APPROVED', acknowledgeSimilarity: true });
const doc = r.json.document;
ok('save selected alternative after explicit review with candidate and similarity provenance', r.status === 200 && doc.status === 'APPROVED' && doc.tier === 'DEEP' && doc.acgmeId === '1403511001' && doc.programSpecialtyId === 'ps_deep_001' && doc.specialtyLabel === 'Internal Medicine' && doc.versionNumber === 1 && doc.metadata.rootTextSha256 === root.textSha256 && doc.metadata.candidateId === chosenDeep.candidateId && doc.metadata.similarityAcknowledged === true && doc.fullText.includes(chosenDeep.replacement) && doc.fullText.split('\n\n').length === 6, r.text.slice(0, 300));
php(`global $wpdb; $wpdb->delete($wpdb->prefix.'mmed_ps_proto_similarity_buckets',array('doc_uuid'=>'20000000-0000-4000-8000-000000000002')); $wpdb->delete($wpdb->prefix.'mmed_ps_proto_similarity_fingerprints',array('doc_uuid'=>'20000000-0000-4000-8000-000000000002'));`);
r = await t.api('POST', '/library', { runId: deep.runId, status: 'DRAFT' });
ok('save is idempotent per run', r.json.alreadySaved === true && r.json.document.docUuid === doc.docUuid);
r = await t.api('POST', '/library', { runId: ess.runId, status: 'DRAFT' });
ok('second program saved as DRAFT', r.json.document.status === 'DRAFT');
r = await t.api('GET', '/library');
ok('library lists both new documents and preserves prior outputs', r.json.documents.length === initialLibraryCount + 2);
r = await t.api('POST', `/library/${doc.docUuid}/status`, { status: 'ARCHIVED' });
ok('status change works', r.json.document.status === 'ARCHIVED');
const dl = await t.raw(`/wp-json/mmed-ps-proto/v1/library/${doc.docUuid}/download?format=docx&_wpnonce=${t.nonce}`);
const bytes = Buffer.from(await dl.arrayBuffer());
fs.writeFileSync(`${HARNESS}/files/download.docx`, bytes);
const xml = execSync(`unzip -p ${HARNESS}/files/download.docx word/document.xml`, { encoding: 'utf8' });
ok('DOCX download: attachment, valid zip, body text only (no metadata in the body)', dl.status === 200 && /attachment; filename="Internal_Medicine_PS_.*\.docx"/.test(dl.headers.get('content-disposition')) && bytes.slice(0, 2).toString() === 'PK' && xml.includes('glucometer') && xml.includes('Lakeshore') && !/ACGME 14|1403511001|runId|F-[a-f0-9]{12}|SYNTHETIC|bundle|ps_deep_001/i.test(xml), dl.headers.get('content-disposition'));
const dlt = await t.raw(`/wp-json/mmed-ps-proto/v1/library/${doc.docUuid}/download?format=txt&_wpnonce=${t.nonce}`);
ok('TXT download works', dlt.status === 200 && (await dlt.text()).includes('Lakeshore'));

// ---------- 8b. M3 durable batch, default approval and bulk export ----------
r = await t.api('GET', '/rise/my-program-index');
const batchIndex = r.json.programs;
ok('M3 import: full RISE index is privacy-minimized with priority-based defaults', r.status === 200 && batchIndex.length === 4 && batchIndex.every(x => !('notes' in x)) && batchIndex.find(x => x.programSpecialtyId === 'ps_deep_001').defaultTier === 'DEEP' && batchIndex.find(x => x.programSpecialtyId === 'ps_ess_003').defaultTier === 'ESSENTIAL');
const jobsBeforeInjectedFailure = Number(php(`global $wpdb; echo $wpdb->get_var('SELECT COUNT(*) FROM '.$wpdb->prefix.'mmed_ps_proto_jobs');`));
execSync(`sqlite3 ${SITE}/wp-content/database/test.sqlite "CREATE TRIGGER mmps_test_fail_item BEFORE INSERT ON wp_mmed_ps_proto_job_items BEGIN SELECT RAISE(ABORT, 'test'); END"`);
r = await t.api('POST', '/batch/jobs', { rootId: root.id, programs: batchIndex.map(x => ({ ...x, tier: x.defaultTier })) });
execSync(`sqlite3 ${SITE}/wp-content/database/test.sqlite "DROP TRIGGER IF EXISTS mmps_test_fail_item"`);
const jobsAfterInjectedFailure = Number(php(`global $wpdb; echo $wpdb->get_var('SELECT COUNT(*) FROM '.$wpdb->prefix.'mmed_ps_proto_jobs');`));
ok('M3 atomic create: injected item failure leaves no partial job or items', r.status === 500 && r.json.code === 'mmps_batch_item_create' && jobsAfterInjectedFailure === jobsBeforeInjectedFailure);
r = await t.api('POST', '/batch/jobs', { rootId: root.id, programs: batchIndex.map(x => ({ ...x, tier: x.defaultTier })) });
let job = r.json.job;
ok('M3 batch create: specialty-isolated durable job with one item per program', r.status === 200 && job.rootId === root.id && job.specialtyLabel === 'Internal Medicine' && job.total === 4 && job.items.length === 4 && job.items.every(x => x.status === 'QUEUED'));
for (let i = 0; i < 8 && job.processed < job.total; i++) {
  r = await t.api('POST', `/batch/jobs/${job.jobUuid}/process`, {});
  job = r.json.job;
}
ok('M3 batch process: partial failures do not stop clean, research-needed or later items', job.processed === 4 && job.ready === 2 && job.attention === 1 && job.failed === 1 && job.status === 'COMPLETE_WITH_EXCEPTIONS', JSON.stringify(job.items.map(x => [x.programSpecialtyId,x.status,x.attemptCount])));
ok('M3 retries: unavailable program exhausts exactly three bounded attempts', job.items.find(x => x.programSpecialtyId === 'ps_missing_999').status === 'FAILED' && job.items.find(x => x.programSpecialtyId === 'ps_missing_999').attemptCount === 3);
ok('M3 deep shortage: Deep Research Needed remains an exception without hallucination', job.items.find(x => x.programSpecialtyId === 'ps_thin_002').status === 'RESEARCH_NEEDED' && job.items.find(x => x.programSpecialtyId === 'ps_thin_002').runId);
const readyItem = job.items.find(x => x.status === 'READY');
r = await t.api('GET', `/batch/jobs/${job.jobUuid}/items/${readyItem.itemUuid}/run`);
ok('M3 resume: stored run reconstructs five choices without another provider call', r.status === 200 && r.json.runId === readyItem.runId && r.json.candidates.length === 5 && r.json.canApprove === true);
const recommendedForReady = r.json.recommendedCandidateId;
const nondefaultForReady = r.json.candidates.find(x => x.candidateId !== recommendedForReady && x.canApprove);
r = await t.api('POST', '/library', { runId: readyItem.runId, candidateId: nondefaultForReady.candidateId, status: 'DRAFT' });
const nondefaultDraft = r.json.document;
ok('M3 candidate custody fixture: a nonrecommended batch alternative can be saved explicitly', r.status === 200 && nondefaultDraft.metadata.candidateId === nondefaultForReady.candidateId && nondefaultDraft.status === 'DRAFT');
r = await t.api('POST', `/batch/jobs/${job.jobUuid}/approve-ready`, {});
job = r.json.job;
ok('M3 exception-focused approval: clean defaults approve, but a saved alternative is never relabeled as default', r.status === 200 && r.json.approved === 1 && r.json.errors.length === 1 && job.items.find(x => x.itemUuid === readyItem.itemUuid).approvedDocUuid === '');
r = await t.api('GET', `/library/${nondefaultDraft.docUuid}`);
ok('M3 saved alternative remains its original DRAFT candidate after bulk default approval', r.json.document.status === 'DRAFT' && r.json.document.metadata.candidateId === nondefaultForReady.candidateId);
r = await t.api('POST', '/library/bulk-download', { allApproved: true, inline: true });
ok('M3 Download All: approved complete statements produce one ZIP and manifest', r.status === 200 && r.json.documents >= 1 && r.json.fileName.endsWith('.zip') && r.json.bytes > 500 && /^[a-f0-9]{64}$/.test(r.json.sha256), r.text.slice(0, 300));
const preserved = job.items.find(x => x.status === 'READY' && x.approvedDocUuid);
const newTier = preserved.tierRequested === 'DEEP' ? 'ESSENTIAL' : 'DEEP';
r = await t.api('PUT', `/batch/jobs/${job.jobUuid}/items/${preserved.itemUuid}/tier`, { tier: newTier });
job = r.json.job;
const requeued = job.items.find(x => x.itemUuid === preserved.itemUuid);
ok('M3 selective regeneration preserves the approved document and reports a non-complete job while requeueing one item', requeued.status === 'QUEUED' && requeued.tierRequested === newTier && requeued.approvedDocUuid === preserved.approvedDocUuid && job.status !== 'COMPLETE' && job.items.filter(x => x.itemUuid !== preserved.itemUuid).every(x => x.status !== 'QUEUED'));
r = await t.api('POST', '/batch/jobs', { rootId: root.id, programs: [
  { programSpecialtyId: 'ps_deep_001', priorityPosition: 1, goldStarred: true, tier: 'ESSENTIAL' },
  { programSpecialtyId: 'ps_ess_003', priorityPosition: 30, goldStarred: false, tier: 'ESSENTIAL' },
  { programSpecialtyId: 'ps_dirty_004', priorityPosition: 31, goldStarred: false, tier: 'ESSENTIAL' }
] });
const liveConcurrencyJob = r.json.job;
await aiMode('slow-good');
const simultaneous = await Promise.all([0, 50, 100].map(ms => concurrentWorker(liveConcurrencyJob.jobUuid, ms)));
await aiMode('good');
r = await t.api('GET', `/batch/jobs/${liveConcurrencyJob.jobUuid}`);
const concurrentJob = r.json.job;
ok('M3 live concurrency: independent workers admit exactly two and roll the saturated claim back cleanly', simultaneous.filter(x => x.code === 0 && x.json?.run).length === 2 && simultaneous.filter(x => x.code === 0 && x.json?.saturated).length === 1 && concurrentJob.items.filter(x => x.status === 'READY').length === 2 && concurrentJob.items.filter(x => x.status === 'QUEUED' && x.attemptCount === 0).length === 1 && Number(php(`global $wpdb; echo $wpdb->get_var($wpdb->prepare('SELECT active_items FROM '.$wpdb->prefix.'mmed_ps_proto_jobs WHERE job_uuid=%s','${liveConcurrencyJob.jobUuid}'));`)) === 0, JSON.stringify(simultaneous.map(x => [x.code, !!x.json?.run, !!x.json?.saturated, x.json?.error, x.stderr.slice(0, 120)])));

r = await t.api('POST', '/batch/jobs', { rootId: root.id, programs: [
  { programSpecialtyId: 'ps_ess_003', priorityPosition: 30, goldStarred: false, tier: 'ESSENTIAL' }
] });
const commitFailureJob = r.json.job;
php(`update_option('mmed_ps_proto_test_fail_transition_commit',1);`);
const callsBeforeCommitFailure = (await aiLog()).length;
r = await t.api('POST', `/batch/jobs/${commitFailureJob.jobUuid}/process`, {});
ok('M3 injected transition commit failure returns 503 and leaves the claimed state recoverable', r.status === 503 && r.json.code === 'mmps_batch_transition_commit' && Number(php(`global $wpdb; echo $wpdb->get_var($wpdb->prepare('SELECT active_items FROM '.$wpdb->prefix.'mmed_ps_proto_jobs WHERE job_uuid=%s','${commitFailureJob.jobUuid}'));`)) === 1, r.text.slice(0, 300));
php(`delete_option('mmed_ps_proto_test_fail_transition_commit'); global $wpdb; $wpdb->query($wpdb->prepare("UPDATE ".$wpdb->prefix."mmed_ps_proto_job_items SET locked_until=%s WHERE job_id=%d AND status='PROCESSING'",gmdate('Y-m-d H:i:s',time()-30),${commitFailureJob.id}));`);
r = await t.api('GET', `/batch/jobs/${commitFailureJob.jobUuid}`);
const recoveredFailureJob = r.json.job;
const callsBeforeRetry = (await aiLog()).length;
r = await t.api('POST', `/batch/jobs/${commitFailureJob.jobUuid}/process`, {});
ok('M3 failed commit recovery releases the exact stale slot and reuses provider work idempotently', recoveredFailureJob.items[0].status === 'QUEUED' && recoveredFailureJob.items[0].lastErrorCode === 'STALE_LOCK_RECOVERED' && r.status === 200 && r.json.run && Number(php(`global $wpdb; echo $wpdb->get_var($wpdb->prepare('SELECT active_items FROM '.$wpdb->prefix.'mmed_ps_proto_jobs WHERE job_uuid=%s','${commitFailureJob.jobUuid}'));`)) === 0 && (await aiLog()).length === callsBeforeRetry && callsBeforeRetry === callsBeforeCommitFailure + 1, r.text.slice(0, 300));
r = await t.api('POST', '/batch/jobs', { rootId: root.id, programs: [
  { programSpecialtyId: 'ps_deep_001', priorityPosition: 1, goldStarred: true, tier: 'ESSENTIAL' },
  { programSpecialtyId: 'ps_thin_002', priorityPosition: 2, goldStarred: false, tier: 'ESSENTIAL' },
  { programSpecialtyId: 'ps_ess_003', priorityPosition: 30, goldStarred: false, tier: 'ESSENTIAL' }
] });
const capJob = r.json.job;
php(`global $wpdb; $until=gmdate('Y-m-d H:i:s',time()+300); $rows=$wpdb->get_col($wpdb->prepare('SELECT id FROM '.$wpdb->prefix.'mmed_ps_proto_job_items WHERE job_id=%d ORDER BY id LIMIT 2',${capJob.id})); foreach($rows as $id){$wpdb->update($wpdb->prefix.'mmed_ps_proto_job_items',array('status'=>'PROCESSING','lock_token'=>wp_generate_uuid4(),'locked_until'=>$until),array('id'=>$id));} $wpdb->update($wpdb->prefix.'mmed_ps_proto_jobs',array('active_items'=>2),array('job_uuid'=>'${capJob.jobUuid}'));`);
r = await t.api('POST', `/batch/jobs/${capJob.jobUuid}/process`, {});
ok('M3 server concurrency: a third claimant is refused without consuming an item attempt', r.status === 200 && r.json.saturated === true && r.json.job.items.find(x => x.status === 'QUEUED').attemptCount === 0, r.text.slice(0, 300));
php(`global $wpdb; $wpdb->query($wpdb->prepare("UPDATE ".$wpdb->prefix."mmed_ps_proto_job_items SET status='FAILED',lock_token='',locked_until=NULL WHERE job_id=%d AND status='PROCESSING'",${capJob.id})); $wpdb->update($wpdb->prefix.'mmed_ps_proto_jobs',array('active_items'=>0),array('job_uuid'=>'${capJob.jobUuid}')); $day=gmdate('Y-m-d'); $n=(int)$wpdb->get_var($wpdb->prepare('SELECT MAX(attempt_no) FROM '.$wpdb->prefix.'mmed_ps_proto_provider_attempts WHERE user_id=%d AND day_key=%s',3,$day)); for($i=$n+1;$i<=150;$i++){$wpdb->insert($wpdb->prefix.'mmed_ps_proto_provider_attempts',array('attempt_uuid'=>wp_generate_uuid4(),'user_id'=>3,'root_id'=>${root.id},'program_specialty_id'=>'cap-fixture','idempotency_key'=>'cap-'.$i,'day_key'=>$day,'attempt_no'=>$i,'outcome_code'=>'TEST_FIXTURE','created_at'=>gmdate('Y-m-d H:i:s'),'updated_at'=>gmdate('Y-m-d H:i:s')));}`);
r = await t.api('POST', `/batch/jobs/${capJob.jobUuid}/process`, {});
ok('M3 daily provider cap: batch pauses without spending retries or losing resumability', r.status === 200 && r.json.paused === true && r.json.pauseCode === 'DAILY_CAP' && r.json.item.status === 'QUEUED' && r.json.item.attemptCount === 0 && r.json.item.lastErrorCode === 'DAILY_CAP_PAUSED', r.text.slice(0, 300));
php(`global $wpdb; $wpdb->delete($wpdb->prefix.'mmed_ps_proto_provider_attempts',array('outcome_code'=>'TEST_FIXTURE'));`);

// ---------- 9. isolation between users + CSRF ----------
const admin = new Session();
ok('admin login', await admin.login('founder', 'Founder-Local-1!'));
await admin.page();
ok('administrator sees Program-Specific PS in members mode', !!admin.nonce);
r = await admin.api('GET', '/bootstrap');
ok('second authorized user has normal production bootstrap without inheriting another owner\'s state', r.status === 200 && r.json.gate.mode === 'members' && r.json.provider.realRootAllowed === true);
r = await admin.api('GET', `/roots/${root.id}`);
ok('another authorized user cannot read tester\'s ROOT', r.status === 404);
r = await admin.api('GET', `/library/${doc.docUuid}`);
ok('another authorized user cannot read tester\'s saved PS', r.status === 404);
r = await admin.api('POST', '/library', { runId: deep.runId });
ok('another authorized user cannot save tester\'s run', r.status === 404);
r = await admin.api('GET', `/research-artifacts/${validArtifact.artifactUuid}/download?inline=1`);
ok('another authorized user cannot read or export tester\'s quarantined research', r.status === 404 && r.json.code === 'mmps_research_not_found');
r = await t.api('POST', '/roots', { source: 'SYNTHETIC', specialtyLabel: 'X' }, { Origin: 'https://evil.example' });
ok('cross-origin write refused', r.status === 403 && r.json.code === 'mmps_bad_origin');
r = await t.api('POST', '/roots', { source: 'SYNTHETIC', specialtyLabel: 'X' }, { 'X-WP-Nonce': 'bad' });
ok('bad nonce refused', r.status === 403 || r.status === 404 || r.status === 401);

// ---------- 10. blast radius ----------
const after = JSON.parse(php(`global $wpdb; echo json_encode(array('fv'=>$wpdb->get_var('SELECT COUNT(*) FROM '.MMED_File_Vault::table_name()),'fvsum'=>md5(json_encode($wpdb->get_results('SELECT * FROM '.MMED_File_Vault::table_name()))),'posts'=>$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts}"),'users'=>$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->users}"),'usermeta'=>$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key NOT LIKE 'session_tokens' AND meta_key NOT LIKE '%user-settings%'")));`));
ok('File Vault table untouched (row count + content hash identical)', after.fv === B.fv && after.fvsum === B.fvsum);
ok('no posts, users or user meta created', after.posts === B.posts && after.users === B.users && after.usermeta === B.usermeta, JSON.stringify([B, after]));
const tables = php(`global $wpdb; echo json_encode($wpdb->get_col("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%mmed%'"));`);
ok('only namespaced prototype tables exist besides the stub FV table', JSON.parse(tables).sort().join() === ['wp_mmed_file_vault_stub', 'wp_mmed_ps_proto_audit', 'wp_mmed_ps_proto_edit_revisions', 'wp_mmed_ps_proto_job_items', 'wp_mmed_ps_proto_jobs', 'wp_mmed_ps_proto_library', 'wp_mmed_ps_proto_provider_attempts', 'wp_mmed_ps_proto_research_artifacts', 'wp_mmed_ps_proto_roots', 'wp_mmed_ps_proto_runs', 'wp_mmed_ps_proto_similarity_buckets', 'wp_mmed_ps_proto_similarity_fingerprints'].join(), tables);
const fingerprintText = php(`global $wpdb; echo json_encode($wpdb->get_results('SELECT * FROM '.$wpdb->prefix.'mmed_ps_proto_similarity_fingerprints'));`);
ok('M5 fingerprint store contains keyed digests/signatures only, never Personal Statement prose', !/glucometer|Lakeshore|careful clinical reasoning|replacement_region|full_text/i.test(fingerprintText));
const auditText = php(`global $wpdb; echo json_encode($wpdb->get_col('SELECT detail_json FROM '.$wpdb->prefix.'mmed_ps_proto_audit'));`);
ok('audit log holds ids/codes/hashes only, never statement or research text', !/glucometer|Lakeshore University|residents take real|longitudinal ambulatory|student@example/.test(auditText));

// ---------- 11. kill switches ----------
php(`update_option('mmed_ps_proto_mode','off');`);
r = await t.api('GET', '/bootstrap'); p = await t.page(); hub = await (await t.raw('/member-dashboard/')).text();
ok('KILL 1 (option off): REST 404, page inert, no Hub script, File Vault stage intact', r.status === 404 && !p.html.includes('mmps-app') && !hub.includes('mmps-entry') && hub.includes('fv-canary'));
php(`update_option('mmed_ps_proto_mode','members');`);
flags(`define( 'MMED_PS_PROTO_DISABLE', true );`);
r = await t.api('GET', '/bootstrap'); p = await t.page(); hub = await (await t.raw('/member-dashboard/')).text();
ok('KILL 2 (wp-config constant): nothing loads', r.status === 404 && !p.html.includes('mmps-app') && !hub.includes('mmps-entry') && hub.includes('fv-canary'));
flags('');
php(`require_once ABSPATH.'wp-admin/includes/plugin.php'; deactivate_plugins('missionmed-file-vault-ps/missionmed-file-vault-ps.php');`);
r = await t.api('GET', '/bootstrap'); p = await t.page(); hub = await (await t.raw('/member-dashboard/')).text();
ok('KILL 3 (deactivate): nothing loads, File Vault stage intact', r.status === 404 && !p.html.includes('mmps-app') && !hub.includes('mmps-entry') && hub.includes('fv-canary'));
php(`require_once ABSPATH.'wp-admin/includes/plugin.php'; activate_plugin('missionmed-file-vault-ps/missionmed-file-vault-ps.php');`);
p = await t.page(); r = await t.api('GET', '/library');
ok('re-enable: prototype and its saved library return intact', p.html.includes('mmps-app') && r.json.documents.length >= 4);

// KILL 4: a corrupted prototype file must not hurt the site
const gen = `${SITE}/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-generator.php`;
const genOk = fs.readFileSync(gen, 'utf8');
fs.writeFileSync(gen, genOk.replace('class MMPS_Generator {', 'class MMPS_Generator {{{ broken'));
const home = await t.raw('/'); hub = await (await t.raw('/member-dashboard/')).text(); r = await t.api('GET', '/bootstrap'); const login = await anon.raw('/wp-login.php');
ok('BLAST RADIUS: corrupted prototype file -> site, Hub/File Vault page and login all still 200; prototype inert', home.status === 200 && hub.includes('fv-canary') && !hub.includes('mmps-entry') && r.status === 404 && login.status === 200);
fs.writeFileSync(gen, genOk);
fs.renameSync(gen, gen + '.gone');
const home2 = await t.raw('/'); hub = await (await t.raw('/member-dashboard/')).text(); r = await t.api('GET', '/bootstrap');
ok('BLAST RADIUS: missing prototype file (partial upload) -> site and Hub page still 200; prototype inert', home2.status === 200 && hub.includes('fv-canary') && !hub.includes('mmps-entry') && r.status === 404);
fs.renameSync(gen + '.gone', gen);
r = await t.api('GET', '/bootstrap');
ok('restored file -> prototype back', r.status === 200);

// ---------- 12. degraded dependencies ----------
flags(`define( 'MMED_PS_PROTO_OPENAI_MODEL', 'gpt-5.6-terra' );`);
await aiMode('bad-model');
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
ok('provider 400 -> clear error, no crash', r.status === 502 && r.json.code === 'mmps_provider_bad_request');
await aiMode('good');
fs.writeFileSync(`${SITE}/harness-flags.php`, `<?php\n`);
r = await t.api('GET', '/bootstrap');
ok('no AI key -> provider "none" (simulator is opt-in only)', r.json.provider.provider === 'none' && r.json.provider.configured === false);
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
ok('no AI key -> generation refuses cleanly', r.status === 503 && r.json.code === 'mmps_provider_not_configured');
fs.writeFileSync(`${SITE}/harness-flags.php`, `<?php\ndefine( 'MMED_PS_PROTO_ALLOW_SIMULATOR', true );\n`);
r = await t.api('GET', '/bootstrap');
ok('simulator is opt-in and reported as such', r.json.provider.provider === 'simulator');
r = await t.api('POST', '/generate', { rootId: root.id, programSpecialtyId: 'ps_ess_003', tier: 'ESSENTIAL' });
ok('simulator output is labelled SIMULATED and still passes integrity', r.status === 200 && r.json.simulated === true && /simulated/i.test(r.json.replacement) && r.json.rootIntegrity.ok === true, r.text.slice(0, 300));
flags('');

const failed = results.filter(x => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync(`${HARNESS}/e2e-api-results.json`, JSON.stringify(results, null, 1));
process.exit(failed.length ? 1 : 0);

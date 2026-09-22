// LOCAL TEST STUBS ONLY. Every program below is FICTIONAL. Shapes mirror the real RISE student routes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HARNESS_ROOT = process.env.MMPS_HARNESS_ROOT || '/home/claude/wpdev';

const day = 86400000, iso = (d) => new Date(Date.now() - d * day).toISOString();
const claim = (value, ageDays = 40) => ({ knowledge: { state: 'known', value }, claimId: 'clm_' + Buffer.from(String(value)).toString('hex').slice(0, 10), authority: 'REGISTRY_IMPORT', sourceUrl: '', retrievedAt: iso(ageDays), contentSha256: 'a'.repeat(64) });
const rec = (id, acgme, programName, institution, city, state, type, pd, pdAge = 40, srcAge = 40) => ({
  programSpecialtyId: id, designation: 'Internal Medicine',
  display: { programName, institution, hospital: institution, city, state },
  identifiers: [{ namespace: 'ACGME_PROGRAM', value: acgme }],
  source: { authority: 'REGISTRY_IMPORT', retrievedAt: iso(srcAge) },
  fields: { 'Program Best Described As': claim(type, srcAge), 'Program Type': claim('Categorical', srcAge), ...(pd ? { 'Program Director': claim(pd, pdAge), 'Program Director Credentials': claim('MD', pdAge) } : {}), 'Program Website': claim('https://im.' + id.replace(/_/g, '-') + '.example.org/', srcAge) }
});
const fact = (field, canonicalValue, extra = {}) => ({ field, knowledge: { state: 'known', value: canonicalValue }, canonicalValue, retrievedAt: iso(20), provider: 'PERPLEXITY_SONAR', sourceUrl: 'https://im.example.org/residency', sourceUrls: ['https://im.example.org/residency'], ...extra });

const programs = {
  ps_deep_001: { program: rec('ps_deep_001', '1403511001', 'Lakeshore University Internal Medicine Residency', 'Lakeshore University Medical Center', 'Rochester', 'NY', 'University-based', 'Registry Name Should Lose'),
    research: { currentFacts: [
      fact('research.leadership', { leadership: [ { name: 'Dr. Marisol Ventresca', credentials: 'MD, MPH', role: 'Program Director', roleCategory: 'PROGRAM_DIRECTOR', source_url: 'https://im.lakeshore.example.org/leadership', source_date: iso(15) }, { name: 'Dr. Owen Hale', role: 'Associate Program Director', source_url: 'https://im.lakeshore.example.org/leadership', source_date: iso(15) } ] }),
      fact('research.program_differentiators', { differentiators: [
        { title: 'Resident-run heart failure transitions clinic', detail: 'Residents staff a weekly post-discharge heart failure clinic with pharmacy and social work', category: 'Clinical training', source_url: 'https://im.lakeshore.example.org/clinics' },
        { title: 'Required quality improvement project with protected time', detail: 'Each resident completes a mentored QI project during a 4-week block in PGY-2', category: 'Research', source_url: 'https://im.lakeshore.example.org/qi' },
        { title: 'You will love our supportive culture', detail: 'Your growth matters to us', source_url: 'https://im.lakeshore.example.org/why' } ] }),
      fact('research.fellowship_inventory', { fellowships: [
        { name: 'Cardiovascular Disease fellowship', detail: 'ACGME-accredited, in-house', relationship: 'IN_HOUSE', classification: 'IM_ACCESSIBLE', source_url: 'https://im.lakeshore.example.org/fellowships' },
        { name: 'Gastroenterology fellowship', detail: 'Planned for a future year', relationship: 'PLANNED_NOT_EXISTING', source_url: 'https://im.lakeshore.example.org/fellowships' },
        { name: 'Nephrology fellowship', relationship: 'AFFILIATED', source_url: 'https://im.lakeshore.example.org/fellowships' } ] }),
      fact('research.curriculum', { curriculum: [ { title: '4+1 block schedule', detail: 'Four inpatient or elective weeks followed by one ambulatory week', source_url: 'https://im.lakeshore.example.org/curriculum' } ] }),
      fact('research.facilities_patient_population', { facilities: [ { title: 'Safety-net teaching hospital', detail: 'Primary site is a 520-bed safety-net hospital serving a large refugee community', source_url: 'https://im.lakeshore.example.org/about' } ] }),
      fact('research.culture', { items: [ { title: 'Peer said the residents are happy', source_url: 'https://forum.example.org/x' } ] }, { provider: 'STUDENT_INTEL' })
    ], pendingEvidence: [], dossier: null, domainStatuses: [] } },
  ps_thin_002: { program: rec('ps_thin_002', '1403821002', 'Riverbend Community Hospital Internal Medicine Residency', 'Riverbend Community Hospital', 'Dayton', 'OH', 'Community-based', 'Dr. Helen Okafor'),
    research: { currentFacts: [ fact('research.curriculum', { curriculum: [ { title: 'Night float system', detail: 'Interns rotate through a two-week night float block', source_url: 'https://riverbend.example.org/im' } ] }) ], pendingEvidence: [], dossier: null, domainStatuses: [] } },
  ps_ess_003: { program: rec('ps_ess_003', '1401931003', 'Prairie Regional Medical Center Internal Medicine Residency', 'Prairie Regional Medical Center', 'Wichita', 'KS', 'Community-based, university-affiliated', 'Dr. Stale Director', 900, 40),
    research: { currentFacts: [], pendingEvidence: [], dossier: null, domainStatuses: [] } },
  ps_dirty_004: { program: rec('ps_dirty_004', '1401111004', 'Harborview Coastal Internal Medicine Program', 'Harborview Coastal Health', 'Tampa', 'FL', 'Community-based', null),
    research: { currentFacts: [
      fact('research.program_differentiators', { contractId: 'rise-terminal-evidence-state-v1', state: 'RESEARCHED_NOT_FOUND', note: 'nothing public' }),
      fact('research.curriculum', { curriculum: [ { title: 'Old curriculum page', detail: 'Described a 3+1 schedule', source_url: 'https://harborview.example.org/old', retrieved_at: iso(800) }, { title: 'Conflicting schedule claims', conflict: true }, { title: 'No ICU rotation', absence: true }, { title: 'Unsourced claim', detail: 'No link at all' } ] }, { sourceUrl: '', sourceUrls: [] }),
      fact('research.research_opportunities', { opportunities: [ { title: 'Annual resident research day', detail: 'Residents present posters each spring', source_url: 'https://harborview.example.org/research' } ] })
    ], pendingEvidence: [], dossier: null, domainStatuses: [] } }
};
const myList = [
  { programSpecialtyId: 'ps_thin_002', state: 'INTERESTED', notes: 'PRIVATE NOTE MUST NEVER LEAVE RISE', goldStarred: false, priorityPosition: 2 },
  { programSpecialtyId: 'ps_ess_003', state: 'INTERESTED', notes: '', goldStarred: false, priorityPosition: 30 },
  { programSpecialtyId: 'ps_dirty_004', state: 'INTERESTED', notes: 'PRIVATE NOTE MUST STAY IN RISE', goldStarred: false, priorityPosition: 31 },
  { programSpecialtyId: 'ps_deep_001', state: 'APPLYING', notes: 'another private note', goldStarred: true, priorityPosition: 1 },
  { programSpecialtyId: 'ps_missing_999', state: 'INTERESTED', notes: '', goldStarred: false, priorityPosition: 32 }
];
const log = { rise: [], ai: [] };
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); const cookie = req.headers.cookie || '';
  log.rise.push({ method: req.method, path: url.pathname, cookie, xfh: req.headers['x-forwarded-host'] });
  if (url.pathname === '/__log') return send(res, 200, log.rise);
  if (req.method !== 'GET') return send(res, 405, { error: 'stub is read-only' });
  if (!/(^|;\s*)mmhq_session=good-session(;|$)/.test(cookie)) return send(res, 401, { error: 'AUTH_REQUIRED' });
  if (url.pathname === '/api/rise/v1/me/programs') return send(res, 200, { records: myList });
  if (url.pathname === '/api/rise/v1/programs') { const q = (url.searchParams.get('q') || '').toLowerCase(); return send(res, 200, { records: Object.values(programs).map(p => p.program).filter(r => (r.display.programName + ' ' + r.display.institution).toLowerCase().includes(q)) }); }
  const m = url.pathname.match(/^\/api\/rise\/v1\/program-specialties\/([^/]+)$/);
  if (m && programs[decodeURIComponent(m[1])]) return send(res, 200, { registryReleaseId: 'rise_registry_STUB_0001', ...programs[decodeURIComponent(m[1])] });
  return send(res, 404, { error: 'NOT_FOUND' });
}).listen(4011, '127.0.0.1');

let mode = 'good';
http.createServer((req, res) => {
  let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__mode') { mode = url.searchParams.get('m') || 'good'; return send(res, 200, { mode }); }
    if (url.pathname === '/__log') return send(res, 200, log.ai);
    if (url.pathname !== '/v1/responses' || req.method !== 'POST') return send(res, 404, {});
    const body = JSON.parse(raw); const payload = JSON.parse(body.input[1].content);
    log.ai.push({ auth: (req.headers.authorization || '').startsWith('Bearer '), store: body.store, strict: body.text?.format?.strict, model: body.model, raw, revision: !!payload.revision_notes });
    if (mode === 'bad-model' ) return send(res, 400, { error: { message: 'model not found' } });
    const F = payload.allowed_facts, by = (label) => F.find(f => f.label === label);
    const name = payload.program.programName, loc = by('Location'), type = by('Program type'), pd = by('Program director');
    const deep = F.filter(f => f.category !== 'identity');
    const regionIndex = Math.max(0, Number(payload.region?.paragraph_number || 1) - 1);
    const protectedRoot = (payload.root_paragraphs || []).filter((_, index) => payload.region?.mode !== 'REPLACE_PARAGRAPH' || index !== regionIndex).join(' ');
    const factCorpus = F.map(item => `${item.label || ''} ${item.text || ''}`.toLocaleLowerCase()).join(' ');
    const genericAnchors = new Set(['patient', 'patients', 'care', 'medicine', 'medical', 'physician', 'physicians', 'residency', 'program', 'growth', 'learning', 'community', 'service', 'curiosity']);
    const rootAnchors = [...new Set((protectedRoot.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{3,}/gu) || []).map(word => word.toLocaleLowerCase()))]
      .filter(word => !genericAnchors.has(word) && !factCorpus.includes(word))
      .slice(0, 5);
    if (rootAnchors.length !== 5) throw new Error('Synthetic fixture needs five distinct protected-ROOT anchors');
    const anchorSentences = [
      anchor => `I learned that kind of attention while searching for ${anchor}.`,
      anchor => `The memory of ${anchor} keeps my goals practical.`,
      anchor => `What began with ${anchor} still guides how I ask questions.`,
      anchor => `I return to ${anchor} when I think about the setting in which I hope to train.`,
      anchor => `${anchor[0].toLocaleUpperCase()}${anchor.slice(1)} remains a quiet reminder to keep reflection tied to action.`
    ];
    const bad = mode === 'hallucinate-always' || (mode === 'hallucinate-once' && !payload.revision_notes);
    const openings = {
      TRAINING_ENVIRONMENT: 'I learn best when close observation, direct feedback, and shared responsibility turn uncertainty into better clinical judgment.',
      STUDENT_GOAL_FORWARD: 'I want residency to make me the kind of internist who can connect careful decisions with practical improvement for patients.',
      RESEARCH_FELLOWSHIP: 'My quality work taught me that inquiry matters most when its answer changes what happens at the bedside.',
      LOCATION_PROGRAM_TYPE: 'Where I train will shape which needs I learn to see and how I understand the community around each patient.',
      BALANCED_QUIET_SPECIFIC: 'I am looking for a place where thoughtful care and steady growth remain connected in the ordinary work of residency.'
    };
    const closings = {
      TRAINING_ENVIRONMENT: 'I would contribute curiosity, steadiness, and a willingness to revise my habits as the work asks more of me.',
      STUDENT_GOAL_FORWARD: 'I would carry that goal forward by listening first, asking useful questions, and remaining accountable for what follows.',
      RESEARCH_FELLOWSHIP: 'That discipline would let me keep investigation close to the relationships that give it purpose.',
      LOCATION_PROGRAM_TYPE: 'I would enter ready to learn local priorities rather than assume them and to contribute through consistent clinical work.',
      BALANCED_QUIET_SPECIFIC: 'I can contribute follow-through, reflection, and respect for the people who make difficult work possible.'
    };
    const candidates = (payload.requested_strategies || []).map((requested, index) => {
      const key = requested.key;
      const segs = [{ text: openings[key] || 'I have thought carefully about residency training.', kind: 'student_link', fact_ids: [] }];
      const rootAnchor = rootAnchors[index];
      segs.push({ text: anchorSentences[index](rootAnchor), kind: 'student_link', fact_ids: [] });
      const nameFact = by('Program name');
      const identityFact = key === 'LOCATION_PROGRAM_TYPE' ? (loc || type) : key === 'BALANCED_QUIET_SPECIFIC' ? null : type;
      const identityIds = [nameFact, identityFact].filter(Boolean).map(f => f.fact_id);
      const identityText = key === 'LOCATION_PROGRAM_TYPE' && loc
        ? `${name}, ${loc.text.replace(/^The program is located in /, 'located in ').replace(/\.$/, '')}, would give that next stage a concrete setting.`
        : key === 'TRAINING_ENVIRONMENT' && type
          ? `${name} is ${type.text.replace(/^The program describes its setting as:\s*/, '').replace(/^The program is /, '').replace(/\.$/, '')}, a verified context for that work.`
          : key === 'STUDENT_GOAL_FORWARD'
            ? `${name} would make that next step concrete.`
            : key === 'RESEARCH_FELLOWSHIP'
              ? `I hope to apply that habit of inquiry at ${name}.`
              : `At ${name}, I could keep those priorities together without overstating what the evidence promises.`;
      segs.push({ text: identityText, kind: 'program_fact', fact_ids: identityIds });
      if (deep.length && ['TRAINING_ENVIRONMENT', 'RESEARCH_FELLOWSHIP', 'BALANCED_QUIET_SPECIFIC'].includes(key)) {
        const f = deep[index % deep.length];
        const lead = key === 'TRAINING_ENVIRONMENT' ? 'The training connection is grounded in this verified detail' : key === 'RESEARCH_FELLOWSHIP' ? 'My interest has a specific point of contact here' : 'One understated reason for that choice is';
        segs.push({ text: `${lead}: ${f.text.replace(/\.$/, '')}.`, kind: 'program_fact', fact_ids: [f.fact_id] });
      }
      if (pd && key === 'STUDENT_GOAL_FORWARD') segs.push({ text: pd.text, kind: 'program_fact', fact_ids: [pd.fact_id] });
      if (bad && index === 0) segs.push({ text: 'With 42 residents per class and the mentorship of Dr. Alan Whitmore, it is better than any other option.', kind: 'program_fact', fact_ids: [] });
      segs.push({ text: closings[key] || 'I can apply the same deliberate approach to the work ahead.', kind: 'student_link', fact_ids: [] });
      return { candidate_id: key, replacement_region: segs.map(s => s.text).join(' '), segments: segs, facts_used: [...new Set(segs.flatMap(s => s.fact_ids))], root_anchor_terms: [rootAnchor], strategy: key, rhetorical_focus: `Stub fixture for ${key}`, self_check: { name_swap_would_still_work: false, possible_unsupported_claims: [], generic_phrases: [] } };
    });
    const out = { recommended_candidate_id: 'BALANCED_QUIET_SPECIFIC', candidates };
    const finish = () => send(res, 200, { id: 'resp_stub', output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(out) }] }], usage: { input_tokens: 1800, output_tokens: 260 } });
    if (mode === 'slow-good') return setTimeout(finish, 800);
    finish();
  });
}).listen(4012, '127.0.0.1');

http.createServer((req, res) => {
  const file = path.join(HARNESS_ROOT, 'harness/files', path.basename(decodeURIComponent(req.url.split('?')[0])));
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(fs.readFileSync(file));
}).listen(4013, '127.0.0.1');
console.log('stubs up: rise 4011, ai 4012, files 4013');

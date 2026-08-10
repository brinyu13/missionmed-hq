#!/usr/bin/env node
/* B1-513 verification probes — security / privacy / data-model checks executed
 * against the prototype's synthetic backend contract (the demonstrated Stage 2
 * API semantics). These prove the PROTOTYPE enforces the contract it maps to;
 * production enforcement is PostgreSQL RLS per docs 10/11/14. */
import { chromium } from 'playwright';

const FILE = 'file:///home/claude/b1-513r/B1-513R2_FINAL_WORKING_PROTOTYPE.html';
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const page = await (await browser.newContext()).newPage();
await page.addInitScript(() => sessionStorage.setItem('storyforge_local_fixture_persona', 'founderStudent'));
await page.goto(FILE, { waitUntil: 'load' });
await page.waitForFunction(() => !document.body.classList.contains('is-booting'), { timeout: 15000 });

const api = async (persona, method, path, body) => page.evaluate(async ({ persona, method, path, body }) => {
  const init = { method, headers: { Authorization: `Bearer proto-token.${persona}`, 'Content-Type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`https://storyforge-prototype.local/api/${path}`, init);
  let payload = {};
  try { payload = await response.json(); } catch { /* empty */ }
  return { status: response.status, payload };
}, { persona, method, path, body });

/* 1. Cross-student direct-ID denial: Maya reads Dr Brian's mentor-visible story */
let r = await api('student', 'GET', 'stories/s-101');
check('cross-student direct-ID read → 404/P0002', r.status === 404 && r.payload.code === 'P0002', `got ${r.status}/${r.payload.code}`);

/* 2. Cross-student write denial */
r = await api('student', 'PATCH', 'stories/s-101', { text: 'hijack' });
check('cross-student write → denied', r.status === 404 || r.status === 403, `got ${r.status}`);

/* 3. Private story invisible to admin by direct ID (s-104 is Dr Brian private; admin persona ≠ owner) */
r = await api('admin', 'GET', 'admin/console/stories/s-104');
check('admin direct-ID read of PRIVATE story → 404', r.status === 404, `got ${r.status}`);

/* 4. Private story absent from admin directory story list */
r = await api('admin', 'GET', 'admin/console/directory/u-founder');
const listedIds = (r.payload.stories || []).map((s) => s.id);
check('directory lists mentor-visible/submitted only (no s-104 private)', r.status === 200 && !listedIds.includes('s-104') && listedIds.includes('s-101'), listedIds.join(','));
check('directory shows private as COUNT only', (r.payload.student?.storyCounts?.private ?? 0) > 0 && !(JSON.stringify(r.payload.stories)).includes('Managua'), `privateCount=${r.payload.student?.storyCounts?.private}`);

/* 5. Anonymous denial */
r = await page.evaluate(async () => {
  const response = await fetch('https://storyforge-prototype.local/api/stories', { headers: { Authorization: 'Bearer proto-token.nobody' } });
  return response.status;
});
check('unknown identity → 401', r === 401, `got ${r}`);

/* 6. Student cannot reach admin endpoints */
r = await api('student', 'GET', 'admin/console/directory');
check('student → admin directory → 403', r.status === 403, `got ${r.status}`);

/* 7. Submitted story cannot be made private without withdraw (s-102 awaiting, owner founderStudent) */
r = await api('founderStudent', 'POST', 'stories/s-102/visibility', { visibility: 'private' });
check('submitted → private blocked (withdraw-first rule)', r.status === 409 && r.payload.code === 'visibility_submitted', `got ${r.status}/${r.payload.code}`);

/* 8. Non-owner cannot change visibility */
r = await api('student', 'POST', 'stories/s-101/visibility', { visibility: 'private' });
check('non-owner visibility change → denied', r.status === 404 || r.status === 403, `got ${r.status}`);

/* 9. Original telling protected via version API */
r = await api('founderStudent', 'PATCH', 'stories/s-101/versions/original', { body: 'overwrite attempt' });
check('version API rejects original overwrite', r.status === 403 && r.payload.code === 'version_protected', `got ${r.status}/${r.payload.code}`);
r = await api('founderStudent', 'PATCH', 'stories/s-101/versions/full_story', { body: 'x' });
check('version API rejects full_story (canonical path only)', r.status === 400, `got ${r.status}`);

/* 10. Version retell preserves prior body as revision (no data loss) */
const before = await api('founderStudent', 'GET', 'stories/s-106');
const priorThirty = before.payload.story.versions.thirty_second.body;
r = await api('founderStudent', 'PATCH', 'stories/s-106/versions/thirty_second', { body: 'fresh retelling', mode: 'retell', source: 'typed' });
const afterRevs = r.payload.story.versions.thirty_second.revisions.map((x) => x.body);
check('retell snapshots prior telling (monotone history)', afterRevs.includes(priorThirty), `revisions=${afterRevs.length}`);

/* 11. Restore is symmetric (newer telling also kept) */
const revId = r.payload.story.versions.thirty_second.revisions.find((x) => x.body === priorThirty).id;
r = await api('founderStudent', 'POST', 'stories/s-106/version-restore', { versionKey: 'thirty_second', revisionId: revId });
const v = r.payload.story.versions.thirty_second;
check('restore brings back prior body AND keeps the fresh one in history', v.body === priorThirty && v.revisions.some((x) => x.body === 'fresh retelling'), '');

/* 12. Consent: new-story default follows consent state */
r = await api('student', 'POST', 'stories', { title: 'pre-consent test', text: 'hello' });
check('pre-consent new story → private', r.payload.story.visibility === 'private', r.payload.story.visibility);
await api('student', 'POST', 'consent', { decision: 'accept' });
r = await api('student', 'POST', 'stories', { title: 'post-consent test', text: 'hello' });
check('post-consent new story → mentor_visible', r.payload.story.visibility === 'mentor_visible', r.payload.story.visibility);
r = await api('student', 'GET', 'stories');
const legacy = r.payload.stories.find((s) => s.id === 's-201');
check('historical story NOT silently converted by consent', legacy.visibility === 'private', legacy.visibility);

/* 13. Review Check rate limit */
await api('admin', 'POST', 'admin/console/review-check', { studentId: 'u-st12' });
r = await api('admin', 'POST', 'admin/console/review-check', { studentId: 'u-st12' });
check('review check 24h duplicate → 429', r.status === 429, `got ${r.status}`);

/* 14. Review Check truthful branching (student with submissions vs none) */
r = await api('admin', 'POST', 'admin/console/review-check', { studentId: 'u-st6', preview: true });
const noneText = r.payload.preview.text;
r = await api('admin', 'POST', 'admin/console/review-check', { studentId: 'u-founder', preview: true });
check('review check text truthful per state', noneText.includes('no stories had been submitted') && !r.payload.preview.text.includes('no stories had been submitted'), '');

/* 15. Visibility change is audited into story history */
r = await api('founderStudent', 'POST', 'stories/s-107/visibility', { visibility: 'private' });
check('visibility change logged to history', r.payload.story.history[0].action === 'story.visibility_changed', r.payload.story.history[0].action);


/* ---- B1-513R guest & module probes ---- */
/* 16. invalid guest token */
r = await page.evaluate(async () => { const x = await fetch('https://storyforge-prototype.local/api/requests/guest/rs-invalid-token'); return x.status; });
check('invalid guest token → 404', r === 404, 'got ' + r);
/* 17. revoked invitation link dies */
await api('founderStudent', 'POST', 'requests/inv-2/revoke');
r = await page.evaluate(async () => { const x = await fetch('https://storyforge-prototype.local/api/requests/guest/rs-demo-ken'); return x.status; });
check('revoked guest token → 410', r === 410, 'got ' + r);
/* 18. guest payload carries no student stories, library, or other-student data */
r = await page.evaluate(async () => { const x = await fetch('https://storyforge-prototype.local/api/requests/guest/rs-demo-rosa'); return await x.json(); });
check('guest payload minimal (no stories/library/ids beyond first name)', !JSON.stringify(r).includes('s-10') && !JSON.stringify(r).includes('Maya') && r.student && !r.student.id && !r.student.email, '');
/* 19. cross-student invitation ops denied */
r = await api('student', 'POST', 'requests/inv-3/revoke');
check('cross-student invitation revoke → 404', r.status === 404, 'got ' + r.status);
/* 20. cross-student contribution promote denied */
r = await api('student', 'POST', 'contributions/ctr-1/promote', {});
check('cross-student contribution promote → 404', r.status === 404, 'got ' + r.status);
/* 21. promoted contribution provenance minimizes PII */
r = await api('founderStudent', 'POST', 'contributions/ctr-2/promote', {});
const org = r.payload?.story?.origin || {};
check('promotion keeps provenance, first-name only (no email)', org.type === 'contribution' && org.contributorFirstName === 'Rosa' && !JSON.stringify(org).includes('@'), JSON.stringify(org).slice(0,80));

/* 22. promoted contribution starts PRIVATE (contributor promise) */
check('contribution promotion starts Private', r.payload?.story?.visibility === 'private', r.payload?.story?.visibility);
/* 23. contribution cap enforced */
let capStatus = 0;
for (let i = 0; i < 4; i += 1) {
  capStatus = await page.evaluate(async () => {
    const x = await fetch('https://storyforge-prototype.local/api/requests/guest/rs-demo-rosa/contribution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', transcript: 'probe', promptId: 'c-001', promptText: 'probe' }) });
    return x.status;
  });
}
check('guest contribution cap → 429 after limit', capStatus === 429, 'got ' + capStatus);

/* ==================== B1-513R2 probes ==================== */

/* 24. Pins are per-user (Maya sees no founder pins; her pin touches only her list) */
r = await api('student', 'GET', 'inspiration/browse');
check('R2: pinned list is per-user (Maya starts empty)', r.status === 200 && (r.payload.pinned || []).length === 0, `pinned=${(r.payload.pinned || []).length}`);
await api('student', 'POST', 'inspiration/pin/q-002');
r = await api('student', 'GET', 'inspiration/browse');
const mayaPinned = (r.payload.pinned || []).map((p) => p.id);
r = await api('founderStudent', 'GET', 'inspiration/browse');
const founderPinned = (r.payload.pinned || []).map((p) => p.id);
check('R2: pinning is isolated per user', mayaPinned.includes('q-002') && !founderPinned.includes('q-002') && founderPinned.length >= 3, `maya=${mayaPinned} founder=${founderPinned.length}`);

/* 25. pin-order reorders only the caller's list */
await api('founderStudent', 'POST', 'inspiration/pin-order', { ids: ['q-035', 'q-046', 'q-001'] });
r = await api('founderStudent', 'GET', 'inspiration/browse');
check('R2: pin-order applies student-owned order', (r.payload.pinned || [])[0]?.id === 'q-035', (r.payload.pinned || []).map((p) => p.id).join(','));
r = await api('student', 'GET', 'inspiration/browse');
check('R2: pin-order does not disturb another user', (r.payload.pinned || []).map((p) => p.id).includes('q-002'), '');

/* 26. Bulk import can NEVER publish directly */
r = await api('admin', 'POST', 'admin/console/inspiration/bulk-parse', { csv: 'text,who,domain,energy,territory,followUp,interviewUse\n"A brand new probe question, quoted commas and all?",you,personal,light,probe_territory,"And then what happened?","probe"' });
check('R2: bulk-parse validates quoted CSV', r.status === 200 && r.payload.summary.ok === 1 && r.payload.summary.errors === 0, JSON.stringify(r.payload.summary));
r = await api('admin', 'POST', 'admin/console/inspiration/bulk-commit', { rows: r.payload.rows });
const importedPrompt = (r.payload.configuration?.prompts || []).find((p) => p.imported && p.text.startsWith('A brand new probe question'));
check('R2: bulk-commit lands as Retired draft, never active', Boolean(importedPrompt) && importedPrompt.state === 'retired', importedPrompt?.state);
r = await api('founderStudent', 'GET', 'inspiration/browse');
check('R2: imported draft invisible to students until published', !(r.payload.prompts || []).some((p) => p.text.startsWith('A brand new probe question')), '');

/* 27. Bulk-parse flags duplicates and errors truthfully */
r = await api('admin', 'GET', 'admin/console/inspiration');
const existingText = (r.payload.configuration?.prompts || []).find((p) => p.state === 'active')?.text || '';
r = await api('admin', 'POST', 'admin/console/inspiration/bulk-parse', { csv: `text,who,domain,energy,territory,followUp,interviewUse\n"${existingText.replaceAll('"', '""')}",you,personal,light,x,"dup follow-up",\n"Missing follow-up row that is long enough",you,personal,light,x,,` });
check('R2: bulk-parse marks duplicate + error rows', r.payload.summary.duplicates === 1 && r.payload.summary.errors === 1 && r.payload.summary.ok === 0, JSON.stringify(r.payload.summary));

/* 28. Students cannot reach bulk import */
r = await api('student', 'POST', 'admin/console/inspiration/bulk-commit', { rows: [] });
check('R2: student → bulk-commit → 403', r.status === 403, `got ${r.status}`);

/* 29. Only never-sent drafts are editable */
r = await api('founderStudent', 'POST', 'requests/inv-1/update', { personalMessage: 'rewrite attempt' });
check('R2: editing a sent invitation → 409 invitation_locked', r.status === 409 && r.payload.code === 'invitation_locked', `got ${r.status}/${r.payload.code}`);

/* 30. Truthful lifecycle walks DRAFT → SENT/DELIVERED → LINK VISITED → STARTED → STORY SHARED */
r = await api('founderStudent', 'POST', 'requests', { relationship: 'mentor', contributorName: 'Prof. Reyes', email: 'reyes@univ.edu', personalMessage: '' });
const lcInv = r.payload.invitation;
check('R2: new invitation starts as draft', lcInv.status === 'draft', lcInv.status);
r = await api('founderStudent', 'POST', `requests/${lcInv.id}/send`);
check('R2: send → delivered only via provider-delivery event', r.payload.invitation.status === 'delivered' && r.payload.delivery?.event === 'Delivery', r.payload.invitation.status);
r = await page.evaluate(async (token) => { const x = await fetch(`https://storyforge-prototype.local/api/requests/guest/${token}`); return (await x.json()) && x.status; }, lcInv.token);
r = await api('founderStudent', 'GET', 'requests');
let lcNow = (r.payload.invitations || []).find((i) => i.id === lcInv.id);
check('R2: guest page visit → link_visited (strongest pre-story signal)', lcNow.status === 'link_visited' && Boolean(lcNow.linkVisitedAt), lcNow.status);
await page.evaluate(async (token) => fetch(`https://storyforge-prototype.local/api/requests/guest/${token}/started`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), lcInv.token);
r = await api('founderStudent', 'GET', 'requests');
lcNow = (r.payload.invitations || []).find((i) => i.id === lcInv.id);
check('R2: contribution entry → started', lcNow.status === 'started', lcNow.status);
await page.evaluate(async (token) => fetch(`https://storyforge-prototype.local/api/requests/guest/${token}/contribution`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', transcript: 'lifecycle probe story', promptId: 'c-030', promptText: 'q' }) }), lcInv.token);
r = await api('founderStudent', 'GET', 'requests');
lcNow = (r.payload.invitations || []).find((i) => i.id === lcInv.id);
check('R2: contribution → story_shared', lcNow.status === 'story_shared', lcNow.status);

/* 31. Relationship-aware journeys (parent vs mentor ordering + line) */
const parentPayload = await page.evaluate(async () => (await (await fetch('https://storyforge-prototype.local/api/requests/guest/rs-demo-rosa')).json()));
const mentorPayload = await page.evaluate(async (token) => (await (await fetch(`https://storyforge-prototype.local/api/requests/guest/${token}`)).json()), lcInv.token);
check('R2: parent journey leads with childhood (c-001) + parent line', parentPayload.prompts?.[0]?.id === 'c-001' && /watched them become/.test(parentPayload.journeyLine || ''), parentPayload.prompts?.[0]?.id);
check('R2: mentor journey leads with growth/feedback (c-030) + mentor line', mentorPayload.prompts?.[0]?.id === 'c-030' && /feedback|learn/.test(mentorPayload.journeyLine || ''), mentorPayload.prompts?.[0]?.id);
check('R2: journeys expose only that relationship’s prompts', (mentorPayload.prompts || []).every((p) => (p.rel || []).includes('mentor')), '');

/* 32. started never regresses story_shared */
await page.evaluate(async (token) => fetch(`https://storyforge-prototype.local/api/requests/guest/${token}/started`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), lcInv.token);
r = await api('founderStudent', 'GET', 'requests');
lcNow = (r.payload.invitations || []).find((i) => i.id === lcInv.id);
check('R2: started never demotes story_shared', lcNow.status === 'story_shared', lcNow.status);

/* 33. bounced is a first-class truthful state */
r = await api('founderStudent', 'GET', 'requests');
const bounced = (r.payload.invitations || []).find((i) => i.id === 'inv-4');
check('R2: bounced surfaced with reason (never shown as sent-and-fine)', bounced?.status === 'bounced' && Boolean(bounced?.bounceReason), bounced?.status);

/* 34/35. preferences persist on the account */
await api('founderStudent', 'POST', 'preferences/theme', { theme: 'light' });
await api('founderStudent', 'POST', 'preferences/inspiration-layout', { layout: 'grid' });
r = await api('founderStudent', 'GET', 'session');
check('R2: theme preference persists on the signed account', r.payload.user?.theme_preference === 'light', r.payload.user?.theme_preference);
check('R2: inspiration layout preference persists', r.payload.user?.inspiration_layout === 'grid', r.payload.user?.inspiration_layout);
await api('founderStudent', 'POST', 'preferences/theme', { theme: 'dark' });

/* 36. directory pagination is bounded and sane at 100+ scale */
r = await api('admin', 'GET', 'admin/console/directory?page=999&pageSize=25');
check('R2: out-of-range page returns empty page, sane totals', r.status === 200 && (r.payload.students || []).length === 0 && r.payload.total >= 120, `total=${r.payload.total}`);
r = await api('admin', 'GET', 'admin/console/directory?pageSize=5000');
check('R2: pageSize capped (≤50)', (r.payload.students || []).length <= 50, `${(r.payload.students || []).length}`);

/* 37. queue endpoint denied to students */
r = await api('student', 'GET', 'admin/console/queue');
check('R2: student → review queue → 403', r.status === 403, `got ${r.status}`);

/* 38. Dr Brian Recommends round-trip (admin marks; student sees) */
await api('admin', 'POST', 'admin/console/inspiration/save', { prompt: { id: 'q-002', recommended: true } });
r = await api('founderStudent', 'GET', 'inspiration/browse');
check('R2: recommended flag flows admin → student browse', (r.payload.prompts || []).find((p) => p.id === 'q-002')?.recommended === true, '');

/* 39. answered mapping never leaks another student's story */
r = await api('student', 'GET', 'inspiration/browse');
const q46ForMaya = (r.payload.prompts || []).find((p) => p.id === 'q-046');
check('R2: answeredStoryId maps own stories only (no cross-student leak)', !q46ForMaya || q46ForMaya.answeredStoryId !== 's-102', q46ForMaya?.answeredStoryId || '(absent)');

/* ==================== red-team pass-2 regression probes ==================== */

/* RT-A: a retired prompt can neither leak through pinned[] nor be newly pinned.
 * (Maya pinned q-002 while it was active in probe 24 — the strongest case.) */
await api('admin', 'POST', 'admin/console/inspiration/save', { prompt: { id: 'q-002', state: 'retired' } });
r = await api('student', 'GET', 'inspiration/browse');
check('RT-A: already-pinned prompt vanishes from pinned[] the moment it is retired', !(r.payload.pinned || []).some((p) => p.id === 'q-002'), (r.payload.pinned || []).map((p) => p.id).join(','));
await api('student', 'POST', 'inspiration/pin/q-002'); /* unpin the stale entry */
r = await api('student', 'POST', 'inspiration/pin/q-002');
check('RT-A: freshly pinning a retired prompt → 404', r.status === 404 && r.payload.code === 'prompt_not_available', `got ${r.status}`);
await api('admin', 'POST', 'admin/console/inspiration/save', { prompt: { id: 'q-002', state: 'active' } });

/* RT-B: bulk-commit discards client-supplied IDs and re-validates rows */
r = await api('admin', 'POST', 'admin/console/inspiration/bulk-commit', { rows: [
  { ok: true, prompt: { id: 'q-012', text: 'Shadow attack question that is long enough to pass', followUp: 'f', who: ['you'], domain: ['personal'], energy: ['light'] } },
  { ok: true, prompt: { text: 'short', followUp: '' } },
] });
const q012Count = (r.payload.configuration?.prompts || []).filter((p) => p.id === 'q-012').length;
const shadow = (r.payload.configuration?.prompts || []).find((p) => p.text.startsWith('Shadow attack question'));
check('RT-B: client id discarded — stable IDs never shadowed', q012Count === 1 && shadow && shadow.id !== 'q-012' && shadow.id.startsWith('q-imp-'), `q-012×${q012Count} → ${shadow?.id}`);
check('RT-B: invalid rows rejected server-side even when marked ok', r.payload.committed === 1, `committed=${r.payload.committed}`);

/* RT-C: bounced is terminal — resend refused with honest 409 */
r = await api('founderStudent', 'POST', 'requests/inv-4/resend');
check('RT-C: resend to a bounced address → 409 invitation_terminal', r.status === 409 && r.payload.code === 'invitation_terminal', `got ${r.status}/${r.payload.code}`);

/* RT-E: guest transcript bounded */
r = await api('founderStudent', 'POST', 'requests', { relationship: 'best_friend', contributorName: 'Cap Probe', email: 'cap@example.com' });
const capInv = r.payload.invitation;
await page.evaluate(async (token) => fetch(`https://storyforge-prototype.local/api/requests/guest/${token}`), capInv.token);
await page.evaluate(async (token) => fetch(`https://storyforge-prototype.local/api/requests/guest/${token}/contribution`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', transcript: 'x'.repeat(500000), promptId: 'c-019', promptText: 'q' }) }), capInv.token);
r = await api('founderStudent', 'GET', 'requests');
const capCtr = (r.payload.contributions || []).find((c) => c.invitationId === capInv.id);
check('RT-E: unauthenticated guest write bounded (transcript ≤ 20k)', capCtr && capCtr.transcript.length <= 20000, `len=${capCtr?.transcript.length}`);

/* RT-F: relationship must come from the governed library */
r = await api('founderStudent', 'POST', 'requests', { relationship: 'landlord', contributorName: 'X', email: 'x@example.com' });
check('RT-F: unknown relationship → 400 (no fallback journey)', r.status === 400 && r.payload.code === 'relationship_invalid', `got ${r.status}`);

await browser.close();
const failed = results.filter((x) => !x.pass);
console.log(`PROBES: ${results.length - failed.length}/${results.length} PASS`);
results.forEach((x) => console.log(` ${x.pass ? '✓' : '✗ FAIL'} ${x.name}${x.detail ? ` — ${x.detail}` : ''}`));
process.exit(failed.length ? 1 : 0);

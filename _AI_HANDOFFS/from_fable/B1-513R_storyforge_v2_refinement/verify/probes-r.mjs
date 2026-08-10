#!/usr/bin/env node
/* B1-513 verification probes — security / privacy / data-model checks executed
 * against the prototype's synthetic backend contract (the demonstrated Stage 2
 * API semantics). These prove the PROTOTYPE enforces the contract it maps to;
 * production enforcement is PostgreSQL RLS per docs 10/11/14. */
import { chromium } from 'playwright';

const FILE = 'file:///home/claude/b1-513r/B1-513R_FINAL_WORKING_PROTOTYPE.html';
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
await browser.close();
const failed = results.filter((x) => !x.pass);
console.log(`PROBES: ${results.length - failed.length}/${results.length} PASS`);
results.forEach((x) => console.log(` ${x.pass ? '✓' : '✗ FAIL'} ${x.name}${x.detail ? ` — ${x.detail}` : ''}`));
process.exit(failed.length ? 1 : 0);

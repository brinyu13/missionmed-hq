// Exact literal replacements only. Refuse stale source; no inferred content.
import fs from 'node:fs';
const p='wp-content/mu-plugins/missionmed-mr-alternate-assets/page.php';let s=fs.readFileSync(p,'utf8');
for(const [a,b] of [
 ['Dr Brian learns the person behind the application. Together, you work with your own experiences—not a memorized script—to develop truthful content you can adapt in a real interview.','Dr Brian gets to know the person behind your application, watches you practice and gives direct feedback. Together, you develop your own truthful experiences into communication you can adapt for the real interview ahead.'],
 ['<p class="mm-alt-kicker">Standalone focused program</p><h3>Interview Bootcamp Week</h3>','<p class="mm-alt-kicker">The intensive.</p><h3>Interview Bootcamp Week</h3>'],
 ['<p class="mm-alt-kicker">Recommended / Full season</p><h3>IV Prep Complete</h3>','<p class="mm-alt-kicker">Bootcamp + the season.</p><h3>IV Prep Complete</h3>'],
 ['sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1199px) calc(100vw - 64px), 1120px"','sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1199px) calc(50vw - 50px), 542px"']
]){if(!s.includes(a))throw Error('Exact source not found: '+a);s=s.replaceAll(a,b)}
fs.writeFileSync(p,s);

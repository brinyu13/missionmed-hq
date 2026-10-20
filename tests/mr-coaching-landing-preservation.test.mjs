import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(0,'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(hash(source),'1f97918da753f76100bc3db00d7be61a81c0480722eaf319ab3a5ca6d1c4d1b4','exact read-only production page');
const edits=[
  [
    "<?php defined('ABSPATH') || exit; ?>",
    "<?php defined('ABSPATH') || exit;\n$coachingMarkup = '';\nif (is_file(__DIR__ . '/CoachingLandingIntegration.php')) {\n    require_once __DIR__ . '/CoachingLandingIntegration.php';\n    $coachingMarkup = mmed_mr_coaching_landing_markup();\n}\n?>"
  ],
  [
    "<link rel=\"stylesheet\" href=\"<?php echo $asset('alternate.css'); ?>\">",
    "<link rel=\"stylesheet\" href=\"<?php echo $asset('alternate.css'); ?>\">\n<?php if ($coachingMarkup !== ''): ?><link rel=\"stylesheet\" href=\"<?php echo $asset('CoachingLandingSection.css'); ?>\"><?php endif; ?>"
  ],
  [
    "<h3>Emergency Private Interview Intensive · $3,999</h3><p>For a real interview seven days or less away. Four total private hours with Dr Brian, including three Signature Mocks, evaluation, debrief and action plan. Excludes Bootcamp, Complete, the season-long pathway and the Match Guarantee. If you still have time to train properly, we recommend Complete instead.</p><p><a href=\"/contact/?inquiry=emergency-interview-prep\">Request Emergency Prep →</a></p>",
    "<h3>Emergency Interview Intensive · $3,999 standard tuition</h3><p>Request first. One 480-minute (8-hour) private training day with Dr Brian, including one Signature Mock; two additional 105-minute follow-up mocks; and one 45-minute post-interview debrief. 735 total live minutes. Staff must confirm an actual eight-hour date before a booking or payment invitation. A request does not reserve a date. Excludes Bootcamp, Complete, the season-long pathway and the Match Guarantee.</p><p>Use the contact form subject “Emergency Interview Intensive request”. Include preferred dates, your upcoming interview date, timezone and contact information in Message. Provide scheduling details only; do not include application documents, bank details or health information. No payment is taken with a request.</p><p><a href=\"/contact/#form_contact-form\">Request an intensive date →</a></p>"
  ],
  [
    "</main>",
    "<?php echo $coachingMarkup; ?>\n</main>"
  ]
];
let expected=source;
for(const [before,after]of edits){assert.equal(expected.split(before).length,2);expected=expected.replace(before,after);}
const dir=path.join(root,'wp-content/mu-plugins/missionmed-mr-alternate-assets');
const page=fs.readFileSync(path.join(dir,'page.php'),'utf8');
assert.equal(page,expected,'all outside page bytes preserved, including hero and other offers');
assert.equal(hash(fs.readFileSync(path.join(dir,'alternate.css'))),'d8ab47c3b716627a14cc04724c9d62f9030ee2ccaa92323f600786fd9fb3cd36','actual production CSS byte-preserved');
assert.ok(!page.includes('Four total private hours')&&!page.includes('including three Signature Mocks'));
for(const name of ['page.php','CoachingLandingIntegration.php']){
 const r=spawnSync('php',['-l',path.join(dir,name)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr+r.stdout);
}
const css=fs.readFileSync(path.join(dir,'CoachingLandingSection.css'),'utf8');
assert.ok(!css.includes('body{')&&!css.includes('html{')&&!css.includes('#hero'));
console.log('PASS static landing preservation: exact live page/CSS hashes; four authorized edits only; PHP lint; scoped additive CSS.');

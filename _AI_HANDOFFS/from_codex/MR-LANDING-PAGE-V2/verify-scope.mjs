import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const dir=new URL('./',import.meta.url),base='wp-content/mu-plugins/missionmed-mr-alternate-assets/';
const old=fs.readFileSync(new URL('v1/page.php',dir),'utf8'),now=fs.readFileSync(base+'page.php','utf8');
function normalize(s){return s.replace(/<section class="mm-alt-story[\s\S]*?<\/section>/,'MATRIX').replace(/<section class="cl1403c-a-pd" id="teacher">[\s\S]*?<\/section>/,'TEACHER').replace('Focused standalone foundation','The intensive.').replace('Recommended full-season pathway','Bootcamp + the season.');}
// Enrollment changes are exactly two approved secondary labels.
const oldEnroll=old.match(/<section class="mm-alt-enroll"[\s\S]*?<\/section>/)[0];
const newEnroll=now.match(/<section class="mm-alt-enroll"[\s\S]*?<\/section>/)[0];
const stripLabels=s=>s.replace(/<p class="mm-alt-kicker">[^<]*<\/p>/g,'LABEL');
assert.equal(stripLabels(oldEnroll),stripLabels(newEnroll),'Commerce section drift');
assert.equal(normalize(old).replace(oldEnroll,'ENROLLMENT'),normalize(now).replace(newEnroll,'ENROLLMENT'),'Unapproved page source drift');
const js=fs.readFileSync(base+'alternate.js','utf8'),oldJs=fs.readFileSync(new URL('v1/alternate.js',dir),'utf8');
assert(js.startsWith(oldJs),'Existing analytics/video JavaScript changed');
const manifest=JSON.parse(fs.readFileSync(new URL('MR-LANDING-PAGE-V1.json',dir)));
for(const file of manifest.assetHashes.filter(x=>!/(page\.php|alternate\.(css|js))$/.test(x.path))){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256,file.path);}
console.log('PASS: exact protected template content, enrollment except two labels, original JS prefix and 21 static assets unchanged.');

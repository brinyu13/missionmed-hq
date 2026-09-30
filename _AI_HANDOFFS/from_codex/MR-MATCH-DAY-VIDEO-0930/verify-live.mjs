import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const origin='https://missionmedinstitute.com';
const base='wp-content/mu-plugins/missionmed-mr-alternate-assets';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const response=await fetch(origin+'/missionresidency/');
const html=await response.text();
assert.equal(response.status,200);assert(html.includes('data-match-day-source="https://customer-wiw9vmb43wmdkdp7.cloudflarestream.com/4ddaf43647395dcc1ca0cda6f17b7ee6/manifest/video.m3u8"'));
assert(!html.includes('<video'));assert(html.includes('Watch the moment it became real'));
const assets={};
for(const file of ['alternate.css','alternate.js','vendor/hls-1.7.3.min.js']){
 const bytes=fs.readFileSync(`${base}/${file}`),sha=hash(bytes);
 const r=await fetch(`${origin}/${base}/${file}?v=${sha.slice(0,12)}`),body=Buffer.from(await r.arrayBuffer());
 assets[file]={status:r.status,sha256:hash(body),matchesSource:hash(body)===sha};assert.equal(r.status,200);assert.equal(hash(body),sha);
}
const utm='?utm_source=facebook&utm_medium=paid_social&utm_campaign=match-day-live';
const legacy=await fetch(origin+'/mission-residency/'+utm,{redirect:'manual'});
assert.equal(legacy.status,301);assert.equal(legacy.headers.get('location'),origin+'/missionresidency/'+utm);
const products={};
for(const p of ['/product/iv-prep-masterclass/','/product/match-prep-pro/']){const r=await fetch(origin+p);products[p]={status:r.status,finalUrl:r.url};assert.equal(r.status,200);}
const expected=['$549','$499','$3,099','$3,499','$3,400','October 8','October 18','October 7','February'];
const pricesAndDates=Object.fromEntries(expected.map(x=>[x,html.includes(x)]));assert(Object.values(pricesAndDates).every(Boolean));
const prior=execFileSync('git',['show','b6490e47f2593504a57432b3f48ab2a9617bc2ca:'+base+'/page.php'],{encoding:'utf8'});
const current=fs.readFileSync(base+'/page.php','utf8');
assert.equal(current.replace("<?php require __DIR__ . '/match-day-player.php'; ?>",''),prior);
const receipt={at:new Date().toISOString(),anonymousCookieFree:true,status:response.status,htmlSha256:hash(html),videoElementInitiallyAbsent:true,playControlPresent:true,assets,legacy:{status:legacy.status,location:legacy.headers.get('location')},products,pricesAndDates,allOtherTemplateBytesIdentical:true};
fs.writeFileSync(new URL('./qa/live-http.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));

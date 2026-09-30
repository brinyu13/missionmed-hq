import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const here=new URL('./',import.meta.url),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const v1=JSON.parse(fs.readFileSync(new URL('MR-LANDING-PAGE-V1.json',here))),deploy=JSON.parse(fs.readFileSync(new URL('qa/deployment.json',here)));
const base='wp-content/mu-plugins/missionmed-mr-alternate-assets';
const read=cmd=>execFileSync('ssh',['missionmed-kinsta',`cd /www/theresidencyacademy_209/public && ${cmd}`],{encoding:'utf8',timeout:25000});
const hashes=read(`find ${base} -type f -print0 | sort -z | xargs -0 sha256sum`).trim().split('\n').map(l=>({path:l.slice(66),sha256:l.slice(0,64)}));
for(const f of hashes){const local=sha(fs.readFileSync(f.path));assert.equal(local,f.sha256,f.path);}
const protectedNow=read(`sha256sum wp-content/mu-plugins/missionmed-mr*.php ${base}/match-day-player.php ${base}/match-day-media.json`);
assert.equal(protectedNow,v1.protectedFiles,'Protected runtime drift');
const r=await fetch('https://missionmedinstitute.com/missionresidency/');assert.equal(r.status,200);const html=await r.text();
assert(html.includes('mm-ecosystem-products')&&html.includes('Bootcamp + the season.'));
function norm(s){return s.replace(/<section class="mm-alt-story[\s\S]*?<\/section>/,'STORY').replace(/<section class="cl1403c-a-pd" id="teacher">[\s\S]*?<\/section>/,'TEACHER').replace(/(<section class="mm-alt-enroll"[\s\S]*?<\/section>)/,e=>e.replace(/<p class="mm-alt-kicker">[^<]*<\/p>/g,'LABEL')).replace(/alternate\.(css|js)\?v=[a-f0-9]+/g,'alternate.$1?v=HASH');}
assert.equal(norm(html),norm(fs.readFileSync(new URL('v1/public.html',here),'utf8')),'Unexpected anonymous HTML drift');
const assets=[];for(const f of ['alternate.css','alternate.js']){const h=deploy.deployed[f];const a=await fetch(`https://missionmedinstitute.com/${base}/${f}?v=${h.slice(0,12)}`);assert.equal(a.status,200);const b=Buffer.from(await a.arrayBuffer());assert.equal(sha(b),h);assets.push({file:f,status:a.status,sha256:h,bytes:b.length});}
const legacy=await fetch('https://missionmedinstitute.com/mission-residency/?utm_source=facebook&utm_campaign=v2-qa',{redirect:'manual'});assert.equal(legacy.status,301);assert.equal(legacy.headers.get('location'),'https://missionmedinstitute.com/missionresidency/?utm_source=facebook&utm_campaign=v2-qa');
const manifest={version:'MR-LANDING-PAGE-V2',label:'MISSION RESIDENCY LANDING PAGE - V2',sourceSha:deploy.source,deploymentIdentity:'mr-landing-page-v2-20260930',deployedAt:deploy.at,verifiedAt:new Date().toISOString(),privateCustody:deploy.custody+'/MR-LANDING-PAGE-V2',sharedAssetCustody:v1.privateCustody+'/presentation.tar.gz',restoreFiles:deploy.files,assetHashes:hashes,protectedFiles:protectedNow,public:{url:r.url,status:r.status,sha256:sha(html),headers:Object.fromEntries([...r.headers].filter(([k])=>/cache|etag|last-modified|content-type/.test(k)))},assets,legacy:{status:legacy.status,location:legacy.headers.get('location')},runtime:v1.runtime,unchangedPublicHtmlOutsideAllowedScope:true,screenshots:['qa/v2-1440.png','qa/v2-390.png','qa/v2-human-proof.png'],measurements:'qa/live-layout.json',rollbackVersion:'MR-LANDING-PAGE-V1',rollbackProcedure:'RESTORE.md'};
fs.writeFileSync(new URL('MR-LANDING-PAGE-V2.json',here),JSON.stringify(manifest,null,2));
fs.writeFileSync(new URL('qa/v2-public.html',here),html);
console.log(JSON.stringify({verified:manifest.version,assets:hashes.length,protectedUnchanged:true,outsideScopeUnchanged:true,legacy:manifest.legacy,source:deploy.source}));

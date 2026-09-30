// Read-only unless --apply AND a current external exact-path heartbeat lease are supplied.
import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const version=process.argv[2];assert(['V1','V2'].includes(version),'Use V1 or V2');
const here=new URL('./',import.meta.url),target=JSON.parse(fs.readFileSync(new URL(`MR-LANDING-PAGE-${version}.json`,here)));
const versions=['V1','V2'].map(v=>JSON.parse(fs.readFileSync(new URL(`MR-LANDING-PAGE-${v}.json`,here))));
const base='/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-alternate-assets';
const q=s=>`'${s.replaceAll("'","'\\''")}'`,ssh=cmd=>execFileSync('ssh',['missionmed-kinsta',`set -eu; ${cmd}`],{encoding:'utf8',timeout:25000});
const expected=f=>target.assetHashes.find(x=>x.path.endsWith('/'+f)).sha256;
const files=['alternate.css','alternate.js','page.php'];
const current=ssh('sha256sum '+files.map(f=>q(base+'/'+f)).join(' ')).trim().split('\n').map(l=>l.slice(0,64));
assert(versions.some(v=>files.every((f,i)=>v.assetHashes.find(x=>x.path.endsWith('/'+f)).sha256===current[i])),'Current runtime is not an exact named V1/V2 release. Reconcile newer changes before restoring.');
const checks=files.map(f=>`test "$(sha256sum ${q(target.privateCustody+'/'+f)} | cut -d' ' -f1)" = '${expected(f)}'`).join('; ');
ssh(checks);console.log(`${target.version}: private preimages verified; current runtime is an exact named version.`);
if(!process.argv.includes('--apply')){console.log('CHECK ONLY: nothing changed.');process.exit(0);}
assert.equal(process.env.MR_PRESENTATION_RESTORE_LEASE_ACTIVE,'1','Acquire and heartbeat the exact three-file lease first');
const custody='/www/theresidencyacademy_209/private/mr-landing-page-versions-20260930/restore-preimage-'+new Date().toISOString().replace(/[:.]/g,'-');
const guard=files.map((f,i)=>`test "$(sha256sum ${q(base+'/'+f)} | cut -d' ' -f1)" = '${current[i]}'`).join('; ');
const install=files.map(f=>`install -m 644 ${q(target.privateCustody+'/'+f)} ${q(base+'/'+f+'.restore-next')}; mv ${q(base+'/'+f+'.restore-next')} ${q(base+'/'+f)}`).join('; ');
console.log(ssh(`${guard}; ${checks}; umask 077; mkdir ${q(custody)}; cp -p ${files.map(f=>q(base+'/'+f)).join(' ')} ${q(custody+'/')}; php -l ${q(target.privateCustody+'/page.php')}; ${install}; sha256sum ${files.map(f=>q(base+'/'+f)).join(' ')}`));
console.log('Restore complete. Purge cache and verify anonymous production, protected hashes and the target screenshots before releasing the lease.');

import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');const out={at:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD']).toString().trim(),preservation:{},runtime:[],navigation:{}};
for(const kind of ['primary','mu']){
 const manifest=fs.readFileSync('_AI_HANDOFFS/from_codex/MR-USCE-ALTERNATE-0930/donor/mr-alt-'+kind+'-before.sha256','utf8').split('\n').filter(l=>l.trim()&&!l.includes('missionmed-mr-alternate.php')&&!l.includes('premium-hero/hero.js')&&!l.includes('assets/js/mr-0912.js')).join('\n')+'\n';
 const result=execFileSync('ssh',['missionmed-kinsta','cd /www/theresidencyacademy_209/public && sha256sum -c -'],{input:manifest}).toString().trim().split('\n');out.preservation[kind]={count:result.length,allUnchanged:result.every(x=>x.endsWith(': OK'))};
}
for(const f of ['missionmed-mr-alternate.php','missionmed-mr-alternate-assets/page.php','missionmed-mr-alternate-assets/alternate.css','missionmed-mr-primary-routing.php','missionmed-mr-0912-assets/premium-hero/hero.js','missionmed-mr-0912-assets/js/mr-0912.js']){
 const path='wp-content/mu-plugins/'+f,local=sha(fs.readFileSync(path)),remote=execFileSync('ssh',['missionmed-kinsta','cd /www/theresidencyacademy_209/public && sha256sum '+path]).toString().split(' ')[0];out.runtime.push({path,sha256:local,matches:local===remote});
}
for(const file of ['premium-hero/hero.js','js/mr-0912.js']){
 const path='wp-content/mu-plugins/missionmed-mr-0912-assets/'+file,old=execFileSync('git',['show','8416e7c:'+path]).toString(),now=fs.readFileSync(path,'utf8');out.preservation[file]={onlyCanonicalLinkChanges:old.replaceAll('/mission-residency/','/missionresidency/')===now};
}
const browser=await chromium.launch();const p=await browser.newPage({viewport:{width:390,height:844}});await p.goto('https://missionmedinstitute.com/missionresidency/',{waitUntil:'networkidle'});
const menu=p.locator('.mm-alt-menu summary');await menu.focus();await p.keyboard.press('Enter');out.navigation.keyboardOpen=await p.locator('.mm-alt-menu').getAttribute('open')!==null;await p.keyboard.press('Escape');out.navigation.escapeCloses=await p.locator('.mm-alt-menu').getAttribute('open')===null;out.navigation.focusReturns=await menu.evaluate(e=>e===document.activeElement);
out.navigation.targets=await p.locator('a[data-offer],.mm-alt-menu summary,.mm-alt-cart,.mm-alt-actions a').evaluateAll(es=>es.map(e=>({text:e.innerText.trim(),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(x=>x.w));out.navigation.primaryTouchTargets=out.navigation.targets.every(x=>x.w>=44&&x.h>=44);
out.typography=await p.evaluate(()=>Object.fromEntries(['.cl1403c-a-hero-sub','.mm-alt-kicker','.cl1403c-a-stat-lbl','.cl1403c-a-step time','.mm-alt-alumnus p','.mm-alt-payment','.cl1403c-footer-legal'].map(s=>[s,getComputedStyle(document.querySelector(s)).fontSize])));
await browser.close();fs.writeFileSync(new URL('./qa/preservation.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));

import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=new URL('./',import.meta.url);const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const remote=cmd=>execFileSync('ssh',['missionmed-kinsta','cd /www/theresidencyacademy_209/public && '+cmd],{maxBuffer:8e6});
const evidence={checked_at:new Date().toISOString(),source:'c57cd227bab6f59acecef628f129e79920d9cc1a',preservation:{},assets:[],routes:[],navigation:[],analytics:[]};
for(const name of ['primary','mu']){
 const manifest=fs.readFileSync(new URL('donor/mr-alt-'+name+'-before.sha256',dir));
 const out=execFileSync('ssh',['missionmed-kinsta','cd /www/theresidencyacademy_209/public && sha256sum -c -'],{input:manifest,maxBuffer:8e6}).toString();
 evidence.preservation[name]={count:out.trim().split('\n').length,allPass:out.trim().split('\n').every(s=>s.endsWith(': OK'))};
}
const old=fs.readFileSync('/tmp/mr-alt-primary-before.html');const primary=await fetch('https://missionmedinstitute.com/mission-residency/');const html=await primary.text();
evidence.preservation.primary_html={before:hash(old),after:hash(html),identical:hash(old)===hash(html)};
const config=remote("wp eval 'echo wp_json_encode(mm_mr_p0_runtime_config());'");
const oldConfig=fs.readFileSync(new URL('donor/mr-alt-commerce.json',dir));
evidence.preservation.commerce={before:hash(oldConfig),after:hash(config),identical:hash(oldConfig)===hash(config)};
const usce=remote('wp post meta get 5656 _elementor_data');const oldUsce=fs.readFileSync(new URL('donor/mr-alt-usce-elementor.json',dir));
evidence.preservation.usce={before:hash(oldUsce),after:hash(usce),identical:hash(oldUsce)===hash(usce)};
for(const name of ['alternate.js','alternate.css','usce-donor.css','usce-shell.css']){
 const r=await fetch('https://missionmedinstitute.com/wp-content/mu-plugins/missionmed-mr-alternate-assets/'+name);const live=Buffer.from(await r.arrayBuffer());const local=fs.readFileSync('wp-content/mu-plugins/missionmed-mr-alternate-assets/'+name);evidence.assets.push({name,status:r.status,sha256:hash(live),sourceMatches:hash(local)===hash(live)});
}
for(const route of ['/missionresidency/','/missionresidency','/mission-residency/','/usce/']){const r=await fetch('https://missionmedinstitute.com'+route,{redirect:'manual'});evidence.routes.push({route,status:r.status,location:r.headers.get('location'),robots:r.headers.get('x-robots-tag')});}
const sitemap=await(await fetch('https://missionmedinstitute.com/page-sitemap.xml')).text();evidence.sitemap={alternatePresent:sitemap.includes('https://missionmedinstitute.com/missionresidency/'),primaryPresent:sitemap.includes('https://missionmedinstitute.com/mission-residency/')};
const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});await p.goto('https://missionmedinstitute.com/missionresidency/',{waitUntil:'networkidle'});
const summary=p.locator('.mm-alt-menu summary');await summary.focus();await p.keyboard.press('Enter');const opened=await p.locator('.mm-alt-menu').getAttribute('open')!==null;const nav=await p.locator('.mm-alt-menu a').evaluateAll(es=>es.map(a=>({text:a.innerText,href:a.href})));await p.keyboard.press('Escape');evidence.navigation={menuKeyboardOpen:opened,escapeCloses:await p.locator('.mm-alt-menu').getAttribute('open')===null,focusReturned:await summary.evaluate(e=>e===document.activeElement),links:nav,targets:await p.locator('a[data-offer],.mm-alt-menu summary,.mm-alt-cart').evaluateAll(es=>es.map(e=>({text:e.innerText.trim(),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})).filter(e=>e.width))};await b.close();
// Isolate each analytics observation from other checkout contexts. Preserve only event/path evidence.
for(const offer of ['interview_week','complete']){const browser=await chromium.launch();const page=await browser.newPage();const events=[];page.on('request',r=>{if(r.url().includes('google-analytics.com')&&r.url().includes('collect')){const u=new URL(r.url());events.push({event:u.searchParams.get('en'),measurement_id:u.searchParams.get('tid'),page_location:u.searchParams.get('dl')});}});await page.goto('https://missionmedinstitute.com/missionresidency/?utm_source=facebook&utm_medium=paid_social&utm_campaign=alternate_qa',{waitUntil:'networkidle'});await page.waitForTimeout(1500);await Promise.all([page.waitForURL(/\/product\//),page.locator('a[data-offer="'+offer+'"]').last().click()]);await page.waitForTimeout(1500);evidence.analytics.push({offer,destination:page.url(),events});await browser.close();}
fs.writeFileSync(new URL('qa/final-readback.json',dir),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));

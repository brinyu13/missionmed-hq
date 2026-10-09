#!/usr/bin/env node
'use strict';
// Approved UI -> packaged immutable UI. Synthetic local harness, never real accounts.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_PRODUCTION');
const approved=path.join(root,'_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_REFINEMENT/screenshots');
const py='/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const checks=[];const observations=[];const errors=[];
function lease(){let s=JSON.parse(fs.readFileSync('/tmp/filevault-production-lease-status.json'));if(s.state!=='healthy'||Date.now()/1000-s.at_unix>15)throw Error('Lease unavailable');}
function check(pass,message){checks.push({pass:!!pass,message});if(!pass)console.error('FAIL '+message);}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{lease();fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--disable-gpu'],executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
 for(const width of [1440,1280,1024,768,390]){
  const p=await browser.newPage({viewport:{width,height:width===390?844:850},deviceScaleFactor:1,reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
  for(const [ext,digest] of [['js','44c578a67d945dfe'],['css','5009c86f47c85fa1']])await p.route('**/student-os-file-vault-v2.'+ext+'*',async route=>{const target=route.request().url().replace('student-os-file-vault-v2.'+ext,'student-os-file-vault-v2.'+digest+'.'+ext);const response=await route.fetch({url:target});await route.fulfill({response});});
  await p.goto('http://127.0.0.1:8782/tests/fixtures/file-vault-v2-harness.html?visual=1');await p.waitForSelector('html[data-harness-ready="true"]');await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await p.waitForLoadState('networkidle');await p.mouse.move(0,0);
  check(await p.locator('.fv2-category-card').count()===8,width+' eight category cards in immutable package');
  const layout=await p.locator('.fv2-category-copy strong').evaluateAll(els=>els.map(e=>({size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight,overflow:e.scrollWidth>e.clientWidth+1})));
  check(layout.every(e=>+e.weight>=800&&!e.overflow),width+' heavy titles fit');
  lease();const current=path.join(out,'screenshots/local-'+width+'.png');await p.screenshot({path:current,animations:'disabled'});
  const diff=JSON.parse(execFileSync(py,['-c',String.raw`
from PIL import Image,ImageChops
import sys,json
x=ImageChops.difference(Image.open(sys.argv[1]).convert('RGB'),Image.open(sys.argv[2]).convert('RGB'))
hist=[0]*256
for rgb in x.get_flattened_data():hist[max(rgb)]+=1
print(json.dumps({'changed':sum(hist[1:]),'overOneLevel':sum(hist[2:]),'maxChannelDifference':max(i for i,n in enumerate(hist) if n)}))
`,path.join(approved,'after-'+width+'.png'),current]).toString());observations.push({width,...diff});check(diff.overOneLevel<width*(width===390?844:850)*.0001,width+' immutable screenshot matches Founder-approved capture '+JSON.stringify(diff));
  await p.close();
 }
 check(errors.length===0,'no browser errors');
 const results={approvedHead:'31b61d4365948abfbadee7cb1393af4adf9db9e1',scope:'Local immutable package visual equality; no production role claim',checks,observations,errors};lease();fs.writeFileSync(path.join(out,'local-visual-results.json'),JSON.stringify(results,null,2)+'\n');
 console.log(checks.filter(c=>c.pass).length+' PASS / '+checks.filter(c=>!c.pass).length+' FAIL');if(checks.some(c=>!c.pass))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

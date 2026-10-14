'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const base='http://127.0.0.1:8782/tests/fixtures/file-vault-v2-harness.html';
const target='https://missionmedinstitute.com/member-dashboard/#dashboard';
const out=path.resolve('_AI_HANDOFFS/from_codex/MX_GX_20261013_001_FILEVAULT_RETURN');
const records=[];
function check(value,label){assert(value,label);records.push(label);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 async function pageFor(width=1280,role='student',baseline=false){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
  await page.route('https://missionmedinstitute.com/member-dashboard/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Local navigation target fixture</h1>'}));
  if(baseline) for(const ext of ['js','css']) await page.route('**/student-os-file-vault-v2.'+ext,r=>r.fulfill({contentType:ext==='js'?'application/javascript':'text/css',body:cp.execFileSync('git',['show','5fb301a224ad44483b029789fb31017cd227300c:wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.'+ext])}));
  await page.goto(base+'?visual=1&role='+role);await page.waitForSelector('html[data-harness-ready="true"]');
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));});return page;
 }
 for(const width of [1280,768,390]){
  const before=await pageFor(width,'student',true);await before.screenshot({path:path.join(out,`before-${width}.png`)});await before.close();
  const page=await pageFor(width);const link=page.locator('.fv2-matrix-return');
  check(await link.count()===1&&await link.isVisible(),`${width}: one visible header return`);
  check(await page.locator('.fv2-rail-matrix').count()===0,`${width}: no duplicate rail return`);
  check(await link.getAttribute('href')===target,`${width}: exact canonical destination`);
  const g=await link.evaluate(a=>{const r=a.getBoundingClientRect(),s=a.querySelector('span').getBoundingClientRect();return {h:r.height,right:r.right,w:innerWidth,label:s.width>0&&s.left>=r.left&&s.right<=r.right&&a.textContent.trim()==='Return to Matrix',hit:a.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),overflow:document.documentElement.scrollWidth>innerWidth};});
  check(g.h>=44&&g.right<=g.w&&g.label&&g.hit&&!g.overflow,`${width}: label,44px,hit target,no overflow`);
  await link.focus();check(await link.evaluate(a=>a===document.activeElement&&getComputedStyle(a).outlineStyle!=='none'),`${width}: keyboard focus visible`);
  await page.screenshot({path:path.join(out,`after-${width}.png`)});
  let cleanup;await page.exposeFunction('recordCleanup',x=>cleanup=x);
  await page.evaluate(()=>{const i=__FV2_HARNESS__.instance,original=i.unmount;i.unmount=function(){original.call(this);window.recordCleanup({destroyed:this.destroyed,listeners:this.listeners.length,mutations:__FV2_HARNESS__.mutations.length});};});
  await link.press('Enter');await page.waitForURL(target);
  check(cleanup&&cleanup.destroyed&&cleanup.listeners===0&&cleanup.mutations===0,`${width}: keyboard navigation with cleanup and no writes`);await page.close();
 }
 const page=await pageFor();
 // Local-only synthetic edge cases exercise the root capture guard, including modal-inert defenses.
 const cases=await page.evaluate(async()=>{
  const i=__FV2_HARNESS__.instance,root=i.root,link=root.querySelector('.fv2-matrix-return');const checks=[];
  const test=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  let confirms=0,aborts=0,bubbled=0;
  window.confirm=()=>{confirms++;return false;};
  const abort=i.abortUpload;i.abortUpload=function(...args){aborts++;return abort.apply(this,args);};
  document.addEventListener('click',()=>{bubbled++;});
  function click(extra={}){return link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,...extra}));}
  for(const phase of ['hashing','signing','transferring','confirming']){
   i.openUpload({file:new File(['synthetic'],'nav-check.txt',{type:'text/plain'})});i.state.upload.phase=phase;
   const file=i.state.upload.file;click();test(i.state.upload.file===file&&!i.destroyed&&aborts===0&&confirms===0,phase+': blocked without abort/confirm');
   i.state.upload.phase='idle';i.closeOverlay();aborts=0;
  }
  for(const method of ['POST','PUT','PATCH','DELETE']){
   const api=i.injectedApi;let resolve,signal;i.injectedApi=req=>{signal=req.signal;return new Promise(r=>resolve=r);};
   const pending=i.request(method,'/local-only');click();test(i.pendingWrites===1&&!signal.aborted&&!i.destroyed&&confirms===0,method+': pending write blocks');
   resolve({});await pending;i.injectedApi=api;test(i.pendingWrites===0,method+': counter settles');
  }
  i.state.busy.test=true;click();test(!i.destroyed&&confirms===0,'busy save blocks');delete i.state.busy.test;
  test(bubbled===0,'return capture stops competing document handler');
  for(const kind of ['comment','internal-note']){
   const form=document.createElement('form');form.dataset.fv2Form=kind;const field=document.createElement('textarea');form.append(field);root.append(form);field.value='Unsaved synthetic note';
   const count=confirms;click();test(confirms===count+1&&field.value==='Unsaved synthetic note'&&!i.destroyed,kind+': cancel preserves exact text');form.remove();
  }
  i.openUpload({documentType:'other'});const input=i.refs.overlay.querySelector('[data-fv2-upload-name]');input.value='Synthetic draft';input.dispatchEvent(new Event('input',{bubbles:true}));
  i.renderOverlay();const draft=i.state.upload;const snapshot=JSON.stringify(draft);const count=confirms;click();test(confirms===count+1&&JSON.stringify(i.state.upload)===snapshot&&i.state.upload===draft,'upload dirty survives redraw and cancel');
  const before=aborts;i.closeOverlay();test(aborts===before+1,'existing explicit modal close cleanup retained');
  i.initializeReviewDrafts({review_note:'existing note'});test(!i.hasUnsavedWork(),'existing review values start clean');
  i.state.reviewNote='unsaved review';i.render();test(i.hasUnsavedWork(),'review dirty survives render');i.reviewBaseline=i.reviewDraftSnapshot();
  i.state.scoreNotes='unsaved score';i.render();test(i.hasUnsavedWork(),'score dirty survives render');i.scoreBaseline=i.scoreDraftSnapshot();
  // Suppress only default navigation in this fixture, preserving whether the app intercepted modifiers.
  for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}]){
   let reached=false;link.addEventListener('click',e=>{reached=true;e.preventDefault();},{once:true});click(extra);test(reached&&!i.destroyed,'modified click keeps native anchor handling '+Object.keys(extra)[0]);
  }
  const other=document.createElement('a');other.href='#unrelated';root.append(other);let reached=false;other.addEventListener('click',e=>{reached=true;e.preventDefault();});other.click();test(reached,'unrelated anchor unaffected');other.remove();
  i.openUpload({file:new File(['synthetic'],'nav-check.txt',{type:'text/plain'})});const unload=new Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);test(unload.defaultPrevented,'reload protection while draft exists');
  return checks;
 });records.push(...cases);
 let cleanup;await page.exposeFunction('recordConfirmedCleanup',x=>cleanup=x);
 await page.evaluate(()=>{const i=__FV2_HARNESS__.instance;i.openUpload({file:new File(['synthetic'],'nav-check.txt',{type:'text/plain'})});window.confirm=()=>true;const old=i.unmount;i.unmount=function(){old.call(this);const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);window.recordConfirmedCleanup({destroyed:this.destroyed,uploadPhase:this.state.upload.phase,listeners:this.listeners.length,unload:e.defaultPrevented,mutations:__FV2_HARNESS__.mutations.length});};document.querySelector('.fv2-matrix-return').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));});
 await page.waitForURL(target);check(cleanup.destroyed&&cleanup.uploadPhase==='aborted'&&cleanup.listeners===0&&!cleanup.unload&&cleanup.mutations===0,'confirmed staged-file leave cleans transient state only');await page.close();
 const admin=await pageFor(1280,'admin');
 const saves=await admin.evaluate(async()=>{
  const i=__FV2_HARNESS__.instance;await i.loadStudent(101,{view:'files'});const d=i.state.data.documents.find(d=>i.rubricForDocument(d).length);if(!d)throw new Error('Missing rubric fixture');i.state.selectedDocumentId=d.id;i.initializeReviewDrafts(d);
  i.state.reviewNote='Synthetic saved review';i.saveReviewStatus();while(i.state.busy.review)await new Promise(r=>setTimeout(r,10));if(i.reviewBaseline!==i.reviewDraftSnapshot())throw new Error('Review save still dirty');
  i.state.scoreNotes='Synthetic saved score';i.saveScore();while(i.state.busy.score)await new Promise(r=>setTimeout(r,10));if(i.scoreBaseline!==i.scoreDraftSnapshot())throw new Error('Score save still dirty');return __FV2_HARNESS__.mutations.map(m=>m.type);
 });check(saves.includes('status')&&saves.includes('score'),'successful review/score saves reset corresponding dirty baseline');await admin.close();
 await browser.close();fs.writeFileSync(path.join(out,'return-tests.json'),JSON.stringify({result:'PASS',count:records.length,checks:records},null,2)+'\n');console.log(`PASS ${records.length} Return contracts`);
})().catch(e=>{console.error(e);process.exit(1);});

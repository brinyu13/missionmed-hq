#!/usr/bin/env node
'use strict';
// Actual V2 implementation; all data and PDF content here are synthetic local fixtures.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_PIXEL_FIDELITY');
const shots = path.join(out, 'screenshots');
const base = process.env.FV2_BASE_URL || 'http://127.0.0.1:8782/tests/fixtures/file-vault-v2-harness.html';
const results = []; const errors = [];
function check(condition, message) {results.push({pass:!!condition,message}); if (!condition) console.error('FAIL:',message);}
async function capture(page,name) {await page.screenshot({path:path.join(shots,name+'.png'),animations:'disabled'});}
async function settled(page) {await page.waitForSelector('html[data-harness-ready="true"]');await page.locator('.fv2-stage h1').first().waitFor();await page.evaluate(()=>Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode().catch(()=>{}))));}
async function overflow(page,label) {
 const bad=await page.evaluate(()=>[...document.querySelectorAll('.fv2-stage,.fv2-rail,.fv2-overlay-panel,.fv2-document-grid .fv2-row-copy')].filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+2).map(n=>({class:n.className,scroll:n.scrollWidth,width:n.clientWidth})));
 check(bad.length===0,label+' no horizontal overflow '+JSON.stringify(bad));
}
async function nav(page,view){if(view==="upload"){if(await page.locator(".fv2-rail-upload").isVisible()){await page.locator(".fv2-rail-upload").click();}else{await nav(page,"vault");await page.getByRole("button",{name:"Upload a File",exact:true}).click();}return;}const button=page.locator('.fv2-nav-item[data-fv2-view="'+view+'"]');if(!await button.isVisible()){await page.locator('[data-fv2-action="toggle-mobile-nav"]').click();await page.locator('.fv2-mobile-nav-option[data-fv2-view="'+view+'"]').click();}else await button.click();}
(async()=>{
 fs.mkdirSync(shots,{recursive:true});
 const browser=await chromium.launch({headless:process.env.FV2_HEADLESS==='1',executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try {
  for(const width of [1440,1280,1024,768,390]) {
   const page=await browser.newPage({viewport:{width,height:width===390?844:850},reducedMotion:'reduce'});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'?visual=1'); await settled(page);
   check(await page.locator('.fv2-category-card').count()===8,width+' eight photographic category destinations');
   check(await page.locator('.fv2-cinema-hero h1').innerText()==='Your Documents.\nYour Journey.\nA Brighter Tomorrow.',width+' exact approved headline');
   await overflow(page,'home '+width); await capture(page,'home-'+width);
   const active=await page.locator('.fv2-nav-item.is-active').evaluate(e=>({shadow:getComputedStyle(e).boxShadow,clip:getComputedStyle(e).clipPath}));
   check(active.shadow!=='none'&&active.clip==='none',width+' illuminated rail');
   check(await page.locator('.fv2-atmosphere i').first().evaluate(e=>getComputedStyle(e).animationName)==='none',width+' OS reduced motion respected');
   await page.locator('.fv2-category-card').nth(0).click();
   check(await page.locator('[data-fv2-file-type]').inputValue()==='personal_statement',width+' statement category opens real type filter');
   await overflow(page,'files '+width);
   if(width>760){await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1101"]').click();await page.locator('.fv2-detail-panel').waitFor();await overflow(page,'selected-file grid '+width);await page.getByRole('button',{name:'Close document details',exact:true}).click();}
   if(width===390){
    await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1101"]').click();await page.getByRole('button',{name:'Quick Look',exact:true}).click();await page.locator('.fv2-preview-frame').waitFor();await overflow(page,'mobile preview');await page.keyboard.press('Escape');
    for(const view of ['upload','library','shared','activity']){await nav(page,view);await overflow(page,'mobile '+view);}
    await page.locator('[data-fv2-action="toggle-mobile-nav"]').click();await page.locator('.fv2-mobile-nav-option[data-fv2-action="open-settings"]').click();await overflow(page,'mobile settings');await page.keyboard.press('Escape');
   }
   if(width===1440){
    await nav(page,'vault'); await page.locator('.fv2-category-card').nth(5).click();
    check(await page.locator('[data-fv2-file-search]').inputValue()==='research','research category searches existing metadata');
    await nav(page,'vault'); await nav(page,'files');
    await page.locator('[data-fv2-file-type]').selectOption('');await page.locator('[data-fv2-file-search]').fill('');await page.locator('.fv2-document-grid').waitFor();
    check(await page.locator('.fv2-document-grid').isVisible(),'My Files defaults to photographic grid');
    await capture(page,'files');
    await page.locator('[data-fv2-action="file-layout"][data-fv2-layout="list"]').click();
    check(await page.locator('.fv2-document-list:not(.fv2-document-grid)').isVisible(),'list toggle works');
    await page.locator('[data-fv2-action="file-layout"][data-fv2-layout="grid"]').click();
    await page.locator('[data-fv2-action="select-document"][data-fv2-document-id="1102"]').click();
    await page.locator('[data-fv2-action="quicklook-document"][data-fv2-document-id="1102"]').click();
    await page.locator('.fv2-preview-frame').waitFor();
    check(await page.locator('.fv2-preview-frame').getAttribute('src')===new URL('file-vault-preview.pdf',base).href,'visual fixture loads real local synthetic PDF');
    check(await page.locator('.fv2-preview-meta').getByRole('heading',{name:'Version History',exact:true}).isVisible(),'preview contains version history');
    await page.waitForTimeout(1500); // Native browser PDF plug-in paints after the iframe load event.
    check(page.frames().some(f=>f.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/')),'Chrome native PDF viewer loads; visible document confirmed separately in screenshot');
    await capture(page,'preview'); await overflow(page,'preview desktop');
    await page.keyboard.press('Escape');
    check(await page.locator('.fv2-overlay-host').getAttribute('hidden')!==null,'Escape closes preview');
    check(await page.evaluate(()=>document.activeElement?.getAttribute('data-fv2-action'))==='quicklook-document','preview returns focus to opener');
    await nav(page,'upload'); await capture(page,'upload');
    check(await page.locator('.fv2-cinema-drop[data-fv2-dropzone]').isVisible(),'upload exposes actual drop target');
    await page.getByRole('button',{name:'Browse Files',exact:true}).click();
    check(await page.locator('[data-fv2-output-filename]').isVisible(),'guided upload preserves editable visible filename');
    check(await page.locator('[data-fv2-upload-version-label]').isVisible(),'guided upload preserves visible version label');
    await page.keyboard.press('Escape');
    await nav(page,'library'); await page.locator('.fv2-share-row').first().waitFor(); await capture(page,'missionmed');
    check(await page.getByRole('heading',{name:'Shared by MissionMed',exact:true}).isVisible(),'MissionMed sharing remains first-class separate page');
    await nav(page,'shared'); await page.locator('.fv2-share-row').first().waitFor(); await capture(page,'shared');
    check(await page.getByRole('heading',{name:'Shared with Me',exact:true}).isVisible(),'peer sharing remains separate');
    await nav(page,'activity'); await capture(page,'activity');
    check(await page.locator('.fv2-activity-row').count()===3,'activity uses only fixture server events');
    await page.locator('.fv2-nav-item[data-fv2-action="open-settings"]').click();await capture(page,'settings');await overflow(page,'settings desktop');
    check(await page.getByRole('switch',{name:'Toggle reduced motion'}).isDisabled(),'OS reduced motion cannot be disabled by in-app preference');
    check((await page.locator('.fv2-storage-summary').innerText()).includes('Current versions only'),'storage summary discloses limited scope');
    check(!(await page.locator('.fv2-storage-summary').innerText()).includes('500 MB'),'synthetic quota fields not mistaken for production API');
   }
   await page.close();
  }
  for(const width of [1440,390]) {
   const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'?role=admin&visual=1');await settled(page);await page.locator('[data-fv2-action="load-student"]').first().waitFor();
   check(await page.locator('[data-fv2-command-search]').isVisible(),width+' admin retains student directory search');
   await overflow(page,'staff '+width);await capture(page,'staff-'+width);
   await page.locator('[data-fv2-action="load-student"]').first().click();await page.locator('.fv2-subject-banner').waitFor();
   check(await page.locator('.fv2-cinema-hero').isVisible(),width+' staff selected student has cinematic home with explicit subject banner');
   await overflow(page,'staff selected student '+width); await page.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:850},reducedMotion:'no-preference'});const page=await context.newPage();
  await page.addInitScript(()=>{window.__fvLayoutShifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__fvLayoutShifts.push(e.value);}).observe({type:'layout-shift',buffered:true});});
  await page.goto(base);await settled(page);await page.waitForLoadState('networkidle');
  const initialLayoutShift=await page.evaluate(()=>window.__fvLayoutShifts.reduce((a,b)=>a+b,0));
  check(initialLayoutShift<0.1,'initial home cumulative layout shift below0.1 ('+initialLayoutShift+')');
  check(await page.locator('.fv2-atmosphere i').first().evaluate(e=>getComputedStyle(e).animationName)!=='none','subtle live background animation present');
  await page.locator('.fv2-nav-item[data-fv2-action="open-settings"]').click();await page.getByRole('switch',{name:'Toggle reduced motion'}).click();
  check(await page.locator('.fv2-atmosphere i').first().evaluate(e=>getComputedStyle(e).animationName)==='none','local reduced-motion preference stops background animation');
  await page.reload();await settled(page);check(await page.locator('.fv2-cinematic').evaluate(e=>e.classList.contains('fv2-reduced-motion')),'reduced-motion preference persists on reload');
  await nav(page,'files');const roomyHeight=await page.locator('.fv2-document-row').first().evaluate(e=>e.getBoundingClientRect().height);
  await page.locator('.fv2-nav-item[data-fv2-action="open-settings"]').click();await page.locator('[data-fv2-action="setting-density"][data-fv2-density="compact"]').click();await page.keyboard.press('Escape');
  check(await page.locator('.fv2-document-row').first().evaluate(e=>e.getBoundingClientRect().height)<roomyHeight,'compact preference visibly reduces file grid density');
  await nav(page,'vault');
  const assetBytes=JSON.parse(fs.readFileSync(path.join(root,'wp-content/plugins/missionmed-hub/assets/file-vault-cinematic/ASSETS.json'))).assets.reduce((n,a)=>n+a.bytes,0);
  check(assetBytes<700000,'all cinematic assets optimized under700KB ('+assetBytes+' bytes)');
  const stats=await page.evaluate(()=>({nodes:document.querySelectorAll('*').length,shifts:window.__fvLayoutShifts.reduce((a,b)=>a+b,0)}));
  check(stats.nodes<1200,'home DOM bounded ('+stats.nodes+' nodes)');
  check(errors.length===0,'no JavaScript page errors '+errors.join(';'));
  fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify({scope:'Local synthetic role/visual regression; not production acceptance',results,errors,assetBytes,stats,initialLayoutShift},null,2)+'\n');
  console.log(results.filter(r=>r.pass).length+' PASS / '+results.filter(r=>!r.pass).length+' FAIL');
  if(results.some(r=>!r.pass))process.exitCode=1;
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

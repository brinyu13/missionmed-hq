const {chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const origin='https://missionmedinstitute.com';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const result={at:new Date().toISOString(),viewports:[],routes:[],commerce:[],financial:'WAIVED BY FOUNDER / NOT EXECUTED'};
 for(const width of [390]){
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:1000}});
  const page=await ctx.newPage(),errors=[],analytics=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(/google-analytics.com.*collect/.test(r.url())){const u=new URL(r.url());analytics.push({status:r.status(),event:u.searchParams.get('en')});}});
  const r=await page.goto(origin+'/mission-residency/?utm_source=whatsapp&utm_medium=social&utm_campaign=mr-b-acceptance',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#other-ways',{timeout:20000});await page.waitForTimeout(1500);
  const item={width,status:r.status(),errors,analytics,screenshots:[]};
  for(const id of ['top','compare','guarantee','other-ways','matrix']){
   await page.locator('#'+id).scrollIntoViewIfNeeded();await page.waitForTimeout(500);
   const shot='/tmp/mr-b-production-'+width+'-'+id+'.png';await page.screenshot({path:shot});item.screenshots.push(shot);
  }
  item.overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  item.copy=await page.locator('#other-ways').innerText();
  item.policy=await page.locator('#guarantee').innerText();
  item.banned=await page.locator('body').evaluate(n=>/internal QA|enrollment opens after verification|142 alumni|local prototype|preview only|governance|out of stock|use desktop/i.test(n.innerText));
  item.emergencyUrl=await page.locator('#emergency-request').getAttribute('href');
  item.soldOutActions=await page.locator('#mentorship-offer a,#mentorship-offer button').count();
  await page.locator('.schedule-details summary').click();await page.locator('.season-details summary').click();
  for(const sess of ['A360','B','C','D','J']){await page.locator('[data-session="'+sess+'"]').click();item['schedule'+sess]=await page.locator('.season-answer h3').innerText();}
  await page.locator('[data-action=iw]:visible').first().click();item.upsell=await page.locator('#modal').innerText();await page.locator('[data-action=accept]').click();item.choice=await page.locator('#compare').getAttribute('data-selected');
  await page.locator('[data-action=curriculum]').first().click();item.curriculum=await page.locator('#modal details').count();await page.keyboard.press('Escape');item.focusRestored=await page.evaluate(()=>document.activeElement?.dataset.action==='curriculum');
  await page.locator('[data-proof="0"]').click();const video=page.locator('#modal video');await video.evaluate(v=>{v.muted=true;return v.play().catch(()=>{});});await page.waitForTimeout(1200);item.video=await video.evaluate(v=>({time:v.currentTime,duration:v.duration,readyState:v.readyState,error:v.error?.code||null}));await page.keyboard.press('Escape');item.videoUnloaded=await page.locator('#modal video').count()===0;
  await page.locator('#emergency-offer summary').click();await page.locator('[data-pathway="1"]').click();await page.locator('#matrix summary').click();await page.locator('#personalization summary').click();await page.locator('.faq-list summary').first().click();await page.locator('.quote-next').first().click();
  await page.locator('[data-action=lead]').first().click();await page.waitForTimeout(3500);item.lead=await page.locator('#lead-frame').evaluate(f=>{try{return {form:!!f.contentDocument.querySelector('#form_contact-form'),bodyChildren:f.contentDocument.body.children.length,text:f.contentDocument.body.innerText.slice(0,1300)}}catch{return {crossOrigin:true}}});await page.keyboard.press('Escape');
  const motionBefore=await page.locator('.hero-room').evaluate(n=>n.style.transform);await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));await page.waitForTimeout(400);item.motionChanged=motionBefore!==await page.locator('.hero-room').evaluate(n=>n.style.transform);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300);item.reduced=await page.evaluate(()=>({class:document.body.classList.contains('motion-off'),transform:getComputedStyle(document.querySelector('.hero-room')).transform,chapters:[...document.querySelectorAll('.chapter')].every(n=>!n.inert)}));
  item.events=await page.evaluate(()=>[...new Set((window.dataLayer||[]).map(e=>e.event).filter(Boolean))]);
  item.resourceBytes=await page.evaluate(()=>performance.getEntriesByType('resource').reduce((s,e)=>s+(e.transferSize||0),0));
  result.viewports.push(item);console.log('B_QA_VIEWPORT '+JSON.stringify(item));
  await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();
 for(const route of ['/','/mission-residency/','/product/iv-prep-masterclass/','/product/match-prep-pro/','/mission-residency-courses/','/product/360-match-mentorship/','/contact/?inquiry=emergency-interview-prep','/terms-of-agreement/','/refund-cancellation-policy/']){
  const r=await page.goto(origin+route,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
  result.routes.push({route,status:r.status(),title:await page.title(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),banned:await page.locator('body').evaluate(n=>/internal QA|enrollment opens after verification|142 alumni|local prototype|preview only|governance|out of stock|use desktop/i.test(n.innerText))});
 }
 await ctx.close();
 for(const offer of ['iw','complete']){
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage();
  await p.route('**/*',async route=>{const req=route.request();if(req.method()==='POST'&&(/wc-ajax=checkout|payment_intents.*confirm|\/v1\/charges/.test(req.url()))){return route.abort();}return route.continue();});
  await p.goto(origin+'/mission-residency/?utm_source=whatsapp&utm_medium=social&utm_campaign=mr-b-acceptance');
  await p.waitForSelector('#other-ways');
  if(offer==='iw'){await p.locator('[data-action=iw]:visible').first().click();await p.locator('[data-action=decline]').click();}else await p.locator('[data-action=complete]:visible').first().click();
  await p.waitForURL('**/checkout/**',{timeout:25000});await p.waitForTimeout(4500);
  const item={offer,url:p.url(),summary:await p.locator('#order_review').innerText().catch(()=>p.locator('body').innerText()),stripe:await p.locator('[name=payment_method][value=stripe]').count(),frames:await p.locator('iframe').evaluateAll(ns=>ns.map(n=>({title:n.title,source:new URL(n.src||location.href).hostname}))),fields:await p.locator('input:visible').evaluateAll(ns=>ns.map(n=>({name:n.name,type:n.type,required:n.required}))),overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
  await p.screenshot({path:'/tmp/mr-b-checkout-'+offer+'-390.png',fullPage:true});
  await p.goto(origin+'/cart/');await p.waitForTimeout(1500);item.cart=await p.locator('body').innerText();
  result.commerce.push(item);console.log('CHECKOUT '+offer+' '+JSON.stringify(item));
  await ctx.close();
 }
 await browser.close();console.log('B_QA_RESULT '+JSON.stringify(result));
})().catch(e=>{console.error(e.stack);process.exit(1)});

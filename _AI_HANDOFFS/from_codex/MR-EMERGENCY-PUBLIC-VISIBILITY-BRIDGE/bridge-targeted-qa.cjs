const {chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),cp=require('child_process'),path=require('path');
const base=path.resolve(__dirname,'../../..');
const sourceRoot='/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week';
const asset=sourceRoot+'/wp-content/mu-plugins/missionmed-mr-0912-assets';
(async()=>{
 const live=process.argv.includes('--live');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const rows=[];let fail=0;
 const routes=live?['/mission-residency/','/product/iv-prep-masterclass/','/product/match-prep-pro/','/mission-residency-courses/','/product/360-match-mentorship/','/']:['/mission-residency/'];
 for(const width of [1440,1024,390]){
  const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1});
  for(const route of routes){
   const page=await context.newPage(),events=[],errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(/google-analytics.*collect/.test(r.url())){let u=new URL(r.url());events.push({status:'requested',name:u.searchParams.get('en'),bodyNames:(r.postData()||'').match(/(?:^|&)en=[^&\n]+/g)});}});
   try{
    if(live){await page.goto('https://missionmedinstitute.com'+route,{waitUntil:'domcontentloaded',timeout:45000});}
    else{
     const cfg=JSON.parse(fs.readFileSync(asset+'/config/campaign-state.json'));
     const runtime=JSON.parse(cp.execFileSync('curl',['-fsSL','https://missionmedinstitute.com/wp-json/missionmed/v1/mr-0912-config']));
     cfg.offers=runtime.offers;cfg.payment_options=runtime.payment_options;
     await page.route('https://missionmedinstitute.com/__mr-bridge-local-qa',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>'+fs.readFileSync(asset+'/css/mr-0912.css','utf8')+'</style></head><body><main id="main"></main><footer><div></div><div></div></footer></body></html>'}));
     await page.goto('https://missionmedinstitute.com/__mr-bridge-local-qa',{waitUntil:'domcontentloaded'});
     await page.evaluate(cfg=>{window.MM_MR_PAGE='mission-residency';window.MM_CONFIG_URL='https://missionmedinstitute.com/wp-json/missionmed/v1/mr-0912-config';window.fetch=async()=>({ok:true,json:async()=>cfg});},cfg);
     await page.addScriptTag({content:fs.readFileSync(asset+'/js/mr-0912.js','utf8')});
    }
    const homepage=route==='/';
    if(!homepage)await page.locator('#other-ways').waitFor({timeout:20000});
    else await page.getByRole('heading',{name:'Interview in the next 7 days?'}).waitFor({timeout:20000});
    const text=await page.locator('body').innerText();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    const row={width,route,url:page.url(),loggedOut:!(await page.locator('#wpadminbar').count()),emergency:text.includes('Emergency Private Interview Intensive')&&text.includes('$3,999'),scope:text.includes('4 total private')&&text.includes('3 Signature Mock'),soldOut:text.includes('360 Match Mentorship')&&text.includes('$5,499')&&text.includes('SOLD OUT'),noStockLeak:!text.includes('OUT OF STOCK'),overflow,errors};
    if(!homepage){
     row.primaryPrices=text.includes('$500')&&text.includes('$3,099')&&text.includes('$3,499');
     row.exclusions=(await page.locator('.emergency-exclusions').innerText()).includes('Match Guarantee');
     const link=page.getByRole('link',{name:'REQUEST EMERGENCY PREP',exact:true});
     row.contact=await link.getAttribute('href');
     row.contactSafe=new URL(row.contact).pathname==='/contact/'&&!/checkout|add-to-cart|payment/i.test(row.contact);
     row.no360Links=(await page.locator('#mentorship-360 a').count())===0;
     await page.locator('#emergency-prep').scrollIntoViewIfNeeded();
     for(const s of await page.locator('#emergency-prep summary').all())await s.click();
     await page.locator('#mentorship-360').scrollIntoViewIfNeeded();
     await page.waitForTimeout(350);
     row.dataLayer=await page.evaluate(()=>(window.dataLayer||[]).filter(x=>x&&x.event).map(x=>x.event).filter(x=>/emergency|360_/.test(x)));
     row.analyticsRequests=events;
     // One request-navigation check per viewport; never submit any form.
     if(live&&route==='/mission-residency/'){
      await page.screenshot({path:__dirname+'/LIVE-'+width+'-offers.png'});
      const contact=await context.newPage();await contact.goto(row.contact,{waitUntil:'domcontentloaded'});
      row.contactPage={url:contact.url(),formCount:await contact.locator('#form_contact-form').count(),paymentFields:await contact.locator('input[name*="card_number"]').count()};
      await contact.close();
     }
    }
    else if(live)await page.screenshot({path:__dirname+'/LIVE-'+width+'-home.png'});
    const pass=row.loggedOut&&row.emergency&&row.scope&&row.soldOut&&row.noStockLeak&&!row.overflow&&(homepage||(row.primaryPrices&&row.exclusions&&row.contactSafe&&row.no360Links));
    row.pass=pass;if(!pass)fail++;rows.push(row);
   }catch(e){fail++;rows.push({width,route,pass:false,error:e.message});}
   await page.close();
  }
  await context.close();
 }
 await browser.close();console.log(JSON.stringify({mode:live?'LIVE':'LOCAL',fail,rows},null,2));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});

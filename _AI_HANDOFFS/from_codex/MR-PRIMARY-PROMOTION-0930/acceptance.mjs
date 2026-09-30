import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin='https://missionmedinstitute.com', dir=new URL('./qa/',import.meta.url);
const out={at:new Date().toISOString(),redirects:[],flows:[],checks:[]};
const check=(name,pass,detail)=>{out.checks.push({name,pass,detail});};
const query='?utm_source=facebook&utm_medium=organic&utm_campaign=mission_residency_fall_2026&utm_content=interview_to_match';
for(const suffix of ['',query,'?utm_content=a%2Bb&fbclid=MR_QA_ONLY&campaign=fall%202026']){
 const r=await fetch(origin+'/mission-residency/'+suffix,{redirect:'manual'}),location=r.headers.get('location');
 const next=await fetch(location,{redirect:'manual'});
 out.redirects.push({from:origin+'/mission-residency/'+suffix,status:r.status,location,finalStatus:next.status});
 check('One-hop permanent redirect and exact query preservation '+suffix,r.status===301&&next.status===200&&location===origin+'/missionresidency/'+suffix);
}
const sitemap=await(await fetch(origin+'/page-sitemap.xml')).text();
check('Sitemap canonical present once; legacy absent',(sitemap.match(/<loc>https:\/\/missionmedinstitute.com\/missionresidency\/<\/loc>/g)||[]).length===1&&!sitemap.includes('<loc>'+origin+'/mission-residency/</loc>'));
const browser=await chromium.launch();
for(const width of [1440,390]){
 const ctx=await browser.newContext({viewport:{width,height:900}}),p=await ctx.newPage();
 await p.goto(origin+'/',{waitUntil:'networkidle'});
 if(width===390)await p.locator('.mm-ph__mobile-nav summary').click();
 const target=width===390?p.locator('.mm-ph__mobile-nav a').filter({hasText:'Mission Residency'}):p.locator('#mm-l5-header .mm-l5__nav a').filter({hasText:'Mission Residency'});
 const href=await target.getAttribute('href');const nav=[];p.on('response',r=>{if(r.request().isNavigationRequest()&&r.request().frame()===p.mainFrame())nav.push({url:r.url(),status:r.status()});});
 await Promise.all([p.waitForURL(origin+'/missionresidency/'),target.click()]);
 check('Homepage direct navigation '+width,href?.includes('/missionresidency/')&&nav.length===1&&nav[0].status===200,{href,nav});
 await ctx.close();
}
const ctx=await browser.newContext({viewport:{width:1440,height:900}}),p=await ctx.newPage();const events=[];
p.on('request',r=>{if(/google-analytics.com.*collect/.test(r.url())){const u=new URL(r.url());events.push({event:u.searchParams.get('en'),tid:u.searchParams.get('tid'),location:u.searchParams.get('dl')});}});
await p.goto(origin+'/mission-residency/'+query+'#dates',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
const seo=await p.evaluate(()=>({url:location.href,canon:[...document.querySelectorAll('link[rel=canonical]')].map(e=>e.href),robots:[...document.querySelectorAll('meta[name=robots]')].map(e=>e.content),anchors:['dates','method','programs','other-ways','emergency-prep'].every(x=>!!document.getElementById(x)),relationship:document.querySelector('.mm-program-relationship')?.innerText,mentorship:document.querySelector('.mm-mentor-lead')?.innerText,headings:[...document.querySelectorAll('h1')].map(e=>e.innerText),lazy:[...document.querySelectorAll('#alumni img,#teacher img,#story img')].map(e=>({src:e.getAttribute('src'),loading:e.loading,width:e.width,height:e.height})),enrollBg:getComputedStyle(document.querySelector('#enroll')).backgroundColor}));
out.seo=seo;out.analytics=events;
check('Self canonical and index enabled',seo.canon.length===1&&seo.canon[0]===origin+'/missionresidency/'&&seo.robots.every(x=>!x.includes('noindex')));
check('Legacy fragment preserved with meaningful section aliases',seo.url.endsWith('#dates')&&seo.anchors);
check('Refinements actually rendered',!!seo.relationship?.includes('Personalized training')&&!!seo.mentorship?.includes('Work directly with Dr Brian'));
check('Exactly one h1',seo.headings.length===1);
check('Lower portraits remain lazy',seo.lazy.every(x=>x.loading==='lazy'));
check('White enrollment finish',seo.enrollBg==='rgb(255, 255, 255)');
const views=events.filter(e=>e.event==='page_view');
check('One GA4 page_view on final canonical path with Facebook attribution',views.length===1&&views[0].tid==='G-B4B4E26HMW'&&views[0].location?.includes('/missionresidency/?utm_source=facebook'),views);
for(const [selector,label] of [['.mm-program-relationship','relationship'],['#teacher','teacher'],['#alumni','alumni']]){await p.locator(selector).scrollIntoViewIfNeeded();await p.screenshot({path:new URL('final-detail-'+label+'.png',dir).pathname});}
await ctx.close();
for(const [path,offer,total] of [['/product/iv-prep-masterclass/','Bootcamp','499.00'],['/product/match-prep-pro/','Complete','3,099.00']]){
 const c=await browser.newContext({viewport:{width:390,height:844}}),page=await c.newPage();
 await page.goto(origin+path+query,{waitUntil:'networkidle'});
 const link=page.getByRole('link',{name:'Continue with Zelle',exact:true});await link.waitFor();const href=await link.getAttribute('href');
 await Promise.all([page.waitForURL(/\/checkout\//),link.click()]);await page.locator('#payment_method_bacs').waitFor({state:'attached'});
 // Woo recalculates the selected Zelle total asynchronously; inspect settled checkout.
 await page.waitForLoadState('networkidle');
 await page.waitForFunction(amount=>document.querySelector('.order-total')?.innerText.includes(amount),total,{timeout:10000});
 const data=await page.evaluate(()=>({url:location.href,summary:document.querySelector('.woocommerce-checkout-review-order')?.innerText,bacs:!!document.querySelector('#payment_method_bacs'),bacsChecked:document.querySelector('#payment_method_bacs')?.checked,stripe:!!document.querySelector('#payment_method_stripe'),overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)}));
 out.flows.push({offer,href,...data});check(offer+' Zelle checkout smoke',data.bacs&&data.summary?.includes(total)&&data.overflow===0,data);await c.close();
}
await browser.close();fs.writeFileSync(new URL('acceptance.json',dir),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));if(out.checks.some(c=>!c.pass))process.exitCode=1;

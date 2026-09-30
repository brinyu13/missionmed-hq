import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url=process.argv[2]||'http://127.0.0.1:8773/_AI_HANDOFFS/from_codex/MR-USCE-ALTERNATE-0930/preview.php';
const label=process.argv[3]||'local';
const dir=path.join(path.dirname(new URL(import.meta.url).pathname),'qa');fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(); const results=[];
for(const [width,height] of [[1440,900],[1366,768],[1280,800],[1024,900],[768,1024],[430,932],[390,844]]){
 const context=await browser.newContext({viewport:{width,height}}); const page=await context.newPage(); const errors=[],failed=[],analytics=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).hostname==='missionmedinstitute.com')failed.push({url:r.url(),status:r.status()});});
 page.on('request',r=>{if(/google-analytics.com.*collect/.test(r.url()))analytics.push({url:r.url(),body:r.postData()});});
 await page.addInitScript(()=>{window.__qa={cls:0,lcp:0};new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__qa.cls+=e.value})).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__qa.lcp=e.startTime)).observe({type:'largest-contentful-paint',buffered:true});});
 const res=await page.goto(url+'?utm_source=facebook&utm_medium=paid_social&utm_campaign=alternate_qa',{waitUntil:'networkidle'});await page.waitForTimeout(500);
 const initial=await page.evaluate(()=>({metrics:window.__qa,hero:document.querySelector('h1')?.innerText,heroHeight:document.querySelector('.cl1403c-a-hero')?.getBoundingClientRect().height,heroImage:document.querySelector('.mm-alt-hero-img')?.currentSrc,bodyFont:getComputedStyle(document.body).fontFamily}));
 await page.screenshot({path:path.join(dir,`${label}-${width}-hero.png`)});
 for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=height){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(70);}
 await page.locator('#enroll').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,`${label}-${width}-enroll.png`)});
 await page.locator('#alumni').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,`${label}-${width}-alumni.png`)});
 await page.locator('.cl1403c-faq-q').first().focus();await page.keyboard.press('Enter');const faqKeyboard=await page.locator('.cl1403c-faq-item').first().getAttribute('open')!==null;
 const audit=await page.evaluate(()=>{
  const rgb=s=>{const m=s.match(/[\d.]+/g);return m?[+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]:[0,0,0,0];};
  const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
  const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const contrast=[];const background=e=>{let out=[255,255,255];const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);for(const n of chain){out=blend(rgb(getComputedStyle(n).backgroundColor),out);}return out;};
  for(const e of document.querySelectorAll('h1,h2,h3,h4,p,a,li,summary,blockquote,figcaption,small,span,strong,time')){const s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height||s.visibility==='hidden'||!e.innerText?.trim()||!e.checkVisibility({checkVisibilityCSS:true}))continue; const fg=rgb(s.color),bg=background(e),a=luminance(blend(fg,bg)),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&+s.fontWeight>=700);if(ratio<(large?3:4.5))contrast.push({text:e.innerText.slice(0,90),cls:e.className,color:s.color,bg,ratio:+ratio.toFixed(2),size:s.fontSize});}
  return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),broken:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),contrast,prices:document.querySelector('#enroll').innerText,links:[...document.querySelectorAll('a[data-offer]')].map(a=>a.href),parallax:getComputedStyle(document.querySelector('.cl1403c-a-specs')).backgroundAttachment,canonical:document.querySelector('link[rel=canonical]')?.href,robots:document.querySelector('meta[name=robots]')?.content,portraitSources:[...document.querySelectorAll('.mm-alt-alumnus img')].map(i=>i.currentSrc),cls:window.__qa.cls,focusOutline:getComputedStyle(document.activeElement).outline};
 });
 await page.emulateMedia({reducedMotion:'reduce'});const reduced=await page.locator('.cl1403c-a-specs').evaluate(e=>getComputedStyle(e).backgroundAttachment);
 await page.evaluate(()=>scrollTo(0,0));if(width===1440||width===390)await page.screenshot({path:path.join(dir,`${label}-${width}-full.png`),fullPage:true});
 const safeHeaders=Object.fromEntries(Object.entries(res.headers()).filter(([k])=>['x-robots-tag','x-missionmed-alternate','cache-control','cf-cache-status','content-type'].includes(k)));
 const safeAnalytics=analytics.map(a=>{const u=new URL(a.url);return {host:u.hostname,event:u.searchParams.get('en'),measurement_id:u.searchParams.get('tid'),page_location:u.searchParams.get('dl')};});
 results.push({width,height,status:res.status(),headers:safeHeaders,...initial,...audit,faqKeyboard,reduced,errors,failed,analytics:safeAnalytics});console.log(JSON.stringify({width,status:res.status(),overflow:audit.overflow,contrast:audit.contrast.length,broken:audit.broken.length,lcp:initial.metrics.lcp,cls:audit.cls,errors}));await context.close();
}
fs.writeFileSync(path.join(dir,`${label}-qa.json`),JSON.stringify(results,null,2));await browser.close();

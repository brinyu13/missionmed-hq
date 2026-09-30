const fs=require('fs');
const path=require('path');
const {chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=__dirname;
const out=path.join(here,'live-qa');
const prior=JSON.parse(fs.readFileSync(path.join(here,'..','live-qa','live-qa.json'),'utf8'));
const expected=prior.home['1440'].frames;
const viewports=[[1440,900],[1440,1000],[1366,768],[1280,800],[1024,768],[768,1024],[430,932],[390,844]];
const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return Object.fromEntries(['x','y','right','bottom','width','height'].map(k=>[k,Math.round(r[k]*100)/100]))};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const report={checkedAt:new Date().toISOString(),browser:'Chrome',zoom:1,root:'https://missionmedinstitute.com/',viewports:{},failures:[]};
 for(const [w,h] of viewports){
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const page=await context.newPage();const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',r=>{if(r.url().startsWith('https://missionmedinstitute.com/'))failed.push({url:r.url(),failure:r.failure()?.errorText})});
  const response=await page.goto('https://missionmedinstitute.com/',{waitUntil:'networkidle',timeout:60000});
  const frames=[];
  for(let i=0;i<8;i++){
   await page.waitForTimeout(160);
   const data=await page.evaluate(({rectSource})=>{
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return Object.fromEntries(['x','y','right','bottom','width','height'].map(k=>[k,Math.round(r[k]*100)/100]))};
    const q=s=>document.querySelector(s);const hero=q('#mm-premium-hero'),head=q('.mm-ph__headline'),cta=q('.mm-ph__cta'),next=q('[data-next]'),image=hero?.dataset.theme==='evidence'?q('.mm-ph__evidence-image'):q('.mm-ph__image');
    const hit=e=>{const r=e?.getBoundingClientRect();if(!r)return false;const target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return target===e||e.contains(target)};
    return {index:+hero.dataset.index,theme:hero.dataset.theme,headline:head.innerText,cta:cta.innerText,href:cta.href,asset:image?.currentSrc||image?.src,assetLoaded:!!(image?.complete&&image?.naturalWidth>0),alt:image?.alt,hero:rect(hero),copy:rect(q('.mm-ph__copy')),headlineRect:rect(head),accent:rect(q('[data-accent]')),support:rect(q('.mm-ph__support')),ctaRect:rect(cta),controls:rect(q('.mm-ph__controls')),nextSection:rect(q('.mm-ph__ecosystem')),header:rect(q('#mm-l5-header')),cart:rect(q('#mm-mr-0912-cart-button')),ctaHit:hit(cta),nextHit:hit(next),overflow:document.documentElement.scrollWidth-innerWidth,accentStyle:getComputedStyle(q('[data-accent]')).fontStyle,accentFamily:getComputedStyle(q('[data-accent]')).fontFamily,viewportScale:visualViewport.scale};
   },{rectSource:''});
   const e=expected[i];const problems=[];
   if(data.index!==i)problems.push('index');
   if(data.headline!==e.headline)problems.push('copy');
   if(data.cta!==e.cta)problems.push('cta');
   if(data.href!==e.href)problems.push('destination');
   if(!data.assetLoaded)problems.push('asset');
   if(data.overflow>0)problems.push('overflow');
   if(data.ctaRect.bottom>data.controls.y-8)problems.push('cta-controls');
   if(!data.ctaHit||!data.nextHit)problems.push('hit-target');
   if(w>=1024&&data.nextSection.y>=h-60)problems.push('next-section-hidden');
   if(w>=761&&(data.hero.height<620||data.hero.height>720))problems.push('hero-height');
   if(data.accentStyle!=='normal')problems.push('italic-accent');
   if(i===0&&data.accent.right>data.hero.right-8)problems.push('payoff-overflow');
   if(data.viewportScale!==1)problems.push('zoom');
   data.pass=problems.length===0;data.problems=problems;
   if(problems.length)report.failures.push({viewport:`${w}x${h}`,frame:i+1,problems});
   frames.push(data);
   if((w===1440&&h===900)||(w===390&&h===844)||i===0){await page.screenshot({path:path.join(out,`${w}x${h}-frame-${String(i+1).padStart(2,'0')}.jpg`),type:'jpeg',quality:82})}
   await page.evaluate(()=>document.querySelector('[data-next]').click());
   await page.waitForTimeout(460);
  }
  if(w===768){await page.locator('.mm-ph__mobile-nav summary').click();const links=await page.locator('.mm-ph__mobile-nav nav a').count();if(links!==8)report.failures.push({viewport:`${w}x${h}`,problem:'tablet-menu-links',links})}
  report.viewports[`${w}x${h}`]={status:response.status(),frames,errors,failed};
  console.log(`${w}x${h}`,response.status(),frames.filter(f=>!f.pass).length,'frame failures',errors.length,'JS errors',failed.length,'failed requests');
  await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'production-visual-qa.json'),JSON.stringify(report,null,2));
 console.log('TOTAL FAILURES',report.failures.length);
 if(report.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

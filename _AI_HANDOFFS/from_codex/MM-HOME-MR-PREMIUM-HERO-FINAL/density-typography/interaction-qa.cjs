const fs=require('fs');
const path=require('path');
const {chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'live-qa','interaction.json');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const report={checkedAt:new Date().toISOString(),url:'https://missionmedinstitute.com/',cases:[],failures:[]};
 for(const test of [{name:'desktop',width:1440,height:900,motion:'no-preference'},{name:'mobile',width:390,height:844,motion:'no-preference'},{name:'reduced-motion',width:1440,height:900,motion:'reduce'}]){
  const context=await browser.newContext({viewport:{width:test.width,height:test.height},deviceScaleFactor:1,reducedMotion:test.motion});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const response=await page.goto('https://missionmedinstitute.com/',{waitUntil:'networkidle',timeout:60000});
  await page.keyboard.press('Tab');
  const first=await page.evaluate(()=>({text:document.activeElement?.textContent?.trim(),href:document.activeElement?.getAttribute('href'),className:document.activeElement?.className}));
  const next=page.locator('[data-next]');await next.focus();
  const before=await page.evaluate(()=>({index:+document.querySelector('#mm-premium-hero').dataset.index,scrollY,focus:document.activeElement?.getAttribute('data-next')!==null,outline:getComputedStyle(document.activeElement).outlineStyle,outlineWidth:getComputedStyle(document.activeElement).outlineWidth}));
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#mm-premium-hero').dataset.index==='1');await page.waitForTimeout(180);
  const after=await page.evaluate(()=>({index:+document.querySelector('#mm-premium-hero').dataset.index,scrollY,focus:document.activeElement?.getAttribute('data-next')!==null,paused:document.querySelector('[data-pause]').getAttribute('aria-pressed'),nextHit:(()=>{const e=document.querySelector('[data-next]'),r=e.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return t===e||e.contains(t)})()}));
  await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('#mm-premium-hero').dataset.index==='0');
  const back=await page.evaluate(()=>({index:+document.querySelector('#mm-premium-hero').dataset.index,scrollY}));
  if(test.motion==='reduce'){
   await page.waitForTimeout(12500);
  }
  const final=await page.evaluate(()=>({index:+document.querySelector('#mm-premium-hero').dataset.index,pauseDisabled:document.querySelector('[data-pause]').disabled,pauseLabel:document.querySelector('[data-pause]').textContent,transition:getComputedStyle(document.querySelector('.mm-ph__image')).transitionDuration}));
  const item={...test,status:response.status(),first,before,after,back,final,errors};report.cases.push(item);
  const problems=[];
  if(response.status()!==200)problems.push('status');if(first.href!=='#content')problems.push('skip-link');if(!before.focus||before.outline==='none'||before.outlineWidth==='0px')problems.push('focus');if(after.index!==1||!after.focus||after.paused!=='true'||!after.nextHit)problems.push('arrow-next');if(after.scrollY!==before.scrollY)problems.push('scroll');if(back.index!==0||back.scrollY!==before.scrollY)problems.push('arrow-previous');if(test.motion==='reduce'&&(final.index!==0||!final.pauseDisabled||final.transition!=='0s'))problems.push('reduced-motion');if(errors.length)problems.push('js-errors');
  if(problems.length)report.failures.push({case:test.name,problems});
  console.log(test.name,problems.length?problems.join(','):'PASS');await context.close();
 }
 await browser.close();fs.writeFileSync(out,JSON.stringify(report,null,2));console.log('TOTAL FAILURES',report.failures.length);if(report.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

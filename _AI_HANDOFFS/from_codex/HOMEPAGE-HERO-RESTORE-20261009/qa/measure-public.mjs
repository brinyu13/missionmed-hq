import {chromium} from '/Users/brianb/MissionMed/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const out=[];
for (const [width,height] of [[1440,900],[1440,900],[390,844],[390,844]]) {
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
 await context.addInitScript(()=>{window.__heroPerf={lcp:[],cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())window.__heroPerf.lcp.push({time:e.startTime,size:e.size,url:e.url||''})}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__heroPerf.cls+=e.value}).observe({type:'layout-shift',buffered:true})});
 const page=await context.newPage();const errors=[];const failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.url().startsWith('https://missionmedinstitute.com/'))failed.push({url:r.url(),failure:r.failure()?.errorText})});
 const response=await page.goto('https://missionmedinstitute.com/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('#mm-premium-hero [data-hero-image]').waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>{const x=document.querySelector('#mm-premium-hero [data-hero-image]');return x&&x.complete&&x.naturalWidth>0},{timeout:15000});
 await page.waitForTimeout(700);
 const metrics=await page.evaluate(()=>({lcp:window.__heroPerf.lcp.at(-1)||null,cls:window.__heroPerf.cls,nav:performance.getEntriesByType('navigation').map(x=>({responseEnd:x.responseEnd,domContentLoaded:x.domContentLoadedEventEnd,transferSize:x.transferSize})),heroId:JSON.parse(document.querySelector('#mm-premium-hero-data').textContent)[0].id,heroHeight:document.querySelector('#mm-premium-hero').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1}));
 out.push({viewport:[width,height],status:response.status(),metrics,errors,failed});await context.close();
}
await browser.close();writeFileSync('/tmp/mm-hero-restoration-20261009/qa/performance-headless.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));

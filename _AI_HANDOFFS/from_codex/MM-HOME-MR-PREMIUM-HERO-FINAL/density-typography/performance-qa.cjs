const fs = require('fs');
const path = require('path');
const {chromium} = require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.join(__dirname, 'live-qa', 'performance.json');
const viewports = [[1440,900],[1366,768],[1280,800],[1024,768],[390,844]];

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const report = {checkedAt:new Date().toISOString(),url:'https://missionmedinstitute.com/',runs:[],failures:[]};
  for (const [width,height] of viewports) {
    for (let run=1;run<=2;run++) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference'});
      const page=await context.newPage();
      const errors=[],failed=[];
      page.on('pageerror',e=>errors.push(String(e)));
      page.on('requestfailed',r=>{if(r.url().startsWith('https://missionmedinstitute.com/'))failed.push({url:r.url(),failure:r.failure()?.errorText})});
      await page.addInitScript(() => {
        window.__heroMetrics={cls:0,shifts:[],lcp:null};
        new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){window.__heroMetrics.cls+=e.value;window.__heroMetrics.shifts.push({startTime:e.startTime,value:e.value,sources:e.sources?.map(s=>s.node?.outerHTML?.slice(0,180))})}}).observe({type:'layout-shift',buffered:true});
        new PerformanceObserver(list=>{for(const e of list.getEntries())window.__heroMetrics.lcp={startTime:e.startTime,size:e.size,url:e.url,element:e.element?.outerHTML?.slice(0,240)}}).observe({type:'largest-contentful-paint',buffered:true});
      });
      const response=await page.goto(`https://missionmedinstitute.com/?hero_qa=${Date.now()}-${width}-${run}`,{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForTimeout(3500);
      const data=await page.evaluate(()=>{
        const hero=document.querySelector('#mm-premium-hero'),img=document.querySelector('[data-hero-image]'),nav=performance.getEntriesByType('navigation')[0];
        return {metrics:window.__heroMetrics,nav:{domContentLoadedEventEnd:nav.domContentLoadedEventEnd,loadEventEnd:nav.loadEventEnd,responseEnd:nav.responseEnd,transferSize:nav.transferSize},heroHeight:hero.getBoundingClientRect().height,image:{complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc,loading:img.loading,fetchPriority:img.fetchPriority},overflow:document.documentElement.scrollWidth-innerWidth,criticalCss:document.head.innerHTML.includes('height:clamp(620px,72vh,700px)')};
      });
      const item={viewport:`${width}x${height}`,run,status:response.status(),...data,errors,failed};
      report.runs.push(item);
      if(response.status()!==200||data.metrics.cls>=0.1||!data.image.complete||!data.image.naturalWidth||data.overflow>0||errors.length||failed.length||!data.criticalCss)report.failures.push({viewport:item.viewport,run,status:item.status,cls:data.metrics.cls,image:data.image,overflow:data.overflow,errors,failed,criticalCss:data.criticalCss});
      console.log(item.viewport,run,'CLS',data.metrics.cls.toFixed(4),'LCP',Math.round(data.metrics.lcp?.startTime||0),'ms','errors',errors.length,'failures',failed.length);
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(out,JSON.stringify(report,null,2));
  console.log('TOTAL FAILURES',report.failures.length);
  if(report.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

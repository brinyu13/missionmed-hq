import fs from 'node:fs';import {createRequire} from 'node:module';const require=createRequire(import.meta.url),{chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=[];
for(let i=0;i<3;i++){
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:i===2?390:1440,height:900}});
 await p.addInitScript(()=>{window.metrics={lcp:0,cls:0,longTasks:[]};new PerformanceObserver(l=>l.getEntries().forEach(e=>{window.metrics.lcp=e.startTime;window.metrics.lcpElement=e.element?.tagName;window.metrics.lcpUrl=e.url;})).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.metrics.cls+=e.value})).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>window.metrics.longTasks.push(e.duration))).observe({type:'longtask',buffered:true});});
 await p.goto('https://missionmedinstitute.com/missionresidency/',{waitUntil:'networkidle'});await p.waitForTimeout(500);
 const data=await p.evaluate(()=>({metrics:window.metrics,nav:performance.getEntriesByType('navigation').map(e=>({ttfb:e.responseStart,domReady:e.domContentLoadedEventEnd,load:e.loadEventEnd})),slow:performance.getEntriesByType('resource').filter(e=>e.duration>500).map(e=>({url:e.name.split('?')[0],duration:e.duration})),heroEyebrow:getComputedStyle(document.querySelector('.cl1403c-a-hero-label')).fontSize,css:[...document.querySelectorAll('link[rel=stylesheet]')].map(e=>e.href)}));
 await p.locator('.mm-alt-cart').focus();data.cartFocus=await p.locator('.mm-alt-cart').evaluate(e=>getComputedStyle(e).outline);out.push(data);await b.close();
}
fs.writeFileSync(new URL('./qa/performance.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));

import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const label=process.argv[2]||'before',url=process.argv[3]||'https://missionmedinstitute.com/missionresidency/';
const out=new URL('./qa/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),results=[];
for(const width of [1440,1366,1024,768,430,390]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.goto(url,{waitUntil:'networkidle'});
 for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=850){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(60);}
 await page.evaluate(()=>document.fonts.ready);
 const data=await page.evaluate(()=>({width:innerWidth,height:document.body.scrollHeight,sections:[...document.querySelectorAll('main>section')].map(e=>({id:e.id,cls:e.className,height:e.getBoundingClientRect().height,text:e.innerText})),portraits:[...document.querySelectorAll('.mm-alt-alumnus img')].map(e=>({src:e.currentSrc,w:e.width,h:e.height,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight})),quotes:[...document.querySelectorAll('.mm-alt-alumnus blockquote')].map(e=>({text:e.innerText,font:getComputedStyle(e).fontSize})),links:[...document.querySelectorAll('a')].map(e=>({text:e.innerText,href:e.href})),canonical:document.querySelector('link[rel=canonical]').href,robots:document.querySelector('meta[name=robots]').content}));
 results.push(data);console.log(JSON.stringify({width,height:data.height,portraits:data.portraits,quotes:data.quotes}));
 if(width===1440||width===390){await page.screenshot({path:new URL(`${label}-${width}-full.png`,out).pathname,fullPage:true});for(const sel of ['#alumni','#teacher','.cl1403c-a-specs']){await page.locator(sel).screenshot({path:new URL(`${label}-${width}-${sel.replace(/[#.]/g,'')}.png`,out).pathname});}}
 await page.close();
}
fs.writeFileSync(new URL(`${label}-measure.json`,out),JSON.stringify(results,null,2));await browser.close();

#!/usr/bin/env node
'use strict';
// Local synthetic fixture only. Compare actual V2 against accepted c230320 CSS.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {execFileSync}=require('child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'), accepted='c230320f8a8329a2ebdbde0cbae802b2cbc918b4';
const cssPath='wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.css';
const assets='wp-content/plugins/missionmed-hub/assets/file-vault-cinematic/';
const out=path.join(root,'_AI_HANDOFFS/from_codex/J1_FILEVAULT_1022_REFINEMENT');
const python=process.env.FV2_PYTHON||'/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const url='http://127.0.0.1:8782/tests/fixtures/file-vault-v2-harness.html?visual=1';
const checks=[],widths=[],errors=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function lease(){const s=JSON.parse(fs.readFileSync('/tmp/filevault-refinement-lease-status.json'));if(s.state!=='healthy'||Date.now()/1000-s.at_unix>15)throw Error('Fresh refinement lease required before evidence writes');}
function check(ok,message){checks.push({pass:!!ok,message});if(!ok)console.error('FAIL '+message);}
const baselineCss=execFileSync('git',['show',accepted+':'+cssPath],{cwd:root}).toString();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function ready(p){await p.waitForSelector('html[data-harness-ready="true"]');await p.locator('.fv2-category-card').last().waitFor({state:'attached'});await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await p.waitForLoadState('networkidle');await p.mouse.move(0,0);}
async function metrics(p){return p.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 const cards=[...document.querySelectorAll('.fv2-category-card')].map(e=>{const t=e.querySelector('strong'),i=e.querySelector('img'),s=getComputedStyle(t),range=document.createRange();range.selectNodeContents(t);return {card:rect(e),title:rect(t),ink:rect(range),description:rect(e.querySelector('small')),image:rect(i),src:i.src,crop:getComputedStyle(i).objectFit,text:t.textContent,attrs:[...e.attributes].map(a=>[a.name,a.value]),size:parseFloat(s.fontSize),weight:s.fontWeight,color:s.color,font:s.fontFamily,lineHeight:s.lineHeight,transition:s.transitionDuration,scrollWidth:t.scrollWidth,clientWidth:t.clientWidth};});
 const layout=[...document.querySelectorAll('.fv2-hud,.fv2-rail,.fv2-cinema-hero,.fv2-cinema-hero h1,.fv2-cinema-actions,.fv2-home-aside,.fv2-category-grid')].map(rect);
 const a=document.querySelector('.fv2-atmosphere'),s=getComputedStyle(a,'::before');return {cards,layout,atmosphere:rect(a),pseudo:{width:parseFloat(s.width),height:parseFloat(s.height)},overflow:document.querySelector('.fv2-stage').scrollWidth>document.querySelector('.fv2-stage').clientWidth+1};
 });}
function pixelDiff(before,after,regions=[]){return JSON.parse(execFileSync(python,['-c',String.raw`
import sys,json,base64,io,math
from PIL import Image,ImageChops,ImageDraw
v=json.load(sys.stdin)
a=Image.open(io.BytesIO(base64.b64decode(v['before']))).convert('RGB');b=Image.open(io.BytesIO(base64.b64decode(v['after']))).convert('RGB')
d=ImageChops.difference(a,b);binary=ImageChops.lighter(ImageChops.lighter(*d.split()[:2]),d.split()[2]).point(lambda p:255 if p else 0);total=sum(1 for p in binary.get_flattened_data() if p)
mask=Image.new('L',a.size,0);draw=ImageDraw.Draw(mask)
for r in v['regions']:draw.rectangle([math.floor(r['x']),math.floor(r['y']),math.ceil(r['x']+r['width']),math.ceil(r['y']+r['height'])],fill=255)
unexpected=ImageChops.subtract(binary,mask)
significant=d.point(lambda p:255 if p>1 else 0);significant=ImageChops.lighter(ImageChops.lighter(*significant.split()[:2]),significant.split()[2]);significant=ImageChops.subtract(significant,mask)
print(json.dumps({'changedPixels':total,'outsideAllowedRegions':sum(1 for p in unexpected.get_flattened_data() if p),'outsideBounds':unexpected.getbbox(),'outsideOverOneLevel':sum(1 for p in significant.get_flattened_data() if p)}))
`],{input:JSON.stringify({before:before.toString('base64'),after:after.toString('base64'),regions}),maxBuffer:20*1024*1024}).toString());}
async function nav(p,view){await p.locator('.fv2-nav-item[data-fv2-view="'+view+'"]').click();await p.mouse.move(0,0);}
(async()=>{
 lease();fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--disable-gpu'],executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  for(const width of [1440,1280,1024,768,390]){
   const pages=[];const captures=[];const measure=[];
   for(const version of ['before','after']){
    const p=await browser.newPage({viewport:{width,height:width===390?844:850},deviceScaleFactor:1,reducedMotion:'reduce'});pages.push(p);p.on('pageerror',e=>errors.push(e.message));
    if(version==='before')await p.route('**/student-os-file-vault-v2.css*',r=>r.fulfill({contentType:'text/css',body:baselineCss}));
    await p.goto(url);await ready(p);measure.push(await metrics(p));lease();captures.push(await p.screenshot({path:path.join(out,'screenshots',version+'-'+width+'.png'),animations:'disabled'}));
   }
   const [before,after]=measure;
   check(after.cards.length===8,width+' all eight category titles');
   check(same(before.layout,after.layout),width+' surrounding layout unchanged');
   check(!after.overflow,width+' no horizontal stage overflow');
   const splitWords=await pages[1].locator('.fv2-category-copy strong').evaluateAll(titles=>titles.flatMap(el=>{
    const text=el.firstChild,result=[];for(const match of text.textContent.matchAll(/\S+/g)){const r=document.createRange();r.setStart(text,match.index);r.setEnd(text,match.index+match[0].length);if(r.getClientRects().length>1)result.push(match[0]);}return result;
   }));check(splitWords.length===0,width+' no split words or single-letter orphans '+JSON.stringify(splitWords));

   for(let i=0;i<8;i++){
    const a=before.cards[i],b=after.cards[i];
    check(['card','description','image','src','crop','text','attrs'].every(k=>same(a[k],b[k])),width+' category '+i+' geometry, photograph, description and destination unchanged');
    check(b.size/a.size>=1.4&&b.size/a.size<=1.501,width+' category '+i+' title enlarged 40–50%');
    check(+b.weight>=800&&b.color==='rgb(255, 255, 255)'&&b.font.includes('Impact'),width+' category '+i+' heavy condensed white title');
    check(b.title.x>=b.card.x&&b.title.y>=b.card.y&&b.title.x+b.title.width<=b.card.x+b.card.width&&b.title.y+b.title.height<=b.description.y&&b.scrollWidth<=b.clientWidth+1,width+' category '+i+' title fits without clipping/overlap');
    check(b.transition==='0s',width+' category '+i+' reduced motion respected');
   }
   const regions=before.cards.concat(after.cards).map(c=>({x:Math.min(c.title.x,c.ink.x)-8,y:Math.min(c.title.y,c.ink.y)-8,width:Math.max(c.title.width,c.ink.width)+16,height:Math.max(c.title.height,c.ink.height)+16}));
   const a=after.atmosphere;let scale,left,top=a.y;
   if(width>=1181){scale=Math.max(after.pseudo.width/1600,after.pseudo.height/667);left=a.x+(after.pseudo.width-1600*scale)/2;top+=(after.pseudo.height-667*scale)/2;}
   else{scale=(width<=760?580:520)/667;left=a.x+(a.width-1600*scale)/2;}
   regions.push({x:left+840*scale-2,y:top+104*scale-2,width:444*scale+4,height:287*scale+4});
   const diff=pixelDiff(...captures,regions);check(diff.outsideOverOneLevel<=width*(width===390?844:850)*0.0001,width+' two-area screenshot regression (one-level raster tolerance; <=0.01% isolated raster noise) '+JSON.stringify(diff));check(diff.changedPixels>0,width+' visible refinement pixels');
   widths.push({width,before,after,diff,allowedRegions:regions});
   if(width===1440){
    const p=pages[1];await p.locator('.fv2-category-card').first().hover();
    const hover=await p.locator('.fv2-category-copy strong').first().evaluate(e=>({transform:getComputedStyle(e).transform,shadow:getComputedStyle(e).textShadow}));
    check(hover.transform.includes('1.03')&&hover.shadow.includes('255, 179, 71'),'hover scales title 3% with amber illumination');lease();await p.screenshot({path:path.join(out,'screenshots/hover-1440.png'),animations:'disabled'});
    await p.mouse.move(0,0);await p.locator('.fv2-category-card').first().focus();await p.keyboard.press('Tab');
    check(await p.locator('.fv2-category-card').nth(1).evaluate(e=>e===document.activeElement&&getComputedStyle(e).outlineStyle!=='none'),'category keyboard focus remains visible');
    await p.keyboard.press('Enter');check(await p.locator('[data-fv2-file-type]').inputValue()==='curriculum_vitae','keyboard Enter opens category destination');
    await nav(p,'vault');
    for(let i=0;i<8;i++){
     const c=after.cards[i],attrs=Object.fromEntries(c.attrs);await p.locator('.fv2-category-card').nth(i).click();
     if(attrs['data-fv2-view']==='shared')check(await p.locator('.fv2-stage').getAttribute('data-fv2-current-view')==='shared','Shared with Me destination retained');
     else check(await p.locator('[data-fv2-file-type]').inputValue()===(attrs['data-fv2-file-group']||'')&&await p.locator('[data-fv2-file-search]').inputValue()===(attrs['data-fv2-category-search']||''),'category '+i+' type/search destination retained');
     await nav(p,'vault');
    }
    for(const q of pages){await nav(q,'files');await q.locator('[data-fv2-file-type]').selectOption('');await q.locator('[data-fv2-file-search]').fill('');await q.mouse.move(0,0);await q.locator('.fv2-header-search input').focus();await q.locator('.fv2-header-search input').evaluate(e=>e.blur());await q.waitForLoadState('networkidle');}
    const secondary=pixelDiff(await pages[0].screenshot({animations:'disabled'}),await pages[1].screenshot({animations:'disabled'}));check(secondary.outsideOverOneLevel<=1440*850*0.0001,'My Files screenshot visually unchanged (<=0.01% raster noise) '+JSON.stringify(secondary));
   }
   for(const p of pages)await p.close();
  }
  const narrow=await browser.newPage({viewport:{width:320,height:844},reducedMotion:'reduce'});await narrow.goto(url);await ready(narrow);const small=await metrics(narrow);
  check(!small.overflow&&small.cards.every(c=>c.scrollWidth<=c.clientWidth+1&&c.title.x+c.title.width<=c.card.x+c.card.width&&c.title.y>=c.card.y),'320px narrow mobile title fit and card geometry');await narrow.close();
  const logo=fs.readFileSync(path.join(root,assets,'mission-residency-logo.png'));
  check(hash(logo)==='7134e0bf375a0917a064bca5382f8c44bc3d33c9e80441f8c1dd11b0d9147f21','supplied Mission Residency logo is byte-identical');
  const svg=fs.readFileSync(path.join(root,assets,'laptop-screen-brand.svg'),'utf8');check(svg.includes(logo.toString('base64')),'SVG embeds unchanged original logo pixels');
  const oldManifest=JSON.parse(execFileSync('git',['show',accepted+':'+assets+'ASSETS.json'],{cwd:root}));
  for(const asset of oldManifest.assets)check(hash(fs.readFileSync(path.join(root,assets,asset.file)))===asset.sha256,'original '+asset.file+' retained byte-identically');
  const js='wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.js';check(fs.readFileSync(path.join(root,js)).equals(execFileSync('git',['show',accepted+':'+js],{cwd:root})),'functional V2 JavaScript unchanged');
  check(errors.length===0,'no browser JavaScript errors');
  lease();fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify({scope:'Local synthetic screenshots; no production or provider behavior changes',accepted,cssSha256:hash(fs.readFileSync(path.join(root,cssPath))),svgSha256:hash(Buffer.from(svg)),checks,widths,errors},null,2)+'\n');
  console.log(checks.filter(c=>c.pass).length+' PASS / '+checks.filter(c=>!c.pass).length+' FAIL');if(checks.some(c=>!c.pass))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

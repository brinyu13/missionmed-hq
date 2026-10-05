'use strict';
// Run from any directory: node /absolute/path/to/shopping-ui.test.js
// Reads the accepted Git object and applies the sibling patch in memory only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const repo=path.resolve(__dirname,'../../../..');
const BASE='b2460b1bd20b7746b2c8a3513186c0e9002f313e';
const read=f=>cp.execFileSync('git',['show',`${BASE}:interview-ready/${f}`],{cwd:repo,encoding:'utf8'});
const patch=fs.readFileSync(path.join(__dirname,'case-fix.patch'),'utf8');
function apply(f){const src=read(f).split('\n');const chunk=patch.split('--- a/').find(x=>x.startsWith('interview-ready/'+f+'\n'));assert(chunk,'Patch file present: '+f);let cursor=0,out=[];const lines=chunk.split('\n');for(let n=2;n<lines.length;n++){const match=lines[n].match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/);if(match){const start=+match[1]-1;out.push(...src.slice(cursor,start));cursor=start;continue;}const line=lines[n];if(line[0]===' '||line[0]==='-'){assert.equal(src[cursor],line.slice(1),'Patch preimage '+f+':'+(cursor+1));if(line[0]===' ')out.push(src[cursor]);cursor++;}else if(line[0]==='+')out.push(line.slice(1));}out.push(...src.slice(cursor));return out.join('\n');}
let completion=apply('completion.js'); const phase=read('phase1.js'),css=read('completion.css'),phaseCss=read('phase1.css');
assert(!completion.includes('shoppingCompare'+'Ids'));
// Simulate lowercasing bare template names where a browser/parser sees attribute syntax.
const bare=/([ \t])\$\{([A-Za-z_$][A-Za-z0-9_$]*)(?=[.\[?])/g;
const boundary=completion.indexOf('const reviewCategories=');
const transformed=completion.slice(0,boundary).replace(bare,(_,space,name)=>space+'${'+name.toLowerCase())+completion.slice(boundary);
if(process.argv.includes('--transformed'))completion=transformed;
new vm.Script(completion);new vm.Script(phase);
assert.deepEqual([...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(x=>x[1]).sort(),['completion.js'].map(x=>'interview-ready/'+x).sort());
const research=JSON.parse(read('catalog.json'));
// Mirror production build.py default-deny media sanitation; denied donor images are absent.
const allowed=new Set(JSON.parse(read('production-assets.json')).assets.map(a=>a.path));
function sanitize(v){if(Array.isArray(v))v.forEach(sanitize);else if(v&&typeof v==='object'){if(v.image&&!allowed.has(v.image)){delete v.image;delete v.imageCredit;}delete v.video;Object.values(v).forEach(sanitize);}}
sanitize(research);research.inperson=[];
const catalogs={online:research.online,'in-person':research.inperson};
for(const [g,cats]of Object.entries(catalogs))for(const c of cats)for(const i of c.items)i.key=`${g}:${c.id}:${i.t}:${i.asin||'plan'}`;
const originalKeys=Object.values(catalogs).flatMap(cs=>cs.flatMap(c=>c.items.map(i=>i.key)));
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const context=vm.createContext({URL,CATALOG:catalogs,RESEARCH:research,PHASE1:{enabledRoutes:[],assetProfile:'production'},ASSET:{},esc,kit:{has:k=>k===originalKeys[0]},tierOf:t=>({name:({bc:'Business Class',fc:'First Class',pj:'Private Jet'})[t],sub:'Considered workflow',icon:''}),ico:()=>'',external:(url,label,cls='')=>`<a class="${cls}" href="${esc(url)}" rel="noopener sponsored">${label} ↗</a>`,amazonUrl:i=>`https://www.amazon.com/dp/${encodeURIComponent(i.asin||'')}?tag=missionmatch-20`,reviewBlock:()=>'',productVisual:()=>'',tierCard:()=>'',renderCatalog:()=>'',document:{},location:{hash:'#online/webcam'},announce:()=>'',ecosystem:()=>'<section class="ecosystem-strip">Existing ecosystem</section>',TIERS:[],bindEditorial:()=>{},paused:true,motionQuery:{matches:true}});
vm.runInContext(completion.slice(0,completion.indexOf('const reviewCategories=')),context);
vm.runInContext(phase.slice(0,phase.indexOf('const renderExpertsBeforePhaseOne')),context);
const evalIn=s=>vm.runInContext(s,context);
let card=evalIn('tierCard(CATALOG.online[0].items[0],CATALOG.online[0],"online")');
assert.match(card,/<details class="shopping-details"><summary>More details/);assert.doesNotMatch(card,/<details[^>]*\bopen\b/);
assert.match(card,/data-kit="online:webcam:bc:B09NBWWP79" aria-pressed="true"/);
assert.match(card,/missionmatch-20/);assert.match(card,/Current price · rating · reviews on Amazon/);
assert.doesNotMatch(card,/product-wordmark|\$\d|★\s*\d|\d[,.]\d\s*(?:stars|reviews)/);
assert.match(card,/View original product photos/);assert.match(card,/Authorized live imagery is not available/);
assert(card.indexOf('Complete')<0||card.indexOf('Complete')>card.indexOf('<details'));
assert.match(evalIn('tierCard(CATALOG.online[0].items[2],CATALOG.online[0],"online")'),/product-canon-r50-cc.webp/);
// Selection constraints, cross-category pair, third-product refusal, explicit replacement, removal and reset.
assert.equal(evalIn('shoppingToggle("online:webcam:0")'),true);
assert.equal(evalIn('shoppingToggle("online:mic:0")'),true);
assert.equal(evalIn('shoppingToggle("online:light:0")'),false);
assert.equal(evalIn('shoppingReplace(1,"alternative:0")'),true);
assert.equal(evalIn('shoppingReplace(1,"online:webcam:0")'),false);
let comparison=evalIn('shoppingComparison()');
assert.match(comparison,/Logitech Brio Ultra 4K/);assert.match(comparison,/DJI Osmo Pocket 3/);assert.match(comparison,/<table class="shopping-matrix"/);
for(const field of ['Resolution / FPS','Product image','Current price','Amazon rating','Review count','Autofocus','Field of view','Microphone specification','Software specification','Ecosystem','Setup complexity','Best for','Required extras','Expert evidence'])assert(comparison.includes(field),field);
assert.match(comparison,/TRADEOFF/);assert.match(comparison,/N\/A/);assert.match(comparison,/MissionMed assessment/);
assert.equal(evalIn('shoppingDifference("Simple","Simple",true)'),'SAME');
assert.equal(evalIn('shoppingDifference(null,null)'),'N/A · not fully recorded');
assert.equal(evalIn('shoppingToggle("alternative:0")'),true);assert.equal(evalIn('shoppingcompareids.filter(Boolean).length'),1);
evalIn('shoppingcompareids=[null,null]');assert.equal(evalIn('shoppingcompareids.filter(Boolean).length'),0);
// Exercise the actual DOM binding callbacks using a bounded host double.
const buttons=['online:webcam:0','online:mic:0','online:light:0'].map(id=>({dataset:{shoppingCompare:id},setAttribute(k,v){this[k]=v},focus(){}}));
const slots=[0,1].map(n=>({dataset:{shoppingSlot:String(n)},value:'',focus(){}}));
const reset={focus(){}},remove={dataset:{shoppingRemove:'online:webcam:0'},focus(){}},panel={innerHTML:''};
context.shoppingHost={querySelectorAll(selector){return selector==='[data-shopping-compare]'?buttons:selector==='[data-shopping-slot]'?slots:selector==='[data-shopping-remove]'?[remove]:[];},querySelector(selector){return selector==='[data-shopping-panel]'?panel:selector==='[data-shopping-reset]'?reset:selector.includes('data-shopping-slot')?slots[selector.includes('"1"')?1:0]:null;}};
evalIn('bindShopping(shoppingHost)');buttons[0].onclick();buttons[1].onclick();buttons[2].onclick();assert.equal(evalIn('shoppingcompareids.filter(Boolean).length'),2);
slots[1].value='alternative:1';slots[1].onchange();assert.equal(evalIn('shoppingcompareids[1]'),'alternative:1');assert.match(panel.innerHTML,/Blue Yeti USB/);
remove.onclick();assert.equal(evalIn('shoppingcompareids.filter(Boolean).length'),1);reset.onclick();assert.equal(evalIn('shoppingcompareids.filter(Boolean).length'),0);assert.match(panel.innerHTML,/0 \/ 2 selected/);
// Regression: labeled selectors remain stable when Product 2 is chosen first.
reset.onclick();slots[1].value='online:webcam:0';slots[1].onchange();
assert.equal(evalIn('shoppingcompareids[0]'),null);assert.equal(evalIn('shoppingcompareids[1]'),'online:webcam:0');
assert.match(panel.innerHTML,/1 \/ 2 selected/);
const secondControl=panel.innerHTML.split('data-shopping-slot="1"')[1].split('</select>')[0];assert.match(secondControl,/value="online:webcam:0" selected/);
slots[0].value='online:mic:0';slots[0].onchange();assert.equal(evalIn('shoppingcompareids[0]'),'online:mic:0');assert.equal(evalIn('shoppingcompareids[1]'),'online:webcam:0');assert.match(panel.innerHTML,/<table class="shopping-matrix"/);
slots[1].value='alternative:0';slots[1].onchange();assert.equal(evalIn('shoppingcompareids[0]'),'online:mic:0');assert.equal(evalIn('shoppingcompareids[1]'),'alternative:0');
slots[0].value='';slots[0].onchange();assert.equal(evalIn('shoppingcompareids[0]'),null);assert.equal(evalIn('shoppingcompareids[1]'),'alternative:0');assert.doesNotMatch(panel.innerHTML,/<table class="shopping-matrix"/);
slots[0].value='online:mic:0';slots[0].onchange();remove.dataset.shoppingRemove='alternative:0';remove.onclick();assert.equal(evalIn('shoppingcompareids[0]'),'online:mic:0');assert.equal(evalIn('shoppingcompareids[1]'),null);
slots[1].value='alternative:1';slots[1].onchange();remove.dataset.shoppingRemove='online:mic:0';remove.onclick();assert.equal(evalIn('shoppingcompareids[0]'),null);assert.equal(evalIn('shoppingcompareids[1]'),'alternative:1');
slots[1].value='';slots[1].onchange();assert.equal(evalIn('shoppingcompareids.filter(Boolean).length'),0);assert.equal(evalIn('shoppingcompareids[0]'),null);assert.equal(evalIn('shoppingcompareids[1]'),null);
reset.onclick();
// Full category render maintains three canonical ordered tiers, has alternatives and comparison panel.
const nodes={};function host(){return{innerHTML:'',setAttribute(){},querySelector(){return null},querySelectorAll(){return[]},insertAdjacentHTML(where,html){this.innerHTML+=html}};}
nodes['catnav-online']=host();nodes['catalog-online']=host();context.document.getElementById=id=>nodes[id];
evalIn('renderCatalog("online")');const html=nodes['catalog-online'].innerHTML;
assert.equal((html.match(/class="tier shopping-tier"/g)||[]).length,3);
assert(html.indexOf('data-tier="bc"')<html.indexOf('data-tier="fc"'));assert(html.indexOf('data-tier="fc"')<html.indexOf('data-tier="pj"'));
assert.match(html,/Other options to consider/);assert.match(html,/Blue Yeti USB/);assert.match(html,/data-shopping-panel/);
// All accepted products and both research alternatives can join a comparison without catalog/kit writes.
for(const id of evalIn('shoppingEntries().map(x=>x.id)')){evalIn('shoppingcompareids=[null,null]');assert.equal(evalIn(`shoppingToggle(${JSON.stringify(id)})`),true);}
assert.deepEqual(Object.values(catalogs).flatMap(cs=>cs.flatMap(c=>c.items.map(i=>i.key))),originalKeys);
// Untrusted names and executable/source URLs remain escaped or fail closed.
context.malicious={...catalogs.online[0].items[0],name:'<img src=x onerror="alert(1)">',source:'javascript:alert(1)',review:{by:'<svg onload=alert(1)>',title:'"><script>alert(1)</script>',url:'data:text/html,evil'}};
let bad=evalIn('tierCard(malicious,CATALOG.online[0],"online")');assert.doesNotMatch(bad,/<img src=x|javascript:|data:text\/html|<script>/);assert.match(bad,/&lt;img/);
assert.match(evalIn('shoppingEvidence(malicious)'),/source unavailable/);
assert.doesNotMatch(evalIn('shoppingLink("https://example.org/?x=\\\" onclick=\\\"evil", "<svg>")'),/href="[^\"]*" onclick=/);
assert.doesNotMatch(evalIn('shoppingLink("https://user:password@example.org/", "Source")'),/href=/);
// Bounded CSS and unchanged engines/routes beyond the assigned shopping segment.
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/\.tier-deck \.tier\.shopping-tier/);assert.match(css,/#page-online \.route-intro\{min-height:185px/);
assert.match(phaseCss,/shopping-photo-fallback/);
assert.equal(completion.slice(completion.indexOf('const reviewCategories=')),read('completion.js').slice(read('completion.js').indexOf('const reviewCategories=')));
assert.equal(phase.slice(phase.indexOf('const renderExpertsBeforePhaseOne')),read('phase1.js').slice(read('phase1.js').indexOf('const renderExpertsBeforePhaseOne')));
console.log('PASS: patch preimages and JS syntax; collapsed shopping cards; three-tier order; licensed/fallback image boundaries; tagged truthful commerce; any-two/alternative/replace/remove/reset; side-by-side fields/differences; escaping and URL protocol rejection; unchanged kit keys and remaining engines.');
console.log('LIMIT: Node VM plus CSS source assertions; browser layout/accessibility, provider hydration, live licensed media qualification and production acceptance are not established.');

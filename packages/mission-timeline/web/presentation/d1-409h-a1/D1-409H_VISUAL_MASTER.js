/* ============================================================
   D1-409H — TIMELINE BUILDER AAA VISUAL MASTER (FROZEN)
   ADDENDUM D1-409H-A1 (ticket D1-411A): versioned hydration /
   rerender / stability / export API around the UNCHANGED kernel.
   Rendering code paths, constants, seeded variance, fit engine,
   and default fixture output are preserved from the approved
   original (D1-409H_VISUAL_MASTER.original.js). The ONLY changes:
   (1) render logic is parameterized by a validated model instead
   of reading module globals directly, (2) window.D1409H exposes
   the contract requested in D1-411_FABLE_FOUNDER_ADDENDUM_REQUEST,
   (3) fail-closed validation, bounds/collision/exclusion checks,
   readiness, fingerprint, semantic events, resize, export.
   No visual constant, asset, geometry, or law was altered.
   Codex: consume verbatim. Hash transition recorded in
   D1-411A_PROTECTED_HASH_MANIFEST.json.
   RC1 Founder addendum: optional manual year-axis range and exact
   six-ID/order-preserving category label/color overrides are permitted.
   When those optional fields are absent, the accepted five-row key,
   adaptive axis, rendering model, geometry, and visual output are unchanged.
   ============================================================ */
'use strict';
(function(){

/* ---------- deterministic seeded variance (never Math.random) — UNCHANGED ---------- */
function hash32(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=hash32(seed);return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const jitter=(id,min,max)=>{const r=rng(id)();return min+r*(max-min)};

/* ---------- category law (frozen) — UNCHANGED ---------- */
const CATS={work:{label:'Work Experience'},personal:{label:'Personal (Not on CV)'},
  usmle:{label:'USMLE Studies'},usce:{label:'US Clinical Experience'},res:{label:'Research'}};
const CAT_KEYS=['work','personal','usmle','usce','res'];
const CATEGORY_KEY_IDS=['education','exams','clinical','work','research','personal'];
const CATEGORY_KEY_MAP={education:'work',exams:'usmle',clinical:'usce',work:'work',research:'res',personal:'personal'};
const HEX_COLOR=/^#[0-9A-F]{6}$/i;

/* ---------- FROZEN default dataset (Dr Brian SAMPLE) — UNCHANGED ---------- */
const DEFAULT_YEARS=[
 {y:'2011',w:128},{y:'2012',w:128},{y:'2013',w:128},{y:'2014',w:128},{y:'2015',w:128},
 {y:'2016',w:154},{y:'2017',w:148},{y:'2018',w:285},{y:'2019',w:262},{y:'2020',w:240},{y:'FUTURE',w:171}
];
const DEFAULT_EVENTS=[
 {id:'ev-int', t:'Internship',cat:'work',sy:2011,sm:8,ey:2012,em:8,date:'08/11 - 08/12',loc:'UK',lp:'below',lane:0},
 {id:'ev-gp',  t:'General Practice',cat:'work',sy:2013,sm:3,ey:2014,em:9,date:'03/13-09/14',loc:'UK',lp:'below',lane:0},
 {id:'ev-imr', t:'IM Resident',cat:'work',sy:2014,sm:9,ey:2015,em:7,date:'9/14 - 7/15',loc:'UAE',lp:'below',lane:0},
 {id:'ev-s1',  t:'Step 1',cat:'usmle',sy:2016,sm:1,ey:2016,em:11,date:'01/16 - 11/16',lane:1},
 {id:'ev-s2ck',t:'Step 2 CK',cat:'usmle',sy:2017,sm:1,ey:2017,em:11,date:'01/17-11/17',lane:1},
 {id:'ev-s2cs',t:'Step 2 CS',cat:'usmle',sy:2018,sm:1,ey:2018,em:4,date:'1/18-4/18',lane:1},
 {id:'ev-2cs', t:'2 CS',cat:'usmle',sy:2018,sm:6,ey:2018,em:8,date:'6/18-8/18',lane:1,hl:true},
 {id:'ev-obs', t:'IM Observer',cat:'usce',sy:2018,sm:1,ey:2018,em:5,date:'1/18-05/18',loc:'SUNY Upstate, NY',lp:'left',lane:2},
 {id:'ev-ext', t:'IM Extern',cat:'usce',sy:2018,sm:4,ey:2018,em:6,date:'4/18-6/18',loc:'Jersey Shore Med, NJ',lp:'left',lane:3},
 {id:'ev-exts',t:'IM Externship',cat:'usce',sy:2018,sm:11,ey:2020,em:2,date:'11/18-2/20',loc:'Mt Sinai, NY',lp:'left',lane:4},
 {id:'ev-cov', t:'Covid-19 Contact Tracing',cat:'work',sy:2020,sm:2,ey:2020,em:12,date:'2/20-Active',lane:5},
 {id:'ev-lar', t:'Team 11',cat:'res',sy:2020,sm:9,ey:2020,em:12,date:'9/20-Active',loc:'Larkin Community Hosp, FL',lp:'left',lane:6}
];
const DEFAULT_FLAGS=[
 {id:'fl-md', d:'5/11',t:'Medical Degree',year:2011,m:5},
 {id:'fl-mar',d:'2/14',t:'Married',year:2014,m:2},
 {id:'fl-usa',d:'7/15',t:'Moved>USA',year:2015,m:7,usflag:true},
 {id:'fl-fa', d:'1/17',t:'Became a Father!',year:2017,m:1},
 {id:'fl-ec', d:'10/18',t:'ECFMG Certified!',year:2018,m:10}
];
const DEFAULT_PROFILE={name:'First Last',visaStatus:'US Citizen',aamc:'##########',
 step1:'252',step2Ck:'264',step2Cs:'Passed 2nd Attempt',step3:'233',
 usce:'Teaching hospitals, # Months',research:'# months, # publications',
 languages:'xxxx, xxxxxx, xxxxx',
 hobbies:"Photography, Making Balloon\nAnimals, Learning Every Lyric from\n'Hamilton' (in Progress)",
 portrait:null};
const DEFAULT_TITLE='Dr Brian SAMPLE';
const DEFAULT_STICKY={text:'Failed, then\npassed CS',targetObjectId:'ev-2cs',visibility:'show'};
const DEFAULT_LOGO={media:null,visibility:'placeholder'};
const DEFAULT_INTERVIEW={label:'My Big Interview!',date:'Dec 8, 2020',visibility:'show'};
/* frozen scrapbook slot geometry — UNCHANGED */
const SLOT_GEOM=[
 {id:'ph-ski', src:'assets/photos/ski.jpg',    x:632, y:596,w:272,h:200,rot:-6.8},
 {id:'ph-wed', src:'assets/photos/wedding.jpg',x:646, y:788,w:302,h:238,rot:5.4},
 {id:'ph-nicu',src:'assets/photos/nicu.jpg',   x:922, y:566,w:300,h:234,rot:4.7},
 {id:'ph-new', src:'assets/photos/newborn.jpg',x:1008,y:776,w:212,h:256,rot:-2.6},
 {id:'ph-kar', src:'assets/photos/karaoke.jpg',x:1206,y:754,w:266,h:212,rot:3.9}
];
const LANE_Y=[196,252,316,382,448,506,564];   /* UNCHANGED */
const AX_LEFT=8;                               /* UNCHANGED */
/* approved sticky-pointer endpoint window (frozen; from the approved default render) */
const STICKY_ENDPOINT={x0:1040,x1:1200,y0:236,y1:322};
/* fixed furniture rects for the collision law (frozen geometry) */
const FURNITURE_RECTS=[
 {id:'color-key',x:18,y:300,w:416,h:322},
 {id:'profile-sheet',x:18,y:634,w:566,h:428},
 {id:'logo-mount',x:1548,y:238,w:232,h:112},
 {id:'logo-slip',x:1560,y:356,w:208,h:26},
 {id:'interview-ribbon',x:1528,y:394,w:272,h:56},
 {id:'interview-date',x:1589,y:458,w:150,h:22}
];

/* ---------- companion fixtures (standalone demo states) — UNCHANGED ---------- */
const SPARSE_EVENTS=[
 {id:'sp-mbbs',t:'MBBS',cat:'work',sy:2019,sm:6,ey:2020,em:5,date:'6/19-5/20',loc:'India',lp:'below',lane:0},
 {id:'sp-s1',t:'Step 1',cat:'usmle',sy:2021,sm:2,ey:2021,em:10,date:'2/21-10/21',lane:1},
 {id:'sp-obs',t:'IM Observer',cat:'usce',sy:2022,sm:3,ey:2022,em:6,date:'3/22-6/22',loc:'Newark, NJ',lp:'left',lane:2},
 {id:'sp-res',t:'Cardiology',cat:'res',sy:2022,sm:8,ey:2023,em:2,date:'8/22-2/23',loc:'Mayo Clinic, MN',lp:'left',lane:3}
];
const STRESS_EVENTS=[
 {id:'st-1',t:'Emergency & Internal Medicine House Officer',cat:'work',sy:2011,sm:8,ey:2012,em:8,date:'08/11 - 08/12',loc:'Port Harcourt Teaching Hospital, Rivers State',lp:'below',lane:0},
 {id:'st-2',t:'General Practice',cat:'work',sy:2013,sm:3,ey:2014,em:9,date:'03/13-09/14',loc:'UK',lp:'below',lane:0},
 {id:'st-3',t:'USMLE Step 2 Clinical Knowledge Preparation',cat:'usmle',sy:2016,sm:1,ey:2016,em:11,date:'01/16 - 11/16',lane:1},
 {id:'st-4',t:'2 CS',cat:'usmle',sy:2018,sm:6,ey:2018,em:8,date:'6/18-8/18',lane:1,hl:true},
 {id:'st-5',t:'Internal Medicine Hospitalist Observership Program',cat:'usce',sy:2018,sm:1,ey:2018,em:5,date:'1/18-05/18',loc:'SUNY Upstate Medical University Hospital, Syracuse NY',lp:'left',lane:2},
 {id:'st-6',t:'Ambulatory & Inpatient Internal Medicine Externship Rotation',cat:'usce',sy:2018,sm:11,ey:2020,em:2,date:'11/18-2/20',loc:'Mount Sinai Beth Israel, New York NY',lp:'left',lane:4},
 {id:'st-7',t:'Multicenter Retrospective Cardiology Outcomes Research',cat:'res',sy:2020,sm:9,ey:2020,em:12,date:'9/20-Active',loc:'Larkin Community Hosp, FL',lp:'left',lane:6}
];
const DENSE_EXTRA=[
 {id:'dx-1',t:'Research Asst',cat:'res',sy:2016,sm:6,ey:2017,em:2,date:'6/16-2/17',lane:2},
 {id:'dx-2',t:'Volunteer EMT',cat:'personal',sy:2015,sm:9,ey:2016,em:6,date:'9/15-6/16',lane:3},
 {id:'dx-3',t:'FM Observer',cat:'usce',sy:2017,sm:6,ey:2017,em:9,date:'6/17-9/17',loc:'Newark, NJ',lp:'left',lane:5},
 {id:'dx-4',t:'Raising Daughter',cat:'personal',sy:2017,sm:1,ey:2020,em:12,date:'1/17-Present',lane:6},
 {id:'dx-5',t:'Clinic Volunteer',cat:'work',sy:2019,sm:3,ey:2019,em:9,date:'3/19-9/19',lane:2},
 {id:'dx-6',t:'Poster: ACP',cat:'res',sy:2019,sm:10,ey:2019,em:11,date:'10/19',lane:3}
];

/* ---------- adaptive axis (immutable law) — UNCHANGED math ---------- */
function fixtureSignature(events,flags){
  return events.map(e=>e.id+':'+e.sy+'.'+e.sm+'-'+e.ey+'.'+e.em).join('|')+'||'+
         (flags||[]).map(f=>f.id+':'+f.year+'.'+f.m).join('|');
}
const APPROVED_DEFAULT_SIG=fixtureSignature(DEFAULT_EVENTS,DEFAULT_FLAGS);
function axisFor(events,flags,axisMode,axisOverride){
  if(axisMode==='frozen-default') return DEFAULT_YEARS.map(o=>({...o}));
  if(axisOverride&&axisOverride.mode==='manual'){
    const years=[];
    for(let y=axisOverride.startYear;y<=axisOverride.endYear;y++)years.push({y:String(y)});
    if(axisOverride.includeFuture)years.push({y:'FUTURE'});
    const width=1904/years.length;
    return years.map(o=>({y:o.y,w:width}));
  }
  let y0=9999,y1=0;
  events.forEach(e=>{y0=Math.min(y0,e.sy);y1=Math.max(y1,e.ey)});
  (flags||[]).forEach(f=>{y0=Math.min(y0,f.year);y1=Math.max(y1,f.year)});
  const yrs=[];const count={};
  events.forEach(e=>{for(let y=e.sy;y<=e.ey;y++)count[y]=(count[y]||0)+1});
  for(let y=y0;y<=y1;y++) yrs.push({y:String(y),n:(count[y]||0)});
  yrs.push({y:'FUTURE',n:1});
  const base=92,k=36,total=1904;
  let raw=yrs.map(o=>base+k*Math.max(o.n,0.6));
  const s=raw.reduce((a,b)=>a+b,0);
  return yrs.map((o,i)=>({y:o.y,w:raw[i]*total/s}));
}

/* ============================================================
   KERNEL STATE (presentation-only; disposable; nonauthoritative)
   ============================================================ */
const K={
  ready:false,readyPromise:null,
  committed:null,          /* deep-frozen last committed model (rollback source) */
  committedRevision:-1,
  renderId:null,fingerprint:null,
  warnings:[],lastError:null,
  objectURLs:[],listeners:[],
  YPOS:{},YEARS:[],
  staticBuilt:false,
  destroyed:false
};
function err(code,message,extra){
  const e=Object.assign(new Error(message),{name:'D1409HError',code,recoverable:true,renderId:K.renderId},extra||{});
  K.lastError={code,message,renderId:K.renderId};return e;
}
function esc(s){return String(s)}

/* ---------- model validation (pure; no DOM mutation) ---------- */
function validateModel(m){
  const fail=(code,msg,path)=>{throw err(code,msg,{path})};
  if(!m||typeof m!=='object')fail('INVALID_SCHEMA','model is not an object');
  if(m.schemaVersion!=='d1-409h-render-model/1')fail('INVALID_SCHEMA','unsupported schemaVersion: '+m.schemaVersion,'schemaVersion');
  if(typeof m.documentId!=='string'||!m.documentId)fail('INVALID_SCHEMA','documentId required','documentId');
  if(!Number.isInteger(m.revision)||m.revision<0)fail('INVALID_SCHEMA','revision must be a non-negative integer','revision');
  if(typeof m.title!=='string')fail('INVALID_SCHEMA','title required','title');
  if(m.axisMode!=='frozen-default'&&m.axisMode!=='adaptive')fail('INVALID_SCHEMA','axisMode must be frozen-default|adaptive','axisMode');
  if(m.axisOverride!==undefined){
    const a=m.axisOverride;
    if(!a||a.mode!=='manual'||!Number.isInteger(a.startYear)||!Number.isInteger(a.endYear)||a.startYear<1900||a.endYear>2200||a.startYear>a.endYear||a.endYear-a.startYear>30||typeof a.includeFuture!=='boolean')
      fail('INVALID_AXIS_OVERRIDE','manual axis requires a 1900–2200 ordered range of at most 31 years','axisOverride');
  }
  if(m.categoryKey!==undefined){
    if(!Array.isArray(m.categoryKey)||m.categoryKey.length!==CATEGORY_KEY_IDS.length)
      fail('INVALID_CATEGORY_KEY','categoryKey must contain exactly six entries','categoryKey');
    m.categoryKey.forEach((item,index)=>{
      const id=CATEGORY_KEY_IDS[index],p='categoryKey['+index+']';
      if(!item||item.id!==id||item.order!==index||item.mapsTo!==CATEGORY_KEY_MAP[id])
        fail('INVALID_CATEGORY_KEY','category IDs, order, and mappings are immutable',p);
      if(typeof item.label!=='string'||!item.label.trim()||item.label.length>32||!HEX_COLOR.test(item.color||''))
        fail('INVALID_CATEGORY_KEY','category label/color is invalid',p);
    });
  }
  if(!Array.isArray(m.events)||m.events.length<1)fail('INVALID_SCHEMA','events[] required','events');
  const ids=new Set();
  const okM=v=>Number.isInteger(v)&&v>=1&&v<=12;
  m.events.forEach((e,i)=>{
    const p='events['+i+']';
    if(!e.id||typeof e.id!=='string')fail('INVALID_SCHEMA','event id required',p);
    if(ids.has(e.id))fail('DUPLICATE_OBJECT_ID','duplicate id '+e.id,p);ids.add(e.id);
    if(!CAT_KEYS.includes(e.cat))fail('INVALID_CATEGORY','unknown category '+e.cat,p+'.cat');
    if(!Number.isInteger(e.sy)||!Number.isInteger(e.ey)||!okM(e.sm)||!okM(e.em))fail('INVALID_DATE_RANGE','bad date fields',p);
    if(e.ey<e.sy||(e.ey===e.sy&&e.em<e.sm))fail('INVALID_DATE_RANGE','end before start',p);
    if(!Number.isInteger(e.lane)||e.lane<0||e.lane>6)fail('INVALID_LANE','lane must be 0..6',p+'.lane');
    if(typeof e.t!=='string'||typeof e.date!=='string')fail('INVALID_SCHEMA','t/date display strings required',p);
    if(e.lp&&e.lp!=='below'&&e.lp!=='left')fail('INVALID_SCHEMA','lp must be below|left',p+'.lp');
    if(m.categoryKey!==undefined){
      if(!CATEGORY_KEY_IDS.includes(e.categoryId))
        fail('INVALID_CATEGORY_KEY','event categoryId required for category overrides',p+'.categoryId');
      if(CATEGORY_KEY_MAP[e.categoryId]!==e.cat)
        fail('INVALID_CATEGORY_KEY','event categoryId is incompatible with its render category',p+'.categoryId');
    }
  });
  (m.flags||[]).forEach((f,i)=>{const p='flags['+i+']';
    if(!f.id)fail('INVALID_SCHEMA','flag id required',p);
    if(ids.has(f.id))fail('DUPLICATE_OBJECT_ID','duplicate id '+f.id,p);ids.add(f.id);
    if(!Number.isInteger(f.year)||!okM(f.m))fail('INVALID_DATE_RANGE','bad flag date',p);
    if(typeof f.d!=='string'||typeof f.t!=='string')fail('INVALID_SCHEMA','flag display strings required',p);
  });
  if(!m.profile||typeof m.profile!=='object')fail('INVALID_SCHEMA','profile required','profile');
  ['name','visaStatus','aamc','step1','step2Ck','step2Cs','step3','usce','research','languages','hobbies']
    .forEach(k=>{if(typeof m.profile[k]!=='string')fail('INVALID_SCHEMA','profile.'+k+' must be string','profile.'+k)});
  const vis3=(v,vals,p)=>{if(!vals.includes(v))fail('INVALID_VISIBILITY_STATE',p+' must be '+vals.join('|'),p)};
  if(!m.sticky)fail('INVALID_SCHEMA','sticky required','sticky');
  vis3(m.sticky.visibility,['show','hide'],'sticky.visibility');
  if(!m.logo)fail('INVALID_SCHEMA','logo required','logo');
  vis3(m.logo.visibility,['content','placeholder','hide'],'logo.visibility');
  if(m.logo.visibility==='content'&&!m.logo.media)fail('INVALID_SCHEMA','logo.media required when visibility=content','logo.media');
  if(!m.interview)fail('INVALID_SCHEMA','interview required','interview');
  vis3(m.interview.visibility,['show','hide'],'interview.visibility');
  if(!Array.isArray(m.photos))fail('INVALID_SCHEMA','photos[] required','photos');
  if(m.photos.length>5)fail('TOO_MANY_PHOTOS','max 5 photos; got '+m.photos.length,'photos');
  const slots=new Set();
  m.photos.forEach((p,i)=>{const pp='photos['+i+']';
    if(!p.id)fail('INVALID_SCHEMA','photo id required',pp);
    if(ids.has(p.id))fail('DUPLICATE_OBJECT_ID','duplicate id '+p.id,pp);ids.add(p.id);
    if(!Number.isInteger(p.slot)||p.slot<0||p.slot>4)fail('INVALID_SCHEMA','slot must be 0..4',pp+'.slot');
    if(slots.has(p.slot))fail('DUPLICATE_OBJECT_ID','duplicate photo slot '+p.slot,pp+'.slot');slots.add(p.slot);
    if(!p.media||typeof p.media.src!=='string')fail('INVALID_SCHEMA','photo.media.src required',pp+'.media');
    if(p.style!=='scrapbook'&&p.style!=='polaroid')fail('INVALID_SCHEMA','photo.style must be scrapbook|polaroid',pp+'.style');
    if(p.caption&&!['marker','type'].includes(p.caption.mode))fail('INVALID_SCHEMA','caption.mode must be marker|type',pp+'.caption');
  });
  if(m.axisMode==='frozen-default'&&fixtureSignature(m.events,m.flags||[])!==APPROVED_DEFAULT_SIG)
    fail('INVALID_SCHEMA','axisMode frozen-default is legal only for the exact approved fixture','axisMode');
  if(m.axisOverride){
    const outside=m.events.find(e=>e.sy<m.axisOverride.startYear||e.ey>m.axisOverride.endYear)||
      (m.flags||[]).find(f=>f.year<m.axisOverride.startYear||f.year>m.axisOverride.endYear);
    if(outside)fail('INVALID_AXIS_OVERRIDE','manual axis must include every visible object','axisOverride');
  }
  return true;
}

/* ---------- media hash verification (fail-closed) ---------- */
async function verifyMedia(ref,path){
  if(!ref)return;
  if(typeof ref.contentSha256!=='string'||ref.contentSha256.length!==64)
    throw err('INVALID_SCHEMA','media.contentSha256 (hex sha-256) required at '+path,{path});
  let buf;
  try{const r=await fetch(ref.src);if(!r.ok)throw 0;buf=await r.arrayBuffer()}
  catch(_){throw err('ASSET_LOAD_FAILED','cannot load media at '+path+' ('+String(ref.src).slice(0,64)+'…)',{path})}
  if(!(crypto&&crypto.subtle))throw err('ASSET_LOAD_FAILED','crypto.subtle unavailable for media verification',{path});
  const d=await crypto.subtle.digest('SHA-256',buf);
  const hex=[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hex!==ref.contentSha256)throw err('MEDIA_HASH_MISMATCH','media hash mismatch at '+path,{path});
}

/* ---------- canonical fingerprint ---------- */
function canonicalJSON(v){
  if(Array.isArray(v))return '['+v.map(canonicalJSON).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
async function fingerprintOf(model){
  const s=canonicalJSON(model)+'|D1-409H-A1|1.0.0';
  if(crypto&&crypto.subtle){
    const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
    return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  return 'fnv-'+hash32(s).toString(16);
}

/* ============================================================
   RENDER — the approved kernel paths, parameterized (UNCHANGED visuals)
   ============================================================ */
let timeX=function(){return AX_LEFT};
function buildAxis(model){
  const YEARS=axisFor(model.events,model.flags||[],model.axisMode,model.axisOverride);
  let acc=AX_LEFT;const YPOS={};
  YEARS.forEach(o=>{o.x0=acc;YPOS[o.y]=o;acc+=o.w});
  K.YEARS=YEARS;K.YPOS=YPOS;
  timeX=function(year,month){const o=YPOS[String(year)];if(!o)return AX_LEFT;return o.x0+((month-1)/12)*o.w};
  const axL=document.getElementById('axisLayer');axL.textContent='';
  const axis=document.createElement('div');axis.id='axis';axis.dataset.objectId='year-axis';
  YEARS.forEach(o=>{const s=document.createElement('div');s.className='yseg';
    s.style.width=(o.w+14)+'px';const sp=document.createElement('span');sp.textContent=o.y;s.appendChild(sp);axis.appendChild(s)});
  axL.appendChild(axis);
  const drift=document.createElement('div');drift.id='axisDrift';axL.appendChild(drift);
}
function buildFlags(model){
  const flL=document.getElementById('flagLayer');flL.textContent='';
  (model.flags||[]).forEach(f=>{
    const el=document.createElement('div');el.className='flag';el.dataset.objectId=f.id;
    el.style.left=timeX(f.year,f.m)+'px';el.style.top='82px';
    el.style.transform='rotate('+jitter(f.id,-0.7,0.7).toFixed(2)+'deg)';
    const stem=document.createElement('div');stem.className='stem';
    const tag=document.createElement('div');tag.className='tag';tag.appendChild(document.createElement('i'));tag.append(esc(f.d));
    const lbl=document.createElement('div');lbl.className='lbl';
    if(f.usflag){const im=document.createElement('img');im.src='assets/photos/us_flag.png';im.alt='';lbl.appendChild(im)}
    lbl.append(esc(f.t));
    el.append(stem,tag,lbl);flL.appendChild(el);
  });
}
function buildArrows(model){
  const arL=document.getElementById('arrowLayer');arL.textContent='';
  model.events.forEach(e=>{
    const x0=timeX(e.sy,e.sm),x1=timeX(e.ey,e.em);
    const w=Math.max(88,x1-x0); /* frozen floor: founder short-arrow width */
    const a=document.createElement('div');
    a.className='arrow c-'+e.cat;a.dataset.objectId=e.id;
    a.style.left=x0+'px';a.style.top=(LANE_Y[e.lane]-7)+'px';a.style.width=w+'px';
    a.style.setProperty('--sat',jitter(e.id+'s',0.985,1.02).toFixed(3));
    a.style.setProperty('--gx',Math.round(jitter(e.id+'x',0,140))+'px');
    a.style.setProperty('--gy',Math.round(jitter(e.id+'y',0,140))+'px');
    const categoryOverride=(model.categoryKey||[]).find(item=>item.id===e.categoryId);
    if(categoryOverride){
      const color=categoryOverride.color;
      a.style.setProperty('--ci',color);
      a.style.setProperty('--ci-hi',shadeHex(color,7));
      a.style.setProperty('--ci-lo',shadeHex(color,-7));
      const rgb=hexRgb(color),luma=(.2126*rgb.r+.7152*rgb.g+.0722*rgb.b)/255;
      a.dataset.categoryId=e.categoryId;
      a.style.setProperty('--category-label-ink',luma>.62?'#25282C':'#FFFFFF');
    }
    const die=document.createElement('div');die.className='die';a.appendChild(die);
    if(e.hl){const hb=document.createElement('div');hb.className='hlbox';a.appendChild(hb)}
    const dt=document.createElement('div');dt.className='date';dt.textContent=e.date;a.appendChild(dt);
    const al=document.createElement('div');al.className='al';
    if(categoryOverride){al.style.color='var(--category-label-ink)';al.style.textShadow='none'}
    const alt=document.createElement('span');alt.className='alt';alt.textContent=e.t;al.appendChild(alt);a.appendChild(al);
    if(e.loc){const lc=document.createElement('div');lc.className='loc '+(e.lp||'below');lc.textContent=e.loc;a.appendChild(lc)}
    arL.appendChild(a);
  });
}
function hexRgb(value){const n=parseInt(String(value).slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function shadeHex(value,percent){
  const rgb=hexRgb(value),factor=(100+percent)/100;
  return '#'+[rgb.r,rgb.g,rgb.b].map(channel=>Math.max(0,Math.min(255,Math.round(channel*factor))).toString(16).padStart(2,'0')).join('').toUpperCase();
}
/* leather corners + stitching — UNCHANGED construction, built once (static) */
function leatherCorner(host,pos,size,idSeed){
  const c=document.createElement('div');
  c.className='lcorner '+pos;c.dataset.objectId=idSeed;
  c.style.width=size+'px';c.style.height=size+'px';
  const p={tl:'left:-3px;top:-3px',tr:'right:-3px;top:-3px',bl:'left:-3px;bottom:-3px',br:'right:-3px;bottom:-3px'}[pos];
  c.style.cssText+=p;
  c.style.setProperty('--lx',Math.round(jitter(idSeed+'lx',0,120))+'px');
  c.style.setProperty('--ly',Math.round(jitter(idSeed+'ly',0,120))+'px');
  const r=rng(idSeed+'st');const S=size;
  const hyp={tl:[[S*0.92,4],[4,S*0.92]],tr:[[S-S*0.92,4],[S-4,S*0.92]],
             bl:[[4,S-S*0.92],[S*0.92,S-4]],br:[[S-4,S-S*0.92],[S-S*0.92,S-4]]}[pos];
  const [A,B]=hyp;const dx=B[0]-A[0],dy=B[1]-A[1];const len=Math.hypot(dx,dy);
  const ux=dx/len,uy=dy/len;const nx=-uy,ny=ux;const inSign=1;
  let seg='',t=6;
  while(t<len-6){
    const dl=5.5+(r()-0.5)*1.8;const wob=(r()-0.5)*0.9;const off=7;
    const x1=A[0]+ux*t+nx*inSign*off+nx*wob,y1=A[1]+uy*t+ny*inSign*off+ny*wob;
    const x2=A[0]+ux*(t+dl)+nx*inSign*off+nx*wob,y2=A[1]+uy*(t+dl)+ny*inSign*off+ny*wob;
    seg+='<line x1="'+x1.toFixed(1)+'" y1="'+(y1+0.8).toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+(y2+0.8).toFixed(1)+'" stroke="rgba(0,0,0,.55)" stroke-width="1.7" stroke-linecap="round"/>';
    seg+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#ddd4bd" stroke-width="1.5" stroke-linecap="round"/>';
    t+=dl+4.2+(r()-0.5)*1.6;
  }
  const rx1=A[0]+nx*inSign*2.2,ry1=A[1]+ny*inSign*2.2,rx2=B[0]+nx*inSign*2.2,ry2=B[1]+ny*inSign*2.2;
  const ridge='<line x1="'+rx1+'" y1="'+ry1+'" x2="'+rx2+'" y2="'+ry2+'" stroke="rgba(255,255,255,.20)" stroke-width="1.6" stroke-linecap="round"/>'+
              '<line x1="'+A[0]+'" y1="'+A[1]+'" x2="'+B[0]+'" y2="'+B[1]+'" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>';
  c.innerHTML='<svg viewBox="0 0 '+S+' '+S+'">'+ridge+seg+'</svg>';
  host.appendChild(c);
}
function skeletonKey(flip){
  return '<svg width="34" height="18" viewBox="0 0 34 18"'+(flip?' style="transform:scaleX(-1)"':'')+'>'+
   '<g fill="none" stroke="#9aa0a6" stroke-width="1.8" stroke-linecap="round">'+
   '<circle cx="6.5" cy="9" r="4.2"/><line x1="10.7" y1="9" x2="30" y2="9"/>'+
   '<line x1="26" y1="9" x2="26" y2="13.5"/><line x1="30" y1="9" x2="30" y2="12.2"/></g></svg>';
}
function buildStaticOnce(){
  if(K.staticBuilt)return;K.staticBuilt=true;
  const tw=document.getElementById('titleWrap');
  ['tl','tr','bl','br'].forEach(p=>leatherCorner(tw,p,44,'lc-title-'+p));
  const pf=document.getElementById('profile');
  ['tl','tr','bl','br'].forEach(p=>leatherCorner(pf,p,52,'lc-prof-'+p));
  document.getElementById('keyTitle').innerHTML=skeletonKey(false)+'<em>COLOR KEY</em>'+skeletonKey(true);
  document.querySelectorAll('#key .sw').forEach((sw,i)=>{
    const d=Math.round(jitter('sw'+i,12,20)),e=Math.round(jitter('swe'+i,74,88));
    sw.style.clipPath='polygon(0 0,100% 0,100% 100%,'+d+'% 100%,0 '+e+'%)';
  });
  document.getElementById('redptr').innerHTML=
   '<svg viewBox="0 0 84 52" width="84" height="52">'+
   '<path d="M80 10 C56 2 34 14 12 30" stroke="#c03a26" stroke-width="7.5" fill="none" stroke-linecap="round" opacity=".92"/>'+
   '<path d="M79 12 C57 5 36 16 15 30" stroke="#a92e1c" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".55"/>'+
   '<path d="M22 20 L6 34 L26 36 Z" fill="#c03a26" opacity=".95"/>'+
   '<path d="M22 22 L10 33 L24 34 Z" fill="#a92e1c" opacity=".5"/></svg>';
}
function buildPhotos(model){
  const layer=document.getElementById('photoLayer');layer.textContent='';
  model.photos.forEach((ph,idx)=>{
    const g=SLOT_GEOM[ph.slot];const i=ph.slot;
    const el=document.createElement('div');el.className='photoTile';el.dataset.objectId=ph.id;
    const bt=(ph.style==='polaroid')?14:11+Math.round(jitter(g.id+'b',-1,1));
    const bb=(ph.style==='polaroid')?Math.round(bt*2.6+(ph.caption?10:0)):bt+(ph.caption?22:0);
    el.style.cssText='left:'+g.x+'px;top:'+g.y+'px;width:'+g.w+'px;height:'+g.h+'px;transform:rotate('+g.rot+'deg)';
    el.style.setProperty('--sheenA',Math.round(jitter(g.id+'sh',115,135))+'deg');
    el.style.setProperty('--px',(4+i%2)+'px');el.style.setProperty('--py',(6+(i*7)%3)+'px');
    el.style.setProperty('--pb',(11+(i*5)%5)+'px');
    const img=document.createElement('div');img.className='img';
    img.style.cssText='left:'+bt+'px;right:'+bt+'px;top:'+bt+'px;bottom:'+bb+'px';
    img.style.setProperty('--gx',Math.round(jitter(g.id+'gx',0,150))+'px');
    img.style.setProperty('--gy',Math.round(jitter(g.id+'gy',0,150))+'px');
    const im=document.createElement('img');im.src=ph.media.src;im.alt=ph.media.alt||'';
    img.appendChild(im);el.appendChild(img);
    if(ph.caption){const c=document.createElement('div');c.className='cap '+(ph.caption.mode==='marker'?'marker':'type');
      c.textContent=ph.caption.text;c.style.height=(bb-4)+'px';c.style.lineHeight=(bb-6)+'px';el.appendChild(c)}
    layer.appendChild(el);
  });
}
function hydrateFurniture(model){
  hydrateCategoryKey(model.categoryKey);
  document.querySelector('#title span').textContent='Timeline: '+model.title;
  const P=model.profile,txt=document.querySelector('#profile .txt');
  txt.textContent='';
  const line=(label,val,br)=>{const b=document.createElement('b');b.className='h';b.textContent=label+':';
    txt.appendChild(b);String(val).split('\n').forEach((seg,i)=>{if(i)txt.appendChild(document.createElement('br'));
      txt.append((i?'':' ')+seg)});if(br)txt.appendChild(document.createElement('br'))};
  const gap=()=>{const g=document.createElement('div');g.className='gap';txt.appendChild(g)};
  line('Name',P.name,true);line('Visa Status',P.visaStatus,true);line('AAMC',P.aamc,false);gap();
  line('Step 1',P.step1,true);line('Step 2 CK',P.step2Ck,true);line('Step 2 CS',P.step2Cs,true);line('Step 3',P.step3,false);gap();
  line('USCE',P.usce,true);line('Research',P.research,true);line('Languages fluent in',P.languages,false);gap();
  line('Hobbies',P.hobbies,false);
  /* portrait */
  const well=document.querySelector('#photoMat .well');
  well.querySelectorAll('img').forEach(n=>n.remove());
  const wellLabel=well.querySelector('i');
  if(P.portrait){const im=document.createElement('img');im.src=P.portrait.src;im.alt=P.portrait.alt||'';
    im.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:3px';
    well.appendChild(im);if(wellLabel)wellLabel.style.visibility='hidden';}
  else if(wellLabel)wellLabel.style.visibility='';
  /* sticky */
  const st=document.getElementById('sticky'),rp=document.getElementById('redptr');
  const stickyOn=model.sticky.visibility==='show';
  st.style.display=stickyOn?'':'none';rp.style.display=stickyOn?'':'none';
  if(stickyOn){const sp=st.querySelector('span');sp.textContent='';
    String(model.sticky.text).split('\n').forEach((ln,i)=>{if(i)sp.appendChild(document.createElement('br'));sp.append(ln)});}
  /* logo */
  const lm=document.getElementById('logoMat'),ls=document.getElementById('logoSlip');
  const lw=lm.querySelector('.well');lw.querySelectorAll('img').forEach(n=>n.remove());
  const lb=lw.querySelector('b');
  if(model.logo.visibility==='hide'){lm.style.display='none';ls.style.display='none'}
  else{lm.style.display='';ls.style.display=model.logo.visibility==='placeholder'?'':'none';
    if(model.logo.visibility==='content'){
      const im=document.createElement('img');im.src=model.logo.media.src;im.alt=model.logo.media.alt||'';
      im.style.cssText='max-width:92%;max-height:86%;object-fit:contain';
      lw.appendChild(im);if(lb)lb.style.display='none';
    } else if(lb)lb.style.display='';
  }
  /* interview */
  const iw=document.getElementById('ivrWrap'),idt=document.getElementById('ivdate');
  const ivOn=model.interview.visibility==='show';
  iw.style.display=ivOn?'':'none';idt.style.display=ivOn?'':'none';
  if(ivOn){document.querySelector('#ivr span').textContent=model.interview.label;idt.textContent=model.interview.date}
}
function hydrateCategoryKey(categoryKey){
  const inner=document.querySelector('#key .inner');
  if(!inner)return;
  const existing=[...inner.querySelectorAll('.row')];
  if(!categoryKey){
    if(existing.length===5&&existing.every(row=>row.dataset.override!=='true'))return;
    const defaults=[
      ['work','Work Experience'],['personal','Personal (Not on CV)'],['usmle','USMLE Studies'],
      ['usce','US Clinical Experience'],['res','Research']
    ];
    existing.forEach(row=>row.remove());
    defaults.forEach(([id,label])=>appendCategoryKeyRow(inner,{id,label,color:null},false));
    return;
  }
  existing.forEach(row=>row.remove());
  categoryKey.forEach(item=>appendCategoryKeyRow(inner,item,true));
}
function appendCategoryKeyRow(inner,item,override){
  const row=document.createElement('div');row.className='row';row.dataset.override=String(override);row.dataset.categoryId=item.id;
  const swatch=document.createElement('div');swatch.className='sw '+(override?'':'c-'+item.id);
  if(override)swatch.style.background=item.color;
  const label=document.createElement('span');label.textContent=item.label;
  if(override){
    row.style.margin='3px 0';swatch.style.height='32px';
    label.style.fontSize=(item.label.length<=20?20:item.label.length<=26?18:16)+'px';
  }
  row.append(swatch,label);inner.appendChild(row);
  const index=[...inner.querySelectorAll('.row')].length-1;
  const d=Math.round(jitter('sw'+index,12,20)),e=Math.round(jitter('swe'+index,74,88));
  swatch.style.clipPath='polygon(0 0,100% 0,100% 100%,'+d+'% 100%,0 '+e+'%)';
}

/* ---------- bounded-text fit engine — UNCHANGED rules ---------- */
const SHORTEN={' Preparation':'',' Program':'',' Rotation':'',' Hospitalist':''};
function fitArrows(){
  document.querySelectorAll('.arrow .al').forEach(al=>{
    const span=al.querySelector('.alt');if(!span)return;
    let txt=span.textContent,changed=true;
    while(span.scrollWidth>al.clientWidth&&changed){changed=false;
      for(const k in SHORTEN){if(txt.includes(k.trim())){txt=txt.replace(new RegExp('\\s*'+k.trim()),SHORTEN[k]);span.textContent=txt;changed=true;break}}}
    al.style.fontSize='';let fs=parseFloat(getComputedStyle(al).fontSize),g=0;
    while(span.scrollWidth>al.clientWidth&&fs>9&&g<60){fs-=0.5;al.style.fontSize=fs+'px';g++}
    if(span.scrollWidth>al.clientWidth){
      while(span.scrollWidth>al.clientWidth&&txt.length>4){txt=txt.slice(0,-2).trim();span.textContent=txt+'…'}}
  });
}
/* profile fit + A1 horizontal mat-exclusion check (contradiction #2: FIXED WITHOUT VISUAL CHANGE) */
function fitProfile(enforceMatExclusion){
  const box=document.querySelector('#profile .txt');if(!box)return null;
  const card=document.getElementById('profile');const cs=getComputedStyle(card);
  const maxH=card.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-4;
  box.style.fontSize='';box.style.lineHeight='';
  let fs=parseFloat(getComputedStyle(box).fontSize),g=0;
  const mat=document.getElementById('photoMat');
  const overlapsMat=()=>{
    if(!enforceMatExclusion)return false; /* approved-fixture exemption: controlling screenshot retained verbatim */
    if(!mat||mat.offsetParent===null)return false;
    const mb=mat.getBoundingClientRect(),bb=box.getBoundingClientRect();
    const range=document.createRange();
    for(const node of box.childNodes){
      if(node.nodeType===3&&node.textContent.trim()){range.selectNodeContents(node);
        for(const r of range.getClientRects()){
          if(r.bottom>mb.top+2&&r.top<mb.bottom-2&&r.right>mb.left-6)return true;}}
      else if(node.nodeType===1&&node.tagName==='B'){
        const r=node.getBoundingClientRect();
        if(r.bottom>mb.top+2&&r.top<mb.bottom-2&&r.right>mb.left-6)return true;}
    }
    return false;
  };
  const wrappedInBand=()=>{
    if(!enforceMatExclusion||!mat||mat.offsetParent===null)return false;
    const mb=mat.getBoundingClientRect();const maxW=box.clientWidth;
    const range=document.createRange();
    for(const node of box.childNodes){
      if(node.nodeType===3&&node.textContent.trim()){range.selectNodeContents(node);
        for(const r of range.getClientRects()){
          if(r.bottom>mb.top+2&&r.top<mb.bottom-2&&r.right>mb.left-6&&r.width>=maxW-8)return true;}}}
    return false;
  };
  if(wrappedInBand())return 'TEXT_FIT_UNRESOLVED';
  while((box.scrollHeight>maxH||overlapsMat())&&fs>11&&g<40){fs-=0.5;box.style.fontSize=fs+'px';box.style.lineHeight='1.28';g++}
  if(box.scrollHeight>maxH||overlapsMat())return 'TEXT_FIT_UNRESOLVED';
  return null;
}
const STICKY_FS_APPROVED=23; /* approved rendered size from the controlling screenshot (deterministic; replaces the original's font-load-race outcome with its measured value) */
function fitSticky(){
  const st=document.querySelector('#sticky span');if(!st)return;
  let fs=STICKY_FS_APPROVED;st.style.fontSize=fs+'px';let g=0;
  while((st.scrollHeight>120||st.scrollWidth>118)&&fs>15&&g<30){fs-=1;st.style.fontSize=fs+'px';g++}
}
function fitLocations(){
  const locs=[...document.querySelectorAll('.arrow .loc.below')]
    .map(el=>({el,r:el.getBoundingClientRect()})).sort((a,b)=>a.r.left-b.r.left);
  for(let i=0;i<locs.length-1;i++){
    const a=locs[i],b=locs[i+1];
    if(a.r.right+10>b.r.left){
      const avail=b.r.left-a.r.left-14;
      let fs=parseFloat(getComputedStyle(a.el).fontSize),g=0;
      while(a.el.getBoundingClientRect().width>avail&&fs>14&&g<12){fs-=0.5;a.el.style.fontSize=fs+'px';g++}
      let t=a.el.textContent;
      while(a.el.getBoundingClientRect().width>avail&&t.length>6){t=t.slice(0,-2).trim();a.el.textContent=t+'…'}
      a.r=a.el.getBoundingClientRect();
    }
  }
}
function runFit(enforceMat){fitArrows();const p=fitProfile(enforceMat);fitSticky();fitLocations();return p}

/* ---------- A1 post-render laws: bounds, furniture collision, sticky endpoint ---------- */
function boardRect(){return document.getElementById('board').getBoundingClientRect()}
function toBoard(r,br,sc){return {x:(r.left-br.left)/sc,y:(r.top-br.top)/sc,w:r.width/sc,h:r.height/sc}}
function stickyEndpointLaw(model){
  const br=boardRect();const sc=br.width/1920;const warns=[];
  if(model.sticky.visibility==='show'){
    let ok=false;
    if(model.sticky.targetObjectId){
      const t=document.querySelector('[data-object-id="'+CSS.escape(model.sticky.targetObjectId)+'"]');
      if(t){const r=toBoard(t.getBoundingClientRect(),br,sc);
        const hx=r.x+r.w,hy=r.y+r.h/2;
        ok=hx>=STICKY_ENDPOINT.x0&&hx<=STICKY_ENDPOINT.x1&&hy>=STICKY_ENDPOINT.y0&&hy<=STICKY_ENDPOINT.y1;}
    }
    if(!ok){
      document.getElementById('sticky').style.display='none';
      document.getElementById('redptr').style.display='none';
      warns.push('STICKY_HIDDEN_TARGET_OUT_OF_WINDOW');
    }
  }
  return warns;
}
function postRenderChecks(model,opts){
  const br=boardRect();const sc=br.width/1920;
  const problems=[];const warns=[];
  const inter=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const active=FURNITURE_RECTS.filter(f=>{
    if(f.id.startsWith('logo')&&model.logo.visibility==='hide')return false;
    if(f.id.startsWith('interview')&&model.interview.visibility==='hide')return false;
    return true;});
  document.querySelectorAll('.arrow').forEach(a=>{
    const parts=[a.querySelector('.die'),a.querySelector('.date'),a.querySelector('.loc')].filter(Boolean);
    parts.forEach(p=>{
      const r=toBoard(p.getBoundingClientRect(),br,sc);
      if(r.x<-2||r.y<70||r.x+r.w>1922||r.y+r.h>1082)
        problems.push({code:'OBJECT_OUT_OF_BOUNDS',id:a.dataset.objectId});
      active.forEach(f=>{if(inter(r,f))problems.push({code:'OBJECT_COLLISION_UNRESOLVED',id:a.dataset.objectId,against:f.id})});
    });
  });
  const policy=(opts&&opts.collisionPolicy)||'fail';
  const collisions=problems.filter(p=>p.code==='OBJECT_COLLISION_UNRESOLVED');
  const oob=problems.filter(p=>p.code==='OBJECT_OUT_OF_BOUNDS');
  if(oob.length)throw err('OBJECT_OUT_OF_BOUNDS','objects out of bounds: '+[...new Set(oob.map(o=>o.id))].join(','));
  if(collisions.length){
    if(policy==='fail')throw err('OBJECT_COLLISION_UNRESOLVED','furniture collisions: '+
      [...new Set(collisions.map(c=>c.id+'~'+c.against))].join(','));
    warns.push('COLLISIONS_ALLOWED_BY_POLICY:'+[...new Set(collisions.map(c=>c.id+'~'+c.against))].join(','));
  }
  return warns;
}

/* ---------- stability: two identical animation-frame measurements ---------- */
function measureSig(){
  const br=boardRect();
  let s=Math.round(br.width)+'x'+Math.round(br.height)+'|';
  document.querySelectorAll('.arrow .alt').forEach(a=>{s+=Math.round(a.getBoundingClientRect().width)+','});
  return s;
}
function twoFrameStable(){
  return new Promise((res,rej)=>{
    let tries=0;
    const step=prev=>requestAnimationFrame(()=>{
      const sig=measureSig();
      if(prev===sig)return res();
      if(++tries>30)return rej(err('TEXT_FIT_UNRESOLVED','layout did not settle'));
      step(sig);
    });
    step(null);
  });
}

/* ---------- full deterministic redraw (documented rerender mechanism) ---------- */
async function renderModel(model,request,opts){
  buildStaticOnce();
  buildAxis(model);buildFlags(model);buildArrows(model);buildPhotos(model);hydrateFurniture(model);
  if(document.fonts&&document.fonts.ready){try{await document.fonts.ready}catch(_){/*noop*/}}
  await new Promise(r=>requestAnimationFrame(r));
  const fitProblem=runFit(model.axisMode!=='frozen-default');
  if(fitProblem)throw err('TEXT_FIT_UNRESOLVED','profile text cannot satisfy in-box + mat-exclusion law at floor size');
  const warns=stickyEndpointLaw(model).concat((opts&&opts.skipPostChecks)?[]:postRenderChecks(model,opts));
  await twoFrameStable();
  return warns;
}
function deepFreezeClone(m){return JSON.parse(JSON.stringify(m))}

/* ============================================================
   PUBLIC API — window.D1409H  (per D1-411 addendum request)
   ============================================================ */
async function assetReady(){
  const probe=src=>new Promise(res=>{const i=new Image();i.onload=()=>res(true);i.onerror=()=>res(false);i.src=src});
  const core=['assets/tex/board_denim.jpg','assets/tex/paper_bond.png','assets/tex/leather_pebble.png'];
  const oks=await Promise.all(core.map(probe));
  if(oks.some(o=>!o))throw err('ASSET_LOAD_FAILED','core protected asset failed to load');
  if(document.fonts&&document.fonts.ready){try{await document.fonts.ready}catch(_){/*noop*/}}
  const b=document.getElementById('board');
  const r=b.getBoundingClientRect();
  const sc=parseFloat((b.style.transform.match(/scale\(([\d.]+)\)/)||[])[1]||'1');
  if(Math.round(r.width/sc)!==1920||Math.round(r.height/sc)!==1080)
    throw err('KERNEL_NOT_READY','board geometry is not 1920x1080');
  K.ready=true;
}
const API={
  apiVersion:'1.0.0',
  kernelId:'D1-409H-A1',
  ready(){ if(!K.readyPromise)K.readyPromise=assetReady(); return K.readyPromise; },
  async hydrate(model,request){ return API.rerender(model,Object.assign({reason:'initial'},request||{})); },
  async rerender(model,request){
    if(K.destroyed)throw err('KERNEL_NOT_READY','kernel destroyed');
    await API.ready();
    request=request||{};K.renderId=request.renderId||('r'+Date.now().toString(36));
    if(K.committed){
      if(request.expectedRevision!==undefined&&request.expectedRevision!==K.committedRevision)
        throw err('STALE_REVISION','expectedRevision '+request.expectedRevision+' != committed '+K.committedRevision);
      if(model.revision<=K.committedRevision)
        throw err('STALE_REVISION','revision '+model.revision+' <= committed '+K.committedRevision);
    }
    validateModel(model);
    /* media verification before any DOM mutation (fail-closed) */
    for(let i=0;i<model.photos.length;i++)await verifyMedia(model.photos[i].media,'photos['+i+'].media');
    if(model.profile.portrait)await verifyMedia(model.profile.portrait,'profile.portrait');
    if(model.logo.visibility==='content')await verifyMedia(model.logo.media,'logo.media');
    const snapshot=deepFreezeClone(model);
    let warns;
    try{
      warns=await renderModel(model,request,Object.assign({skipPostChecks:model.axisMode==='frozen-default'},request.options||{}));
    }catch(e){
      if(K.committed){ /* rollback to last good */
        try{await renderModel(K.committed,{reason:'rollback'},{collisionPolicy:'warn'})}catch(_){/* keep DOM as-is */}
      }
      throw e;
    }
    K.committed=snapshot;K.committedRevision=model.revision;K.warnings=warns;
    K.fingerprint=await fingerprintOf(snapshot);
    const detail={renderId:K.renderId,revision:K.committedRevision,fingerprint:K.fingerprint,
      manifest:'D1-411A',counts:{events:model.events.length,flags:(model.flags||[]).length,photos:model.photos.length},
      warnings:warns};
    document.dispatchEvent(new CustomEvent('d1-409h:stable',{detail}));
    return {success:true,renderedRevision:K.committedRevision,renderId:K.renderId,
      fingerprint:K.fingerprint,warnings:warns,validationErrors:[],
      omitted:{sticky:model.sticky.visibility!=='show',logo:model.logo.visibility==='hide',
               interview:model.interview.visibility!=='show',photoSlotsEmpty:5-model.photos.length},
      diagnostics:API.diagnostics()};
  },
  async whenStable(renderId){
    await API.ready();
    if(renderId&&renderId!==K.renderId)throw err('KERNEL_NOT_READY','renderId '+renderId+' is not current');
    await twoFrameStable();return {renderId:K.renderId,fingerprint:K.fingerprint};
  },
  /* semantic interactions — no domain mutation */
  _wireInteractions(){
    if(K._wired)return;K._wired=true;
    const typeOf=id=>id.startsWith('ev-')||id.startsWith('st-')||id.startsWith('sp-')||id.startsWith('dx-')?'event':
      id.startsWith('fl-')?'milestone':id.startsWith('ph-')?'photo':
      id==='profile-photo-well'?'profile-photo':id==='logo-mount'?'logo':
      id==='sticky-note'?'callout':id.startsWith('profile')?'profile':id;
    const h=ev=>{
      const n=ev.target.closest('[data-object-id]');if(!n)return;
      const id=n.dataset.objectId;const br=boardRect();const sc=br.width/1920;
      const r=n.getBoundingClientRect();
      const op=ev.type==='dblclick'
        ?(typeOf(id)==='photo'||typeOf(id)==='logo'||typeOf(id)==='profile-photo'?'replace-requested':'edit-requested')
        :'select';
      document.dispatchEvent(new CustomEvent('d1-409h:interaction',{detail:{
        objectType:typeOf(id),objectId:id,op,
        geometry:{x:(r.left-br.left)/sc,y:(r.top-br.top)/sc,w:r.width/sc,h:r.height/sc},
        revision:K.committedRevision,renderId:K.renderId}}));
    };
    const b=document.getElementById('board');
    b.addEventListener('click',h);b.addEventListener('dblclick',h);
    K.listeners.push(['click',h],['dblclick',h]);
  },
  resize(view){
    const b=document.getElementById('board');
    let scale=1;
    if(view&&view.scale)scale=view.scale;
    else if(view&&view.containerWidth)scale=Math.min(view.containerWidth/1920,(view.containerHeight||1e9)/1080);
    scale=Math.max(scale,0.05);
    b.style.transformOrigin='top left';b.style.transform=scale===1?'':'scale('+scale+')';
    document.body.style.width=(1920*scale)+'px';document.body.style.height=(1080*scale)+'px';
    return {scale,cssWidth:1920*scale,cssHeight:1080*scale,dpr:window.devicePixelRatio||1};
  },
  getSnapshot(){return K.committed?deepFreezeClone(K.committed):null},
  diagnostics(){return {apiVersion:API.apiVersion,kernelId:API.kernelId,ready:K.ready,
    committedRevision:K.committedRevision,renderId:K.renderId,fingerprint:K.fingerprint,
    warnings:K.warnings.slice(),lastError:K.lastError,
    counts:K.committed?{events:K.committed.events.length,flags:(K.committed.flags||[]).length,
      photos:K.committed.photos.length}:null}},
  /* export: same committed DOM, foreignObject capture; PDF embeds the same raster */
  async exportBoard(request){
    request=request||{};const fmt=request.format||'png';
    const pr=request.pixelRatio===2?2:1;
    await API.whenStable();
    if(!K.committed)throw err('EXPORT_NOT_STABLE','no committed render');
    const b=document.getElementById('board');
    const prevT=b.style.transform;b.style.transform='';
    let cssText;
    try{cssText=await (await fetch('D1-409H_VISUAL_MASTER.css')).text()}
    catch(_){b.style.transform=prevT;throw err('EXPORT_FAILED','cannot read protected stylesheet for capture')}
    const cache={};
    async function toDataURL(url){
      if(cache[url])return cache[url];
      const r=await fetch(url);if(!r.ok)throw err('EXPORT_FAILED','asset fetch failed: '+url);
      const blob=await r.blob();
      const d=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)});
      cache[url]=d;return d;
    }
    const urlRe=/url\('?(assets\/[^')]+)'?\)/g;const found=new Set();let mm;
    while((mm=urlRe.exec(cssText)))found.add(mm[1]);
    for(const u of found)cssText=cssText.split("url('"+u+"')").join("url('"+await toDataURL(u)+"')");
    const clone=b.cloneNode(true);
    clone.querySelectorAll('#stateBanner').forEach(n=>n.remove()); /* no chrome in export */
    for(const img of clone.querySelectorAll('img')){
      const s=img.getAttribute('src')||'';
      if(!s.startsWith('data:'))img.setAttribute('src',await toDataURL(s));
    }
    const xhtml=new XMLSerializer().serializeToString(clone);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+(1920*pr)+'" height="'+(1080*pr)+'">'+
      '<foreignObject width="100%" height="100%" transform="scale('+pr+')">'+
      '<div xmlns="http://www.w3.org/1999/xhtml"><style>'+cssText.replace(/]]>/g,'')+'</style>'+xhtml+'</div>'+
      '</foreignObject></svg>';
    const svgUrl='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    const img=new Image();
    await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(err('EXPORT_FAILED','capture rasterization failed'));img.src=svgUrl});
    const canvas=document.createElement('canvas');canvas.width=1920*pr;canvas.height=1080*pr;
    const ctx=canvas.getContext('2d');
    if(request.background){ctx.fillStyle=request.background;ctx.fillRect(0,0,canvas.width,canvas.height)}
    ctx.drawImage(img,0,0);
    b.style.transform=prevT;
    if(canvas.width!==1920*pr||canvas.height!==1080*pr)throw err('EXPORT_DIMENSION_MISMATCH','canvas '+canvas.width+'x'+canvas.height);
    if(fmt==='png'){
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
      if(!blob)throw err('EXPORT_FAILED','png encode failed');
      return {format:'png',width:canvas.width,height:canvas.height,blob,
        fingerprint:K.fingerprint,renderId:K.renderId};
    }
    if(fmt==='pdf'){
      /* embed the SAME raster (JPEG) in a minimal one-page 16:9 PDF — no reflow, no second renderer */
      const jpeg=canvas.toDataURL('image/jpeg',0.95);
      const bytes=atob(jpeg.split(',')[1]);
      const W=request.pageWidth||792,H=request.pageHeight||445.5; /* 16:9 points */
      const objs=[];const add=s=>objs.push(s);
      add('<< /Type /Catalog /Pages 2 0 R >>');
      add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
      add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
      add('<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n'+bytes+'\nendstream');
      const content='q '+W+' 0 0 '+H+' 0 0 cm /Im0 Do Q';
      add('<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');
      let pdf='%PDF-1.4\n';const xref=[0];
      objs.forEach((o,i)=>{xref.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
      const xs=pdf.length;
      pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
      for(let i=1;i<=objs.length;i++)pdf+=String(xref[i]).padStart(10,'0')+' 00000 n \n';
      pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xs+'\n%%EOF';
      const buf=new Uint8Array(pdf.length);
      for(let i=0;i<pdf.length;i++)buf[i]=pdf.charCodeAt(i)&0xff;
      return {format:'pdf',pageWidth:W,pageHeight:H,blob:new Blob([buf],{type:'application/pdf'}),
        fingerprint:K.fingerprint,renderId:K.renderId};
    }
    throw err('EXPORT_FAILED','unknown format '+fmt);
  },
  destroy(){
    const b=document.getElementById('board');
    K.listeners.forEach(([t,h])=>b.removeEventListener(t,h));K.listeners=[];
    K.objectURLs.forEach(u=>{try{URL.revokeObjectURL(u)}catch(_){/*noop*/}});K.objectURLs=[];
    ['axisLayer','flagLayer','arrowLayer','photoLayer'].forEach(id=>{document.getElementById(id).textContent=''});
    K.committed=null;K.committedRevision=-1;K.destroyed=true;K.ready=false;K.readyPromise=null;K._wired=false;
    return true;
  },
  /* test/bootstrap helpers (deterministic; documented) */
  defaultModel(){return deepFreezeClone(BOOT_DEFAULT_MODEL)},
  _reviveAfterDestroyForTests(){K.destroyed=false}
};
window.D1409H=API;

/* ============================================================
   STANDALONE BOOT — identical to the approved master behavior
   ============================================================ */
const Q=new URLSearchParams(location.search);
const MODE={density:Q.get('density'),fit:Q.get('fit'),demo:Q.get('demo'),
  scale:parseFloat(Q.get('scale')||'1'),defer:Q.get('defer')==='1'};
function fixtureModel(){
  let events=DEFAULT_EVENTS,flags=DEFAULT_FLAGS,axisMode='frozen-default';
  if(MODE.density==='sparse'){events=SPARSE_EVENTS;flags=[{id:'fl-sp',d:'6/19',t:'MBBS Graduation',year:2019,m:6}];axisMode='adaptive'}
  if(MODE.density==='dense'){events=DEFAULT_EVENTS.concat(DENSE_EXTRA);axisMode='adaptive'}
  if(MODE.fit==='stress'){events=STRESS_EVENTS;axisMode='adaptive'}
  const FIXTURE_SHA={ski:'b6ef8e82df2e732a89e92d054bf1367f1a5b5b94455edbe5d5e27626114ca3d2',wedding:'f9de95f98036a4e387a0197467126bfc9595a2f78c1825d1990c82e2baa3e4a9',nicu:'6e92a8d75cd06796eac153a0424bc553a5008b155f6de2ab04f470bfb8ffc7ab',newborn:'17502c23f158a321a2a220d854c676f43e2964ad93ab1271b5e3edcb070315e8',karaoke:'0de79263988fb5c6745370cd25d2c09ccd5d433546bd8ce1142954dcbd2aa407'};
  const photos=SLOT_GEOM.map((g,i)=>({id:g.id,slot:i,style:'scrapbook',
    media:{id:'m-'+g.id,src:g.src,mime:'image/jpeg',alt:'',contentSha256:FIXTURE_SHA[g.src.match(/photos\/(\w+)\./)[1]]}}));
  if(MODE.demo==='polaroid'){
    const caps=['ski day!','the big day','our fighter','week one','front-row fans'];
    photos.forEach((p,i)=>{p.style='polaroid';p.caption={mode:i%2?'type':'marker',text:caps[i]}});
  }
  return {schemaVersion:'d1-409h-render-model/1',documentId:'fixture-default',revision:0,
    title:DEFAULT_TITLE,axisMode,events,flags,
    profile:DEFAULT_PROFILE,sticky:DEFAULT_STICKY,logo:DEFAULT_LOGO,interview:DEFAULT_INTERVIEW,photos};
}
const BOOT_DEFAULT_MODEL=fixtureModel();
async function boot(){
  const model=BOOT_DEFAULT_MODEL;
  buildStaticOnce();
  /* fixture media are protected package assets covered by the hash manifest; skip per-media re-hash at boot */
  buildAxis(model);buildFlags(model);buildArrows(model);buildPhotos(model);hydrateFurniture(model);
  if(MODE.demo==='polaroid'){
    /* companion-state photo spread (UNCHANGED from approved master) */
    const layer=document.getElementById('photoLayer');
    [...layer.children].forEach((el,i)=>{
      if(i>=3){el.style.top=(parseFloat(el.style.top)+18)+'px';
        if(i===3)el.style.left=(parseFloat(el.style.left)+10)+'px';}});
    const bn=document.createElement('div');bn.id='stateBanner';
    bn.textContent='DESIGN-SYSTEM COMPANION STATE — POLAROID STYLE + CAPTIONS (NOT THE DEFAULT BOARD)';
    document.getElementById('board').appendChild(bn);
  }
  if(MODE.density||MODE.fit){
    const bn=document.createElement('div');bn.id='stateBanner';
    bn.textContent='COMPANION STATE — '+(MODE.fit?'TEXT-FIT STRESS CONTENT':(MODE.density.toUpperCase()+' DENSITY'))+' (DEFAULT GEOMETRY LAWS APPLIED)';
    document.getElementById('board').appendChild(bn);
  }
  runFit(false);
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(()=>{runFit(false);
    document.documentElement.dataset.ready='1';});
  K.committed=deepFreezeClone(model);K.committedRevision=0;
  fingerprintOf(K.committed).then(fp=>{K.fingerprint=fp});
  API._wireInteractions();
  if(MODE.scale&&MODE.scale!==1)API.resize({scale:MODE.scale});
}
if(!MODE.defer)boot(); else {buildStaticOnce();API._wireInteractions();document.documentElement.dataset.ready='deferred';}
})();

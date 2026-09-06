/* ============================================================
   D1-409H — TIMELINE BUILDER AAA VISUAL MASTER (FROZEN)
   Render engine: adaptive axis, chronological staircase, seeded
   variance, irregular stitching, bounded-text fit engine,
   companion states (?density=|?fit=stress|?demo=polaroid|?scale=).
   Every presentation object is an independent DOM node with
   data-object-id (Advanced Mode seam). Codex: consume verbatim.
   ============================================================ */
'use strict';

/* ---------- deterministic seeded variance (never Math.random) ---------- */
function hash32(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=hash32(seed);return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const jitter=(id,min,max)=>{const r=rng(id)();return min+r*(max-min)};

/* ---------- category system (frozen palette; configurable later) ---------- */
const CATS={
  work:{label:'Work Experience'},
  personal:{label:'Personal (Not on CV)'},
  usmle:{label:'USMLE Studies'},
  usce:{label:'US Clinical Experience'},
  res:{label:'Research'}
};
/* category-aware label dedup: arrow never repeats what legend+location say */
const DEDUP=[]; /* dedup demonstrated at data level: research arrow reads 'Team 11' (legend+location carry 'Larkin'/'Research'); regex dedup reserved for configurable categories */

/* ---------- FROZEN default dataset (Dr Brian SAMPLE) ---------- */
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
/* even cascade rhythm within chapters (407H §1.6) */
const LANE_Y=[196,252,316,382,448,506,564];
const AX_LEFT=8;

/* ---------- companion-state fixtures ---------- */
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

/* ---------- adaptive axis (immutable law) ---------- */
function axisFor(events,flags){
  const q=new URLSearchParams(location.search);
  if(!q.get('density')&&!q.get('fit')) return DEFAULT_YEARS.map(o=>({...o})); // frozen default geometry
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

/* ---------- board build ---------- */
const Q=new URLSearchParams(location.search);
const MODE={density:Q.get('density'),fit:Q.get('fit'),demo:Q.get('demo'),scale:parseFloat(Q.get('scale')||'1')};
let EVENTS=DEFAULT_EVENTS, FLAGS=DEFAULT_FLAGS;
if(MODE.density==='sparse'){EVENTS=SPARSE_EVENTS;FLAGS=[{id:'fl-sp',d:'6/19',t:'MBBS Graduation',year:2019,m:6}]}
if(MODE.density==='dense'){EVENTS=DEFAULT_EVENTS.concat([
 {id:'dx-1',t:'Research Asst',cat:'res',sy:2016,sm:6,ey:2017,em:2,date:'6/16-2/17',lane:2},
 {id:'dx-2',t:'Volunteer EMT',cat:'personal',sy:2015,sm:9,ey:2016,em:6,date:'9/15-6/16',lane:3},
 {id:'dx-3',t:'FM Observer',cat:'usce',sy:2017,sm:6,ey:2017,em:9,date:'6/17-9/17',loc:'Newark, NJ',lp:'left',lane:5},
 {id:'dx-4',t:'Raising Daughter',cat:'personal',sy:2017,sm:1,ey:2020,em:12,date:'1/17-Present',lane:6},
 {id:'dx-5',t:'Clinic Volunteer',cat:'work',sy:2019,sm:3,ey:2019,em:9,date:'3/19-9/19',lane:2},
 {id:'dx-6',t:'Poster: ACP',cat:'res',sy:2019,sm:10,ey:2019,em:11,date:'10/19',lane:3}])}
if(MODE.fit==='stress'){EVENTS=STRESS_EVENTS}

const YEARS=axisFor(EVENTS,FLAGS);
let acc=AX_LEFT;const YPOS={};
YEARS.forEach(o=>{o.x0=acc;YPOS[o.y]=o;acc+=o.w});
function timeX(year,month){const o=YPOS[String(year)];if(!o)return AX_LEFT;return o.x0+((month-1)/12)*o.w}

/* axis DOM */
const axL=document.getElementById('axisLayer');
const axis=document.createElement('div');axis.id='axis';axis.dataset.objectId='year-axis';
YEARS.forEach(o=>{const s=document.createElement('div');s.className='yseg';
  s.style.width=(o.w+14)+'px';s.innerHTML='<span>'+o.y+'</span>';axis.appendChild(s)});
axL.appendChild(axis);
const drift=document.createElement('div');drift.id='axisDrift';axL.appendChild(drift);

/* milestone flags */
const flL=document.getElementById('flagLayer');
FLAGS.forEach(f=>{
  const el=document.createElement('div');el.className='flag';el.dataset.objectId=f.id;
  el.style.left=timeX(f.year,f.m)+'px';el.style.top='82px';
  el.style.transform='rotate('+jitter(f.id,-0.7,0.7).toFixed(2)+'deg)';
  el.innerHTML='<div class="stem"></div><div class="tag"><i></i>'+f.d+'</div>'+
    '<div class="lbl">'+(f.usflag?'<img src="assets/photos/us_flag.png" alt="">':'')+f.t+'</div>';
  flL.appendChild(el);
});

/* arrows — matte die-cut cardstock, seeded variance */
const arL=document.getElementById('arrowLayer');
EVENTS.forEach(e=>{
  let label=e.t; DEDUP.forEach(([re,rep])=>{label=label.replace(re,rep)}); label=label.trim();
  const x0=timeX(e.sy,e.sm),x1=timeX(e.ey,e.em);
  const w=Math.max(88,x1-x0); /* frozen floor: founder short-arrow width */
  const a=document.createElement('div');
  a.className='arrow c-'+e.cat;a.dataset.objectId=e.id;
  a.style.left=x0+'px';a.style.top=(LANE_Y[e.lane]-7)+'px';a.style.width=w+'px';
  a.style.setProperty('--sat',jitter(e.id+'s',0.985,1.02).toFixed(3));
  a.style.setProperty('--gx',Math.round(jitter(e.id+'x',0,140))+'px');
  a.style.setProperty('--gy',Math.round(jitter(e.id+'y',0,140))+'px');
  a.innerHTML='<div class="die"></div>'+
    (e.hl?'<div class="hlbox"></div>':'')+
    '<div class="date">'+e.date+'</div>'+
    '<div class="al"><span class="alt">'+label+'</span></div>'+
    (e.loc?'<div class="loc '+(e.lp||'below')+'">'+e.loc+'</div>':'');
  arL.appendChild(a);
});

/* ---------- leather corners with irregular stitching ---------- */
function leatherCorner(host,pos,size,idSeed){
  const c=document.createElement('div');
  c.className='lcorner '+pos;c.dataset.objectId=idSeed;
  c.style.width=size+'px';c.style.height=size+'px';
  const p={tl:'left:-3px;top:-3px',tr:'right:-3px;top:-3px',bl:'left:-3px;bottom:-3px',br:'right:-3px;bottom:-3px'}[pos];
  c.style.cssText+=p;
  c.style.setProperty('--lx',Math.round(jitter(idSeed+'lx',0,120))+'px');
  c.style.setProperty('--ly',Math.round(jitter(idSeed+'ly',0,120))+'px');
  /* stitching + fold ridge as inline SVG along the hypotenuse */
  const r=rng(idSeed+'st');const S=size;
  const hyp={tl:[[S*0.92,4],[4,S*0.92]],tr:[[S-S*0.92,4],[S-4,S*0.92]],
             bl:[[4,S-S*0.92],[S*0.92,S-4]],br:[[S-4,S-S*0.92],[S-S*0.92,S-4]]}[pos];
  const [A,B]=hyp;const dx=B[0]-A[0],dy=B[1]-A[1];const len=Math.hypot(dx,dy);
  const ux=dx/len,uy=dy/len;                       // along hypotenuse
  const nx=-uy,ny=ux;                              // normal (into leather)
  const inSign={tl:1,tr:1,bl:1,br:1}[pos];
  let seg='',t=6;
  while(t<len-6){
    const dl=5.5+(r()-0.5)*1.8;                    // dash length ±15%
    const wob=(r()-0.5)*0.9;                       // lateral wobble
    const off=7;                                    // stitch inset from edge
    const x1=A[0]+ux*t+nx*inSign*off+nx*wob, y1=A[1]+uy*t+ny*inSign*off+ny*wob;
    const x2=A[0]+ux*(t+dl)+nx*inSign*off+nx*wob, y2=A[1]+uy*(t+dl)+ny*inSign*off+ny*wob;
    seg+='<line x1="'+x1.toFixed(1)+'" y1="'+(y1+0.8).toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+(y2+0.8).toFixed(1)+'" stroke="rgba(0,0,0,.55)" stroke-width="1.7" stroke-linecap="round"/>';
    seg+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#ddd4bd" stroke-width="1.5" stroke-linecap="round"/>';
    t+=dl+4.2+(r()-0.5)*1.6;                       // gap jitter
  }
  /* fold ridge highlight just inside the hypotenuse edge */
  const rx1=A[0]+nx*inSign*2.2,ry1=A[1]+ny*inSign*2.2,rx2=B[0]+nx*inSign*2.2,ry2=B[1]+ny*inSign*2.2;
  const ridge='<line x1="'+rx1+'" y1="'+ry1+'" x2="'+rx2+'" y2="'+ry2+'" stroke="rgba(255,255,255,.20)" stroke-width="1.6" stroke-linecap="round"/>'+
              '<line x1="'+A[0]+'" y1="'+A[1]+'" x2="'+B[0]+'" y2="'+B[1]+'" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>';
  c.innerHTML='<svg viewBox="0 0 '+S+' '+S+'">'+ridge+seg+'</svg>';
  host.appendChild(c);
}
const tw=document.getElementById('titleWrap');
['tl','tr','bl','br'].forEach(p=>leatherCorner(tw,p,44,'lc-title-'+p));
const pf=document.getElementById('profile');
['tl','tr','bl','br'].forEach(p=>leatherCorner(pf,p,52,'lc-prof-'+p));

/* ---------- skeleton keys for the color key header ---------- */
function skeletonKey(flip){
  return '<svg width="34" height="18" viewBox="0 0 34 18"'+(flip?' style="transform:scaleX(-1)"':'')+'>'+
   '<g fill="none" stroke="#9aa0a6" stroke-width="1.8" stroke-linecap="round">'+
   '<circle cx="6.5" cy="9" r="4.2"/><line x1="10.7" y1="9" x2="30" y2="9"/>'+
   '<line x1="26" y1="9" x2="26" y2="13.5"/><line x1="30" y1="9" x2="30" y2="12.2"/></g></svg>';
}
document.getElementById('keyTitle').innerHTML=skeletonKey(false)+'<em>COLOR KEY</em>'+skeletonKey(true);
/* swatch fold-depth variance */
document.querySelectorAll('#key .sw').forEach((sw,i)=>{
  const d=Math.round(jitter('sw'+i,12,20)), e=Math.round(jitter('swe'+i,74,88));
  sw.style.clipPath='polygon(0 0,100% 0,100% 100%,'+d+'% 100%,0 '+e+'%)';
});

/* ---------- photos (founder-provided prints) ---------- */
const SCRAP=[
 {id:'ph-ski',src:'assets/photos/ski.jpg',x:632,y:596,w:272,h:200,rot:-6.8},
 {id:'ph-wed',src:'assets/photos/wedding.jpg',x:646,y:788,w:302,h:238,rot:5.4},
 {id:'ph-nicu',src:'assets/photos/nicu.jpg',x:922,y:566,w:300,h:234,rot:4.7},   /* breaks the hull upward */
 {id:'ph-new',src:'assets/photos/newborn.jpg',x:1008,y:776,w:212,h:256,rot:-2.6},
 {id:'ph-kar',src:'assets/photos/karaoke.jpg',x:1206,y:754,w:266,h:212,rot:3.9}
];
function buildPhotos(list,style){
  const layer=document.getElementById('photoLayer');layer.innerHTML='';
  list.forEach((p,i)=>{
    const el=document.createElement('div');el.className='photoTile';el.dataset.objectId=p.id;
    const bt=(style==='polaroid')?14:11+Math.round(jitter(p.id+'b',-1,1));
    const bb=(style==='polaroid')?Math.round(bt*2.6+(p.cap?10:0)):bt+(p.cap?22:0);
    el.style.cssText='left:'+p.x+'px;top:'+p.y+'px;width:'+p.w+'px;height:'+p.h+'px;transform:rotate('+p.rot+'deg)';
    el.style.setProperty('--sheenA',Math.round(jitter(p.id+'sh',115,135))+'deg');
    el.style.setProperty('--px',(4+i%2)+'px');el.style.setProperty('--py',(6+(i*7)%3)+'px');
    el.style.setProperty('--pb',(11+(i*5)%5)+'px');
    const img=document.createElement('div');img.className='img';
    img.style.cssText='left:'+bt+'px;right:'+bt+'px;top:'+bt+'px;bottom:'+bb+'px';
    img.style.setProperty('--gx',Math.round(jitter(p.id+'gx',0,150))+'px');
    img.style.setProperty('--gy',Math.round(jitter(p.id+'gy',0,150))+'px');
    img.innerHTML='<img src="'+p.src+'" alt="">';
    el.appendChild(img);
    if(p.cap){const c=document.createElement('div');c.className='cap '+(p.capStyle||'type');
      c.textContent=p.cap;c.style.height=(bb-4)+'px';c.style.lineHeight=(bb-6)+'px';el.appendChild(c)}
    layer.appendChild(el);
  });
}
if(MODE.demo==='polaroid'){
  buildPhotos(SCRAP.map((p,i)=>({...p,y:p.y+(i>=3?18:0),x:p.x+(i===3?10:0),cap:['ski day!','the big day','our fighter','week one','front-row fans'][i],
    capStyle:i%2?'type':'marker'})),'polaroid');
  const b=document.createElement('div');b.id='stateBanner';
  b.textContent='DESIGN-SYSTEM COMPANION STATE — POLAROID STYLE + CAPTIONS (NOT THE DEFAULT BOARD)';
  document.getElementById('board').appendChild(b);
}else{
  buildPhotos(SCRAP,'scrapbook');
}
if(MODE.density||MODE.fit){
  const b=document.createElement('div');b.id='stateBanner';
  b.textContent='COMPANION STATE — '+(MODE.fit?'TEXT-FIT STRESS CONTENT':(MODE.density.toUpperCase()+' DENSITY'))+' (DEFAULT GEOMETRY LAWS APPLIED)';
  document.getElementById('board').appendChild(b);
}

/* ---------- red marker pointer (china-marker stroke) ---------- */
document.getElementById('redptr').innerHTML=
 '<svg viewBox="0 0 84 52" width="84" height="52">'+
 '<path d="M80 10 C56 2 34 14 12 30" stroke="#c03a26" stroke-width="7.5" fill="none" stroke-linecap="round" opacity=".92"/>'+
 '<path d="M79 12 C57 5 36 16 15 30" stroke="#a92e1c" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".55"/>'+
 '<path d="M22 20 L6 34 L26 36 Z" fill="#c03a26" opacity=".95"/>'+
 '<path d="M22 22 L10 33 L24 34 Z" fill="#a92e1c" opacity=".5"/></svg>';

/* ---------- bounded-text fit engine ---------- */
const SHORTEN={' Preparation':'',' Program':'',' Rotation':'',' Hospitalist':''};
function fitArrows(){
  document.querySelectorAll('.arrow .al').forEach(al=>{
    const span=al.querySelector('.alt');if(!span)return;
    /* step 1: intelligent shorten */
    let txt=span.textContent,changed=true;
    while(span.scrollWidth>al.clientWidth&&changed){
      changed=false;
      for(const k in SHORTEN){if(txt.includes(k.trim())){txt=txt.replace(new RegExp('\\s*'+k.trim()),SHORTEN[k]);span.textContent=txt;changed=true;break}}
    }
    /* step 2: scale within governed bounds */
    al.style.fontSize='';let fs=parseFloat(getComputedStyle(al).fontSize),g=0;
    while(span.scrollWidth>al.clientWidth&&fs>9&&g<60){fs-=0.5;al.style.fontSize=fs+'px';g++}
    /* step 3: governed fallback — editorial ellipsis, never clip */
    if(span.scrollWidth>al.clientWidth){
      while(span.scrollWidth>al.clientWidth&&txt.length>4){txt=txt.slice(0,-2).trim();span.textContent=txt+'…'}
    }
  });
}
function fitProfile(){
  const box=document.querySelector('#profile .txt');if(!box)return;
  const card=document.getElementById('profile');const cs=getComputedStyle(card);
  const maxH=card.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-4;
  box.style.fontSize='';let fs=parseFloat(getComputedStyle(box).fontSize),g=0;
  while(box.scrollHeight>maxH&&fs>11&&g<40){fs-=0.5;box.style.fontSize=fs+'px';box.style.lineHeight='1.28';g++}
}
function fitSticky(){
  const st=document.querySelector('#sticky span');if(!st)return;
  let fs=parseFloat(getComputedStyle(st).fontSize),g=0;
  while((st.scrollHeight>120||st.scrollWidth>118)&&fs>15&&g<30){fs-=1;st.style.fontSize=fs+'px';g++}
}
function fitLocations(){
  /* below-position location labels may not collide with a neighbour's label */
  const locs=[...document.querySelectorAll('.arrow .loc.below')]
    .map(el=>({el,r:el.getBoundingClientRect()})).sort((a,b)=>a.r.left-b.r.left);
  for(let i=0;i<locs.length-1;i++){
    const a=locs[i],b=locs[i+1];
    if(a.r.right+10>b.r.left){
      const avail=b.r.left-a.r.left-14;
      let fs=parseFloat(getComputedStyle(a.el).fontSize),g=0;
      while(a.el.getBoundingClientRect().width>avail&&fs>14&&g<12){fs-=0.5;a.el.style.fontSize=fs+'px';g++}
      let t=a.el.textContent;
      while(a.el.getBoundingClientRect().width>avail&&t.length>6){t=t.slice(0,-2).trim();a.el.textContent=t+'\u2026'}
      a.r=a.el.getBoundingClientRect();
    }
  }
}
function runFit(){fitArrows();fitProfile();fitSticky();fitLocations()}
runFit();
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(runFit);

/* ---------- reusable preview scaling ---------- */
if(MODE.scale&&MODE.scale!==1){
  const b=document.getElementById('board');
  b.style.transformOrigin='top left';b.style.transform='scale('+MODE.scale+')';
  document.body.style.width=(1920*MODE.scale)+'px';document.body.style.height=(1080*MODE.scale)+'px';
}
document.documentElement.dataset.ready='1';

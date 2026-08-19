/* ============================================================
   D1-411A — PRESENTATION KERNEL ADAPTER (host-side, UNPROTECTED)
   Maps TimelineVisualDocument (TimelineStore projection) ->
   FrozenTimelineRenderModel (protected kernel input).
   Pure, deterministic, no DOM, no fetch, no state retention.
   The adapter NEVER silently drops content: unrenderable input
   throws AdapterError; advisory conditions surface as warnings.
   ============================================================ */
'use strict';

const LANE_MAX = 6;
/* Lane Assignment Law (Fable-issued, D1-411A):
   band by frozen category chapter -> work:0, usmle:1, usce:[2,3,4],
   ongoing/community work:5, res:6, personal: first free of [6,5,3,2].
   Within a band, x-overlapping events cascade to the next lane of the band.
   presentationOverride.lane always wins. If no lane clears, the adapter
   uses the nearest otherwise-free display lane before reporting saturation.
   This overflow is layout-only: category/color/semantic mapping remain frozen.
   If every lane is occupied, it keeps the last canonical lane and lets the
   kernel's collision law fail closed. */
const BANDS = { work:[0,5], usmle:[1], usce:[2,3,4], res:[6], personal:[6,5,3,2] };
const OVERFLOW_LANES = {
  work:[1,2,3,4,6],
  usmle:[2,0,3,4,5,6],
  usce:[1,5,6,0],
  res:[5,4,3,2,1,0],
  personal:[4,1,0]
};
const CATEGORY_KEY_IDS=['education','exams','clinical','work','research','personal'];
const HEX_COLOR=/^#[0-9A-F]{6}$/i;

class AdapterError extends Error {
  constructor(code, message, path){ super(message); this.name='AdapterError'; this.code=code; this.path=path; }
}

function parseYM(s, path){
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(s||''));
  if(!m) throw new AdapterError('INVALID_DATE','date must be YYYY-MM or YYYY-MM-DD: '+s, path);
  const y=+m[1], mo=+m[2];
  if(mo<1||mo>12) throw new AdapterError('INVALID_DATE','month out of range: '+s, path);
  return {y, m:mo};
}
const fmt = (y,m)=> (m)+'/'+String(y).slice(2);

function displayDate(ev, s, e){
  if(ev.ongoing) return fmt(s.y,s.m)+'-Active';
  const d = fmt(s.y,s.m)+'-'+fmt(e.y,e.m);
  return (ev.approximateStart||ev.approximateEnd) ? '\u2248 '+d : d;
}

function toRenderModel(doc){
  if(!doc || doc.schemaVersion!=='d1-411a/timeline-visual-document/1')
    throw new AdapterError('INVALID_SCHEMA','unsupported TimelineVisualDocument schemaVersion', 'schemaVersion');
  const warnings=[];
  const catMap={};
  (doc.categories||[]).forEach(c=>{
    if(!c.mapsTo) throw new AdapterError('INVALID_CATEGORY','category '+c.id+' has no mapsTo', 'categories');
    catMap[c.id]=c;
  });
  const presentation=doc.presentation||{};
  let axisOverride;
  if(presentation.axisOverride!=null){
    const axis=presentation.axisOverride;
    if(axis?.mode!=='manual')
      throw new AdapterError('INVALID_AXIS_OVERRIDE','axis override mode must be manual','presentation.axisOverride.mode');
    const startYear=Number(axis.startYear),endYear=Number(axis.endYear);
    if(!Number.isInteger(startYear)||!Number.isInteger(endYear)||startYear<1900||endYear>2200||startYear>endYear||endYear-startYear>30)
      throw new AdapterError('INVALID_AXIS_OVERRIDE','manual axis requires a 1900–2200 ordered range of at most 31 years','presentation.axisOverride');
    axisOverride={mode:'manual',startYear,endYear,includeFuture:axis.includeFuture!==false};
  }
  let categoryKey;
  if(presentation.categoryKeyOverride!=null){
    const supplied=presentation.categoryKeyOverride;
    if(!Array.isArray(supplied)||supplied.length!==CATEGORY_KEY_IDS.length)
      throw new AdapterError('INVALID_CATEGORY_KEY','category key must contain exactly six entries','presentation.categoryKeyOverride');
    categoryKey=supplied.map((item,index)=>{
      const id=CATEGORY_KEY_IDS[index];
      if(item?.id!==id||Number(item?.order)!==index)
        throw new AdapterError('INVALID_CATEGORY_KEY','category key IDs and order are fixed','presentation.categoryKeyOverride['+index+']');
      if(!item.label||String(item.label).length>32||!HEX_COLOR.test(String(item.color||'')))
        throw new AdapterError('INVALID_CATEGORY_KEY','category label/color is invalid','presentation.categoryKeyOverride['+index+']');
      if(item.mapsTo!==undefined&&item.mapsTo!==catMap[id]?.mapsTo)
        throw new AdapterError('INVALID_CATEGORY_KEY','category mapping cannot be changed','presentation.categoryKeyOverride['+index+'].mapsTo');
      return{id,label:String(item.label),color:String(item.color).toUpperCase(),mapsTo:catMap[id].mapsTo,order:index};
    });
  }

  /* ---- events (visible only; hidden NEVER reach the kernel) ---- */
  const vis=(doc.events||[]).filter(e=>(e.visibility||'visible')==='visible');
  const nowEnd = (()=>{ // ongoing events end at the last explicit year in the doc
    let maxY=0; vis.forEach(e=>{ const s=parseYM(e.startDate,'events'); maxY=Math.max(maxY,s.y);
      if(e.endDate){ const q=parseYM(e.endDate,'events'); maxY=Math.max(maxY,q.y); }});
    return axisOverride?{y:axisOverride.endYear,m:12}:{y:maxY, m:12};
  })();

  const arrows=[], flags=[];
  vis.forEach((ev,i)=>{
    const path='events['+i+']';
    const cat=catMap[ev.categoryId];
    if(!cat) throw new AdapterError('INVALID_CATEGORY','unknown categoryId '+ev.categoryId, path);
    const s=parseYM(ev.startDate, path+'.startDate');
    if(ev.milestone){
      flags.push({ id:ev.id, d:fmt(s.y,s.m), t:ev.shortLabel||ev.title, year:s.y, m:s.m,
        usflag:/moved\s*>?\s*usa/i.test(ev.title)||undefined });
      return;
    }
    const e=ev.ongoing? nowEnd : parseYM(ev.endDate||ev.startDate, path+'.endDate');
    if(e.y<s.y||(e.y===s.y&&e.m<s.m)) throw new AdapterError('INVALID_DATE','end before start', path);
    let label=ev.shortLabel||ev.title;
    if((cat.arrowWordingRule||'keep')==='dedupe-category-term'&&cat.shortLabel){
      const re=new RegExp('\\s*'+cat.shortLabel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$','i');
      const ded=label.replace(re,'').trim(); if(ded) label=ded;
    }
    arrows.push({ id:ev.id, t:label, cat:cat.mapsTo, ...(categoryKey?{categoryId:ev.categoryId}:{}), sy:s.y, sm:s.m, ey:e.y, em:e.m,
      date: displayDate(ev,s,e),
      loc: ev.location||ev.institution||undefined,
      lp: (ev.presentationOverride&&ev.presentationOverride.labelPosition)||(cat.mapsTo==='work'?'below':(ev.location||ev.institution)?'left':undefined),
      lane: -1, hl: !!(ev.presentationOverride&&ev.presentationOverride.highlight),
      _ovr: ev.presentationOverride&&Number.isInteger(ev.presentationOverride.lane)?ev.presentationOverride.lane:null });
  });

  (doc.milestones||[]).filter(m=>(m.visibility||'visible')==='visible').forEach((ms,i)=>{
    const s=parseYM(ms.date,'milestones['+i+']');
    flags.push({ id:ms.id, d:fmt(s.y,s.m), t:ms.label, year:s.y, m:s.m,
      usflag: ms.icon==='us-flag'||undefined });
  });

  /* ---- Lane Assignment Law ---- */
  const monthsX = e => e.sy*12+e.sm;
  const monthsE = e => e.ey*12+e.em;
  const overlap=(a,b)=> monthsX(a)<=monthsE(b) && monthsX(b)<=monthsE(a);
  const laneOcc={}; for(let l=0;l<=LANE_MAX;l++) laneOcc[l]=[];
  arrows.sort((a,b)=>monthsX(a)-monthsX(b));
  arrows.forEach(a=>{
    /* An override wins only when the lane is actually free. Accepting it blindly
       bypassed the entire Lane Assignment Law and let two events share one lane. */
    if(a._ovr!==null){
      if(!laneOcc[a._ovr].some(o=>overlap(o,a))){ a.lane=a._ovr; laneOcc[a.lane].push(a); return; }
      warnings.push('EVENT_LANE_OVERRIDE_REJECTED:'+a.id+':'+a._ovr);
    }
    const band=BANDS[a.cat]||[6];
    let placed=false;
    for(const l of band){
      if(!laneOcc[l].some(o=>overlap(o,a))){ a.lane=l; laneOcc[l].push(a); placed=true; break; }
    }
    if(!placed){
      for(const l of OVERFLOW_LANES[a.cat]||[]){
        if(!laneOcc[l].some(o=>overlap(o,a))){
          a.lane=l; laneOcc[l].push(a); placed=true;
          warnings.push('EVENT_LANE_OVERFLOW:'+a.id+':'+a.lane);
          break;
        }
      }
    }
    if(!placed){ a.lane=band[band.length-1]; laneOcc[a.lane].push(a);
      warnings.push('EVENT_LANE_SATURATED:'+a.id); }
    else if(band.length>1) warnings.push('EVENT_LANE_AUTOASSIGNED:'+a.id+':'+a.lane);
  });
  arrows.forEach(a=>{ delete a._ovr; });

  /* ---- profile ---- */
  const st=doc.student||{}, sc=st.stepScores||{};
  const profile={
    name: st.displayName||[st.firstName,st.lastName].filter(Boolean).join(' ')||'\u2014',
    visaStatus: st.visaStatus||'\u2014',
    aamc: st.aamcDisplay||'\u2014',
    step1: sc.step1||'\u2014', step2Ck: sc.step2Ck||'\u2014',
    step2Cs: sc.step2Cs||'\u2014', step3: sc.step3||'\u2014',
    usce: st.usceSummary||'\u2014', research: st.researchSummary||'\u2014',
    languages: st.languages||'\u2014', hobbies: st.hobbies||'\u2014',
    portrait: st.profilePhoto||null };

  /* ---- callouts -> single sticky (frozen composition supports one) ---- */
  const cls=(doc.callouts||[]).filter(c=>(c.visibility||'visible')==='visible');
  let sticky={ text:'', targetObjectId:null, visibility:'hide' };
  if(cls.length){
    const c=cls[0];
    sticky={ text:c.text, targetObjectId:c.targetEventId, visibility:'show' };
    if(cls.length>1) warnings.push('EXTRA_CALLOUTS_REPORTED:'+cls.slice(1).map(c=>c.id).join(','));
  }

  /* ---- interview + logo ---- */
  const iv=doc.interview||{};
  const ivVisible=(iv.visibility||'visible')==='visible' && (iv.ribbonText||iv.programName||iv.interviewDateDisplay||iv.interviewDate);
  const interview={ label: iv.ribbonText||'My Big Interview!',
    date: iv.interviewDateDisplay||iv.interviewDate||'', visibility: ivVisible?'show':'hide' };
  if(iv.ribbonColor) warnings.push('RIBBON_COLOR_DEFERRED_TO_THEME_LAW'); // future; frozen neutral satin renders
  const logo={ media: iv.logo||null, visibility: iv.logo?'content':(ivVisible?'placeholder':'hide') };

  /* ---- photos ---- */
  const ph=(doc.photos||[]).filter(p=>(p.visibility||'visible')==='visible');
  if(ph.length>5) throw new AdapterError('TOO_MANY_PHOTOS','max 5 visible photos', 'photos');
  const used=new Set(); const photos=[];
  ph.forEach((p,i)=>{
    let slot=Number.isInteger(p.slot)?p.slot:[0,1,2,3,4].find(s=>!used.has(s));
    if(used.has(slot)) throw new AdapterError('DUPLICATE_OBJECT_ID','photo slot '+slot+' reused','photos['+i+']');
    used.add(slot);
    const style=p.presentationStyle||(doc.presentation&&doc.presentation.photoStyleDefault)||'scrapbook';
    const capStyle=p.captionStyle||(doc.presentation&&doc.presentation.captionDefault)||'none';
    photos.push({ id:p.id, media:p.source, slot, style,
      caption: (capStyle!=='none'&&p.caption)?{mode:capStyle,text:String(p.caption).slice(0,32)}:undefined });
  });

  const model={ schemaVersion:'d1-409h-render-model/1',
    documentId: doc.timelineId, revision: doc.revision||0,
    title: doc.title, axisMode:'adaptive',
    ...(axisOverride?{axisOverride}:{}),
    ...(categoryKey?{categoryKey}:{}),
    events: arrows, flags, profile, sticky, logo, interview, photos };
  return { model, warnings, dropped: [] };
}

if(typeof module!=='undefined'&&module.exports){ module.exports={ toRenderModel, AdapterError }; }
if(typeof window!=='undefined'){ window.D1411A_Adapter={ toRenderModel, AdapterError }; }

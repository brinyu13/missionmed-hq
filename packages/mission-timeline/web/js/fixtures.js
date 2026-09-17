import {monthString} from "./timeline-engine.js";

const cats=["work","personal","usmle","th","cl","res"];

export function makeStressEvents(count,options={}){
  const startYear=options.startYear||2014;
  const spanMonths=options.spanMonths||120;
  const dense=!!options.dense;
  const out=[];
  for(let i=0;i<count;i++){
    const cat=cats[i%cats.length];
    const base=dense?Math.floor(i/3):i;
    const start=startYear*12+(base*3)%spanMonths;
    const dur=(i%7===0)?0:Math.max(1,(i%9)+2);
    const milestone=dur===0||i%11===0;
    out.push({
      id:`fx${count}_${i+1}`,
      t:titleFor(i,cat,count),
      cat,
      mile:milestone,
      s:monthString(start),
      e:milestone?null:monthString(start+dur),
      vis:i%13===0?"advisor":"public",
      loc:cat==="th"?`Teaching Hospital ${i%5+1}`:(cat==="cl"?`Clinic ${i%4+1}`:""),
      origin:`fixture-${count}`,
      notes:i%10===0?"Stress fixture with intentionally long overlap and label pressure.":"",
      lane:null
    });
  }
  if(count>=15){
    out.push({id:`fx${count}_preg`,t:"Pregnancy and family support during Step 2 CK",cat:"personal",mile:false,s:"2020-01",e:"2020-08",vis:"advisor",loc:"",origin:`fixture-${count}`,notes:"Overlaps exam preparation.",lane:null});
    out.push({id:`fx${count}_triple`,t:"Simultaneous work, USCE, and study pressure",cat:"work",mile:false,s:"2021-06",e:"2021-09",vis:"public",loc:"",origin:`fixture-${count}`,notes:"Overlap stress.",lane:null});
  }
  return out.slice(0,count);
}

function titleFor(i,cat,count){
  const base={
    work:"Clinical work block",
    personal:"Personal milestone",
    usmle:"USMLE study period",
    th:"Teaching hospital USCE rotation",
    cl:"Clinic USCE experience",
    res:"Research and publication work"
  }[cat]||"Timeline event";
  if(i%12===0)return `${base} with a deliberately long label for collision testing ${i+1}`;
  return `${base} ${i+1}`;
}

export const FIXTURE_DEFINITIONS=[
  {id:"fx5",label:"5 events",count:5,options:{startYear:2023,spanMonths:36}},
  {id:"fx15",label:"15 events",count:15,options:{startYear:2020,spanMonths:72}},
  {id:"fx30",label:"30 events",count:30,options:{startYear:2017,spanMonths:120,dense:true}},
  {id:"fx50",label:"50 events",count:50,options:{startYear:2007,spanMonths:240,dense:true}},
  {id:"fx_same_month",label:"Multiple events in one month",count:18,options:{startYear:2021,spanMonths:12,dense:true}},
  {id:"fx_10y",label:"10-year span",count:24,options:{startYear:2016,spanMonths:120}},
  {id:"fx_20y",label:"20-year span",count:36,options:{startYear:2006,spanMonths:240}}
];

export function loadFixtureById(id){
  const def=FIXTURE_DEFINITIONS.find((item)=>item.id===id)||FIXTURE_DEFINITIONS[0];
  return {definition:def,events:makeStressEvents(def.count,def.options)};
}


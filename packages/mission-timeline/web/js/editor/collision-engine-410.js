import {visibilityName} from "../core/canonical.js";

const BASE={width:1920,height:1080};
const FIXED_REGIONS=[
  {id:"title-plaque",label:"Timeline title plaque",x:610,y:18,w:700,h:92},
  {id:"interview-ribbon",label:"Interview ribbon",x:1510,y:96,w:285,h:126},
  {id:"category-key",label:"Category key",x:34,y:470,w:260,h:330},
  {id:"profile-card",label:"Profile card",x:118,y:818,w:270,h:184},
  {id:"photo-collage",label:"Photo frames",x:1165,y:824,w:640,h:178},
  {id:"sticky-note",label:"Sticky note",x:1510,y:490,w:260,h:205},
  {id:"advisor-pin-1",label:"Advisor pin 1",x:330,y:300,w:42,h:42,advisorOnly:true},
  {id:"advisor-pin-2",label:"Advisor pin 2",x:860,y:500,w:42,h:42,advisorOnly:true},
  {id:"advisor-pin-3",label:"Advisor pin 3",x:1390,y:650,w:42,h:42,advisorOnly:true}
];

function monthIndex(value){if(!/^\d{4}-\d{2}$/.test(value||""))return null;const [year,month]=value.split("-").map(Number);return year*12+month-1;}
function axisFor(events){const values=[];events.forEach((event)=>{const start=monthIndex(event.startDate||event.s),end=monthIndex(event.endDate||event.e||event.startDate||event.s);if(start!=null)values.push(start);if(end!=null)values.push(end);});if(!values.length){const year=new Date().getUTCFullYear();return {start:year*12,end:(year+3)*12+11};}return {start:Math.floor(Math.min(...values)/12)*12,end:Math.floor(Math.max(...values)/12)*12+11};}
function overlap(a,b,padding=0){return a.x<b.x+b.w+padding&&a.x+a.w+padding>b.x&&a.y<b.y+b.h+padding&&a.y+a.h+padding>b.y;}
function visibilityAllows(event,scope){const value=visibilityName(event.visibilityState||event.visibility||event.vis);if(value==="HIDDEN")return false;if(scope==="INTERVIEWER_SAFE")return value==="INTERVIEWER_SAFE";if(scope==="FULL_STORY")return value==="INTERVIEWER_SAFE"||value==="FULL_STORY";if(scope==="ADVISOR_PACKET")return value!=="STUDENT_ONLY";return true;}

export function analyzeCollisionLayout(document,{scope="FULL_STORY",width=BASE.width,height=BASE.height,density="FIT"}={}){
  const scaleX=width/BASE.width,scaleY=height/BASE.height,events=(document.events||[]).filter((event)=>visibilityAllows(event,scope));
  const axis=axisFor(events),total=Math.max(1,axis.end-axis.start+1),laneStep=density==="CONDENSED"?39:69;
  const boxes=[];
  events.forEach((event,index)=>{const start=monthIndex(event.startDate||event.s)??axis.start,end=monthIndex(event.endDate||event.e||event.startDate||event.s)??start,lane=Number.isInteger(event.lane)?event.lane:index%8,manual=event.manualOffset||{};const x=(118+((start-axis.start)/total)*1682+(Number(manual.x)||0))*scaleX,w=Math.max(event.eventType==="milestone"||event.mile?48:64,((Math.max(start,end)-start+1)/total)*1682)*scaleX,y=(event.eventType==="milestone"||event.mile?286:340+lane*laneStep+(Number(manual.y)||0))*scaleY,h=(event.eventType==="milestone"||event.mile?108:54)*scaleY;boxes.push({id:event.id,label:event.title||event.t||event.id,kind:event.eventType==="milestone"||event.mile?"milestone":"event",x,y,w,h,lane,visibility:visibilityName(event.visibilityState||event.visibility||event.vis)});});
  const fixed=FIXED_REGIONS.filter((region)=>!region.advisorOnly||scope==="ADVISOR_PACKET").map((region)=>({...region,x:region.x*scaleX,y:region.y*scaleY,w:region.w*scaleX,h:region.h*scaleY,kind:"fixed"}));
  const warnings=[];
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlap(boxes[i],boxes[j],4))warnings.push({code:"EVENT_COLLISION",severity:"HIGH",elementIds:[boxes[i].id,boxes[j].id],message:`${boxes[i].label} collides with ${boxes[j].label}.`});
  boxes.forEach((box)=>fixed.forEach((region)=>{if(overlap(box,region,2))warnings.push({code:"RESERVED_REGION_COLLISION",severity:"MEDIUM",elementIds:[box.id,region.id],message:`${box.label} enters the ${region.label.toLowerCase()} region.`});}));
  for(let i=0;i<fixed.length;i++)for(let j=i+1;j<fixed.length;j++)if(overlap(fixed[i],fixed[j],2))warnings.push({code:"FIXED_ELEMENT_COLLISION",severity:"HIGH",elementIds:[fixed[i].id,fixed[j].id],message:`${fixed[i].label} collides with ${fixed[j].label}.`});
  boxes.filter((box)=>box.kind==="event").forEach((box)=>{
    const startLabel={id:`${box.id}:start-date`,label:`${box.label} start date`,x:box.x,y:box.y-24*scaleY,w:74*scaleX,h:18*scaleY};
    const endLabel={id:`${box.id}:end-date`,label:`${box.label} end date`,x:box.x+box.w-74*scaleX,y:box.y-24*scaleY,w:74*scaleX,h:18*scaleY};
    const siteLabel={id:`${box.id}:site-label`,label:`${box.label} site label`,x:box.x-220*scaleX,y:box.y+7*scaleY,w:210*scaleX,h:22*scaleY};
    boxes.forEach((other)=>{if(other.id!==box.id){if(overlap(startLabel,other,1)||overlap(endLabel,other,1))warnings.push({code:"DATE_LABEL_COLLISION",severity:"MEDIUM",elementIds:[box.id,other.id],message:`Date labels for ${box.label} may collide with ${other.label}.`});if(overlap(siteLabel,other,1))warnings.push({code:"SITE_LABEL_COLLISION",severity:"MEDIUM",elementIds:[box.id,other.id],message:`Site label for ${box.label} may collide with ${other.label}.`});}});
  });
  boxes.forEach((box)=>{if(box.w<100)warnings.push({code:"COMPACT_LABEL",severity:"INFO",elementIds:[box.id],message:`${box.label} uses compact label fallback and a full tooltip.`});});
  const laneCount=boxes.filter((box)=>box.kind==="event").reduce((max,box)=>Math.max(max,box.lane+1),0);
  if(laneCount>9)warnings.push({code:"DENSE_LANES",severity:"MEDIUM",elementIds:boxes.map((box)=>box.id),message:`${laneCount} event lanes require condensed view or auto arrange.`});
  return {schemaVersion:"d1-collision-410.1",scope,width,height,density,axis,boxes,fixedRegions:fixed,warnings,stats:{visibleEvents:boxes.length,laneCount,collisionCount:warnings.filter((item)=>item.severity!=="INFO").length,compactLabelCount:warnings.filter((item)=>item.code==="COMPACT_LABEL").length}};
}

export function deterministicAutoArrange(events,{scope="FULL_STORY"}={}){
  const visible=events.filter((event)=>visibilityAllows(event,scope)).slice().sort((a,b)=>(monthIndex(a.startDate||a.s)||0)-(monthIndex(b.startDate||b.s)||0)||(monthIndex(a.endDate||a.e||a.startDate||a.s)||0)-(monthIndex(b.endDate||b.e||b.startDate||b.s)||0)||String(a.id).localeCompare(String(b.id)));
  const lanes=[];
  visible.forEach((event)=>{const start=monthIndex(event.startDate||event.s)||0,end=monthIndex(event.endDate||event.e||event.startDate||event.s)||start;if(event.manualOffset?.laneLocked&&Number.isInteger(event.lane)){lanes[event.lane]=Math.max(lanes[event.lane]??-Infinity,end);return;}let lane=0;while((lanes[lane]??-Infinity)>=start)lane++;event.lane=lane;lanes[lane]=end;});
  return {laneCount:lanes.length,placed:visible.length};
}

export {FIXED_REGIONS};

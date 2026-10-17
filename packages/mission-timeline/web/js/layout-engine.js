import {axisForEvents,eventRange,rangesOverlap,leftPct,widthPct} from "./timeline-engine.js";

function visibleEvents(document){
  return document.events.filter((event)=>{
    if(event.visibility==="hidden")return false;
    if(document.visibilityMode==="interviewSafe"&&!event.interviewSafe)return false;
    return true;
  });
}

export function layoutTimeline(document,options={}){
  const axis=axisForEvents(document.events,document.studentProfile);
  const events=visibleEvents(document);
  const duration=events.filter((e)=>e.eventType!=="milestone").sort((a,b)=>{
    const ar=eventRange(a),br=eventRange(b);
    return ar.start-br.start||ar.end-br.end||a.title.localeCompare(b.title);
  });
  const milestones=events.filter((e)=>e.eventType==="milestone").sort((a,b)=>eventRange(a).start-eventRange(b).start||a.title.localeCompare(b.title));
  const lanes=[];
  const placements={};
  const warnings=[];
  duration.forEach((event)=>{
    const range=eventRange(event);
    let lane=Number.isInteger(event.lane)?event.lane:null;
    if(lane==null){
      lane=0;
      while((lanes[lane]||[]).some((other)=>rangesOverlap(range,other.range,0)))lane++;
    }
    lanes[lane]=lanes[lane]||[];
    const collides=lanes[lane].some((other)=>rangesOverlap(range,other.range,0));
    lanes[lane].push({id:event.id,range});
    const months=range.end-range.start+1;
    const placement={id:event.id,lane,range,left:leftPct(range.start,axis),width:widthPct(range.start,range.end,axis),warnings:[]};
    if(collides)placement.warnings.push("manual lane collides with another event");
    if(months<=2)placement.warnings.push("short event needs compact label treatment");
    if((event.title||"").length>28)placement.warnings.push("long title will truncate");
    if((event.siteName||"").length>24)placement.warnings.push("site label may collide");
    placements[event.id]=placement;
    placement.warnings.forEach((message)=>warnings.push({eventId:event.id,severity:message.includes("collides")?"risk":"warning",message}));
  });
  const monthBuckets=new Map();
  milestones.forEach((event,index)=>{
    const range=eventRange(event);
    const key=range.start;
    const count=monthBuckets.get(key)||0;
    monthBuckets.set(key,count+1);
    const placement={id:event.id,lane:count,range,left:leftPct(range.start,axis),width:4,warnings:[]};
    if(count>0)placement.warnings.push("multiple milestones share this month");
    if(duration.some((other)=>rangesOverlap(range,eventRange(other),0)))placement.warnings.push("milestone overlaps an arrow");
    placements[event.id]=placement;
    placement.warnings.forEach((message)=>warnings.push({eventId:event.id,severity:"warning",message}));
  });
  const laneCount=Math.max(1,lanes.length);
  if(laneCount>8)warnings.push({severity:"warning",message:`dense layout uses ${laneCount} lanes`});
  if(events.length>=50)warnings.push({severity:"info",message:"50-event fixture is stress mode; graceful density is expected, not final polish"});
  return {axis,placements,warnings,stats:{visibleEvents:events.length,durationEvents:duration.length,milestones:milestones.length,laneCount}};
}

export function applyLayoutToLegacy(layout,legacyState){
  const targets=[legacyState.user,legacyState.demo].filter(Boolean);
  targets.forEach((bucket)=>{
    (bucket.events||[]).forEach((event)=>{
      const placement=layout.placements[event.id];
      if(!placement)return;
      if(event.vis==="hidden"||(legacyState.safe&&event.vis!=="public"))return;
      if(event.lane==null)event.lane=placement.lane;
      event.__407Placement=placement;
      event.__407Warnings=placement.warnings;
    });
  });
}

export function resetManualLayout(legacyState){
  [legacyState.user,legacyState.demo].filter(Boolean).forEach((bucket)=>{
    (bucket.events||[]).forEach((event)=>{
      event.lane=null;
      event.manualOffset=null;
    });
  });
}


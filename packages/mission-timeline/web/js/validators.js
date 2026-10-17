import {monthIndex,eventRange} from "./timeline-engine.js";

export function validateDocument(document,layout){
  const warnings=[];
  const ids=new Set();
  const keySet=new Set();
  const categoryMap=new Map(document.categories.map((category)=>[category.id,category]));
  document.events.forEach((event)=>{
    const label=event.title||event.id;
    if(!event.title)warnings.push({eventId:event.id,severity:"risk",message:"Missing title."});
    if(ids.has(event.id))warnings.push({eventId:event.id,severity:"risk",message:"Duplicate event id."});
    ids.add(event.id);
    const start=monthIndex(event.startDate);
    const end=monthIndex(event.endDate||event.startDate);
    if(start==null)warnings.push({eventId:event.id,severity:"risk",message:"Malformed start month."});
    if(event.eventType==="duration"&&!event.endDate)warnings.push({eventId:event.id,severity:"warning",message:"Duration event is missing an end date."});
    if(event.eventType==="duration"&&start!=null&&end!=null&&end<start)warnings.push({eventId:event.id,severity:"risk",message:"The end date comes before the start date."});
    if(event.eventType==="milestone"&&event.endDate)warnings.push({eventId:event.id,severity:"warning",message:"Milestone should not have a duration."});
    if(["th","cl"].includes(event.categoryId)&&!event.siteName)warnings.push({eventId:event.id,severity:"warning",message:"This USCE event needs a hospital or clinic name."});
    if((event.title||"").length>42)warnings.push({eventId:event.id,severity:"info",message:"Excessively long label will be truncated."});
    if(!categoryMap.has(event.categoryId))warnings.push({eventId:event.id,severity:"risk",message:"Unknown category."});
    if(event.visibility==="advisor"&&event.interviewSafe)warnings.push({eventId:event.id,severity:"risk",message:"Conflicting visibility flags."});
    if(document.visibilityMode==="interviewSafe"&&event.visibility!=="public"&&event.interviewSafe)warnings.push({eventId:event.id,severity:"risk",message:"Private event included in interviewer-safe mode."});
    const key=[event.title,event.startDate,event.endDate,event.categoryId].join("|");
    if(keySet.has(key))warnings.push({eventId:event.id,severity:"warning",message:"Possible duplicate event."});
    keySet.add(key);
    if(start!=null&&document.studentProfile.graduationDate&&monthIndex(document.studentProfile.graduationDate)>start&&!/medical|degree|graduat/i.test(label)){
      warnings.push({eventId:event.id,severity:"info",message:"This event appears before graduation; confirm chronology."});
    }
  });
  (layout?.warnings||[]).forEach((warning)=>warnings.push(warning));
  if((layout?.stats?.laneCount||0)>7)warnings.push({severity:"warning",message:"Crowded layout: review lane count and label collisions."});
  if(!document.media.length)warnings.push({severity:"info",message:"Media slots are empty; add media only if it helps the story."});
  return warnings;
}


// Consume the existing Scheduler-owned minimized calendar projection. No new
// endpoint, event storage, meeting URL, program identity or selected-student grant.
import {InterviewCalendarCapability} from '../../../capabilities/calendar-context.mjs';
export function calendarProjection(value){
  if(value?.schema!=='ivoc.calendar-context.v1'||!Number.isSafeInteger(value.eventCount)||value.eventCount<0||value.eventCount>24
    ||!Number.isSafeInteger(value.upcomingCount)||value.upcomingCount<0||value.upcomingCount>value.eventCount)return null;
  const next=value.nextEvent;
  if(value.upcomingCount>0&&(!next||typeof next.title!=='string'||!Number.isFinite(Date.parse(next.startsAt))))return null;
  return {schema:value.schema,eventCount:value.eventCount,upcomingCount:value.upcomingCount,nextEvent:value.upcomingCount>0?{
    title:next.title.slice(0,180),startsAt:next.startsAt,provider:String(next.provider||'unavailable').slice(0,40),
    status:String(next.status||'unknown').slice(0,40),joinAvailable:next.joinAvailable===true}:null};
}
export async function readOwnCalendar(controller,{isCurrent=()=>true,createCapability=()=>new InterviewCalendarCapability()}={}){
  const account=controller.account,durable=controller.durable,subject=account?.subject,role=account?.role;
  const current=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&account?.subject===subject&&account?.role===role;
  if(!current()||account?.mode!=='REAL'||!/^wp:[1-9][0-9]*$/.test(subject||''))return null;
  const admitted=async()=>{const fresh=await account.api.bootstrap();return current()&&fresh?.entitlement?.admitted===true
    &&fresh.identity?.subject===subject&&Boolean(fresh.identity.admin)===(role==='admin');};
  try{
    if(!await admitted())return current()?{state:'unavailable'}:null;
    const projection=calendarProjection(await createCapability().studentCalendar());
    if(!current())return null;
    // Recheck the current cookie/admission after the owner read, not a cached
    // actor label. A login change must not publish the intervening projection.
    if(!projection||!await admitted())return current()?{state:'unavailable'}:null;
    return {state:'ready',projection};
  }catch{return current()?{state:'unavailable'}:null;}
}
export function calendarHomeAction(value,{now=Date.now()}={}){
  const projection=value?.state==='ready'?calendarProjection(value.projection):null,next=projection?.nextEvent;
  if(!next||Date.parse(next.startsAt)<now)return null;
  return {title:'Prepare for your next interview.',body:`Your connected calendar lists ${next.title} on ${new Date(next.startsAt).toLocaleString()}. Choose the matching verified program; an appointment is not a RISE program identity.`,
    cta:'Prepare for this interview',href:'#/prepare',plan:['Choose your verified program','Select authorized context','Rehearse your interview','Review your recording']};
}

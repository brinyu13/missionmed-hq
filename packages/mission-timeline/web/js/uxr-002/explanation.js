import {parseMonth,uid} from "./utils.js";

export const EXPLANATION_TEXT_MAX=180;
export const EXPLANATION_LIMIT=12;
export const EXPLANATION_BOUNDS=Object.freeze({
  minX:96,
  maxX:1744,
  minY:112,
  maxY:904,
  minWidth:220,
  maxWidth:520,
  minHeight:96,
  maxHeight:220
});

function clean(value){
  return String(value||"").trim();
}

function clamp(value,min,max,fallback){
  const number=Number(value);
  return Math.max(min,Math.min(max,Number.isFinite(number)?number:fallback));
}

function normalizedTarget(target={}){
  const kind=["event","date","region","coordinate"].includes(target.kind)
    ?target.kind
    :"coordinate";
  return{
    kind,
    eventId:kind==="event"?clean(target.eventId):"",
    date:kind==="date"?(parseMonth(target.date)||""):"",
    region:kind==="region"?clean(target.region).slice(0,60):"",
    x:clamp(target.x,96,1824,960),
    y:clamp(target.y,112,968,540)
  };
}

export function isExplanationEvent(event){
  return event?.fields?.builderDomain==="explanation"||
    event?.fields?.elementType==="explanation";
}

export function normalizeExplanationEvent(event){
  const source=event||{};
  const fields=source.fields||{};
  const text=clean(fields.explanationText||source.title).slice(
    0,
    EXPLANATION_TEXT_MAX
  );
  return{
    ...source,
    id:clean(source.id)||uid("explanation"),
    title:text||"Explanation",
    categoryId:"personal",
    eventType:"milestone",
    startDate:parseMonth(source.startDate)||parseMonth(fields.target?.date)||"",
    endDate:null,
    openEnded:false,
    visibilityState:source.visibilityState==="ADVISOR_ONLY"
      ?"ADVISOR_ONLY"
      :"INTERVIEWER_SAFE",
    siteName:"",
    notes:"",
    sourceType:source.sourceType||"guided-explanation",
    fields:{
      ...fields,
      builderDomain:"explanation",
      elementType:"explanation",
      explanationText:text,
      x:clamp(fields.x,EXPLANATION_BOUNDS.minX,EXPLANATION_BOUNDS.maxX,1180),
      y:clamp(fields.y,EXPLANATION_BOUNDS.minY,EXPLANATION_BOUNDS.maxY,144),
      width:clamp(
        fields.width,
        EXPLANATION_BOUNDS.minWidth,
        EXPLANATION_BOUNDS.maxWidth,
        360
      ),
      height:clamp(
        fields.height,
        EXPLANATION_BOUNDS.minHeight,
        EXPLANATION_BOUNDS.maxHeight,
        126
      ),
      leaderEnabled:fields.leaderEnabled!==false,
      target:normalizedTarget(fields.target)
    }
  };
}

export function createExplanation(document,{
  text,
  target,
  startDate="",
  visibilityState="INTERVIEWER_SAFE"
}={}){
  const value=clean(text);
  if(!value)return{ok:false,code:"EXPLANATION_TEXT_REQUIRED"};
  if(value.length>EXPLANATION_TEXT_MAX){
    return{ok:false,code:"EXPLANATION_TEXT_TOO_LONG"};
  }
  const existing=(document?.events||[]).filter(isExplanationEvent);
  if(existing.length>=EXPLANATION_LIMIT){
    return{ok:false,code:"EXPLANATION_LIMIT_REACHED"};
  }
  const event=normalizeExplanationEvent({
    id:uid("explanation"),
    title:value,
    startDate:parseMonth(startDate)||parseMonth(target?.date)||"",
    visibilityState,
    fields:{explanationText:value,target}
  });
  document.events=[...(document.events||[]),event];
  return{ok:true,event:structuredClone(event)};
}

export function updateExplanation(document,eventId,changes={}){
  const index=(document?.events||[]).findIndex(
    (event)=>event.id===eventId&&isExplanationEvent(event)
  );
  if(index<0)return{ok:false,code:"EXPLANATION_NOT_FOUND"};
  const current=document.events[index];
  const text=clean(changes.text??current.fields?.explanationText);
  if(!text)return{ok:false,code:"EXPLANATION_TEXT_REQUIRED"};
  if(text.length>EXPLANATION_TEXT_MAX){
    return{ok:false,code:"EXPLANATION_TEXT_TOO_LONG"};
  }
  const next=normalizeExplanationEvent({
    ...current,
    title:text,
    startDate:changes.startDate??current.startDate,
    visibilityState:changes.visibilityState??current.visibilityState,
    fields:{
      ...(current.fields||{}),
      explanationText:text,
      ...(changes.target?{target:changes.target}:{}),
      ...(changes.leaderEnabled!=null
        ?{leaderEnabled:changes.leaderEnabled}
        :{}),
      ...(changes.x!=null?{x:changes.x}:{}),
      ...(changes.y!=null?{y:changes.y}:{}),
      ...(changes.width!=null?{width:changes.width}:{}),
      ...(changes.height!=null?{height:changes.height}:{})
    }
  });
  document.events[index]=next;
  return{ok:true,event:structuredClone(next)};
}

export function moveExplanation(document,eventId,{x,y}={}){
  return updateExplanation(document,eventId,{x,y});
}

export function resizeExplanation(document,eventId,{width,height}={}){
  return updateExplanation(document,eventId,{width,height});
}

export function deleteExplanation(document,eventId){
  const before=(document?.events||[]).length;
  document.events=(document?.events||[]).filter(
    (event)=>!(event.id===eventId&&isExplanationEvent(event))
  );
  return document.events.length!==before;
}

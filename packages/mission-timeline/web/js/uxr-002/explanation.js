import {parseMonth,uid} from "./utils.js";

export const EXPLANATION_TEXT_MAX=180;
export const EXPLANATION_LIMIT=12;
export const EXPLANATION_BOUNDS=Object.freeze({
  minX:96,
  maxX:1744,
  minY:112,
  maxY:904,
  minWidth:132,
  maxWidth:520,
  minHeight:96,
  maxHeight:320
});

function clean(value){
  return String(value||"").trim();
}

function clamp(value,min,max,fallback){
  const number=Number(value);
  return Math.max(min,Math.min(max,Number.isFinite(number)?number:fallback));
}

export function layoutExplanationText(text,{width=180,height=166,x=1470,y=674,rotation=8}={}){
  const cardWidth=Math.max(EXPLANATION_BOUNDS.minWidth,Number(width)||180);
  const requestedHeight=Math.max(EXPLANATION_BOUNDS.minHeight,Number(height)||166);
  // Short explanations are plain paragraphs. Preserve every word and split a
  // long token across visual lines instead of letting it escape the card.
  const words=String(text||"").trim().split(/\s+/).filter(Boolean);
  const wrap=(size)=>{
    const capacity=Math.max(1,Math.floor((cardWidth-28)/(size*.57)));
    const lines=[];let line="";
    for(const original of words){
      let word=original;
      if(line&&line.length+1+word.length>capacity){lines.push(line);line="";}
      while(word.length>capacity){lines.push(word.slice(0,capacity));word=word.slice(capacity);}
      if(word)line=line?`${line} ${word}`:word;
    }
    if(line)lines.push(line);
    return lines.length?lines:[""];
  };
  let fontSize=20,lines=wrap(fontSize);
  while(fontSize>12&&lines.length*fontSize*1.12>requestedHeight-28){fontSize-=1;lines=wrap(fontSize);}
  // A readable font establishes the minimum height. Resizing cannot clip or
  // silently remove authored text; the scene, handles and export share this box.
  const cardHeight=Math.max(requestedHeight,Math.ceil(lines.length*fontSize*1.12+28));
  const angle=(Number(rotation)||0)*Math.PI/180;
  const xPadding=Math.max(0,(Math.abs(cardWidth*Math.cos(angle))+Math.abs(cardHeight*Math.sin(angle))-cardWidth)/2);
  const yPadding=Math.max(0,(Math.abs(cardWidth*Math.sin(angle))+Math.abs(cardHeight*Math.cos(angle))-cardHeight)/2);
  return{
    x:clamp(x,EXPLANATION_BOUNDS.minX,Math.min(EXPLANATION_BOUNDS.maxX,1920-cardWidth-xPadding),1470),
    y:clamp(y,EXPLANATION_BOUNDS.minY,Math.min(EXPLANATION_BOUNDS.maxY,1080-cardHeight-yPadding),674),
    width:cardWidth,height:cardHeight,fontSize,lines
  };
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
  const layout=layoutExplanationText(text,{
    width:clamp(fields.width,EXPLANATION_BOUNDS.minWidth,EXPLANATION_BOUNDS.maxWidth,180),
    height:clamp(fields.height,EXPLANATION_BOUNDS.minHeight,EXPLANATION_BOUNDS.maxHeight,166),
    x:fields.x,y:fields.y
  });
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
      x:layout.x,
      y:layout.y,
      width:layout.width,
      height:layout.height,
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

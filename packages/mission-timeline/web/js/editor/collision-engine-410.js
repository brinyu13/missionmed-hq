import {visibilityName} from "../core/canonical.js";
import {serializeFounderPresentation} from "../presentation/founder-presentation-serializer.js";
import {resolveFounderPresentationSvg} from "../presentation/resolved-founder-presentation.js";

const BASE={width:1920,height:1080};
function monthIndex(value){if(!/^\d{4}-\d{2}$/.test(value||""))return null;const [year,month]=value.split("-").map(Number);return year*12+month-1;}
function visibilityAllows(event,scope){const value=visibilityName(event.visibilityState||event.visibility||event.vis);if(value==="HIDDEN")return false;if(scope==="INTERVIEWER_SAFE")return value==="INTERVIEWER_SAFE";if(scope==="FULL_STORY")return value==="INTERVIEWER_SAFE"||value==="FULL_STORY";if(scope==="ADVISOR_PACKET")return value!=="STUDENT_ONLY";return true;}

function corners(bounds,scaleX,scaleY){
  const cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2;
  const radians=(bounds.rotation||0)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{
    const x=sx*bounds.width/2,y=sy*bounds.height/2;
    return{x:(cx+x*c-y*s)*scaleX,y:(cy+x*s+y*c)*scaleY};
  });
}
function enclosing(points){
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return{x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y};
}
function overlap(left,right){
  if(left.x>=right.x+right.w||left.x+left.w<=right.x||left.y>=right.y+right.h||left.y+left.h<=right.y)return false;
  // Rotated label/photo bounds stay oriented instead of becoming a larger false box.
  for(const polygon of [left.polygon,right.polygon])for(let index=0;index<polygon.length;index++){
    const next=polygon[(index+1)%polygon.length],current=polygon[index];
    const axis={x:next.y-current.y,y:current.x-next.x};
    const project=points=>points.map(p=>p.x*axis.x+p.y*axis.y);
    const a=project(left.polygon),b=project(right.polygon);
    if(Math.max(...a)<=Math.min(...b)||Math.max(...b)<=Math.min(...a))return false;
  }
  return true;
}
function painted(node){
  if(!node.bounds||node.sourceAttributes['data-board-background']||node.sourceAttributes['data-advanced-background'])return false;
  if(Number(node.style.opacity)===0||node.sourceAttributes.visibility==='hidden'||node.sourceAttributes.display==='none')return false;
  // Connector stems/ticks and decorative highlight strokes are deliberate connectors,
  // not text or occluding event bodies. Filled paths, images and text remain checked.
  if(node.kind==='path'&&(node.lineOnly||node.bounds.width<1||node.bounds.height<1))return false;
  return true;
}
function labelForGroup(id){return String(id).replace(/^furniture:/,'').replace(/-/g,' ');}

export function analyzeCollisionLayout(document,{scope="FULL_STORY",width=BASE.width,height=BASE.height,density="FIT",currentMonth=null,measureText=null}={}){
  const rendered=serializeFounderPresentation(document,{scope,currentMonth});
  const projection=resolveFounderPresentationSvg(rendered.svg,{advancedGroups:document.advanced?.groups||[],measureText});
  const scaleX=width/BASE.width,scaleY=height/BASE.height;
  // The canonical scope projection decides what is visible; the map supplies labels
  // only for components that actually survived that projection.
  const events=new Map((document.events||[]).map(event=>[String(event.id),event]));
  const groups=new Map(projection.groups.map(group=>[group.id,group]));
  const components=projection.nodes.filter(painted).filter(node=>node.groupId).map(node=>{
    const polygon=corners(node.bounds,scaleX,scaleY);
    const group=groups.get(node.groupId);
    const parent=group?.parentId&&groups.get(group.parentId);
    const owner=node.semanticRef||((parent?.id||'').startsWith('advanced-group:')?parent.id:node.groupId);
    const part=node.sourceAttributes['data-arrow-caption']?'date':node.kind==='text'?'label':'body';
    return{...enclosing(polygon),polygon,id:node.id,owner,groupId:node.groupId,role:node.role,part,kind:node.kind,text:node.text||'',rotation:node.bounds.rotation||0};
  });
  const summarize=(owner,parts,kind,label)=>({id:owner,label,kind,...enclosing(parts.flatMap(part=>part.polygon)),parts:parts.map(({id,x,y,w,h,rotation,part})=>({id,x,y,w,h,rotation,part}))});
  const boxes=[];
  for(const [id,event] of events){
    const parts=components.filter(part=>part.owner===id&&part.role==='event');
    if(parts.length)boxes.push({...summarize(id,parts,event.eventType==='milestone'||event.mile?'milestone':'event',event.title||event.t||id),lane:rendered.scene.events?.find(item=>item.id===id)?.lane??event.lane??0,visibility:visibilityName(event.visibilityState||event.visibility||event.vis)});
  }
  const fixed=[];
  for(const id of new Set(components.filter(part=>['furniture','profile'].includes(part.role)).map(part=>part.groupId))){
    const parts=components.filter(part=>part.groupId===id);
    fixed.push(summarize(id,parts,'fixed',labelForGroup(id)));
  }
  const objects=[];
  for(const id of new Set(components.filter(part=>['annotation','media'].includes(part.role)).map(part=>part.owner))){
    const parts=components.filter(part=>part.owner===id);
    objects.push(summarize(id,parts,'object',parts.find(part=>part.text)?.text||'Canvas object'));
  }
  const warnings=[],seen=new Set();
  const add=(code,severity,ids,message)=>{
    const key=code+'|'+[...ids].sort().join('|');if(seen.has(key))return;seen.add(key);
    warnings.push({code,severity,elementIds:ids,message});
  };
  const eventParts=components.filter(part=>part.role==='event');
  for(let i=0;i<eventParts.length;i++)for(let j=i+1;j<eventParts.length;j++){
    const a=eventParts[i],b=eventParts[j];if(a.owner===b.owner||!overlap(a,b))continue;
    const code=a.part==='date'||b.part==='date'?'DATE_LABEL_COLLISION':'EVENT_COLLISION';
    add(code,code==='EVENT_COLLISION'?'HIGH':'MEDIUM',[a.owner,b.owner],`${events.get(a.owner)?.title||a.owner} overlaps ${events.get(b.owner)?.title||b.owner} in the rendered presentation.`);
  }
  for(const part of eventParts)for(const region of components.filter(part=>['furniture','profile'].includes(part.role))){
    if(region.groupId==='furniture:axis'&&(events.get(part.owner)?.eventType==='milestone'||events.get(part.owner)?.mile))continue;
    if(overlap(part,region))add('RESERVED_REGION_COLLISION','MEDIUM',[part.owner,region.groupId],`${events.get(part.owner)?.title||part.owner} overlaps the rendered ${labelForGroup(region.groupId)}.`);
  }
  const objectParts=components.filter(part=>['annotation','media'].includes(part.role));
  for(const part of objectParts)for(const other of eventParts){
    if(overlap(part,other))add('CANVAS_OBJECT_COLLISION','MEDIUM',[part.owner,other.owner],`A canvas object overlaps ${events.get(other.owner)?.title||other.owner} in the rendered presentation.`);
  }
  // Canonical furniture and objects within an intentional Advanced group may overlap.
  // Neither is independently relocated or treated as a corrupted protected region.
  const axisYears=projection.nodes.filter(node=>node.groupId==='furniture:axis'&&node.kind==='text'&&/^\d{4}$/.test(node.text||'')).map(node=>Number(node.text));
  const axis={start:axisYears.length?Math.min(...axisYears)*12:null,end:axisYears.length?Math.max(...axisYears)*12+11:null};
  const laneCount=rendered.scene.laneLayout?.laneCount??boxes.filter(box=>box.kind==='event').reduce((max,box)=>Math.max(max,box.lane+1),0);
  return{schemaVersion:'d1-collision-021.1',geometrySource:projection.schema,textMeasurement:measureText?'provided':typeof globalThis.document!=='undefined'?'browser-canvas':'font-metric-fallback',scope,width,height,density,axis,boxes,fixedRegions:fixed,objects,warnings,stats:{visibleEvents:boxes.length,laneCount,collisionCount:warnings.filter(item=>item.severity!=='INFO').length,compactLabelCount:0}};
}

export function deterministicAutoArrange(events,{scope="FULL_STORY"}={}){
  const visible=events.filter((event)=>visibilityAllows(event,scope)).slice().sort((a,b)=>(monthIndex(a.startDate||a.s)||0)-(monthIndex(b.startDate||b.s)||0)||(monthIndex(a.endDate||a.e||a.startDate||a.s)||0)-(monthIndex(b.endDate||b.e||b.startDate||b.s)||0)||String(a.id).localeCompare(String(b.id)));
  const lanes=[];
  visible.forEach((event)=>{const start=monthIndex(event.startDate||event.s)||0,end=monthIndex(event.endDate||event.e||event.startDate||event.s)||start;if(event.manualOffset?.laneLocked&&Number.isInteger(event.lane)){lanes[event.lane]=Math.max(lanes[event.lane]??-Infinity,end);return;}let lane=0;while((lanes[lane]??-Infinity)>=start)lane++;event.lane=lane;lanes[lane]=end;});
  return {laneCount:lanes.length,placed:visible.length};
}

import {serializeFounderPresentation,founderMilestoneTemplateGeometry,violatesFounderTemplateBand,FOUNDER_MILESTONE_RIBBON_TOP,FOUNDER_RIBBON_BOTTOM} from './founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from './resolved-founder-presentation.js';
import {parsePresentationXml,xmlNodes} from './presentation-xml.js';
import {applyLocalLayoutCriticSceneCommand} from '../editor/scene-commands.js';
import {setAxisPresentationOverride,setAxisSegmentWeights} from '../uxr-002/advanced-studio.js';
import {locked407FMilestoneGeometry} from '../uxr-002/locked-407f-export.js';
import {parseMonth} from '../uxr-002/utils.js';
import {presentationDayDate} from './source-date-wording.js';

export const LAYOUT_CRITIC_VERSION='d1-local-layout-critic.2';
export const LAYOUT_CRITIC_CONSENT_VERSION='d1-local-layout-geometry-consent.1';
export const LAYOUT_CRITIC_REASON_CODES=Object.freeze(['REDUCE_COLLISION','CLEAR_RIBBON','BALANCE_SPACING','REDUCE_CLIPPING']);
const clone=value=>structuredClone(value);
const round=value=>Math.round(Number(value)*1e6)/1e6;
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key))&&allowed.every(key=>Object.hasOwn(value,key));
const number=(value,min=-10000,max=10000)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const alias=value=>typeof value==='string'&&/^[gpes][0-9]{4}$/.test(value);
const error=code=>Object.assign(new Error(code),{code});
export function stableLayoutJson(value){
  if(Array.isArray(value))return '['+value.map(stableLayoutJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableLayoutJson(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
export async function layoutCriticDigest(value){
  const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableLayoutJson(value)));
  return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function bounds(box){return Object.fromEntries(['x','y','width','height','rotation'].map(key=>[key,round(box[key]||0)]));}
function corners(box){
  const angle=box.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=box.x+box.width/2,cy=box.y+box.height/2;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:cx+x*box.width/2*c-y*box.height/2*s,y:cy+x*box.width/2*s+y*box.height/2*c}));
}
function overlaps(a,b){
  if(!a.rotation&&!b.rotation)return a.x<b.x+b.width-.5&&a.x+a.width>b.x+.5&&a.y<b.y+b.height-.5&&a.y+a.height>b.y+.5;
  const pa=corners(a),pb=corners(b);
  for(const polygon of [pa,pb])for(let i=0;i<4;i++){
    const next=polygon[(i+1)%4],p=polygon[i],axis={x:next.y-p.y,y:p.x-next.x};
    const left=pa.map(p=>p.x*axis.x+p.y*axis.y),right=pb.map(p=>p.x*axis.x+p.y*axis.y);
    if(Math.max(...left)<=Math.min(...right)+.5||Math.max(...right)<=Math.min(...left)+.5)return false;
  }
  return true;
}
function painted(node){
  const a=node.sourceAttributes||{},style=node.style||{};
  return node.bounds&&node.groupId&&!a['data-board-background']&&!a['data-advanced-background']&&Number(style.opacity??1)>0&&Number(style['fill-opacity']??1)>0&&a.visibility!=='hidden'&&a.display!=='none'&&
    !(node.kind==='path'&&(node.lineOnly||style.fill==='none'||node.bounds.width<1||node.bounds.height<1));
}
// Independent painted-part gate: the legacy engines exempt axis encounters too
// broadly. Only connector strokes are excluded, never flag bodies/date/labels.
export function measureLayoutCriticSafety(parts,targets=[]){
  const collisions=new Set(),axisOverlaps=new Set(),crowding=new Set(),outside=new Set(),overflow=new Set();
  for(const p of parts){
    if(corners(p.bounds).some(point=>point.x<-.5||point.y<-.5||point.x>1920.5||point.y>1080.5))outside.add(p.id);
    if(p.overflow)overflow.add(p.id);
  }
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    const a=parts[i],b=parts[j];
    if(a.groupId===b.groupId||(!['EVENT','OBJECT'].includes(a.role)&&!['EVENT','OBJECT'].includes(b.role)))continue;
    const pair=[a.groupId,b.groupId].sort().join('|');
    if(!overlaps(a.bounds,b.bounds)){
      const padded=box=>({...box,x:box.x-4,y:box.y-4,width:box.width+8,height:box.height+8});
      if(overlaps(padded(a.bounds),padded(b.bounds)))crowding.add(pair);
      continue;
    }
    collisions.add(pair);
    if(a.role==='AXIS'||b.role==='AXIS')axisOverlaps.add(pair);
  }
  const templateViolationTargets=targets.filter(target=>{
    const points=parts.filter(part=>target.partIds.includes(part.id)).flatMap(part=>corners(part.bounds));
    return violatesFounderTemplateBand({...target,bodyTop:points.length?Math.min(...points.map(point=>point.y)):-Infinity,bodyBottom:points.length?Math.max(...points.map(point=>point.y)):Infinity});
  }).map(target=>target.id).sort();
  const durationInversionPairs=measureLayoutCriticDurationInversions(targets);
  return {durationInversionCount:durationInversionPairs.length,durationInversionPairs,collisionCount:collisions.size,axisOverlapCount:axisOverlaps.size,crowdingCount:crowding.size,offCanvasCount:outside.size,overflowCount:overflow.size,
    templateViolationCount:templateViolationTargets.length,templateViolationTargets,
    collisionPairs:[...collisions].sort(),axisOverlapPairs:[...axisOverlaps].sort(),crowdingPairs:[...crowding].sort(),offCanvasParts:[...outside].sort(),overflowParts:[...overflow].sort()};
}
function hasManualPlacement(event,object,document){
  const groups=document.advanced?.scene?.groups||document.advanced?.groups||[];
  return !!(event?.manualOffset?.laneLocked||Number(event?.manualOffset?.x)||Number(event?.manualOffset?.y)||(object?.geometry&&object.presentation?.localLayoutCriticAuto!==true)||object?.locked||object?.groupId||groups.some(group=>group.locked&&group.childIds?.includes(object?.id)));
}
// Source dates stay local. Overlapping precision intervals share a start group:
// month-only facts cannot invent an order against exact days in that month.
function factualStartInterval(source){
  const precision=source?.datePrecision?.start;
  if(precision&&!['YEAR','MONTH','DAY'].includes(precision))return null;
  const raw=source?.startDate??source?.startMonth??source?.month;
  const exact=presentationDayDate(raw)||presentationDayDate(source?.sourceDateWording?.start?.normalizedMonth);
  const month=parseMonth(raw)||exact?.slice(0,7)||parseMonth(source?.startMonth??source?.month);
  if(!month||!/^\d{4}-\d{2}$/.test(month))return null;
  if(exact&&exact.slice(0,7)!==month)return null;
  if(precision==='DAY'&&!exact)return null;
  if(precision==='YEAR')return [month.slice(0,4)+'-01-01',month.slice(0,4)+'-12-31'];
  if(exact&&precision!=='MONTH')return [exact,exact];
  return [month+'-01',month+'-31'];
}
function rankFactualStarts(targets,intervals){
  const known=targets.map((target,index)=>({target,interval:intervals[index]})).filter(item=>item.interval)
    .sort((a,b)=>a.interval[0].localeCompare(b.interval[0])||a.interval[1].localeCompare(b.interval[1]));
  let rank=0,end=null;
  for(const {target,interval} of known){
    if(end===null||interval[0]>end){rank++;end=interval[1];}else if(interval[1]>end)end=interval[1];
    target.startRank=rank;target.sameStartGroup=rank;
  }
}
// Only automatic independent durations participate. Human/group/locked/study
// placements and native above-axis milestones are deliberate exceptions.
export function measureLayoutCriticDurationInversions(targets){
  const durations=targets.filter(target=>target.kind==='DURATION'&&target.editable&&target.startRank!==null),pairs=[];
  for(const earlier of durations)for(const later of durations){
    if(earlier.startRank<later.startRank&&earlier.sameStartGroup!==later.sameStartGroup&&earlier.geometry.y>=later.geometry.y-.04)pairs.push(earlier.id+'|'+later.id);
  }
  return pairs.sort();
}
function createsDurationInversion(before,after){
  const existing=new Set(measureLayoutCriticDurationInversions(before));
  return measureLayoutCriticDurationInversions(after).some(pair=>!existing.has(pair));
}
function localRenderBinding(options){
  // URL strings remain in browser custody. Only the private source digest binds
  // their identities; provider input and its scene digest remain geometry-only.
  const {mediaById=new Map(),...rest}=options;
  if(!(mediaById instanceof Map))throw error('LAYOUT_CRITIC_RENDER_OPTIONS_INVALID');
  return {options:Object.fromEntries(Object.entries(rest).filter(([,value])=>typeof value!=='function')),
    media:[...mediaById.entries()].sort(([a],[b])=>String(a).localeCompare(String(b)))};
}
function snapshotRenderOptions({scope='EVERYTHING',currentMonth=null,measureText=null,mediaById=new Map(),...rest}={}){
  if(!(mediaById instanceof Map))throw error('LAYOUT_CRITIC_RENDER_OPTIONS_INVALID');
  return {...rest,scope,currentMonth,measureText,mediaById:new Map(mediaById)};
}
function assertResolvedMedia(document,rendered,paint){
  const projection=rendered.scene.mediaProjection||{},images=new Set(paint.nodes.filter(node=>node.kind==='image').map(node=>node.sourceAttributes['data-media-id']).filter(Boolean));
  const missingNode=xmlNodes(parsePresentationXml(rendered.svg),node=>node.attrs?.['data-media-state']==='missing').length>0;
  const missingBackground=document.advanced?.background?.kind==='upload'&&rendered.scene.advancedProjection?.background?.kind!=='upload';
  if(projection.pendingIds?.length||(projection.expectedIds||[]).some(id=>!images.has(id))||missingNode||missingBackground)throw error('LAYOUT_CRITIC_MEDIA_UNRESOLVED');
}
function render(document,options){
  const rendered=serializeFounderPresentation(document,options);
  const paint=resolveFounderPresentationSvg(rendered.svg,{measureText:options.measureText,advancedGroups:document.advanced?.groups||[]});
  assertResolvedMedia(document,rendered,paint);
  return {rendered,paint};
}
export async function projectLayoutCritic(document,renderOptions={}){
  const options=snapshotRenderOptions(renderOptions),sourceDigest=await layoutCriticDigest({document,renderOptions:localRenderBinding(options)}),{rendered,paint}=render(document,options);
  if(paint.nodes.length>4000||rendered.scene.omissions?.length)throw error('LAYOUT_CRITIC_RENDER_INCOMPLETE');
  const groupIds=new Map(paint.groups.map((group,index)=>[group.id,'g'+String(index+1).padStart(4,'0')]));
  const parts=paint.nodes.filter(painted).map((node,index)=>({
    id:'p'+String(index+1).padStart(4,'0'),groupId:groupIds.get(node.groupId),
    role:node.groupId==='furniture:axis'?'AXIS':node.role==='event'?'EVENT':['media','annotation'].includes(node.role)?'OBJECT':'FURNITURE',
    kind:node.kind==='text'?'TEXT':node.kind==='image'?'IMAGE':'BODY',bounds:bounds(node.occlusionBounds||node.bounds),
    fontSize:node.kind==='text'?round(node.fontSize):0,lineHeight:node.kind==='text'?round(node.lineHeight):0,
    characterCount:node.kind==='text'?node.text.length:0,overflow:node.sourceAttributes['data-text-overflow']==='true'
  }));
  const eventObjects=rendered.scene.founderPresentation?.advancedScene?.objects||[];
  const templateTargets=new Map(founderMilestoneTemplateGeometry(rendered.scene,paint).map(target=>[target.eventId,target]));
  const targetMap=new Map(),targets=[],startIntervals=[];
  for(const event of document.events||[]){
    const eventNodes=paint.nodes.filter(node=>node.semanticRef===String(event.id));
    const body=eventNodes.find(node=>node.sourceAttributes['data-continuous-duration-arrow']);
    const flag=locked407FMilestoneGeometry(rendered.scene,event.id);
    if(!body&&!flag)continue;
    const object=eventObjects.find(object=>object.type==='event'&&(String(object.semanticRef||'')===String(event.id)||String(object.id)===String(event.id)));
    const id='e'+String(targets.length+1).padStart(4,'0');
    const eventParts=parts.filter(part=>part.groupId===groupIds.get('event:'+event.id));
    const arrow=rendered.scene.arrows?.find(arrow=>String(arrow.id)===String(event.id));
    const templateTarget=templateTargets.get(String(event.id));
    const attached=templateTarget?.kind==='EXAM_RESULT'||Boolean(arrow?.study&&rendered.scene.flags?.some(flag=>flag.categoryId==='exams'&&flag.examAttemptId&&flag.examAttemptId===arrow.examAttemptId));
    const joined=eventNodes.some(node=>node.sourceAttributes['data-personal-band']);
    const geometry=flag?{x:flag.x,y:flag.y,width:flag.width,height:flag.height,rotation:flag.rotation}:bounds(body.bounds);
    // Full painted arrow bounds, not its shaft or combined text envelope.
    const editable=!hasManualPlacement(event,object,document)&&!attached&&!joined&&Math.abs(geometry.rotation||0)<1e-6&&document.layoutLock!==true;
    targets.push({id,groupId:eventParts[0]?.groupId||groupIds.get('event:'+event.id),kind:flag?templateTarget.kind:'DURATION',editable,
      geometry:bounds(geometry),startRank:null,sameStartGroup:null,poleFootY:flag?templateTarget.poleFootY:null,attachmentY:flag?templateTarget.attachmentY:null,partIds:eventParts.map(part=>part.id)});
    startIntervals.push(factualStartInterval(arrow||rendered.scene.flags?.find(flag=>String(flag.id)===String(event.id))));
    targetMap.set(id,{eventId:String(event.id),objectId:object?.id||String(event.id),kind:flag?'MILESTONE':'DURATION',geometry,editable});
  }
  rankFactualStarts(targets,startIntervals);
  if(targets.length>200)throw error('LAYOUT_CRITIC_LIMIT');
  const axisNodes=xmlNodes(parsePresentationXml(rendered.svg),node=>Object.hasOwn(node.attrs||{},'data-axis-segment-id'));
  const segmentMap=new Map();
  const segments=axisNodes.map((node,index)=>{
    const cell=node.children.find(child=>typeof child==='object'&&child.attrs?.['data-axis-cell']);
    const id='s'+String(index+1).padStart(4,'0');segmentMap.set(id,String(node.attrs['data-axis-segment-id']));
    return {id,x:round(cell?.attrs.x),width:round(node.attrs['data-axis-date-width']),weight:round(node.attrs['data-axis-segment-weight'])};
  });
  const safety=measureLayoutCriticSafety(parts,targets);
  const input={version:LAYOUT_CRITIC_VERSION,canvas:{width:1920,height:1080},parts,targets,
    axis:{editable:document.layoutLock!==true&&(document.presentationOverrides?.axis?.mode!=='manual'||document.presentationOverrides.axis.localLayoutCriticAuto===true)&&!eventObjects.some(object=>object.type==='event'&&object.geometry&&object.presentation?.localLayoutCriticAuto!==true)&&!(document.events||[]).some(event=>hasManualPlacement(event,null,document)),segments},safety};
  validateLayoutCriticInput(input);
  const sceneDigest=await layoutCriticDigest(input);
  // Never serialize localContext to the handler. It retains the private lookup
  // and source digest exclusively for browser-side application and stale checks.
  return {input,sceneDigest,localContext:{targetMap,segmentMap,sourceDigest,options,scene:rendered.scene,axis:rendered.scene.composedAxis||null,paint}};
}
export function validateLayoutCriticInput(input){
  if(!keys(input,['version','canvas','parts','targets','axis','safety'])||input.version!==LAYOUT_CRITIC_VERSION||!keys(input.canvas,['width','height'])||input.canvas.width!==1920||input.canvas.height!==1080)throw error('LAYOUT_CRITIC_INPUT_INVALID');
  if(!Array.isArray(input.parts)||input.parts.length>4000||!Array.isArray(input.targets)||input.targets.length>200||!keys(input.axis,['editable','segments'])||typeof input.axis.editable!=='boolean'||!Array.isArray(input.axis.segments)||input.axis.segments.length>32)throw error('LAYOUT_CRITIC_INPUT_INVALID');
  const validBox=box=>keys(box,['x','y','width','height','rotation'])&&Object.values(box).every(value=>number(value))&&box.width>0&&box.height>0;
  const partIds=new Set(),groups=new Set();
  for(const part of input.parts){
    if(!keys(part,['id','groupId','role','kind','bounds','fontSize','lineHeight','characterCount','overflow'])||!alias(part.id)||!alias(part.groupId)||partIds.has(part.id)||!['AXIS','EVENT','OBJECT','FURNITURE'].includes(part.role)||!['TEXT','IMAGE','BODY'].includes(part.kind)||!validBox(part.bounds)||!number(part.fontSize,0,1000)||!number(part.lineHeight,0,2000)||!Number.isInteger(part.characterCount)||part.characterCount<0||part.characterCount>100000||typeof part.overflow!=='boolean')throw error('LAYOUT_CRITIC_INPUT_INVALID');
    partIds.add(part.id);groups.add(part.groupId);
  }
  const ids=new Set();
  for(const target of input.targets){
    if(!keys(target,['id','groupId','kind','editable','geometry','startRank','sameStartGroup','poleFootY','attachmentY','partIds'])||!alias(target.id)||ids.has(target.id)||!groups.has(target.groupId)||!['DURATION','MILESTONE','EXAM_RESULT'].includes(target.kind)||typeof target.editable!=='boolean'||(target.kind==='EXAM_RESULT'&&target.editable)||!validBox(target.geometry)||(target.poleFootY!==null&&!number(target.poleFootY))||(target.kind==='DURATION'&&target.poleFootY!==null)||(target.attachmentY!==null&&!number(target.attachmentY))||(target.kind!=='EXAM_RESULT'&&target.attachmentY!==null)||!Array.isArray(target.partIds)||!target.partIds.length||!target.partIds.every(id=>partIds.has(id)&&input.parts.find(part=>part.id===id).groupId===target.groupId))throw error('LAYOUT_CRITIC_INPUT_INVALID');
    if(!((target.startRank===null&&target.sameStartGroup===null)||(Number.isInteger(target.startRank)&&target.startRank>=1&&target.startRank<=input.targets.length&&target.sameStartGroup===target.startRank)))throw error('LAYOUT_CRITIC_INPUT_INVALID');
    ids.add(target.id);
  }
  const ranks=[...new Set(input.targets.map(target=>target.startRank).filter(rank=>rank!==null))].sort((a,b)=>a-b);
  if(ranks.some((rank,index)=>rank!==index+1))throw error('LAYOUT_CRITIC_INPUT_INVALID');
  const segments=new Set();
  for(const segment of input.axis.segments){
    if(!keys(segment,['id','x','width','weight'])||!alias(segment.id)||segments.has(segment.id)||!number(segment.x)||!number(segment.width,.001,1920)||!number(segment.weight,.001,1000))throw error('LAYOUT_CRITIC_INPUT_INVALID');
    segments.add(segment.id);
  }
  if(stableLayoutJson(input.safety)!==stableLayoutJson(measureLayoutCriticSafety(input.parts,input.targets)))throw error('LAYOUT_CRITIC_INPUT_INVALID');
  return input;
}
export function validateLayoutRecommendations(input,output,sceneDigest){
  validateLayoutCriticInput(input);
  if(!keys(output,['sceneDigest','recommendations'])||output.sceneDigest!==sceneDigest||!/^[a-f0-9]{64}$/.test(sceneDigest||'')||!Array.isArray(output.recommendations)||output.recommendations.length>30)throw error('LAYOUT_CRITIC_OUTPUT_INVALID');
  const seen=new Set();
  for(const op of output.recommendations){
    if(!LAYOUT_CRITIC_REASON_CODES.includes(op?.reasonCode)||!number(op.confidence,0,1))throw error('LAYOUT_CRITIC_OUTPUT_INVALID');
    if(op.kind==='SET_EVENT_Y'){
      const target=input.targets.find(target=>target.id===op.targetId);
      if(!keys(op,['kind','targetId','y','reasonCode','confidence'])||!target||!target.editable||!number(op.y,0,1080)||seen.has(op.targetId))throw error('LAYOUT_CRITIC_OPERATION_REJECTED');
      if(input.parts.filter(part=>target.partIds.includes(part.id)).some(part=>corners(part.bounds).some(point=>
        target.kind==='MILESTONE'?point.y+op.y-target.geometry.y>FOUNDER_MILESTONE_RIBBON_TOP+.04:
        target.kind==='DURATION'&&point.y+op.y-target.geometry.y<FOUNDER_RIBBON_BOTTOM-.04)))throw error('LAYOUT_CRITIC_TEMPLATE_FIDELITY_HOLD');
      seen.add(op.targetId);
    }else if(op.kind==='SET_YEAR_WEIGHTS'){
      if(!keys(op,['kind','weights','reasonCode','confidence'])||!input.axis.editable||seen.has('axis')||!Array.isArray(op.weights)||op.weights.length!==input.axis.segments.length||!op.weights.length||!op.weights.every((weight,index)=>keys(weight,['segmentId','weight'])&&weight.segmentId===input.axis.segments[index].id&&number(weight.weight,.25,8)))throw error('LAYOUT_CRITIC_OPERATION_REJECTED');
      seen.add('axis');
    }else throw error('LAYOUT_CRITIC_OPERATION_REJECTED');
  }
  const proposed=clone(input.targets);
  for(const op of output.recommendations)if(op.kind==='SET_EVENT_Y')proposed.find(target=>target.id===op.targetId).geometry.y=op.y;
  if(createsDurationInversion(input.targets,proposed))throw error('LAYOUT_CRITIC_CHRONOLOGY_HOLD');
  return clone(output);
}
function protectedSnapshot(document){
  const value=clone(document);delete value.advanced;delete value.presentationOverrides;return stableLayoutJson(value);
}
function unchangedNativeArrows(before,after,{allowAxisChange=false,movedIds=new Set()}={}){
  const arrows=paint=>paint.nodes.filter(node=>node.sourceAttributes['data-continuous-duration-arrow']);
  const a=arrows(before),b=arrows(after);if(a.length!==b.length)return false;
  return a.every(left=>{
    const right=b.find(node=>node.semanticRef===left.semanticRef);if(!right)return false;
    // Native shape is invariant after translation. Axis weighting may change
    // horizontal duration length according to the SAME factual dates.
    if(Math.abs(left.bounds.height-right.bounds.height)>.04||left.commands.length!==right.commands.length)return false;
    if(!allowAxisChange&&Math.abs(left.bounds.width-right.bounds.width)>.04)return false;
    if(!allowAxisChange&&Math.abs(left.bounds.x-right.bounds.x)>.04)return false;
    if(!movedIds.has(left.semanticRef)&&Math.abs(left.bounds.y-right.bounds.y)>.04)return false;
    if(!allowAxisChange&&left.commands.some((p,i)=>p.close!==right.commands[i].close||(!p.close&&(Math.abs((p.x-left.bounds.x)-(right.commands[i].x-right.bounds.x))>.04||Math.abs((p.y-left.bounds.y)-(right.commands[i].y-right.bounds.y))>.04))))return false;
    const texts=paint=>paint.nodes.filter(node=>node.semanticRef===left.semanticRef&&node.kind==='text').map(node=>({text:node.text,fontSize:node.fontSize,fontFamily:node.fontFamily}));
    return stableLayoutJson(texts(before))===stableLayoutJson(texts(after));
  });
}
function safelyImproves(before,after){
  for(const field of ['collisionCount','axisOverlapCount','crowdingCount','offCanvasCount','overflowCount','templateViolationCount','durationInversionCount'])if(after[field]>before[field])return false;
  for(const field of ['collisionPairs','axisOverlapPairs','crowdingPairs','offCanvasParts','overflowParts','templateViolationTargets','durationInversionPairs'])if(after[field].some(item=>!before[field].includes(item)))return false;
  return ['collisionCount','axisOverlapCount','crowdingCount','offCanvasCount','overflowCount','templateViolationCount','durationInversionCount'].some(field=>after[field]<before[field]);
}
function pinMeasuredAutomaticEvents(document,projection){
  const automaticAxis=document.presentationOverrides?.axis?.mode!=='manual'||document.presentationOverrides.axis.localLayoutCriticAuto===true;
  let next=clone(document);
  for(const target of projection.localContext.targetMap.values()){
    if(!target.editable)continue;
    const pinned=applyLocalLayoutCriticSceneCommand(next,{kind:'geometry',target:{type:'event',id:target.objectId},geometry:{...target.geometry},
      create:{type:'event',semanticRef:target.eventId,aspectLocked:false,presentation:{eventType:target.kind==='MILESTONE'?'milestone':'duration',localLayoutCriticAuto:true,...(target.kind==='MILESTONE'?{guardianAnchor:'axis'}:{})}},label:'Preserve current automatic composition'},projection.localContext.options);
    if(pinned.changed)next=pinned.document;
    const label=projection.localContext.scene.autoFlagLabels?.get(target.eventId);
    if(target.kind==='MILESTONE'&&label){
      const object=next.advanced?.scene?.objects?.find(item=>item.type==='event'&&String(item.semanticRef)===target.eventId);
      if(object)object.presentation={...object.presentation,flagLabelLayout:{width:label.width,flip:label.flip,...(Number.isFinite(label.yOffset)?{yOffset:label.yOffset}:{}),...(Number.isFinite(label.linePitch)?{linePitch:label.linePitch}:{})}};
    }
  }
  if(automaticAxis&&next.presentationOverrides?.axis?.mode==='manual')next.presentationOverrides.axis.localLayoutCriticAuto=true;
  return next;
}
// Reuse the canonical date composition after any axis edit. AI-owned anchors
// retain their chosen y and native shape; human-authored geometry stays exact.
export function reflowLocalLayoutCriticDateAnchors(document,renderOptions={},measuredTargets=null){
  const options=snapshotRenderOptions(renderOptions),objects=document.advanced?.scene?.objects||[];
  const anchors=measuredTargets||objects.filter(object=>{
    const event=(document.events||[]).find(event=>String(event.id)===String(object.semanticRef||object.id));
    return object.type==='event'&&object.presentation?.localLayoutCriticAuto===true&&event&&!hasManualPlacement(event,object,document)&&document.layoutLock!==true;
  }).map(object=>({eventId:String(object.semanticRef||object.id),objectId:object.id,geometry:object.geometry}));
  if(!anchors.length)return clone(document);
  // Render retained critic placements through the canonical date scale. Their
  // y/shape participates in safety refinement; unpinning would choose another
  // automatic composition and could disagree with the final painted axis.
  const originalAxis=document.presentationOverrides?.axis;
  let dateSource=document;
  if(originalAxis?.mode==='manual'){
    // Explicit manual snapshots retain their existing fixed-geometry contract;
    // an actual axis edit resolves dates with the original unpin/reflow donor.
    dateSource=clone(document);const ids=new Set(anchors.map(target=>String(target.objectId)));
    if(dateSource.advanced?.scene)dateSource.advanced.scene.objects=dateSource.advanced.scene.objects.filter(object=>!ids.has(String(object.id)));
  }
  const dated=render(dateSource,options);let next=clone(document);
  for(const target of anchors){
    const body=dated.paint.nodes.find(node=>node.semanticRef===target.eventId&&node.sourceAttributes['data-continuous-duration-arrow']);
    const flag=locked407FMilestoneGeometry(dated.rendered.scene,target.eventId),geometry=flag||body?.bounds;
    if(!geometry)throw error('LAYOUT_CRITIC_DATE_REFLOW_UNAVAILABLE');
    const placed=applyLocalLayoutCriticSceneCommand(next,{kind:'geometry',target:{type:'event',id:target.objectId},geometry:{...target.geometry,x:geometry.x,width:geometry.width},
      create:{type:'event',semanticRef:target.eventId,aspectLocked:false,presentation:{eventType:flag?'milestone':'duration',localLayoutCriticAuto:true,...(flag?{guardianAnchor:'axis'}:{})}},label:'Reflow native date anchors'},options);
    if(placed.changed)next=placed.document;
  }
  // Scene commands freeze first authored placements. Date reflow is not a
  // human placement and must preserve Reset automatic's absent axis override.
  if(originalAxis===undefined){if(next.presentationOverrides)delete next.presentationOverrides.axis;}
  else next.presentationOverrides={...(next.presentationOverrides||{}),axis:clone(originalAxis)};
  return next;
}
function unrelatedPaintPreserved(before,after,{movedId=null,axisChange=false}={}){
  // Furniture/media/annotations stay exact. Automatic dated events can change
  // x under year weights, but vertical commands must only translate their target.
  const nodes=paint=>paint.nodes.filter(painted);
  const a=nodes(before),b=nodes(after);if(a.length!==b.length)return false;
  return a.every((left,index)=>{
    const right=b[index];
    if(left.kind!==right.kind||left.groupId!==right.groupId||left.semanticRef!==right.semanticRef||left.text!==right.text||left.source!==right.source||left.fontSize!==right.fontSize||left.fontFamily!==right.fontFamily)return false;
    if(axisChange&&(left.role==='event'||left.groupId==='furniture:axis'))return true;
    const x=left.bounds,y=right.bounds;
    if(['x','width','height','rotation'].some(field=>Math.abs((x[field]||0)-(y[field]||0))>.04))return false;
    if(left.semanticRef!==movedId&&Math.abs(x.y-y.y)>.04)return false;
    return true;
  });
}
export const LAYOUT_CRITIC_CANDIDATE_BUDGET=8;
export async function applyLayoutRecommendations(document,output,expected,{sourceDigest=null,...options}={}){
  const original=stableLayoutJson(document),projection=await projectLayoutCritic(document,options);
  if(projection.sceneDigest!==expected||(sourceDigest&&projection.localContext.sourceDigest!==sourceDigest))throw error('LAYOUT_CRITIC_STALE_SCENE');
  // Validate the envelope once; individual typed/target/geometric failures do
  // not discard a separate safe proposal. Provider transport still validates
  // its complete strict response before exposing any recommendation to the UI.
  if(!keys(output,['sceneDigest','recommendations'])||output.sceneDigest!==expected||!Array.isArray(output.recommendations)||output.recommendations.length>30)throw error('LAYOUT_CRITIC_OUTPUT_INVALID');
  let current=projection,next=document,attempts=0,applied=0;const rejected=[],acceptedTargets=new Set();
  const reject=(index,code)=>rejected.push({index,code});
  for(let index=0;index<output.recommendations.length;index++){
    const op=output.recommendations[index];
    if(attempts>=LAYOUT_CRITIC_CANDIDATE_BUDGET){reject(index,'LAYOUT_CRITIC_CANDIDATE_BUDGET');continue;}
    try{validateLayoutRecommendations(current.input,{sceneDigest:expected,recommendations:[op]},expected);}catch(e){reject(index,e.code||'LAYOUT_CRITIC_OPERATION_REJECTED');continue;}
    const key=op.kind==='SET_EVENT_Y'?op.targetId:'axis';
    if(acceptedTargets.has(key)){reject(index,'LAYOUT_CRITIC_DUPLICATE_OPERATION');continue;}
    attempts++;
    try{
      let candidate=clone(next),movedId=null,axisChange=op.kind==='SET_YEAR_WEIGHTS';
      if(axisChange){
        const ids=[...current.localContext.segmentMap.values()],years=ids.filter(id=>/^\d{4}$/.test(id)).map(Number);
        if(!years.length){reject(index,'LAYOUT_CRITIC_AXIS_REJECTED');continue;}
        const range=setAxisPresentationOverride(candidate,{startYear:Math.min(...years),endYear:Math.max(...years),includeFuture:ids.includes('FUTURE')});
        if(!range.changed||range.error){reject(index,'LAYOUT_CRITIC_AXIS_REJECTED');continue;}
        const resized=setAxisSegmentWeights(range.document,op.weights.map(item=>({id:current.localContext.segmentMap.get(item.segmentId),weight:item.weight})));
        if(!resized.changed||resized.error){reject(index,'LAYOUT_CRITIC_AXIS_REJECTED');continue;}
        candidate=resized.document;
        candidate.presentationOverrides.axis.localLayoutCriticAuto=true;
        candidate=reflowLocalLayoutCriticDateAnchors(candidate,current.localContext.options,[...current.localContext.targetMap.values()].filter(target=>target.editable));
      }else{
        const target=current.localContext.targetMap.get(op.targetId),initialTarget=projection.localContext.targetMap.get(op.targetId);
        if(!target||target.eventId!==initialTarget.eventId||!initialTarget.editable){reject(index,'LAYOUT_CRITIC_TARGET_REJECTED');continue;}
        // Pin actual full native paint before the first authored event command
        // disables automatic composition. No biography/semantic event is edited.
        candidate=pinMeasuredAutomaticEvents(candidate,current);
        const placed=applyLocalLayoutCriticSceneCommand(candidate,{kind:'geometry',target:{type:'event',id:target.objectId},geometry:{...target.geometry,y:op.y},
          create:{type:'event',semanticRef:target.eventId,aspectLocked:false,presentation:{eventType:target.kind==='MILESTONE'?'milestone':'duration',localLayoutCriticAuto:true,...(target.kind==='MILESTONE'?{guardianAnchor:'axis'}:{})}},label:'Local geometry review: move event vertically'},current.localContext.options);
        if(!placed.changed){reject(index,'LAYOUT_CRITIC_NO_CHANGE');continue;}
        candidate=placed.document;movedId=target.eventId;
      }
      // Retain exact unrelated legacy arrays rather than helper-added defaults.
      for(const collection of ['media','textBlocks','elements','groups']){
        if(Object.hasOwn(document.advanced||{},collection))candidate.advanced[collection]=clone(document.advanced[collection]);
        else delete candidate.advanced[collection];
      }
      for(const field of ['preferences','layoutLock']){
        if(Object.hasOwn(next,field))candidate[field]=clone(next[field]);else delete candidate[field];
      }
      if(protectedSnapshot(next)!==protectedSnapshot(candidate)){reject(index,'LAYOUT_CRITIC_SEMANTIC_CHANGE');continue;}
      const proposed=await projectLayoutCritic(candidate,projection.localContext.options);
      // This common post-render gate also covers axis weights and sequential
      // proposals: factual start order must survive actual date-anchor reflow.
      if(createsDurationInversion(current.input.targets,proposed.input.targets)){reject(index,'LAYOUT_CRITIC_CHRONOLOGY_HOLD');continue;}
      const violations=proposed.input.safety.templateViolationTargets;
      if(violations.some(id=>!current.input.safety.templateViolationTargets.includes(id))||
        (!axisChange&&violations.includes(op.targetId))){reject(index,'LAYOUT_CRITIC_TEMPLATE_FIDELITY_HOLD');continue;}
      if(!unchangedNativeArrows(current.localContext.paint,proposed.localContext.paint,{allowAxisChange:axisChange,movedIds:new Set(movedId?[movedId]:[])})||!unrelatedPaintPreserved(current.localContext.paint,proposed.localContext.paint,{movedId,axisChange})){
        reject(index,'LAYOUT_CRITIC_NATIVE_GEOMETRY_CHANGE');continue;
      }
      if(!safelyImproves(current.input.safety,proposed.input.safety)){reject(index,'LAYOUT_CRITIC_NO_SAFE_IMPROVEMENT');continue;}
      next=candidate;current=proposed;applied++;acceptedTargets.add(key);
    }catch{reject(index,'LAYOUT_CRITIC_VALIDATION_FAILED');}
  }
  if(stableLayoutJson(document)!==original)throw error('LAYOUT_CRITIC_SOURCE_MUTATED');
  if(await layoutCriticDigest({document,renderOptions:localRenderBinding(snapshotRenderOptions(options))})!==projection.localContext.sourceDigest)throw error('LAYOUT_CRITIC_STALE_SCENE');
  return {document:next,applied,rejected,before:projection.input.safety,after:current.input.safety,sourceUnchanged:true,candidatesEvaluated:attempts};
}

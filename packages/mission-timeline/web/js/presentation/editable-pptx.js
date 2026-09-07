import {PptxGenJS,JSZip} from '../../vendor/presentation/pptx-runtime.js';
import {resolveFounderPresentationSvg,visibleFounderPresentationTitle} from './resolved-founder-presentation.js';
import {parsePresentationXml,serializePresentationXml,xmlNodes,xmlText} from './presentation-xml.js';
import {FOUNDER_KEYNOTE_CONTRACT} from './founder-keynote-contract.js';
import {projectPresentationExamEvents} from './presentation-exam-display.js';
import {projectPresentationEventFields} from './presentation-field-privacy.js';

export const EDITABLE_PPTX_MIME='application/vnd.openxmlformats-officedocument.presentationml.presentation';
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));
// Inter is bundled for browser annotations but absent from the verified native
// host. Arial keeps those editable annotations portable; Founder fonts stay exact.
const nativeFontFamily=paint=>paint.role==='annotation'&&paint.fontFamily==='Inter'?'Arial':paint.fontFamily;
const inch=px=>px/96;
const emu=px=>Math.round(px*9525);
const node=(tag,attrs={},children=[])=>({tag,attrs,children});
const direct=(parent,tag)=>parent?.children?.find(child=>typeof child!=='string'&&child.tag===tag);
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
function bytesFromDataUrl(value){
  const match=String(value).match(/^data:([^;,]+)(;base64)?,([\s\S]+)$/);
  if(!match)throw new Error('PRESENTATION_EMBEDDED_IMAGE_REQUIRED');
  const raw=match[2]?atob(match[3]):decodeURIComponent(match[3]);
  return{mime:match[1],bytes:Uint8Array.from(raw,c=>c.charCodeAt(0))};
}
function imageSize(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length>=24&&view.getUint32(0)===0x89504e47)return{width:view.getUint32(16),height:view.getUint32(20)};
  if(bytes[0]===255&&bytes[1]===216){
    let p=2;while(p+9<bytes.length){if(bytes[p]!==255){p++;continue;}const marker=bytes[p+1];p+=2;if(marker===0xd8||marker===0xd9)continue;const size=view.getUint16(p);if(size<2)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{width:view.getUint16(p+5),height:view.getUint16(p+3)};p+=size;}
  }
  throw new Error('PRESENTATION_IMAGE_DIMENSIONS_UNSUPPORTED');
}
function color(value,fallback='000000'){
  const raw=String(value||'').trim();
  if(/^#[\da-f]{6}$/i.test(raw))return raw.slice(1).toUpperCase();
  if(/^#[\da-f]{3}$/i.test(raw))return [...raw.slice(1)].map(c=>c+c).join('').toUpperCase();
  const rgb=raw.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  if(rgb)return rgb.slice(1).map(v=>Math.max(0,Math.min(255,Number(v))).toString(16).padStart(2,'0')).join('').toUpperCase();
  return({white:'FFFFFF',black:'000000',red:'FF0000',transparent:'FFFFFF'}[raw.toLowerCase()]||fallback);
}
function paintOptions(paint,resolved){
  const s=paint.style,gradientId=String(s.fill||'').match(/^url\(#([^)]*)\)/)?.[1];
  const gradient=gradientId?resolved.gradients[gradientId]:null;
  const invisible=s.fill==='none'||s.fill==='transparent'||paint.lineOnly;
  return{
    fill:{color:color(gradient?.stops.at(-1)?.color||s.fill),transparency:invisible?100:100-clamp(s['fill-opacity']??s.opacity??1)*100},
    line:{color:color(s.stroke),width:s.stroke&&s.stroke!=='none'?(Number(s['stroke-width'])||1)*.75:0,transparency:s.stroke&&s.stroke!=='none'?100-clamp(s['stroke-opacity']??1)*100:100,...(paint.endArrow?{endArrowType:'triangle'}:{})},
    ...(s.filter?{shadow:{type:'outer',color:'141E32',opacity:.35,blur:2,offset:1.5,angle:90}}:{})
  };
}
function gradientNode(gradient){
  return node('a:gradFill',{rotWithShape:'1'},[
    node('a:gsLst',{},gradient.stops.map(stop=>node('a:gs',{pos:String(Math.round(clamp(stop.offset)*100000))},[
      node('a:srgbClr',{val:color(stop.color)},[node('a:alpha',{val:String(Math.round(clamp(stop.opacity)*100000))})])
    ]))),node('a:lin',{ang:gradient.vertical?'5400000':'0',scaled:'1'}),node('a:tileRect')
  ]);
}
function scopeFacts(document,resolved){
  const visible=new Set(resolved.nodes.filter(n=>n.role==='event').map(n=>n.semanticRef));
  const privateExamResults=new Set(resolved.nodes.filter(n=>n.sourceAttributes?.['data-exam-result-private']).map(n=>n.semanticRef));
  return projectPresentationEventFields(projectPresentationExamEvents(document),{privateExamResults}).filter(event=>visible.has(String(event.id))).map(event=>{
    const fact={id:String(event.id)};
    for(const key of ['title','startDate','endDate','categoryId','eventType','siteName','openEnded'])if(event[key]!==undefined)fact[key]=event[key];
    if(event.presentationRedactions)fact.presentationRedactions=[...event.presentationRedactions];
    const precision=event?.fields?.datePrecision||event?.datePrecision;
    if(precision)fact.datePrecision=typeof precision==='string'?precision:{start:precision.start||null,end:precision.end||null};
    const evidence=Array.isArray(event.provenance)?event.provenance:[];
    fact.provenance=evidence.map(item=>{
      const record={};for(const key of ['sourceSha256','artifactSha256','sourceBlockId','sourcePage','pageOrSlide','confidence','support','basis'])if(typeof item?.[key]==='string'||typeof item?.[key]==='number')record[key]=item[key];return record;
    }).filter(item=>Object.keys(item).length);
    return fact;
  });
}

// Creates editable primitives from the same final SVG used by PNG/PDF and the
// Advanced Studio preview. Images remain separate assets with editable crops.
export async function createEditableFounderPptx({svg,document:timeline={},resolveImage=null,measureText=null}={}){
  // The serializer reconciles compatibility arrays with scene event geometry.
  // Its group authority is advanced.groups, including when stored scene.groups
  // is an empty array, so export must use the same reconciled membership.
  const advancedGroups=timeline?.advanced?.groups||[];
  const resolved=resolveFounderPresentationSvg(svg,{advancedGroups,measureText});
  const pptx=new PptxGenJS();
  pptx.defineLayout({name:'MISSIONMED_1920',width:20,height:11.25});pptx.layout='MISSIONMED_1920';
  pptx.title=visibleFounderPresentationTitle(resolved);pptx.author='MissionMed Timeline Builder';pptx.subject='Editable Timeline for PowerPoint and Keynote';pptx.company='MissionMed';
  pptx.theme={headFontFace:'American Typewriter',bodyFontFace:'Baskerville'};
  const slide=pptx.addSlide(),paintByName=new Map(),imageCache=new Map(),media=[];
  const warnings=[...resolved.warnings];
  for(const paint of resolved.nodes){
    const b=paint.bounds;
    if(![b.x,b.y,b.width,b.height,b.rotation].every(Number.isFinite)||b.width<=0||b.height<=0)throw new Error(`PRESENTATION_GEOMETRY_INVALID:${paint.id}`);
    const objectName=`MM:${paint.id}`;
    const opts={x:inch(b.x),y:inch(b.y),w:inch(b.width),h:inch(b.height),rotate:(b.rotation+360)%360,objectName};
    paintByName.set(objectName,paint);
    if(paint.kind==='text'){
      const textOptions={...opts,fontFace:nativeFontFamily(paint),fontSize:paint.fontSize*.75,color:color(paint.style.fill),bold:Number(paint.style['font-weight'])>=600,italic:paint.style['font-style']==='italic',margin:0,breakLine:false,paraSpaceAfter:0,paraSpaceBefore:0,fit:'shrink',wrap:false,valign:'top',align:paint.alignment,lineSpacingMultiple:paint.lineHeight/paint.fontSize,charSpacing:paint.characterSpacing*.75};
      slide.addText(paint.runs?paint.runs.map(run=>({text:run.text,options:run.bold!==undefined?{bold:run.bold}:{}})):paint.text,textOptions);
    }else if(paint.kind==='shape')slide.addShape(paint.shape,{...opts,...paintOptions(paint,resolved),...(paint.radius?{rectRadius:paint.radius/Math.min(b.width,b.height)}:{})});
    else if(paint.kind==='path'){
      // Degenerate custom paths import into Keynote as auto-rotated lines.
      // Use the native line geometry for two-point strokes, preserving an exact
      // zero width for vertical poles and zero height for horizontal highlights.
      if(paint.commands.length===2&&paint.commands.every(command=>!command.curve&&!command.close)){
        const [start,end]=paint.commands;
        slide.addShape(pptx.ShapeType.line,{...opts,...paintOptions(paint,resolved),x:inch(Math.min(start.x,end.x)),y:inch(Math.min(start.y,end.y)),w:inch(Math.abs(end.x-start.x)),h:inch(Math.abs(end.y-start.y)),rotate:0,flipH:end.x<start.x,flipV:end.y<start.y});
        continue;
      }
      const points=paint.commands.map(command=>{
        if(command.close)return{close:true};
        const next={x:inch(command.x-b.x),y:inch(command.y-b.y),...(command.moveTo?{moveTo:true}:{})};
        if(command.curve)next.curve={type:command.curve.type,x1:inch(command.curve.x1-b.x),y1:inch(command.curve.y1-b.y),...(command.curve.type==='cubic'?{x2:inch(command.curve.x2-b.x),y2:inch(command.curve.y2-b.y)}:{})};
        return next;
      });
      slide.addShape(pptx.ShapeType.custGeom,{...opts,points,...paintOptions(paint,resolved)});
    }else if(paint.kind==='image'){
      let image=imageCache.get(paint.source);
      if(!image){
        const data=paint.source?.startsWith('data:')?paint.source:await resolveImage?.(paint.source);
        const decoded=bytesFromDataUrl(data);const size=imageSize(decoded.bytes);
        image={data,...size,sha256:await sha(decoded.bytes)};imageCache.set(paint.source,image);
      }
      if(paint.fit==='cover'&&!paint.crop){
        const imageAspect=image.width/image.height,frameAspect=b.width/b.height;
        const cw=imageAspect>frameAspect?frameAspect/imageAspect:1,ch=imageAspect<frameAspect?imageAspect/frameAspect:1;
        paint.crop={left:(1-cw)/2,right:(1-cw)/2,top:(1-ch)/2,bottom:(1-ch)/2};
      }else if(paint.fit==='contain'){
        const ratio=Math.min(b.width/image.width,b.height/image.height),w=image.width*ratio,h=image.height*ratio;
        opts.x+=inch((b.width-w)/2);opts.y+=inch((b.height-h)/2);opts.w=inch(w);opts.h=inch(h);
      }
      slide.addImage({...opts,data:image.data,altText:paint.sourceAttributes['aria-label']||paint.sourceAttributes['data-media-id']||'Timeline image'});
      media.push({objectId:paint.id,sha256:image.sha256,crop:paint.crop||null});
    }
  }
  // Notes contain a practical editing hint, never source CV text or private data.
  slide.addNotes('This Timeline contains editable text, shapes, image frames and groups. Open it in PowerPoint or Keynote. Review any factual changes before importing an edited presentation back into Timeline Builder.');
  const zip=await JSZip.loadAsync(await pptx.write({outputType:'arraybuffer',compression:true}));
  const slidePath='ppt/slides/slide1.xml',tree=parsePresentationXml(await zip.file(slidePath).async('string'));
  const shapeTree=xmlNodes(tree,n=>n.tag==='p:spTree')[0];
  let maxId=Math.max(...xmlNodes(tree,n=>n.tag==='p:cNvPr').map(n=>Number(n.attrs.id)));
  const byPaint=new Map(),metadata=[];
  for(const shape of shapeTree.children.filter(n=>typeof n!=='string'&&['p:sp','p:pic','p:cxnSp'].includes(n.tag))){
    const nv=xmlNodes(shape,n=>n.tag==='p:cNvPr')[0],paint=paintByName.get(nv?.attrs.name);
    if(!paint)continue;
    byPaint.set(paint.id,shape);nv.attrs.name=`MM:${paint.role}:${paint.semanticRef||paint.groupId||paint.id}:${paint.id}`;
    nv.attrs.descr=`MissionMed ${paint.role}; canonical object ${paint.semanticRef||paint.id}`;
    const spPr=direct(shape,'p:spPr');
    const gradient=resolved.gradients[String(paint.style.fill||'').match(/^url\(#([^)]*)\)/)?.[1]];
    if(gradient&&spPr){spPr.children=spPr.children.filter(n=>typeof n==='string'||!['a:solidFill','a:noFill','a:gradFill'].includes(n.tag));const geomIndex=spPr.children.findIndex(n=>typeof n!=='string'&&['a:prstGeom','a:custGeom'].includes(n.tag));spPr.children.splice(geomIndex+1,0,gradientNode(gradient));}
    if(paint.kind==='image'&&paint.crop){
      const fill=direct(shape,'p:blipFill');fill.children=fill.children.filter(n=>typeof n==='string'||n.tag!=='a:srcRect');
      const index=fill.children.findIndex(n=>typeof n!=='string'&&n.tag==='a:stretch');
      fill.children.splice(index<0?1:index,0,node('a:srcRect',Object.fromEntries([['l','left'],['t','top'],['r','right'],['b','bottom']].map(([key,field])=>[key,String(Math.round(clamp(paint.crop[field])*100000))]))));
    }
    metadata.push({id:paint.id,nativeId:Number(nv.attrs.id),role:paint.role,semanticRef:paint.semanticRef,groupId:paint.groupId,kind:paint.kind,bounds:paint.bounds,...(paint.kind==='text'?{text:paint.text,fontFamily:paint.fontFamily,nativeFontFamily:nativeFontFamily(paint)}:{})});
  }
  const groupMap=new Map(resolved.groups.map(g=>[g.id,{...g,xml:null}]));
  const ancestors=id=>{const list=[];let current=groupMap.get(id);while(current){if(list.includes(current.id))throw new Error('PRESENTATION_GROUP_CYCLE');list.push(current.id);current=groupMap.get(current.parentId);}return list;};
  const separatedGroups=[];
  for(const group of groupMap.values()){
    const descendants=resolved.nodes.filter(p=>ancestors(p.groupId).includes(group.id));
    if(!descendants.length)continue;
    const indices=resolved.nodes.map((paint,index)=>ancestors(paint.groupId).includes(group.id)?index:-1).filter(index=>index>=0);
    if(indices.at(-1)-indices[0]+1!==indices.length){
      // Native groups occupy one contiguous position in a slide's paint order.
      // Keep interleaved members separately editable rather than moving another
      // object behind or in front of them merely to force one native group.
      separatedGroups.push(group.id);continue;
    }
    const x=Math.min(...descendants.map(p=>p.bounds.x)),y=Math.min(...descendants.map(p=>p.bounds.y)),w=Math.max(...descendants.map(p=>p.bounds.x+p.bounds.width))-x,h=Math.max(...descendants.map(p=>p.bounds.y+p.bounds.height))-y;
    const groupId=String(++maxId);
    group.xml=node('p:grpSp',{},[
      node('p:nvGrpSpPr',{},[node('p:cNvPr',{id:groupId,name:`MM:group:${group.id}`,descr:`MissionMed ${group.role}; ${group.semanticRef||group.id}`}),node('p:cNvGrpSpPr'),node('p:nvPr')]),
      node('p:grpSpPr',{},[node('a:xfrm',{},[node('a:off',{x:String(emu(x)),y:String(emu(y))}),node('a:ext',{cx:String(emu(w)),cy:String(emu(h))}),node('a:chOff',{x:String(emu(x)),y:String(emu(y))}),node('a:chExt',{cx:String(emu(w)),cy:String(emu(h))})])])
    ]);
  }
  const structure=shapeTree.children.filter(n=>typeof n==='string'||!['p:sp','p:pic','p:cxnSp'].includes(n.tag));
  const inserted=new Set();
  function groupContainer(groupId){
    const group=groupMap.get(groupId);if(!group?.xml)return structure;
    if(!inserted.has(groupId)){groupContainer(group.parentId).push(group.xml);inserted.add(groupId);}return group.xml.children;
  }
  for(const paint of resolved.nodes){const shape=byPaint.get(paint.id);if(shape)groupContainer(paint.groupId).push(shape);}
  if(separatedGroups.length)warnings.push('Some objects remain in separate groups to preserve their stacking order.');
  shapeTree.children=structure;
  zip.file(slidePath,'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+serializePresentationXml(tree));
  const facts=scopeFacts(timeline,resolved),factsSha256=await sha(new TextEncoder().encode(JSON.stringify(facts)));
  const recovery={schema:'d1-timeline-editable-recovery/1',interpretation:'EXPORTED_BASELINE_REQUIRES_REVIEW_AGAINST_VISIBLE_EDITS',canvas:resolved.canvas,authority:{sourceSha256:FOUNDER_KEYNOTE_CONTRACT.source.sha256,goldenSha256:FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pngSha256},factsSha256,facts,objects:metadata,groups:resolved.groups,...(separatedGroups.length?{separatedNativeGroups:separatedGroups}:{}),media};
  const recoveryXml=node('mm:timeline',{'xmlns:mm':'urn:missionmed:timeline:recovery:1'},[JSON.stringify(recovery)]);
  zip.file('customXml/item1.xml',serializePresentationXml(recoveryXml));
  const relationshipsPath='ppt/_rels/presentation.xml.rels',relationships=parsePresentationXml(await zip.file(relationshipsPath).async('string'));
  relationships.children.push(node('Relationship',{Id:'rIdMissionMedRecovery',Type:'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml',Target:'../customXml/item1.xml'}));
  zip.file(relationshipsPath,serializePresentationXml(relationships));
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const validation=await inspectEditablePptx(bytes);
  if(validation.textCount<1||validation.shapeCount<1||validation.groupCount<1||validation.errors.length)throw new Error(`PRESENTATION_EDITABILITY_VALIDATION:${validation.errors.join(',')}`);
  return{blob:new Blob([bytes],{type:EDITABLE_PPTX_MIME}),mimeType:EDITABLE_PPTX_MIME,byteSize:bytes.byteLength,width:1920,height:1080,executionMode:'local',simulated:false,editable:true,nativeKeynote:false,renderer:'Founder shared SVG to native PPTX',serializer:'d1-founder-keynote-portable-svg/1',warnings,recovery,validation};
}

export async function inspectEditablePptx(input){
  const zip=await JSZip.loadAsync(input instanceof Blob?await input.arrayBuffer():input);
  const presentation=parsePresentationXml(await zip.file('ppt/presentation.xml').async('string'));
  const size=xmlNodes(presentation,n=>n.tag==='p:sldSz')[0]?.attrs;
  const slide=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const ids=xmlNodes(slide,n=>n.tag==='p:cNvPr').map(n=>n.attrs.id),errors=[];
  if(new Set(ids).size!==ids.length)errors.push('DUPLICATE_NATIVE_ID');
  if(Number(size?.cx)!==emu(1920)||Number(size?.cy)!==emu(1080))errors.push('SLIDE_SIZE_MISMATCH');
  const rels=parsePresentationXml(await zip.file('ppt/slides/_rels/slide1.xml.rels').async('string'));
  const relationIds=new Set(rels.children.filter(n=>typeof n!=='string').map(n=>n.attrs.Id));
  for(const image of xmlNodes(slide,n=>n.tag==='a:blip'))if(!relationIds.has(image.attrs['r:embed']))errors.push('MISSING_IMAGE_RELATIONSHIP');
  const recovery=zip.file('customXml/item1.xml')?JSON.parse(xmlText(parsePresentationXml(await zip.file('customXml/item1.xml').async('string')))):null;
  return{errors,slideSizeEmu:{width:Number(size?.cx),height:Number(size?.cy)},textCount:xmlNodes(slide,n=>n.tag==='p:txBody').length,shapeCount:xmlNodes(slide,n=>n.tag==='p:sp').length,lineCount:xmlNodes(slide,n=>n.tag==='p:cxnSp').length,imageCount:xmlNodes(slide,n=>n.tag==='p:pic').length,groupCount:xmlNodes(slide,n=>n.tag==='p:grpSp').length,cropCount:xmlNodes(slide,n=>n.tag==='a:srcRect'&&Object.values(n.attrs).some(v=>Number(v)>0)).length,text:xmlNodes(slide,n=>n.tag==='a:t').map(xmlText),recovery};
}

import {parsePresentationXml,xmlNodes,xmlText} from './presentation-xml.js';

const I=[1,0,0,1,0,0];
const numeric=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
function transform(value){
  let result=I;
  for(const match of String(value||'').matchAll(/(translate|scale|rotate|matrix)\s*\(([^)]+)\)/g)){
    const a=match[2].trim().split(/[ ,]+/).map(Number);let next=I;
    if(a.some(v=>!Number.isFinite(v)))throw new Error('PRESENTATION_TRANSFORM_INVALID');
    if(match[1]==='translate')next=[1,0,0,1,a[0],a[1]||0];
    if(match[1]==='scale')next=[a[0],0,0,a[1]??a[0],0,0];
    if(match[1]==='matrix'){if(a.length!==6)throw new Error('PRESENTATION_TRANSFORM_INVALID');next=a;}
    if(match[1]==='rotate'){
      const angle=a[0]*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),x=a[1]||0,y=a[2]||0;
      next=mul(mul([1,0,0,1,x,y],[c,s,-s,c,0,0]),[1,0,0,1,-x,-y]);
    }
    result=mul(result,next);
  }
  return result;
}
function box(m,x,y,width,height){
  const center=point(m,x+width/2,y+height/2),w=width*Math.hypot(m[0],m[1]),h=height*Math.hypot(m[2],m[3]);
  return{x:center.x-w/2,y:center.y-h/2,width:w,height:h,rotation:Math.atan2(m[1],m[0])*180/Math.PI};
}
const styleKeys=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','font-family','font-size','font-weight','font-style','text-anchor','opacity','filter'];
function style(parent,attrs){
  const result={...parent};
  for(const key of styleKeys)if(attrs[key]!==undefined)result[key]=attrs[key];
  for(const declaration of String(attrs.style||'').split(';')){
    const separator=declaration.indexOf(':');if(separator>0)result[declaration.slice(0,separator).trim()]=declaration.slice(separator+1).trim();
  }
  return result;
}
function pathCommands(value,matrix){
  const tokens=String(value).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
  const result=[];let cursor=0,command='',x=0,y=0,startX=0,startY=0;
  const number=()=>{const v=Number(tokens[cursor++]);if(!Number.isFinite(v))throw new Error('PRESENTATION_PATH_INVALID');return v;};
  while(cursor<tokens.length){
    if(/^[a-zA-Z]$/.test(tokens[cursor]))command=tokens[cursor++];
    const op=command.toUpperCase(),relative=op!==command;
    const coordinate=()=>{let nx=number(),ny=number();if(relative){nx+=x;ny+=y;}return{nx,ny,p:point(matrix,nx,ny)};};
    if(op==='Z'){result.push({close:true});x=startX;y=startY;command='';continue;}
    if(op==='M'||op==='L'){const c=coordinate();result.push({...c.p,...(op==='M'?{moveTo:true}:{})});x=c.nx;y=c.ny;if(op==='M'){startX=x;startY=y;command=relative?'l':'L';}}
    else if(op==='H'){x=number()+(relative?x:0);result.push(point(matrix,x,y));}
    else if(op==='V'){y=number()+(relative?y:0);result.push(point(matrix,x,y));}
    else if(op==='C'){const c1=coordinate(),c2=coordinate(),end=coordinate();result.push({...end.p,curve:{type:'cubic',x1:c1.p.x,y1:c1.p.y,x2:c2.p.x,y2:c2.p.y}});x=end.nx;y=end.ny;}
    else if(op==='Q'){const c1=coordinate(),end=coordinate();result.push({...end.p,curve:{type:'quadratic',x1:c1.p.x,y1:c1.p.y}});x=end.nx;y=end.ny;}
    else throw new Error(`PRESENTATION_PATH_UNSUPPORTED:${op}`);
  }
  return result;
}
function pathBounds(commands){
  const coords=commands.flatMap(c=>c.close?[]:[{x:c.x,y:c.y},...(c.curve?[{x:c.curve.x1,y:c.curve.y1},...(c.curve.type==='cubic'?[{x:c.curve.x2,y:c.curve.y2}]:[])]:[])]);
  const x=Math.min(...coords.map(p=>p.x)),y=Math.min(...coords.map(p=>p.y));
  return{x,y,width:Math.max(.01,...coords.map(p=>p.x-x)),height:Math.max(.01,...coords.map(p=>p.y-y)),rotation:0};
}
function textWidth(text,size,family,weight){
  if(typeof document!=='undefined'){
    const context=document.createElement('canvas').getContext('2d');
    if(context){context.font=`${weight||400} ${size}px ${family||'serif'}`;return context.measureText(text).width;}
  }
  return Math.max(size*.25,String(text).length*size*.56);
}

// This projection reads the exact canonical paint tree. It never re-lays out
// semantic dates or approximates a second Timeline. Hit targets/defs are excluded.
export function resolveFounderPresentationSvg(svg,{advancedGroups=[],measureText=null}={}){
  const root=parsePresentationXml(svg);
  if(root.tag!=='svg'||root.attrs.viewBox!=='0 0 1920 1080')throw new Error('PRESENTATION_CANONICAL_SVG_REQUIRED');
  const definitions=new Map(xmlNodes(root,n=>Boolean(n.attrs.id)).map(n=>[n.attrs.id,n]));
  const nodes=[],groups=[],warnings=[];let serial=0;
  const groupMap=new Map();
  const makeGroup=(id,parentId,role,semanticRef)=>{
    if(!groupMap.has(id)){const value={id,parentId,role,semanticRef};groups.push(value);groupMap.set(id,value);}return id;
  };
  function visit(node,context){
    if(typeof node==='string')return;
    const a=node.attrs||{};
    if(['defs','title','desc','style','metadata'].includes(node.tag))return;
    if(a['data-axis-hit-target']||a['data-axis-cell']||a['pointer-events']==='all'||a.fill==='transparent')return;
    const currentStyle=style(context.style,a),matrix=mul(context.matrix,transform(a.transform));
    let groupId=context.groupId,semanticRef=context.semanticRef,role=context.role;
    const objectId=a['data-scene-object'];
    const furniture=a['data-artifact-chrome']||a['data-artifact-photo-frame']&&`photo-${a['data-artifact-photo-frame']}`;
    if(a['data-event-id']){semanticRef=a['data-event-id'];role=a['data-event-kind']==='explanation'?'annotation':'event';groupId=makeGroup(`event:${semanticRef}`,groupId,role,semanticRef);}
    else if(objectId){role=a['data-scene-object-type']==='media'?'media':'annotation';groupId=makeGroup(`object:${objectId}`,null,role,null);}
    else if(furniture){role=furniture==='profile'?'profile':'furniture';groupId=makeGroup(`furniture:${furniture}`,groupId,role,null);}
    else if(a['data-layer']==='axis'){role='furniture';groupId=makeGroup('furniture:axis',null,role,null);}
    const shared={id:`paint-${++serial}`,groupId,semanticRef,role,style:currentStyle,sourceAttributes:{...a}};
    if(node.tag==='g'||node===root){for(const child of node.children)visit(child,{matrix,style:currentStyle,groupId,semanticRef,role});return;}
    if(node.tag==='svg'){
      const image=node.children.find(n=>typeof n!=='string'&&n.tag==='image');
      if(a['data-crop-zoom']&&image){
        const [vx,vy,vw,vh]=a.viewBox.split(/[ ,]+/).map(Number),iw=numeric(image.attrs.width),ih=numeric(image.attrs.height);
        nodes.push({...shared,kind:'image',source:image.attrs.href,bounds:box(matrix,numeric(a.x),numeric(a.y),numeric(a.width),numeric(a.height)),crop:{left:vx/iw,top:vy/ih,right:(iw-vx-vw)/iw,bottom:(ih-vy-vh)/ih},fit:'stretch'});return;
      }
      throw new Error('PRESENTATION_NESTED_VIEWPORT_UNSUPPORTED');
    }
    if(node.tag==='image'){
      if(!a.href){warnings.push('MISSING_IMAGE');return;}
      nodes.push({...shared,kind:'image',source:a.href,bounds:box(matrix,numeric(a.x),numeric(a.y),numeric(a.width),numeric(a.height)),fit:a.preserveAspectRatio?.includes('slice')?'cover':a.preserveAspectRatio==='none'?'stretch':'contain'});return;
    }
    if(node.tag==='text'){
      const size=numeric(currentStyle['font-size'],16),family=currentStyle['font-family']||'serif';
      const multiline=node.children.some(n=>typeof n!=='string'&&n.attrs.dy!==undefined);
      const spans=multiline?node.children.filter(n=>typeof n!=='string'):null;
      const text=multiline?spans.map(xmlText).join('\n'):xmlText(node);
      if(!text.trim())return;
      const runs=multiline?null:node.children.map(child=>typeof child==='string'?{text:child}:{text:xmlText(child),bold:numeric(child.attrs['font-weight'],numeric(currentStyle['font-weight'],400))>=600});
      const natural=Math.max(...text.split('\n').map(line=>measureText?measureText(line,size,family,currentStyle['font-weight']):textWidth(line,size,family,currentStyle['font-weight'])));
      const width=a.textLength?numeric(a.textLength):Math.max(1,natural+size*.12);
      const anchor=currentStyle['text-anchor'];
      const x=numeric(a.x)-(anchor==='middle'?width/2:anchor==='end'?width:0);
      const lineHeight=multiline&&spans.length>1?numeric(spans[1].attrs.dy,size*1.2):size*1.2;
      const y=numeric(a.y)-size*.86,height=size*1.2+(text.split('\n').length-1)*lineHeight;
      nodes.push({...shared,kind:'text',text,runs,fontFamily:family.split(',')[0].replace(/['"]/g,''),fontSize:size*Math.hypot(matrix[2],matrix[3]),bounds:box(matrix,x,y,width,height),alignment:anchor==='middle'?'center':anchor==='end'?'right':'left',lineHeight:lineHeight*Math.hypot(matrix[2],matrix[3]),characterSpacing:a.textLength&&text.length>1?(width-natural)/(text.length-1)*Math.hypot(matrix[0],matrix[1]):0});return;
    }
    if(node.tag==='rect'){
      const fill=currentStyle.fill;
      if(fill?.startsWith('url(')){
        const def=definitions.get(fill.match(/#([^)]*)/)?.[1]);
        if(def?.tag==='pattern'){
          const image=xmlNodes(def,n=>n.tag==='image')[0];
          if(image){nodes.push({...shared,role:'furniture',kind:'image',source:image.attrs.href,bounds:box(matrix,numeric(a.x),numeric(a.y),numeric(a.width),numeric(a.height)),fit:'cover'});return;}
        }
      }
      nodes.push({...shared,kind:'shape',shape:numeric(a.rx)?'roundRect':'rect',radius:numeric(a.rx),bounds:box(matrix,numeric(a.x),numeric(a.y),numeric(a.width),numeric(a.height))});return;
    }
    if(node.tag==='circle'||node.tag==='ellipse'){
      const rx=numeric(a.rx,numeric(a.r)),ry=numeric(a.ry,numeric(a.r));
      nodes.push({...shared,kind:'shape',shape:'ellipse',bounds:box(matrix,numeric(a.cx)-rx,numeric(a.cy)-ry,rx*2,ry*2)});return;
    }
    if(node.tag==='path'||node.tag==='line'){
      const commands=node.tag==='line'?[{...point(matrix,numeric(a.x1),numeric(a.y1)),moveTo:true},point(matrix,numeric(a.x2),numeric(a.y2))]:pathCommands(a.d,matrix);
      if(!commands.length)return;
      nodes.push({...shared,kind:'path',commands,bounds:pathBounds(commands),endArrow:Boolean(a['marker-end']),lineOnly:node.tag==='line'});return;
    }
    throw new Error(`PRESENTATION_PRIMITIVE_UNSUPPORTED:${node.tag}`);
  }
  visit(root,{matrix:I,style:{fill:'#000000'},groupId:null,semanticRef:null,role:'furniture'});
  for(const group of advancedGroups){
    const children=(group.childIds||group.children||[]).map(item=>`object:${typeof item==='string'?item:item.id}`);
    if(children.filter(id=>groupMap.has(id)).length<2)continue;
    const id=makeGroup(`advanced-group:${group.id}`,null,'annotation',null);
    for(const child of children)if(groupMap.has(child))groupMap.get(child).parentId=id;
  }
  const gradients=Object.fromEntries([...definitions].filter(([,d])=>d.tag==='linearGradient').map(([id,d])=>[id,{stops:d.children.filter(n=>typeof n!=='string'&&n.tag==='stop').map(n=>({offset:numeric(n.attrs.offset),color:n.attrs['stop-color'],opacity:numeric(n.attrs['stop-opacity'],1)})),vertical:d.attrs.x1===d.attrs.x2||d.attrs.x2==='0'}]));
  return{schema:'d1-founder-resolved-svg/1',canvas:{width:1920,height:1080},nodes,groups,gradients,warnings};
}

export function visibleFounderPresentationTitle(svgOrResolved){
  const resolved=typeof svgOrResolved==='string'?resolveFounderPresentationSvg(svgOrResolved):svgOrResolved;
  return(resolved?.nodes||[]).filter(paint=>paint.kind==='text'&&paint.groupId==='furniture:title').map(paint=>paint.text).join(' ')||'MissionMed Timeline';
}

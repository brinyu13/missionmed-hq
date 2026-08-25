import {visibilityName} from "../core/canonical.js";
import {serializeFounderPresentationAsync} from "../presentation/founder-presentation-serializer.js";
import {rasterizePresentationSvg} from "../presentation/svg-rasterizer.js";

const BASE={width:1920,height:1080};
const imageCache=new Map();
const photoFrameCache=new Map();
const coverRasterCache=new Map();

function cssAsset(name){
  if(typeof document==="undefined")return null;
  const raw=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match=raw.match(/^url\(["']?(.*?)["']?\)$/);return match?match[1]:null;
}

async function loadImage(source){
  if(!source)return null;if(imageCache.has(source))return imageCache.get(source);
  const promise=new Promise((resolve)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=source;});imageCache.set(source,promise);return promise;
}

function drawCoverRaster(ctx,image,x,y,width,height,crop={x:50,y:50,zoom:1,rotation:0}){
  if(!image)return;const zoom=Math.max(1,Number(crop.zoom)||1),scale=Math.max(width/image.naturalWidth,height/image.naturalHeight)*zoom;
  const sourceWidth=width/scale,sourceHeight=height/scale,maxX=Math.max(0,image.naturalWidth-sourceWidth),maxY=Math.max(0,image.naturalHeight-sourceHeight);
  const sourceX=maxX*(Number(crop.x??50)/100),sourceY=maxY*(Number(crop.y??50)/100);
  ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.translate(x+width/2,y+height/2);ctx.rotate((Number(crop.rotation)||0)*Math.PI/180);ctx.drawImage(image,sourceX,sourceY,sourceWidth,sourceHeight,-width/2,-height/2,width,height);ctx.restore();
}

function drawCover(ctx,image,x,y,width,height,crop={x:50,y:50,zoom:1,rotation:0}){
  if(!image)return;const key=`${image.currentSrc||image.src}|${width}x${height}|${Number(crop.x??50)},${Number(crop.y??50)},${Number(crop.zoom)||1},${Number(crop.rotation)||0}`;
  let raster=coverRasterCache.get(key);if(!raster){raster=globalThis.document.createElement("canvas");raster.width=Math.max(1,Math.round(width));raster.height=Math.max(1,Math.round(height));drawCoverRaster(raster.getContext("2d"),image,0,0,raster.width,raster.height,crop);coverRasterCache.set(key,raster);}ctx.drawImage(raster,x,y,width,height);
}

function photoFrameSprite(width,height,rotation){
  const key=`${width}x${height}@${rotation}`;if(photoFrameCache.has(key))return photoFrameCache.get(key);
  const pad=20,canvas=globalThis.document.createElement("canvas");canvas.width=Math.ceil(width+pad*2);canvas.height=Math.ceil(height+pad*2);
  const ctx=canvas.getContext("2d");ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.fillStyle="#f7f1e4";ctx.shadowColor="rgba(0,0,0,.55)";ctx.shadowBlur=10;ctx.fillRect(-width/2-7,-height/2-7,width+14,height+14);photoFrameCache.set(key,canvas);return canvas;
}

function monthIndex(value){if(!/^\d{4}-\d{2}$/.test(value||""))return null;const [year,month]=value.split("-").map(Number);return year*12+month-1;}
function monthLabel(value){if(!value)return "";const [year,month]=value.split("-").map(Number);return new Intl.DateTimeFormat("en-US",{month:"short",year:"2-digit",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));}
function axis(events){const values=[];events.forEach((event)=>{const start=monthIndex(event.startDate);const end=monthIndex(event.endDate||event.startDate);if(start!=null)values.push(start);if(end!=null)values.push(end);});if(!values.length){const now=new Date().getUTCFullYear();return {start:now*12,end:(now+3)*12+11};}const min=Math.min(...values),max=Math.max(...values);return {start:Math.floor(min/12)*12,end:Math.floor(max/12)*12+11};}
function eventVisibility(event){return visibilityName(event.visibilityState||event.visibility);}

export function eventsForScope(document,scope){
  return (document.events||[]).filter((event)=>{
    const visibility=eventVisibility(event);
    if(visibility==="HIDDEN")return false;
    if(scope==="INTERVIEWER_SAFE")return visibility==="INTERVIEWER_SAFE";
    if(scope==="FULL_STORY")return visibility==="INTERVIEWER_SAFE"||visibility==="FULL_STORY";
    if(scope==="ADVISOR_PACKET")return visibility==="INTERVIEWER_SAFE"||visibility==="FULL_STORY"||visibility==="ADVISOR_ONLY";
    if(scope==="STUDENT")return visibility!=="HIDDEN";
    return visibility==="INTERVIEWER_SAFE";
  });
}

export function mediaForScope(document,scope){
  return (document.mediaItems||[]).filter((item)=>{
    const visibility=visibilityName(item.visibility);
    if(visibility==="HIDDEN")return false;
    if(scope==="INTERVIEWER_SAFE")return visibility==="INTERVIEWER_SAFE";
    if(scope==="FULL_STORY")return visibility==="INTERVIEWER_SAFE"||visibility==="FULL_STORY";
    if(scope==="ADVISOR_PACKET")return visibility==="INTERVIEWER_SAFE"||visibility==="FULL_STORY"||visibility==="ADVISOR_ONLY";
    if(scope==="STUDENT")return visibility!=="HIDDEN";
    return visibility==="INTERVIEWER_SAFE";
  });
}

function roundedRect(ctx,x,y,w,h,r){const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();}
function fitText(ctx,text,maxWidth){const value=String(text||"");if(ctx.measureText(value).width<=maxWidth)return value;let out=value;while(out.length>1&&ctx.measureText(out+"...").width>maxWidth)out=out.slice(0,-1);return out+"...";}
function wrapText(ctx,text,maxWidth,maxLines=8){const words=String(text||"").split(/\s+/),lines=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;if(lines.length>=maxLines-1)break;}else line=next;}if(line&&lines.length<maxLines)lines.push(line);return lines;}

function categoryMap(document){return Object.fromEntries((document.categories||[]).map((category)=>[category.id,category]));}

async function drawBackground(ctx,theme){
  if(theme==="paper"){ctx.fillStyle="#f3efe4";ctx.fillRect(0,0,BASE.width,BASE.height);ctx.strokeStyle="#d4c7aa";for(let y=0;y<BASE.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(BASE.width,y);ctx.stroke();}return;}
  if(theme==="season"){const gradient=ctx.createLinearGradient(0,0,BASE.width,BASE.height);gradient.addColorStop(0,"#101319");gradient.addColorStop(1,"#24272d");ctx.fillStyle=gradient;ctx.fillRect(0,0,BASE.width,BASE.height);return;}
  const board=await loadImage(cssAsset("--kbBoard"));if(board)ctx.drawImage(board,0,0,BASE.width,BASE.height);else{ctx.fillStyle="#5a4832";ctx.fillRect(0,0,BASE.width,BASE.height);}
}

function drawAxis(ctx,events,theme){
  const range=axis(events),x=118,y=222,width=1682,height=68,total=Math.max(1,range.end-range.start+1),startYear=Math.floor(range.start/12),endYear=Math.floor(range.end/12);
  ctx.save();ctx.shadowColor="rgba(0,0,0,.4)";ctx.shadowBlur=9;ctx.fillStyle=theme==="paper"?"#d3b45e":"#b99135";roundedRect(ctx,x,y,width,height,5);ctx.fill();ctx.restore();
  const years=endYear-startYear+1;
  for(let i=0;i<years;i++){
    const year=startYear+i,left=x+((i*12-(range.start-startYear*12))/total)*width,right=x+(((i+1)*12-(range.start-startYear*12))/total)*width;
    ctx.strokeStyle="rgba(62,38,10,.7)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left,y+height);ctx.stroke();
    ctx.fillStyle="#21180f";ctx.font="700 27px Futura, Helvetica, sans-serif";ctx.textAlign="center";ctx.fillText(String(year),(left+Math.min(right,x+width))/2,y+38);
    ctx.font="600 12px Helvetica, sans-serif";ctx.fillStyle="rgba(33,24,15,.72)";ctx.fillText("JAN",left+18,y+59);ctx.fillText("JUL",(left+right)/2,y+59);ctx.fillText("DEC",Math.min(right,x+width)-18,y+59);
  }
  ctx.strokeStyle="#e2c46d";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y+height+7);ctx.lineTo(x+width,y+height+7);ctx.stroke();
  return {...range,x,y,width,height,total};
}

function eventPosition(event,axisInfo){const start=monthIndex(event.startDate)??axisInfo.start,end=monthIndex(event.endDate||event.startDate)??start;return {x:axisInfo.x+((start-axisInfo.start)/axisInfo.total)*axisInfo.width,width:Math.max(42,((Math.max(start,end)-start+1)/axisInfo.total)*axisInfo.width)};}

function drawArrow(ctx,event,position,y,color){
  const h=45,head=Math.min(27,Math.max(14,position.width*.22)),body=Math.max(10,position.width-head);ctx.save();ctx.shadowColor="rgba(0,0,0,.45)";ctx.shadowBlur=6;ctx.shadowOffsetY=3;
  const gradient=ctx.createLinearGradient(position.x,y,position.x,y+h);gradient.addColorStop(0,"rgba(255,255,255,.34)");gradient.addColorStop(.2,color);gradient.addColorStop(1,color);ctx.fillStyle=gradient;
  ctx.beginPath();ctx.moveTo(position.x,y+4);ctx.lineTo(position.x+body,y+4);ctx.lineTo(position.x+position.width,y+h/2);ctx.lineTo(position.x+body,y+h-4);ctx.lineTo(position.x,y+h-4);ctx.closePath();ctx.fill();
  ctx.strokeStyle="rgba(45,25,12,.55)";ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
  ctx.font="500 17px Futura, Helvetica, sans-serif";ctx.textAlign="center";ctx.fillStyle="#fff";ctx.fillText(fitText(ctx,event.title,Math.max(24,position.width-34)),position.x+position.width/2,y+28);
  ctx.font="700 13px Helvetica, sans-serif";ctx.fillStyle="#382714";ctx.textAlign="left";ctx.fillText(monthLabel(event.startDate),position.x,y-4);ctx.textAlign="right";ctx.fillText(monthLabel(event.endDate||event.startDate),position.x+position.width,y-4);
  if(event.siteName){ctx.font="700 12px Helvetica, sans-serif";const site=fitText(ctx,event.siteName,210),siteWidth=Math.min(220,ctx.measureText(site).width+16),siteX=Math.max(118,position.x-siteWidth-10);ctx.fillStyle="rgba(250,245,231,.9)";roundedRect(ctx,siteX,y+7,siteWidth,25,3);ctx.fill();ctx.fillStyle="#2c2118";ctx.textAlign="left";ctx.fillText(site,siteX+8,y+24);}
}

function drawFlag(ctx,event,position,y,color){
  const x=position.x;ctx.save();ctx.shadowColor="rgba(0,0,0,.42)";ctx.shadowBlur=5;ctx.strokeStyle="#2b241e";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,y+74);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+48,y+8);ctx.lineTo(x+34,y+31);ctx.lineTo(x,y+23);ctx.closePath();ctx.fill();ctx.restore();
  ctx.font="700 13px Helvetica, sans-serif";ctx.fillStyle="#382714";ctx.textAlign="center";ctx.fillText(fitText(ctx,event.title,140),x+12,y-18);ctx.font="700 11px Helvetica, sans-serif";ctx.fillText(monthLabel(event.startDate),x+12,y+91);
}

function drawLegend(ctx,document){
  const categories=(document.categories||[]).slice(0,6),x=410,y=897,w=700,h=102;ctx.save();ctx.fillStyle="rgba(249,244,232,.94)";ctx.shadowColor="rgba(0,0,0,.35)";ctx.shadowBlur=8;roundedRect(ctx,x,y,w,h,4);ctx.fill();ctx.restore();ctx.fillStyle="#2a2018";ctx.font="700 14px Helvetica, sans-serif";ctx.textAlign="left";ctx.fillText("COLOR KEY",x+18,y+24);categories.forEach((item,index)=>{const col=index%3,row=Math.floor(index/3),itemX=x+18+col*224,itemY=y+42+row*27;ctx.fillStyle=item.color||"#777";ctx.fillRect(itemX,itemY-12,18,13);ctx.strokeStyle="rgba(42,32,24,.55)";ctx.strokeRect(itemX,itemY-12,18,13);ctx.fillStyle="#2a2018";ctx.font="600 12px Helvetica, sans-serif";ctx.fillText(fitText(ctx,item.label||item.id,185),itemX+26,itemY);});
}

async function drawMedia(ctx,document,mediaResolver,scope){
  const items=mediaForScope(document,scope),photoCount=document.mediaLayout?.photoCount||3,photos=items.filter((item)=>item.type==="photo"||item.type==="personalImage").slice(0,photoCount);
  const startX=1180,gap=16,frameW=photos.length>=5?112:photos.length===4?138:175,frameH=132,y=836;
  for(let i=0;i<Math.max(photoCount,photos.length);i++){
    const x=startX+i*(frameW+gap),pad=20,frame=photoFrameSprite(frameW,frameH,(i%2?1:-1)*2);ctx.drawImage(frame,x-pad,y-pad);
    const item=photos[i];if(item&&mediaResolver){const source=await mediaResolver(item);const image=await loadImage(source);drawCover(ctx,image,x,y,frameW,frameH,item.crop);}
  }
  const avatar=items.find((item)=>item.type==="profilePhoto");ctx.fillStyle="#f8f2e5";ctx.fillRect(122,822,250,174);ctx.fillStyle="#271d16";ctx.font="700 22px Baskerville, Georgia, serif";ctx.textAlign="center";ctx.fillText((document.studentProfile?.name||"Student").toUpperCase(),247,974);
  if(avatar&&mediaResolver){const source=await mediaResolver(avatar),image=await loadImage(source);ctx.save();ctx.beginPath();ctx.arc(247,887,58,0,Math.PI*2);ctx.clip();drawCover(ctx,image,189,829,116,116,avatar.crop);ctx.restore();}
  const logo=items.find((item)=>item.type==="logo"||item.type==="programLogo");
  if(logo&&mediaResolver){const source=await mediaResolver(logo),image=await loadImage(source);ctx.fillStyle="#f7f1e4";ctx.fillRect(1518,118,268,84);drawCover(ctx,image,1530,128,244,64,logo.crop);}
}

export async function renderTimelineCanvas(document,{scope="INTERVIEWER_SAFE",width=1920,height=1080,mediaResolver=null}={}){
  if(typeof document?.createElement==="function")throw new Error("TimelineDocument expected, not DOM document.");
  if(globalThis.document?.fonts?.ready)await globalThis.document.fonts.ready;
  const presentation=await serializeFounderPresentationAsync(document,{
    scope,
    mediaResolver
  });
  const rasterized=await rasterizePresentationSvg(presentation.svg,{width,height});
  return{
    canvas:rasterized.canvas,
    events:eventsForScope(document,scope),
    scope,
    width,
    height,
    axis:presentation.scene.axis,
    scene:presentation.scene,
    svg:presentation.svg,
    serializer:presentation.serializer,
    warnings:rasterized.warnings
  };
}

export async function canvasToBlob(canvas,type="image/png",quality=.96){return new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error("Canvas export failed.")),type,quality));}

export async function renderAdvisorPage(document,{width=1920,height=1080}={}){
  const canvas=globalThis.document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{alpha:false}),scale=width/BASE.width;ctx.scale(scale,height/BASE.height);
  ctx.fillStyle="#0d1016";ctx.fillRect(0,0,BASE.width,BASE.height);ctx.fillStyle="#f2a13b";ctx.fillRect(0,0,18,BASE.height);ctx.fillStyle="#f6efe1";ctx.font="700 42px Archivo, Helvetica, sans-serif";ctx.fillText("ADVISOR REVIEW PACKET",70,80);
  ctx.fillStyle="#9bb3c9";ctx.font="600 18px Rajdhani, Helvetica, sans-serif";ctx.fillText(`${document.studentProfile?.name||"Student"}  |  ${document.advisorReview?.status||"UNREVIEWED"}  |  LOCAL SANDBOX`,72,115);
  const comments=document.advisorReview?.comments||[],requests=document.advisorReview?.changeRequests||[];let y=170;
  const section=(title,items,format)=>{
    ctx.fillStyle="#f2a13b";ctx.font="700 22px Archivo, Helvetica, sans-serif";ctx.fillText(title,72,y);y+=35;
    if(!items.length){ctx.fillStyle="#7f8d9c";ctx.font="500 17px Archivo, Helvetica, sans-serif";ctx.fillText("None recorded.",88,y);y+=40;return;}
    const available=Math.max(0,Math.floor((990-y)/74)),overflow=items.length>available,visibleCount=overflow?Math.max(0,available-1):Math.min(items.length,available);
    items.slice(0,visibleCount).forEach((item,index)=>{ctx.fillStyle="#171d26";roundedRect(ctx,72,y,1776,62,4);ctx.fill();ctx.fillStyle="#f6efe1";ctx.font="500 17px Archivo, Helvetica, sans-serif";const lines=wrapText(ctx,format(item,index),1700,2);lines.forEach((line,lineIndex)=>ctx.fillText(line,92,y+25+lineIndex*22));y+=74;});
    if(overflow&&available>0){ctx.fillStyle="#171d26";roundedRect(ctx,72,y,1776,62,4);ctx.fill();ctx.fillStyle="#9bb3c9";ctx.font="600 17px Rajdhani, Helvetica, sans-serif";ctx.fillText(`${items.length-visibleCount} ADDITIONAL RECORDS REMAIN IN TIMELINE JSON`,92,y+37);y+=74;}
    y+=18;
  };
  section("COACH COMMENTS",comments,(item)=>`${item.resolved?"RESOLVED":"OPEN"}  |  ${item.authorRole||"ADVISOR"}  |  ${item.body}`);
  section("CHANGE REQUESTS",requests,(item)=>`${item.state||"OPEN"}  |  ${item.body}`);
  section("APPROVAL AUDIT",document.advisorReview?.auditHistory||[],(item)=>`${item.at||""}  |  ${item.action}`);
  ctx.fillStyle="#f6efe1";ctx.font="600 16px Archivo, Helvetica, sans-serif";ctx.fillText("ADVISOR COPY  |  NOT FOR INTERVIEWER DISTRIBUTION",72,1040);return canvas;
}

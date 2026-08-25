/*
 * Raster-safe export projection for the protected 407F renderer.
 *
 * Browser canvas security deliberately taints SVG images containing
 * foreignObject. The interactive renderer remains untouched; this module
 * projects its already-built scene through the same recovered 407F assets,
 * constants, composition, and coordinates using native SVG primitives so the
 * browser can encode PNG/PDF locally.
 */

import {
  LOCKED_407F_ASSETS,
  LOCKED_407F_GEOMETRY,
  LOCKED_407F_SOURCE_SHA256,
  locked407FComposition,
  locked407FExplanationConnection
} from "./locked-407f-artifact.js";
import {
  FOUNDER_COLOR_KEY_ROWS,
  FOUNDER_KEYNOTE_CONTRACT
} from "../presentation/founder-keynote-contract.js";

const WIDTH=LOCKED_407F_GEOMETRY.width;
const HEIGHT=LOCKED_407F_GEOMETRY.height;
const CONTENT_WIDTH=WIDTH-2;
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TYPE=Object.freeze({
  title:"'American Typewriter',Rockwell,'Courier New',serif",
  axis:"Futura,'Trebuchet MS',Arial,sans-serif",
  key:"Futura,'Trebuchet MS',Arial,sans-serif",
  profile:"'American Typewriter',Rockwell,'Courier New',serif",
  event:"Baskerville,'Iowan Old Style','Times New Roman',serif"
});
const FOUNDER_PORTABLE_GEOMETRY=Object.freeze({
  axisTop:125,
  axisHeight:36,
  title:Object.freeze({x:648,y:0,width:596,height:83}),
  colorKey:Object.freeze({x:37,y:350,width:247,height:277}),
  profile:Object.freeze({x:30,y:677,width:512,height:375}),
  photos:Object.freeze([
    Object.freeze({x:599,y:776,width:176,height:235,rotation:-10}),
    Object.freeze({x:753,y:884,width:223,height:140,rotation:-6}),
    Object.freeze({x:992,y:878,width:233,height:175,rotation:0})
  ]),
  interview:Object.freeze({x:1666,y:238,width:220,height:136})
});
function xml(value){
  return String(value??"").replace(/[&<>"']/g,(character)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"
  })[character]);
}

function monthIndex(value){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  return match?Number(match[1])*12+Number(match[2])-1:0;
}

function formatMonth(value){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  return match?`${MONTHS[Number(match[2])-1]} ${match[1]}`:"";
}

function formatFlagDate(value){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  return match?`${Number(match[2])}/${String(match[1]).slice(-2)}`:"";
}

function metrics(scene){
  const manual=scene?.founderPresentation?.axis;
  if(manual?.mode==="manual"){
    const segments=manual.segmentWeights.map((item)=>({
      id:String(item.id),
      label:String(item.id),
      weight:Math.max(.25,Number(item.weight)||1)
    }));
    const totalWeight=segments.reduce((sum,item)=>sum+item.weight,0);
    let cumulative=0;
    for(const segment of segments){
      segment.startPercent=2+(cumulative/totalWeight)*96;
      cumulative+=segment.weight;
      segment.endPercent=2+(cumulative/totalWeight)*96;
    }
    const yearSegments=segments.filter(({id})=>/^\d{4}$/.test(id));
    const byYear=new Map(yearSegments.map((item)=>[Number(item.id),item]));
    const percentAtMonth=(month,{after=false}={})=>{
      const index=monthIndex(month)+(after?1:0);
      const year=Math.floor(index/12),within=((index%12)+12)%12;
      const segment=byYear.get(year);
      if(segment)return segment.startPercent+
        (segment.endPercent-segment.startPercent)*(within/12);
      if(year<manual.startYear)return 2;
      return 98;
    };
    return{
      firstYear:manual.startYear,
      lastYear:manual.endYear,
      segments,
      xPercent:(month)=>percentAtMonth(month),
      widthPercent:(start,end)=>Math.max(0,percentAtMonth(end,{after:true})-percentAtMonth(start))
    };
  }
  const months=[
    ...(scene?.arrows||[]).flatMap((arrow)=>[arrow.startMonth,arrow.endMonth]),
    ...(scene?.flags||[]).map((flag)=>flag.month),
    scene?.interviewMarker?.month
  ].filter(Boolean).map(monthIndex);
  const firstYear=months.length
    ?Math.floor(Math.min(...months)/12)
    :Number(scene?.span?.firstYear)||new Date().getUTCFullYear();
  const lastCandidate=months.length
    ?Math.floor(Math.max(...months)/12)
    :Number(scene?.span?.lastYear)||firstYear+1;
  const lastYear=Math.max(firstYear+1,lastCandidate);
  const totalMonths=(lastYear-firstYear+1)*12;
  const segments=[];
  for(let year=firstYear;year<=lastYear;year+=1){
    const startPercent=2+((year-firstYear)/(lastYear-firstYear+1))*96;
    const endPercent=2+((year-firstYear+1)/(lastYear-firstYear+1))*96;
    segments.push({id:String(year),label:String(year),weight:1,startPercent,endPercent});
  }
  return{
    firstYear,
    lastYear,
    segments,
    xPercent:(month)=>2+((monthIndex(month)-firstYear*12)/totalMonths)*96,
    widthPercent:(start,end)=>((monthIndex(end)-monthIndex(start)+1)/totalMonths)*96
  };
}

function boardX(percent){
  return 1+CONTENT_WIDTH*Number(percent)/100;
}

function pixel(value){
  return Math.floor(Number(value)*64)/64;
}

function presentation(arrow,scene){
  const rows=new Map((scene?.founderPresentation?.categoryKey||FOUNDER_COLOR_KEY_ROWS)
    .map((item)=>[item.id,item]));
  if(arrow.categoryId==="exams")return{slug:"usmle",color:rows.get("exams")?.color||"#3A78C9"};
  if(arrow.categoryId==="clinical"){
    return /clinic|ambulatory|outpatient/i.test(arrow.siteName)
      ?{slug:"cl",color:rows.get("clinical-clinic")?.color||"#E89B3C"}
      :{slug:"th",color:rows.get("clinical-hospital")?.color||"#C8641C"};
  }
  if(arrow.categoryId==="personal")return{slug:"personal",color:rows.get("personal")?.color||"#8A5BBF"};
  if(arrow.categoryId==="research")return{slug:"res",color:rows.get("research")?.color||"#D4B636"};
  return{slug:"work",color:rows.get("work")?.color||"#3F9B52"};
}

function founderBoardAssetUrl(){
  const path=FOUNDER_KEYNOTE_CONTRACT.assets.board.publicPath;
  return globalThis.D1_TIMELINE_ASSET_URLS?.[path]||path;
}

function founderKeynoteAssetUrl(asset){
  return globalThis.D1_TIMELINE_ASSET_URLS?.[asset.publicPath]||asset.publicPath;
}

function background(scene){
  const advanced=scene?.advancedProjection?.background;
  if(advanced?.kind==="color"&&advanced.color){
    return`<linearGradient id="d1406-board"><stop offset="0" stop-color="${xml(advanced.color)}"/><stop offset="1" stop-color="${xml(advanced.color)}"/></linearGradient>`;
  }
  if(advanced?.kind==="preset"&&advanced.css){
    const colors=[...String(advanced.css).matchAll(/#[0-9A-Fa-f]{6}/g)].map((match)=>match[0]);
    const start=colors[0]||"#F8F4EA";
    const end=colors.at(-1)||start;
    return`<linearGradient id="d1406-board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`;
  }
  const id=String(scene?.theme?.id||"keynote-classic");
  if(id==="season-one-board"){
    return`<linearGradient id="d1406-board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121726"/><stop offset="1" stop-color="#070A12"/></linearGradient>`;
  }
  if(id==="advisor-paper"){
    return`<linearGradient id="d1406-board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBFAF6"/><stop offset="1" stop-color="#EEEAE1"/></linearGradient>`;
  }
  if(id==="horizon"){
    return`<linearGradient id="d1406-board" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF7EA"/><stop offset=".26" stop-color="#FDFCF9"/><stop offset="1" stop-color="#FDFCF9"/></linearGradient>`;
  }
  if(id==="little-journeys"){
    return`<linearGradient id="d1406-board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4FAFD"/><stop offset="1" stop-color="#EAF4F0"/></linearGradient>`;
  }
  const board=FOUNDER_KEYNOTE_CONTRACT.assets.board;
  return`<pattern id="d1406-board" x="0" y="0" width="${board.width}" height="${board.height}" patternUnits="userSpaceOnUse"><image data-founder-board-template="true" data-founder-board-asset-sha256="${board.sha256}" href="${xml(founderBoardAssetUrl())}" x="0" y="0" width="${board.width}" height="${board.height}" preserveAspectRatio="xMidYMid slice"/></pattern>`;
}

function advancedBackgroundLayer(scene){
  const background=scene?.advancedProjection?.background;
  if(background?.kind!=="upload"||!background.resolvedUrl)return"";
  const colorMatch=String(background.scrimCss||"").match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/
  );
  const scrim=colorMatch
    ?`<rect x="1" y="1" width="1918" height="1078" fill="rgb(${colorMatch[1]} ${colorMatch[2]} ${colorMatch[3]})" fill-opacity="${colorMatch[4]}"/>`
    :"";
  return`<image data-board-background-upload="true" href="${xml(background.resolvedUrl)}" x="1" y="1" width="1918" height="1078" preserveAspectRatio="xMidYMid slice"/>${scrim}`;
}

function presentationEventObject(scene,id){
  return(scene?.founderPresentation?.advancedScene?.objects||[]).find((object)=>
    object?.type==="event"&&
    (String(object.semanticRef||"")===String(id)||String(object.id||"")===String(id))
  )||null;
}

function geometry(arrow,layout,scale,scene){
  const overridden=presentationEventObject(scene,arrow.id)?.geometry;
  if(overridden){
    const x=pixel(overridden.x),y=pixel(overridden.y);
    const width=pixel(Math.max(1,overridden.width));
    return{x,y,width,x2:x+width,height:pixel(Math.max(1,overridden.height))};
  }
  const x=pixel(boardX(scale.xPercent(arrow.startMonth)));
  const width=pixel(Math.max(
    LOCKED_407F_GEOMETRY.minimumArrowWidth,
    CONTENT_WIDTH*scale.widthPercent(arrow.startMonth,arrow.endMonth)/100
  ));
  const y=pixel(1+layout.laneTop+Number(arrow.lane||0)*layout.lanePitch);
  return{x,y,width,x2:x+width,height:LOCKED_407F_GEOMETRY.arrowHeight};
}

function founderPortableLayout(scene){
  const recovered=locked407FComposition(scene);
  const laneTop=recovered.density==="dense"
    ?Math.max(184,recovered.laneTop+42)
    :Math.max(205,recovered.laneTop+36);
  const lanePitch=recovered.density==="dense"
    ?Math.max(44,recovered.lanePitch)
    :recovered.density==="medium"
      ?Math.max(82,recovered.lanePitch)
      :Math.max(96,recovered.lanePitch);
  const eventBottom=laneTop+(recovered.laneCount-1)*lanePitch+
    LOCKED_407F_GEOMETRY.arrowHeight;
  return Object.freeze({...recovered,laneTop,lanePitch,eventBottom});
}

function arrowDefinitions(arrows,layout,scale,scene){
  return arrows.map((arrow,index)=>{
    const color=presentation(arrow,scene).color;
    return`<linearGradient id="d1406-arrow-${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".34"/><stop offset=".18" stop-color="${color}"/><stop offset="1" stop-color="${color}"/></linearGradient>`;
  }).join("");
}

function arrowMarkup(arrow,index,layout,scale,scene){
  const box=geometry(arrow,layout,scale,scene);
  const style=presentation(arrow,scene);
  const start=formatMonth(arrow.startMonth);
  const end=arrow.openEnded?"Present":formatMonth(arrow.endMonth);
  const duration=monthIndex(arrow.endMonth)-monthIndex(arrow.startMonth)+1;
  const tight=layout.tight;
  const dateSize=tight?16:18;
  const dateY=box.y-(tight?4:8);
  const dates=duration>=6&&box.width>=180
    ?`<text x="${box.x}" y="${dateY}" fill="#111827" font-family="${TYPE.event}" font-size="${dateSize}">${xml(start)}</text><text x="${box.x2-8}" y="${dateY}" text-anchor="end" fill="#111827" font-family="${TYPE.event}" font-size="${dateSize}">${xml(end)}</text>`
    :`<text x="${box.x+box.width/2}" y="${dateY}" text-anchor="middle" fill="#111827" font-family="${TYPE.event}" font-size="${dateSize}">${xml(start)} - ${xml(end)}</text>`;
  const site=arrow.siteName&&!tight
    ?`<text x="${box.x+box.width/2}" y="${box.y+51}" text-anchor="middle" fill="#111827" font-family="${TYPE.event}" font-size="18">${xml(arrow.siteName)}</text>`
    :"";
  const arrowHead=Math.min(18,Math.max(13,box.width*.12));
  const arrowPath=`M${box.x} ${box.y}H${box.x2-arrowHead}L${box.x2} ${box.y+box.height/2}L${box.x2-arrowHead} ${box.y+box.height}H${box.x}Z`;
  const labelX=box.x+10+(box.width-28)/2;
  const lor=arrow.lorSubmitted
    ?`<g data-lor-submitted="true" transform="translate(${box.x2-38} ${box.y-10})"><path d="M0 0H20V22L10 16L0 22Z" fill="#F3E7B3" stroke="#8C6B20"/><text x="10" y="14" text-anchor="middle" fill="#6C5018" font-family="Arial" font-size="11" font-weight="800">★</text></g>`
    :"";
  const chip=arrow.actionChip
    ?`<g data-study-action-chip="${xml(arrow.actionChip.targetAttemptId||"")}" transform="translate(${box.x2-141} ${box.y+36})"><rect width="126" height="24" rx="12" fill="#B98A2E" stroke="#A67A26"/><text x="63" y="16" text-anchor="middle" fill="#191C21" font-family="Rajdhani,Arial,sans-serif" font-size="10" font-weight="700">${xml(arrow.actionChip.label||"Set retake date")}</text></g>`
    :"";
  return`<g data-event-kind="arrow" data-event-id="${xml(arrow.id)}" data-category="${xml(arrow.categoryId)}" aria-label="${xml(arrow.ariaLabel)}" filter="url(#d1406-arrow-shadow)"><path data-continuous-duration-arrow="true" d="${arrowPath}" fill="url(#d1406-arrow-${index})" stroke="#17212B" stroke-width="1.5"/><path d="M${box.x+2} ${box.y+2}H${box.x2-arrowHead-2}" stroke="#FFFFFF" stroke-opacity=".46" stroke-width="1"/>${dates}${site}<text x="${labelX}" y="${box.y+21}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.event}" font-size="18">${xml(arrow.title)}</text>${lor}${chip}</g>`;
}

function axisMarkup(scale){
  const segments=scale.segments||[];
  const x=boardX(2);
  const width=CONTENT_WIDTH*.96;
  const y=FOUNDER_PORTABLE_GEOMETRY.axisTop;
  const height=FOUNDER_PORTABLE_GEOMETRY.axisHeight;
  return`<g data-layer="axis" data-axis-language="407f-powerpoint">${segments.map((segment,index)=>{
    const sx=x+width*((segment.startPercent-2)/96);
    const ex=x+width*((segment.endPercent-2)/96);
    const segmentWidth=ex-sx;
    // Non-first segments use an inward notch instead of painting over the prior
    // segment's arrowhead. Every year therefore reads as a connected chevron.
    const path=index===0
      ?`M${sx} ${y}H${ex-12}L${ex} ${y+height/2}L${ex-12} ${y+height}H${sx}Z`
      :`M${sx+12} ${y}L${sx} ${y+height/2}L${sx+12} ${y+height}H${ex-12}L${ex} ${y+height/2}L${ex-12} ${y}Z`;
    const kind=segment.id==="FUTURE"?"future":"year";
    const fontSize=segmentWidth<90?17:23;
    return`<g data-segment-kind="${kind}" data-axis-segment-id="${xml(segment.id)}" data-axis-segment-weight="${segment.weight}"><path d="${path}" fill="url(#d1406-axis)" stroke="#C1B98B" stroke-width="1.2"/><path d="M${sx+14} ${y+2}H${ex-14}" stroke="#FFFFFF" stroke-opacity=".35"/><text x="${sx+segmentWidth/2}" y="${y+26}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.axis}" font-size="${fontSize}" font-weight="700">${xml(segment.label)}</text></g>`;
  }).join("")}<rect data-axis-hit-target="true" x="${x}" y="${y-8}" width="${width}" height="${height+16}" fill="transparent" pointer-events="all"/></g>`;
}

function flagMarkup(flag,index,scale,scene,{interview=false}={}){
  const overridden=interview?null:presentationEventObject(scene,flag.id)?.geometry;
  const x=overridden?pixel(overridden.x):boardX(scale.xPercent(flag.month));
  const y=overridden?pixel(overridden.y):(index%2===0?58:65);
  const sx=overridden?Math.max(.25,Number(overridden.width)||50)/50:1;
  const sy=overridden?Math.max(.25,Number(overridden.height)||64)/64:1;
  const rotation=overridden?Number(overridden.rotation)||0:0;
  const transform=overridden
    ?` transform="translate(${x} ${y}) rotate(${rotation} 25 32) scale(${sx} ${sy})"`
    :"";
  const bx=overridden?0:x,by=overridden?0:y;
  const source=flag.categoryId==="personal"
    ?LOCKED_407F_ASSETS.flagPersonal
    :LOCKED_407F_ASSETS.flagGray;
  const title=interview?"Interview":flag.title;
  const useUsFlag=!interview&&/relocat|moved|u\.?s\.?a|green\s*card|citizen|immigra/i.test(title);
  if(useUsFlag){
    const poleX=bx+4;
    const usaFlag=FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag;
    return`<g data-event-kind="flag" data-event-id="${xml(flag.id)}" data-founder-milestone-style="usa" aria-label="${xml(flag.ariaLabel)}"${transform}><line x1="${poleX}" y1="${by+2}" x2="${poleX}" y2="${overridden?64:FOUNDER_PORTABLE_GEOMETRY.axisTop}" stroke="#A9AFB2" stroke-width="4"/><image data-founder-usa-flag-asset-sha256="${usaFlag.sha256}" href="${xml(founderKeynoteAssetUrl(usaFlag))}" x="${bx}" y="${by}" width="50" height="41" preserveAspectRatio="xMinYMin meet"/><text x="${bx+54}" y="${by+31}" fill="#111827" font-family="${TYPE.event}" font-size="18">${xml(title)}</text><text x="${bx+54}" y="${by+52}" fill="#111827" font-family="${TYPE.event}" font-size="18">${xml(formatMonth(flag.month))}</text></g>`;
  }
  return`<g data-event-kind="${interview?"interview-marker":"flag"}"${interview?"":` data-event-id="${xml(flag.id)}"`} data-founder-milestone-style="metallic-flag" aria-label="${xml(flag.ariaLabel)}"${transform}><line x1="${bx+5}" y1="${by+8}" x2="${bx+5}" y2="${overridden?64:FOUNDER_PORTABLE_GEOMETRY.axisTop}" stroke="#A9AFB2" stroke-width="4"/><image href="${xml(source)}" x="${bx}" y="${by}" width="50" height="64" preserveAspectRatio="xMinYMin meet"/><text x="${bx+12}" y="${by+30}" fill="#FFFFFF" font-family="${TYPE.axis}" font-size="14" font-weight="500">${xml(formatFlagDate(flag.month))}</text><text x="${bx+49}" y="${by+29}" fill="#111827" font-family="${TYPE.event}" font-size="18">${xml(title)}</text></g>`;
}

function colorKey(scene){
  const geometry=scene?.founderPresentation?.colorKeyGeometry||FOUNDER_PORTABLE_GEOMETRY.colorKey;
  const {x,y,width,height}=geometry;
  const rows=[...(scene?.founderPresentation?.categoryKey||FOUNDER_COLOR_KEY_ROWS)];
  if(scene?.lorLegend?.visible)rows.push({id:"lor-submitted",label:scene.lorLegend.label||"LOR submitted",color:"#F3E7B3"});
  const rowPitch=31;
  const base=FOUNDER_PORTABLE_GEOMETRY.colorKey;
  const sx=width/base.width,sy=height/base.height;
  return`<g data-artifact-chrome="color-key" data-canonical-row-count="6" data-founder-geometry="${x},${y},${width},${height}" transform="translate(${x} ${y}) scale(${sx} ${sy})"><image href="${xml(LOCKED_407F_ASSETS.key)}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/><image href="${xml(LOCKED_407F_ASSETS.pin)}" x="${base.width/2-13}" y="-12" width="26" height="26"/><text x="24" y="45" fill="#A8402F" font-family="${TYPE.key}" font-size="18" font-weight="500">COLOR KEY</text>${rows.map(({id,label,color},index)=>{const fit=String(label).length>17?' textLength="163" lengthAdjust="spacingAndGlyphs"':"";return`<g data-color-key-row="${index}" data-category-id="${xml(id)}"><rect x="24" y="${63+index*rowPitch}" width="23" height="17" rx="2" fill="${color}"/><text x="58" y="${79+index*rowPitch}" fill="#171D26" font-family="${TYPE.key}" font-size="18" font-weight="500"${fit}>${xml(label)}</text></g>`;}).join("")}</g>`;
}

function profileMarkup(scene){
  const profile=scene?.profile||{};
  const photo=scene?.mediaProjection?.profilePhoto;
  const geometry=scene?.founderPresentation?.profileGeometry||FOUNDER_PORTABLE_GEOMETRY.profile;
  const {x,y,width,height}=geometry;
  const base=FOUNDER_PORTABLE_GEOMETRY.profile;
  const sx=width/base.width,sy=height/base.height;
  const rows=[
    ["Medical school",profile.medicalSchool],
    ["Degree",profile.degree],
    ["Status",profile.status],
    ["Specialty",profile.specialty],
    ["Step 1",profile.step1],
    ["Step 2 CK",profile.step2]
  ].filter(([,value])=>String(value||"").trim());
  const photoX=333,photoY=48,photoWidth=145,photoHeight=190;
  const photoLayer=photo
    ?`<image data-profile-photo-slot="true" data-media-id="${xml(photo.id)}" href="${xml(photo.source)}" x="${photoX}" y="${photoY}" width="${photoWidth}" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" stroke="#FFFFFF" stroke-width="7"/>`
    :`<rect data-profile-photo-slot="true" data-media-state="empty" x="${photoX}" y="${photoY}" width="${photoWidth}" height="${photoHeight}" fill="#C9C2AE" stroke="#FFFFFF" stroke-width="7"/><text x="${photoX+photoWidth/2}" y="${photoY+101}" text-anchor="middle" fill="#6D6753" font-family="${TYPE.profile}" font-size="19" font-weight="700">PROFILE PHOTO</text>`;
  return`<g data-artifact-chrome="profile" data-founder-geometry="${x},${y},${width},${height}" transform="translate(${x} ${y}) scale(${sx} ${sy})"><image href="${xml(LOCKED_407F_ASSETS.paper)}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/><text x="38" y="57" fill="#171D26" font-family="${TYPE.profile}" font-size="23" font-weight="700">${xml(profile.fullName||"Your journey")}</text>${rows.slice(0,6).map(([label,value],index)=>{const fit=String(`${label}: ${value}`).length>25?' textLength="255" lengthAdjust="spacingAndGlyphs"':"";return`<text x="38" y="${99+index*42}" fill="#171D26" font-family="${TYPE.profile}" font-size="19"${fit}><tspan font-weight="700">${xml(label)}: </tspan>${xml(value)}</text>`;}).join("")}${photoLayer}</g>`;
}

function photoFrames(scene){
  const photos=scene?.mediaProjection?.photos||[];
  return`<g data-artifact-chrome="photo-frames">${FOUNDER_PORTABLE_GEOMETRY.photos.map((frame,index)=>{
    const {x,y,width,height,rotation}=frame,photo=photos[index];
    const content=photo
      ?`<image data-media-id="${xml(photo.id)}" href="${xml(photo.source)}" x="${x+9}" y="${y+9}" width="${width-18}" height="${height-31}" preserveAspectRatio="xMidYMid slice"/>`
      :`<rect data-media-state="empty" x="${x+9}" y="${y+9}" width="${width-18}" height="${height-31}" fill="#D6D8D5"/><text x="${x+width/2}" y="${y+height/2}" text-anchor="middle" fill="#515B62" font-family="${TYPE.event}" font-size="18">DROP PHOTO ${index+1}</text>`;
    return`<g data-artifact-photo-frame="${index+1}" data-founder-geometry="${x},${y},${width},${height},${rotation}" transform="rotate(${rotation} ${x+width/2} ${y+height/2})"><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#FDFBF4"/>${content}</g>`;
  }).join("")}</g>`;
}

function interviewMarkup(scene,scale){
  const target=scene?.interviewTarget||{};
  const marker=scene?.interviewMarker;
  const logo=scene?.mediaProjection?.logo;
  const {x,y,width}=FOUNDER_PORTABLE_GEOMETRY.interview;
  const logoLayer=logo
    ?`<image data-program-logo="true" data-media-id="${xml(logo.id)}" href="${xml(logo.source)}" x="${x+8}" y="${y+5}" width="${width-16}" height="42" preserveAspectRatio="xMidYMid meet"/>`
    :`<text x="${x+width/2}" y="${y+31}" text-anchor="middle" fill="#4A5670" font-family="${TYPE.axis}" font-size="16" font-weight="700">${xml(String(target.programName||target.prog||"PROGRAM LOGO").toUpperCase())}</text>`;
  const ribbonY=y+62;
  return`${marker?flagMarkup(marker,0,scale,scene,{interview:true}):""}<g data-interview-destination="407f-ribbon"><rect x="${x}" y="${y}" width="${width}" height="52" fill="#FFFFFF" fill-opacity=".4" stroke="#26314D" stroke-opacity=".45" stroke-dasharray="4 3"/>${logoLayer}<path d="M${x} ${ribbonY}H${x+width}L${x+width-10} ${ribbonY+18}L${x+width} ${ribbonY+36}H${x}L${x+10} ${ribbonY+18}Z" fill="#7E4BB6"/><text x="${x+width/2}" y="${ribbonY+25}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.title}" font-size="18" font-weight="700">${xml(target.label||"YOUR BIG INTERVIEW")}</text><text x="${x+width/2}" y="${ribbonY+58}" text-anchor="middle" fill="#111827" font-family="${TYPE.event}" font-size="18">${marker?`Interview · ${xml(formatMonth(marker.month))}`:"Date pending"}</text></g>`;
}

function explanationMarkup(scene,explanation,index,scale){
  const x=Number.isFinite(Number(explanation.x))?Number(explanation.x):1691-index*190;
  const y=Number.isFinite(Number(explanation.y))?Number(explanation.y):497+index*110;
  const width=Math.max(132,Number(explanation.width)||132);
  const height=Math.max(96,Number(explanation.height)||96);
  const connection=locked407FExplanationConnection(scene,{
    ...explanation,x,y,width,height
  },{
    xAtPercent:boardX,
    widthAtPercent:(percent)=>CONTENT_WIDTH*Number(percent)/100,
    coordinateOffset:1
  });
  const lines=String(explanation.text||"").match(/.{1,24}(?:\s|$)/g)||[String(explanation.text||"")];
  return`<g data-event-kind="explanation" data-event-id="${xml(explanation.id)}" aria-label="${xml(explanation.ariaLabel)}">${explanation.leaderEnabled&&connection.distance?`<line data-explanation-leader="true" data-target-event-id="${xml(connection.targetEventId||"")}" x1="${connection.source.x}" y1="${connection.source.y}" x2="${connection.target.x}" y2="${connection.target.y}" stroke="#C73A25" stroke-width="4" marker-end="url(#d1406-red-arrowhead)"/>`:""}<image data-explanation-card="true" href="${xml(LOCKED_407F_ASSETS.sticky)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" transform="rotate(3 ${x+width/2} ${y+height/2})"/>${lines.slice(0,6).map((line,lineIndex)=>`<text x="${x+12}" y="${y+28+lineIndex*16}" fill="#4A3F14" font-family="Archivo,Arial,sans-serif" font-size="11" font-weight="600">${xml(line.trim())}</text>`).join("")}</g>`;
}

function chrome(scene,scale){
  const headline=String(scene?.headline?.text||scene?.profile?.fullName||"Your journey")
    .replace(/^timeline\s*:\s*/i,"");
  const plaque=FOUNDER_PORTABLE_GEOMETRY.title;
  const typography=scene?.advancedProjection?.headlineTypography||{};
  const alignment=typography.alignment==="left"?"start":typography.alignment==="right"?"end":"middle";
  const headlineX=alignment==="start"?plaque.x+48:alignment==="end"?plaque.x+plaque.width-48:plaque.x+plaque.width/2;
  const fontFamily=typography.font?`${xml(typography.font)},${TYPE.title}`:TYPE.title;
  const label=`Timeline: ${headline}`;
  const fit=label.length>26?' textLength="500" lengthAdjust="spacingAndGlyphs"':"";
  return`<g data-artifact-chrome="title" data-founder-geometry="648,0,596,83"><image href="${xml(LOCKED_407F_ASSETS.plaque)}" x="${plaque.x}" y="${plaque.y}" width="${plaque.width}" height="${plaque.height}" preserveAspectRatio="none"/><text data-board-headline="true" x="${headlineX}" y="56" text-anchor="${alignment}" fill="${xml(typography.color||"#111827")}" font-family="${fontFamily}" font-size="${Number(typography.size)||36}" font-weight="${Number(typography.weight)||400}"${fit}>${xml(label)}</text></g>${colorKey(scene)}${profileMarkup(scene)}${photoFrames(scene)}${interviewMarkup(scene,scale)}${(scene?.explanations||[]).map((explanation,index)=>explanationMarkup(scene,explanation,index,scale)).join("")}`;
}

function advancedFlagEmoji(code="US"){
  const value=String(code||"").toUpperCase();
  return/^[A-Z]{2}$/.test(value)
    ?String.fromCodePoint(...[...value].map((character)=>127397+character.charCodeAt(0)))
    :"⚑";
}

function advancedElementBody(object){
  const item=object.presentation||{};
  const width=Number(object.geometry.width)||120,height=Number(object.geometry.height)||80;
  const fill=xml(item.fill||"#2C6E8F"),stroke=xml(item.stroke||"#17324A");
  const common=`fill="${fill}" stroke="${stroke}" stroke-width="3" vector-effect="non-scaling-stroke"`;
  switch(String(item.kind||"")){
    case"rounded-rectangle":return`<rect width="${width}" height="${height}" rx="18" ${common}/>`;
    case"circle":return`<ellipse cx="${width/2}" cy="${height/2}" rx="${width/2}" ry="${height/2}" ${common}/>`;
    case"line":case"separator":return`<line x1="0" y1="${height/2}" x2="${width}" y2="${height/2}" ${common} stroke-width="6"/>`;
    case"badge":return`<path d="M${width*.5} 0L${width*.92} ${height*.25}L${width*.82} ${height*.82}L${width*.5} ${height}L${width*.18} ${height*.82}L${width*.08} ${height*.25}Z" ${common}/>`;
    case"label":return`<path d="M0 0H${width*.82}L${width} ${height/2}L${width*.82} ${height}H0Z" ${common}/>`;
    case"callout":return`<path d="M0 0H${width}V${height*.75}H${width*.35}L${width*.2} ${height}V${height*.75}H0Z" ${common}/>`;
    case"frame":return`<rect x="3" y="3" width="${width-6}" height="${height-6}" fill="none" stroke="${stroke}" stroke-width="8" vector-effect="non-scaling-stroke"/>`;
    case"arrow-right":case"arrow-thin":case"arrow-thick":return`<path d="M0 ${height*.5}H${width*.73}V${height*.18}L${width} ${height*.5}L${width*.73} ${height*.82}V${height*.5}H0Z" ${common}/>`;
    case"arrow-double":return`<path d="M0 ${height*.5}L${width*.24} ${height*.12}V${height*.34}H${width*.76}V${height*.12}L${width} ${height*.5}L${width*.76} ${height*.88}V${height*.66}H${width*.24}V${height*.88}Z" ${common}/>`;
    case"arrow-curved":return`<path d="M${width*.1} ${height*.8}C${width*.15} ${height*.14},${width*.72} ${height*.14},${width*.78} ${height*.46}L${width*.61} ${height*.28}M${width*.78} ${height*.46}L${width*.54} ${height*.5}" fill="none" stroke="${stroke}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    case"milestone":case"marker":case"pin":case"milestone-flag":return`<path d="M${width*.5} 0L${width} ${height*.5}L${width*.5} ${height}L0 ${height*.5}Z" ${common}/>`;
    case"ribbon":return`<path d="M0 ${height*.16}H${width}V${height*.84}H0L${width*.12} ${height*.5}Z" ${common}/>`;
    case"shadow":return`<ellipse cx="${width/2}" cy="${height/2}" rx="${width*.48}" ry="${height*.24}" fill="#000000" fill-opacity=".18"/>`;
    case"hospital":return`<rect x="${width*.12}" y="${height*.12}" width="${width*.76}" height="${height*.76}" rx="10" ${common}/><path d="M${width*.5} ${height*.25}V${height*.75}M${width*.25} ${height*.5}H${width*.75}" stroke="#fff" stroke-width="10" vector-effect="non-scaling-stroke"/>`;
    case"graduation":return`<path d="M0 ${height*.34}L${width*.5} 0L${width} ${height*.34}L${width*.5} ${height*.67}Z" ${common}/><path d="M${width*.22} ${height*.52}V${height*.78}Q${width*.5} ${height} ${width*.78} ${height*.78}V${height*.52}" fill="none" stroke="${stroke}" stroke-width="5"/>`;
    case"country-flag":return`<rect width="${width}" height="${height}" rx="8" fill="#fff" stroke="${stroke}" stroke-width="3"/><text x="${width/2}" y="${height*.72}" text-anchor="middle" font-size="${Math.min(width,height)*.7}">${advancedFlagEmoji(item.countryCode)}</text>`;
    case"missionmed-wordmark":return`<rect width="${width}" height="${height}" rx="${height*.18}" fill="#0B1320" stroke="#2B3A50" stroke-width="2"/><text x="${width*.08}" y="${height*.65}" fill="#F5F7FA" font-family="Inter,Arial,sans-serif" font-size="${height*.42}" font-style="italic" font-weight="800">MissionMed</text><text x="${width*.72}" y="${height*.65}" fill="#FF9F36" font-family="Inter,Arial,sans-serif" font-size="${height*.42}" font-style="italic" font-weight="900">//</text>`;
    default:return`<rect width="${width}" height="${height}" rx="${Math.min(16,height/5)}" ${common}/><text x="${width/2}" y="${height*.62}" text-anchor="middle" fill="#fff" font-family="Inter" font-size="${Math.min(width,height)*.36}" font-weight="700">${xml(item.label||item.kind||"Asset")}</text>`;
  }
}

function wrappedTextLines(text,width,fontSize,wrap){
  const source=String(text||"").split(/\r?\n/);
  if(wrap==="nowrap")return[source.join(" ")];
  const max=Math.max(1,Math.floor(width/(fontSize*.57)));
  const lines=[];
  for(const paragraph of source){
    const words=paragraph.split(/\s+/).filter(Boolean);
    if(!words.length){lines.push("");continue;}
    let line="";
    for(const word of words){
      const candidate=line?`${line} ${word}`:word;
      if(candidate.length<=max||!line)line=candidate;
      else{lines.push(line);line=word;}
    }
    if(line)lines.push(line);
  }
  return lines;
}

function advancedTextMarkup(object){
  const item=object.presentation||{},box=object.geometry;
  const lineHeight=Math.max(.8,Math.min(2,Number(item.lineHeight)||1.2));
  const minimum=Math.max(8,Math.min(72,Number(item.minFontSize)||10));
  let size=Math.max(minimum,Math.min(72,Number(item.size)||24));
  let lines=wrappedTextLines(item.text,box.width,size,item.wrap);
  if(item.fitMode!=="fixed"){
    while(size>minimum&&lines.length*size*lineHeight>box.height){
      size-=1;
      lines=wrappedTextLines(item.text,box.width,size,item.wrap);
    }
  }
  const anchor=item.alignment==="center"?"middle":item.alignment==="right"?"end":"start";
  const x=anchor==="middle"?box.width/2:anchor==="end"?box.width:0;
  const contentHeight=lines.length*size*lineHeight;
  const startY=item.verticalAlign==="bottom"
    ?box.height-contentHeight+size
    :item.verticalAlign==="center"
      ?(box.height-contentHeight)/2+size
      :size;
  return`<text data-advanced-text="${xml(object.id)}" x="${x}" y="${startY}" fill="${xml(item.color||"#191C21")}" font-family="${xml(item.font||"Inter")}" font-size="${size}" font-weight="${Number(item.weight)||400}" text-anchor="${anchor}" data-text-fit="${item.fitMode==="fixed"?"fixed":"auto"}">${lines.map((line,index)=>`<tspan x="${x}" dy="${index?size*lineHeight:0}">${xml(line)}</tspan>`).join("")}</text>`;
}

function advancedSceneMarkup(scene){
  const projection=scene?.founderPresentation?.advancedScene;
  if(!projection?.objects?.length)return"";
  const objects=[...projection.objects].filter((object)=>object.type!=="event")
    .sort((left,right)=>Number(left.z)-Number(right.z));
  if(!objects.length)return"";
  return`<g data-advanced-layer="true" data-scene-schema="${xml(projection.schema)}" data-scene-version="${xml(projection.version)}">${objects.map((object)=>{
    const box=object.geometry||{},item=object.presentation||{};
    const cx=Number(box.width)/2,cy=Number(box.height)/2;
    const transform=`translate(${Number(box.x)||0} ${Number(box.y)||0}) rotate(${Number(box.rotation)||0} ${cx} ${cy})`;
    const shared=`data-scene-object="${xml(object.id)}" data-scene-object-type="${xml(object.type)}" data-scene-z="${Number(object.z)||0}"${object.groupId?` data-scene-group="${xml(object.groupId)}"`:""} transform="${transform}"`;
    if(object.type==="media"){
      if(!item.resolvedSource)return`<g ${shared} data-media-state="missing"/>`;
      const preserve=item.fit==="contain"?"xMidYMid meet":"xMidYMid slice";
      return`<g ${shared}><image data-advanced-media="${xml(object.id)}" href="${xml(item.resolvedSource)}" x="0" y="0" width="${Math.max(1,Number(box.width)||1)}" height="${Math.max(1,Number(box.height)||1)}" preserveAspectRatio="${preserve}"/></g>`;
    }
    if(object.type==="text")return`<g ${shared}>${advancedTextMarkup(object)}</g>`;
    return`<g ${shared} data-advanced-element="${xml(object.id)}" data-advanced-kind="${xml(item.kind||"")}">${advancedElementBody(object)}</g>`;
  }).join("")}</g>`;
}

function appendLayers(svg,layers=""){
  return layers?svg.replace("</svg>",`${layers}</svg>`):svg;
}

function namespacePortableSvgResources(svg,resourceNamespace){
  const namespace=String(resourceNamespace||"")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,64);
  if(!namespace)return svg;
  return svg.replaceAll("d1406-",`d1406-${namespace}-`);
}

export function serializeLocked407FPortableSvg(scene,{layers="",resourceNamespace=""}={}){
  const scale=metrics(scene);
  const layout=founderPortableLayout(scene);
  const arrows=scene?.arrows||[];
  const flags=scene?.flags||[];
  const titleId="d1406-portable-title";
  const descriptionId="d1406-portable-description";
  const board=FOUNDER_KEYNOTE_CONTRACT.assets.board;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-labelledby="${titleId} ${descriptionId}" data-renderer="${xml(scene?.renderer)}" data-artifact-language="407f-powerpoint-keynote" data-export-projection="native-svg" data-locked-407f-source-sha256="${LOCKED_407F_SOURCE_SHA256}"><title id="${titleId}">${xml(scene?.accessibility?.ariaLabel)}</title><desc id="${descriptionId}">${xml(scene?.accessibility?.description)}</desc><defs>${background(scene)}<linearGradient id="d1406-axis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#315E82"/><stop offset=".18" stop-color="#244F75"/><stop offset=".72" stop-color="#173D62"/><stop offset="1" stop-color="#0C2B4E"/></linearGradient><filter id="d1406-arrow-shadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#141E32" flood-opacity=".48"/></filter><marker id="d1406-red-arrowhead" markerWidth="10" markerHeight="14" refX="10" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 7L0 14Z" fill="#C73A25"/></marker>${arrowDefinitions(arrows,layout,scale,scene)}</defs><rect data-board-background="true" data-founder-board-source="${xml(board.sourcePath)}" data-founder-board-asset-sha256="${board.sha256}" x="0" y="0" width="1920" height="1080" fill="url(#d1406-board)"/>${advancedBackgroundLayer(scene)}${axisMarkup(scale)}<g data-layer="events">${flags.map((flag,index)=>flagMarkup(flag,index,scale,scene)).join("")}${arrows.map((arrow,index)=>arrowMarkup(arrow,index,layout,scale,scene)).join("")}</g>${chrome(scene,scale)}</svg>`;
  return namespacePortableSvgResources(
    appendLayers(svg,`${advancedSceneMarkup(scene)}${layers}`),
    resourceNamespace
  );
}

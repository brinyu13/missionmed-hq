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

const WIDTH=LOCKED_407F_GEOMETRY.width;
const HEIGHT=LOCKED_407F_GEOMETRY.height;
const CONTENT_WIDTH=WIDTH-2;
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLOR_KEY=Object.freeze([
  ["Work Experience","#3F9B52"],
  ["USMLE Studies","#3A78C9"],
  ["USCE: Teaching Hospital","#C8641C"],
  ["USCE: Clinics","#E89B3C"],
  ["Personal / Not on CV","#8A5BBF"],
  ["Research Experience","#D4B636"]
]);

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

function metrics(scene){
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
  return{
    firstYear,
    lastYear,
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

function presentation(arrow){
  if(arrow.categoryId==="exams")return{slug:"usmle",color:"#3A78C9"};
  if(arrow.categoryId==="clinical"){
    return /clinic|ambulatory|outpatient/i.test(arrow.siteName)
      ?{slug:"cl",color:"#E89B3C"}
      :{slug:"th",color:"#C8641C"};
  }
  if(arrow.categoryId==="personal")return{slug:"personal",color:"#8A5BBF"};
  if(arrow.categoryId==="research")return{slug:"res",color:"#D4B636"};
  return{slug:"work",color:"#3F9B52"};
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
  return`<linearGradient id="d1406-board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07101D"/><stop offset=".46" stop-color="#101827"/><stop offset="1" stop-color="#070A12"/></linearGradient>`;
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

function geometry(arrow,layout,scale){
  const x=pixel(boardX(scale.xPercent(arrow.startMonth)));
  const width=pixel(Math.max(
    LOCKED_407F_GEOMETRY.minimumArrowWidth,
    CONTENT_WIDTH*scale.widthPercent(arrow.startMonth,arrow.endMonth)/100
  ));
  const y=pixel(1+layout.laneTop+Number(arrow.lane||0)*layout.lanePitch);
  return{x,y,width,x2:x+width,height:LOCKED_407F_GEOMETRY.arrowHeight};
}

function arrowDefinitions(arrows,layout,scale){
  return arrows.map((arrow,index)=>{
    const box=geometry(arrow,layout,scale);
    return`<clipPath id="d1406-arrow-${index}"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"/></clipPath>`;
  }).join("");
}

function arrowMarkup(arrow,index,layout,scale){
  const box=geometry(arrow,layout,scale);
  const style=presentation(arrow);
  const sprites=LOCKED_407F_ASSETS.arrows[style.slug];
  const start=formatMonth(arrow.startMonth);
  const end=arrow.openEnded?"Present":formatMonth(arrow.endMonth);
  const duration=monthIndex(arrow.endMonth)-monthIndex(arrow.startMonth)+1;
  const tight=layout.tight;
  const dateSize=tight?8.5:10;
  const dateY=box.y-(tight?3:7);
  const dates=duration>=6
    ?`<text x="${box.x}" y="${dateY}" fill="#D8E5F7" font-family="Rajdhani,Arial,sans-serif" font-size="${dateSize}" font-weight="700">${xml(start)}</text><text x="${box.x2-8}" y="${dateY}" text-anchor="end" fill="#D8E5F7" font-family="Rajdhani,Arial,sans-serif" font-size="${dateSize}" font-weight="700">${xml(end)}</text>`
    :`<text x="${box.x}" y="${dateY}" fill="#D8E5F7" font-family="Rajdhani,Arial,sans-serif" font-size="${dateSize}" font-weight="700">${xml(start)} - ${xml(end)}</text>`;
  const site=arrow.siteName&&!tight
    ?`<text x="${box.x-8}" y="${box.y+19}" text-anchor="end" fill="#D8E5F7" font-family="Rajdhani,Arial,sans-serif" font-size="10.5" font-weight="700">${xml(arrow.siteName)}</text>`
    :"";
  const tileWidth=72/36*box.height;
  const tiles=[];
  for(let x=box.x;x<box.x2;x+=tileWidth){
    tiles.push(`<image href="${xml(sprites.body)}" x="${x}" y="${box.y}" width="${tileWidth}" height="${box.height}" preserveAspectRatio="none"/>`);
  }
  const labelX=box.x+10+(box.width-28)/2;
  const lor=arrow.lorSubmitted
    ?`<g data-lor-submitted="true" transform="translate(${box.x2-38} ${box.y-10})"><path d="M0 0H20V22L10 16L0 22Z" fill="#F3E7B3" stroke="#8C6B20"/><text x="10" y="14" text-anchor="middle" fill="#6C5018" font-family="Arial" font-size="11" font-weight="800">★</text></g>`
    :"";
  const chip=arrow.actionChip
    ?`<g data-study-action-chip="${xml(arrow.actionChip.targetAttemptId||"")}" transform="translate(${box.x2-141} ${box.y+36})"><rect width="126" height="24" rx="12" fill="#B98A2E" stroke="#A67A26"/><text x="63" y="16" text-anchor="middle" fill="#191C21" font-family="Rajdhani,Arial,sans-serif" font-size="10" font-weight="700">${xml(arrow.actionChip.label||"Set retake date")}</text></g>`
    :"";
  return`<g data-event-kind="arrow" data-event-id="${xml(arrow.id)}" data-category="${xml(arrow.categoryId)}" aria-label="${xml(arrow.ariaLabel)}" filter="url(#d1406-arrow-shadow)"><g clip-path="url(#d1406-arrow-${index})">${tiles.join("")}</g><image href="${xml(sprites.cap)}" x="${box.x}" y="${box.y}" width="${LOCKED_407F_GEOMETRY.capWidth}" height="${box.height}" preserveAspectRatio="none"/><image href="${xml(sprites.head)}" x="${box.x2-LOCKED_407F_GEOMETRY.headWidth}" y="${box.y}" width="${LOCKED_407F_GEOMETRY.headWidth}" height="${box.height}" preserveAspectRatio="none"/>${dates}${site}<text x="${labelX}" y="${box.y+20}" text-anchor="middle" fill="#FFFFFF" font-family="Archivo,Arial,sans-serif" font-size="11" font-weight="600">${xml(arrow.title)}</text>${lor}${chip}</g>`;
}

function axisMarkup(scale){
  const years=[];
  for(let year=scale.firstYear;year<=scale.lastYear;year+=1)years.push(year);
  const x=boardX(2);
  const width=CONTENT_WIDTH*.96;
  const overlap=9;
  const segmentWidth=(width+overlap*(years.length-1))/years.length;
  const y=1+LOCKED_407F_GEOMETRY.axisTop;
  return`<g data-layer="axis" data-axis-language="407f-powerpoint">${years.map((year,index)=>{
    const sx=x+index*(segmentWidth-overlap);
    const path=`M${sx} ${y}H${sx+segmentWidth-12}L${sx+segmentWidth} ${y+17}L${sx+segmentWidth-12} ${y+34}H${sx}Z`;
    return`<g data-segment-kind="year"><path d="${path}" fill="url(#d1406-axis)"/><text x="${sx+segmentWidth/2-4}" y="${y+23}" text-anchor="middle" fill="#DBE6F8" font-family="Rajdhani,Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="1.2">${year}</text></g>`;
  }).join("")}<text x="${boardX(2.2)}" y="115" fill="#9FB0CD" font-family="Rajdhani,Arial,sans-serif" font-size="9" font-weight="700" letter-spacing="2.16">AXIS ${scale.firstYear}-${scale.lastYear} · CALIBRATED FROM YOUR DATES · JAN LEFT · DEC RIGHT</text></g>`;
}

function flagMarkup(flag,index,scale,{interview=false}={}){
  const x=boardX(scale.xPercent(flag.month));
  const y=1+(index%2===0?14:30);
  const source=flag.categoryId==="personal"
    ?LOCKED_407F_ASSETS.flagPersonal
    :LOCKED_407F_ASSETS.flagGray;
  const title=interview?"Interview":flag.title;
  return`<g data-event-kind="${interview?"interview-marker":"flag"}"${interview?"":` data-event-id="${xml(flag.id)}"`} aria-label="${xml(flag.ariaLabel)}"><text x="${x+12}" y="${y-2}" fill="#D8E5F7" font-family="Rajdhani,Arial,sans-serif" font-size="10" font-weight="700">${xml(title)}</text><image href="${xml(source)}" x="${x}" y="${y}" width="22" height="38"/><text x="${x-6}" y="${y+48}" fill="#D8E5F7" font-family="Rajdhani,Arial,sans-serif" font-size="9" font-weight="700">${xml(formatMonth(flag.month))}</text><line x1="${x+11}" y1="${y+38}" x2="${x+11}" y2="${y+78}" stroke="#55617E" stroke-width="2"/></g>`;
}

function colorKey(scene){
  const x=boardX(2.2),y=HEIGHT*.44;
  const rows=[...COLOR_KEY];
  if(scene?.lorLegend?.visible)rows.push([scene.lorLegend.label||"LOR submitted","#F3E7B3"]);
  return`<g data-artifact-chrome="color-key"><image href="${xml(LOCKED_407F_ASSETS.key)}" x="${x}" y="${y}" width="186" height="${rows.length>6?164:143}" preserveAspectRatio="none"/><image href="${xml(LOCKED_407F_ASSETS.pin)}" x="${x+83}" y="${y-11}" width="20" height="20"/><text x="${x+16}" y="${y+31}" fill="#A8402F" font-family="Archivo,Arial,sans-serif" font-size="11" font-weight="900">COLOR KEY</text>${rows.map(([label,color],index)=>`<rect x="${x+16}" y="${y+42+index*17}" width="15" height="11" rx="2" fill="${color}"/><text x="${x+39}" y="${y+52+index*17}" fill="#171D26" font-family="Archivo,Arial,sans-serif" font-size="10.5" font-weight="600">${xml(label)}</text>`).join("")}</g>`;
}

function profileMarkup(scene){
  const profile=scene?.profile||{};
  const x=boardX(2.2),y=897;
  const rows=[
    ["Medical school",profile.medicalSchool],
    ["Degree",profile.degree],
    ["Status",profile.status],
    ["Specialty",profile.specialty],
    ["Step 1",profile.step1],
    ["Step 2 CK",profile.step2]
  ].filter(([,value])=>String(value||"").trim());
  return`<g data-artifact-chrome="profile"><image href="${xml(LOCKED_407F_ASSETS.paper)}" x="${x}" y="${y}" width="240" height="166" preserveAspectRatio="none"/><text x="${x+18}" y="${y+30}" fill="#171D26" font-family="Archivo,Arial,sans-serif" font-size="12" font-weight="900">${xml(profile.fullName||"Your journey")}</text>${rows.slice(0,5).map(([label,value],index)=>`<text x="${x+18}" y="${y+52+index*18}" fill="#171D26" font-family="Archivo,Arial,sans-serif" font-size="10.5"><tspan font-weight="800">${xml(label)}: </tspan>${xml(value)}</text>`).join("")}<rect data-profile-photo-slot="true" x="${x+164}" y="${y+18}" width="56" height="62" fill="#C9C2AE" stroke="#FFFFFF" stroke-width="3"/><text x="${x+192}" y="${y+44}" text-anchor="middle" fill="#6D6753" font-family="Rajdhani,Arial,sans-serif" font-size="9" font-weight="700">PROFILE</text><text x="${x+192}" y="${y+56}" text-anchor="middle" fill="#6D6753" font-family="Rajdhani,Arial,sans-serif" font-size="9" font-weight="700">PHOTO</text></g>`;
}

function photoFrames(){
  return`<g data-artifact-chrome="photo-frames">${[0,1,2].map((index)=>{
    const x=812+index*102,rotation=index%2?2.5:-3;
    return`<g data-artifact-photo-frame="${index+1}" transform="rotate(${rotation} ${x+46} 1009)"><rect x="${x}" y="957" width="92" height="104" fill="#FDFBF4"/><rect x="${x+6}" y="963" width="80" height="76" fill="#28354B"/><text x="${x+46}" y="1003" text-anchor="middle" fill="#9FB0CD" font-family="Rajdhani,Arial,sans-serif" font-size="8.5" font-weight="700">DROP PHOTO ${index+1}</text></g>`;
  }).join("")}</g>`;
}

function interviewMarkup(scene,scale){
  const target=scene?.interviewTarget||{};
  const marker=scene?.interviewMarker;
  const x=1683,y=97,width=190;
  return`${marker?flagMarkup(marker,0,scale,{interview:true}):""}<g data-interview-destination="407f-ribbon"><rect x="${x}" y="${y}" width="${width}" height="52" fill="#FFFFFF" fill-opacity=".4" stroke="#26314D" stroke-opacity=".45" stroke-dasharray="4 3"/><text x="${x+width/2}" y="${y+30}" text-anchor="middle" fill="#4A5670" font-family="Rajdhani,Arial,sans-serif" font-size="9" font-weight="700" letter-spacing="1.8">${xml(String(target.programName||target.prog||"PROGRAM LOGO").toUpperCase())}</text><path d="M${x} 157H${x+width}L${x+width-10} 173L${x+width} 189H${x}L${x+10} 173Z" fill="#7E4BB6"/><text x="${x+width/2}" y="177" text-anchor="middle" fill="#FFFFFF" font-family="Archivo,Arial,sans-serif" font-size="12.5" font-weight="800">${xml(target.label||"YOUR BIG INTERVIEW")}</text><text x="${x+width/2}" y="207" text-anchor="middle" fill="#CFD9EC" font-family="Rajdhani,Arial,sans-serif" font-size="10.5" font-weight="700">${marker?`Interview · ${xml(formatMonth(marker.month))}`:"Date pending"}</text></g>`;
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
  const plaqueWidth=Math.max(280,Math.min(620,headline.length*11+116));
  const plaqueX=(WIDTH-plaqueWidth)/2;
  const typography=scene?.advancedProjection?.headlineTypography||{};
  const alignment=typography.alignment==="left"?"start":typography.alignment==="right"?"end":"middle";
  const headlineX=alignment==="start"?plaqueX+46:alignment==="end"?plaqueX+plaqueWidth-46:960;
  return`<g data-artifact-chrome="title"><image href="${xml(LOCKED_407F_ASSETS.plaque)}" x="${plaqueX}" y="15" width="${plaqueWidth}" height="47" preserveAspectRatio="none"/><text data-board-headline="true" x="${headlineX}" y="46" text-anchor="${alignment}" fill="${xml(typography.color||"#111827")}" font-family="${xml(typography.font||"Archivo")},Arial,sans-serif" font-size="${Number(typography.size)||19}" font-weight="${Number(typography.weight)||800}">Timeline: ${xml(headline)}</text></g>${colorKey(scene)}${profileMarkup(scene)}${photoFrames()}${interviewMarkup(scene,scale)}${(scene?.explanations||[]).map((explanation,index)=>explanationMarkup(scene,explanation,index,scale)).join("")}`;
}

function appendLayers(svg,layers=""){
  return layers?svg.replace("</svg>",`${layers}</svg>`):svg;
}

export function serializeLocked407FPortableSvg(scene,{layers=""}={}){
  const scale=metrics(scene);
  const layout=locked407FComposition(scene);
  const arrows=scene?.arrows||[];
  const flags=scene?.flags||[];
  const titleId="d1406-portable-title";
  const descriptionId="d1406-portable-description";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-labelledby="${titleId} ${descriptionId}" data-renderer="${xml(scene?.renderer)}" data-artifact-language="407f-powerpoint-keynote" data-export-projection="native-svg" data-locked-407f-source-sha256="${LOCKED_407F_SOURCE_SHA256}"><title id="${titleId}">${xml(scene?.accessibility?.ariaLabel)}</title><desc id="${descriptionId}">${xml(scene?.accessibility?.description)}</desc><defs>${background(scene)}<pattern id="d1406-axis" x="0" y="0" width="129.88" height="34" patternUnits="userSpaceOnUse"><image href="${xml(LOCKED_407F_ASSETS.axis)}" x="0" y="0" width="129.88" height="34" preserveAspectRatio="none"/></pattern><filter id="d1406-arrow-shadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#141E32" flood-opacity=".35"/></filter><marker id="d1406-red-arrowhead" markerWidth="10" markerHeight="14" refX="10" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 7L0 14Z" fill="#C73A25"/></marker>${arrowDefinitions(arrows,layout,scale)}</defs><rect data-board-background="true" x="1" y="1" width="1918" height="1078" fill="url(#d1406-board)" stroke="#31405C" stroke-width="2"/>${advancedBackgroundLayer(scene)}${axisMarkup(scale)}<g data-layer="events">${flags.map((flag,index)=>flagMarkup(flag,index,scale)).join("")}${arrows.map((arrow,index)=>arrowMarkup(arrow,index,layout,scale)).join("")}</g>${chrome(scene,scale)}</svg>`;
  return appendLayers(svg,layers);
}

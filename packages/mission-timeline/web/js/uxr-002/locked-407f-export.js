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
  locked407FComposition
} from "./locked-407f-artifact.js";
import {
  FOUNDER_COLOR_KEY_ROWS,
  FOUNDER_KEYNOTE_CONTRACT
} from "../presentation/founder-keynote-contract.js";
import {layoutExplanationText} from './explanation.js';

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
  /* AAA-019 Keynote fidelity — card boxes measured on the 2025 golden master
     (FOUNDER_KEYNOTE_2025_GOLDEN.001.png): the Color Key card is 283×311 with 40px rows and
     36×30 swatches, the profile card's corner brackets span (16,668)–(555,1066). */
  colorKey:Object.freeze({x:20,y:300,width:284,height:346}),
  profile:Object.freeze({x:13,y:661,width:545,height:410}),
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

function formatMonth(value,precision){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  if(match&&precision==='YEAR')return match[1];
  return match?`${MONTHS[Number(match[2])-1]} ${match[1]}`:"";
}

function formatFlagDate(value,precision){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  if(match&&precision==='YEAR')return match[1];
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
  if(arrow.categoryId==="work")return{slug:"work",color:rows.get("work")?.color||"#3F9B52"};
  if(arrow.categoryId==="education")return{slug:"education",color:rows.get("education")?.color||"#2C6E8F"};
  throw new TypeError(`Unsupported event category: ${String(arrow.categoryId)}`);
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
  if(id==="mission-navy"){
    return`<radialGradient id="d1406-board" cx=".5" cy=".3" r=".7071067811865476" gradientTransform="translate(.5 .3) scale(1 1.4) translate(-.5 -.3)"><stop offset="0" stop-color="#1B2A4A"/><stop offset="1" stop-color="#0E1730"/></radialGradient>`;
  }
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

function boardInk(scene){
  const token=String(scene?.theme?.ink||"");
  return /^#[0-9A-F]{6}$/i.test(token)?token:"#111827";
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

function personalBandSegments(scene){
  // Join only exact monthly adjacency. Gaps, concurrent periods, and manual
  // placement remain independent; no missing personal history is fabricated.
  const arrows=(scene?.arrows||[]).filter(arrow=>arrow.categoryId==="personal"&&!presentationEventObject(scene,arrow.id)?.geometry)
    .sort((a,b)=>monthIndex(a.startMonth)-monthIndex(b.startMonth)||String(a.id).localeCompare(String(b.id)));
  const result=new Map();let chain=[];
  const finish=()=>{if(chain.length>1)chain.forEach((arrow,index)=>result.set(arrow.id,{first:chain[0],index,count:chain.length,terminal:index===chain.length-1}));chain=[];};
  for(const arrow of arrows){if(chain.length&&monthIndex(arrow.startMonth)!==monthIndex(chain.at(-1).endMonth)+1)finish();chain.push(arrow);}
  finish();return result;
}

function geometry(arrow,layout,scale,scene){
  const overridden=presentationEventObject(scene,arrow.id)?.geometry;
  if(overridden){
    const x=pixel(overridden.x),y=pixel(overridden.y);
    const width=pixel(Math.max(1,overridden.width));
    return{x,y,width,x2:x+width,height:pixel(Math.max(1,overridden.height))};
  }
  const segment=personalBandSegments(scene).get(arrow.id);
  const x=pixel(boardX(scale.xPercent(arrow.startMonth)));
  const width=pixel(Math.max(LOCKED_407F_GEOMETRY.minimumArrowWidth,CONTENT_WIDTH*scale.widthPercent(arrow.startMonth,arrow.endMonth)/100));
  const y=pixel(1+layout.laneTop+Number(segment?.first.lane??arrow.lane??0)*layout.lanePitch);
  return{x,y,width,x2:x+width,height:LOCKED_407F_GEOMETRY.arrowHeight,personalSegment:segment};
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
  const rotation=Number(presentationEventObject(scene,arrow.id)?.geometry?.rotation)||0;
  const rotationAttribute=rotation?` transform="rotate(${rotation} ${box.x+box.width/2} ${box.y+box.height/2})"`:"";
  const style=presentation(arrow,scene);
  const start=formatMonth(arrow.startMonth);
  const end=arrow.openEnded?"Present":formatMonth(arrow.endMonth);
  const duration=monthIndex(arrow.endMonth)-monthIndex(arrow.startMonth)+1;
  const tight=layout.tight;
  const dateSize=tight?16:18;
  const dateY=box.y-(tight?4:7);
  /* AAA-019 Keynote fidelity (016 §3 "Duration arrows"): the golden writes one compact
     caption — "8/11 - 1/17" — centred immediately above the banner, never one date per end. */
  const compactStart=formatFlagDate(arrow.startMonth,arrow.datePrecision?.start);
  const compactEnd=arrow.openEnded?"Present":formatFlagDate(arrow.endMonth,arrow.datePrecision?.end);
  const caption=`${compactStart} - ${compactEnd}`;
  const captionX=Math.max(box.x+40,Math.min(WIDTH-40,box.x+box.width/2));
  const outsideInk=boardInk(scene);
  const dates=`<text data-arrow-caption="true" data-board-ink-role="caption" x="${captionX}" y="${dateY}" text-anchor="middle" fill="${outsideInk}" font-family="${TYPE.event}" font-size="${dateSize}">${xml(caption)}</text>`;
  void start;void end;void duration;
  const site=arrow.siteName&&!tight
    ?`<text data-board-ink-role="site" x="${box.x+box.width/2}" y="${box.y+51}" text-anchor="middle" fill="${outsideInk}" font-family="${TYPE.event}" font-size="18">${xml(arrow.siteName)}</text>`
    :"";
  const arrowHead=Math.min(24,Math.max(14,box.width*.14));
  const joined=box.personalSegment&&!box.personalSegment.terminal;
  const arrowPath=joined
    ?`M${box.x} ${box.y}H${box.x2}V${box.y+box.height}H${box.x}Z`
    :`M${box.x} ${box.y}H${box.x2-arrowHead}L${box.x2} ${box.y+box.height/2}L${box.x2-arrowHead} ${box.y+box.height}H${box.x}Z`;
  const separator=joined?`<path data-personal-band-separator="true" d="M${box.x2-9} ${box.y+1}L${box.x2} ${box.y+box.height/2}L${box.x2-9} ${box.y+box.height-1}" fill="none" stroke="#D9C8EA" stroke-width="1.5"/>`:"";
  const labelX=box.x+10+(box.width-28)/2;
  const title=String(arrow.title||'');
  const titleWidth=title.length*20*.57;
  const titleFits=titleWidth<=box.width-arrowHead-16;
  const leftRoom=Math.max(1,box.x-44),rightRoom=Math.max(1,WIDTH-box.x2-44);
  const outsideLeft=leftRoom>=titleWidth&&(rightRoom<titleWidth||box.x+box.width/2>WIDTH/2)||leftRoom>rightRoom&&rightRoom<titleWidth;
  const titleLines=titleFits?[title]:wrappedTextLines(title,outsideLeft?leftRoom:rightRoom,20,'wrap');
  const titleAnchor=titleFits?'middle':outsideLeft?'end':'start';
  const titleX=titleFits?labelX:outsideLeft?box.x-12:box.x2+12;
  const titleY=box.y+22-(titleLines.length-1)*11;
  // Short chronology bars retain their exact dates/width. Their full readable
  // label sits beside the bar instead of crushing glyphs into a few pixels.
  const titleColor=titleFits?String(arrow?.label?.color||"#FFFFFF"):outsideInk;
  const titleMarkup=`<text data-arrow-label-placement="${titleFits?'inside':outsideLeft?'outside-left':'outside-right'}" data-board-ink-role="${titleFits?'inside-arrow':'outside-arrow'}" x="${titleX}" y="${titleY}" text-anchor="${titleAnchor}" fill="${xml(titleColor)}" font-family="${TYPE.event}" font-size="20" font-weight="700">${titleLines.length===1?xml(title):titleLines.map((line,i)=>`<tspan x="${titleX}" dy="${i?22:0}">${xml(line)}</tspan>`).join('')}</text>`;
  const lor=arrow.lorSubmitted
    ?`<g data-lor-submitted="true" transform="translate(${box.x2-38} ${box.y-10})"><path d="M0 0H20V22L10 16L0 22Z" fill="#F3E7B3" stroke="#8C6B20"/><text x="10" y="14" text-anchor="middle" fill="#6C5018" font-family="Arial" font-size="11" font-weight="800">★</text></g>`
    :"";
  const chip=arrow.actionChip
    ?`<g data-study-action-chip="${xml(arrow.actionChip.targetAttemptId||"")}" transform="translate(${box.x2-141} ${box.y+36})"><rect width="126" height="24" rx="12" fill="#B98A2E" stroke="#A67A26"/><text x="63" y="16" text-anchor="middle" fill="#191C21" font-family="Rajdhani,Arial,sans-serif" font-size="10" font-weight="700">${xml(arrow.actionChip.label||"Set retake date")}</text></g>`
    :"";
  return`<g data-event-kind="arrow" data-event-id="${xml(arrow.id)}" data-category="${xml(arrow.categoryId)}"${box.personalSegment?` data-personal-band="${xml(box.personalSegment.first.id)}" data-personal-band-segment="${box.personalSegment.index}"`:""} aria-label="${xml(arrow.ariaLabel)}"${rotationAttribute} filter="url(#d1406-arrow-shadow)"><path data-continuous-duration-arrow="true" d="${arrowPath}" fill="url(#d1406-arrow-${index})" stroke="#17212B" stroke-width="1.5"/><path d="M${box.x+2} ${box.y+2}H${box.x2-arrowHead-2}" stroke="#FFFFFF" stroke-opacity=".46" stroke-width="1"/>${separator}${dates}${site}${titleMarkup}${lor}${chip}</g>`;
}

function axisMarkup(scale){
  const segments=scale.segments||[];
  const x=boardX(2);
  const width=CONTENT_WIDTH*.96;
  const y=FOUNDER_PORTABLE_GEOMETRY.axisTop;
  const height=FOUNDER_PORTABLE_GEOMETRY.axisHeight;
  const mid=y+height/2;
  /* AAA-019 Keynote fidelity (016 §3 "Year ribbon"): the 2025 golden is ONE continuous navy
     band that bleeds to both canvas edges, with chevron notches drawn BETWEEN year cells —
     not separated chevron segments with board showing through. The band is painted once
     (edge to edge, bevel highlight on top), the cells keep their ids/weights/hit targets, and
     the notch between two cells is a thin light chevron line. */
  const band=`<path data-axis-band="true" d="M0 ${y}H${WIDTH}V${y+height}H0Z" fill="url(#d1406-axis)"/><path d="M0 ${y+1.5}H${WIDTH}" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1.5"/><path d="M0 ${y+height-1}H${WIDTH}" stroke="#C1B98B" stroke-opacity=".9" stroke-width="1.2"/><path d="M0 ${y}H${WIDTH}" stroke="#C1B98B" stroke-opacity=".9" stroke-width="1.2"/>`;
  return`<g data-layer="axis" data-axis-language="407f-powerpoint" data-axis-ribbon="continuous">${band}${segments.map((segment,index)=>{
    const sx=index===0?0:x+width*((segment.startPercent-2)/96);
    const ex=index===segments.length-1?WIDTH:x+width*((segment.endPercent-2)/96);
    const segmentWidth=ex-sx;
    const kind=segment.id==="FUTURE"?"future":"year";
    const fontSize=segmentWidth<90?18:segmentWidth<150?22:26;
    const notch=index===0?"":`<path data-axis-notch="true" d="M${sx-11} ${y+1}L${sx} ${mid}L${sx-11} ${y+height-1}" fill="none" stroke="#DCE6F4" stroke-opacity=".85" stroke-width="2"/>`;
    /* A transparent cell rect keeps the per-year hit/drag geometry the axis handles use. */
    return`<g data-segment-kind="${kind}" data-axis-segment-id="${xml(segment.id)}" data-axis-segment-weight="${segment.weight}"><rect data-axis-cell="true" x="${sx}" y="${y}" width="${Math.max(1,segmentWidth)}" height="${height}" fill="transparent"/>${notch}<text x="${sx+segmentWidth/2+(index===0?0:4)}" y="${y+27}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.axis}" font-size="${fontSize}" font-weight="700">${xml(segment.label)}</text></g>`;
  }).join("")}<rect data-axis-hit-target="true" x="0" y="${y-8}" width="${WIDTH}" height="${height+16}" fill="transparent" pointer-events="all"/></g>`;
}

function milestoneGeometry(flag,index,scale,scene,{interview=false}={}){
  const object=interview?null:presentationEventObject(scene,flag.id);
  const overridden=object?.geometry;
  const rawX=overridden?pixel(overridden.x):boardX(scale.xPercent(flag.month));
  const study=!interview&&flag.categoryId==="exams"&&flag.examAttemptId
    ?(scene.arrows||[]).find(arrow=>arrow.study&&arrow.examAttemptId===flag.examAttemptId):null;
  const studyBox=study?geometry(study,founderPortableLayout(scene),scale,scene):null;
  return {object,overridden,x:overridden?rawX:Math.max(6,Math.min(WIDTH-60,rawX)),y:overridden?pixel(overridden.y):studyBox?studyBox.y-58:(index%2===0?58:65),width:overridden?Math.max(.25,Number(overridden.width)||50):50,height:overridden?Math.max(.25,Number(overridden.height)||64):64,rotation:overridden?Number(overridden.rotation)||0:0,defaultPoleBottom:studyBox?.y??FOUNDER_PORTABLE_GEOMETRY.axisTop};
}

export function locked407FMilestoneGeometry(scene,id){
  const index=(scene?.flags||[]).findIndex(flag=>String(flag.id)===String(id));
  if(index<0)return null;
  const {x,y,width,height,rotation,object}=milestoneGeometry(scene.flags[index],index,metrics(scene),scene);
  return {x,y,width,height,rotation,axisY:FOUNDER_PORTABLE_GEOMETRY.axisTop,object};
}

function flagMarkup(flag,index,scale,scene,{interview=false}={}){
  const placed=milestoneGeometry(flag,index,scale,scene,{interview});
  const {overridden,x,y}=placed;
  /* AAA-019 — a milestone in the last months used to plant its flag at the very edge and run
     its label off the board. The pole stays on the date; the label flips to the left of the
     flag when there is no room to its right. */
  const labelWidth=String((interview?"Interview":flag.title)||"").length*9.5+8;
  const flipLabel=!overridden&&x+56+labelWidth>WIDTH-8;
  const sx=placed.width/50,sy=placed.height/64,rotation=placed.rotation;
  const axisAnchored=!!overridden&&placed.object?.presentation?.guardianAnchor==='axis'&&rotation===0;
  const anchoredPoleBottom=axisAnchored?(FOUNDER_PORTABLE_GEOMETRY.axisTop-y)/sy:64;
  const transform=overridden
    ?` transform="translate(${x} ${y}) rotate(${rotation} 25 32) scale(${sx} ${sy})"`
    :"";
  const bx=overridden?0:x,by=overridden?0:y;
  const title=interview?"Interview":flag.title;
  const useUsFlag=!interview&&/relocat|moved|u\.?s\.?a|green\s*card|citizen|immigra/i.test(title);
  if(useUsFlag){
    const poleX=bx+4;
    const usaFlag=FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag;
    const ink=boardInk(scene);
    return`<g data-event-kind="flag" data-event-id="${xml(flag.id)}" data-founder-milestone-style="usa" aria-label="${xml(flag.ariaLabel)}"${transform}><line x1="${poleX}" y1="${by+2}" x2="${poleX}" y2="${overridden?anchoredPoleBottom:FOUNDER_PORTABLE_GEOMETRY.axisTop}" stroke="#A9AFB2" stroke-width="4"/><image data-founder-usa-flag-asset-sha256="${usaFlag.sha256}" href="${xml(founderKeynoteAssetUrl(usaFlag))}" x="${bx}" y="${by}" width="50" height="41" preserveAspectRatio="xMinYMin meet"/><text data-board-ink-role="flag-label" x="${bx+54}" y="${by+31}" fill="${ink}" font-family="${TYPE.event}" font-size="18">${xml(title)}</text><text data-board-ink-role="flag-date" x="${bx+54}" y="${by+52}" fill="${ink}" font-family="${TYPE.event}" font-size="18">${xml(formatMonth(flag.month,flag.datePrecision?.start))}</text></g>`;
  }
  /* AAA-019 Keynote fidelity (016 §3 "Milestone flags"): the golden milestone is a waving
     grey pennant planted on the ribbon with a white date chip inside and the label beside it —
     not the old 72×92 signpost sprite. Drawn as vector so it scales with export DPI. Personal
     milestones keep the purple family. The pole foot lands exactly on the ribbon's top edge. */
  const personal=flag.categoryId==="personal";
  const examResult=!interview&&flag.categoryId==="exams"?flag.examResult:null;
  const fill=examResult==="Failed"?"#C92113":examResult==="Passed"?"#379B43":personal?"#8A5BBF":"#A6AAAE";
  const edge=examResult==="Failed"?"#982018":examResult==="Passed"?"#267333":personal?"#5B3A86":"#6E7378";
  const light=examResult==="Failed"?"#F07A66":examResult==="Passed"?"#75C877":personal?"#B08BD9":"#C9CDD1";
  const poleX=bx+4;
  const poleBottom=overridden?anchoredPoleBottom:placed.defaultPoleBottom;
  const pennant=`<path d="M${poleX} ${by+2}C${poleX+16} ${by-4},${poleX+34} ${by+8},${poleX+52} ${by+2}L${poleX+52} ${by+36}C${poleX+36} ${by+42},${poleX+18} ${by+30},${poleX} ${by+36}Z" fill="${fill}" stroke="${edge}" stroke-width="1.2"/><path d="M${poleX+2} ${by+4}C${poleX+16} ${by-1},${poleX+34} ${by+10},${poleX+50} ${by+5}" stroke="${light}" stroke-opacity=".8" stroke-width="1"/>`;
  const chip=`<rect x="${poleX+8}" y="${by+10}" width="36" height="18" rx="3" fill="#FFFFFF" fill-opacity=".92"/><text x="${poleX+26}" y="${by+23}" text-anchor="middle" fill="#3B4048" font-family="${TYPE.event}" font-size="13">${xml(formatFlagDate(flag.month,flag.datePrecision?.start))}</text>`;
  const labelX=flipLabel?poleX-8:poleX+60;
  const words=String(title||"").split(/\s+/).filter(Boolean);
  const lines=words.length>2&&String(title||"").length>16?[words.slice(0,Math.ceil(words.length/2)).join(" "),words.slice(Math.ceil(words.length/2)).join(" ")]:[String(title||"")];
  const resultPrivacy=flag.presentationRedactions?.includes('EXAM_RESULT_PRIVATE')?' data-exam-result-private="true"':'';
  const label=lines.map((line,lineIndex)=>`<text${resultPrivacy} data-board-ink-role="flag-label" x="${labelX}" y="${by+22+lineIndex*21}"${flipLabel?' text-anchor="end"':""} fill="${boardInk(scene)}" font-family="${TYPE.event}" font-size="18">${xml(line)}</text>`).join("");
  return`<g data-event-kind="${interview?"interview-marker":"flag"}"${interview?"":` data-event-id="${xml(flag.id)}"`} data-founder-milestone-style="pennant"${examResult?` data-exam-result="${examResult}"`:""} aria-label="${xml(flag.ariaLabel)}"${transform}><line x1="${poleX}" y1="${by}" x2="${poleX}" y2="${poleBottom}" stroke="#8E9398" stroke-width="3"/><circle cx="${poleX}" cy="${by}" r="2.5" fill="#B9BDC1"/>${pennant}${chip}${label}</g>`;
}

function colorKey(scene){
  const geometry=scene?.founderPresentation?.colorKeyGeometry||FOUNDER_PORTABLE_GEOMETRY.colorKey;
  const {x,y,width,height}=geometry;
  const rows=[...(scene?.founderPresentation?.categoryKey||FOUNDER_COLOR_KEY_ROWS)];
  if(scene?.lorLegend?.visible)rows.push({id:"lor-submitted",label:scene.lorLegend.label||"LOR submitted",color:"#F3E7B3"});
  /* Golden card metrics (base 284×346, card paper starts 35px down under the pin):
     header "COLOR KEY" 18px red with an underline, rows on a 40px pitch, 36×30 swatches with
     a dark hairline, 18px labels. Supplemental Education and LOR rows stay inside
     the same paper bounds; the six-row default keeps its original metrics. */
  const rowPitch=rows.length>7?32:rows.length>6?36:40;
  const base=FOUNDER_PORTABLE_GEOMETRY.colorKey;
  const sx=width/base.width,sy=height/base.height;
  const cardTop=35,left=20,swatchWidth=36,swatchHeight=rows.length>7?26:30,firstRow=cardTop+41;
  return`<g data-artifact-chrome="color-key" data-canonical-row-count="6" data-founder-geometry="${x},${y},${width},${height}" transform="translate(${x} ${y}) scale(${sx} ${sy})"><image href="${xml(LOCKED_407F_ASSETS.key)}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/><image href="${xml(LOCKED_407F_ASSETS.pin)}" x="${base.width/2-14}" y="-12" width="28" height="28"/><text x="${left}" y="${cardTop+26}" fill="#A8402F" font-family="${TYPE.key}" font-size="18" font-weight="700">COLOR KEY</text><path d="M${left} ${cardTop+31}H${left+100}" stroke="#A8402F" stroke-width="1.2"/>${rows.map(({id,label,color},index)=>{const fit=String(label).length>19?' textLength="190" lengthAdjust="spacingAndGlyphs"':"";const top=firstRow+index*rowPitch;return`<g data-color-key-row="${index}" data-category-id="${xml(id)}"><rect x="${left}" y="${top}" width="${swatchWidth}" height="${swatchHeight}" rx="2" fill="${color}" stroke="#2B2B2B" stroke-width="1"/><text x="${left+swatchWidth+12}" y="${top+21}" fill="#171D26" font-family="${TYPE.key}" font-size="18" font-weight="500"${fit}>${xml(label)}</text></g>`;}).join("")}</g>`;
}

/* AAA-019 — crop rendered in SVG. The stored crop model ({x,y} pan 0–100, zoom 1–4) used
   to be honoured only by the 2D raster path, so on screen and in the SVG export every
   crop collapsed to "cover". A nested <svg> whose viewBox is the zoomed/panned window of
   the cover-fitted image gives the same pixels in the live board, the PNG and the PDF. */
function croppedImageMarkup({href,x,y,width,height,crop=null,fit="cover",naturalAspect=null,attributes=""}={}){
  const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
  if(fit==="contain"){
    return`<image ${attributes} href="${xml(href)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const zoom=Math.min(4,Math.max(1,Number(crop?.zoom)||1));
  const px=Math.min(100,Math.max(0,Number(crop?.x??50)))/100;
  const py=Math.min(100,Math.max(0,Number(crop?.y??50)))/100;
  /* Cover-fit the picture at zoom 1 using its real aspect when known, so the overflow
     beyond the frame is pannable exactly like Canva; unknown aspect falls back to a
     frame-shaped box that the browser slices. */
  const aspect=Number(naturalAspect);
  const known=Number.isFinite(aspect)&&aspect>0;
  const imageWidth=known?Math.max(w,h*aspect):w;
  const imageHeight=known?Math.max(h,w/aspect):h;
  const vw=w/zoom,vh=h/zoom,vx=(imageWidth-vw)*px,vy=(imageHeight-vh)*py;
  return`<svg ${attributes} x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid slice" data-crop-zoom="${zoom}" data-crop-x="${Math.round(px*100)}" data-crop-y="${Math.round(py*100)}" data-crop-image-width="${imageWidth}" data-crop-image-height="${imageHeight}"><image href="${xml(href)}" x="0" y="0" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="${known?"none":"xMidYMid slice"}"/></svg>`;
}

function profileMarkup(scene){
  const profile=scene?.profile||{};
  const photo=scene?.mediaProjection?.profilePhoto;
  const geometry=scene?.founderPresentation?.profileGeometry||FOUNDER_PORTABLE_GEOMETRY.profile;
  const {x,y,width,height}=geometry;
  const base=FOUNDER_PORTABLE_GEOMETRY.profile;
  const sx=width/base.width,sy=height/base.height;
  /* Golden card content model: bold label / roman value pairs, one per line. The student's
     own numbers only — USCE and research months are derived from their events. */
  const months=(value)=>Number(value)>0?`${Number(value)} month${Number(value)===1?"":"s"}`:"";
  const rows=[
    ["Medical school",profile.medicalSchool],
    ["Degree",profile.degree],
    ["Visa status",profile.status],
    ["Specialty",profile.specialty],
    ["Step 1",profile.step1],
    ["Step 2 CK",profile.step2],
    ["Step 3",profile.step3],
    ["USCE",months(profile.usceMonths)],
    ["Research",months(profile.researchMonths)]
  ].filter(([,value])=>String(value||"").trim());
  const photoX=351,photoY=20,photoWidth=169,photoHeight=170;
  const wrappedRows=rows.slice(0,9).map(([label,value])=>({label,lines:wrappedTextLines(`${label}: ${value}`,296,17,'wrap')}));
  const totalLines=wrappedRows.reduce((count,row)=>count+row.lines.length,0);
  const rowGap=Math.max(4,Math.min(12,(base.height-20-94-(totalLines-1)*22)/Math.max(1,wrappedRows.length-1)));
  let rowY=94;
  const rowMarkup=wrappedRows.map(({label,lines})=>{
    const markup=lines.map((line,index)=>{
      const prefix=`${label}: `;
      const contents=index===0&&line.startsWith(prefix)?`<tspan font-weight="700">${xml(prefix)}</tspan>${xml(line.slice(prefix.length))}`:xml(line);
      return`<text data-profile-field="${xml(label)}" data-profile-line="${index}" x="34" y="${rowY+index*22}" fill="#171D26" font-family="${TYPE.profile}" font-size="17">${contents}</text>`;
    }).join('');
    rowY+=lines.length*22+rowGap;
    return markup;
  }).join('');
  const photoLayer=photo
    ?`<g data-frame-slot="profile" data-media-state="filled" data-media-id="${xml(photo.id)}"><rect x="${photoX}" y="${photoY}" width="${photoWidth}" height="${photoHeight}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="7"/>${croppedImageMarkup({href:photo.source,x:photoX,y:photoY,width:photoWidth,height:photoHeight,crop:photo.crop,naturalAspect:photo.naturalAspect,attributes:`data-profile-photo-slot="true" data-media-id="${xml(photo.id)}"`})}</g>`
    :`<g data-frame-slot="profile" data-media-state="empty"><rect data-profile-photo-slot="true" data-media-state="empty" x="${photoX}" y="${photoY}" width="${photoWidth}" height="${photoHeight}" fill="#C9C2AE" stroke="#FFFFFF" stroke-width="7"/><text x="${photoX+photoWidth/2}" y="${photoY+photoHeight/2+7}" text-anchor="middle" fill="#6D6753" font-family="${TYPE.profile}" font-size="17" font-weight="700" pointer-events="none">PROFILE PHOTO</text></g>`;
  return`<g data-artifact-chrome="profile" data-founder-geometry="${x},${y},${width},${height}" transform="translate(${x} ${y}) scale(${sx} ${sy})"><image href="${xml(LOCKED_407F_ASSETS.paper)}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/><text x="34" y="54" fill="#171D26" font-family="${TYPE.profile}" font-size="22" font-weight="700">${xml(profile.fullName||"Your journey")}</text>${rowMarkup}${photoLayer}</g>`;
}

export function photoFrameGeometry(scene,index){
  const base=FOUNDER_PORTABLE_GEOMETRY.photos[index];
  const override=scene?.founderPresentation?.photoFrames?.[String(index+1)];
  if(!override||typeof override!=="object")return{...base};
  const finiteOr=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const width=Math.min(1920,Math.max(60,finiteOr(override.width,base.width)));
  const height=Math.min(1080,Math.max(60,finiteOr(override.height,base.height)));
  return{
    x:Math.min(1920-width,Math.max(0,finiteOr(override.x,base.x))),
    y:Math.min(1080-height,Math.max(0,finiteOr(override.y,base.y))),
    width,height,
    rotation:Math.max(-45,Math.min(45,finiteOr(override.rotation,base.rotation)))
  };
}

function photoFrames(scene){
  const photos=scene?.mediaProjection?.photos||[];
  /* A photo addressed to a frame slot (photo1–photo3) wins that frame; every other photo
     (legacy 0-based placements, unslotted items) fills the remaining frames in order. */
  const exact=new Map();
  for(const photo of photos){
    const slot=String(photo.slot||"");
    if(/^photo[123]$/.test(slot)&&!exact.has(slot))exact.set(slot,photo);
  }
  const rest=photos.filter((photo)=>exact.get(String(photo.slot||""))!==photo);
  return`<g data-artifact-chrome="photo-frames">${FOUNDER_PORTABLE_GEOMETRY.photos.map((_,index)=>{
    const {x,y,width,height,rotation}=photoFrameGeometry(scene,index);
    const slot=`photo${index+1}`;
    const photo=exact.get(slot)||rest.shift()||null;
    const content=photo
      ?croppedImageMarkup({href:photo.source,x:x+9,y:y+9,width:width-18,height:height-31,crop:photo.crop,naturalAspect:photo.naturalAspect,attributes:`data-media-id="${xml(photo.id)}"`})
      :`<rect data-media-state="empty" x="${x+9}" y="${y+9}" width="${width-18}" height="${height-31}" fill="#D6D8D5"/><text x="${x+width/2}" y="${y+height/2}" text-anchor="middle" fill="#515B62" font-family="${TYPE.event}" font-size="18" pointer-events="none">DROP PHOTO ${index+1}</text>`;
    return`<g data-artifact-photo-frame="${index+1}" data-frame-slot="${slot}" data-media-state="${photo?"filled":"empty"}"${photo?` data-media-id="${xml(photo.id)}"`:""} data-founder-geometry="${x},${y},${width},${height},${rotation}" transform="rotate(${rotation} ${x+width/2} ${y+height/2})"><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#FDFBF4"/>${content}</g>`;
  }).join("")}</g>`;
}

function interviewMarkup(scene,scale){
  const target=scene?.interviewTarget||{};
  const marker=scene?.interviewMarker;
  const logo=scene?.mediaProjection?.logo;
  const {x,y,width}=FOUNDER_PORTABLE_GEOMETRY.interview;
  const logoLayer=logo
    ?`<g data-frame-slot="logo" data-media-state="filled" data-media-id="${xml(logo.id)}"><image data-program-logo="true" data-media-id="${xml(logo.id)}" href="${xml(logo.source)}" x="${x+8}" y="${y+5}" width="${width-16}" height="42" preserveAspectRatio="xMidYMid meet"/></g>`
    :`<g data-frame-slot="logo" data-media-state="empty"><rect x="${x}" y="${y}" width="${width}" height="52" fill="transparent"/><text x="${x+width/2}" y="${y+31}" text-anchor="middle" fill="#4A5670" font-family="${TYPE.axis}" font-size="16" font-weight="700" pointer-events="none">${xml(String(target.programName||target.prog||"PROGRAM LOGO").toUpperCase())}</text></g>`;
  const ribbonY=y+62;
  return`${marker?flagMarkup(marker,0,scale,scene,{interview:true}):""}<g data-interview-destination="407f-ribbon"><rect x="${x}" y="${y}" width="${width}" height="52" fill="#FFFFFF" fill-opacity=".4" stroke="#26314D" stroke-opacity=".45" stroke-dasharray="4 3"/>${logoLayer}<path d="M${x} ${ribbonY}H${x+width}L${x+width-10} ${ribbonY+18}L${x+width} ${ribbonY+36}H${x}L${x+10} ${ribbonY+18}Z" fill="#7E4BB6"/><text x="${x+width/2}" y="${ribbonY+25}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.title}" font-size="18" font-weight="700">${xml(target.label||"YOUR BIG INTERVIEW")}</text><text data-board-ink-role="interview-date" x="${x+width/2}" y="${ribbonY+58}" text-anchor="middle" fill="${boardInk(scene)}" font-family="${TYPE.event}" font-size="18">${marker?`Interview · ${xml(formatMonth(marker.month))}`:"Date pending"}</text></g>`;
}

function explanationMarkup(scene,explanation,index,scale){
  const override=presentationEventObject(scene,explanation.id)?.geometry;
  const rotation=Number(override?.rotation??explanation.rotation??8);
  const {x,y,width,height,fontSize,lines}=layoutExplanationText(explanation.text,{
    x:override?.x??explanation.x,y:override?.y??explanation.y,
    width:override?.width??explanation.width,height:override?.height??explanation.height,rotation
  });
  const cx=x+width/2,cy=y+height/2;
  const layout=founderPortableLayout(scene),targetId=String(explanation.target?.eventId||"");
  const arrow=(scene.arrows||[]).find(item=>String(item.id)===targetId);
  const flagIndex=(scene.flags||[]).findIndex(item=>String(item.id)===targetId);
  const target=arrow?geometry(arrow,layout,scale,scene):flagIndex>=0?milestoneGeometry(scene.flags[flagIndex],flagIndex,scale,scene):{x:Number(explanation.target?.x)||960,y:Number(explanation.target?.y)||125,width:1,height:1};
  const tx=target.x+target.width/2,ty=target.y+target.height/2;
  const boundary=(box,toward)=>{const center={x:box.x+box.width/2,y:box.y+box.height/2};const dx=toward.x-center.x,dy=toward.y-center.y;const ratio=1/Math.max(Math.abs(dx)/(box.width/2),Math.abs(dy)/(box.height/2),1);return{x:center.x+dx*ratio,y:center.y+dy*ratio};};
  const angle=rotation*Math.PI/180;
  const rotate=(point,origin,theta)=>({x:origin.x+(point.x-origin.x)*Math.cos(theta)-(point.y-origin.y)*Math.sin(theta),y:origin.y+(point.x-origin.x)*Math.sin(theta)+(point.y-origin.y)*Math.cos(theta)});
  const source=rotate(boundary({x,y,width,height},rotate({x:tx,y:ty},{x:cx,y:cy},-angle)),{x:cx,y:cy},angle);
  const endpoint=boundary(target,source),dx=endpoint.x-source.x,dy=endpoint.y-source.y,distance=Math.hypot(dx,dy);
  const ux=distance?dx/distance:0,uy=distance?dy/distance:0;
  const pointer=explanation.leaderEnabled&&distance>8?`<path data-explanation-leader="true" data-target-event-id="${xml(targetId)}" d="M${source.x} ${source.y}L${endpoint.x} ${endpoint.y}" fill="none" stroke="#C73A25" stroke-width="4"/><path data-explanation-arrowhead="true" d="M${endpoint.x-ux*15-uy*7} ${endpoint.y-uy*15+ux*7}L${endpoint.x} ${endpoint.y}L${endpoint.x-ux*15+uy*7} ${endpoint.y-uy*15-ux*7}" fill="none" stroke="#C73A25" stroke-width="4"/>`:"";
  const text=lines.map((line,i)=>`<text data-explanation-text="true" x="${x+14}" y="${y+14+fontSize+i*fontSize*1.12}" fill="#29220D" font-family="${TYPE.event}" font-size="${fontSize}">${xml(line)}</text>`).join("");
  return`<g data-event-kind="explanation" data-event-id="${xml(explanation.id)}" data-founder-note="editable-yellow-sticky" aria-label="${xml(explanation.ariaLabel)}">${pointer}<g transform="rotate(${rotation} ${cx} ${cy})"><rect data-explanation-card="true" x="${x}" y="${y}" width="${width}" height="${height}" fill="#FFF1A0" stroke="#DBC878" stroke-width=".6" filter="url(#d1406-arrow-shadow)"/>${text}</g></g>`;
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
    case"rectangle":return`<rect width="${width}" height="${height}" ${common}/>${item.label?`<text x="${width/2}" y="${height*.62}" text-anchor="middle" fill="#fff" font-family="Inter" font-size="${Math.min(width,height)*.36}" font-weight="700">${xml(item.label)}</text>`:""}`;
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

/* AAA-019 — the asset rail shows the real shape the tile inserts (Canva shows a true
   preview, not a glyph). Same geometry code as the board, so what you see is what lands. */
export function advancedElementPreviewMarkup(kind,{width=120,height=80,fill="#2C6E8F",stroke="#17324A",label=""}={}){
  const body=advancedElementBody({
    id:"preview",
    geometry:{width,height},
    presentation:{kind:String(kind||""),fill,stroke,label}
  });
  return`<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
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
      return`<g ${shared}>${croppedImageMarkup({href:item.resolvedSource,x:0,y:0,width:Math.max(1,Number(box.width)||1),height:Math.max(1,Number(box.height)||1),crop:item.crop,fit:item.fit==="contain"?"contain":"cover",naturalAspect:item.naturalAspect,attributes:`data-advanced-media="${xml(object.id)}"`})}</g>`;
    }
    if(object.type==="text")return`<g ${shared}>${advancedTextMarkup(object)}</g>`;
    return`<g ${shared} data-advanced-element="${xml(object.id)}" data-advanced-kind="${xml(item.kind||"")}">${advancedElementBody(object)}</g>`;
  }).join("")}</g>`;
}

function appendLayers(svg,layers=""){
  /* Cropped images are nested <svg> viewports, so the layers must go before the
     LAST closing tag — the outer board — never the first one the string contains. */
  if(!layers)return svg;
  const index=svg.lastIndexOf("</svg>");
  return index<0?svg+layers:`${svg.slice(0,index)}${layers}${svg.slice(index)}`;
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
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-labelledby="${titleId} ${descriptionId}" data-renderer="${xml(scene?.renderer)}" data-artifact-language="407f-powerpoint-keynote" data-export-projection="native-svg" data-locked-407f-source-sha256="${LOCKED_407F_SOURCE_SHA256}"><title id="${titleId}">${xml(scene?.accessibility?.ariaLabel)}</title><desc id="${descriptionId}">${xml(scene?.accessibility?.description)}</desc><defs>${background(scene)}<linearGradient id="d1406-axis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F4A78"/><stop offset=".16" stop-color="#22395F"/><stop offset=".7" stop-color="#182B4C"/><stop offset="1" stop-color="#101F3A"/></linearGradient><filter id="d1406-arrow-shadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#141E32" flood-opacity=".48"/></filter><marker id="d1406-red-arrowhead" markerWidth="10" markerHeight="14" refX="10" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 7L0 14Z" fill="#C73A25"/></marker>${arrowDefinitions(arrows,layout,scale,scene)}</defs><rect data-board-background="true" data-founder-board-source="${xml(board.sourcePath)}" data-founder-board-asset-sha256="${board.sha256}" x="0" y="0" width="1920" height="1080" fill="url(#d1406-board)"/>${advancedBackgroundLayer(scene)}${axisMarkup(scale)}<g data-layer="events">${flags.map((flag,index)=>flagMarkup(flag,index,scale,scene)).join("")}${arrows.map((arrow,index)=>arrowMarkup(arrow,index,layout,scale,scene)).join("")}</g>${chrome(scene,scale)}</svg>`;
  return namespacePortableSvgResources(
    appendLayers(svg,`${advancedSceneMarkup(scene)}${layers}`),
    resourceNamespace
  );
}

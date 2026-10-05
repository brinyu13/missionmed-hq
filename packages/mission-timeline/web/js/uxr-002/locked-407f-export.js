import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../presentation/resolved-founder-presentation.js';
import {presentationDateWording} from '../presentation/source-date-wording.js';
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
import {fitPresentationText,wrapPresentationText,measurePresentationText} from '../presentation/text-layout.js';

const WIDTH=LOCKED_407F_GEOMETRY.width;
const HEIGHT=LOCKED_407F_GEOMETRY.height;
const CONTENT_WIDTH=WIDTH-2;
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TYPE=Object.freeze({
  title:"'American Typewriter',Rockwell,'Courier New',serif",
  axis:"Futura,'Trebuchet MS',Arial,sans-serif",
  key:"Futura,'Trebuchet MS',Arial,sans-serif",
  profile:"'American Typewriter',Rockwell,'Courier New',serif",
  arrowLabel:"'American Typewriter',Rockwell,'Courier New',serif",
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
    Object.freeze({x:607.4708862304688,y:782.659423828125,width:195.9185791015625,height:260.55804443359375,rotation:10}),
    Object.freeze({x:749.3143310546875,y:888.0833740234375,width:243.38780212402344,height:166.1234588623047,rotation:6}),
    Object.freeze({x:981.880615234375,y:870.6946411132812,width:253.4744873046875,height:200.90078735351562,rotation:0})
  ]),
  interview:Object.freeze({x:1666,y:238,width:220,height:136})
});
// Opaque paper and photo aperture measured within each original frame image.
// The raw box includes transparent shadow padding, so these are separate layers.
const FOUNDER_PHOTO_PIXELS=Object.freeze([
  Object.freeze({width:408,height:543,paper:[9,1,400,515],aperture:[23,16,385,501]}),
  Object.freeze({width:507,height:347,paper:[9,1,498,317],aperture:[23,16,483,303]}),
  Object.freeze({width:528,height:419,paper:[9,1,519,390],aperture:[23,16,504,376]})
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
  const firstYear=(months.length
    ?Math.floor(Math.min(...months)/12)
    :Number(scene?.span?.firstYear)||new Date().getUTCFullYear())-(scene.autoAxisPadding?.before||0);
  const lastCandidate=months.length
    ?Math.floor(Math.max(...months)/12)
    :Number(scene?.span?.lastYear)||firstYear+1;
  const lastYear=Math.max(firstYear,lastCandidate)+(scene.autoAxisPadding?.after||0);
  if(scene.autoYearWeights){
    const segments=[];let total=0;
    for(let year=firstYear;year<=lastYear;year++){const weight=scene.autoYearWeights.get(year)||1;segments.push({id:String(year),label:String(year),weight});total+=weight;}
    // Preserve enough cell width for the unchanged 23px year typography and notch.
    const readableWidth=Math.max(...segments.map(segment=>(scene.measureText||measurePresentationText)(segment.label,23,TYPE.axis,700)))+20; // native 11px notch, 4px text offset and painted clearance
    const minPercent=Math.min(96/segments.length,readableWidth/CONTENT_WIDTH*100);
    const flexible=96-minPercent*segments.length;
    let cursor=2;
    for(const segment of segments){segment.startPercent=cursor;cursor+=minPercent+flexible*segment.weight/total;segment.endPercent=cursor;segment.weight=(segment.endPercent-segment.startPercent)*total/96;}
    const byYear=new Map(segments.map(s=>[Number(s.id),s]));
    const at=(month,after=0)=>{const index=monthIndex(month)+after,year=Math.floor(index/12),within=((index%12)+12)%12,s=byYear.get(year);return s?s.startPercent+(s.endPercent-s.startPercent)*within/12:year<firstYear?2:98;};
    return{firstYear,lastYear,segments,xPercent:month=>at(month),widthPercent:(start,end)=>Math.max(0,at(end,1)-at(start))};
  }
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
  if(arrow.categoryId==="exams")return{slug:"usmle",color:rows.get("exams")?.color||"#0565C0"};
  if(arrow.categoryId==="clinical"){
    return /clinic|ambulatory|outpatient/i.test(arrow.siteName)
      ?{slug:"cl",color:rows.get("clinical-clinic")?.color||"#F49018"}
      :{slug:"th",color:rows.get("clinical-hospital")?.color||"#DF6A0F"};
  }
  if(arrow.categoryId==="personal")return{slug:"personal",color:rows.get("personal")?.color||"#763F9B"};
  if(arrow.categoryId==="research")return{slug:"res",color:rows.get("research")?.color||"#DCBE23"};
  if(arrow.categoryId==="work")return{slug:"work",color:rows.get("work")?.color||"#00882B"};
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
  const arrows=(scene?.arrows||[]).filter(arrow=>arrow.categoryId==="personal"&&!presentationEventObject(scene,arrow.id)?.geometry&&!arrow.manualOffset?.laneLocked&&!Number(arrow.manualOffset?.x)&&!Number(arrow.manualOffset?.y))
    .sort((a,b)=>monthIndex(a.startMonth)-monthIndex(b.startMonth)||String(a.id).localeCompare(String(b.id)));
  const result=new Map();let chain=[];
  const finish=()=>{if(chain.length>1)chain.forEach((arrow,index)=>result.set(arrow.id,{first:chain[0],index,count:chain.length,terminal:index===chain.length-1}));chain=[];};
  for(const arrow of arrows){if(chain.length&&monthIndex(arrow.startMonth)!==monthIndex(chain.at(-1).endMonth)+1)finish();chain.push(arrow);}
  finish();return result;
}

// Only retained critic ownership grants date reflow. Human, grouped, locked
// and unmarked legacy geometry remains an exact authored placement.
function automaticDateAnchor(scene,event){
  const object=presentationEventObject(scene,event.id),source=(scene.events||[]).find(item=>String(item.id)===String(event.id))||event;
  const nativeBand=(scene.flags||[]).some(flag=>String(flag.id)===String(event.id))
    ?Number(object?.geometry?.y)>=2.5&&Number(object?.geometry?.y)<=87.75
    :Number(object?.geometry?.y)>=181;
  return !!(nativeBand&&object?.geometry&&object.presentation?.localLayoutCriticAuto===true&&
    !scene.automaticDateAnchorsLocked&&!object.locked&&!object.groupId&&Math.abs(Number(object.geometry.rotation)||0)<1e-6&&
    !(scene.founderPresentation?.advancedScene?.groups||[]).some(group=>group.locked&&group.childIds?.includes(object.id))&&
    !source.manualOffset?.laneLocked&&!Number(source.manualOffset?.x)&&!Number(source.manualOffset?.y));
}

function geometry(arrow,layout,scale,scene){
  const overridden=presentationEventObject(scene,arrow.id)?.geometry||scene.autoArrowGeometry?.get(String(arrow.id));
  if(overridden){
    const dated=scene.founderPresentation?.axis?.mode!=='manual'&&automaticDateAnchor(scene,arrow);
    const resolved=automaticDateAnchor(scene,arrow)?scene.autoArrowGeometry?.get(String(arrow.id)):null;
    const x=pixel(dated?boardX(scale.xPercent(arrow.startMonth)):overridden.x),y=pixel(resolved?.y??overridden.y);
    const width=pixel(dated?Math.max(LOCKED_407F_GEOMETRY.minimumArrowWidth,CONTENT_WIDTH*scale.widthPercent(arrow.startMonth,arrow.endMonth)/100):Math.max(1,overridden.width));
    return{x,y,width,x2:x+width,height:pixel(Math.max(1,overridden.height)),...(overridden.personalSegment?{personalSegment:overridden.personalSegment}:{})};
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
  const dateSize=18;
  const dateY=box.y-(tight?4:7);
  /* AAA-019 Keynote fidelity (016 §3 "Duration arrows"): the golden writes one compact
     caption — "8/11 - 1/17" — centred immediately above the banner, never one date per end. */
  const compactStart=presentationDateWording(arrow.startMonth,arrow.datePrecision?.start,arrow.sourceDateWording?.start);
  const compactEnd=arrow.openEnded?"Present":presentationDateWording(arrow.endMonth,arrow.datePrecision?.end,arrow.sourceDateWording?.end);
  const caption=`${compactStart} - ${compactEnd}`;
  const captionX=Math.max(box.x+40,Math.min(WIDTH-40,box.x+box.width/2));
  const outsideInk=boardInk(scene);
  const dates=`<text data-arrow-caption="true" data-board-ink-role="caption" x="${captionX}" y="${dateY}" text-anchor="middle" fill="${outsideInk}" font-family="${TYPE.event}" font-size="${dateSize}">${xml(caption)}</text>`;
  void start;void end;void duration;
  const siteWidth=Math.min(500,Math.max(1,(scene.measureText||measurePresentationText)(String(arrow.siteName||""),19,TYPE.event)+4));
  const siteCenter=Math.max(24+siteWidth/2,Math.min(WIDTH-24-siteWidth/2,box.x+box.width/2));
  const siteLines=arrow.siteName?wrapPresentationText(arrow.siteName,{width:Math.max(1,siteWidth),size:19,family:TYPE.event,measureText:scene.measureText||measurePresentationText}):[];
  const siteX=(siteLines.length>1?Math.min(WIDTH-24-siteWidth,Math.max(24,box.x)):siteCenter)+(scene.autoSiteOffsets?.get(String(arrow.id))||0);
  const siteAnchor=siteLines.length>1?"start":"middle";
  const site=siteLines.length
    ?`<text data-board-ink-role="site" data-material-field="siteName" x="${siteX}" y="${box.y+51}" text-anchor="${siteAnchor}" fill="${outsideInk}" font-family="${TYPE.event}" font-size="19">${siteLines.map((line,i)=>`<tspan x="${siteX}" dy="${i?21:0}">${xml(line)}</tspan>`).join('')}</text>`
    :"";
  const arrowHead=Math.min(24,Math.max(14,box.width*.14));
  const joined=box.personalSegment&&!box.personalSegment.terminal;
  const arrowPath=joined
    ?`M${box.x} ${box.y}H${box.x2}V${box.y+box.height}H${box.x}Z`
    :`M${box.x} ${box.y}H${box.x2-arrowHead}L${box.x2} ${box.y+box.height/2}L${box.x2-arrowHead} ${box.y+box.height}H${box.x}Z`;
  const separator=joined?`<path data-personal-band-separator="true" d="M${box.x2-9} ${box.y+1}L${box.x2} ${box.y+box.height/2}L${box.x2-9} ${box.y+box.height-1}" fill="none" stroke="#D9C8EA" stroke-width="1.5"/>`:"";
  const labelX=box.x+10+(box.width-28)/2;
  const title=String(arrow.title||'');
  const titleWidth=(scene.measureText||measurePresentationText)(title,18,TYPE.arrowLabel,400);
  const titleFits=titleWidth<=box.width-arrowHead-16;
  const leftRoom=Math.max(1,box.x-44),rightRoom=Math.max(1,WIDTH-box.x2-44);
  const outsideLeft=leftRoom>=titleWidth&&(rightRoom<titleWidth||box.x+box.width/2>WIDTH/2)||leftRoom>rightRoom&&rightRoom<titleWidth;
  const titleLines=titleFits?[title]:wrapPresentationText(title,{width:outsideLeft?leftRoom:rightRoom,size:18,family:TYPE.arrowLabel,measureText:scene.measureText||measurePresentationText});
  const titleAnchor=titleFits?'middle':outsideLeft?'end':'start';
  const titleX=titleFits?labelX:outsideLeft?box.x-12:box.x2+12;
  const titleY=box.y+22-(titleLines.length-1)*11;
  // Short chronology bars retain their exact dates/width. Their full readable
  // label sits beside the bar instead of crushing glyphs into a few pixels.
  const titleColor=titleFits?"#FFFFFF":outsideInk;
  const titleMarkup=`<text data-arrow-label-placement="${titleFits?'inside':outsideLeft?'outside-left':'outside-right'}" data-board-ink-role="${titleFits?'inside-arrow':'outside-arrow'}" x="${titleX}" y="${titleY}" text-anchor="${titleAnchor}" fill="${xml(titleColor)}" font-family="${TYPE.arrowLabel}" font-size="18" font-weight="400">${titleLines.length===1?xml(title):titleLines.map((line,i)=>`<tspan x="${titleX}" dy="${i?22:0}">${xml(line)}</tspan>`).join('')}</text>`;
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
    const fontSize=23;
    const notch=index===0?"":`<path data-axis-notch="true" d="M${sx-11} ${y+1}L${sx} ${mid}L${sx-11} ${y+height-1}" fill="none" stroke="#DCE6F4" stroke-opacity=".85" stroke-width="2"/>`;
    /* A transparent cell rect keeps the per-year hit/drag geometry the axis handles use. */
    return`<g data-segment-kind="${kind}" data-axis-segment-id="${xml(segment.id)}" data-axis-segment-weight="${segment.weight}" data-axis-date-width="${width*(segment.endPercent-segment.startPercent)/96}"><rect data-axis-cell="true" x="${sx}" y="${y}" width="${Math.max(1,segmentWidth)}" height="${height}" fill="transparent"/>${notch}<text x="${sx+segmentWidth/2+(index===0?0:4)}" y="${y+27}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.axis}" font-size="${fontSize}" font-weight="700">${xml(segment.label)}</text></g>`;
  }).join("")}<rect data-axis-hit-target="true" x="0" y="${y-8}" width="${WIDTH}" height="${height+16}" fill="transparent" pointer-events="all"/></g>`;
}

function milestoneGeometry(flag,index,scale,scene,{interview=false}={}){
  const object=interview?null:presentationEventObject(scene,flag.id);
  const overridden=object?.geometry;
  const dated=!interview&&scene.founderPresentation?.axis?.mode!=='manual'&&automaticDateAnchor(scene,flag);
  const rawX=overridden&&!dated?pixel(overridden.x):boardX(scale.xPercent(flag.month));
  const x=overridden&&!dated?rawX:Math.max(6,Math.min(WIDTH-60,rawX));
  const study=!interview&&flag.categoryId==="exams"&&flag.examAttemptId
    ?(scene.arrows||[]).find(arrow=>arrow.study&&arrow.examAttemptId===flag.examAttemptId):null;
  const studyBox=study?geometry(study,founderPortableLayout(scene),scale,scene):null;
  const title=String((interview?"Interview":flag.title)||"");
  const labelWidth=title.length*9.5+8;
  const flipLabel=x+56+labelWidth>WIDTH-8;
  const footprintLeft=Math.min(x,flipLabel?x-labelWidth-8:x+60);
  const footprintRight=Math.max(x+56,flipLabel?x-8:x+60+labelWidth);
  const plaque=titlePlaqueLayout(scene).plaque;
  const crossesTitle=footprintLeft<plaque.x+plaque.width&&footprintRight>plaque.x;
  // General milestones stay above the ribbon; explicit exam-attempt flags
  // attach to their study arrow, as the Founder exemplar shows. The gap
  // under the plaque can hold a pennant and a single-line label; unresolved
  // long/simultaneous labels are quality findings, never moved below the axis.
  const automaticY=scene.autoFlagGeometry?.get(String(flag.id))?.y??(studyBox?studyBox.y-58:crossesTitle?87:(index%2===0?58:65));
  const defaultPoleBottom=studyBox?.y??FOUNDER_PORTABLE_GEOMETRY.axisTop;
  return {object,overridden,x,y:overridden?pixel(automaticDateAnchor(scene,flag)?scene.autoFlagGeometry?.get(String(flag.id))?.y??overridden.y:overridden.y):automaticY,width:overridden?Math.max(.25,Number(overridden.width)||50):50,height:overridden?Math.max(.25,Number(overridden.height)||64):64,rotation:overridden?Number(overridden.rotation)||0:0,defaultPoleBottom};
}

export function locked407FMilestoneGeometry(scene,id){
  const index=(scene?.flags||[]).findIndex(flag=>String(flag.id)===String(id));
  if(index<0)return null;
  const {x,y,width,height,rotation,object}=milestoneGeometry(scene.flags[index],index,metrics(scene),scene);
  return {x,y,width,height,rotation,axisY:FOUNDER_PORTABLE_GEOMETRY.axisTop,axisBottom:FOUNDER_PORTABLE_GEOMETRY.axisTop+FOUNDER_PORTABLE_GEOMETRY.axisHeight,object};
}

// Capture the resolved native grammar when a human first materializes an
// event object. Existing authored geometry keeps its original presentation.
export function locked407FNativeMilestonePresentation(scene,id){
  const index=(scene?.flags||[]).findIndex(flag=>String(flag.id)===String(id));
  if(index<0)return null;
  const flag=scene.flags[index],placed=milestoneGeometry(flag,index,metrics(scene),scene);
  if(placed.object)return null;
  const layout=scene.autoFlagLabels?.get(String(flag.id));
  const labelWidth=String(flag.title||'').length*9.5+8;
  const flip=layout?.flip??(placed.x+56+Math.max(labelWidth,Math.min(420,String(flag.siteName||'').length*10))>WIDTH-8);
  return {flagLabelLayout:{width:layout?.width||420,flip,...(Number.isFinite(layout?.yOffset)?{yOffset:layout.yOffset}:{})},nativeFlagPole:{anchor:'native'}};
}

function flagMarkup(flag,index,scale,scene,{interview=false}={}){
  const placed=milestoneGeometry(flag,index,scale,scene,{interview});
  const {overridden,x,y}=placed;
  /* AAA-019 — a milestone in the last months used to plant its flag at the very edge and run
     its label off the board. The pole stays on the date; the label flips to the left of the
     flag when there is no room to its right. */
  const labelWidth=String((interview?"Interview":flag.title)||"").length*9.5+8;
  const labelLayout=scene.autoFlagLabels?.get(String(flag.id))||placed.object?.presentation?.flagLabelLayout;
  const flipLabel=labelLayout?.flip??(x+56+Math.max(labelWidth,Math.min(420,String(flag.siteName||"").length*10))>WIDTH-8);
  const sx=placed.width/50,sy=placed.height/64,rotation=placed.rotation;
  const axisAnchored=!!overridden&&placed.object?.presentation?.guardianAnchor==='axis'&&rotation===0;
  // Native first edits retain the original axis/study attachment, including
  // rotation. This opt-in marker never reinterprets older authored overrides.
  const nativeAnchored=!!overridden&&placed.object?.presentation?.nativeFlagPole?.anchor==='native';
  const nativeBottom=/\b(?:united states(?: of america)?|u\.s\.(?:a\.)?|usa)\b/i.test(String(flag.title||''))
    ?FOUNDER_PORTABLE_GEOMETRY.axisTop:placed.defaultPoleBottom;
  const anchoredPoleBottom=nativeAnchored?(nativeBottom-y)/sy:axisAnchored?(FOUNDER_PORTABLE_GEOMETRY.axisTop-y)/sy:64;
  const transform=overridden
    ?` transform="translate(${x} ${y}) rotate(${rotation} 25 32) scale(${sx} ${sy})"`
    :"";
  const bx=overridden?0:x,by=overridden?0:y;
  const title=interview?"Interview":flag.title;
  const useUsFlag=!interview&&/\b(?:united states(?: of america)?|u\.s\.(?:a\.?)?|usa)\b/i.test(title);
  if(useUsFlag){
    const poleX=bx+4,usaFlag=FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag,ink=boardInk(scene);
    const labelX=flipLabel?bx-8:bx+54;
    const available=Math.max(1,flipLabel?placed.x-24:WIDTH-placed.x-70);
    const lines=wrapPresentationText(String(title||'')+(flag.siteName?' — '+String(flag.siteName):''),{width:Math.min(labelLayout?.width||420,available),size:18,family:TYPE.event,measureText:scene.measureText||measurePresentationText});
    const anchor=flipLabel?' text-anchor="end"':'';
    const label=lines.map((line,i)=>`<text data-board-ink-role="flag-label" data-material-field="title" x="${labelX}" y="${by+19+i*21}"${anchor} fill="${ink}" font-family="${TYPE.event}" font-size="18">${xml(line)}</text>`).join('');
    return`<g data-event-kind="flag" data-event-id="${xml(flag.id)}" data-founder-milestone-style="usa" aria-label="${xml(flag.ariaLabel)}"${transform}><line x1="${poleX}" y1="${by+2}" x2="${poleX}" y2="${overridden?anchoredPoleBottom:FOUNDER_PORTABLE_GEOMETRY.axisTop}" stroke="#A9AFB2" stroke-width="4"/><image data-founder-usa-flag-asset-sha256="${usaFlag.sha256}" href="${xml(founderKeynoteAssetUrl(usaFlag))}" x="${bx}" y="${by}" width="50" height="41" preserveAspectRatio="xMinYMin meet"/>${label}<text data-board-ink-role="flag-date" x="${labelX}" y="${by+19+lines.length*21}"${anchor} fill="${ink}" font-family="${TYPE.event}" font-size="18">${xml(presentationDateWording(flag.month,flag.datePrecision?.start,flag.sourceDateWording?.start))}</text></g>`;
  }
  /* AAA-019 Keynote fidelity (016 §3 "Milestone flags"): the golden milestone is a waving
     grey pennant planted on the ribbon with a white date chip inside and the label beside it —
     not the old 72×92 signpost sprite. Drawn as vector so it scales with export DPI. General
     milestones remain gray; only explicit exam results change their flag color. The pole foot lands exactly on the ribbon's top edge. */
  const examResult=!interview&&flag.categoryId==="exams"?flag.examResult:null;
  const fill=examResult==="Failed"?"#C92113":examResult==="Passed"?"#379B43":"#A6AAAE";
  const edge=examResult==="Failed"?"#982018":examResult==="Passed"?"#267333":"#6E7378";
  const light=examResult==="Failed"?"#F07A66":examResult==="Passed"?"#75C877":"#C9CDD1";
  const poleX=bx+4;
  const poleBottom=overridden?anchoredPoleBottom:placed.defaultPoleBottom;
  const pennant=`<path d="M${poleX} ${by+2}C${poleX+16} ${by-4},${poleX+34} ${by+8},${poleX+52} ${by+2}L${poleX+52} ${by+36}C${poleX+36} ${by+42},${poleX+18} ${by+30},${poleX} ${by+36}Z" fill="${fill}" stroke="${edge}" stroke-width="1.2"/><path d="M${poleX+2} ${by+4}C${poleX+16} ${by-1},${poleX+34} ${by+10},${poleX+50} ${by+5}" stroke="${light}" stroke-opacity=".8" stroke-width="1"/>`;
  const chip=`<text data-founder-pennant-date="true" x="${poleX+26}" y="${by+24}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.event}" font-size="18">${xml(presentationDateWording(flag.month,flag.datePrecision?.start,flag.sourceDateWording?.start))}</text>`;
  const labelX=flipLabel?poleX-8:poleX+60;
  const available=Math.max(1,flipLabel?placed.x-8-16:WIDTH-placed.x-64-16);
  const wrapWidth=Math.min(labelLayout?.width||420,available);
  const measureText=scene.measureText||measurePresentationText;
  const adjacentLabel=String(title||'')+(!interview&&flag.siteName?' — '+String(flag.siteName):'');
  const lines=wrapPresentationText(adjacentLabel,{width:wrapWidth,size:18,family:TYPE.arrowLabel,measureText});
  const resultPrivacy=flag.presentationRedactions?.includes('EXAM_RESULT_PRIVATE')?' data-exam-result-private="true"':'';
  const labelYOffset=!interview&&!examResult&&Number.isFinite(labelLayout?.yOffset)?labelLayout.yOffset:0;
  const label=lines.map((line,lineIndex)=>`<text${resultPrivacy} data-board-ink-role="flag-label" data-material-field="title" x="${labelX}" y="${by+22+labelYOffset+lineIndex*21}"${flipLabel?' text-anchor="end"':""} fill="${boardInk(scene)}" font-family="${TYPE.arrowLabel}" font-size="18">${xml(line)}</text>`).join("");
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
  return`<g data-artifact-chrome="color-key" data-canonical-row-count="6" data-founder-geometry="${x},${y},${width},${height}" transform="translate(${x} ${y}) scale(${sx} ${sy})"><image data-paint-inset-top="35" href="${xml(LOCKED_407F_ASSETS.key)}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/><image href="${xml(LOCKED_407F_ASSETS.pin)}" x="${base.width/2-14}" y="-12" width="28" height="28"/><text x="${left}" y="${cardTop+26}" fill="#A8402F" font-family="${TYPE.key}" font-size="18" font-weight="700">COLOR KEY</text><path d="M${left} ${cardTop+31}H${left+100}" stroke="#A8402F" stroke-width="1.2"/>${rows.map(({id,label,color},index)=>{const top=firstRow+index*rowPitch;const labelWidth=(scene.measureText||measurePresentationText)(label,18,TYPE.key,500)+18*.12;const overflow=labelWidth>base.width-left-(left+swatchWidth+12)+.01;return`<g data-color-key-row="${index}" data-category-id="${xml(id)}"><rect x="${left}" y="${top}" width="${swatchWidth}" height="${swatchHeight}" rx="2" fill="${color}" stroke="#2B2B2B" stroke-width="1"/><text${overflow?' data-text-overflow="true"':""} x="${left+swatchWidth+12}" y="${top+21}" fill="#171D26" font-family="${TYPE.key}" font-size="18" font-weight="500">${xml(label)}</text></g>`;}).join("")}</g>`;
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
  let {x,y,width,height}=geometry;
  const base=FOUNDER_PORTABLE_GEOMETRY.profile;
  const sx=width/base.width,sy=height/base.height;
  /* Native reference: 19pt label/value text, grouped identity, exams and personal
     details. Explicit summaries retain the applicant's wording; derived months
     are only a fallback and must not replace authored facts. */
  const months=(value)=>Number(value)>0?`${Number(value)} month${Number(value)===1?"":"s"}`:"";
  const displayFields=scene?.profileDisplay?.includedFields;
  const rows=[
    ["Name",profile.fullName,"identity","fullName"],
    ["Visa Status",profile.status,"identity","status"],
    ["AAMC",profile.aamcDisplay,"identity","aamcDisplay"],
    ["Medical school",profile.medicalSchool,"education","medicalSchool"],
    ["Degree",profile.degree,"education","degree"],
    ["Specialty",profile.specialty,"education","specialty"],
    ["Step 1",profile.step1,"exams","step1"],
    ["Step 2 CK",profile.step2,"exams","step2"],
    ["Step 2 CS",profile.step2Cs,"exams","step2Cs"],
    ["Step 3",profile.step3,"exams","step3"],
    ["USCE",profile.usceSummary||months(profile.usceMonths),"experience","usceSummary"],
    ["Research",profile.researchSummary||months(profile.researchMonths),"experience","researchSummary"],
    ["EMR Experience",profile.emrExperience,"personal","emrExperience"],
    ["Languages fluent in",profile.languages,"languages","languages"],
    ["Hobbies",profile.hobbies,"hobbies","hobbies"]
  ].filter(([,value,,field])=>String(value||"").trim()&&(!displayFields||displayFields.includes(field)));
  const photoX=351,photoY=20,photoWidth=170,photoHeight=170;
  const measureText=scene.measureText||measurePresentationText;
  const layoutRows=(orderedRows,lineHeight,groupGap)=>{
    let rowY=32;
    const lines=[];
    const emitLines=(text,label,eventId=null,field=null)=>{
      let remaining=String(text||'').trim().replace(/\s+/g,' '),index=0,pendingWidth=null,pendingLines=[];
      while(remaining){
        const width=(photo||scene.showEmptySlots)&&rowY-19<photoY+photoHeight+12?317:base.width-44;
        const prefix=label?`${label}: `:'';
        // A bold label is wider than its roman value. Measure the same runs
        // that the SVG and editable export will paint, including after wrapping.
        const measure=(value,size,family,weight)=>index===0&&prefix&&value.startsWith(prefix)
          ?measureText(prefix,size,family,700)+measureText(value.slice(prefix.length),size,family,400)
          :measureText(value,size,family,weight);
        if(pendingWidth!==width||!pendingLines.length){
          pendingLines=wrapPresentationText(remaining,{width,size:19,family:TYPE.profile,weight:400,measureText:measure});pendingWidth=width;
        }
        const line=pendingLines.shift()||remaining;
        const overflow=rowY+19*.34>base.height-18||measure(line,19,TYPE.profile,400)>width+.01;
        lines.push({text:line,label,index,eventId,field,y:rowY,prefix:index===0&&line.startsWith(prefix)?prefix:'',overflow});
        remaining=remaining.slice(line.length).trimStart();rowY+=lineHeight;index++;
      }
    };
    let previousGroup=null;
    for(const [label,value,group] of orderedRows){
      if(previousGroup&&previousGroup!==group)rowY+=groupGap;
      emitLines(`${label}: ${value}`,label);previousGroup=group;
    }
    for(const record of profile.educationRecords||[]){
      const start=presentationDateWording(record.startDate,record.datePrecision?.start,record.sourceDateWording?.start);
      const end=record.openEnded?'Ongoing':presentationDateWording(record.endDate,record.datePrecision?.end,record.sourceDateWording?.end);
      emitLines(`${record.title}${record.school?' — '+record.school:''}:`,'Education',record.eventId,'educationSpan');
      emitLines(`${start} – ${end}`,'Education',record.eventId,'educationSpan');rowY+=groupGap;
    }
    return{lines,rowY,lineHeight,groupGap,fits:lines.every(line=>!line.overflow)};
  };
  // Keep the reference paper, portrait aperture and 19pt text. Search bounded
  // spacing and put school/degree after exams when that uses the wider area
  // below the portrait. No value is abbreviated, omitted or moved to a key.
  const afterExams=[...rows.filter(row=>row[2]==='identity'),...rows.filter(row=>row[2]==='exams'),
    ...rows.filter(row=>row[2]==='education'),...rows.filter(row=>!['identity','exams','education'].includes(row[2]))];
  let chosen=null;
  search:for(const lineHeight of [22.8,22,21,20.5])for(const groupGap of [6,4,2,0])for(const orderedRows of [rows,afterExams]){
    const layout=layoutRows(orderedRows,lineHeight,groupGap);
    if(!chosen||layout.rowY<chosen.rowY)chosen=layout;
    if(layout.fits){chosen=layout;break search;}
  }
  const rowY=chosen.rowY;
  const rowMarkup=chosen.lines.map(({text,label,index,eventId,field,y,prefix,overflow})=>{
    const contents=prefix?`<tspan font-weight="700">${xml(prefix)}</tspan>${xml(text.slice(prefix.length))}`:xml(text);
    return`<text${eventId?` data-event-id="${xml(eventId)}" data-material-field="${xml(field||"educationSpan")}"`:""} data-profile-field="${xml(label||'Name')}" data-profile-line="${index}" data-profile-line-height="${chosen.lineHeight}" data-text-overflow="${overflow}" x="22" y="${y}" fill="#171D26" font-family="${TYPE.profile}" font-size="19" font-weight="400">${contents}</text>`;
  }).join('');
  const photoLayer=!photo&&!scene.showEmptySlots?"":photo
    ?`<g data-frame-slot="profile" data-media-state="filled" data-media-id="${xml(photo.id)}"><rect x="${photoX}" y="${photoY}" width="${photoWidth}" height="${photoHeight}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="7"/>${croppedImageMarkup({href:photo.source,x:photoX,y:photoY,width:photoWidth,height:photoHeight,crop:photo.crop,naturalAspect:photo.naturalAspect,attributes:`data-profile-photo-slot="true" data-media-id="${xml(photo.id)}"`})}</g>`
    :`<g data-frame-slot="profile" data-media-state="empty"><rect data-profile-photo-slot="true" data-media-state="empty" x="${photoX}" y="${photoY}" width="${photoWidth}" height="${photoHeight}" fill="#C9C2AE" stroke="#FFFFFF" stroke-width="7"/><text x="${photoX+photoWidth/2}" y="${photoY+photoHeight/2+7}" text-anchor="middle" fill="#6D6753" font-family="${TYPE.profile}" font-size="17" font-weight="700" pointer-events="none">PROFILE PHOTO</text></g>`;
  let paper=`<image href="${xml(LOCKED_407F_ASSETS.paper)}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/>`;
  let renderScaleY=sy;
  if(scene.autoCompactProfile&&!scene.founderPresentation?.profileGeometryExplicit){
    // Keep the native lower-left paper and full-size type/corners. Remove only
    // surplus blank paper when a full-span experience cannot clear furniture.
    const contentHeight=Math.ceil(Math.max(164,rowY+18,photo?photoY+photoHeight+20:0));
    height=Math.min(base.height,contentHeight);y=base.y+base.height-height;renderScaleY=1;
    const strip=32;
    const slice=(targetY,sourceY,h)=>`<svg data-crop-zoom="1" data-profile-paper-slice="true" x="0" y="${targetY}" width="${base.width}" height="${h}" viewBox="0 ${sourceY} ${base.width} ${h}" preserveAspectRatio="none"><image href="${xml(LOCKED_407F_ASSETS.paper)}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/></svg>`;
    paper=slice(0,0,strip)+`<rect x="7" y="${strip}" width="${base.width-14}" height="${height-strip*2}" fill="#FFFFFF"/>`+slice(height-strip,base.height-strip,strip);
  }
  return`<g data-artifact-chrome="profile" data-founder-geometry="${x},${y},${width},${height}" transform="translate(${x} ${y}) scale(${sx} ${renderScaleY})">${paper}${rowMarkup}${photoLayer}</g>`;
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
  // Assign source photos to slots 1, 2, 3, then paint the original back-to-front
  // stack 3, 2, 1. Reversing before assignment swaps unslotted source photos.
  const slots=FOUNDER_PORTABLE_GEOMETRY.photos.map((_,index)=>({
    index,photo:exact.get(`photo${index+1}`)||rest.shift()||null
  }));
  return`<g data-artifact-chrome="photo-frames">${slots.reverse().map(({index,photo})=>{
    const {x,y,width,height,rotation}=photoFrameGeometry(scene,index);
    const slot=`photo${index+1}`;
    if(!photo&&!scene.showEmptySlots)return "";
    const pixels=FOUNDER_PHOTO_PIXELS[index];
    const scaled=([left,top,right,bottom])=>({
      x:x+left/pixels.width*width,y:y+top/pixels.height*height,
      width:(right-left)/pixels.width*width,height:(bottom-top)/pixels.height*height
    });
    const paper=scaled(pixels.paper),aperture=scaled(pixels.aperture);
    const content=photo
      ?croppedImageMarkup({href:photo.source,x:aperture.x,y:aperture.y,width:aperture.width,height:aperture.height,crop:photo.crop,naturalAspect:photo.naturalAspect,attributes:`data-photo-aperture="true" data-media-id="${xml(photo.id)}"`})
      :`<rect data-photo-aperture="true" data-media-state="empty" x="${aperture.x}" y="${aperture.y}" width="${aperture.width}" height="${aperture.height}" fill="#D6D8D5"/><text x="${aperture.x+aperture.width/2}" y="${aperture.y+aperture.height/2}" text-anchor="middle" fill="#515B62" font-family="${TYPE.event}" font-size="18" pointer-events="none">DROP PHOTO ${index+1}</text>`;
    return`<g data-artifact-photo-frame="${index+1}" data-frame-slot="${slot}" data-media-state="${photo?"filled":"empty"}"${photo?` data-media-id="${xml(photo.id)}"`:""} data-founder-geometry="${x},${y},${width},${height},${rotation}" transform="rotate(${rotation} ${x+width/2} ${y+height/2})"><rect data-photo-paper="true" x="${paper.x}" y="${paper.y}" width="${paper.width}" height="${paper.height}" fill="#FFFFFF" filter="url(#d1406-photo-shadow)"/>${content}</g>`;
  }).join("")}</g>`;
}

function interviewMarkup(scene,scale){
  const target=scene?.interviewTarget||{},marker=scene?.interviewMarker,logo=scene?.mediaProjection?.logo;
  const program=String(target.programName||target.prog||"").trim();
  if(!marker&&!logo&&!program&&!scene.showEmptySlots)return "";
  const {x,y,width}=FOUNDER_PORTABLE_GEOMETRY.interview;
  const hasHeader=!!logo||!!program||scene.showEmptySlots;
  const logoLayer=logo
    ?`<g data-frame-slot="logo" data-media-state="filled" data-media-id="${xml(logo.id)}"><image data-program-logo="true" data-media-id="${xml(logo.id)}" href="${xml(logo.source)}" x="${x+8}" y="${y+5}" width="${width-16}" height="42" preserveAspectRatio="xMidYMid meet"/></g>`
    :hasHeader?`<g data-frame-slot="logo" data-media-state="${program?'text':'empty'}"><rect x="${x}" y="${y}" width="${width}" height="52" fill="transparent"/><text x="${x+width/2}" y="${y+31}" text-anchor="middle" fill="#4A5670" font-family="${TYPE.axis}" font-size="16" font-weight="700" pointer-events="none">${xml((program||"PROGRAM LOGO").toUpperCase())}</text></g>`:"";
  const ribbonY=y+62;
  const rawDate=String(target.date||'');
  const exactDay=/^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  const dateLabel=exactDay?`${MONTHS[Number(exactDay[2])-1]} ${Number(exactDay[3])}, ${exactDay[1]}`:formatMonth(marker?.month);
  const date=marker?`Interview · ${xml(dateLabel)}`:scene.showEmptySlots?"Date pending":"";
  return`${marker?flagMarkup(marker,0,scale,scene,{interview:true}):""}<g data-interview-destination="407f-ribbon">${hasHeader?`<rect x="${x}" y="${y}" width="${width}" height="52" fill="#FFFFFF" fill-opacity=".4" stroke="#26314D" stroke-opacity=".45" stroke-dasharray="4 3"/>`:""}${logoLayer}<path d="M${x} ${ribbonY}H${x+width}L${x+width-10} ${ribbonY+18}L${x+width} ${ribbonY+36}H${x}L${x+10} ${ribbonY+18}Z" fill="#7E4BB6"/><text x="${x+width/2}" y="${ribbonY+25}" text-anchor="middle" fill="#FFFFFF" font-family="${TYPE.title}" font-size="18" font-weight="700">${xml(target.label||"YOUR BIG INTERVIEW")}</text>${date?`<text data-board-ink-role="interview-date" x="${x+width/2}" y="${ribbonY+58}" text-anchor="middle" fill="${boardInk(scene)}" font-family="${TYPE.event}" font-size="18">${date}</text>`:""}</g>`;
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

function titlePlaqueLayout(scene){
  const headline=String(scene?.headline?.text||scene?.profile?.fullName||"Your journey")
    .replace(/^timeline\s*:\s*/i,"");
  const base=FOUNDER_PORTABLE_GEOMETRY.title;
  const typography=scene?.advancedProjection?.headlineTypography||{};
  const label=`Timeline: ${headline}`;
  const fontFamily=typography.font?`${xml(typography.font)},${TYPE.title}`:TYPE.title;
  const fontSize=Number(typography.size)||36,fontWeight=Number(typography.weight)||400;
  const textWidth=(scene.measureText||measurePresentationText)(label,fontSize,fontFamily,fontWeight)+fontSize*.12;
  const center=base.x+base.width/2,maxWidth=2*Math.min(center,WIDTH-center);
  const width=Math.min(maxWidth,Math.max(base.width,textWidth+96));
  return{label,typography,fontFamily,fontSize,fontWeight,textWidth,plaque:{...base,x:center-width/2,width}};
}

function titlePlaqueMarkup(plaque){
  const base=FOUNDER_PORTABLE_GEOMETRY.title,href=xml(LOCKED_407F_ASSETS.plaque);
  if(plaque.width===base.width)return`<image href="${href}" x="${plaque.x}" y="${plaque.y}" width="${plaque.width}" height="${plaque.height}" preserveAspectRatio="none"/>`;
  // Retain the original corner mounts at their native size. Only the plain
  // center of the existing frame grows to contain the full, uncompressed name.
  const cap=48;
  const slice=(x,width,sourceX,sourceWidth)=>`<svg data-crop-zoom="1" data-title-plaque-slice="true" x="${x}" y="${plaque.y}" width="${width}" height="${plaque.height}" viewBox="${sourceX} 0 ${sourceWidth} ${base.height}" preserveAspectRatio="none"><image href="${href}" x="0" y="0" width="${base.width}" height="${base.height}" preserveAspectRatio="none"/></svg>`;
  return slice(plaque.x,cap,0,cap)+slice(plaque.x+cap,plaque.width-2*cap,cap,base.width-2*cap)+slice(plaque.x+plaque.width-cap,cap,base.width-cap,cap);
}

function chrome(scene,scale){
  const {label,typography,fontFamily,fontSize,fontWeight,textWidth,plaque}=titlePlaqueLayout(scene);
  const alignment=typography.alignment==="left"?"start":typography.alignment==="right"?"end":"middle";
  const headlineX=alignment==="start"?plaque.x+48:alignment==="end"?plaque.x+plaque.width-48:plaque.x+plaque.width/2;
  const overflow=textWidth>plaque.width-96+.01||56-fontSize*.86<plaque.y||56+fontSize*.34>plaque.y+plaque.height;
  return`<g data-artifact-chrome="title" data-founder-geometry="${plaque.x},${plaque.y},${plaque.width},${plaque.height}">${titlePlaqueMarkup(plaque)}<text data-board-headline="true"${overflow?' data-text-overflow="true"':""} x="${headlineX}" y="56" text-anchor="${alignment}" fill="${xml(typography.color||"#111827")}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}">${xml(label)}</text></g>${colorKey(scene)}${profileMarkup(scene)}${photoFrames(scene)}${interviewMarkup(scene,scale)}${(scene?.explanations||[]).map((explanation,index)=>explanationMarkup(scene,explanation,index,scale)).join("")}`;
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

function wrappedTextLines(text,width,size,wrap,family=TYPE.event){
  return wrapPresentationText(text,{width,size,wrap,family});
}

function advancedTextMarkup(object){
  const item=object.presentation||{},box=object.geometry;
  const lineHeight=Math.max(.8,Math.min(2,Number(item.lineHeight)||1.2));
  const minimum=Math.max(8,Math.min(72,Number(item.minFontSize)||10));
  const fitted=fitPresentationText(item.text,{width:box.width,height:box.height,
    size:Math.max(minimum,Math.min(72,Number(item.size)||24)),minSize:minimum,lineHeight,
    fit:item.fitMode,wrap:item.wrap,family:item.font||'Inter',weight:Number(item.weight)||400});
  const size=fitted.fontSize,lines=fitted.lines;
  const anchor=item.alignment==="center"?"middle":item.alignment==="right"?"end":"start";
  const x=anchor==="middle"?box.width/2:anchor==="end"?box.width:0;
  const contentHeight=lines.length*size*lineHeight;
  const startY=item.verticalAlign==="bottom"
    ?box.height-contentHeight+size
    :item.verticalAlign==="center"
      ?(box.height-contentHeight)/2+size
      :size;
  return`<text data-advanced-text="${xml(object.id)}" data-text-overflow="${!fitted.fits}" x="${x}" y="${startY}" fill="${xml(item.color||"#191C21")}" font-family="${xml(item.font||"Inter")}" font-size="${size}" font-weight="${Number(item.weight)||400}" text-anchor="${anchor}" data-text-fit="${item.fitMode==="fixed"?"fixed":"auto"}">${lines.map((line,index)=>`<tspan x="${x}" dy="${index?size*lineHeight:0}">${xml(line)}</tspan>`).join("")}</text>`;
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

function serializePlacedPortableSvg(scene,{layers="",resourceNamespace=""}={}){
  const scale=metrics(scene);
  const layout=founderPortableLayout(scene);
  const arrows=scene?.arrows||[];
  const flags=scene?.flags||[];
  const titleId="d1406-portable-title";
  const descriptionId="d1406-portable-description";
  const board=FOUNDER_KEYNOTE_CONTRACT.assets.board;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-labelledby="${titleId} ${descriptionId}" data-renderer="${xml(scene?.renderer)}" data-artifact-language="407f-powerpoint-keynote" data-export-projection="native-svg" data-locked-407f-source-sha256="${LOCKED_407F_SOURCE_SHA256}"><title id="${titleId}">${xml(scene?.accessibility?.ariaLabel)}</title><desc id="${descriptionId}">${xml(scene?.accessibility?.description)}</desc><defs>${background(scene)}<linearGradient id="d1406-axis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F4A78"/><stop offset=".16" stop-color="#22395F"/><stop offset=".7" stop-color="#182B4C"/><stop offset="1" stop-color="#101F3A"/></linearGradient><filter id="d1406-arrow-shadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#141E32" flood-opacity=".48"/></filter><filter id="d1406-photo-shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="-6.603568780525887" dy="6.114971738353651" stdDeviation="5" flood-color="#000000" flood-opacity=".5"/></filter><marker id="d1406-red-arrowhead" markerWidth="10" markerHeight="14" refX="10" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 7L0 14Z" fill="#C73A25"/></marker>${arrowDefinitions(arrows,layout,scale,scene)}</defs><rect data-board-background="true" data-founder-board-source="${xml(board.sourcePath)}" data-founder-board-asset-sha256="${board.sha256}" x="0" y="0" width="1920" height="1080" fill="url(#d1406-board)"/>${advancedBackgroundLayer(scene)}${axisMarkup(scale)}<g data-layer="events">${flags.map((flag,index)=>flagMarkup(flag,index,scale,scene)).join("")}${arrows.map((arrow,index)=>arrowMarkup(arrow,index,layout,scale,scene)).join("")}</g>${chrome(scene,scale)}</svg>`;
  return namespacePortableSvgResources(
    appendLayers(svg,`${advancedSceneMarkup(scene)}${layers}`),
    resourceNamespace
  );
}

// Fit independent, directly labelled duration arrows inside the existing board.
// Chronological x/width, native typography, content and manual geometry are
// immutable here. No consolidation, abbreviation, new lanes/legend or pages.
function avoidAutomaticArrowCollisions(scene,svg,{chronological=false}={}){
  const joinedBands=personalBandSegments(scene);
  const auto=(scene.arrows||[]).filter(arrow=>(!presentationEventObject(scene,arrow.id)?.geometry||automaticDateAnchor(scene,arrow))&&!arrow.manualOffset?.laneLocked&&!Number(arrow.manualOffset?.x)&&!Number(arrow.manualOffset?.y)&&!joinedBands.has(arrow.id)&&!(arrow.study&&(scene.flags||[]).some(flag=>flag.examAttemptId&&flag.examAttemptId===arrow.examAttemptId)))
    .sort((a,b)=>monthIndex(a.startMonth)-monthIndex(b.startMonth));
  if(!auto.length)return null;
  const ids=new Set(auto.map(arrow=>'event:'+arrow.id));
  const resolved=resolveFounderPresentationSvg(svg,{measureText:scene.measureText});
  const physical=resolved.nodes.filter(n=>n.groupId&&n.bounds&&n.groupId!=='furniture:axis'&&
    !n.sourceAttributes['data-board-background']&&!n.sourceAttributes['data-advanced-background']&&
    Number(n.style.opacity??1)>0&&Number(n.style['fill-opacity']??1)>0&&
    !(n.kind==='path'&&(n.lineOnly||n.style.fill==='none'||n.bounds.width<1||n.bounds.height<1)));
  // Conservative axis-aligned envelope for rotated photos; never move a card.
  const envelope=b=>{const a=(b.rotation||0)*Math.PI/180,w=Math.abs(b.width*Math.cos(a))+Math.abs(b.height*Math.sin(a)),h=Math.abs(b.width*Math.sin(a))+Math.abs(b.height*Math.cos(a));return{x:b.x+(b.width-w)/2,y:b.y+(b.height-h)/2,width:w,height:h};};
  const intersects=(a,b)=>a.x<b.x+b.width+6&&a.x+a.width+6>b.x&&a.y<b.y+b.height+6&&a.y+a.height+6>b.y;
  const occupied=physical.filter(n=>!ids.has(n.groupId)).map(n=>envelope(n.occlusionBounds||n.bounds));
  const scale=metrics(scene),layout=founderPortableLayout(scene),placements=new Map(),siteOffsets=new Map();
  let changed=false,previousStart=null,previousY=null;
  for(const arrow of auto){
    const original=geometry(arrow,layout,scale,scene);
    const parts=physical.filter(n=>n.groupId==='event:'+arrow.id).map(n=>({...envelope(n.occlusionBounds||n.bounds),site:n.sourceAttributes['data-material-field']==='siteName'}));
    const shifted=(b,dy,dx)=>({...b,x:b.x+(b.site?dx:0),y:b.y+dy});
    const fits=(dy,dx)=>parts.map(b=>shifted(b,dy,dx)).every(b=>b.x>=0&&b.x+b.width<=WIDTH&&b.y>=171&&b.y+b.height<=HEIGHT-8&&
      !occupied.some(other=>intersects(b,other)));
    const start=monthIndex(arrow.startMonth);
    const inOrder=y=>previousY===null||start===previousStart||y>=previousY+(chronological===true?18:0);
    let delta=0,siteOffset=0;
    if(!fits(0,0)||chronological&&(chronological===true||!inOrder(original.y))){
      const candidates=[0];
      for(let y=188;y<=1000;y+=2)candidates.push(y-original.y);
      // Preserve the recovered sorted-start stair whenever a safe placement
      // exists below the preceding event. Dense boards may still need a reset.
      candidates.sort((a,b)=>(chronological?Number(!inOrder(original.y+a))-Number(!inOrder(original.y+b)):0)||(chronological===true?a-b:Math.abs(a)-Math.abs(b))||a-b);
      const offsets=[0,Math.min(250,original.width),-Math.min(250,original.width)];
      let found=false;
      for(const dx of offsets){const dy=candidates.find(y=>(chronological!==true||inOrder(original.y+y))&&fits(y,dx));if(dy!==undefined){delta=dy;siteOffset=dx;changed=true;found=true;break;}}
      if(!found){delta=0;siteOffset=0;} // Preserve all material; the final gate reports the remaining conflict.
    }
    placements.set(String(arrow.id),{...original,y:original.y+delta});
    siteOffsets.set(String(arrow.id),siteOffset);
    occupied.push(...parts.map(b=>shifted(b,delta,siteOffset)));
    previousStart=start;previousY=original.y+delta;
  }
  return changed?{...scene,autoArrowGeometry:placements,autoSiteOffsets:siteOffsets}:null;
}

// Reuse safe existing vertical slots in chronological order when exchanging
// two automatic arrows clears all painted furniture. Dates, widths, captions,
// typography and authored positions do not participate in this repair.
function exchangeAutomaticArrowSlots(scene,svg){
  const joined=personalBandSegments(scene);
  const eligible=new Set((scene.arrows||[]).filter(arrow=>(!presentationEventObject(scene,arrow.id)?.geometry||automaticDateAnchor(scene,arrow))&&!arrow.manualOffset?.laneLocked&&!Number(arrow.manualOffset?.x)&&!Number(arrow.manualOffset?.y)&&!joined.has(arrow.id)&&!(arrow.study&&(scene.flags||[]).some(flag=>flag.examAttemptId&&flag.examAttemptId===arrow.examAttemptId))).map(arrow=>String(arrow.id)));
  const physical=resolveFounderPresentationSvg(svg,{measureText:scene.measureText}).nodes.filter(n=>n.groupId&&n.bounds&&n.groupId!=='furniture:axis'&&!n.sourceAttributes['data-board-background']&&!n.sourceAttributes['data-advanced-background']&&Number(n.style.opacity??1)>0&&Number(n.style['fill-opacity']??1)>0&&!(n.kind==='path'&&(n.lineOnly||n.style.fill==='none'||n.bounds.width<1||n.bounds.height<1)));
  const envelope=b=>{const a=(b.rotation||0)*Math.PI/180,w=Math.abs(b.width*Math.cos(a))+Math.abs(b.height*Math.sin(a)),h=Math.abs(b.width*Math.sin(a))+Math.abs(b.height*Math.cos(a));return{x:b.x+(b.width-w)/2,y:b.y+(b.height-h)/2,width:w,height:h};};
  const parts=physical.map(n=>({group:n.groupId,...envelope(n.occlusionBounds||n.bounds)}));
  const intersects=(a,b)=>a.x<b.x+b.width+6&&a.x+a.width+6>b.x&&a.y<b.y+b.height+6&&a.y+a.height+6>b.y;
  const scale=metrics(scene),layout=founderPortableLayout(scene),positions=new Map((scene.arrows||[]).map(arrow=>[String(arrow.id),geometry(arrow,layout,scale,scene)]));
  let changed=false;
  // Three bounded passes improve local reversals without recomposing the board.
  for(let pass=0;pass<3;pass++){
    let exchanged=false;
    for(let index=1;index<(scene.arrows||[]).length;index++){
      const left=scene.arrows[index-1],right=scene.arrows[index],a=positions.get(String(left.id)),b=positions.get(String(right.id));
      if(!eligible.has(String(left.id))||!eligible.has(String(right.id))||monthIndex(right.startMonth)<=monthIndex(left.startMonth)||b.y>=a.y)continue;
      const leftGroup='event:'+left.id,rightGroup='event:'+right.id;
      const shifted=parts.filter(p=>p.group===leftGroup||p.group===rightGroup).map(p=>({...p,y:p.y+(p.group===leftGroup?b.y-a.y:a.y-b.y)}));
      const occupied=parts.filter(p=>p.group!==leftGroup&&p.group!==rightGroup);
      if(!shifted.length||!shifted.every(p=>p.x>=0&&p.x+p.width<=WIDTH&&p.y>=171&&p.y+p.height<=HEIGHT-8&&!occupied.some(o=>intersects(p,o))&&!shifted.some(o=>o.group!==p.group&&intersects(p,o))))continue;
      positions.set(String(left.id),{...a,y:b.y});positions.set(String(right.id),{...b,y:a.y});
      for(const p of parts)if(p.group===leftGroup||p.group===rightGroup)p.y+=p.group===leftGroup?b.y-a.y:a.y-b.y;
      changed=true;exchanged=true;
    }
    if(!exchanged)break;
  }
  return changed?{...scene,autoArrowGeometry:positions}:null;
}

// Place native pennants and their adjacent labels in the existing upper band.
// Same-date poles remain on the same date. No title/site abbreviation or merging.
function avoidAutomaticMilestoneCollisions(scene,svg){
  const eligible=(scene.flags||[]).filter(flag=>(!presentationEventObject(scene,flag.id)?.geometry||automaticDateAnchor(scene,flag))&&
    !(flag.examAttemptId&&(scene.arrows||[]).some(a=>a.study&&a.examAttemptId===flag.examAttemptId)));
  if(!eligible.length)return null;
  const ids=new Set(eligible.map(f=>'event:'+f.id));
  const resolved=resolveFounderPresentationSvg(svg,{measureText:scene.measureText});
  const visible=n=>n.bounds&&n.groupId&&Number(n.style.opacity??1)>0&&Number(n.style['fill-opacity']??1)>0&&
    !n.sourceAttributes['data-board-background']&&!n.sourceAttributes['data-advanced-background']&&
    !(n.kind==='path'&&(n.lineOnly||n.style.fill==='none'));
  const occupied=resolved.nodes.filter(n=>visible(n)&&n.groupId!=='furniture:axis'&&!ids.has(n.groupId)).map(n=>n.occlusionBounds||n.bounds).filter(b=>b.y<125&&b.y+b.height>2);
  const intersects=(a,b)=>a.x<b.x+b.width+5&&a.x+a.width+5>b.x&&a.y<b.y+b.height+1&&a.y+a.height+1>b.y;
  const scale=metrics(scene),measure=scene.measureText||measurePresentationText;
  const entries=eligible.map(flag=>{
    const index=scene.flags.indexOf(flag),original=milestoneGeometry(flag,index,scale,scene);
    const adjacentLabel=String(flag.title||'')+(flag.siteName?' — '+String(flag.siteName):'');
    const family=/\b(?:united states(?: of america)?|u\.s\.(?:a\.?)?|usa)\b/i.test(flag.title)?TYPE.event:TYPE.arrowLabel;
    const legacyWidths=[...new Set([420,320,240,560,Math.ceil(measure(adjacentLabel,18,family))])];
    const words=adjacentLabel.split(/\s+/).filter(Boolean),breakpoints=[];
    // A prefix ending at a source word is a real wrapping breakpoint. Cap
    // these options before painting; never truncate the actual label text.
    for(let count=1;count<=Math.min(12,words.length);count++)breakpoints.push(Math.ceil(measure(words.slice(0,count).join(' '),18,family))+.5);
    const ordinaryWidths=[...new Set([...legacyWidths,...breakpoints.filter(w=>w>=64&&w<=1912)])];
    const plaque=titlePlaqueLayout(scene).plaque,poleX=original.x+4;
    // Exact board/plaque clearance widths are label-only fallback options.
    // Leave the recovered zero-offset greedy and joint candidates unchanged.
    const clearanceWidths=[poleX-24,WIDTH-poleX-76,plaque.x-5-(poleX+60),poleX-8-(plaque.x+plaque.width+5)]
      .map(width=>width-18*.12).filter(width=>width>=64&&width<=1912);
    const widths=[...new Set([...ordinaryWidths,...clearanceWidths])];
    const variants=[],seen=new Set();
    for(const width of widths)for(const flip of [false,true]){
      const variant={...scene,autoFlagLabels:new Map(scene.autoFlagLabels||[]).set(String(flag.id),{width,flip})};
      const parts=resolveFounderPresentationSvg(`<svg viewBox="0 0 1920 1080">${flagMarkup(flag,index,scale,variant)}</svg>`,{measureText:scene.measureText}).nodes.filter(visible).map(n=>({...n.occlusionBounds||n.bounds,y:(n.occlusionBounds||n.bounds).y-original.y,label:n.sourceAttributes['data-board-ink-role']==='flag-label'}));
      if(!parts.length||parts.some(b=>b.x<8||b.x+b.width>1912))continue;
      const signature=JSON.stringify(parts);
      if(seen.has(signature))continue;seen.add(signature);
      variants.push({width,flip,parts,legacy:legacyWidths.includes(width),fallbackOnly:!ordinaryWidths.includes(width)});
    }
    return{flag,original,variants,originalParts:resolved.nodes.filter(n=>visible(n)&&n.groupId==='event:'+flag.id).map(n=>n.occlusionBounds||n.bounds)};
  });
  const limit=8192;let expansions=0;
  const choices=(entry,blocked,{joint=false}={})=>{
    const found=[];
    for(const variant of entry.variants){
      if(variant.fallbackOnly||(!joint&&!variant.legacy))continue;
      const lower=Math.max(joint?-Infinity:4.5,2-Math.min(...variant.parts.map(b=>b.y)));
      const upper=Math.min(joint?Infinity:87.75,125-Math.max(...variant.parts.map(b=>b.y+b.height)));
      const ys=new Set([entry.original.y,lower,upper]);
      for(const part of variant.parts)for(const other of blocked){
        if(part.x>=other.x+other.width+5||part.x+part.width+5<=other.x)continue;
        const before=other.y-part.y-part.height-1,after=other.y+other.height-part.y+1;
        // Snap legacy choices to its old quarter-unit grid. The joint pass
        // also explores exact clearance edges within the same upper band.
        ys.add(joint?before-.01:4.5+Math.floor((before-4.5)/.25)*.25);
        ys.add(joint?after+.01:4.5+Math.ceil((after-4.5)/.25)*.25);
      }
      for(const y of ys){
        if(y<lower||y>upper)continue;
        if(joint){if(expansions>=limit)return found;expansions++;}
        const shifted=variant.parts.map(b=>({...b,y:b.y+y}));
        if(shifted.every(b=>b.y>=2&&b.y+b.height<=125&&!blocked.some(other=>intersects(b,other)))){
          const cost=(scene.autoMilestoneTopDown?y:Math.abs(y-entry.original.y))+(variant.flip?8:0)+Math.abs(variant.width-420)/40;
          found.push({...variant,y,parts:shifted,cost});
        }
      }
    }
    return found.sort((a,b)=>a.cost-b.cost||a.y-b.y||Number(a.flip)-Number(b.flip)||a.width-b.width);
  };
  // Preserve the recovered greedy result as the incumbent. Critical clearance
  // edges replace 334 trial y coordinates for every measured variant.
  const greedy=new Map();let blocked=occupied.slice();
  for(const entry of entries){
    const best=choices(entry,blocked)[0];
    if(best){greedy.set(String(entry.flag.id),best);blocked.push(...best.parts);}
    else blocked.push(...entry.originalParts);
  }
  let selected=greedy,strategy='greedy';
  if(greedy.size<entries.length){
    // Constrained labels first; date/id tie breaks remain deterministic. A
    // finite beam retains alternative early choices instead of committing
    // the first pennant and calling later conflicts globally impossible.
    const ordered=entries.slice().sort((a,b)=>a.variants.filter(variant=>!variant.fallbackOnly).length-b.variants.filter(variant=>!variant.fallbackOnly).length||monthIndex(a.flag.month)-monthIndex(b.flag.month)||String(a.flag.id).localeCompare(String(b.flag.id)));
    let states=[{placed:new Map(),blocked:occupied.slice(),cost:0}];
    for(const entry of ordered){
      const next=[];
      for(const state of states){
        for(const option of choices(entry,state.blocked,{joint:true}).slice(0,12)){
          next.push({placed:new Map(state.placed).set(String(entry.flag.id),option),blocked:[...state.blocked,...option.parts],cost:state.cost+option.cost});
        }
        if(expansions>=limit)break;
      }
      states=next.sort((a,b)=>a.cost-b.cost).slice(0,16);
      if(!states.length||expansions>=limit)break;
    }
    const complete=states.find(state=>state.placed.size===entries.length);
    if(complete){selected=complete.placed;strategy='joint';}
  }
  // Only after the recovered rigid packing fails, decouple general adjacent
  // labels from their fixed incumbent pennants. Exam/USA paint is untouched.
  const labelLimit=8192;let labelExpansions=0;
  if(selected.size<entries.length){
    const general=entries.filter(entry=>!entry.flag.examResult&&!/\b(?:united states(?: of america)?|u\.s\.(?:a\.)?|usa)\b/i.test(entry.flag.title));
    const generalIds=new Set(general.map(entry=>String(entry.flag.id))),fixed=occupied.slice();
    let bodiesFit=true;const bodyPlacements=new Map(selected);
    // The adjacent-label grammar can rescue labels only after the native
    // pennants themselves fit. Repack movable general bodies independently;
    // fixed exam/USA bodies and all painted furniture remain obstacles.
    for(const entry of [...entries.filter(item=>!generalIds.has(String(item.flag.id))),...general]){
      const incumbent=bodyPlacements.get(String(entry.flag.id)),originalY=incumbent?.y??entry.original.y;
      const variant=incumbent??entry.variants[0];
      let body=generalIds.has(String(entry.flag.id))
        ?variant?.parts.filter(part=>!part.label).map(part=>({...part,y:incumbent?part.y:part.y+originalY}))
        :incumbent?.parts??entry.originalParts;
      const fits=parts=>parts?.length&&parts.every(part=>part.y>=2&&part.y+part.height<=125&&!fixed.some(other=>intersects(part,other)));
      if(!fits(body)&&generalIds.has(String(entry.flag.id))&&body?.length){
        const relative=body.map(part=>({...part,y:part.y-originalY})),lower=2-Math.min(...relative.map(part=>part.y)),upper=125-Math.max(...relative.map(part=>part.y+part.height));
        const ys=new Set([originalY,lower,upper]);
        for(const part of relative)for(const other of fixed){
          if(part.x>=other.x+other.width+5||part.x+part.width+5<=other.x)continue;
          ys.add(other.y-part.y-part.height-1.01);ys.add(other.y+other.height-part.y+1.01);
        }
        const y=[...ys].filter(y=>y>=lower&&y<=upper).sort((a,b)=>Math.abs(a-originalY)-Math.abs(b-originalY)||a-b)
          .find(y=>fits(relative.map(part=>({...part,y:part.y+y}))));
        if(y!==undefined){body=relative.map(part=>({...part,y:part.y+y}));bodyPlacements.set(String(entry.flag.id),{...variant,y,parts:variant.parts.map(part=>({...part,y:incumbent?part.y+y-originalY:part.y+y}))});}
      }
      if(!fits(body)){bodiesFit=false;break;}
      fixed.push(...body);
    }
    if(bodiesFit&&general.length){
      const labelChoices=(entry,blocked)=>{
        const y=bodyPlacements.get(String(entry.flag.id))?.y??entry.original.y,found=[];
        for(const variant of entry.variants){
          const labels=variant.parts.filter(part=>part.label);if(!labels.length)continue;
          const lower=2-Math.min(...labels.map(part=>part.y)),upper=125-Math.max(...labels.map(part=>part.y+part.height));
          const ys=new Set([y,lower,upper]);
          for(const part of labels)for(const other of blocked){
            if(part.x>=other.x+other.width+5||part.x+part.width+5<=other.x)continue;
            ys.add(other.y-part.y-part.height-1.01);ys.add(other.y+other.height-part.y+1.01);
          }
          for(const labelY of ys){
            if(labelY<lower||labelY>upper)continue;
            if(labelExpansions>=labelLimit)return found;labelExpansions++;
            const labelParts=labels.map(part=>({...part,y:part.y+labelY}));
            if(labelParts.every(part=>!blocked.some(other=>intersects(part,other)))){
              const parts=variant.parts.map(part=>({...part,y:part.y+(part.label?labelY:y)}));
              found.push({...variant,y,yOffset:labelY-y,labelParts,parts,cost:Math.abs(labelY-y)+(variant.flip?8:0)+Math.abs(variant.width-420)/40});
            }
          }
        }
        return found.sort((a,b)=>a.cost-b.cost||Math.abs(a.yOffset)-Math.abs(b.yOffset)||a.yOffset-b.yOffset||Number(a.flip)-Number(b.flip)||a.width-b.width);
      };
      const ordered=general.slice().sort((a,b)=>b.variants[0].parts.filter(part=>part.label).length-a.variants[0].parts.filter(part=>part.label).length||monthIndex(a.flag.month)-monthIndex(b.flag.month)||String(a.flag.id).localeCompare(String(b.flag.id)));
      let states=[{placed:new Map(),blocked:fixed,cost:0}];
      for(const entry of ordered){
        const next=[];
        for(const state of states){
          for(const option of labelChoices(entry,state.blocked).slice(0,12))next.push({placed:new Map(state.placed).set(String(entry.flag.id),option),blocked:[...state.blocked,...option.labelParts],cost:state.cost+option.cost});
          if(labelExpansions>=labelLimit)break;
        }
        states=next.sort((a,b)=>a.cost-b.cost).slice(0,16);
        if(!states.length||labelExpansions>=labelLimit)break;
      }
      const complete=states.find(state=>state.placed.size===general.length);
      if(complete){selected=new Map([...selected,...complete.placed]);strategy='adjacent-label';}
    }
  }
  if(!selected.size)return null;
  const next={...scene,autoFlagGeometry:new Map(scene.autoFlagGeometry||[]),autoFlagLabels:new Map(scene.autoFlagLabels||[]),autoMilestonePacking:{strategy,expansions,limit,greedyPlaced:greedy.size,total:entries.length,labelExpansions,labelLimit}};
  for(const [id,choice] of selected){
    next.autoFlagGeometry.set(id,{y:choice.y});next.autoFlagLabels.set(id,{width:choice.width,flip:choice.flip,...(Number.isFinite(choice.yOffset)?{yOffset:choice.yOffset}:{})});
  }
  return next;
}

export function composeLocked407FPortableSvg(scene,options={}){
  const finish=result=>{
    if(!result.scene.autoYearWeights&&!result.scene.autoAxisPadding)return result;
    const axis=metrics(result.scene),factor=Math.min(1,8/Math.max(...axis.segments.map(segment=>segment.weight)));
    return {...result,scene:{...result.scene,composedAxis:{mode:'manual',startYear:axis.firstYear,endYear:axis.lastYear,includeFuture:false,
      segmentWeights:axis.segments.map(({id,weight})=>({id,weight:weight*factor}))}}};
  };
  const safety=svg=>{
    const r=resolveFounderPresentationSvg(svg,{measureText:scene.measureText});
    return 1000*r.nodes.filter(n=>n.kind==='text'&&(n.sourceAttributes['data-text-overflow']==='true'||n.bounds.x<-.5||n.bounds.y<-.5||n.bounds.x+n.bounds.width>WIDTH+.5||n.bounds.y+n.bounds.height>HEIGHT+.5)).length+materialPresentationCollisions(r).length;
  };
  const reversals=result=>{
    const scale=metrics(result.scene),layout=founderPortableLayout(result.scene);
    let count=0,previous=null;
    for(const arrow of result.scene.arrows||[]){
      const box=geometry(arrow,layout,scale,result.scene),start=monthIndex(arrow.startMonth);
      if(previous&&start>previous.start&&box.y<previous.y)count++;
      previous={start,y:box.y};
    }
    return count;
  };
  const chronologicalArrows=result=>{
    const scale=metrics(result.scene),layout=founderPortableLayout(result.scene);
    const joined=personalBandSegments(result.scene);
    const ordered=[...(result.scene.arrows||[])].filter(arrow=>!joined.has(arrow.id)&&
      (!presentationEventObject(result.scene,arrow.id)?.geometry||automaticDateAnchor(result.scene,arrow))&&
      !arrow.manualOffset?.laneLocked&&!Number(arrow.manualOffset?.x)&&!Number(arrow.manualOffset?.y)&&
      !(arrow.study&&(result.scene.flags||[]).some(flag=>flag.examAttemptId&&flag.examAttemptId===arrow.examAttemptId)))
      .sort((a,b)=>monthIndex(a.startMonth)-monthIndex(b.startMonth)||String(a.id).localeCompare(String(b.id)));
    return ordered.map(arrow=>({id:String(arrow.id),start:monthIndex(arrow.startMonth),y:geometry(arrow,layout,scale,result.scene).y}));
  };
  const stairPenalty=result=>{
    // Larger legacy boards retain the recovered bounded neighboring-slot score.
    // The stronger normal-case search is bounded to ten movable durations.
    if((result.scene.arrows||[]).length>10){
      const scale=metrics(result.scene),layout=founderPortableLayout(result.scene),sourceOrder=new Map((result.scene.events||[]).map((event,index)=>[String(event.id),index]));
      const ordered=[...(result.scene.arrows||[])].sort((a,b)=>monthIndex(a.startMonth)-monthIndex(b.startMonth)||(sourceOrder.get(String(a.id))??0)-(sourceOrder.get(String(b.id))??0));
      let count=0,previous=null;for(const arrow of ordered){const start=monthIndex(arrow.startMonth),y=geometry(arrow,layout,scale,result.scene).y;if(previous&&start>previous.start&&y<previous.y)count++;previous={start,y};}return count;
    }
    const ordered=chronologicalArrows(result);let count=0;
    // Compare all distinct start pairs, not just neighboring events. The
    // native 18px label size sets a minimum stair, with exact-start exceptions.
    for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
      const a=ordered[i],b=ordered[j];if(a.start===b.start)continue;
      if(b.y<a.y+18)count+=1+(a.y+18-b.y)/HEIGHT;
    }
    return count;
  };
  const preservesOrder=(before,after)=>{
    if((before.scene.arrows||[]).length>10)return true;
    const original=chronologicalArrows(before),next=new Map(chronologicalArrows(after).map(item=>[item.id,item]));
    for(let i=0;i<original.length;i++)for(let j=i+1;j<original.length;j++){
      const a=original[i],b=original[j];if(a.start===b.start||a.y>b.y)continue;
      if(next.get(a.id)?.y>next.get(b.id)?.y)return false;
    }
    return true;
  };
  const place=(input,chronological)=>{
    let placed=input,svg=serializePlacedPortableSvg(placed,options);
    const flags=avoidAutomaticMilestoneCollisions(placed,svg);
    if(flags){placed=flags;svg=serializePlacedPortableSvg(placed,options);}
    const arrows=avoidAutomaticArrowCollisions(placed,svg,{chronological});
    if(arrows){placed=arrows;svg=serializePlacedPortableSvg(placed,options);}
    return{scene:placed,svg};
  };
  const compose=input=>{
    const original=place(input,false);
    // Restore the earlier sorted-start stair only when equally safe. Keep the
    // verified current placement if dense furniture leaves no legal stair.
    if(!stairPenalty(original))return finish(original);
    let best=original;
    const exchanged=exchangeAutomaticArrowSlots(original.scene,original.svg);
    const chronologicalTrial=chronological=>{
      const arrows=avoidAutomaticArrowCollisions(original.scene,original.svg,{chronological});
      return arrows?{scene:arrows,svg:serializePlacedPortableSvg(arrows,options)}:original;
    };
    const neighborReversals=result=>{
      const scale=metrics(result.scene),layout=founderPortableLayout(result.scene),sourceOrder=new Map((result.scene.events||[]).map((event,index)=>[String(event.id),index]));
      const ordered=[...(result.scene.arrows||[])].sort((a,b)=>monthIndex(a.startMonth)-monthIndex(b.startMonth)||(sourceOrder.get(String(a.id))??0)-(sourceOrder.get(String(b.id))??0));
      let count=0,previous=null;for(const arrow of ordered){const start=monthIndex(arrow.startMonth),y=geometry(arrow,layout,scale,result.scene).y;if(previous&&start>previous.start&&y<previous.y)count++;previous={start,y};}return count;
    };
    // Keep the recovered safe nearest-slot repair as an incumbent. The stronger
    // all-pairs staircase may improve it, but cannot undo an already ordered pair.
    for(const candidate of [...(exchanged?[{scene:exchanged,svg:serializePlacedPortableSvg(exchanged,options)}]:[]),chronologicalTrial('nearest')])
      if(safety(candidate.svg)<=safety(original.svg)&&neighborReversals(candidate)<neighborReversals(best))best=candidate;
    const stair=(input.arrows||[]).length<=10?chronologicalTrial(true):best;
    if(safety(stair.svg)<=safety(best.svg)&&preservesOrder(best,stair)&&stairPenalty(stair)<stairPenalty(best))best=stair;
    return finish(best);
  };
  let best=compose(scene);
  // Nonuniform year widths are present in the Founder exemplar. Existing
  // authored axes, lanes and event geometry are preserved.
  if(scene.founderPresentation?.axis?.mode==='manual'||(scene.arrows||[]).some(a=>a.manualOffset?.laneLocked||Number(a.manualOffset?.x)||Number(a.manualOffset?.y)||(presentationEventObject(scene,a.id)?.geometry&&!automaticDateAnchor(scene,a)))||(scene.flags||[]).some(f=>presentationEventObject(scene,f.id)?.geometry&&!automaticDateAnchor(scene,f)))return finish(best);
  const score=svg=>{const r=resolveFounderPresentationSvg(svg,{measureText:scene.measureText});return 1000*r.nodes.filter(n=>n.kind==='text'&&(n.bounds.x<-.5||n.bounds.y<-.5||n.bounds.x+n.bounds.width>WIDTH+.5||n.bounds.y+n.bounds.height>HEIGHT+.5)).length+materialPresentationCollisions(r).length;};
  let bestScore=score(best.svg);if(!bestScore)return best;
  if(!scene.showEmptySlots&&!scene.founderPresentation?.profileGeometryExplicit){
    const compact=compose({...scene,autoCompactProfile:true}),compactScore=score(compact.svg);
    if(compactScore<bestScore){best=compact;bestScore=compactScore;if(!bestScore)return best;}
  }
  const counts=new Map();
  const count=month=>{const year=Math.floor(monthIndex(month)/12);counts.set(year,(counts.get(year)||0)+1);};
  for(const arrow of scene.arrows||[]){
    count(arrow.startMonth);count(arrow.endMonth);
    const first=Math.floor(monthIndex(arrow.startMonth)/12),last=Math.floor(monthIndex(arrow.endMonth)/12);
    const pressure=(scene.measureText||measurePresentationText)([arrow.title,arrow.siteName].filter(Boolean).join(' '),18,TYPE.arrowLabel)/160;
    for(let year=first;year<=last;year++)counts.set(year,(counts.get(year)||0)+pressure/Math.max(1,last-first+1)+.5);
  }
  for(const flag of scene.flags||[]){count(flag.month);const year=Math.floor(monthIndex(flag.month)/12);counts.set(year,(counts.get(year)||0)+(scene.measureText||measurePresentationText)([flag.title,flag.siteName].filter(Boolean).join(' '),18,TYPE.arrowLabel)/160);}
  // Close, distinct native pennant dates create stronger boundary pressure
  // than a count of endpoints. Keep quiet years readable through metrics' 80px
  // floor, and try only two bounded emphasis levels before the label refinements.
  const flagMonths=new Map();for(const flag of scene.flags||[]){const month=monthIndex(flag.month),year=Math.floor(month/12);flagMonths.set(year,[...(flagMonths.get(year)||[]),month]);}
  const boundaryDemand=new Map();
  for(const [year,months] of flagMonths){const sorted=[...new Set(months)].sort((a,b)=>a-b);for(let index=1;index<sorted.length;index++)boundaryDemand.set(year,Math.max(boundaryDemand.get(year)||0,57*12/(sorted[index]-sorted[index-1])));}
  for(const emphasis of [8,16]){
    if(!boundaryDemand.size)break;
    const weights=new Map([...boundaryDemand].map(([year,width])=>[year,Math.max(1,Math.min(emphasis,width/80*emphasis/4))]));
    const candidate=compose({...scene,autoYearWeights:weights}),candidateScore=score(candidate.svg);
    if(candidateScore<bestScore||(candidateScore===bestScore&&preservesOrder(best,candidate)&&reversals(candidate)<reversals(best))){best=candidate;bestScore=candidateScore;}
  }
  for(const strength of [.5,1,2,4]){
    const weights=new Map([...counts].map(([year,count])=>[year,Math.min(8,1+Math.sqrt(count)*strength)]));
    const candidate=compose({...scene,autoYearWeights:weights}),candidateScore=score(candidate.svg);
    if(candidateScore<bestScore){best=candidate;bestScore=candidateScore;if(!bestScore)break;}
  }
  // Context beside the existing year ribbon can also keep simultaneous duration
  // arrows clear of the fixed legend and photos. Search at most one empty year
  // per side, retaining separately labelled years and linear month mapping.
  // This never creates an event or changes a date; authored axes return above.
  if(bestScore&&(scene.flags?.length>1||scene.arrows?.length)){
    for(const autoAxisPadding of [null,{before:0,after:1},{before:1,after:0},{before:1,after:1}]){
      // Retain the selected widths; recompute placements from the original scene.
      const candidate=compose({...scene,autoYearWeights:best.scene.autoYearWeights,autoAxisPadding,autoMilestoneTopDown:true}),candidateScore=score(candidate.svg);
      const flagPenalty=result=>[...(result.scene.autoFlagLabels?.values()||[])].reduce((sum,label)=>sum+(label.flip?1:0),0)+
        resolveFounderPresentationSvg(result.svg,{measureText:scene.measureText}).nodes.filter(n=>n.sourceAttributes['data-board-ink-role']==='flag-label').length;
      if(candidateScore<bestScore||(candidateScore===bestScore&&flagPenalty(candidate)<flagPenalty(best))){best=candidate;bestScore=candidateScore;}
    }
  }
  return finish(best);
}

export function serializeLocked407FPortableSvg(scene,options={}){
  return composeLocked407FPortableSvg(scene,options).svg;
}

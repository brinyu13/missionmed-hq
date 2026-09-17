/*
 * Verbatim renderer contract recovered from the locked 407F implementation.
 *
 * Authority:
 *   (D1)-MacProTimeline-Fable5-DefinitiveFullProductPrototype-407F.html
 *   SHA-256 23e0f5d420b69cd90da3f04b30e5752183aff41c737860ec30fc4ccbb87beb6b
 *
 * The asset files referenced here are byte-for-byte extractions of that
 * document's ASSETS and SPR402 objects. The CSS geometry below intentionally
 * preserves the locked renderer's values instead of translating the artifact
 * into a new SVG/CSS visual language.
 */

import {LOCKED_407F_DATA_URLS} from "../../assets/locked_407f/data-urls.js";

export const LOCKED_407F_SOURCE_SHA256=
  "23e0f5d420b69cd90da3f04b30e5752183aff41c737860ec30fc4ccbb87beb6b";

export const LOCKED_407F_GEOMETRY=Object.freeze({
  width:1920,
  height:1080,
  axisTop:64,
  axisHeight:34,
  laneTop:132,
  lanePitch:46,
  condensedLanePitch:32,
  arrowHeight:30,
  capWidth:9,
  headWidth:15,
  minimumArrowWidth:52,
  horizontalInsetPercent:2
});

export const LOCKED_407F_ASSETS=Object.freeze({
  board:LOCKED_407F_DATA_URLS.assets.board,
  plaque:LOCKED_407F_DATA_URLS.assets.plaque,
  paper:LOCKED_407F_DATA_URLS.assets.paper,
  sticky:LOCKED_407F_DATA_URLS.assets.sticky,
  pin:LOCKED_407F_DATA_URLS.assets.pin,
  flag:LOCKED_407F_DATA_URLS.assets.flag,
  key:LOCKED_407F_DATA_URLS.assets.key,
  axis:LOCKED_407F_DATA_URLS.sprites.axis.body,
  flagGray:LOCKED_407F_DATA_URLS.sprites.flagGray,
  flagPersonal:LOCKED_407F_DATA_URLS.sprites.flagPers,
  arrows:Object.freeze({
    work:Object.freeze({
      cap:LOCKED_407F_DATA_URLS.sprites.work.cap,
      body:LOCKED_407F_DATA_URLS.sprites.work.body,
      head:LOCKED_407F_DATA_URLS.sprites.work.head
    }),
    usmle:Object.freeze({
      cap:LOCKED_407F_DATA_URLS.sprites.usmle.cap,
      body:LOCKED_407F_DATA_URLS.sprites.usmle.body,
      head:LOCKED_407F_DATA_URLS.sprites.usmle.head
    }),
    th:Object.freeze({
      cap:LOCKED_407F_DATA_URLS.sprites.th.cap,
      body:LOCKED_407F_DATA_URLS.sprites.th.body,
      head:LOCKED_407F_DATA_URLS.sprites.th.head
    }),
    cl:Object.freeze({
      cap:LOCKED_407F_DATA_URLS.sprites.cl.cap,
      body:LOCKED_407F_DATA_URLS.sprites.cl.body,
      head:LOCKED_407F_DATA_URLS.sprites.cl.head
    }),
    personal:Object.freeze({
      cap:LOCKED_407F_DATA_URLS.sprites.personal.cap,
      body:LOCKED_407F_DATA_URLS.sprites.personal.body,
      head:LOCKED_407F_DATA_URLS.sprites.personal.head
    }),
    res:Object.freeze({
      cap:LOCKED_407F_DATA_URLS.sprites.res.cap,
      body:LOCKED_407F_DATA_URLS.sprites.res.body,
      head:LOCKED_407F_DATA_URLS.sprites.res.head
    })
  })
});

const CATEGORY_PRESENTATION=Object.freeze({
  work:Object.freeze({slug:"work",label:"Work Experience",color:"#3f9b52"}),
  education:Object.freeze({slug:"work",label:"Education",color:"#3f9b52"}),
  exams:Object.freeze({slug:"usmle",label:"USMLE Studies",color:"#3a78c9"}),
  clinical:Object.freeze({slug:"th",label:"USCE: Teaching Hospital",color:"#c8641c"}),
  personal:Object.freeze({slug:"personal",label:"Personal / Not on CV",color:"#8a5bbf"}),
  research:Object.freeze({slug:"res",label:"Research Experience",color:"#d4b636"})
});

const CANONICAL_COLOR_KEY=Object.freeze([
  Object.freeze({label:"Work Experience",color:"#3f9b52"}),
  Object.freeze({label:"Personal / Not on CV",color:"#8a5bbf"}),
  Object.freeze({label:"USMLE Studies",color:"#3a78c9"}),
  Object.freeze({label:"USCE: Teaching Hospital",color:"#c8641c"}),
  Object.freeze({label:"USCE: Clinics",color:"#e89b3c"}),
  Object.freeze({label:"Research Experience",color:"#d4b636"})
]);

function escapeMarkup(value){
  return String(value??"").replace(/[&<>"']/g,(character)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  })[character]);
}

function monthIndex(value){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  if(!match)return 0;
  return Number(match[1])*12+(Number(match[2])-1);
}

const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatMonth(value){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  if(!match)return"";
  return`${MONTHS[Number(match[2])-1]} ${match[1]}`;
}

function timelineMetrics(scene){
  const months=[
    ...(scene?.arrows||[]).flatMap((arrow)=>[arrow.startMonth,arrow.endMonth]),
    ...(scene?.flags||[]).map((flag)=>flag.month),
    scene?.interviewMarker?.month
  ].filter(Boolean).map(monthIndex);
  const firstYear=months.length?Math.floor(Math.min(...months)/12):Number(scene?.span?.firstYear);
  const lastYear=months.length?Math.floor(Math.max(...months)/12):Number(scene?.span?.lastYear);
  const safeFirst=Number.isFinite(firstYear)?firstYear:new Date().getUTCFullYear();
  const safeLast=Number.isFinite(lastYear)?Math.max(safeFirst+1,lastYear):safeFirst+1;
  const totalMonths=(safeLast-safeFirst+1)*12;
  return{
    firstYear:safeFirst,
    lastYear:safeLast,
    totalMonths,
    xPercent:(month)=>2+((monthIndex(month)-safeFirst*12)/totalMonths)*96,
    widthPercent:(start,end)=>(
      (monthIndex(end)-monthIndex(start)+1)/totalMonths
    )*96
  };
}

export function locked407FComposition(scene={}){
  const arrows=Array.isArray(scene.arrows)?scene.arrows:[];
  const laneCount=Math.max(
    1,
    ...arrows.map((arrow)=>Number(arrow.lane||0)+1)
  );
  const density=arrows.length<=3?"sparse":arrows.length<=9?"medium":"dense";
  const condensed=density==="dense"||arrows.some((arrow)=>arrow.condensed);
  const tight=density==="dense"&&laneCount>13;
  const laneTop=density==="sparse"?190:density==="medium"?154:132;
  const lanePitch=density==="sparse"
    ?Math.min(118,Math.max(86,310/Math.max(1,laneCount-1)))
    :density==="medium"
      ?Math.min(64,430/Math.max(1,laneCount-1))
      :tight
        ?Math.max(30,Math.min(38,560/Math.max(1,laneCount-1)))
        :LOCKED_407F_GEOMETRY.lanePitch;
  const eventBottom=laneTop+(laneCount-1)*lanePitch+LOCKED_407F_GEOMETRY.arrowHeight;
  return Object.freeze({
    density,
    laneCount,
    condensed,
    tight,
    laneTop,
    lanePitch,
    eventBottom,
    eventBandTop:laneTop-24,
    eventBandBottom:Math.min(760,Math.max(390,eventBottom+52))
  });
}

function arrowPresentation(arrow){
  const category=CATEGORY_PRESENTATION[arrow.categoryId]||CATEGORY_PRESENTATION.work;
  if(
    arrow.categoryId==="clinical"&&
    /clinic|ambulatory|outpatient/i.test(arrow.siteName)
  ){
    return{...category,slug:"cl"};
  }
  return category;
}

function styleUrl(url){
  return`url(&quot;${escapeMarkup(url)}&quot;)`;
}

function axisMarkup(scene,metrics){
  const years=[];
  for(let year=metrics.firstYear;year<=metrics.lastYear;year+=1)years.push(year);
  return`<div class="locked407F-axis" data-layer="axis" data-axis-language="407f-powerpoint">${
    years.map((year)=>`<div class="locked407F-yseg" data-segment-kind="year"><span>${year}</span></div>`).join("")
  }</div><div class="locked407F-axNote">AXIS ${metrics.firstYear}-${metrics.lastYear} · CALIBRATED FROM YOUR DATES · JAN LEFT · DEC RIGHT</div>`;
}

function arrowMarkup(arrow,metrics,composition){
  const presentation=arrowPresentation(arrow);
  const sprites=LOCKED_407F_ASSETS.arrows[presentation.slug];
  const x=metrics.xPercent(arrow.startMonth);
  const width=Math.max(
    metrics.widthPercent(arrow.startMonth,arrow.endMonth),
    0
  );
  const top=composition.laneTop+Number(arrow.lane||0)*composition.lanePitch;
  const start=formatMonth(arrow.startMonth);
  const end=arrow.openEnded?"Present":formatMonth(arrow.endMonth);
  const duration=monthIndex(arrow.endMonth)-monthIndex(arrow.startMonth)+1;
  const dates=duration>=6
    ?`<div class="locked407F-ads">${escapeMarkup(start)}</div><div class="locked407F-ade">${escapeMarkup(end)}</div>`
    :`<div class="locked407F-ads">${escapeMarkup(start)} - ${escapeMarkup(end)}</div>`;
  const site=arrow.siteName
    ?`<div class="locked407F-aloc">${escapeMarkup(arrow.siteName)}</div>`
    :"";
  const lor=arrow.lorSubmitted
    ?`<span class="locked407F-lor" data-lor-submitted="true" role="img" aria-label="LOR submitted">★</span>`
    :"";
  const chip=arrow.actionChip
    ?`<span class="locked407F-actionChip" data-study-action-chip="${escapeMarkup(arrow.actionChip.targetAttemptId||"")}">${escapeMarkup(arrow.actionChip.label||"Set retake date")}</span>`
    :"";
  return`<div class="locked407F-arrow spr" data-event-kind="arrow" data-event-id="${escapeMarkup(arrow.id)}" data-category="${escapeMarkup(arrow.categoryId)}" data-lane="${Number(arrow.lane||0)}" data-open-ended="${arrow.openEnded}" data-study="${arrow.study}" aria-label="${escapeMarkup(arrow.ariaLabel)}" style="left:${x}%;width:${width}%;min-width:${LOCKED_407F_GEOMETRY.minimumArrowWidth}px;top:${top}px;--ac:${presentation.color};--sc:${styleUrl(sprites.cap)};--sb:${styleUrl(sprites.body)};--sh:${styleUrl(sprites.head)}">${dates}${site}<div class="locked407F-al">${escapeMarkup(arrow.title)}</div>${lor}${chip}</div>`;
}

function flagMarkup(flag,index,metrics){
  const x=metrics.xPercent(flag.month);
  const personal=flag.categoryId==="personal";
  const source=personal?LOCKED_407F_ASSETS.flagPersonal:LOCKED_407F_ASSETS.flagGray;
  return`<div class="locked407F-flag${personal?" personal":""}" data-event-kind="flag" data-event-id="${escapeMarkup(flag.id)}" data-category="${escapeMarkup(flag.categoryId)}" aria-label="${escapeMarkup(flag.ariaLabel)}" style="left:${x}%;top:${index%2===0?14:30}px;--fm:${styleUrl(source)}"><div class="locked407F-fl8">${escapeMarkup(flag.title)}</div><div class="locked407F-fmark"></div><div class="locked407F-fdate">${escapeMarkup(formatMonth(flag.month))}</div><div class="locked407F-pole" style="height:${index%2===0?40:26}px"></div></div>`;
}

function colorKeyMarkup(scene){
  return`<div class="locked407F-ckey" data-artifact-chrome="color-key"><div class="locked407F-pin"></div><div class="locked407F-ct">COLOR KEY</div>${
    CANONICAL_COLOR_KEY.map((category)=>`<div class="locked407F-cr"><span class="locked407F-cs" style="background:${category.color}"></span>${escapeMarkup(category.label)}</div>`).join("")
  }${scene?.lorLegend?.visible?`<div class="locked407F-cr" data-lor-legend="true"><span class="locked407F-lorKey">★</span>${escapeMarkup(scene.lorLegend.label||"LOR submitted")}</div>`:""}</div>`;
}

function profileMarkup(scene){
  const profile=scene.profile||{};
  const rows=[
    ["Medical school",profile.medicalSchool],
    ["Degree",profile.degree],
    ["Status",profile.status],
    ["Step 1",profile.step1],
    ["Step 2 CK",profile.step2],
    ["Specialty",profile.specialty]
  ].filter(([,value])=>String(value||"").trim());
  const title=String(profile.fullName||"").trim()||"Student profile";
  return`<div class="locked407F-pcard" data-artifact-chrome="profile"><div class="locked407F-ph" data-profile-photo-slot="true">PROFILE<br/>PHOTO</div><div class="locked407F-pt">${escapeMarkup(title)}</div>${rows.map(([label,value])=>`<b>${escapeMarkup(label)}:</b> ${escapeMarkup(value)}<br/>`).join("")}</div>`;
}

function photosMarkup(){
  return`<div class="locked407F-photos" data-artifact-chrome="photo-frames">${
    [1,2,3].map((index)=>`<div class="locked407F-pframe" data-artifact-photo-frame="${index}"><div class="locked407F-pin2">DROP<br/>PHOTO ${index}</div></div>`).join("")
  }</div>`;
}

function interviewMarkup(scene,metrics){
  const target=scene.interviewTarget||{};
  const marker=scene.interviewMarker;
  const program=String(target.programName||target.prog||"PROGRAM LOGO").trim();
  const label=String(target.label||"YOUR BIG INTERVIEW").trim();
  const date=marker?.month?formatMonth(marker.month):"Date pending";
  const axisMarker=marker
    ?`<div class="locked407F-flag locked407F-interviewFlag" data-event-kind="interview-marker" aria-label="${escapeMarkup(marker.ariaLabel)}" style="left:${metrics.xPercent(marker.month)}%;top:14px;--fm:${styleUrl(LOCKED_407F_ASSETS.flagGray)}"><div class="locked407F-fl8">Interview</div><div class="locked407F-fmark"></div><div class="locked407F-fdate">${escapeMarkup(date)}</div><div class="locked407F-pole" style="height:40px"></div></div>`
    :"";
  return`${axisMarker}<div class="locked407F-ribbonWrap" data-interview-destination="407f-ribbon"><div class="locked407F-logoSlot">${escapeMarkup(program.toUpperCase())}</div><div class="locked407F-ribbon">${escapeMarkup(label)}</div><div class="locked407F-ribDate">${marker?`Interview · ${escapeMarkup(date)}`:"Date pending"}</div></div>`;
}

function explanationsMarkup(scene){
  return(scene.explanations||[]).map((explanation,index)=>{
    const x=Number.isFinite(Number(explanation.x))?Number(explanation.x):1691-index*190;
    const y=Number.isFinite(Number(explanation.y))?Number(explanation.y):497+index*110;
    const width=Math.max(132,Number(explanation.width)||132);
    const height=Math.max(96,Number(explanation.height)||96);
    const connection=locked407FExplanationConnection(scene,{
      ...explanation,x,y,width,height
    });
    const leader=explanation.leaderEnabled&&connection.bodyLength>0
      ?`<span data-explanation-leader="true" data-target-event-id="${escapeMarkup(connection.targetEventId||"")}" data-target-x="${connection.target.x}" data-target-y="${connection.target.y}" class="locked407F-explanationLeader" aria-hidden="true" style="left:${connection.source.x}px;top:${connection.source.y}px;width:${connection.bodyLength}px;transform:rotate(${connection.angle}deg)"></span>`
      :"";
    return`${leader}<div class="locked407F-sticky" data-event-kind="explanation" data-event-id="${escapeMarkup(explanation.id)}" data-explanation-card="true" aria-label="${escapeMarkup(explanation.ariaLabel)}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px">${escapeMarkup(explanation.text)}</div>`;
  }).join("");
}

function boundaryPoint(box,toward){
  const center={x:box.x+box.width/2,y:box.y+box.height/2};
  const dx=Number(toward.x)-center.x;
  const dy=Number(toward.y)-center.y;
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||(!dx&&!dy))return center;
  const halfWidth=Math.max(.5,box.width/2);
  const halfHeight=Math.max(.5,box.height/2);
  const scale=1/Math.max(Math.abs(dx)/halfWidth,Math.abs(dy)/halfHeight);
  return{x:center.x+dx*scale,y:center.y+dy*scale};
}

export function locked407FExplanationConnection(scene,explanation,{
  xAtPercent=(percent)=>1+(LOCKED_407F_GEOMETRY.width-2)*Number(percent)/100,
  widthAtPercent=(percent)=>(LOCKED_407F_GEOMETRY.width-2)*Number(percent)/100,
  coordinateOffset=1
}={}){
  const metrics=timelineMetrics(scene);
  const composition=locked407FComposition(scene);
  const targetEventId=String(explanation?.target?.eventId||"");
  const arrow=(scene?.arrows||[]).find(({id})=>String(id)===targetEventId);
  const flagIndex=(scene?.flags||[]).findIndex(({id})=>String(id)===targetEventId);
  let targetBox=null;
  if(arrow){
    targetBox={
      x:xAtPercent(metrics.xPercent(arrow.startMonth)),
      y:coordinateOffset+composition.laneTop+Number(arrow.lane||0)*composition.lanePitch,
      width:Math.max(
        LOCKED_407F_GEOMETRY.minimumArrowWidth,
        widthAtPercent(metrics.widthPercent(arrow.startMonth,arrow.endMonth))
      ),
      height:LOCKED_407F_GEOMETRY.arrowHeight
    };
  }else if(flagIndex>=0){
    const flag=scene.flags[flagIndex];
    targetBox={
      x:xAtPercent(metrics.xPercent(flag.month)),
      y:coordinateOffset+(flagIndex%2===0?14:30),
      width:22,
      height:38
    };
  }else{
    const targetX=Number(explanation?.target?.x);
    const targetY=Number(explanation?.target?.y);
    const x=Number.isFinite(targetX)?targetX:LOCKED_407F_GEOMETRY.width/2;
    const y=Number.isFinite(targetY)?targetY:LOCKED_407F_GEOMETRY.axisTop;
    targetBox={x:x-.5,y:y-.5,width:1,height:1};
  }
  const sourceBox={
    x:Number(explanation?.x)||0,
    y:Number(explanation?.y)||0,
    width:Math.max(132,Number(explanation?.width)||132),
    height:Math.max(96,Number(explanation?.height)||96)
  };
  const sourceCenter={
    x:sourceBox.x+sourceBox.width/2,
    y:sourceBox.y+sourceBox.height/2
  };
  const targetCenter={
    x:targetBox.x+targetBox.width/2,
    y:targetBox.y+targetBox.height/2
  };
  const source=boundaryPoint(sourceBox,targetCenter);
  const target=boundaryPoint(targetBox,sourceCenter);
  const dx=target.x-source.x;
  const dy=target.y-source.y;
  const distance=Math.hypot(dx,dy);
  return Object.freeze({
    source:Object.freeze(source),
    target:Object.freeze(target),
    targetBox:Object.freeze(targetBox),
    targetEventId:targetEventId||null,
    distance,
    bodyLength:Math.max(0,distance-9),
    angle:Math.atan2(dy,dx)*180/Math.PI
  });
}

function themeBoardBackground(theme){
  const board=theme?.board;
  if(!board||theme?.id==="keynote-classic")return"";
  if(board.css)return String(board.css);
  if(board.kind==="flat")return String(board.color||"");
  if(board.kind==="radial-gradient")return`radial-gradient(at ${board.position||"50% 30%"}, ${board.start} 0%, ${board.end} 100%)`;
  if(board.kind==="horizon-band")return`linear-gradient(180deg, ${board.band?.start||"#FFF7EA"} 0%, ${board.band?.end||"transparent"} ${board.band?.endPercent||26}%), ${board.color||"#FDFCF9"}`;
  if(board.start&&board.end)return`linear-gradient(${board.angle||165}deg, ${board.start}, ${board.end})`;
  return"";
}

const LOCKED_CSS=`
.locked407FBoard,.locked407FBoard *{box-sizing:border-box}
.locked407FBoard{position:relative;width:1920px;height:1080px;overflow:hidden;border:1px solid #31405c;font-family:Archivo,system-ui,sans-serif;color:#e8eefb;background:var(--themeBoard,radial-gradient(ellipse at 18% 18%,rgba(57,214,255,.18),transparent 35%),radial-gradient(ellipse at 84% 14%,rgba(255,179,64,.15),transparent 30%),radial-gradient(ellipse at 52% 82%,rgba(138,125,255,.16),transparent 42%),linear-gradient(rgba(232,238,251,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(232,238,251,.025) 1px,transparent 1px),linear-gradient(135deg,#07101d 0%,#101827 46%,#070a12 100%));background-size:100% 100%,100% 100%,100% 100%,34px 34px,34px 34px,100% 100%;background-position:0 0,0 0,0 0,0 0,0 0,0 0}
.locked407FBoard:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;opacity:.22;background:repeating-linear-gradient(115deg,rgba(255,255,255,.018) 0 2px,transparent 2px 5px),radial-gradient(ellipse at 50% 38%,transparent 44%,rgba(3,6,12,.55) 88%)}
.locked407F-plaque{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:6;background:transparent var(--kbPlaque) 0 0/100% 100% no-repeat;color:#111827;padding:13px 46px;border-radius:3px;box-shadow:0 8px 20px rgba(20,30,50,.35);font-weight:800;font-size:19px;letter-spacing:-.01em;white-space:nowrap}
.locked407F-axis{position:absolute;left:2%;right:2%;top:64px;z-index:4;display:flex;height:34px}
.locked407F-yseg{position:relative;height:100%;flex:1;display:grid;place-items:center;background-image:var(--axisSprite);background-repeat:repeat-x;background-size:auto 100%;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%);margin-right:-9px}
.locked407F-yseg span{font-family:Rajdhani,sans-serif;font-weight:700;font-size:15px;color:#dbe6f8;letter-spacing:.08em}
.locked407F-axNote{position:absolute;top:104px;left:2.2%;z-index:4;font-family:Rajdhani,sans-serif;font-size:9px;font-weight:700;letter-spacing:.24em;color:#9fb0cd;text-shadow:0 1px 4px rgba(0,0,0,.72)}
.locked407F-arrow{position:absolute;height:30px;z-index:5;cursor:grab;background-color:var(--ac,#3f9b52);background-image:var(--sb);background-repeat:repeat-x;background-size:auto 100%;filter:drop-shadow(0 2px 2px rgba(20,30,50,.35));touch-action:none}
.locked407F-arrow:before{content:"";position:absolute;left:0;top:0;bottom:0;width:9px;background-image:var(--sc);background-size:100% 100%;background-repeat:no-repeat}
.locked407F-arrow:after{content:"";position:absolute;right:0;top:0;bottom:0;width:15px;background-image:var(--sh);background-size:100% 100%;background-repeat:no-repeat}
.locked407F-al{position:absolute;inset:0 18px 0 10px;display:grid;place-items:center;font-weight:600;font-size:11px;color:#fff;letter-spacing:.01em;text-shadow:0 1px 2px rgba(0,0,0,.55);white-space:nowrap;overflow:hidden;pointer-events:none}
.locked407F-ads,.locked407F-ade{position:absolute;top:-16px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:10px;color:#d8e5f7;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.88);pointer-events:none}.locked407F-ads{left:0}.locked407F-ade{right:8px}
.locked407F-aloc{position:absolute;right:calc(100% + 8px);top:7px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:10.5px;color:#d8e5f7;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.88);pointer-events:none}
.locked407F-lor{position:absolute;right:18px;top:-10px;z-index:7;width:20px;height:22px;display:grid;place-items:center;background:#f3e7b3;color:#6c5018;border:1px solid #8c6b20;clip-path:polygon(0 0,100% 0,100% 100%,50% 76%,0 100%);font-size:12px;text-shadow:none}
.locked407F-actionChip{position:absolute;right:15px;top:36px;padding:4px 9px;border-radius:12px;background:#b98a2e;color:#191c21;border:1px solid #a67a26;font:700 10px Rajdhani,sans-serif;white-space:nowrap}
.locked407F-flag{position:absolute;z-index:5;transform:translateX(-1px)}.locked407F-fl8{position:absolute;top:-13px;left:12px;white-space:nowrap;font-family:Rajdhani,sans-serif;font-weight:700;font-size:10px;color:#d8e5f7;letter-spacing:.05em;text-shadow:0 1px 4px rgba(0,0,0,.88)}.locked407F-fmark{width:22px;height:38px;background-image:var(--fm);background-size:contain;background-repeat:no-repeat;margin-left:1px}.locked407F-fdate{transform:translateX(-30%);font:700 9px Rajdhani,sans-serif;color:#d8e5f7;white-space:nowrap}.locked407F-pole{width:2px;background:#55617e;margin:0 auto}
.locked407F-ckey{position:absolute;z-index:6;left:2.2%;top:44%;width:186px;background:transparent var(--kbKey) 0 0/100% 100% no-repeat;color:#171d26;border-radius:3px;padding:16px 16px 18px}.locked407F-pin{position:absolute;top:-11px;left:50%;width:20px;height:20px;transform:translateX(-50%);background:transparent var(--kbPin) center/contain no-repeat}.locked407F-ct{font-weight:900;font-size:11px;letter-spacing:.08em;color:#a8402f;margin-bottom:7px}.locked407F-cr{display:flex;align-items:center;gap:8px;font-weight:600;font-size:10.5px;margin:4px 0}.locked407F-cs{width:15px;height:11px;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2);flex:none}.locked407F-lorKey{width:15px;text-align:center;color:#6c5018}
.locked407F-pcard{position:absolute;z-index:6;left:2.2%;bottom:16px;width:240px;background:transparent var(--kbPaper) 0 0/100% 100% no-repeat;color:#171d26;border-radius:3px;padding:16px 18px 14px;box-shadow:0 10px 24px rgba(20,30,50,.35);font-size:10.5px;line-height:1.55}.locked407F-pcard b{font-weight:800}.locked407F-ph{float:right;width:56px;height:62px;margin:0 0 6px 8px;background:#c9c2ae;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);display:grid;place-items:center;font:700 9px Rajdhani,sans-serif;color:#6d6753;text-align:center}.locked407F-pt{font-weight:900;font-size:12px;margin-bottom:4px}
.locked407F-photos{position:absolute;z-index:6;bottom:18px;left:50%;transform:translateX(-46%);display:flex;gap:10px}.locked407F-pframe{width:92px;height:104px;background:#fdfbf4;border-radius:2px;box-shadow:0 8px 20px rgba(0,0,0,.55);padding:6px 6px 22px}.locked407F-pframe:nth-child(odd){transform:rotate(-3deg)}.locked407F-pframe:nth-child(even){transform:rotate(2.5deg)}.locked407F-pin2{width:100%;height:100%;background:linear-gradient(160deg,#232d42,#39465f);display:grid;place-items:center;font:700 8.5px/1.6 Rajdhani,sans-serif;letter-spacing:.14em;color:#9fb0cd;text-align:center}
.locked407F-ribbonWrap{position:absolute;z-index:6;right:2.4%;top:96px;width:190px;text-align:center}.locked407F-logoSlot{height:52px;border:1px dashed rgba(38,49,77,.45);border-radius:3px;display:grid;place-items:center;font:700 9px Rajdhani,sans-serif;letter-spacing:.2em;color:#4a5670;background:rgba(255,255,255,.4);margin-bottom:8px}.locked407F-ribbon{position:relative;background:linear-gradient(180deg,#9a6cd4,#6d3fa8);color:#fff;font-weight:800;font-size:12.5px;padding:8px 6px;clip-path:polygon(0 0,100% 0,calc(100% - 10px) 50%,100% 100%,0 100%,10px 50%);box-shadow:0 6px 16px rgba(0,0,0,.5);letter-spacing:.02em}.locked407F-ribDate{font:700 10.5px Rajdhani,sans-serif;color:#cfd9ec;margin-top:6px}
.locked407F-sticky{position:absolute;z-index:7;width:132px;min-height:96px;background:transparent var(--kbSticky) 0 0/100% 100% no-repeat;color:#4a3f14;transform:rotate(3deg);padding:12px 12px 14px;font-weight:600;font-size:11px;line-height:1.5;box-shadow:0 10px 22px rgba(20,30,50,.4);border-radius:1px}.locked407F-explanationLeader{position:absolute;left:0;top:50%;height:4px;background:#c73a25;transform-origin:0 50%;pointer-events:none}.locked407F-explanationLeader:after{content:"";position:absolute;right:-1px;top:-5px;border-left:10px solid #c73a25;border-top:7px solid transparent;border-bottom:7px solid transparent}
.locked407F-arrow[aria-selected="true"],.locked407F-flag[aria-selected="true"],.locked407F-sticky[aria-selected="true"]{outline:4px solid #39d6ff;outline-offset:5px;filter:drop-shadow(0 0 8px rgba(57,214,255,.8))}
.locked407FBoard[data-composition-tight="true"] .locked407F-arrow .locked407F-aloc{display:none}.locked407FBoard[data-composition-tight="true"] .locked407F-arrow .locked407F-ads,.locked407FBoard[data-composition-tight="true"] .locked407F-arrow .locked407F-ade{top:-11px;font-size:8.5px}
`;

const BOARD_CONTENT_WIDTH=LOCKED_407F_GEOMETRY.width-2;
const boardX=(percent)=>1+BOARD_CONTENT_WIDTH*Number(percent)/100;
const canonicalPixel=(value)=>Math.floor(Number(value)*64)/64;

function directArrowGeometry(arrow,metrics){
  const leftPercent=metrics.xPercent(arrow.startMonth);
  const widthPercent=metrics.widthPercent(arrow.startMonth,arrow.endMonth);
  const x=canonicalPixel(boardX(leftPercent));
  const width=canonicalPixel(Math.max(
    LOCKED_407F_GEOMETRY.minimumArrowWidth,
    BOARD_CONTENT_WIDTH*widthPercent/100
  ));
  const y=1+LOCKED_407F_GEOMETRY.laneTop+
    Number(arrow.lane||0)*(
      arrow.condensed
        ?LOCKED_407F_GEOMETRY.condensedLanePitch
        :LOCKED_407F_GEOMETRY.lanePitch
    );
  return{x,y,width,x2:x+width,height:arrow.condensed?24:30};
}

function directArrowDefinitions(arrows,metrics){
  return arrows.map((arrow,index)=>{
    const geometry=directArrowGeometry(arrow,metrics);
    return`<clipPath id="locked407f-arrow-clip-${index}"><rect x="${geometry.x}" y="${geometry.y}" width="${geometry.width}" height="${geometry.height}"/></clipPath>`;
  }).join("");
}

function canonicalArrowLayer(arrows,metrics){
  return`<foreignObject data-layer="canonical-407f-arrows" x="0" y="0" width="1920" height="1080" overflow="visible"><div xmlns="http://www.w3.org/1999/xhtml"><style aria-hidden="true">${LOCKED_CSS}</style><div style="box-sizing:border-box;position:relative;width:1920px;height:1080px;border:1px solid transparent;font-family:Archivo,system-ui,sans-serif">${arrows.map((arrow)=>arrowMarkup(arrow,metrics)).join("")}</div></div></foreignObject>`;
}

function directArrowMarkup(arrow,index,metrics){
  const geometry=directArrowGeometry(arrow,metrics);
  const presentation=arrowPresentation(arrow);
  const sprites=LOCKED_407F_ASSETS.arrows[presentation.slug];
  const start=formatMonth(arrow.startMonth);
  const end=arrow.openEnded?"Present":formatMonth(arrow.endMonth);
  const duration=monthIndex(arrow.endMonth)-monthIndex(arrow.startMonth)+1;
  const dateStyle="text-shadow:0 1px 4px rgba(0,0,0,.88)";
  const dates=duration>=6
    ?`<text x="${geometry.x}" y="${geometry.y-7}" fill="#D8E5F7" font-family="Rajdhani" font-size="10" font-weight="700" style="${dateStyle}">${escapeMarkup(start)}</text><text x="${geometry.x2-8}" y="${geometry.y-7}" text-anchor="end" fill="#D8E5F7" font-family="Rajdhani" font-size="10" font-weight="700" style="${dateStyle}">${escapeMarkup(end)}</text>`
    :`<text x="${geometry.x}" y="${geometry.y-7}" fill="#D8E5F7" font-family="Rajdhani" font-size="10" font-weight="700" style="${dateStyle}">${escapeMarkup(start)} - ${escapeMarkup(end)}</text>`;
  const site=arrow.siteName
    ?`<text x="${geometry.x-8}" y="${geometry.y+17}" text-anchor="end" fill="#D8E5F7" font-family="Rajdhani" font-size="10.5" font-weight="700" style="${dateStyle}">${escapeMarkup(arrow.siteName)}</text>`
    :"";
  const label=`<text data-arrow-label="inside" x="${geometry.x+10+(geometry.width-28)/2}" y="${geometry.y+19}" text-anchor="middle" fill="#FFFFFF" font-family="Archivo,system-ui,sans-serif" font-size="11" font-weight="600" letter-spacing=".11" style="text-shadow:0 1px 2px rgba(0,0,0,.55)"><title>${escapeMarkup(arrow.title)}</title>${escapeMarkup(arrow.title)}</text>`;
  const lor=arrow.lorSubmitted
    ?`<g data-lor-submitted="true" role="img" aria-label="LOR submitted" transform="translate(${geometry.x2-28} ${geometry.y-10})"><path d="M0 0H20V22L10 16L0 22Z" fill="#F3E7B3" stroke="#8C6B20"/><text x="10" y="14" text-anchor="middle" fill="#6C5018" font-family="Archivo" font-size="11" font-weight="800">★</text></g>`
    :"";
  const chip=arrow.actionChip
    ?`<g data-study-action-chip="${escapeMarkup(arrow.actionChip.targetAttemptId||"")}" transform="translate(${geometry.x2-126} ${geometry.y+36})"><rect width="122" height="24" rx="12" fill="#B98A2E" stroke="#A67A26"/><text x="61" y="16" text-anchor="middle" fill="#191C21" font-family="Rajdhani" font-size="10" font-weight="700">${escapeMarkup(arrow.actionChip.label||"Set retake date")}</text></g>`
    :"";
  const tileWidth=72/36*geometry.height;
  const bodyTiles=[];
  for(let x=geometry.x;x<geometry.x2;x+=tileWidth){
    bodyTiles.push(`<image href="${escapeMarkup(sprites.body)}" x="${x}" y="${geometry.y}" width="${tileWidth}" height="${geometry.height}" preserveAspectRatio="none"/>`);
  }
  return`<g data-event-kind="arrow" data-event-id="${escapeMarkup(arrow.id)}" data-category="${escapeMarkup(arrow.categoryId)}" data-open-ended="${arrow.openEnded}" data-study="${arrow.study}" aria-label="${escapeMarkup(arrow.ariaLabel)}" style="filter:drop-shadow(0 2px 2px rgba(20,30,50,.35))"><g clip-path="url(#locked407f-arrow-clip-${index})">${bodyTiles.join("")}</g><image href="${escapeMarkup(sprites.cap)}" x="${geometry.x}" y="${geometry.y}" width="${LOCKED_407F_GEOMETRY.capWidth}" height="${geometry.height}" preserveAspectRatio="none"/><image href="${escapeMarkup(sprites.head)}" x="${geometry.x2-LOCKED_407F_GEOMETRY.headWidth}" y="${geometry.y}" width="${LOCKED_407F_GEOMETRY.headWidth}" height="${geometry.height}" preserveAspectRatio="none"/>${dates}${site}${label}${lor}${chip}</g>`;
}

function directAxis(scene,metrics){
  const years=[];
  for(let year=metrics.firstYear;year<=metrics.lastYear;year+=1)years.push(year);
  const x=boardX(2);
  const width=BOARD_CONTENT_WIDTH*.96;
  const overlap=9;
  const segmentWidth=(width+overlap*(years.length-1))/years.length;
  const axisY=1+LOCKED_407F_GEOMETRY.axisTop;
  const tileWidth=191/50*LOCKED_407F_GEOMETRY.axisHeight;
  const segments=years.map((year,index)=>{
    const sx=x+index*(segmentWidth-overlap);
    const d=`M${sx} ${axisY}H${sx+segmentWidth-12}L${sx+segmentWidth} ${axisY+17}L${sx+segmentWidth-12} ${axisY+34}H${sx}Z`;
    return`<g data-segment-kind="year"><path d="${d}" fill="url(#locked407f-axis-body)"/><text x="${sx+segmentWidth/2-4}" y="${axisY+23}" text-anchor="middle" fill="#DBE6F8" font-family="Rajdhani" font-size="15" font-weight="700" letter-spacing="1.2">${year}</text></g>`;
  }).join("");
  return`<g data-layer="axis" data-axis-language="407f-powerpoint">${segments}<text x="${boardX(2.2)}" y="115" fill="#9FB0CD" font-family="Rajdhani" font-size="9" font-weight="700" letter-spacing="2.16">AXIS ${metrics.firstYear}-${metrics.lastYear} · CALIBRATED FROM YOUR DATES · JAN LEFT · DEC RIGHT</text></g><defs><pattern id="locked407f-axis-body" x="${x}" y="${axisY}" width="${tileWidth}" height="34" patternUnits="userSpaceOnUse"><image href="${escapeMarkup(LOCKED_407F_ASSETS.axis)}" x="${x}" y="${axisY}" width="${tileWidth}" height="34" preserveAspectRatio="none"/></pattern></defs>`;
}

function directFlagMarkup(flag,index,metrics){
  const x=boardX(metrics.xPercent(flag.month));
  const y=1+(index%2===0?14:30);
  const source=flag.categoryId==="personal"
    ?LOCKED_407F_ASSETS.flagPersonal
    :LOCKED_407F_ASSETS.flagGray;
  return`<g data-event-kind="flag" data-event-id="${escapeMarkup(flag.id)}" data-category="${escapeMarkup(flag.categoryId)}" aria-label="${escapeMarkup(flag.ariaLabel)}"><text x="${x+12}" y="${y-2}" fill="#D8E5F7" font-family="Rajdhani" font-size="10" font-weight="700">${escapeMarkup(flag.title)}</text><image href="${escapeMarkup(source)}" x="${x}" y="${y}" width="22" height="38"/><text x="${x-6}" y="${y+48}" fill="#D8E5F7" font-family="Rajdhani" font-size="9" font-weight="700">${escapeMarkup(formatMonth(flag.month))}</text><line x1="${x+11}" y1="${y+38}" x2="${x+11}" y2="${y+38+(index%2===0?40:26)}" stroke="#55617E" stroke-width="2"/></g>`;
}

function directChrome(scene,metrics){
  const headline=String(scene?.headline?.text||"Your journey").replace(/^timeline\\s*:\\s*/i,"");
  const profile=scene.profile||{};
  const plaque={x:800.21,y:15,width:319.58,height:47};
  const key={x:boardX(2.2),y:476,width:186,height:143};
  const card={x:boardX(2.2),y:897,width:240,height:166};
  const photoStart=812;
  const sticky={x:1691,y:497,width:132,height:96};
  const ribbon={x:1683,y:97,width:190};
  const target=scene.interviewTarget||{};
  const marker=scene.interviewMarker;
  const explanation=(scene.explanations||[])[0];
  return`<g data-artifact-chrome="title"><image href="${escapeMarkup(LOCKED_407F_ASSETS.plaque)}" x="${plaque.x}" y="${plaque.y}" width="${plaque.width}" height="${plaque.height}" preserveAspectRatio="none"/><text data-board-headline="true" x="${plaque.x+plaque.width/2}" y="46" text-anchor="middle" fill="#111827" font-family="Archivo" font-size="19" font-weight="800">Timeline: ${escapeMarkup(headline)}</text></g><g data-artifact-chrome="color-key"><image href="${escapeMarkup(LOCKED_407F_ASSETS.key)}" x="${key.x}" y="${key.y}" width="${key.width}" height="${key.height}" preserveAspectRatio="none"/><image href="${escapeMarkup(LOCKED_407F_ASSETS.pin)}" x="${key.x+83}" y="${key.y-11}" width="20" height="20"/><text x="${key.x+16}" y="${key.y+31}" fill="#A8402F" font-family="Archivo" font-size="11" font-weight="900">COLOR KEY</text></g><g data-artifact-chrome="profile"><image href="${escapeMarkup(LOCKED_407F_ASSETS.paper)}" x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" preserveAspectRatio="none"/><text x="${card.x+18}" y="${card.y+30}" fill="#171D26" font-family="Archivo" font-size="12" font-weight="900">${escapeMarkup(profile.fullName||"Profile not set")}</text><text x="${card.x+18}" y="${card.y+54}" fill="#171D26" font-family="Archivo" font-size="10.5"><tspan font-weight="800">Medical school: </tspan>${escapeMarkup(profile.medicalSchool||"Not set")}</text><text x="${card.x+18}" y="${card.y+74}" fill="#171D26" font-family="Archivo" font-size="10.5"><tspan font-weight="800">Status: </tspan>${escapeMarkup(profile.status||"Not set")}</text><text x="${card.x+18}" y="${card.y+94}" fill="#171D26" font-family="Archivo" font-size="10.5"><tspan font-weight="800">Step 1: </tspan>${escapeMarkup(profile.step1||"Not set")} · <tspan font-weight="800">Step 2 CK: </tspan>${escapeMarkup(profile.step2||"Not set")}</text><rect data-profile-photo-slot="true" x="${card.x+164}" y="${card.y+18}" width="56" height="62" fill="#C9C2AE" stroke="#FFFFFF" stroke-width="3"/><text x="${card.x+192}" y="${card.y+44}" text-anchor="middle" fill="#6D6753" font-family="Rajdhani" font-size="9" font-weight="700">PROFILE</text><text x="${card.x+192}" y="${card.y+56}" text-anchor="middle" fill="#6D6753" font-family="Rajdhani" font-size="9" font-weight="700">PHOTO</text></g><g data-artifact-chrome="photo-frames">${[0,1,2].map((index)=>{const x=photoStart+index*102,rotation=index%2?2.5:-3;return`<g data-artifact-photo-frame="${index+1}" transform="rotate(${rotation} ${x+46} 1009)"><rect x="${x}" y="957" width="92" height="104" fill="#FDFBF4"/><rect x="${x+6}" y="963" width="80" height="76" fill="#28354B"/><text x="${x+46}" y="1003" text-anchor="middle" fill="#9FB0CD" font-family="Rajdhani" font-size="8.5" font-weight="700">DROP PHOTO ${index+1}</text></g>`;}).join("")}</g><g data-interview-destination="407f-ribbon"><rect x="${ribbon.x}" y="${ribbon.y}" width="${ribbon.width}" height="52" fill="rgba(255,255,255,.4)" stroke="#26314D" stroke-opacity=".45" stroke-dasharray="4 3"/><text x="${ribbon.x+ribbon.width/2}" y="${ribbon.y+30}" text-anchor="middle" fill="#4A5670" font-family="Rajdhani" font-size="9" font-weight="700" letter-spacing="1.8">${escapeMarkup(String(target.programName||target.prog||"PROGRAM LOGO").toUpperCase())}</text><path d="M${ribbon.x} 157H${ribbon.x+ribbon.width}L${ribbon.x+ribbon.width-10} 173L${ribbon.x+ribbon.width} 189H${ribbon.x}L${ribbon.x+10} 173Z" fill="#7E4BB6"/><text x="${ribbon.x+ribbon.width/2}" y="177" text-anchor="middle" fill="#FFFFFF" font-family="Archivo" font-size="12.5" font-weight="800">${escapeMarkup(target.label||"YOUR BIG INTERVIEW")}</text><text x="${ribbon.x+ribbon.width/2}" y="207" text-anchor="middle" fill="#CFD9EC" font-family="Rajdhani" font-size="10.5" font-weight="700">${marker?`Interview · ${escapeMarkup(formatMonth(marker.month))}`:"Date pending"}</text></g>${explanation?`<g data-event-kind="explanation" data-event-id="${escapeMarkup(explanation.id)}" aria-label="${escapeMarkup(explanation.ariaLabel)}"><image data-explanation-card="true" href="${escapeMarkup(LOCKED_407F_ASSETS.sticky)}" x="${sticky.x}" y="${sticky.y}" width="${sticky.width}" height="${sticky.height}" preserveAspectRatio="none" transform="rotate(3 ${sticky.x+66} ${sticky.y+48})"/><text x="${sticky.x+12}" y="${sticky.y+30}" fill="#4A3F14" font-family="Archivo" font-size="11" font-weight="600">${escapeMarkup(explanation.text.slice(0,28))}</text>${explanation.leaderEnabled?`<path data-explanation-leader="true" d="M${sticky.x} ${sticky.y+48}L${sticky.x-42} ${sticky.y+48}" stroke="#C73A25" stroke-width="4"/>`:""}</g>`:""}</g>`;
}

export function serializeLocked407FArtifact(scene){
  const metrics=timelineMetrics(scene);
  const composition=locked407FComposition(scene);
  const titleId="d1-locked-407f-title";
  const descriptionId="d1-locked-407f-description";
  const arrows=scene.arrows||[];
  const flags=scene.flags||[];
  const headline=String(scene?.headline?.text||scene?.profile?.fullName||"Your journey")
    .replace(/^timeline\s*:\s*/i,"");
  const boardVariables=[
    `--axisSprite:${styleUrl(LOCKED_407F_ASSETS.axis)}`,
    `--kbPlaque:${styleUrl(LOCKED_407F_ASSETS.plaque)}`,
    `--kbPaper:${styleUrl(LOCKED_407F_ASSETS.paper)}`,
    `--kbSticky:${styleUrl(LOCKED_407F_ASSETS.sticky)}`,
    `--kbPin:${styleUrl(LOCKED_407F_ASSETS.pin)}`,
    `--kbKey:${styleUrl(LOCKED_407F_ASSETS.key)}`,
    ...(themeBoardBackground(scene.theme)?[`--themeBoard:${escapeMarkup(themeBoardBackground(scene.theme))}`]:[]),
    "filter:saturate(1.1762)"
  ].join(";");
  const boardMarkup=`<div class="locked407FBoard" data-board-background="true" data-composition-density="${composition.density}" data-composition-tight="${composition.tight}" data-event-band="${composition.eventBandTop}-${composition.eventBandBottom}" style="${boardVariables}"><div class="locked407F-plaque" data-artifact-chrome="title">Timeline: ${escapeMarkup(headline)}</div>${axisMarkup(scene,metrics)}<div data-layer="events">${flags.map((flag,index)=>flagMarkup(flag,index,metrics)).join("")}${arrows.map((arrow)=>arrowMarkup(arrow,metrics,composition)).join("")}</div>${colorKeyMarkup(scene)}${profileMarkup(scene)}${photosMarkup()}${interviewMarkup(scene,metrics)}${explanationsMarkup(scene)}</div>`;
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" role="img" aria-labelledby="${titleId} ${descriptionId}" data-renderer="${escapeMarkup(scene.renderer)}" data-theme="keynote-classic" data-artifact-language="407f-powerpoint-keynote" data-locked-407f-source-sha256="${LOCKED_407F_SOURCE_SHA256}"><title id="${titleId}">${escapeMarkup(scene.accessibility.ariaLabel)}</title><desc id="${descriptionId}">${escapeMarkup(scene.accessibility.description)}</desc><foreignObject x="0" y="0" width="1920" height="1080"><div xmlns="http://www.w3.org/1999/xhtml"><style aria-hidden="true">${LOCKED_CSS}</style>${boardMarkup}</div></foreignObject></svg>`;
}

import {renderKeynoteClassicBoard} from "./board-renderer.js";
import {
  ADVANCED_BACKGROUND_PRESETS,
  advancedStudioState,
  scrimCss
} from "./advanced-studio.js";

function xml(value){
  return String(value??"").replace(/[&<>"']/g,(character)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&apos;"
  })[character]);
}

function number(value,fallback=0){
  const result=Number(value);
  return Number.isFinite(result)?result:fallback;
}

function textAnchor(alignment){
  if(alignment==="center")return"middle";
  if(alignment==="right")return"end";
  return"start";
}

function backgroundMarkup(background,resolveObjectUrl){
  if(background.kind==="color"&&background.color){
    return`<rect data-board-background="true" width="1920" height="1080" fill="${xml(background.color)}"/>`;
  }
  if(background.kind==="preset"&&background.preset){
    const preset=ADVANCED_BACKGROUND_PRESETS.find(({id})=>id===background.preset);
    if(preset){
      return`<rect data-board-background="true" width="1920" height="1080" fill="transparent" style="background:${xml(preset.css)}"/>`;
    }
  }
  if(background.kind==="upload"){
    const url=resolveObjectUrl(background.mediaId,background);
    if(url){
      const scrim=background.scrimCss||scrimCss(background.scrim,background.dim);
      return`<image data-board-background="true" href="${xml(url)}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/><rect data-background-scrim="true" width="1920" height="1080" fill="${xml(scrim)}"/>`;
    }
  }
  return null;
}

function backgroundCss(background,resolveObjectUrl){
  if(background.kind==="color"&&background.color)return background.color;
  if(background.kind==="preset"&&background.preset){
    return ADVANCED_BACKGROUND_PRESETS.find(({id})=>id===background.preset)?.css||null;
  }
  if(background.kind==="upload"){
    const url=resolveObjectUrl(background.mediaId,background);
    if(!url)return null;
    const scrim=background.scrimCss||scrimCss(background.scrim,background.dim);
    return`linear-gradient(${scrim}, ${scrim}), url("${url}") center / cover no-repeat`;
  }
  return null;
}

function advancedBackgroundProjection(background,resolveObjectUrl){
  if(background.kind==="upload"){
    return{
      ...background,
      resolvedUrl:resolveObjectUrl(background.mediaId,background)||null,
      scrimCss:background.scrimCss||scrimCss(background.scrim,background.dim)
    };
  }
  if(background.kind==="preset"){
    return{
      ...background,
      css:ADVANCED_BACKGROUND_PRESETS.find(({id})=>id===background.preset)?.css||null
    };
  }
  return{...background};
}

function applyLockedHtmlBackground(svg,css){
  if(!css)return svg;
  return svg.replace(
    /(<div class="locked407FBoard"[^>]*style=")([^"]*)"/,
    (_match,start,style)=>`${start}${style};--themeBoard:${xml(css)}"`
  );
}

function mediaMarkup(media,resolveObjectUrl,{
  guided=false,
  reducedMotion=false
}={}){
  return [...media]
    .filter((item)=>item?.placed!==false&&(!guided||item?.guidedVisible===true))
    .sort((left,right)=>number(left.layerIndex)-number(right.layerIndex))
    .map((item)=>{
      const url=resolveObjectUrl(item.id,item);
      if(!url)return"";
      const accessibleName=String(item.source?.name||item.kind||"timeline media");
      const accessibleLabel=`${accessibleName}; press Enter to select, use arrow keys to move, and Shift plus arrow keys to resize`;
      if(reducedMotion&&(item.fileType==="gif"||item.animated===true)){
        const x=number(item.x);
        const y=number(item.y);
        const width=number(item.width,1);
        const height=number(item.height,1);
        return`<g data-advanced-media="${xml(item.id)}" data-media-kind="${xml(item.kind)}" data-media-motion-paused="true" role="button" tabindex="0" aria-label="${xml(accessibleLabel)}">
          <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#111827" stroke="#39D6FF" stroke-width="2"/>
          <text x="${x+width/2}" y="${y+height/2}" fill="#E8EEFB" font-family="Inter" font-size="18" font-weight="700" text-anchor="middle">GIF · MOTION PAUSED</text>
        </g>`;
      }
      const preserveAspectRatio=item.fit==="cover"
        ?"xMidYMid slice"
        :item.fit==="contain"
          ?"xMidYMid meet"
          :"none";
      return`<image data-advanced-media="${xml(item.id)}" data-media-kind="${xml(item.kind)}" href="${xml(url)}" x="${number(item.x)}" y="${number(item.y)}" width="${number(item.width,1)}" height="${number(item.height,1)}" preserveAspectRatio="${preserveAspectRatio}" role="button" tabindex="0" aria-label="${xml(accessibleLabel)}"/>`;
    })
    .join("");
}

function textMarkup(blocks){
  return [...blocks]
    .sort((left,right)=>number(left.layerIndex)-number(right.layerIndex))
    .map((item)=>`<text data-advanced-text="${xml(item.id)}" x="${number(item.x)}" y="${number(item.y)}" fill="${xml(item.color||"#191C21")}" font-family="${xml(item.font||"Inter")}" font-size="${number(item.size,24)}" font-weight="${number(item.weight,400)}" text-anchor="${textAnchor(item.alignment)}" role="button" tabindex="0" aria-label="${xml(`${item.text||"Text block"}; press Enter to select and use arrow keys to move`)}">${xml(item.text)}</text>`)
    .join("");
}

function flagEmoji(code="US"){
  const value=String(code||"").toUpperCase();
  return/^[A-Z]{2}$/.test(value)
    ?String.fromCodePoint(...[...value].map((character)=>127397+character.charCodeAt(0)))
    :"⚑";
}

function elementBody(item){
  const width=number(item.width,120),height=number(item.height,80);
  const fill=xml(item.fill||"#2C6E8F"),stroke=xml(item.stroke||"#17324A");
  const label=xml(item.label||"");
  const common=`fill="${fill}" stroke="${stroke}" stroke-width="3" vector-effect="non-scaling-stroke"`;
  switch(item.kind){
    case"rounded-rectangle":return`<rect width="${width}" height="${height}" rx="18" ${common}/>`;
    case"circle":return`<ellipse cx="${width/2}" cy="${height/2}" rx="${width/2}" ry="${height/2}" ${common}/>`;
    case"line":case"separator":return`<line x1="0" y1="${height/2}" x2="${width}" y2="${height/2}" ${common} stroke-width="6"/>`;
    case"badge":return`<path d="M${width*.5} 0 L${width*.92} ${height*.25} L${width*.82} ${height*.82} L${width*.5} ${height} L${width*.18} ${height*.82} L${width*.08} ${height*.25}Z" ${common}/>`;
    case"label":return`<path d="M0 0H${width*.82}L${width} ${height/2}L${width*.82} ${height}H0Z" ${common}/>`;
    case"callout":return`<path d="M0 0H${width}V${height*.75}H${width*.35}L${width*.2} ${height}V${height*.75}H0Z" ${common}/>`;
    case"frame":return`<rect x="3" y="3" width="${width-6}" height="${height-6}" fill="none" stroke="${stroke}" stroke-width="8" vector-effect="non-scaling-stroke"/>`;
    case"arrow-right":case"arrow-thin":case"arrow-thick":return`<path d="M0 ${height*.5}H${width*.73}V${height*.18}L${width} ${height*.5}L${width*.73} ${height*.82}V${height*.5}H0Z" ${common}/>`;
    case"arrow-double":return`<path d="M0 ${height*.5}L${width*.24} ${height*.12}V${height*.34}H${width*.76}V${height*.12}L${width} ${height*.5}L${width*.76} ${height*.88}V${height*.66}H${width*.24}V${height*.88}Z" ${common}/>`;
    case"arrow-curved":return`<path d="M${width*.1} ${height*.8}C${width*.15} ${height*.14},${width*.72} ${height*.14},${width*.78} ${height*.46}L${width*.61} ${height*.28}M${width*.78} ${height*.46}L${width*.54} ${height*.5}" fill="none" stroke="${stroke}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    case"milestone":case"marker":case"pin":case"milestone-flag":return`<path d="M${width*.5} 0L${width} ${height*.5}L${width*.5} ${height}L0 ${height*.5}Z" ${common}/>`;
    case"ribbon":return`<path d="M0 ${height*.16}H${width}V${height*.84}H0L${width*.12} ${height*.5}Z" ${common}/>`;
    case"shadow":return`<ellipse cx="${width/2}" cy="${height/2}" rx="${width*.48}" ry="${height*.24}" fill="rgba(0,0,0,.18)"/>`;
    case"hospital":return`<rect x="${width*.12}" y="${height*.12}" width="${width*.76}" height="${height*.76}" rx="10" ${common}/><path d="M${width*.5} ${height*.25}V${height*.75}M${width*.25} ${height*.5}H${width*.75}" stroke="#fff" stroke-width="10" vector-effect="non-scaling-stroke"/>`;
    case"graduation":return`<path d="M0 ${height*.34}L${width*.5} 0L${width} ${height*.34}L${width*.5} ${height*.67}Z" ${common}/><path d="M${width*.22} ${height*.52}V${height*.78}Q${width*.5} ${height} ${width*.78} ${height*.78}V${height*.52}" fill="none" stroke="${stroke}" stroke-width="5"/>`;
    case"country-flag":return`<rect width="${width}" height="${height}" rx="8" fill="#fff" stroke="${stroke}" stroke-width="3"/><text x="${width/2}" y="${height*.72}" text-anchor="middle" font-size="${Math.min(width,height)*.7}">${flagEmoji(item.countryCode)}</text>`;
    default:return`<rect width="${width}" height="${height}" rx="${Math.min(16,height/5)}" ${common}/><text x="${width/2}" y="${height*.62}" text-anchor="middle" fill="#fff" font-family="Inter" font-size="${Math.min(width,height)*.36}" font-weight="700">${label||xml(item.kind||"Asset")}</text>`;
  }
}

function elementMarkup(elements){
  return[...elements]
    .sort((left,right)=>number(left.layerIndex)-number(right.layerIndex))
    .map((item)=>`<g data-advanced-element="${xml(item.id)}" data-advanced-kind="${xml(item.kind)}" transform="translate(${number(item.x)} ${number(item.y)})" role="button" tabindex="0" aria-label="${xml(`${item.label||item.kind||"Timeline asset"}; press Enter to select and use arrow keys to move`)}">${elementBody(item)}</g>`)
    .join("");
}

function applyHeadlineTypography(svg,typography){
  if(!typography)return svg;
  const nativeUpdated=svg.replace(
    /<text data-board-headline="true" ([^>]*)>/,
    (_match,attributes)=>{
      const cleaned=attributes
        .replace(/\sfill="[^"]*"/,"")
        .replace(/\sfont-family="[^"]*"/,"")
        .replace(/\sfont-size="[^"]*"/,"")
        .replace(/\sfont-weight="[^"]*"/,"")
        .replace(/\stext-anchor="[^"]*"/,"");
      return`<text data-board-headline="true" ${cleaned} fill="${xml(typography.color)}" font-family="${xml(typography.font)}" font-size="${number(typography.size,48)}" font-weight="${number(typography.weight,700)}" text-anchor="${textAnchor(typography.alignment)}">`;
    }
  );
  return nativeUpdated.replace(
    /<div class="locked407F-plaque"([^>]*)>/,
    (_match,attributes)=>`<div class="locked407F-plaque"${attributes} style="color:${xml(typography.color)};font-family:${xml(typography.font)},sans-serif;font-size:${number(typography.size,19)}px;font-weight:${number(typography.weight,800)};text-align:${xml(typography.alignment||"center")}">`
  );
}

export function renderAdvancedBoard(
  document,
  options={},
  {
    baseRenderer=renderKeynoteClassicBoard,
    resolveObjectUrl=()=>null
  }={}
){
  const rendered=baseRenderer(document,options);
  const state=advancedStudioState(document);
  if(document?.mode!=="advanced"){
    const guidedMedia=mediaMarkup(state.media,resolveObjectUrl,{
      guided:true,
      reducedMotion:!!options.reducedMotion
    });
    if(!guidedMedia)return rendered;
    return{
      ...rendered,
      svg:rendered.svg.replace(
        "</svg>",
        `<g data-guided-media-layer="true">${guidedMedia}</g></svg>`
      ),
      advanced:{
        visible:false,
        guidedMediaCount:state.media.filter(
          (item)=>item?.placed!==false&&item?.guidedVisible===true
        ).length
      }
    };
  }
  let svg=rendered.svg;
  svg=applyLockedHtmlBackground(svg,backgroundCss(state.background,resolveObjectUrl));
  const background=backgroundMarkup(state.background,resolveObjectUrl);
  if(background){
    svg=svg.replace(/<rect data-board-background="true"[^>]*\/>/,background);
  }
  svg=applyHeadlineTypography(svg,state.headlineTypography);
  const layers=`<g data-advanced-layer="true">${mediaMarkup(state.media,resolveObjectUrl,{reducedMotion:!!options.reducedMotion})}${textMarkup(state.textBlocks)}${elementMarkup(state.elements)}</g>`;
  svg=svg.replace("</svg>",`${layers}</svg>`);
  return{
    ...rendered,
    scene:{
      ...rendered.scene,
      advancedProjection:{
        background:advancedBackgroundProjection(state.background,resolveObjectUrl),
        headlineTypography:{...state.headlineTypography}
      }
    },
    svg,
    advanced:{
      visible:true,
      backgroundKind:state.background.kind,
      mediaCount:state.media.length,
      textCount:state.textBlocks.length,
      elementCount:state.elements.length
    }
  };
}

export function createAdvancedBoardRenderer({
  baseRenderer=renderKeynoteClassicBoard,
  resolveObjectUrl=()=>null
}={}){
  return(document,options)=>renderAdvancedBoard(document,options,{baseRenderer,resolveObjectUrl});
}

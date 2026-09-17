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
  const layers=`<g data-advanced-layer="true">${mediaMarkup(state.media,resolveObjectUrl,{reducedMotion:!!options.reducedMotion})}${textMarkup(state.textBlocks)}</g>`;
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
      textCount:state.textBlocks.length
    }
  };
}

export function createAdvancedBoardRenderer({
  baseRenderer=renderKeynoteClassicBoard,
  resolveObjectUrl=()=>null
}={}){
  return(document,options)=>renderAdvancedBoard(document,options,{baseRenderer,resolveObjectUrl});
}

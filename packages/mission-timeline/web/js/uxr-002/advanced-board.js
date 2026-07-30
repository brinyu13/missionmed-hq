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
      if(reducedMotion&&(item.fileType==="gif"||item.animated===true)){
        const x=number(item.x);
        const y=number(item.y);
        const width=number(item.width,1);
        const height=number(item.height,1);
        return`<g data-advanced-media="${xml(item.id)}" data-media-kind="${xml(item.kind)}" data-media-motion-paused="true">
          <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#111827" stroke="#39D6FF" stroke-width="2"/>
          <text x="${x+width/2}" y="${y+height/2}" fill="#E8EEFB" font-family="Inter" font-size="18" font-weight="700" text-anchor="middle">GIF · MOTION PAUSED</text>
        </g>`;
      }
      return`<image data-advanced-media="${xml(item.id)}" data-media-kind="${xml(item.kind)}" href="${xml(url)}" x="${number(item.x)}" y="${number(item.y)}" width="${number(item.width,1)}" height="${number(item.height,1)}" preserveAspectRatio="none"/>`;
    })
    .join("");
}

function textMarkup(blocks){
  return [...blocks]
    .sort((left,right)=>number(left.layerIndex)-number(right.layerIndex))
    .map((item)=>`<text data-advanced-text="${xml(item.id)}" x="${number(item.x)}" y="${number(item.y)}" fill="${xml(item.color||"#191C21")}" font-family="${xml(item.font||"Inter")}" font-size="${number(item.size,24)}" font-weight="${number(item.weight,400)}" text-anchor="${textAnchor(item.alignment)}">${xml(item.text)}</text>`)
    .join("");
}

function applyHeadlineTypography(svg,typography){
  if(!typography)return svg;
  return svg.replace(
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
  const background=backgroundMarkup(state.background,resolveObjectUrl);
  if(background){
    svg=svg.replace(/<rect data-board-background="true"[^>]*\/>/,background);
  }
  svg=applyHeadlineTypography(svg,state.headlineTypography);
  const layers=`<g data-advanced-layer="true">${mediaMarkup(state.media,resolveObjectUrl,{reducedMotion:!!options.reducedMotion})}${textMarkup(state.textBlocks)}</g>`;
  svg=svg.replace("</svg>",`${layers}</svg>`);
  return{
    ...rendered,
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

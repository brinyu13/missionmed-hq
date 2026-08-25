function imageFromUrl(url){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("The Founder presentation SVG could not be decoded."));
    image.src=url;
  });
}

function dataUrlFromBlob(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(new Error("A presentation asset could not be encoded."));
    reader.readAsDataURL(blob);
  });
}

function isFailSoftMedia(image){
  return image.hasAttribute("data-media-id")||
    image.hasAttribute("data-program-logo")||
    image.hasAttribute("data-board-background-upload");
}

export async function inlinePresentationSvgSources(svg){
  const parser=new DOMParser();
  const documentNode=parser.parseFromString(svg,"image/svg+xml");
  if(documentNode.querySelector("parsererror")){
    throw new Error("The Founder presentation SVG could not be parsed for export.");
  }
  const cache=new Map();
  const warnings=[];
  const localDataUrl=async(source)=>{
    if(!source||source.startsWith("data:")||source.startsWith("#"))return source;
    let dataUrl=cache.get(source);
    if(dataUrl)return dataUrl;
    const resolved=new URL(source,document.baseURI);
    if(resolved.protocol!=="blob:"&&resolved.origin!==window.location.origin){
      throw new Error("Presentation export refused a non-local image source.");
    }
    const response=await fetch(resolved.href,{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw new Error(`Presentation asset load failed (${response.status}).`);
    dataUrl=await dataUrlFromBlob(await response.blob());
    cache.set(source,dataUrl);
    return dataUrl;
  };
  const images=[...documentNode.querySelectorAll("image[href]")];
  for(const image of images){
    const source=image.getAttribute("href");
    if(!source||source.startsWith("data:"))continue;
    try{
      image.setAttribute("href",await localDataUrl(source));
    }catch(error){
      if(!isFailSoftMedia(image))throw error;
      image.removeAttribute("href");
      image.setAttribute("data-media-load-failed","true");
      warnings.push(`MEDIA_FAIL_SOFT:${image.getAttribute("data-media-id")||"presentation-media"}`);
    }
  }
  const inlineCssUrls=async(css)=>{
    const matches=[...String(css||"").matchAll(/url\((['"]?)(.*?)\1\)/g)];
    let result=String(css||"");
    for(const match of matches){
      const source=match[2];
      if(!source||source.startsWith("data:")||source.startsWith("#"))continue;
      const dataUrl=await localDataUrl(source);
      result=result.replace(match[0],`url("${dataUrl}")`);
    }
    return result;
  };
  for(const styleNode of documentNode.querySelectorAll("style")){
    styleNode.textContent=await inlineCssUrls(styleNode.textContent);
  }
  for(const styledNode of documentNode.querySelectorAll("[style]")){
    styledNode.setAttribute("style",await inlineCssUrls(styledNode.getAttribute("style")));
  }
  return{
    svg:new XMLSerializer().serializeToString(documentNode.documentElement),
    warnings
  };
}

export async function rasterizePresentationSvg(svg,{width=1920,height=1080}={}){
  const inlined=await inlinePresentationSvgSources(svg);
  const source=new Blob([inlined.svg],{type:"image/svg+xml;charset=utf-8"});
  const url=URL.createObjectURL(source);
  try{
    const image=await imageFromUrl(url);
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext("2d",{alpha:false});
    if(!context)throw new Error("Canvas 2D rendering is unavailable.");
    context.drawImage(image,0,0,width,height);
    return{canvas,svg:inlined.svg,warnings:inlined.warnings};
  }finally{
    URL.revokeObjectURL(url);
  }
}

export function canvasPng(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(
    (blob)=>blob?resolve(blob):reject(new Error("PNG encoding failed.")),
    "image/png"
  ));
}

import {buildImagePdf,canvasJpegPage} from "../export/pdf-writer.js";
import {createAdvancedBoardRenderer} from "./advanced-board.js";
import {renderKeynoteClassicBoard} from "./board-renderer.js";
import {serializeLocked407FPortableSvg} from "./locked-407f-export.js";

function imageFromUrl(url){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("The local export image could not be decoded."));
    image.src=url;
  });
}

function dataUrlFromBlob(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(new Error("A local artifact asset could not be encoded."));
    reader.readAsDataURL(blob);
  });
}

async function inlineSvgImageSources(svg){
  const parser=new DOMParser();
  const documentNode=parser.parseFromString(svg,"image/svg+xml");
  if(documentNode.querySelector("parsererror")){
    throw new Error("The artifact SVG could not be parsed for portable export.");
  }
  const cache=new Map();
  const localDataUrl=async(source)=>{
    if(!source||source.startsWith("data:")||source.startsWith("#"))return source;
    let dataUrl=cache.get(source);
    if(dataUrl)return dataUrl;
    const resolved=new URL(source,document.baseURI);
    if(
      resolved.protocol!=="blob:"&&
      resolved.origin!==window.location.origin
    ){
      throw new Error("Artifact export refused a non-local image source.");
    }
    const response=await fetch(resolved.href,{
      credentials:"same-origin",
      cache:"no-store"
    });
    if(!response.ok){
      throw new Error(`Artifact asset load failed (${response.status}).`);
    }
    dataUrl=await dataUrlFromBlob(await response.blob());
    cache.set(source,dataUrl);
    return dataUrl;
  };
  const images=[...documentNode.querySelectorAll("image[href]")];
  for(const image of images){
    const source=image.getAttribute("href");
    if(!source||source.startsWith("data:"))continue;
    image.setAttribute("href",await localDataUrl(source));
  }
  const inlineCssUrls=async(css)=>{
    const matches=[...String(css||"").matchAll(/url\\((['"]?)(.*?)\\1\\)/g)];
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
    styledNode.setAttribute(
      "style",
      await inlineCssUrls(styledNode.getAttribute("style"))
    );
  }
  return new XMLSerializer().serializeToString(documentNode.documentElement);
}

function portableAdvancedLayers(svg){
  const parser=new DOMParser();
  const documentNode=parser.parseFromString(svg,"image/svg+xml");
  if(documentNode.querySelector("parsererror"))return"";
  const serializer=new XMLSerializer();
  return[...documentNode.querySelectorAll(
    "svg > [data-guided-media-layer], svg > [data-advanced-layer]"
  )].map((node)=>serializer.serializeToString(node)).join("");
}

async function svgCanvas(svg,width,height){
  const source=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});
  const url=URL.createObjectURL(source);
  try{
    const image=await imageFromUrl(url);
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext("2d",{alpha:false});
    if(!context)throw new Error("Canvas 2D rendering is unavailable.");
    context.drawImage(image,0,0,width,height);
    return canvas;
  }finally{
    URL.revokeObjectURL(url);
  }
}

function canvasPng(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(
    (blob)=>blob?resolve(blob):reject(new Error("PNG encoding failed.")),
    "image/png"
  ));
}

function pageDimensions(format){
  if(format?.page?.name==="A4")return{pageWidth:841.89,pageHeight:595.28};
  return{pageWidth:792,pageHeight:612};
}

export function createLocalExportAdapter({
  resolveObjectUrl=()=>null,
  triggerDownload=null,
  baseRenderer=renderKeynoteClassicBoard
}={}){
  const boardRenderer=createAdvancedBoardRenderer({
    baseRenderer,
    resolveObjectUrl
  });
  const download=triggerDownload||((blob,filename)=>{
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download=filename;
    anchor.hidden=true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return{downloaded:true,verification:"browser-download-dispatched"};
  });

  return{
    id:"d1-uxr-002-local-browser-export",
    executionMode:"local",
    metadata:{
      executionMode:"local",
      externalApiCalls:false,
      productionWrites:false,
      renderer:"D1-UXR-002-Keynote-Classic"
    },
    async generate(request){
      const input=request?.renderInput;
      if(input?.contract!=="D1-UXR-002-EXPORT-RENDER-INPUT-V1"){
        throw new TypeError("The local adapter requires a verified export render input.");
      }
      const output=input.output;
      const width=output.kind==="PNG"?output.width:2560;
      const height=output.kind==="PNG"?output.height:1440;
      const rendered=boardRenderer(input.timeline,{
        ...input.rendererOptions,
        currentMonth:new Date().toISOString().slice(0,7)
      });
      const projectedSvg=serializeLocked407FPortableSvg(rendered.scene,{
        layers:portableAdvancedLayers(rendered.svg)
      });
      const portableSvg=await inlineSvgImageSources(projectedSvg);
      const canvas=await svgCanvas(portableSvg,width,height);
      const blob=output.kind==="PNG"
        ?await canvasPng(canvas)
        :await buildImagePdf([
          await canvasJpegPage(canvas,pageDimensions(output))
        ],{
          title:input.timeline.title||"Mission Timeline",
          author:"MissionMed Timeline Builder"
        });
      return{
        blob,
        executionMode:"local",
        simulated:false,
        mimeType:blob.type,
        byteSize:blob.size,
        width,
        height,
        eventCount:input.timeline.events.length,
        renderer:"D1-UXR-002-Keynote-Classic",
        pdfTagged:false
      };
    },
    async download(artifact,{filename}={}){
      if(!(artifact?.blob instanceof Blob))throw new TypeError("A generated local Blob is required.");
      const result=await download(artifact.blob,filename);
      return{
        downloaded:result?.downloaded===true,
        verification:result?.verification||"unverified",
        filename,
        byteSize:artifact.blob.size
      };
    }
  };
}

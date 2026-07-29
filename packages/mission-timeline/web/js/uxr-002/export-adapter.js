import {buildImagePdf,canvasJpegPage} from "../export/pdf-writer.js";
import {createAdvancedBoardRenderer} from "./advanced-board.js";
import {renderKeynoteClassicBoard} from "./board-renderer.js";

function imageFromUrl(url){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("The local export image could not be decoded."));
    image.src=url;
  });
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
  triggerDownload=null
}={}){
  const boardRenderer=createAdvancedBoardRenderer({
    baseRenderer:renderKeynoteClassicBoard,
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
      const canvas=await svgCanvas(rendered.svg,width,height);
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

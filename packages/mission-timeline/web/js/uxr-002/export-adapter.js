import {buildImagePdf,canvasJpegPage} from "../export/pdf-writer.js";
import {serializeFounderPresentationAsync} from "../presentation/founder-presentation-serializer.js";
import {canvasPng,rasterizePresentationSvg,inlinePresentationSvgSources} from "../presentation/svg-rasterizer.js";
import {visibleFounderPresentationTitle} from '../presentation/resolved-founder-presentation.js';

function pageDimensions(format){
  if(format?.page?.name==="A4")return{pageWidth:841.89,pageHeight:595.28};
  return{pageWidth:792,pageHeight:612};
}

/* AAA-019 — the PDF presets promise 300 DPI. The raster placed on the page has to be sized
   from the page's printable width at that DPI (Letter 11in → 3300px, A4 297mm → 3508px),
   not a fixed 2560px, or the promise is ~230 DPI on paper. The board keeps its 16:9. */
export function printRasterSize(format){
  const dpi=Math.max(72,Number(format?.dpi)||300);
  const page=format?.page||{};
  const widthIn=Number(page.widthIn)||(Number(page.widthMm)?Number(page.widthMm)/25.4:11);
  const width=Math.round(widthIn*dpi);
  return{width,height:Math.round(width*1080/1920),dpi};
}

export function createLocalExportAdapter({
  resolveObjectUrl=()=>null,
  triggerDownload=null,
  rasterize=rasterizePresentationSvg
}={}){
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
      if(!["PNG","PDF","PPTX"].includes(output.kind))throw new TypeError("Unsupported local export format.");
      const print=output.kind==="PDF"?printRasterSize(output):null;
      const width=print?print.width:output.width;
      const height=print?print.height:output.height;
      const rendered=await serializeFounderPresentationAsync(input.timeline,{
        ...input.rendererOptions,
        currentMonth:new Date().toISOString().slice(0,7),
        mediaResolver:(item)=>resolveObjectUrl(item?.mediaId||item?.id,item)
      });
      if(output.kind==="PPTX"){
        const inlined=await inlinePresentationSvgSources(rendered.svg);
        const {createEditableFounderPptx}=await import("../presentation/editable-pptx.js");
        const artifact=await createEditableFounderPptx({svg:inlined.svg,document:input.timeline});
        return{...artifact,eventCount:input.timeline.events.length,warnings:[...inlined.warnings,...artifact.warnings]};
      }
      const rasterized=await rasterize(rendered.svg,{width,height});
      const canvas=rasterized.canvas;
      const blob=output.kind==="PNG"
        ?await canvasPng(canvas)
        :await buildImagePdf([
          await canvasJpegPage(canvas,pageDimensions(output))
        ],{
          title:visibleFounderPresentationTitle(rendered.svg),
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
        ...(print?{dpi:print.dpi}:{}),
        pdfTagged:false,
        warnings:rasterized.warnings,
        serializer:"d1-founder-keynote-portable-svg/1"
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

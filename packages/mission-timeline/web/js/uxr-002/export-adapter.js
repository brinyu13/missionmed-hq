import {buildImagePdf,canvasJpegPage} from "../export/pdf-writer.js";
import {serializeFounderPresentationAsync} from "../presentation/founder-presentation-serializer.js";
import {canvasPng,rasterizePresentationSvg} from "../presentation/svg-rasterizer.js";

function pageDimensions(format){
  if(format?.page?.name==="A4")return{pageWidth:841.89,pageHeight:595.28};
  return{pageWidth:792,pageHeight:612};
}

export function createLocalExportAdapter({
  resolveObjectUrl=()=>null,
  triggerDownload=null
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
      const width=output.kind==="PNG"?output.width:2560;
      const height=output.kind==="PNG"?output.height:1440;
      const rendered=await serializeFounderPresentationAsync(input.timeline,{
        ...input.rendererOptions,
        currentMonth:new Date().toISOString().slice(0,7),
        mediaResolver:(item)=>resolveObjectUrl(item?.id||item?.mediaId,item)
      });
      const rasterized=await rasterizePresentationSvg(rendered.svg,{width,height});
      const canvas=rasterized.canvas;
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

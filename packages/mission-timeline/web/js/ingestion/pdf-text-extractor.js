import {getDocument,GlobalWorkerOptions,PasswordResponses} from "../../vendor/pdfjs/pdf.min.mjs";
import {inspectFile,sourceDocumentId,MAX_PAGES,IngestionFileError} from "./file-inspector.js";
import {buildDocumentPage} from "./pdf-page-model.js";
import {assessOcrRequirement} from "./ocr-adapter.js";

GlobalWorkerOptions.workerSrc=new URL("../../vendor/pdfjs/pdf.worker.min.mjs",import.meta.url).href;

function errorCode(error){
  const name=String(error?.name||"");
  const message=String(error?.message||error||"");
  if(name.includes("Password")||/password/i.test(message))return "PASSWORD_REQUIRED";
  if(name.includes("InvalidPDF")||/invalid pdf|corrupt|xref/i.test(message))return "CORRUPTED_PDF";
  if(name.includes("MissingPDF"))return "MISSING_PDF";
  return "PDF_EXTRACTION_FAILED";
}

export async function extractPdf(file,{onStatus=()=>{},password=null}={}){
  onStatus("READING",{message:"Inspecting the local file"});
  const inspected=await inspectFile(file);
  const id=sourceDocumentId(inspected.sha256);
  let task;
  try{
    onStatus("EXTRACTING",{message:"Reading the PDF text layer",fileName:inspected.name});
    task=getDocument({
      data:new Uint8Array(inspected.buffer.slice(0)),
      password:password||undefined,
      isEvalSupported:false,
      useWorkerFetch:false,
      stopAtErrors:false
    });
    task.onPassword=(updatePassword,reason)=>{
      if(password)updatePassword(password);
      else if(reason===PasswordResponses.NEED_PASSWORD||reason===PasswordResponses.INCORRECT_PASSWORD)task.destroy();
    };
    const pdf=await task.promise;
    if(pdf.numPages>MAX_PAGES){
      await task.destroy();
      throw new IngestionFileError("PAGE_LIMIT","The PDF has "+pdf.numPages+" pages, above the "+MAX_PAGES+"-page local safety limit.",{pageCount:pdf.numPages,max:MAX_PAGES});
    }
    const pages=[];
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      onStatus("EXTRACTING",{message:"Reading page "+pageNumber+" of "+pdf.numPages,pageNumber,pageCount:pdf.numPages});
      const page=await pdf.getPage(pageNumber);
      const textContent=await page.getTextContent({includeMarkedContent:false,disableNormalization:false});
      pages.push(buildDocumentPage({sourceDocumentId:id,pageNumber,textContent,viewport:page.getViewport({scale:1})}));
      page.cleanup();
    }
    const charCount=pages.reduce((sum,page)=>sum+page.charCount,0);
    const text=pages.map((page)=>page.text).join("\n\n");
    const emptyPages=pages.filter((page)=>page.charCount<12).length;
    const ocr=assessOcrRequirement({charCount,emptyPages,pageCount:pages.length});
    const ocrRequired=ocr.required;
    await task.destroy();
    return {
      inspected:{...inspected,buffer:undefined},
      sourceDocumentId:id,
      pageCount:pages.length,
      pages,
      text,
      charCount,
      emptyPages,
      ocr,
      status:ocrRequired?"OCR_REQUIRED":"EXTRACTED",
      extractionMethod:ocrRequired?"PDFJS_EMPTY_TEXT_LAYER":"PDFJS_TEXT_LAYER",
      warnings:ocrRequired?["No usable native text layer was found. Local OCR is required."]:[]
    };
  }catch(error){
    try{await task?.destroy();}catch{}
    if(error instanceof IngestionFileError)throw error;
    const code=errorCode(error);
    throw new IngestionFileError(code,code==="PASSWORD_REQUIRED"?"This PDF is password protected. Unlock a local copy before ingestion.":"The PDF could not be read safely.",{cause:String(error?.message||error)});
  }
}

import {clone,nowIso,safeFilename,sha256Hex,stableId,stableStringify,visibilityName} from "../core/canonical.js";
import {createTimelineArtifact} from "../artifacts/timeline-artifact.js";
import {canvasToBlob,mediaForScope,renderAdvisorPage,renderTimelineCanvas} from "./timeline-canvas-renderer.js";
import {buildImagePdf,canvasJpegPage} from "./pdf-writer.js";
import {blobEntry,buildStoredZip} from "./zip-writer.js";
import {buildAccessibleTextSummary,buildAccessibleTimelineHtml} from "./accessible-export.js";

const EXPORT_DEFS={
  INTERVIEWER_SAFE_PNG:{artifactType:"TIMELINE_INTERVIEWER_SAFE_PNG",scope:"INTERVIEWER_SAFE",mimeType:"image/png",extension:"png",visibility:"INTERVIEWER_AND_PROGRAM",approvalScopes:["interviewerSafe","export"]},
  FULL_STORY_PNG:{artifactType:"TIMELINE_FULL_STORY_PNG",scope:"FULL_STORY",mimeType:"image/png",extension:"png",visibility:"STUDENT_AND_ADVISOR",approvalScopes:["fullStory"]},
  PRINT_PDF:{artifactType:"TIMELINE_PRINT_PDF",scope:"PRINT",mimeType:"application/pdf",extension:"pdf",visibility:"INTERVIEWER_AND_PROGRAM",approvalScopes:["interviewerSafe","export"]},
  ADVISOR_PACKET_PDF:{artifactType:"TIMELINE_ADVISOR_PACKET_PDF",scope:"ADVISOR_PACKET",mimeType:"application/pdf",extension:"pdf",visibility:"ADVISOR_ONLY",approvalScopes:[]},
  SOURCE_JSON:{artifactType:"TIMELINE_SOURCE_JSON",scope:"SOURCE",mimeType:"application/json",extension:"json",visibility:"STUDENT_ONLY",approvalScopes:[]},
  ACCESSIBLE_HTML:{artifactType:"TIMELINE_ACCESSIBLE_HTML",scope:"ACCESSIBLE",mimeType:"text/html",extension:"html",visibility:"STUDENT_AND_ADVISOR",approvalScopes:[]},
  ARCHIVE:{artifactType:"TIMELINE_ARCHIVE",scope:"ARCHIVE",mimeType:"application/zip",extension:"zip",visibility:"STUDENT_ONLY",approvalScopes:[]}
};

function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);}

const SOURCE_PAYLOAD_KEYS=new Set(["rawText","rawExtraction","originalExtraction","sourceText","pageText","sourceExcerpt","extractedText","textContent","pdfBytes","rawPdfBytes","thumbnail","previewDataUrl","objectUrl"]);
function stripSourcePayload(value,path=[]){
  if(Array.isArray(value))return value.map((item,index)=>stripSourcePayload(item,[...path,index]));
  if(!value||typeof value!=="object")return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key,item])=>{
    if(SOURCE_PAYLOAD_KEYS.has(key)&&path[0]!=="retention")return [];
    return [[key,stripSourcePayload(item,[...path,key])]];
  }));
}

export function sanitizeDocumentForExport(document){
  const safe=clone(document);
  safe.events=(safe.events||[]).filter((event)=>visibilityName(event.visibilityState||event.visibility)!=="HIDDEN");
  safe.documentPages=(safe.documentPages||[]).map((page)=>({id:page.id,sourceDocumentId:page.sourceDocumentId,pageNumber:page.pageNumber,charCount:page.charCount,textLayerPresent:page.textLayerPresent,extractionMethod:page.extractionMethod,sourceTextRetained:false}));
  safe.sourceBlocks=[];
  safe.extractionCandidates=(safe.extractionCandidates||[]).map((candidate)=>{
    const value=clone(candidate);
    delete value.rawText;delete value.rawExtraction;delete value.sourceText;delete value.pageText;
    value.provenance=(value.provenance||[]).map((item)=>{const row=clone(item);delete row.sourceExcerpt;delete row.rawText;row.excerptRetained=false;return row;});
    return value;
  });
  safe.mediaItems=(safe.mediaItems||[]).filter((item)=>visibilityName(item.visibility)!=="HIDDEN").map((item)=>{const value=clone(item);delete value.thumbnail;delete value.previewDataUrl;delete value.objectUrl;value.binaryIncludedSeparately=true;return value;});
  safe.metadata={...(safe.metadata||{}),rawSourceTextIncluded:false,exportSanitizer:"D1-409.1"};
  return stripSourcePayload(safe);
}

export class ExportEngine{
  constructor({adapter,mediaManager,advisorManager,state,documentProvider,versionProvider=()=>"working"}){this.adapter=adapter;this.mediaManager=mediaManager;this.advisorManager=advisorManager;this.state=state;this.documentProvider=documentProvider;this.versionProvider=versionProvider;this.runtimeBlobs=new Map();}
  approvalState(){return clone(this.advisorManager.state);}
  assertGate(def){
    const missing=def.approvalScopes.filter((scope)=>!this.advisorManager.exportGate(scope));
    if(missing.length){const error=new Error("EXPORT_APPROVAL_REQUIRED: "+missing.join(","));error.code="EXPORT_APPROVAL_REQUIRED";error.missing=missing;throw error;}
  }
  filename(document,key,width=null){const def=EXPORT_DEFS[key],student=safeFilename(document.studentProfile?.name||"student"),version=safeFilename(this.versionProvider()||"working"),size=width?`-${width}x${Math.round(width*9/16)}`:"";return `${student}-mission-timeline-${version}-${def.scope.toLowerCase().replaceAll("_","-")}${size}.${def.extension}`;}
  async mediaResolver(item){return this.mediaManager.objectUrl(item.id);}
  async recordExport({key,blob,document,filename,dimensions=null,pageCount=null,warnings=[],companionFiles=[]}){
    const def=EXPORT_DEFS[key],artifact=await createTimelineArtifact({document,versionId:this.versionProvider()||"working",artifactType:def.artifactType,blob,filename,scope:def.scope,visibility:def.visibility,approvalState:this.approvalState(),dimensions,pageCount,companionFiles,warnings,advisorCommentCount:document.advisorReview?.comments?.length||0,generatedQuestionCount:document.interviewPractice?.questions?.length||0});
    const record={id:stableId("export",[artifact.artifactId,nowIso()]),artifactId:artifact.artifactId,key,filename,mimeType:blob.type,byteSize:blob.size,contentHash:artifact.contentHash,scope:def.scope,createdAt:nowIso(),dimensions,pageCount,warnings:clone(warnings)};
    this.runtimeBlobs.set(record.id,blob);this.state.exportRecords.push(record);this.state.timelineArtifacts.push(artifact);await this.adapter.put("exports",record);await this.adapter.put("artifacts",artifact,artifact.artifactId);await this.adapter.putBlob(`export:${record.id}`,blob,{filename,mimeType:blob.type,contentHash:artifact.contentHash});return {blob,filename,record,artifact};
  }
  async generatePng(key,{width=1920,download=false}={}){
    if(!["INTERVIEWER_SAFE_PNG","FULL_STORY_PNG"].includes(key))throw new Error("PNG export key is invalid.");const def=EXPORT_DEFS[key];this.assertGate(def);
    const document=this.documentProvider(),height=Math.round(width*9/16),rendered=await renderTimelineCanvas(document,{scope:def.scope,width,height,mediaResolver:(item)=>this.mediaResolver(item)}),blob=await canvasToBlob(rendered.canvas,"image/png"),filename=this.filename(document,key,width);
    const result=await this.recordExport({key,blob,document,filename,dimensions:{width,height},warnings:[]});if(download)downloadBlob(blob,filename);return {...result,eventCount:rendered.events.length,canvas:rendered.canvas};
  }
  async generatePdf(key,{width=2560,download=false}={}){
    if(!["PRINT_PDF","ADVISOR_PACKET_PDF"].includes(key))throw new Error("PDF export key is invalid.");const def=EXPORT_DEFS[key];this.assertGate(def);
    const document=this.documentProvider(),height=Math.round(width*9/16),scope=key==="PRINT_PDF"?"INTERVIEWER_SAFE":"ADVISOR_PACKET",rendered=await renderTimelineCanvas(document,{scope,width,height,mediaResolver:(item)=>this.mediaResolver(item)}),pages=[await canvasJpegPage(rendered.canvas)];
    if(key==="ADVISOR_PACKET_PDF"){const advisorCanvas=await renderAdvisorPage(document,{width,height});pages.push(await canvasJpegPage(advisorCanvas));}
    const blob=await buildImagePdf(pages,{title:document.title||"Mission Timeline"}),filename=this.filename(document,key),result=await this.recordExport({key,blob,document,filename,dimensions:{width,height},pageCount:pages.length,warnings:[]});if(download)downloadBlob(blob,filename);return {...result,eventCount:rendered.events.length};
  }
  async generateJson({download=false}={}){
    const key="SOURCE_JSON",document=this.documentProvider(),safeDocument=sanitizeDocumentForExport(document),json=JSON.stringify(safeDocument,null,2),blob=new Blob([json],{type:"application/json"}),filename=this.filename(document,key),result=await this.recordExport({key,blob,document:safeDocument,filename,companionFiles:[]});if(download)downloadBlob(blob,filename);return result;
  }
  async generateAccessibleHtml({scope="INTERVIEWER_SAFE",download=false}={}){
    if(!["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_PACKET","STUDENT"].includes(scope))throw new Error("Accessible export scope is invalid.");
    const key="ACCESSIBLE_HTML",document=this.documentProvider();
    if(scope==="INTERVIEWER_SAFE")this.assertGate({...EXPORT_DEFS[key],approvalScopes:["interviewerSafe","export"]});
    if(scope==="FULL_STORY")this.assertGate({...EXPORT_DEFS[key],approvalScopes:["fullStory"]});
    const html=buildAccessibleTimelineHtml(document,{scope}),blob=new Blob([html],{type:"text/html"}),base=this.filename(document,key),filename=base.replace("-accessible.html",`-${scope.toLowerCase().replaceAll("_","-")}-accessible.html`),summary=buildAccessibleTextSummary(document,{scope});
    const result=await this.recordExport({key,blob,document,filename,companionFiles:[{filename:filename.replace(/\.html$/,".txt"),byteSize:new TextEncoder().encode(summary).length,mimeType:"text/plain"}],warnings:["Visual PDFs are untagged. This semantic HTML is the accessible companion."]});if(download)downloadBlob(blob,filename);return {...result,scope,summary};
  }
  async generateArchive({download=false}={}){
    const key="ARCHIVE",document=this.documentProvider(),safeDocument=sanitizeDocumentForExport(document),timelineBytes=new TextEncoder().encode(JSON.stringify(safeDocument,null,2)),accessibleHtml=buildAccessibleTimelineHtml(safeDocument,{scope:"STUDENT"}),accessibleText=buildAccessibleTextSummary(safeDocument,{scope:"STUDENT"}),entries=[{name:"timeline-document.json",bytes:timelineBytes},{name:"accessible/timeline-accessible.html",bytes:new TextEncoder().encode(accessibleHtml)},{name:"accessible/timeline-summary.txt",bytes:new TextEncoder().encode(accessibleText)},{name:"accessible/PDF_LIMITATIONS.txt",bytes:new TextEncoder().encode("Visual PDFs in D1-410 are untagged image PDFs. Use timeline-accessible.html or timeline-summary.txt for searchable text and linear reading order. No PDF/UA claim is made.\n")}];
    const portableMediaIds=new Set(mediaForScope(document,"STUDENT").map((item)=>item.id));
    for(const media of await this.mediaManager.archiveEntries((item)=>portableMediaIds.has(item.id)))entries.push({name:media.name,bytes:media.bytes});
    const artifactIndex=new TextEncoder().encode(JSON.stringify(this.state.timelineArtifacts,null,2));entries.push({name:"timeline-artifacts.json",bytes:artifactIndex});
    for(const record of this.state.exportRecords){const blob=this.runtimeBlobs.get(record.id)||await this.adapter.getBlob(`export:${record.id}`);if(blob)entries.push(await blobEntry(`exports/${record.filename}`,blob));}
    const blob=buildStoredZip(entries),filename=this.filename(document,key),result=await this.recordExport({key,blob,document:safeDocument,filename,companionFiles:entries.map((entry)=>({filename:entry.name,byteSize:entry.bytes.length}))});if(download)downloadBlob(blob,filename);return result;
  }
  async generateArtifactManifest(artifactId,{download=false}={}){const artifact=this.state.timelineArtifacts.find((item)=>item.artifactId===artifactId);if(!artifact)throw new Error("TimelineArtifact not found.");const blob=new Blob([JSON.stringify(artifact,null,2)],{type:"application/json"}),filename=`${safeFilename(artifact.displayName)}.artifact.json`;if(download)downloadBlob(blob,filename);return {blob,filename,artifact};}
  async eraseExports(){for(const record of this.state.exportRecords){await this.adapter.delete("exports",record.id);await this.adapter.deleteBlob(`export:${record.id}`);}for(const artifact of this.state.timelineArtifacts)await this.adapter.delete("artifacts",artifact.artifactId);this.runtimeBlobs.clear();this.state.exportRecords=[];this.state.timelineArtifacts=[];}
  async contentHashForCurrent(scope="SOURCE"){
    const filtered=sanitizeDocumentForExport(this.documentProvider());
    if(scope!=="SOURCE")filtered.events=filtered.events.filter((event)=>event.visibilityState!=="HIDDEN");
    delete filtered.persistence;delete filtered.recovery;delete filtered.exportRecords;delete filtered.timelineArtifacts;delete filtered.fileVault;
    if(filtered.metadata)delete filtered.metadata.updatedAt;
    return sha256Hex(stableStringify(filtered));
  }
}

export {EXPORT_DEFS,downloadBlob};
export {buildAccessibleTimelineHtml,buildAccessibleTextSummary};

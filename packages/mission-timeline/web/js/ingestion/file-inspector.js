export const MAX_FILE_BYTES=20*1024*1024;
export const MAX_PAGES=80;

export class IngestionFileError extends Error{
  constructor(code,message,details={}){super(message);this.name="IngestionFileError";this.code=code;this.details=details;}
}

export async function sha256Hex(buffer){
  const digest=await crypto.subtle.digest("SHA-256",buffer.slice(0));
  return Array.from(new Uint8Array(digest),(byte)=>byte.toString(16).padStart(2,"0")).join("");
}

export function hasPdfMagic(buffer){
  const bytes=new Uint8Array(buffer,0,Math.min(buffer.byteLength,8));
  return String.fromCharCode(...bytes).startsWith("%PDF-");
}

export async function inspectFile(file){
  if(!file)throw new IngestionFileError("NO_FILE","Choose a local PDF to continue.");
  const name=String(file.name||"unnamed.pdf");
  if(name.toLowerCase().split(".").pop()!=="pdf")throw new IngestionFileError("UNSUPPORTED_FILE","Only PDF documents are supported in this build.",{name});
  if(file.size===0)throw new IngestionFileError("EMPTY_FILE","The selected file is empty.",{name});
  if(file.size>MAX_FILE_BYTES)throw new IngestionFileError("FILE_TOO_LARGE","The PDF is larger than the "+Math.round(MAX_FILE_BYTES/1024/1024)+" MB local safety limit.",{name,size:file.size,max:MAX_FILE_BYTES});
  const buffer=await file.arrayBuffer();
  if(!hasPdfMagic(buffer))throw new IngestionFileError("INVALID_PDF","The file does not have a valid PDF signature.",{name});
  return {name,size:file.size,mimeType:file.type||"application/pdf",lastModified:file.lastModified||null,sha256:await sha256Hex(buffer),buffer};
}

export function sourceDocumentId(sha256){return "src-"+String(sha256||"unknown").slice(0,16);}

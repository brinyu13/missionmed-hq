import {IngestionFileError,MAX_FILE_BYTES,sha256Hex,sourceDocumentId} from "./file-inspector.js";

const ZIP_EOCD_SIGNATURE=0x06054b50;
const ZIP_CENTRAL_SIGNATURE=0x02014b50;
const ZIP_LOCAL_SIGNATURE=0x04034b50;
const MAX_ZIP_ENTRIES=2048;
const MAX_XML_BYTES=16*1024*1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES=64*1024*1024;
const DOCX_MIME="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const CRC_TABLE=Uint32Array.from({length:256},(_value,index)=>{
  let crc=index;
  for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;
  return crc>>>0;
});

function fail(code,message,details={}){
  throw new IngestionFileError(code,message,details);
}

function findEocd(bytes){
  const minimum=Math.max(0,bytes.byteLength-65_557);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let offset=bytes.byteLength-22;offset>=minimum;offset--){
    if(view.getUint32(offset,true)===ZIP_EOCD_SIGNATURE)return offset;
  }
  fail("INVALID_DOCX","The file is not a valid DOCX archive.");
}

function decodeName(bytes){
  return new TextDecoder("utf-8",{fatal:false}).decode(bytes).replaceAll("\\","/");
}

function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes)crc=CRC_TABLE[(crc^byte)&0xff]^(crc>>>8);
  return(crc^0xffffffff)>>>0;
}

function centralEntries(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const eocd=findEocd(bytes);
  const disk=view.getUint16(eocd+4,true);
  const centralDisk=view.getUint16(eocd+6,true);
  const diskCount=view.getUint16(eocd+8,true);
  const count=view.getUint16(eocd+10,true);
  const centralSize=view.getUint32(eocd+12,true);
  const centralOffset=view.getUint32(eocd+16,true);
  if(disk!==0||centralDisk!==0||diskCount!==count)fail("INVALID_DOCX","Multi-part DOCX archives are not supported.");
  if(count>MAX_ZIP_ENTRIES)fail("DOCX_ARCHIVE_LIMIT","The DOCX contains too many internal files.",{count,max:MAX_ZIP_ENTRIES});
  const centralEnd=centralOffset+centralSize;
  if(centralEnd>eocd)fail("INVALID_DOCX","The DOCX archive directory is incomplete.");
  const entries=[];
  let offset=centralOffset,totalUncompressed=0;
  for(let index=0;index<count;index++){
    if(offset+46>bytes.byteLength||view.getUint32(offset,true)!==ZIP_CENTRAL_SIGNATURE)fail("INVALID_DOCX","The DOCX archive directory is malformed.");
    const flags=view.getUint16(offset+8,true);
    const method=view.getUint16(offset+10,true);
    const checksum=view.getUint32(offset+16,true);
    const compressedSize=view.getUint32(offset+20,true);
    const uncompressedSize=view.getUint32(offset+24,true);
    const nameLength=view.getUint16(offset+28,true);
    const extraLength=view.getUint16(offset+30,true);
    const commentLength=view.getUint16(offset+32,true);
    const localOffset=view.getUint32(offset+42,true);
    const nameStart=offset+46;
    const nextOffset=nameStart+nameLength+extraLength+commentLength;
    if(nextOffset>centralEnd||localOffset>=centralOffset)fail("INVALID_DOCX","The DOCX archive directory is malformed.");
    const name=decodeName(bytes.subarray(nameStart,nameStart+nameLength));
    if(!name||name.startsWith("/")||name.split("/").includes(".."))fail("INVALID_DOCX","The DOCX contains an unsafe internal path.");
    if(flags&1)fail("PASSWORD_REQUIRED","This DOCX is encrypted. Save an unlocked local copy and try again.");
    if(![0,8].includes(method))fail("UNSUPPORTED_DOCX_COMPRESSION","This DOCX uses an unsupported compression method.",{method});
    totalUncompressed+=uncompressedSize;
    if(totalUncompressed>MAX_TOTAL_UNCOMPRESSED_BYTES)fail("DOCX_ARCHIVE_LIMIT","The expanded DOCX is above the local safety limit.",{max:MAX_TOTAL_UNCOMPRESSED_BYTES});
    entries.push({name,flags,method,checksum,compressedSize,uncompressedSize,localOffset});
    offset=nextOffset;
  }
  if(offset!==centralEnd)fail("INVALID_DOCX","The DOCX archive directory has unexpected trailing data.");
  return entries;
}

async function inflateEntry(bytes,entry){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const offset=entry.localOffset;
  if(offset+30>bytes.byteLength||view.getUint32(offset,true)!==ZIP_LOCAL_SIGNATURE)fail("INVALID_DOCX","A DOCX content entry is malformed.");
  const nameLength=view.getUint16(offset+26,true);
  const extraLength=view.getUint16(offset+28,true);
  const start=offset+30+nameLength+extraLength;
  const end=start+entry.compressedSize;
  if(end>bytes.byteLength)fail("INVALID_DOCX","A DOCX content entry is incomplete.");
  if(entry.uncompressedSize>MAX_XML_BYTES)fail("DOCX_XML_LIMIT","The DOCX text content is above the local safety limit.",{max:MAX_XML_BYTES});
  const compressed=bytes.slice(start,end);
  let output;
  if(entry.method===0){
    output=compressed;
  }else{
    if(typeof DecompressionStream!=="function")fail("DOCX_DECOMPRESSION_UNAVAILABLE","This browser cannot read compressed DOCX files safely.");
    try{
      const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      output=new Uint8Array(await new Response(stream).arrayBuffer());
    }catch(error){
      fail("INVALID_DOCX","The DOCX text content could not be decompressed.",{cause:String(error?.message||error)});
    }
  }
  if(output.byteLength>MAX_XML_BYTES||output.byteLength!==entry.uncompressedSize){
    fail("INVALID_DOCX","The DOCX expanded size does not match its archive record.");
  }
  if(crc32(output)!==entry.checksum)fail("INVALID_DOCX","The DOCX text checksum is invalid.");
  return output;
}

function xmlEntity(value){
  const named={amp:"&",lt:"<",gt:">",quot:'"',apos:"'"};
  if(named[value])return named[value];
  const point=value.startsWith("#x")?Number.parseInt(value.slice(2),16):value.startsWith("#")?Number.parseInt(value.slice(1),10):null;
  if(Number.isInteger(point)&&point>=0&&point<=0x10ffff&&!((point>=0xd800)&&(point<=0xdfff)))return String.fromCodePoint(point);
  return`&${value};`;
}

export function docxXmlToLines(xml){
  const text=String(xml||"")
    .replace(/<w:tab\b[^>]*\/>/gi,"\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/gi,"\n")
    .replace(/<\/w:(?:p|tr)>/gi,"\n")
    .replace(/<w:tc\b[^>]*>/gi,"\t")
    .replace(/<[^>]+>/g,"")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_match,entity)=>xmlEntity(entity.toLowerCase()))
    .replace(/\r\n?/g,"\n");
  return text.split("\n").map((line)=>line.replace(/[\t ]+/g," ").trim()).filter(Boolean);
}

async function readDocumentXml(bytes){
  const entry=centralEntries(bytes).find(({name})=>name.toLowerCase()==="word/document.xml");
  if(!entry)fail("INVALID_DOCX","The DOCX is missing its main document text.");
  return new TextDecoder("utf-8",{fatal:false}).decode(await inflateEntry(bytes,entry));
}

export async function extractDocx(file,{onStatus=()=>{}}={}){
  if(!file)fail("NO_FILE","Choose a local DOCX to continue.");
  const name=String(file.name||"unnamed.docx");
  if(!name.toLowerCase().endsWith(".docx"))fail("UNSUPPORTED_FILE","Only DOCX documents are supported by this extractor.",{name});
  if(file.size===0)fail("EMPTY_FILE","The selected file is empty.",{name});
  if(file.size>MAX_FILE_BYTES)fail("FILE_TOO_LARGE",`The DOCX is larger than the ${Math.round(MAX_FILE_BYTES/1024/1024)} MB local safety limit.`,{name,size:file.size,max:MAX_FILE_BYTES});
  onStatus("READING",{message:"Inspecting the local DOCX"});
  const buffer=await file.arrayBuffer();
  const bytes=new Uint8Array(buffer.slice(0));
  if(bytes.byteLength<4||bytes[0]!==0x50||bytes[1]!==0x4b)fail("INVALID_DOCX","The file does not have a valid DOCX signature.",{name});
  const sha256=await sha256Hex(buffer);
  const id=sourceDocumentId(sha256);
  onStatus("EXTRACTING",{message:"Reading the DOCX text",fileName:name});
  const xml=await readDocumentXml(bytes);
  const lines=docxXmlToLines(xml);
  const text=lines.join("\n");
  if(text.length<12)fail("EMPTY_DOCUMENT_TEXT","The DOCX does not contain enough readable text.");
  const page={
    id:`${id}:document`,sourceDocumentId:id,pageNumber:null,pageLabel:"Document text",
    width:0,height:0,lines,text,charCount:text.length,textLayerPresent:true,
    extractionMethod:"DOCX_OOXML_TEXT"
  };
  return{
    inspected:{name,size:file.size,mimeType:file.type||DOCX_MIME,lastModified:file.lastModified||null,sha256},
    sourceDocumentId:id,pageCount:null,pages:[page],text,charCount:text.length,emptyPages:0,
    ocr:{required:false,reason:"DOCX_TEXT_AVAILABLE",cloud:false},status:"EXTRACTED",
    extractionMethod:"DOCX_OOXML_TEXT",warnings:["DOCX has no stable page numbering; review source sections and quoted text instead."]
  };
}

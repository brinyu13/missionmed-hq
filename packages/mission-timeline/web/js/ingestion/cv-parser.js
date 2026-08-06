const DATE_HINT=/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter|early|mid|late)\s+(?:19|20)\d{2}\b|\b\d{1,2}\/(?:19|20)\d{2}\b|\b(?:19|20)\d{2}\b|present|current/i;
const DATE_POINT="(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter|early|mid|late)\\s+(?:19|20)\\d{2}|\\d{1,2}/(?:19|20)\\d{2}|(?:19|20)\\d{2})";
const DATE_RANGE=new RegExp(`(${DATE_POINT}(?:\\s*(?:-|–|—|to|through|until)\\s*(?:present|current|ongoing|${DATE_POINT}))?)`,"i");

function recordFromPipe(block){
  const parts=block.text.split("|").map((part)=>part.trim()).filter(Boolean);
  if(parts.length<2)return null;
  const dateIndex=parts.findIndex((part)=>DATE_HINT.test(part));
  if(dateIndex<0)return null;
  const dates=parts[dateIndex];
  const rest=parts.filter((_,index)=>index!==dateIndex);
  return {
    section:block.section,
    pageNumber:block.pageNumber,
    pageNumbers:[block.pageNumber],
    sourceBlocks:[block],
    title:rest[0]||"Unclassified CV entry",
    organization:rest[1]||"",
    location:rest[2]||"",
    dates,
    description:rest.slice(3).join(" | "),
    experienceType:"",
    specialty:"",
    rawText:block.text,
    fields:{}
  };
}

function recordFromFreeLine(block){
  if(!DATE_HINT.test(block.text))return null;
  let match=block.text.match(/^(.+?)\s{2,}(.+?\b(?:19|20)\d{2}(?:\s+(?:-|to|through)\s+(?:present|current|.+?\b(?:19|20)\d{2}))?)$/i);
  if(match)return {section:block.section,pageNumber:block.pageNumber,pageNumbers:[block.pageNumber],sourceBlocks:[block],title:match[1].trim(),organization:"",location:"",dates:match[2].trim(),description:"",experienceType:"",specialty:"",rawText:block.text,fields:{}};
  match=block.text.match(/^((?:19|20)\d{2})\s*[:.-]\s*(.+)$/);
  if(match)return {section:block.section,pageNumber:block.pageNumber,pageNumbers:[block.pageNumber],sourceBlocks:[block],title:match[2].trim(),organization:"",location:"",dates:match[1],description:"",experienceType:"",specialty:"",rawText:block.text,fields:{}};
  return null;
}

function chronologyRecord(block,available){
  if(!DATE_HINT.test(block.text)||/^[^:]{2,36}:\s*.+$/.test(block.text))return null;
  const match=block.text.match(DATE_RANGE);
  if(!match)return null;
  const dates=match[1].trim();
  const remainder=block.text.replace(match[0],"").replace(/^[\s|,;:–—-]+|[\s|,;:–—-]+$/g,"").trim();
  const preceding=available.filter((candidate)=>
    candidate.pageNumber===block.pageNumber&&
    candidate.section===block.section&&
    candidate.lineNumber<block.lineNumber&&
    block.lineNumber-candidate.lineNumber<=3&&
    !DATE_HINT.test(candidate.text)&&
    !/^[^:]{2,36}:\s*.+$/.test(candidate.text)
  ).slice(-2);
  if(!remainder&&!preceding.length)return null;
  let title=remainder,organization="",sourceBlocks=[...preceding,block];
  if(!title){
    title=preceding.length>1?preceding.at(-2).text:preceding.at(-1).text;
    organization=preceding.length>1?preceding.at(-1).text:"";
  }else if(preceding.length){
    organization=preceding.at(-1).text;
  }
  return{
    section:block.section,pageNumber:block.pageNumber,pageNumbers:[block.pageNumber],
    sourceBlocks,title,organization,location:"",dates,description:"",experienceType:"",
    specialty:"",rawText:sourceBlocks.map((item)=>item.text).join("\n"),fields:{}
  };
}

function parseKeyValueGroups(blocks){
  const records=[];
  let current=null;
  const flush=()=>{
    if(!current)return;
    if(!current.dates&&current.startDate)current.dates=current.endDate?current.startDate+" - "+current.endDate:current.startDate;
    if(current.title||current.dates){current.rawText=current.sourceBlocks.map((block)=>block.text).join("\n");current.pageNumbers=[...new Set(current.sourceBlocks.map((block)=>block.pageNumber))];records.push(current);}
    current=null;
  };
  (blocks||[]).forEach((block)=>{
    const match=block.text.match(/^([^:]{2,36}):\s*(.+)$/);
    if(!match)return;
    const key=match[1].toLowerCase().trim();
    const value=match[2].trim();
    if(["position","title","role","exam","degree"].includes(key)&&current?.title)flush();
    current=current||{section:block.section,pageNumber:block.pageNumber,sourceBlocks:[],title:"",organization:"",location:"",dates:"",startDate:"",endDate:"",description:"",experienceType:"",specialty:"",fields:{}};
    current.sourceBlocks.push(block);
    current.fields[key]=value;
    if(["position","title","role","exam","degree"].includes(key))current.title=value;
    if(["organization","institution","employer"].includes(key))current.organization=value;
    if(key==="location")current.location=value;
    if(["dates","date","graduation date"].includes(key))current.dates=value;
    if(key==="start date")current.startDate=value;
    if(key==="end date")current.endDate=value;
    if(key==="description")current.description=value;
  });
  flush();
  return records;
}

export function parseCvBlocks(blocks){
  const records=[];
  const consumed=new Set();
  (blocks||[]).forEach((block)=>{
    const record=recordFromPipe(block)||recordFromFreeLine(block);
    if(record){records.push(record);consumed.add(block.id);}
  });
  (blocks||[]).filter((block)=>!consumed.has(block.id)).forEach((block)=>{
    const available=(blocks||[]).filter((candidate)=>!consumed.has(candidate.id));
    const record=chronologyRecord(block,available);
    if(record){records.push(record);record.sourceBlocks.forEach((item)=>consumed.add(item.id));}
  });
  const keyValue=parseKeyValueGroups((blocks||[]).filter((block)=>!consumed.has(block.id)));
  return records.concat(keyValue);
}

export function parseResumeBlocks(blocks){return parseCvBlocks(blocks).map((record)=>({...record,parserHint:"resume"}));}
export function parseUnknownBlocks(blocks){return parseCvBlocks(blocks).map((record)=>({...record,parserHint:"unknown"}));}

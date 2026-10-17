const START_KEYS=new Set(["experience type","exam","degree","certification","publication title","presentation title","activity","training type"]);

function blankRecord(block){
  return {section:block?.section||"unknown",pageNumber:block?.pageNumber||1,sourceBlocks:[],title:"",organization:"",location:"",dates:"",startDate:"",endDate:"",description:"",experienceType:"",specialty:"",fields:{}};
}

function hasRecord(record){return !!(record&&(record.title||record.dates||record.startDate||record.organization||record.description));}

function finalize(record,output){
  if(!hasRecord(record))return;
  if(!record.dates)record.dates=record.startDate&&record.endDate?record.startDate+" - "+record.endDate:record.startDate||record.endDate||"";
  if(!record.title)record.title=record.experienceType||record.fields.type||record.fields.position||"Unclassified ERAS entry";
  record.rawText=record.sourceBlocks.map((block)=>block.text).join("\n");
  record.pageNumbers=[...new Set(record.sourceBlocks.map((block)=>block.pageNumber))];
  output.push(record);
}

function assign(record,key,value){
  record.fields[key]=value;
  if(["position","role","title","exam","degree","certification","publication title","presentation title","activity"].includes(key))record.title=value;
  else if(["organization","institution","hospital","clinic","program"].includes(key))record.organization=value;
  else if(key==="location"||key==="city/state")record.location=value;
  else if(["dates","date","graduation date","completion date"].includes(key))record.dates=value;
  else if(key==="start date")record.startDate=value;
  else if(key==="end date")record.endDate=value;
  else if(["description","details","responsibilities"].includes(key))record.description=(record.description+" "+value).trim();
  else if(key==="experience type"||key==="training type"||key==="type")record.experienceType=value;
  else if(key==="specialty"||key==="service")record.specialty=value;
}

function pipeRecord(block){
  const parts=block.text.split("|").map((part)=>part.trim()).filter(Boolean);
  if(parts.length<2)return null;
  const dateIndex=parts.findIndex((part)=>/\b(?:19|20)\d{2}\b|present|current/i.test(part));
  if(dateIndex<0)return null;
  const date=parts[dateIndex];
  const fields=parts.filter((_,index)=>index!==dateIndex);
  return {...blankRecord(block),title:fields[0]||"",organization:fields[1]||"",location:fields[2]||"",dates:date,sourceBlocks:[block],rawText:block.text,pageNumbers:[block.pageNumber]};
}

export function parseErasBlocks(blocks){
  const records=[];
  let current=null;
  let currentSection=null;
  (blocks||[]).forEach((block)=>{
    if(current&&currentSection!==block.section&&hasRecord(current)){finalize(current,records);current=null;}
    currentSection=block.section;
    const match=block.text.match(/^([^:]{2,42}):\s*(.*)$/);
    if(match){
      const key=match[1].trim().toLowerCase();
      const value=match[2].trim();
      if(START_KEYS.has(key)&&current&&hasRecord(current)){finalize(current,records);current=null;}
      current=current||blankRecord(block);
      current.sourceBlocks.push(block);
      assign(current,key,value);
      return;
    }
    const piped=pipeRecord(block);
    if(piped){if(current&&hasRecord(current))finalize(current,records);records.push(piped);current=null;return;}
    if(current){
      current.sourceBlocks.push(block);
      current.description=(current.description+" "+block.text).trim();
    }
  });
  finalize(current,records);
  return records;
}

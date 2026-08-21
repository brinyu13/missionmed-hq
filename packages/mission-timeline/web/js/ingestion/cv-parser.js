const DATE_HINT=/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter|early|mid|late)\.?\s+(?:\d{1,2},?\s+)?(?:19|20)\d{2}\b|\b\d{1,2}\/(?:19|20)\d{2}\b|\b(?:19|20)\d{2}\b|present|current/i;
/* ISO first so "2023-01-15" is captured whole; the bare-year branch would otherwise stop at
   "2023" and leave "-01-15" glued to the title. */
const DATE_POINT="(?:(?:19|20)\\d{2}-\\d{2}(?:-\\d{2})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter|early|mid|late)\\.?\\s+(?:\\d{1,2},?\\s+)?(?:19|20)\\d{2}|\\d{1,2}/(?:19|20)\\d{2}|(?:19|20)\\d{2})";
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
  let match=block.text.match(/^(.+?)\s{2,}(.+?\b(?:19|20)\d{2}(?:-\d{2}(?:-\d{2})?)?(?:\s*(?:-|\u2013|\u2014|to|through)\s*(?:present|current|ongoing|.+?\b(?:19|20)\d{2}(?:-\d{2}(?:-\d{2})?)?))?)$/i);
  if(match)return {section:block.section,pageNumber:block.pageNumber,pageNumbers:[block.pageNumber],sourceBlocks:[block],title:match[1].trim(),organization:"",location:"",dates:match[2].trim(),description:"",experienceType:"",specialty:"",rawText:block.text,fields:{}};
  match=block.text.match(/^((?:19|20)\d{2})\s*[:.-]\s*(.+)$/);
  if(match)return {section:block.section,pageNumber:block.pageNumber,pageNumbers:[block.pageNumber],sourceBlocks:[block],title:match[2].trim(),organization:"",location:"",dates:match[1],description:"",experienceType:"",specialty:"",rawText:block.text,fields:{}};
  return null;
}

/* A CV pairs a dated line with a neighbouring line, but which side that neighbour sits on
   is a property of the section's layout, not of the individual entry: some CVs write
   [institution][dated title], others write [dated title][institution]. Guessing per-entry
   shifted every institution up by one and turned a blank field into a confidently wrong
   one - which then flows into the approved event through the one-click accept path. Decide
   the direction once per section, and never adopt a line that reads as prose. */
/* Past-tense duty verbs only. Matching verb STEMS rejected ordinary job titles -
   "Rotating Internship" and "Research Assistant" are entries, not descriptions. */
const INSTITUTION_HINT=/\b(?:hospital|clinic|university|college|centre|center|medical|institute|school|health|foundation|academy|laborator(?:y|ies)|trust|sciences)\b/i;
const PROSE_OPENER=/^(?:shadowed|shadowing|assisted|assisting|performed|performing|managed|managing|presented|presenting|participated|participating|conducted|conducting|observed|observing|attended|attending to|prepared|preparing|collected|collecting|analy[sz]ed|analy[sz]ing|reviewed|reviewing|authored|co-authored|developed|developing|designed|designing|implemented|implementing|supported|supporting|provided|providing|delivered|delivering|collaborated|coordinated|responsible|duties included)\b/i;

function adoptableEntryLine(text){
  const value=String(text||"").trim();
  if(!value||value.length>120)return false;
  if(PROSE_OPENER.test(value)&&value.split(/\s+/).length>4)return false;
  if(/^[^:]{2,36}:\s*.+$/.test(value))return false;
  /* A trailing sentence full stop marks prose; an abbreviation does not. */
  if(/[.!?]$/.test(value)&&!/\b(?:inc|llc|ltd|co|univ|dept)\.$/i.test(value))return false;
  const words=value.split(/\s+/);
  /* A lone word with no comma is a heading the section detector did not recognise
     ("Miscellaneous", "Publications"), not an institution. Adopting it put a section
     title on the student's event as its organization. */
  if(words.length<=1&&!value.includes(",")&&!INSTITUTION_HINT.test(value))return false;
  return words.length<=14;
}

function sectionEntryOrientation(blocks){
  const orientation=new Map();
  for(const block of blocks||[]){
    const key=`${block.pageNumber}|${block.section}`;
    if(orientation.has(key))continue;
    orientation.set(key,DATE_HINT.test(block.text)?1:-1);
  }
  return orientation;
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

/*
 * C-05: two-line education blocks are written in both orders. When the school is on the
 * dated line and the degree above it, the generic "remainder is the title" rule produced
 * title="Universidad ..." / organization="Doctor of Medicine", which then drove the wrong
 * medicalSchool downstream. Only flip when one side is unambiguously a credential and the
 * other unambiguously an institution - anything less certain is left exactly as parsed.
 */
const ABBREVIATED_DEGREE=/\b(?:MD|DO|MBBS|MBChB|MBBCh|PhD|MSc|BSc|MPH|MS|BS|BA|MA|DDS|DVM|PharmD)\b/;
const WORDED_DEGREE=/\b(?:doctor of medicine|bachelor(?:'s)?|master(?:'s)?|doctorate|degree|diploma|m\.d\.|d\.o\.|ph\.?d\.)\b/i;
const INSTITUTION_LIKE=/\b(?:universit(?:y|ies|e|ies)|universidad|universidade|universite|college|school|faculty|facultad|institute|instituto|academy|hospital|centre|center|clinic)\b/i;
const ROLE_LIKE=/\b(?:observership|externship|clerkship|sub-?internship|internship|residency|resident|fellowship|fellow|rotation|elective|assistant|associate|coordinator|officer|physician|surgeon|volunteer|scribe|technician|researcher|intern|manager|director|instructor|tutor|nurse|therapist)\b/i;
/* "Baltimore, MD" is a city, not a doctorate: a trailing US state code has to come off
   before the credential test or every US address reads as a degree. */
function withoutTrailingState(value){return String(value||"").replace(/,\s*[A-Z]{2}\.?\s*(?:\d{5}(?:-\d{4})?)?\s*$/,"").trim();}
function degreeLike(value){const bare=withoutTrailingState(value);return ABBREVIATED_DEGREE.test(bare)||WORDED_DEGREE.test(bare);}
function credentialLike(value){return degreeLike(value)||ROLE_LIKE.test(value);}
function orientCredentialRecord(record){
  const title=String(record.title||""),organization=String(record.organization||"");
  if(!title||!organization)return record;
  if(!credentialLike(organization)||INSTITUTION_LIKE.test(organization))return record;
  if(credentialLike(title))return record;
  return {...record,title:organization,organization:title};
}

export function parseCvBlocks(blocks){
  const records=[];
  const consumed=new Set();
  const orientation=sectionEntryOrientation(blocks);
  (blocks||[]).forEach((block,index)=>{
    const record=recordFromPipe(block)||recordFromFreeLine(block);
    if(!record)return;
    /* A dated line carrying no organization is usually one line of a two-line entry. The
       institution may sit either side of it, so consider both neighbours and take only one
       that genuinely reads as an institution. */
    if(!record.organization){
      const neighbour=(offset)=>{
        const candidate=(blocks||[])[index+offset];
        if(!candidate||consumed.has(candidate.id))return null;
        if(candidate.pageNumber!==block.pageNumber||candidate.section!==block.section)return null;
        if(candidate.lineNumber!==block.lineNumber+offset)return null;
        if(DATE_HINT.test(candidate.text))return null;
        return adoptableEntryLine(candidate.text)?candidate:null;
      };
      const preferred=orientation.get(`${block.pageNumber}|${block.section}`)||-1;
      const adopted=neighbour(preferred)||neighbour(-preferred);
      if(adopted){
        record.organization=adopted.text;
        const before=adopted.lineNumber<block.lineNumber;
        record.sourceBlocks=before?[adopted,...record.sourceBlocks]:[...record.sourceBlocks,adopted];
        record.rawText=before?`${adopted.text}\n${record.rawText}`:`${record.rawText}\n${adopted.text}`;
        consumed.add(adopted.id);
      }
    }
    records.push(record);
    consumed.add(block.id);
  });
  (blocks||[]).filter((block)=>!consumed.has(block.id)).forEach((block)=>{
    const available=(blocks||[]).filter((candidate)=>!consumed.has(candidate.id));
    const record=chronologyRecord(block,available);
    if(record){records.push(record);record.sourceBlocks.forEach((item)=>consumed.add(item.id));}
  });
  const keyValue=parseKeyValueGroups((blocks||[]).filter((block)=>!consumed.has(block.id)));
  return records.concat(keyValue).map(orientCredentialRecord);
}

export function parseResumeBlocks(blocks){return parseCvBlocks(blocks).map((record)=>({...record,parserHint:"resume"}));}
export function parseUnknownBlocks(blocks){return parseCvBlocks(blocks).map((record)=>({...record,parserHint:"unknown"}));}

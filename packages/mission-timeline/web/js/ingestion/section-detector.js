const SECTION_ALIASES={
  education:["education","medical education","medical school","academic background"],
  postgraduate_training:["postgraduate training","graduate medical education","internship and residency","training"],
  certifications:["certifications","certification","licensure","licenses and certifications"],
  examinations:["examinations","exams","usmle examinations","licensure examinations"],
  experiences:["experiences","professional experience","clinical experience","clinical experiences","clinical rotations","rotations","clerkships","clinical clerkships","observerships","externships","usce","us clinical experience","united states clinical experience"],
  work:["work experience","employment","employment history","professional experience"],
  volunteer:["volunteer experience","volunteer","community service"],
  research:["research experience","research"],
  publications:["publications","peer reviewed publications"],
  presentations:["presentations","posters and presentations","abstracts"],
  leadership:["leadership","leadership experience"],
  memberships:["memberships","professional memberships"],
  honors:["honors","honours","awards","awards and honors","honors and awards","awards & honors","medical school awards","honors and service","honors & service"],
  languages:["languages","language fluency"],
  interests:["hobbies and interests","interests","hobbies"],
  personal:["personal information","personal history","additional information"],
  geographic_history:["geographic history","locations"],
  visa_status:["visa status","immigration status"],
  summary:["professional summary","summary","objective"]
};

const ALIAS_LOOKUP=new Map(Object.entries(SECTION_ALIASES).flatMap(([key,values])=>values.map((value)=>[value,key])));
/* Longest alias first so "graduate medical education" resolves to postgraduate_training
   instead of stopping at the shorter "education". */
const ALIAS_BY_LENGTH=[...ALIAS_LOOKUP.entries()].sort((left,right)=>right[0].length-left[0].length);
const HEADING_FILLER=new Set(["and","or","of","the","a","an","in","for","to","my","amp","&","-","/","us","usa","u s","united","states"]);
const SMALL_HEADING_WORD=new Set(["and","or","of","the","a","an","in","for","to","at","on","my","&","-","/","us","usa"]);
function normalizeHeading(line){return String(line||"").toLowerCase().replace(/[:.]+$/g,"").replace(/\s+/g," ").trim();}

/*
 * A heading only counts as a heading when the aliases it contains cover the WHOLE line.
 * "Research Experience and Publications" is covered (two aliases plus a filler word) and
 * is a real section break; "Clinical Experience at Mount Sinai" is not, and used to be
 * eligible under a bare substring test that would have swallowed the entry as a heading.
 */
function coveringAliasKey(normalized){
  let remainder=" "+normalized.replace(/[()]/g," ").replace(/\s+/g," ").trim()+" ";
  let key=null,longest=0;
  for(const [alias,value] of ALIAS_BY_LENGTH){
    if(!remainder.includes(" "+alias+" "))continue;
    remainder=remainder.replace(" "+alias+" "," ");
    if(alias.length>longest){longest=alias.length;key=value;}
  }
  if(!key)return null;
  return remainder.trim().split(" ").filter(Boolean).every((word)=>HEADING_FILLER.has(word))?key:null;
}

/* Title Case headings ("Postgraduate Training", "US Clinical Experience") are as common in
   real CVs as ALL CAPS ones and were previously invisible unless they were exact aliases. */
function headingCased(line){
  const text=String(line).trim();
  if(text===text.toUpperCase())return true;
  return text.split(/\s+/).every((word)=>{
    const bare=word.replace(/^[("']+|[)"':.,]+$/g,"");
    if(!bare)return true;
    if(SMALL_HEADING_WORD.has(bare.toLowerCase()))return true;
    return /^[A-Z0-9]/.test(bare);
  });
}

export function classifyHeading(line){
  const normalized=normalizeHeading(line);
  if(ALIAS_LOOKUP.has(normalized))return ALIAS_LOOKUP.get(normalized);
  if(normalized.length>70)return null;
  const words=normalized.split(" ");
  const looksLikeHeading=words.length<=7&&headingCased(line)&&!/[|,]/.test(line)&&!/\d{4}/.test(normalized);
  if(looksLikeHeading)return coveringAliasKey(normalized);
  return null;
}

export function detectSections(pages){
  const blocks=[];
  const sectionCounts={};
  /* Section context is a property of the document, not of the page: resetting it per page
     dropped the section for every entry after the first page break. */
  let currentSection="unknown";
  (pages||[]).forEach((page)=>{
    page.lines.forEach((line,index)=>{
      const heading=classifyHeading(line);
      if(heading){currentSection=heading;sectionCounts[heading]=(sectionCounts[heading]||0)+1;return;}
      if(!String(line).trim())return;
      blocks.push({
        id:page.id+":block:"+(index+1),
        sourceDocumentId:page.sourceDocumentId,
        pageId:page.id,
        pageNumber:page.pageNumber,
        section:currentSection,
        lineNumber:index+1,
        text:String(line).trim(),
        extractionMethod:page.extractionMethod
      });
    });
  });
  return {blocks,sections:Object.keys(sectionCounts),sectionCounts};
}

export {SECTION_ALIASES};

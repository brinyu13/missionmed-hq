const SECTION_ALIASES={
  education:["education","medical education","medical school","academic background"],
  postgraduate_training:["postgraduate training","graduate medical education","internship and residency","training"],
  certifications:["certifications","certification","licensure","licenses and certifications"],
  examinations:["examinations","exams","usmle examinations","licensure examinations"],
  experiences:["experiences","professional experience","clinical experience"],
  work:["work experience","employment","employment history","professional experience"],
  volunteer:["volunteer experience","volunteer","community service"],
  research:["research experience","research"],
  publications:["publications","peer reviewed publications"],
  presentations:["presentations","posters and presentations","abstracts"],
  leadership:["leadership","leadership experience"],
  memberships:["memberships","professional memberships"],
  honors:["honors","awards and honors","medical school awards","honors and service","honors & service"],
  languages:["languages","language fluency"],
  interests:["hobbies and interests","interests","hobbies"],
  personal:["personal information","personal history","additional information"],
  geographic_history:["geographic history","locations"],
  visa_status:["visa status","immigration status"],
  summary:["professional summary","summary","objective"]
};

const ALIAS_LOOKUP=new Map(Object.entries(SECTION_ALIASES).flatMap(([key,values])=>values.map((value)=>[value,key])));
function normalizeHeading(line){return String(line||"").toLowerCase().replace(/[:.]+$/g,"").replace(/\s+/g," ").trim();}

export function classifyHeading(line){
  const normalized=normalizeHeading(line);
  if(ALIAS_LOOKUP.has(normalized))return ALIAS_LOOKUP.get(normalized);
  if(normalized.length>70)return null;
  const words=normalized.split(" ");
  const looksLikeHeading=words.length<=7&&String(line).trim()===String(line).trim().toUpperCase()&&!/[|,]/.test(line);
  if(looksLikeHeading){
    for(const [alias,key] of ALIAS_LOOKUP.entries())if(normalized.includes(alias))return key;
  }
  return null;
}

export function detectSections(pages){
  const blocks=[];
  const sectionCounts={};
  (pages||[]).forEach((page)=>{
    let currentSection="unknown";
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

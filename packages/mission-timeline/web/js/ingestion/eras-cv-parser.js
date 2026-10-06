/*
 * Structured parser for the CV that MyERAS generates for applicants.
 *
 * That document has a fixed layout: a page header "Lastname, First Middle (AAMC ID)",
 * fixed section headings ("Medical Education", "Experiences", "Scholarly Work", ...),
 * and one experience block per entry made of a title line, an institution line with the
 * MM/YYYY range, an ERAS experience-type line with the city/state, then bullet text.
 * The generic CV parser reads that layout as loose free text and loses the location,
 * the type, the degree and the applicant identity. This parser reads the layout as the
 * structured source it is. Every record keeps the exact lines it came from. Nothing is
 * inferred that the page does not state; interpretation happens later, in the
 * classifier, with the source wording attached.
 *
 * It accepts either line model: the browser text layer (institution and dates on one
 * visual line) or the server block stream (one text item per line).
 */
const MONTHS="January|February|March|April|May|June|July|August|September|October|November|December";
const MONTH_ABBR="Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const PAGE_CHROME=[
  /^Page \d+$/i,
  /^Confidential - Do not disclose/i,
  /^Curriculum Vitae$/i
];
const NAME_HEADER=/^([^,()]{1,80}),\s*([^,()]{1,80}?)\s*\((\d{5,12})\)$/;
const PREFERRED_HEADER=/^([^,()]{1,80}),\s*([^,()]{1,80}?)\s*\(([^()]{1,60}?)\s*\)$/;
const AAMC_LINE=/^AAMC ID:\s*(\d{5,12})$/i;
const DATE_RANGE_TAIL=/\s*(\d{2}\/\d{4})\s*[-–—]\s*(\d{2}\/\d{4}|Present|Current)\s*$/i;
const DATE_RANGE_ONLY=/^(\d{2}\/\d{4})\s*[-–—]\s*(\d{2}\/\d{4}|Present|Current)$/i;
const ERAS_TYPES=[
  "Education/training","Volunteer/service/advocacy","Other extracurricular activities/clubs",
  "Professional organization","Teaching/mentoring","Military service","Leadership","Research","Work"
];
const ERAS_TYPE_LINE=new RegExp(`^(${ERAS_TYPES.map((type)=>type.replace(/[/]/g,"\\/")).join("|")})(?:\\s+(.*))?$`,"i");
const SECTION_HEADINGS=new Map([
  ["medical education","medical_education"],
  ["education","education"],
  ["postgraduate training","postgraduate_training"],
  ["honors & awards","honors"],["honors and awards","honors"],["medical school awards","honors"],["other awards/accomplishments","honors"],
  ["professional memberships","memberships"],
  ["hobbies & interests","interests"],["hobbies and interests","interests"],
  ["certifications","certifications"],["licensure","licensure"],
  ["experiences","experiences"],
  ["scholarly work","scholarly_work"],["publications","scholarly_work"],["presentations","scholarly_work"],
  ["proficient languages","languages"],["languages","languages"],
  ["military service","military"],
  ["personal information","personal"]
]);
const SCHOLARLY_KINDS=new Map([
  ["journal article","PUBLICATION"],["journal abstract","ABSTRACT_POSTER_PRESENTATION"],["book chapter","PUBLICATION"],
  ["oral presentation","ABSTRACT_POSTER_PRESENTATION"],["poster presentation","ABSTRACT_POSTER_PRESENTATION"],
  ["non peer reviewed online publication","PUBLICATION"],["other articles","PUBLICATION"],["scientific monograph","PUBLICATION"],
  ["thesis","PUBLICATION"],["non-peer reviewed online publication","PUBLICATION"]
]);
const SCHOLARLY_METADATA=/^(Publication Status|Article URL|Abstract URL|Event Link|Conference Abstract|Poster URL|Most Meaningful|First Author|Cited in PubMed)\b/i;
const text=(value)=>String(value||"").replace(/\s+/g," ").trim();

function headingKey(line){
  const normalized=text(line).toLowerCase().replace(/[:.]+$/,"");
  return SECTION_HEADINGS.get(normalized)||null;
}
function scholarlyKind(line){
  const normalized=text(line).toLowerCase().replace(/\s*\(.*\)\s*$/,"");
  return SCHOLARLY_KINDS.get(normalized)||null;
}
function monthFromNumeric(value){
  const match=String(value||"").match(/^(\d{2})\/(\d{4})$/);
  if(!match)return null;
  const month=Number(match[1]),year=Number(match[2]);
  if(month<1||month>12||year<1900||year>2200)return null;
  return `${year}-${String(month).padStart(2,"0")}`;
}
function naturalName(sourceForm){
  const match=String(sourceForm||"").match(/^([^,]+),\s*(.+)$/);
  if(!match)return text(sourceForm);
  return text(`${match[2]} ${match[1]}`);
}

/** Lines the applicant did not write: page numbers, footers, repeated headers. */
export function isErasPageChrome(line,identity=null){
  const value=text(line);
  if(!value)return true;
  if(PAGE_CHROME.some((pattern)=>pattern.test(value)))return true;
  if(identity?.sourceForm&&NAME_HEADER.test(value))return true;
  return false;
}

/**
 * The applicant identity the MyERAS CV prints on every page: "Lastname, First (AAMC ID)"
 * and the explicit "AAMC ID:" line. Both must agree, or no identity is claimed.
 */
export function erasIdentityClaim(pages=[]){
  const headers=[],aamcLines=[],preferred=[];
  for(const page of pages||[]){
    (page.lines||[]).forEach((raw,index)=>{
      const line=text(raw);
      const block={pageId:page.id,pageNumber:page.pageNumber,lineNumber:index+1,id:`${page.id}:block:${index+1}`,text:line};
      const header=line.match(NAME_HEADER);
      if(header){headers.push({block,lastName:text(header[1]),givenNames:text(header[2]),aamcId:header[3]});return;}
      const aamc=line.match(AAMC_LINE);
      if(aamc){aamcLines.push({block,aamcId:aamc[1]});return;}
      const pref=Number(page.pageNumber)===1?line.match(PREFERRED_HEADER):null;
      if(pref&&!/\d/.test(pref[3]))preferred.push({block,lastName:text(pref[1]),givenNames:text(pref[2]),preferredName:text(pref[3])});
    });
  }
  if(!headers.length)return null;
  const forms=new Set(headers.map((item)=>`${item.lastName}, ${item.givenNames}|${item.aamcId}`));
  if(forms.size!==1)return{conflict:true,reason:"The CV pages name more than one applicant.",provenance:headers.map((item)=>item.block)};
  const first=headers[0];
  if(aamcLines.some((item)=>item.aamcId!==first.aamcId))return{conflict:true,reason:"The AAMC ID lines disagree.",provenance:[...headers,...aamcLines].map((item)=>item.block)};
  const sourceForm=`${first.lastName}, ${first.givenNames}`;
  const preferredName=preferred.find((item)=>item.lastName===first.lastName&&item.givenNames===first.givenNames)?.preferredName||"";
  return{
    conflict:false,
    sourceForm,
    fullName:naturalName(sourceForm),
    lastName:first.lastName,
    givenNames:first.givenNames,
    preferredName,
    aamcId:first.aamcId,
    extractionMethod:"MYERAS_CV_PAGE_HEADER",
    provenance:[...new Map([first,...aamcLines].map((item)=>[item.block.id,item.block])).values()]
  };
}

/** True when the page text has the MyERAS CV signature, whatever the declared type says. */
export function isErasCvLayout(pages=[]){
  const lines=(pages||[]).flatMap((page)=>page.lines||[]).map(text);
  const hasIdentity=lines.some((line)=>NAME_HEADER.test(line))&&lines.some((line)=>AAMC_LINE.test(line));
  const hasExperiences=lines.some((line)=>headingKey(line)==="experiences");
  const hasTypeLine=lines.some((line)=>ERAS_TYPE_LINE.test(line));
  return hasIdentity&&hasExperiences&&hasTypeLine;
}

function makeBlock(page,index,section){
  return{
    id:`${page.id}:block:${index+1}`,
    sourceDocumentId:page.sourceDocumentId,
    pageId:page.id,
    pageNumber:page.pageNumber,
    section,
    lineNumber:index+1,
    text:text(page.lines[index]),
    extractionMethod:page.extractionMethod
  };
}

function record(section,blocks,values){
  const sourceBlocks=[...blocks];
  const first=sourceBlocks[0];
  return{
    section,
    pageNumber:first?.pageNumber||1,
    pageNumbers:[...new Set(sourceBlocks.map((block)=>block.pageNumber))],
    sourceBlocks,
    title:"",organization:"",location:"",dates:"",startDate:"",endDate:"",description:"",experienceType:"",specialty:"",
    rawText:sourceBlocks.map((block)=>block.text).join("\n"),
    fields:{erasSection:section},
    ...values
  };
}

function splitDateTail(line){
  const match=line.match(DATE_RANGE_TAIL);
  if(!match)return null;
  return{head:text(line.slice(0,match.index)),dates:`${match[1]} - ${/^\d/.test(match[2])?match[2]:"Present"}`};
}

/* One Experiences entry:
 *   Title
 *   Institution MM/YYYY - MM/YYYY            (or Institution / MM/YYYY - MM/YYYY on two lines)
 *   <ERAS type> City, ST                     (or <ERAS type> / City, ST on two lines)
 *   - bullet text ... / Most Meaningful: ...
 * A title repeated at the top of the next page with no dated line after it continues
 * the previous entry.
 */
function parseExperiences(entries){
  const records=[];
  let current=null,index=0;
  const peek=(offset=0)=>entries[index+offset]||null;
  while(index<entries.length){
    const entry=peek();
    const line=entry.text;
    const next=peek(1),after=peek(2);
    const tail=next?splitDateTail(next.text):null;
    const twoLine=next&&after&&!DATE_RANGE_ONLY.test(next.text)&&DATE_RANGE_ONLY.test(after.text);
    // Structure decides: a line followed by "<institution> <range>" is a title, even when
    // the title itself starts with a type word ("Research Elective", "Work Study").
    const startsEntry=!line.startsWith("-")&&!/^Most Meaningful:?/i.test(line)&&(
      (tail&&tail.head)||twoLine
    );
    if(startsEntry){
      current=record("experiences",[entry],{title:line,fields:{erasSection:"experiences"}});
      records.push(current);
      if(tail&&tail.head){
        current.organization=tail.head;current.dates=tail.dates;current.sourceBlocks.push(next);index+=2;
      }else{
        current.organization=next.text;current.dates=after.text.replace(/\s*[-–—]\s*/,' - ').replace(/current$/i,'Present');current.sourceBlocks.push(next,after);index+=3;
      }
      const typeEntry=peek();
      const typeMatch=typeEntry?typeEntry.text.match(ERAS_TYPE_LINE):null;
      if(typeMatch){
        current.experienceType=ERAS_TYPES.find((type)=>type.toLowerCase()===typeMatch[1].toLowerCase())||typeMatch[1];
        current.fields.erasType=current.experienceType;
        current.sourceBlocks.push(typeEntry);
        index+=1;
        if(text(typeMatch[2])){current.location=text(typeMatch[2]);}
        else{
          const locationEntry=peek();
          if(locationEntry&&!locationEntry.text.startsWith("-")&&!/^Most Meaningful:?/i.test(locationEntry.text)&&!splitDateTail(locationEntry.text)&&locationEntry.text.length<=80){
            current.location=locationEntry.text;current.sourceBlocks.push(locationEntry);index+=1;
          }
        }
      }
      continue;
    }
    if(current){
      // A repeated title on a new page is layout, not a new entry.
      if(line===current.title&&next&&(next.text.startsWith("-")||/^Most Meaningful:?/i.test(next.text))){index+=1;continue;}
      current.sourceBlocks.push(entry);
      if(/^Most Meaningful:?/i.test(line))current.fields.mostMeaningful=true;
      else current.description=text(`${current.description} ${line.replace(/^-\s*/,"")}`);
    }
    index+=1;
  }
  for(const item of records){
    item.rawText=item.sourceBlocks.map((block)=>block.text).join("\n");
    item.fields.descriptionSource="MYERAS_CV_BULLETS";
    item.fields.privacyScope="TITLE_ONLY";
    const specialty=explicitSpecialty(item);
    if(specialty){item.specialty=specialty.value;item.fields.specialtyEvidence=specialty;}
  }
  return records;
}

/* The rotation's specialty when a bullet states it outright ("Hematology/Oncology
   observership at…", "inpatient cardiology elective", "Hospital Medicine observership").
   Read from the applicant's own sentence, kept with that line as evidence; never guessed. */
const SPECIALTY_WORDS="(?:hematology(?:\\s*\\/\\s*|\\s+and\\s+|\\s*&\\s*)oncology|hospital medicine|internal medicine|family medicine|emergency medicine|infectious diseases?|critical care|general surgery|obstetrics and gynecology|ob\\/gyn|pediatrics|psychiatry|neurology|cardiology|nephrology|gastroenterology|pulmonology|endocrinology|rheumatology|dermatology|anesthesiology|radiology|oncology|hematology|urology|orthopedics|ophthalmology|pathology|geriatrics|palliative care)";
const SPECIALTY_PATTERN=new RegExp(`\\b${SPECIALTY_WORDS}\\s+(?:observership|elective|rotation|clerkship|externship|sub-?internship|consult service)\\b`,"i");
const SPECIALTY_TITLE=new RegExp(`^(?:[\\w\\s/&-]*?)\\b${SPECIALTY_WORDS}\\b`,"i");
function explicitSpecialty(record){
  const title=String(record.title||"");
  const fromTitle=title.match(SPECIALTY_TITLE);
  if(fromTitle)return{value:normalizeSpecialty(fromTitle[0].replace(/\s+(?:observership|elective|rotation|clerkship|externship)\b.*$/i,"")),support:"EXPLICIT",sourceBlockId:record.sourceBlocks[0]?.id||"",excerpt:title};
  for(const block of record.sourceBlocks){
    if(!block.text.startsWith("-"))continue;
    const match=block.text.match(SPECIALTY_PATTERN);
    if(match)return{value:normalizeSpecialty(match[0].replace(/\s+(?:observership|elective|rotation|clerkship|externship|sub-?internship|consult service)\b$/i,"")),support:"INFERRED",sourceBlockId:block.id,excerpt:block.text};
    // "inpatient ID consult service" is explicit ERAS wording for infectious diseases.
    if(/\bID consult service\b/.test(block.text))return{value:"Infectious Diseases",support:"INFERRED",sourceBlockId:block.id,excerpt:block.text};
  }
  return null;
}
function normalizeSpecialty(value){
  const cleaned=text(value).replace(/\s*\/\s*/g,"/").replace(/\s+and\s+|\s*&\s*/gi,"/");
  return cleaned.split(/(\/|\s)/).map((part)=>/^[a-z]/.test(part)?part[0].toUpperCase()+part.slice(1):part).join("");
}

function parseMedicalEducation(entries,identity){
  const lines=entries.map((entry)=>entry.text);
  if(!lines.length)return{records:[],profile:{}};
  const blocks=[...entries];
  const school=lines.find((line)=>!DATE_RANGE_ONLY.test(line)&&!/\d{2}\/\d{4}/.test(line))||"";
  const range=lines.find((line)=>DATE_RANGE_ONLY.test(line))||"";
  // "M.B.,B.S. , 05/2026" in the browser text layer; ", 05/2026 M.B.,B.S." from the server stream.
  const degreeLine=lines.find((line)=>/\d{2}\/\d{4}/.test(line)&&!DATE_RANGE_ONLY.test(line))||"";
  const degreeDate=degreeLine.match(/(\d{2}\/\d{4})/)?.[1]||"";
  const degree=text(degreeLine.replace(/(\d{2}\/\d{4})/,"").replace(/^[\s,]+|[\s,]+$/g,""));
  const schoolParts=school.split(",").map(text).filter(Boolean);
  const country=schoolParts.length>1?schoolParts.at(-1):"";
  const schoolName=schoolParts.length>1?schoolParts.slice(0,-1).join(", "):school;
  const records=[];
  if(school&&range){
    records.push(record("education",blocks.filter((block)=>block.text===school||block.text===range),{
      title:"Medical Education",organization:schoolName,location:country,dates:range.replace(/\s*[-–—]\s*/," - "),
      fields:{erasSection:"medical_education",explicitCategory:"education",degree,country,medicalSchoolCountry:country}
    }));
  }
  if(degree&&degreeDate){
    records.push(record("education",blocks.filter((block)=>block.text===degreeLine||block.text===school),{
      title:degree,organization:schoolName,location:country,dates:degreeDate,
      fields:{erasSection:"medical_education",explicitCategory:"education",degree,country,medicalSchoolCountry:country,degreeMilestone:true}
    }));
  }
  const profile={};
  if(schoolName)profile.medicalSchool={value:schoolName,block:blocks.find((block)=>block.text===school)};
  if(country)profile.medicalSchoolCountry={value:country,block:blocks.find((block)=>block.text===school)};
  if(degree)profile.degree={value:degree,block:blocks.find((block)=>block.text===degreeLine)};
  if(degreeDate&&monthFromNumeric(degreeDate))profile.graduationDate={value:monthFromNumeric(degreeDate),raw:degreeDate,block:blocks.find((block)=>block.text===degreeLine)};
  if(range){
    const [start,end]=range.split(/\s*[-–—]\s*/);
    profile.medicalEducationSpan={value:`${monthFromNumeric(start)||start}..${monthFromNumeric(end)||end}`,start:monthFromNumeric(start),end:monthFromNumeric(end),raw:range,block:blocks.find((block)=>block.text===range)};
  }
  void identity;
  return{records,profile};
}

/* Honors & Awards: title / "<kind> - description" / "Received: Mon, YYYY". */
function parseHonors(entries){
  const records=[];
  let current=null;
  for(const entry of entries){
    const line=entry.text;
    const received=line.match(/^Received:\s*(.+)$/i);
    if(received&&current){
      current.sourceBlocks.push(entry);
      current.dates=text(received[1]).replace(/,/g,"");
      current.rawText=current.sourceBlocks.map((block)=>block.text).join("\n");
      current=null;
      continue;
    }
    if(!current){
      current=record("honors",[entry],{title:line,fields:{erasSection:"honors",explicitCategory:"education",sourceRecordOnly:true}});
      records.push(current);
      continue;
    }
    current.sourceBlocks.push(entry);
    const kind=line.match(/^([A-Za-z ]{3,40}?)\s+-\s+(.*)$/);
    if(kind&&!current.description){current.fields.awardKind=text(kind[1]);current.description=text(kind[2]);}
    else current.description=text(`${current.description} ${line}`);
  }
  return records.filter((item)=>item.dates);
}

/* Certifications: "<Name>: Mon, YYYY[ - Mon, YYYY]". The validity end is kept as text;
 * a certification is a dated milestone, not a Timeline duration. */
function parseCertifications(entries){
  const records=[];
  const datePart=`(?:${MONTH_ABBR}|${MONTHS})\\.?,?\\s+\\d{4}`;
  const pattern=new RegExp(`^(.+?):\\s*(${datePart})(?:\\s*[-–—]\\s*(${datePart}))?$`,"i");
  for(const entry of entries){
    const match=entry.text.match(pattern);
    if(!match)continue;
    const name=text(match[1]);
    const validUntil=match[3]?text(match[3]).replace(/,/g,""):"";
    records.push(record("certifications",[entry],{
      title:name,dates:text(match[2]).replace(/,/g,""),
      description:validUntil?`Valid until ${validUntil}`:"",
      fields:{erasSection:"certifications",validUntil,...(/\becfmg\b/i.test(name)?{}:{sourceRecordOnly:true})}
    }));
  }
  return records;
}

/* Scholarly Work: a kind subheading, then citations separated by their metadata lines. */
function parseScholarlyWork(entries){
  const records=[];
  let kind=null,citation=[],meta=[];
  const monthPattern=new RegExp(`\\b(${MONTHS})\\s+(\\d{4})\\b`,"g");
  const flush=()=>{
    if(!citation.length){meta=[];return;}
    const citationText=text(citation.map((entry)=>entry.text).join(" "));
    const canonical=kind||"PUBLICATION";
    let title="",venue="",dates="",location="";
    const presentation=citationText.match(/(?:Oral|Poster)\s+presentation:\s*(.+?);\s*(\d{2}\/\d{4})\.\s*(.*)$/i);
    if(presentation){
      venue=text(presentation[1]);dates=presentation[2];location=text(presentation[3]).replace(/\.$/,"");
      const head=citationText.slice(0,presentation.index);
      title=text(head.replace(/^.+?\b[A-Z]{1,4}\.\s+(?=[A-Z])/,"")).replace(/\.$/,"");
    }else{
      const months=[...citationText.matchAll(monthPattern)];
      const month=months.at(-1);
      if(month){
        dates=`${month[1]} ${month[2]}`;
        const before=citationText.slice(0,month.index).replace(/[\s.]+$/,"");
        const venueMatch=before.match(/\.\s+([^.]+)$/);
        venue=text(venueMatch?.[1]||"");
        const titleSource=venueMatch?before.slice(0,venueMatch.index):before;
        title=text(titleSource.replace(/^.+?\b[A-Z]{1,4}\.\s+(?=[A-Z])/,"")).replace(/\.$/,"");
      }
    }
    if(!title)title=text(citationText.slice(0,120));
    const status=meta.map((entry)=>entry.text).find((line)=>/^Publication Status:/i.test(line))?.replace(/^Publication Status:\s*/i,"").replace(/\.$/,"")||"";
    const firstAuthor=meta.some((entry)=>/\bFirst Author\b/i.test(entry.text));
    const blocks=[...citation,...meta];
    records.push(record("scholarly_work",blocks,{
      title,organization:venue,location,dates,description:citationText,
      fields:{erasSection:"scholarly_work",scholarlyKind:canonical,publicationStatus:status,firstAuthor,explicitCategory:"research",sourceRecordOnly:true}
    }));
    citation=[];meta=[];
  };
  for(const entry of entries){
    const line=entry.text;
    const nextKind=scholarlyKind(line);
    if(nextKind){flush();kind=nextKind;continue;}
    if(SCHOLARLY_METADATA.test(line)){meta.push(entry);continue;}
    if(meta.length)flush();
    citation.push(entry);
  }
  flush();
  return records.filter((item)=>item.dates);
}

/**
 * Parse MyERAS CV pages into source records plus profile claims and the identity claim.
 * Records use the generic CV record shape so the existing candidate builder, classifier,
 * confidence engine and provenance apply unchanged.
 */
export function parseErasCvPages(pages=[]){
  const identity=erasIdentityClaim(pages);
  const sections=new Map();
  let section="header";
  const order=[];
  for(const page of pages||[]){
    (page.lines||[]).forEach((raw,index)=>{
      const line=text(raw);
      if(!line||isErasPageChrome(line,identity)||AAMC_LINE.test(line))return;
      const heading=headingKey(line);
      if(heading){section=heading;if(!sections.has(section)){sections.set(section,[]);order.push(section);}return;}
      if(!sections.has(section)){sections.set(section,[]);order.push(section);}
      sections.get(section).push(makeBlock(page,index,section));
    });
  }
  const medical=parseMedicalEducation(sections.get("medical_education")||[],identity);
  const records=[
    ...medical.records,
    ...parseHonors(sections.get("honors")||[]),
    ...parseCertifications(sections.get("certifications")||[]),
    ...parseExperiences(sections.get("experiences")||[]),
    ...parseScholarlyWork(sections.get("scholarly_work")||[])
  ];
  const profile={...medical.profile};
  const languages=(sections.get("languages")||[]).map((block)=>block.text).filter((line)=>line.length<=40);
  if(languages.length)profile.languages={value:languages.join(", "),block:sections.get("languages")[0]};
  const hobbies=(sections.get("interests")||[]).map((block)=>block.text.replace(/^-\s*/,"")).filter(Boolean);
  if(hobbies.length)profile.hobbies={value:hobbies.map((item)=>item.split(":")[0].trim()).join(", "),block:sections.get("interests")[0]};
  return{
    layout:"MYERAS_CV",
    identity,
    profile,
    records,
    sections:order,
    unusedSections:order.filter((key)=>!["medical_education","honors","certifications","experiences","scholarly_work","languages","interests","header"].includes(key))
  };
}

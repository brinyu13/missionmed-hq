// Presentation policy only. Accepted source facts and categories remain immutable.
const text=value=>String(value??'').trim();
export const FOUNDER_DISPLAY_CATEGORY_ROWS=Object.freeze([
 {id:'work',label:'Work Experience',color:'#00882B'},
 {id:'personal',label:'Personal (Not on CV)',color:'#763F9B'},
 {id:'exams',label:'USMLE Studies',color:'#0565C0'},
 {id:'clinical',label:'USCE',color:'#DF6A0F'},
 {id:'volunteer',label:'Volunteer',color:'#307B72'},
 {id:'research',label:'Research Experience',color:'#DCBE23'}
].map(Object.freeze));
const categoryId=id=>['clinical-hospital','clinical-clinic','clinicalHospital','clinic','th','cl'].includes(id)?'clinical':id;
const aliases=new Map([
 ['State University of New York Upstate Medical University','SUNY Upstate'],
 ['University of Wisconsin','U of Wisconsin'],
 ['University of Pittsburgh Medical Center','UPMC'],
 ['University of California Los Angeles','UCLA'],
 ['University of Southern California','USC']
]);
/* Concise presentation forms. Display only: the accepted source title and institution
   are never rewritten, and every proposal is an undoable presentation override. */
const ROLE_ABBREVIATIONS=[
 [/\bhematology\s*(?:and|&|\/)\s*oncology\b/i,'Heme/Onc'],[/\bhematology\b/i,'Heme'],[/\boncology\b/i,'Onc'],
 [/\bobstetrics\s*(?:and|&|\/)\s*gynecology\b/i,'OB/GYN'],[/\binternal medicine\b/i,'IM'],[/\bfamily medicine\b/i,'FM'],
 [/\bemergency medicine\b/i,'EM'],[/\bpediatrics\b/i,'Peds'],[/\bcardiology\b/i,'Cards'],[/\bneurology\b/i,'Neuro'],
 [/\bpsychiatry\b/i,'Psych'],[/\bgastroenterology\b/i,'GI'],[/\bnephrology\b/i,'Nephro'],[/\bpulmonology\b/i,'Pulm'],
 [/\binfectious diseases?\b/i,'ID'],[/\banesthesiology\b/i,'Anesthesia'],[/\bradiology\b/i,'Rads'],[/\bsurgery\b/i,'Surg'],
 [/\bsub[- ]?internship\b/i,'Sub-I'],[/\bexternship\b/i,'Extern'],[/\bobservership\b/i,'Observership'],[/\bclerkship\b/i,'Clerkship'],
 [/\bresearch (?:elective|assistant|associate|fellow)\b/i,'Research'],[/\bclinical\s+/i,''],[/\bhospital medicine\b/i,'Hospitalist']
];
const GENERIC_ROLE_TRIMS=[[/\bresearch (?:elective|assistant|associate|fellow)\b/i,'Research'],[/\bsub[- ]?internship\b/i,'Sub-I'],[/\bexternship\b/i,'Extern'],[/\bclinical\s+(?=\S)/i,''],[/\bhospital medicine\b/i,'Hospitalist']];
/* The 2025 Keynote labels one-month rotations with the specialty code alone ("IM", "FM");
   the USCE color and the institution carry the rest. */
const SPECIALTY_CODES=new Map([
 ['internal medicine','IM'],['family medicine','FM'],['emergency medicine','EM'],['hospital medicine','HM'],['hospitalist','HM'],
 ['hematology/oncology','H/O'],['heme/onc','H/O'],['hematology and oncology','H/O'],['oncology','Onc'],['hematology','Heme'],
 ['cardiology','Cards'],['infectious diseases','ID'],['infectious disease','ID'],['critical care','CC'],['general surgery','Surg'],['surgery','Surg'],
 ['obstetrics and gynecology','OB'],['ob/gyn','OB'],['pediatrics','Peds'],['psychiatry','Psych'],['neurology','Neuro'],['nephrology','Nephro'],
 ['gastroenterology','GI'],['pulmonology','Pulm'],['endocrinology','Endo'],['rheumatology','Rheum'],['dermatology','Derm'],['anesthesiology','Anes'],
 ['radiology','Rads'],['urology','Uro'],['orthopedics','Ortho'],['ophthalmology','Ophtho'],['pathology','Path'],['geriatrics','Geri'],['palliative care','Pall']
]);
const ROTATION_CODES=[[/\bobservership\b/i,'Obs'],[/\belective\b/i,'Elec'],[/\bextern(?:ship)?\b/i,'Ext'],[/\bclerkship\b/i,'Clerk'],[/\bsub-i\b/i,'Sub-I'],[/\bresearch\b/i,'Res']];
export function founderSpecialtyCode(value){
 const key=text(value).toLowerCase().replace(/\s*\/\s*/g,'/');
 return SPECIALTY_CODES.get(key)||'';
}
export function founderConciseRole(value,{maxLength=20,specialty=''}={}){
 const tidy=role=>role.replace(/\s{2,}/g,' ').replace(/^[\s\-–—,]+|[\s\-–—,]+$/g,'').trim();
 let role=text(value);
 if(!role)return role;
 // Generic wording first ("Clinical Elective" → "Elective"); specialty abbreviations only
 // when the role is still too long to sit inside an arrow.
 for(const [pattern,short] of GENERIC_ROLE_TRIMS)role=tidy(role.replace(pattern,short));
 // "Cardiology Resident" → "Cardiology Res." before any specialty shorthand.
 if(role.length>maxLength)role=tidy(role.replace(/\bResident\b/i,'Res.').replace(/\bFellow\b/i,'Fel.'));
 if(role.length>maxLength)for(const [pattern,short] of ROLE_ABBREVIATIONS)role=tidy(role.replace(pattern,short));
 if(role.length>maxLength){
  // Narrow arrow: the Keynote form is the specialty code when the source states one.
  const code=founderSpecialtyCode(specialty);
  if(code&&/\b(?:obs(?:ervership)?|elec(?:tive)?|extern|clerkship|sub-i|rotation)\b/i.test(role))return code;
  for(const [pattern,short] of ROTATION_CODES)role=tidy(role.replace(pattern,short));
 }
 return role||text(value);
}
const INSTITUTION_WORD=/\b(?:universit(?:y|ies)|college|school|institute|hospital|medical cent(?:er|re)|health system|health network|clinic|infirmary|academy)\b/i;
export function founderConciseInstitution(value){
 const full=text(value);
 if(!full)return full;
 if(aliases.has(full))return aliases.get(full);
 const parts=full.split(/\s*,\s*/).filter(Boolean);
 // "Department, Institution" keeps the institution; "Hospital, University" keeps the hospital.
 const chosen=parts.length>1?(INSTITUTION_WORD.test(parts[0])?parts[0]:parts.find(part=>INSTITUTION_WORD.test(part))||parts.at(-1)):full;
 return founderInstitutionLabel(chosen,{compact:chosen.length>44});
}
export function founderInstitutionLabel(value,{compact=false}={}){
 const full=text(value);if(aliases.has(full))return aliases.get(full);
 return compact?full.replace(/\bUniversity\b/g,'U').replace(/\bSaint\b/g,'St.').replace(/\bMedical Center\b/g,'Med Ctr'):full;
}
function explicitVolunteer(event){
 return event?.fields?.canonicalType==='VOLUNTEER_EXPERIENCE'||
 /^(volunteer|volunteer experience|community service)$/i.test(text(event?.experienceType||event?.fields?.experienceType||event?.type));
}
export function founderUsesUsFlag(event){
 if(event?.display?.usStatus!==undefined)return event.display.usStatus;
 const type=text(event?.fields?.founderMilestoneType||event?.fields?.canonicalType);
 if(['US_MOVE','US_CITIZENSHIP','US_GREEN_CARD','US_EAD'].includes(type))return true;
 const title=text(event?.title);
 if(event?.categoryId==='personal'&&/(?:\bUnited States(?: of America)?\b|\bUSA\b|\bUS\b|\bU\.S\.(?:A\.)?(?=\W|$))/i.test(title)&&/move|moved|arriv|entry|citizen|immigra|green card|EAD|employment authorization|permanent residen/i.test(title))return true;
 return event?.categoryId==='personal'&&/^(US|USA|United States(?: of America)?)$/i.test(text(event.country||event.fields?.country))&&/^(EAD|Employment Authorization Document|(?:Received )?(?:permanent residency \/ )?green card|US Citizenship)$/i.test(title);
}
// ECFMG certification is a credential date, not an exam attempt: it never needs a study arrow.
const examEndpoint=event=>String(event?.eventType||event?.kind||event?.type).toLowerCase()==='milestone'&&
 text(event.fields?.canonicalType)!=='ECFMG_CERTIFICATION'&&
 (event.categoryId==='exams'||/^STEP_(?:1|2_CK|2_CS|3)$/.test(text(event.fields?.canonicalType)));
function founderExamRecords(document,event){
 const records=new Map();
 for(const record of [...(document.presentationExamLinks||[]),...(document.exams||[])]){
  const id=String(record.id||''),previous=records.get(id),sourceEventId=record.sourceEventId||record.fieldProvenance?.examDate?.sourceEventId||previous?.sourceEventId;
  if(id&&String(sourceEventId||'')===String(event.id))records.set(id,{...previous,...record,sourceEventId});
 }
 return [...records.values()];
}
export function founderExamStudyLink(document,event,events=document?.events||[]){
 const records=founderExamRecords(document,event);
 const matches=events.filter(study=>String(study.eventType||study.kind).toLowerCase()==='duration'&&
 (!(study.sourceType==='local-test-study'||study.fields?.localTestOnly===true)||founderLocalTestVisible(document))&&
 (study.isStudyPeriod||study.fields?.isStudyPeriod||study.fields?.studyPeriod||study.sourceType==='local-test-study')&&
 ((event.fields?.attemptId&&event.fields.attemptId===study.fields?.attemptId)||
 String(study.fields?.sourceEventId||'')===String(event.id)||records.some(record=>String(record.id)===String(study.fields?.sourceExamRecordId||''))));
 return matches.length===1?matches[0]:null;
}
function founderStudyExamLabel(document,study){
 const comlexTypes={'comlex-level-1':'Level 1','comlex-level-2-ce':'Level 2-CE','comlex-level-3':'Level 3'};
 const comlexRecords={'level-1':'Level 1','level-2-ce':'Level 2-CE','level-3':'Level 3'};
 const direct=comlexTypes[text(study.examTypeId)];
 const recordId=text(study.fields?.sourceExamRecordId);
 const records=recordId?(document.exams||[]).filter(record=>text(record.id)===recordId):[];
 if(records.length>1)return 'Study';
 const record=records[0],recordLabel=record?.system==='COMLEX-USA'?comlexRecords[text(record.examId)]:null;
 if(direct&&(study.systemId&&study.systemId!=='comlex'||record&&recordLabel!==direct))return 'Study';
 if(direct||recordLabel)return direct||recordLabel;
 const linked=(document.events||[]).filter(event=>examEndpoint(event)&&founderExamStudyLink(document,event)?.id===study.id);
 if(linked.length!==1)return 'Study';
 const endpoint=linked[0],canonical=text(endpoint.fields?.canonicalType);
 const labels={STEP_1:'Step 1',STEP_2_CK:'Step 2 CK',STEP_2_CS:'Step 2 CS',STEP_3:'Step 3'};
 if(labels[canonical])return labels[canonical];
 const match=/^(?:USMLE\s+)?Step\s*(1|2\s*CK|2\s*CS|3)(?=\s|$)/i.exec(text(endpoint.fields?.examName||endpoint.title));
 return match?'Step '+match[1].toUpperCase().replace(/\s*/g,'').replace(/^2(CK|CS)$/,'2 $1'):'Study';
}
function coveredFounderExamEndpoint(document,event,study){
 if(!study||document.presentationOverrides?.events?.[String(event.id)]?.showAsMilestone===true||text(document.presentationOverrides?.events?.[String(event.id)]?.label))return false;
 const object=(document.advanced?.scene?.objects||[]).find(object=>object.type==='event'&&String(object.semanticRef||object.id)===String(event.id));
 if(object?.geometry&&(object.presentation?.localLayoutCriticAuto!==true||object.locked||object.groupId||Number(object.geometry.rotation)||(document.advanced?.scene?.groups||[]).some(group=>group.locked&&group.childIds?.includes(object.id))))return false;
 if(document.layoutLock===true||event.manualOffset?.laneLocked||Number(event.manualOffset?.x)||Number(event.manualOffset?.y))return false;
 const date=text(event.startDate),end=text(study.endDate);
 if(date!==end||!/^\d{4}-\d{2}(?:-\d{2})?$/.test(date))return false;
 const expected=date.length===10?'DAY':'MONTH',precision=(value,field)=>text(value.datePrecision?.[field]||value.fields?.datePrecision?.[field]||expected);
 if(precision(event,'start')!==expected||precision(study,'end')!==expected)return false;
 const wording=study.fields?.sourceDateWording?.end;
 if(typeof wording==='string'&&wording!==date||wording?.normalizedMonth&&wording.normalizedMonth!==date)return false;
 if(founderStudyExamLabel(document,study)==='Study')return false;
 if(text(event.siteName)&&text(event.siteName)!==text(study.siteName))return false;
 const records=founderExamRecords(document,event),known=value=>text(value)&&!/^(unknown|unprovided|not provided)$/i.test(text(value));
 for(const field of ['result','score'])if(known(event.fields?.[field])){
  const record=records.length===1?records[0]:null;
  if(!record||text(record.system).toUpperCase()!=='USMLE'||text(record[field])!==text(event.fields[field])||
    (document.exams||[]).filter(other=>other.system===record.system&&other.examId===record.examId).length!==1)return false;
 }
 return true;
}

export function deriveFounderEventDisplay(document,event){
 const override=document?.presentationOverrides?.events?.[String(event.id)]||{};
 const institution=text(event.siteName||event.organization||event.fields?.organization);
 const country=text(event.country||event.fields?.country||event.fields?.sourceCountry);
 const location=country&&!/^(US|USA|United States(?: of America)?)$/i.test(country)?country:text(event.fields?.cityState)||[text(event.fields?.city),text(event.fields?.state)].filter(Boolean).join(', ')||text(event.location||event.fields?.location||event.fields?.sourceLocation);
 const suppliedAlias=text(event.fields?.displayInstitution||event.fields?.shortName||event.fields?.acronym);
 const concise=new Map([['Research Associate','Research Assoc.'],['Internal Medicine Extern','IM'],['Family Medicine Extern','FM'],['Primary Clinical Preceptee','Preceptee']]);
 const study=event.isStudyPeriod||event.fields?.isStudyPeriod||event.fields?.studyPeriod;
 return {role:text(override.role)||(study?founderStudyExamLabel(document,event):explicitVolunteer(event)?text(event.fields?.programName)||'Volunteer':concise.get(text(event.title))||text(event.title).replace(/^Clinical\s+(Observership|Elective|Rotation|Externship|Clerkship)$/i,'$1')),
  institution:override.institution!==undefined?text(override.institution):suppliedAlias||founderInstitutionLabel(institution),
  location:override.location!==undefined?text(override.location):location,
  categoryId:categoryId(text(override.categoryId)||(explicitVolunteer(event)?'volunteer':text(event.categoryId))),
  label:text(override.label)||text(event.title),showAsMilestone:override.showAsMilestone===true,labelSize:Number(override.labelSize)||18,labelFit:override.labelFit||'fit',usStatus:founderUsesUsFlag(event),requiresStudy:examEndpoint(event)&&!founderExamStudyLink(document,event)};
}
function trueSingleDate(event){return !!text(event.startDate||event.date||event.startMonth)&&!event.openEnded&&(!text(event.endDate)||text(event.endDate)===text(event.startDate));}
export function founderMilestoneEligible(document,event){
 const display=deriveFounderEventDisplay(document,event),type=text(event.fields?.canonicalType);
 if(!trueSingleDate(event))return false;
 if(['PUBLICATION','ABSTRACT_POSTER_PRESENTATION','AWARD_HONOR','VOLUNTEER_EXPERIENCE'].includes(type))return false;
 if(display.showAsMilestone)return true;
 if(founderUsesUsFlag(event))return true;
 // "M.B.,B.S." is the medical degree; its dotted "B.S." is not a bachelor's degree.
 if(/(?:^|[^A-Z])M\.?\s*B\.?\s*,?\s*B\.?\s*S\.?(?:$|[^A-Z])/i.test(text(event.title)))return true;
 if(/\b(bachelor|baccalaureate|B\.?S\.?|B\.?A\.?)\b/i.test(text(event.title)))return false;
 if(['MEDICAL_DEGREE','ECFMG_CERTIFICATION','LIFE_EVENT','CUSTOM_MILESTONE'].includes(type))return true;
 const title=text(event.title);
 if(/\b(bachelor|baccalaureate|B\.?S\.?|B\.?A\.?)\b/i.test(title))return false;
 if(event.categoryId==='personal'&&/\b(arrival|arrived|moved|immigration|birth|marriage|married|wedding|parenthood)\b/i.test(title))return true;
 return event.categoryId==='education'&&/\b(medical degree|doctor of medicine|M\.?D\.?|master(?:s|'s)?|Ph\.?D\.?|ECFMG)\b/i.test(title)&&!/(award|honou?r|scholarship)/i.test(title);
}
export function founderLocalTestVisible(document){
 const location=globalThis.location;
 return document?.metadata?.localTestPrototype===true&&location?.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(location.hostname);
}
export function projectFounderDisplayEvents(document,events=document?.events||[]){
 const included=[],excluded=[];
 for(const source of events){
  const event=structuredClone(source),display=deriveFounderEventDisplay(document,event);
  if((event.sourceType==='local-test-study'||event.fields?.localTestOnly===true)&&!founderLocalTestVisible(document)){
   excluded.push({eventId:String(event.id),reason:'local-test-only',source:event});continue;
  }
  const milestone=String(event.eventType||event.kind||event.type).toLowerCase()==='milestone';
  const attempt=examEndpoint(event);
  if(attempt){
   const study=founderExamStudyLink(document,event,events);
   if(study?.fields?.attemptId)event.fields={...(event.fields||{}),attemptId:study.fields.attemptId};
   const records=founderExamRecords(document,event);
   const review=records.length===1?document.builder?.examReviewCorrections?.[records[0].id]:null;
   const correction=review?.examDate;
   if(review){
    event.fields={...(event.fields||{})};
    if(Object.hasOwn(review,'result')&&!event.presentationRedactions?.includes('EXAM_RESULT_PRIVATE'))event.fields.result=review.result;
    if(Object.hasOwn(review,'score')&&!event.presentationRedactions?.includes('EXAM_SCORE_HIDDEN'))event.fields.score=review.score;
   }
   if(correction){
    const exact=/^\d{4}-\d{2}(?:-\d{2})?$/.test(correction)&&Number(correction.slice(5,7))>=1&&Number(correction.slice(5,7))<=12&&
     (correction.length===7||new Date(correction+'T00:00:00Z').toISOString().slice(0,10)===correction);
    if(!exact)error('FOUNDER_DISPLAY_INVALID_EXAM_DATE','Confirm a valid exam date.');
    event.startDate=correction;event.fields={...(event.fields||{}),datePrecision:{start:correction.length===10?'DAY':'MONTH',end:null},sourceDateWording:{start:null,end:null}};
   }
  }
  if(milestone&&!attempt&&!founderMilestoneEligible(document,event)){
   excluded.push({eventId:String(event.id),reason:'cv-record-retained-for-review',source:event});continue;
  }
  event.display=display;included.push(event);
 }
 const visible=included.filter(event=>{
  if(!examEndpoint(event))return true;
  const study=founderExamStudyLink(document,event,included);
  if(!coveredFounderExamEndpoint(document,event,study))return true;
  excluded.push({eventId:String(event.id),reason:'covered-by-study-endpoint',coveredByEventId:String(study.id),endpointDate:event.startDate,
   endpointPrecision:String(event.startDate).length===10?'DAY':'MONTH',examLabel:founderStudyExamLabel(document,study),source:structuredClone(events.find(source=>String(source.id)===String(event.id)))});
  return false;
 });
 return {events:visible,excluded};
}
export function computeFounderCategoryKey(document,events=document?.events||[]){
 const visible=projectFounderDisplayEvents(document,events).events.filter(event=>String(event.eventType||event.kind||event.type).toLowerCase()!=='milestone'&&event.categoryId!=='education');
 const used=new Set(visible.map(event=>deriveFounderEventDisplay(document,event).categoryId));
 const explicit=new Map();
 for(const row of document?.presentationOverrides?.categoryKey||[]){
  const id=categoryId(text(row.id)),legacy=id==='clinical'&&['USCE: Clinics','USCE: Teaching Hosp'].includes(text(row.label));
  const migrated=legacy?{...row,id,label:'USCE',color:'#DF6A0F'}:row;
  if(!explicit.has(id)||!legacy)explicit.set(id,migrated);
 }
 const examFamilies=new Set();let uncertainExamFamily=false;
 const supportedTypes=new Map([['usmle-step-1','USMLE'],['usmle-step-2-ck','USMLE'],['usmle-step-2-cs','USMLE'],['usmle-step-3','USMLE'],['comlex-level-1','COMLEX'],['comlex-level-2-ce','COMLEX'],['comlex-level-3','COMLEX']]);
 for(const study of visible.filter(event=>deriveFounderEventDisplay(document,event).categoryId==='exams')){
  const families=new Set(),type=supportedTypes.get(text(study.examTypeId));if(type)families.add(type);
  if(study.systemId==='usmle')families.add('USMLE');if(study.systemId==='comlex')families.add('COMLEX');
  const recordId=text(study.fields?.sourceExamRecordId),records=recordId?(document.exams||[]).filter(record=>text(record.id)===recordId):[];
  if(records.length>1){uncertainExamFamily=true;continue;}
  const record=records[0];
  if(record?.system==='USMLE'&&['step-1','step-2-ck','step-2-cs','step-3'].includes(record.examId))families.add('USMLE');
  else if(record?.system==='COMLEX-USA'&&['level-1','level-2-ce','level-3'].includes(record.examId))families.add('COMLEX');
  else if(record){uncertainExamFamily=true;continue;}
  const endpoints=(document.events||[]).filter(event=>examEndpoint(event)&&founderExamStudyLink(document,event)?.id===study.id);
  for(const endpoint of endpoints)if(/^STEP_(?:1|2_CK|2_CS|3)$/.test(text(endpoint.fields?.canonicalType)))families.add('USMLE');
  if(families.size===1)examFamilies.add([...families][0]);else uncertainExamFamily=true;
 }
 const examLabel=uncertainExamFamily||!examFamilies.size?'Exam Studies':examFamilies.size>1?'USMLE/COMLEX':examFamilies.has('COMLEX')?'COMLEX Studies':'USMLE Studies';
 const defaults=new Map(FOUNDER_DISPLAY_CATEGORY_ROWS.map(row=>[row.id,row.id==='exams'?{...row,label:examLabel}:row]));
 return [...new Set([...defaults.keys(),...explicit.keys()])].filter(id=>used.has(id)).map((id,order)=>{
  const row=explicit.get(id)||defaults.get(id);return{id,order,label:text(row?.label)||id,color:/^#[0-9a-f]{6}$/i.test(text(row?.color))?text(row.color).toUpperCase():'#5B6168'};
 });
}
function error(code,message){const value=new TypeError(message);value.code=code;throw value;}
export function setFounderEventDisplay(document,eventId,changes){
 if(!(document.events||[]).some(event=>String(event.id)===String(eventId)))error('FOUNDER_DISPLAY_EVENT_NOT_FOUND','Select an existing event.');
 const result=structuredClone(document);result.presentationOverrides||={};result.presentationOverrides.events||={};
 const next={...(result.presentationOverrides.events[String(eventId)]||{})};
 for(const [field,value] of Object.entries(changes||{})){
  if(!['role','institution','location','categoryId','showAsMilestone','label','labelSize','labelFit'].includes(field))error('FOUNDER_DISPLAY_INVALID_FIELD','Unsupported display field.');
  if(value===null){delete next[field];continue;}
  if(field==='labelSize'){if(typeof value!=='number'||!Number.isFinite(value))error('FOUNDER_DISPLAY_INVALID_FIELD','Display text size must be numeric.');next[field]=Math.max(18,Math.min(24,Math.round(value)));}
  else if(field==='labelFit'){if(!['fit','fixed'].includes(value))error('FOUNDER_DISPLAY_INVALID_FIELD','Choose readable fit or fixed text size.');next[field]=value;}
  else if(field==='showAsMilestone'){if(typeof value!=='boolean')error('FOUNDER_DISPLAY_INVALID_FIELD','Milestone preference must be a boolean.');next[field]=value;}
  else{if(typeof value!=='string')error('FOUNDER_DISPLAY_INVALID_FIELD','Display labels must be text.');next[field]=field==='categoryId'?categoryId(text(value)):text(value);}
 }
 const id=next.categoryId;
 if(id&&!FOUNDER_DISPLAY_CATEGORY_ROWS.some(row=>row.id===id)&&!(result.presentationOverrides.categoryKey||[]).some(row=>row.id===id))error('FOUNDER_DISPLAY_CATEGORY_NOT_FOUND','Add this category to the key first.');
 result.presentationOverrides.events[String(eventId)]=next;return result;
}
export function setFounderCategoryKey(document,rows){
 if(!Array.isArray(rows))error('FOUNDER_DISPLAY_INVALID_KEY','Category key must be an array.');
 const normalized=rows.map(row=>({id:categoryId(text(row.id)),label:text(row.label),color:text(row.color).toUpperCase()}));
 if(new Set(normalized.map(row=>row.id)).size!==normalized.length||normalized.some(row=>!row.id||!row.label||!/^#[0-9A-F]{6}$/.test(row.color)))error('FOUNDER_DISPLAY_INVALID_KEY','Provide unique category IDs, labels and six-digit colors.');
 for(const row of computeFounderCategoryKey(document))if(!normalized.some(next=>next.id===row.id))error('FOUNDER_DISPLAY_CATEGORY_IN_USE','Reassign displayed events before removing a used category.');
 const result=structuredClone(document);result.presentationOverrides||={};result.presentationOverrides.categoryKey=normalized;return result;
}
export function resetFounderCategoryKey(document){
 const result=structuredClone(document);result.presentationOverrides||={};delete result.presentationOverrides.categoryKey;
 for(const value of Object.values(result.presentationOverrides.events||{}))if(value.categoryId&&!FOUNDER_DISPLAY_CATEGORY_ROWS.some(row=>row.id===categoryId(value.categoryId)))delete value.categoryId;
 return result;
}

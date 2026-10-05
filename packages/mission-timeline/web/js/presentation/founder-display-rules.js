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
const examEndpoint=event=>String(event?.eventType||event?.kind||event?.type).toLowerCase()==='milestone'&&
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
export function deriveFounderEventDisplay(document,event){
 const override=document?.presentationOverrides?.events?.[String(event.id)]||{};
 const institution=text(event.siteName||event.organization||event.fields?.organization);
 const country=text(event.country||event.fields?.country||event.fields?.sourceCountry);
 const location=country&&!/^(US|USA|United States(?: of America)?)$/i.test(country)?country:text(event.fields?.cityState)||[text(event.fields?.city),text(event.fields?.state)].filter(Boolean).join(', ')||text(event.location||event.fields?.location||event.fields?.sourceLocation);
 const suppliedAlias=text(event.fields?.displayInstitution||event.fields?.shortName||event.fields?.acronym);
 const concise=new Map([['Internal Medicine Extern','IM'],['Family Medicine Extern','FM'],['Primary Clinical Preceptee','Preceptee']]);
 const study=event.isStudyPeriod||event.fields?.isStudyPeriod||event.fields?.studyPeriod;
 return {role:text(override.role)||(study?'Study':explicitVolunteer(event)?text(event.fields?.programName)||'Volunteer':concise.get(text(event.title))||text(event.title)),
  institution:override.institution!==undefined?text(override.institution):suppliedAlias||founderInstitutionLabel(institution),
  location:override.location!==undefined?text(override.location):location,
  categoryId:categoryId(text(override.categoryId)||(explicitVolunteer(event)?'volunteer':text(event.categoryId))),
  label:text(override.label)||text(event.title),showAsMilestone:override.showAsMilestone===true,usStatus:founderUsesUsFlag(event),requiresStudy:examEndpoint(event)&&!founderExamStudyLink(document,event)};
}
function trueSingleDate(event){return !!text(event.startDate||event.date||event.startMonth)&&!event.openEnded&&(!text(event.endDate)||text(event.endDate)===text(event.startDate));}
export function founderMilestoneEligible(document,event){
 const display=deriveFounderEventDisplay(document,event),type=text(event.fields?.canonicalType);
 if(!trueSingleDate(event))return false;
 if(['PUBLICATION','ABSTRACT_POSTER_PRESENTATION','AWARD_HONOR','VOLUNTEER_EXPERIENCE'].includes(type))return false;
 if(display.showAsMilestone)return true;
 if(founderUsesUsFlag(event))return true;
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
 return {events:included,excluded};
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
 const defaults=new Map(FOUNDER_DISPLAY_CATEGORY_ROWS.map(row=>[row.id,row]));
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
  if(!['role','institution','location','categoryId','showAsMilestone','label'].includes(field))error('FOUNDER_DISPLAY_INVALID_FIELD','Unsupported display field.');
  if(value===null){delete next[field];continue;}
  if(field==='showAsMilestone'){if(typeof value!=='boolean')error('FOUNDER_DISPLAY_INVALID_FIELD','Milestone preference must be a boolean.');next[field]=value;}
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

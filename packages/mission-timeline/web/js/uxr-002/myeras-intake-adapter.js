import {parseExactDate} from './exact-date-field.js';
import {parseMonth} from './utils.js';

export const MYERAS_SOURCE_SCHEMA='missionmed-myeras-source.1';
const clone=value=>structuredClone(value);
const text=value=>String(value??'').trim();
const semantic=value=>text(value).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
const categories=new Set(['education','exams','clinical','work','research','personal']);
const entryFields=new Set(['id','recordKey','section','title','categoryId','canonicalType','startDate','endDate','openEnded','eventType','institution','country','city','state','specialty','rotationType','degree','role','description','confidence','sourceExcerpt','pageNumber','visibilityState','examSystem','examName','result','score','attempt']);
export const MYERAS_PROFILE_FIELDS=Object.freeze(['fullName','medicalSchool','medicalSchoolCountry','degree','degreeOther','graduationDate','visaStatus','currentUsWorkAuthorization','workAuthorizationOther','specialtyGoal','interviewSeason','emrExperience','languages','hobbies','usceSummary','researchSummary']);
const profileFields=new Set(MYERAS_PROFILE_FIELDS);
const sourceFields=new Set(['id','kind','label','sha256','profile','entries']);
const idPattern=/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const fail=(message,code='MYERAS_SOURCE_INVALID')=>{const error=new Error(message);error.code=code;throw error;};
function allowOnly(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object.`);
  for(const key of Object.keys(value))if(!allowed.has(key))fail(`${label} contains unsupported field ${/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)?key:'(unrecognized field name)' }. Remove account identifiers and fields outside the import contract.`);
}
function bounded(value,label,max=12000){const result=text(value);if(result.length>max)fail(`${label} is too long.`);return result;}

/** Years are comparison anchors only; YEAR and unchanged source wording remain attached. */
export function myerasDate(value,edge='start'){
  const raw=text(value);
  if(!raw)return{value:'',precision:'UNKNOWN',raw};
  if(/^\d{4}$/.test(raw)&&Number(raw)>=1900&&Number(raw)<=2200)return{value:`${raw}-${edge==='end'?'12':'01'}`,precision:'YEAR',raw};
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
    const exact=parseExactDate(raw);if(!exact)fail('A source contains an invalid calendar date. Correct the source or leave the date unknown.','MYERAS_DATE_INVALID');
    return{value:exact,precision:'DAY',raw};
  }
  const month=parseMonth(raw);
  if(month&&Number(month.slice(0,4))>=1900&&Number(month.slice(0,4))<=2200)return{value:month,precision:'MONTH',raw};
  // Ambiguous wording is evidence, never an invented date.
  return{value:'',precision:'UNKNOWN',raw};
}
const ongoingKey=category=>({clinical:'currentlyOnRotation',work:'stillWorking',research:'ongoing'})[category];
export function synchronizeMyerasOngoing(candidate){
  if(!candidate.fields?.myerasReview)return candidate;
  for(const key of ['currentlyOnRotation','stillWorking','ongoing'])delete candidate.fields[key];
  const key=ongoingKey(candidate.categoryId);if(key)candidate.fields[key]=candidate.openEnded===true;
  return candidate;
}
const institutionKey=category=>category==='education'?'medicalSchool':category==='work'?'organization':'institution';
function provenance(source,entry,index){
  return{id:`${encodeURIComponent(source.id)}:${encodeURIComponent(entry.id||String(index))}`,sourceDocumentId:source.id,sourceSha256:source.sha256||'',fileName:source.label,
    documentType:source.kind,section:entry.section||'',pageNumber:entry.pageNumber||null,sourceBlockId:text(entry.id)||String(index),
    sourceExcerpt:entry.sourceExcerpt||[entry.title,entry.institution,entry.startDate,entry.endDate,entry.description].filter(Boolean).join(' | '),
    extractionMethod:'MYERAS_STRUCTURED_SOURCE_CHECK',parserVersion:MYERAS_SOURCE_SCHEMA};
}
function claimVariants(values,field){
  const unique=new Map();
  for(const item of values){const value=item.values[field];if(value==null||value==='')continue;const key=JSON.stringify(value);let variant=unique.get(key);
    if(!variant){variant={value:clone(value),sourceIds:[],evidence:[]};unique.set(key,variant);}
    if(!variant.sourceIds.includes(item.sourceId))variant.sourceIds.push(item.sourceId);
    variant.evidence.push(clone(item.provenance));
  }
  return[...unique.values()];
}
export function myerasConflicts(variants){
  const keys=new Set(variants.flatMap(item=>Object.keys(item.values)));
  return[...keys].flatMap(field=>{const choices=claimVariants(variants,field);return choices.length>1?[{id:`conflict:${field}`,field,choices,resolution:null}]:[];});
}
function profileClaims(sources){
  const values=[];
  for(const source of sources){if(!source.profile)continue;const claims={};for(const [key,value] of Object.entries(source.profile))claims[key]=bounded(value,`Profile ${key}`,['emrExperience','hobbies','usceSummary','researchSummary'].includes(key)?12000:1200);
    values.push({sourceId:source.id,values:claims,provenance:provenance(source,{id:'profile',section:'Profile',sourceExcerpt:Object.entries(claims).map(([key,value])=>`${key}: ${value}`).join('\n')},0)});}
  return values;
}
export function synchronizeMyerasInstitution(candidate,explicitValue=null){
  if(!candidate.fields?.myerasReview)return candidate;
  const key=institutionKey(candidate.categoryId),fields=candidate.fields;
  const value=explicitValue??fields[key]??fields.institution??fields.organization??fields.medicalSchool??'';
  for(const alias of ['institution','organization','medicalSchool','employer','siteName'])delete fields[alias];
  fields[key]=value;return candidate;
}
function mapEntry(source,entry,index){
  allowOnly(entry,entryFields,'Entry');
  for(const [key,value] of Object.entries(entry))if(value!=null&&typeof value==='object')fail(`Entry ${key} must be a scalar source value.`);
  if(entry.visibilityState&&!['ADVISOR_ONLY','INTERVIEWER_SAFE'].includes(entry.visibilityState))fail('Unsupported visibility state.');
  if(entry.id!=null&&(typeof entry.id!=='string'||entry.id!==text(entry.id)||!idPattern.test(entry.id)))fail('Entry id must be a local record reference.');
  if(entry.recordKey!=null&&(typeof entry.recordKey!=='string'||entry.recordKey!==text(entry.recordKey)||!idPattern.test(entry.recordKey)))fail('recordKey must be a local cross-source record reference.');
  const title=bounded(entry.title,'Title',1000),category=categories.has(entry.categoryId)?entry.categoryId:'';
  const start=myerasDate(entry.startDate),end=myerasDate(entry.endDate,'end');
  if(entry.eventType!=null&&!['duration','milestone'].includes(entry.eventType))fail('eventType must be duration or milestone.');
  if(entry.openEnded!=null&&typeof entry.openEnded!=='boolean')fail('openEnded must be a boolean.');
  if(entry.pageNumber!=null&&(!Number.isInteger(entry.pageNumber)||entry.pageNumber<1))fail('pageNumber must be a positive integer.');
  if(entry.attempt!=null&&(!Number.isInteger(entry.attempt)||entry.attempt<1||entry.attempt>20))fail('Exam attempt must be an explicit positive whole number.');
  const evidence=provenance(source,entry,index);
  const values={title,categoryId:category,canonicalType:bounded(entry.canonicalType,'Canonical type',100),examSystem:bounded(entry.examSystem,'Exam system',100),examName:bounded(entry.examName,'Exam name',300),result:bounded(entry.result,'Exam result',100),score:bounded(entry.score,'Exam score',100),attempt:entry.attempt??null,startDate:start.raw,endDate:end.raw||null,openEnded:entry.openEnded===true,
    eventType:entry.eventType==='milestone'?'milestone':'duration',institution:bounded(entry.institution,'Institution',1000),
    description:bounded(entry.description,'Description'),country:bounded(entry.country,'Country',300),city:bounded(entry.city,'City',300),state:bounded(entry.state,'State',300),
    specialty:bounded(entry.specialty,'Specialty',300),rotationType:bounded(entry.rotationType,'Rotation type',300),degree:bounded(entry.degree,'Degree',300),role:bounded(entry.role,'Role',300)};
  const fields={canonicalType:bounded(entry.canonicalType,'Canonical type',100),extractionBasis:'SOURCE_CHECK',
    mappingReviewRequired:!category,[institutionKey(category)]:values.institution,...(ongoingKey(category)?{[ongoingKey(category)]:values.openEnded}:{}),
    ...Object.fromEntries(['description','country','city','state','specialty','rotationType','degree','role','examSystem','examName','result','score','attempt'].filter(key=>values[key]!=null&&values[key]!=='').map(key=>[key==='country'&&category==='education'?'medicalSchoolCountry':key,values[key]])),
    datePrecision:{start:start.precision,end:end.precision},sourceDateWording:{start:{raw:start.raw,precision:start.precision,normalizedMonth:start.value},end:{raw:end.raw,precision:end.precision,normalizedMonth:end.value}},
    myerasReview:{schemaVersion:MYERAS_SOURCE_SCHEMA,recordKey:text(entry.recordKey),variants:[{sourceId:source.id,values,dates:{start,end},confidence:text(entry.confidence)||'medium',provenance:evidence}],conflicts:[],possibleDuplicates:[],profileConflicts:[]}};
  return{id:`myeras:${encodeURIComponent(source.id)}:${encodeURIComponent(entry.id||String(index))}`,title,categoryId:category,startDate:start.value,endDate:end.value||null,openEnded:values.openEnded,eventType:values.eventType,
    confidence:['high','medium','low'].includes(entry.confidence)?entry.confidence:'medium',confidenceDetails:{level:text(entry.confidence)||'medium',basis:'SOURCE_CLAIM'},
    sourceSnippet:evidence.sourceExcerpt,provenance:[evidence],notes:'',warnings:[...(!category?['Choose the category from your source.']:[]),...([start,end].some(date=>date.raw&&date.precision==='UNKNOWN')?['Source date wording needs your review.']:[])],
    visibilityState:'ADVISOR_ONLY',decision:'undecided',fields};
}
const fingerprint=c=>JSON.stringify([c.title,c.categoryId,c.startDate,c.endDate,c.openEnded,c.eventType,c.fields.myerasReview.variants[0].values].map(value=>typeof value==='string'?semantic(value):value));
const sameContext=(a,b)=>semantic(a.title)&&semantic(a.title)===semantic(b.title)&&semantic(a.fields.myerasReview.variants[0].values.institution)===semantic(b.fields.myerasReview.variants[0].values.institution);
export function supplementMyerasCandidate(candidate){
  for(const field of new Set(candidate.fields.myerasReview.variants.flatMap(item=>Object.keys(item.values)))){
    const choices=claimVariants(candidate.fields.myerasReview.variants,field);if(choices.length!==1)continue;
    const choice=choices[0];candidate.fields.myerasFieldProvenance={...(candidate.fields.myerasFieldProvenance||{}),[field]:clone(choice)};
    if(['startDate','endDate'].includes(field)){
      const edge=field==='endDate'?'end':'start',date=myerasDate(choice.value,edge);candidate[field]=date.value||null;candidate.fields.datePrecision[edge]=date.precision;candidate.fields.sourceDateWording[edge]={raw:date.raw,precision:date.precision,normalizedMonth:date.value};
    }else if(['title','categoryId','openEnded','eventType'].includes(field))candidate[field]=choice.value;
    else candidate.fields[field==='institution'?institutionKey(candidate.categoryId):field==='country'&&candidate.categoryId==='education'?'medicalSchoolCountry':field]=choice.value;
  }
  if(candidate.categoryId)candidate.fields.mappingReviewRequired=false;
  return synchronizeMyerasOngoing(synchronizeMyerasInstitution(candidate));
}
function combine(target,next){
  target.provenance.push(...clone(next.provenance));target.sourceSnippet=[target.sourceSnippet,next.sourceSnippet].filter(Boolean).join('\n');
  target.fields.myerasReview.variants.push(...clone(next.fields.myerasReview.variants));
  target.fields.myerasReview.conflicts=myerasConflicts(target.fields.myerasReview.variants);
  supplementMyerasCandidate(target);
  target.confidence=target.confidence===next.confidence?target.confidence:'medium';
  if(target.fields.myerasReview.conflicts.length)target.confidence='low';
}
export function normalizeMyerasSources(envelope,{existingEvents=[],existingProfile={}}={}){
  allowOnly(envelope,new Set(['schemaVersion','sources']),'Import');
  if(envelope.schemaVersion!==MYERAS_SOURCE_SCHEMA)fail(`Use schemaVersion ${MYERAS_SOURCE_SCHEMA}.`);
  if(!Array.isArray(envelope.sources)||!envelope.sources.length||envelope.sources.length>30)fail('Provide 1–30 sources.');
  const sourceIds=new Set(),sources=envelope.sources.map(source=>{
    allowOnly(source,sourceFields,'Source');if(typeof source.id!=='string'||source.id!==text(source.id)||!idPattern.test(source.id)||sourceIds.has(source.id))fail('Source ids must be unique local references.');sourceIds.add(source.id);
    if(!['CV','MYERAS_SECTION'].includes(source.kind))fail('Source kind must be CV or MYERAS_SECTION.');
    if(source.sha256&&!/^[a-f0-9]{64}$/i.test(source.sha256))fail('Source SHA-256 must be a hexadecimal digest.');
    if(source.profile){allowOnly(source.profile,profileFields,'Profile');for(const value of Object.values(source.profile))if(typeof value!=='string')fail('Profile claims must be text.');}
    if(!Array.isArray(source.entries)||source.entries.length>500)fail('Each source needs an entries array of at most 500 records.');
    return{...source,label:bounded(source.label||source.id,'Source label',300)};
  });
  for(const source of sources){const ids=new Set();for(const [index,entry] of source.entries.entries()){const id=text(entry?.id)||String(index);if(ids.has(id))fail('Entry ids must be unique within each source, including generated record references.');ids.add(id);}}
  const candidates=[],exact=new Map();
  for(const source of sources)for(const [index,entry] of source.entries.entries()){
    const candidate=mapEntry(source,entry,index),key=fingerprint(candidate);
    const prior=exact.get(key)||candidates.find(other=>candidate.fields.myerasReview.recordKey&&candidate.fields.myerasReview.recordKey===other.fields.myerasReview.recordKey);
    if(prior)combine(prior,candidate);else{candidates.push(candidate);exact.set(key,candidate);}
  }
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
    if(!sameContext(candidates[i],candidates[j]))continue;
    for(const [a,b] of [[candidates[i],candidates[j]],[candidates[j],candidates[i]]])a.fields.myerasReview.possibleDuplicates.push({id:b.id,kind:'candidate',resolution:null});
  }
  for(const candidate of candidates)for(const event of existingEvents){
    if(semantic(event.title)===semantic(candidate.title)&&event.categoryId===candidate.categoryId&&semantic(event.siteName||event.fields?.[institutionKey(event.categoryId)])===semantic(candidate.fields.myerasReview.variants[0].values.institution))candidate.fields.myerasReview.possibleDuplicates.push({id:String(event.id),kind:'event',resolution:null});
  }
  const profileVariants=profileClaims(sources),claims=[];
  for(const field of MYERAS_PROFILE_FIELDS){
    const choices=claimVariants(profileVariants,field);if(!choices.length)continue;
    const current=text(existingProfile[field]);
    if(current&&!choices.some(choice=>text(choice.value)===current))choices.push({value:current,sourceIds:[],evidence:clone(existingProfile.fieldProvenance?.[field]?.provenance||[]),keepCurrent:true});
    claims.push({id:`profile:${field}`,field,choices,expectedPrior:current,resolution:null,decision:'undecided',visibilityState:'ADVISOR_ONLY'});
  }
  return{readable:true,candidates,sourceDocument:{effectiveType:'MYERAS',userDeclaredType:'MyERAS export'},parser:{intelligenceMode:'LOCAL_LIMITED',effectiveType:'MYERAS',detectedType:'MYERAS',schemaVersion:MYERAS_SOURCE_SCHEMA,extractionMethod:'MYERAS_STRUCTURED_SOURCE_CHECK',
    sourceCount:sources.length,myerasProfileReview:{schemaVersion:MYERAS_SOURCE_SCHEMA,claims}},qualitySuggestions:[]};
}
export function myerasReviewErrors(candidate){
  const review=candidate?.fields?.myerasReview;if(!review)return{};
  const errors={};
  if((review.conflicts||[]).some(item=>!item.resolution))errors.sourceConflicts='Choose a source value or enter a correction for each conflicting fact.';
  if((review.possibleDuplicates||[]).some(item=>!item.resolution))errors.possibleDuplicates='Decide whether the possible duplicate is separate or the same experience.';
  if(candidate.fields.acceptProfileClaims===true&&(review.profileConflicts||[]).some(item=>!item.resolution))errors.profileConflicts='Resolve profile source conflicts before accepting profile claims.';
  return errors;
}
export function resolveMyerasConflict(candidate,conflictId,{choiceIndex=null,value=null,reason='',profile=false}={}){
  const copy=clone(candidate),review=copy.fields.myerasReview;
  const conflict=(profile?review.profileConflicts:review.conflicts).find(item=>item.id===conflictId);if(!conflict)fail('This source conflict is unavailable.');
  let selected;
  if(choiceIndex!=null){selected=conflict.choices[Number(choiceIndex)];if(!selected)fail('Choose an available source value.');value=selected.value;}
  else if(!text(reason))fail('Describe the evidence for your correction.');
  if(conflict.field==='openEnded'){
    if(value===true||value==='true')value=true;else if(value===false||value==='false')value=false;else fail('Ongoing status must be true or false.');
  }
  if(conflict.field==='eventType'&&!['duration','milestone'].includes(value))fail('Choose duration or milestone.');
  if(conflict.field==='categoryId'&&!categories.has(value))fail('Choose a supported category.');
  if(conflict.field==='attempt'){
    if(!/^[1-9][0-9]*$/.test(String(value))||Number(value)>20)fail('Exam attempt must be an explicit positive whole number.');value=Number(value);
  }
  conflict.resolution={basis:selected?'SOURCE_CHOICE':'HUMAN_CORRECTION',value:clone(value),sourceIds:selected?clone(selected.sourceIds):[],reason:text(reason)};
  const field=conflict.field;
  if(profile){
    const keys={fullName:['profileFullName','profileNameProvenance'],medicalSchool:['profileMedicalSchool','profileMedicalSchoolProvenance'],degree:['profileDegree','profileDegreeProvenance']};
    if(keys[field]){copy.fields[keys[field][0]]=value;copy.fields[keys[field][1]]=selected?clone(selected.evidence):[{extractionMethod:'HUMAN_CORRECTION',sourceExcerpt:text(reason)}];}
    else review.profileClaims={...(review.profileClaims||{}),[field]:{value,evidence:selected?clone(selected.evidence):[],resolution:clone(conflict.resolution)}};
  }else if(['startDate','endDate'].includes(field)){
    const date=myerasDate(value,field==='endDate'?'end':'start');if(!date.value)fail('The resolved date needs a year, month and year, or exact calendar date.');
    copy[field]=date.value;const edge=field==='endDate'?'end':'start';copy.fields.datePrecision[edge]=date.precision;copy.fields.sourceDateWording[edge]={raw:date.raw,precision:date.precision,normalizedMonth:date.value};
  }else if(['title','categoryId','openEnded','eventType'].includes(field)){copy[field]=value;if(field==='categoryId'){if(!categories.has(value))fail('Choose a supported category.');copy.fields.mappingReviewRequired=false;copy.fields.categoryConfirmed=true;synchronizeMyerasInstitution(copy,review.conflicts.find(item=>item.field==='institution')?.resolution?.value??copy.fields.institution??copy.fields.organization??copy.fields.medicalSchool??'');}}
  else if(field==='institution')synchronizeMyerasInstitution(copy,value);else copy.fields[field==='country'&&copy.categoryId==='education'?'medicalSchoolCountry':field]=value;
  if(copy.openEnded)copy.endDate=null;
  copy.decision='undecided';return synchronizeMyerasOngoing(copy);
}
export function createMyerasIntakeAdapter({fallbackAdapter=null,existingEvents=()=>[],existingProfile=()=>({})}={}){
  return{...fallbackAdapter,async extract(input){
    if(input.file?.myerasStructured!==true){if(!fallbackAdapter?.extract)fail('A CV document adapter is unavailable.');return fallbackAdapter.extract(input);}
    if(input.signal?.aborted)throw new DOMException('Import cancelled.','AbortError');
    const raw=await input.file.text();if(raw.length>2*1024*1024)fail('Structured import is limited to 2MB.');
    let envelope;try{envelope=JSON.parse(raw);}catch{fail('The structured import must be valid JSON.');}
    return normalizeMyerasSources(envelope,{existingEvents:existingEvents(),existingProfile:existingProfile()});
  }};
}

import {escapeHtml,formatMonth,parseMonth} from './utils.js';
import {parseExactDate} from './exact-date-field.js';
import {ALL_ROTATION_SPECIALTIES} from './specialty-taxonomy.js';

const DOMAINS=new Set(['clinical','work','research','personal']);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value||{},key);
const text=value=>String(value??'').trim();
const normalized=value=>text(value).normalize('NFKC').replace(/[–—−]/g,'-').replace(/\s+/g,' ').toLowerCase();

export function isImportedBuilderEvent022(event){
  return event?.sourceType==='document-intake'&&!!event.id&&DOMAINS.has(event.categoryId)&&!event.fields?.publicationMilestone;
}
export function builderDomain022(event){
  return event?.fields?.builderDomain||(isImportedBuilderEvent022(event)?event.categoryId:null);
}
export function builderEntryId022(event){
  return event?.fields?.builderEntryId||(isImportedBuilderEvent022(event)?`imported:${event.id}`:null);
}

function sourceTitleEvidence(event){
  const title=normalized(event.title);
  if(!title)return[];
  return(event.provenance||[]).flatMap((item,index)=>{
    const excerpt=text(item.sourceExcerpt||item.sourceSnippet||item.excerpt||item.sourceText);
    return normalized(excerpt).includes(title)?[index]:[];
  });
}

/** Split only explicit comma-separated, source-backed labels. Unknowns stay empty. */
export function importedBuilderFields022(event){
  const fields=structuredClone(event?.fields||{});
  if(!isImportedBuilderEvent022(event))return fields;
  const evidenceIndexes=sourceTitleEvidence(event);
  const parts=text(event.title).split(/\s*,\s*/).map(text);
  const add=(key,value)=>{
    if(text(fields[key])||!text(value)||!evidenceIndexes.length)return;
    fields[key]=text(value);
    fields.builderFieldProvenance022={...(fields.builderFieldProvenance022||{}),[key]:{
      basis:'SOURCE_FACT',sourceEventId:event.id,sourceProvenanceIndexes:evidenceIndexes,value:text(value)
    }};
  };
  if(event.categoryId==='clinical'){
    const first=parts[0]||'';
    const direct=/^(?:clinical )?(?:observership|elective|externship|sub-internship|clerkship)$/i.test(first);
    const suffix=first.match(/^(.+?)\s+(Observership|Elective|Externship|Sub-internship|Clerkship)$/i);
    if(direct&&parts.length>=3){
      add('rotationType',first);add('specialty',parts[1]);add('institution',parts[2]);
      if(parts.length===5&&/^[A-Z]{2}$/.test(parts[4])){add('city',parts[3]);add('state',parts[4]);}
    }else if(suffix){
      add('specialty',suffix[1]);add('rotationType',suffix[2]);
      if(parts.length>=2)add('institution',parts[1]);
    }
  }else if(event.categoryId==='work'&&parts.length>=2){
    add('role',parts[0]);
    const specialty=ALL_ROTATION_SPECIALTIES.some(value=>normalized(value)===normalized(parts[1]));
    add('organization',specialty&&parts.length>=3?parts.slice(2).join(', '):parts[1]);
  }else if(event.categoryId==='research'&&/\b(?:research (?:assistant|fellow|coordinator)|principal investigator)\b/i.test(parts[0]||'')){
    add('role',parts[0]);
    if(parts.length>=2)add('institution',parts.slice(1).join(', '));
  }
  return fields;
}

export function bindImportedBuilderEvent022(event){
  if(!isImportedBuilderEvent022(event))return event;
  const fields=importedBuilderFields022(event);
  return{...event,fields:{...fields,builderDomain:builderDomain022(event),builderEntryId:builderEntryId022(event)},
    siteName:event.siteName||fields.institution||fields.organization||''};
}

function precision(event,edge){
  const value=event.fields?.datePrecision;
  return text(typeof value==='string'?value:value?.[edge]||value?.[`${edge}Date`]).toUpperCase();
}
function dateInput(event,edge){
  const raw=event[`${edge}Date`];
  if(!raw)return'';
  if(precision(event,edge)==='YEAR')return text(raw).slice(0,4);
  const exact=event.fields?.[`rotation${edge==='start'?'Start':'End'}Date`];
  return exact||raw;
}
export function importedBuilderDraft022(event){
  const fields=importedBuilderFields022(event);
  return{
    importedEventId:event.id,title:text(event.title),startDate:dateInput(event,'start'),endDate:dateInput(event,'end'),
    openEnded:event.openEnded===true,eventType:event.eventType,
    institution:text(fields.institution||event.siteName),specialty:text(fields.specialty),rotationType:text(fields.rotationType),
    role:text(fields.role),organization:text(fields.organization||event.siteName),country:text(fields.country),city:text(fields.city),
    state:text(fields.state),kind:text(fields.kind),projectTitle:text(fields.projectTitle),notes:text(event.notes)
  };
}

function parsedDate(value,edge){
  const raw=text(value);
  if(/^\d{4}$/.test(raw))return{date:`${raw}-${edge==='end'?'12':'01'}`,precision:'YEAR',exact:null};
  const month=parseMonth(raw);
  if(month)return{date:month,precision:'MONTH',exact:null};
  const exact=parseExactDate(raw);
  return exact?{date:exact.slice(0,7),precision:'DAY',exact}:null;
}
export function validateImportedBuilderDraft022(draft){
  const errors={};
  if(!text(draft.title))errors.title='Required.';
  const start=parsedDate(draft.startDate,'start');
  const end=draft.eventType==='milestone'||draft.openEnded?null:parsedDate(draft.endDate,'end');
  if(!start)errors.startDate='Use a year, month and year, or an exact date from your source.';
  if(text(draft.endDate)&&!draft.openEnded&&draft.eventType!=='milestone'&&!end)errors.endDate='Use a year, month and year, or an exact date from your source.';
  if(start&&end&&(end.exact||`${end.date}-31`)<(start.exact||`${start.date}-01`))errors.endDate='End date is before the start date.';
  return errors;
}

const DOMAIN_FIELDS={
  clinical:[['institution','Institution'],['specialty','Specialty'],['rotationType','Rotation type'],['city','City'],['state','State']],
  work:[['role','Role / title'],['organization','Organization'],['country','Country'],['city','City'],['kind','Clinical or non-clinical, if known']],
  research:[['projectTitle','Project title, if known'],['institution','Institution / lab'],['role','Role']],
  personal:[]
};
export function renderImportedBuilderForm022(draft,domain){
  const input=(key,label,required=false)=>`<div class="field builderField"><label for="imported-${escapeHtml(key)}">${escapeHtml(label)}</label><input id="imported-${escapeHtml(key)}" name="${escapeHtml(key)}" type="text" value="${escapeHtml(draft[key])}" data-imported-field="${escapeHtml(key)}" data-draft-field="${escapeHtml(key)}" ${required?'required':''} aria-describedby="imported-${escapeHtml(key)}-error"><p class="field-error" id="imported-${escapeHtml(key)}-error" data-error-for="${escapeHtml(key)}" data-domain-error="${escapeHtml(key)}" aria-live="polite"></p></div>`;
  return`<form class="entry-card builderDomainCard" data-entry-form="${escapeHtml(domain)}" data-domain-form="${escapeHtml(domain)}" data-imported-entry-form novalidate>
    <h2>Review imported entry</h2><p class="field-help">Your accepted facts are already filled. Correct only what needs changing. Keep the date precision stated in your source; you do not need to invent a day or month.</p>
    <div class="builderFields">${input('title','Timeline label',true)}${(DOMAIN_FIELDS[domain]||[]).map(([key,label])=>input(key,label)).join('')}
    <div class="field-row">${input('startDate',draft.eventType==='milestone'?'Date':'Start date',true)}${draft.eventType==='milestone'||draft.openEnded?'':input('endDate','End date')}</div>
    ${draft.eventType==='milestone'?'':`<label class="check-row builderToggle"><input type="checkbox" name="openEnded" data-imported-field="openEnded" data-draft-field="openEnded" data-domain-toggle="openEnded" ${draft.openEnded?'checked':''}><span>Ongoing</span></label>`}
    ${input('notes','Notes (optional)')}</div>
    <div class="entry-actions builderDomainActions"><button type="button" class="button primary btnD go" data-save-entry="${escapeHtml(domain)}" data-domain-save="${escapeHtml(domain)}">Save changes</button><button type="button" class="button tertiary homeTertiary" data-cancel-entry="${escapeHtml(domain)}" data-domain-cancel="${escapeHtml(domain)}">Cancel</button></div>
  </form>`;
}
export function importedDraftFromForm022(form,current){
  const next={...current};
  for(const control of form.querySelectorAll('[data-imported-field]')){
    const key=control.dataset.importedField;
    if(own(current,key))next[key]=control.type==='checkbox'?control.checked:text(control.value);
  }
  return next;
}

export function updateImportedBuilderEvent022(existing,draft,{clock=()=>new Date()}={}){
  const errors=validateImportedBuilderDraft022(draft);
  if(Object.keys(errors).length)return{ok:false,errors};
  if(!isImportedBuilderEvent022(existing)||String(draft.importedEventId)!==String(existing.id))return{ok:false,errors:{title:'The imported entry is no longer available. Reopen it from your Timeline.'}};
  const original=importedBuilderDraft022(existing);
  const event=bindImportedBuilderEvent022(structuredClone(existing));
  const changes=[];
  const change=(field,before,after)=>{if(JSON.stringify(before)!==JSON.stringify(after))changes.push({field,before,after,basis:'STUDENT_CHANGE'});};
  for(const key of ['title','notes']){
    if(text(draft[key])!==text(original[key])){change(key,existing[key],text(draft[key]));event[key]=text(draft[key]);}
  }
  const fields=event.fields;
  for(const [key] of DOMAIN_FIELDS[existing.categoryId]||[]){
    if(text(draft[key])!==text(original[key])){change(`fields.${key}`,fields[key]??'',text(draft[key]));fields[key]=text(draft[key]);}
  }
  const organizationKey=existing.categoryId==='work'?'organization':'institution';
  if(['clinical','work','research'].includes(existing.categoryId)&&text(draft[organizationKey])!==text(original[organizationKey]))event.siteName=text(draft[organizationKey]);
  for(const edge of ['start','end']){
    const key=`${edge}Date`,raw=text(draft[key]);
    if(edge==='end'&&(existing.eventType==='milestone'||draft.openEnded)){
      if(existing.endDate){change(key,existing.endDate,null);event.endDate=null;}
      continue;
    }
    if(raw===text(original[key]))continue;
    const parsed=parsedDate(raw,edge);
    change(key,existing[key],parsed?.date||null);event[key]=parsed?.date||null;
    fields.datePrecision={start:precision(existing,'start')||null,end:precision(existing,'end')||null,...(typeof fields.datePrecision==='object'?fields.datePrecision:{}),[edge]:parsed?.precision||null};
    if(existing.categoryId==='clinical'){
      fields[`rotation${edge==='start'?'Start':'End'}Date`]=parsed?.exact||null;
      fields.rotationDatePrecision=parsed?.exact?'day':'month-legacy';
    }
  }
  if(existing.eventType!=='milestone'){change('openEnded',existing.openEnded===true,draft.openEnded===true);event.openEnded=draft.openEnded===true;}
  if(changes.length)fields.importedBuilderEdits022=[...(fields.importedBuilderEdits022||[]),{at:clock().toISOString(),changes}];
  return{ok:true,errors:{},event};
}

export function importedBuilderSummary022(event){
  const label=edge=>precision(event,edge)==='YEAR'?text(event[`${edge}Date`]).slice(0,4):formatMonth(event[`${edge}Date`])||text(event[`${edge}Date`]);
  return`${event.title||''} · ${label('start')}${event.eventType==='milestone'?'':`–${event.openEnded?'now':label('end')}`}`;
}

export function importedCanvasDateField022(event,edge){
  const key=`${edge}Date`;
  const id=`canvas-${event.id}-${edge}`;
  return`<div class="field"><label for="${escapeHtml(id)}">${edge==='start'?(event.eventType==='milestone'?'Date':'Start date'):'End date'}</label><input type="text" id="${escapeHtml(id)}" data-canvas-imported-date="${key}" value="${escapeHtml(dateInput(event,edge))}" aria-describedby="${escapeHtml(id)}-help"><p id="${escapeHtml(id)}-help" class="field-help">Keep the year, month, or exact date stated in your source.</p></div>`;
}

/** Canvas uses the same in-place imported save as Builder, then its explicit presentation controls. */
export function updateImportedCanvasDetails022(existing,{keys={},fields={},dates={},exportAudiences}={}){
  const draft=importedBuilderDraft022(existing),display=bindImportedBuilderEvent022(existing);
  for(const key of ['title','notes'])if(own(keys,key))draft[key]=keys[key];
  for(const edge of ['startDate','endDate'])if(own(dates,edge))draft[edge]=dates[edge];
  const organizationKey=existing.categoryId==='work'?'organization':'institution';
  if(own(keys,'siteName')&&text(keys.siteName)!==text(display.siteName))draft[organizationKey]=text(keys.siteName);
  for(const [key] of DOMAIN_FIELDS[existing.categoryId]||[]){
    if(own(fields,key)&&text(fields[key])!==text(display.fields[key]))draft[key]=fields[key];
  }
  const ongoingKey=existing.categoryId==='research'?'ongoing':'current';
  if(own(fields,ongoingKey))draft.openEnded=fields[ongoingKey]===true;
  const result=updateImportedBuilderEvent022(existing,draft);
  if(!result.ok)return result;
  const event=result.event,extraChanges=[];
  const record=(field,before,after)=>extraChanges.push({field,before,after,basis:'STUDENT_CHANGE'});
  for(const key of ['categoryId','visibilityState'])if(own(keys,key)&&keys[key]!==existing[key]){record(key,existing[key],keys[key]);event[key]=keys[key];}
  if(event.categoryId!==existing.categoryId){
    if(DOMAINS.has(event.categoryId))event.fields.builderDomain=event.categoryId;
    else delete event.fields.builderDomain;
  }
  for(const [key,value] of Object.entries(fields)){
    if((DOMAIN_FIELDS[existing.categoryId]||[]).some(([field])=>field===key))continue;
    const expected=key===ongoingKey?existing.openEnded===true:display.fields[key];
    const changed=typeof value==='boolean'?value!==(expected===true):text(value)!==text(expected);
    if(changed){record(`fields.${key}`,existing.fields?.[key]??null,value);event.fields[key]=value;}
  }
  if(exportAudiences!==undefined&&JSON.stringify(exportAudiences)!==JSON.stringify(existing.fields?.exportAudiences||[])){
    record('fields.exportAudiences',existing.fields?.exportAudiences||[],exportAudiences);event.fields.exportAudiences=[...exportAudiences];
  }
  if(extraChanges.length)event.fields.importedBuilderEdits022=[...(event.fields.importedBuilderEdits022||[]),{at:new Date().toISOString(),changes:extraChanges}];
  return result;
}

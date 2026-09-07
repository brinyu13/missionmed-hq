/* D1-022. Consent and publication are acknowledged by their server owners.
 * Presentation capabilities never replace API authorization. No private content
 * is placed in markup; all user-authored standard text uses textContent. */
export const TIMELINE_AI_DISCLOSURE_022 = Object.freeze({
  purpose: 'Optional AI help for your Timeline',
  description: 'When you ask for AI help, the selected CV or document content, Timeline details, or existing Timeline image is sent to OpenAI to review chronology, categories, wording, readability, and reconstruction.',
  review: 'AI suggestions are separate from source facts. You review changes to dates, institutions, roles, and experiences before they become part of your Timeline.',
  storage: 'MissionMed sends these requests with response storage disabled (store: false). This does not mean every form of provider retention is disabled.',
  choice: 'AI is optional. You can continue with the editor and MissionMed rules, and withdraw permission here to stop future AI requests. A request already sent may finish.',
  checkbox: 'I understand how my selected content is used and choose to enable Timeline AI.'
});
const KINDS = Object.freeze({GOOD_EXAMPLE:'Good example',REJECTED_EXAMPLE:'Rejected example',PHRASING:'Preferred phrasing',CATEGORY_CORRECTION:'Category correction',DENSITY:'Density',LAYOUT:'Layout',KEEP_REMOVE:'Keep or remove',VISUAL_QUALITY:'Visual quality',INTERVIEW_READINESS:'Interview readiness'});
const WORKFLOWS = Object.freeze({CV:'CV review',GUARDIAN:'Guardian',RESCUE:'Rescue'});
function create(doc,tag,className='',text='') {const el=doc.createElement(tag);if(className)el.className=className;el.textContent=text;return el;}
function append(parent,...children){parent.append(...children);return parent;}
function button(doc,text,primary=false){const el=create(doc,'button',`tl-ai022-button ${primary?'tl-ai022-primary':''}`,text);el.type='button';return el;}
function heading(doc,eyebrow,title,copy){const group=create(doc,'div','tl-ai022-heading');append(group,create(doc,'p','tl-ai022-eyebrow',eyebrow),create(doc,'h2','',title));if(copy)group.append(create(doc,'p','tl-ai022-copy',copy));return group;}
function message(doc){const el=create(doc,'p','tl-ai022-message');el.setAttribute('role','status');el.setAttribute('aria-live','polite');return el;}
function installStyle(doc){if(!doc.head||doc.querySelector('link[data-ai-settings-022]'))return;const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./styles/ai-settings-022.css',doc.baseURI||globalThis.location?.href||new URL('../../',import.meta.url)).href;link.setAttribute('data-ai-settings-022','');doc.head.append(link);}
function errorText(error){return typeof error?.message==='string'?error.message:'This change could not be confirmed. Please try again.';}
function panel(host){const doc=host.ownerDocument||globalThis.document;installStyle(doc);const root=create(doc,'section','tl-ai022');host.replaceChildren(root);return{doc,root};}
function field(doc,label,{multiline=false,type='text',required=true,limit=500,value=''}={}){const wrapper=create(doc,'label','tl-ai022-field');wrapper.append(create(doc,'span','',label));const input=create(doc,multiline?'textarea':'input');if(!multiline)input.type=type;input.required=required;input.maxLength=limit;input.value=value;if(multiline)input.rows=5;wrapper.append(input);return{wrapper,input};}
function selectField(doc,label,options,value=''){const wrapper=create(doc,'label','tl-ai022-field');wrapper.append(create(doc,'span','',label));const input=create(doc,'select');Object.entries(options).forEach(([key,name])=>{const option=create(doc,'option','',name);option.value=key;input.append(option);});if(value)input.value=value;wrapper.append(input);return{wrapper,input};}
function checkbox(doc,text){const wrapper=create(doc,'label','tl-ai022-check');const input=create(doc,'input');input.type='checkbox';input.checked=false;wrapper.append(input,create(doc,'span','',text));return{wrapper,input};}
function stamp(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():'Not recorded';}

export function timelineAiSettingsState(authClient){
  const state=authClient?.bootstrapState||{};
  return Object.freeze({student:state.role==='STUDENT',available:state.aiProcessingAvailable===true,consented:state.aiConsent===true,
    version:String(state.configuredAiConsentVersion||state.aiConsentVersion||''),consentedAt:String(state.aiConsentedAt||'')});
}

export function mountTimelineAiSettings(host,{authClient,onChange=()=>{},onClose=()=>{}}={}){
  const{doc,root}=panel(host);let destroyed=false,busy=false,notice='';
  function refresh(){
    if(destroyed)return;
    const state=timelineAiSettingsState(authClient);
    root.replaceChildren(heading(doc,'YOUR CHOICE','Timeline AI',TIMELINE_AI_DISCLOSURE_022.purpose));
    if(!state.student){root.append(create(doc,'p','tl-ai022-copy','AI permission is managed by each student for their own Timeline.'));return;}
    const badge=create(doc,'p','tl-ai022-badge',state.consented?(state.available?'Permission enabled':'Permission saved · AI currently unavailable'):'Permission not enabled');root.append(badge);
    for(const key of ['description','review','storage','choice'])root.append(create(doc,'p','tl-ai022-copy',TIMELINE_AI_DISCLOSURE_022[key]));
    if(state.consented)root.append(create(doc,'p','tl-ai022-caption',`Permission recorded ${stamp(state.consentedAt)} · ${state.version}`));
    if(!state.available)root.append(create(doc,'p','tl-ai022-notice','AI processing is not currently available for this account. The editor and MissionMed rules remain available.'));
    const form=create(doc,'form');const confirmation=checkbox(doc,TIMELINE_AI_DISCLOSURE_022.checkbox);
    const actions=create(doc,'div','tl-ai022-actions');const grant=button(doc,'Enable Timeline AI',true);grant.type='submit';
    if(!state.consented&&state.available){form.append(confirmation.wrapper);grant.disabled=true;confirmation.input.disabled=busy;confirmation.input.addEventListener('change',()=>{grant.disabled=busy||!confirmation.input.checked||!state.version;});actions.append(grant);}
    const later=button(doc,state.consented?'Done':'Not now');later.disabled=busy;later.addEventListener('click',()=>onClose());actions.append(later);
    if(state.consented){const revoke=button(doc,'Withdraw AI permission');revoke.disabled=busy;revoke.addEventListener('click',()=>change('withdraw'));actions.append(revoke);}
    form.addEventListener('submit',event=>{event.preventDefault();if(!busy&&!state.consented&&state.available&&state.version&&confirmation.input.checked)change('grant');});
    form.append(actions);root.append(form);const status=message(doc);status.textContent=busy?'Saving your choice…':notice;root.append(status);
  }
  async function change(decision){
    if(busy||destroyed)return;busy=true;notice='';refresh();
    try{await authClient.setAiConsent(decision);if(destroyed)return;const state=timelineAiSettingsState(authClient);
      if(state.consented!==(decision==='grant'))throw new Error('The server has not confirmed this permission change. Please refresh and try again.');
      notice=decision==='grant'?'AI permission is enabled. Choose an AI review when you are ready.':'AI permission is withdrawn. Future AI requests are disabled.';
      try{onChange({kind:'ai-consent',decision,state});}catch{}
    }catch(error){notice=errorText(error);}finally{busy=false;refresh();}
  }
  const unsubscribe=authClient?.subscribeClaims?.(()=>refresh());refresh();
  return{refresh,destroy(){destroyed=true;unsubscribe?.();root.remove();}};
}

/** Latest publication decision controls status; retiring v2 never revives v1. */
export function founderStandardsView(payload={}){
  const revisions=Array.isArray(payload.revisions)?payload.revisions:[];
  const decisions=Array.isArray(payload.decisions)?payload.decisions:[];
  return revisions.map(row=>{
    const own=decisions.filter(d=>d.standard_id===row.standard_id);
    const sorted=[...own].sort((a,b)=>{const x=BigInt(a.sequence||0),y=BigInt(b.sequence||0);return x===y?0:x>y?-1:1;});
    const publication=sorted.find(d=>d.decision==='APPROVE'||d.decision==='RETIRE');
    const decision=sorted.find(d=>Number(d.version)===Number(row.version));
    const current=publication?.decision==='APPROVE'&&Number(publication.version)===Number(row.version);
    const status=current?'APPROVED':decision?.decision==='RETIRE'?'RETIRED':decision?.decision==='REJECT'?'REJECTED':decision?.decision==='APPROVE'?'SUPERSEDED':'DRAFT';
    return{...row,status,current,latestVersion:Math.max(...revisions.filter(r=>r.standard_id===row.standard_id).map(r=>Number(r.version))),approval:current?publication:null};
  }).sort((a,b)=>String(a.standard_id).localeCompare(String(b.standard_id))||Number(b.version)-Number(a.version));
}

export function mountFounderStandardsManager(host,{authClient,onChange=()=>{}}={}){
  const{doc,root}=panel(host);let destroyed=false,busy=false,notice='',rows=[],editor=null,loaded=false,loadGeneration=0;
  const manager=()=>authClient?.bootstrapState?.founderStandardsManager===true;
  const status=message(doc);
  async function refresh(){
    const generation=++loadGeneration;if(destroyed)return;
    if(!manager()){rows=[];render();return;}
    busy=true;render();try{const result=await authClient.request('/founder-standards');if(destroyed||generation!==loadGeneration)return;rows=founderStandardsView(result);loaded=true;}
    catch(error){if(generation===loadGeneration)notice=errorText(error);}finally{if(generation===loadGeneration){busy=false;render();}}
  }
  function render(){
    if(destroyed)return;
    root.replaceChildren(heading(doc,'FOUNDER STANDARD','Your Timeline standard','Turn explicit review decisions into versioned guidance for CV review, Guardian, and Rescue. Only approved guidance is retrieved.'));
    if(!manager()){root.append(create(doc,'p','tl-ai022-copy','Founder standard management is available to the authorized standards manager.'));return;}
    const toolbar=create(doc,'div','tl-ai022-actions');const add=button(doc,'Add guidance',true),reload=button(doc,'Refresh');add.disabled=reload.disabled=busy;
    add.addEventListener('click',()=>{editor={};render();});reload.addEventListener('click',()=>refresh());toolbar.append(add,reload);root.append(toolbar);
    status.textContent=busy?'Loading or saving standards…':notice;root.append(status);
    if(editor!==null){root.append(editorForm(editor));return;}
    if(loaded&&!rows.length)root.append(create(doc,'p','tl-ai022-empty','No Founder guidance has been added yet. Save a draft, review its exact wording and source, then approve it for future AI reviews.'));
    const list=create(doc,'div','tl-ai022-library');rows.forEach(row=>list.append(standardCard(row)));root.append(list);
  }
  function standardCard(row){
    const card=create(doc,'details','tl-ai022-card');const summary=create(doc,'summary');summary.append(create(doc,'strong','',String(row.title)),create(doc,'span','tl-ai022-badge',`Version ${row.version} · ${row.status.toLowerCase()}`));card.append(summary);
    const content=create(doc,'div','tl-ai022-card-content');content.append(create(doc,'p','tl-ai022-caption',`${KINDS[row.kind]||row.kind} · ${(row.applicability_json?.workflows||[]).map(w=>WORKFLOWS[w]||w).join(', ')}`));
    content.append(create(doc,'p','tl-ai022-guidance',String(row.guidance)));
    const provenance=create(doc,'details','tl-ai022-provenance');provenance.append(create(doc,'summary','','Source and approval record'));
    for(const[label,value]of [['Source',row.provenance_json?.sourceRef],['Source SHA-256',row.provenance_json?.sourceSha256],['Version SHA-256',row.content_sha256],['Data',row.provenance_json?.dataClass],['Approval',row.approval?.approval_ref],['Approved at',row.approval?.created_at?stamp(row.approval.created_at):null]])if(value)provenance.append(create(doc,'p','',`${label}: ${value}`));content.append(provenance);
    const revise=button(doc,'Create a new version');revise.disabled=busy;revise.addEventListener('click',()=>{editor=row;render();});content.append(revise);
    const decision=create(doc,'details','tl-ai022-decision');decision.append(create(doc,'summary','',row.current?'Withdraw this version':'Review this version'));
    const reference=field(doc,'Approval or review reference',{limit:500});const reason=field(doc,'Why this decision?',{multiline:true,limit:1000});const confirmed=checkbox(doc,`I reviewed version ${row.version}, its exact guidance, and its source record.`);const actions=create(doc,'div','tl-ai022-actions');
    for(const[kind,label]of (row.current?[['RETIRE','Withdraw approved guidance']]:[['APPROVE','Approve this exact version'],['REJECT','Reject this version']])){
      const action=button(doc,label,kind==='APPROVE');action.disabled=true;const update=()=>{action.disabled=busy||!confirmed.input.checked||!reference.input.value.trim()||!reason.input.value.trim();};[confirmed.input,reference.input,reason.input].forEach(el=>el.addEventListener('input',update));confirmed.input.addEventListener('change',update);
      action.addEventListener('click',()=>{if(!action.disabled)save('/founder-standards/decisions',{standardId:row.standard_id,version:Number(row.version),decision:kind,approvalRef:reference.input.value.trim(),reason:reason.input.value.trim()},kind==='APPROVE'?'Exact guidance version approved. Future reviews can retrieve it.':kind==='RETIRE'?'Guidance withdrawn from future reviews. Its history is preserved.':'Version rejected. Existing approved guidance is unchanged.');});actions.append(action);
    }
    decision.append(reference.wrapper,reason.wrapper,confirmed.wrapper,actions);content.append(decision);card.append(content);return card;
  }
  function editorForm(row){
    const form=create(doc,'form','tl-ai022-editor');const existing=Boolean(row.latestVersion);
    form.append(create(doc,'h3','',existing?`New version of ${row.title}`:'New guidance draft'),create(doc,'p','tl-ai022-copy','Use nonpersonal guidance or synthetic examples. Private student examples and contact details are not accepted. Saving a draft does not approve it.'));
    const identity=field(doc,'Stable guidance name',{value:row.standard_id||'',limit:120});identity.input.pattern='[a-z][a-z0-9_.:-]{2,119}';identity.input.placeholder='chronology-ambiguous-dates';identity.input.readOnly=existing;
    const title=field(doc,'Title',{value:row.title||'',limit:140});const kind=selectField(doc,'Guidance type',KINDS,row.kind||'INTERVIEW_READINESS');const guidance=field(doc,'Exact guidance or example',{value:row.guidance||'',multiline:true,limit:4000});
    const source=field(doc,'Source reference',{value:row.provenance_json?.sourceRef||'',limit:500});source.input.placeholder='Approved rule, review note, or synthetic example reference';
    const hash=field(doc,'Source SHA-256',{value:row.provenance_json?.sourceSha256||'',limit:64});hash.input.pattern='[a-f0-9]{64}';
    const dataClass=selectField(doc,'Source content',{'NONPERSONAL':'Nonpersonal guidance','SYNTHETIC':'Synthetic example'},row.provenance_json?.dataClass||'NONPERSONAL');
    const categories=field(doc,'Categories (optional)',{required:false,value:(row.applicability_json?.categoryIds||[]).join(', '),limit:1000});categories.input.placeholder='education, work';
    const workflows=create(doc,'fieldset','tl-ai022-workflows');workflows.append(create(doc,'legend','','Use in'));const workflowInputs=Object.entries(WORKFLOWS).map(([key,label])=>{const control=checkbox(doc,label);control.input.checked=(row.applicability_json?.workflows||['CV','GUARDIAN','RESCUE']).includes(key);workflows.append(control.wrapper);return{key,input:control.input};});
    append(form,identity.wrapper,title.wrapper,kind.wrapper,guidance.wrapper,workflows,categories.wrapper,source.wrapper,hash.wrapper,dataClass.wrapper);
    const actions=create(doc,'div','tl-ai022-actions');const submit=button(doc,'Save draft',true);submit.type='submit';submit.disabled=busy;const cancel=button(doc,'Cancel');cancel.disabled=busy;cancel.addEventListener('click',()=>{editor=null;render();});actions.append(submit,cancel);form.append(actions);
    form.addEventListener('submit',event=>{event.preventDefault();if(busy)return;const selected=workflowInputs.filter(w=>w.input.checked).map(w=>w.key);if(!selected.length){notice='Choose at least one workflow.';status.textContent=notice;return;}
      const body={standardId:identity.input.value.trim(),baseVersion:existing?row.latestVersion:0,kind:kind.input.value,title:title.input.value.trim(),guidance:guidance.input.value.trim(),applicability:{workflows:selected,categoryIds:categories.input.value.split(',').map(v=>v.trim()).filter(Boolean)},provenance:{sourceRef:source.input.value.trim(),sourceSha256:hash.input.value.trim(),dataClass:dataClass.input.value}};
      editor={standard_id:body.standardId,latestVersion:body.baseVersion,kind:body.kind,title:body.title,guidance:body.guidance,applicability_json:body.applicability,provenance_json:body.provenance};
      save('/founder-standards/revisions',body,'Draft saved. Review the exact version before approving it.');});return form;
  }
  async function save(path,body,success){
    if(busy||destroyed)return;busy=true;notice='Saving…';status.textContent=notice;root.querySelectorAll('button').forEach(el=>{el.disabled=true;});
    try{const result=await authClient.request(path,{method:'POST',body});if(destroyed)return;editor=null;notice=success;try{onChange({kind:'founder-standard',path,result});}catch{}await refresh();}
    catch(error){notice=errorText(error);}finally{busy=false;render();}
  }
  const unsubscribe=authClient?.subscribeClaims?.(()=>{if(!manager()){rows=[];editor=null;render();}});refresh();
  return{refresh,destroy(){destroyed=true;loadGeneration++;unsubscribe?.();root.remove();}};
}

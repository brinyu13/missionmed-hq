import {escapeHtml} from '../uxr-002/utils.js';

export const TIMELINE_ADMIN_METRICS_022=Object.freeze([
  {id:'eligible',label:'Eligible 360 students'},
  {id:'never_started',label:'Never started'},
  {id:'cv_imported',label:'Imported a CV'},
  {id:'draft',label:'Have a draft'},
  {id:'needs_review',label:'Need review'},
  {id:'guardian_issues',label:'Guardian issues'},
  {id:'ready',label:'Interview-ready'},
  {id:'recently_exported',label:'Exported this week'},
  {id:'recently_active',label:'Active this week'}
]);
const metricIds=new Set(TIMELINE_ADMIN_METRICS_022.map(item=>item.id));
const labelFor=id=>TIMELINE_ADMIN_METRICS_022.find(item=>item.id===id)?.label||'All eligible students';
const text=value=>typeof value==='string'?value.trim():'';
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const plainStatus=value=>text(value).toLowerCase().replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase());
const initials=name=>text(name).split(/\s+/).filter(Boolean).slice(0,2).map(part=>[...part][0]).join('').toUpperCase()||'ST';
const statusLabels={NEVER_STARTED:'Never started',DRAFT:'Draft',IN_REVIEW:'Needs review',APPROVED:'Reviewed',CHANGES_REQUESTED:'Changes requested',ACCESS_RESTRICTED:'Access restricted'};

/** This is a read model for the server-verified enrollment population, not an
 * enrollment source, a local roster, or an authorization decision. */
export function normalizeTimelineAdminRoster(payload){
  if(payload?.source!=='learndash-course-3893'||!validDate(payload.verifiedAt)||!Array.isArray(payload.students)||!Array.isArray(payload.sessions)||!integer(payload.total)||!Number.isSafeInteger(payload.page)||payload.page<1||!Number.isSafeInteger(payload.pageSize)||payload.pageSize<1||payload.pageSize>250){
    throw new Error('The current student roster could not be verified. Refresh to try again.');
  }
  const metrics={};
  for(const {id} of TIMELINE_ADMIN_METRICS_022){
    if(!integer(payload.metrics?.[id]))throw new Error('The current Timeline counts could not be verified. Refresh to try again.');
    metrics[id]=payload.metrics[id];
  }
  const ids=new Set();
  const students=payload.students.map(row=>{
    if(!Number.isSafeInteger(row?.wpUserId)||row.wpUserId<1||ids.has(row.wpUserId)||row.eligible!==true||typeof row.displayName!=='string'||!Array.isArray(row.sessions)){
      throw new Error('The current student roster could not be verified. Refresh to try again.');
    }
    ids.add(row.wpUserId);
    return Object.freeze({...row,displayName:text(row.displayName)||`Student ${row.wpUserId}`,email:text(row.email),program:text(row.program),sessions:row.sessions.filter(value=>typeof value==='string').map(text).filter(Boolean)});
  });
  if(students.length!==Math.min(payload.pageSize,Math.max(0,payload.total-(payload.page-1)*payload.pageSize))||payload.total>metrics.eligible||payload.page>Math.max(1,Math.ceil(payload.total/payload.pageSize))){
    throw new Error('The current student roster page could not be verified. Refresh to try again.');
  }
  return Object.freeze({source:payload.source,verifiedAt:payload.verifiedAt,metrics:Object.freeze(metrics),students:Object.freeze(students),sessions:Object.freeze(payload.sessions.filter(value=>typeof value==='string').map(text).filter(Boolean)),total:payload.total,page:payload.page,pageSize:payload.pageSize});
}

export function timelineAdminStudentPresentation(row){
  const source=row.cvStatus==='IMPORTED'?'Imported':row.cvStatus==='NOT_IMPORTED'?'Not imported':'Unavailable';
  const issueCount=integer(row.guardianIssueCount)?row.guardianIssueCount:null;
  const guardian=row.guardianStatus==='NOT_STARTED'?'Not started':row.guardianStatus==='NOT_CHECKED'?'Not checked':row.guardianStatus==='ISSUES'?issueCount===null?'Issues to review':`${issueCount} ${issueCount===1?'issue':'issues'}`:row.guardianStatus==='CHECKED'?'Checked':'Unavailable';
  const readiness=row.exportReadiness==='READY'?'Ready to export':row.exportReadiness==='NEEDS_REVIEW'?'Needs review':row.exportReadiness==='NOT_CHECKED'?'Not checked':'Unavailable';
  return Object.freeze({name:text(row.displayName)||`Student ${row.wpUserId}`,initials:initials(row.displayName),status:statusLabels[row.status]||plainStatus(row.status)||'Status unavailable',source,guardian,readiness,eventCount:integer(row.eventCount)?row.eventCount:null,canOpen:row.canOpen===true&&Boolean(text(row.documentId))&&row.status!=='ACCESS_RESTRICTED',openReason:row.status==='NEVER_STARTED'?'No Timeline yet':row.status==='ACCESS_RESTRICTED'?'Access restricted':'Timeline unavailable'});
}

function dateMarkup(value,empty){
  if(!validDate(value))return escapeHtml(empty);
  return `<time datetime="${escapeHtml(value)}" title="${escapeHtml(value)}">${escapeHtml(new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)))}</time>`;
}
function metricButton(id,model){
  const value=model.roster?.metrics[id];
  return `<button class="tl-admin022-metric" type="button" data-admin022-metric="${id}" ${model.phase==='loading'||!integer(value)?'disabled':''}><span>${escapeHtml(labelFor(id))}</span><strong>${integer(value)?value:'—'}</strong><span aria-hidden="true">↗</span></button>`;
}
function metricGroup(title,ids,model){return `<section class="tl-admin022-actionGroup"><h2>${title}</h2>${ids.map(id=>metricButton(id,model)).join('')}</section>`;}
function studentMarkup(row,model){
  const item=timelineAdminStudentPresentation(row),opening=model.opening===row.wpUserId;
  return `<li><article class="tl-admin022-student" aria-labelledby="tl-admin022-student-${row.wpUserId}">
    <div class="tl-admin022-person"><span class="tl-admin022-avatar" aria-hidden="true">${escapeHtml(item.initials)}</span><div><h3 id="tl-admin022-student-${row.wpUserId}">${escapeHtml(item.name)}</h3>${row.email?`<p class="tl-admin022-email">${escapeHtml(row.email)}</p>`:''}<p class="tl-admin022-program">${escapeHtml(row.program||'Program not listed')} · <span>360 eligible</span></p><p class="tl-admin022-session">${escapeHtml(row.sessions.join(' · ')||'No session listed')}</p></div></div>
    <dl class="tl-admin022-facts">
      <div><dt>Timeline</dt><dd><span class="tl-admin022-state" data-state="${escapeHtml(row.status)}">${escapeHtml(item.status)}</span></dd></div>
      <div><dt>CV / source</dt><dd>${escapeHtml(item.source)}</dd></div>
      <div><dt>Events</dt><dd>${item.eventCount===null?'—':item.eventCount}</dd></div>
      <div><dt>Guardian</dt><dd>${escapeHtml(item.guardian)}</dd></div>
      <div><dt>Export</dt><dd>${escapeHtml(item.readiness)}<small>Last export: ${dateMarkup(row.lastExport,'None recorded')}</small></dd></div>
      <div><dt>Last active</dt><dd>${dateMarkup(row.lastActivity,'No activity recorded')}</dd></div>
    </dl>
    <div class="tl-admin022-open"><button class="tl-admin022-button" type="button" data-admin022-open="${row.wpUserId}" aria-label="Open Timeline for ${escapeHtml(item.name)}" ${!item.canOpen||model.phase!=='ready'||model.opening?'disabled':''}>${opening?'Opening…':'Open Timeline'}</button>${!item.canOpen?`<small>${escapeHtml(item.openReason)}</small>`:''}</div>
  </article></li>`;
}

export function renderTimelineAdminWorkspace(model){
  const roster=model.roster,loading=model.phase==='loading',hasFilter=Boolean(model.query||model.session||model.filter!=='all'),page=roster?.page||model.page||1,pages=Math.max(1,Math.ceil((roster?.total||0)/(roster?.pageSize||25)));
  const total=roster?.total,range=typeof total==='number'&&total>0?`${(page-1)*roster.pageSize+1}–${Math.min(page*roster.pageSize,total)} of ${total}`:typeof total==='number'?'0 students':'Checking the current population…';
  return `<div class="tl-admin022" aria-busy="${loading}">
    <div class="tl-admin022-intro"><div><p class="tl-admin022-eyebrow">TIMELINE ADMINISTRATOR</p><h1 tabindex="-1" data-admin022-title>Know who needs you.<br><em>Act next.</em></h1><p class="tl-admin022-purpose">Follow each student's progress from their first CV to a Timeline they can confidently share.</p></div><button type="button" class="tl-admin022-button primary" data-admin022-find>Find a student <span aria-hidden="true">↗</span></button></div>
    <div class="tl-admin022-population">${metricButton('eligible',model)}<p>Eligibility reflects current MissionMed 360 enrollment.${roster?` <span>Checked ${dateMarkup(roster.verifiedAt,'just now')}</span>`:''}</p><button type="button" class="tl-admin022-button subtle" data-admin022-refresh ${loading?'disabled':''}>${loading?'Refreshing…':'Refresh'}</button></div>
    <div class="tl-admin022-actionCenter" aria-label="Timeline administrator action center">${metricGroup('Who needs me',['needs_review','guardian_issues','never_started'],model)}${metricGroup('What comes next',['cv_imported','draft','ready'],model)}${metricGroup('What changed',['recently_exported','recently_active'],model)}</div>
    <details class="tl-admin022-how"><summary>How this works</summary><p>Choose a count to see those students, or search the full roster below. Open a student's Timeline to review their history, source documents, Guardian findings, and exports. Students who have not started remain on the roster. Their Timeline becomes available to open after they begin.</p><p>Activity and export counts cover the last seven days. Timeline and Guardian readiness remain separate until the current Timeline has been checked.</p></details>
    <section class="tl-admin022-roster" data-admin-roster aria-labelledby="tl-admin022-roster-title">
      <div class="tl-admin022-sectionHead"><div><p class="tl-admin022-eyebrow">ELIGIBLE 360 POPULATION</p><h2 id="tl-admin022-roster-title" tabindex="-1">Find a student</h2></div><p class="tl-admin022-resultCount" role="status" aria-live="polite">${escapeHtml(range)}${loading&&roster?' · refreshing':''}</p></div>
      <form class="tl-admin022-filters" data-admin022-search-form>
        <label class="tl-admin022-search"><span>Search students</span><input type="search" name="query" data-admin022-query autocomplete="off" placeholder="Name or email" value="${escapeHtml(model.query||'')}"></label>
        <label><span>Timeline status</span><select data-admin022-filter name="filter"><option value="all" ${model.filter==='all'?'selected':''}>All eligible students</option>${TIMELINE_ADMIN_METRICS_022.filter(item=>item.id!=='eligible').map(item=>`<option value="${item.id}" ${model.filter===item.id?'selected':''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>
        <label><span>Program session</span><select data-admin022-session name="session"><option value="">All sessions</option>${(roster?.sessions||[]).map(value=>`<option value="${escapeHtml(value)}" ${model.session===value?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select></label>
        <button class="tl-admin022-button primary" type="submit">Search</button>${hasFilter?'<button class="tl-admin022-button subtle" type="button" data-admin022-clear>Clear filters</button>':''}
      </form>
      ${model.error?`<div class="tl-admin022-error" role="alert"><h3>The roster needs attention</h3><p>${escapeHtml(model.error)}</p><button class="tl-admin022-button" type="button" data-admin022-refresh>Try again</button></div>`:''}
      ${loading&&!roster?'<div class="tl-admin022-loading" role="status"><span aria-hidden="true"></span><strong>Checking eligible students and Timeline progress…</strong><p>We will show the roster when its current status is confirmed.</p></div>':''}
      ${roster&&roster.students.length?`<ol class="tl-admin022-students" aria-label="Eligible students">${roster.students.map(row=>studentMarkup(row,model)).join('')}</ol>`:roster&&!loading?`<div class="tl-admin022-empty"><h3>${hasFilter?'No students match this view':'No eligible students are listed'}</h3><p>${hasFilter?'Try another name, status, or session.':'The current enrollment source returned no eligible 360 students.'}</p>${hasFilter?'<button class="tl-admin022-button" type="button" data-admin022-clear>Show all eligible students</button>':''}</div>`:''}
      ${roster&&roster.total>0?`<nav class="tl-admin022-pagination" aria-label="Student roster pages"><button class="tl-admin022-button" type="button" data-admin022-page="${page-1}" ${page<=1||loading?'disabled':''}>← Previous</button><span>Page ${page} of ${pages}</span><button class="tl-admin022-button" type="button" data-admin022-page="${page+1}" ${page>=pages||loading?'disabled':''}>Next →</button></nav>`:''}
    </section>
  </div>`;
}

function publicError(error){
  if([401,403].includes(Number(error?.status)))return 'Administrator access could not be confirmed. Return to Matrix and open Timeline again.';
  if(Number(error?.status)===409)return 'The roster changed while you were reviewing it. Refresh to see the current students.';
  return 'The current student roster could not be loaded. Refresh to try again.';
}

export function mountTimelineAdminWorkspace(host,{authClient,onOpenStudent=()=>{},onError=()=>{}}={}){
  if(!host||typeof authClient?.listAdminStudents!=='function')throw new TypeError('The Timeline administrator roster client is required.');
  const documentObject=host.ownerDocument;
  if(documentObject?.head&&!documentObject.querySelector('link[data-admin-workspace-022]')){
    const link=documentObject.createElement('link');link.rel='stylesheet';link.href=new URL('../../styles/admin-workspace-022.css',import.meta.url).href;link.setAttribute('data-admin-workspace-022','');documentObject.head.append(link);
  }
  let model={query:'',filter:'all',session:'',page:1,phase:'loading',roster:null,error:null,opening:null},generation=0,destroyed=false;
  const render=()=>{if(!destroyed)host.innerHTML=renderTimelineAdminWorkspace(model);};
  const focusRoster=()=>{host.querySelector('[data-admin-roster]')?.scrollIntoView?.({block:'start',behavior:'instant'});host.querySelector('#tl-admin022-roster-title')?.focus?.({preventScroll:true});};
  const currentFields=()=>({query:host.querySelector('[data-admin022-query]')?.value??model.query,filter:host.querySelector('[data-admin022-filter]')?.value??model.filter,session:host.querySelector('[data-admin022-session]')?.value??model.session});
  async function refresh(options={}){
    if(destroyed)return null;
    for(const key of ['query','session'])if(typeof options[key]==='string')model[key]=options[key].trim();
    if(options.filter==='all'||metricIds.has(options.filter))model.filter=options.filter==='eligible'?'all':options.filter;
    if(Number.isSafeInteger(options.page)&&options.page>0)model.page=options.page;
    const request=++generation;model.phase='loading';model.error=null;model.opening=null;render();
    try{
      const payload=await authClient.listAdminStudents({query:model.query,filter:model.filter,session:model.session,page:model.page});
      if(destroyed||request!==generation)return null;
      const roster=normalizeTimelineAdminRoster(payload);model={...model,roster,page:roster.page,phase:'ready'};render();return roster;
    }catch(error){
      if(destroyed||request!==generation)return null;
      model={...model,roster:null,phase:'error',error:publicError(error)};render();try{onError(new Error(model.error));}catch{}return null;
    }
  }
  async function onClick(event){
    const button=event.target?.closest?.('button');if(!button||!host.contains(button)||button.disabled)return;
    if(button.hasAttribute('data-admin022-find')){focusRoster();host.querySelector('[data-admin022-query]')?.focus?.({preventScroll:true});return;}
    if(button.hasAttribute('data-admin022-refresh')){await refresh({...currentFields()});return;}
    if(button.hasAttribute('data-admin022-clear')){await refresh({query:'',filter:'all',session:'',page:1});focusRoster();return;}
    if(button.hasAttribute('data-admin022-metric')){await refresh({query:'',session:'',filter:button.getAttribute('data-admin022-metric'),page:1});focusRoster();return;}
    if(button.hasAttribute('data-admin022-page')){await refresh({...currentFields(),page:Number(button.getAttribute('data-admin022-page'))});focusRoster();return;}
    if(button.hasAttribute('data-admin022-open')){
      const id=Number(button.getAttribute('data-admin022-open')),row=model.roster?.students.find(student=>student.wpUserId===id);
      if(model.phase!=='ready'||model.opening||!row||!timelineAdminStudentPresentation(row).canOpen)return;
      model.opening=id;render();
      try{await onOpenStudent(row);}catch(error){model.error='This student’s Timeline could not open. Refresh the roster and try again.';try{onError(new Error(model.error));}catch{}}
      finally{model.opening=null;render();}
    }
  }
  function onInput(event){if(event.target?.matches?.('[data-admin022-query]'))model.query=String(event.target.value||'');}
  function onSubmit(event){if(!event.target?.matches?.('[data-admin022-search-form]'))return;event.preventDefault();void refresh({...currentFields(),page:1});}
  function onChange(event){if(!event.target?.matches?.('[data-admin022-filter], [data-admin022-session]'))return;void refresh({...currentFields(),page:1});}
  host.addEventListener('click',onClick);host.addEventListener('submit',onSubmit);host.addEventListener('change',onChange);host.addEventListener('input',onInput);
  const ready=refresh();
  return Object.freeze({ready,refresh,destroy(){destroyed=true;generation++;host.removeEventListener('click',onClick);host.removeEventListener('submit',onSubmit);host.removeEventListener('change',onChange);host.removeEventListener('input',onInput);host.innerHTML='';}});
}

import {legacyVisibility,visibilityName} from "../core/canonical.js";
import {analyzeCollisionLayout,deterministicAutoArrange} from "../editor/collision-engine-410.js";
import {renderTimelineCanvas} from "../export/timeline-canvas-renderer.js";

function esc(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function displayVisibility(value){return String(value||"").replaceAll("_"," ").toLowerCase().replace(/\b\w/g,(letter)=>letter.toUpperCase());}
function monthIndex(value){if(!/^\d{4}-\d{2}$/.test(value||""))return null;const [year,month]=value.split("-").map(Number);return year*12+month-1;}
const SENSITIVE_QUESTION_CONTEXT=/\b(?:pregnan(?:cy|t)?|illness|disab(?:ility|led)?|divorc(?:e|ed)|immigration|visa|green card|citizenship|work permit|family death|miscarriage|mental health|medical leave|parental leave|daughter|son|child|baby|spouse|husband|wife)\b/i;

function hasStudentQuestionDisclosure(event){return event.studentConfirmedDisclosure===true||event.interviewerQuestionDisclosureConfirmed===true||event.questionDisclosureConfirmed===true;}

export function buildPracticeQuestions(events=[]){
  const questions=[];
  events.forEach((event)=>{
    const visibility=visibilityName(event.visibilityState||event.visibility||event.vis);
    const privateScope=["HIDDEN","STUDENT_ONLY","ADVISOR_ONLY"].includes(visibility);
    const sensitiveText=`${event.title||event.t||""} ${event.notes||""}`;
    if((privateScope&&!hasStudentQuestionDisclosure(event))||event.categoryId==="personal"||event.cat==="personal"||SENSITIVE_QUESTION_CONTEXT.test(sensitiveText))return;
    const title=event.title||event.t||"this experience",site=event.siteName||event.location||event.loc;
    if(event.categoryId==="usmle"||event.cat==="usmle")questions.push({id:`q-exam-${event.id}`,eventId:event.id,text:`How did ${title} shape your preparation strategy?`});
    else if(["th","cl"].includes(event.categoryId||event.cat))questions.push({id:`q-usce-${event.id}`,eventId:event.id,text:`What did you learn at ${site||title}, and how did it influence your residency goals?`});
    else if((event.categoryId||event.cat)==="research"||(event.categoryId||event.cat)==="res")questions.push({id:`q-research-${event.id}`,eventId:event.id,text:`What was your contribution and most important learning from ${title}?`});
    else if((event.categoryId||event.cat)==="work")questions.push({id:`q-work-${event.id}`,eventId:event.id,text:`Which responsibility in ${title} best prepared you for residency?`});
    else questions.push({id:`q-story-${event.id}`,eventId:event.id,text:`What should an interviewer understand about ${title}?`});
  });
  return questions.slice(0,12);
}

export function install410Ui(ctx){
  const {api,state,release,history,review,controller,persistence,advisor,exportEngine,ui409}=ctx;
  const query=(selector)=>document.querySelector(selector),all=(selector)=>[...document.querySelectorAll(selector)];
  const announce=(message)=>{const node=query("#statusLive409");if(node)node.textContent=message;ui409.toast(message);};
  const renderLater=()=>queueMicrotask(()=>render());

  function ensureFirstUse(){
    const command=query('section[data-view="command"] .grid2');if(!command||query("#firstUse410"))return;
    command.insertAdjacentHTML("afterend",'<section id="firstUse410" class="firstUse410" aria-labelledby="firstUseTitle410"><div><div class="subt" id="firstUseTitle410">CHOOSE A SAFE STARTING ROUTE</div><p>Start with guidance, a locally read document, or a blank manual canvas. Sample data stays optional.</p></div><button class="route410 recommended" data-nav="builder"><b>GUIDED BUILDER</b><span>Best first route. Answer in plain dates.</span></button><button class="route410" data-nav="upload"><b>CV OR ERAS INTAKE</b><span>Local privacy check, then quarantined review.</span></button><button class="route410" data-nav="canvas"><b>MANUAL CANVAS</b><span>Start blank and add only what you choose.</span></button><div class="recoveryCue410"><b>LOCAL DEMO SESSION</b><span>NOT SAFE TO LEAVE UNTIL THE SAVED CHECKPOINT ABOVE IS CONFIRMED.</span></div><div class="visibilityLaw410"><b>VISIBILITY IS ALWAYS EXPLICIT</b><span>Interviewer Safe · Full Story · Advisor Only · Student Only · Hidden</span></div></section>');
  }

  function ensureCanvasTools(){
    const section=query('section[data-view="canvas"]'),anchor=section?.querySelector(".canvasCtl");if(!section||!anchor||query("#editorTools410"))return;
    anchor.insertAdjacentHTML("afterend",'<div class="canvasCtl editorTools410" id="editorTools410" role="toolbar" aria-label="Timeline editor controls"><button class="iconTool410" data-410-action="undo" title="Undo" aria-label="Undo" disabled>↶</button><button class="iconTool410" data-410-action="redo" title="Redo" aria-label="Redo" disabled>↷</button><div class="seg density410" aria-label="Canvas density"><button data-410-density="CONDENSED">Condensed</button><button data-410-density="FIT" class="on">Fit</button><button data-410-density="EXPANDED">Expanded</button></div><div class="zoom410"><output id="zoomValue410">100%</output><button class="btnD alt sm" data-410-action="zoom-fit">FIT CANVAS</button></div><button class="btnD alt sm" data-410-action="toggle-editor-advanced" aria-expanded="false">MORE EDIT TOOLS</button><div id="advancedEditor410" class="advancedEditor410" hidden><button class="iconTool410" data-410-action="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><button class="iconTool410" data-410-action="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button class="btnD alt sm" data-410-action="duplicate-event">DUPLICATE</button><button class="btnD alt sm" data-410-action="recover-event">RECOVER REMOVED</button><button class="btnD alt sm" data-410-action="reset-source">RESET SOURCE DATES</button><button class="btnD alt sm" data-410-action="reset-layout">RESET LAYOUT</button><button class="btnD alt sm" data-410-action="reset-categories">RESET CATEGORY KEY</button><button class="btnD alt sm" data-410-action="edit-title-profile">TITLE + PROFILE</button><button class="btnD alt sm" data-410-action="edit-ribbon">INTERVIEW RIBBON</button></div></div><p class="mobileReviewNotice410" role="status">NARROW VIEW IS REVIEW-ONLY. EDIT CONTROLS ARE READ-ONLY UNTIL A WIDER SCREEN IS USED.</p>');
    const grid=query("#canvasGrid");grid?.insertAdjacentHTML("afterend",'<aside id="collisionPanel410" class="collisionPanel410" aria-live="polite"></aside>');
  }

  function ensureManualOcr(){
    const host=query('section[data-view="upload"] .grid2 > div:first-child');if(!host||query("#manualOcr410"))return;
    host.insertAdjacentHTML("beforeend",'<section class="panelD manualOcr410" id="manualOcr410"><div class="pi"><div class="subt">SCANNED PDF FALLBACK · LOCAL TEXT ONLY</div><p class="modalCopy409">If a scan has no text layer, run OCR locally on your Mac, then paste its text here. Nothing is transmitted. Page separators may use <code>--- PAGE 2 ---</code>.</p><button class="btnD alt sm" data-410-action="manual-ocr-toggle" aria-expanded="false">OPEN MANUAL TEXT FALLBACK</button><div id="manualOcrFields410" hidden><div class="editDateGrid"><label class="f"><span class="fl">SOURCE LABEL</span><input id="manualOcrName410" value="local-scanned-cv-ocr.txt"></label><label class="f"><span class="fl">PARSE AS</span><select id="manualOcrType410"><option value="auto">Auto Detect</option><option value="cv">CV</option><option value="eras">ERAS</option><option value="resume">Resume</option></select></label></div><label class="f"><span class="fl">LOCALLY GENERATED OCR TEXT</span><textarea id="manualOcrText410" rows="10" aria-describedby="manualOcrLaw410"></textarea></label><div class="ocrLaw410" id="manualOcrLaw410">ENGLISH-FIRST PARSER · OCR ACCURACY IS NOT VERIFIED · EVERY RESULT REMAINS QUARANTINED</div><button class="btnD go" data-410-action="manual-ocr-ingest">BUILD REVIEW CANDIDATES</button></div></div></section>');
  }

  function ensureReviewTools(){
    const toolbar=query('section[data-view="review"] .reviewFilters');if(!toolbar||query("#reviewTools410"))return;
    toolbar.insertAdjacentHTML("afterend",'<section class="reviewTools410" id="reviewTools410" aria-label="Large document review controls"><label>SEARCH<input id="reviewSearch410" type="search" placeholder="Title, site, source, excerpt"></label><label>SOURCE<select id="reviewSource410"><option value="ALL">All sources</option></select></label><label>GROUP<select id="reviewGroup410"><option value="ALL">All candidates</option><option value="DUPLICATES">Duplicates</option><option value="CONFLICTS">Conflicts</option><option value="UNRESOLVED">Unresolved</option></select></label><label>PAGE SIZE<select id="reviewPageSize410"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></label><button class="btnD alt sm" data-410-action="select-review-page">SELECT PAGE</button><button class="btnD go sm" data-410-action="accept-selected-safe">ACCEPT SELECTED SAFE</button><button class="btnD alt sm" data-410-action="clear-review-selection">CLEAR SELECTION</button><span class="chip cy" id="reviewSummary410">0 CANDIDATES</span></section><nav class="reviewPager410" id="reviewPager410" aria-label="Candidate pages"><button class="btnD alt sm" data-410-action="review-prev">PREVIOUS</button><span id="reviewPageLabel410">PAGE 1 OF 1</span><button class="btnD alt sm" data-410-action="review-next">NEXT</button></nav>');
    const source=query("#reviewSource410");(controller.state.sourceDocuments||[]).forEach((item)=>source.insertAdjacentHTML("beforeend",`<option value="${esc(item.id)}">${esc(item.fileName)}</option>`));
    query("#reviewSearch410").value=release.review.query;query("#reviewGroup410").value=release.review.group;query("#reviewPageSize410").value=String(release.review.pageSize);
    all("[data-408-filter]").forEach((select)=>{const key=select.dataset["408Filter"];if(release.review[key]&&controller.state.filters[key]==="ALL")select.value=release.review[key];});
  }

  function ensureAdvisorBrief(){
    const host=query('section[data-view="advisor"] .grid2 > div:last-child');if(!host||query("#advisorBrief410"))return;
    host.insertAdjacentHTML("afterbegin",'<section class="panelD advisorBrief410"><div class="pi"><div class="advisorBriefHead410"><div><div class="subt">FIVE-MINUTE PRE-MOCK BRIEF</div><p>Chronology, risk, visibility, questions, export, and FileVault in one workspace.</p></div><div><button class="btnD gd sm" data-410-action="advisor-generate-questions">REFRESH QUESTIONS</button><button class="btnD alt sm" data-410-action="advisor-revoke">REVOKE APPROVALS</button><button class="btnD alt sm" data-nav="versions">COMPARE VERSIONS</button></div></div><div id="advisorBrief410"></div></div></section>');
  }

  function ensureExportPreview(){
    const grid=query("#exGrid");if(!grid||query("#exportPreview410"))return;
    grid.insertAdjacentHTML("beforebegin",'<section id="exportPreview410" class="panelD exportPreview410"><div class="pi"><div class="exportPreviewHead410"><div><div class="subt">EXACT LOCAL EXPORT RENDERER PREVIEW</div><p>What you see here uses the same canvas renderer as the generated PNG and visual PDF.</p></div><label>SCOPE<select id="exportPreviewScope410"><option value="INTERVIEWER_SAFE">Interviewer Safe</option><option value="FULL_STORY">Full Story</option><option value="ADVISOR_PACKET">Advisor Packet</option></select></label><button class="btnD alt sm" data-410-action="download-accessible">DOWNLOAD ACCESSIBLE HTML</button></div><div id="exportPreviewCanvas410" role="img" aria-label="Export renderer preview"></div><div class="accessibleLaw410">VISUAL PDF IS UNTAGGED · SEMANTIC HTML AND TEXT COMPANIONS PROVIDE SEARCHABLE CONTENT AND LINEAR READING ORDER · NO PDF/UA CLAIM</div></div></section>');
  }

  function augmentInspector(){
    const inspector=query("#inspector"),event=api.state.user.events.find((item)=>item.id===api.state.sel);if(!inspector)return;
    if(!event)return;
    event.visibilityState=visibilityName(event.visibilityState||event.vis);
    const old=query("#iV");if(old){old.innerHTML=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"].map((value)=>`<button data-410-visibility="${value}" class="${event.visibilityState===value?"on":""}" aria-pressed="${event.visibilityState===value}">${displayVisibility(value)}</button>`).join("");old.classList.add("visibilityFive410");}
    const remove=query("#iDel");if(remove){remove.textContent="REMOVE EVENT";remove.onclick=(click)=>{click.preventDefault();history.softDeleteSelected();announce("Event removed. Recover Removed can restore it.");};}
    if(!query("#inspector410"))inspector.insertAdjacentHTML("beforeend",'<div id="inspector410" class="inspector410"><div class="inspectorAction410"><button class="btnD alt sm" data-410-action="lane-up">LANE UP</button><button class="btnD alt sm" data-410-action="lane-down">LANE DOWN</button><button class="btnD alt sm" data-410-action="duplicate-event">DUPLICATE</button><button class="btnD alt sm" data-410-action="reset-source">RESET DATES</button></div>'+(event.cat==="personal"?'<div class="personalWarning410 '+(event.visibilityState==="INTERVIEWER_SAFE"?"risk":"safe")+'"><b>PERSONAL CONTEXT</b><span>'+(event.visibilityState==="INTERVIEWER_SAFE"?"This will appear in interviewer-safe output. Confirm it is intentional and advisor-approved.":"This context is excluded from interviewer-safe output.")+'</span></div>':"")+'</div>');
  }

  function renderHistory(){const status=history.status(),undo=query('[data-410-action="undo"]'),redo=query('[data-410-action="redo"]');if(undo){undo.disabled=!status.canUndo;undo.title=status.canUndo?`Undo ${status.undoLabel}`:"Nothing to undo";}if(redo){redo.disabled=!status.canRedo;redo.title=status.canRedo?`Redo ${status.redoLabel}`:"Nothing to redo";}}

  function renderZoom(){const value=query("#zoomValue410");if(value)value.textContent=Math.round(release.editor.zoom*100)+"%";all("[data-410-density]").forEach((button)=>button.classList.toggle("on",button.dataset["410Density"]===release.editor.density));const host=query("#boardMain"),board=host?.querySelector(".board");if(!host||!board)return;const zoom=release.editor.zoom,base=Number.parseFloat(board.style.height)||540;board.style.transformOrigin="top left";board.style.transform=`scale(${zoom})`;board.style.width=(100/zoom)+"%";host.style.height=Math.round(base*zoom)+"px";host.style.overflow="auto";}

  function renderCollisions(){const panel=query("#collisionPanel410");if(!panel)return;const document=ctx.documentProvider(),result=analyzeCollisionLayout(document,{scope:release.editor.viewScope,density:release.editor.density});release.editor.lastCollisionCount=result.stats.collisionCount;const warnings=result.warnings.filter((item)=>item.severity!=="INFO");panel.innerHTML='<div><b>LAYOUT CHECK</b><span>'+result.stats.visibleEvents+' visible · '+result.stats.laneCount+' lanes · '+result.stats.collisionCount+' actionable warning'+(result.stats.collisionCount===1?"":"s")+'</span></div>'+(warnings.length?'<ul>'+warnings.slice(0,4).map((item)=>'<li><span class="chip '+(item.severity==="HIGH"?"rd":"em")+'">'+item.severity+'</span>'+esc(item.message)+'</li>').join("")+'</ul>':'<span class="chip gn">NO ACTIONABLE COLLISIONS</span>')+'<button class="btnD alt sm" data-410-action="auto-arrange-410">AUTO ARRANGE</button>';
  }

  function renderReview(){
    ensureReviewTools();const host=query("#candList");if(!host)return;const info=review.summary(),visible=new Set(info.visibleIds),selected=new Set(release.review.selectedCandidateIds);
    all("[data-candidate-card]").forEach((card)=>{const id=card.dataset.candidateCard,show=visible.has(id);card.hidden=!show;card.setAttribute("aria-hidden",String(!show));if(show){card.tabIndex=0;card.setAttribute("role","group");card.setAttribute("aria-label",`Review candidate ${id}`);if(!card.querySelector("[data-410-review-select]")){const head=card.querySelector(".candidateHead");head?.insertAdjacentHTML("afterbegin",`<label class="candidateSelect410"><input type="checkbox" data-410-review-select="${esc(id)}" aria-label="Select candidate for safe bulk review"><span>SELECT</span></label>`);}const checkbox=card.querySelector("[data-410-review-select]");if(checkbox)checkbox.checked=selected.has(id);}});
    const summary=query("#reviewSummary410");if(summary)summary.textContent=`${info.start}-${info.end} OF ${info.filtered} · ${info.selected} SELECTED`;
    const page=query("#reviewPageLabel410");if(page)page.textContent=`PAGE ${info.page} OF ${info.pages}`;
    const prev=query('[data-410-action="review-prev"]'),next=query('[data-410-action="review-next"]');if(prev)prev.disabled=info.page<=1;if(next)next.disabled=info.page>=info.pages;
    const source=query("#reviewSource410");if(source&&source.options.length!==controller.state.sourceDocuments.length+1){const current=release.review.source;source.innerHTML='<option value="ALL">All sources</option>'+controller.state.sourceDocuments.map((item)=>`<option value="${esc(item.id)}">${esc(item.fileName)}</option>`).join("");source.value=current;}
    host.scrollTop=release.review.scrollTop||0;
  }

  function practiceQuestions(){
    return buildPracticeQuestions(ctx.documentProvider().events||[]);
  }

  function renderAdvisorBrief(){
    const host=query("#advisorBrief410");if(!host)return;const document=ctx.documentProvider(),events=document.events||[],visibleCounts=events.reduce((out,event)=>{const key=visibilityName(event.visibilityState||event.visibility);out[key]=(out[key]||0)+1;return out;},{}),unresolved=controller.state.extractionCandidates.filter((item)=>["PENDING","DEFERRED"].includes(item.reviewStatus)).length,conflicts=controller.state.candidateConflicts.filter((item)=>item.status!=="RESOLVED").length,questions=state.interviewPractice.questions?.length?state.interviewPractice.questions:practiceQuestions(),collisions=analyzeCollisionLayout(document,{scope:"ADVISOR_PACKET",density:release.editor.density}),grad=events.find((event)=>/graduat|medical degree/i.test(event.title||"")),exams=events.filter((event)=>event.categoryId==="usmle"),usce=events.filter((event)=>["th","cl"].includes(event.categoryId)),research=events.filter((event)=>event.categoryId==="research"),work=events.filter((event)=>event.categoryId==="work"),personal=events.filter((event)=>event.categoryId==="personal");
    const briefRows=[
      ["PROFILE",`${document.studentProfile?.name||"Student"} · ${document.studentProfile?.specialtyGoal||"Goal not set"} · ${document.studentProfile?.medicalSchoolCountry||"Country not set"}`],
      ["CHRONOLOGY",`${events.length} events · graduation ${grad?.startDate||"not identified"} · ${exams.length} exam items`],
      ["USCE",usce.map((event)=>event.siteName||event.title).filter(Boolean).join(" · ")||"No USCE identified"],
      ["STORY ARC",`${research.length} research · ${work.length} work · ${personal.length} personal context`],
      ["REVIEW RISK",`${unresolved} unresolved candidates · ${conflicts} source conflicts · ${collisions.stats.collisionCount} layout warnings`],
      ["VISIBILITY",Object.entries(visibleCounts).map(([key,count])=>`${displayVisibility(key)} ${count}`).join(" · ")||"No events"],
      ["EXPORT",advisor.exportGate("export")?"Approved for export":"Approval gate pending or stale"],
      ["FILEVAULT",`${state.fileVault.status||"NOT CONNECTED"} · ${state.fileVault.mode||"DISABLED"} · mock only`]
    ];
    host.innerHTML='<div class="briefGrid410">'+briefRows.map(([name,value])=>`<article><b>${name}</b><span>${esc(value)}</span></article>`).join("")+'</div><details class="advisorQuestions410" '+(questions.length?"open":"")+'><summary>PRACTICE QUESTIONS · '+questions.length+'</summary><div class="questionList410">'+questions.slice(0,8).map((item)=>`<button class="question410 ${release.advisor.practiceQuestionIds.includes(item.id)?"marked":""}" data-410-question="${esc(item.id)}" data-event="${esc(item.eventId||"")}" aria-pressed="${release.advisor.practiceQuestionIds.includes(item.id)}"><span>${esc(item.text)}</span><b>${release.advisor.practiceQuestionIds.includes(item.id)?"PRACTICE":"MARK"}</b></button>`).join("")+'</div></details>';
  }

  let exportPreviewToken=0;
  async function renderExportPreview(){const host=query("#exportPreviewCanvas410"),section=query('section[data-view="export"]');if(!host||!section?.classList.contains("live"))return;const token=++exportPreviewToken,scope=query("#exportPreviewScope410")?.value||"INTERVIEWER_SAFE",rendered=await renderTimelineCanvas(ctx.documentProvider(),{scope,width:960,height:540,mediaResolver:(item)=>ctx.media.objectUrl(item.id)});if(token!==exportPreviewToken)return;rendered.canvas.id="exportRendererCanvas410";rendered.canvas.setAttribute("aria-label",`${displayVisibility(scope)} timeline preview with ${rendered.events.length} events`);host.replaceChildren(rendered.canvas);}

  function renderAccessibility(){
    query("#bgfx")?.setAttribute("aria-hidden","true");query(".vg")?.setAttribute("aria-hidden","true");query("header")?.setAttribute("role","banner");query("#rail")?.setAttribute("aria-label","Timeline workspace routes");const main=query("main");if(main)main.id="mainContent";const safe=query("#hudSafe");if(safe){safe.setAttribute("aria-pressed",String(Boolean(api.state.safe)));safe.setAttribute("aria-label","Toggle interviewer-safe timeline view");}const mode=query("#modeSeg");if(mode){mode.setAttribute("role","group");mode.setAttribute("aria-label","Canvas data mode");all("#modeSeg [data-m]").forEach((button)=>button.setAttribute("aria-pressed",String(button.classList.contains("on"))));}const modal=query("#modalBk");if(modal&&!modal.hasAttribute("aria-labelledby"))modal.setAttribute("aria-label","Timeline dialog");all("#rail .rtab").forEach((button)=>{const active=button.dataset.v===api.state.view;button.setAttribute("aria-controls",`view-${button.dataset.v}`);if(active)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");});all("section[data-view]").forEach((section)=>{section.id=`view-${section.dataset.view}`;const heading=section.querySelector(".bigt");if(heading){heading.id=heading.id||`heading-${section.dataset.view}`;heading.setAttribute("role","heading");heading.setAttribute("aria-level","1");heading.tabIndex=-1;section.setAttribute("aria-labelledby",heading.id);}});
    all(".elBtn").forEach((button)=>button.setAttribute("type","button"));all("[data-410-density]").forEach((button)=>button.setAttribute("aria-pressed",String(button.dataset["410Density"]===release.editor.density)));
    all("#evList .evRow").forEach((row)=>{const eventId=row.dataset.ev,selected=eventId===api.state.sel;row.tabIndex=0;row.setAttribute("role","button");row.setAttribute("aria-selected",String(selected));row.setAttribute("aria-label",`${selected?"Selected event":"Select event"} ${row.textContent.trim()}`);});
    all(".board:not(.mini) .arrow,.board:not(.mini) .flag").forEach((item)=>{const eventId=item.dataset.ev,event=api.state.user.events.find((candidate)=>candidate.id===eventId),selected=eventId===api.state.sel;item.tabIndex=0;item.setAttribute("role","button");item.setAttribute("aria-selected",String(selected));item.setAttribute("aria-label",`${selected?"Selected timeline element":"Select timeline element"} ${event?.title||event?.t||eventId||""}. Press Enter to edit.`);});
    all(".board:not(.mini) [data-ck],.board:not(.mini) [data-slot],.board:not(.mini) [data-logo],.board:not(.mini) [data-sticky]").forEach((item)=>{if(item.tabIndex<0)item.tabIndex=0;if(!item.hasAttribute("role"))item.setAttribute("role","button");if(!item.hasAttribute("aria-label"))item.setAttribute("aria-label","Editable timeline canvas item");});
    const inspector=query("#inspector");if(inspector){inspector.tabIndex=-1;inspector.setAttribute("aria-label","Selected timeline element editor");}
    const foot=query(".railFoot");if(foot)foot.innerHTML="MISSION TIMELINE BUILDER<br>KEYNOTE DUPE ENGINE<br>413R · BOUNDED UI PILOT<br>SANDBOX · NO PRODUCTION WRITE";
  }

  function enforceResponsiveReviewOnly(){const narrow=window.matchMedia('(max-width: 860px)').matches;const canvas=query('section[data-view="canvas"]');if(!canvas)return;canvas.dataset.reviewOnly=String(narrow);canvas.classList.toggle("reviewOnly410",narrow);all('section[data-view="canvas"] button,section[data-view="canvas"] input,section[data-view="canvas"] select,section[data-view="canvas"] textarea,section[data-view="canvas"] [contenteditable],section[data-view="canvas"] [role="button"],section[data-view="canvas"] [tabindex]').forEach((control)=>{if(narrow){if(!control.dataset.responsiveState)control.dataset.responsiveState=JSON.stringify({disabled:'disabled' in control?control.disabled:null,tabindex:control.hasAttribute('tabindex')?control.getAttribute('tabindex'):null,contenteditable:control.hasAttribute('contenteditable')?control.getAttribute('contenteditable'):null,ariaDisabled:control.hasAttribute('aria-disabled')?control.getAttribute('aria-disabled'):null});if('disabled' in control)control.disabled=true;control.tabIndex=-1;if(control.hasAttribute('contenteditable'))control.setAttribute('contenteditable','false');control.setAttribute('aria-disabled','true');}else if(control.dataset.responsiveState){const prior=JSON.parse(control.dataset.responsiveState);if('disabled' in control&&prior.disabled!==null)control.disabled=prior.disabled;if(prior.tabindex===null)control.removeAttribute('tabindex');else control.setAttribute('tabindex',prior.tabindex);if(prior.contenteditable===null)control.removeAttribute('contenteditable');else control.setAttribute('contenteditable',prior.contenteditable);if(prior.ariaDisabled===null)control.removeAttribute('aria-disabled');else control.setAttribute('aria-disabled',prior.ariaDisabled);delete control.dataset.responsiveState;}});}

  function render(){ensureFirstUse();ensureCanvasTools();ensureManualOcr();ensureReviewTools();ensureAdvisorBrief();ensureExportPreview();augmentInspector();renderHistory();renderZoom();renderCollisions();renderReview();renderAdvisorBrief();renderAccessibility();enforceResponsiveReviewOnly();renderExportPreview().catch(ui409.reportError);}

  async function saveRelease(reason){release.updatedAt=new Date().toISOString();await persistence.observe();await persistence.saveDraft({reason});}

  document.addEventListener("click",async(event)=>{
    const visibility=event.target.closest("[data-410-visibility]");if(visibility){event.preventDefault();history.setSelectedVisibility(visibility.dataset["410Visibility"]);announce(`Visibility set to ${displayVisibility(visibility.dataset["410Visibility"])}.`);return;}
    const question=event.target.closest("[data-410-question]");if(question){const id=question.dataset["410Question"],set=new Set(release.advisor.practiceQuestionIds);if(set.has(id))set.delete(id);else set.add(id);release.advisor.practiceQuestionIds=[...set];if(question.dataset.event){api.state.sel=question.dataset.event;api.renderAll();}renderAdvisorBrief();return;}
    const button=event.target.closest("[data-410-action]");if(!button)return;const action=button.dataset["410Action"];
    try{
      if(action==="undo"){history.undo();announce("Last editor action undone.");}
      if(action==="redo"){history.redo();announce("Editor action redone.");}
      if(action==="duplicate-event"){history.duplicateSelected();announce("Event duplicated one month later.");}
      if(action==="recover-event"){history.recoverLastDeleted();announce("Last removed event recovered.");}
      if(action==="reset-source"){history.resetSelectedToSource();announce("Selected event reset to its source dates.");}
      if(action==="lane-up"){history.changeLane(-1);announce("Selected event moved up one lane.");}
      if(action==="lane-down"){history.changeLane(1);announce("Selected event moved down one lane.");}
      if(action==="zoom-out"){release.editor.zoom=Math.max(.55,release.editor.zoom-.1);renderZoom();}
      if(action==="zoom-in"){release.editor.zoom=Math.min(1.4,release.editor.zoom+.1);renderZoom();}
      if(action==="zoom-fit"){release.editor.zoom=1;release.editor.density="FIT";api.renderAll();}
      if(action==="toggle-editor-advanced"){const panel=query("#advancedEditor410"),open=panel.hidden;panel.hidden=!open;button.setAttribute("aria-expanded",String(open));button.textContent=open?"HIDE EDIT TOOLS":"MORE EDIT TOOLS";if(open)panel.querySelector("button")?.focus();}
      if(action==="reset-layout"){history.perform("Reset deterministic layout",()=>{api.state.user.events.forEach((item)=>{item.lane=null;item.manualOffset=null;});deterministicAutoArrange(api.state.user.events,{scope:release.editor.viewScope});api.renderAll();});announce("Manual layout adjustments cleared and deterministic placement restored.");}
      if(action==="reset-categories"){history.resetCategories();announce("Category labels and colors reset to the Keynote Classic defaults.");}
      if(action==="auto-arrange-410"){history.perform("Auto arrange timeline",()=>{(api.state.user.events||[]).forEach((item)=>{if(!item.manualOffset?.laneLocked)item.lane=null;});deterministicAutoArrange(api.state.user.events,{scope:release.editor.viewScope});api.renderAll();});announce("Timeline auto arranged with locked manual lanes preserved.");}
      if(action==="edit-title-profile")ui409.openModal('<div class="subt">TIMELINE TITLE + PROFILE</div><label class="f"><span class="fl">TIMELINE TITLE</span><input id="title410" value="'+esc(api.state.timelineTitle||"")+'"></label><label class="f"><span class="fl">STUDENT NAME</span><input id="profileName410" value="'+esc(api.state.profile.name)+'"></label><label class="f"><span class="fl">SPECIALTY GOAL</span><input id="profileGoal410" value="'+esc(api.state.profile.goal)+'"></label><label class="f"><span class="fl">MEDICAL SCHOOL COUNTRY</span><input id="profileCountry410" value="'+esc(api.state.profile.country)+'"></label><label class="f"><span class="fl">VISA OR STATUS</span><input id="profileVisa410" value="'+esc(api.state.profile.visa)+'"></label><div class="modalActions409"><button class="btnD go" data-410-action="save-title-profile">SAVE PROFILE</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
      if(action==="save-title-profile"){history.perform("Edit title and profile",()=>{api.state.timelineTitle=query("#title410").value.trim()||`Timeline: ${query("#profileName410").value.trim()||"Student"}`;api.state.profile.name=query("#profileName410").value.trim()||"Student";api.state.profile.goal=query("#profileGoal410").value.trim();api.state.profile.country=query("#profileCountry410").value.trim();api.state.profile.visa=query("#profileVisa410").value.trim();ui409.closeModal();api.renderAll();});await saveRelease("EDIT_TITLE_PROFILE");}
      if(action==="edit-ribbon"){const interview=api.state.user.interview||{};ui409.openModal('<div class="subt">INTERVIEW RIBBON</div><label class="f"><span class="fl">PROGRAM</span><input id="ribbonProgram410" value="'+esc(interview.prog||"")+'"></label><label class="f"><span class="fl">RIBBON LABEL</span><input id="ribbonLabel410" value="'+esc(interview.label||"")+'"></label><label class="f"><span class="fl">INTERVIEW MONTH</span><input id="ribbonDate410" type="month" value="'+esc(interview.date||"")+'"></label><div class="modalActions409"><button class="btnD go" data-410-action="save-ribbon">SAVE RIBBON</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);}
      if(action==="save-ribbon"){history.perform("Edit interview ribbon",()=>{api.state.user.interview={prog:query("#ribbonProgram410").value.trim(),label:query("#ribbonLabel410").value.trim(),date:query("#ribbonDate410").value};ui409.closeModal();api.renderAll();});await saveRelease("EDIT_RIBBON");}
      if(action==="manual-ocr-toggle"){const fields=query("#manualOcrFields410"),open=fields.hidden;fields.hidden=!open;button.setAttribute("aria-expanded",String(open));button.textContent=open?"CLOSE MANUAL TEXT FALLBACK":"OPEN MANUAL TEXT FALLBACK";if(open)query("#manualOcrText410")?.focus();}
      if(action==="manual-ocr-ingest"){button.disabled=true;button.textContent="BUILDING CANDIDATES";const result=await controller.ingestManualText(query("#manualOcrText410").value,{fileName:query("#manualOcrName410").value,declaredType:query("#manualOcrType410").value});release.ocr.lastManualSourceId=result.document.id;api.go("review");announce(`${result.candidates.length} local OCR-text candidates are quarantined for review.`);}
      if(action==="select-review-page"){review.selectPage();renderReview();}
      if(action==="clear-review-selection"){review.clearSelection();renderReview();}
      if(action==="accept-selected-safe"){const result=review.bulkAcceptSafe();announce(`${result.accepted} safe candidates accepted. ${result.skipped} remained quarantined.`);api.renderAll();}
      if(action==="review-prev"){release.review.page=Math.max(1,release.review.page-1);release.review.scrollTop=0;renderReview();}
      if(action==="review-next"){release.review.page=Math.min(review.summary().pages,release.review.page+1);release.review.scrollTop=0;renderReview();}
      if(action==="advisor-generate-questions"){state.interviewPractice.questions=practiceQuestions();release.advisor.lastBriefOpenedAt=new Date().toISOString();api.renderAll();await saveRelease("REFRESH_PRACTICE_QUESTIONS");announce("Timeline-derived practice questions refreshed.");}
      if(action==="advisor-revoke"){const count=advisor.revokeApprovals("MANUAL_ADVISOR_REVOCATION");api.renderAll();await saveRelease("ADVISOR_REVOKE");announce(count?`${count} approvals revoked.`:"No active approvals to revoke.");}
      if(action==="download-accessible"){const scope=query("#exportPreviewScope410")?.value||"INTERVIEWER_SAFE",result=await exportEngine.generateAccessibleHtml({scope,download:true});await saveRelease("ACCESSIBLE_EXPORT");announce(`Accessible ${displayVisibility(scope)} HTML generated: ${result.filename}`);}
    }catch(error){ui409.reportError(error);}finally{if(action==="manual-ocr-ingest"){button.disabled=false;button.textContent="BUILD REVIEW CANDIDATES";}}
  });

  document.addEventListener("click",(event)=>{const density=event.target.closest("[data-410-density]");if(!density)return;release.editor.density=density.dataset["410Density"];api.renderAll();});
  document.addEventListener("change",(event)=>{const select=event.target.closest("[data-410-review-select]");if(select){review.toggle(select.dataset["410ReviewSelect"],select.checked);renderReview();}const legacyFilter=event.target.closest("[data-408-filter]");if(legacyFilter){release.review[legacyFilter.dataset["408Filter"]]=legacyFilter.value;release.review.page=1;renderLater();}if(event.target.id==="reviewSource410"){release.review.source=event.target.value;release.review.page=1;renderReview();}if(event.target.id==="reviewGroup410"){release.review.group=event.target.value;release.review.page=1;renderReview();}if(event.target.id==="reviewPageSize410"){release.review.pageSize=Number(event.target.value);release.review.page=1;renderReview();}if(event.target.id==="exportPreviewScope410")renderExportPreview().catch(ui409.reportError);});
  document.addEventListener("input",(event)=>{if(event.target.id==="reviewSearch410"){release.review.query=event.target.value;release.review.page=1;renderReview();}});
  query("#candList")?.addEventListener("scroll",()=>{release.review.scrollTop=query("#candList").scrollTop;},{passive:true});

  document.addEventListener("keydown",(event)=>{
    const card=event.target.closest("[data-candidate-card]");if(card&&!card.hidden){const visible=all("[data-candidate-card]:not([hidden])"),index=visible.indexOf(card);if(event.key==="ArrowDown"||event.key==="j"){event.preventDefault();visible[Math.min(visible.length-1,index+1)]?.focus();}if(event.key==="ArrowUp"||event.key==="k"){event.preventDefault();visible[Math.max(0,index-1)]?.focus();}if(event.key===" "){event.preventDefault();review.toggle(card.dataset.candidateCard);renderReview();}if(event.key==="Enter"){event.preventDefault();card.querySelector("button:not([disabled]),select")?.focus();}}
    const row=event.target.closest("#evList .evRow");if(row&&(event.key==="Enter"||event.key===" ")){event.preventDefault();row.click();}
    const boardItem=event.target.closest(".board:not(.mini) .arrow,.board:not(.mini) .flag");if(boardItem&&(event.key==="Enter"||event.key===" ")){event.preventDefault();api.state.sel=boardItem.dataset.ev;api.renderAll();query("#inspector")?.focus({preventScroll:false});announce("Timeline element selected for editing.");}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?history.redo():history.undo();}
  });

  document.addEventListener("pointerdown",(event)=>{if(event.target.closest("#boardMain .arrow,#boardMain .flag"))history.begin(event.target.closest(".ah")?"Resize event":"Move event");},true);
  document.addEventListener("pointerup",()=>setTimeout(()=>history.commit(),0),true);
  document.addEventListener("click",(event)=>{if(["iEarlier","iLater","iShort","iLong","ctlArrange"].includes(event.target.id))history.begin(event.target.id==="ctlArrange"?"Auto arrange":"Adjust event dates");},true);
  document.addEventListener("click",(event)=>{if(["iEarlier","iLater","iShort","iLong","ctlArrange"].includes(event.target.id))setTimeout(()=>history.commit(),0);});
  document.addEventListener("focusin",(event)=>{if(["iT","iS","iE","iL","iN"].includes(event.target.id)||event.target.matches("[data-sticky]"))history.begin("Edit timeline element");});
  document.addEventListener("focusout",(event)=>{if(["iT","iS","iE","iL","iN"].includes(event.target.id)||event.target.matches("[data-sticky]"))setTimeout(()=>history.commit(),0);});

  window.matchMedia('(max-width: 860px)').addEventListener?.('change',()=>api.renderAll());
  window.addEventListener("resize",()=>renderLater(),{passive:true});
  history.subscribe(renderHistory);controller.subscribe(()=>renderLater());render();
  return {render,renderReview,renderAdvisorBrief,renderCollisions,practiceQuestions,announce};
}

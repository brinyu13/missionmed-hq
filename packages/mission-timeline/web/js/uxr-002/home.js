import {HOME_COPY} from "./constants.js";
import {icon} from "./icons.js";
import {simpleBoardPreview} from "./preview.js";
import {escapeHtml,monthIndex,relativeEdited,shortDate} from "./utils.js";
import {openDialog,showToast} from "./overlays.js";

export function timelineRange(events,{now=new Date()}={}){
  const values=(events||[]).flatMap((event)=>[monthIndex(event.startDate),monthIndex(event.endDate||event.startDate)]).filter(Number.isFinite);
  if(!values.length){const year=now.getFullYear();return`${year}–${year}`;}
  return`${Math.floor(Math.min(...values)/12)}–${Math.floor(Math.max(...values)/12)}`;
}

export function pendingSuggestionCount(candidates){
  return(candidates||[]).filter((item)=>!["accepted","rejected"].includes(item.decision)).length;
}

export function renderHome(store){
  const document=store.document,count=document.events.length,pending=pendingSuggestionCount(document.intake?.candidates);
  const advisorApproved=document.advisor?.approvedAt;
  const advisorApprovalText=advisorApproved
    ?document.advisor?.editedSince
      ?`Approved ${shortDate(advisorApproved)} · edited since`
      :`Advisor approved · ${shortDate(advisorApproved)}`
    :"";
  return`<div class="screen home-screen" data-screen="home">
    <div class="home-grid">
      <section class="card home-build" aria-labelledby="home-title">
        <p class="micro-label">Build your timeline</p>
        <h1 id="home-title">${HOME_COPY.heading}</h1>
        <p class="home-subline">${HOME_COPY.subline}</p>
        <div class="home-actions">
          <button type="button" class="button primary" data-home-build>${count?"Continue building":"Start building"}</button>
          ${count?'<button type="button" class="button tertiary" data-start-over>Start over</button>':""}
        </div>
        <p class="journey-strip">${HOME_COPY.strip}</p>
      </section>
      <section class="card home-intake" aria-labelledby="home-intake-title">
        <h2 id="home-intake-title">${HOME_COPY.intakeTitle}</h2>
        <p>${HOME_COPY.intakeBody}</p>
        <button type="button" class="home-dropzone" data-home-intake>
          ${icon("file-up",{size:24})}
          <span><strong>Drop a PDF here, or browse</strong><small>CV · MyERAS PDF · résumé</small></span>
        </button>
        <p class="micro-label assurance">${HOME_COPY.assurance}</p>
      </section>
      <section class="card home-preview" aria-labelledby="home-preview-title">
        <div class="card-title-row">
          <h2 id="home-preview-title">Your timeline</h2>
          <div class="timeline-meta">
            ${advisorApproved?`<span class="status-badge success">${escapeHtml(advisorApprovalText)}</span>`:""}
            ${pending?`<button type="button" class="status-chip" data-review-suggestions>${pending} suggestions to review</button>`:""}
            <span>${count} events · ${timelineRange(document.events)} · edited ${relativeEdited(document.updatedAt)}</span>
          </div>
        </div>
        ${count?`<button type="button" class="preview-button" data-open-canvas aria-label="Open canvas">
          ${simpleBoardPreview(document,{interactive:false,label:"Current interview-safe timeline preview"})}
          <span class="ghost-action" aria-hidden="true">Open canvas</span>
        </button>`:`<div class="empty-preview">
          ${simpleBoardPreview(document,{ghost:true,label:"Example timeline illustration"})}
          <div class="empty-preview-card">
            <h3>This is what you're building.</h3>
            <p>A one-page visual story an interviewer can read at a glance.</p>
            <button type="button" class="button tertiary" data-home-build>Use the guided builder →</button>
          </div>
        </div>`}
      </section>
    </div>
  </div>`;
}

export function installHome(root,store,{openIntake=()=>{},openReviewIntake=null,openConfirm=openDialog,toast=showToast}={}){
  root.querySelectorAll("[data-home-build]").forEach((button)=>button.addEventListener("click",()=>{
    if(!store.document.events.length)store.mutate("Open Builder",(document)=>{document.builder.step=1;},{history:false,material:false});
    store.navigate("builder");
  }));
  const intakeTarget=root.querySelector("[data-home-intake]");
  intakeTarget?.addEventListener("click",()=>openIntake({source:"home-browse"}));
  intakeTarget?.addEventListener("dragover",(event)=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect="copy";intakeTarget.classList.add("drag-active");});
  intakeTarget?.addEventListener("dragleave",(event)=>{if(!intakeTarget.contains(event.relatedTarget))intakeTarget.classList.remove("drag-active");});
  intakeTarget?.addEventListener("drop",(event)=>{
    event.preventDefault();intakeTarget.classList.remove("drag-active");
    const file=[...(event.dataTransfer?.files||[])].find((item)=>{
      const name=String(item.name||"").toLowerCase();
      return item.type==="application/pdf"||
        item.type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"||
        name.endsWith(".pdf")||
        name.endsWith(".docx");
    });
    openIntake({source:"home-drop",file:file||null});
  });
  root.querySelector("[data-open-canvas]")?.addEventListener("click",()=>store.navigate("canvas"));
  root.querySelector("[data-review-suggestions]")?.addEventListener("click",()=>{
    if(typeof openReviewIntake==="function"){openReviewIntake();return;}
    store.mutate("Open Intake review",(document)=>{document.intake.stage="review";},{history:false,material:false});
    store.navigate("intake");
  });
  root.querySelector("[data-start-over]")?.addEventListener("click",(event)=>openConfirm({
    title:"Start a new timeline?",
    body:"Your current draft stays in History as a version. You can restore it anytime.",
    primaryLabel:"Save & start new",
    secondaryLabel:"Cancel",
    opener:event.currentTarget,
    onPrimary:async()=>{
      await store.startNewTimeline();
      store.navigate("builder");
      toast("New timeline ready");
    }
  }));
}

import {sha256Hex} from "../core/canonical.js";
import {AdvisorReviewManager} from "../advisor/advisor-manager.js";
import {FILEVAULT_MODES} from "../filevault/capabilities.js";

const EXPORT_LABELS={
  INTERVIEWER_SAFE_PNG:["INTERVIEWER-SAFE PNG","Approved public timeline image"],
  FULL_STORY_PNG:["FULL-STORY PNG","Student and advisor timeline image"],
  PRINT_PDF:["PRINT-READY PDF","Single-page interviewer-safe PDF"],
  ADVISOR_PACKET_PDF:["ADVISOR PACKET PDF","Timeline plus advisor review page"],
  SOURCE_JSON:["TIMELINE JSON","Sanitized portable TimelineDocument"],
  ACCESSIBLE_HTML:["ACCESSIBLE HTML","Semantic, searchable timeline companion"],
  ARCHIVE:["STUDENT ARCHIVE","Timeline, media, exports, and manifests"]
};

function esc(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function displayTime(value){if(!value)return"NEVER";try{return new Date(value).toLocaleString();}catch{return String(value);}}
function bytes(value){const size=Number(value)||0;if(size<1024)return size+" B";if(size<1048576)return(size/1024).toFixed(1)+" KB";return(size/1048576).toFixed(1)+" MB";}

export function install409Ui(ctx){
  const {api,state,persistence,media,advisor,exportEngine,bridge}=ctx;
  const ui={busy:null,error:null,returnFocus:null,versionRender:0,exportWidth:1920,currentRole:"ADVISOR",deletionComplete:false};
  const query=(selector)=>document.querySelector(selector);
  const toast=(message,tone="cy")=>{const host=query("#toast");if(!host)return;host.textContent=message;host.dataset.tone=tone;host.classList.add("on");clearTimeout(ui.toastTimer);ui.toastTimer=setTimeout(()=>host.classList.remove("on"),3200);};
  const reportError=(error)=>{ui.error=String(error?.message||error);toast(ui.error,"rd");renderStatus();};
  const closeModal=()=>{const backdrop=query("#modalBk");if(!backdrop)return;backdrop.classList.remove("on");backdrop.setAttribute("aria-hidden","true");delete backdrop.dataset.modalOwner;const target=ui.returnFocus;ui.returnFocus=null;if(target?.isConnected)target.focus();};
  const openModal=(html,opener=document.activeElement)=>{ui.returnFocus=opener;const backdrop=query("#modalBk"),host=query("#modalIn");host.innerHTML=html;backdrop.dataset.modalOwner="409";backdrop.classList.add("on");backdrop.setAttribute("aria-hidden","false");requestAnimationFrame(()=>host.querySelector("button,input,select,textarea,[tabindex]")?.focus());};
  const run=async(label,operation)=>{if(ui.busy)return;ui.busy=label;ui.error=null;renderStatus();try{return await operation();}catch(error){reportError(error);return null;}finally{ui.busy=null;renderStatus();}};

  function renderStatus(){
    const save=query("#hudSave"),p=state.persistence||{};
    if(save){
      const failed=p.lastSaveError||ui.error;
      save.textContent=failed?"SAVE FAILED":ui.busy?"WORKING":p.dirty?"UNSAVED EDITS":"SAVED · "+(p.lastSavedAt?new Date(p.lastSavedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"LOCAL");
      save.className="chip "+(failed?"rd":p.dirty||ui.busy?"em":"gn");
      save.title=failed||("IndexedDB autosave. Last saved "+displayTime(p.lastSavedAt));
    }
    const vault=query("#hudVault409");
    if(vault){vault.textContent="FILEVAULT · "+(state.fileVault.status||"DISABLED");vault.className="chip "+(state.fileVault.status==="SYNCED"?"gn":state.fileVault.status==="PARTIAL_FAILURE"?"rd":"cy");}
    const region=query("#statusLive409");if(region)region.textContent=ui.error?ui.error:(ui.busy?ui.busy:"Local draft ready");
  }

  function mediaCard(item,placement,type,label,defaultVisibility){
    const preview=item?.thumbnail?'<img src="'+esc(item.thumbnail)+'" alt="'+esc(item.altText||label)+'">':'<span class="mediaEmpty409">CHOOSE LOCAL IMAGE</span>';
    const meta=item?'<small>'+esc(item.sourceFilename)+' · '+item.width+'x'+item.height+' · '+bytes(item.size)+'</small>':'<small>JPEG, PNG, OR WEBP · MAX 5 MB</small>';
    return '<article class="mediaCard409" data-placement="'+placement+'"><div class="mediaThumb409">'+preview+'</div><div><b>'+label+'</b>'+meta+'<div class="mediaActions409"><button class="btnD go sm" data-409-action="media-select" data-placement="'+placement+'" data-type="'+type+'" data-visibility="'+defaultVisibility+'">'+(item?"REPLACE":"CHOOSE")+'</button>'+(item?'<button class="btnD alt sm" data-409-action="media-edit" data-id="'+item.id+'">EDIT</button><button class="btnD alt sm" data-409-action="media-remove" data-id="'+item.id+'">REMOVE</button>':'')+'</div></div></article>';
  }

  function renderMedia(){
    const seg=query("#photoSeg");
    if(seg){seg.innerHTML=[3,4,5].map((count)=>'<button data-409-photo-count="'+count+'" class="'+(state.mediaLayout.photoCount===count?"on":"")+'" aria-pressed="'+(state.mediaLayout.photoCount===count)+'">'+count+' PHOTOS</button>').join("");}
    const slots=query("#mediaSlots");
    if(slots){let html="";for(let index=0;index<state.mediaLayout.photoCount;index++){const placement="photo"+index;html+=mediaCard(media.list().find((item)=>item.placement===placement),placement,"photo","PHOTO "+(index+1),"FULL_STORY");}slots.innerHTML=html;}
    const logo=query("#mLogo"),logoItem=media.list().find((item)=>item.type==="logo"||item.type==="programLogo");
    if(logo){logo.onclick=null;logo.removeAttribute("style");logo.innerHTML=mediaCard(logoItem,"ribbon","logo","PROGRAM LOGO","INTERVIEWER_SAFE");}
    const avatar=query("#mAvatar"),avatarItem=media.list().find((item)=>item.type==="profilePhoto");
    if(avatar){avatar.onclick=null;avatar.removeAttribute("style");avatar.innerHTML=mediaCard(avatarItem,"profile","profilePhoto","PROFILE PHOTO","ADVISOR_ONLY");}
    const personal=query("#personalMedia409");if(personal)personal.innerHTML=mediaCard(media.list().find((item)=>item.type==="personalImage"),"personal0","personalImage","OPTIONAL PERSONAL IMAGE","FULL_STORY");
    renderBoardMedia();
  }

  function renderBoardMedia(){
    document.querySelectorAll(".mediaPreview409").forEach((node)=>node.remove());
    media.list().forEach((item)=>{
      if(!item.thumbnail)return;
      let selector='[data-slot="'+item.placement+'"]';
      if(item.placement==="profile")selector='[data-slot="avatar"]';
      document.querySelectorAll(selector).forEach((slot)=>{
        const target=item.placement==="ribbon"?slot.querySelector(".logoSlot")||slot:slot;
        const image=document.createElement("img");image.className="mediaPreview409";image.src=item.thumbnail;image.alt=item.altText||item.sourceFilename||"Timeline media";image.style.objectPosition=(item.crop?.x??50)+"% "+(item.crop?.y??50)+"%";image.style.transform="scale("+(item.crop?.zoom||1)+") rotate("+(item.crop?.rotation||0)+"deg)";target.appendChild(image);
      });
    });
  }

  function approvalMissing(key){
    const scopes={INTERVIEWER_SAFE_PNG:["interviewerSafe","export"],PRINT_PDF:["interviewerSafe","export"],FULL_STORY_PNG:["fullStory"],ACCESSIBLE_HTML:["interviewerSafe","export"]}[key]||[];
    return scopes.filter((scope)=>!advisor.exportGate(scope));
  }

  function renderAdvisor(){
    const review=advisor.state,checks=query("#advChecks");
    if(checks)checks.innerHTML=review.checklist.map((item)=>'<div class="chkRow"><button class="tglD '+(item.complete?"on":"")+'" data-409-action="advisor-check" data-id="'+item.id+'" aria-pressed="'+item.complete+'" aria-label="'+esc(item.label)+'"><i></i></button><span>'+esc(item.label)+'</span><span class="cst">'+(item.complete?"DONE":"OPEN")+'</span></div>').join("");
    const approve=query("#advApprove");if(approve){approve.onclick=null;approve.dataset["409Action"]="advisor-approval-menu";approve.disabled=!advisor.canApprove()||ui.currentRole!=="ADVISOR";approve.textContent="APPROVAL OPTIONS ▸";}
    const changes=query("#advChanges");if(changes){changes.onclick=null;changes.dataset["409Action"]="advisor-request-menu";changes.disabled=ui.currentRole!=="ADVISOR";}
    const comments=query("#advComments");
    if(comments)comments.innerHTML=review.comments.length?review.comments.map((item)=>'<article class="advisorRecord409 '+(item.resolved?"resolved":"")+'"><div><b>'+esc(item.authorRole)+' · '+(item.timelineEventId?"PINNED":"GENERAL")+'</b><small>'+displayTime(item.createdAt)+' · '+esc(item.visibility)+'</small></div><p>'+esc(item.body)+'</p><div class="mediaActions409">'+(!item.resolved&&ui.currentRole==="ADVISOR"?'<button class="btnD alt sm" data-409-action="advisor-resolve-comment" data-id="'+item.id+'">RESOLVE</button>':'')+(!item.studentAcknowledged&&ui.currentRole==="STUDENT"?'<button class="btnD alt sm" data-409-action="advisor-ack-comment" data-id="'+item.id+'">ACKNOWLEDGE</button>':'')+'</div></article>').join(""):'<div class="empty409">No persisted advisor comments yet.</div>';
    const panel=query("#advisorWorkflow409");
    if(panel){
      const approvals=Object.keys(review.approvals).map((scope)=>{const value=review.approvals[scope];return '<span class="chip '+(value?.state==="APPROVED"?"gd":value?.state==="REVOKED"?"rd":"")+'">'+scope.toUpperCase()+' · '+(value?.state||"PENDING")+'</span>';}).join("");
      const requests=review.changeRequests.map((item)=>'<article class="advisorRecord409 '+(item.state==="RESOLVED"?"resolved":"")+'"><b>CHANGE REQUEST · '+esc(item.state)+'</b><p>'+esc(item.body)+'</p><small>'+displayTime(item.createdAt)+'</small><div class="mediaActions409">'+(item.state==="OPEN"&&ui.currentRole==="ADVISOR"?'<button class="btnD alt sm" data-409-action="advisor-resolve-request" data-id="'+item.id+'">RESOLVE</button>':'')+(item.state==="OPEN"&&!item.studentAcknowledged&&ui.currentRole==="STUDENT"?'<button class="btnD alt sm" data-409-action="advisor-ack-request" data-id="'+item.id+'">ACKNOWLEDGE</button>':'')+'</div></article>').join("");
      panel.innerHTML='<div class="advisorTop409"><label>ROLE SIMULATION<select id="role409"><option '+(ui.currentRole==="ADVISOR"?"selected":"")+'>ADVISOR</option><option '+(ui.currentRole==="STUDENT"?"selected":"")+'>STUDENT</option></select></label><div><span class="chip '+(review.status.includes("APPROVED")?"gd":review.status.includes("CHANGE")||review.status.includes("REREVIEW")?"rd":"em")+'">'+esc(review.status)+'</span></div></div><div class="approvalStrip409">'+approvals+'</div><label class="f"><span class="fl">NEW COMMENT</span><textarea id="advisorComment409" placeholder="Add a general or selected-event comment"></textarea></label><button class="btnD gd sm" data-409-action="advisor-add-comment" '+(ui.currentRole!=="ADVISOR"?"disabled":"")+'>ADD COACH COMMENT</button><div class="subt blockTitle409">CHANGE REQUESTS</div>'+(requests||'<div class="empty409">No open change requests.</div>');
    }
    const gate=query("#hudGate");if(gate){gate.textContent="ADVISOR GATE · "+review.status;gate.className="chip "+(review.status.includes("APPROVED")?"gd":review.status.includes("CHANGE")||review.status.includes("REREVIEW")?"rd":"em");}
  }

  function renderExport(){
    const host=query("#exGrid");if(!host)return;
    host.innerHTML=Object.entries(EXPORT_LABELS).map(([key,value],index)=>{
      const missing=approvalMissing(key),blocked=missing.length>0;
      return '<article class="exCard exportCard409"><div class="exT">'+value[0]+'</div><div class="exS">'+value[1]+'<br>LOCAL GENERATION · NO NETWORK</div><div class="exportMeta409">'+(blocked?'<span class="chip em">NEEDS '+missing.join(" + ").toUpperCase()+'</span>':'<span class="chip gn">READY</span>')+'</div><button class="btnD '+(blocked?"alt":"go")+' sm" data-409-action="export" data-key="'+key+'" data-ex="'+index+'">'+(blocked?"REVIEW GATE":"GENERATE FILE")+' ▸</button></article>';
    }).join("");
    const records=query("#exportRecords409");
    if(records)records.innerHTML=state.exportRecords.length?state.exportRecords.slice().reverse().slice(0,12).map((record)=>'<div class="recordRow409"><span><b>'+esc(record.filename)+'</b><small>'+displayTime(record.createdAt)+' · '+bytes(record.byteSize)+' · '+esc(record.scope)+'</small></span><button class="btnD alt sm" data-409-action="artifact-manifest" data-artifact="'+record.artifactId+'">MANIFEST</button></div>').join(""):'<div class="empty409">No local exports generated yet.</div>';
  }

  function renderVault(){
    const host=query("#fileVault409");if(!host)return;
    const artifacts=state.timelineArtifacts||[],latest=artifacts[artifacts.length-1],links=state.fileVault.links||[];
    host.innerHTML='<div class="vaultHead409"><div><div class="subt">MOCK FILEVAULT CONNECTION</div><b>NO PRODUCTION WRITE</b></div><span class="chip '+(state.fileVault.status==="SYNCED"?"gn":state.fileVault.status==="PARTIAL_FAILURE"?"rd":"cy")+'">'+esc(state.fileVault.status||"NOT_CONNECTED")+'</span></div><div class="vaultControls409"><label>BRIDGE MODE<select id="vaultMode409">'+Object.values(FILEVAULT_MODES).map((mode)=>'<option '+(mode===state.fileVault.mode?"selected":"")+'>'+mode+'</option>').join("")+'</select></label><label>ARTIFACT<select id="vaultArtifact409">'+artifacts.slice().reverse().map((artifact)=>'<option value="'+artifact.artifactId+'">'+esc(artifact.displayName)+' · '+esc(artifact.exportScope)+'</option>').join("")+'</select></label><button class="btnD go sm" data-409-action="vault-save" '+(!latest||state.fileVault.mode==="DISABLED"?"disabled":"")+'>SAVE MOCK COPY</button><button class="btnD alt sm" data-409-action="vault-reconcile" '+(!latest?"disabled":"")+'>RECONCILE</button><button class="btnD alt sm" data-409-action="vault-partial-test" '+(!latest?"disabled":"")+'>SIMULATE PARTIAL FAILURE</button></div><div class="helper">All adapters are in-memory mocks. Legacy production endpoints and proposed v2 routes are never called.</div><div class="vaultLinks409">'+(links.length?links.map((link)=>'<div class="recordRow409"><span><b>'+esc(link.status)+' · '+esc(link.logicalKey||link.artifactId)+'</b><small>LEGACY '+esc(link.legacyReference||"NONE")+' · V2 '+esc(link.v2Reference||"NONE")+'</small></span></div>').join(""):'<div class="empty409">No mock FileVault linkage.</div>')+'</div>';
  }

  async function refreshVersions(){
    const token=++ui.versionRender;
    const [versions,drafts]=await Promise.all([persistence.listVersions(),persistence.listDrafts()]);
    if(token!==ui.versionRender)return;
    const versionHost=query("#versionList409"),draftHost=query("#draftList409");
    if(versionHost)versionHost.innerHTML=versions.length?versions.map((version)=>'<div class="recordRow409"><span><b>'+esc(version.label)+'</b><small>'+displayTime(version.createdAt)+' · '+version.eventCount+' EVENTS · '+version.mediaCount+' MEDIA</small></span><div><button class="btnD alt sm" data-409-action="version-compare" data-id="'+version.id+'">COMPARE</button><button class="btnD go sm" data-409-action="version-restore" data-id="'+version.id+'">RESTORE</button></div></div>').join(""):'<div class="empty409">No named versions yet.</div>';
    if(draftHost)draftHost.innerHTML=drafts.map((draft)=>'<div class="recordRow409 '+(draft.id===state.persistence.activeDocumentId?"active":"")+'"><span><b>'+esc(draft.title)+'</b><small>'+displayTime(draft.savedAt)+' · '+draft.eventCount+' EVENTS · '+(draft.archived?"ARCHIVED":"ACTIVE")+'</small></span>'+(draft.id!==state.persistence.activeDocumentId?'<button class="btnD alt sm" data-409-action="draft-switch" data-id="'+draft.id+'">OPEN</button>':'<span class="chip gn">CURRENT</span>')+'</div>').join("");
  }

  function renderVersions(){
    const p=state.persistence,meta=query("#draftMeta409"),recovery=query("#recovery409"),migration=query("#migration409");
    if(meta)meta.innerHTML='<span class="chip cy">'+esc(p.adapter||ctx.adapter.kind)+'</span><span class="chip '+(p.dirty?"em":"gn")+'">'+(p.dirty?"DIRTY":"SAVED")+'</span><span class="chip">'+esc(p.draftName||"Mission Timeline Draft")+'</span><span class="chip">'+(p.archived?"ARCHIVED":"ACTIVE")+'</span>';
    if(recovery)recovery.innerHTML='<div class="recordRow409"><span><b>RECOVERY CHECKPOINT</b><small>'+displayTime(state.recovery.lastCheckpointAt)+' · '+(state.recovery.available?"AVAILABLE":"NOT YET CREATED")+'</small></span><button class="btnD alt sm" data-409-action="recover-latest" '+(!state.recovery.available?"disabled":"")+'>RECOVER</button></div>';
    if(migration){const last=state.migrationMetadata.history?.slice(-1)[0];migration.innerHTML=last?'<div class="recordRow409"><span><b>'+esc(last.status)+' · '+esc(last.sourceSchema)+' TO '+esc(last.targetSchema)+'</b><small>'+esc((last.warnings||[]).join(" | ")||"No migration warnings")+'</small></span></div>':'<div class="empty409">No imported migration report.</div>';}
    refreshVersions().catch(reportError);
  }

  function render(){
    renderStatus();renderMedia();renderAdvisor();renderExport();renderVault();renderVersions();
    document.querySelectorAll("#rail .rtab").forEach((button)=>button.setAttribute("aria-current",button.classList.contains("on")?"page":"false"));
    [["ctlSaveD","save-draft"],["wizSave","save-draft"],["ctlSaveV","save-version-menu"]].forEach(([id,action])=>{const button=query("#"+id);if(button){button.onclick=null;button.dataset["409Action"]=action;}});
  }

  function mediaEditModal(item,opener){
    openModal('<div class="subt" id="modalTitle409">MEDIA EDITOR · LOCAL ONLY</div><div class="mediaEdit409"><img src="'+esc(item.thumbnail||"")+'" alt="'+esc(item.altText||item.sourceFilename)+'"><label>X POSITION<input id="cropX409" type="range" min="0" max="100" value="'+item.crop.x+'"></label><label>Y POSITION<input id="cropY409" type="range" min="0" max="100" value="'+item.crop.y+'"></label><label>ZOOM<input id="cropZoom409" type="range" min="1" max="3" step="0.05" value="'+item.crop.zoom+'"></label><label>ROTATION<input id="cropRotation409" type="range" min="-15" max="15" step="1" value="'+item.crop.rotation+'"></label><label>ALT TEXT<input id="mediaAlt409" type="text" value="'+esc(item.altText||"")+'"></label><label>VISIBILITY<select id="mediaVisibility409">'+["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"].map((value)=>'<option '+(value===item.visibility?"selected":"")+'>'+value+'</option>').join("")+'</select></label></div><div class="modalActions409"><button class="btnD go" data-409-action="media-save-edit" data-id="'+item.id+'">SAVE MEDIA</button><button class="btnD alt" data-409-close>CANCEL</button></div>',opener);
  }

  async function performExport(key){
    const options={width:ui.exportWidth,download:true};
    let result;if(key==="INTERVIEWER_SAFE_PNG"||key==="FULL_STORY_PNG")result=await exportEngine.generatePng(key,options);
    else if(key==="PRINT_PDF"||key==="ADVISOR_PACKET_PDF")result=await exportEngine.generatePdf(key,options);
    else if(key==="SOURCE_JSON")result=await exportEngine.generateJson({download:true});
    else if(key==="ACCESSIBLE_HTML")result=await exportEngine.generateAccessibleHtml({scope:"INTERVIEWER_SAFE",download:true});
    else if(key==="ARCHIVE")result=await exportEngine.generateArchive({download:true});
    await persistence.observe();await persistence.saveDraft({reason:"EXPORT_RECORD"});api.renderAll();toast("Generated locally · "+result.filename,"gn");return result;
  }

  document.addEventListener("click",(event)=>{
    const close=event.target.closest("[data-409-close]");if(close){event.preventDefault();closeModal();return;}
    if(event.target.id==="modalBk"){if(!ui.deletionComplete)closeModal();return;}
    const button=event.target.closest("[data-409-action]");if(!button)return;
    const action=button.dataset["409Action"];
    if(action==="save-draft")run("SAVING DRAFT",async()=>{await persistence.saveDraft({reason:"EXPLICIT_SAVE"});api.state.saved=true;toast("Draft saved to IndexedDB","gn");});
    if(action==="save-version-menu")openModal('<div class="subt">SAVE NAMED VERSION</div><label class="f"><span class="fl">VERSION NAME</span><input id="versionName409" type="text" value="Review checkpoint"></label><div class="modalActions409"><button class="btnD go" data-409-action="save-version-confirm">SAVE VERSION</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="save-version-confirm")run("SAVING VERSION",async()=>{const version=await persistence.saveVersion(query("#versionName409")?.value);state.persistence.lastVersionId=version.id;api.state.draft++;closeModal();api.renderAll();toast("Named version saved","gn");});
    if(action==="version-restore")openModal('<div class="subt">RESTORE NAMED VERSION</div><p class="modalCopy409">The current draft will be checkpointed, then replaced with this version.</p><div class="modalActions409"><button class="btnD go" data-409-action="version-restore-confirm" data-id="'+button.dataset.id+'">RESTORE</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="version-restore-confirm")run("RESTORING VERSION",async()=>{await persistence.restoreVersion(button.dataset.id);closeModal();api.renderAll();toast("Version restored and checkpointed","gn");});
    if(action==="version-compare")run("COMPARING VERSION",async()=>{const diff=await persistence.compareVersion(button.dataset.id);openModal('<div class="subt">VERSION COMPARISON</div><pre class="json409">'+esc(JSON.stringify(diff,null,2))+'</pre><button class="btnD alt" data-409-close>CLOSE</button>',button);});
    if(action==="draft-switch")run("OPENING DRAFT",async()=>{await persistence.switchDraft(button.dataset.id);api.renderAll();toast("Draft opened","gn");});
    if(action==="draft-duplicate")openModal('<div class="subt">DUPLICATE DRAFT</div><label class="f"><span class="fl">COPY NAME</span><input id="draftName409" type="text" value="Copy of '+esc(state.persistence.draftName||"Mission Timeline")+'"></label><div class="modalActions409"><button class="btnD go" data-409-action="draft-duplicate-confirm">CREATE COPY</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="draft-duplicate-confirm")run("DUPLICATING DRAFT",async()=>{await persistence.duplicateDraft(query("#draftName409")?.value);closeModal();renderVersions();toast("Draft copy created","gn");});
    if(action==="draft-rename")openModal('<div class="subt">RENAME DRAFT</div><label class="f"><span class="fl">DRAFT NAME</span><input id="rename409" type="text" value="'+esc(state.persistence.draftName||"Mission Timeline Draft")+'"></label><div class="modalActions409"><button class="btnD go" data-409-action="draft-rename-confirm">RENAME</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="draft-rename-confirm")run("RENAMING DRAFT",async()=>{await persistence.renameDraft(query("#rename409")?.value);closeModal();api.renderAll();toast("Draft renamed","gn");});
    if(action==="draft-archive")run("UPDATING DRAFT",async()=>{await persistence.archiveDraft(!state.persistence.archived);api.renderAll();toast(state.persistence.archived?"Draft archived":"Draft restored","gn");});
    if(action==="recover-latest")run("CHECKING RECOVERY",async()=>{const result=await persistence.recoverLatest();if(result.recovered){api.renderAll();toast("Recovery checkpoint restored","gn");}else toast("Current saved state is newer than the recovery checkpoint");});
    if(action==="import-select")query("#timelineImport409")?.click();
    if(action==="archive-before-delete")run("BUILDING ARCHIVE",()=>exportEngine.generateArchive({download:true}));
    if(action==="purge-page-text")openModal('<div class="subt">PURGE EXTRACTED PAGE TEXT</div><p class="modalCopy409">Accepted timeline facts remain. Source links are retained. Full extracted page text and section blocks are removed.</p><div class="modalActions409"><button class="btnD go" data-409-action="purge-page-text-confirm">PURGE TEXT</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="purge-page-text-confirm")run("PURGING PAGE TEXT",async()=>{const result=await persistence.purgeExtractedPageText();closeModal();api.renderAll();toast("Purged "+result.pageCount+" page records","gn");});
    if(action==="erase-media")openModal('<div class="subt">ERASE ALL LOCAL MEDIA</div><p class="modalCopy409">Image blobs, thumbnails, and placements will be removed from this draft.</p><div class="modalActions409"><button class="btnD go" data-409-action="erase-media-confirm">ERASE MEDIA</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="erase-media-confirm")run("ERASING MEDIA",async()=>{await media.eraseAll();closeModal();api.renderAll();await persistence.saveDraft({reason:"ERASE_MEDIA"});toast("Local media erased","gn");});
    if(action==="erase-exports")openModal('<div class="subt">ERASE LOCAL EXPORTS</div><p class="modalCopy409">Generated files and TimelineArtifact records will be removed from local storage.</p><div class="modalActions409"><button class="btnD go" data-409-action="erase-exports-confirm">ERASE EXPORTS</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="erase-exports-confirm")run("ERASING EXPORTS",async()=>{await exportEngine.eraseExports();closeModal();api.renderAll();await persistence.saveDraft({reason:"ERASE_EXPORTS"});toast("Local exports erased","gn");});
    if(action==="erase-draft")run("BUILDING DELETION PREVIEW",async()=>{const preview=await persistence.previewDeleteDraft(state.persistence.activeDocumentId),rows=Object.entries(preview.willDelete).filter(([,count])=>count>0).map(([label,count])=>'<li>'+esc(label.replace(/([A-Z])/g," $1").toUpperCase())+' · '+count+'</li>').join("")||'<li>No stored records found.</li>',kept=preview.willNotDelete.map((item)=>'<li>'+esc(item)+'</li>').join("");openModal('<div class="subt">ERASE ENTIRE LOCAL DRAFT</div><p class="modalCopy409">This is browser-local deletion only. Review both columns, then type <b>DELETE LOCAL DRAFT</b> to continue.</p><div class="deletePreview409"><article><b>WILL DELETE</b><ul>'+rows+'</ul></article><article><b>WILL NOT DELETE</b><ul>'+kept+'</ul></article></div><label class="f"><span class="fl">CONFIRMATION PHRASE</span><input id="deleteDraftPhrase409" type="text" autocomplete="off" placeholder="DELETE LOCAL DRAFT"></label><div class="modalActions409"><button class="btnD danger409" data-409-action="erase-draft-confirm" disabled>ERASE LOCAL DRAFT</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);});
    if(action==="erase-draft-confirm")run("ERASING LOCAL DRAFT",async()=>{if(query("#deleteDraftPhrase409")?.value!=="DELETE LOCAL DRAFT")throw new Error("Type DELETE LOCAL DRAFT exactly.");const result=await persistence.deleteDraft(state.persistence.activeDocumentId,{confirmed:true});ui.deletionComplete=true;openModal('<div class="subt">LOCAL DRAFT ERASED</div><p class="modalCopy409">The selected IndexedDB draft and its unshared local records were deleted. External source files, downloaded files, other drafts, and all production systems were untouched.</p><pre class="json409">'+esc(JSON.stringify(result.willDelete,null,2))+'</pre><div class="modalActions409"><button class="btnD go" data-409-action="reload-after-delete">START FRESH</button></div>');});
    if(action==="reload-after-delete")location.reload();
    if(action==="media-select"){const input=query("#mediaFile409");input.dataset.placement=button.dataset.placement;input.dataset.type=button.dataset.type;input.dataset.visibility=button.dataset.visibility;input.value="";input.click();}
    if(action==="media-remove")run("REMOVING MEDIA",async()=>{await media.remove(button.dataset.id);api.renderAll();await persistence.saveDraft({reason:"MEDIA_REMOVE"});toast("Media removed","gn");});
    if(action==="media-edit"){const item=media.get(button.dataset.id);if(item)mediaEditModal(item,button);}
    if(action==="media-save-edit")run("SAVING MEDIA",async()=>{media.update(button.dataset.id,{crop:{x:query("#cropX409").value,y:query("#cropY409").value,zoom:query("#cropZoom409").value,rotation:query("#cropRotation409").value},altText:query("#mediaAlt409").value,visibility:query("#mediaVisibility409").value});closeModal();api.renderAll();await persistence.saveDraft({reason:"MEDIA_EDIT"});toast("Media placement saved","gn");});
    if(action==="advisor-check"){advisor.setChecklist(button.dataset.id,button.getAttribute("aria-pressed")!=="true",ui.currentRole);api.renderAll();}
    if(action==="advisor-add-comment"){const value=query("#advisorComment409")?.value;if(value){advisor.addComment({body:value,timelineEventId:api.state.sel||null,authorRole:ui.currentRole});api.renderAll();toast("Coach comment persisted","gn");}}
    if(action==="advisor-resolve-comment"){advisor.resolveComment(button.dataset.id,ui.currentRole);api.renderAll();}
    if(action==="advisor-ack-comment"){advisor.acknowledgeComment(button.dataset.id);api.renderAll();}
    if(action==="advisor-request-menu")openModal('<div class="subt">REQUEST CHANGES</div><label class="f"><span class="fl">REQUEST</span><textarea id="changeRequest409">Please revise the selected timeline detail.</textarea></label><div class="modalActions409"><button class="btnD gd" data-409-action="advisor-request-confirm">SAVE REQUEST</button><button class="btnD alt" data-409-close>CANCEL</button></div>',button);
    if(action==="advisor-request-confirm"){advisor.requestChanges({body:query("#changeRequest409").value,timelineEventId:api.state.sel||null,authorRole:ui.currentRole});closeModal();api.renderAll();toast("Changes requested","rd");}
    if(action==="advisor-resolve-request"){advisor.resolveChangeRequest(button.dataset.id,ui.currentRole);api.renderAll();}
    if(action==="advisor-ack-request"){advisor.acknowledgeChangeRequest(button.dataset.id);api.renderAll();}
    if(action==="advisor-approval-menu"){const disabled=!advisor.canApprove();openModal('<div class="subt">ADVISOR APPROVAL GATES</div><p class="modalCopy409">Each approval binds to the current material timeline fingerprint. Material edits revoke it.</p><div class="modalActions409"><button class="btnD gd" data-409-action="advisor-approve" data-scope="personalContext" '+(disabled?"disabled":"")+'>PERSONAL CONTEXT</button><button class="btnD gd" data-409-action="advisor-approve" data-scope="interviewerSafe" '+(disabled?"disabled":"")+'>INTERVIEWER-SAFE</button><button class="btnD gd" data-409-action="advisor-approve" data-scope="fullStory" '+(disabled?"disabled":"")+'>FULL STORY</button><button class="btnD gd" data-409-action="advisor-approve" data-scope="export" '+(disabled?"disabled":"")+'>EXPORT GATE</button><button class="btnD alt" data-409-close>CLOSE</button></div>',button);}
    if(action==="advisor-approve")run("RECORDING APPROVAL",async()=>{const fingerprint=await sha256Hex(AdvisorReviewManager.fingerprintInput(ctx.documentProvider()));advisor.approve(button.dataset.scope,fingerprint,ui.currentRole);closeModal();api.renderAll();await persistence.saveDraft({reason:"ADVISOR_APPROVAL"});toast("Approval recorded for "+button.dataset.scope,"gn");});
    if(action==="export"){const key=button.dataset.key,missing=approvalMissing(key);openModal('<div class="subt">LOCAL EXPORT</div><div style="font-weight:800;font-size:18px;margin:10px 0">'+esc(EXPORT_LABELS[key][0])+'</div><p class="modalCopy409">'+esc(EXPORT_LABELS[key][1])+'<br>Resolution '+ui.exportWidth+'x'+Math.round(ui.exportWidth*9/16)+'<br>'+(missing.length?"Required approval: "+missing.join(", "):"Visibility and approval checks passed.")+'</p><div class="modalActions409"><button class="btnD '+(missing.length?"alt":"go")+'" id="mGo" data-409-action="export-confirm" data-key="'+key+'" '+(missing.length?"disabled":"")+'>GENERATE FILE</button><button class="btnD alt" id="mNo2" data-409-close>BACK</button></div>',button);}
    if(action==="export-confirm"){const key=button.dataset.key;closeModal();run("GENERATING "+key,()=>performExport(key));}
    if(action==="artifact-manifest")run("BUILDING MANIFEST",()=>exportEngine.generateArtifactManifest(button.dataset.artifact,{download:true}));
    if(action==="vault-save")run("MOCK FILEVAULT SAVE",async()=>{const id=query("#vaultArtifact409")?.value,artifact=state.timelineArtifacts.find((item)=>item.artifactId===id)||state.timelineArtifacts.at(-1),result=await bridge.saveArtifact(artifact);api.renderAll();await persistence.saveDraft({reason:"MOCK_FILEVAULT_SYNC"});toast("Mock FileVault status · "+result.status,result.status==="SYNCED"?"gn":"rd");});
    if(action==="vault-reconcile")run("MOCK RECONCILIATION",async()=>{const id=query("#vaultArtifact409")?.value,artifact=state.timelineArtifacts.find((item)=>item.artifactId===id)||state.timelineArtifacts.at(-1),result=await bridge.reconcile(artifact);api.renderAll();toast("Reconciliation · "+result.state,result.state.includes("MATCH")?"gn":"em");});
    if(action==="vault-partial-test")run("SIMULATING PARTIAL FAILURE",async()=>{bridge.setMode(FILEVAULT_MODES.DUAL_WRITE);ctx.v2.injectFailure("createTimelineArtifact","SIMULATED_V2_OUTAGE");const artifact=state.timelineArtifacts.at(-1),result=await bridge.saveArtifact(artifact);api.renderAll();toast("Visible mock result · "+result.status,"rd");});
  });

  document.addEventListener("change",(event)=>{
    if(event.target.id==="photoSeg")return;
    if(event.target.matches("[data-409-photo-count]"))return;
    if(event.target.id==="role409"){ui.currentRole=event.target.value;api.renderAll();}
    if(event.target.id==="vaultMode409"){bridge.setMode(event.target.value);api.renderAll();}
    if(event.target.id==="exportResolution409"){ui.exportWidth=Number(event.target.value)||1920;}
  });
  document.addEventListener("input",(event)=>{if(event.target.id==="deleteDraftPhrase409"){const button=query('[data-409-action="erase-draft-confirm"]');if(button)button.disabled=event.target.value!=="DELETE LOCAL DRAFT";}});
  document.addEventListener("click",(event)=>{const count=event.target.closest("[data-409-photo-count]")?.dataset?.["409PhotoCount"];if(count){media.setPhotoCount(Number(count));api.renderAll();persistence.observe();}});

  const mediaInput=query("#mediaFile409");
  mediaInput?.addEventListener("change",()=>{const file=mediaInput.files?.[0];if(!file)return;run("PROCESSING LOCAL MEDIA",async()=>{await media.addFile(file,{type:mediaInput.dataset.type,placement:mediaInput.dataset.placement,visibility:mediaInput.dataset.visibility,altText:""});api.renderAll();await persistence.saveDraft({reason:"MEDIA_ADD"});toast("Local media placed · no upload","gn");});});
  const importInput=query("#timelineImport409");
  importInput?.addEventListener("change",()=>{const file=importInput.files?.[0];if(!file)return;run("MIGRATING IMPORT",async()=>{const text=await file.text(),result=await persistence.importTimeline(text);if(!result.ok)throw new Error(result.report.warnings.join(" "));api.renderAll();toast("Import migrated with report","gn");});});

  document.addEventListener("keydown",(event)=>{
    const backdrop=query("#modalBk");if(!backdrop?.classList.contains("on"))return;
    if(backdrop.dataset.modalOwner!=="409")return;
    if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();if(!ui.deletionComplete)closeModal();return;}
    if(event.key!=="Tab")return;
    const focusable=[...query("#modalIn").querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")];
    if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  },true);

  return {render,renderStatus,reportError,openModal,closeModal,toast,get busy(){return ui.busy;}};
}

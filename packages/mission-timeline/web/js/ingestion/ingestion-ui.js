import {documentTypeLabel} from "./document-types.js";

function esc(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function fmtMonth(value){if(!value)return "Unknown";const [year,month]=value.split("-").map(Number);return new Date(year,month-1,1).toLocaleString("en-US",{month:"short",year:"numeric"});}
function kindLabel(kind){return {NORMAL:"STANDARD",DUPLICATE:"DUPLICATE",CONFLICT:"CONFLICT",PRIVACY:"PRIVACY REVIEW",UNCLASSIFIED:"UNCLASSIFIED"}[kind]||kind;}
function statusClass(status){if(["ACCEPTED","MERGED","KEPT_BOTH"].includes(status))return "done";if(["REJECTED","SOURCE_NOT_SELECTED"].includes(status))return "aside";return "";}
function confidenceClass(level){return level==="HIGH"?"gn":level==="MEDIUM"?"em":level==="LOW"?"rd":"vi";}
function visibilityOptions(selected){
  return [["INTERVIEWER_SAFE","Interviewer Safe"],["FULL_STORY","Full Story"],["ADVISOR_ONLY","Advisor Only"],["STUDENT_ONLY","Student Only"],["HIDDEN","Hidden"]].map(([value,label])=>'<option value="'+value+'"'+(selected===value?" selected":"")+">"+label+"</option>").join("");
}

export function installIngestionUi(controller,api){
  const input=document.querySelector("#pdfFileInput");
  const dropzone=document.querySelector("#dropzone");
  const privacy=document.querySelector("#privOk");
  let declaredType="auto";
  let modalReturnFocus=null;

  const toast=(message)=>{
    const node=document.querySelector("#toast");
    if(!node)return;
    node.textContent=message;
    node.classList.add("on");
    clearTimeout(node.__408Timer);
    node.__408Timer=setTimeout(()=>node.classList.remove("on"),3000);
  };
  const openModal=(html)=>{
    modalReturnFocus=document.activeElement;
    document.querySelector("#modalIn").innerHTML=html;
    const backdrop=document.querySelector("#modalBk");
    backdrop.classList.add("on");
    backdrop.setAttribute("aria-hidden","false");
    requestAnimationFrame(()=>document.querySelector("#modalIn button,#modalIn input,#modalIn select,#modalIn textarea")?.focus());
  };
  const closeModal=()=>{
    const backdrop=document.querySelector("#modalBk");
    backdrop.classList.remove("on");
    backdrop.setAttribute("aria-hidden","true");
    if(modalReturnFocus?.isConnected)modalReturnFocus.focus();
    modalReturnFocus=null;
  };

  document.querySelectorAll("#docTypes [data-doc]").forEach((button)=>{
    button.onclick=()=>{
      declaredType=button.dataset.doc;
      document.querySelectorAll("#docTypes [data-doc]").forEach((item)=>{item.classList.toggle("go",item===button);item.classList.toggle("alt",item!==button);});
      document.querySelector("#dropLabel").textContent=declaredType==="auto"?"Choose a PDF and let the local parser detect its type":"Choose a "+documentTypeLabel(declaredType);
    };
  });
  privacy.onclick=()=>{
    const enabled=!privacy.classList.contains("on");
    privacy.classList.toggle("on",enabled);
    privacy.setAttribute("aria-pressed",String(enabled));
  };
  dropzone.onclick=()=>{
    if(!privacy.classList.contains("on")){toast("Confirm the privacy check before choosing a document.");return;}
    input.click();
  };
  dropzone.ondragover=(event)=>{event.preventDefault();dropzone.classList.add("drag");};
  dropzone.ondragleave=()=>dropzone.classList.remove("drag");
  dropzone.onkeydown=(event)=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    event.preventDefault();
    dropzone.click();
  };
  dropzone.ondrop=(event)=>{
    event.preventDefault();
    dropzone.classList.remove("drag");
    if(!privacy.classList.contains("on")){toast("Confirm the privacy check before reading a document.");return;}
    const file=event.dataTransfer?.files?.[0];
    if(file)runIngestion(file);
  };
  input.onchange=()=>{const file=input.files?.[0];if(file)runIngestion(file);};
  document.querySelector("#modalBk").addEventListener("keydown",(event)=>{
    if(event.key==="Escape"){event.preventDefault();closeModal();}
  });

  async function runIngestion(file){
    document.querySelector("#parseWrap").style.display="block";
    const result=await controller.ingestFile(file,{declaredType});
    if(result.status==="READY_FOR_REVIEW"){
      api.go("review");
      toast(result.candidates.length+" candidates quarantined for review.");
    }else if(result.status==="OCR_REQUIRED")toast("This PDF needs local OCR. No candidate was created.");
    else toast(result.error?.message||"Document intake needs attention.");
  }

  document.querySelector("#acceptHigh").onclick=()=>{
    const result=controller.acceptAllSafeHighConfidence();
    toast(result.accepted?result.accepted+" safe high-confidence candidates accepted.":"No safe high-confidence candidates are eligible.");
  };
  document.querySelector("#rerunX").onclick=async()=>{
    const documentId=controller.state.activeDocumentId;
    if(!documentId){toast("Choose a source document first.");return;}
    try{await controller.rerunDocument(documentId);toast("Extraction re-run completed. Prior decisions were preserved when fingerprints matched.");}
    catch(error){toast(error.message);}
  };
  document.querySelector("#addMissing").onclick=()=>{api.go("canvas");api.addElement("work","bar");toast("Manual event added. Document intake never blocks direct editing.");};
  document.querySelectorAll("[data-408-filter]").forEach((select)=>select.onchange=()=>{controller.state.filters[select.dataset["408Filter"]]=select.value;controller.notify();});

  document.querySelector("#candList").addEventListener("click",(event)=>{
    const button=event.target.closest("[data-408-action]");
    if(!button)return;
    const id=button.dataset.candidate;
    const candidate=controller.candidate(id);
    try{
      if(button.dataset["408Action"]==="accept"){
        const visibility=document.querySelector('[data-visibility="'+CSS.escape(id)+'"]')?.value||candidate.visibilityRecommendation;
        controller.acceptCandidate(id,{visibility});
        toast("Confirmed. The event is now on the editable blank canvas.");
      }
      if(button.dataset["408Action"]==="reject"){controller.rejectCandidate(id);toast("Rejected. No timeline event was created.");}
      if(button.dataset["408Action"]==="defer"){controller.deferCandidate(id);toast("Deferred. The candidate remains quarantined.");}
      if(button.dataset["408Action"]==="provenance")showProvenance(candidate);
      if(button.dataset["408Action"]==="edit")showEdit(candidate);
      if(button.dataset["408Action"]==="merge"){
        const groupId=candidate.duplicateGroupIds[0];
        controller.mergeDuplicate(groupId,id,document.querySelector('[data-visibility="'+CSS.escape(id)+'"]')?.value||"INTERVIEWER_SAFE");
        toast("Duplicate sources merged into one event with both provenance chains.");
      }
      if(button.dataset["408Action"]==="keep-both"){
        controller.keepBoth(candidate.duplicateGroupIds[0],document.querySelector('[data-visibility="'+CSS.escape(id)+'"]')?.value||"INTERVIEWER_SAFE");
        toast("Both source entries were kept as separate events.");
      }
      if(button.dataset["408Action"]==="choose-source"){
        controller.chooseSource(candidate.conflictIds[0],id,document.querySelector('[data-visibility="'+CSS.escape(id)+'"]')?.value||"INTERVIEWER_SAFE");
        toast("Conflict resolved with this source. The alternate provenance remains recorded.");
      }
    }catch(error){toast(error.message);}
  });

  document.querySelector("#sourceDocList").addEventListener("click",(event)=>{
    const button=event.target.closest("[data-remove-document]");
    if(!button)return;
    showRemoveDocument(button.dataset.removeDocument);
  });
  document.querySelector("#sourceDocList").addEventListener("change",async(event)=>{
    const select=event.target.closest("[data-source-type]");
    if(!select)return;
    select.disabled=true;
    try{
      await controller.correctDocumentType(select.dataset.sourceType,select.value);
      toast("Document type corrected and this source was re-run locally.");
    }catch(error){toast(error.message);}
    finally{select.disabled=false;}
  });

  function showProvenance(candidate){
    const rows=(candidate.provenance||[]).map((item)=>'<div class="provRow"><div><span class="chip cy">'+esc(item.fileName)+" - PAGE "+item.pageNumber+'</span><span class="chip">'+esc(item.section)+'</span></div><blockquote>'+esc(item.sourceExcerpt)+'</blockquote></div>').join("");
    const factors=(candidate.confidence?.factors||[]).map((factor)=>'<div class="confFactor"><b>'+(factor.points>=0?"+":"")+factor.points+'</b><span>'+esc(factor.label)+'</span></div>').join("");
    openModal('<div class="subt">PROVENANCE - WHY THIS WAS PROPOSED</div><h2 class="modalTitle">'+esc(candidate.title)+'</h2>'+rows+'<div class="subt modalSection">MAPPING</div><p class="modalCopy">'+esc(candidate.mappingRationale)+'</p><div class="subt modalSection">CONFIDENCE FACTORS</div><div class="confidenceGrid">'+factors+'</div>'+(candidate.inferredFields.length?'<div class="subt modalSection">INFERRED FIELDS</div><p class="modalCopy">'+esc(candidate.inferredFields.map((item)=>item.field+": "+item.reason).join(" | "))+'</p>':"")+'<button class="btnD alt" id="provClose408">CLOSE</button>');
    document.querySelector("#provClose408").onclick=closeModal;
  }

  function showEdit(candidate){
    openModal('<div class="subt">EDIT QUARANTINED CANDIDATE</div><h2 class="modalTitle">'+esc(candidate.title)+'</h2><label class="f"><span class="fl">TITLE</span><input id="ceTitle" value="'+esc(candidate.title)+'"></label><label class="f"><span class="fl">CATEGORY</span><select id="ceCategory">'+Object.entries(api.CATS).map(([id,item])=>'<option value="'+id+'"'+(candidate.categoryId===id?" selected":"")+">"+esc(item.n)+"</option>").join("")+'</select></label><div class="editDateGrid"><label class="f"><span class="fl">START</span><input type="month" id="ceStart" value="'+esc(candidate.startDate)+'"></label><label class="f"><span class="fl">END</span><input type="month" id="ceEnd" value="'+esc(candidate.endDate||"")+'"></label></div><label class="f"><span class="fl">ORGANIZATION OR SITE</span><input id="ceSite" value="'+esc(candidate.siteName||candidate.organization)+'"></label><div class="modalOriginal">ORIGINAL EXTRACTION IS PRESERVED: '+esc(candidate.originalExtraction.rawText)+'</div><div class="modalActions"><button class="btnD go" id="ceSave">SAVE CORRECTION</button><button class="btnD alt" id="ceCancel">CANCEL</button></div>');
    document.querySelector("#ceSave").onclick=()=>{
      controller.editCandidate(candidate.id,{title:document.querySelector("#ceTitle").value,categoryId:document.querySelector("#ceCategory").value,startDate:document.querySelector("#ceStart").value,endDate:document.querySelector("#ceEnd").value||null,siteName:document.querySelector("#ceSite").value,organization:document.querySelector("#ceSite").value});
      closeModal();
      toast("Correction saved. Original extraction remains in provenance.");
    };
    document.querySelector("#ceCancel").onclick=closeModal;
  }

  function showRemoveDocument(documentId){
    const impact=controller.previewDocumentRemoval(documentId);
    const source=controller.state.sourceDocuments.find((document)=>document.id===documentId);
    openModal('<div class="subt">REMOVE LOCAL SOURCE</div><h2 class="modalTitle">'+esc(source?.fileName||"Source document")+'</h2><p class="modalCopy">This affects '+impact.candidateCount+' candidates and '+impact.eventCount+' accepted timeline events. Accepted events will remain, and their source links will be marked removed.</p><div class="modalActions"><button class="btnD alt" id="removeConfirm408">REMOVE SOURCE</button><button class="btnD go" id="removeCancel408">KEEP SOURCE</button></div>');
    document.querySelector("#removeConfirm408").onclick=()=>{controller.removeDocument(documentId,{confirmed:true});closeModal();toast("Source removed. Accepted events were retained.");};
    document.querySelector("#removeCancel408").onclick=closeModal;
  }

  function renderDocuments(state){
    const host=document.querySelector("#sourceDocList");
    if(!state.sourceDocuments.length){host.innerHTML='<div class="emptyIntake">No source documents in this draft.</div>';return;}
    host.innerHTML=state.sourceDocuments.map((source)=>{
      const tone=source.status==="EXTRACTED"?"gn":"em";
      const selected=source.userDeclaredType||"auto";
      const typeOptions=[["auto","Auto Detect"],["eras","ERAS"],["cv","CV"],["resume","Resume"]].map(([value,label])=>'<option value="'+value+'"'+(selected===value?" selected":"")+'>'+label+'</option>').join("");
      return '<div class="sourceDocRow">'
        +'<div><b>'+esc(source.fileName)+'</b><span>Detected '+esc(documentTypeLabel(source.detectedType))+' - using '+esc(documentTypeLabel(source.effectiveType||source.detectedType))+' - '+source.pageCount+' pages - '+source.charCount+' characters</span></div>'
        +'<label class="sourceTypeControl">PARSE AS<select data-source-type="'+source.id+'" aria-label="Correct document type for '+esc(source.fileName)+'">'+typeOptions+'</select></label>'
        +'<span class="chip '+tone+'">'+esc(source.status)+'</span>'
        +'<button class="iconBtn" title="Remove source document" data-remove-document="'+source.id+'">×</button>'
        +'</div>';
    }).join("");
  }

  function renderPipeline(state){
    const host=document.querySelector("#parseSteps");
    const recent=state.processingHistory.slice(-9);
    host.innerHTML=recent.map((item)=>'<div class="pipelineStep"><i></i><span><b>'+esc(item.status.replaceAll("_"," "))+'</b>'+esc(item.detail)+'</span></div>').join("");
    document.querySelector("#parseState").textContent=state.status.replaceAll("_"," ");
    document.querySelector("#parseDocName").textContent=state.sourceDocuments.find((document)=>document.id===state.activeDocumentId)?.fileName||"LOCAL PDF";
    const error=document.querySelector("#intakeError");
    error.hidden=!state.lastError;
    error.textContent=state.lastError?state.lastError.code+": "+state.lastError.message:"";
  }

  function filteredCandidates(state){
    const filters=state.filters;
    return state.extractionCandidates.filter((candidate)=>{
      if(filters.status!=="ALL"&&candidate.reviewStatus!==filters.status)return false;
      if(filters.confidence!=="ALL"&&candidate.confidence.level!==filters.confidence)return false;
      if(filters.type!=="ALL"&&candidate.candidateKind!==filters.type)return false;
      return true;
    });
  }

  function renderCandidates(state){
    const host=document.querySelector("#candList");
    const candidates=filteredCandidates(state);
    if(!state.sourceDocuments.length){host.innerHTML='<div class="panelD"><div class="pi emptyReview"><b>No extraction yet.</b><span>Run Document Intake first. Every candidate will arrive here quarantined.</span><button class="btnD go sm" id="goIntake408">GO TO INTAKE</button></div></div>';document.querySelector("#goIntake408").onclick=()=>api.go("upload");}
    else if(!candidates.length)host.innerHTML='<div class="panelD"><div class="pi emptyReview"><b>No candidates match these filters.</b><span>Change a filter or ingest another local document.</span></div></div>';
    else host.innerHTML=candidates.map((candidate)=>candidateCard(candidate)).join("");
    const progress=controller.reviewProgress();
    document.querySelector("#candMeter").textContent=progress.reviewed+" OF "+progress.total+" REVIEWED";
    document.querySelector("#reviewPending").textContent=progress.pending+" PENDING";
    const pending=state.extractionCandidates.filter((candidate)=>candidate.reviewStatus==="PENDING").length;
    const railBadge=document.querySelector("#railUp");
    railBadge.textContent=pending?String(pending):"";
    railBadge.classList.toggle("on",pending>0);
    const status=document.querySelector("#stCand");
    if(status)status.textContent=pending+" WAITING";
  }

  function candidateCard(candidate){
    const source=candidate.provenance[0];
    const range=fmtMonth(candidate.startDate)+(candidate.endDate?" - "+fmtMonth(candidate.endDate):candidate.timelineKind==="duration"?" - Present":"");
    const relation=candidate.candidateKind==="DUPLICATE"?'<div class="relationNote">LIKELY DUPLICATE - merge into one event or keep both.</div>':candidate.candidateKind==="CONFLICT"?'<div class="relationNote conflictNote">SOURCE CONFLICT - choose a source or edit before acceptance.</div>':candidate.candidateKind==="PRIVACY"?'<div class="relationNote privacyNote">PRIVACY REVIEW - advisor-only is recommended until the student approves broader visibility.</div>':candidate.candidateKind==="UNCLASSIFIED"?'<div class="relationNote conflictNote">UNCLASSIFIED - correct the category before acceptance.</div>':"";
    const inferred=candidate.inferredFields.length?'<div class="inferredNote">INFERRED: '+esc(candidate.inferredFields.map((item)=>item.field+" - "+item.reason).join(" | "))+"</div>":"";
    const done=candidate.reviewStatus!=="PENDING"&&candidate.reviewStatus!=="DEFERRED";
    let actions="";
    if(done)actions='<span class="chip '+(["ACCEPTED","MERGED","KEPT_BOTH"].includes(candidate.reviewStatus)?"gn":"")+'">'+esc(candidate.reviewStatus.replaceAll("_"," "))+"</span>";
    else{
      const visibility='<select class="candidateVisibility" data-visibility="'+candidate.id+'">'+visibilityOptions(candidate.visibilityRecommendation)+"</select>";
      const common='<button class="btnD alt sm" data-408-action="edit" data-candidate="'+candidate.id+'">EDIT</button><button class="btnD alt sm" data-408-action="provenance" data-candidate="'+candidate.id+'">PROVENANCE</button><button class="btnD alt sm" data-408-action="reject" data-candidate="'+candidate.id+'">REJECT</button><button class="btnD alt sm" data-408-action="defer" data-candidate="'+candidate.id+'">DEFER</button>';
      if(candidate.candidateKind==="DUPLICATE")actions=visibility+'<button class="btnD go sm" data-408-action="merge" data-candidate="'+candidate.id+'">MERGE SOURCES</button><button class="btnD alt sm" data-408-action="keep-both" data-candidate="'+candidate.id+'">KEEP BOTH</button>'+common;
      else if(candidate.candidateKind==="CONFLICT")actions=visibility+'<button class="btnD go sm" data-408-action="choose-source" data-candidate="'+candidate.id+'">USE THIS SOURCE</button>'+common;
      else actions=visibility+'<button class="btnD go sm" data-408-action="accept" data-candidate="'+candidate.id+'">ACCEPT</button>'+common;
    }
    return '<article class="candidateCard '+statusClass(candidate.reviewStatus)+' kind-'+candidate.candidateKind.toLowerCase()+'" data-candidate-card="'+candidate.id+'"><div class="candidateHead"><span class="categoryDot" style="background:'+esc(api.CATS[candidate.categoryId]?.c||"#8a7dff")+'"></span><div class="candidateIdentity"><b>'+esc(candidate.title)+'</b><span>'+esc(candidate.siteName||candidate.organization||candidate.section)+"</span></div><span class=\"chip "+confidenceClass(candidate.confidence.level)+'">'+esc(candidate.confidence.level)+" "+candidate.confidence.score+'</span><span class="chip">'+kindLabel(candidate.candidateKind)+'</span><time>'+range+"</time></div>"+relation+'<blockquote class="candidateExcerpt">'+esc(source?.sourceExcerpt||candidate.originalExtraction.rawText)+'</blockquote><div class="candidateMeta"><span class="chip cy">'+esc(source?.fileName||"LOCAL PDF")+" - P"+esc(source?.pageNumber||"?")+'</span><span class="chip">'+esc(candidate.canonicalType.replaceAll("_"," "))+"</span><span>"+esc(candidate.mappingRationale)+"</span></div>"+inferred+'<div class="candidateActions">'+actions+"</div></article>";
  }

  function render(state){renderPipeline(state);renderDocuments(state);renderCandidates(state);}
  controller.subscribe(render);
  return {render,runIngestion,showProvenance,showEdit,showRemoveDocument,toast};
}

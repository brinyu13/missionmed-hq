const LABELS={UNREVIEWED:"Not reviewed",APPROVED:"Approved for interview use",CHANGES_REQUESTED:"Changes requested",NEEDS_REVIEW:"Changed since review — needs review"};
function failure(code,message){return Object.assign(new Error(message),{code});}
function sourceFingerprint(document){
  const copy=structuredClone(document||{});delete copy.persistence;delete copy.recovery;delete copy.exportRecords;delete copy.timelineArtifacts;
  if(copy.metadata){delete copy.metadata.updatedAt;delete copy.metadata.lastSyncedAt;}
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  return JSON.stringify(ordered(copy));
}

/** UI permissions are display hints from the authenticated runtime. The API is the authority. */
export function mountInterviewApprovalV1({host,runtime,store,getDocument,subscribeEdits=()=>()=>{},clock=()=>Date.now()}={}){
  if(!host||!runtime?.authClient||!runtime?.adapter||!store||typeof getDocument!=="function")throw new TypeError("An authenticated Timeline runtime, store, document and host are required.");
  const api=runtime.authClient,adapter=runtime.adapter;
  let receipt=null,error="",busy=false,syncFlushing=false,disposed=false,epoch=0,readSequence=0;
  const dom=host.ownerDocument;
  function context(){
    const document=getDocument(),claims=api.claims||{},grant=api.adminSubjectGrant;
    const id=String(document?.id||"");
    const administrator=api.configured===true&&claims.timeline_role==="PROGRAM_ADMIN"&&claims.is_wordpress_administrator===true
      &&claims.timeline_admin_workspace===true&&api.bootstrapState?.adminWorkspace===true
      &&Number(claims.exp)*1000>clock()&&grant?.documentId===id&&grant?.principalId===document?.studentOwnerId
      &&grant?.wpUserId===api.subjectWpUserId&&grant?.expiresAt>clock();
    return {id,administrator,key:JSON.stringify([api.bootstrapState?.principalId,claims.sub,claims.timeline_role,
      claims.timeline_admin_workspace===true,api.locked,api.closed,id,document?.studentOwnerId,
      api.subjectWpUserId,grant?.documentId,grant?.principalId]),fingerprint:sourceFingerprint(document)};
  }
  function localSavePending(){
    return typeof store.saveNow==="function" ? store.saveStatus!=="saved"||Boolean(store.saveError)
      : Boolean(store.state?.persistence?.dirty||store.state?.persistence?.lastSaveError);
  }
  async function flushLocal(){
    if(typeof store.saveNow==="function")return store.saveNow("BEFORE_ADVISOR_DECISION");
    if(typeof store.flush==="function")return store.flush();
    throw failure("APPROVAL_SAVE_UNAVAILABLE","The current Timeline cannot be saved for review.");
  }
  function stillCurrent(captured,at){return !disposed&&epoch===at&&context().key===captured.key&&context().fingerprint===captured.fingerprint;}
  function assertCurrent(captured,at){if(!stillCurrent(captured,at))throw failure("APPROVAL_CONTEXT_CHANGED","The Timeline or selected account changed. Reload the current review status.");}
  async function synchronizedRevision(captured,at){
    const synchronized=()=>{
      const status=adapter.getSyncStatus?.();
      return !localSavePending()&&status?.state==="SYNCED"&&status.pending===0;
    };
    if(!synchronized())throw failure("APPROVAL_SYNC_REQUIRED","The current edits have not synced. Resolve the save error before viewing review status.");
    const revision=await adapter.getRemoteRevision(captured.id);assertCurrent(captured,at);
    if(!synchronized()||!Number.isInteger(revision)||revision<0)throw failure("APPROVAL_SYNC_REQUIRED","The current saved revision has not been acknowledged by the server.");
    return revision;
  }
  function handleSyncStatus(status={}){
    if((status.syncState||status.state)!=="SYNCED"||status.pending!==0){
      // A decision already clears its receipt before its own local/remote flush.
      // Expected pending emissions during that flush must not cancel the flush.
      if(busy&&syncFlushing){receipt=null;return;}
      invalidate("The current edits have not synced. Refresh review status after sync completes.");
    }
  }
  function validate(value,id){
    if(value?.documentId!==id||!Number.isInteger(value.currentRevision)||value.currentRevision<0||!Object.hasOwn(LABELS,value.status)
      ||(value.currentVersionId!==null&&typeof value.currentVersionId!=="string")
      ||(value.currentContentSha256!==null&&!/^[a-f0-9]{64}$/.test(value.currentContentSha256||"")))throw failure("APPROVAL_RESPONSE_INVALID","The server review status could not be verified.");
    if(value.status==="APPROVED"&&(!value.decision||value.decision.decision!=="APPROVED"
      ||value.decision.versionId!==value.currentVersionId||value.decision.contentSha256!==value.currentContentSha256
      ||value.decision.revision!==value.currentRevision))throw failure("APPROVAL_RESPONSE_INVALID","The reviewed revision does not match this Timeline.");
    return value;
  }
  function element(tag,text){const node=dom.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
  function render(){
    if(disposed)return;
    const content=element("section");content.setAttribute("aria-label","Interview review");
    const status=element("p",busy?"Checking the current saved revision…":receipt?LABELS[receipt.status]:"Review status requires the current saved Timeline.");status.setAttribute("role","status");content.append(status);
    if(receipt){
      content.append(element("p",`Current revision ${receipt.currentRevision}`));
      if(receipt.decision){const d=receipt.decision;content.append(element("p",`${d.decision} · revision ${d.revision} · ${d.actorId} · ${d.timestamp}`));if(d.note)content.append(element("p",d.note));}
    }
    if(error){const message=element("p",error);message.setAttribute("role","alert");content.append(message);}
    const reload=element("button","Refresh review status");reload.type="button";reload.disabled=busy;reload.addEventListener("click",()=>refresh().catch(()=>{}));content.append(reload);
    if(receipt?.canDecide===true&&context().administrator){
      const label=element("label","Optional review note"),note=element("textarea");note.maxLength=1000;note.disabled=busy;label.append(note);content.append(label);
      for(const [decision,title]of [["APPROVED","Approve for interview use"],["CHANGES_REQUESTED","Request changes"]]){
        const button=element("button",title);button.type="button";button.disabled=busy;button.addEventListener("click",()=>decide(decision,note.value).catch(()=>{}));content.append(button);
      }
    }
    host.replaceChildren(content);
  }
  function invalidate(message="This Timeline changed. Save it and refresh the review status."){
    epoch++;readSequence++;receipt=null;error=message;render();
  }
  async function refresh(){
    if(busy)return null;
    const captured=context(),at=epoch,sequence=++readSequence;
    receipt=null;error="";render();
    try{
      if(!captured.id||api.configured!==true)throw failure("APPROVAL_SESSION_REQUIRED","Verify your Timeline session to view review status.");
      if(localSavePending())throw failure("APPROVAL_UNSAVED","Save the current edits before viewing review status.");
      const remoteRevision=await synchronizedRevision(captured,at);
      const value=validate(await api.getApproval(captured.id),captured.id);
      assertCurrent(captured,at);
      if(sequence!==readSequence)return null;
      const afterRevision=await synchronizedRevision(captured,at);
      if(sequence!==readSequence)return null;
      if(remoteRevision!==afterRevision||afterRevision!==value.currentRevision)throw failure("REVISION_CONFLICT","The server Timeline differs from the current synced source. Reload before viewing review status.");
      receipt=value;render();return value;
    }catch(e){if(stillCurrent(captured,at)&&sequence===readSequence){receipt=null;error=e.message||"Review status is unavailable.";render();}throw e;}
  }
  async function decide(decision,note=""){
    if(busy)throw failure("APPROVAL_BUSY","A review decision is already in progress.");
    if(!["APPROVED","CHANGES_REQUESTED"].includes(decision))throw failure("APPROVAL_DECISION_INVALID","Choose a review decision.");
    const start=context();
    if(!start.administrator||receipt?.canDecide!==true)throw failure("APPROVAL_ADMIN_REQUIRED","A currently authorized administrator must open this student's Timeline.");
    const at=epoch;readSequence++;busy=true;receipt=null;error="";render();
    try{
      syncFlushing=true;
      await flushLocal();
      if(disposed||epoch!==at||context().key!==start.key)throw failure("APPROVAL_CONTEXT_CHANGED","The Timeline or selected account changed. Reopen the current Timeline.");
      const captured=context();
      await adapter.flush();syncFlushing=false;assertCurrent(captured,at);
      const remoteRevision=await synchronizedRevision(captured,at);
      const current=validate(await api.getApproval(captured.id),captured.id);assertCurrent(captured,at);
      if(await synchronizedRevision(captured,at)!==remoteRevision)throw failure("REVISION_CONFLICT","The saved revision changed during review. Reload before deciding.");
      if(!context().administrator||current.canDecide!==true)throw failure("APPROVAL_ADMIN_REQUIRED","Administrator review access is no longer available.");
      if(!current.currentVersionId||remoteRevision!==current.currentRevision)throw failure("REVISION_CONFLICT","The server Timeline changed. Reload its current saved revision before deciding.");
      let reviewId=current.reviewId;
      if(!reviewId){const review=await api.requestReview(captured.id,current.currentVersionId);assertCurrent(captured,at);
        if(review.documentId!==captured.id||review.versionId!==current.currentVersionId||review.versionHash!==current.currentContentSha256)throw failure("APPROVAL_RESPONSE_INVALID","The review does not match the saved revision.");
        reviewId=review.id;
      }
      await api.decideReview(reviewId,decision,current.currentRevision,String(note).trim());assertCurrent(captured,at);
      const result=validate(await api.getApproval(captured.id),captured.id);assertCurrent(captured,at);
      if(await synchronizedRevision(captured,at)!==result.currentRevision)throw failure("REVISION_CONFLICT","The server Timeline differs from the current synced source. Reload its review status.");
      receipt=result;return result;
    }catch(e){receipt=null;if(!disposed&&epoch===at&&context().key===start.key)error=e.message||"The server could not record this decision.";throw e;}
    finally{syncFlushing=false;busy=false;render();}
  }
  let contextKey=context().key,observedFingerprint=context().fingerprint;
  const unclaims=api.subscribeClaims?.(()=>{const next=context().key;if(next!==contextKey){contextKey=next;observedFingerprint=context().fingerprint;invalidate("The session or selected account changed. Refresh review status.");}})||(()=>{});
  // TimelineStore emits itself immediately after every mutation and on save/selection changes.
  // Fingerprint every emission so source edits clear a receipt before autosave begins.
  const unsubscribe=store.subscribe?.(()=>{
    const next=context();
    if(next.key!==contextKey){contextKey=next.key;observedFingerprint=next.fingerprint;invalidate("The selected Timeline changed. Refresh review status.");}
    else if(next.fingerprint!==observedFingerprint){observedFingerprint=next.fingerprint;invalidate();}
    else if(localSavePending()&&receipt&&!busy)invalidate("Save the current Timeline before viewing review status.");
  })||(()=>{});
  const unedits=subscribeEdits(()=>invalidate())||(()=>{});
  render();
  return {refresh,decide,invalidate,handleSyncStatus,getState:()=>({receipt:receipt?structuredClone(receipt):null,error,busy}),
    dispose(){disposed=true;epoch++;readSequence++;unclaims();unsubscribe();unedits();host.replaceChildren();}};
}

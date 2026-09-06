import {ensureReleaseCandidateState,RELEASE_CANDIDATE_VERSION,OCR_RELEASE_DECISION} from "./release/release-state.js";
import {EditorHistoryManager} from "./editor/editor-history.js";
import {analyzeCollisionLayout,deterministicAutoArrange} from "./editor/collision-engine-410.js";
import {ReviewWorkspace} from "./review/review-workspace.js";
import {buildAccessibleTextSummary,buildAccessibleTimelineHtml} from "./export/accessible-export.js";
import {install410Ui} from "./ui/product-410-ui.js";

export async function install410ReleaseCandidate(api409){
  if(!api409?.ready)throw new Error("D1-409 must be ready before D1-410 starts.");
  const {context}=api409,{api,state,persistence,advisor,exportEngine}=context,controller=window.D1_408_TEST?.controller;
  if(!controller)throw new Error("D1-408 ingestion controller is required for D1-410.");
  const release=ensureReleaseCandidateState(api,state),history=new EditorHistoryManager(api,release),review=new ReviewWorkspace(controller,release),ctx={...context,api409,release,history,review,controller,ui409:context.ui};
  const previousAfter=window.D1_407_HARDENING.afterRenderAll;
  const ui=install410Ui(ctx);ctx.ui410=ui;
  window.D1_407_HARDENING.afterRenderAll=()=>{previousAfter?.();ui.render();};
  const testApi={
    version:RELEASE_CANDIDATE_VERSION,ready:true,context:ctx,get state(){return release;},get document(){return context.documentProvider();},
    history,review,controller,
    analyzeCollisions:(options)=>analyzeCollisionLayout(context.documentProvider(),options),
    autoArrange:(options)=>deterministicAutoArrange(api.state.user.events,options),
    ingestManualText:(text,options)=>controller.ingestManualText(text,options),
    generateAccessibleHtml:(options)=>exportEngine.generateAccessibleHtml(options),
    buildAccessibleHtml:(document,options)=>buildAccessibleTimelineHtml(document,options),
    buildAccessibleText:(document,options)=>buildAccessibleTextSummary(document,options),
    ocrDecision:OCR_RELEASE_DECISION,
    productionRequestCount:()=>api409.productionRequestCount,
    pure:{analyzeCollisionLayout,deterministicAutoArrange,buildAccessibleTimelineHtml,buildAccessibleTextSummary}
  };
  state.releaseCandidate=release;await persistence.observe();await persistence.saveDraft({reason:"D1_410_RELEASE_CANDIDATE_BOOT"});
  window.D1_410_TEST=testApi;window.D1_410_READY=true;api.renderAll();
  return testApi;
}

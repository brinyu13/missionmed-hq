import {projectLayoutCritic,applyLayoutRecommendations,validateLayoutRecommendations,LAYOUT_CRITIC_CONSENT_VERSION,stableLayoutJson} from '../presentation/layout-critic-projection.js';

export const LOCAL_LAYOUT_REVIEW_PATH='/api/local-layout-critic';
export function isLocalLayoutReviewLocation(location=globalThis.location){
  return location?.protocol==='http:'&&['localhost','127.0.0.1'].includes(location.hostname);
}
const failure=code=>Object.assign(new Error(code),{code});
const safeReceipt=receipt=>({responseId:receipt.responseId,model:receipt.model,receivedAt:receipt.receivedAt||'',store:false});

// This controller never sends the source document or the local alias mapping.
// Dependency injection is for synthetic tests, never a second provider path.
export function createLocalLayoutReview(store,{
  location=globalThis.location,fetchImpl=globalThis.fetch,
  project=projectLayoutCritic,apply=applyLayoutRecommendations,
  validate=validateLayoutRecommendations,onState=()=>{},renderOptions={scope:'EVERYTHING'}
}={}){
  let state={status:'UNAVAILABLE',available:false,busy:false},active=false;
  const publish=patch=>{state={...state,...patch};onState({...state});return state;};
  async function capabilities(){
    if(!isLocalLayoutReviewLocation(location))return publish({available:false,status:'UNAVAILABLE'});
    try{
      const response=await fetchImpl(LOCAL_LAYOUT_REVIEW_PATH+'/capabilities',{method:'GET',credentials:'same-origin',cache:'no-store'});
      const value=await response.json();
      const available=response.ok&&value.scope==='LOCAL_GEOMETRY_ONLY'&&value.providerConfigured===true&&value.productionWrites===false&&value.synthetic===false&&value.consentVersion===LAYOUT_CRITIC_CONSENT_VERSION;
      return publish({available,status:available?'READY':'UNAVAILABLE'});
    }catch{return publish({available:false,status:'UNAVAILABLE'});}
  }
  async function review(){
    if(active||!state.available||!isLocalLayoutReviewLocation(location)||store.entitlement?.canMutate!==true)return state;
    active=true;publish({busy:true,status:'REVIEWING',receipt:null,applied:0,rejected:0,errorCode:null});
    try{
      const projection=await project(store.document,renderOptions);
      const response=await fetchImpl(LOCAL_LAYOUT_REVIEW_PATH,{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json','x-timeline-local-layout-critic':'1'},
        body:JSON.stringify({projection:projection.input,sceneDigest:projection.sceneDigest,
          consent:{version:LAYOUT_CRITIC_CONSENT_VERSION,sceneDigest:projection.sceneDigest,geometryOnly:true}})});
      const value=await response.json();
      if(!response.ok||value.status!=='COMPLETE')throw failure(/^LAYOUT_CRITIC_[A-Z_]+$/.test(value.error?.code||'')?value.error.code:'LAYOUT_CRITIC_PROVIDER_UNAVAILABLE');
      if(value.mode!=='LOCAL_PROVIDER_AI'||value.scope!=='LOCAL_GEOMETRY_ONLY'||value.synthetic!==false||value.productionWrites!==false||value.sourceUnchanged!==true||!value.providerReceipt?.responseId||!value.providerReceipt.model||value.providerReceipt.store!==false)throw failure('LAYOUT_CRITIC_PROVIDER_RECEIPT_REQUIRED');
      const output={sceneDigest:value.sceneDigest,recommendations:value.recommendations};
      if(value.sceneDigest!==projection.sceneDigest)throw failure('LAYOUT_CRITIC_STALE_SCENE');
      validate(projection.input,output,projection.sceneDigest);
      if(store.entitlement?.canMutate!==true)throw failure('LAYOUT_CRITIC_PERMISSION_CHANGED');
      const source=stableLayoutJson(store.document);
      const result=await apply(store.document,output,projection.sceneDigest,{...renderOptions,sourceDigest:projection.localContext.sourceDigest});
      if(stableLayoutJson(store.document)!==source)throw failure('LAYOUT_CRITIC_STALE_SCENE');
      if(result.sourceUnchanged!==true||!Number.isInteger(result.applied)||result.applied<0||result.applied>value.recommendations.length||!Array.isArray(result.rejected))throw failure('LAYOUT_CRITIC_VALIDATION_FAILED');
      const receipt={status:result.applied?'APPLIED':'REVIEWED',scope:'LOCAL_GEOMETRY_ONLY',sceneDigest:projection.sceneDigest,
        consentVersion:LAYOUT_CRITIC_CONSENT_VERSION,providerReceipt:safeReceipt(value.providerReceipt),
        recommended:value.recommendations.length,applied:result.applied,rejected:result.rejected.length,
        before:result.before,after:result.after,sourceUnchanged:true};
      if(result.applied){
        if(store.entitlement?.canMutate!==true)throw failure('LAYOUT_CRITIC_PERMISSION_CHANGED');
        const next=structuredClone(result.document);next.metadata||={};next.metadata.qualityGuardian||={};
        const previous=next.metadata.qualityGuardian;
        previous.localLayoutReview=receipt;
        previous.localLayoutReviews=[...(Array.isArray(previous.localLayoutReviews)?previous.localLayoutReviews:[]),receipt];
        if(store.replace(next,{label:'Quality Guardian: validated local AI layout fix'})===false)throw failure('LAYOUT_CRITIC_SAVE_REJECTED');
      }
      return publish({...receipt,receipt,busy:false});
    }catch(error){
      return publish({status:error.code==='LAYOUT_CRITIC_STALE_SCENE'?'STALE':'FAILED',busy:false,receipt:null,applied:0,rejected:0,errorCode:/^LAYOUT_CRITIC_[A-Z_]+$/.test(error.code||'')?error.code:'LAYOUT_CRITIC_VALIDATION_FAILED'});
    }finally{active=false;}
  }
  return {capabilities,review,get state(){return {...state};}};
}

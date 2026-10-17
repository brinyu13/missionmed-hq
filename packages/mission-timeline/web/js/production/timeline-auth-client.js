export class TimelineProductionAuthError extends Error{
  constructor(code,message,status=0){super(message);this.name="TimelineProductionAuthError";this.code=code;this.status=status;}
}

function sameOriginUrl(value,origin){
  const url=new URL(String(value||""),origin);
  if(url.origin!==origin)throw new TimelineProductionAuthError("CROSS_ORIGIN_CONFIGURATION","Timeline authentication configuration is invalid.");
  return url.href;
}

function jwtPayload(token){
  try{
    const part=token.split(".")[1];
    const padded=part.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(part.length/4)*4,"=");
    return JSON.parse(atob(padded));
  }catch{throw new TimelineProductionAuthError("TOKEN_PAYLOAD_INVALID","Timeline session token is invalid.",401);}
}

const AUTHORITY_REVOCATION_CODES=new Set([
  "session_required","eligibility_required","eligibility_unverified","timeline_disabled",
  "canary_access_required","administrator_approval_required","remote_sync_consent_required",
  "principal_unavailable","timeline_identity_unmapped","timeline_identity_conflict","timeline_identity_invalid"
]);
const isAuthorityRevocation=(code)=>AUTHORITY_REVOCATION_CODES.has(String(code||"").toLowerCase());

export class TimelineProductionAuthClient{
  constructor({fetchImpl=globalThis.fetch.bind(globalThis),locationObject=globalThis.location,documentObject=globalThis.document,onAccountSwitch=()=>{}}={}){
    this.fetchImpl=fetchImpl;this.locationObject=locationObject;this.documentObject=documentObject;this.onAccountSwitch=onAccountSwitch;
    this.bootstrapState=null;this.token="";this.claims=null;this.refreshing=null;this.refreshTimer=null;this.locked=false;
    this.visibilityHandler=()=>{
      if(this.documentObject?.visibilityState==="visible")this.refreshToken().catch(()=>{});
    };
    this.documentObject?.addEventListener?.("visibilitychange",this.visibilityHandler);
  }

  get configured(){
    return Boolean(!this.locked&&this.bootstrapState?.apiBase&&this.token&&this.claims);
  }

  async initialize(){
    this.locked=false;
    const origin=this.locationObject.origin;
    const endpoint=new URL("/wp-admin/admin-ajax.php",origin);
    endpoint.searchParams.set("action","missionmed_timeline_bootstrap");
    endpoint.searchParams.set("return_to",`${this.locationObject.pathname}${this.locationObject.search}${this.locationObject.hash}`);
    const response=await this.fetchImpl(endpoint,{credentials:"same-origin",cache:"no-store",headers:{accept:"application/json"},signal:AbortSignal.timeout(20_000)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||payload?.success!==true){
      throw new TimelineProductionAuthError(payload?.data?.code||"TIMELINE_BOOTSTRAP_FAILED",payload?.data?.message||"Timeline access could not be verified.",response.status);
    }
    const data=payload.data||{};
    this.bootstrapState={
      nonce:String(data.nonce||""),
      tokenEndpoint:sameOriginUrl(data.token_endpoint,origin),
      apiBase:sameOriginUrl(data.api_base,origin).replace(/\/$/,""),
      matrixUrl:sameOriginUrl(data.matrix_url,origin),
      principalId:String(data.user?.principal_id||"").toLowerCase(),
      wpUserId:Number(data.user?.wp_user_id),
      role:String(data.user?.role||""),
      remoteSyncConsent:data.remote_sync_consent===true,
      remoteSyncAllowed:data.remote_sync_allowed===true||data.remote_sync_consent===true,
      consentVersion:String(data.consent_version||""),
    };
    if(!this.bootstrapState.nonce||!this.bootstrapState.principalId||!Number.isSafeInteger(this.bootstrapState.wpUserId)){
      throw new TimelineProductionAuthError("TIMELINE_BOOTSTRAP_INVALID","Timeline identity bootstrap is invalid.");
    }
    await this.refreshToken();
    return Object.freeze({...this.bootstrapState,claims:{...this.claims}});
  }

  async refreshToken(){
    if(this.refreshing)return this.refreshing;
    this.refreshing=this.performRefresh().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }

  async performRefresh(){
    if(this.locked)throw new TimelineProductionAuthError("TIMELINE_SESSION_LOCKED","Timeline is locked for this browser session.",401);
    if(!this.bootstrapState)throw new TimelineProductionAuthError("TIMELINE_BOOTSTRAP_REQUIRED","Timeline authentication is not initialized.");
    const response=await this.fetchImpl(this.bootstrapState.tokenEndpoint,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{accept:"application/json","x-wp-nonce":this.bootstrapState.nonce},
      signal:AbortSignal.timeout(20_000)
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const code=payload?.code||payload?.error?.code||"TOKEN_REFRESH_FAILED";
      if(response.status===401||isAuthorityRevocation(code))this.lock(`refresh_${String(code).toLowerCase()}`);
      throw new TimelineProductionAuthError(code,payload?.message||payload?.error?.message||"Timeline session refresh failed.",response.status);
    }
    const nextToken=String(payload.token||"");
    const nextClaims=jwtPayload(nextToken);
    if(
      String(nextClaims.sub||"").toLowerCase()!==this.bootstrapState.principalId||
      Number(nextClaims.wp_user_id)!==this.bootstrapState.wpUserId||
      String(nextClaims.timeline_role||"")!==this.bootstrapState.role
    ){
      this.lock("account_changed");
      throw new TimelineProductionAuthError("TIMELINE_ACCOUNT_CHANGED","MissionMed account changed. Timeline was locked.",401);
    }
    this.bootstrapState.nonce=String(payload.nonce||this.bootstrapState.nonce);
    this.token=nextToken;this.claims=nextClaims;
    this.scheduleRefresh();
    return nextToken;
  }

  async validToken(){
    if(this.locked)throw new TimelineProductionAuthError("TIMELINE_SESSION_LOCKED","Timeline is locked for this browser session.",401);
    const expires=Number(this.claims?.exp||0)*1000;
    if(!this.token||expires-Date.now()<30_000)await this.refreshToken();
    return this.token;
  }

  async request(path,{method="GET",body,headers={},retry=true}={}){
    const token=await this.validToken();
    const response=await this.fetchImpl(`${this.bootstrapState.apiBase}${path}`,{
      method,credentials:"same-origin",cache:"no-store",
      headers:{accept:"application/json",authorization:`Bearer ${token}`,...(body===undefined?{}:{"content-type":"application/json"}),...headers},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20_000)
    });
    if(response.status===401&&retry){await this.refreshToken();return this.request(path,{method,body,headers,retry:false});}
    const payload=await response.json().catch(()=>({}));
    const errorCode=payload?.error?.code||"TIMELINE_API_ERROR";
    if(response.status===401)this.lock("api_session_invalid");
    else if(isAuthorityRevocation(errorCode))this.lock(`api_${String(errorCode).toLowerCase()}`);
    if(!response.ok)throw new TimelineProductionAuthError(errorCode,payload?.error?.message||"Timeline request failed.",response.status);
    return payload;
  }

  scheduleRefresh(){
    clearTimeout(this.refreshTimer);
    const refreshAt=Math.max(1_000,Number(this.claims?.exp||0)*1000-Date.now()-30_000);
    this.refreshTimer=setTimeout(()=>this.refreshToken().catch(()=>{}),refreshAt);
    this.refreshTimer?.unref?.();
  }

  lock(reason="session_invalid"){
    if(this.locked)return false;
    this.locked=true;this.token="";this.claims=null;clearTimeout(this.refreshTimer);this.refreshTimer=null;
    this.onAccountSwitch(reason);
    return true;
  }

  close(){
    clearTimeout(this.refreshTimer);this.refreshTimer=null;
    this.documentObject?.removeEventListener?.("visibilitychange",this.visibilityHandler);
  }

  listDocuments(){return this.request("/documents");}
  createDocument(document,programId){return this.request("/documents",{method:"POST",body:{id:document.id,programId,title:document.title,theme:document.theme,document}});}
  checkpoint(documentId,deviceId,baseRevision,snapshot){return this.request(`/documents/${encodeURIComponent(documentId)}/checkpoints/${encodeURIComponent(deviceId)}`,{method:"PUT",body:{baseRevision,snapshot}});}
  createVersion(documentId,baseRevision,snapshot,label){return this.request(`/documents/${encodeURIComponent(documentId)}/versions`,{method:"POST",body:{baseRevision,snapshot,label}});}
}

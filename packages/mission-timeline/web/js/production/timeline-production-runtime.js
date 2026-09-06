import {HybridIndexedDbAdapter} from "../../../matrix/hybrid-indexeddb-adapter.js";
import {TimelineProductionAuthClient} from "./timeline-auth-client.js";

function cacheName(origin,principalId,role){
  const environment=new URL(origin).hostname.toLowerCase().replace(/[^a-z0-9.-]/g,"-");
  const persona=String(role||"unknown").toLowerCase().replace(/[^a-z0-9_-]/g,"-");
  return `missionmed-timeline:${environment}:principal:${principalId}:persona:${persona}:v3`;
}

export async function prepareTimelineProductionRuntime({fetchImpl=globalThis.fetch.bind(globalThis),locationObject=globalThis.location}={}){
  let adapter=null;
  const authClient=new TimelineProductionAuthClient({
    fetchImpl,locationObject,
    onAccountSwitch:(reason)=>{
      adapter?.close?.();
      globalThis.dispatchEvent?.(new CustomEvent("mission-timeline-account-changed",{detail:{reason:String(reason||"session_invalid")}}));
      if(globalThis.document?.documentElement)globalThis.document.documentElement.hidden=true;
      locationObject.reload();
    }
  });
  const identity=await authClient.initialize();
  const listing=await authClient.listDocuments();
  const documents=Array.isArray(listing?.documents)?listing.documents:[];
  const active=documents[0]||null;
  const newDocumentId=`timeline_${crypto.randomUUID()}`;
  adapter=new HybridIndexedDbAdapter({
    apiClient:authClient,
    programId:String(active?.document?.programId||"missionmed-360:3893"),
    name:cacheName(locationObject.origin,identity.principalId,identity.role),
    version:1,
    remoteSyncConsent:false
  });
  adapter.newDocumentId=newDocumentId;
  await adapter.open();
  if(active?.document){
    const savedAt=String(active.updatedAt||new Date().toISOString());
    await adapter.reconcileAuthoritative([
      {store:"documents",key:active.document.id,value:{id:active.document.id,document:active.document,schemaVersion:active.document.schemaVersion,savedAt,sequence:Number(active.document.revision||0),reason:"SERVER_HYDRATION"}},
      {store:"settings",key:"uxr-002-active-document",value:{id:"uxr-002-active-document",documentId:active.document.id,updatedAt:savedAt}},
      {store:"settings",key:`remote-revision:${active.document.id}`,value:{id:`remote-revision:${active.document.id}`,revision:Number(active.document.revision||0),documentId:active.document.id,updatedAt:savedAt}}
    ],{documentId:active.document.id,serverRevision:Number(active.document.revision||0),serverSnapshot:active.document});
  }
  if(identity.remoteSyncAllowed)adapter.setRemoteSyncConsent(true);
  const issuedAt=new Date(Number(identity.claims.iat)*1000).toISOString();
  const expiresAt=new Date(Number(identity.claims.exp)*1000).toISOString();
  const administrator=identity.claims.is_wordpress_administrator===true;
  const assertion=Object.freeze({
    schemaVersion:"d1-405.timeline-entitlement.1",verified:true,enabled:true,eligible:true,
    allowance:administrator?"unlimited":1,currentUsage:documents.length,
    source:administrator?"wordpress-administrator":"learndash-course-3893",
    subjectKind:administrator?"administrator":"eligible-360",
    reason:administrator?"WordPress administrator eligibility verified.":"LearnDash course 3893 eligibility verified.",
    principalId:identity.principalId,wpUserId:identity.wpUserId,
    issuer:String(identity.claims.iss||""),audience:String(identity.claims.aud||""),
    membershipVersion:"learndash-course-3893:v1",decisionId:String(identity.claims.jti||""),
    verifiedAt:issuedAt,expiresAt
  });
  const expectedBinding=Object.freeze({
    principalId:identity.principalId,issuer:assertion.issuer,audience:assertion.audience,
    membershipVersion:assertion.membershipVersion
  });
  return Object.freeze({adapter,authClient,identity,documents,assertion,expectedBinding});
}

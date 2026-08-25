export const FOUNDER_PREFERENCE_SCHEMA="d1-timeline-founder-preferences.1";
export const FOUNDER_PREFERENCE_AUTHORITY_SOURCE="MISSIONMED_SERVER_APPROVED";

const KINDS=new Set([
  "CATEGORY_CORRECTION",
  "LABEL_CONVENTION",
  "VISIBILITY_CONVENTION",
  "LAYOUT_PREFERENCE",
  "PRESENTATION_CORRECTION"
]);
const PRESENTATION_FIXES=new Set([
  "AUTO_ARRANGE_EVENTS",
  "CLAMP_OBJECTS",
  "RESTORE_THEME_BACKGROUND",
  "RESTORE_DEFAULT_THEME"
]);
const VISIBILITIES=new Set(["PRIVATE","ADVISOR","INTERVIEWER"]);
const ALIGNMENTS=new Set(["LEFT","CENTER","RIGHT"]);
const clean=(value,maximum)=>String(value??"").replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,maximum);
const id=()=>globalThis.crypto?.randomUUID?.()||`founder-rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clone=(value)=>structuredClone(value);

function serverAuthority(value){
  if(typeof globalThis.window!=="undefined")throw new Error("FOUNDER_RULE_BROWSER_MUTATION_DENIED");
  const source=clean(value?.source,80);
  const registryId=clean(value?.registryId,160);
  const actor=clean(value?.approvedBy,120);
  const approvalRef=clean(value?.approvalRef,200);
  if(source!==FOUNDER_PREFERENCE_AUTHORITY_SOURCE||value?.canManageFounderPreferences!==true||!registryId||!actor||!approvalRef){
    throw new Error("FOUNDER_RULE_SERVER_APPROVAL_REQUIRED");
  }
  return Object.freeze({source,registryId,actor,approvalRef});
}

function normalizedPayload(kind,input){
  const source=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  if(kind==="CATEGORY_CORRECTION"){
    const fromCategoryId=clean(source.fromCategoryId,80);
    const toCategoryId=clean(source.toCategoryId,80);
    if(!fromCategoryId||!toCategoryId||fromCategoryId===toCategoryId)throw new Error("FOUNDER_RULE_CATEGORY_INVALID");
    return{fromCategoryId,toCategoryId};
  }
  if(kind==="LABEL_CONVENTION"){
    const categoryId=clean(source.categoryId,80);
    const preferredLabel=clean(source.preferredLabel,120);
    if(!categoryId||!preferredLabel)throw new Error("FOUNDER_RULE_LABEL_INVALID");
    return{categoryId,preferredLabel};
  }
  if(kind==="VISIBILITY_CONVENTION"){
    const eventType=clean(source.eventType,80).toUpperCase();
    const defaultVisibility=clean(source.defaultVisibility,40).toUpperCase();
    if(!eventType||!VISIBILITIES.has(defaultVisibility))throw new Error("FOUNDER_RULE_VISIBILITY_INVALID");
    return{eventType,defaultVisibility};
  }
  if(kind==="LAYOUT_PREFERENCE"){
    const objectKind=clean(source.objectKind,80).toUpperCase();
    const alignment=clean(source.alignment,20).toUpperCase();
    const minimumGap=Math.round(Number(source.minimumGap));
    if(!objectKind||!ALIGNMENTS.has(alignment)||!Number.isFinite(minimumGap)||minimumGap<0||minimumGap>240){
      throw new Error("FOUNDER_RULE_LAYOUT_INVALID");
    }
    return{objectKind,alignment,minimumGap};
  }
  if(kind==="PRESENTATION_CORRECTION"){
    const fixKind=clean(source.fixKind,100).toUpperCase();
    if(!PRESENTATION_FIXES.has(fixKind))throw new Error("FOUNDER_RULE_PRESENTATION_INVALID");
    return{fixKind};
  }
  throw new Error("FOUNDER_RULE_KIND_INVALID");
}

function registry(document,authority){
  if(!document||typeof document!=="object")throw new Error("FOUNDER_RULE_DOCUMENT_REQUIRED");
  const current=document.founderPreferences;
  if(current?.schemaVersion===FOUNDER_PREFERENCE_SCHEMA&&Array.isArray(current.rules)&&Array.isArray(current.audit)){
    if(current.authority?.source!==authority.source||current.authority?.registryId!==authority.registryId){
      throw new Error("FOUNDER_RULE_AUTHORITY_MISMATCH");
    }
    return current;
  }
  document.founderPreferences={
    schemaVersion:FOUNDER_PREFERENCE_SCHEMA,
    automaticLearning:false,
    authority:Object.freeze({source:authority.source,registryId:authority.registryId}),
    rules:[],
    audit:[]
  };
  return document.founderPreferences;
}

function audit(target,{action,ruleId,version,actor,approvalRef,at}){
  target.audit=[...target.audit.slice(-499),Object.freeze({
    id:id(),
    at:clean(at||new Date().toISOString(),64),
    action,
    ruleId,
    version,
    actor:clean(actor,120),
    approvalRef:clean(approvalRef,200)
  })];
}

export function addFounderPreferenceRule(document,input,{now=()=>new Date().toISOString(),makeId=id,authority}={}){
  const approved=serverAuthority(authority);
  const target=registry(document,approved);
  const kind=clean(input?.kind,80).toUpperCase();
  if(!KINDS.has(kind))throw new Error("FOUNDER_RULE_KIND_INVALID");
  const approvalRef=approved.approvalRef;
  const actor=approved.actor;
  const ruleId=clean(makeId(),160);
  const recordedAt=clean(now(),64);
  const rule={
    schemaVersion:FOUNDER_PREFERENCE_SCHEMA,
    id:ruleId,
    kind,
    status:"ACTIVE",
    activeVersion:1,
    versions:[Object.freeze({version:1,payload:Object.freeze(normalizedPayload(kind,input?.payload)),recordedAt,actor,approvalRef})]
  };
  target.rules=[...target.rules,rule];
  audit(target,{action:"CREATE",ruleId,version:1,actor,approvalRef,at:recordedAt});
  return clone(rule);
}

export function reviseFounderPreferenceRule(document,ruleId,input,{now=()=>new Date().toISOString(),authority}={}){
  const approved=serverAuthority(authority);
  const target=registry(document,approved);
  const rule=target.rules.find((item)=>item.id===ruleId);
  if(!rule)throw new Error("FOUNDER_RULE_NOT_FOUND");
  const approvalRef=approved.approvalRef;
  const actor=approved.actor;
  const version=Math.max(0,...rule.versions.map((item)=>Number(item.version)||0))+1;
  const recordedAt=clean(now(),64);
  rule.versions=[...rule.versions,Object.freeze({version,payload:Object.freeze(normalizedPayload(rule.kind,input?.payload)),recordedAt,actor,approvalRef})];
  rule.activeVersion=version;
  rule.status="ACTIVE";
  audit(target,{action:"REVISE",ruleId,version,actor,approvalRef,at:recordedAt});
  return clone(rule);
}

export function setFounderPreferenceRuleEnabled(document,ruleId,enabled,{authority,now=()=>new Date().toISOString()}={}){
  const approved=serverAuthority(authority);
  const target=registry(document,approved);
  const rule=target.rules.find((item)=>item.id===ruleId);
  if(!rule)throw new Error("FOUNDER_RULE_NOT_FOUND");
  const approvalRef=approved.approvalRef;
  const actor=approved.actor;
  rule.status=enabled?"ACTIVE":"DISABLED";
  audit(target,{action:enabled?"ENABLE":"DISABLE",ruleId,version:rule.activeVersion,actor,approvalRef,at:now()});
  return clone(rule);
}

export function rollbackFounderPreferenceRule(document,ruleId,version,{authority,now=()=>new Date().toISOString()}={}){
  const approved=serverAuthority(authority);
  const target=registry(document,approved);
  const rule=target.rules.find((item)=>item.id===ruleId);
  if(!rule||!rule.versions.some((item)=>item.version===version))throw new Error("FOUNDER_RULE_VERSION_NOT_FOUND");
  const approvalRef=approved.approvalRef;
  const actor=approved.actor;
  rule.activeVersion=version;
  rule.status="ACTIVE";
  audit(target,{action:"ROLLBACK",ruleId,version,actor,approvalRef,at:now()});
  return clone(rule);
}

export function activeFounderPreferenceRules(document,{authority}={}){
  const approved=serverAuthority(authority);
  const current=document?.founderPreferences;
  if(current?.schemaVersion!==FOUNDER_PREFERENCE_SCHEMA||!Array.isArray(current.rules))return[];
  if(current.authority?.source!==approved.source||current.authority?.registryId!==approved.registryId)return[];
  return current.rules.filter((rule)=>rule.status==="ACTIVE").flatMap((rule)=>{
    const version=rule.versions?.find((item)=>item.version===rule.activeVersion);
    return version?[Object.freeze({id:rule.id,kind:rule.kind,version:version.version,payload:clone(version.payload),approvalRef:version.approvalRef,authoritySource:approved.source})]:[];
  });
}

// UI state, save bookkeeping and export history do not change reviewed chronology.
// Facts, source references, scene geometry and presentation remain in the hash.
import {projectQualitySource022,QUALITY_SOURCE_EXCLUDED_FIELDS_022} from './quality-source-projection-022.js';
export const QUALITY_IGNORED_FIELDS_022=QUALITY_SOURCE_EXCLUDED_FIELDS_022;
function sorted(value){
  if(Array.isArray(value))return value.map(item=>sorted(item)??null);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined&&!(typeof value[key]==='string'&&value[key].startsWith('blob:'))&&key!=='resolvedUrl'&&key!=='previewUrl').map(key=>[key,sorted(value[key])]));
  return value;
}
export function qualitySourceText022(document){return JSON.stringify(sorted(projectQualitySource022(document)));}
export async function qualitySourceSha022(document){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(qualitySourceText022(document)));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}

export async function restoreServerGuardian022(document,serverDocument,{analyze,merge}){
  const envelope=serverDocument?.metadata?.qualityReport022?.ai?.providerAuthenticity;
  if(!envelope?.serverVerified||envelope.workflow!=='GUARDIAN'||envelope.documentId!==document.id||envelope.ownerPrincipalId!==document.studentOwnerId
    ||serverDocument.id!==document.id||serverDocument.studentOwnerId!==document.studentOwnerId)return null;
  const sourceText=qualitySourceText022(document);
  if(envelope.sourceSha256!==await qualitySourceSha022(document)||sourceText!==qualitySourceText022(document))return null;
  const report=merge(analyze(document,{stage:'AFTER_SERVER_RELOAD'}),{...structuredClone(envelope.payload),providerAuthenticity:structuredClone(envelope)});
  return{report,sourceText};
}

export async function persistQualityReport022(store,report){
  const before=qualitySourceText022(store.document),sourceSha256=await qualitySourceSha022(store.document);
  if(before!==qualitySourceText022(store.document))throw new Error('Timeline changed during review. Run Guardian again.');
  const checkedAt=new Date().toISOString();
  store.mutate('Record Guardian review',document=>{
    document.metadata={...(document.metadata||{}),qualitySummary022:{checkedAt,sourceSha256,issueCount:Number(report.findingCount??report.findings?.length??0),exportReady:report.exportReady===true,aiReview:report.ai?.status==='COMPLETE'&&!!report.ai?.providerReceipt},qualityReport022:structuredClone(report)};
  },{history:false,material:false});
  await store.saveNow('GUARDIAN_REVIEW');
  return{sourceText:before,sourceSha256,checkedAt};
}

export async function recordCompletedExport022(store,result){
  if(result?.completed!==true||result?.metadata?.downloaded!==true)throw new Error('The export download was not confirmed.');
  const completedAt=new Date().toISOString();
  const entry={filename:String(result.filename),downloaded:true,exportedAt:completedAt,completedAt,format:String(result.metadata.formatId||result.metadata.format||''),sourceSha256:await qualitySourceSha022(store.document)};
  store.mutate('Record completed export',document=>{
    document.metadata={...(document.metadata||{}),lastExport022:entry,exportHistory022:[entry,...(document.metadata?.exportHistory022||[])].slice(0,30)};
  },{history:false,material:false});
  await store.saveNow('EXPORT_COMPLETED');
  if(store.adapter.remoteSyncConsent===true){
    let result=await store.adapter.flush();
    // A scheduled adapter flush can already be finishing when saveNow queues
    // this export entry. Drain once more so a successful late checkpoint does
    // not surface as a false sync warning.
    if(Number(result?.pending||0)>0&&!result?.conflict)result=await store.adapter.flush();
    if(Number(result?.pending||0)>0||result?.conflict)throw new Error('Export history is waiting to sync.');
  }
  return entry;
}

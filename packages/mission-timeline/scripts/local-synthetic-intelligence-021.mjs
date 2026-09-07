// Local-only review route. No database, private object store or production identity.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OpenAiCvIntelligenceProvider } from '../src/intelligence/openai-cv-intelligence.ts';
import { CvIntelligenceService } from '../src/intelligence/cv-intelligence-service.ts';
import { extractExactCvSourceBlocks } from '../src/intelligence/cv-source-extractor.ts';
import { OpenAiTimelineWorkflowProvider } from '../src/intelligence/openai-timeline-ai-workflows.ts';
import { TimelineAiWorkflowService } from '../src/intelligence/timeline-ai-workflow-service.ts';
import { analyzeTimelineRescue } from '../src/intelligence/timeline-rescue-service.ts';
import { stableStringify } from '../src/core/canonical.ts';
import { analyzeTimelineQuality, deterministicFindingsForAi } from '../web/js/uxr-002/quality-guardian.js';
import { qualityInputFromDocument } from '../src/intelligence/timeline-ai-workflow-schema.ts';
import { THEMES_BY_ID } from '../web/js/uxr-002/themes.js';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const evidenceRoot = resolve(root, '_AI_HANDOFFS/from_codex/D1-TIMELINE-ASTRA6-AAA-FINAL-021/evidence/real-ai');
const consent = 'd1-021-synthetic-provider-review-1';
const principal = 'd1_021_synthetic_reviewer';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = {
  path: resolve(root, '_AI_HANDOFFS/from_cowork/D1-TIMELINE-FABLE5-STORYFORGE-AAA-019/evidence/fixtures/synthetic-cv.pdf'),
  sha256: 'd261c62ac4e71f123cc048d1db096af04126032ac4830ef6c8f8cacd09f4a81d',
  kind: 'CV', mimeType: 'application/pdf',
};
const apiKey = process.env.TIMELINE_AI_API_KEY || process.env.OPENAI_API_KEY || '';
const model = process.env.TIMELINE_AI_MODEL || 'gpt-6-astra';
const cvService = new CvIntelligenceService({
  provider: apiKey ? new OpenAiCvIntelligenceProvider({apiKey, model, timeoutMs:120000}) : null,
  expectedConsentVersion: consent, syntheticPrincipalIds: [principal],
});
const workflows = new TimelineAiWorkflowService(apiKey ? new OpenAiTimelineWorkflowProvider({apiKey,model,timeoutMs:120000}) : null,[principal]);
const context = {principalId:principal,role:'STUDENT',programIds:[],assignedDocumentIds:[],facultyGrants:[],serviceScopes:[],sessionId:'local-021',requestId:'local-021'};
const analysisCache = new Map();

async function sourceFor(sha256, kind) {
  const extraPath = process.env.D1_021_SYNTHETIC_ARTIFACT_MANIFEST;
  const extras = extraPath ? JSON.parse(await readFile(extraPath,'utf8')).files || [] : [];
  const entry = [fixture,...extras].find(item=>item.sha256===sha256 && (kind!=='CV'||item.kind==='CV'));
  if (!entry) throw Object.assign(new Error('Only registered synthetic fixture bytes can be sent to the provider.'),{status:403,code:'SYNTHETIC_FIXTURE_NOT_REGISTERED'});
  // Entries come from the operator-owned local manifest, never the request body.
  const bytes = await readFile(entry.path);
  if (hash(bytes)!==entry.sha256) throw Object.assign(new Error('Synthetic fixture checksum changed.'),{status:409,code:'SYNTHETIC_FIXTURE_HASH_CHANGED'});
  return {...entry,bytes,filename:basename(entry.path)};
}
function reviewDocument(input) {
  if (!input || !Array.isArray(input.events) || input.events.length>200) throw new Error('Invalid synthetic review document.');
  // Only the documented synthetic review route accepts this local snapshot; it confers no production access.
  return {...input,id:String(input.id||'timeline_021'),studentOwnerId:principal,programId:'synthetic_021',revision:Number(input.revision)||0};
}

// A known CV hash is not permission to send unrelated browser content. Registration
// is an operator-owned file boundary; a request cannot supply a path or whitelist.
export async function registeredSyntheticReviewDocument(input,{manifestPath=process.env.D1_021_SYNTHETIC_ARTIFACT_MANIFEST,read=readFile}={}) {
  const denied=()=>Object.assign(new Error('This local synthetic prototype requires the Timeline facts to be registered before AI review. This is not a production authorization error.'),{status:403,code:'SYNTHETIC_DOCUMENT_NOT_REGISTERED'});
  if(!manifestPath||!input?.document||!Array.isArray(input.document.events)||input.document.events.length>200)throw denied();
  const manifest=JSON.parse(await read(manifestPath,'utf8'));
  const entries=(Array.isArray(manifest.files)?manifest.files:[]).filter(entry=>entry.kind==='DOCUMENT'&&
    (entry.sourceSha256===input.sourceSha256||(Array.isArray(entry.sourceSha256s)&&entry.sourceSha256s.includes(input.sourceSha256))));
  const requestedHash=hash(stableStringify(syntheticProviderFacts(input.document)));
  for(const entry of entries){
    if(typeof entry.path!=='string'||!entry.path.startsWith('/')||!/^[a-f0-9]{64}$/.test(entry.sha256||''))continue;
    const bytes=await read(entry.path);
    if(hash(bytes)!==entry.sha256)throw Object.assign(new Error('Registered synthetic document checksum changed.'),{status:409,code:'SYNTHETIC_DOCUMENT_HASH_CHANGED'});
    const document=JSON.parse(Buffer.from(bytes).toString('utf8'));
    if(hash(stableStringify(syntheticProviderFacts(document)))!==requestedHash)continue;
    return {document:reviewDocument(document),registration:{fileSha256:entry.sha256,factualSha256:requestedHash,sourceSha256:input.sourceSha256,binding:'EXACT_PROVIDER_VISIBLE_EVENT_FACTS'}};
  }
  throw denied();
}

export function syntheticProviderFacts(document) {
  return qualityInputFromDocument(reviewDocument(document)).events.sort((a,b)=>a.id.localeCompare(b.id));
}

export function syntheticQualityReviewPayload(current,registered) {
  const knownIds=new Set(registered.events.map(event=>String(event.id)));
  const report=analyzeTimelineQuality(current);
  // Finding messages can quote user-entered Advanced text, filenames or profile
  // values. Those stay local. Provider messages are fixed rule codes only.
  const findings=deterministicFindingsForAi(report).map((finding,index)=>({
    id:`local-rule-${index}-${finding.code}`,category:finding.category,code:finding.code,severity:finding.severity,
    elementIds:finding.elementIds.filter(id=>knownIds.has(id)),message:`MissionMed local rule: ${finding.code}.`
  }));
  const count=collection=>Math.min(500,Array.isArray(collection)?collection.length:0);
  const advanced=current.advanced||{};
  const backgroundKind=['theme','color','preset','upload'].includes(advanced.background?.kind)?advanced.background.kind:'unknown';
  const document=reviewDocument({
    id:registered.id,revision:Number.isSafeInteger(current.revision)?current.revision:0,
    events:registered.events,theme:Object.hasOwn(THEMES_BY_ID,String(current.theme))?current.theme:'keynote-classic',
    advanced:{background:{kind:backgroundKind},
      media:Array.from({length:count(advanced.media)},(_,i)=>({id:`local-media-${i}`})),
      textBlocks:Array.from({length:count(advanced.textBlocks)},(_,i)=>({id:`local-text-${i}`})),
      elements:Array.from({length:count(advanced.elements)},(_,i)=>({id:`local-element-${i}`}))}
  });
  return {document,findings};
}
async function saveEvidence(kind,result) {
  await mkdir(evidenceRoot,{recursive:true});
  const id=randomUUID();
  await writeFile(resolve(evidenceRoot,`${kind}-${id}.json`),JSON.stringify({kind,recordedAt:new Date().toISOString(),syntheticOnly:true,productionWrites:false,result},null,2)+'\n',{flag:'wx'});
}
async function analyze(kind,input) {
  if(input.consentVersion!==consent) throw Object.assign(new Error('Synthetic provider review consent is required.'),{status:409,code:'SYNTHETIC_CONSENT_REQUIRED'});
  if(kind==='cv') {
    const source=await sourceFor(input.sourceSha256,'CV');
    const key=`cv:${source.sha256}:${model}`;
    if(analysisCache.has(key))return {...analysisCache.get(key),cached:true};
    const doc={id:'timeline_021_synthetic',schemaVersion:'1',studentOwnerId:principal,programId:'synthetic_021',title:'Synthetic CV review',theme:'keynote-classic',revision:0,events:[]};
    const blocks=(await extractExactCvSourceBlocks(source.bytes,source.mimeType)).blocks;
    const record={id:'local_synthetic_cv',ownerPrincipalId:principal,documentId:doc.id,objectClass:'SOURCE',storageKey:'LOCAL_SYNTHETIC_FIXTURE',mimeType:source.mimeType,expectedBytes:source.bytes.length,expectedSha256:source.sha256,status:'CONFIRMED',createdAt:new Date().toISOString(),confirmedAt:new Date().toISOString()};
    const result=await cvService.analyze(context,doc,{record,bytes:source.bytes},{source:{objectId:record.id,sha256:source.sha256,mimeType:source.mimeType},blocks,documentType:'CV',existingEvents:[],consentVersion:consent,idempotencyKey:key},true);
    const output={...result,sourceBlocks:blocks,sourceScope:'LOCAL_SYNTHETIC_FIXTURE'};
    if(output.mode==='SERVER_AI' && output.providerReceipt?.responseId) analysisCache.set(key,output);
    await saveEvidence(kind,output);
    return output;
  }
  if(kind==='quality') {
    await sourceFor(input.sourceSha256,'CV');
    const {document:doc,registration}=await registeredSyntheticReviewDocument(input);
    const payload=syntheticQualityReviewPayload(input.document,doc);
    const analysis=await workflows.analyzeQuality(context,payload.document,payload.findings,true);
    const result={...analysis,syntheticDocumentRegistration:registration};
    await saveEvidence(kind,result);return result;
  }
  if(kind==='rescue') {
    // The observation provider only needs authorization identity and registered
    // source objects. Client biography snapshots and CV claims are not transmitted.
    const doc=reviewDocument({id:'timeline_021_synthetic_rescue',events:[],revision:0});
    const source=await sourceFor(input.sourceSha256,'RESCUE');
    const base=analyzeTimelineRescue(source,[]);
    let image=source.mimeType.startsWith('image/')?{bytes:source.bytes,mimeType:source.mimeType}:null;
    if(source.mimeType==='application/pdf') {
      // Local registered fixtures only: the production PDF/OCR boundary stays separate.
      const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
      const {createCanvas}=await import('@napi-rs/canvas');
      const task=getDocument({data:Uint8Array.from(source.bytes),isEvalSupported:false,useSystemFonts:true,useWorkerFetch:false});
      const pdf=await task.promise;
      try {
        if(pdf.numPages!==1)throw Object.assign(new Error('Use a single-page synthetic Timeline PDF for this local review.'),{status:422,code:'SYNTHETIC_SINGLE_PAGE_REQUIRED'});
        const page=await pdf.getPage(1), original=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(1920/original.width,1920/original.height)});
        const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
        await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'}).promise;
        image={bytes:canvas.toBuffer('image/png'),mimeType:'image/png'};
      } finally {await pdf.destroy();}
    }
    const ai=await workflows.observeRescue(context,doc,{artifactSha256:source.sha256,format:base.format,pageOrSlideCount:base.slideOrPageCount,objects:base.objects,...(image?{image}:{})},true);
    const rescue=analyzeTimelineRescue({...source,visualObservations:ai.observations},[]);
    const result={ai,rescue,...(image?{renderedVisionInput:{mimeType:image.mimeType,sha256:hash(image.bytes),bytes:image.bytes.length}}:{})};await saveEvidence(kind,result);return result;
  }
  throw Object.assign(new Error('Unknown local review route.'),{status:404});
}

export async function handleLocalSyntheticIntelligence(request,response,url,headers) {
  if(!url.pathname.startsWith('/api/prototype-021/'))return false;
  const respond=(status,payload)=>{response.writeHead(status,{...headers,'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(payload));};
  const host=String(request.headers.host||'');
  const expectedOrigin=`http://${host}`;
  if(!/^(localhost|127\.0\.0\.1):\d+$/.test(host) || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress) || (request.headers.origin && request.headers.origin!==expectedOrigin)) {respond(403,{error:{code:'LOCAL_ORIGIN_REQUIRED'}});return true;}
  if(url.pathname.endsWith('/capabilities')&&request.method==='GET') {
    respond(200,{scope:'LOCAL_SYNTHETIC_ONLY',providerConfigured:Boolean(apiKey),model:apiKey?model:null,consentVersion:consent,fixtureSha256:fixture.sha256,productionWrites:false});return true;
  }
  if(request.method!=='POST'||request.headers['x-timeline-synthetic-fixture']!=='021'||!String(request.headers['content-type']).startsWith('application/json')) {respond(403,{error:{code:'LOCAL_SYNTHETIC_REQUEST_REQUIRED'}});return true;}
  try {
    const chunks=[];let size=0;
    for await(const chunk of request){size+=chunk.length;if(size>2*1024*1024)throw Object.assign(new Error('Review input is too large.'),{status:413});chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result=await analyze(url.pathname.split('/').pop(),input);respond(200,result);
  } catch(error) {respond(error.status||400,{error:{code:error.code||'LOCAL_REVIEW_FAILED',message: error.code?.startsWith('SYNTHETIC_')?error.message:'The local review could not complete. Your Timeline was not changed.'}});}
  return true;
}

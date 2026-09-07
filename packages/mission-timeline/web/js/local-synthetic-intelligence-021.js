import { mergeCvSourceCoverage } from './uxr-002/cv-source-coverage-021.js';
import { createD1408PdfIntakeAdapter, mapCvIntelligenceCandidateToUxr } from './uxr-002/intake-d1-408-adapter.js';
import { rescueVisibleReviewFields } from './uxr-002/rescue-profile-intake-021.js';

const enabled = typeof window !== 'undefined' && ['localhost','127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).get('prototype') === '021'
  && new URLSearchParams(location.search).get('ai') === 'synthetic';

if(enabled) {
  const capabilities = fetch('/api/prototype-021/capabilities').then(response=>response.ok?response.json():null).catch(()=>null);
  const base = createD1408PdfIntakeAdapter();
  const digest = async file => [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const request = async (kind,input,signal) => {
    const cap = await capabilities;
    if(!cap?.providerConfigured) throw Object.assign(new Error('The local synthetic AI service is unavailable. Your Timeline was not changed.'),{code:'LOCAL_SYNTHETIC_AI_UNAVAILABLE'});
    const response=await fetch(`/api/prototype-021/${kind}`,{method:'POST',headers:{'content-type':'application/json','x-timeline-synthetic-fixture':'021'},body:JSON.stringify({...input,consentVersion:cap.consentVersion}),signal});
    const result=await response.json();
    if(!response.ok)throw Object.assign(new Error(result.error?.message||'Local synthetic review could not complete.'),{code:result.error?.code});
    return result;
  };
  const rescueCandidate = (candidate,file,sha256) => ({
    id:String(candidate.id),categoryId:({usmle:'exams',th:'clinical',cl:'clinical',res:'research'})[candidate.categoryId]||candidate.categoryId,
    title:candidate.title,startDate:candidate.startDate,endDate:candidate.endDate||null,eventType:candidate.timelineKind==='milestone'?'milestone':'duration',
    openEnded:Boolean(candidate.openEnded),confidence:Math.min(.74,Number(candidate.confidence?.score)||0),
    confidenceDetails:{summary:candidate.confidence?.reasons||[],source:'Timeline Rescue'},sourceSnippet:candidate.provenance?.[0]?.sourceText||'',
    provenance:(candidate.provenance||[]).map(item=>({...item,pageNumber:item.pageOrSlide,sourceDocumentName:file.name,sourceExcerpt:item.sourceText})),
    inferredFields:(candidate.provenance||[]).filter(item=>item.support!=='SOURCE_FACT').map(()=>({field:'dates',reason:'Recovered from geometry or vision; confirm before accepting.'})),
    warnings:candidate.uncertainties||[],notes:'',visibilityState:'INTERVIEWER_SAFE',decision:'undecided',
    fields:{rescueReviewRequired:true,institution:String(candidate.institution||''),siteName:String(candidate.institution||''),
      ...(candidate.categoryId==='education'?{medicalSchool:String(candidate.institution||'')}:{ }),
      ...(candidate.categoryId==='work'?{organization:String(candidate.institution||'')}:{ }),
      datePrecision:candidate.datePrecision?structuredClone(candidate.datePrecision):null,mappingReviewRequired:candidate.categoryId==='unclassified',rescueArtifactSha256:sha256,canonicalType:candidate.categoryId==='unclassified'?'UNCLASSIFIED':'TIMELINE_RESCUE_EVENT',...rescueVisibleReviewFields(candidate)},
  });
  const client=Object.freeze({
    scope:'LOCAL_SYNTHETIC_ONLY',
    async analyzeQuality(document,deterministicFindings=[]) {
      const cap=await capabilities;
      return request('quality',{document,deterministicFindings,sourceSha256:cap?.fixtureSha256});
    },
    async extract(input={}) {
      if(input.file?.timelineRescue===true) {
        const sha256=await digest(input.file);
        const document=window.D1_407F_ENGINEERING?.store?.document||{id:'timeline_021',events:[],revision:0};
        const result=await request('rescue',{sourceSha256:sha256,document},input.signal);
        const candidates=(result.rescue?.candidates||[]).map(candidate=>rescueCandidate(candidate,input.file,sha256));
        return {readable:true,outcome:candidates.length?'ready-for-review':'empty',candidates,sourceBlocks:[],
          sourceDocument:{name:input.file.name,sha256,mimeType:input.file.type,fileSize:input.file.size,custody:'LOCAL_SYNTHETIC_FIXTURE',effectiveType:'TIMELINE_RESCUE'},
          parser:{version:result.rescue.schemaVersion,effectiveType:'TIMELINE_RESCUE',detectedType:'TIMELINE_RESCUE',networkCalls:true,
            intelligenceMode:result.ai?.providerReceipt?.responseId?'SERVER_AI':'TIMELINE_RESCUE',provider:result.ai?.provider,model:result.ai?.model,
            providerReceipt:result.ai?.providerReceipt,analysisId:result.ai?.analysisId,aiStatus:result.ai?.status,
            unresolvedQuestions:result.rescue.unresolvedQuestions||[],qualitySuggestions:[],warnings:result.rescue.warnings||[],
            cleanupProposal:result.rescue.cleanupProposal,reconciliation:result.rescue.reconciliation},qualitySuggestions:[]};
      }
      const local=await base.extract(input);
      if(!local?.readable||!local.sourceDocument?.sha256)return local;
      try {
        const analysis=await request('cv',{sourceSha256:local.sourceDocument.sha256},input.signal);
        if(analysis.mode!=='SERVER_AI'||!analysis.providerReceipt?.responseId) return {...local,parser:{...local.parser,intelligenceMode:'LOCAL_LIMITED',fallbackReason:analysis.fallbackReason||'PROVIDER_RECEIPT_UNAVAILABLE'}};
        const sourceBlocks=[...(analysis.sourceBlocks||[]),...(local.sourceBlocks||[])];
        const mapped=analysis.candidates.map(candidate=>mapCvIntelligenceCandidateToUxr(candidate,{sourceDocument:local.sourceDocument,sourceBlocks}));
        const {candidates,sourceRecoveryCount}=mergeCvSourceCoverage(mapped,local.candidates||[]);
        return {...local,sourceBlocks,candidates,sourceDocument:{...local.sourceDocument,custody:'LOCAL_SYNTHETIC_FIXTURE',analysisId:analysis.analysisId},
          parser:{...local.parser,intelligenceMode:'SERVER_AI',networkCalls:true,analysisId:analysis.analysisId,provider:analysis.provider,model:analysis.model,
            providerReceipt:analysis.providerReceipt,schemaVersion:analysis.schemaVersion,promptVersion:analysis.promptVersion,
            reviewSummary:analysis.reviewSummary,prefillSummary:analysis.prefillSummary,rejectedCandidateCount:analysis.rejectedCandidateCount,sourceRecoveryCount,
            qualitySuggestions:(analysis.qualitySuggestions||[]).filter(item=>!(item.source==='DETERMINISTIC'&&item.reason==='The timeline has no events.')),unresolvedQuestions:analysis.unresolvedQuestions||[],cached:analysis.cached===true}};
      } catch(error) {
        if(error?.name==='AbortError')throw error;
        return {...local,parser:{...local.parser,intelligenceMode:'LOCAL_LIMITED',fallbackReason:error.code||'PROVIDER_UNAVAILABLE',aiUnavailableMessage:error.message}};
      }
    },
  });
  window.D1_LOCAL_SYNTHETIC_AI=client;
  window.D1_TIMELINE_INTAKE_ADAPTER=Object.freeze({...base,...client,capability:{...base.capability,mode:'local-synthetic-server-ai',networkCalls:true}});
}

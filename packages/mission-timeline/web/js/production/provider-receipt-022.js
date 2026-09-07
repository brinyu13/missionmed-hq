/** Structural display check. Provider calls and receipt creation belong to the
 * authenticated API; a display check never authorizes a model call. */
export function verifiedProviderReceipt022(receipt){return Boolean(receipt?.responseId&&receipt?.model&&receipt?.store===false&&/^[a-f0-9]{64}$/.test(receipt?.inputSha256||'')&&/^[a-f0-9]{64}$/.test(receipt?.outputSha256||''));}

/** Call only with a freshly authenticated API document. A flag recovered from
 * IndexedDB is not verification; the API rechecks every envelope signature. */
export function reconcileRestoredProviderTruth022(document,serverDocument){
  const verified=new Map();
  const sameSubject=serverDocument?.id===document?.id&&serverDocument?.studentOwnerId===document?.studentOwnerId;
  function collect(value){
    if(!value||typeof value!=='object')return;
    const envelope=value.providerAuthenticity;
    if(envelope?.serverVerified===true&&envelope.documentId===document.id&&envelope.ownerPrincipalId===document.studentOwnerId
      &&/^[a-f0-9]{64}$/.test(envelope.signature||'')&&verifiedProviderReceipt022(envelope.payload?.providerReceipt))verified.set(envelope.signature,envelope);
    for(const [key,item] of Object.entries(value))if(key!=='providerAuthenticity')collect(item);
  }
  if(sameSubject)collect(serverDocument);
  function reconcile(value){
    if(!value||typeof value!=='object')return;
    const envelope=verified.get(value.providerAuthenticity?.signature);
    const hadAi=value.providerReceipt||value.providerAuthenticity||value.intelligenceMode==='SERVER_AI'||value.mode==='SERVER_AI';
    for(const [key,item] of Object.entries(value))if(key!=='providerAuthenticity')reconcile(item);
    delete value.providerAuthenticity;delete value.providerReceipt;delete value.serverVerified;
    if(envelope){
      value.providerAuthenticity=structuredClone(envelope);
      value.providerReceipt=structuredClone(envelope.payload.providerReceipt);
      value.founderStandardProvenance=structuredClone(envelope.payload.founderStandardProvenance||null);
    }else if(hadAi){
      delete value.founderStandardProvenance;delete value.provider;delete value.model;
      if(value.intelligenceMode==='SERVER_AI')value.intelligenceMode='LOCAL_LIMITED';
      if(value.mode==='SERVER_AI')value.mode='LOCAL_LIMITED';
      if(value.status==='COMPLETE')value.status='UNAVAILABLE';
    }
  }
  reconcile(document);
  // Merged findings/summary are client-editable even when they hold a real receipt.
  if(document.metadata){delete document.metadata.qualityReport022;delete document.metadata.qualitySummary022;}
  return document;
}

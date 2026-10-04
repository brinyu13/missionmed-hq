import { digest } from './domain.mjs';
import { fail, text, hash } from './ledger.mjs';
import { assessAIProposal, matchChaseReceipt } from './ingestion.mjs';
export function accountingAnomalies(expenses){
 const findings=[],seen=new Map();
 for(const row of expenses){
  const key=row.vendor.toLowerCase()+':'+row.invoiceNumber,prior=seen.get(key);
  if(prior)findings.push({kind:prior.amountCents===row.amountCents&&prior.evidenceSha256===row.evidenceSha256?'DUPLICATE':'CONFLICT',expenseId:row.id,sourceSha256:row.evidenceSha256});
  if(row.periodStart>row.periodEnd)findings.push({kind:'INVALID_SERVICE_PERIOD',expenseId:row.id,sourceSha256:row.evidenceSha256});
  if(!row.evidenceSha256||row.state==='NEEDS_VERIFICATION')findings.push({kind:'CUSTODY_OR_REVIEW_PENDING',expenseId:row.id,sourceSha256:row.evidenceSha256||null});
  seen.set(key,row);
 }
 return findings;
}
// Shadow workers may stage proposals and exceptions. They never certify, apply credits, dispatch money or complete payments.
export class PartnerAccountingWorker{
 constructor({store,vendor,gmail,ai=null,mode='disabled',aliases={}}={}){this.store=store;this.vendor=vendor;this.gmail=gmail;this.ai=ai;this.mode=mode;this.aliases=aliases;}
 async run(actor,requestId){
  if(this.mode!=='shadow')return {state:'DISABLED',posted:false,moneyMoved:false};
  if(!actor?.active||actor.key!=='brian'||!this.store)fail('Explicit Brian shadow worker binding required',403);
  text(requestId,'Worker request',120);
  const view=await this.store.view(actor),admin=view.admin;if(!admin)fail('Private accounting view required',403);
  const result={state:'SHADOW',expenses:[],receiptMatches:[],exceptions:[],ai:[],anomalies:accountingAnomalies(admin.expenses),posted:false,moneyMoved:false};
  try{
   const discovery=await this.vendor?.discover(admin.expenses);
   for(const proposal of discovery?.proposals||[]){
    const key='vendor:'+digest({sourceSha256:proposal.evidenceSha256,vendor:proposal.vendor,invoiceNumber:proposal.invoiceNumber});
    result.expenses.push(await this.store.execute(actor,'ingest',key,proposal));
   }
   for(const held of discovery?.held||[])result.exceptions.push({kind:'VENDOR_EVIDENCE',reason:held.reason,sourceSha256:held.proposal.evidenceSha256});
  }catch(error){result.exceptions.push({kind:'VENDOR_UNAVAILABLE',reason:'Authoritative vendor discovery is unavailable; existing ledger preserved'});}
  try{
   const envelope=await this.gmail?.receipts({requestId,eligibleObligations:admin.obligations.filter(x=>['OPEN','PARTIAL'].includes(x.status)).map(x=>({id:x.id,partner:x.partner,amountCents:x.amountCents+(x.adjustmentAppliedCents||0)-(x.creditAppliedCents||0)-x.appliedCents,revision:x.revision,snapshotHash:x.snapshotHash,createdAt:x.createdAt,currency:'USD'}))});
   for(const receipt of envelope?.receipts||[]){
    const match=matchChaseReceipt(receipt,admin.obligations,{aliases:this.aliases,consumedFingerprints:admin.payments.map(x=>x.fingerprint),consumedMessages:admin.payments.map(x=>x.messageFingerprint).filter(Boolean)});
    const proposal={kind:'receipt_review',sourceSha256:receipt.evidenceSha256,sourceId:receipt.fingerprint,summary:match.matched?'Exactly one eligible receipt match; review before canonical completion':match.reason,
     fields:match.matched?match:{amountCents:receipt.amountCents,receivedAt:receipt.receivedAt,reason:match.reason,fingerprint:receipt.fingerprint},insights:[]};
    hash(proposal.sourceSha256);
    await this.store.execute(actor,'stageProposal','receipt:'+receipt.fingerprint,proposal);
    (match.matched?result.receiptMatches:result.exceptions).push(match);
   }
  }catch{result.exceptions.push({kind:'RECEIPT_BRIDGE_UNAVAILABLE',reason:'Receipt verification unavailable; no payment marked verified'});}
  // AI receives only explicit structured source records through a separately configured adapter; no raw mailbox body.
  if(this.ai){
   try{const response=await this.ai.proposals(admin.expenses.map(({vendor,invoiceNumber,amountCents,currency,periodStart,periodEnd,category,description,evidenceSha256,assetId})=>({vendor,invoiceNumber,amountCents,currency,periodStart,periodEnd,category,description,sha256:evidenceSha256,assetId,extractedAmountCents:amountCents})));
    if(!Array.isArray(response)||response.length>100)fail('AI batch exceeds bounded census');
    for(const row of response){const proposed=assessAIProposal(row,admin.expenses.map(x=>({sha256:x.evidenceSha256,assetId:x.assetId,extractedAmountCents:x.amountCents,currency:x.currency,invoiceNumber:x.invoiceNumber})));
     const proposal={kind:'ai_expense',sourceSha256:proposed.evidenceSha256,sourceId:proposed.proposalId,summary:'AI-assisted source-grounded proposal; human custody review required',fields:proposed,insights:proposed.insights};
     result.ai.push(await this.store.execute(actor,'stageProposal','ai:'+proposed.proposalId,proposal));
    }
   }catch{result.exceptions.push({kind:'AI_PROPOSAL_HELD',reason:'Unverified or unavailable AI output excluded'});}
  }
  return result;
 }
}

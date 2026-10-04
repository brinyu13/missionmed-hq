import { createHmac, timingSafeEqual } from 'node:crypto';
import { digest, cents, PARTNERS } from './domain.mjs';
import { fail, hash, date, text } from './ledger.mjs';
export const VENDOR_CENSUS=Object.freeze(['Kinsta','Cloudflare','Supabase','Replicate','OpenAI API','ChatGPT','Anthropic','Google Workspace','Railway','WooCommerce','LearnDash','Elementor','Formidable']);
export const normalizePayer=value=>String(value||'').normalize('NFKC').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function proposeExpense(input,{sourceSha256,assetId,sourceKind}) {
 hash(sourceSha256);text(assetId,'Private evidence reference');text(sourceKind,'Evidence source');
 const vendor=text(input.vendor,'Vendor'), invoiceNumber=text(input.invoiceNumber,'Invoice number');
 let amountCents;try{amountCents=cents(input.amountCents);}catch{fail('Extraction amount must be exact integer cents',400);}
 date(input.periodStart);date(input.periodEnd);
 if(input.currency!=='USD'||input.periodStart>input.periodEnd)fail('Extracted currency or service period requires review',400);
 return {vendor,invoiceNumber,amountCents,currency:'USD',periodStart:input.periodStart,periodEnd:input.periodEnd,
  category:text(input.category,'Category'),description:text(input.description,'Service description',1000),
  evidenceSha256:sourceSha256,assetId,source:sourceKind,
  proposalId:digest({vendor:vendor.toLowerCase(),invoiceNumber,sourceSha256}),state:'NEEDS_VERIFICATION',included:false,aiMayPost:false};
}
export function classifyExpenseCandidates(candidates,known=[]) {
 const accepted=[],held=[];
 for(const row of candidates){
  const matches=[...known,...accepted].filter(x=>(x.vendor.toLowerCase()===row.vendor.toLowerCase()&&x.invoiceNumber===row.invoiceNumber)||x.evidenceSha256===row.evidenceSha256);
  if(matches.length){const exact=matches.every(x=>x.vendor.toLowerCase()===row.vendor.toLowerCase()&&x.invoiceNumber===row.invoiceNumber&&x.amountCents===row.amountCents&&x.evidenceSha256===row.evidenceSha256);held.push({proposal:row,reason:exact?'DUPLICATE':'CONFLICTING_EVIDENCE'});}
  else accepted.push(row);
 }
 return {proposals:accepted,held,moneyMoved:false,posted:false};
}
export function assessAIProposal(proposal,sources) {
 // The model's prose is untrusted. Only grounded fields become reviewable proposals.
 if(!proposal||Object.keys(proposal).some(k=>!['sourceSha256','vendor','invoiceNumber','amountCents','currency','periodStart','periodEnd','category','description','insights'].includes(k)))fail('Unsupported AI output field',400);
 const source=sources.find(x=>x.sha256===proposal.sourceSha256);if(!source)fail('AI output lacks source custody');
 if(source.extractedAmountCents!==proposal.amountCents||source.currency!==proposal.currency||source.invoiceNumber!==proposal.invoiceNumber)fail('AI accounting fields conflict with deterministic extraction');
 const result=proposeExpense(proposal,{sourceSha256:source.sha256,assetId:source.assetId,sourceKind:'ai_proposal'});
 result.insights=(proposal.insights||[]).filter(x=>typeof x==='string'&&x.length<=500).slice(0,8);
 return result;
}
export function authenticateReceiptEnvelope(raw,envelope,secret,{now=Date.now(),maxAgeMs=300000}={}) {
 if(!secret||secret.length<32||typeof raw!=='string'||raw.length>250000)fail('Receipt bridge is not configured',503);
 const timestamp=Number(envelope.timestamp), nonce=String(envelope.nonce||''), signature=String(envelope.signature||'');
 if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>maxAgeMs||!/^[a-zA-Z0-9-]{16,100}$/.test(nonce)||!/^[0-9a-f]{64}$/.test(signature))fail('Receipt envelope is stale or malformed',403);
 const expected=createHmac('sha256',secret).update(timestamp+'\n'+nonce+'\n'+raw).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))fail('Receipt transport signature invalid',403);
 let receipts;try{receipts=JSON.parse(raw);}catch{fail('Receipt payload malformed',400);}
 if(!Array.isArray(receipts)||receipts.length>100)fail('Receipt batch exceeds bounded protocol',400);
 return receipts.map(row=>({...row,transportVerified:true}));
}
export function matchChaseReceipt(receipt,obligations,{aliases,consumedFingerprints=[],consumedMessages=[],recipient='Mission Global Group LLC',destination='info@missionmedinstitute.com'}) {
 const hold=reason=>({state:'NEEDS_REVIEW',reason,matched:false,moneyMoved:false});
 if(receipt?.transportVerified!==true||receipt.protocolVersion!==2||receipt.authentication!=='gmail_chase_dkim_dmarc_pass')return hold('UNAUTHENTICATED_RECEIPT');
 if(receipt.recipient!==recipient||receipt.destination!==destination||receipt.currency!=='USD')return hold('WRONG_DESTINATION_OR_CURRENCY');
 try{hash(receipt.fingerprint);hash(receipt.messageFingerprint);cents(receipt.amountCents);}catch{return hold('INVALID_RECEIPT');}
 if(receipt.amountCents<=0||consumedFingerprints.includes(receipt.fingerprint)||consumedMessages.includes(receipt.messageFingerprint))return hold('CONSUMED_OR_INVALID_RECEIPT');
 const payer=normalizePayer(receipt.payer);
 const partners=PARTNERS.filter(p=>(aliases?.[p]||[]).some(x=>normalizePayer(x)===payer));
 if(partners.length!==1)return hold('AMBIGUOUS_OR_UNKNOWN_PAYER');
 const received=Date.parse(receipt.receivedAt);
 if(!Number.isFinite(received))return hold('INVALID_RECEIVED_TIME');
 const matches=obligations.filter(o=>o.partner===partners[0]&&o.currency==='USD'&&['OPEN','PARTIAL'].includes(o.status)
  &&o.amountCents+(o.adjustmentAppliedCents||0)-(o.creditAppliedCents||0)-o.appliedCents===receipt.amountCents&&Date.parse(o.createdAt)<=received
  &&(!o.expiresAt||Date.parse(o.expiresAt)>=received));
 // Identical amounts across periods are deliberately ambiguous; never pick the latest.
 if(matches.length!==1)return hold(matches.length?'MULTIPLE_ELIGIBLE_OBLIGATIONS':'NO_ELIGIBLE_OBLIGATION');
 return {state:'MATCHED_PROPOSAL',matched:true,obligationId:matches[0].id,partner:partners[0],expectedRevision:matches[0].revision,expectedSettlementRevision:matches[0].settlementRevision||0,snapshotHash:matches[0].snapshotHash,
  fingerprint:receipt.fingerprint,messageFingerprint:receipt.messageFingerprint,amountCents:receipt.amountCents,receivedAt:receipt.receivedAt,
  method:'authenticated_chase_gmail',evidenceSha256:receipt.evidenceSha256,transportVerified:true,moneyMoved:false};
}

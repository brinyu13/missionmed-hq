import { randomUUID } from 'node:crypto';
import { PARTNERS, LABELS, cents, allocateExpenses, digest } from './domain.mjs';
export function fail(message, status = 409) { throw Object.assign(new Error(message), { status }); }
export function text(value, name, limit = 200) { if (typeof value !== 'string' || !value.trim() || value.length > limit) fail(name + ' is required',400); return value.trim(); }
export function date(value) { const parsed=new Date(value+'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) fail('Invalid calendar date',400);return value; }
export function hash(value) { if (!/^[0-9a-f]{64}$/.test(String(value))) fail('SHA-256 provenance is required',400);return value; }
function actorKey(actor) { if (!actor?.active || !PARTNERS.includes(actor.key)) fail('Explicit active partner membership required',403);return actor.key; }
function admin(actor) { if (actorKey(actor) !== 'brian') fail('Brian accounting authority required',403); }
const clone = value => structuredClone(value);
const safeCents = value => { try { return cents(value); } catch { fail('Integer cents required',400); } };
function signedCents(value) { if(!Number.isSafeInteger(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)fail('Integer adjustment cents required',400);return value; }
function initial() { return { revision:0, expenses:[], periods:[], obligations:[], claims:[], payments:[], adjustments:[], applications:[], methods:[], consents:[], proposals:[], audit:[], requests:{} }; }
export const remainingCents=o=>o.amountCents+(o.adjustmentAppliedCents||0)-(o.creditAppliedCents||0)-o.appliedCents;

// Disposable local/test domain engine. Production uses private transactional RPCs, never this in-memory repository.
export class PartnerLedger {
 constructor({state, now=()=>new Date().toISOString(), uuid=randomUUID}={}) { this.state=clone(state||initial());this.now=now;this.uuid=uuid;this.tail=Promise.resolve(); }
 async transact(actor, requestId, command, payload, operation) {
  actorKey(actor);text(requestId,'Idempotency key',160);
  const scope=actor.key+':'+requestId, fingerprint=digest({command,payload});
  const run=async()=> {
   const previous=this.state.requests[scope];
   if(previous){if(previous.fingerprint!==fingerprint)fail('Idempotency key reused for a different request');return clone({...previous.result,duplicate:true});}
   const draft=clone(this.state), result=await operation(draft);
   draft.audit.push({id:this.uuid(),actor:actor.key,command,requestId,at:this.now(),resultHash:digest(result)});
   draft.requests[scope]={fingerprint,result};this.state=draft;return clone(result);
  };
  const pending=this.tail.then(run);this.tail=pending.catch(()=>{});return pending;
 }
 async ingest(actor, requestId, candidate) {
  admin(actor);
  const vendor=text(candidate.vendor,'Vendor'), invoiceNumber=text(candidate.invoiceNumber,'Invoice number');
  const amountCents=safeCents(candidate.amountCents), evidenceSha256=hash(candidate.evidenceSha256);
  const periodStart=date(candidate.periodStart),periodEnd=date(candidate.periodEnd);
  if(periodStart>periodEnd||candidate.currency!=='USD')fail('Supported currency/service period required',400);
  const source=text(candidate.source,'Evidence source',40), category=text(candidate.category,'Category',80);
  const normalized={vendor,invoiceNumber,amountCents,evidenceSha256,periodStart,periodEnd,currency:'USD',source,category,
   assetId:text(candidate.assetId,'Private asset reference',200),description:text(candidate.description,'Service description',1000),
   taxCents:safeCents(candidate.taxCents??0),discountCents:safeCents(candidate.discountCents??0)};
  return this.transact(actor,requestId,'ingest',normalized,s=>{
   const existing=s.expenses.find(x=>x.vendor.toLowerCase()===vendor.toLowerCase()&&x.invoiceNumber===invoiceNumber);
   if(existing) { if(existing.amountCents!==amountCents||existing.evidenceSha256!==evidenceSha256)fail('Conflicting invoice evidence requires review');return {expense:existing,duplicate:true}; }
   if(s.expenses.some(x=>x.evidenceSha256===evidenceSha256))fail('Evidence already belongs to another invoice');
   const row={id:this.uuid(),...normalized,state:'NEEDS_VERIFICATION',included:false,createdAt:this.now()};
   s.expenses.push(row);return {expense:row};
  });
 }
 async reviewExpense(actor, requestId, {expenseId,decision,evidenceSha256,reason,expectedRevision}) {
  admin(actor);hash(evidenceSha256);text(reason,'Review rationale',1000);
  if(!['approve','exclude'].includes(decision))fail('Unknown review decision',400);
  return this.transact(actor,requestId,'expense-review',{expenseId,decision,evidenceSha256,reason,expectedRevision},s=>{
   if(s.revision!==expectedRevision)fail('Ledger revision changed');
   const row=s.expenses.find(x=>x.id===expenseId);if(!row)fail('Expense not found',404);
   if(row.state!=='NEEDS_VERIFICATION')fail('Expense already reviewed; use a new adjustment');
   if(row.evidenceSha256!==evidenceSha256)fail('Review evidence does not match invoice');
   row.state=decision==='approve'?'APPROVED':'EXCLUDED';row.included=decision==='approve';row.reviewedBy=actor.key;row.reason=reason;s.revision++;
   return {expense:row,revision:s.revision};
  });
 }
 async certifyPeriod(actor, requestId, payload) {
  admin(actor);const {expenseIds,openingBalances,expectedRevision,coverageCutoff,periodStart,periodEnd,allocationRuleVersion,certificationEvidenceSha256}=payload;
  date(coverageCutoff);date(periodStart);date(periodEnd);hash(certificationEvidenceSha256);
  if(periodStart>periodEnd||coverageCutoff>periodEnd||allocationRuleVersion!=='equal-third-brian-residual-v1')fail('Invalid certification contract',400);
  if(!Array.isArray(expenseIds)||!expenseIds.length||new Set(expenseIds).size!==expenseIds.length)fail('Explicit unique expense census required',400);
  if(!openingBalances||Object.keys(openingBalances).sort().join()!==PARTNERS.slice().sort().join())fail('All three certified opening balances required',400);
  PARTNERS.forEach(p=>signedCents(openingBalances[p]));
  return this.transact(actor,requestId,'certify-period',payload,s=>{
   if(s.revision!==expectedRevision)fail('Ledger revision changed');
   if(s.periods.some(p=>p.periodStart<=periodEnd&&p.periodEnd>=periodStart))fail('Coverage overlaps a certified period');
   if(s.periods.length && PARTNERS.some(p=>openingBalances[p]!==0))fail('Subsequent periods carry the existing ledger, not repeated opening balances');
   const expenses=expenseIds.map(id=>s.expenses.find(x=>x.id===id));
   if(expenses.some(x=>!x||x.state!=='APPROVED'||!x.included))fail('Unsupported or unapproved expense in census');
   if(s.periods.some(p=>p.expenseIds.some(id=>expenseIds.includes(id))))fail('Expense already allocated');
   const allocation=allocateExpenses(expenses), revision=s.revision+1;
   const snapshotHash=digest({expenses,openingBalances,coverageCutoff,periodStart,periodEnd,allocationRuleVersion,revision});
   const period={id:this.uuid(),revision,periodStart,periodEnd,coverageCutoff,expenseIds,openingBalances,allocationRuleVersion,certificationEvidenceSha256,snapshotHash,certifiedBy:'brian',certifiedAt:this.now()};
   s.periods.push(period);
   for(const p of PARTNERS){
    const total=openingBalances[p]+allocation.shares[p];
    if(!Number.isSafeInteger(total))fail('Period balance exceeds integer range');
    const obligation={id:this.uuid(),partner:p,periodId:period.id,revision,snapshotHash,amountCents:Math.max(total,0),openingCreditCents:Math.max(-total,0),appliedCents:0,status:total<=0?'PAID':'OPEN',currency:'USD',
     lines:allocation.expenses.map(x=>({expenseId:x.id,amountCents:x.shares[p],vendor:x.vendor,invoiceNumber:x.invoiceNumber,category:x.category,periodStart:x.periodStart,periodEnd:x.periodEnd,evidenceSha256:x.evidenceSha256})),createdAt:this.now()};
    s.obligations.push(obligation);
   }
   s.revision=revision;return {period,obligations:s.obligations.filter(o=>o.periodId===period.id)};
  });
 }
 async reportSent(actor, requestId, {obligationId,amountCents}) {
  const p=actorKey(actor);safeCents(amountCents);
  return this.transact(actor,requestId,'report-sent',{obligationId,amountCents},s=>{
   const o=s.obligations.find(x=>x.id===obligationId&&x.partner===p);if(!o)fail('Own obligation not found',404);
   if(!['OPEN','PARTIAL'].includes(o.status)||amountCents<=0||amountCents>remainingCents(o))fail('Obligation is not eligible for this claim');
   const row={id:this.uuid(),partner:p,obligationId,amountCents,state:'PENDING_VERIFICATION',reportedAt:this.now()};
   s.claims.push(row);return {claim:row,moneyMoved:false};
  });
 }
 async markPartnerPaymentVerifiedAndComplete(actor, requestId, evidence) {
  admin(actor);
  const {obligationId,partner,amountCents,expectedRevision,snapshotHash,fingerprint,messageFingerprint,method,receivedAt,evidenceSha256}=evidence;
  safeCents(amountCents);hash(snapshotHash);hash(fingerprint);hash(evidenceSha256);text(receivedAt,'Evidence timestamp');
  if(!PARTNERS.includes(partner)||amountCents<=0||!['authenticated_chase_gmail','authorized_admin','stripe_webhook'].includes(method))fail('Unsupported verification method');
  if(method==='authenticated_chase_gmail'&&!evidence.transportVerified)fail('Authenticated receipt transport is required');
  if(method==='stripe_webhook'&&!evidence.signatureVerified)fail('Authenticated provider webhook is required');
  if(method==='authorized_admin')text(evidence.attestation,'Exact evidence attestation',1000);
  if(messageFingerprint)hash(messageFingerprint);
  return this.transact(actor,requestId,'verify-and-complete',evidence,s=>{
   const replay=s.payments.find(x=>x.fingerprint===fingerprint||(messageFingerprint&&x.messageFingerprint===messageFingerprint));
   if(replay){if(replay.obligationId===obligationId&&replay.amountCents===amountCents&&replay.evidenceSha256===evidenceSha256)return {payment:replay,duplicate:true};fail('Receipt already consumed by another payment');}
   const o=s.obligations.find(x=>x.id===obligationId&&x.partner===partner);if(!o)fail('Payment obligation does not match partner');
   if(!['OPEN','PARTIAL'].includes(o.status)||o.revision!==expectedRevision||o.snapshotHash!==snapshotHash||(o.settlementRevision||0)!==(evidence.expectedSettlementRevision||0))fail('Obligation closed or its immutable/settlement revision differs');
   const received=Date.parse(receivedAt);if(!Number.isFinite(received))fail('Invalid receipt timestamp');
   if(received<Date.parse(o.createdAt)){
    const period=s.periods.find(x=>x.id===o.periodId),assignment=evidence.historicalAssignment;
    if(method!=='authorized_admin'||!assignment||assignment.certificationEvidenceSha256!==period.certificationEvidenceSha256)fail('Receipt predates the eligible obligation; certified historical assignment required');
    text(assignment.reason,'Historical assignment rationale',1000);
   }
   const applied=Math.min(amountCents,remainingCents(o)),excess=amountCents-applied;
   if(excess){if(method!=='authorized_admin'||evidence.excessTreatment?.action!=='certified_credit')fail('Excess requires separate certified credit treatment');hash(evidence.excessTreatment.evidenceSha256);text(evidence.excessTreatment.reason,'Excess credit rationale',1000);}
   const payment={id:this.uuid(),partner,obligationId,amountCents,amountAppliedCents:applied,state:'VERIFIED',fingerprint,messageFingerprint:messageFingerprint||null,method,evidenceSha256,verifiedAt:this.now(),receivedAt,
    historicalAssignment:evidence.historicalAssignment||null,excessCreditCents:excess,
    receiptState:'READY',statementState:'POSTED'};
   s.payments.push(payment);o.appliedCents+=applied;o.status=remainingCents(o)===0?'PAID':'PARTIAL';o.settlementRevision=++s.revision;
   if(excess){s.adjustments.push({id:this.uuid(),partner,amountCents:-excess,evidenceSha256:evidence.excessTreatment.evidenceSha256,reason:evidence.excessTreatment.reason,sourcePaymentId:payment.id,postedBy:'brian',postedAt:this.now()});s.revision++;}
   const claim=s.claims.find(x=>x.obligationId===obligationId&&x.state==='PENDING_VERIFICATION'&&x.amountCents===amountCents);
   if(claim)claim.state='RECONCILED';
   return {payment,obligation:o,remainingCents:remainingCents(o),receiptState:'READY',statementState:'POSTED'};
  });
 }
 async adjustment(actor, requestId, payload) {
  admin(actor);const {partner,amountCents,evidenceSha256,reason,expectedRevision}=payload;
  if(!PARTNERS.includes(partner)||!signedCents(amountCents))fail('Nonzero signed adjustment required');hash(evidenceSha256);text(reason,'Adjustment rationale',1000);
  return this.transact(actor,requestId,'adjustment',payload,s=>{
   if(s.revision!==expectedRevision)fail('Ledger revision changed');
   const row={id:this.uuid(),partner,amountCents,evidenceSha256,reason,postedBy:'brian',postedAt:this.now()};s.adjustments.push(row);s.revision++;return {adjustment:row,revision:s.revision};
  });
 }
 async setMethod(actor, requestId, method) {
  const p=actorKey(actor);if(!method.providerVerified||method.domain!=='partner_cost_sharing'||method.partner!==p||!/^pm_[A-Za-z0-9]+$/.test(method.reference)||!/^cus_[A-Za-z0-9]+$/.test(method.customerReference))fail('Provider-bound own method required');
  return this.transact(actor,requestId,'set-method',method,s=>{const row={id:this.uuid(),partner:p,reference:method.reference,customerReference:method.customerReference,state:'ACTIVE',brand:method.brand||'card',last4:/^\d{4}$/.test(method.last4)?method.last4:null,at:this.now()};s.methods=s.methods.map(x=>x.partner===p?{...x,state:'REPLACED'}:x);for(const x of s.consents.filter(x=>x.partner===p&&!x.revokedAt))x.revokedAt=this.now();s.methods.push(row);return {method:row,autoCollectionConsent:false};});
 }
 async applySettlement(actor,requestId,payload){
  admin(actor);const {obligationId,sourceKind,sourceId,amountCents,evidenceSha256,reason,expectedRevision}=payload;
  safeCents(amountCents);hash(evidenceSha256);text(reason,'Credit or adjustment allocation rationale',1000);
  if(amountCents<=0||!['opening_credit','adjustment'].includes(sourceKind))fail('Certified settlement source required');
  return this.transact(actor,requestId,'apply-settlement',payload,s=>{
   if(s.revision!==expectedRevision)fail('Ledger revision changed');
   const source=sourceKind==='opening_credit'?s.obligations.find(x=>x.id===sourceId&&x.openingCreditCents>0):s.adjustments.find(x=>x.id===sourceId);
   const o=s.obligations.find(x=>x.id===obligationId);if(!source||!o||source.partner!==o.partner||o.status==='VOID')fail('Own settlement source and obligation required');
   const expectedHash=sourceKind==='opening_credit'?s.periods.find(x=>x.id===source.periodId).certificationEvidenceSha256:source.evidenceSha256;
   if(expectedHash!==evidenceSha256)fail('Settlement source custody differs');
   s.applications||=[];const sourceAmount=sourceKind==='opening_credit'?-source.openingCreditCents:source.amountCents;
   const allocated=s.applications.filter(x=>x.sourceKind===sourceKind&&x.sourceId===sourceId).reduce((sum,x)=>sum+x.amountCents,0);
   if(amountCents>Math.abs(sourceAmount)-allocated||(sourceAmount<0&&amountCents>remainingCents(o)))fail('Settlement exceeds available source or payable obligation');
   if(sourceAmount<0)o.creditAppliedCents=(o.creditAppliedCents||0)+amountCents;else o.adjustmentAppliedCents=(o.adjustmentAppliedCents||0)+amountCents;
   if(!Number.isSafeInteger(remainingCents(o)))fail('Settlement exceeds integer range');
   o.status=remainingCents(o)===0?'PAID':o.appliedCents||o.creditAppliedCents?'PARTIAL':'OPEN';o.settlementRevision=++s.revision;
   const row={id:this.uuid(),partner:o.partner,obligationId,sourceKind,sourceId,amountCents,direction:sourceAmount<0?'CREDIT':'DEBIT',evidenceSha256,reason,postedAt:this.now(),revision:s.revision};s.applications.push(row);
   return {application:row,obligation:o,remainingCents:remainingCents(o),revision:s.revision};
  });
 }
 async stageProposal(actor,requestId,payload){
  admin(actor);hash(payload.sourceSha256);text(payload.sourceId,'Stable proposal source ID',160);text(payload.summary,'Proposal summary',1000);
  if(!['ai_expense','receipt_review','anomaly','collection_shadow'].includes(payload.kind)||!payload.fields||JSON.stringify(payload.fields).length>16000||!Array.isArray(payload.insights)||payload.insights.length>8||Object.keys(payload).some(k=>!['kind','sourceSha256','sourceId','summary','fields','insights'].includes(k)))fail('Bounded review-only proposal required',400);
  return this.transact(actor,requestId,'stage-proposal',payload,s=>{const prior=s.proposals.find(x=>x.sourceSha256===payload.sourceSha256&&x.sourceId===payload.sourceId);if(prior){if(digest(prior.proposal)!==digest(payload))fail('Proposal source has conflicting interpretations');return {proposal:prior,duplicate:true,posted:false};}const row={id:this.uuid(),sourceSha256:payload.sourceSha256,sourceId:payload.sourceId,proposal:clone(payload),state:'NEEDS_REVIEW',createdAt:this.now()};s.proposals.push(row);return {proposal:row,posted:false,moneyMoved:false};});
 }
 async removeMethod(actor, requestId) {
  const p=actorKey(actor);return this.transact(actor,requestId,'remove-method',{},s=>{for(const x of s.methods.filter(x=>x.partner===p))x.state='REMOVED';for(const x of s.consents.filter(x=>x.partner===p&&!x.revokedAt))x.revokedAt=this.now();return {removed:true,autoCollectionConsent:false};});
 }
 async consent(actor, requestId, payload) {
  const p=actorKey(actor);const {action,termsVersion,termsSha256,maxAmountCents,periodId}=payload;
  if(!['authorize','revoke'].includes(action))fail('Unknown consent action',400);
  if(action==='authorize'){text(termsVersion,'Terms version');hash(termsSha256);safeCents(maxAmountCents);}
  return this.transact(actor,requestId,'consent',payload,s=>{
   for(const x of s.consents.filter(x=>x.partner===p&&!x.revokedAt))x.revokedAt=this.now();
   if(action==='revoke')return {autoCollectionConsent:false};
   if(!s.methods.some(x=>x.partner===p&&x.state==='ACTIVE'))fail('An active own payment method is required');
   const o=s.obligations.find(x=>x.partner===p&&x.periodId===periodId&&['OPEN','PARTIAL'].includes(x.status));if(!o)fail('Certified eligible period is required');
   const row={id:this.uuid(),partner:p,termsVersion,termsSha256,maxAmountCents,periodId,acceptedAt:this.now(),revokedAt:null};s.consents.push(row);return {consent:row,collectionEnabled:false};
  });
 }
 collectionProposal(actor, obligationId) {
  const p=actorKey(actor), s=this.state, o=s.obligations.find(x=>x.id===obligationId&&x.partner===p);
  if(!o||!['OPEN','PARTIAL'].includes(o.status))fail('Eligible own obligation required');
  const method=s.methods.find(x=>x.partner===p&&x.state==='ACTIVE'), consent=s.consents.find(x=>x.partner===p&&!x.revokedAt&&x.periodId===o.periodId);
   const amountCents=remainingCents(o);
  const allocated=(kind,id)=>(s.applications||[]).filter(x=>x.sourceKind===kind&&x.sourceId===id).reduce((sum,x)=>sum+x.amountCents,0);
  if(s.adjustments.some(x=>x.partner===p&&Math.abs(x.amountCents)!==allocated('adjustment',x.id)))fail('Adjustment allocation must be reconciled before collection');
  if(s.obligations.some(x=>x.partner===p&&x.openingCreditCents>allocated('opening_credit',x.id)))fail('Opening credit allocation must be reconciled before collection');
  if(!method||!consent||amountCents>consent.maxAmountCents)fail('Current method and bounded versioned consent required');
  return {domain:'partner_cost_sharing',partner:p,obligationId,periodId:o.periodId,revision:o.revision,snapshotHash:o.snapshotHash,amountCents,currency:'USD',methodReference:method.reference,customerReference:method.customerReference,
   idempotencyKey:'partner-cost-sharing:collect:'+o.id+':r'+o.revision+':s'+(o.settlementRevision||0),settlementRevision:o.settlementRevision||0,shadow:true,moneyMoved:false,consentId:consent.id};
 }
 view(actor) {
  const p=actorKey(actor), s=this.state, own=x=>x.partner===p;
  const periods=s.periods.map(({openingBalances,...x})=>({...x,openingBalanceCents:openingBalances[p]}));
  const obligations=s.obligations.filter(own), payments=s.payments.filter(own), adjustments=s.adjustments.filter(own);
  const currentBalanceCents=periods.length ? obligations.reduce((sum,o)=>sum+o.amountCents-o.appliedCents-o.openingCreditCents,0)+adjustments.reduce((sum,a)=>sum+a.amountCents,0) : null;
  const result={partner:{key:p,name:LABELS[p],admin:p==='brian'},revision:s.revision,certified:periods.length>0,currentBalanceCents,periods,obligations,payments,adjustments,claims:s.claims.filter(own),
   applications:(s.applications||[]).filter(own),methods:s.methods.filter(own).map(({reference,customerReference,...row})=>row),consents:s.consents.filter(own)};
  if(p==='brian')result.admin={expenses:clone(s.expenses),periods:clone(s.periods),obligations:clone(s.obligations),payments:clone(s.payments),adjustments:clone(s.adjustments),applications:clone(s.applications||[]),claims:clone(s.claims),proposals:clone(s.proposals),audit:clone(s.audit)};
  return clone(result);
 }
}

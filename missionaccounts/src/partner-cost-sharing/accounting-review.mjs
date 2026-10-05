import { PARTNERS, LABELS, digest, splitTotal, csvCell } from './domain.mjs';
import { date, fail } from './ledger.mjs';

const rowFields = ['id','vendor','invoiceNumber','recordedAt','dateBasis','paidAt','periodStart','periodEnd','amountCents','status','purpose','legacy','description','evidenceKind','evidenceSha256','originalSha256'];
const cleanText = (v, name) => { if(typeof v!=='string'||!v.trim()||v.length>400||/https?:\/\/|@|[\r\n]/i.test(v)) fail('Invalid sanitized '+name,400);return v; };
const sum = rows => rows.reduce((n,r)=>{const next=n+r.amountCents;if(!Number.isSafeInteger(next))fail('Review amount exceeds supported range',400);return next;},0);

// Read-only accounting workpaper. It cannot post to, certify, or settle the canonical journal.
export function buildAccountingReview(input) {
 if(input?.schema!=='pcs-private-accounting-review-v1'||!Array.isArray(input.rows)||input.rows.length>2000)fail('Invalid private accounting review',400);
 date(input.asOf);
 const seen=new Set();
 const rows=input.rows.map(raw=>{
  if(Object.keys(raw).some(k=>!rowFields.includes(k)))fail('Unexpected private review field',400);
  const r=Object.fromEntries(rowFields.map(k=>[k,raw[k]??null]));
  if(!/^[a-z0-9-]{1,100}$/.test(r.id||''))fail('Invalid review row identity',400);
  for(const k of ['vendor','invoiceNumber','description'])cleanText(r[k],k);
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(r.invoiceNumber)||r.invoiceNumber.includes('..'))fail('Invalid sanitized invoice identity',400);
  const key=r.vendor.toLowerCase()+':'+r.invoiceNumber;if(seen.has(key))fail('Duplicate review invoice',409);seen.add(key);
  if(!Number.isSafeInteger(r.amountCents)||r.amountCents<0)fail('Integer review cents required',400);
  for(const k of ['recordedAt','paidAt','periodStart','periodEnd'])if(r[k])date(r[k]);
  if(!['BILLING_HISTORY','INVOICE_ISSUE','RECEIPT_DATE','ACCRUAL_DATE','FORECAST_DATE'].includes(r.dateBasis))fail('Observed date basis required',400);
  if(r.periodStart&&r.periodEnd&&r.periodStart>r.periodEnd)fail('Invalid review service period',400);
  if(!['PAID','ACCRUED','QUARANTINED','CLAIM','FORECAST'].includes(r.status)||!['SHARED','PENDING'].includes(r.purpose)||!['INCLUDED','NOT_IN_OLD_HTML','POSSIBLE_OVERLAP'].includes(r.legacy))fail('Invalid review classification',400);
  if(r.status==='PAID'&&(!r.paidAt||!r.recordedAt||r.paidAt>input.asOf||r.recordedAt>input.asOf))fail('Paid review invoice requires observed dates',400);
  if(!['ORIGINAL_HASHED','PROVIDER_METADATA','ATTACHMENT_EXTRACT','EMAIL_RECEIPT_EXTRACT','FOUNDER_ATTESTATION'].includes(r.evidenceKind)||!/^[a-f0-9]{64}$/.test(r.evidenceSha256||''))fail('Review provenance required',400);
  if(r.originalSha256&&!/^[a-f0-9]{64}$/.test(r.originalSha256))fail('Invalid original hash',400);
  if(r.evidenceKind==='ORIGINAL_HASHED'&&!r.originalSha256)fail('Original custody hash required',400);
  return r;
 });
 const contributions=(input.contributions||[]).map(r=>{
  if(!PARTNERS.includes(r.partner)||!Number.isSafeInteger(r.amountCents)||r.amountCents<0||!['FOUNDER_ATTESTED_UNASSIGNED','SOURCE_AUTHENTICATED_UNASSIGNED'].includes(r.state))fail('Invalid review contribution',400);
  date(r.receivedAt);if(r.receivedAt>input.asOf)fail('Future contribution',400);
  return {partner:r.partner,amountCents:r.amountCents,receivedAt:r.receivedAt,state:r.state};
 });
 const workspace = input.workspace;
 if(!workspace||Object.keys(workspace).some(k=>!['paymentTodayCents','vendorOutstandingCents','totalNetChargesCents','totalPaymentsCents'].includes(k))||Object.values(workspace).some(v=>!Number.isSafeInteger(v)||v<0)||workspace.totalNetChargesCents-workspace.totalPaymentsCents!==workspace.vendorOutstandingCents)fail('Workspace charges/payments do not reconcile',400);
 const result={schema:input.schema,asOf:input.asOf,rows,contributions,workspace:{...workspace},certified:false,currentBalanceCents:null,collectionEnabled:false};
 result.sourceVersion=digest(result);return result;
}

export function projectAccountingReview(review,actor) {
 if(!actor?.prototype||!PARTNERS.includes(actor.key))fail('Private local accounting review unavailable',404);
 const scenarios=['2026-05-31','2026-06-30'].map(cutoff=>{
  const candidates=review.rows.filter(r=>r.status==='PAID'&&r.purpose==='SHARED'&&r.legacy!=='INCLUDED'&&r.recordedAt>cutoff&&!(r.periodEnd&&r.periodEnd<=cutoff));
  const totalCents=sum(candidates),shares=splitTotal(totalCents);
  const earlierDiscoveries=review.rows.filter(r=>r.status==='PAID'&&r.purpose==='SHARED'&&r.legacy==='NOT_IN_OLD_HTML'&&!candidates.some(c=>c.id===r.id));
  return {cutoff,totalCents,ownShareCents:shares[actor.key],invoiceIds:candidates.map(r=>r.id),boundaryInvoiceCount:candidates.filter(r=>!r.periodStart||!r.periodEnd||r.periodStart<=cutoff).length,
   unresolvedEarlierCents:sum(earlierDiscoveries),unresolvedEarlierCount:earlierDiscoveries.length,
   basis:'Whole paid invoice candidates recorded after assumed cutoff; fully earlier service periods excluded. Mixed and unknown periods need review. Not an amount due.'};
 });
 const rows=review.rows.filter(r=>actor.key==='brian'||r.purpose==='SHARED'&&['PAID','ACCRUED'].includes(r.status)).map(({evidenceSha256,originalSha256,...r})=>({...r,...(actor.key==='brian'?{evidenceSha256,originalSha256}:{}),originalAvailable:Boolean(originalSha256)}));
 return {schema:review.schema,asOf:review.asOf,sourceVersion:review.sourceVersion,certified:false,currentBalanceCents:null,collectionEnabled:false,
  rows,scenarios,contributions:review.contributions.filter(r=>actor.key==='brian'||r.partner===actor.key),workspace:actor.key==='brian'?review.workspace:{vendorOutstandingCents:review.workspace.vendorOutstandingCents},
  oldPackage:{claimedTotalCents:267857,originalBackedCents:132596,unverifiedClaimsCents:126257,learnDashDifferenceCents:9004,settledByFounderAttestation:true,exactCutoff:null},
  pendingPurposeCents:actor.key==='brian'?sum(review.rows.filter(r=>r.purpose==='PENDING'&&r.status==='PAID'&&r.recordedAt>'2026-06-30')):null,
  outstandingCostCents:sum(review.rows.filter(r=>r.purpose==='SHARED'&&r.status==='ACCRUED')),
  originalCount:review.rows.filter(r=>r.originalSha256).length};
}

export function accountingReviewCsv(view,partner) {
 const rows=[['PRIVATE ACCOUNTING REVIEW - NOT CERTIFIED OR PAYABLE'],['Partner',LABELS[partner]],['As of',view.asOf],['Source version',view.sourceVersion],['Current balance','UNKNOWN'],
  ['Vendor','Invoice','Observed date','Date basis','Paid date','Service start','Service end','Amount cents','Status','Shared purpose','Old package crosswalk','Evidence kind']];
 for(const r of view.rows)rows.push([r.vendor,r.invoiceNumber,r.recordedAt,r.dateBasis,r.paidAt,r.periodStart,r.periodEnd,r.amountCents,r.status,r.purpose,r.legacy,r.evidenceKind]);
 for(const s of view.scenarios){rows.push(['ASSUMPTION ONLY',s.cutoff,'Paid invoice candidates',s.totalCents,'Your draft allocation',s.ownShareCents,s.basis]);rows.push(['UNRESOLVED EARLIER DISCOVERIES',s.cutoff,s.unresolvedEarlierCount,s.unresolvedEarlierCents,'Absent from old HTML; not assumed reimbursed or payable']);}
 for(const p of view.contributions)rows.push(['Unassigned contribution',LABELS[p.partner],p.receivedAt,p.amountCents,p.state]);
 return rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}

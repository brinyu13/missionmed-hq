import { csvCell, digest } from './domain.mjs';
import { fail, date } from './ledger.mjs';
export function partnerStatement(view,{start,end}) {
 date(start);date(end);if(start>end)fail('Statement date range required',400);
 const before=t=>String(t).slice(0,10)<start,inside=t=>String(t).slice(0,10)>=start&&String(t).slice(0,10)<=end;
 const obligations=view.obligations||[],payments=view.payments||[],adjustments=view.adjustments||[];
 const debit=o=>o.amountCents-(o.openingCreditCents||0);
 const opening=view.certified?obligations.filter(o=>before(o.createdAt)).reduce((s,o)=>s+debit(o),0)-payments.filter(p=>before(p.verifiedAt)).reduce((s,p)=>s+p.amountAppliedCents,0)+adjustments.filter(a=>before(a.postedAt)).reduce((s,a)=>s+a.amountCents,0):null;
 const rows=obligations.filter(o=>inside(o.createdAt)).flatMap(o=>o.lines.map(line=>({...line,kind:'EXPENSE',obligationId:o.id,revision:o.revision,postedAt:o.createdAt})));
 const contributions=payments.filter(p=>inside(p.verifiedAt)),changes=adjustments.filter(a=>inside(a.postedAt));
 const debitCents=obligations.filter(o=>inside(o.createdAt)).reduce((s,o)=>s+debit(o),0);
 const closing=opening===null?null:opening+debitCents-contributions.reduce((s,p)=>s+p.amountAppliedCents,0)+changes.reduce((s,a)=>s+a.amountCents,0);
 const record={domain:'partner_cost_sharing',partner:view.partner,start,end,currency:'USD',certified:view.certified,openingBalanceCents:opening,closingBalanceCents:closing,allocatedExpenses:rows,
  openingCertifications:(view.periods||[]).filter(p=>p.periodStart<=end&&p.periodEnd>=start).map(p=>({periodId:p.id,openingBalanceCents:p.openingBalanceCents,coverageCutoff:p.coverageCutoff,certificationEvidenceSha256:p.certificationEvidenceSha256})),
  payments:contributions,adjustments:changes,invoicePackageManifest:rows.map(x=>({expenseId:x.expenseId,invoiceNumber:x.invoiceNumber,sha256:x.evidenceSha256})),
  taxTreatment:'No tax treatment is assumed.'};
 return {...record,statementHash:digest(record)};
}
export function statementToCsv(record) {
 const rows=[['Partner Cost Statement',record.certified?'CERTIFIED LEDGER':'DRAFT - BALANCES UNKNOWN'],['Partner',record.partner.name],['From',record.start,'To',record.end],['Opening cents',record.openingBalanceCents??'UNKNOWN'],['Closing cents',record.closingBalanceCents??'UNKNOWN'],
  ['Type','Vendor','Invoice','Service from','Service through','Category','Own share cents','Payment applied cents','Evidence SHA-256']];
 for(const x of record.allocatedExpenses)rows.push(['Expense',x.vendor,x.invoiceNumber,x.periodStart,x.periodEnd,x.category,x.amountCents,'',x.evidenceSha256]);
 for(const x of record.payments)rows.push(['Payment','','',x.receivedAt,'','', '',x.amountAppliedCents,x.evidenceSha256]);
 for(const x of record.adjustments)rows.push(['Adjustment','','',x.postedAt,'',x.reason,x.amountCents,'',x.evidenceSha256]);
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function annualSummary(view,year) {
 if(!Number.isInteger(year)||year<2000||year>2100)fail('Annual summary year invalid',400);
 const statement=partnerStatement(view,{start:year+'-01-01',end:year+'-12-31'});
 const categories={};for(const row of statement.allocatedExpenses)categories[row.category]=(categories[row.category]||0)+row.amountCents;
 return {...statement,annualCategoriesCents:categories,documentType:'ANNUAL_PARTNER_COST_SUMMARY'};
}

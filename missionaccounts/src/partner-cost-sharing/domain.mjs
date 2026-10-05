import { createHash } from 'node:crypto';

export const PARTNERS = Object.freeze(['brian', 'drj', 'phil']);
export const LABELS = Object.freeze({ brian: 'Brian', drj: 'Dr J', phil: 'Phil' });
export function cents(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('A nonnegative integer USD amount is required');
  return value;
}
export function splitTotal(total) {
  cents(total);
  const payor = Math.round(total / 3);
  // Tiny batches use largest remainder, rather than producing a negative Brian share.
  if (total < 2) return { brian: 0, drj: total, phil: 0 };
  return { brian: total - 2 * payor, drj: payor, phil: payor };
}
export function allocateExpenses(expenses) {
  const total = expenses.reduce((sum, row) => cents(sum + cents(row.amountCents)), 0);
  const targets = splitTotal(total);
  const allocations = expenses.map(row => ({ ...row, shares: Object.fromEntries(PARTNERS.map(p => [p, Math.floor(row.amountCents / 3)])) }));
  const deficits = Object.fromEntries(PARTNERS.map(p => [p, targets[p] - allocations.reduce((sum, row) => sum + row.shares[p], 0)]));
  for (const row of allocations) {
    let remainder = row.amountCents - PARTNERS.reduce((sum, p) => sum + row.shares[p], 0);
    for (const p of ['drj', 'phil', 'brian'].sort((a, b) => deficits[b] - deficits[a])) {
      if (remainder && deficits[p] > 0) { row.shares[p]++; deficits[p]--; remainder--; }
    }
    if (remainder) throw new Error('Allocation invariant failed');
  }
  if (PARTNERS.some(p => deficits[p] !== 0)) throw new Error('Batch allocation invariant failed');
  return { totalCents: total, shares: targets, expenses: allocations };
}
export function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function statementCsv(view) {
  const rows = [['DRAFT HISTORICAL EVIDENCE - NOT A PAYABLE STATEMENT'], ['Partner', view.partner.name], ['Opening balance', 'UNKNOWN'], ['Closing balance', 'UNKNOWN'],
    ['Vendor', 'Invoice', 'Service period', 'Currency', 'Expense cents', 'Historical allocation cents', 'Evidence SHA-256']];
  for (const row of view.expenses) rows.push([row.vendor, row.invoiceNumber, row.period, 'USD', row.amountCents, row.ownShareCents, row.sha256]);
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

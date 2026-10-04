import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readJsonBody } from '../http/body.mjs';
import { allocateExpenses, LABELS, PARTNERS, statementCsv } from './domain.mjs';
import { RECOVERED_EXPENSES, EXCLUDED_CLAIMS } from './recovered-data.mjs';
import { partnerStatement, statementToCsv, annualSummary } from './statements.mjs';
import { invoicePackage } from './archive.mjs';

const prefix = '/api/partner-cost-sharing';
const allocation = allocateExpenses(RECOVERED_EXPENSES);
function deny(message, status = 403) { throw Object.assign(new Error(message), { status }); }
function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store, private', vary: 'Authorization, Cookie', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(body));
}
export function createPartnerCostRouter({ config, authenticate, memberStore = null }) {
  const settings = config.partnerCostSharing || {};
  if (settings.prototype && (config.production || !config.localAuth)) throw new Error('Partner prototype requires isolated nonproduction local authentication');
  const claims = new Map();
  const keys = new Map();
  async function member(request) {
    if (settings.enabled !== true) deny('Partner Cost Sharing is not enabled', 404);
    if (settings.prototype) {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) deny('Local prototype only');
      const cookie = String(request.headers.cookie || '').match(/(?:^|;\s*)pcs_prototype_lens=(brian|drj|phil)(?:;|$)/);
      const key = cookie?.[1] || 'brian';
      return { key, name: LABELS[key], admin: key === 'brian', prototype: true };
    }
    const identity = await authenticate(request, config);
    // Generic app roles never grant partner membership. Only an explicitly bound canonical principal does.
    const binding = await memberStore?.memberForPrincipal(identity.userId, identity.wpUserId);
    if (!binding || binding.active !== true || !PARTNERS.includes(binding.key)) deny('Partner membership is not active',404);
    if (settings.brianOnly === true && binding.key !== 'brian') deny('Partner acceptance is not enabled',404);
    return { key: binding.key, name: LABELS[binding.key], admin: binding.key === 'brian', prototype: false, principalId:identity.userId,wpUserId:identity.wpUserId };
  }
  function projection(actor) {
    const ownPayments = actor.key === 'drj' ? [{ date: '2026-05-09', amountCents: 89300, state: 'FOUNDER_ATTESTED_UNMATCHED', evidence: 'Original Chase evidence and obligation matching pending' }]
      : actor.key === 'phil' ? [{ date: '2026-07-02', amountCents: 90000, state: 'FOUNDER_ATTESTED_UNMATCHED', evidence: 'Original Chase evidence and obligation matching pending' }] : [];
    const result = {
      schema: 'partner-cost-sharing-prototype-v1', prototype: actor.prototype, partner: actor,
      currentBalanceCents: null, openingBalanceCents: null, certified: false,
      balanceStatus: 'Historical reconciliation pending', currency: 'USD',
      recoveredTotalCents: allocation.totalCents, historicalSampleShareCents: allocation.shares[actor.key],
      expenses: allocation.expenses.map(({ shares, url: _privateHistoricalUrl, ...row }) => ({ ...row, ownShareCents: shares[actor.key], assetUrl: `${config.basePath || '/missionaccounts/'}api/partner-cost-sharing/invoices/${row.id}` })),
      excludedClaims: EXCLUDED_CLAIMS.map(row => ({ ...row, state: 'NEEDS VERIFICATION', included: false })),
      ownPayments, sampleClaim: claims.get(actor.key) || null,
      paymentMethod: { state: 'NOT_CONNECTED', autoCollectionConsent: false, collectionEnabled: false },
      zelle: { recipient: 'Mission Global Group LLC', id: 'info@missionmedinstitute.com', qrVerified: false },
      statementState: 'DRAFT_HISTORICAL_EVIDENCE',
    };
    if (actor.admin) result.admin = {
      partners: PARTNERS.map(key => ({ key, name: LABELS[key], currentBalanceCents: null, historicalSampleShareCents: allocation.shares[key], sampleClaim: claims.get(key) || null })),
      exceptions: [
        { id: 'opening', title: 'Certify opening balances and expense coverage', detail: 'Recover the historical obligation and match both Founder-attested contributions. Current balances remain unknown.' },
        { id: 'evidence', title: 'Verify excluded historical expenses', detail: '$1,262.57 of unsupported claims remain excluded. LearnDash correction: $90.04.' },
        { id: 'qr', title: 'Verify current Chase QR custody', detail: 'The old donor QR is excluded from the new payment destination.' },
      ],
      payments: [{ partner: 'Dr J', ...{ date: '2026-05-09', amountCents: 89300, state: 'FOUNDER_ATTESTED_UNMATCHED' } }, { partner: 'Phil', date: '2026-07-02', amountCents: 90000, state: 'FOUNDER_ATTESTED_UNMATCHED' }],
    };
    return result;
  }
  async function bootstrap(actor) {
    const result=projection(actor);
    if(memberStore?.view){
      const ledger=await memberStore.view(actor);
      result.ledger=ledger;result.certified=ledger.certified;result.currentBalanceCents=ledger.currentBalanceCents;
      result.balanceStatus=ledger.certified?'Certified ledger':'Historical reconciliation pending';
    }
    return result;
  }
  function mutationGuard(request){
    const origin=request.headers.origin;
    const expected=settings.publicOrigin||`${config.production?'https':'http'}://${request.headers.host}`;
    if(origin&&origin!==expected)deny('Origin mismatch');
    if(!actorIsBearer(request)&&!settings.prototype)deny('Bearer-authenticated partner command required');
    const requestId=String(request.headers['idempotency-key']||'');
    if(!/^[A-Za-z0-9._:-]{8,160}$/.test(requestId))deny('Idempotency key required',400);
    return requestId;
  }
  const actorIsBearer=request=>/^Bearer [^\s]+$/i.test(String(request.headers.authorization||''));
  return async function route(request, response, url) {
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return false;
    const actor = await member(request);
    const routePath = url.pathname.slice(prefix.length) || '/';
    if (request.method === 'GET' && routePath === '/bootstrap') { json(response, 200, await bootstrap(actor)); return true; }
    if (request.method === 'GET' && routePath === '/admin') {
      if (!actor.admin) deny('Brian accounting administrator access required');
      json(response, 200, (await bootstrap(actor)).ledger?.admin||projection(actor).admin); return true;
    }
    if (request.method === 'GET' && routePath === '/statement.csv') {
      const csv = statementCsv(projection(actor));
      response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="partner-historical-evidence-DRAFT.csv"', 'cache-control': 'no-store, private', vary: 'Authorization, Cookie', 'x-content-type-options': 'nosniff' }); response.end(csv); return true;
    }
    if (request.method === 'GET' && routePath === '/statement-export') {
      if(url.searchParams.has('start')||url.searchParams.has('year')){
        if(!memberStore?.view)deny('Certified journal is unavailable',503);
        const view=await memberStore.view(actor),record=url.searchParams.has('year')?annualSummary(view,Number(url.searchParams.get('year'))):partnerStatement(view,{start:url.searchParams.get('start'),end:url.searchParams.get('end')});
        json(response,200,{record,csv:statementToCsv(record),filename:`partner-${actor.key}-${record.start}-${record.end}${record.certified?'':'-DRAFT'}.csv`});return true;
      }
      json(response,200,{csv:statementCsv(projection(actor)),filename:'partner-historical-evidence-DRAFT.csv'});return true;
    }
    const command=routePath.match(/^\/commands\/(ingest|reviewExpense|certifyPeriod|reportSent|verifyPayment|adjustment|applySettlement|consent|method)$/);
    if(request.method==='GET'&&routePath==='/invoice-package'){
      if(!memberStore?.view)deny('Partner journal is unavailable',503);
      const record=partnerStatement(await memberStore.view(actor),{start:url.searchParams.get('start'),end:url.searchParams.get('end')});
      const packageRecord=await invoicePackage(record,async id=>{
        if(memberStore?.readOriginal)return memberStore.readOriginal(actor,id);
        const row=RECOVERED_EXPENSES.find(x=>x.id===id);
        if(!row||!settings.privateInvoiceDirectory)deny('Original custody unavailable; incomplete package withheld',409);
        return {bytes:await readFile(path.join(settings.privateInvoiceDirectory,row.file)),type:row.type==='pdf'?'application/pdf':'image/png'};
      });
      json(response,200,packageRecord);return true;
    }
    if(request.method==='POST'&&command){
      if(!memberStore?.execute)deny('Partner journal is unavailable',503);
      const requestId=mutationGuard(request),payload=await readJsonBody(request,{limitBytes:32768});
      if(!payload||typeof payload!=='object'||Array.isArray(payload))deny('Partner command requires an object',400);
      if(['ingest','reviewExpense','certifyPeriod','verifyPayment','adjustment','applySettlement'].includes(command[1])&&!actor.admin)deny('Brian accounting administrator access required');
      if(command[1]==='reviewExpense'&&payload.decision==='approve'&&!actor.prototype){
        if(!memberStore.readOriginal)deny('Original private custody is unavailable',409);
        const original=await memberStore.readOriginal(actor,payload.expenseId);
        if(original.sha256!==payload.evidenceSha256)deny('Original custody does not match review evidence',409);
      }
      if(command[1]==='verifyPayment'){
        if(['transportVerified','signatureVerified'].some(k=>k in payload)||payload.method&&payload.method!=='authorized_admin')deny('Provider verification cannot be asserted by the client',400);
        payload.method='authorized_admin';
      }
      if(command[1]==='method'&&payload.action!=='remove')deny('Provider-bound card setup is disabled',503);
      const result=await memberStore.execute(actor,command[1],requestId,payload);
      json(response,200,{...result,prototype:actor.prototype,moneyMoved:false});return true;
    }
    const invoice = routePath.match(/^\/invoices\/([a-z0-9-]+)(\/(?:preview|document))?$/);
    if (request.method === 'GET' && invoice) {
      const row = RECOVERED_EXPENSES.find(row => row.id === invoice[1]);
      if(!row&&memberStore?.readOriginal){
        const asset=await memberStore.readOriginal(actor,invoice[1]);
        if(invoice[2]==='/document')json(response,200,{originalBase64:asset.bytes.toString('base64'),previewBase64:asset.type==='image/png'||asset.type==='image/jpeg'?asset.bytes.toString('base64'):null,previewType:asset.type,originalType:asset.type,sha256:asset.sha256,filename:asset.filename});
        else{response.writeHead(200,{'content-type':asset.type,'content-disposition':`attachment; filename="${asset.filename}"`,'cache-control':'no-store, private',vary:'Authorization, Cookie','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"});response.end(asset.bytes);}
        return true;
      }
      if (!row || !settings.privateInvoiceDirectory) deny('Invoice evidence is unavailable', 404);
      const bytes = await readFile(path.join(settings.privateInvoiceDirectory, row.file));
      if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) deny('Invoice custody check failed', 409);
      if (bytes.length > 10 * 1024 * 1024) deny('Invoice exceeds secure document limit',413);
      if (invoice[2] === '/document') {
        const preview = settings.privatePreviews?.[row.id];
        const png = row.type === 'pdf' && preview ? await readFile(preview.file) : row.type !== 'pdf' ? bytes : null;
        if (!png) deny('Private preview is unavailable',404);
        if (preview && createHash('sha256').update(png).digest('hex') !== preview.sha256) deny('Preview custody check failed',409);
        if (png.length > 10 * 1024 * 1024) deny('Preview exceeds secure document limit',413);
        json(response,200,{originalBase64:bytes.toString('base64'),previewBase64:png.toString('base64'),originalType:row.type === 'pdf' ? 'application/pdf' : 'image/png',sha256:row.sha256});return true;
      }
      if (invoice[2] === '/preview' && row.type === 'pdf') {
        const preview = settings.privatePreviews?.[row.id];
        if (!preview) deny('Private preview is unavailable', 404);
        const png = await readFile(preview.file);
        if (createHash('sha256').update(png).digest('hex') !== preview.sha256) deny('Preview custody check failed', 409);
        response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store, private', vary: 'Authorization, Cookie', 'x-content-type-options': 'nosniff' }); response.end(png); return true;
      }
      response.writeHead(200, { 'content-type': row.type === 'pdf' ? 'application/pdf' : 'image/png', 'content-disposition': `inline; filename="${row.file}"`, 'cache-control': 'no-store, private', vary: 'Authorization, Cookie', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" }); response.end(bytes); return true;
    }
    if (request.method === 'POST' && routePath === '/prototype/lens') {
      if (!actor.prototype) deny('Prototype controls are disabled', 404);
      const origin = request.headers.origin;
      if (origin && origin !== new URL(request.url, `http://${request.headers.host}`).origin) deny('Origin mismatch');
      const body = await readJsonBody(request);
      if (!PARTNERS.includes(body.partner)) deny('Unknown prototype lens', 400);
      response.setHeader('set-cookie', `pcs_prototype_lens=${body.partner}; HttpOnly; SameSite=Strict; Path=/`);
      json(response, 200, { prototype: true, partner: body.partner }); return true;
    }
    if (request.method === 'POST' && routePath === '/prototype/report-sent') {
      if (!actor.prototype) deny('Prototype controls are disabled', 404);
      const origin = request.headers.origin;
      if (origin && origin !== new URL(request.url, `http://${request.headers.host}`).origin) deny('Origin mismatch');
      const key = String(request.headers['idempotency-key'] || '');
      if (!/^[a-zA-Z0-9:-]{8,120}$/.test(key)) deny('An idempotency key is required', 400);
      const body = await readJsonBody(request);
      if (Object.keys(body).some(key => !['sample', 'amountCents'].includes(key)) || body.sample !== true || body.amountCents !== 1234) deny('Only the explicit sample obligation is supported', 400);
      const scopedKey = `${actor.key}:${key}`;
      const sampleClaim = keys.get(scopedKey) || { state: 'PENDING_VERIFICATION', sample: true, amountCents: 1234, reportedAt: new Date().toISOString(), financialEvidence: false };
      claims.set(actor.key, sampleClaim); keys.set(scopedKey, sampleClaim);
      json(response, 200, { sampleClaim, currentBalanceCents: null, moneyMoved: false }); return true;
    }
    deny('Partner endpoint not found', 404);
  };
}

import { FinancialOperationsService } from './operations-service.mjs';
import { FinancialReceiptRefundService } from './receipts-refunds.mjs';
import { readJsonBody, readRawBody } from '../http/body.mjs';

export function createFinancialOperationsRouter({ config, authenticate, store, stripe, chaseEvidence }) {
  const service = new FinancialOperationsService({ store, config: config.missionResidencyFinance, stripe, chaseEvidence });
  const receipts = new FinancialReceiptRefundService({operations:service});
  return async (request, response, url) => {
    if (request.method==='POST'&&url.pathname==='/api/mission-residency-finance/provider/stripe-webhook') {
      const result=await service.receiveProviderEvent(await readRawBody(request,{limitBytes:131_072}),request.headers['stripe-signature']);
      response.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private'});response.end(JSON.stringify(result));return true;
    }
    const prefix = '/api/mission-residency-finance/operations', own = '/api/me/mission-residency-finance';
    if (!(url.pathname === prefix || url.pathname.startsWith(prefix + '/') || url.pathname === own || url.pathname.startsWith(own + '/'))) return false;
    const identity = await authenticate(request, config);
    let result;
    if (url.pathname.startsWith(prefix)) {
      await service.founder(identity);
      if (request.method === 'GET' && url.pathname === prefix) result = await service.command(identity);
      else if (request.method === 'POST' && url.pathname === prefix) {
        const body = await readJsonBody(request, { limitBytes: 32_768 });
        result = await service.operate(identity, body.subject_key, body.operation, body, request.headers['idempotency-key']);
      } else if (request.method === 'GET' && url.pathname === prefix + '/history') result = await receipts.founderHistory(identity,url.searchParams.get('subject'));
      else if (request.method === 'POST' && url.pathname === prefix + '/refund-record') { const body=await readJsonBody(request,{limitBytes:16384}); result=await receipts.refund(identity,body.payment_id,body,request.headers['idempotency-key']); }
      else if (request.method === 'POST' && url.pathname === prefix + '/card') result = await service.startCard(identity, await readJsonBody(request, { limitBytes: 8192 }), request.headers['idempotency-key'], true);
      else if (request.method === 'POST' && url.pathname === prefix + '/card/reconcile') result = await service.reconcileCard(identity, (await readJsonBody(request, { limitBytes: 8192 })).attempt_id, true);
      else if (request.method === 'POST' && url.pathname === prefix + '/zelle/reconcile') result = await service.reconcileZelle(identity, (await readJsonBody(request, { limitBytes: 8192 })).request_id);
      else throw Object.assign(new Error('Financial operation route is not available'), { status: 404 });
    } else if (request.method === 'GET' && url.pathname === own + '/onboarding') result = await service.onboarding(identity);
    else if (request.method === 'POST' && url.pathname === own + '/onboarding') result = await service.saveOnboarding(identity, await readJsonBody(request, { limitBytes: 8_192 }), request.headers['idempotency-key']);
    else if (request.method === 'POST' && url.pathname === own + '/setup') result = await service.setup(identity, request.headers['idempotency-key']);
    else if (request.method === 'POST' && url.pathname === own + '/setup/confirm') result = await service.confirmSetup(identity, (await readJsonBody(request, { limitBytes: 8192 })).request_id);
    else if (request.method === 'GET' && url.pathname === own) result = await service.account(identity);
    else if (request.method === 'GET' && url.pathname === own + '/history') result=await receipts.ownHistory(identity);
    else if (request.method === 'POST' && url.pathname === own + '/authorize') result = await service.authorizeCharge(identity, await readJsonBody(request, { limitBytes: 8192 }), request.headers['idempotency-key']);
    else if (request.method === 'POST' && url.pathname === own + '/card') result = await service.startCard(identity, await readJsonBody(request, { limitBytes: 8192 }), request.headers['idempotency-key']);
    else if (request.method === 'POST' && url.pathname === own + '/card/reconcile') result = await service.reconcileCard(identity, (await readJsonBody(request, { limitBytes: 8192 })).attempt_id);
    else if (request.method === 'POST' && url.pathname === own + '/card/resume') result = await service.resumeCard(identity, (await readJsonBody(request, { limitBytes: 8192 })).attempt_id);
    else if (request.method === 'POST' && url.pathname === own + '/zelle/report') result = await service.reportZelle(identity, await readJsonBody(request, { limitBytes: 8192 }), request.headers['idempotency-key']);
    else throw Object.assign(new Error('Own-account financial route is not available'), { status: 404 });
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, private', vary: 'Authorization, Cookie', pragma: 'no-cache', 'x-accel-expires': '0', 'x-content-type-options': 'nosniff' });
    response.end(JSON.stringify(result)); return true;
  };
}

import { financialReadAccess, financialReadIdentity, financialCommandProjection } from './read-model.mjs';
export function createFinancialReadRouter({ config, authenticate, store }) {
  const prefix = '/api/mission-residency-finance';
  return async (request, response, url) => {
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) return false;
    const identity = await authenticate(request, config);
    if (!await financialReadAccess(store, identity)) throw Object.assign(new Error('Founder finance access is not authorized'), { status: 403 });
    if (request.method !== 'GET') throw Object.assign(new Error('Financial accounts are read-only'), { status: 405 });
    const route = url.pathname.slice(prefix.length);
    let body;
    if (route === '/access') body = { authorized: true, read_only: true };
    else if (route === '/command') body = financialCommandProjection(await store.rpc('api_read_financial_command', financialReadIdentity(identity)));
    else throw Object.assign(new Error('Financial read route not found'), { status: 404 });
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, private', vary: 'Authorization, Cookie', pragma: 'no-cache', 'x-accel-expires': '0', 'x-content-type-options': 'nosniff' });
    response.end(JSON.stringify(body));
    return true;
  };
}

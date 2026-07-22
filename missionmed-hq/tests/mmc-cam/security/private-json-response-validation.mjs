import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { sendMmcPrivateJson } from '../../../lib/mmc/trust/private-json-response.mjs';

const response = {
  status: null,
  headers: null,
  body: null,
  writeHead(status, headers) {
    this.status = status;
    this.headers = { ...headers };
  },
  end(body) {
    this.body = String(body);
  },
};

sendMmcPrivateJson(response, 200, { data: { kind: 'PRIVATE_TEST' }, meta: {} }, {
  'Access-Control-Allow-Origin': 'https://cdn.missionmedinstitute.com',
  'Access-Control-Allow-Credentials': 'true',
  Vary: 'Origin',
});

assert.equal(response.status, 200);
assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
assert.match(response.headers['Content-Security-Policy'], /default-src 'none'/u);
assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
assert.equal(Object.keys(response.headers).some((name) => name.toLowerCase().startsWith('access-control-')), false,
  'The private response adapter must never emit CORS response headers.');
assert.equal(Object.hasOwn(response.headers, 'Vary'), false,
  'The private response adapter must not inherit a Vary: Origin policy.');
assert.deepEqual(JSON.parse(response.body), { data: { kind: 'PRIVATE_TEST' }, meta: {} });

const serverSource = readFileSync(path.join(process.cwd(), 'missionmed-hq/server.mjs'), 'utf8');
assert.match(serverSource, /mentorSendJson: sendMmcPrivateJson/u,
  'The real shared server must wire the dedicated private response adapter into mentor routes.');

console.log(JSON.stringify({
  result: 'MMC private JSON response adapter validation passed',
  credentialedCorsAbsent: true,
  serverWiringPresent: true,
  noStore: true,
}, null, 2));

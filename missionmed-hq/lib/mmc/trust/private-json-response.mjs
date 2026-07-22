import { MMC_JSON_SECURITY_HEADERS } from './security.mjs';

export function sendMmcPrivateJson(response, statusCode, payload) {
  if (!response || typeof response.writeHead !== 'function' || typeof response.end !== 'function') {
    throw new TypeError('MMC private JSON response requires a writable HTTP response.');
  }
  response.writeHead(statusCode, {
    ...MMC_JSON_SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload, null, 2));
}

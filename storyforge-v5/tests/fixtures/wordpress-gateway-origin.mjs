import http from 'node:http';

const port = Number.parseInt(process.env.STORYFORGE_GATEWAY_MOCK_PORT || '4190', 10);
const host = '0.0.0.0';
const oversizedBytes = (32 * 1024 * 1024) + 1;

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/api/test-redirect') {
    response.writeHead(302, {
      Location: 'https://example.invalid/redirect-must-not-pass',
      'Set-Cookie': 'gateway_mock_cookie=must-not-pass',
    });
    response.end();
    return;
  }
  if (request.url === '/api/test-invalid-json') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('not-json');
    return;
  }
  if (request.url === '/api/test-oversize') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(Buffer.alloc(oversizedBytes, 32));
    return;
  }
  if (request.url === '/api/test-timeout') {
    setTimeout(() => {
      if (!response.destroyed) sendJson(response, 200, { late: true });
    }, 11000);
    return;
  }
  if (request.url === '/api/test-echo') {
    let bodyBytes = 0;
    for await (const chunk of request) bodyBytes += chunk.length;
    const names = new Set(Object.keys(request.headers).map((name) => name.toLowerCase()));
    sendJson(response, 200, {
      authorizationPresent: names.has('authorization'),
      contentTypePresent: names.has('content-type'),
      originPresent: names.has('origin'),
      cookiePresent: names.has('cookie'),
      noncePresent: names.has('x-wp-nonce'),
      refererPresent: names.has('referer'),
      forwardedPresent: [...names].some((name) => name.startsWith('x-forwarded-')),
      bodyBytes,
    }, {
      'Set-Cookie': 'gateway_mock_cookie=must-not-pass',
      Location: 'https://example.invalid/location-must-not-pass',
    });
    return;
  }
  sendJson(response, 404, { error: { code: 'mock_not_found' } });
});

server.listen(port, host, () => {
  console.log(`StoryForge WordPress gateway mock listening on ${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}

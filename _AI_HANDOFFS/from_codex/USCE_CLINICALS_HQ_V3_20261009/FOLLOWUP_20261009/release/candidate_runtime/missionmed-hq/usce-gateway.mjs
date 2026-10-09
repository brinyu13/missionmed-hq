import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isUsceGatewayPath } from './usce-gateway-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outerPort = readPort(process.env.PORT, 4173);
const configuredInnerPort = readPort(process.env.MMHQ_USCE_GATEWAY_INNER_PORT, 4174);
const innerPort = configuredInnerPort === outerPort ? outerPort + 1 : configuredInnerPort;

const child = spawn(process.execPath, [path.join(__dirname, 'server.mjs')], {
  cwd: __dirname,
  env: {
    ...process.env,
    PORT: String(innerPort),
    MMHQ_USCE_GATEWAY_CHILD: '1',
  },
  stdio: 'inherit',
});

let stopping = false;

const gateway = http.createServer((request, response) => {
  let url;
  try {
    url = new URL(request.url || '/', 'http://usce-gateway.invalid');
  } catch {
    sendJson(response, 400, { error: 'invalid_request_url' });
    return;
  }

  if (!isUsceGatewayPath(url.pathname)) {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }

  const headers = { ...request.headers };
  const originalHost = String(headers.host || '').trim();
  delete headers.connection;
  delete headers['keep-alive'];
  delete headers['proxy-authenticate'];
  delete headers['proxy-authorization'];
  delete headers.te;
  delete headers.trailer;
  delete headers['transfer-encoding'];
  delete headers.upgrade;
  headers.host = `127.0.0.1:${innerPort}`;
  headers['x-forwarded-proto'] = 'https';
  if (originalHost) headers['x-forwarded-host'] = originalHost;

  const upstream = http.request({
    hostname: '127.0.0.1',
    port: innerPort,
    method: request.method,
    path: request.url,
    headers,
  }, (upstreamResponse) => {
    const responseHeaders = { ...upstreamResponse.headers };
    delete responseHeaders.connection;
    delete responseHeaders['keep-alive'];
    delete responseHeaders['proxy-authenticate'];
    delete responseHeaders['proxy-authorization'];
    delete responseHeaders.te;
    delete responseHeaders.trailer;
    delete responseHeaders['transfer-encoding'];
    delete responseHeaders.upgrade;
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
    upstreamResponse.pipe(response);
  });

  upstream.setTimeout(60_000, () => {
    upstream.destroy(new Error('USCE_GATEWAY_UPSTREAM_TIMEOUT'));
  });

  upstream.on('error', () => {
    if (!response.headersSent) {
      sendJson(response, 503, { error: 'usce_runtime_unavailable' });
    } else {
      response.destroy();
    }
  });

  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
});

gateway.on('upgrade', (_request, socket) => socket.destroy());
gateway.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});
gateway.on('error', (error) => {
  console.error('USCE_GATEWAY_FATAL:', error?.message || 'unknown');
  stop(1);
});

child.on('error', (error) => {
  console.error('USCE_RUNTIME_START_FAILED:', error?.message || 'unknown');
  stop(1);
});
child.on('exit', (code, signal) => {
  if (stopping) return;
  console.error('USCE_RUNTIME_EXITED:', signal || code || 'unknown');
  stop(Number.isInteger(code) && code !== 0 ? code : 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(0, signal));
}

gateway.listen(outerPort, '0.0.0.0', () => {
  console.log(`USCE gateway listening on port ${outerPort}`);
});

function readPort(raw, fallback) {
  const value = Number(raw || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error('USCE_GATEWAY_INVALID_PORT');
  }
  return value;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function stop(exitCode, signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal);
  const forceExit = setTimeout(() => process.exit(exitCode), 5_000);
  forceExit.unref();
  gateway.close(() => process.exit(exitCode));
}


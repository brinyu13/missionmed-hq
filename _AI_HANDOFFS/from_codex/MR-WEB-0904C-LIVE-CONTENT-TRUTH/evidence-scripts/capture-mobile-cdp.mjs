import fs from 'node:fs';

const [port, pageUrl, outputFile, scrollOffset = '0'] = process.argv.slice(2);
if (!port || !pageUrl || !outputFile) {
  throw new Error('Usage: node capture-mobile-cdp.mjs PORT URL OUTPUT_FILE');
}

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const target = targets.find((item) => item.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('No Chrome page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send('Page.navigate', { url: pageUrl });

let ready = false;
for (let attempt = 0; attempt < 40; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const state = await send('Runtime.evaluate', {
    expression: "document.readyState === 'complete' && !!document.querySelector('h1')",
    returnByValue: true,
  });
  if (state.result?.value === true) {
    ready = true;
    break;
  }
}
if (!ready) throw new Error('The rendered page did not become ready.');
await new Promise((resolve) => setTimeout(resolve, 800));

const metricsResult = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    heading: document.querySelector('h1')?.textContent?.trim() || null,
    stale: /Match Prep Pro|Forever Match Guarantee|MatchFirst|6-Month|August 1|Session C|\\$3,999|Unlimited mock/i.test(document.body.innerText)
  })`,
  returnByValue: true,
});
const metrics = JSON.parse(metricsResult.result.value);
if (metrics.innerWidth !== 390 || metrics.overflow || metrics.stale) {
  throw new Error(`Mobile verification failed: ${JSON.stringify(metrics)}`);
}

const requestedScroll = Number.parseInt(scrollOffset, 10) || 0;
if (requestedScroll > 0) {
  await send('Runtime.evaluate', {
    expression: `window.scrollTo(0, ${requestedScroll})`,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
fs.writeFileSync(outputFile, Buffer.from(screenshot.data, 'base64'));
console.log(JSON.stringify({ outputFile, ...metrics }));
socket.close();

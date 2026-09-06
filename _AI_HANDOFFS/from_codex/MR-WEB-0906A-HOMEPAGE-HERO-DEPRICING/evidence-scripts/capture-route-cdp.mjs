import fs from 'node:fs';

const [port, pageUrl, outputFile, rawWidth = '1440', rawHeight = '1200'] = process.argv.slice(2);
if (!port || !pageUrl || !outputFile) {
  throw new Error('Usage: node capture-route-cdp.mjs PORT URL OUTPUT_FILE [WIDTH] [HEIGHT]');
}

const width = Number.parseInt(rawWidth, 10);
const height = Number.parseInt(rawHeight, 10);
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 600) {
  throw new Error('Invalid viewport.');
}

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
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
  const callbacks = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) callbacks.reject(new Error(message.error.message));
  else callbacks.resolve(message.result);
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
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width <= 430,
});
await send('Page.navigate', { url: pageUrl });

let ready = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const state = await send('Runtime.evaluate', {
    expression: "document.readyState === 'complete' && !!document.body && document.body.innerText.length > 100",
    returnByValue: true,
  });
  if (state.result?.value === true) {
    ready = true;
    break;
  }
}
if (!ready) throw new Error('The rendered page did not become ready.');
await new Promise((resolve) => setTimeout(resolve, 1500));

await send('Runtime.evaluate', {
  expression: `(() => {
    const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent.trim().toUpperCase() === 'GOT IT');
    if (button) button.click();
    return !!button;
  })()`,
  returnByValue: true,
});
await new Promise((resolve) => setTimeout(resolve, 300));

const metricsResult = await send('Runtime.evaluate', {
  expression: `JSON.stringify((() => {
    const bodyText = document.body.innerText;
    const hero = document.querySelector('.mm-mr-p0-route');
    const pricePattern = /\\$2,799|\\$1,199|\\$5,499|\\$3,299|\\$3,199|launch tuition/i;
    return {
      url: location.href,
      title: document.title,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heroPresent: !!hero,
      heroText: hero?.innerText?.replace(/\\s+/g, ' ').trim() || null,
      homepageMissionResidencyPrices: Array.from(bodyText.matchAll(/\\$(?:2,799|1,199|5,499|3,299|3,199)/g), (match) => match[0]),
      hasPricingLanguage: pricePattern.test(bodyText),
    };
  })())`,
  returnByValue: true,
});
const metrics = JSON.parse(metricsResult.result.value);

const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
fs.writeFileSync(outputFile, Buffer.from(screenshot.data, 'base64'));
console.log(JSON.stringify({ outputFile, ...metrics }, null, 2));
socket.close();

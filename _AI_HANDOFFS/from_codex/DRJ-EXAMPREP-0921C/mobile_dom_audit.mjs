const port = Number(process.argv[2] || 9223);
const auditWidth = Number(process.argv[3] || 390);
const screenshotPath = process.argv[4] || '';
const targetUrl = process.argv[5] || '';
const response = await fetch(`http://127.0.0.1:${port}/json/list`);
const targets = await response.json();
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No headless Chrome page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await call('Runtime.enable');
await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride', {
  width: auditWidth,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true
});
if (targetUrl) await call('Page.navigate', { url: targetUrl });
else await call('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 5000));
const expression = `(() => {
  const root = document.documentElement;
  const viewport = root.clientWidth;
  const notice = document.querySelector('#mm-mobile-notice');
  const offenders = [...document.querySelectorAll('body *')]
    .map(el => ({
      tag: el.tagName,
      id: el.id,
      cls: String(el.className || '').slice(0, 120),
      left: Math.round(el.getBoundingClientRect().left),
      right: Math.round(el.getBoundingClientRect().right),
      width: Math.round(el.getBoundingClientRect().width),
      text: (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0,80)
    }))
    .filter(x => x.width && (x.right > viewport + 1 || x.left < -1))
    .sort((a,b) => b.right - a.right)
    .slice(0,40);
  return {
    viewport,
    scrollWidth: root.scrollWidth,
    overflow: root.scrollWidth > viewport,
    mobileNoticeDisplay: notice ? getComputedStyle(notice).display : null,
    mobileNoticeVisible: notice ? Boolean(notice.offsetWidth || notice.offsetHeight || notice.getClientRects().length) : false,
    offenders
  };
})()`;
const result = await call('Runtime.evaluate', { expression, returnByValue: true });
console.log(JSON.stringify(result.result.value, null, 2));
if (screenshotPath) {
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
}
socket.close();

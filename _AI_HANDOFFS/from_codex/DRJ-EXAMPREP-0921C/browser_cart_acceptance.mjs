const port = Number(process.argv[2] || 9223);
const response = await fetch(`http://127.0.0.1:${port}/json/list`);
const targets = await response.json();
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No browser page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
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
await call('Emulation.clearDeviceMetricsOverride');
const url = process.argv[3] || 'https://missionmedinstitute.com/cart/?add-to-cart=3651&variation_id=3668&attribute_exam-track=Step+1+%2F+Level+1&mmdrj_add_daily_rounds=yes&acceptance=0921c';
await call('Page.navigate', { url });
await new Promise((resolve) => setTimeout(resolve, 7000));
const expression = `(() => {
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const text = document.body.innerText.replace(/\\s+/g,' ').trim();
  const rows = [...document.querySelectorAll('.woocommerce-cart-form__cart-item, tr.cart_item')].map(row => ({
    product: (row.querySelector('.product-name')?.innerText || '').replace(/\\s+/g,' ').trim(),
    subtotal: (row.querySelector('.product-subtotal')?.innerText || '').replace(/\\s+/g,' ').trim(),
    eligibility: /Live Drills student rate/i.test(row.innerText)
  }));
  return {
    url: location.href,
    title: document.title,
    rows,
    notices: [...document.querySelectorAll('.woocommerce-error,.woocommerce-message,.wc-block-components-notice-banner')].filter(visible).map(x => x.innerText.replace(/\\s+/g,' ').trim()),
    today1999: /\\$19\\.99/.test(text),
    renewal300: /\\$300(?:\\.00)?\\s*\\/\\s*month/i.test(text),
    renewal1999: /\\$19\\.99\\s*\\/\\s*month/i.test(text),
    trial: /first renewal|free trial|7 day|1 week/i.test(text),
    checkoutVisible: [...document.querySelectorAll('a,button')].some(x => visible(x) && /proceed to checkout/i.test(x.innerText || '')),
    excerpt: text.slice(0, 1800)
  };
})()`;
const result = await call('Runtime.evaluate', { expression, returnByValue: true });
console.log(JSON.stringify(result.result.value, null, 2));
socket.close();

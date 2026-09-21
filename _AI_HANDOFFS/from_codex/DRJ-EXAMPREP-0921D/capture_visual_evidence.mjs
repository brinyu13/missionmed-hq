const port = Number(process.argv[2] || 9225);
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 1100);
const screenshotPath = process.argv[5] || '';
const targetUrl = process.argv[6] || '';
const mobile = process.argv[7] === 'mobile';

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
	width,
	height,
	deviceScaleFactor: 1,
	mobile,
});
await call('Page.navigate', { url: targetUrl });
await new Promise((resolve) => setTimeout(resolve, 6500));

const expression = `(() => {
	const root = document.documentElement;
	const viewport = root.clientWidth;
	const offenders = [...document.querySelectorAll('body *')]
		.map((el) => {
			const box = el.getBoundingClientRect();
			return {
				tag: el.tagName,
				id: el.id,
				cls: String(el.className || '').slice(0, 100),
				left: Math.round(box.left),
				right: Math.round(box.right),
				width: Math.round(box.width),
			};
		})
		.filter((item) => item.width && (item.right > viewport + 1 || item.left < -1))
		.slice(0, 20);
	return {
		url: location.href,
		title: document.title,
		viewport,
		scrollWidth: root.scrollWidth,
		overflow: root.scrollWidth > viewport,
		offenders,
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

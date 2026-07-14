import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoPath = path.resolve(__dirname, '../public/mmc-partner-demo/index.html');
const html = readFileSync(demoPath, 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/giu)].map((match) => match[1]);

assert.equal(inlineScripts.length, 1, 'Partner demo must contain one self-contained inline runtime.');
assert.doesNotThrow(
  () => new Function(inlineScripts[0]),
  'Partner demo inline runtime must compile as JavaScript.',
);

assert.match(html, /data-demo="partner-synthetic-static"/u, 'Partner demo must identify itself as synthetic static content.');
assert.match(html, /data:"synthetic-only"/u, 'Partner demo runtime must declare synthetic-only data.');
assert.match(html, /productionHydration:false/u, 'Partner demo must keep production hydration disabled.');
assert.match(html, /persistenceWrites:false/u, 'Partner demo must keep persistence writes disabled.');
assert.match(html, /externalCalls:false/u, 'Partner demo must declare zero external calls.');
assert.match(html, /privateRouteChanged:false/u, 'Partner demo must not alter the private MMC route.');
assert.match(html, /<meta name="robots" content="noindex,nofollow">/u, 'Partner demo must remain noindex/nofollow.');

for (const screen of ['today', 'directory', 'profile', 'actions', 'meeting', 'memory', 'goals', 'timeline', 'session', 'post', 'studentview']) {
  assert.match(html, new RegExp(`data-screen="${screen}"`, 'u'), `Partner demo must include the ${screen} screen.`);
}

const forbiddenRuntimePatterns = [
  /\bfetch\s*\(/u,
  /\bXMLHttpRequest\b/u,
  /\bWebSocket\b/u,
  /https?:\/\//u,
  /\.supabase\.co/u,
  /\bservice_role\b/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})\b/u,
];

for (const pattern of forbiddenRuntimePatterns) {
  assert.doesNotMatch(html, pattern, `Partner demo contains forbidden runtime or credential pattern ${pattern}.`);
}

console.log(JSON.stringify({
  result: 'MMC partner demo deterministic validation passed',
  route: '/mmc-partner-demo/',
  data: 'synthetic-only',
  externalCalls: false,
  persistenceWrites: false,
  screenCount: 11,
}, null, 2));

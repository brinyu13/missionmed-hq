#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import { CAM_ASSET_ROOT } from './review-server.mjs';
import { assert, runChecks } from './review-test-kit.mjs';

const files = await collectFiles(CAM_ASSET_ROOT);
const sources = new Map(await Promise.all(files.map(async (file) => [file, await fs.readFile(file, 'utf8')])));
const allSource = [...sources.values()].join('\n');
const indexPath = path.join(CAM_ASSET_ROOT, 'index.html');
const index = sources.get(indexPath) || '';

await runChecks('MMC CAM 007 static fallback (no browser claims)', [
  ['isolated CAM index exists', async () => {
    assert(index.length > 0, 'CAM index.html is missing.');
    assert(index.includes('/mmc-private/src/cam/app.js'), 'CAM index does not load the isolated app module.');
    assert(index.includes('/mmc-private/src/cam/styles.css'), 'CAM index does not load the isolated stylesheet.');
  }],
  ['CSP-compatible index has no inline executable/style blocks', async () => {
    assert(!/<script(?![^>]*\bsrc=)[^>]*>/iu.test(index), 'Inline script found in CAM index.');
    assert(!/<style(?:\s|>)/iu.test(index), 'Inline style block found in CAM index.');
    assert(!/\son[a-z]+\s*=/iu.test(index), 'Inline event handler found in CAM index.');
  }],
  ['semantic bootstrap and skip link exist', async () => {
    assert(/<html\s+lang="en"/iu.test(index), 'Document language is missing.');
    assert(/class="skip-link"[^>]+href="#main-content"/iu.test(index), 'Skip link is missing.');
    assert(/<main\s+id="main-content"/iu.test(index), 'Initial main landmark is missing.');
  }],
  ['historical private client is not imported', async () => {
    const forbidden = [
      '/mmc-private/src/app.js',
      '/mmc-private/src/styles.css',
      'mmc-data-adapters.js',
      'mmc-ownership-layer.js',
    ];
    for (const value of forbidden) assert(!allSource.includes(value), `CAM source imports historical private client asset: ${value}`);
  }],
  ['browser persistence and worker caches are absent', async () => {
    const forbidden = [/\blocalStorage\b/u, /\bsessionStorage\b/u, /\bindexedDB\b/u, /serviceWorker\.register/u, /caches\.open/u];
    for (const pattern of forbidden) assert(!pattern.test(allSource), `Forbidden durable browser persistence pattern found: ${pattern}`);
  }],
  ['mentor route and API families are explicit', async () => {
    const expected = [
      '/mmc-private/today', '/mmc-private/students', '/mmc-private/work', '/mmc-private/reviews', '/mmc-private/operations',
      '/api/mmc/v2/mentor/today', '/api/mmc/v2/mentor/students', '/api/mmc/v2/mentor/work',
      '/api/mmc/v2/mentor/reviews', '/api/mmc/v2/mentor/operations', '/api/mmc/v2/mentor/commands',
    ];
    for (const value of expected) assert(allSource.includes(value), `Expected route/API family is absent: ${value}`);
  }],
  ['critical test contracts are present', async () => {
    const expected = [
      'cam-shell', 'cam-rail', 'environment-badge', 'route-stage', 'attention-list', 'student-directory',
      'student-workspace', 'evidence-inspector', 'mobile-nav', 'command-palette', 'quick-capture-dialog',
    ];
    for (const value of expected) assert(allSource.includes(value), `Expected stable test identifier is absent: ${value}`);
  }],
  ['relative ESM imports resolve inside CAM asset root', async () => {
    for (const [file, source] of sources.entries()) {
      if (!/\.(?:m?js)$/u.test(file)) continue;
      for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/gu)) {
        const target = path.resolve(path.dirname(file), match[1]);
        assert(target.startsWith(`${CAM_ASSET_ROOT}${path.sep}`), `ESM import escapes CAM asset root: ${match[1]}`);
        const candidates = path.extname(target) ? [target] : [`${target}.js`, `${target}.mjs`, path.join(target, 'index.js')];
        assert(candidates.some((candidate) => sources.has(candidate)), `ESM import does not resolve: ${path.relative(CAM_ASSET_ROOT, file)} -> ${match[1]}`);
      }
    }
  }],
]);

async function collectFiles(root) {
  const output = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile() && /\.(?:css|html|m?js)$/u.test(entry.name)) output.push(candidate);
    }
  }
  return output.sort();
}

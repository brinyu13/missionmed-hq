#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(HERE, '..');
const capture = process.argv.includes('--capture');
const staticOnly = process.argv.includes('--static-only');
const unknown = process.argv.slice(2).filter((argument) => !['--capture', '--static-only'].includes(argument));
if (unknown.length) throw new Error(`Unknown review-suite arguments: ${unknown.join(', ')}`);

const scripts = staticOnly ? [
  path.join(root, 'browser/mentor-static-fallback-validation.mjs'),
  path.join(root, 'state/mentor-security-validation.mjs'),
] : [
  path.join(root, 'browser/mentor-static-fallback-validation.mjs'),
  path.join(root, 'state/mentor-security-validation.mjs'),
  path.join(root, 'browser/mentor-route-workflow-validation.mjs'),
  path.join(root, 'browser/mentor-multitab-validation.mjs'),
  path.join(root, 'state/mentor-state-matrix-validation.mjs'),
  path.join(root, 'a11y/mentor-keyboard-focus-validation.mjs'),
  path.join(root, 'visual/mentor-responsive-visual-validation.mjs'),
  path.join(root, 'performance/mentor-performance-validation.mjs'),
  path.join(root, 'usability/mentor-usability-heuristic-validation.mjs'),
  ...(capture ? [
    path.join(root, 'visual/capture-mentor-screenshots.mjs'),
    path.join(root, 'visual/mentor-screenshot-manifest-validation.mjs'),
  ] : []),
];

const results = [];
for (const script of scripts) {
  const startedAt = Date.now();
  const exitCode = await run(script);
  results.push({ script: path.relative(root, script), exitCode, durationMs: Date.now() - startedAt });
  if (exitCode !== 0) break;
}
const failed = results.find((result) => result.exitCode !== 0);
process.stdout.write(`${JSON.stringify({
  suite: 'MMC CAM 007 isolated Founder review suite',
  status: failed ? 'FAIL' : 'PASS',
  captureIncluded: capture,
  staticOnly,
  results,
}, null, 2)}\n`);
if (failed) process.exitCode = failed.exitCode || 1;

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: path.resolve(root, '../../..'),
      env: { ...process.env },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        process.stderr.write(`Review validation terminated by ${signal}: ${script}\n`);
        resolve(1);
      } else resolve(code ?? 1);
    });
  });
}

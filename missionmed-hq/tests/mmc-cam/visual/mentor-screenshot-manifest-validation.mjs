#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assert, assertEqual, runChecks } from '../browser/review-test-kit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(HERE, 'evidence', 'mentor-007');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
const checksums = await fs.readFile(path.join(root, 'CHECKSUMS.sha256'), 'utf8');

await runChecks('MMC CAM 007 screenshot evidence manifest', [
  ['manifest is explicitly synthetic and non-production', async () => {
    assertEqual(manifest.dataClassification, 'SYNTHETIC_ONLY', 'Screenshot classification drifted');
    assertEqual(manifest.productionConnections, false, 'Screenshot manifest claims a production connection');
    assertEqual(manifest.captureSurface, 'viewport only; browser chrome excluded', 'Capture-surface claim drifted');
  }],
  ['required viewport set is represented', async () => {
    const expected = ['1440x900', '1280x800', '1024x768', '768x1024', '390x844', '320x740'];
    const present = new Set(manifest.entries.map((entry) => `${entry.viewport.width}x${entry.viewport.height}`));
    for (const viewport of expected) assert(present.has(viewport), `Required viewport is absent: ${viewport}`);
  }],
  ['required state evidence is represented', async () => {
    const scenarios = new Set(manifest.entries.map((entry) => entry.scenario));
    for (const scenario of ['loading', 'empty', 'partial', 'stale', 'offline-not-saved', 'conflict', 'error', 'revoked']) {
      assert(scenarios.has(scenario), `Required screenshot state is absent: ${scenario}`);
    }
  }],
  ['visible environment labels preserve authority truth', async () => {
    for (const entry of manifest.entries) {
      const label = String(entry.visibleEnvironmentBadge || '').toLowerCase();
      if (['loading', 'error', 'revoked'].includes(entry.scenario)) {
        assert(label.includes('unconfirmed'), `${entry.id} falsely classifies an unavailable authority response`);
      } else {
        assert(label.includes('fixture'), `${entry.id} lacks its visible fixture classification`);
      }
    }
  }],
  ['every screenshot byte size and SHA-256 matches', async () => {
    const ids = new Set();
    let totalBytes = 0;
    for (const entry of manifest.entries) {
      assert(!ids.has(entry.id), `Duplicate screenshot ID: ${entry.id}`);
      ids.add(entry.id);
      const file = path.join(root, entry.file);
      const bytes = await fs.readFile(file);
      assertEqual(bytes[0], 0xff, `${entry.file} is not a JPEG`);
      assertEqual(bytes[1], 0xd8, `${entry.file} is not a JPEG`);
      assertEqual(bytes.length, entry.bytes, `${entry.file} byte count drifted`);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      assertEqual(digest, entry.sha256, `${entry.file} SHA-256 drifted`);
      assert(checksums.includes(`${digest}  ${entry.file}`), `${entry.file} is absent from CHECKSUMS.sha256`);
      totalBytes += bytes.length;
    }
    assertEqual(totalBytes, manifest.totalBytes, 'Manifest total byte count drifted');
    assert(totalBytes <= 40 * 1024 * 1024, `Screenshot evidence exceeds 40 MiB: ${totalBytes}`);
  }],
  ['manifest has no ephemeral review URL or absolute user path', async () => {
    const text = JSON.stringify(manifest);
    assert(!/127\.0\.0\.1:\d+/u.test(text), 'Manifest retained an ephemeral review port');
    assert(!text.includes('/Users/'), 'Manifest retained an absolute local path');
  }],
]);

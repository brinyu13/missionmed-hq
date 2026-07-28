import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_RELATIVE_PATH,
  CANONICAL_SHA256,
  PRODUCT_SURFACES,
} from '../tests/conformance/authority-contract.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDir = path.resolve(packageDir, '..');
const canonicalFile = path.join(repositoryDir, ...CANONICAL_RELATIVE_PATH);
const bytes = await readFile(canonicalFile);
const actualSha256 = createHash('sha256').update(bytes).digest('hex');

if (actualSha256 !== CANONICAL_SHA256) {
  throw new Error(
    `Founder-approved StoryForge V5 authority hash mismatch: `
      + `expected ${CANONICAL_SHA256}, received ${actualSha256}. Build stopped before dist generation.`,
  );
}
const requiredSurfaceKeys = [
  'home',
  'library',
  'story_detail',
  'story_builder',
  'notifications',
  'quick_capture',
  'interview_prep',
  'mentor',
  'settings',
  'review',
  'question_coverage',
  'reflection',
  'story_classification',
  'program_fit',
  'mentor_notes',
];
const missingSurfaceKeys = requiredSurfaceKeys.filter((key) => !PRODUCT_SURFACES[key]);
if (missingSurfaceKeys.length) {
  throw new Error(
    `StoryForge product authority contract is missing required surfaces: ${missingSurfaceKeys.join(', ')}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  authority: path.relative(repositoryDir, canonicalFile),
  sha256: actualSha256,
  bytes: bytes.length,
  requiredSurfaces: requiredSurfaceKeys,
  evidenceSurfaces: Object.keys(PRODUCT_SURFACES),
}, null, 2));

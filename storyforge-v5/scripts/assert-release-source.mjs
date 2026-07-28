import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertReleaseSource, parseBuildMode } from './release-source.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guardedReleasePaths = [
  path.join(packageDir, 'public'),
  path.join(packageDir, 'dist'),
  path.join(
    packageDir,
    'infra',
    'wordpress',
    'missionmed-storyforge-runtime',
  ),
];
const mode = parseBuildMode(process.argv.slice(2));
if (mode !== 'release') {
  throw new Error(
    'StoryForge release provenance failed: assert-release-source only accepts --mode=release.',
  );
}

const proof = assertReleaseSource({
  startDirectory: packageDir,
  forbiddenIgnoredPaths: guardedReleasePaths,
});

console.log(JSON.stringify({
  ok: true,
  mode: 'release',
  stage: 'source-preflight',
  releaseEligible: true,
  deployable: false,
  expectedCommit: proof.expectedCommit,
  head: proof.head,
  clean: proof.clean,
}, null, 2));

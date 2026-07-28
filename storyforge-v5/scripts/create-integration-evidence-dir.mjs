import { randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  realpath,
  rename,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { releaseExpectedCommit } from './release-source.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worktreeDir = path.resolve(packageDir, '..');
const localRoot = path.join(packageDir, '.local');
const b1503Root = path.join(worktreeDir, '_AI_HANDOFFS', 'from_codex');
const legacyRoot = path.join(
  b1503Root,
  'B1-502M_storyforge_megarun',
);
const expectedCommit = releaseExpectedCommit();
const requested = String(
  process.env.STORYFORGE_INTEGRATION_EVIDENCE_DIR
    || path.join(localRoot, 'integration-evidence'),
);

function fail(message) {
  throw new Error(`StoryForge integration evidence failed: ${message}`);
}

function within(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

async function prospectiveRealpath(candidate) {
  const missing = [];
  let existing = candidate;
  while (true) {
    try {
      await access(existing);
      break;
    } catch {
      const parent = path.dirname(existing);
      if (parent === existing) fail(`cannot resolve evidence root ${candidate}.`);
      missing.unshift(path.basename(existing));
      existing = parent;
    }
  }
  return path.resolve(await realpath(existing), ...missing);
}

function validateRoot(candidate, {
  physicalWorktree,
  physicalPackage,
  physicalLocal,
  physicalB1503,
  physicalLegacy,
}) {
  if (within(candidate, physicalLegacy)) {
    fail('refusing to overwrite prior-ticket B1-502M evidence receipts.');
  }
  if (within(candidate, physicalWorktree)) {
    const relativeB1503 = path.relative(physicalB1503, candidate);
    const isB1503 = (
      relativeB1503
      && !relativeB1503.startsWith('..')
      && relativeB1503.split(path.sep)[0].startsWith('B1-503')
    );
    if (!within(candidate, physicalLocal) && !isB1503) {
      fail(
        'an in-worktree evidence root must stay under storyforge-v5/.local '
          + 'or a caller-selected B1-503 handoff directory.',
      );
    }
  } else if (
    within(physicalWorktree, candidate)
    || within(physicalPackage, candidate)
  ) {
    fail('the evidence root cannot be an ancestor of the StoryForge worktree.');
  }
}

if (!path.isAbsolute(requested)) {
  fail('STORYFORGE_INTEGRATION_EVIDENCE_DIR must be an absolute path.');
}

const physicalWorktree = await realpath(worktreeDir);
const physicalPackage = await realpath(packageDir);
const physicalLocal = await prospectiveRealpath(localRoot);
const physicalB1503 = await prospectiveRealpath(b1503Root);
const physicalLegacy = await prospectiveRealpath(legacyRoot);
const roots = {
  physicalWorktree,
  physicalPackage,
  physicalLocal,
  physicalB1503,
  physicalLegacy,
};
const prospectiveRoot = await prospectiveRealpath(path.resolve(requested));
validateRoot(prospectiveRoot, roots);
await mkdir(prospectiveRoot, { recursive: true });
const evidenceRoot = await realpath(prospectiveRoot);
validateRoot(evidenceRoot, roots);

const evidenceDir = path.join(
  evidenceRoot,
  `run.${expectedCommit}.${randomUUID()}`,
);
await mkdir(evidenceDir, { recursive: false });
const status = {
  schemaVersion: 1,
  ticket: 'B1-503',
  status: 'in_progress',
  deployable: false,
  releaseArtifactEligible: false,
  deploymentAuthorized: false,
  expectedCommit,
  startedAt: new Date().toISOString(),
  completedAt: null,
  terminal: null,
};
const temporaryStatus = path.join(evidenceDir, '.RUN_STATUS.json.tmp');
await writeFile(temporaryStatus, `${JSON.stringify(status, null, 2)}\n`, {
  flag: 'wx',
});
await rename(temporaryStatus, path.join(evidenceDir, 'RUN_STATUS.json'));
process.stdout.write(evidenceDir);

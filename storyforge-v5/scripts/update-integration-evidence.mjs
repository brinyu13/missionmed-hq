import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  readFile,
  readlink,
  readdir,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertReleaseSource,
  releaseExpectedCommit,
} from './release-source.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedCommit = releaseExpectedCommit();
const argumentsMap = new Map(
  process.argv.slice(2).map((argument) => {
    const separator = argument.indexOf('=');
    if (!argument.startsWith('--') || separator < 3) {
      throw new Error(`Invalid integration evidence argument: ${argument}`);
    }
    return [argument.slice(2, separator), argument.slice(separator + 1)];
  }),
);
const evidenceDir = path.resolve(argumentsMap.get('directory') || '');
const nextStatus = argumentsMap.get('status');
const statusFile = path.join(evidenceDir, 'RUN_STATUS.json');

function fail(message) {
  throw new Error(`StoryForge integration evidence failed: ${message}`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function filesBelow(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) fail(`artifact tree contains a symbolic link: ${relative}.`);
    if (entry.isDirectory()) {
      files.push(...await filesBelow(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      fail(`artifact tree contains an unsupported entry: ${relative}.`);
    }
  }
  return files;
}

async function artifact(pathname) {
  const bytes = await readFile(pathname);
  const details = await stat(pathname);
  return {
    path: pathname,
    sha256: sha256(bytes),
    size: details.size,
  };
}

async function writeStatus(value) {
  const temporary = path.join(
    evidenceDir,
    `.RUN_STATUS.${randomUUID()}.tmp`,
  );
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
  await rename(temporary, statusFile);
}

if (!argumentsMap.get('directory')) fail('--directory is required.');
const current = JSON.parse(await readFile(statusFile, 'utf8'));
if (
  current.schemaVersion !== 1
  || current.ticket !== 'B1-503'
  || current.status !== 'in_progress'
  || current.deployable !== false
  || current.releaseArtifactEligible !== false
  || current.deploymentAuthorized !== false
  || current.expectedCommit !== expectedCommit
) {
  fail('RUN_STATUS.json is not the matching in-progress B1-503 receipt.');
}

if (nextStatus === 'failed') {
  const exitCode = Number(argumentsMap.get('exit-code'));
  if (!Number.isInteger(exitCode) || exitCode === 0) {
    fail('a nonzero --exit-code is required for failed evidence.');
  }
  await writeStatus({
    ...current,
    status: 'failed',
    deployable: false,
    releaseArtifactEligible: false,
    deploymentAuthorized: false,
    completedAt: new Date().toISOString(),
    terminal: {
      exitCode,
      clean: false,
    },
  });
} else if (nextStatus === 'complete') {
  const required = [
    'terminal-proof',
    'dist',
    'route',
    'release',
    'edge',
    'staged-release',
    'current-link',
  ];
  for (const name of required) {
    if (!argumentsMap.get(name)) fail(`--${name} is required for complete evidence.`);
  }

  const terminalProof = JSON.parse(
    await readFile(path.resolve(argumentsMap.get('terminal-proof')), 'utf8'),
  );
  if (
    terminalProof.ok !== true
    || terminalProof.mode !== 'release'
    || terminalProof.stage !== 'source-preflight'
    || terminalProof.expectedCommit !== expectedCommit
    || terminalProof.head !== expectedCommit
    || terminalProof.clean !== true
  ) {
    fail('terminal source proof is not a clean exact-commit release proof.');
  }

  const releasePath = path.resolve(argumentsMap.get('release'));
  const stagedReleasePath = path.resolve(argumentsMap.get('staged-release'));
  const currentLink = path.resolve(argumentsMap.get('current-link'));
  const stagedRuntimeRoot = path.dirname(currentLink);
  const releasesRoot = path.join(stagedRuntimeRoot, 'releases');
  const stagedReleaseDir = path.join(releasesRoot, expectedCommit);
  if (stagedReleasePath !== path.join(stagedReleaseDir, 'release.php')) {
    fail('the staged release.php is not under the expected commit-labeled runtime path.');
  }
  for (const directory of [stagedRuntimeRoot, releasesRoot, stagedReleaseDir]) {
    const details = await lstat(directory);
    if (!details.isDirectory() || details.isSymbolicLink()) {
      fail(`the staged runtime directory is not a real directory: ${directory}.`);
    }
  }
  const stagedReleaseDetails = await lstat(stagedReleasePath);
  if (!stagedReleaseDetails.isFile() || stagedReleaseDetails.isSymbolicLink()) {
    fail('the staged release.php is not a regular file.');
  }
  const [releaseBytes, stagedReleaseBytes] = await Promise.all([
    readFile(releasePath),
    readFile(stagedReleasePath),
  ]);
  if (!releaseBytes.equals(stagedReleaseBytes)) {
    fail('commit-labeled staged release.php bytes differ from the committed release.php.');
  }

  const currentDetails = await lstat(currentLink);
  if (!currentDetails.isSymbolicLink()) {
    fail('the staged current runtime selector is not a symbolic link.');
  }
  const currentTarget = await readlink(currentLink);
  if (currentTarget !== `releases/${expectedCommit}`) {
    fail(`the staged current runtime selector is ${currentTarget}, not the expected commit.`);
  }

  const distDir = path.resolve(argumentsMap.get('dist'));
  const dist = [];
  for (const relative of await filesBelow(distDir)) {
    const details = await artifact(path.join(distDir, relative));
    dist.push({
      path: relative,
      sha256: details.sha256,
      size: details.size,
    });
  }
  const route = await artifact(path.resolve(argumentsMap.get('route')));
  const release = await artifact(releasePath);
  const edge = await artifact(path.resolve(argumentsMap.get('edge')));
  const releaseSource = releaseBytes.toString('utf8');
  const releaseId = releaseSource.match(/'release_id'\s*=>\s*'([^']+)'/)?.[1];
  if (!releaseId || !/^v-[a-f0-9]{16}$/.test(releaseId)) {
    fail('the committed release.php has no valid release ID.');
  }
  const finalSourceProof = assertReleaseSource({
    startDirectory: packageDir,
    forbiddenIgnoredPaths: [
      path.join(packageDir, 'public'),
      distDir,
      path.dirname(releasePath),
    ],
  });
  const [finalReleaseBytes, finalStagedReleaseBytes] = await Promise.all([
    readFile(releasePath),
    readFile(stagedReleasePath),
  ]);
  if (
    sha256(finalReleaseBytes) !== release.sha256
    || sha256(finalStagedReleaseBytes) !== release.sha256
  ) {
    fail('release.php bytes changed during terminal evidence verification.');
  }

  await writeStatus({
    ...current,
    status: 'complete',
    deployable: false,
    releaseArtifactEligible: true,
    deploymentAuthorized: false,
    completedAt: new Date().toISOString(),
    terminal: {
      expectedCommit,
      head: finalSourceProof.head,
      clean: finalSourceProof.clean,
      releaseId,
      stagedRuntime: {
        releasePhpSha256: sha256(stagedReleaseBytes),
        currentTarget,
      },
      artifacts: {
        dist,
        wordpressRoute: route,
        releasePhp: release,
        edgeAliases: edge,
      },
    },
  });
} else {
  fail('--status must be failed or complete.');
}

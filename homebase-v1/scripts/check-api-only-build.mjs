import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertHomeBaseReleaseSafety } from './phase-one-release-safety.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(packageDir, 'server');
const packageManifest = JSON.parse(
  await readFile(path.join(packageDir, 'package.json'), 'utf8'),
);
const railwayManifest = JSON.parse(
  await readFile(path.join(packageDir, 'railway.json'), 'utf8'),
);

function fail(message) {
  throw new Error(`HomeBase API-only build failed: ${message}`);
}

function runNode(args, environment = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: packageDir,
    env: environment,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    fail(`node ${args.join(' ')} failed${detail ? `: ${detail}` : '.'}`);
  }
}

await assertHomeBaseReleaseSafety({ packageDir });

if (packageManifest.scripts?.start !== 'node server/app.mjs') {
  fail('package start command must remain node server/app.mjs.');
}
if (packageManifest.scripts?.['build:api'] !== 'node scripts/check-api-only-build.mjs') {
  fail('package build:api command is not the self-contained API verifier.');
}
if (railwayManifest.build?.buildCommand !== 'npm run build:api') {
  fail('Railway must invoke npm run build:api.');
}
if (railwayManifest.deploy?.startCommand !== 'npm start') {
  fail('Railway must invoke npm start.');
}
if (railwayManifest.deploy?.healthcheckPath !== '/healthz') {
  fail('Railway healthcheck must remain /healthz.');
}

async function serverModuleFiles(directory, relativeDirectory = 'server') {
  const modules = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relative = `${relativeDirectory}/${entry.name}`;
    if (entry.isSymbolicLink()) fail(`server source must not contain symlinks: ${relative}.`);
    if (entry.isDirectory()) {
      modules.push(...await serverModuleFiles(path.join(directory, entry.name), relative));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      modules.push(relative);
    }
  }
  return modules.sort();
}

const serverFiles = await serverModuleFiles(serverDir);
if (!serverFiles.includes('server/app.mjs')) {
  fail('server/app.mjs is missing from the provider upload.');
}
for (const relative of serverFiles) {
  runNode(['--check', relative]);
}

const probeEnvironment = { ...process.env };
delete probeEnvironment.HOMEBASE_DEV_AUTH;
delete probeEnvironment.HOMEBASE_ORIGIN_API_ONLY;
runNode([
  '--input-type=module',
  '--eval',
  [
    "const loaded = await import('./server/app.mjs');",
    "const configModule = await import('./server/config.mjs');",
    'if (typeof loaded.createAppServer !== "function") process.exit(2);',
    'if (configModule.config.originApiOnly !== true) process.exit(3);',
    'if (configModule.config.packageDir !== process.cwd()) process.exit(4);',
  ].join(' '),
], probeEnvironment);

console.log(JSON.stringify({
  ok: true,
  mode: 'api-only-provider',
  selfContainedPackageRoot: true,
  canonicalProductBuildInvoked: false,
  releaseArtifactEligible: false,
  deployable: false,
  deploymentAuthorized: false,
  entrypoint: packageManifest.scripts.start,
  serverModules: serverFiles,
}, null, 2));

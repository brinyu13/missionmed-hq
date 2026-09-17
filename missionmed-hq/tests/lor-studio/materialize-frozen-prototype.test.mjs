import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  CANONICAL_MATERIALIZED_OUTPUT_BYTES,
  CANONICAL_MATERIALIZED_OUTPUT_SHA256,
  CANONICAL_PROTOTYPE_SHA256,
  PRODUCTION_ADAPTER_VERSION,
  PROTOTYPE_SOURCE_ENV_VAR,
  verifyCommittedMaterialization,
} from '../../scripts/lor-studio/materialize-frozen-prototype.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeDirectory = path.resolve(testDirectory, '..', '..');
const materializerPath = path.join(runtimeDirectory, 'scripts', 'lor-studio', 'materialize-frozen-prototype.mjs');
const committedOutputPath = path.join(runtimeDirectory, 'public', 'lor-studio', 'index.html');
const committedManifestPath = path.join(runtimeDirectory, 'public', 'lor-studio', 'FROZEN_PRESENTATION_MANIFEST.json');
const testRoot = await mkdtemp(path.join(os.tmpdir(), 'lor-materializer-test-'));

after(async () => {
  await rm(testRoot, { recursive: true, force: true });
});

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function createCommittedFixture(name) {
  const directory = path.join(testRoot, name);
  await mkdir(directory, { recursive: true });
  const outputPath = path.join(directory, 'index.html');
  const manifestPath = path.join(directory, 'FROZEN_PRESENTATION_MANIFEST.json');
  await Promise.all([
    copyFile(committedOutputPath, outputPath),
    copyFile(committedManifestPath, manifestPath),
  ]);
  return { directory, outputPath, manifestPath };
}

async function loadWithDefaultSource(defaultSourcePath) {
  const original = await readFile(materializerPath, 'utf8');
  const originalDeclaration = "const defaultSource = '/Users/brianb/MissionMed/F2-LOR-1003-functional-prototype.html';";
  assert.equal(original.split(originalDeclaration).length, 2, 'test seam must replace exactly one default source declaration');
  const isolated = original.replace(
    originalDeclaration,
    `const defaultSource = ${JSON.stringify(defaultSourcePath)};`,
  );
  const isolatedPath = path.join(testRoot, `materializer-${randomUUID()}.mjs`);
  await writeFile(isolatedPath, isolated, { flag: 'wx', mode: 0o600 });
  return import(`${pathToFileURL(isolatedPath).href}?v=${randomUUID()}`);
}

test('verifies the exact committed materialization without modifying it', async () => {
  const beforeOutput = await readFile(committedOutputPath);
  const beforeManifest = await readFile(committedManifestPath);
  const result = await verifyCommittedMaterialization();

  assert.equal(result.sourceSha256, CANONICAL_PROTOTYPE_SHA256);
  assert.equal(result.adapterVersion, PRODUCTION_ADAPTER_VERSION);
  assert.equal(result.outputSha256, CANONICAL_MATERIALIZED_OUTPUT_SHA256);
  assert.equal(result.outputBytes, CANONICAL_MATERIALIZED_OUTPUT_BYTES);
  assert.deepEqual(await readFile(committedOutputPath), beforeOutput);
  assert.deepEqual(await readFile(committedManifestPath), beforeManifest);
});

test('reuses only a verified committed materialization when the implicit default source is absent', async () => {
  const fixture = await createCommittedFixture('implicit-default-missing');
  const missingDefault = path.join(fixture.directory, 'missing-default-prototype.html');
  const materializer = await loadWithDefaultSource(missingDefault);
  const beforeOutput = await readFile(fixture.outputPath);
  const beforeManifest = await readFile(fixture.manifestPath);

  const result = await materializer.materialize({
    outputPath: fixture.outputPath,
    manifestPath: fixture.manifestPath,
    environment: {},
  });

  assert.equal(result.sourcePath, missingDefault);
  assert.equal(result.reusedCommittedMaterialization, true);
  assert.equal(result.outputSha256, CANONICAL_MATERIALIZED_OUTPUT_SHA256);
  assert.deepEqual(await readFile(fixture.outputPath), beforeOutput);
  assert.deepEqual(await readFile(fixture.manifestPath), beforeManifest);
});

test('never falls back for an explicit source argument or configured source environment', async () => {
  const fixture = await createCommittedFixture('explicit-sources');
  const missingDefault = path.join(fixture.directory, 'missing-default.html');
  const missingExplicit = path.join(fixture.directory, 'missing-explicit.html');
  const materializer = await loadWithDefaultSource(missingDefault);

  await assert.rejects(
    materializer.materialize({
      sourcePath: missingExplicit,
      outputPath: fixture.outputPath,
      manifestPath: fixture.manifestPath,
      environment: {},
    }),
    /Canonical frozen prototype was not readable/u,
  );
  await assert.rejects(
    materializer.materialize({
      outputPath: fixture.outputPath,
      manifestPath: fixture.manifestPath,
      environment: { [PROTOTYPE_SOURCE_ENV_VAR]: missingExplicit },
    }),
    /Canonical frozen prototype was not readable/u,
  );
});

test('never falls back when the implicit default exists but is non-canonical', async () => {
  const fixture = await createCommittedFixture('tampered-default');
  const tamperedDefault = path.join(fixture.directory, 'prototype.html');
  await writeFile(tamperedDefault, '<!doctype html><p>tampered</p>');
  const materializer = await loadWithDefaultSource(tamperedDefault);

  await assert.rejects(
    materializer.materialize({
      outputPath: fixture.outputPath,
      manifestPath: fixture.manifestPath,
      environment: {},
    }),
    /Canonical prototype digest mismatch/u,
  );
});

test('fails closed when a committed fallback file is missing or is a symlink', async (context) => {
  await context.test('missing output', async () => {
    const fixture = await createCommittedFixture('missing-output');
    await unlink(fixture.outputPath);
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /Committed materialized output was not safely readable/u,
    );
  });

  await context.test('missing manifest', async () => {
    const fixture = await createCommittedFixture('missing-manifest');
    await unlink(fixture.manifestPath);
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /Committed frozen presentation manifest was not safely readable/u,
    );
  });

  await context.test('symlink output', async () => {
    const fixture = await createCommittedFixture('symlink-output');
    await unlink(fixture.outputPath);
    await symlink(committedOutputPath, fixture.outputPath);
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /Committed materialized output was not safely readable/u,
    );
  });

  await context.test('symlink manifest', async () => {
    const fixture = await createCommittedFixture('symlink-manifest');
    await unlink(fixture.manifestPath);
    await symlink(committedManifestPath, fixture.manifestPath);
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /Committed frozen presentation manifest was not safely readable/u,
    );
  });
});

test('rejects invalid JSON, extra manifest keys, and every security-bound manifest field', async (context) => {
  const cases = [
    ['source name', 'sourceName', 'different-prototype.html', /source name mismatch/u],
    ['source digest', 'sourceSha256', '0'.repeat(64), /source digest mismatch/u],
    ['source bytes', 'sourceBytes', 1, /source byte count mismatch/u],
    ['adapter version', 'adapterVersion', PRODUCTION_ADAPTER_VERSION + 1, /adapter version mismatch/u],
    ['output digest', 'outputSha256', '0'.repeat(64), /output digest mismatch/u],
    ['output bytes', 'outputBytes', CANONICAL_MATERIALIZED_OUTPUT_BYTES - 1, /output byte count mismatch/u],
    ['security transforms', 'securityTransforms', ['toast_text_only'], /security transforms mismatch/u],
  ];

  await context.test('invalid JSON', async () => {
    const fixture = await createCommittedFixture('invalid-json');
    await writeFile(fixture.manifestPath, '{');
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /manifest is not valid JSON/u,
    );
  });

  await context.test('extra key', async () => {
    const fixture = await createCommittedFixture('extra-key');
    const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
    manifest.unexpected = true;
    await writeFile(fixture.manifestPath, JSON.stringify(manifest));
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /manifest has an unexpected shape/u,
    );
  });

  for (const [name, field, value, expected] of cases) {
    await context.test(name, async () => {
      const fixture = await createCommittedFixture(`manifest-${field}`);
      const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
      manifest[field] = value;
      await writeFile(fixture.manifestPath, JSON.stringify(manifest));
      await assert.rejects(verifyCommittedMaterialization(fixture), expected);
    });
  }
});

test('rejects changed output bytes and removed quarantine markers', async (context) => {
  await context.test('changed byte count', async () => {
    const fixture = await createCommittedFixture('changed-byte-count');
    await writeFile(fixture.outputPath, `${await readFile(fixture.outputPath, 'utf8')}\n`);
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /materialized output byte count mismatch/u,
    );
  });

  await context.test('removed quarantine marker', async () => {
    const fixture = await createCommittedFixture('removed-quarantine-marker');
    const output = await readFile(fixture.outputPath, 'utf8');
    const changed = output.replace('id="lorRuntimeGate"', 'id="lorRuntimeGatf"');
    assert.equal(Buffer.byteLength(changed), CANONICAL_MATERIALIZED_OUTPUT_BYTES);
    assert.notEqual(digest(changed), CANONICAL_MATERIALIZED_OUTPUT_SHA256);
    await writeFile(fixture.outputPath, changed);
    await assert.rejects(
      verifyCommittedMaterialization(fixture),
      /missing required security marker/u,
    );
  });
});

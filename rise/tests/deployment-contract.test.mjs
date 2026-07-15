import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const riseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("isolated RISE deployment contract cannot launch the HQ service", async () => {
  const contract = JSON.parse(await fs.readFile(path.join(riseRoot, "deployment-contract.v1.json"), "utf8"));
  const railway = JSON.parse(await fs.readFile(path.join(riseRoot, "railway.json"), "utf8"));
  const dockerfile = await fs.readFile(path.join(riseRoot, "Dockerfile"), "utf8");
  const packageJson = JSON.parse(await fs.readFile(path.join(riseRoot, "package.json"), "utf8"));

  assert.equal(contract.service, "missionmed-rise");
  assert.equal(contract.serviceRoot, "/rise");
  assert.equal(contract.configFilePath, "/rise/railway.json");
  assert.deepEqual(contract.expectedEntrypoint, ["node", "server.mjs"]);
  assert.ok(contract.forbiddenEntrypoints.includes("node missionmed-hq/server.mjs"));
  assert.equal(railway.build.builder, "DOCKERFILE");
  assert.equal(railway.build.dockerfilePath, "Dockerfile");
  assert.equal(railway.deploy.healthcheckPath, contract.healthcheckPath);
  assert.equal(packageJson.scripts.start, "node server.mjs");
  assert.match(dockerfile, /CMD \["node", "server\.mjs"\]/);
  assert.doesNotMatch(dockerfile, /missionmed-hq/);
});

test("production contract pins auth, source rights, index, assets, and abuse control", async () => {
  const contract = JSON.parse(await fs.readFile(path.join(riseRoot, "deployment-contract.v1.json"), "utf8"));
  for (const name of [
    "RISE_AUTH_ADAPTER_MODULE",
    "RISE_ABUSE_ADAPTER_MODULE",
    "RISE_INDEX_SHA256",
    "RISE_INDEX_MANIFEST_PATH",
    "RISE_SOURCE_AUTHORIZATION_SHA256S",
    "RISE_ASSET_MANIFEST_SHA256",
    "RISE_BUILD_ID",
  ]) {
    assert.ok(contract.requiredEnvironment.includes(name), `missing ${name}`);
  }
  assert.equal(contract.requiredValues.RISE_AUTH_MODE, "injected");
  assert.equal(contract.runtimeArtifactPolicy.registryIndexEmbeddedInImage, false);
  assert.equal(contract.runtimeArtifactPolicy.syntheticRegistryProhibitedInProduction, true);
  assert.equal(contract.runtimeArtifactPolicy.sourceAuthorizationHashesMustMatchRuntimePins, true);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateProductionEnvironment } from "../server.mjs";

const riseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("isolated RISE deployment contract cannot launch the HQ service", async () => {
  const contract = JSON.parse(await fs.readFile(path.join(riseRoot, "deployment-contract.v1.json"), "utf8"));
  const railway = JSON.parse(await fs.readFile(path.join(riseRoot, "railway.json"), "utf8"));
  const dockerfile = await fs.readFile(path.join(riseRoot, "Dockerfile"), "utf8");
  const serverSource = await fs.readFile(path.join(riseRoot, "server.mjs"), "utf8");
  const startProductionSource = await fs.readFile(path.join(riseRoot, "tools/start-production.mjs"), "utf8");
  const packageJson = JSON.parse(await fs.readFile(path.join(riseRoot, "package.json"), "utf8"));

  assert.equal(contract.service, "missionmed-rise");
  assert.equal(contract.serviceRoot, "/rise");
  assert.equal(contract.configFilePath, "/rise/railway.json");
  assert.deepEqual(contract.expectedEntrypoint, ["node", "tools/start-production.mjs"]);
  assert.ok(contract.forbiddenEntrypoints.includes("node missionmed-hq/server.mjs"));
  assert.equal(railway.build.builder, "DOCKERFILE");
  assert.equal(railway.build.dockerfilePath, "Dockerfile");
  assert.equal(railway.deploy.healthcheckPath, contract.healthcheckPath);
  assert.equal(packageJson.scripts.start, "node server.mjs");
  assert.equal(packageJson.scripts["start:production"], "node tools/start-production.mjs");
  assert.match(dockerfile, /CMD \["node", "tools\/start-production\.mjs"\]/);
  assert.match(dockerfile, /node:22-alpine@sha256:[a-f0-9]{64}/);
  assert.match(dockerfile, /COPY adapters \.\/adapters/);
  assert.doesNotMatch(dockerfile, /RISE_AUTH_ADAPTER_MODULE=/);
  assert.doesNotMatch(dockerfile, /RISE_ABUSE_ADAPTER_MODULE=/);
  const runtimeStage = dockerfile.slice(dockerfile.indexOf(" AS runtime"));
  assert.match(runtimeStage, /rm -rf \/usr\/local\/lib\/node_modules\/npm/);
  assert.match(runtimeStage, /\/usr\/local\/lib\/node_modules\/corepack/);
  assert.match(runtimeStage, /\/opt\/yarn-v\$\{YARN_VERSION\}/);
  assert.doesNotMatch(runtimeStage, /npm ci/);
  assert.doesNotMatch(runtimeStage, /COPY package\.json package-lock\.json/);
  assert.doesNotMatch(runtimeStage, /--chown=node:node \/app\/dist/);
  assert.doesNotMatch(serverSource, /LUCIDE_UMD_PATH\s*=\s*require\.resolve/);
  assert.doesNotMatch(dockerfile, /missionmed-hq/);
  assert.match(startProductionSource, /if \(isProductionEnvironment\(\)\) validateProductionEnvironment\(\);/);
  assert.ok(
    startProductionSource.indexOf("validateProductionEnvironment();") <
      startProductionSource.indexOf("prepareRuntimeArtifacts();"),
    "production environment validation must run before artifact fetching",
  );
});

test("production contract pins auth, source rights, index, assets, and abuse control", async () => {
  const contract = JSON.parse(await fs.readFile(path.join(riseRoot, "deployment-contract.v1.json"), "utf8"));
  for (const name of [
    "RISE_AUTH_ADAPTER_MODULE",
    "RISE_AUTH_ISSUER",
    "RISE_LOGIN_URL",
    "RISE_AUDIT_HMAC_KEY",
    "RISE_ABUSE_ADAPTER_MODULE",
    "RISE_ABUSE_CONTROL_URL",
    "RISE_SOURCE_RIGHTS_ADAPTER_MODULE",
    "RISE_SOURCE_RIGHTS_CONTROL_URL",
    "RISE_SOURCE_RIGHTS_CONTROL_TOKEN",
    "RISE_ARTIFACT_ORIGIN",
    "RISE_INDEX_URL",
    "RISE_INDEX_SHA256",
    "RISE_INDEX_MANIFEST_PATH",
    "RISE_INDEX_MANIFEST_SHA256",
    "RISE_ACTIVATION_RECEIPT_PATH",
    "RISE_ACTIVATION_RECEIPT_SHA256",
    "RISE_SOURCE_AUTHORIZATION_SHA256S",
    "RISE_ASSET_MANIFEST_SHA256",
    "RISE_BUILD_ID",
    "RISE_PUBLIC_ORIGIN",
  ]) {
    assert.ok(contract.requiredEnvironment.includes(name), `missing ${name}`);
  }
  assert.equal(contract.requiredValues.RISE_AUTH_MODE, "injected");
  assert.equal(contract.requiredValues.RISE_SOURCE_RIGHTS_ADAPTER_MODULE, "/app/adapters/http-source-rights.mjs");
  assert.equal(contract.runtimeArtifactPolicy.registryIndexEmbeddedInImage, false);
  assert.equal(contract.runtimeArtifactPolicy.registryArtifactsFetchedFromOnePinnedOrigin, true);
  assert.equal(contract.runtimeArtifactPolicy.activationReceiptMustBindIndexAndManifest, true);
  assert.equal(contract.runtimeArtifactPolicy.syntheticRegistryProhibitedInProduction, true);
  assert.equal(contract.runtimeArtifactPolicy.sourceAuthorizationHashesMustMatchRuntimePins, true);
  assert.equal(contract.runtimeArtifactPolicy.liveSourceRightsMustBeRevalidatedAtStartupAndEveryAuthenticatedRequest, true);
  assert.equal(contract.runtimeArtifactPolicy.insecureLoopbackOverridesProhibitedInProduction, true);
  assert.equal(contract.runtimeArtifactPolicy.webAssetManifestMustCoverEveryServedAsset, true);
  assert.equal(contract.runtimeArtifactPolicy.webAssetsMustRemainRootOwned, true);
  assert.equal(contract.runtimeArtifactPolicy.registryResponsesMustNotBeCached, true);
  assert.equal(contract.runtimeArtifactPolicy.readOnlyRootFilesystemRequired, true);
});

test("production environment validation enforces the deployment contract", () => {
  const sha = "a".repeat(64);
  const environment = {
    NODE_ENV: "production",
    RISE_ENVIRONMENT: "production",
    RISE_AUTH_MODE: "injected",
    RISE_AUTH_ADAPTER_MODULE: "/app/adapters/hq-auth.mjs",
    RISE_AUTH_ISSUER: "https://os.missionmedinstitute.com",
    RISE_LOGIN_URL: "https://os.missionmedinstitute.com/api/auth/start?audience=rise",
    RISE_HQ_AUTH_SESSION_URL: "https://os.missionmedinstitute.com/api/auth/session",
    RISE_HQ_SESSION_COOKIE_NAME: "mmhq_session",
    RISE_SESSION_BINDING_HMAC_KEY: "binding-key-000000000000000000000",
    RISE_AUDIT_HMAC_KEY: "audit-key-00000000000000000000000",
    RISE_ABUSE_ADAPTER_MODULE: "/app/adapters/http-abuse.mjs",
    RISE_ABUSE_CONTROL_URL: "https://abuse.example.test/v1/decisions",
    RISE_ABUSE_CONTROL_TOKEN: "abuse-token-000000000000000000000",
    RISE_SOURCE_RIGHTS_ADAPTER_MODULE: "/app/adapters/http-source-rights.mjs",
    RISE_SOURCE_RIGHTS_CONTROL_URL: "https://rights.example.test/v1/current",
    RISE_SOURCE_RIGHTS_CONTROL_TOKEN: "rights-token-00000000000000000000",
    RISE_ARTIFACT_ORIGIN: "https://artifacts.example.test",
    RISE_ARTIFACT_BEARER_TOKEN: "artifact-token-0000000000000000000",
    RISE_INDEX_URL: "https://artifacts.example.test/rise/api-index.json",
    RISE_INDEX_PATH: "/tmp/rise/api-index.json",
    RISE_INDEX_SHA256: sha,
    RISE_INDEX_MANIFEST_PATH: "/tmp/rise/index-manifest.json",
    RISE_INDEX_MANIFEST_URL: "https://artifacts.example.test/rise/index-manifest.json",
    RISE_INDEX_MANIFEST_SHA256: sha,
    RISE_ACTIVATION_RECEIPT_PATH: "/tmp/rise/activation-receipt.json",
    RISE_ACTIVATION_RECEIPT_URL: "https://artifacts.example.test/rise/activation-receipt.json",
    RISE_ACTIVATION_RECEIPT_SHA256: sha,
    RISE_SOURCE_AUTHORIZATION_SHA256S: sha,
    RISE_ASSET_MANIFEST_SHA256: sha,
    RISE_BUILD_ID: "rise_web_fixture",
    RISE_PUBLIC_ORIGIN: "https://missionmedinstitute.com",
  };
  assert.equal(validateProductionEnvironment(environment), true);
  assert.throws(
    () => validateProductionEnvironment({ ...environment, RISE_BUILD_ID: "" }),
    /RISE_BUILD_ID/,
  );
  assert.throws(
    () => validateProductionEnvironment({ ...environment, RISE_HQ_AUTH_SESSION_URL: "https://evil.example.test/api/auth/session" }),
    /topology/,
  );
  for (const name of [
    "RISE_ALLOW_INSECURE_LOOPBACK_AUTH",
    "RISE_ALLOW_INSECURE_LOOPBACK_ABUSE",
    "RISE_ALLOW_INSECURE_LOOPBACK_SOURCE_RIGHTS",
    "RISE_ALLOW_INSECURE_LOOPBACK_ARTIFACTS",
  ]) {
    assert.throws(
      () => validateProductionEnvironment({ ...environment, [name]: "true" }),
      new RegExp(`${name}.*prohibited`),
    );
  }
});

test("same-origin route contract covers the application, vendor asset, and API", async () => {
  const routeContract = JSON.parse(await fs.readFile(path.join(riseRoot, "route-contract.v1.json"), "utf8"));
  assert.equal(routeContract.browserTopology, "same_origin_reverse_proxy");
  assert.equal(routeContract.browserApiUrls, "relative_same_origin_only");
  assert.deepEqual(routeContract.requiredPathMappings.map((item) => item.publicPrefix), [
    "/rise",
    "/rise/vendor/lucide.js",
    "/api/rise/v1",
  ]);
  assert.equal(routeContract.edgeOwnerApprovalRequired, true);
});

test("activation receipt schema binds the release, index, manifest, actor, and decision", async () => {
  const schema = JSON.parse(await fs.readFile(path.join(riseRoot, "contracts/activation-receipt.schema.json"), "utf8"));
  assert.equal(schema.additionalProperties, false);
  for (const field of [
    "registryReleaseId", "apiIndexSha256", "indexManifestSha256",
    "decisionRecordId", "approvedBySubject", "approvedAt",
  ]) {
    assert.ok(schema.required.includes(field), `missing ${field}`);
  }
  assert.equal(schema.properties.action.const, "activate");
  assert.equal(schema.properties.immutable.const, true);
});

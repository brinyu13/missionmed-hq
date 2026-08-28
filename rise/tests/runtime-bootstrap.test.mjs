import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareRuntimeArtifacts } from "../tools/prepare-runtime.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("production bootstrap rejects insecure artifact transport before any fetch", async () => {
  let fetchCalls = 0;
  await assert.rejects(
    prepareRuntimeArtifacts({
      environment: {
        NODE_ENV: "production",
        RISE_ARTIFACT_ORIGIN: "http://127.0.0.1:4177",
      },
      allowInsecureLoopback: true,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("must not fetch");
      },
    }),
    /prohibited in production/,
  );
  assert.equal(fetchCalls, 0);
});

test("production bootstrap fetches only same-origin, authenticated, hash-pinned artifacts", async () => {
  const bodies = new Map([
    ["/registry.json", Buffer.from('{"registry":"fixture"}\n')],
    ["/manifest.json", Buffer.from('{"manifest":"fixture"}\n')],
    ["/activation.json", Buffer.from('{"activation":"fixture"}\n')],
  ]);
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    const body = bodies.get(request.url);
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": body.length });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const outputParent = await fs.mkdtemp(path.join(os.tmpdir(), "rise-bootstrap-test-"));
  const environment = {
    RISE_ARTIFACT_ORIGIN: origin,
    RISE_ARTIFACT_BEARER_TOKEN: "artifact-test-token-00000000000000",
    RISE_INDEX_URL: `${origin}/registry.json`,
    RISE_INDEX_SHA256: sha256(bodies.get("/registry.json")),
    RISE_INDEX_MANIFEST_URL: `${origin}/manifest.json`,
    RISE_INDEX_MANIFEST_SHA256: sha256(bodies.get("/manifest.json")),
    RISE_ACTIVATION_RECEIPT_URL: `${origin}/activation.json`,
    RISE_ACTIVATION_RECEIPT_SHA256: sha256(bodies.get("/activation.json")),
  };
  try {
    const prepared = await prepareRuntimeArtifacts({
      environment,
      allowInsecureLoopback: true,
      outputParent,
    });
    assert.equal(prepared.artifacts.length, 3);
    assert.deepEqual(await fs.readFile(environment.RISE_INDEX_PATH), bodies.get("/registry.json"));
    assert.deepEqual(await fs.readFile(environment.RISE_INDEX_MANIFEST_PATH), bodies.get("/manifest.json"));
    assert.deepEqual(await fs.readFile(environment.RISE_ACTIVATION_RECEIPT_PATH), bodies.get("/activation.json"));
    assert.equal(requests.every((request) => request.authorization === "Bearer artifact-test-token-00000000000000"), true);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(outputParent, { recursive: true, force: true });
  }
});

test("production bootstrap removes temporary artifacts on a hash mismatch", async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("tampered\n");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const outputParent = await fs.mkdtemp(path.join(os.tmpdir(), "rise-bootstrap-reject-test-"));
  const environment = {
    RISE_ARTIFACT_ORIGIN: origin,
    RISE_ARTIFACT_BEARER_TOKEN: "artifact-test-token-00000000000000",
    RISE_INDEX_URL: `${origin}/registry.json`,
    RISE_INDEX_SHA256: "0".repeat(64),
    RISE_INDEX_MANIFEST_URL: `${origin}/manifest.json`,
    RISE_INDEX_MANIFEST_SHA256: "0".repeat(64),
    RISE_ACTIVATION_RECEIPT_URL: `${origin}/activation.json`,
    RISE_ACTIVATION_RECEIPT_SHA256: "0".repeat(64),
  };
  try {
    await assert.rejects(prepareRuntimeArtifacts({
      environment,
      allowInsecureLoopback: true,
      outputParent,
    }), /hash mismatch/);
    assert.deepEqual(await fs.readdir(outputParent), []);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(outputParent, { recursive: true, force: true });
  }
});

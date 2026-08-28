import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { createRiseStudentStore } from "../adapters/http-student-state.mjs";

test("durable student-state adapter pseudonymizes subjects and validates bound responses", async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ authorization: request.headers.authorization, body });
    const base = { schemaVersion: 1, subjectKey: body.subjectKey };
    if (body.action === "list") {
      response.end(JSON.stringify({ ...base, records: [] }));
      return;
    }
    if (body.action === "upsert") {
      response.end(JSON.stringify({
        ...base,
        record: {
          programSpecialtyId: body.programSpecialtyId,
          state: body.state,
          notes: body.notes,
          updatedAt: "2026-08-28T03:00:00.000Z",
        },
      }));
      return;
    }
    response.end(JSON.stringify({ ...base, deleted: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const store = createRiseStudentStore({
    controlUrl: `http://127.0.0.1:${server.address().port}/v1/rise/student-programs`,
    bearerToken: "student-state-test-token-000000000000",
    subjectHmacKey: "student-state-test-hmac-key-0000000000",
    allowInsecureLoopback: true,
  });
  const context = {
    subject: "matrix-user-123",
    releaseId: "rise_registry_release_test",
    programSpecialtyId: "rise_ps_fixture",
  };
  try {
    assert.deepEqual(await store.list(context), []);
    assert.equal((await store.put({ ...context, state: "SAVED", notes: "Private note" })).state, "SAVED");
    assert.equal(await store.delete(context), true);
    assert.equal(store.scope, "durable_private");
    assert.equal(requests.length, 3);
    assert.equal(requests.every(({ authorization }) => authorization === "Bearer student-state-test-token-000000000000"), true);
    assert.equal(requests.every(({ body }) => body.subjectKey.length === 64), true);
    assert.equal(JSON.stringify(requests).includes("matrix-user-123"), false);
    assert.equal(requests.every(({ body }) => body.releaseId === "rise_registry_release_test"), true);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("student-state adapter requires HTTPS outside an explicit local test", () => {
  assert.throws(() => createRiseStudentStore({
    controlUrl: "http://state.example.test/v1/rise/student-programs",
    bearerToken: "student-state-test-token-000000000000",
    subjectHmacKey: "student-state-test-hmac-key-0000000000",
  }), /must use HTTPS/);
});

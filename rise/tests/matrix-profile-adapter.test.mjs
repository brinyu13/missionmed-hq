import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

import { createMatrixProfileAdapter } from "../adapters/http-matrix-profile.mjs";

let server;
let origin;
let profile;
const requests = [];

before(async () => {
  profile = { first_name: "Ada", last_name: "Lovelace", primary_specialty: "Internal Medicine" };
  server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;
    requests.push({ url: request.url, method: request.method, headers: request.headers, body });
    response.setHeader("Content-Type", "application/json");
    if (!String(request.headers.cookie ?? "").includes("wordpress_logged_in_fixture=session") || request.headers["x-wp-nonce"] !== "nonce12345") {
      response.statusCode = 403;
      response.end('{"code":"rest_cookie_invalid_nonce"}');
      return;
    }
    if (request.url === "/wp-json/wp/v2/users/me?context=edit") {
      response.end('{"id":42}');
      return;
    }
    if (request.url === "/wp-json/mmed/v1/profile/me" && request.method === "POST") {
      profile = { ...profile, ...body.profile };
      response.end(`${JSON.stringify({ profile, progress: 100 })}\n`);
      return;
    }
    if (request.url === "/wp-json/mmed/v1/profile/me") {
      response.end(`${JSON.stringify({ profile, progress: 100, required_fields: [] })}\n`);
      return;
    }
    response.statusCode = 404;
    response.end('{"error":"not_found"}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function inboundRequest(overrides = {}) {
  return {
    headers: {
      cookie: "unrelated=secret; wordpress_logged_in_fixture=session; mmed_rise_wp_nonce=nonce12345",
      ...overrides,
    },
  };
}

test("Matrix adapter performs subject-bound canonical read without forwarding unrelated cookies", async () => {
  const adapter = createMatrixProfileAdapter({
    profileUrl: `${origin}/wp-json/mmed/v1/profile/me`,
    allowInsecureLoopback: true,
  });
  const result = await adapter.read({ request: inboundRequest(), subject: "wp:42" });
  assert.equal(result.profile.first_name, "Ada");
  assert.equal(requests.at(-2).headers.cookie, "wordpress_logged_in_fixture=session");
  assert.equal(requests.at(-1).headers.cookie, "wordpress_logged_in_fixture=session");
  assert.equal(requests.at(-1).headers["x-wp-nonce"], "nonce12345");
});

test("Matrix adapter writes only the canonical profile payload and returns owner readback", async () => {
  const adapter = createMatrixProfileAdapter({
    profileUrl: `${origin}/wp-json/mmed/v1/profile/me`,
    allowInsecureLoopback: true,
  });
  const result = await adapter.write({
    request: inboundRequest({ "x-wp-nonce": "nonce12345" }),
    subject: "wp:42",
    profile: { primary_specialty: "Family Medicine" },
    markComplete: false,
  });
  assert.equal(result.profile.primary_specialty, "Family Medicine");
  assert.equal(result.canonicalReadback, true);
  const post = requests.findLast((request) => request.method === "POST");
  assert.deepEqual(post.body, { profile: { primary_specialty: "Family Medicine" }, mark_complete: false });
});

test("Matrix adapter rejects anonymous credentials and cross-user subject mismatch", async () => {
  const adapter = createMatrixProfileAdapter({
    profileUrl: `${origin}/wp-json/mmed/v1/profile/me`,
    allowInsecureLoopback: true,
  });
  await assert.rejects(
    adapter.read({ request: { headers: {} }, subject: "wp:42" }),
    (error) => error.code === "MATRIX_AUTH_REQUIRED",
  );
  await assert.rejects(
    adapter.read({ request: inboundRequest(), subject: "wp:99" }),
    (error) => error.code === "MATRIX_SUBJECT_MISMATCH",
  );
});

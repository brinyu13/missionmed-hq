import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { createHqAuthenticator } from "../adapters/hq-auth.mjs";
import { createRiseAbuseController } from "../adapters/http-abuse.mjs";
import { createRiseSourceRightsController } from "../adapters/http-source-rights.mjs";

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

test("HQ adapter introspects the exact audience and exposes only a bound RISE session", async () => {
  const observed = [];
  const now = Date.parse("2026-07-22T12:00:00.000Z");
  const fixture = await listen((request, response) => {
    observed.push({ url: request.url, cookie: request.headers.cookie, authorization: request.headers.authorization });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      authenticated: true,
      sessionPersistent: true,
      authAudience: "rise",
      revoked: false,
      revokedAt: null,
      risePrivateBeta: true,
      riseEntitlements: ["FULL_RISE_BETA_ACCESS"],
      csrfToken: "upstreamCsrfTokenForRise00000000",
      expiresAt: "2026-07-22T13:00:00.000Z",
      accessToken: "must-never-leave-the-adapter",
      user: {
        id: 42,
        displayName: "Beta Student",
        email: "private@example.test",
        roles: ["subscriber"],
      },
    }));
  });
  try {
    const authenticate = createHqAuthenticator({
      authSessionUrl: `${fixture.origin}/api/auth/session`,
      bindingHmacKey: "binding-test-key-0000000000000000",
      allowInsecureLoopback: true,
      now: () => now,
    });
    const session = await authenticate({
      headers: { cookie: "unrelated=private; mmhq_session=encrypted-cookie-value" },
    });
    assert.equal(observed[0].url, "/api/auth/session?audience=rise");
    assert.equal(observed[0].cookie, "mmhq_session=encrypted-cookie-value");
    assert.equal(observed[0].authorization, undefined);
    assert.equal(session.subject, "wp:42");
    assert.equal(session.issuer, fixture.origin);
    assert.equal(session.audience, "rise");
    assert.deepEqual(session.capabilities, ["rise:read", "rise:premium", "rise:private-beta", "rise:contribute"]);
    assert.equal(session.displayName, "Beta Student");
    assert.match(session.sessionId, /^[a-f0-9]{64}$/);
    assert.equal(session.email, undefined);
    assert.equal(session.accessToken, undefined);

    const bearer = await authenticate({
      headers: { authorization: "Bearer forbidden", cookie: "mmhq_session=encrypted-cookie-value" },
    });
    assert.equal(bearer, null);
    assert.equal(observed.length, 1);
  } finally {
    await fixture.close();
  }
});

test("HQ adapter rejects expired, revoked, malformed-revocation, and audience-drifted upstream sessions", async () => {
  let mode = "expired";
  const fixture = await listen((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    const revocation = mode === "revoked" ? { revoked: true, revokedAt: "2026-07-22T11:30:00.000Z" }
      : mode === "revoked-string" ? { revoked: "true", revokedAt: null }
        : mode === "revoked-number" ? { revoked: 1, revokedAt: null }
          : mode === "revoked-date-empty" ? { revoked: false, revokedAt: "" }
            : mode === "revocation-omitted" ? {}
              : { revoked: false, revokedAt: null };
    response.end(JSON.stringify({
      authenticated: true,
      sessionPersistent: true,
      authAudience: mode === "audience" ? "arena" : "rise",
      risePrivateBeta: true,
      riseEntitlements: ["FULL_RISE_BETA_ACCESS"],
      ...revocation,
      csrfToken: "upstreamCsrfTokenForRise00000000",
      expiresAt: mode === "expired" ? "2026-07-22T11:59:00.000Z" : "2026-07-22T13:00:00.000Z",
      user: { id: 7, roles: ["administrator"] },
    }));
  });
  try {
    const authenticate = createHqAuthenticator({
      authSessionUrl: `${fixture.origin}/api/auth/session`,
      bindingHmacKey: "binding-test-key-0000000000000000",
      allowInsecureLoopback: true,
      now: () => Date.parse("2026-07-22T12:00:00.000Z"),
    });
    assert.equal(await authenticate({ headers: { cookie: "mmhq_session=expired" } }), null);
    for (const invalidMode of ["revoked", "revoked-string", "revoked-number", "revoked-date-empty", "revocation-omitted"]) {
      mode = invalidMode;
      assert.equal(await authenticate({ headers: { cookie: `mmhq_session=${invalidMode}` } }), null);
    }
    mode = "audience";
    assert.equal(await authenticate({ headers: { cookie: "mmhq_session=wrong-audience" } }), null);
  } finally {
    await fixture.close();
  }
});

test("durable abuse adapter sends pseudonymous decisions and fails closed", async () => {
  const observed = [];
  let validResponse = true;
  const fixture = await listen(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed.push({ authorization: request.headers.authorization, body: JSON.parse(body) });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(validResponse ? { schemaVersion: 1, allowed: true } : { allowed: "yes" }));
  });
  try {
    const controller = createRiseAbuseController({
      controlUrl: `${fixture.origin}/v1/decisions`,
      bearerToken: "abuse-test-token-0000000000000000",
      allowInsecureLoopback: true,
    });
    assert.equal(controller.scope, "shared_durable");
    assert.equal(await controller.allowPreAuth({ method: "GET", path: "/rise/", cost: 1 }), true);
    assert.equal(await controller.allowAuthenticatedSubject({
      subjectKey: "a".repeat(32),
      method: "GET",
      path: "/api/rise/v1/programs",
      cost: 6,
    }), true);
    assert.equal(observed[0].authorization, "Bearer abuse-test-token-0000000000000000");
    assert.equal(observed[1].body.subjectKey, "a".repeat(32));
    assert.equal(JSON.stringify(observed).includes("student"), false);

    validResponse = false;
    assert.equal(await controller.allowPreAuth({ method: "GET", path: "/", cost: 1 }), false);
    assert.equal(await controller.allowAuthenticatedSubject({ subjectKey: "invalid" }), false);
  } finally {
    await fixture.close();
  }
});

test("source-rights adapter requires a fresh release-bound decision and fails closed", async () => {
  const observed = [];
  const now = Date.parse("2026-07-22T12:00:00.000Z");
  const authorizationSha256 = "a".repeat(64);
  let mode = "current";
  const fixture = await listen(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed.push({ authorization: request.headers.authorization, body: JSON.parse(body) });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      schemaVersion: 1,
      current: mode !== "revoked",
      registryReleaseId: mode === "wrong-release" ? "other-release" : "rise_registry_test",
      authorizationSha256s: [mode === "wrong-authorization" ? "b".repeat(64) : authorizationSha256],
      checkedAt: new Date(mode === "stale" ? now - 61_000 : now).toISOString(),
      validUntil: new Date(mode === "overlong" ? now + 301_000 : now + 60_000).toISOString(),
      decisionId: "source-rights-decision-test",
    }));
  });
  try {
    const controller = createRiseSourceRightsController({
      controlUrl: `${fixture.origin}/v1/current`,
      bearerToken: "rights-test-token-0000000000000000",
      allowInsecureLoopback: true,
      now: () => now,
    });
    const input = { registryReleaseId: "rise_registry_test", authorizationSha256s: [authorizationSha256] };
    assert.equal(controller.scope, "shared_durable_current");
    const decision = await controller.assertCurrent(input);
    assert.equal(decision.current, true);
    assert.equal(decision.decisionId, "source-rights-decision-test");
    assert.equal(decision.checkedAt, "2026-07-22T12:00:00.000Z");
    assert.equal(observed[0].authorization, "Bearer rights-test-token-0000000000000000");
    assert.deepEqual(observed[0].body.authorizationSha256s, [authorizationSha256]);
    for (const invalidMode of ["revoked", "stale", "wrong-release", "wrong-authorization", "overlong"]) {
      mode = invalidMode;
      assert.equal(await controller.assertCurrent(input), false);
    }
  } finally {
    await fixture.close();
  }
});

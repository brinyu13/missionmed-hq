import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function handoffToken(secret, audience = "rise", overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    wp_user_id: 42,
    email: "rise-test@example.test",
    username: "rise-test",
    display_name: "RISE Test",
    roles: ["subscriber"],
    rise_beta_access: true,
    rise_beta_course_ids: [3893],
    rise_beta_entitlements: ["FULL_RISE_BETA_ACCESS"],
    auth_audience: audience,
    iat: now,
    exp: now + 60,
    nonce: "test-nonce",
    ...overrides,
  }));
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function startHq() {
  const port = 43_000 + process.pid % 1_000;
  const secret = randomBytes(32).toString("hex");
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: hqRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(port),
      MMHQ_AUTH_REQUIRED: "true",
      MMHQ_SESSION_SECRET: randomBytes(32).toString("hex"),
      MMHQ_HANDOFF_SECRET: secret,
      MMHQ_WP_BASE: "https://missionmedinstitute.com",
      MMHQ_DBOC_PIPELINE_SAFE_MODE: "true",
      MMHQ_DBOC_TRANSCRIBE_SAFE_MODE: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`HQ test server timeout: ${output.slice(-500)}`)), 10_000);
    const collect = (chunk) => {
      output += chunk.toString();
      if (output.includes("HQ server running on port:")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`HQ test server exited ${code}: ${output.slice(-500)}`));
    });
  });
  return { child, origin: `http://127.0.0.1:${port}`, secret };
}

test("HQ mints and isolates a learner-safe audience=rise session", async () => {
  const runtime = await startHq();
  try {
    const anonymous = await fetch(`${runtime.origin}/api/auth/session?audience=rise`);
    assert.equal(anonymous.status, 200);
    assert.equal((await anonymous.json()).authenticated, false);

    const token = handoffToken(runtime.secret);
    const exchanged = await fetch(`${runtime.origin}/api/auth/session?audience=rise&token=${encodeURIComponent(token)}`, {
      redirect: "manual",
    });
    assert.equal(exchanged.status, 200);
    const payload = await exchanged.json();
    assert.equal(payload.authenticated, true);
    assert.equal(payload.authAudience, "rise");
    assert.equal(payload.revoked, false);
    assert.equal(payload.revokedAt, null);
    assert.equal(payload.risePrivateBeta, true);
    assert.deepEqual(payload.riseEntitlements, ["FULL_RISE_BETA_ACCESS"]);
    assert.equal(payload.user.id, 42);
    assert.deepEqual(payload.user.roles, ["subscriber"]);
    const cookie = String(exchanged.headers.get("set-cookie") ?? "").match(/mmhq_session=([^;]+)/)?.[1];
    assert.ok(cookie);

    const introspected = await fetch(`${runtime.origin}/api/auth/session?audience=rise`, {
      headers: { Cookie: `mmhq_session=${cookie}` },
    });
    assert.equal((await introspected.json()).authAudience, "rise");

    const isolated = await fetch(`${runtime.origin}/api/summary`, {
      headers: { Cookie: `mmhq_session=${cookie}` },
    });
    assert.equal(isolated.status, 403);
    assert.equal((await isolated.json()).error, "rise_audience_isolated");

    const mismatch = await fetch(`${runtime.origin}/api/auth/session?token=${encodeURIComponent(token)}`);
    assert.equal(mismatch.status, 401);

    const ineligibleToken = handoffToken(runtime.secret, "rise", {
      rise_beta_access: false,
      rise_beta_course_ids: [],
      rise_beta_entitlements: [],
    });
    const ineligible = await fetch(`${runtime.origin}/api/auth/session?audience=rise&token=${encodeURIComponent(ineligibleToken)}`);
    assert.equal(ineligible.status, 403);
  } finally {
    runtime.child.kill("SIGTERM");
    await new Promise((resolve) => runtime.child.once("exit", resolve));
  }
});

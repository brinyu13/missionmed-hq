import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures/wordpress-rise-proxy.php");
const plugin = path.resolve(here, "../../wp-content/mu-plugins/missionmed-rise-route.php");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("WordPress /rise/ proxy serves the complete upstream security header set", async (context) => {
  const port = await freePort();
  const child = spawn("php", ["-S", `127.0.0.1:${port}`, fixture], {
    env: { ...process.env, RISE_ROUTE_PLUGIN_PATH: plugin },
    stdio: ["ignore", "ignore", "pipe"],
  });
  context.after(() => child.kill("SIGTERM"));
  let response;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/rise/`, { headers: { Cookie: "mmhq_session=fixture-session" } });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.ok(response, "PHP proxy fixture did not start");
  assert.equal(response.status, 200);
  const expected = {
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-missionmed-rise-proxy": "1",
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(response.headers.get(name), value, name);
  assert.match(response.headers.get("set-cookie") ?? "", /^mmed_rise_wp_nonce=/);
  assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /must-not-forward/);
  assert.notEqual(response.headers.get("connection"), "keep-alive");
});

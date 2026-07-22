import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  LauncherError,
  loadConfig,
  parseJsonWithoutDuplicateKeys,
  runtimePaths,
} from "../missionmed-prototype-launcher.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORK = path.resolve(HERE, "..");
const LAUNCHER = path.join(FRAMEWORK, "missionmed-prototype-launcher.mjs");
const FIXTURE = path.join(HERE, "fixtures", "static-site");
const MARKER = "MissionMed Launcher Fixture · exact health identity";
const children = new Set();
const runtimeDirectories = new Set();

test.afterEach(async () => {
  await Promise.all([...children].map(async (child) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolvePromise) => {
      let timer;
      const finish = () => {
        clearTimeout(timer);
        resolvePromise();
      };
      child.once("exit", finish);
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish();
      }, 3000);
      child.kill("SIGTERM");
    });
  }));
  children.clear();
  for (const directory of runtimeDirectories) await rm(directory, { recursive: true, force: true });
  runtimeDirectories.clear();
});

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const { port } = server.address();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

function staticConfig(port, overrides = {}) {
  return {
    schema: "missionmed.prototype-launcher",
    schemaVersion: 1,
    frameworkVersion: "1.0.0",
    prototypeId: `launcher-fixture-${port}`,
    displayName: "MissionMed Launcher Fixture",
    projectDirectory: "site",
    port,
    openUrl: `http://localhost:${port}/`,
    node: { minimumVersion: "20.0.0" },
    health: {
      url: `http://localhost:${port}/`,
      status: 200,
      bodyIncludes: MARKER,
      timeoutMs: 5000,
      intervalMs: 100,
    },
    dependencies: { mode: "none" },
    server: {
      mode: "static",
      rootDirectory: ".",
      entryFile: "index.html",
      allowedExtensions: [".html", ".css", ".js", ".png", ".svg"],
      shutdownGraceMs: 1000,
    },
    ...overrides,
  };
}

async function makePackage(config) {
  const root = await mkdtemp(path.join(os.tmpdir(), "MissionMed Launcher path with spaces "));
  await cp(FIXTURE, path.join(root, "site"), { recursive: true });
  const configPath = path.join(root, "prototype.launch.json");
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  try {
    const loaded = await loadConfig(configPath);
    runtimeDirectories.add(runtimePaths(loaded).directory);
  } catch {
    // Invalid-configuration tests intentionally cannot derive runtime state.
  }
  return { root, configPath };
}

function startCli(args, options = {}) {
  const child = spawn(process.execPath, [LAUNCHER, ...args], {
    cwd: options.cwd ?? "/",
    env: options.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const result = new Promise((resolvePromise) => {
    child.once("exit", (code, signal) => {
      children.delete(child);
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
  return { child, result, output: () => ({ stdout, stderr }) };
}

async function runCli(args, options = {}) {
  const launched = startCli(args, options);
  const timeoutMs = options.timeoutMs ?? 10000;
  let timer;
  try {
    return await Promise.race([
      launched.result,
      new Promise((_, rejectPromise) => {
        timer = setTimeout(() => {
      launched.child.kill("SIGKILL");
      rejectPromise(new Error(`CLI timeout: ${args.join(" ")}\n${JSON.stringify(launched.output())}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const request = http.get(url, { timeout: 1000 }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolvePromise({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString("utf8"),
        headers: response.headers,
      }));
    });
    request.once("timeout", () => request.destroy(new Error("timeout")));
    request.once("error", rejectPromise);
  });
}

async function waitHealthy(url, marker, timeoutMs = 7000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchText(url);
      if (response.status === 200 && response.body.includes(marker)) return;
    } catch {
      // Startup polling intentionally ignores connection refusal.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 75));
  }
  throw new Error(`Fixture never became healthy: ${url}`);
}

test("strict JSON rejects duplicate keys", () => {
  assert.throws(
    () => parseJsonWithoutDuplicateKeys('{"schema":1,"schema":2}', "fixture"),
    (error) => error instanceof LauncherError && error.code === "MMPL-CONFIG-009",
  );
});

test("strict configuration rejects unknown fields and package escapes", async () => {
  const port = await reservePort();
  const first = await makePackage({ ...staticConfig(port), surprise: true });
  await assert.rejects(() => loadConfig(first.configPath), (error) => error.code === "MMPL-CONFIG-003");
  await rm(first.root, { recursive: true, force: true });

  const second = await makePackage({ ...staticConfig(port), projectDirectory: "../outside" });
  await assert.rejects(() => loadConfig(second.configPath), (error) => error.code === "MMPL-CONFIG-012");
  await rm(second.root, { recursive: true, force: true });
});

test("wrong-cwd path-with-spaces launch, owned reuse, status, and stop", async () => {
  const port = await reservePort();
  const fixture = await makePackage(staticConfig(port));
  await writeFile(path.join(fixture.root, "site", ".env"), "SHOULD_NOT_BE_SERVED=true\n", "utf8");
  await writeFile(path.join(fixture.root, "site", "package.json"), "{}\n", "utf8");
  const first = startCli(["launch", "--config", fixture.configPath, "--browser", "none"], { cwd: "/" });
  await waitHealthy(`http://localhost:${port}/`, MARKER);
  const index = await fetchText(`http://localhost:${port}/`);
  assert.match(index.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(index.headers["x-frame-options"], "DENY");
  assert.equal((await fetchText(`http://localhost:${port}/.env`)).status, 404);
  assert.equal((await fetchText(`http://localhost:${port}/package.json`)).status, 404);

  const status = await runCli(["status", "--config", fixture.configPath]);
  assert.equal(status.code, 0);
  assert.match(status.stdout, /ready \(owned supervisor/);

  const duplicate = await runCli(["launch", "--config", fixture.configPath, "--browser", "none"], { cwd: os.tmpdir() });
  assert.equal(duplicate.code, 0);
  assert.match(duplicate.stdout, /no duplicate server was launched/i);

  const stop = await runCli(["stop", "--config", fixture.configPath]);
  assert.equal(stop.code, 0);
  assert.match(stop.stdout, /No unrelated development server was affected/);
  const firstResult = await first.result;
  assert.equal(firstResult.code, 0);

  const loaded = await loadConfig(fixture.configPath);
  const state = runtimePaths(loaded);
  await assert.rejects(() => readFile(state.statePath, "utf8"), /ENOENT/);
  await rm(fixture.root, { recursive: true, force: true });
});

test("foreign listener blocks launch and remains untouched", async () => {
  const port = await reservePort();
  let requests = 0;
  const foreign = http.createServer((_request, response) => {
    requests += 1;
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("This belongs to another local developer server.");
  });
  await new Promise((resolvePromise) => foreign.listen(port, "127.0.0.1", resolvePromise));
  const fixture = await makePackage(staticConfig(port));
  const launch = await runCli(["launch", "--config", fixture.configPath, "--browser", "none"]);
  assert.equal(launch.code, 75);
  assert.match(launch.stderr, /MMPL-PORT-001/);
  const stillThere = await fetchText(`http://127.0.0.1:${port}/`);
  assert.match(stillThere.body, /another local developer server/);
  assert.ok(requests >= 1);
  const stop = await runCli(["stop", "--config", fixture.configPath]);
  assert.equal(stop.code, 0);
  assert.match(stop.stdout, /left untouched/);
  await new Promise((resolvePromise) => foreign.close(resolvePromise));
  await rm(fixture.root, { recursive: true, force: true });
});

test("health marker failure cleans up the owned server", async () => {
  const port = await reservePort();
  const config = staticConfig(port);
  config.health = { ...config.health, bodyIncludes: "marker that is intentionally absent", timeoutMs: 1000 };
  const fixture = await makePackage(config);
  const launch = await runCli(["launch", "--config", fixture.configPath, "--browser", "none"]);
  assert.equal(launch.code, 69);
  assert.match(launch.stderr, /MMPL-HEALTH-001/);
  await assert.rejects(() => fetchText(`http://127.0.0.1:${port}/`));
  await rm(fixture.root, { recursive: true, force: true });
});

test("missing probe invokes the exact fake frozen install once", async () => {
  const port = await reservePort();
  const managerDirectory = await mkdtemp(path.join(os.tmpdir(), "missionmed-fake-manager-"));
  const fakeManager = path.join(managerDirectory, "pnpm");
  const installReceipt = path.join(managerDirectory, "install-receipt.txt");
  await writeFile(
    fakeManager,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '11.9.0\\n'; exit 0; fi\nprintf '%s\\n' "$*" > "${installReceipt}"\nmkdir -p node_modules/.bin\ntouch node_modules/.bin/fixture-ready\n`,
    "utf8",
  );
  await chmod(fakeManager, 0o755);
  const config = staticConfig(port, {
    dependencies: {
      mode: "package-manager",
      manager: "pnpm",
      version: "11.9.0",
      lockfile: "pnpm-lock.yaml",
      probes: ["node_modules/.bin/fixture-ready"],
      installArgs: ["install", "--frozen-lockfile"],
      timeoutMs: 5000,
    },
  });
  const fixture = await makePackage(config);
  await writeFile(path.join(fixture.root, "site", "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  const environment = { ...process.env, PATH: `${managerDirectory}${path.delimiter}${process.env.PATH || ""}` };
  const first = startCli(["launch", "--config", fixture.configPath, "--browser", "none"], { env: environment });
  await waitHealthy(`http://localhost:${port}/`, MARKER);
  assert.equal(await readFile(installReceipt, "utf8"), "install --frozen-lockfile\n");
  const stop = await runCli(["stop", "--config", fixture.configPath], { env: environment });
  assert.equal(stop.code, 0);
  assert.equal((await first.result).code, 0);
  await rm(fixture.root, { recursive: true, force: true });
  await rm(managerDirectory, { recursive: true, force: true });
});

test("SIGTERM interruption removes the owned listener", async () => {
  const port = await reservePort();
  const fixture = await makePackage(staticConfig(port));
  const first = startCli(["launch", "--config", fixture.configPath, "--browser", "none"]);
  await waitHealthy(`http://localhost:${port}/`, MARKER);
  first.child.kill("SIGTERM");
  const result = await first.result;
  assert.equal(result.code, 0);
  await assert.rejects(() => fetchText(`http://127.0.0.1:${port}/`));
  await rm(fixture.root, { recursive: true, force: true });
});

test("SIGTERM during dependency restoration stops the owned manager process group", async () => {
  const port = await reservePort();
  const managerDirectory = await mkdtemp(path.join(os.tmpdir(), "missionmed-slow-manager-"));
  const fakeManager = path.join(managerDirectory, "pnpm");
  const managerPidPath = path.join(managerDirectory, "manager.pid");
  const childPidPath = path.join(managerDirectory, "child.pid");
  await writeFile(
    fakeManager,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '11.9.0\\n'; exit 0; fi\nprintf '%s\\n' "$$" > "${managerPidPath}"\nsleep 30 &\nprintf '%s\\n' "$!" > "${childPidPath}"\nwait\n`,
    "utf8",
  );
  await chmod(fakeManager, 0o755);
  const config = staticConfig(port, {
    dependencies: {
      mode: "package-manager",
      manager: "pnpm",
      version: "11.9.0",
      lockfile: "pnpm-lock.yaml",
      probes: ["node_modules/.bin/fixture-never-created"],
      installArgs: ["install", "--frozen-lockfile"],
      timeoutMs: 30000,
    },
  });
  const fixture = await makePackage(config);
  await writeFile(path.join(fixture.root, "site", "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  const environment = { ...process.env, PATH: `${managerDirectory}${path.delimiter}${process.env.PATH || ""}` };
  const first = startCli(["launch", "--config", fixture.configPath, "--browser", "none"], { env: environment });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      await readFile(childPidPath, "utf8");
      break;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
  }
  const managerPid = Number((await readFile(managerPidPath, "utf8")).trim());
  const childPid = Number((await readFile(childPidPath, "utf8")).trim());
  first.child.kill("SIGTERM");
  const result = await first.result;
  assert.equal(result.code, 0);
  for (const pid of [managerPid, childPid]) {
    assert.throws(() => process.kill(pid, 0), (error) => error.code === "ESRCH");
  }
  const state = runtimePaths(await loadConfig(fixture.configPath));
  await assert.rejects(() => readFile(state.statePath, "utf8"), /ENOENT/);
  await rm(fixture.root, { recursive: true, force: true });
  await rm(managerDirectory, { recursive: true, force: true });
});

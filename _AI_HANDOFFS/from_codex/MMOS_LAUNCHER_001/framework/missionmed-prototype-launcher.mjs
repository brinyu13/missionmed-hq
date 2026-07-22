#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const FRAMEWORK_VERSION = "1.0.0";
const CONFIG_SCHEMA = "missionmed.prototype-launcher";
const STATE_SCHEMA = "missionmed.prototype-launcher-state";
const MAX_CONTROL_BYTES = 16 * 1024;
const MAX_HEALTH_BYTES = 1024 * 1024;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9._-]{1,62}[a-z0-9])?$/;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SENSITIVE_ENV_KEY = /(?:secret|token|password|passwd|credential|private.?key|api.?key|auth|session|cookie|bearer)/i;
const EXECUTABLE_TOOL_VALUES = new Set(["node", "packageManager", "executable"]);
const BROWSER_VALUES = new Set(["chrome", "default", "none"]);
const ACTIONS = new Set(["launch", "stop", "status", "validate-config"]);
const SCRIPT_PATH = fileURLToPath(import.meta.url);

const EXIT = Object.freeze({
  usage: 64,
  runtime: 69,
  internal: 70,
  control: 73,
  port: 75,
  config: 78,
});

class LauncherError extends Error {
  constructor(code, message, exitCode = EXIT.internal, options = {}) {
    super(message, options);
    this.name = "LauncherError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

function fail(code, message, exitCode = EXIT.internal, options = {}) {
  throw new LauncherError(code, message, exitCode, options);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKeys(object, allowed, label) {
  if (!isRecord(object)) fail("MMPL-CONFIG-002", `${label} must be an object.`, EXIT.config);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      fail("MMPL-CONFIG-003", `${label} contains unsupported key "${key}".`, EXIT.config);
    }
  }
}

function requireString(value, label, { min = 1, max = 4096 } = {}) {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    fail("MMPL-CONFIG-004", `${label} must be a string between ${min} and ${max} characters.`, EXIT.config);
  }
  if (value.includes("\0")) fail("MMPL-CONFIG-005", `${label} contains a NUL byte.`, EXIT.config);
  return value;
}

function requireInteger(value, label, { min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail("MMPL-CONFIG-006", `${label} must be an integer from ${min} through ${max}.`, EXIT.config);
  }
  return value;
}

function requireStringArray(value, label, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail("MMPL-CONFIG-007", `${label} must be an array${allowEmpty ? "" : " with at least one item"}.`, EXIT.config);
  }
  return value.map((item, index) => requireString(item, `${label}[${index}]`));
}

function parseJsonWithoutDuplicateKeys(text, label) {
  let index = 0;
  const whitespace = () => {
    while (/\s/.test(text[index] ?? "")) index += 1;
  };
  const stringToken = () => {
    whitespace();
    if (text[index] !== '"') fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config);
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\\") {
        index += 2;
        continue;
      }
      index += 1;
      if (character === '"') {
        try {
          return JSON.parse(text.slice(start, index));
        } catch (error) {
          fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config, { cause: error });
        }
      }
    }
    fail("MMPL-CONFIG-008", `${label} contains an unterminated JSON string.`, EXIT.config);
  };
  const valueToken = () => {
    whitespace();
    const character = text[index];
    if (character === "{") return objectToken();
    if (character === "[") return arrayToken();
    if (character === '"') return stringToken();
    const start = index;
    while (index < text.length && !/[\s,\]}]/.test(text[index])) index += 1;
    if (start === index) fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config);
    try {
      JSON.parse(text.slice(start, index));
    } catch (error) {
      fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config, { cause: error });
    }
  };
  const objectToken = () => {
    index += 1;
    const keys = new Set();
    whitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    while (index < text.length) {
      const key = stringToken();
      if (keys.has(key)) fail("MMPL-CONFIG-009", `${label} repeats JSON key "${key}".`, EXIT.config);
      keys.add(key);
      whitespace();
      if (text[index] !== ":") fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config);
      index += 1;
      valueToken();
      whitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      if (text[index] !== ",") fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config);
      index += 1;
    }
    fail("MMPL-CONFIG-008", `${label} contains an unterminated JSON object.`, EXIT.config);
  };
  const arrayToken = () => {
    index += 1;
    whitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    while (index < text.length) {
      valueToken();
      whitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      if (text[index] !== ",") fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config);
      index += 1;
    }
    fail("MMPL-CONFIG-008", `${label} contains an unterminated JSON array.`, EXIT.config);
  };

  try {
    valueToken();
    whitespace();
    if (index !== text.length) fail("MMPL-CONFIG-008", `${label} has trailing JSON content.`, EXIT.config);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof LauncherError) throw error;
    fail("MMPL-CONFIG-008", `${label} contains malformed JSON.`, EXIT.config, { cause: error });
  }
}

function parseSemver(value, label) {
  const match = requireString(value, label, { max: 64 }).match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) fail("MMPL-CONFIG-010", `${label} must be a complete semantic version.`, EXIT.config);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function validateRelativePath(value, label) {
  const item = requireString(value, label);
  if (path.isAbsolute(item)) fail("MMPL-CONFIG-011", `${label} must be relative.`, EXIT.config);
  const normalized = path.normalize(item);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    fail("MMPL-CONFIG-012", `${label} may not escape its configured root.`, EXIT.config);
  }
  return item;
}

function validateLoopbackUrl(value, label, port) {
  let url;
  try {
    url = new URL(requireString(value, label));
  } catch (error) {
    fail("MMPL-CONFIG-013", `${label} must be a valid URL.`, EXIT.config, { cause: error });
  }
  if (url.protocol !== "http:") fail("MMPL-CONFIG-014", `${label} must use local HTTP.`, EXIT.config);
  if (!LOOPBACK_HOSTS.has(url.hostname)) fail("MMPL-CONFIG-015", `${label} must use a loopback host.`, EXIT.config);
  const actualPort = Number(url.port || 80);
  if (actualPort !== port) fail("MMPL-CONFIG-016", `${label} must use configured port ${port}.`, EXIT.config);
  if (url.username || url.password) fail("MMPL-CONFIG-017", `${label} may not contain credentials.`, EXIT.config);
  return url;
}

function validateEnvironment(value) {
  if (value === undefined) return Object.freeze({});
  assertKeys(value, new Set(Object.keys(value)), "server.environment");
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      fail("MMPL-CONFIG-018", `server.environment key "${key}" is not a portable environment name.`, EXIT.config);
    }
    if (SENSITIVE_ENV_KEY.test(key)) {
      fail("MMPL-CONFIG-019", `server.environment may not contain credential-like key "${key}".`, EXIT.config);
    }
    output[key] = requireString(item, `server.environment.${key}`, { min: 0, max: 2048 });
  }
  return Object.freeze(output);
}

async function loadConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  let source;
  try {
    source = await readFile(absoluteConfigPath, "utf8");
  } catch (error) {
    fail("MMPL-CONFIG-001", `Could not read launcher configuration at ${absoluteConfigPath}.`, EXIT.config, { cause: error });
  }
  const raw = parseJsonWithoutDuplicateKeys(source, "launcher configuration");
  assertKeys(
    raw,
    new Set([
      "schema",
      "schemaVersion",
      "frameworkVersion",
      "prototypeId",
      "displayName",
      "projectDirectory",
      "port",
      "openUrl",
      "node",
      "health",
      "dependencies",
      "server",
    ]),
    "launcher configuration",
  );
  if (raw.schema !== CONFIG_SCHEMA || raw.schemaVersion !== 1) {
    fail("MMPL-CONFIG-020", `Configuration must use ${CONFIG_SCHEMA} schema version 1.`, EXIT.config);
  }
  if (raw.frameworkVersion !== FRAMEWORK_VERSION) {
    fail("MMPL-CONFIG-021", `Configuration requires launcher ${raw.frameworkVersion}; this launcher is ${FRAMEWORK_VERSION}.`, EXIT.config);
  }
  const prototypeId = requireString(raw.prototypeId, "prototypeId", { max: 64 });
  if (!SAFE_ID.test(prototypeId)) {
    fail("MMPL-CONFIG-022", "prototypeId must be a lowercase stable ID using letters, digits, dots, dashes, or underscores.", EXIT.config);
  }
  const displayName = requireString(raw.displayName, "displayName", { max: 120 });
  const projectDirectory = validateRelativePath(raw.projectDirectory, "projectDirectory");
  const port = requireInteger(raw.port, "port", { min: 1024, max: 65535 });
  const openUrl = validateLoopbackUrl(raw.openUrl, "openUrl", port);

  assertKeys(raw.node, new Set(["minimumVersion"]), "node");
  const minimumNodeVersion = requireString(raw.node.minimumVersion, "node.minimumVersion", { max: 64 });
  parseSemver(minimumNodeVersion, "node.minimumVersion");

  assertKeys(raw.health, new Set(["url", "status", "bodyIncludes", "timeoutMs", "intervalMs"]), "health");
  const healthUrl = validateLoopbackUrl(raw.health.url, "health.url", port);
  const health = Object.freeze({
    url: healthUrl.href,
    status: requireInteger(raw.health.status, "health.status", { min: 100, max: 599 }),
    bodyIncludes: requireString(raw.health.bodyIncludes, "health.bodyIncludes", { max: 512 }),
    timeoutMs: requireInteger(raw.health.timeoutMs, "health.timeoutMs", { min: 1000, max: 600000 }),
    intervalMs: requireInteger(raw.health.intervalMs, "health.intervalMs", { min: 100, max: 10000 }),
  });

  assertKeys(raw.dependencies, new Set(["mode", "manager", "version", "lockfile", "probes", "installArgs", "timeoutMs"]), "dependencies");
  let dependencies;
  if (raw.dependencies.mode === "none") {
    if (Object.keys(raw.dependencies).length !== 1) {
      fail("MMPL-CONFIG-023", "dependencies mode none accepts no package-manager fields.", EXIT.config);
    }
    dependencies = Object.freeze({ mode: "none" });
  } else if (raw.dependencies.mode === "package-manager") {
    const manager = requireString(raw.dependencies.manager, "dependencies.manager", { max: 32 });
    if (!new Set(["pnpm", "npm", "yarn"]).has(manager)) {
      fail("MMPL-CONFIG-024", "dependencies.manager must be pnpm, npm, or yarn.", EXIT.config);
    }
    const managerVersion = requireString(raw.dependencies.version, "dependencies.version", { max: 64 });
    parseSemver(managerVersion, "dependencies.version");
    const lockfile = validateRelativePath(raw.dependencies.lockfile, "dependencies.lockfile");
    const installArgs = requireStringArray(raw.dependencies.installArgs, "dependencies.installArgs", { allowEmpty: false });
    const lockfileName = path.basename(lockfile);
    if (manager === "pnpm" && (lockfileName !== "pnpm-lock.yaml" || installArgs[0] !== "install" || !installArgs.includes("--frozen-lockfile"))) {
      fail("MMPL-CONFIG-036", "pnpm dependency restoration requires pnpm-lock.yaml and install --frozen-lockfile.", EXIT.config);
    }
    if (manager === "npm" && (!new Set(["package-lock.json", "npm-shrinkwrap.json"]).has(lockfileName) || installArgs[0] !== "ci")) {
      fail("MMPL-CONFIG-037", "npm dependency restoration requires package-lock.json/npm-shrinkwrap.json and npm ci.", EXIT.config);
    }
    if (manager === "yarn" && (lockfileName !== "yarn.lock" || installArgs[0] !== "install" || !installArgs.some((item) => item === "--frozen-lockfile" || item === "--immutable"))) {
      fail("MMPL-CONFIG-038", "Yarn dependency restoration requires yarn.lock and an immutable/frozen install.", EXIT.config);
    }
    dependencies = Object.freeze({
      mode: "package-manager",
      manager,
      version: managerVersion,
      lockfile,
      probes: Object.freeze(requireStringArray(raw.dependencies.probes, "dependencies.probes", { allowEmpty: false }).map((item, index) => validateRelativePath(item, `dependencies.probes[${index}]`))),
      installArgs: Object.freeze(installArgs),
      timeoutMs: requireInteger(raw.dependencies.timeoutMs, "dependencies.timeoutMs", { min: 1000, max: 1800000 }),
    });
  } else {
    fail("MMPL-CONFIG-025", "dependencies.mode must be none or package-manager.", EXIT.config);
  }

  assertKeys(raw.server, new Set(["mode", "tool", "executable", "args", "environment", "rootDirectory", "entryFile", "allowedExtensions", "shutdownGraceMs"]), "server");
  let server;
  if (raw.server.mode === "process") {
    const tool = requireString(raw.server.tool, "server.tool", { max: 32 });
    if (!EXECUTABLE_TOOL_VALUES.has(tool)) {
      fail("MMPL-CONFIG-026", "server.tool must be node, packageManager, or executable.", EXIT.config);
    }
    const executable = tool === "executable"
      ? requireString(raw.server.executable, "server.executable", { max: 1024 })
      : undefined;
    if (tool !== "executable" && raw.server.executable !== undefined) {
      fail("MMPL-CONFIG-027", "server.executable is accepted only when server.tool is executable.", EXIT.config);
    }
    for (const forbidden of ["rootDirectory", "entryFile", "allowedExtensions"]) {
      if (raw.server[forbidden] !== undefined) fail("MMPL-CONFIG-028", `server.${forbidden} is static-mode only.`, EXIT.config);
    }
    if (tool === "packageManager" && dependencies.mode !== "package-manager") {
      fail("MMPL-CONFIG-029", "server.tool packageManager requires package-manager dependencies.", EXIT.config);
    }
    const args = requireStringArray(raw.server.args, "server.args");
    const environment = validateEnvironment(raw.server.environment);
    const hostEvidence = [
      ...args,
      environment.HOST,
      environment.HOSTNAME,
      environment.BIND_HOST,
    ].filter((item) => typeof item === "string");
    if (hostEvidence.some((item) => item.includes("0.0.0.0") || item === "::" || item === "[::]")) {
      fail("MMPL-CONFIG-040", "Process server configuration may not bind a wildcard host.", EXIT.config);
    }
    if (!hostEvidence.some((item) => item.includes("127.0.0.1") || item.includes("localhost") || item.includes("::1"))) {
      fail("MMPL-CONFIG-041", "Process server configuration must explicitly carry loopback-host binding evidence.", EXIT.config);
    }
    const portText = String(port);
    if (![...args, environment.PORT].filter((item) => typeof item === "string").some((item) => item === portText || item.endsWith(`=${portText}`))) {
      fail("MMPL-CONFIG-042", "Process server configuration must explicitly carry the fixed port.", EXIT.config);
    }
    server = Object.freeze({
      mode: "process",
      tool,
      executable,
      args: Object.freeze(args),
      environment,
      shutdownGraceMs: requireInteger(raw.server.shutdownGraceMs, "server.shutdownGraceMs", { min: 500, max: 60000 }),
    });
  } else if (raw.server.mode === "static") {
    for (const forbidden of ["tool", "executable", "args", "environment"]) {
      if (raw.server[forbidden] !== undefined) fail("MMPL-CONFIG-030", `server.${forbidden} is process-mode only.`, EXIT.config);
    }
    server = Object.freeze({
      mode: "static",
      rootDirectory: validateRelativePath(raw.server.rootDirectory, "server.rootDirectory"),
      entryFile: validateRelativePath(raw.server.entryFile, "server.entryFile"),
      allowedExtensions: Object.freeze(
        requireStringArray(raw.server.allowedExtensions, "server.allowedExtensions", { allowEmpty: false })
          .map((extension, index) => {
            if (!/^\.[a-z0-9]+$/.test(extension)) {
              fail("MMPL-CONFIG-039", `server.allowedExtensions[${index}] must be a lowercase file extension beginning with a dot.`, EXIT.config);
            }
            return extension;
          }),
      ),
      shutdownGraceMs: requireInteger(raw.server.shutdownGraceMs, "server.shutdownGraceMs", { min: 500, max: 60000 }),
    });
  } else {
    fail("MMPL-CONFIG-031", "server.mode must be process or static.", EXIT.config);
  }

  const configDirectory = path.dirname(absoluteConfigPath);
  const configDirectoryReal = await realpath(configDirectory).catch((error) => {
    fail("MMPL-CONFIG-032", "Could not resolve the configuration directory.", EXIT.config, { cause: error });
  });
  const projectPath = path.resolve(configDirectoryReal, projectDirectory);
  const projectReal = await realpath(projectPath).catch((error) => {
    fail("MMPL-CONFIG-033", `Project directory is missing: ${projectPath}`, EXIT.config, { cause: error });
  });
  if (projectReal !== configDirectoryReal && !projectReal.startsWith(`${configDirectoryReal}${path.sep}`)) {
    fail("MMPL-CONFIG-034", "projectDirectory resolves outside the review package.", EXIT.config);
  }
  const projectStats = await stat(projectReal);
  if (!projectStats.isDirectory()) fail("MMPL-CONFIG-035", "projectDirectory is not a directory.", EXIT.config);

  const identity = createHash("sha256")
    .update(`${prototypeId}\0${projectReal}`)
    .digest("hex")
    .slice(0, 24);
  const configDigest = createHash("sha256").update(source).digest("hex");

  return Object.freeze({
    configPath: absoluteConfigPath,
    configDirectory: configDirectoryReal,
    configDigest,
    prototypeId,
    displayName,
    projectDirectory,
    projectPath: projectReal,
    port,
    openUrl: openUrl.href,
    minimumNodeVersion,
    health,
    dependencies,
    server,
    identity,
  });
}

function runtimePaths(config) {
  const home = os.homedir();
  let base;
  if (process.platform === "darwin") {
    base = path.join(home, "Library", "Application Support", "MissionMed", "Launcher");
  } else if (process.platform === "win32") {
    base = path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "MissionMed", "Launcher");
  } else {
    base = path.join(process.env.XDG_STATE_HOME || path.join(home, ".local", "state"), "missionmed", "launcher");
  }
  const directory = path.join(base, config.identity);
  const controlDirectory = process.platform === "win32"
    ? null
    : path.join("/tmp", `missionmed-launcher-${typeof process.getuid === "function" ? process.getuid() : "user"}`);
  const controlPath = process.platform === "win32"
    ? `\\\\.\\pipe\\missionmed-prototype-${config.identity}`
    : path.join(controlDirectory, `${config.identity}.sock`);
  return Object.freeze({
    directory,
    controlDirectory,
    controlPath,
    statePath: path.join(directory, "state.json"),
    logPath: path.join(directory, "launcher.log"),
  });
}

async function prepareRuntimeDirectory(paths) {
  await mkdir(paths.directory, { recursive: true, mode: 0o700 });
  await chmod(paths.directory, 0o700);
  if (paths.controlDirectory) {
    await mkdir(paths.controlDirectory, { recursive: true, mode: 0o700 });
    const controlStats = await lstat(paths.controlDirectory);
    if (!controlStats.isDirectory() || controlStats.isSymbolicLink()) {
      fail("MMPL-CONTROL-005", `Protected control path is not a real directory: ${paths.controlDirectory}`, EXIT.control);
    }
    if (typeof process.getuid === "function" && controlStats.uid !== process.getuid()) {
      fail("MMPL-CONTROL-006", `Protected control path is not owned by the current user: ${paths.controlDirectory}`, EXIT.control);
    }
    await chmod(paths.controlDirectory, 0o700);
  }
  const logHandle = await open(paths.logPath, "a", 0o600);
  await logHandle.close();
  await chmod(paths.logPath, 0o600);
}

async function atomicStateWrite(statePath, state) {
  const temporary = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, statePath);
  await chmod(statePath, 0o600);
}

function publicState(config, paths, phase, childPid = null) {
  return {
    schema: STATE_SCHEMA,
    schemaVersion: 1,
    frameworkVersion: FRAMEWORK_VERSION,
    prototypeId: config.prototypeId,
    displayName: config.displayName,
    identity: config.identity,
    projectPath: config.projectPath,
    configDigest: config.configDigest,
    supervisorPid: process.pid,
    childPid,
    phase,
    openUrl: config.openUrl,
    logPath: paths.logPath,
    updatedAt: new Date().toISOString(),
  };
}

function safeEnvironment(extra = {}) {
  const allowed = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "TERM",
    "COLORTERM",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "PATHEXT",
    "APPDATA",
    "LOCALAPPDATA",
  ];
  const environment = {};
  for (const key of allowed) {
    if (typeof process.env[key] === "string") environment[key] = process.env[key];
  }
  return { ...environment, ...extra };
}

function pathCandidates(name) {
  const candidates = [];
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const directory of pathEntries) candidates.push(path.join(directory, process.platform === "win32" ? `${name}.cmd` : name));
  if (process.platform === "darwin") {
    candidates.push(`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`);
    if (name === "pnpm") {
      candidates.push(path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "bin", "fallback", "pnpm"));
    }
  }
  if (process.platform === "win32") {
    candidates.push(path.join(process.env.APPDATA || "", "npm", `${name}.cmd`));
  }
  return [...new Set(candidates.filter(Boolean))];
}

async function isExecutable(filePath) {
  try {
    await access(filePath, process.platform === "win32" ? undefined : 1);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(nameOrPath) {
  if (path.isAbsolute(nameOrPath) || nameOrPath.includes(path.sep)) {
    return (await isExecutable(nameOrPath)) ? nameOrPath : null;
  }
  for (const candidate of pathCandidates(nameOrPath)) {
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

function cleanVersion(output) {
  const match = output.trim().match(/(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/);
  return match?.[1] ?? null;
}

async function resolvePackageManager(config) {
  const { manager, version } = config.dependencies;
  for (const candidate of pathCandidates(manager)) {
    if (!(await isExecutable(candidate))) continue;
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      timeout: 10000,
      env: safeEnvironment(),
      shell: false,
    });
    const actual = cleanVersion(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (result.status === 0 && actual === version) return { command: candidate, prefixArgs: [], display: `${manager} ${version}` };
  }

  const corepack = await findExecutable("corepack");
  if (corepack) {
    const selector = `${manager}@${version}`;
    const result = spawnSync(corepack, [selector, "--version"], {
      encoding: "utf8",
      timeout: 30000,
      env: safeEnvironment(),
      shell: false,
    });
    const actual = cleanVersion(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (result.status === 0 && actual === version) {
      return { command: corepack, prefixArgs: [selector], display: `${manager} ${version} through Corepack` };
    }
  }

  fail(
    "MMPL-DEPS-001",
    `The exact required package manager (${manager} ${version}) is not available. No global install was attempted.`,
    EXIT.runtime,
  );
}

function createLogger(paths) {
  const stream = createWriteStream(paths.logPath, { flags: "a", mode: 0o600 });
  const stamp = () => new Date().toISOString();
  const line = (message, { terminal = true } = {}) => {
    const text = String(message);
    stream.write(`[${stamp()}] ${text}\n`);
    if (terminal) process.stdout.write(`${text}\n`);
  };
  const child = (chunk, target) => {
    stream.write(chunk);
    target.write(chunk);
  };
  return { stream, line, child };
}

async function commandResult(command, args, {
  cwd,
  env,
  timeoutMs,
  logger,
  label,
  shutdownGraceMs,
  registerOwned,
}) {
  logger.line(`${label}…`);
  const child = spawn(command, args, {
    cwd,
    env,
    detached: process.platform !== "win32",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  child.stdout.on("data", (chunk) => logger.child(chunk, process.stdout));
  child.stderr.on("data", (chunk) => logger.child(chunk, process.stderr));
  const exitPromise = new Promise((resolvePromise, rejectPromise) => {
    child.once("error", (error) => rejectPromise(new LauncherError("MMPL-DEPS-003", `${label} could not start.`, EXIT.runtime, { cause: error })));
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
  const dependencyOwner = {
    kind: "process",
    role: "dependency restoration",
    pid: child.pid,
    child,
    exitPromise,
  };
  await registerOwned(dependencyOwner);
  let timer;
  try {
    const result = await Promise.race([
      exitPromise.then((value) => ({ timedOut: false, value })),
      new Promise((resolvePromise) => {
        timer = setTimeout(() => resolvePromise({ timedOut: true }), timeoutMs);
      }),
    ]);
    if (result.timedOut) {
      await stopOwnedServer(dependencyOwner, shutdownGraceMs, logger);
      fail("MMPL-DEPS-002", `${label} timed out and its owned process group was stopped.`, EXIT.runtime);
    }
    return result.value;
  } finally {
    clearTimeout(timer);
    await registerOwned(null);
  }
}

async function verifyDependencies(config, manager, logger, registerOwned) {
  if (config.dependencies.mode === "none") return manager;
  const missing = [];
  for (const relativePath of config.dependencies.probes) {
    try {
      await access(path.resolve(config.projectPath, relativePath));
    } catch {
      missing.push(relativePath);
    }
  }
  if (missing.length === 0) {
    logger.line("Dependencies are ready; no install is needed.");
    return manager ?? await resolvePackageManager(config);
  }

  const lockfile = path.resolve(config.projectPath, config.dependencies.lockfile);
  try {
    const lockStats = await stat(lockfile);
    if (!lockStats.isFile()) throw new Error("not a file");
  } catch (error) {
    fail("MMPL-DEPS-004", `Dependency probe is missing and the configured lockfile is unavailable: ${config.dependencies.lockfile}`, EXIT.config, { cause: error });
  }
  const resolvedManager = manager ?? await resolvePackageManager(config);
  logger.line(`A required local dependency is missing (${missing.join(", ")}).`);
  const result = await commandResult(
    resolvedManager.command,
    [...resolvedManager.prefixArgs, ...config.dependencies.installArgs],
    {
      cwd: config.projectPath,
      env: safeEnvironment(),
      timeoutMs: config.dependencies.timeoutMs,
      logger,
      label: `Restoring locked dependencies with ${resolvedManager.display}`,
      shutdownGraceMs: config.server.shutdownGraceMs,
      registerOwned,
    },
  );
  if (result.code !== 0) {
    fail("MMPL-DEPS-005", `Locked dependency installation failed with exit ${result.code ?? result.signal}.`, EXIT.runtime);
  }
  for (const relativePath of missing) {
    try {
      await access(path.resolve(config.projectPath, relativePath));
    } catch (error) {
      fail("MMPL-DEPS-006", `Dependency restoration completed but probe is still missing: ${relativePath}`, EXIT.runtime, { cause: error });
    }
  }
  logger.line("Locked dependencies are ready.");
  return resolvedManager;
}

async function requestHealth(health) {
  return await new Promise((resolvePromise) => {
    const request = http.get(health.url, { timeout: Math.min(5000, health.intervalMs * 4) }, (response) => {
      let bytes = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes <= MAX_HEALTH_BYTES) chunks.push(chunk);
        else request.destroy(new Error("health response too large"));
      });
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolvePromise({
          reachable: true,
          status: response.statusCode ?? 0,
          marker: body.includes(health.bodyIncludes),
        });
      });
    });
    request.on("timeout", () => request.destroy(new Error("health timeout")));
    request.on("error", () => resolvePromise({ reachable: false, status: 0, marker: false }));
  });
}

async function waitForHealth(config, { childExitPromise = null } = {}) {
  const deadline = Date.now() + config.health.timeoutMs;
  while (Date.now() < deadline) {
    const check = await requestHealth(config.health);
    if (check.reachable && check.status === config.health.status && check.marker) return check;
    if (childExitPromise) {
      const exit = await Promise.race([
        childExitPromise.then((value) => ({ type: "exit", value })),
        new Promise((resolvePromise) => setTimeout(() => resolvePromise({ type: "continue" }), config.health.intervalMs)),
      ]);
      if (exit.type === "exit") {
        fail("MMPL-SERVER-003", `The prototype server exited before it became ready (exit ${exit.value.code ?? exit.value.signal}).`, EXIT.runtime);
      }
    } else {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, config.health.intervalMs));
    }
  }
  fail("MMPL-HEALTH-001", `The prototype did not pass its identity check within ${config.health.timeoutMs} ms.`, EXIT.runtime);
}

async function listenerOn(host, port) {
  return await new Promise((resolvePromise) => {
    const socket = net.createConnection({ host, port });
    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise(value);
    };
    socket.setTimeout(400);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function anyLoopbackListener(port) {
  const [ipv4, ipv6] = await Promise.all([listenerOn("127.0.0.1", port), listenerOn("::1", port)]);
  return ipv4 || ipv6;
}

function mimeType(filePath) {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return types[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function createStaticServer(config, logger) {
  const rootCandidate = path.resolve(config.projectPath, config.server.rootDirectory);
  const root = await realpath(rootCandidate).catch((error) => {
    fail("MMPL-STATIC-001", `Static root is missing: ${rootCandidate}`, EXIT.config, { cause: error });
  });
  if (root !== config.projectPath && !root.startsWith(`${config.projectPath}${path.sep}`)) {
    fail("MMPL-STATIC-002", "Static root resolves outside the project directory.", EXIT.config);
  }
  const entry = path.resolve(root, config.server.entryFile);
  if (entry !== root && !entry.startsWith(`${root}${path.sep}`)) {
    fail("MMPL-STATIC-003", "Static entry resolves outside the static root.", EXIT.config);
  }

  const allowedExtensions = new Set(config.server.allowedExtensions);
  const securityHeaders = {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; media-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  const server = http.createServer(async (request, response) => {
    try {
      if (!new Set(["GET", "HEAD"]).has(request.method || "")) {
        response.writeHead(405, { ...securityHeaders, Allow: "GET, HEAD" });
        response.end();
        return;
      }
      const parsed = new URL(request.url || "/", "http://localhost");
      const decoded = decodeURIComponent(parsed.pathname);
      if (decoded.includes("\0")) throw new Error("NUL path");
      const relativePath = decoded === "/" ? config.server.entryFile : decoded.replace(/^\/+/, "");
      const pathSegments = relativePath.split(/[\\/]+/);
      if (pathSegments.some((segment) => segment.startsWith("."))) throw new Error("dot path denied");
      const basename = pathSegments.at(-1).toLowerCase();
      if (
        /(?:secret|credential|token|password|passwd|private.?key)/i.test(basename) ||
        new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "prototype.launch.json"]).has(basename)
      ) {
        throw new Error("private file denied");
      }
      if (!allowedExtensions.has(path.extname(relativePath).toLowerCase())) throw new Error("extension denied");
      const candidate = path.resolve(root, relativePath);
      if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new Error("path escape");
      let resolved = await realpath(candidate);
      let fileStats = await stat(resolved);
      if (fileStats.isDirectory()) {
        resolved = await realpath(path.join(resolved, "index.html"));
        fileStats = await stat(resolved);
      }
      if (!fileStats.isFile() || (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))) throw new Error("not a file");
      response.writeHead(200, {
        ...securityHeaders,
        "Content-Type": mimeType(resolved),
        "Content-Length": fileStats.size,
      });
      if (request.method === "HEAD") response.end();
      else {
        const stream = createReadStream(resolved);
        stream.once("error", () => response.destroy());
        stream.pipe(response);
      }
    } catch {
      response.writeHead(404, { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
    }
  });
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(config.port, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  }).catch((error) => {
    fail("MMPL-STATIC-004", `The static server could not bind fixed port ${config.port}.`, EXIT.port, { cause: error });
  });
  logger.line(`Static review server is listening on fixed port ${config.port}.`);
  let exitResolve;
  const exitPromise = new Promise((resolvePromise) => { exitResolve = resolvePromise; });
  return {
    kind: "static",
    role: "prototype server",
    pid: process.pid,
    exitPromise,
    close: async () => {
      await new Promise((resolvePromise) => {
        let settled = false;
        let timer;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolvePromise();
        };
        server.close(finish);
        server.closeIdleConnections?.();
        timer = setTimeout(() => {
          server.closeAllConnections?.();
          finish();
        }, config.server.shutdownGraceMs);
      });
      exitResolve({ code: 0, signal: null });
    },
  };
}

async function resolveServerCommand(config, manager) {
  if (config.server.tool === "node") return { command: process.execPath, args: config.server.args };
  if (config.server.tool === "packageManager") {
    const resolved = manager ?? await resolvePackageManager(config);
    return { command: resolved.command, args: [...resolved.prefixArgs, ...config.server.args] };
  }
  let configuredExecutable = config.server.executable;
  if (!path.isAbsolute(configuredExecutable) && configuredExecutable.includes(path.sep)) {
    configuredExecutable = path.resolve(config.projectPath, configuredExecutable);
    if (configuredExecutable !== config.projectPath && !configuredExecutable.startsWith(`${config.projectPath}${path.sep}`)) {
      fail("MMPL-SERVER-005", "Configured server executable resolves outside the project directory.", EXIT.config);
    }
  }
  const executable = await findExecutable(configuredExecutable);
  if (!executable) fail("MMPL-SERVER-001", `Configured server executable is unavailable: ${config.server.executable}`, EXIT.runtime);
  return { command: executable, args: config.server.args };
}

async function createProcessServer(config, manager, logger) {
  const resolved = await resolveServerCommand(config, manager);
  const child = spawn(resolved.command, resolved.args, {
    cwd: config.projectPath,
    env: safeEnvironment(config.server.environment),
    detached: process.platform !== "win32",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  child.stdout.on("data", (chunk) => logger.child(chunk, process.stdout));
  child.stderr.on("data", (chunk) => logger.child(chunk, process.stderr));
  const exitPromise = new Promise((resolvePromise, rejectPromise) => {
    child.once("error", (error) => rejectPromise(new LauncherError("MMPL-SERVER-002", "The configured prototype server could not start.", EXIT.runtime, { cause: error })));
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
  logger.line(`Prototype server process started (owned PID ${child.pid}).`);
  return { kind: "process", role: "prototype server", pid: child.pid, child, exitPromise };
}

async function stopOwnedServer(owned, graceMs, logger) {
  if (!owned) return;
  const role = owned.role ?? "owned process";
  if (owned.kind === "static") {
    await owned.close();
    logger.line(`The launcher-owned ${role} stopped.`);
    return;
  }
  if (owned.child.exitCode !== null || owned.child.signalCode !== null) return;
  logger.line(`Stopping only this launcher-owned ${role}…`);
  try {
    if (process.platform === "win32") owned.child.kill("SIGTERM");
    else process.kill(-owned.child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  const result = await Promise.race([
    owned.exitPromise.then(() => "exited"),
    new Promise((resolvePromise) => setTimeout(() => resolvePromise("timeout"), graceMs)),
  ]);
  if (result === "timeout") {
    logger.line("Graceful stop timed out; terminating the same owned process group.");
    try {
      if (process.platform === "win32") owned.child.kill("SIGKILL");
      else process.kill(-owned.child.pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
    await Promise.race([owned.exitPromise, new Promise((resolvePromise) => setTimeout(resolvePromise, 3000))]);
  }
  logger.line(`The launcher-owned ${role} stopped.`);
}

async function removeStaleSocket(controlPath) {
  if (process.platform === "win32") return;
  try {
    const socketStats = await lstat(controlPath);
    if (!socketStats.isSocket()) {
      fail("MMPL-CONTROL-001", `Refusing to replace non-socket control path: ${controlPath}`, EXIT.control);
    }
    await unlink(controlPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function controlLine(socket, payload) {
  socket.write(`${JSON.stringify(payload)}\n`);
}

function createControlServer(config, paths, statusProvider, stopRequest) {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    let buffer = "";
    let challenge = null;
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > MAX_CONTROL_BYTES) {
        socket.destroy();
        return;
      }
      while (buffer.includes("\n")) {
        const newline = buffer.indexOf("\n");
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        let request;
        try {
          request = JSON.parse(line);
        } catch {
          controlLine(socket, { ok: false, code: "MMPL-CONTROL-002" });
          continue;
        }
        if (!isRecord(request) || request.identity !== config.identity) {
          controlLine(socket, { ok: false, code: "MMPL-CONTROL-003" });
          continue;
        }
        if (request.action === "status") {
          controlLine(socket, { ok: true, status: statusProvider() });
        } else if (request.action === "challenge") {
          challenge = randomUUID();
          controlLine(socket, { ok: true, challenge });
        } else if (request.action === "stop" && challenge && request.challenge === challenge) {
          challenge = null;
          controlLine(socket, { ok: true, accepted: true });
          setImmediate(stopRequest);
        } else {
          controlLine(socket, { ok: false, code: "MMPL-CONTROL-004" });
        }
      }
    });
  });
  Object.defineProperty(server, "missionmedSockets", { value: sockets });
  server.on("error", () => {});
  return server;
}

async function listenControl(server, paths) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(paths.controlPath, () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });
  if (process.platform !== "win32") await chmod(paths.controlPath, 0o600);
}

async function connectControl(config, paths, timeoutMs = 800) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const socket = net.createConnection(paths.controlPath);
    const timer = setTimeout(() => socket.destroy(new Error("control timeout")), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolvePromise(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
  });
}

async function controlRequest(config, paths, action) {
  let socket;
  try {
    socket = await connectControl(config, paths);
  } catch {
    return null;
  }
  socket.setEncoding("utf8");
  return await new Promise((resolvePromise) => {
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      resolvePromise(null);
    }, 1200);
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      clearTimeout(timer);
      socket.end();
      try {
        resolvePromise(JSON.parse(buffer.slice(0, buffer.indexOf("\n"))));
      } catch {
        resolvePromise(null);
      }
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolvePromise(null);
    });
    controlLine(socket, { action, identity: config.identity });
  });
}

async function requestOwnedStop(config, paths) {
  let socket;
  try {
    socket = await connectControl(config, paths, 1500);
  } catch {
    return null;
  }
  socket.setEncoding("utf8");
  return await new Promise((resolvePromise) => {
    let buffer = "";
    let phase = "challenge";
    const timer = setTimeout(() => {
      socket.destroy();
      resolvePromise(null);
    }, 3000);
    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.includes("\n")) {
        const newline = buffer.indexOf("\n");
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        let response;
        try {
          response = JSON.parse(line);
        } catch {
          clearTimeout(timer);
          socket.destroy();
          resolvePromise(null);
          return;
        }
        if (phase === "challenge" && response.ok && typeof response.challenge === "string") {
          phase = "stop";
          controlLine(socket, { action: "stop", identity: config.identity, challenge: response.challenge });
        } else if (phase === "stop") {
          clearTimeout(timer);
          socket.end();
          resolvePromise(response.ok && response.accepted ? response : null);
          return;
        } else {
          clearTimeout(timer);
          socket.destroy();
          resolvePromise(null);
          return;
        }
      }
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolvePromise(null);
    });
    controlLine(socket, { action: "challenge", identity: config.identity });
  });
}

async function browserCommand(browser, url) {
  if (browser === "none") return { skipped: true, fallback: false };
  const run = async (command, args) => await new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: "ignore", shell: false, windowsHide: true, env: safeEnvironment() });
    child.once("error", () => resolvePromise(false));
    child.once("exit", (code) => resolvePromise(code === 0));
  });
  if (process.platform === "darwin") {
    if (browser === "chrome") {
      const chromeScript = [
        "on run argv",
        "set targetURL to item 1 of argv",
        'tell application "Google Chrome"',
        "activate",
        "if (count of windows) = 0 then make new window",
        "tell front window to make new tab with properties {URL:targetURL}",
        "end tell",
        "end run",
      ];
      const chromeArguments = chromeScript.flatMap((line) => ["-e", line]);
      chromeArguments.push("--", url);
      if (await run("/usr/bin/osascript", chromeArguments)) {
        return { skipped: false, fallback: false };
      }
    }
    const opened = await run("/usr/bin/open", [url]);
    if (!opened) fail("MMPL-BROWSER-001", "macOS could not open the local prototype URL.", EXIT.runtime);
    return { skipped: false, fallback: browser === "chrome" };
  }
  if (process.platform === "win32") {
    const command = path.join(process.env.SYSTEMROOT || "C:\\Windows", "System32", "rundll32.exe");
    const opened = await run(command, ["url.dll,FileProtocolHandler", url]);
    if (!opened) fail("MMPL-BROWSER-002", "Windows could not open the local prototype URL.", EXIT.runtime);
    return { skipped: false, fallback: browser === "chrome" };
  }
  if (browser === "chrome") {
    const chrome = await findExecutable("google-chrome") || await findExecutable("chromium") || await findExecutable("chromium-browser");
    if (chrome && await run(chrome, [url])) return { skipped: false, fallback: false };
  }
  const xdgOpen = await findExecutable("xdg-open");
  if (!xdgOpen || !(await run(xdgOpen, [url]))) fail("MMPL-BROWSER-003", "The default browser could not open the local prototype URL.", EXIT.runtime);
  return { skipped: false, fallback: browser === "chrome" };
}

async function verifyNodeVersion(config) {
  const current = parseSemver(process.versions.node, "current Node version");
  const minimum = parseSemver(config.minimumNodeVersion, "node.minimumVersion");
  if (compareVersions(current, minimum) < 0) {
    fail("MMPL-RUNTIME-002", `${config.displayName} requires Node ${config.minimumNodeVersion} or newer; found ${process.versions.node}.`, EXIT.runtime);
  }
}

async function tryReuseOwned(config, paths, browser, logger = null) {
  const response = await controlRequest(config, paths, "status");
  if (!response?.ok || response.status?.identity !== config.identity) return false;
  if (logger) logger.line(`An owned ${config.displayName} launch is already active (${response.status.phase}).`);
  await waitForHealth(config);
  const browserResult = await browserCommand(browser, config.openUrl);
  if (logger && browserResult.fallback) logger.line("Google Chrome was unavailable, so the default browser opened instead.");
  if (logger) logger.line("The existing prototype is ready; no duplicate server was launched.");
  return true;
}

async function launch(config, browser) {
  await verifyNodeVersion(config);
  const paths = runtimePaths(config);
  await prepareRuntimeDirectory(paths);
  const logger = createLogger(paths);
  logger.line("");
  logger.line(`MissionMed Prototype Launcher ${FRAMEWORK_VERSION}`);
  logger.line(`Preparing ${config.displayName}…`);

  if (await tryReuseOwned(config, paths, browser, logger)) {
    logger.stream.end();
    return;
  }

  const controlServer = createControlServer(
    config,
    paths,
    () => publicState(config, paths, phase, owned?.pid ?? null),
    () => { stopRequested = true; void shutdown("requested"); },
  );
  let phase = "claiming";
  let owned = null;
  let stopRequested = false;
  let shuttingDown = false;
  let shutdownPromise = null;

  const cleanupControl = async () => {
    for (const socket of controlServer.missionmedSockets) socket.destroy();
    await new Promise((resolvePromise) => {
      if (!controlServer.listening) return resolvePromise();
      controlServer.close(() => resolvePromise());
    });
    if (process.platform !== "win32") await unlink(paths.controlPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    await unlink(paths.statePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  };
  const shutdown = async (reason) => {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = (async () => {
      phase = "stopping";
      await atomicStateWrite(paths.statePath, publicState(config, paths, phase, owned?.pid ?? null)).catch(() => {});
      await stopOwnedServer(owned, config.server.shutdownGraceMs, logger).catch((error) => {
        logger.line(`Owned stop warning: ${error.message}`);
      });
      await cleanupControl().catch((error) => logger.line(`Control cleanup warning: ${error.message}`));
      if (reason === "requested") logger.line("Stop complete. No unrelated development server was affected.");
      logger.stream.end();
    })();
    return shutdownPromise;
  };

  const signalHandler = (signal) => {
    logger.line(`Received ${signal}; cleaning up this launcher-owned server.`);
    void shutdown(signal).finally(() => process.exit(0));
  };
  for (const signal of ["SIGINT", "SIGTERM", ...(process.platform === "win32" ? [] : ["SIGHUP"])]) {
    process.once(signal, () => signalHandler(signal));
  }

  try {
    try {
      await listenControl(controlServer, paths);
    } catch (error) {
      if (error?.code === "EADDRINUSE") {
        if (await tryReuseOwned(config, paths, browser, logger)) {
          logger.stream.end();
          return;
        }
        await removeStaleSocket(paths.controlPath);
        try {
          await listenControl(controlServer, paths);
        } catch (retryError) {
          if (retryError?.code === "EADDRINUSE" && await tryReuseOwned(config, paths, browser, logger)) {
            logger.stream.end();
            return;
          }
          throw retryError;
        }
      } else {
        throw error;
      }
    }

    phase = "verifying";
    await atomicStateWrite(paths.statePath, publicState(config, paths, phase));

    if (await anyLoopbackListener(config.port)) {
      const check = await requestHealth(config.health);
      if (check.reachable && check.status === config.health.status && check.marker) {
        logger.line("A matching externally started prototype is already healthy. It will be opened but not claimed or stopped.");
        const browserResult = await browserCommand(browser, config.openUrl);
        if (browserResult.fallback) logger.line("Google Chrome was unavailable, so the default browser opened instead.");
        await cleanupControl();
        logger.stream.end();
        return;
      }
      fail("MMPL-PORT-001", `Fixed port ${config.port} is occupied by an unowned or unexpected service. It was left untouched.`, EXIT.port);
    }

    phase = "dependencies";
    await atomicStateWrite(paths.statePath, publicState(config, paths, phase));
    let manager = null;
    if (config.dependencies.mode === "package-manager") {
      manager = await verifyDependencies(config, manager, logger, async (dependencyOwner) => {
        owned = dependencyOwner;
        if (dependencyOwner && !shuttingDown) {
          await atomicStateWrite(
            paths.statePath,
            publicState(config, paths, phase, dependencyOwner?.pid ?? null),
          ).catch(() => {});
        }
      });
    }

    phase = "starting";
    owned = null;
    await atomicStateWrite(paths.statePath, publicState(config, paths, phase));
    owned = config.server.mode === "static"
      ? await createStaticServer(config, logger)
      : await createProcessServer(config, manager, logger);
    await atomicStateWrite(paths.statePath, publicState(config, paths, phase, owned.pid));

    logger.line("Waiting for the exact prototype identity check…");
    await waitForHealth(config, { childExitPromise: owned.exitPromise });
    phase = "ready";
    await atomicStateWrite(paths.statePath, publicState(config, paths, phase, owned.pid));
    logger.line(`${config.displayName} is ready at ${config.openUrl}`);
    const browserResult = await browserCommand(browser, config.openUrl);
    if (browserResult.fallback) logger.line("Google Chrome was unavailable, so the default browser opened instead.");
    if (!browserResult.skipped) logger.line("Browser opened. Keep this window open while reviewing; use STOP_LOCAL_SERVER.command when finished.");

    const exit = await owned.exitPromise;
    if (!shuttingDown && !stopRequested) {
      fail("MMPL-SERVER-004", `The prototype server stopped unexpectedly (exit ${exit.code ?? exit.signal}).`, EXIT.runtime);
    }
    await shutdown(stopRequested ? "requested" : "server-exit");
  } catch (error) {
    await shutdown("error");
    throw error;
  }
}

async function stop(config) {
  const paths = runtimePaths(config);
  const response = await requestOwnedStop(config, paths);
  if (!response) {
    const occupied = await anyLoopbackListener(config.port);
    process.stdout.write(`No launcher-owned ${config.displayName} server is active.\n`);
    if (occupied) process.stdout.write(`Port ${config.port} has an unowned listener; it was left untouched.\n`);
    else process.stdout.write("Nothing needed to be stopped.\n");
    return;
  }
  process.stdout.write(`Stopping only the launcher-owned ${config.displayName} server…\n`);
  const deadline = Date.now() + config.server.shutdownGraceMs + 5000;
  while (Date.now() < deadline) {
    if (!(await controlRequest(config, paths, "status"))) {
      process.stdout.write("Stop complete. No unrelated development server was affected.\n");
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  fail("MMPL-STOP-001", "The owned supervisor accepted stop but did not close within the shutdown window.", EXIT.control);
}

async function status(config) {
  const paths = runtimePaths(config);
  const response = await controlRequest(config, paths, "status");
  if (!response?.ok) {
    process.stdout.write(`${config.displayName}: no launcher-owned instance\n`);
    return;
  }
  process.stdout.write(`${config.displayName}: ${response.status.phase} (owned supervisor ${response.status.supervisorPid})\n`);
}

function parseArguments(argv) {
  const [action, ...rest] = argv;
  if (!ACTIONS.has(action)) fail("MMPL-USAGE-001", "Usage: launcher <launch|stop|status|validate-config> --config PATH [--browser chrome|default|none]", EXIT.usage);
  let configPath = null;
  let browser = "default";
  let pauseOnError = false;
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (item === "--config") configPath = rest[++index];
    else if (item === "--browser") browser = rest[++index];
    else if (item === "--pause-on-error") pauseOnError = true;
    else fail("MMPL-USAGE-002", `Unknown launcher argument: ${item}`, EXIT.usage);
  }
  if (!configPath) fail("MMPL-USAGE-003", "--config PATH is required.", EXIT.usage);
  if (!BROWSER_VALUES.has(browser)) fail("MMPL-USAGE-004", "--browser must be chrome, default, or none.", EXIT.usage);
  if (action !== "launch" && browser !== "default") fail("MMPL-USAGE-005", "--browser is accepted only for launch.", EXIT.usage);
  return { action, configPath, browser, pauseOnError };
}

async function pauseForError() {
  if (!process.stdin.isTTY || process.env.CI === "true") return;
  process.stdout.write("Press Return to close this window.\n");
  process.stdin.resume();
  await new Promise((resolvePromise) => process.stdin.once("data", resolvePromise));
}

async function main() {
  let parsed;
  try {
    parsed = parseArguments(process.argv.slice(2));
    const config = await loadConfig(parsed.configPath);
    if (parsed.action === "validate-config") {
      await verifyNodeVersion(config);
      process.stdout.write(`PASS ${config.displayName} launcher configuration (${config.identity})\n`);
    } else if (parsed.action === "launch") {
      await launch(config, parsed.browser);
    } else if (parsed.action === "stop") {
      await stop(config);
    } else {
      await status(config);
    }
  } catch (error) {
    const launcherError = error instanceof LauncherError
      ? error
      : new LauncherError("MMPL-INTERNAL-001", "The launcher encountered an unexpected local error.", EXIT.internal, { cause: error });
    process.stderr.write(`\nCould not complete the prototype launch.\nCode: ${launcherError.code}\n${launcherError.message}\nNo unrelated development server was stopped.\n`);
    process.exitCode = launcherError.exitCode;
    if (parsed?.pauseOnError) await pauseForError();
  }
}

if (path.resolve(process.argv[1] || "") === path.resolve(SCRIPT_PATH)) {
  await main();
}

export {
  CONFIG_SCHEMA,
  FRAMEWORK_VERSION,
  LauncherError,
  browserCommand,
  loadConfig,
  parseArguments,
  parseJsonWithoutDuplicateKeys,
  requestHealth,
  runtimePaths,
};

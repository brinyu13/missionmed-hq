import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CAPABILITY_REGISTRY } from "../../cie/src/capabilities.mjs";

const ticketRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(ticketRoot, "..");
const runtimeRoots = [
  path.join(workspace, "cie", "src"),
  path.join(workspace, "cie", "public"),
  path.join(workspace, "cie", "scripts"),
  path.join(workspace, "cie", "migrations")
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".sql"]);

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(target));
    else if (textExtensions.has(path.extname(entry.name))) files.push(target);
  }
  return files;
}

const runtimeFiles = (await Promise.all(runtimeRoots.map(filesUnder))).flat();
const reportFiles = await filesUnder(ticketRoot);
const files = [...new Set([...runtimeFiles, ...reportFiles.filter((file) => !file.includes(`${path.sep}tests${path.sep}`))])];
const credentialPatterns = [
  ["jwt", /eyJ[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}/gu],
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu],
  ["openai_key", /sk-[a-zA-Z0-9_-]{20,}/gu],
  ["github_token", /(?:ghp|github_pat)_[a-zA-Z0-9_]{20,}/gu],
  ["aws_access_key", /AKIA[0-9A-Z]{16}/gu]
];
const credentialFindings = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const [kind, pattern] of credentialPatterns) {
    if (pattern.test(source)) credentialFindings.push({ kind, file: path.relative(workspace, file) });
    pattern.lastIndex = 0;
  }
}

assert.deepEqual(credentialFindings, []);
const inactive = CAPABILITY_REGISTRY.filter((entry) => entry.activation_state === "INACTIVE");
assert.equal(inactive.length, 7);
assert.equal(inactive.every((entry) => entry.accepted_writes === false && entry.implementation_ref === null && entry.provider_ref === null), true);
assert.deepEqual(CAPABILITY_REGISTRY.filter((entry) => entry.accepted_writes).map((entry) => entry.capability_key), ["mentor_manual_opportunity"]);

const runtimeSource = (await Promise.all(runtimeFiles.map((file) => readFile(file, "utf8")))).join("\n");
assert.doesNotMatch(runtimeSource, /from\s+["'](?:openai|@anthropic|elevenlabs|onnx|tensorflow|mediapipe|whisper)/iu);
assert.doesNotMatch(runtimeSource, /(?:readiness|match_probability|personality|emotion|anxiety|confidence)_score/iu);

process.stdout.write(`${JSON.stringify({
  ticket: "Y1-CIE-C0-0001",
  status: "PASS",
  text_files_scanned: files.length,
  credential_findings: credentialFindings.length,
  active_write_capabilities: ["mentor_manual_opportunity"],
  inactive_future_capabilities: inactive.map((entry) => entry.capability_key),
  production_touched: false
})}\n`);

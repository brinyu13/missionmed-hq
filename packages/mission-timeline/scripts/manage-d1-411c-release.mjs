import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readFile, readlink, realpath, rename, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) throw new Error("RELEASE_ARGUMENTS_INVALID");
  args.set(key.slice(2), value);
}
const action = args.get("action");
const releaseRoot = args.get("release-root");
const execute = args.get("execute") === "yes";
if (!["install", "rollback"].includes(action) || !releaseRoot || !isAbsolute(releaseRoot)) {
  throw new Error("RELEASE_ACTION_OR_ROOT_INVALID");
}
const normalizedRoot = resolve(releaseRoot);
if ([sep, "/Users", "/Users/brianb"].includes(normalizedRoot)) throw new Error("RELEASE_ROOT_TOO_BROAD");

const releases = join(normalizedRoot, "releases");
const receipts = join(normalizedRoot, "receipts");
const current = join(normalizedRoot, "current");
await mkdir(releases, { recursive: true });
await mkdir(receipts, { recursive: true });

async function currentTarget() {
  try {
    const details = await lstat(current);
    if (!details.isSymbolicLink()) throw new Error("CURRENT_RELEASE_NOT_SYMLINK");
    return await readlink(current);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function verifyRelease(directory) {
  const root = await realpath(directory);
  const manifest = JSON.parse(await readFile(join(root, "release-manifest.json"), "utf8"));
  if (manifest.schema_version !== "d1-411c-release-manifest.1" || !/^timeline-[a-f0-9]{16}$/.test(manifest.release_id)) {
    throw new Error("RELEASE_MANIFEST_INVALID");
  }
  for (const [path, expected] of Object.entries(manifest.files)) {
    const file = await realpath(join(root, path));
    if (relative(root, file).startsWith("..")) throw new Error(`RELEASE_PATH_ESCAPE:${path}`);
    const bytes = await readFile(file);
    if (bytes.byteLength !== expected.bytes || createHash("sha256").update(bytes).digest("hex") !== expected.sha256) {
      throw new Error(`RELEASE_HASH_MISMATCH:${path}`);
    }
  }
  return { root, manifest };
}

const previous = await currentTarget();
const receiptBase = {
  schema_version: "d1-411c-release-operation.1",
  action,
  mode: execute ? "EXECUTE" : "PREFLIGHT_ONLY",
  release_root: normalizedRoot,
  previous_current: previous,
  generated_at: new Date().toISOString(),
};

if (action === "install") {
  const source = args.get("release-dir");
  if (!source || !isAbsolute(source)) throw new Error("RELEASE_DIRECTORY_INVALID");
  const verified = await verifyRelease(source);
  const target = join(releases, verified.manifest.release_id);
  const preflight = { ...receiptBase, release_id: verified.manifest.release_id, source: verified.root, target, status: "PREFLIGHT_PASS" };
  const receiptPath = join(receipts, `${Date.now()}-${verified.manifest.release_id}-install.json`);
  await writeFile(receiptPath, `${JSON.stringify(preflight, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  if (execute) {
    try {
      await verifyRelease(target);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const staging = join(releases, `.install-${verified.manifest.release_id}-${randomUUID()}`);
      await cp(verified.root, staging, { recursive: true, errorOnExist: true, force: false });
      await verifyRelease(staging);
      await rename(staging, target);
    }
    const next = join(normalizedRoot, `.current-${randomUUID()}`);
    await symlink(join("releases", verified.manifest.release_id), next);
    await rename(next, current);
    await writeFile(receiptPath, `${JSON.stringify({ ...preflight, status: "INSTALLED", current: await currentTarget() }, null, 2)}\n`, { mode: 0o600 });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, receipt: receiptPath, release_id: verified.manifest.release_id, executed: execute })}\n`);
} else {
  const installReceiptPath = args.get("receipt");
  if (!installReceiptPath || !isAbsolute(installReceiptPath)) throw new Error("INSTALL_RECEIPT_INVALID");
  const installReceipt = JSON.parse(await readFile(installReceiptPath, "utf8"));
  const prior = installReceipt.previous_current;
  if (typeof prior !== "string" || !prior.startsWith("releases/timeline-")) throw new Error("ROLLBACK_TARGET_UNAVAILABLE");
  const target = join(normalizedRoot, prior);
  const verified = await verifyRelease(target);
  const receiptPath = join(receipts, `${Date.now()}-${verified.manifest.release_id}-rollback.json`);
  const rollbackReceipt = { ...receiptBase, install_receipt: installReceiptPath, rollback_target: prior, release_id: verified.manifest.release_id, status: "PREFLIGHT_PASS" };
  await writeFile(receiptPath, `${JSON.stringify(rollbackReceipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  if (execute) {
    const next = join(normalizedRoot, `.current-${randomUUID()}`);
    await symlink(prior, next);
    await rename(next, current);
    await writeFile(receiptPath, `${JSON.stringify({ ...rollbackReceipt, status: "ROLLED_BACK", current: await currentTarget() }, null, 2)}\n`, { mode: 0o600 });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, receipt: receiptPath, release_id: verified.manifest.release_id, executed: execute })}\n`);
}

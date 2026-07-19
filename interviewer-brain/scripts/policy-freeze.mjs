import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const ROOT_ENTRIES = ["package.json", "src", "personas", "plans", "schemas"];

async function filesUnder(path) {
  const statEntries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of statEntries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export function rawSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function buildPolicySnapshot() {
  const paths = [];
  for (const entry of ROOT_ENTRIES) {
    const path = join(ROOT, entry);
    if (entry === "package.json") paths.push(path);
    else paths.push(...await filesUnder(path));
  }
  const files = [];
  for (const path of paths.sort()) {
    const bytes = await readFile(path);
    files.push({ path: relative(ROOT, path), bytes: bytes.length, sha256: rawSha256(bytes) });
  }
  return {
    root: ROOT,
    files,
    aggregate_sha256: rawSha256(JSON.stringify(files)),
  };
}

export async function fileSha256(path) {
  return rawSha256(await readFile(path));
}

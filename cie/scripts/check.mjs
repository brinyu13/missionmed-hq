import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const files = ["src", "scripts", "tests"]
  .flatMap((directory) => {
    const full = path.join(root, directory);
    return statSync(full, { throwIfNoEntry: false })?.isDirectory() ? filesUnder(full) : [];
  })
  .filter((file) => file.endsWith(".mjs"))
  .sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

console.log(`CIE syntax check passed (${files.length} modules)`);

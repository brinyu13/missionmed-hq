import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const target = join(root, "release", "manifest.json");
const excluded = new Set(["node_modules", ".DS_Store"]);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (path === target) return [];
    return entry.isDirectory() ? files(path) : [path];
  });
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const records = files(root)
  .map((path) => ({ path: relative(root, path), bytes: statSync(path).size, sha256: hash(path) }))
  .sort((left, right) => left.path.localeCompare(right.path));
const manifest = {
  schemaVersion: "d1-timeline-release-manifest-413.1",
  release: "413.0.0-rc.0",
  classification: "BLOCKED_BY_MATRIX_AUTHORITY",
  deployed: false,
  productionDataAllowed: false,
  sourceAuthority: {
    name: "D1-410 release candidate",
    indexSha256: records.find((item) => item.path === "web/index.html")?.sha256,
  },
  components: {
    web: "410.0-rc preserved with 413 medical/privacy hardening modules",
    api: "413.0.0-rc.0 local contract",
    database: "202607150001 base plus 202607150002 hardening exercised only on disposable PostgreSQL",
    documentSchema: "d1-timeline-document-409.1",
    artifactSchema: "d1-timeline-artifact-409.1",
    matrixAppMode: "BLOCKED_BY_MATRIX_AUTHORITY_DISABLED",
    privateStorage: "DISPOSABLE_FILESYSTEM_S3_COMPATIBLE_NOT_CONNECTED",
    rendererAuthority: "MAC_PRO_AUTHORITY_LOCAL_SIMULATOR_NOT_CONNECTED",
    fileVaultLegacy: "LOCAL_CONTRACT_FIXTURE_NOT_CONNECTED",
    fileVaultV2: "DISABLED_NOT_RATIFIED",
  },
  files: records,
};
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${target}\n${records.length} files\n`);

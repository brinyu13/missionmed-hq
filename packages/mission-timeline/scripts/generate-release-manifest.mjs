import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const target = join(root, "release", "manifest.json");
const excluded = new Set(["node_modules", ".DS_Store", "dist", "dist-api", "dist-wordpress"]);

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
  schemaVersion: "d1-timeline-release-manifest-500.1",
  release: "D1-500",
  classification: "PRODUCTION_LAUNCH_AUTHORIZED_DEFAULT_OFF",
  deployed: false,
  productionDataAllowed: true,
  sourceAuthority: {
    name: "Accepted D1-413 baseline with protected D1-409H-A1 presentation",
    acceptedBaseCommit: "49ba56dacd2cddfc2fb2241839d54a03e85bc271",
    indexSha256: records.find((item) => item.path === "web/index.html")?.sha256,
  },
  components: {
    web: "Accepted D1-413 application with protected D1-409H-A1 presentation",
    api: "D1-500 production same-origin gateway service",
    database: "Migration chain through 202608040004; d1-timeline-db-500.1",
    documentSchema: "d1-timeline-document-409.1",
    artifactSchema: "d1-timeline-artifact-409.1",
    matrixAppMode: "WORDPRESS_AUTHENTICATED_ROUTE_DEFAULT_OFF",
    privateStorage: "PRODUCTION_API_FAILS_CLOSED_UNTIL_SEPARATELY_CONFIGURED",
    rendererAuthority: "CLIENT_SIDE_ACCEPTED_RENDERER",
    fileVaultLegacy: "LOCAL_IMPORT_AVAILABLE_REMOTE_PUBLICATION_NOT_CONNECTED",
    fileVaultV2: "DISABLED_NOT_RATIFIED",
  },
  files: records,
};
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${target}\n${records.length} files\n`);

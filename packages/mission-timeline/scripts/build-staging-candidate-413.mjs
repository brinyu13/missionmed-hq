import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const engineRoot = "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const evidenceRoot = join(engineRoot, "evidence/413");
const reportsRoot = join(engineRoot, "reports");
const targetRoot = join(engineRoot, "staging_candidate_413");
const applicationRoot = join(targetRoot, "application");
const refresh = process.env.D1_413_REFRESH === "1";

if (existsSync(targetRoot) && !refresh) {
  throw new Error(`Refusing to merge into an existing candidate: ${targetRoot}`);
}
if (refresh && !existsSync(join(targetRoot, "manifests/staging-candidate-manifest-413.json"))) {
  throw new Error(`Refusing to refresh an unrecognized candidate directory: ${targetRoot}`);
}

mkdirSync(targetRoot, { recursive: true });
cpSync(packageRoot, applicationRoot, {
  recursive: true,
  filter: (source) => !source.split("/").includes("node_modules"),
});
cpSync(evidenceRoot, join(targetRoot, "evidence"), { recursive: true });

const reportNames = readdirSync(reportsRoot)
  .filter((name) => /^D1_413_.*\.md$/.test(name) && name !== "D1_413_COMBINED_HANDOFF.md")
  .sort();
mkdirSync(join(targetRoot, "reports"), { recursive: true });
for (const name of reportNames) {
  cpSync(join(reportsRoot, name), join(targetRoot, "reports", name));
}

mkdirSync(join(targetRoot, "matrix-host-patch"), { recursive: true });
writeFileSync(
  join(targetRoot, "matrix-host-patch/BLOCKED_BY_MATRIX_AUTHORITY.json"),
  `${JSON.stringify({
    schemaVersion: "d1-matrix-host-patch-status-413.1",
    status: "BLOCKED_BY_MATRIX_AUTHORITY",
    patchIncluded: false,
    featureFlagDefault: false,
    reason: "No clean, ratified, hash-current Matrix Runtime v2 source authority passed all guards.",
    protectedRuntimeModified: false,
  }, null, 2)}\n`,
);

mkdirSync(join(targetRoot, "config"), { recursive: true });
writeFileSync(
  join(targetRoot, "config/staging.env.example"),
  [
    "# D1-413 example only. No secrets are included.",
    "TIMELINE_ENV=private-staging",
    "TIMELINE_API_ENABLED=false",
    "TIMELINE_REMOTE_SYNC_ENABLED=false",
    "TIMELINE_PRIVATE_STORAGE_ENABLED=false",
    "TIMELINE_MAC_PRO_EXPORT_ENABLED=false",
    "TIMELINE_FILEVAULT_LEGACY_ENABLED=false",
    "TIMELINE_FILEVAULT_V2_ENABLED=false",
    "TIMELINE_CLOUD_OCR_ENABLED=false",
    "DATABASE_URL=REQUIRED_FROM_SECRET_MANAGER",
    "TIMELINE_TOKEN_SECRET=REQUIRED_FROM_SECRET_MANAGER",
    "TIMELINE_OBJECT_SIGNING_SECRET=REQUIRED_FROM_SECRET_MANAGER",
    "",
  ].join("\n"),
);

mkdirSync(join(targetRoot, "rollback"), { recursive: true });
cpSync(join(packageRoot, "release/rollback-plan.md"), join(targetRoot, "rollback/D1_412_BASE_ROLLBACK_PLAN.md"));
writeFileSync(
  join(targetRoot, "rollback/ROLLBACK_STATUS_413.md"),
  [
    "# D1-413 Rollback Status",
    "",
    "No shared Matrix host patch or deployment was performed. All release flags remain false.",
    "The disposable PostgreSQL migration was backed up, restored, rolled down, and reapplied locally.",
    "A future host rollback remains blocked until Matrix source authority is reconciled and a pre-edit manifest is ratified.",
    "",
  ].join("\n"),
);

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (path === join(targetRoot, "manifests/staging-candidate-manifest-413.json")) return [];
    return entry.isDirectory() ? files(path) : [path];
  });
}

const packageLock = JSON.parse(readFileSync(join(packageRoot, "package-lock.json"), "utf8"));
const dependencies = Object.entries(packageLock.packages ?? {})
  .filter(([name]) => name.startsWith("node_modules/"))
  .map(([name, value]) => ({
    name: basename(name),
    version: value.version ?? null,
    developmentOnly: Boolean(value.dev),
    license: value.license ?? null,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

mkdirSync(join(targetRoot, "manifests"), { recursive: true });
writeFileSync(
  join(targetRoot, "manifests/dependency-inventory-413.json"),
  `${JSON.stringify({ schemaVersion: "d1-dependency-inventory-413.1", dependencies }, null, 2)}\n`,
);

writeFileSync(
  join(targetRoot, "README.md"),
  [
    "# D1-413 Staging Candidate",
    "",
    "Classification: BLOCKED_BY_MATRIX_AUTHORITY",
    "",
    "This is a reproducible implementation and evidence package, not a deployed staging release.",
    "It contains only local/disposable adapters and contract fixtures. All release flags are false.",
    "It must not receive real student data until the security, medical-education, Matrix authority, and external-contract gates are closed.",
    "",
  ].join("\n"),
);

const records = files(targetRoot)
  .map((path) => ({ path: relative(targetRoot, path), bytes: statSync(path).size, sha256: sha256(path) }))
  .sort((left, right) => left.path.localeCompare(right.path));
const manifest = {
  schemaVersion: "d1-staging-candidate-manifest-413.1",
  generatedAt: new Date().toISOString(),
  refreshed: refresh,
  classification: "BLOCKED_BY_MATRIX_AUTHORITY",
  deployed: false,
  productionDataAllowed: false,
  matrixHostPatchIncluded: false,
  featureFlagsDefaultFalse: true,
  sourcePackage: packageRoot,
  reportsIncluded: reportNames,
  fileCountExcludingManifest: records.length,
  files: records,
};
writeFileSync(
  join(targetRoot, "manifests/staging-candidate-manifest-413.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const manifestHash = sha256(join(targetRoot, "manifests/staging-candidate-manifest-413.json"));
process.stdout.write(`${targetRoot}\n${records.length + 1} files\nmanifest sha256 ${manifestHash}\n`);

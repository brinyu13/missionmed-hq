import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const repo = resolve(root, "../..");
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
}

function text(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function sha(path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

check(
  "D1-404 candidate remains a canonical 407F in-place upgrade",
  /MissionMed<b>\/\/<\/b>TimelineBuilder/.test(text("web/index.html"))
    && /--bg:#0b0e14;\s*--bg2:#101623;\s*--card:#141b2b;/.test(text("web/index.html"))
    && /src="\.\/js\/407f-engineering-adapter\.js"/.test(text("web/index.html")),
  sha("web/index.html"),
);
const activeIndex = text("web/index.html");
const uxrEntry = text("web/js/app.js");
const uxrApp = text("web/js/uxr-002/app.js");
const uxrConstants = text("web/js/uxr-002/constants.js");
const uxrStyles = text("web/styles/uxr-002.css");
const contrastAddendum = text("docs/D1-UXR-002-CONTRAST-ADDENDUM-001.md");
const microLabelContrastAddendum = text("docs/D1-UXR-002-CONTRAST-ADDENDUM-002.md");
const implementationAuthorityAddendum = text("docs/D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001.md");
const executionAmendment = text("docs/D1-UXR-002-EXECUTION-AMENDMENT-001.md");
const completionDirective = text("docs/D1-UXR-002-AUTONOMOUS-COMPLETION-DIRECTIVE-001.md");
const d1404Authority = text("docs/D1-404-AUTHORITY.md");
check(
  "superseded D1-UXR-002 entry is inactive",
  /import\s+\{bootTimelineBuilder\}\s+from\s+"\.\/uxr-002\/app\.js"/.test(uxrEntry)
    && !/src=["']\.\/js\/app\.js["']/.test(activeIndex)
    && !/href=["']\.\/styles\.css["']/.test(activeIndex),
  "UXR engineering retained without serving its shell",
);
check(
  "D1-404 authority and 407F presentation identity are candidate-bound",
  /^# D1-404 — 407F Upgrade and Production Megarun$/m.test(d1404Authority)
    && /ACTIVE — SUPERSEDES WHITE UXR RUNTIME ACTIVATION/.test(d1404Authority)
    && /b318e9da82a45c187725a6439fa042e0cab54af4973a5d5c7fdb6b5974c63db4/.test(d1404Authority)
    && /MissionMed<b>\/\/<\/b>TimelineBuilder/.test(activeIndex)
    && /<nav id="rail" aria-label="Timeline Builder">/.test(activeIndex)
    && (activeIndex.match(/class="rtab(?: on)?"/g)||[]).length===5
    && ["Home","Builder","Edit Timeline","Media","Export"].every((label)=>new RegExp(`data-v="[^"]+">${label}<`).test(activeIndex))
    && /window\.D1_407F_TEST=/.test(activeIndex),
  "canonical 407F active; D1-404 precedence recorded",
);
check(
  "Founder contrast addendum is candidate-bound",
  /D1-UXR-002-CONTRAST-ADDENDUM-001/.test(uxrApp)
    && /--accent-gold:#B98A2E;/.test(uxrStyles)
    && /--accent-gold-text:#191C21;/.test(uxrStyles)
    && /^# D1-UXR-002-CONTRAST-ADDENDUM-001$/m.test(contrastAddendum),
  "gold #B98A2E with normal text/icons #191C21",
);
check(
  "Founder micro-label contrast addendum is candidate-bound",
  /D1-UXR-002-CONTRAST-ADDENDUM-002/.test(uxrApp)
    && /--ink-tertiary:#8A9099;/.test(uxrStyles)
    && /\.micro-label\{[^}]*color:var\(--ink-secondary\)/.test(uxrStyles)
    && /\.journey-strip\{[^}]*color:var\(--ink-secondary\)/.test(uxrStyles)
    && !/color:var\(--ink-tertiary\)/.test(uxrStyles)
    && /^# D1-UXR-002-CONTRAST-ADDENDUM-002$/m.test(microLabelContrastAddendum),
  "11px/650 micro labels #565D66; tertiary #8A9099 preserved",
);
check(
  "Founder implementation authority delegation is candidate-bound",
  /D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001/.test(uxrApp)
    && /^# D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001$/m.test(implementationAuthorityAddendum)
    && /adaptive-timeline algorithm changes/.test(implementationAuthorityAddendum),
  "non-material accessibility adjustments delegated; product behavior remains Founder-controlled",
);
check(
  "Founder autonomous specialist execution amendment is candidate-bound",
  /^# D1-UXR-002-EXECUTION-AMENDMENT-001$/m.test(executionAmendment)
    && /f5d29cf7a8b0098fa11f9c4c2fff847c0d3944e394094501f5268cdc0a24dcc5/.test(executionAmendment)
    && /all 14 milestones, all 27 binary acceptance criteria/.test(executionAmendment)
    && /no-commit, no-push, no-deploy/.test(executionAmendment),
  "engineering owns execution; product judgment and protected boundaries remain Founder-controlled",
);
check(
  "Founder autonomous completion directive is candidate-bound",
  /^# D1-UXR-002-AUTONOMOUS-COMPLETION-DIRECTIVE-001$/m.test(completionDirective)
    && /a78a1ece0f0f2f67c599e6f8c65f8d164fc232f575a66c3fda23040608cdb0b2/.test(completionDirective)
    && /all 14 frozen milestones and all 27 binary acceptance criteria/.test(completionDirective)
    && /RELEASE_DECISION_READY/.test(completionDirective)
    && /no-commit, no-push,[\s\S]*no-deploy/.test(completionDirective),
  "implement, integrate, validate, harden, and prepare release without crossing protected authority",
);
const manifest = JSON.parse(text("matrix/app-manifest.json"));
check("Matrix App Mode is non-iframe", manifest.usesIframe === false && !/createElement\(["']iframe/i.test(text("matrix/timeline-app-mode.js")), manifest.mode);
check("Matrix owns authentication", manifest.authenticationAuthority === "MATRIX", manifest.authenticationAuthority);
check("Matrix host integration is authority-blocked", manifest.hostIntegrationStatus === "BLOCKED_BY_MATRIX_AUTHORITY", manifest.hostIntegrationStatus);
check("hybrid persistence injection is explicit", /window\.D1_PERSISTENCE_ADAPTER/.test(text("web/js/product-409.js")), "global adapter injection point");

const flags = JSON.parse(text("release/feature-flags.json"));
const requiredFlags = [
  "matrix.timeline_app_mode.enabled",
  "timeline.api.enabled",
  "timeline.remote_sync.enabled",
  "timeline.private_storage.enabled",
  "timeline.mac_pro_export.enabled",
  "timeline.filevault_legacy.enabled",
  "timeline.filevault_v2.enabled",
  "timeline.faculty_access.enabled",
  "timeline.break_glass.enabled",
  "timeline.cloud_ocr.enabled",
];
check("all mandatory release flags exist and default false", requiredFlags.every((name) => flags[name] === false), `${requiredFlags.length} required flags`);

const sql = text("database/migrations/202607150001_timeline_v1.sql");
const rlsCount = (sql.match(/enable row level security/gi) || []).length;
check("RLS coverage", rlsCount === 19, `${rlsCount}/19 protected tables`);
check("public database access revoked", /revoke all on all tables in schema timeline from public/i.test(sql), "revoke present");
check("no permissive RLS policy", !/using\s*\(\s*true\s*\)/i.test(sql), "no USING (true)");

const source = [
  text("src/api/http-api.ts"),
  text("src/storage/private-object-store.ts"),
  text("src/telemetry/telemetry.ts"),
  text("matrix/timeline-app-mode.js"),
  text("src/export/staging/mac-pro-renderer-staging.ts"),
  text("src/filevault/staging/legacy-filevault-staging.ts"),
  text("src/identity/staging/matrix-session.ts"),
  text("src/persistence/staging-hybrid.ts"),
  text("src/storage/staging/staging-private-object-store.ts"),
].join("\n");
check("no embedded production endpoint", !/https?:\/\/(?!private-objects\.invalid|timeline\.local)/i.test(source), "no production URL literals");
check("FileVault v2 disabled by default", /constructor\(\s*readonly enabled = false/.test(text("src/filevault/filevault.ts")), "disabled contract adapter");
check("Mac Pro remains official authority", /MAC_PRO_AUTHORITY/.test(text("src/export/renderer.ts")), "authority contract present");
check("Mac Pro staging worker is explicitly disconnected", /LOCAL_WORKER_SIMULATOR_NOT_CONNECTED/.test(text("src/export/staging/mac-pro-renderer-staging.ts")), "disconnected simulator");
check("legacy FileVault staging adapter is explicitly disconnected", /LOCAL_CONTRACT_FIXTURE_NOT_CONNECTED/.test(text("src/filevault/staging/legacy-filevault-staging.ts")), "disconnected fixture");

const changed = execFileSync("git", ["status", "--short"], { cwd: repo, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const trackedChanges = execFileSync("git", ["diff", "--name-only"], { cwd: repo, encoding: "utf8" }).trim().split("\n").filter(Boolean);
check(
  "no unrelated tracked production file modified",
  trackedChanges.every((path) =>
    path.startsWith("packages/mission-timeline/")
      || path.startsWith("_AI_HANDOFFS/from_codex/D1-404_TIMELINE_407F_UPGRADE/")
      || path.startsWith("_AI_HANDOFFS/from_codex/D1-405_TIMELINE_LAUNCH_REFINEMENT/")
  ),
  trackedChanges.join(", ") || "none",
);
check("nothing staged", execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: repo, encoding: "utf8" }).trim() === "", "staging area empty");

const failed = checks.filter((item) => item.status === "FAIL");
const result = { generatedAt: new Date().toISOString(), package: "@missionmed/mission-timeline", checks, gitStatus: changed, passed: checks.length - failed.length, failed: failed.length };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failed.length) process.exitCode = 1;

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const evidence = "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/413/security_scan_413.json";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".sql", ".ts", ".txt", ".xml", ".yml", ".yaml"]);
const skippedDirectories = new Set(["node_modules"]);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return textExtensions.has(extname(entry.name).toLowerCase()) && statSync(path).size <= 5_000_000 ? [path] : [];
  });
}

const secretPatterns = [
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["stripe_live_key", /sk_live_[A-Za-z0-9]{16,}/g],
  ["aws_access_key", /AKIA[0-9A-Z]{16}/g],
  ["github_token", /gh[opurs]_[A-Za-z0-9]{24,}/g],
  ["slack_token", /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ["long_jwt", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g],
];
const browserForbidden = /\b(?:DATABASE_URL|SUPABASE_SERVICE_ROLE(?:_KEY)?|AWS_SECRET_ACCESS_KEY|TIMELINE_TOKEN_SECRET|TIMELINE_OBJECT_SIGNING_SECRET|D1_MAC_PRO_(?:ENVELOPE|WORKER)_SECRET)\b/g;
const urlPattern = /https?:\/\/[^\s"'`<>)}]+/g;
const allowedHosts = new Set(["127.0.0.1", "localhost", "timeline.local", "matrix.missionmed.test", "signed.invalid", "www.apache.org", "www.w3.org"]);

const secretFindings = [];
const browserSecretFindings = [];
const externalUrlFindings = [];
for (const path of files(root)) {
  const name = relative(root, path);
  const content = readFileSync(path, "utf8");
  for (const [kind, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) secretFindings.push({ file: name, kind, offset: match.index });
  }
  if (name.startsWith("web/") || name.startsWith("matrix/")) {
    browserForbidden.lastIndex = 0;
    for (const match of content.matchAll(browserForbidden)) browserSecretFindings.push({ file: name, name: match[0], offset: match.index });
    // Vendored PDF.js namespace strings and JSON Schema identifiers are not runtime request targets.
    if (!name.startsWith("web/vendor/") && !name.startsWith("web/docs/")) {
      urlPattern.lastIndex = 0;
      for (const match of content.matchAll(urlPattern)) {
        try {
          const url = new URL(match[0]);
          if (!allowedHosts.has(url.hostname) && !url.hostname.endsWith(".test") && !url.hostname.endsWith(".invalid")) {
            externalUrlFindings.push({ file: name, host: url.hostname, offset: match.index });
          }
        } catch {}
      }
    }
  }
}

const flagsPath = join(root, "release/feature-flags.json");
const flags = JSON.parse(readFileSync(flagsPath, "utf8"));
const enabledFlags = Object.entries(flags).filter(([, enabled]) => enabled !== false).map(([name, value]) => ({ name, value }));
const webIndexPath = join(root, "web/index.html");
const webIndexSha256 = createHash("sha256").update(readFileSync(webIndexPath)).digest("hex");
const expectedWebIndexSha256 = "d93f31663946b4284397c87a6ae367e4d12942f69d2638265db7e1074602b1ef";

const result = {
  schemaVersion: "d1-security-scan-413.1",
  generatedAt: new Date().toISOString(),
  scope: root,
  scannedTextFiles: files(root).length,
  secretFindings,
  browserSecretFindings,
  externalUrlFindings,
  featureFlags: flags,
  enabledFlags,
  webIndexSha256,
  expectedWebIndexSha256,
  checks: {
    noCredentialPattern: secretFindings.length === 0,
    noBrowserSecretName: browserSecretFindings.length === 0,
    noUnexpectedBrowserEndpoint: externalUrlFindings.length === 0,
    allFeatureFlagsFalse: enabledFlags.length === 0,
    d1ReleaseEntryTraceable: webIndexSha256 === expectedWebIndexSha256,
  },
};
result.status = Object.values(result.checks).every(Boolean) ? "PASS" : "FAIL";
writeFileSync(evidence, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, checks: result.checks })}\n`);
if (result.status !== "PASS") process.exitCode = 1;

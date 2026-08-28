import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const riseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(riseRoot, "..");
const lockPath = path.join(
  workspaceRoot,
  "_UI_LOCKS/RISE_FABLE_5002_FOUNDER_APPROVED/source/RISE_NEXTGEN_FABLE_FOUNDER_SHELL.html",
);
const expectedLockSha256 = "1e1a16aa630449c9e763a04f6f720b51df0afa46822044de165687d7f8758987";

test("production shell is mechanically derived from the immutable Fable 5002 lock", async () => {
  const lockedBytes = await fs.readFile(lockPath);
  assert.equal(createHash("sha256").update(lockedBytes).digest("hex"), expectedLockSha256);
  const locked = lockedBytes.toString("utf8");
  const style = locked.match(/<style>\n([\s\S]*?)\n<\/style>/)?.[1];
  assert.ok(style);
  assert.equal(await fs.readFile(path.join(riseRoot, "web/styles.css"), "utf8"), `${style.replace(/\n+$/, "")}\n`);

  const productionHtml = await fs.readFile(path.join(riseRoot, "web/index.html"), "utf8");
  assert.match(productionHtml, /Founder-approved Fable 5002 · Production data/);
  assert.match(productionHtml, /<script type="module" src="\/rise\/app\.js"><\/script>/);
  assert.match(productionHtml, /<link rel="stylesheet" href="\/rise\/styles\.css">/);
  assert.doesNotMatch(productionHtml, /window\.RISE_DATA|demo-brookdale|Ignacio/);
});

test("student bundle excludes representative medical facts and unsafe production fallbacks", async () => {
  const app = await fs.readFile(path.join(riseRoot, "web/app.js"), "utf8");
  for (const forbidden of [
    "demo-brookdale",
    "Ignacio",
    "495 alumni",
    "IMG 61%",
    "61% of 28",
    "Viren Kaul",
    "Representative preview",
    "Math.random",
    "localStorage",
    "window.RISE_DATA",
  ]) {
    assert.equal(app.includes(forbidden), false, `student bundle contains ${forbidden}`);
  }
  assert.match(app, /\/api\/rise\/v1\/me\/programs/);
  assert.match(app, /Needs more verified data — fit is not forced/);
  assert.match(app, /Research submission is disabled/);
  assert.doesNotMatch(app, /hashN\(/);
});

test("Fable preservation landmarks remain in production markup and styles", async () => {
  const html = await fs.readFile(path.join(riseRoot, "web/index.html"), "utf8");
  const css = await fs.readFile(path.join(riseRoot, "web/styles.css"), "utf8");
  for (const landmark of ["id=\"hdr\"", "id=\"rail\"", "id=\"main\"", "id=\"file\"", "id=\"srcPanel\"", "id=\"filterDrawer\""]) {
    assert.ok(html.includes(landmark), `missing ${landmark}`);
  }
  for (const token of ["--em:#ffb340", "--em2:#ff7a3d", "--hdr:64px", "--rail:232px", ".heroCapture", ".tabStrip", ".stateTag"]) {
    assert.ok(css.includes(token), `missing ${token}`);
  }
});

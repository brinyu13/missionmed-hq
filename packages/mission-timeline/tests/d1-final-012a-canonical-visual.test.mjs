import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);
const presentation=new URL("web/presentation/d1-409h-a1/",root);
const fixture=JSON.parse(await readFile(new URL("tests/fixtures/d1-409h-canonical-visual-golden.json",root),"utf8"));
const sha256=(bytes)=>createHash("sha256").update(bytes).digest("hex");

test("012A canonical visual fingerprint binds the Founder-approved 1920x1080 landscape authority",()=>{
  assert.equal(fixture.schemaVersion,"d1-409h-canonical-visual-golden/1");
  assert.deepEqual(
    [fixture.authority.presentation,fixture.authority.founderReference,fixture.authority.orientation],
    ["D1-409H-A1","407G Preview 6","landscape"]
  );
  assert.deepEqual([fixture.authority.width,fixture.authority.height],[1920,1080]);
  assert.match(fixture.cleanFixture.normalizedVisualDigestSha256,/^[a-f0-9]{64}$/);
  assert.ok(fixture.cleanFixture.minimumPngSimilarity>=0.97);
  assert.equal(fixture.cleanFixture.renderedColorKeyRows,5);
  assert.deepEqual(fixture.nonAuthorityFixtures,["Brian RC1 Canary","torture fixture"]);
});

test("012A protected presentation bytes and denim board remain exactly sealed",async()=>{
  for(const [name,expected] of Object.entries(fixture.protectedSource)){
    assert.equal(sha256(await readFile(new URL(name,presentation))),expected,name);
  }
  const css=await readFile(new URL("D1-409H_VISUAL_MASTER.css",presentation),"utf8");
  assert.match(css,/#board\s*\{[\s\S]*?width:1920px;height:1080px;overflow:hidden;/);
  assert.match(css,/background:url\('assets\/tex\/board_denim\.jpg'\) 0 0\/1920px 1080px no-repeat;/);
  const protectedManifest=JSON.parse(await readFile(new URL("D1-411A_PROTECTED_HASH_MANIFEST.json",presentation),"utf8"));
  for(const entry of protectedManifest.protectedFiles){
    assert.equal(entry.afterSha256,fixture.protectedSource[entry.path],entry.path);
  }
});

test("012A release requires the protected background and preserves its accepted hash",async()=>{
  const [builder,checker,release]=await Promise.all([
    readFile(new URL("scripts/build-static.mjs",root),"utf8"),
    readFile(new URL("scripts/check-release.mjs",root),"utf8"),
    readFile(new URL("dist/release-manifest.json",root),"utf8").then(JSON.parse)
  ]);
  assert.match(builder,/"board_denim\.jpg"/);
  assert.match(checker,/"board_denim\.jpg"/);
  assert.match(checker,/RELEASE_CORE_TEXTURE_MISSING/);
  const asset=release.files[fixture.acceptedEvidence.background];
  assert.ok(asset?.bytes>0);
  assert.equal(asset.sha256,fixture.acceptedEvidence.backgroundSha256);
});

test("012A Export preview is constrained to its responsive grid track instead of cropping the 1920px kernel",async()=>{
  const css=await readFile(new URL("web/styles/407f-upgrade.css",root),"utf8");
  assert.match(css,/\.export407FHost \.export-preview-panel\s*\{[\s\S]*?min-width:0;[\s\S]*?overflow:hidden;/);
  assert.match(css,/\.export407FHost \.export-preview-content\s*\{[\s\S]*?min-width:0;[\s\S]*?width:100%;/);
  assert.match(css,/\.export407FHost \.export-preview-content>d1-timeline-kernel\s*\{[\s\S]*?max-width:100%;[\s\S]*?min-width:0;/);
});

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  buildImagePdf,
  fitImageToPage
} from "../web/js/export/pdf-writer.js";
import {exportPdfPageDimensions} from "../web/js/d1-411a/kernel-host.js";

test("RC1 centers the canonical 16:9 board on true Letter and A4 landscape pages",()=>{
  assert.deepEqual(exportPdfPageDimensions({page:{name:"Letter"}}),{
    pageWidth:792,
    pageHeight:612
  });
  assert.deepEqual(exportPdfPageDimensions({page:{name:"A4"}}),{
    pageWidth:841.89,
    pageHeight:595.28
  });
  assert.deepEqual(fitImageToPage({
    pixelWidth:1920,
    pixelHeight:1080,
    pageWidth:792,
    pageHeight:612
  }),{
    x:0,
    y:83.25,
    width:792,
    height:445.5
  });
  const a4=fitImageToPage({
    pixelWidth:1920,
    pixelHeight:1080,
    pageWidth:841.89,
    pageHeight:595.28
  });
  assert.equal(a4.x,0);
  assert.ok(Math.abs(a4.y-60.8584375)<1e-9);
  assert.equal(a4.width,841.89);
  assert.ok(Math.abs(a4.height-473.563125)<1e-9);
});

test("RC1 PDF writer preserves board geometry instead of stretching to the paper aspect ratio",async()=>{
  const blob=await buildImagePdf([{
    jpegBytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),
    pixelWidth:1920,
    pixelHeight:1080,
    pageWidth:792,
    pageHeight:612
  }]);
  const text=new TextDecoder("latin1").decode(await blob.arrayBuffer());
  assert.match(text,/\/MediaBox \[0 0 792 612\]/);
  assert.match(text,/792 0 0 445\.5 0 83\.25 cm/);
  assert.doesNotMatch(text,/792 0 0 612 0 0 cm/);
});

test("RC1 WordPress runtime makes the protected capture stylesheet self-contained",async()=>{
  const source=await readFile(new URL(
    "../scripts/build-wordpress-runtime.mjs",
    import.meta.url
  ),"utf8");
  assert.match(source,/protectedStylesheetPath="presentation\/d1-409h-a1\/D1-409H_VISUAL_MASTER\.css"/);
  assert.match(source,/protectedCaptureStylesheetAsset=addAsset/);
  assert.match(source,/target===protectedStylesheetPath\s*\?protectedCaptureStylesheetAsset/);
  assert.match(source,/url\("data:\$\{source\.contentType\};base64,\$\{source\.bytes\.toString\("base64"\)\}"\)/);
});

test("RC1 Builder preview replacement is keyed to visual state, not save timestamps",async()=>{
  const source=await readFile(new URL(
    "../web/js/407f-engineering-adapter.js",
    import.meta.url
  ),"utf8");
  const mount=source.match(/const mountBuilderPreview=\(host,[\s\S]*?\n  const renderBuilderEmbeddedPreview=/)?.[0]||"";
  assert.match(mount,/timelineRenderSignature\(store\.document\)/);
  assert.doesNotMatch(mount,/store\.document\?\.updatedAt/);
});

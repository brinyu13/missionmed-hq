import assert from "node:assert/strict";
import test from "node:test";

import {createLocalExportAdapter} from "../web/js/uxr-002/export-adapter.js";

test("local export adapter declares the exact no-network browser boundary",()=>{
  const adapter=createLocalExportAdapter();
  assert.equal(adapter.executionMode,"local");
  assert.equal(adapter.metadata.externalApiCalls,false);
  assert.equal(adapter.metadata.productionWrites,false);
  assert.equal(adapter.metadata.renderer,"D1-UXR-002-Keynote-Classic");
});

test("local export adapter refuses an unverifiable download payload",async()=>{
  const adapter=createLocalExportAdapter({
    triggerDownload:()=>({downloaded:false,verification:"test-refusal"})
  });
  await assert.rejects(
    ()=>adapter.download({blob:"not-a-blob"},{filename:"timeline.png"}),
    /local Blob/
  );
});

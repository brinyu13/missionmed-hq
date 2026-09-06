import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {timelineWithLorPresentation} from "../web/js/407f-engineering-adapter.js";
import {
  activeSpecialtyVariant,
  applyActiveSpecialtyVariant,
  createSpecialtyVariant,
  ensureSpecialtyVariants,
  removeSpecialtyVariant,
  renameSpecialtyVariant,
  setVariantEventHidden,
  switchSpecialtyVariant
} from "../web/js/uxr-002/specialty-variants.js";

function fixture(){
  return{
    id:"timeline-one",
    studentProfile:{
      fullName:"Avery Student",
      specialtyGoal:"Internal Medicine"
    },
    builder:{
      targetSpecialtyId:"acgme:internal-medicine",
      targetSpecialtyLabel:"Internal Medicine"
    },
    events:[
      {
        id:"rotation-one",
        title:"Internal Medicine Rotation",
        categoryId:"clinical",
        eventType:"duration",
        startDate:"2026-01",
        endDate:"2026-02",
        visibilityState:"INTERVIEWER_SAFE",
        fields:{
          builderEntryId:"rotation-one",
          lorStatusesByTarget:{
            "acgme:internal-medicine":"submitted-to-eras",
            "acgme:pediatrics":"requested"
          }
        }
      },
      {
        id:"research-one",
        title:"Research",
        categoryId:"research",
        eventType:"duration",
        startDate:"2025-01",
        endDate:"2025-08",
        visibilityState:"ADVISOR_ONLY",
        fields:{}
      }
    ]
  };
}

test("M8 migrates legacy target specialty into one normalized variant",()=>{
  const document=fixture();
  const state=ensureSpecialtyVariants(document);
  assert.equal(state.variants.length,1);
  assert.equal(activeSpecialtyVariant(document).specialty.label,"Internal Medicine");
  assert.equal(state.schemaVersion,"d1-405.specialty-variants.1");
});

test("M8 creates and switches specialty presentation without duplicating factual history",()=>{
  const document=fixture();
  ensureSpecialtyVariants(document);
  const facts=structuredClone(document.events);
  const created=createSpecialtyVariant(document,{
    specialtyLabel:"Pediatrics",
    specialtyId:"acgme:pediatrics"
  });
  assert.equal(created.ok,true);
  assert.equal(document.events.length,2);
  assert.deepEqual(document.events,facts);
  assert.equal(activeSpecialtyVariant(document).specialty.label,"Pediatrics");
  assert.equal(switchSpecialtyVariant(
    document,
    "specialty-variant:internal-medicine"
  ).ok,true);
  assert.deepEqual(document.events,facts);
});

test("M8 keeps rename and guarded remove inside variant configuration",()=>{
  const document=fixture();
  ensureSpecialtyVariants(document);
  const first=activeSpecialtyVariant(document);
  assert.equal(renameSpecialtyVariant(
    document,
    first.id,
    "IM residency timeline"
  ).variant.name,"IM residency timeline");
  assert.equal(
    removeSpecialtyVariant(document,first.id,{confirmed:true}).code,
    "LAST_SPECIALTY_VARIANT"
  );
  createSpecialtyVariant(document,{
    specialtyLabel:"Family Medicine",
    specialtyId:"acgme:family-medicine"
  });
  assert.equal(
    removeSpecialtyVariant(document,first.id).code,
    "CONFIRMATION_REQUIRED"
  );
  assert.equal(
    removeSpecialtyVariant(document,first.id,{confirmed:true}).ok,
    true
  );
  assert.equal(document.events.length,2);
});

test("M8 applies specialty visibility as a nonmutating presentation projection",()=>{
  const document=fixture();
  ensureSpecialtyVariants(document);
  const variant=activeSpecialtyVariant(document);
  const before=structuredClone(document);
  assert.equal(
    setVariantEventHidden(document,variant.id,"research-one",true).ok,
    true
  );
  const canonicalAfterConfiguration=structuredClone(document);
  const projected=applyActiveSpecialtyVariant(document);
  assert.deepEqual(projected.events.map(({id})=>id),["rotation-one"]);
  assert.deepEqual(document,canonicalAfterConfiguration);
  assert.deepEqual(
    document.events,
    before.events,
    "variant visibility must never alter global factual events"
  );
  assert.equal(
    document.events.find(({id})=>id==="research-one").visibilityState,
    "ADVISOR_ONLY",
    "variant configuration must not elevate source visibility"
  );
});

test("M8 changes the rotation LOR star immediately with active specialty",()=>{
  const document=fixture();
  ensureSpecialtyVariants(document);
  assert.equal(
    timelineWithLorPresentation(document).events[0].fields.lorSubmitted,
    true
  );
  const pediatrics=createSpecialtyVariant(document,{
    specialtyLabel:"Pediatrics",
    specialtyId:"acgme:pediatrics"
  });
  assert.equal(pediatrics.ok,true);
  assert.equal(
    timelineWithLorPresentation(document).events[0].fields.lorSubmitted,
    undefined
  );
  switchSpecialtyVariant(document,"specialty-variant:internal-medicine");
  assert.equal(
    timelineWithLorPresentation(document).events[0].fields.lorSubmitted,
    true
  );
});

test("M8 makes export consume the active specialty projection",async()=>{
  const source=await readFile(
    new URL("../web/js/407f-engineering-adapter.js",import.meta.url),
    "utf8"
  );
  assert.match(
    source,
    /const exportDocument=timelineWithLorPresentation\(store\.document\)/
  );
  assert.match(source,/buildExportPreviewInput\(exportDocument,exportState\)/);
  assert.match(source,/installExportScreen\(exportHost,exportDocument,/);
});

test("M8 exposes the prominent Builder selector and guarded management workflow",async()=>{
  const [html,source,css]=await Promise.all([
    readFile(new URL("../web/index.html",import.meta.url),"utf8"),
    readFile(
      new URL("../web/js/407f-engineering-adapter.js",import.meta.url),
      "utf8"
    ),
    readFile(new URL("../web/styles/407f-upgrade.css",import.meta.url),"utf8")
  ]);
  assert.match(html,/id="builderVariantBar"/);
  assert.match(source,/ACTIVE SPECIALTY TIMELINE/);
  assert.match(source,/\+ NEW SPECIALTY TIMELINE/);
  assert.match(source,/Rename specialty timeline/);
  assert.match(source,/Only this specialty’s presentation settings are removed/);
  assert.match(source,/data-canvas-variant-visible/);
  assert.match(source,/specialtyVariantTrap=installFocusTrap\(dialog,\{/);
  assert.match(source,/previewBackgroundInert\(true\)/);
  assert.match(source,/refreshSpecialtyVariantSurfaces\(\{restoreSelectFocus:true\}\)/);
  assert.match(source,/event\.target\?\.id!=="modalBk"[\s\S]*?closeSpecialtyVariantDialog\(\)/);
  assert.match(css,/\.builderVariantBar\{/);
  assert.match(css,/\.builderVariantSignal\{/);
  assert.match(css,/\.builderVariantManage:disabled\{[\s\S]*?cursor:not-allowed;[\s\S]*?opacity:\.42;/);
});

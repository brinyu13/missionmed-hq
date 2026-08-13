import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  PINNED_ROTATION_SPECIALTIES,
  normalizeSpecialtyId,
  rankSpecialtyMatches,
  specialtyOption
} from "../web/js/uxr-002/specialty-taxonomy.js";
import {
  eventFromBuilderEntry,
  typeaheadRows
} from "../web/js/uxr-002/builder.js";

const index=await readFile(
  new URL("../web/index.html",import.meta.url),
  "utf8"
);

test("M7 pins the ten founder-specified common specialties in alphabetical order",()=>{
  assert.deepEqual(PINNED_ROTATION_SPECIALTIES,[
    "Anesthesiology",
    "Diagnostic Radiology",
    "Family Medicine",
    "General Surgery",
    "Internal Medicine",
    "Interventional Radiology",
    "Neurology",
    "Obstetrics and Gynecology",
    "Pediatrics",
    "Psychiatry"
  ]);
  const matches=[
    "Vascular Surgery",
    "Pediatrics",
    "Internal Medicine",
    "Anesthesiology",
    "Dermatology"
  ].map(specialtyOption);
  assert.deepEqual(
    rankSpecialtyMatches(matches).map(({value})=>value),
    [
      "Anesthesiology",
      "Internal Medicine",
      "Pediatrics",
      "Dermatology",
      "Vascular Surgery"
    ]
  );
});

test("M7 stores a stable normalized specialty ID with the factual rotation",()=>{
  assert.equal(
    normalizeSpecialtyId("Obstetrics and Gynecology"),
    "acgme:obstetrics-and-gynecology"
  );
  const event=eventFromBuilderEntry("clinical",{
    institution:"Bellevue Hospital Center",
    specialty:"Internal Medicine",
    rotationType:"Observership",
    rotationStartDate:"2025-06-09",
    rotationEndDate:"2025-07-04",
    rotationDatePrecision:"day"
  },{entryId:"rotation-1",eventId:"event-1"});
  assert.equal(event.fields.specialtyId,"acgme:internal-medicine");
});

test("M7 specialty selector opens with pinned choices and prohibits unsupported free text",()=>{
  const rows=typeaheadRows("",[
    specialtyOption("Anesthesiology"),
    specialtyOption("Internal Medicine")
  ],{
    allowFreeText:false,
    limit:12,
    minQueryLength:0
  });
  assert.equal(rows.length,2);
  assert.equal(rows.every(({kind})=>kind==="match"),true);
  assert.match(
    index,
    /domainTypeahead404\('Specialty','specialty',draft\.specialty,'specialties',\{required:true,allowFreeText:false\}\)/
  );
  assert.match(index,/builderTypeaheadPinned/);
  assert.match(index,/changes\.specialtyId=/);
});

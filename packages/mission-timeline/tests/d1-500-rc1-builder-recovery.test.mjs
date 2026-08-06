import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  PERSONAL_EVENT_PRESETS,
  countryFlag,
  eventFromBuilderEntry,
  validateBuilderEntry
} from "../web/js/uxr-002/builder.js";
import {createSpecialtyProvider} from "../web/js/uxr-002/datasets.js";

const adapter=await readFile(
  new URL("../web/js/407f-engineering-adapter.js",import.meta.url),
  "utf8"
);

test("RC1 Builder exposes truthful save, finish-later, Home progress, and exact-resume controls",()=>{
  assert.match(adapter,/SAVE AND CONTINUE/);
  assert.match(adapter,/data-builder-finish-later/);
  assert.match(adapter,/BUILDER_FINISH_LATER/);
  assert.match(adapter,/store\.adapter\?\.flush/);
  assert.match(adapter,/homeCompletion407F/);
  assert.match(adapter,/Next recommended:/);
  assert.match(adapter,/resumeStep/);
});

test("RC1 Personal events support governed presets, ranges, ongoing state, countries, flags, and privacy",()=>{
  assert.ok(PERSONAL_EVENT_PRESETS.includes("Moved to the United States"));
  assert.equal(countryFlag("GH"),"🇬🇭");
  assert.deepEqual(
    validateBuilderEntry("personal",{
      happened:"Moved to the United States",
      whenKind:"Date range",
      startDate:"2025-05",
      endDate:"2025-04",
      toCountry:"United States"
    }),
    {endDate:"End date is before the start date."}
  );
  const event=eventFromBuilderEntry("personal",{
    happened:"Moved to the United States",
    whenKind:"Date range",
    startDate:"2025-05",
    ongoing:true,
    fromCountry:"Ghana",
    fromCountryCode:"GH",
    toCountry:"United States",
    toCountryCode:"US",
    icon:"plane",
    iconStyle:"Monochrome",
    visibilityState:"ADVISOR_ONLY"
  },{entryId:"personal-1",eventId:"event-1"});
  assert.equal(event.openEnded,true);
  assert.equal(event.fields.fromCountryFlag,"🇬🇭");
  assert.equal(event.fields.toCountryFlag,"🇺🇸");
  assert.equal(event.fields.iconStyle,"Monochrome");
  assert.equal(event.visibilityState,"ADVISOR_ONLY");
});

test("RC1 specialty provider opens with common residency choices and searches the complete local taxonomy",async()=>{
  const provider=createSpecialtyProvider();
  const common=await provider.search("");
  assert.equal(common[0].value,"Internal Medicine");
  assert.ok(common.some(({value})=>value==="Emergency Medicine"));
  const specific=await provider.search("abdominal radiology");
  assert.equal(specific[0].value,"Abdominal Radiology");
});

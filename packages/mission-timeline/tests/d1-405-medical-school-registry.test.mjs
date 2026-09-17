import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  createMedicalSchoolProvider,
  createUnverifiedSchoolSubmission,
  normalizeSchoolRecord,
  searchMedicalSchools
} from "../web/js/uxr-002/medical-school-registry.js";
import {
  needsResidencyVisaQuestion,
  syncEducationMilestone,
  validateCoreInfo
} from "../web/js/uxr-002/builder.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const payload=JSON.parse(await readFile(
  new URL("../web/data/medical-schools/us-dapip-2026-07-30.json",import.meta.url),
  "utf8"
));
const externalManifest=JSON.parse(await readFile(
  new URL("../web/data/medical-schools/manifest.json",import.meta.url),
  "utf8"
));
const index=await readFile(new URL("../web/index.html",import.meta.url),"utf8");
const css=await readFile(
  new URL("../web/styles/407f-upgrade.css",import.meta.url),
  "utf8"
);

test("M6 bundled registry is a bounded DAPIP U.S. MD/DO snapshot with complete canonical fields",()=>{
  assert.equal(payload.manifest.dataset_version,"us-dapip-2026-07-30");
  assert.equal(payload.manifest.schema_version,2);
  assert.equal(payload.manifest.coverage.record_count,payload.records.length);
  assert.ok(payload.records.length>=190);
  assert.deepEqual(payload.manifest.coverage.countries,["United States"]);
  assert.deepEqual(payload.manifest.coverage.school_types,["MD","DO"]);
  const required=[
    "canonical_school_id",
    "canonical_name",
    "alternate_names",
    "country",
    "state_or_region",
    "city",
    "school_type",
    "source",
    "source_identifier",
    "source_url_or_reference",
    "active_status_if_known"
  ];
  for(const record of payload.records){
    for(const field of required)assert.ok(
      Object.hasOwn(record,field),
      `${record.canonical_school_id} missing ${field}`
    );
    assert.match(
      record.canonical_school_id,
      /^mm-school-us-dapip-unit-\d+-(program-(78|52)|agency-(46|48)-program-unconfirmed)$/
    );
    assert.equal(record.country,"United States");
    assert.ok(["MD","DO"].includes(record.school_type));
    assert.equal(record.source,"U.S. Department of Education DAPIP");
    assert.ok(record.parent_institution_name);
    assert.ok(record.program_name);
    assert.ok([
      "normalized",
      "review-needed",
      "crosswalk-review-needed"
    ].includes(record.display_name_status));
    assert.equal(
      record.alternate_names.every((alias)=>alias.length<=100),
      true
    );
    if(record.verification_status==="source-reported-agency"){
      assert.equal(record.analytics_eligible,false);
      assert.equal(record.program_id,null);
      assert.match(record.normalization_status,/program/);
    }else{
      assert.equal(record.verification_status,"source-reported-program");
      assert.equal(record.analytics_eligible,
        record.display_name_status==="normalized"&&
        !record.superseded_by_canonical_school_id
      );
      assert.ok(record.program_id);
      assert.ok(record.accreditation_record_id);
    }
  }
  assert.equal(
    JSON.stringify(payload).includes("World Directory of Medical Schools"),
    false,
    "WDOMS-derived content is not bundled"
  );
  assert.equal(payload.manifest.coverage.completeness_status,"not asserted");
  assert.ok(payload.manifest.integrity.records_sha256);
  assert.ok(payload.manifest.integrity.accreditation_response_aggregate_sha256);
  assert.match(
    payload.manifest.integrity.raw_source_snapshot_sha256,
    /^[a-f0-9]{64}$/
  );
  assert.equal(
    externalManifest.integrity.dataset_file,
    "us-dapip-2026-07-30.json"
  );
  assert.match(externalManifest.integrity.dataset_file_sha256,/^[a-f0-9]{64}$/);
  assert.match(payload.manifest.ingestion_tool.sha256,/^[a-f0-9]{64}$/);
  assert.equal(payload.manifest.name_enrichment.license,"Creative Commons CC0 1.0");
  assert.equal(
    payload.records.some((record)=>
      record.alternate_names.some((alias)=>/dental|divinity|hospital/i.test(alias))
    ),
    false,
    "unrelated DAPIP institution aliases are excluded"
  );
});

test("M6 registry search matches aliases, location, country, and MD/DO facets deterministically",()=>{
  const alias=searchMedicalSchools(payload.records,"ACOM",{schoolType:"DO"});
  assert.equal(alias[0].canonical_name,"Alabama College of Osteopathic Medicine");
  assert.equal(alias[0].school_type,"DO");

  const country=searchMedicalSchools(
    payload.records,
    "United States",
    {schoolType:"MD",limit:20}
  );
  assert.equal(country.length,20);
  assert.equal(country.every((record)=>record.school_type==="MD"),true);

  const location=searchMedicalSchools(payload.records,"Albany NY");
  assert.equal(location[0].canonical_name,"Albany Medical College");

  assert.equal(
    searchMedicalSchools(payload.records,"Harvard Medical School")[0]
      .canonical_name,
    "Harvard Medical School"
  );
  assert.equal(
    searchMedicalSchools(payload.records,"MSUCOM")[0].school_type,
    "DO"
  );
  assert.equal(
    searchMedicalSchools(payload.records,"ATSU-KCOM")[0].school_type,
    "DO"
  );

  const georgia=searchMedicalSchools(
    payload.records,
    "Medical College of Georgia"
  );
  assert.equal(georgia.length,1);
  assert.equal(
    georgia[0].canonical_school_id,
    "mm-school-us-dapip-unit-231730-program-78"
  );
  const staleGeorgia=payload.records.find((record)=>
    record.canonical_school_id==="mm-school-us-dapip-unit-111522-program-78"
  );
  assert.equal(staleGeorgia.analytics_eligible,false);
  assert.equal(
    staleGeorgia.superseded_by_canonical_school_id,
    georgia[0].canonical_school_id
  );
});

test("M6 provider lazily loads the local chunk once and exposes source metadata",async()=>{
  let calls=0;
  const provider=createMedicalSchoolProvider({
    fetcher:async()=>{
      calls+=1;
      return payload;
    },
    url:"local-fixture"
  });
  assert.equal(provider.networkRequests,false);
  const first=await provider.search("Baylor",{schoolType:"MD"});
  const second=await provider.search("Alabama",{schoolType:"DO"});
  const metadata=await provider.metadata();
  assert.equal(calls,1);
  assert.equal(first[0].canonical_name,"Baylor College of Medicine");
  assert.equal(second[0].canonical_name,"Alabama College of Osteopathic Medicine");
  assert.equal(metadata.recordCount,payload.records.length);
  assert.equal(metadata.indexKind,"inverted-token-index");
  assert.ok(metadata.indexTokenCount>100);
});

test("M6 unlisted schools are explicit, queued, local-only, and excluded from verified analytics",()=>{
  const submission=createUnverifiedSchoolSubmission({
    name:"Example International Medical School",
    country:"Ghana",
    city:"Accra",
    now:()=>"2026-07-30T12:00:00.000Z",
    idFactory:()=>"fixture-id"
  });
  assert.equal(submission.canonical_school_id,"unverified:fixture-id");
  assert.equal(submission.verification_status,"unverified");
  assert.equal(submission.normalization_status,"queued");
  assert.equal(submission.analytics_eligible,false);
  assert.equal(submission.source_url_or_reference,"LOCAL_ONLY");
  assert.equal(normalizeSchoolRecord(submission).normalization_status,"queued");
});

test("M6 normalization queue persists unresolved school records in the canonical document",()=>{
  const document=defaultDocument();
  const submission=createUnverifiedSchoolSubmission({
    name:"Example International Medical School",
    country:"Ghana",
    city:"Accra",
    idFactory:()=>"durable-queue"
  });
  document.studentProfile={
    ...document.studentProfile,
    medicalSchool:submission.canonical_name,
    canonicalSchoolId:submission.canonical_school_id,
    medicalSchoolRecord:submission,
    medicalSchoolCountry:submission.country,
    graduationDate:"2028-06"
  };
  syncEducationMilestone(document);
  assert.equal(document.medicalSchoolNormalizationQueue.length,1);
  assert.equal(
    document.medicalSchoolNormalizationQueue[0].canonical_school_id,
    submission.canonical_school_id
  );
  assert.equal(
    document.medicalSchoolNormalizationQueue[0].queue_status,
    "pending-local-review"
  );
  assert.equal(
    document.medicalSchoolNormalizationQueue[0].analytics_eligible,
    false
  );
});

test("M6 work-authorization conditions exempt only Citizen, permanent resident, and active unrestricted EAD",()=>{
  assert.equal(needsResidencyVisaQuestion({
    currentUsWorkAuthorization:"U.S. Citizen"
  }),false);
  assert.equal(needsResidencyVisaQuestion({
    currentUsWorkAuthorization:"Permanent Resident / Green Card"
  }),false);
  assert.equal(needsResidencyVisaQuestion({
    currentUsWorkAuthorization:"Employment Authorization Document",
    eadStatus:"Active and unrestricted"
  }),false);
  assert.equal(needsResidencyVisaQuestion({
    currentUsWorkAuthorization:"Employment Authorization Document",
    eadStatus:"Not sure"
  }),true);
  assert.equal(needsResidencyVisaQuestion({
    currentUsWorkAuthorization:"F-1"
  }),true);
  assert.equal(validateCoreInfo({
    fullName:"Amara",
    medicalSchool:"Albany Medical College",
    canonicalSchoolId:"mm-school-us-dapip-46-129312",
    medicalSchoolCountry:"United States",
    graduationDate:"2026-05",
    degree:"MD",
    currentUsWorkAuthorization:"F-1"
  }).residencyVisaTypesOpenTo,"Required.");
});

test("M6 registry and work-authorization UI use one accessible focus model",()=>{
  assert.match(
    index,
    /<ul id="schoolRegistryOptions407F" class="schoolRegistryOptions" role="listbox" hidden><\/ul>'\s*\+'<div class="schoolRegistryStatus" id="schoolRegistryStatus407F" role="status" aria-live="polite"/
  );
  assert.match(
    index,
    /'<li role="option" tabindex="-1" data-school-choice="'\+index\+'"/
  );
  assert.doesNotMatch(index,/<button[^>]+data-school-choice/);
  assert.match(index,/schoolRegistryActive404=-1;/);
  assert.match(index,/restoreBuilderCoreFocus404\(key,announcement\)/);
  assert.match(
    index,
    /data-core="residencyVisaTypesOpenTo" aria-describedby="residencyVisaError407F"/
  );
  assert.match(
    index,
    /if\(!valid&&focusInvalid&&firstInvalid&&!\$\('#modalBk'\)\.classList\.contains\('on'\)\)\{[\s\S]*firstInvalid\.focus\(\)/
  );
  assert.match(css,/max-height:min\(240px,35dvh\)/);
});

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {createMedicalSchoolProvider,searchMedicalSchools,schoolSelectionExclusion} from "../web/js/uxr-002/medical-school-registry.js";
import {createCountryProvider} from "../web/js/uxr-002/datasets.js";
import {installTypeahead,renderBuilder,validateCoreInfo} from "../web/js/uxr-002/builder.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const files=["us-dapip-2026-07-30.json","global-wikidata-2026-08-24.json","global-img-supplement-2026-09-05.json"];
const payloads=await Promise.all(files.map(async name=>JSON.parse(await readFile(new URL(`../web/data/medical-schools/${name}`,import.meta.url),"utf8"))));
const provider=()=>createMedicalSchoolProvider({urls:files,fetcher:async name=>payloads[files.indexOf(name)]});

test("school country filters accept country names and common codes consistently",async()=>{
  const schools=provider();
  assert.deepEqual((await schools.search("medical",{country:"China"})).map(r=>r.id),(await schools.search("medical",{country:"CN"})).map(r=>r.id));
  assert.ok((await schools.search("Oxford",{country:"UK"})).length);
  const countries=createCountryProvider();
  for(const [query,code] of [["US","US"],["USA","US"],["UK","GB"],["UAE","AE"],["CN","CN"]])assert.equal((await countries.search(query))[0]?.code,code);
});

test("search preserves non-Latin source aliases instead of erasing the query",()=>{
  const rows=[{canonical_school_id:"synthetic-source-only",canonical_name:"Synthetic test institution",alternate_names:["架空の試験医学校","Синтетическая школа"],country:"Synthetic fixture",city:""}];
  assert.equal(searchMedicalSchools(rows,"架空")[0]?.id,"synthetic-source-only");
  assert.equal(searchMedicalSchools(rows,"Синтетическая")[0]?.id,"synthetic-source-only");
  assert.deepEqual(searchMedicalSchools(rows,"Unrecorded institution"),[]);
});

test("runtime excludes explicit veterinary and non-physician departments while preserving the source bytes",async()=>{
  const before=JSON.stringify(payloads);
  const schools=provider();
  const cairo=await schools.search("Cairo");
  assert.ok(cairo.some(r=>/Kasr Alainy/.test(r.canonical_name)));
  assert.equal(cairo.some(r=>/veterinary/i.test(r.canonical_name)),false);
  assert.equal(schoolSelectionExclusion({canonical_name:"Faculty of Pharmacy of the University of Medicine and Pharmacy"}),"non-physician-program");
  assert.equal(schoolSelectionExclusion({canonical_name:"University Faculty of Medicine and Dentistry"}),"");
  assert.equal(JSON.stringify(payloads),before);
});

test("a failed optional registry source retains good sources and reports partial coverage",async()=>{
  const schools=createMedicalSchoolProvider({urls:["good","failed"],fetcher:async url=>{if(url==="failed")throw new Error("fixture unavailable");return payloads[2];}});
  assert.match((await schools.search("Semmelweis"))[0]?.canonical_name||"",/Semmelweis/);
  const meta=await schools.metadata();
  assert.equal(meta.partial,true);
  assert.equal(meta.sourceErrors.length,1);
  assert.match(meta.error,/1 of 2 local school sources unavailable/);
});

test("selected-school UI distinguishes curated identity and an unknown source city",async()=>{
  const schools=provider();
  const document=defaultDocument();
  const [curated]=await schools.search("Semmelweis");
  document.studentProfile.medicalSchoolRecord=curated;
  const curatedHtml=renderBuilder(document);
  assert.match(curatedHtml,/Curated identity · unverified/);
  assert.match(curatedHtml,/No per-school source reference is attached/);
  const [unknownCity]=await schools.search("Aga Khan University Medical College Pakistan");
  assert.equal(unknownCity.city,"");
  document.studentProfile.medicalSchoolRecord=unknownCity;
  const unknownHtml=renderBuilder(document);
  assert.match(unknownHtml,/City not recorded by source/);
  assert.match(unknownHtml,/Wikidata identity · accreditation unverified/);
  assert.equal(unknownCity.city,"");
  assert.match(unknownCity.label,/Pakistan/);
});

test("result click commits exact school identity once and clears school Required without inventing a city",async()=>{
  const rows=await provider().search("Aga Khan University Medical College Pakistan");
  const listeners=new Map();let buttons=[];
  const input={id:"medicalSchool",value:"Aga Khan University Medical College Pakistan",addEventListener:(name,fn)=>listeners.set(name,fn),setAttribute(){},removeAttribute(){}};
  const list={hidden:true,set innerHTML(html){buttons=[...html.matchAll(/data-typeahead-index="(\d+)"/g)].map((m)=>({dataset:{typeaheadIndex:m[1]},listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);}}));},querySelectorAll:()=>buttons};
  const field={dataset:{typeaheadProvider:"schools",typeaheadContext:"core-school",allowFreeText:"false"},querySelector:selector=>selector.includes("combobox")?input:selector.includes("listbox")?list:null};
  const root={querySelectorAll:()=>[field],querySelector:()=>null};
  const document=defaultDocument();let writes=0;
  const store={document,mutate(_label,fn){writes++;fn(document);}};
  installTypeahead(root,store,{schools:{search:async()=>rows}});
  listeners.get("input")();await new Promise(setImmediate);
  assert.ok(buttons.length);
  const chosen=buttons[0];
  chosen.listeners.get("click")({preventDefault(){}});
  chosen.listeners.get("mousedown")({preventDefault(){}});
  assert.equal(writes,1);
  assert.equal(document.studentProfile.canonicalSchoolId,rows[0].canonical_school_id);
  assert.equal(document.studentProfile.medicalSchoolCountry,"Pakistan");
  assert.equal(document.studentProfile.medicalSchoolCity,"");
  assert.equal(validateCoreInfo(document.studentProfile).medicalSchool,undefined);
});

test("a CV school awaiting lookup is not declared absent from the registry",()=>{
  const document=defaultDocument();
  Object.assign(document.studentProfile,{medicalSchool:"Carol Davila University of Medicine and Pharmacy",medicalSchoolCountry:"Romania",medicalSchoolEntryMode:"unlisted",medicalSchoolVerificationStatus:"unverified-source-claimed"});
  const html=renderBuilder(document);
  assert.match(html,/From your CV — confirm school/);
  assert.match(html,/Find registry match/);
  assert.doesNotMatch(html,/id="school-unlisted-title">School not listed/);
});

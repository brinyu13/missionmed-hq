import {createHash} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";

const ROOT=resolve(import.meta.dirname,"..");
const args=new Map();
for(let index=2;index<process.argv.length;index+=2)args.set(process.argv[index],process.argv[index+1]);
const required=(name)=>{
  const value=args.get(name);
  if(!value)throw new Error(`Missing ${name}`);
  return resolve(value);
};
const schoolsPath=required("--schools-json");
const aliasesPath=required("--aliases-json");
const countryCodesPath=required("--country-codes-json");
const isoTabPath=required("--iso-tab");
const retrievedAt=String(args.get("--retrieved-at")||new Date().toISOString());
const datasetDate=retrievedAt.slice(0,10);
const version=`global-wikidata-${datasetDate}`;
const sha256=(value)=>createHash("sha256").update(value).digest("hex");
const json=async(path)=>JSON.parse(await readFile(path,"utf8"));
const qid=(uri)=>String(uri||"").match(/Q\d+$/)?.[0]||"";
const rebuildQueries={
  schools:`SELECT ?school ?country ?city ?schoolLabel ?countryLabel ?cityLabel WHERE {
  ?school wdt:P31/wdt:P279* wd:Q494230;
          wdt:P17 ?country.
  OPTIONAL { ?school wdt:P131 ?city. }
  FILTER NOT EXISTS { ?school wdt:P576 ?dissolved. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`,
  aliases:`SELECT ?school (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases) WHERE {
  ?school wdt:P31/wdt:P279* wd:Q494230;
          skos:altLabel ?alias.
  FILTER(LANG(?alias) = "en")
} GROUP BY ?school`,
  country_codes:`SELECT ?country ?countryCode ?countryLabel WHERE {
  ?country wdt:P297 ?countryCode.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`
};

const [schoolsRaw,aliasesRaw,countryCodesRaw,isoTab]=await Promise.all([
  readFile(schoolsPath),readFile(aliasesPath),readFile(countryCodesPath),readFile(isoTabPath,"utf8")
]);
const schools=JSON.parse(schoolsRaw);
const aliases=JSON.parse(aliasesRaw);
const countryCodes=JSON.parse(countryCodesRaw);

const aliasesBySchool=new Map((aliases.results?.bindings||[]).map((binding)=>[
  qid(binding.school?.value),
  String(binding.aliases?.value||"").split("|").map((value)=>value.trim()).filter(Boolean)
]));
const codeByCountry=new Map((countryCodes.results?.bindings||[]).map((binding)=>[
  qid(binding.country?.value),String(binding.countryCode?.value||"").toUpperCase()
]));
const countries=isoTab.split(/\r?\n/).filter((line)=>line&&!line.startsWith("#")).map((line)=>{
  const [code,...nameParts]=line.split("\t");
  return{code,name:nameParts.join(" ").trim()};
}).filter(({code,name})=>/^[A-Z]{2}$/.test(code)&&name).sort((a,b)=>a.name.localeCompare(b.name));
if(countries.length!==249)throw new Error(`Expected 249 current ISO alpha-2 rows, found ${countries.length}.`);
const currentIsoCodes=new Set(countries.map(({code})=>code));
const rowsBySchool=new Map();
for(const binding of schools.results?.bindings||[]){
  const schoolQid=qid(binding.school?.value);
  const countryQid=qid(binding.country?.value);
  const canonicalName=String(binding.schoolLabel?.value||"").trim();
  const country=String(binding.countryLabel?.value||"").trim();
  const countryCode=codeByCountry.get(countryQid)||"";
  if(!schoolQid||!countryQid||!canonicalName||canonicalName===schoolQid||!country||country==="United States"||!currentIsoCodes.has(countryCode))continue;
  if(/\b(?:veterinary|nursing|pharmacy|pharmaceutical)\b/i.test(canonicalName)&&!/\b(?:medical|medicine)\b/i.test(canonicalName))continue;
  const current=rowsBySchool.get(schoolQid)||{
    canonical_school_id:`mm-school-wikidata-${schoolQid}`,
    canonical_name:canonicalName,
    alternate_names:[...new Set(aliasesBySchool.get(schoolQid)||[])].filter((name)=>name!==canonicalName).sort(),
    country,
    country_code:countryCode,
    state_or_region:"",
    city:"",
    school_type:"Medical school",
    source:"Wikidata CC0",
    source_identifier:schoolQid,
    source_url_or_reference:`https://www.wikidata.org/wiki/${schoolQid}`,
    accreditation_body:"",
    active_status_if_known:null,
    dataset_version:version,
    verified_at:"",
    verification_status:"wikidata-identity-unverified-accreditation",
    normalization_status:"identity-matched-accreditation-not-asserted",
    analytics_eligible:false,
    wikidata_qid:schoolQid,
    cities:new Set()
  };
  const city=String(binding.cityLabel?.value||"").trim();
  if(city&&!/^Q\d+$/.test(city))current.cities.add(city);
  rowsBySchool.set(schoolQid,current);
}
const records=[...rowsBySchool.values()].map((row)=>{
  const cities=[...row.cities].sort();
  delete row.cities;
  return{...row,city:cities[0]||"",alternate_cities:cities.slice(1)};
}).sort((left,right)=>left.country.localeCompare(right.country)||left.canonical_name.localeCompare(right.canonical_name));
const coveredCountries=[...new Set(records.map(({country})=>country))].sort();
const recordsText=JSON.stringify(records);
const manifest={
  schema_version:1,
  dataset_version:version,
  retrieved_at:retrievedAt,
  coverage:{
    record_count:records.length,
    country_count:coveredCountries.length,
    countries:coveredCountries,
    excludes_united_states:true,
    completeness_status:"not asserted"
  },
  source:{
    name:"Wikidata",
    query_service:"https://query.wikidata.org/sparql",
    class_qid:"Q494230",
    class_label:"medical school",
    selection:"instance/subclass of medical school; entities explicitly marked dissolved excluded; obvious non-medical veterinary/nursing/pharmacy label collisions excluded",
    license:"Creative Commons CC0 1.0",
    license_url:"https://www.wikidata.org/wiki/Wikidata:Licensing",
    rebuild_queries:rebuildQueries,
    schools_query_result_sha256:sha256(schoolsRaw),
    aliases_query_result_sha256:sha256(aliasesRaw),
    country_codes_query_result_sha256:sha256(countryCodesRaw)
  },
  integrity:{records_sha256:sha256(recordsText)},
  verification_law:{
    identity_only:true,
    accreditation_asserted:false,
    active_status_asserted:false,
    analytics_eligible:false,
    unlisted_path_required:true
  },
  limitations:[
    "Wikidata identity data is incomplete and may be stale.",
    "A match establishes only a source identity; it does not verify accreditation, active status, eligibility, or degree authority.",
    "U.S. MD/DO records remain governed by the separate DAPIP snapshot.",
    "Students can use School not listed; those entries remain explicitly unverified and queued for normalization."
  ]
};

const geographyDir=resolve(ROOT,"web/data/geography");
const schoolsDir=resolve(ROOT,"web/data/medical-schools");
const uxrDir=resolve(ROOT,"web/js/uxr-002");
await mkdir(geographyDir,{recursive:true});
await mkdir(schoolsDir,{recursive:true});
await writeFile(resolve(geographyDir,"iso-3166-1-alpha-2-2024.json"),`${JSON.stringify({
  manifest:{
    schema_version:1,
    dataset_version:"iso-3166-1-alpha-2-2024-02-29-tzdata-2025-07-01",
    source_file:"tzdata iso3166.tab",
    source_file_sha256:sha256(isoTab),
    source_note:"ISO 3166-1 alpha-2 codes current to ISO/TC 46 N1127 (2024-02-29); tzdata table public domain.",
    record_count:countries.length
  },records:countries
},null,2)}\n`);
await writeFile(resolve(uxrDir,"iso-country-codes.js"),`// Generated by scripts/build-global-reference-data.mjs. Do not hand edit.\nexport const ISO_3166_ALPHA2=Object.freeze(${JSON.stringify(countries)}.map((row)=>Object.freeze(row)));\n`);
await writeFile(resolve(schoolsDir,`${version}.json`),`${JSON.stringify({manifest,records},null,2)}\n`);
await writeFile(resolve(schoolsDir,"global-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({version,records:records.length,countries:coveredCountries.length,isoRows:countries.length},null,2));

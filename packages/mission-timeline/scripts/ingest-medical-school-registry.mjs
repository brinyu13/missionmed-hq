import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_PATH=fileURLToPath(import.meta.url);
const SCRIPT_DIR=path.dirname(SCRIPT_PATH);
const PACKAGE_DIR=path.resolve(SCRIPT_DIR,"..");
const OUTPUT_DIR=path.join(PACKAGE_DIR,"web","data","medical-schools");
const EVIDENCE_DIR=process.env.D1_SCHOOL_EVIDENCE_DIR||path.resolve(
  PACKAGE_DIR,
  "..",
  "..",
  "_AI_HANDOFFS",
  "from_codex",
  "D1-405_TIMELINE_LAUNCH_REFINEMENT",
  "evidence",
  "data-sources"
);
const SNAPSHOT_DATE=process.env.D1_SCHOOL_SNAPSHOT_DATE||
  new Date().toISOString().slice(0,10);
const RETRIEVED_AT=new Date().toISOString();
const INGESTION_TOOL_VERSION="1.1.0";
const API_ROOT="https://ope.ed.gov/dapip/api";
const WIKIDATA_QUERY=`SELECT ?school ?schoolLabel ?alt ?cityLabel ?parentLabel WHERE {
  ?school wdt:P31 wd:Q494230;
    wdt:P17 wd:Q30.
  OPTIONAL { ?school skos:altLabel ?alt FILTER(LANG(?alt) = "en") }
  OPTIONAL { ?school wdt:P131 ?city. }
  OPTIONAL { ?school wdt:P749 ?parent. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
const SOURCES=Object.freeze([
  Object.freeze({
    agencyId:46,
    programId:78,
    schoolType:"MD",
    accreditationBody:"Liaison Committee on Medical Education"
  }),
  Object.freeze({
    agencyId:48,
    programId:52,
    schoolType:"DO",
    accreditationBody:
      "American Osteopathic Association, Commission on Osteopathic College Accreditation"
  })
]);

function clean(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function sha256(value){
  return createHash("sha256").update(value).digest("hex");
}

function acronym(value){
  const excluded=new Set([
    "a","an","and","at","for","in","of","on","the","to"
  ]);
  const letters=clean(value)
    .replace(/\b([A-Za-z])\./g,"$1 ")
    .split(/[^A-Za-z0-9]+/)
    .filter((word)=>
      word&&(word.length===1||!excluded.has(word.toLowerCase()))
    )
    .map((word)=>word[0])
    .join("")
    .toUpperCase();
  return letters.length>=2&&letters.length<=12?letters:"";
}

function brandAcronym(value){
  const name=clean(value);
  const university=name.match(/^(.+?\bUniversity)\b/i)?.[1];
  return university?acronym(university):"";
}

function alreadyProgramSpecific(name){
  return/(medical (college|school)|college of (human )?medicine|school of medicine|osteopathic medicine|health sciences university|university of health sciences)/i.test(
    name
  );
}

function canonicalProgramName(institutionName,schoolType,wikidataMatch){
  if(wikidataMatch?.label)return wikidataMatch.label;
  return alreadyProgramSpecific(institutionName)
    ?institutionName
    :`${institutionName} — ${schoolType} program`;
}

function aliasesFor(institutionName,canonicalName,schoolType,wikidataMatch){
  const aliases=new Set();
  for(const alias of wikidataMatch?.aliases||[])aliases.add(alias);
  if(institutionName!==canonicalName)aliases.add(institutionName);
  const initials=[
    acronym(institutionName),
    acronym(canonicalName),
    brandAcronym(institutionName)
  ].filter(Boolean);
  for(const initialism of initials)aliases.add(initialism);
  if(schoolType==="MD"&&!alreadyProgramSpecific(institutionName)){
    aliases.add(`${institutionName} School of Medicine`);
    aliases.add(`${institutionName} Medical School`);
  }else if(schoolType==="DO"&&!alreadyProgramSpecific(institutionName)){
    aliases.add(`${institutionName} College of Osteopathic Medicine`);
  }
  return [...aliases]
    .map(clean)
    .filter((alias)=>
      alias&&
      alias!==canonicalName&&
      alias.length<=100&&
      !/\b(dental|dentistry|divinity|hospital)\b/i.test(alias)
    )
    .sort((left,right)=>left.localeCompare(right));
}

async function fetchedJson(url,options={}){
  const response=await fetch(url,options);
  if(!response.ok){
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  const text=await response.text();
  return{
    payload:JSON.parse(text),
    evidence:Object.freeze({
      url,
      response_sha256:sha256(text)
    })
  };
}

async function mapConcurrent(values,limit,worker){
  const output=new Array(values.length);
  let next=0;
  async function consume(){
    while(next<values.length){
      const index=next;
      next+=1;
      output[index]=await worker(values[index],index);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,values.length)},consume));
  return output;
}

async function agencyRows(source){
  const requestBody={
    AgencyIds:[source.agencyId],
    PageNumber:1,
    RecordsPerPage:500,
    SortField:"institutionName",
    SortAscending:true
  };
  const result=await fetchedJson(`${API_ROOT}/search/advanced`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(requestBody)
  });
  return{
    rows:(result.payload.Results||[]).map((row)=>({...row,source})),
    raw:result.payload,
    evidence:{
      ...result.evidence,
      method:"POST",
      request_body:requestBody,
      agency_id:source.agencyId,
      expected_program_id:source.programId
    }
  };
}

function normalizeMatch(value){
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

const MATCH_STOP_WORDS=new Set([
  "and","at","campus","center","centre","college","for","health","in",
  "medical","medicine","of","school","science","sciences","system","the",
  "university"
]);

function matchTokens(value){
  return new Set(
    normalizeMatch(value)
      .split(" ")
      .filter((token)=>token&&!MATCH_STOP_WORDS.has(token))
  );
}

function jaccard(left,right){
  const intersection=[...left].filter((token)=>right.has(token)).length;
  return intersection/Math.max(1,new Set([...left,...right]).size);
}

function wikidataCandidates(payload){
  const rows=payload?.results?.bindings||[];
  const grouped=new Map();
  for(const row of rows){
    const qid=clean(row.school?.value).split("/").pop();
    if(!qid)continue;
    const candidate=grouped.get(qid)||{
      qid,
      label:clean(row.schoolLabel?.value),
      aliases:new Set(),
      cities:new Set(),
      parents:new Set()
    };
    if(row.alt?.value)candidate.aliases.add(clean(row.alt.value));
    if(row.cityLabel?.value)candidate.cities.add(clean(row.cityLabel.value));
    if(row.parentLabel?.value)candidate.parents.add(clean(row.parentLabel.value));
    grouped.set(qid,candidate);
  }
  return [...grouped.values()].map((candidate)=>({
    ...candidate,
    aliases:[...candidate.aliases],
    cities:[...candidate.cities],
    parents:[...candidate.parents]
  }));
}

function wikidataScore(row,candidate){
  const institution=normalizeMatch(row.institutionName);
  const label=normalizeMatch(candidate.label);
  const institutionBrand=normalizeMatch(
    clean(row.institutionName).match(/^(.+?\bUniversity)\b/i)?.[1]||""
  );
  const parents=candidate.parents.map(normalizeMatch);
  let score=0;
  if(parents.includes(institution))score=120;
  else if(institutionBrand&&label.startsWith(institutionBrand))score=105;
  else if(label.includes(institution)||institution.includes(label))score=90;
  else{
    score=Math.round(Math.max(
      jaccard(matchTokens(row.institutionName),matchTokens(candidate.label)),
      ...candidate.parents.map((parent)=>
        jaccard(matchTokens(row.institutionName),matchTokens(parent))
      )
    )*70);
  }
  if(candidate.cities.some(
    (city)=>normalizeMatch(city)===normalizeMatch(row.city)
  ))score+=15;
  const osteopathic=/osteopath/i.test(
    `${candidate.label} ${candidate.aliases.join(" ")}`
  );
  if(row.source.schoolType==="DO"&&!osteopathic)score-=60;
  if(row.source.schoolType==="MD"&&osteopathic)score-=80;
  return score;
}

function matchWikidataSchool(row,candidates){
  const ranked=candidates
    .map((candidate)=>({
      ...candidate,
      score:wikidataScore(row,candidate)
    }))
    .sort((left,right)=>right.score-left.score);
  const best=ranked[0];
  const runnerUp=ranked[1];
  if(!best||best.score<85)return null;
  if(best.score-(runnerUp?.score||0)>=10)return best;
  const aliasCandidates=ranked.filter(
    ({score})=>score>=85&&score>=best.score-15
  );
  return{
    qid:null,
    label:null,
    score:null,
    aliases:[...new Set(aliasCandidates.flatMap((candidate)=>[
      candidate.label,
      ...candidate.aliases
    ]).filter(Boolean))],
    alias_qids:aliasCandidates.map(({qid})=>qid),
    alias_only:true
  };
}

function activeProgramRecord(records,source){
  return(records||[])
    .filter((record)=>
      Number(record.AgencyId)===source.agencyId&&
      Number(record.ProgramId)===source.programId&&
      clean(record.ActiveCD).toUpperCase()==="A"
    )
    .sort((left,right)=>
      Number(right.SequentialId||0)-Number(left.SequentialId||0)
    )[0]||null;
}

function recordFrom(row,program,programMetadata,wikidataMatch){
  const institutionName=clean(row.institutionName);
  const canonicalName=canonicalProgramName(
    institutionName,
    row.source.schoolType,
    wikidataMatch
  );
  const programSequence=program?Number(program.SequentialId||1):null;
  const exactProgramRecord=Boolean(program);
  const normalizedDisplayName=Boolean(wikidataMatch?.label);
  const canonicalId=exactProgramRecord
    ?`mm-school-us-dapip-unit-${row.unitid}-program-${row.source.programId}`
    :`mm-school-us-dapip-unit-${row.unitid}-agency-${row.source.agencyId}`+
      "-program-unconfirmed";
  return{
    canonical_school_id:canonicalId,
    canonical_name:canonicalName,
    alternate_names:aliasesFor(
      institutionName,
      canonicalName,
      row.source.schoolType,
      wikidataMatch
    ),
    parent_institution_name:institutionName,
    country:"United States",
    country_code:"US",
    state_or_region:clean(row.state),
    city:clean(row.city),
    school_type:row.source.schoolType,
    display_name_source:normalizedDisplayName
      ?"Wikidata CC0"
      :"DAPIP source-derived",
    display_name_status:normalizedDisplayName?"normalized":"review-needed",
    wikidata_qid:normalizedDisplayName?wikidataMatch.qid:null,
    wikidata_alias_qids:wikidataMatch?.alias_qids||[],
    display_name_match_score:normalizedDisplayName?wikidataMatch.score:null,
    program_name:clean(program?.ProgramName||programMetadata?.ProgramName),
    program_id:exactProgramRecord?String(program.ProgramId):null,
    accreditation_record_id:exactProgramRecord
      ?`${program.UnitId}:${program.ProgramId}:${programSequence}`
      :null,
    campus_or_department_description:clean(program?.DepartmentDescription),
    accreditation_status:exactProgramRecord
      ?clean(program.AccreditationFlag||program.ActiveCD)
      :"Agency search result only",
    accreditation_review_date:clean(program?.ReviewDate),
    source:"U.S. Department of Education DAPIP",
    source_identifier:
      exactProgramRecord
        ?`UNITID ${row.unitid}; agency ${row.source.agencyId}; `+
          `program ${program.ProgramId}; sequence ${programSequence}`
        :`UNITID ${row.unitid}; agency ${row.source.agencyId}; `+
          "institution-program record unavailable",
    source_url_or_reference:
      exactProgramRecord
        ?`${API_ROOT}/records/specialized/profile/${row.unitid}`
        :`${API_ROOT}/search/advanced`,
    accreditation_body:row.source.accreditationBody,
    active_status_if_known:
      exactProgramRecord
        ?(clean(program.ActiveCD).toUpperCase()==="A"
          ?"Active"
          :clean(program.ActiveCD))
        :clean(row.activeStatus),
    dataset_version:`us-dapip-${SNAPSHOT_DATE}`,
    verified_at:null,
    source_retrieved_at:RETRIEVED_AT,
    verification_status:exactProgramRecord
      ?"source-reported-program"
      :"source-reported-agency",
    normalization_status:
      exactProgramRecord&&normalizedDisplayName
        ?"normalized"
        :(!exactProgramRecord&&normalizedDisplayName
          ?"program-record-review-needed"
          :(!exactProgramRecord
            ?"program-and-name-review-needed"
            :"school-name-review-needed")),
    analytics_eligible:exactProgramRecord&&normalizedDisplayName,
    external_crosswalks:{
      dapip_unitid:String(row.unitid),
      dapip_program_id:exactProgramRecord?String(program.ProgramId):null,
      dapip_record_sequence:exactProgramRecord?String(programSequence):null,
      opeid:clean(row.opeID)||null,
      wikidata_qid:normalizedDisplayName?wikidataMatch.qid:null
    }
  };
}

function accreditationReviewTime(record){
  const match=clean(record?.accreditation_review_date)
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!match)return 0;
  return Date.UTC(Number(match[3]),Number(match[1])-1,Number(match[2]));
}

function reconcileDuplicateCrosswalks(records){
  const groups=new Map();
  for(const record of records){
    const qid=clean(record.wikidata_qid);
    if(!qid)continue;
    const key=[
      qid,
      clean(record.school_type).toUpperCase(),
      clean(record.city).toLocaleLowerCase()
    ].join(":");
    const group=groups.get(key)||[];
    group.push(record);
    groups.set(key,group);
  }
  for(const group of groups.values()){
    if(group.length<2)continue;
    const ordered=[...group].sort((left,right)=>
      accreditationReviewTime(right)-accreditationReviewTime(left)||
      String(right.canonical_school_id).localeCompare(
        String(left.canonical_school_id)
      )
    );
    const current=ordered[0];
    for(const stale of ordered.slice(1)){
      stale.display_name_status="crosswalk-review-needed";
      stale.normalization_status="superseded-crosswalk-review-needed";
      stale.analytics_eligible=false;
      stale.superseded_by_canonical_school_id=current.canonical_school_id;
    }
  }
  return records;
}

async function main(){
  const agencyResults=await Promise.all(SOURCES.map(agencyRows));
  const programMetadataResults=await Promise.all(
    SOURCES.map(({programId})=>fetchedJson(`${API_ROOT}/programs/${programId}`))
  );
  const programMetadata=new Map(
    SOURCES.map((source,index)=>[
      source.programId,
      programMetadataResults[index].payload
    ])
  );
  const wikidataUrl=
    "https://query.wikidata.org/sparql?format=json&query="+
    encodeURIComponent(WIKIDATA_QUERY);
  const wikidataResult=await fetchedJson(wikidataUrl,{
    headers:{
      accept:"application/sparql-results+json",
      "user-agent":"MissionMedTimelineBuilder/1.1 local-candidate"
    }
  });
  const wikidataSchools=wikidataCandidates(wikidataResult.payload);
  const sourceRows=agencyResults.flatMap(({rows})=>rows);
  const accreditationEvidence=[];
  const accreditationRaw=[];
  const inspected=await mapConcurrent(sourceRows,12,async(row)=>{
    const endpoint=`${API_ROOT}/records/specialized/profile/${row.unitid}`;
    const result=await fetchedJson(endpoint);
    accreditationEvidence.push(
      `${row.unitid}:${result.evidence.response_sha256}`
    );
    accreditationRaw.push({
      unitid:String(row.unitid),
      agency_id:row.source.agencyId,
      expected_program_id:row.source.programId,
      response_sha256:result.evidence.response_sha256,
      response:result.payload
    });
    const program=activeProgramRecord(result.payload,row.source);
    return recordFrom(
      row,
      program,
      programMetadata.get(row.source.programId),
      matchWikidataSchool(row,wikidataSchools)
    );
  });
  const records=reconcileDuplicateCrosswalks(inspected.filter(Boolean))
    .sort((left,right)=>
    left.canonical_name.localeCompare(right.canonical_name)||
    left.school_type.localeCompare(right.school_type)
  );
  const unique=records.filter((record,index,array)=>
    index===0||
    record.canonical_school_id!==array[index-1].canonical_school_id
  );
  const scriptSha=sha256(await readFile(SCRIPT_PATH));
  const recordsSha=sha256(`${JSON.stringify(unique)}\n`);
  const pendingProgramCount=unique.filter(
    ({verification_status})=>verification_status==="source-reported-agency"
  ).length;
  const pendingNameCount=unique.filter(
    ({display_name_status})=>display_name_status!=="normalized"
  ).length;
  const normalizedCount=unique.filter(
    ({display_name_status})=>display_name_status==="normalized"
  ).length;
  const supersededCrosswalkCount=unique.filter(
    ({superseded_by_canonical_school_id})=>
      Boolean(superseded_by_canonical_school_id)
  ).length;
  const rawSnapshot={
    schema_version:1,
    retrieved_at:RETRIEVED_AT,
    dapip:{
      agency_searches:agencyResults.map(({evidence,raw})=>({
        evidence,
        response:raw
      })),
      program_metadata:programMetadataResults.map((result)=>({
        evidence:result.evidence,
        response:result.payload
      })),
      specialized_profiles:accreditationRaw.sort((left,right)=>
        left.unitid.localeCompare(right.unitid)||
        left.agency_id-right.agency_id
      )
    },
    wikidata:{
      license:"CC0",
      query:WIKIDATA_QUERY,
      evidence:wikidataResult.evidence,
      response:wikidataResult.payload
    }
  };
  const rawSnapshotText=`${JSON.stringify(rawSnapshot,null,2)}\n`;
  const rawSnapshotFile=`medical-school-source-snapshot-${SNAPSHOT_DATE}.json`;
  const rawSnapshotSha=sha256(rawSnapshotText);
  const manifest={
    schema_version:2,
    dataset_version:`us-dapip-${SNAPSHOT_DATE}`,
    retrieved_at:RETRIEVED_AT,
    ingestion_tool:{
      name:path.basename(SCRIPT_PATH),
      version:INGESTION_TOOL_VERSION,
      sha256:scriptSha
    },
    coverage:{
      countries:["United States"],
      school_types:["MD","DO"],
      record_count:unique.length,
      by_school_type:Object.fromEntries(
        SOURCES.map(({schoolType})=>[
          schoolType,
          unique.filter((record)=>record.school_type===schoolType).length
        ])
      ),
      source_result_count:sourceRows.length,
      records_without_matching_active_program:pendingProgramCount,
      normalized_display_name_count:normalizedCount,
      records_without_normalized_display_name:pendingNameCount,
      superseded_crosswalk_record_count:supersededCrosswalkCount,
      completeness_status:"not asserted",
      missing_record_inventory:
        "Not available from DAPIP; use the unlisted-school normalization path."
    },
    integrity:{
      records_sha256:recordsSha,
      accreditation_response_count:accreditationEvidence.length,
      accreditation_response_aggregate_sha256:sha256(
        `${accreditationEvidence.sort().join("\n")}\n`
      ),
      raw_source_snapshot_file:rawSnapshotFile,
      raw_source_snapshot_sha256:rawSnapshotSha
    },
    source:{
      name:"U.S. Department of Education DAPIP",
      public_service_url:"https://ope.ed.gov/dapip/",
      api_root:API_ROOT,
      method:
        "Agency search followed by exact active agency/program accreditation-record verification.",
      agency_program_pairs:SOURCES.map(({agencyId,programId,schoolType})=>({
        agency_id:agencyId,
        program_id:programId,
        school_type:schoolType
      })),
      search_request_evidence:agencyResults.map(({evidence})=>evidence),
      program_metadata_evidence:programMetadataResults.map(({evidence})=>evidence),
      reuse_basis:
        "U.S. Department of Education public-service data; no affirmative license statement was found. Production redistribution requires legal confirmation."
    },
    name_enrichment:{
      name:"Wikidata",
      url:"https://www.wikidata.org/",
      query_service:"https://query.wikidata.org/sparql",
      license:"Creative Commons CC0 1.0",
      license_url:"https://www.wikidata.org/wiki/Wikidata:Licensing",
      response_sha256:wikidataResult.evidence.response_sha256,
      method:
        "High-confidence parent/name/city matching with degree-type safeguards; ambiguous matches are rejected."
    },
    limitations:[
      "DAPIP is agency-reported, unaudited, and may be incomplete or stale.",
      "Records with a matching active institution-program profile identify the exact DAPIP agency/program accreditation record; display names use the source institution plus degree-program identity when DAPIP does not report a school-level name.",
      `${pendingProgramCount} records are returned by the agency-filtered search but lack a matching active institution-program profile record; they remain selectable, are marked for program-record review, and are excluded from verified analytics.`,
      `${pendingNameCount} records lack a high-confidence CC0 medical-school display-name match; they retain a source-derived label, are marked for name review, and are excluded from verified analytics.`,
      `${supersededCrosswalkCount} stale duplicate source crosswalk record is preserved for provenance, marked review-only, excluded from selection, and excluded from verified analytics.`,
      "Aliases are deterministic search aids only; DAPIP institution aliases are excluded because they may describe unrelated schools, hospitals, prior names, or other programs.",
      "No completeness percentage is asserted and no unsupported missing-school inventory is fabricated.",
      "No WDOMS, LCME-directory, AACOM, or COCA-directory compilation is redistributed.",
      "International and unlisted schools remain explicitly unverified and excluded from verified analytics pending normalization."
    ]
  };
  const datasetPath=path.join(
    OUTPUT_DIR,
    `us-dapip-${SNAPSHOT_DATE}.json`
  );
  const datasetText=`${JSON.stringify({manifest,records:unique},null,2)}\n`;
  const externalManifest={
    ...manifest,
    integrity:{
      ...manifest.integrity,
      dataset_file: path.basename(datasetPath),
      dataset_file_sha256:sha256(datasetText)
    }
  };
  await mkdir(OUTPUT_DIR,{recursive:true});
  await mkdir(EVIDENCE_DIR,{recursive:true});
  await Promise.all([
    writeFile(datasetPath,datasetText),
    writeFile(
      path.join(OUTPUT_DIR,"manifest.json"),
      `${JSON.stringify(externalManifest,null,2)}\n`
    ),
    writeFile(path.join(EVIDENCE_DIR,rawSnapshotFile),rawSnapshotText)
  ]);
  process.stdout.write(
    `Medical-school registry: ${unique.length} source-reported records `+
    `(${pendingProgramCount} require program-record review) -> ${OUTPUT_DIR}\n`
  );
}

await main();

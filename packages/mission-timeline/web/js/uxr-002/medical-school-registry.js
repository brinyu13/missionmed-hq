import {uid} from "./utils.js";

const NORMALIZED_RECORD=Symbol("normalized-medical-school-record");
const SEARCH_TEXT_CACHE=new WeakMap();

export const MEDICAL_SCHOOL_DATASET_URL=globalThis.D1_TIMELINE_ASSET_URLS?.["data/medical-schools/us-dapip-2026-07-30.json"]
  ||new URL("../../data/medical-schools/us-dapip-2026-07-30.json",import.meta.url);

function clean(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

export function normalizeSchoolSearch(value){
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function recordSearchText(record){
  if(SEARCH_TEXT_CACHE.has(record))return SEARCH_TEXT_CACHE.get(record);
  const value=normalizeSchoolSearch([
    record.canonical_name,
    ...(record.alternate_names||[]),
    record.country,
    record.country_code,
    record.state_or_region,
    record.city,
    record.school_type
  ].filter(Boolean).join(" "));
  SEARCH_TEXT_CACHE.set(record,value);
  return value;
}

function buildTokenIndex(records){
  const tokens=new Map();
  records.forEach((record,index)=>{
    for(const token of new Set(recordSearchText(record).split(" ").filter(Boolean))){
      const matches=tokens.get(token)||new Set();
      matches.add(index);
      tokens.set(token,matches);
    }
  });
  return Object.freeze({kind:"inverted-token-index",records,tokens});
}

function indexedCandidates(index,query){
  const queryTokens=normalizeSchoolSearch(query).split(" ").filter(Boolean);
  if(!queryTokens.length)return[];
  let candidates=null;
  for(const queryToken of queryTokens){
    const matches=new Set();
    for(const [token,indexes] of index.tokens){
      if(token.startsWith(queryToken)||token.includes(queryToken)){
        for(const recordIndex of indexes)matches.add(recordIndex);
      }
    }
    candidates=candidates==null
      ?matches
      :new Set([...candidates].filter((recordIndex)=>matches.has(recordIndex)));
    if(!candidates.size)return[];
  }
  return [...candidates].map((recordIndex)=>index.records[recordIndex]);
}

function resultLabel(record){
  const location=[record.city,record.state_or_region].filter(Boolean).join(", ");
  return[
    record.canonical_name,
    record.school_type,
    location||record.country
  ].filter(Boolean).join(" · ");
}

export function normalizeSchoolRecord(record={}){
  if(record?.[NORMALIZED_RECORD])return record;
  const canonicalName=clean(record.canonical_name||record.canonicalName);
  const canonicalId=clean(
    record.canonical_school_id||record.canonicalSchoolId
  );
  if(!canonicalId||!canonicalName)return null;
  return Object.freeze({
    [NORMALIZED_RECORD]:true,
    canonical_school_id:canonicalId,
    canonical_name:canonicalName,
    alternate_names:Object.freeze(
      [...new Set((record.alternate_names||[]).map(clean).filter(Boolean))]
    ),
    country:clean(record.country),
    country_code:clean(record.country_code),
    state_or_region:clean(record.state_or_region),
    city:clean(record.city),
    school_type:clean(record.school_type)||"Other",
    display_name_source:clean(record.display_name_source),
    display_name_status:clean(record.display_name_status),
    wikidata_qid:record.wikidata_qid==null
      ?null
      :clean(record.wikidata_qid),
    wikidata_alias_qids:Object.freeze(
      [...new Set((record.wikidata_alias_qids||[]).map(clean).filter(Boolean))]
    ),
    display_name_match_score:
      Number.isFinite(Number(record.display_name_match_score))
        ?Number(record.display_name_match_score)
        :null,
    parent_institution_name:clean(record.parent_institution_name),
    program_name:clean(record.program_name),
    program_id:record.program_id==null?null:clean(record.program_id),
    accreditation_record_id:
      record.accreditation_record_id==null
        ?null
        :clean(record.accreditation_record_id),
    campus_or_department_description:
      clean(record.campus_or_department_description),
    accreditation_status:clean(record.accreditation_status),
    accreditation_review_date:clean(record.accreditation_review_date),
    source:clean(record.source),
    source_identifier:clean(record.source_identifier),
    source_url_or_reference:clean(record.source_url_or_reference),
    accreditation_body:clean(record.accreditation_body),
    active_status_if_known:
      record.active_status_if_known==null
        ?null
        :clean(record.active_status_if_known),
    dataset_version:clean(record.dataset_version),
    verified_at:record.verified_at==null?null:clean(record.verified_at),
    source_retrieved_at:clean(record.source_retrieved_at),
    verification_status:clean(record.verification_status)||"source-reported",
    normalization_status:clean(record.normalization_status),
    superseded_by_canonical_school_id:
      clean(record.superseded_by_canonical_school_id),
    submitted_at:clean(record.submitted_at),
    analytics_eligible:record.analytics_eligible!==false,
    external_crosswalks:Object.freeze({...record.external_crosswalks})
  });
}

function rank(record,needle,tokens){
  const canonical=normalizeSchoolSearch(record.canonical_name);
  const aliases=(record.alternate_names||[]).map(normalizeSchoolSearch);
  if(canonical===needle)return 0;
  if(aliases.includes(needle))return 1;
  if(canonical.startsWith(needle))return 2;
  if(aliases.some((alias)=>alias.startsWith(needle)))return 3;
  if(canonical.includes(needle))return 4;
  if(aliases.some((alias)=>alias.includes(needle)))return 5;
  const haystack=record._searchText||recordSearchText(record);
  if(tokens.every((token)=>haystack.includes(token)))return 6;
  return Number.POSITIVE_INFINITY;
}

export function searchMedicalSchools(records,query,{
  country="",
  schoolType="",
  limit=12
}={}){
  const needle=normalizeSchoolSearch(query);
  if(needle.length<2)return[];
  const tokens=needle.split(" ").filter(Boolean);
  const countryFilter=normalizeSchoolSearch(country);
  const typeFilter=clean(schoolType).toUpperCase();
  return(records||[])
    .map(normalizeSchoolRecord)
    .filter(Boolean)
    .filter((record)=>!record.superseded_by_canonical_school_id)
    .filter((record)=>
      (!countryFilter||
        normalizeSchoolSearch(record.country)===countryFilter||
        normalizeSchoolSearch(record.country_code)===countryFilter)&&
      (!typeFilter||record.school_type.toUpperCase()===typeFilter)
    )
    .map((record)=>({
      record,
      score:rank(record,needle,tokens)
    }))
    .filter(({score})=>Number.isFinite(score))
    .sort((left,right)=>
      left.score-right.score||
      left.record.canonical_name.localeCompare(right.record.canonical_name)
    )
    .slice(0,Math.max(1,Number(limit)||12))
    .map(({record})=>Object.freeze({
      ...record,
      id:record.canonical_school_id,
      value:record.canonical_name,
      label:resultLabel(record),
      shortName:record.alternate_names[0]||record.canonical_name
    }));
}

async function defaultFetcher(url){
  const response=await fetch(url);
  if(!response.ok)throw new Error(
    `Medical-school registry unavailable (${response.status}).`
  );
  return response.json();
}

export function createMedicalSchoolProvider({
  rows=null,
  fetcher=defaultFetcher,
  url=MEDICAL_SCHOOL_DATASET_URL
}={}){
  let cache=Array.isArray(rows)?rows.map(normalizeSchoolRecord).filter(Boolean):null;
  let searchIndex=cache?buildTokenIndex(cache):null;
  let manifest=null;
  let pending=null;
  let loadError=null;
  const load=async()=>{
    if(cache)return cache;
    if(pending)return pending;
    pending=Promise.resolve(fetcher(url)).then((payload)=>{
      manifest=payload?.manifest||null;
      cache=(payload?.records||[]).map(normalizeSchoolRecord).filter(Boolean);
      searchIndex=buildTokenIndex(cache);
      loadError=null;
      return cache;
    }).catch((error)=>{
      loadError=String(error?.message||error);
      cache=[];
      searchIndex=buildTokenIndex(cache);
      return cache;
    }).finally(()=>{pending=null;});
    return pending;
  };
  return Object.freeze({
    kind:"local-authoritative-medical-school-registry",
    localOnly:true,
    networkRequests:false,
    async search(query,options={}){
      await load();
      return searchMedicalSchools(indexedCandidates(searchIndex,query),query,{
        country:options.country||options.filters?.country,
        schoolType:options.schoolType||options.filters?.schoolType,
        limit:options.limit
      });
    },
    async countries(){
      const values=[...new Set((await load())
        .map((record)=>record.country)
        .filter(Boolean))];
      return values.sort();
    },
    async metadata(){
      await load();
      return Object.freeze({
        manifest,
        recordCount:cache?.length||0,
        indexKind:searchIndex?.kind||null,
        indexTokenCount:searchIndex?.tokens?.size||0,
        error:loadError
      });
    }
  });
}

export function createUnverifiedSchoolSubmission({
  name,
  country,
  city="",
  stateOrRegion="",
  now=()=>new Date().toISOString(),
  idFactory=uid
}={}){
  const id=`unverified:${idFactory("medical-school")}`;
  return Object.freeze({
    canonical_school_id:id,
    canonical_name:clean(name),
    alternate_names:Object.freeze([]),
    country:clean(country),
    country_code:"",
    state_or_region:clean(stateOrRegion),
    city:clean(city),
    school_type:"Other",
    source:"Student-submitted local normalization queue",
    source_identifier:id,
    source_url_or_reference:"LOCAL_ONLY",
    accreditation_body:"",
    active_status_if_known:null,
    dataset_version:"unverified-local",
    verified_at:"",
    verification_status:"unverified",
    normalization_status:"queued",
    analytics_eligible:false,
    submitted_at:now()
  });
}

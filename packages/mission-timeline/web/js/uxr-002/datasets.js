import {createMedicalSchoolProvider} from "./medical-school-registry.js";
import {ISO_3166_ALPHA2} from "./iso-country-codes.js";
import {
  ALL_ROTATION_SPECIALTIES,
  PINNED_ROTATION_SPECIALTIES,
  rankSpecialtyMatches,
  specialtyOption
} from "./specialty-taxonomy.js";

export function browserCountryRows({
  DisplayNames=globalThis.Intl?.DisplayNames
}={}){
  const names=typeof DisplayNames==="function"
    ?new DisplayNames(["en"],{type:"region"})
    :null;
  return ISO_3166_ALPHA2
    .map(({code,name})=>({code,name:String(names?.of(code)||name)}))
    .sort((left,right)=>left.name.localeCompare(right.name))
    .map(({code,name})=>Object.freeze({
      id:`country-${code.toLowerCase()}`,
      code,
      value:name,
      label:name
    }));
}

export function createCountryProvider(options={}){
  const rows=browserCountryRows(options);
  return Object.freeze({
    kind:"browser-region-names",
    locale:"en",
    localOnly:true,
    networkRequests:false,
    async search(query){
      const needle=String(query||"").trim().toLocaleLowerCase();
      if(needle.length<2)return[];
      return rows
        .filter((item)=>item.value.toLocaleLowerCase().includes(needle)||
          item.code.toLocaleLowerCase().includes(needle))
        .slice(0,8);
    }
  });
}

export function createSpecialtyProvider(){
  const rows=ALL_ROTATION_SPECIALTIES.map(specialtyOption);
  return Object.freeze({
    kind:"governed-local-specialty-taxonomy",
    localOnly:true,
    networkRequests:false,
    async search(query,{limit=12}={}){
      const needle=String(query||"").trim();
      const matches=needle
        ?rankSpecialtyMatches(rows,{query:needle})
        :PINNED_ROTATION_SPECIALTIES.map(specialtyOption);
      return matches.slice(0,Math.max(1,Number(limit)||12));
    }
  });
}

export function createRuntimeDatasets(options={}){
  return Object.freeze({
    countries:createCountryProvider(options),
    schools:createMedicalSchoolProvider(options.medicalSchools||{}),
    specialties:createSpecialtyProvider()
  });
}

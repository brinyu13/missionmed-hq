import {createMedicalSchoolProvider} from "./medical-school-registry.js";

const NON_COUNTRY_REGION_CODES=new Set(["EU","EZ","UN","XA","XB","ZZ"]);

function regionCodes(){
  const codes=[];
  for(let first=65;first<=90;first+=1){
    for(let second=65;second<=90;second+=1){
      codes.push(String.fromCharCode(first,second));
    }
  }
  return codes;
}

export function browserCountryRows({
  DisplayNames=globalThis.Intl?.DisplayNames
}={}){
  if(typeof DisplayNames!=="function")return[];
  const names=new DisplayNames(["en"],{type:"region"});
  return regionCodes()
    .filter((code)=>!NON_COUNTRY_REGION_CODES.has(code))
    .map((code)=>({code,name:String(names.of(code)||"")}))
    .filter(({code,name})=>name&&name!==code&&!/unknown region/i.test(name))
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

export function createRuntimeDatasets(options={}){
  return Object.freeze({
    countries:createCountryProvider(options),
    schools:createMedicalSchoolProvider(options.medicalSchools||{})
  });
}

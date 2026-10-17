export function clone(value){
  if(value===undefined)return undefined;
  if(typeof structuredClone==="function")return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function canonicalize(value){
  if(value===undefined)return null;
  if(value===null||typeof value!=="object")return value;
  if(value instanceof Date)return value.toISOString();
  if(value instanceof Blob)return {type:value.type,size:value.size};
  if(Array.isArray(value))return value.map(canonicalize);
  return Object.keys(value).sort().reduce((out,key)=>{
    if(value[key]!==undefined)out[key]=canonicalize(value[key]);
    return out;
  },{});
}

export function stableStringify(value){return JSON.stringify(canonicalize(value));}

function fallbackHash(text){
  let a=0x811c9dc5,b=0x9e3779b9;
  for(let i=0;i<text.length;i++){
    a=Math.imul(a^text.charCodeAt(i),0x01000193)>>>0;
    b=Math.imul(b+text.charCodeAt(i)+(b<<6)+(b>>>2),0x85ebca6b)>>>0;
  }
  return [a,b,a^b,Math.imul(a,31)^b].map((n)=>(n>>>0).toString(16).padStart(8,"0")).join("");
}

export async function sha256Hex(value){
  const bytes=value instanceof ArrayBuffer?new Uint8Array(value):value instanceof Uint8Array?value:new TextEncoder().encode(typeof value==="string"?value:stableStringify(value));
  if(globalThis.crypto?.subtle){
    const digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
    return [...new Uint8Array(digest)].map((part)=>part.toString(16).padStart(2,"0")).join("");
  }
  return fallbackHash(new TextDecoder().decode(bytes)).padEnd(64,"0").slice(0,64);
}

export function stableId(prefix,value){return `${prefix}-${fallbackHash(stableStringify(value)).slice(0,20)}`;}
export function nowIso(clock=()=>new Date()){return clock().toISOString();}
export function byteSize(value){return new TextEncoder().encode(typeof value==="string"?value:stableStringify(value)).byteLength;}

export function visibilityName(value){
  const map={public:"INTERVIEWER_SAFE",safe:"INTERVIEWER_SAFE",INTERVIEWER_SAFE:"INTERVIEWER_SAFE",full:"FULL_STORY",FULL_STORY:"FULL_STORY",advisor:"ADVISOR_ONLY",ADVISOR_ONLY:"ADVISOR_ONLY",student:"STUDENT_ONLY",STUDENT_ONLY:"STUDENT_ONLY",hidden:"HIDDEN",HIDDEN:"HIDDEN"};
  return map[value]||"ADVISOR_ONLY";
}

export function legacyVisibility(value){
  return {INTERVIEWER_SAFE:"public",FULL_STORY:"full",ADVISOR_ONLY:"advisor",STUDENT_ONLY:"student",HIDDEN:"hidden"}[visibilityName(value)];
}

export function safeFilename(value){
  return String(value||"timeline").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").replace(/-+/g,"-").slice(0,96)||"timeline";
}

export const PINNED_ROTATION_SPECIALTIES=Object.freeze([
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

const PINNED_INDEX=new Map(
  PINNED_ROTATION_SPECIALTIES.map((label,index)=>[label,index])
);

export function normalizeSpecialtyId(value){
  const label=String(value||"").trim();
  if(!label)return"";
  return`acgme:${label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase()
    .replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")}`;
}

export function specialtyOption(label){
  const value=String(label||"").trim();
  return Object.freeze({
    id:normalizeSpecialtyId(value),
    specialtyId:normalizeSpecialtyId(value),
    value,
    label:value,
    pinned:PINNED_INDEX.has(value)
  });
}

export function rankSpecialtyMatches(matches,{query=""}={}){
  const needle=String(query||"").trim().toLocaleLowerCase();
  return[...(matches||[])]
    .map((item,index)=>({
      item,
      index,
      label:String(item?.value||item?.label||item||"")
    }))
    .filter(({label})=>
      !needle||label.toLocaleLowerCase().includes(needle)
    )
    .sort((left,right)=>{
      const leftPinned=PINNED_INDEX.get(left.label);
      const rightPinned=PINNED_INDEX.get(right.label);
      const leftRank=leftPinned==null?1:0;
      const rightRank=rightPinned==null?1:0;
      return leftRank-rightRank||
        (leftRank===0?leftPinned-rightPinned:0)||
        left.label.localeCompare(right.label)||
        left.index-right.index;
    })
    .map(({item})=>item);
}

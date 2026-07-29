export const clone=(value)=>structuredClone(value);

export function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}

export function uid(prefix="item"){
  return `${prefix}-${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

export function isoNow(){return new Date().toISOString();}

export function dateLabel(value=new Date()){
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(value instanceof Date?value:new Date(value));
}

export function shortDate(value=new Date()){
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(value instanceof Date?value:new Date(value));
}

export function relativeEdited(value){
  if(!value)return"just now";
  const seconds=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60)return"just now";
  if(seconds<3600)return`${Math.floor(seconds/60)}m ago`;
  if(seconds<86400)return`${Math.floor(seconds/3600)}h ago`;
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(new Date(value));
}

export function parseMonth(value){
  const text=String(value||"").trim();
  if(!text)return null;
  let match=text.match(/^(\d{4})-(0?[1-9]|1[0-2])$/);
  if(match)return`${match[1]}-${String(match[2]).padStart(2,"0")}`;
  match=text.match(/^(0?[1-9]|1[0-2])\/(\d{4})$/);
  if(match)return`${match[2]}-${String(match[1]).padStart(2,"0")}`;
  const cleaned=text.replace(/[,.-]+/g," ").replace(/\s+/g," ").trim();
  match=cleaned.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if(match){
    const monthNames=[
      ["jan","january"],["feb","february"],["mar","march"],["apr","april"],
      ["may"],["jun","june"],["jul","july"],["aug","august"],
      ["sep","september"],["oct","october"],["nov","november"],["dec","december"]
    ];
    const token=match[1].toLowerCase();
    const index=monthNames.findIndex((names)=>names.includes(token));
    if(index>=0)return`${match[2]}-${String(index+1).padStart(2,"0")}`;
  }
  return null;
}

export function formatMonth(value){
  const parsed=parseMonth(value);
  if(!parsed)return"";
  const [year,month]=parsed.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));
}

export function monthIndex(value){
  const parsed=parseMonth(value);
  if(!parsed)return null;
  const [year,month]=parsed.split("-").map(Number);
  return year*12+month-1;
}

export function monthString(index){
  const year=Math.floor(index/12);
  const month=((index%12)+12)%12;
  return`${year}-${String(month+1).padStart(2,"0")}`;
}

export function addMonths(value,delta){
  const index=monthIndex(value);
  return index==null?null:monthString(index+delta);
}

function channel(value){
  const normalized=value/255;
  return normalized<=0.04045?normalized/12.92:((normalized+0.055)/1.055)**2.4;
}

export function luminance(hex){
  const match=String(hex).trim().match(/^#([0-9a-f]{6})$/i);
  if(!match)return 0;
  const n=parseInt(match[1],16);
  return 0.2126*channel((n>>16)&255)+0.7152*channel((n>>8)&255)+0.0722*channel(n&255);
}

export function contrastRatio(a,b){
  const first=luminance(a),second=luminance(b);
  return(Number(((Math.max(first,second)+0.05)/(Math.min(first,second)+0.05)).toFixed(4)));
}

export function titleCase(value){
  return String(value||"").replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

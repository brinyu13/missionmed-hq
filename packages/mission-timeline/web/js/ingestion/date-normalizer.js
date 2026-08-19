const MONTHS={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
const SEASONS={spring:[3,5],summer:[6,8],fall:[9,11],autumn:[9,11],winter:[12,2]};

function monthString(year,month){return String(year)+"-"+String(month).padStart(2,"0");}
function basePoint(raw){return {raw:String(raw||"").trim(),timelineMonth:null,isoDate:null,precision:"UNKNOWN",inferred:false,openEnded:false,confidence:"LOW",warnings:[]};}

export function parseDatePoint(raw,{edge="start"}={}){
  const point=basePoint(raw);
  const value=point.raw.replace(/[,]/g,"").trim();
  if(!value)return point;
  if(/^(present|current|ongoing|now)$/i.test(value))return {...point,precision:"OPEN_ENDED",openEnded:true,confidence:"HIGH"};
  let match=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(match){
    const [,month,day,year]=match;
    return {...point,timelineMonth:monthString(+year,+month),isoDate:year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"),precision:"DAY",confidence:"HIGH"};
  }
  match=value.match(/^(\d{1,2})\/(\d{4})$/);
  if(match)return {...point,timelineMonth:monthString(+match[2],+match[1]),precision:"MONTH",confidence:"HIGH"};
  match=value.match(/^(\d{4})-(\d{2})$/);
  if(match)return {...point,timelineMonth:monthString(+match[1],+match[2]),precision:"MONTH",confidence:"HIGH"};
  match=value.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if(match&&MONTHS[match[1].toLowerCase()])return {...point,timelineMonth:monthString(+match[2],MONTHS[match[1].toLowerCase()]),precision:"MONTH",confidence:"HIGH"};
  match=value.match(/^(spring|summer|fall|autumn|winter)\s+(\d{4})$/i);
  if(match){
    const [start,end]=SEASONS[match[1].toLowerCase()];
    const month=edge==="end"?end:start;
    const year=+match[2]+(match[1].toLowerCase()==="winter"&&edge==="end"?1:0);
    return {...point,timelineMonth:monthString(year,month),precision:"SEASON",inferred:true,confidence:"MEDIUM",warnings:["Month inferred from seasonal date"]};
  }
  match=value.match(/^(early|mid|late)\s+(\d{4})$/i);
  if(match){
    const range={early:[1,4],mid:[5,8],late:[9,12]}[match[1].toLowerCase()];
    return {...point,timelineMonth:monthString(+match[2],edge==="end"?range[1]:range[0]),precision:"VAGUE_RANGE",inferred:true,confidence:"LOW",warnings:["Month inferred from "+match[1].toLowerCase()+" year wording"]};
  }
  match=value.match(/^(\d{4})$/);
  if(match){
    return {...point,timelineMonth:monthString(+match[1],edge==="end"?12:1),precision:"YEAR",inferred:true,confidence:"MEDIUM",warnings:["Month placeholder is "+(edge==="end"?"December":"January")+"; source precision remains year-only"]};
  }
  return {...point,warnings:["Unrecognized date format"]};
}

export function monthIndex(value){
  if(!/^\d{4}-\d{2}$/.test(String(value||"")))return null;
  const [year,month]=value.split("-").map(Number);
  return year*12+month-1;
}

/*
 * CVs overwhelmingly write ranges without spaces: "07/2021-12/2022", "Jan 2023-Jun 2024",
 * "2021-2023". The range splitter below requires whitespace on both sides of the dash,
 * while the CV parser's own capture allows none - so those entries arrived with BOTH
 * dates blank and the student had to retype every one. The lookahead only fires when the
 * dash is followed by another date token, so ISO values ("2023-01", "2023-01-15") are
 * left exactly as they are.
 */
const RANGE_JOIN=/((?:19|20)\d{2})\s*[-\u2013\u2014]\s*(?=(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}|spring|summer|fall|autumn|winter|early|mid|late|present|current|ongoing|now|\d{1,2}\/(?:19|20)\d{2}|(?:19|20)\d{2}\b)/gi;

export function normalizeDateRange(raw){
  const value=String(raw||"").trim().replace(RANGE_JOIN,"$1 - ");
  const separator=/\s+(?:-|–|—|to|through|until)\s+/i;
  const parts=value.split(separator).filter(Boolean);
  let start,end;
  if(parts.length>=2){
    start=parseDatePoint(parts[0],{edge:"start"});
    end=parseDatePoint(parts.slice(1).join(" "),{edge:"end"});
  }else if(/^(spring|summer|fall|autumn|winter|early|mid|late)\s+\d{4}$/i.test(value)){
    start=parseDatePoint(value,{edge:"start"});
    end=parseDatePoint(value,{edge:"end"});
  }else{
    start=parseDatePoint(value,{edge:"start"});
    end=null;
  }
  const startIndex=monthIndex(start?.timelineMonth);
  const endIndex=end?.openEnded?null:monthIndex(end?.timelineMonth);
  const validOrder=startIndex==null||endIndex==null||endIndex>=startIndex;
  const warnings=[...(start?.warnings||[]),...(end?.warnings||[])];
  if(!validOrder)warnings.push("End date precedes start date");
  return {
    raw:value,
    start,
    end,
    validOrder,
    precision:{start:start?.precision||"UNKNOWN",end:end?.precision||null},
    inferred:!!start?.inferred||!!end?.inferred,
    openEnded:!!end?.openEnded,
    warnings
  };
}

export function rangeDisplay(range){
  if(!range?.start?.raw)return "Date needs review";
  return range.end?range.start.raw+" - "+range.end.raw:range.start.raw;
}

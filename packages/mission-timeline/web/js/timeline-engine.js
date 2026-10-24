export function parseMonth(value){
  if(!/^\d{4}-\d{2}$/.test(String(value||"")))return null;
  const [y,m]=String(value).split("-").map(Number);
  if(m<1||m>12)return null;
  return {year:y,month:m,index:y*12+(m-1)};
}

export function monthIndex(value){
  const p=parseMonth(value);
  return p?p.index:null;
}

export function monthString(index){
  const y=Math.floor(index/12);
  const m=index-y*12+1;
  return `${y}-${String(m).padStart(2,"0")}`;
}

export function monthLabel(value){
  const p=parseMonth(value);
  if(!p)return "Unknown";
  return new Date(p.year,p.month-1,1).toLocaleString("en-US",{month:"short",year:"numeric"});
}

export function eventRange(event){
  const s=monthIndex(event.startDate);
  const e=event.eventType==="milestone"?s:monthIndex(event.endDate||event.startDate);
  return {start:s,end:e==null?s:e};
}

export function axisForEvents(events,profile={}){
  const visible=events.filter((e)=>e.visibility!=="hidden");
  const months=[];
  visible.forEach((event)=>{
    const r=eventRange(event);
    if(r.start!=null)months.push(r.start);
    if(r.end!=null)months.push(r.end);
  });
  const grad=profile.graduationDate?monthIndex(profile.graduationDate):null;
  if(grad!=null)months.push(grad);
  const now=new Date();
  const fallbackStart=now.getFullYear()*12;
  const min=months.length?Math.min(...months):fallbackStart;
  const max=months.length?Math.max(...months):fallbackStart+36;
  const y0=Math.floor(min/12);
  const y1=Math.max(y0+2,Math.floor(max/12)+1);
  return {y0,y1,start:y0*12,end:(y1+1)*12-1,total:(y1-y0+1)*12};
}

export function leftPct(month,axis){
  if(month==null)return 0;
  return Math.max(0,Math.min(96,((month-axis.start)/axis.total)*96+2));
}

export function widthPct(start,end,axis){
  if(start==null)return 4;
  const e=end==null?start:end;
  return Math.max(4,((e-start+1)/axis.total)*96);
}

export function rangesOverlap(a,b,pad=0){
  return a.start<=b.end+pad&&b.start<=a.end+pad;
}

export function clone(value){
  return JSON.parse(JSON.stringify(value));
}


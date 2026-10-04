// Preserve source date precision independently of presentation layout.
export const presentationDayDate=value=>{
 const raw=String(value??'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
 const [year,month,day]=raw.split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?raw:null;
};

export const presentationDateWording=(v,p,source)=>{
 if(!v||p==='UNKNOWN')return 'Date needed';
 if(p==='DAY'){
  const exact=presentationDayDate(v)||presentationDayDate(source?.normalizedMonth);
  if(!exact||(exact!==v&&exact.slice(0,7)!==v))return 'Date needed';
  const [year,month,day]=exact.split('-');
  return `${Number(month)}/${Number(day)}/${year.slice(2)}`;
 }
 if(source?.raw&&source.normalizedMonth===v&&['SEASON','VAGUE_RANGE'].includes(p))return String(source.raw);
 if(['SEASON','VAGUE_RANGE'].includes(p))return String(v).slice(0,4)+' (approximate; review source)';
 return p==='YEAR'?String(v).slice(0,4):String(v).replace(/^(\d{4})-(\d{2})$/,(_,y,m)=>`${Number(m)}/${y.slice(2)}`);
};

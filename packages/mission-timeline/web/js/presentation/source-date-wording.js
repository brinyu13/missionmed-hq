// Preserve source date precision independently of presentation layout.
export const presentationDateWording=(v,p,source)=>{
 if(!v)return 'Date needed';
 if(source?.raw&&source.normalizedMonth===v&&['SEASON','VAGUE_RANGE'].includes(p))return String(source.raw);
 if(['SEASON','VAGUE_RANGE'].includes(p))return String(v).slice(0,4)+' (approximate; review source)';
 return p==='YEAR'?String(v).slice(0,4):String(v).replace(/^(\d{4})-(\d{2})$/,(_,y,m)=>`${Number(m)}/${y.slice(2)}`);
};

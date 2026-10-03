import { AppError, requireValue } from './errors.mjs';

export function validZone(zone) {
  if (typeof zone!=='string' || zone.length>80) return false;
  try { new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(); return true; } catch { return false; }
}
export function validDate(date) {
  if (typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d=new Date(`${date}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===date && Number(date.slice(0,4))>=2000 && Number(date.slice(0,4))<=2100;
}
function parts(date,zone) {
  const values=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
  return values;
}
function wallAt(date,zone) { const p=parts(date,zone); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`; }
function offsetAt(date,zone) { const p=parts(date,zone); return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-date.getTime())/60000); }

export function resolveWall(wall,zone) {
  requireValue(validZone(zone),'invalid_timezone','Choose a valid named time zone.');
  requireValue(typeof wall==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:00)?$/.test(wall) && validDate(wall.slice(0,10)) && +wall.slice(11,13)<24 && +wall.slice(14,16)<60,'invalid_wall_time','Enter a valid local date and time.');
  const normalized=wall.slice(0,16)+':00', guess=new Date(normalized+'Z').getTime();
  const offsets=new Set([-48,-24,-1,0,1,24,48].map(h=>offsetAt(new Date(guess+h*3600000),zone)));
  const candidates=[];
  for (const offset of offsets) {
    const candidate=new Date(guess-offset*60000);
    if (wallAt(candidate,zone)===normalized) candidates.push({instant:candidate.toISOString(),offset});
  }
  return candidates.sort((a,b)=>a.instant.localeCompare(b.instant)).map((x,fold)=>({...x,fold}));
}

export function schedule(data) {
  const zone=data.zone ?? 'America/New_York';
  requireValue(validZone(zone),'invalid_timezone','Choose a valid named time zone.');
  const date=data.date || null, time=data.time || null;
  const wall=data.wall || (date && time ? `${date}T${time}` : null);
  requireValue(!date || validDate(date),'invalid_date','Enter a valid date.');
  requireValue(!time || Boolean(date || wall),'date_required','Choose the date for this time.');
  const number=(value,label,max)=>{
    if (value===null || value===undefined || value==='') return null;
    requireValue(typeof value==='number' && Number.isInteger(value) && value>=0 && value<=max,`invalid_${label}`,`Enter a valid ${label.replaceAll('_',' ')}.`);
    return value;
  };
  const duration=number(data.duration,'duration',1440),travel_minutes=number(data.travel_minutes,'travel_buffer',10080);
  requireValue(duration!==0,'invalid_duration','Duration must be positive or unknown.');
  const format=data.format || 'unknown';
  requireValue(['unknown','virtual','in person','hybrid','phone'].includes(format),'invalid_format','Choose a supported interview format.');
  requireValue(typeof (data.joining ?? '')==='string' && (data.joining ?? '').length<=4000,'invalid_joining','Joining details are too long.');
  let instant=null,fold=null,resolvedDate=date;
  if (wall) {
    requireValue(!date || date===wall.slice(0,10),'date_mismatch','The date and local time disagree.');
    const candidates=resolveWall(wall,zone);
    if (!candidates.length) throw new AppError(422,'dst_gap','This local time does not exist. Choose a different time.');
    if (candidates.length>1 && (data.fold===null || data.fold===undefined || data.fold===''))
      throw new AppError(422,'dst_fold_required','This local time occurs twice. Choose the intended offset.',{candidates});
    const chosen=data.fold===null || data.fold===undefined || data.fold==='' ? 0 : data.fold;
    requireValue(Number.isInteger(chosen) && Boolean(candidates[chosen]),'invalid_fold','Choose one of the available time offsets.');
    ({instant,fold}=candidates[chosen]); resolvedDate=wall.slice(0,10);
  } else requireValue(data.fold===null || data.fold===undefined || data.fold==='','time_required','A daylight-saving selection requires a time.');
  return {date:resolvedDate,wall:wall ? wall.slice(0,16)+':00' : null,zone,instant,fold,duration,travel_minutes,format,joining:data.joining ?? ''};
}

export function conflicts(first,second) {
  if (!first.instant || !second.instant) return {kind:'unknown'};
  const a=Date.parse(first.instant),b=Date.parse(second.instant);
  if (first.duration===null || second.duration===null) {
    return Math.abs(a-b)<=24*3600000 ? {kind:'possible',reason:'Duration is unknown.'} : {kind:'none'};
  }
  if (a<b+second.duration*60000 && b<a+first.duration*60000) return {kind:'overlap'};
  const [early,late]=a<=b ? [first,second] : [second,first];
  const gap=(Date.parse(late.instant)-Date.parse(early.instant))/60000-early.duration;
  if (early.format==='in person' || late.format==='in person') {
    if (late.travel_minutes===null) return gap<24*60 ? {kind:'possible',reason:'Travel time is unknown.'} : {kind:'none'};
    if (gap<late.travel_minutes) return {kind:'travel',gap};
  }
  return {kind:'none'};
}

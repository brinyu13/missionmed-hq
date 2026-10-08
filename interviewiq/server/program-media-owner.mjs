import {AppError} from './errors.mjs';
import {parseMediaCandidate,heroFor} from './program-media.mjs';
const fail=()=>{throw new AppError(503,'program_media_unavailable','Approved program imagery is unavailable.');};
export function projectOwnerMedia(input,program,now=Date.now()){
 const need=x=>{if(!x)fail();},plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
 need(plain(input)&&input.schema==='rise-program-media-v1'&&input.programId===program.id&&input.registryReleaseId===program.registryReleaseId&&typeof input.observedAt==='string'&&new Date(input.observedAt).toISOString()===input.observedAt&&Date.parse(input.observedAt)<=now&&now-Date.parse(input.observedAt)<=300000);
 if(input.media===null)return null;const m=input.media;
 need(plain(m)&&m.programId===program.id&&m.registryReleaseId===program.registryReleaseId&&m.approvalState==='APPROVED'&&m.category==='INSTITUTION_EXTERIOR'&&Number.isSafeInteger(m.revision)&&m.revision>0&&/^[a-f0-9-]{36}$/.test(m.mediaId)&&/^[a-f0-9]{64}$/.test(m.assetSha256)&&Number.isSafeInteger(m.assetBytes)&&m.assetBytes>0&&m.assetBytes<=2000000&&typeof m.validThrough==='string'&&Number.isFinite(Date.parse(m.validThrough))&&Date.parse(m.validThrough)>now&&Date.parse(m.validThrough)<=now+366*86400000);
 function url(x,asset=false){need(typeof x==='string'&&x.length<=2048);let u;try{u=new URL(x);}catch{fail();}need(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&!u.port&&u.hostname.includes('.')&&!/[\[\]:]/.test(u.hostname)&&!/^\d[\d.]*$/.test(u.hostname)&&!/(^|\.)(localhost|local|internal|private|invalid|test|example|lan|home|home\.arpa)$/.test(u.hostname));if(asset)need(u.origin==='https://upload.wikimedia.org'&&/^\/wikipedia\/commons\/[a-f0-9]\/[a-f0-9]{2}\/[A-Za-z0-9_().%+,-]+\.(?:jpe?g|png|webp)$/i.test(u.pathname)&&!/%(?:2f|5c|00|2e)/i.test(u.pathname));return u.href;}
 const candidate=parseMediaCandidate({schema:'iiq-program-media-candidate-v1',sourceUrl:url(m.sourceUrl),assetRef:url(m.url,true),publisher:m.publisher,programId:m.programId,registryReleaseId:m.registryReleaseId,category:m.category,caption:m.caption,alt:m.alt,verifiedAt:m.verifiedAt,identityConfidence:m.identityConfidence,licenseState:m.licenseState,approvalState:m.approvalState,discoveredBy:'IMPORT',notes:''});const hero=heroFor([candidate],program.id);need(hero);
 for(const [key,max] of [['attribution',500],['changes',300],['institution',300],['dateConflict',500]])need(typeof m[key]==='string'&&m[key].length<=max&&!/[\u0000-\u001f\u007f]/.test(m[key]));need(plain(m.photoDates)&&Object.keys(m.photoDates).length===2&&['page','exif'].every(k=>m.photoDates[k]===null||/^\d{4}-\d\d-\d\d$/.test(m.photoDates[k])));if(m.dateConflict)need(/Historical photograph; source dates differ\./.test(m.caption));
 return {...hero,mediaId:m.mediaId,revision:m.revision,registryReleaseId:m.registryReleaseId,assetSha256:m.assetSha256,assetBytes:m.assetBytes,validThrough:m.validThrough,licenseUrl:url(m.licenseUrl),attribution:m.attribution,changes:m.changes,institution:m.institution,dateConflict:m.dateConflict,photoDates:{page:m.photoDates.page,exif:m.photoDates.exif}};
}
export async function attachProgramMedia({state,actor,config,owners,programIds,now=Date.now()}){
 state.programMedia=Object.create(null);
 if(config?.programMediaEnabled!==true||config?.rise?.programMediaEnabled!==true||actor?.eligible!==true||!['student','admin'].includes(actor.role)||typeof owners?.getProgramMedia!=='function')return;
 const ids=[...new Set(programIds)].filter(x=>typeof x==='string'&&/^rise_[A-Za-z0-9._:-]{1,174}$/.test(x)).sort().slice(0,8);
 await Promise.allSettled(ids.map(async id=>{const result=await owners.getProgramMedia(actor,id);if(result)state.programMedia[id]=[result];}));
}

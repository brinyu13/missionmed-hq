import {createHash} from 'node:crypto';
import {AppError,requireValue} from './errors.mjs';
import {UUID} from './auth.mjs';

// Copy-adapted from approved StoryForge storage donor (3cffc77). Dedicated IIQ
// configuration is mandatory; no StoryForge bucket, prefix or credential fallback.
export const MAX_AUDIO_BYTES=1048576;
const extensions={'audio/webm':'webm','audio/mp4':'m4a','audio/ogg':'ogg','audio/wav':'wav'};
export function audioMime(value){const type=String(value||'').split(';',1)[0].trim().toLowerCase();requireValue(extensions[type],'invalid_audio_type','This audio format is unsupported.');return type;}
export function audioObjectKey({prefix,ownerId,recordingId,segmentId,seq,contentType}){
  requireValue(typeof prefix==='string'&&/^interviewiq(?:[-/][a-z0-9-]+)*$/.test(prefix),'invalid_audio_prefix','A dedicated InterviewIQ storage prefix is required.',503);
  for(const id of [ownerId,recordingId,segmentId])requireValue(UUID.test(id),'invalid_audio_identity','Audio identity is invalid.');
  requireValue(Number.isSafeInteger(seq)&&seq>=0&&seq<=10000,'invalid_sequence','Audio sequence is invalid.');
  return `${prefix}/${ownerId}/${recordingId}/${String(seq).padStart(5,'0')}-${segmentId}.${extensions[audioMime(contentType)]}`;
}
export function assertAudioSignature(bytes,contentType){
  requireValue(Buffer.isBuffer(bytes)&&bytes.length>=12&&bytes.length<=MAX_AUDIO_BYTES,'invalid_audio_size','Audio segments must be between 12 bytes and 1 MiB.');
  const type=audioMime(contentType),hex=bytes.subarray(0,16).toString('hex');
  const valid=type==='audio/webm'?hex.startsWith('1a45dfa3'):type==='audio/mp4'?bytes.subarray(4,8).toString('ascii')==='ftyp':type==='audio/ogg'?bytes.subarray(0,4).toString('ascii')==='OggS':bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WAVE';
  requireValue(valid,'invalid_audio_container','The segment is not a complete supported audio container.');
  return type;
}
function unavailable(){return new AppError(503,'audio_storage_unavailable','Private audio storage is unavailable. Your edited account is unchanged.');}
export async function createPrivateAudioStorage({endpoint,region='auto',bucket,accessKeyId,secretAccessKey,prefix,sdk,client}={}){
  let origin;try{origin=new URL(endpoint);}catch{throw unavailable();}
  requireValue(origin.protocol==='https:'&&!origin.username&&!origin.password&&!origin.search&&!origin.hash&&origin.pathname==='/'&&/\.r2\.cloudflarestorage\.com$/.test(origin.hostname),'invalid_audio_endpoint','Private audio storage must use its approved R2 endpoint.',503);
  requireValue(typeof bucket==='string'&&/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)&&accessKeyId&&secretAccessKey,'audio_storage_unavailable','Dedicated private audio storage configuration is required.',503);
  audioObjectKey({prefix,ownerId:'11111111-1111-4111-8111-111111111111',recordingId:'22222222-2222-4222-8222-222222222222',segmentId:'33333333-3333-4333-8333-333333333333',seq:0,contentType:'audio/webm'});
  const lib=sdk||await import('@aws-sdk/client-s3');
  const s3=client||new lib.S3Client({endpoint:origin.origin,region,forcePathStyle:true,credentials:{accessKeyId,secretAccessKey},maxAttempts:2});
  function scoped({objectKey,ownerId,recordingId}){
    requireValue(UUID.test(ownerId)&&UUID.test(recordingId)&&typeof objectKey==='string'&&objectKey.startsWith(`${prefix}/${ownerId}/${recordingId}/`)&&!objectKey.includes('..')&&!objectKey.includes('\\')&&!objectKey.includes('://'),'invalid_audio_scope','The recording object is outside this account.',403);
    const tail=objectKey.slice(`${prefix}/${ownerId}/${recordingId}/`.length);requireValue(/^\d{5}-[0-9a-f-]{36}\.(webm|m4a|ogg|wav)$/i.test(tail),'invalid_audio_key','The recording object key is invalid.');
    return objectKey;
  }
  async function put(input){
    const Key=scoped(input),body=Buffer.from(input.body),contentType=assertAudioSignature(body,input.contentType),sha256=createHash('sha256').update(body).digest('hex');
    requireValue(sha256===input.sha256,'audio_digest_mismatch','Audio digest does not match the reserved segment.');
    try{await s3.send(new lib.PutObjectCommand({Bucket:bucket,Key,Body:body,ContentType:contentType,ContentLength:body.length,IfNoneMatch:'*',Metadata:{sha256,owner:input.ownerId,recording:input.recordingId},CacheControl:'private, no-store'}));}
    catch(error){
      if(!['PreconditionFailed','ConditionalRequestConflict'].includes(error?.name)&&![409,412].includes(error?.$metadata?.httpStatusCode))throw unavailable();
      let head;try{head=await s3.send(new lib.HeadObjectCommand({Bucket:bucket,Key}));}catch{throw unavailable();}
      requireValue(head.Metadata?.sha256===sha256&&Number(head.ContentLength)===body.length&&audioMime(head.ContentType)===contentType,'audio_replay_conflict','The stored segment differs from this retry.',409);
    }
    return {sha256,byteSize:body.length};
  }
  async function get(input){
    let result;try{result=await s3.send(new lib.GetObjectCommand({Bucket:bucket,Key:scoped(input)}));}catch(error){if(error?.status)throw error;throw unavailable();}
    requireValue(Number.isFinite(Number(result.ContentLength))&&Number(result.ContentLength)>0&&Number(result.ContentLength)<=MAX_AUDIO_BYTES,'invalid_audio_size','Stored audio exceeds the segment limit.',503);
    const chunks=[];let length=0;
    try{for await(const chunk of result.Body){length+=chunk.length;if(length>MAX_AUDIO_BYTES)throw unavailable();chunks.push(Buffer.from(chunk));}}catch{result.Body?.destroy?.();throw unavailable();}
    const bytes=Buffer.concat(chunks);assertAudioSignature(bytes,result.ContentType);return bytes;
  }
  return Object.freeze({configured:true,prefix,put,get});
}

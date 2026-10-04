import { createHash } from 'node:crypto';
import { UUID } from './auth.mjs';
import { AppError,requireValue } from './errors.mjs';

export function object(value,label='data') {
  requireValue(value!==null && typeof value==='object' && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype,'invalid_object',`${label} must be an object.`);
  requireValue(!Object.keys(value).some(k=>['__proto__','constructor','prototype'].includes(k)),'invalid_object',`${label} has an invalid field.`);
  return value;
}
export function text(value,label,max=1000,{empty=true}={}) {
  requireValue(typeof value==='string' && value.length<=max && (empty || value.trim().length>0) && !value.includes('\u0000'),'invalid_text',`${label} is missing or too long.`);
  return value;
}
export function uuid(value,label='Record') {
  requireValue(typeof value==='string' && UUID.test(value),'invalid_identifier',`${label} identifier is invalid.`);
  return value;
}
export function integer(value,label,min=0,max=10000) {
  requireValue(Number.isSafeInteger(value) && value>=min && value<=max,'invalid_integer',`${label} must be between ${min} and ${max}.`);return value;
}
export function choice(value,choices,label) {
  requireValue(choices.includes(value),'invalid_choice',`Choose a valid ${label}.`);return value;
}
export function boolean(value,label) {
  requireValue(typeof value==='boolean','invalid_boolean',`${label} must be confirmed explicitly.`);return value;
}
export function array(value,label,max=100) {
  requireValue(Array.isArray(value) && value.length<=max,'invalid_array',`${label} has too many entries.`);return value;
}
export function onlyKeys(value,allowed) {
  object(value);const keys=Object.keys(value).filter(k=>!allowed.includes(k));
  if(keys.length) throw new AppError(422,'unexpected_fields','This request contains unsupported fields.');
}
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
export function digest(value) {return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export function commandEnvelope(body) {
  onlyKeys(body,['command','interviewId','data','requestId','expectedVersion']);
  text(body.command,'Command',80,{empty:false});
  requireValue(/^[a-z]+\.[a-z]+$/.test(body.command),'invalid_command','The command is invalid.');
  uuid(body.requestId,'Request');integer(body.expectedVersion,'Version',0,Number.MAX_SAFE_INTEGER);
  if(body.interviewId!==undefined && body.interviewId!==null) uuid(body.interviewId,'Interview');
  object(body.data ?? {},'Command data');
  const canonicalBody={command:body.command,interviewId:body.interviewId || null,data:body.data ?? {}};
  return {...canonicalBody,requestId:body.requestId,expectedVersion:body.expectedVersion,bodyHash:digest(canonicalBody)};
}

export async function jsonBody(request,maximum=262144) {
  requireValue(/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type']||'')),'json_required','Send JSON data.',415);
  const claimed=Number(request.headers['content-length']);
  requireValue(!Number.isFinite(claimed) || claimed<=maximum,'payload_too_large','This request is too large.',413);
  const pieces=[];let size=0;
  for await(const chunk of request) {
    size+=chunk.length;
    if(size>maximum) throw new AppError(413,'payload_too_large','This request is too large.');
    pieces.push(chunk);
  }
  try {return object(JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(pieces))));} catch(error) {
    if(error instanceof AppError)throw error;
    throw new AppError(400,'invalid_json','The request could not be read.');
  }
}

// IIQ-1204 — Program media candidate / provenance contract (InterviewIQ side).
//
// Founder requirement: research can discover a hospital/institution exterior image
// candidate → provenance → canonical program match → approval → reusable program
// media → promotion into canonical RISE program media.
//
// This pure validator never mutates RISE; program-media-owner.mjs consumes the governed owner projection.
// It defines the pure, validated InterviewIQ-side candidate record, the approval
// state machine and the projection the client uses to decide whether an image may
// be shown as a program hero. Promotion into RISE is a protected owner action
// (see PROMOTION_PROPOSAL) that Codex must wire; nothing here performs it.
import {AppError,requireValue} from './errors.mjs';
import * as v from './validation.mjs';

export const MEDIA_CATEGORIES=Object.freeze(['INSTITUTION_EXTERIOR','CAMPUS','DEPARTMENT','LOGO','OTHER']);
export const APPROVAL_STATES=Object.freeze(['CANDIDATE','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN']);
export const IDENTITY_CONFIDENCE=Object.freeze(['VERIFIED','HIGH','MEDIUM','LOW','UNKNOWN']);
export const LICENSE_STATES=Object.freeze(['PUBLISHER_TERMS','CREATIVE_COMMONS','PUBLIC_DOMAIN','PERMISSION_GRANTED','UNKNOWN','NOT_PERMITTED']);
export const MEDIA_SCHEMA='iiq-program-media-candidate-v1';
// Legal transitions. Approval always requires an explicit human decision; nothing auto-approves.
const TRANSITIONS=Object.freeze({CANDIDATE:['UNDER_REVIEW','REJECTED','WITHDRAWN'],UNDER_REVIEW:['APPROVED','REJECTED','WITHDRAWN'],APPROVED:['WITHDRAWN','REJECTED'],REJECTED:['UNDER_REVIEW'],WITHDRAWN:[]});
const CANDIDATE_KEYS=['schema','sourceUrl','publisher','assetRef','programId','registryReleaseId','category','caption','alt','verifiedAt','identityConfidence','licenseState','approvalState','discoveredBy','notes'];
const DATE=/^\d{4}-\d{2}-\d{2}$(?![\s\S])/;
const PROGRAM_ID=/^rise_[A-Za-z0-9._:-]{1,174}$(?![\s\S])/;
function httpsUrl(value,label){requireValue(typeof value==='string'&&value.length<=2048,'invalid_url',`${label} must be an https URL.`);let u;try{u=new URL(value);}catch{throw new AppError(422,'invalid_url',`${label} must be an https URL.`);}requireValue(u.protocol==='https:'&&!u.username&&!u.password,'invalid_url',`${label} must be an https URL.`);return u.toString();}
export function parseMediaCandidate(data){
 v.onlyKeys(data,CANDIDATE_KEYS);
 requireValue(data.schema===undefined||data.schema===MEDIA_SCHEMA,'invalid_schema','Unsupported program media schema.');
 const out={schema:MEDIA_SCHEMA,sourceUrl:httpsUrl(data.sourceUrl,'Source URL'),publisher:v.text(data.publisher,'Publisher',200,{empty:false}).trim(),assetRef:httpsUrl(data.assetRef,'Asset reference'),programId:data.programId,registryReleaseId:v.text(data.registryReleaseId,'Registry release',200,{empty:false}),category:v.choice(data.category,MEDIA_CATEGORIES,'image category'),caption:v.text(data.caption??'','Caption',300),alt:v.text(data.alt,'Alt text',300,{empty:false}).trim(),verifiedAt:data.verifiedAt,identityConfidence:v.choice(data.identityConfidence??'UNKNOWN',IDENTITY_CONFIDENCE,'identity confidence'),licenseState:v.choice(data.licenseState??'UNKNOWN',LICENSE_STATES,'licensing state'),approvalState:v.choice(data.approvalState??'CANDIDATE',APPROVAL_STATES,'approval state'),discoveredBy:v.choice(data.discoveredBy??'RESEARCH',['RESEARCH','STUDENT','ADMIN','IMPORT'],'discovery source'),notes:v.text(data.notes??'','Notes',2000)};
 requireValue(typeof out.programId==='string'&&PROGRAM_ID.test(out.programId),'invalid_identifier','A canonical RISE program identifier is required.');
 requireValue(typeof out.verifiedAt==='string'&&DATE.test(out.verifiedAt)&&!Number.isNaN(Date.parse(out.verifiedAt)),'invalid_date','Verification date must be YYYY-MM-DD.');
 // A candidate can be recorded as APPROVED only when identity and licensing are both established.
 if(out.approvalState==='APPROVED')requireValue(['VERIFIED','HIGH'].includes(out.identityConfidence)&&out.licenseState!=='UNKNOWN'&&out.licenseState!=='NOT_PERMITTED','media_not_approvable','Approved media requires verified identity and a known permitted license.');
 return Object.freeze(out);
}
export function canTransition(from,to){return Array.isArray(TRANSITIONS[from])&&TRANSITIONS[from].includes(to);}
export function transitionMedia(candidate,to,{decidedBy,reason=''}={}){
 requireValue(candidate&&typeof candidate==='object'&&APPROVAL_STATES.includes(candidate.approvalState),'invalid_object','Program media candidate is invalid.');
 requireValue(canTransition(candidate.approvalState,to),'invalid_transition',`Cannot move program media from ${candidate.approvalState} to ${to}.`,409);
 requireValue(typeof decidedBy==='string'&&decidedBy.trim().length>0,'decision_required','A named human decision is required for program media.');
 if(to==='APPROVED')requireValue(['VERIFIED','HIGH'].includes(candidate.identityConfidence)&&candidate.licenseState!=='UNKNOWN'&&candidate.licenseState!=='NOT_PERMITTED','media_not_approvable','Approved media requires verified identity and a known permitted license.');
 return Object.freeze({...candidate,approvalState:to,decision:Object.freeze({by:decidedBy.trim(),reason:v.text(reason,'Reason',1000),from:candidate.approvalState,to})});
}
// Client projection: only approved institution exteriors matched to the exact canonical program may ever be shown as a hero.
export function heroEligible(candidate,programId){return !!(candidate&&candidate.approvalState==='APPROVED'&&candidate.category==='INSTITUTION_EXTERIOR'&&candidate.programId===programId&&['VERIFIED','HIGH'].includes(candidate.identityConfidence)&&candidate.licenseState!=='UNKNOWN'&&candidate.licenseState!=='NOT_PERMITTED');}
export function heroFor(candidates,programId){if(!Array.isArray(candidates))return null;const list=candidates.filter(c=>heroEligible(c,programId)).sort((a,b)=>(IDENTITY_CONFIDENCE.indexOf(a.identityConfidence)-IDENTITY_CONFIDENCE.indexOf(b.identityConfidence))||String(b.verifiedAt).localeCompare(String(a.verifiedAt)));const c=list[0];return c?Object.freeze({programId:c.programId,url:c.assetRef,alt:c.alt,caption:c.caption,publisher:c.publisher,sourceUrl:c.sourceUrl,category:c.category,approvalState:c.approvalState,verifiedAt:c.verifiedAt,licenseState:c.licenseState}):null;}
export function programMediaProjection(candidates){const out=Object.create(null);for(const c of Array.isArray(candidates)?candidates:[]){if(!c||typeof c.programId!=='string')continue;const h=heroFor([c],c.programId);if(h)(out[c.programId]||=[]).push(h);}return out;}
// Protected owner action for Codex. InterviewIQ never calls RISE with this; it is the documented adapter proposal.
export const PROMOTION_PROPOSAL=Object.freeze({owner:'RISE',action:'program-media.promote',authority:'Codex / MissionMed production owner',requires:['approvalState=APPROVED','identityConfidence in VERIFIED|HIGH','licenseState permitted','registryReleaseId matches current release'],payload:Object.freeze(['programId','registryReleaseId','category','assetRef','sourceUrl','publisher','caption','alt','verifiedAt','identityConfidence','licenseState','decision']),status:'SOURCE_CANDIDATE_DEFAULT_OFF — governed RISE program-media storage/read projection; explicit human approval required'});

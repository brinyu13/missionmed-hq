/* The one place engine language becomes student language. Every string a student can
   read - toast, banner, tooltip, live region, field error - passes through here. The
   untranslated text never reaches the screen; it stays on the console and in data
   attributes so support can still see what actually failed. */

export const STUDENT_FALLBACKS=Object.freeze({
  generic:"Something went wrong on our side. Your work is safe on this device, so please try again.",
  save:"We couldn't save just now. We'll keep trying, and your work is safe on this device.",
  open:"Your timeline is still getting ready. Give it a moment and try again.",
  layout:"We kept your previous layout while we worked on this change.",
  media:"That image couldn't be added. Try a different PNG, JPG, WEBP, or GIF.",
  document:"We couldn't read that document. Try uploading it again, or use a different PDF or Word file.",
  export:"We couldn't finish that export. Your timeline is safe, so please try again.",
  access:"Timeline Builder isn't available on this account right now. Contact MissionMed and we'll sort it out."
});

/* Anything matching these reads as engineering, not as help. A message that trips one of
   them is replaced rather than shown. */
const INTERNAL_LANGUAGE=Object.freeze([
  /\bcanonical\w*/i,
  /\bkernels?\b/i,
  /\bfingerprints?\b/i,
  /\bprincipals?\b/i,
  /\brenderers?\b/i,
  /\brevisions?\b/i,
  /\buuid\b/i,
  /\bservices?\b/i,
  /\badapters?\b/i,
  /\bprojections?\b/i,
  /\bsurfaces?\b/i,
  /\btaxonom(?:y|ies)\b/i,
  /\bingestion\b/i,
  /\bprovenance\b/i,
  /\bentitlements?\b/i,
  /\brls\b/i,
  /\bobject[ -]?(?:keys?|ids?|stores?)\b/i,
  /\bsigned[ -]urls?\b/i,
  /\bindexed\s?db\b/i,
  /\bblobs?\b/i,
  /\bsha-?256\b/i,
  /\bschema\b/i,
  /\bwordpress\b/i,
  /\bmetadata\b/i,
  /\bpayloads?\b/i,
  /\bnot implemented\b/i,
  /\bD1[-_ ]?\d{3}[a-z0-9-]*/i,
  /\buxr[-_ ]?\d+/i,
  /\b4(?:0[5-9]|1[0-9])[a-z]\b/i,
  /\bTimeline(?:Artifact|Document|Store)\b/,
  /[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/
]);

const CODE_LANGUAGE=Object.freeze({
  TEXT_FIT_UNRESOLVED:"We resized that text so it fits on your timeline.",
  OBJECT_OUT_OF_BOUNDS:"Move this item back onto the board, or let Timeline arrange it for you.",
  EXISTING_LAYOUT_OVERLAP_RECOVERED:"We kept your previous layout while we worked on this change.",
  ASSET_LOAD_FAILED:"One of your images didn't load. Everything else on your timeline is fine.",
  MEDIA_HASH_MISMATCH:"One of your images didn't load. Everything else on your timeline is fine.",
  IMAGE_DECODE_FAILED:"That image couldn't be opened. Try a different PNG, JPG, WEBP, or GIF.",
  INDEXED_DB_UNAVAILABLE:"This browser is blocking Timeline from saving on this device. Try again in a normal window rather than a private one.",
  EXPORT_APPROVAL_REQUIRED:"Finish the Review and Finish checklist before you export.",
  TIMELINE_ENTITLEMENT_REQUIRED:"Your timeline is read-only right now. Contact MissionMed to start editing again.",
  ARTIFACT_NOT_FOUND:"We couldn't find that saved timeline. Your current work is safe on this device.",
  INTAKE_EXTRACTION_ADAPTER_REQUIRED:"We couldn't read that document. Try uploading it again.",
  INTAKE_ACCEPTED_CANDIDATE_INVALID:"We found a few items that need your review before they can be added.",
  D1_408_CANDIDATE_REQUIRED:"We couldn't read that document. Try uploading it again.",
  D1_408_CATEGORY_UNMAPPABLE:"We found an item we couldn't sort into a category. Choose one for it and continue.",
  TIMELINE_BOOTSTRAP_FAILED:"Timeline couldn't finish opening. Your work on this device is safe.",
  LEGACY_DELETE_ENDPOINT_UNKNOWN:"We couldn't remove that just now. Please try again.",
  OCR_REQUIRED:"This file is a scan, so we can't read its text. Paste the text instead, or upload the original file."
});

const MESSAGE_LANGUAGE=Object.freeze([
  [/kernel|canonical timeline frame|projection is unavailable|render failed/i,"Your timeline is still getting ready. Give it a moment and try again."],
  [/indexed\s?db|object ?(?:store|key|id)|transaction (?:aborted|failed)|persistence key/i,"We couldn't save that just now. We'll keep trying, and your work is safe on this device."],
  [/omission limit|could not be loaded|did not load|decode|hash mismatch/i,"Some images couldn't be loaded. Everything else on your timeline is safe."],
  [/unauthori[sz]ed|forbidden|not permitted|permission denied|entitlement|read-only/i,"You don't have access to that right now. Contact MissionMed if that looks wrong."],
  [/still syncing|finish syncing|pending/i,"We're still saving your latest changes. Give it a moment and try again."],
  [/upload|media|image|photo|logo/i,"That image couldn't be added. Try a different PNG, JPG, WEBP, or GIF."],
  [/pdf|docx|document|extract|ocr/i,"We couldn't read that document. Try uploading it again, or use a different PDF or Word file."]
]);

/* Access denials arrive as configuration codes. Students get the consequence and the one
   action that resolves it, never the rule that produced it. */
const ACCESS_LANGUAGE=Object.freeze({
  ENTITLEMENT_GLOBALLY_DISABLED:"Timeline Builder is switched off for everyone right now. Check back soon.",
  NO_MATCHING_ENTITLEMENT:"Your MissionMed membership doesn't include Timeline Builder yet. Contact MissionMed to add it.",
  ENTITLEMENT_INELIGIBLE:"Your MissionMed membership doesn't include Timeline Builder yet. Contact MissionMed to add it.",
  INDIVIDUAL_OVERRIDE_DENIED:"Timeline Builder isn't open on your account right now. Contact MissionMed to turn it back on.",
  MATCHING_ENTITLEMENTS_INACTIVE:"Your Timeline Builder access isn't active right now. Contact MissionMed to turn it back on.",
  ENTITLEMENT_EXPIRED:"Your Timeline Builder access has ended. Contact MissionMed to renew it.",
  ENTITLEMENT_DISABLED:"Your Timeline Builder access is turned off right now. Contact MissionMed to turn it back on.",
  ZERO_TIMELINE_ALLOWANCE:"Your membership doesn't include a timeline yet. Contact MissionMed to add one.",
  TIMELINE_ALLOWANCE_REACHED:"You've already used every timeline your membership includes. Contact MissionMed if you need another.",
  PRODUCTION_ENTITLEMENT_UNVERIFIED:"We couldn't confirm your MissionMed access just now. Sign in from your member dashboard and open Timeline Builder again.",
  PRODUCTION_ENTITLEMENT_MALFORMED:"We couldn't confirm your MissionMed access just now. Sign in from your member dashboard and open Timeline Builder again.",
  ENTITLEMENT_DENIED:STUDENT_FALLBACKS.access
});

const ACCESS_GRANTED_MESSAGE="You have full access to Timeline Builder.";

function rawText(input){
  if(input==null)return"";
  if(typeof input==="string")return input.trim();
  const text=typeof input.message==="string"&&input.message
    ?input.message
    :String(input);
  return text.replace(/^[A-Za-z]*Error:\s*/,"").trim();
}

function errorCode(input){
  return String(input?.code||input?.errorCode||"").trim().toUpperCase();
}

export function isStudentSafe(text){
  const value=String(text||"").trim();
  if(!value)return false;
  return !INTERNAL_LANGUAGE.some((pattern)=>pattern.test(value));
}

export function studentMessage(input,{context="generic",fallback=""}={}){
  const code=errorCode(input);
  if(code&&Object.hasOwn(CODE_LANGUAGE,code))return CODE_LANGUAGE[code];
  if(code&&Object.hasOwn(ACCESS_LANGUAGE,code))return ACCESS_LANGUAGE[code];
  const raw=rawText(input);
  if(isStudentSafe(raw))return raw;
  for(const[pattern,message]of MESSAGE_LANGUAGE){
    if(pattern.test(raw))return message;
  }
  return fallback||STUDENT_FALLBACKS[context]||STUDENT_FALLBACKS.generic;
}

export function studentDiagnostic(input){
  const code=errorCode(input);
  const raw=rawText(input);
  return[code,raw].filter(Boolean).join(": ")||"UNSPECIFIED";
}

export function studentError(input,{context="generic",fallback=""}={}){
  return Object.freeze({
    code:errorCode(input),
    message:studentMessage(input,{context,fallback}),
    diagnostic:studentDiagnostic(input)
  });
}

export function studentAccessMessage(denialCode,{readOnly=false}={}){
  const code=String(denialCode||"").trim().toUpperCase();
  if(!code)return ACCESS_GRANTED_MESSAGE;
  return ACCESS_LANGUAGE[code]||(
    readOnly
      ?"Your timeline is read-only right now. Contact MissionMed to start editing again."
      :STUDENT_FALLBACKS.access
  );
}

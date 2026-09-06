export const DOCUMENT_TYPES=Object.freeze({
  AUTO:"auto",
  ERAS:"eras",
  CV:"cv",
  RESUME:"resume",
  SCANNED:"scanned",
  UNKNOWN:"unknown"
});

const TYPE_LABELS={auto:"Auto detect",eras:"ERAS-style PDF",cv:"Traditional CV",resume:"Resume",scanned:"Scanned PDF",unknown:"Unknown or mixed document"};

export function normalizeDocumentType(value){
  const normalized=String(value||"").toLowerCase().replace(/[^a-z]/g,"");
  if(normalized==="eras"||normalized==="erasstyle")return DOCUMENT_TYPES.ERAS;
  if(normalized==="cv"||normalized==="curriculumvitae")return DOCUMENT_TYPES.CV;
  if(normalized==="resume")return DOCUMENT_TYPES.RESUME;
  if(normalized==="scan"||normalized==="scanned")return DOCUMENT_TYPES.SCANNED;
  if(normalized==="auto")return DOCUMENT_TYPES.AUTO;
  return DOCUMENT_TYPES.UNKNOWN;
}

export function documentTypeLabel(value){return TYPE_LABELS[normalizeDocumentType(value)]||TYPE_LABELS.unknown;}

export function detectDocumentType(text,declaredType=DOCUMENT_TYPES.AUTO){
  const sample=String(text||"").slice(0,120000).toLowerCase();
  const scores={eras:0,cv:0,resume:0,unknown:0};
  const evidence=[];
  const add=(type,points,label)=>{scores[type]+=points;evidence.push({type,points,label});};
  if(/electronic residency application service|aamc id|myeras|eras application/.test(sample))add("eras",55,"ERAS identity label");
  if(/experiences\s*\n|experience type:|most meaningful/.test(sample))add("eras",20,"ERAS experience fields");
  if(/medical school awards|medical education|postgraduate training/.test(sample))add("eras",12,"ERAS section vocabulary");
  if(/curriculum vitae/.test(sample))add("cv",45,"Curriculum Vitae heading");
  if(/education\s*\n|research experience|publications|presentations|professional memberships/.test(sample))add("cv",15,"CV section vocabulary");
  if(/professional summary|skills\s*\n|employment history|objective\s*\n/.test(sample))add("resume",35,"Resume section vocabulary");
  if(/references available upon request/.test(sample))add("resume",12,"Resume reference phrase");
  const declared=normalizeDocumentType(declaredType);
  if(["eras","cv","resume"].includes(declared))add(declared,8,"User-declared type");
  const ranked=Object.entries(scores).filter(([key])=>key!=="unknown").sort((a,b)=>b[1]-a[1]);
  const [detected,best]=ranked[0]||["unknown",0];
  const second=ranked[1]?.[1]||0;
  const confidence=best>=55&&best-second>=20?"HIGH":best>=25?"MEDIUM":best>=10?"LOW":"NEEDS_REVIEW";
  return {declaredType:declared,detectedType:best?detected:DOCUMENT_TYPES.UNKNOWN,confidence,scores,evidence:evidence.filter((item)=>item.type===detected),mismatch:!["auto","unknown"].includes(declared)&&declared!==detected};
}

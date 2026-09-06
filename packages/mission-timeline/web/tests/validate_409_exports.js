const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {execFileSync}=require("child_process");

const ROOT="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const DIR=path.join(ROOT,"evidence/409/exports");
const OUT=path.join(ROOT,"evidence/409");
const files=["interviewer_safe_1920x1080_409.png","full_story_1920x1080_409.png","interviewer_safe_2560x1440_409.png","print_ready_409.pdf","advisor_packet_409.pdf","student_archive_409.zip","timeline_document_sanitized_409.json","timeline_artifact_interviewer_safe_409.json"];

function hash(buffer){return crypto.createHash("sha256").update(buffer).digest("hex");}
function pngDimensions(buffer){return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};}
function command(executable,args){return execFileSync(executable,args,{encoding:"utf8"});}
function parsePdfInfo(text){return Object.fromEntries(text.trim().split(/\r?\n/).map((line)=>{const index=line.indexOf(":");return [line.slice(0,index).trim(),line.slice(index+1).trim()];}));}

const records=files.map((name)=>{const target=path.join(DIR,name),buffer=fs.readFileSync(target);return {name,path:target,size:buffer.length,sha256:hash(buffer),fileType:command("/usr/bin/file",["-b",target]).trim(),dimensions:name.endsWith(".png")?pngDimensions(buffer):null};});
const printInfo=parsePdfInfo(command("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdfinfo",[path.join(DIR,"print_ready_409.pdf")]));
const advisorInfo=parsePdfInfo(command("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdfinfo",[path.join(DIR,"advisor_packet_409.pdf")]));
const archiveTest=command("/usr/bin/unzip",["-t",path.join(DIR,"student_archive_409.zip")]);
const archiveDocument=command("/usr/bin/unzip",["-p",path.join(DIR,"student_archive_409.zip"),"timeline-document.json"]);
const sanitized=JSON.parse(fs.readFileSync(path.join(DIR,"timeline_document_sanitized_409.json"),"utf8"));
const artifact=JSON.parse(fs.readFileSync(path.join(DIR,"timeline_artifact_interviewer_safe_409.json"),"utf8"));
const sensitiveKeys=new Set(["rawText","rawExtraction","originalExtraction","sourceText","pageText","sourceExcerpt","extractedText","textContent","pdfBytes"]);
function hasSensitivePayload(value,path=[]){if(Array.isArray(value))return value.some((item,index)=>hasSensitivePayload(item,[...path,index]));if(!value||typeof value!=="object")return false;return Object.entries(value).some(([key,item])=>sensitiveKeys.has(key)||hasSensitivePayload(item,[...path,key]));}
const checks={
  png1920:records.filter((item)=>item.name.includes("1920x1080")).every((item)=>item.dimensions.width===1920&&item.dimensions.height===1080),
  png2560:records.find((item)=>item.name.includes("2560x1440")).dimensions.width===2560&&records.find((item)=>item.name.includes("2560x1440")).dimensions.height===1440,
  printPdfReadable:printInfo.Pages==="1"&&printInfo.Encrypted==="no"&&printInfo.JavaScript==="no",
  advisorPdfReadable:advisorInfo.Pages==="2"&&advisorInfo.Encrypted==="no"&&advisorInfo.JavaScript==="no",
  archiveReadable:/No errors detected/.test(archiveTest),
  archiveHasMedia:/media\/.+synthetic_story_1\.png/.test(archiveTest)&&/media\/.+synthetic_profile\.jpg/.test(archiveTest),
  sanitizedJsonHasNoRawSourceText:sanitized.metadata?.rawSourceTextIncluded===false&&!hasSensitivePayload(sanitized),
  archiveJsonHasNoRawSourceText:!hasSensitivePayload(JSON.parse(archiveDocument)),
  artifactHasNoRawSourceText:!hasSensitivePayload(artifact),
  artifactHashMatchesPng:artifact.contentHash===records.find((item)=>item.name==="interviewer_safe_1920x1080_409.png").sha256
};
const result={generatedAt:new Date().toISOString(),status:Object.values(checks).every(Boolean)?"PASS":"FAIL",checks,files:records,pdfInfo:{printReady:printInfo,advisorPacket:advisorInfo},limitations:["PDF pages are raster-image pages and are not tagged for assistive technology.","Archive uses stored ZIP entries rather than compression to keep the local writer small and deterministic."]};
fs.writeFileSync(path.join(OUT,"export_validation_409.json"),JSON.stringify(result,null,2)+"\n");
const lines=["# D1-409 External Export Validation","","- Status: "+result.status,"- Files checked: "+records.length,"- Print PDF pages: "+printInfo.Pages,"- Advisor packet pages: "+advisorInfo.Pages,"- ZIP integrity: "+(checks.archiveReadable?"PASS":"FAIL"),"- ZIP media inclusion: "+(checks.archiveHasMedia?"PASS":"FAIL"),"- Raw-source-text leak scan: "+(checks.sanitizedJsonHasNoRawSourceText&&checks.archiveJsonHasNoRawSourceText&&checks.artifactHasNoRawSourceText?"PASS":"FAIL"),"","| Check | Result |","|---|---|",...Object.entries(checks).map(([name,passed])=>"| "+name+" | "+(passed?"PASS":"FAIL")+" |"),"","## Limitations","",...result.limitations.map((item)=>"- "+item)];
fs.writeFileSync(path.join(OUT,"export_validation_409.md"),lines.join("\n")+"\n");
console.log(JSON.stringify({status:result.status,checks:Object.keys(checks).length,files:records.length}));
if(result.status!=="PASS")process.exitCode=1;

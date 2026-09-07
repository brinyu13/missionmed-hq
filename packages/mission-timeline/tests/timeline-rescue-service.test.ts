import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import test from "node:test";

import { extractPptx } from "../src/intelligence/timeline-rescue-pptx.js";
import { analyzeTimelineRescue, KEYNOTE_GUIDANCE } from "../src/intelligence/timeline-rescue-service.js";

function crc32(input: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, raw] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = typeof raw === "string" ? Buffer.from(raw) : Buffer.from(raw);
    const compressed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(entries).length, 8); eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}

function pptxFixture(): Uint8Array {
  return zip({
    "[Content_Types].xml": "<Types/>",
    "ppt/presentation.xml": '<p:presentation xmlns:p="p"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
    "ppt/slides/slide1.xml": `
      <p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:cNvPr id="2" name="Event"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1000000" y="2000000"/><a:ext cx="3000000" cy="500000"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="336699"/></a:solidFill></p:spPr><p:txBody><a:p><a:r><a:rPr sz="1800"/><a:t>Research Fellow 2021-2023</a:t></a:r></a:p></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="3" name="Year 2020"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1000000" y="5000000"/><a:ext cx="300000" cy="200000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>2020</a:t></a:r></a:p></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="4" name="Year 2024"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="5000000" y="5000000"/><a:ext cx="300000" cy="200000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>2024</a:t></a:r></a:p></p:txBody></p:sp>
        <p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="Grouped Event"/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="11" name="Clinical label"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="2600000" y="3000000"/><a:ext cx="1500000" cy="300000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Clinical Rotation</a:t></a:r></a:p></p:txBody></p:sp></p:grpSp>
        <p:pic><p:nvPicPr><p:cNvPr id="12" name="Student image"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/></p:blipFill><p:spPr><a:xfrm><a:off x="6000000" y="1000000"/><a:ext cx="1000000" cy="1000000"/></a:xfrm></p:spPr></p:pic>
      </p:spTree></p:cSld></p:sld>`,
    "ppt/slides/_rels/slide1.xml.rels": '<Relationships><Relationship Id="rId1" Target="../media/image1.png" Type="image"/></Relationships>',
    "ppt/media/image1.png": new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  });
}

function profilePptx({header="Ana Popescu",name="Ana Popescu",degree="MD",hiddenName="STALE Hidden Name"}={}): Uint8Array {
  const text=(id:number,role:string,value:string,y:number)=>`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="MM:${role}:profile:${id}"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="100000" y="${y}"/><a:ext cx="6000000" cy="200000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>${value}</a:t></a:r></a:p></p:txBody></p:sp>`;
  return zip({"[Content_Types].xml":"<Types/>","ppt/presentation.xml":'<p:presentation xmlns:p="p"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
    "ppt/slides/slide1.xml":`<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>${text(1,"event","Doctor of Medicine (MD) — Synthetic University — 2016-09–2022-06",1000000)}${text(2,"furniture",`Timeline: ${header}`,100000)}${text(3,"profile",name,3000000)}${text(4,"profile","Medical school: Synthetic University",3250000)}${text(5,"profile",`Degree: ${degree}`,3500000)}</p:spTree></p:cSld></p:sld>`,
    "customXml/item1.xml":`<baseline><fullName>${hiddenName}</fullName><degree>MD</degree><country>INVENTED COUNTRY</country></baseline>`});
}

test("021 native Rescue transports visible profile facts on the medical event with native evidence and no extra event",()=>{
  const source={filename:"profile.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",bytes:profilePptx()};
  const result=analyzeTimelineRescue(source),candidate=result.candidates[0]!;
  assert.equal(result.candidates.length,1);
  assert.equal(candidate.profileClaims?.fullName?.value,"Ana Popescu");
  assert.equal(candidate.profileClaims?.degree?.value,"MD");
  for(const claim of Object.values(candidate.profileClaims!))for(const p of claim!.provenance){
    assert.equal(p.artifactSha256,result.artifactSha256);assert.equal(p.pageOrSlide,1);assert.equal(p.extractionMethod,"PPTX_OOXML");assert.ok(result.evidence.some(item=>item.evidenceId===p.evidenceId));
  }
  assert.equal(candidate.safeToAutoAccept,false);
  assert.equal(candidate.reviewState,"REQUIRED");
  assert.doesNotMatch(JSON.stringify(candidate.profileClaims),/STALE|INVENTED COUNTRY/);
  const edited=analyzeTimelineRescue({...source,bytes:profilePptx({header:"Elena Rivera",name:"Elena Rivera"}),visualObservations:[{id:"stale-profile",pageOrSlide:1,text:"Timeline: Ana Popescu\nAna Popescu\nMedical school: Synthetic University\nDegree: MD",confidence:1}]});
  assert.equal(edited.candidates[0]?.profileClaims?.fullName?.value,"Elena Rivera","Edited native text dominates stale AI and hidden baseline");
});

test("021 conflicting visible Rescue names or degrees require review rather than hidden-baseline selection",()=>{
  const result=analyzeTimelineRescue({filename:"conflict.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",bytes:profilePptx({header:"Elena Rivera",degree:"DO"})});
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0]?.profileClaims,undefined);
  assert.match(result.unresolvedQuestions.join(" "),/names disagree/);
  assert.match(result.unresolvedQuestions.join(" "),/degree.*disagree/);
});

test("021 raster Rescue binds matching visible header/profile and degree while retaining vision uncertainty",()=>{
  const result=analyzeTimelineRescue({filename:"profile.png",mimeType:"image/png",bytes:new Uint8Array([137,80,78,71,13,10,26,10]),visualObservations:[
    {id:"medical",pageOrSlide:1,text:"2016-09–2022-06\nDoctor of Medicine (MD)\nSynthetic University",geometry:{x:.3,y:.3,width:.5,height:.1},confidence:.99},
    {id:"title",pageOrSlide:1,text:"Timeline: Ana Popescu",geometry:{x:.4,y:.01,width:.3,height:.03},confidence:.99},
    {id:"profile",pageOrSlide:1,text:"Ana Popescu\nMedical school: Synthetic University\nDegree: MD\nStep 2 CK: 251",geometry:{x:.03,y:.6,width:.2,height:.2},confidence:.98}
  ]});
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0]?.profileClaims?.fullName?.value,"Ana Popescu");
  assert.equal(result.candidates[0]?.profileClaims?.degree?.value,"MD");
  assert.ok(result.candidates[0]?.profileClaims?.fullName?.provenance.every(item=>item.support==="VISION_OBSERVATION"));
  assert.doesNotMatch(JSON.stringify(result.candidates[0]?.profileClaims),/country":/i);
});

test("PPTX rescue extracts OOXML geometry, groups, media custody, and review-only semantic candidates", () => {
  const result = analyzeTimelineRescue({ filename: "existing-timeline.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", bytes: pptxFixture() });
  assert.equal(result.format, "PPTX");
  assert.equal(result.extractionStatus, "STRUCTURED");
  assert.deepEqual(result.slideSize, { width: 12192000, height: 6858000, unit: "EMU" });
  assert.ok(result.objects.some((item) => item.kind === "GROUP"));
  const image = result.objects.find((item) => item.kind === "IMAGE");
  assert.equal(image?.relationshipTarget, "ppt/media/image1.png");
  assert.match(image?.mediaSha256 ?? "", /^[a-f0-9]{64}$/);
  const research = result.candidates.find((item) => /Research Fellow/.test(item.title));
  assert.equal(research?.categoryId, "res");
  assert.equal(research?.startDate, "2021-01");
  assert.equal(research?.endDate, "2023-12");
  assert.equal(research?.safeToAutoAccept, false);
  assert.equal(research?.provenance[0]?.support, "SOURCE_FACT");
  const clinical = result.candidates.find((item) => /Clinical Rotation/.test(item.title));
  assert.equal(clinical?.provenance[0]?.support, "GEOMETRY_INFERENCE");
  assert.equal(clinical?.reviewState, "REQUIRED");
  assert.ok(clinical?.uncertainties.some((item) => /inferred from object geometry/i.test(item)));
  assert.equal(result.cleanupProposal.factualMutationAllowed, false);
  assert.equal(result.cleanupProposal.authority, "MISSIONMED_FOUNDER_KEYNOTE_2025_CANONICAL_PRESENTATION");
  assert.match(result.cleanupProposal.actions[0]?.reason ?? "", /2025 Founder Keynote/);
  assert.ok(result.cleanupProposal.actions.every((item) => item.requiresReview && !item.changesBiography));
});

test("PPTX rescue excludes canonical furniture and classifies relocation as Personal", () => {
  const result = analyzeTimelineRescue({
    filename: "existing-timeline.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    bytes: zip({
      "[Content_Types].xml": "<Types/>",
      "ppt/presentation.xml": '<p:presentation xmlns:p="p"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
      "ppt/slides/slide1.xml": `<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1000000" y="100000"/><a:ext cx="3000000" cy="500000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Timeline: Synthetic Student</a:t></a:r></a:p></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="2" name="Color Key"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="100000" y="2000000"/><a:ext cx="1000000" cy="2000000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>COLOR KEY Work Experience Personal (Not on CV) USMLE Studies</a:t></a:r></a:p></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="3" name="Profile"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="100000" y="4000000"/><a:ext cx="2000000" cy="2000000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Medical school: Global University Degree: MBBS Specialty: Internal Medicine</a:t></a:r></a:p></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="4" name="Personal milestone"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="3000000" y="2000000"/><a:ext cx="1500000" cy="300000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Relocation 2025</a:t></a:r></a:p></p:txBody></p:sp>
      </p:spTree></p:cSld></p:sld>`,
    }),
  });
  assert.deepEqual(result.candidates.map((candidate) => candidate.title), ["Relocation"]);
  assert.equal(result.candidates[0]?.categoryId, "personal");
});

test("PDF rescue recovers directly encoded source text but keeps review and provenance", () => {
  const content = "BT 1 0 0 1 72 720 Tm (USMLE Step 2 2023) Tj ET";
  const pdf = Buffer.from(`%PDF-1.4\n1 0 obj <</Type /Page>> endobj\n2 0 obj << /Length ${content.length} >> stream\n${content}\nendstream\nendobj\n%%EOF`);
  const result = analyzeTimelineRescue({ filename: "timeline.pdf", mimeType: "application/pdf", bytes: pdf });
  assert.equal(result.format, "PDF");
  assert.equal(result.extractionStatus, "LIMITED");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.categoryId, "usmle");
  assert.equal(result.candidates[0]?.provenance[0]?.extractionMethod, "PDF_TEXT_OPERATOR");
  assert.equal(result.candidates[0]?.safeToAutoAccept, false);
});

test("image rescue never invents facts and only maps authenticated vision observations", () => {
  const withoutVision = analyzeTimelineRescue({ filename: "timeline.png", mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) });
  assert.equal(withoutVision.extractionStatus, "VISION_REQUIRED");
  assert.deepEqual(withoutVision.candidates, []);
  assert.ok(withoutVision.unresolvedQuestions.some((item) => /OCR\/document vision/i.test(item)));

  const withVision = analyzeTimelineRescue({
    filename: "timeline.jpg", mimeType: "image/jpeg", bytes: new Uint8Array([255, 216, 255, 217]),
    visualObservations: [{ id: "ocr-1", pageOrSlide: 1, text: "Medical School 2016-2020", confidence: 0.93, geometry: { x: 0.2, y: 0.3, width: 0.4, height: 0.08 } }],
  });
  assert.equal(withVision.candidates.length, 1);
  assert.equal(withVision.candidates[0]?.categoryId, "education");
  assert.equal(withVision.candidates[0]?.provenance[0]?.support, "VISION_OBSERVATION");
  assert.equal(withVision.candidates[0]?.provenance[0]?.confidence, 0.93);
  assert.equal(withVision.candidates[0]?.safeToAutoAccept, false);
});

test("CV reconciliation treats CV as factual authority and never silently resolves conflict", () => {
  const result = analyzeTimelineRescue(
    { filename: "existing.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", bytes: pptxFixture() },
    [
      { id: "cv-research", title: "Research Fellow", categoryId: "res", startDate: "2021-01", endDate: "2024-01" },
      { id: "cv-award", title: "Dean Award", categoryId: "education", startDate: "2020-01", endDate: null },
    ],
  );
  assert.ok(result.reconciliation.some((item) => item.state === "DATE_CONFLICT" && item.cvCandidateId === "cv-research"));
  assert.ok(result.reconciliation.some((item) => item.state === "CV_ONLY" && item.cvCandidateId === "cv-award"));
  assert.ok(result.reconciliation.every((item) => item.requiresReview));
});

test("Keynote is handled honestly with export-to-PPTX/PDF guidance", () => {
  const result = analyzeTimelineRescue({ filename: "existing.key", mimeType: "application/x-iwork-keynote-sffkey", bytes: new Uint8Array([1, 2, 3]) });
  assert.equal(result.extractionStatus, "UNSUPPORTED_KEYNOTE");
  assert.deepEqual(result.candidates, []);
  assert.equal(result.keynoteGuidance, KEYNOTE_GUIDANCE);
  assert.match(result.keynoteGuidance ?? "", /Export To > PowerPoint.*or PDF/i);
});

test("unsupported files fail closed", () => {
  assert.throws(() => analyzeTimelineRescue({ filename: "timeline.txt", mimeType: "text/plain", bytes: Buffer.from("not a timeline") }), /TIMELINE_RESCUE_FORMAT_UNSUPPORTED/);
});

function shape(id: number, label: string, name = "Text", transform = '<a:xfrm><a:off x="100" y="200"/><a:ext cx="100" cy="50"/></a:xfrm>'): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/></p:nvSpPr><p:spPr>${transform}</p:spPr><p:txBody><a:p><a:r><a:t>${label}</a:t></a:r></a:p></p:txBody></p:sp>`;
}
function grouped(id: number, name: string, children: string, transform = ""): string {
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/></p:nvGrpSpPr><p:grpSpPr>${transform}</p:grpSpPr>${children}</p:grpSp>`;
}
function slideArchive(slide: string, extra: Record<string, string | Uint8Array> = {}): Uint8Array {
  return zip({ "[Content_Types].xml": "<Types/>", "ppt/presentation.xml": '<p:presentation><p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
    "ppt/slides/slide1.xml": `<p:sld><p:cSld><p:spTree>${slide}</p:spTree></p:cSld></p:sld>`, ...extra });
}
function rescueSlide(slide: string) {
  return analyzeTimelineRescue({ filename: "edited.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", bytes: slideArchive(slide) });
}

test("021 edited event groups recover exact compact months and separate per-object provenance while excluding furniture", () => {
  const axis = Array.from({length: 10}, (_, index) => shape(100+index, String(2016+index), `MM:furniture:axis:${index}`)).join("");
  const event = grouped(10, "MM:group:event:research-1", shape(11, "Research Fellow", "MM:event:research-1:title") + shape(12, "3/21–12/22", "MM:event:research-1:date") + shape(13, "Cardiovascular Lab", "MM:event:research-1:site"));
  const furniture = grouped(20, "MM:group:furniture:color-key", shape(21, "Work Experience") + shape(22, "Personal (Not on CV)") + shape(23, "USMLE Studies"));
  const profile = grouped(30, "MM:group:furniture:profile", shape(31, "Global University 2023"));
  const annotation = shape(40, "Work notes 2024", "MM:annotation:note-1:text");
  const result = rescueSlide(axis+event+furniture+profile+annotation);
  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0]!;
  assert.equal(candidate.title, "Research Fellow");
  assert.equal(candidate.institution, "Cardiovascular Lab");
  assert.equal(candidate.startDate, "2021-03");
  assert.equal(candidate.endDate, "2022-12");
  assert.deepEqual(candidate.datePrecision, {start: "MONTH", end: "MONTH"});
  assert.deepEqual(candidate.provenance.map(item => item.sourceText), ["Research Fellow", "3/21–12/22", "Cardiovascular Lab"]);
  assert.deepEqual(candidate.uncertainties, []);
  assert.equal(candidate.reviewState, "REQUIRED");
  assert.equal(candidate.safeToAutoAccept, false);
});

test("021 current native duration typography separates edited title and institution with every visible run retained", () => {
  const styled = (id: number, label: string, size: number, bold: boolean, y: number) => shape(id,label,`MM:event:golden-observership:paint-${id}`,
    `<a:xfrm><a:off x="13624140" y="${y}"/><a:ext cx="1515487" cy="${size===1500?228600:205740}"/></a:xfrm>`)
    .replace("<a:r>",`<a:r><a:rPr sz="${size}"${bold?' b="1"':''}/>`);
  const event = grouped(127,"MM:group:event:golden-observership",
    styled(89,"7/23 - 8/23",1350,false,4872228)+
    styled(90,"Edited Harbor Hospital",1350,false,5424678)+
    styled(91,"Edited Clinical Observership",1500,true,5132070));
  const bytes=slideArchive(shape(1,"2023","MM:furniture:axis:year")+event,{
    "customXml/item1.xml":'<mm:timeline>{"facts":[{"title":"STALE Observership","siteName":"STALE Mount Sinai Hospital"}]}</mm:timeline>'
  });
  const result=analyzeTimelineRescue({filename:"native-edited.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",bytes});
  assert.equal(result.candidates.length,1);
  const candidate=result.candidates[0]!;
  assert.equal(candidate.title,"Edited Clinical Observership");
  assert.equal(candidate.institution,"Edited Harbor Hospital");
  assert.equal(candidate.categoryId,"cl");
  assert.equal(candidate.startDate,"2023-07");
  assert.equal(candidate.endDate,"2023-08");
  assert.deepEqual(candidate.provenance.map(item=>item.sourceText),["7/23 - 8/23","Edited Harbor Hospital","Edited Clinical Observership"]);
  assert.ok(candidate.uncertainties.some(item=>/confirm their roles/.test(item)));
  assert.equal(candidate.safeToAutoAccept,false);
  assert.equal(result.objects.find(item=>item.name?.endsWith("paint-91"))?.fontBold,true);
  assert.ok(!JSON.stringify(candidate).includes("STALE"));

  const ambiguous=rescueSlide(event.replace('sz="1500" b="1"','sz="1350" b="0"'));
  assert.equal(ambiguous.candidates[0]?.institution,null,"Equal styling cannot silently identify an institution");
  assert.match(ambiguous.candidates[0]!.title,/Edited Harbor Hospital/);
  assert.match(ambiguous.candidates[0]!.title,/Edited Clinical Observership/);
});

test("021 a wrapped milestone stays one complete title and an institutional word cannot override an explicit role",()=>{
  const exam=rescueSlide(grouped(1,"MM:group:event:exam",shape(2,"3/23")+shape(3,"USMLE Step 2")+shape(4,"CK — 251")));
  assert.equal(exam.candidates[0]?.title,"USMLE Step 2 CK — 251");
  assert.equal(exam.candidates[0]?.institution,null);
  const work=rescueSlide(grouped(10,"MM:group:event:resident",shape(11,"Resident Physician (PGY-1 equivalent)","MM:event:resident:title")+shape(12,"1/23–6/24","MM:event:resident:date")+shape(13,"Emergency University Hospital Bucharest","MM:event:resident:site")));
  assert.equal(work.candidates[0]?.title,"Resident Physician (PGY-1 equivalent)");
  assert.equal(work.candidates[0]?.institution,"Emergency University Hospital Bucharest");
  assert.equal(work.candidates[0]?.categoryId,"work");
});

test("021 editable PPTX visual AI fragments remain evidence while native edited or added events remain candidates",()=>{
  const bytes=slideArchive(grouped(1,"MM:group:event:clinical",shape(2,"Edited Clinical Observership","MM:event:clinical:title")+shape(3,"7/2023–9/2023","MM:event:clinical:date")+shape(4,"Edited Hospital","MM:event:clinical:site"))+
    shape(5,"Added Research Poster 2024","New student object"));
  const result=analyzeTimelineRescue({filename:"native-with-ai.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",bytes,
    visualObservations:[
      {id:"duplicate",text:"Clinical Observership 7/2023–8/2023",pageOrSlide:1,confidence:.95},
      {id:"furniture",text:"USCE",pageOrSlide:1,confidence:.99,geometry:{x:.5,y:.3,width:.2,height:.1}},
      {id:"invented-date",text:"Profile Name 2023",pageOrSlide:1,confidence:.9}
    ]});
  assert.equal(result.candidates.length,2);
  assert.equal(result.candidates[0]?.title,"Edited Clinical Observership");
  assert.equal(result.candidates[0]?.endDate,"2023-09","Visible edit overrides conflicting AI observation");
  assert.equal(result.candidates[1]?.title,"Added Research Poster","An added native object is not ignored");
  assert.ok(result.candidates.every(candidate=>candidate.provenance.every(item=>item.extractionMethod==="PPTX_OOXML")));
  assert.equal(result.objects.filter(object=>object.id.startsWith("vision-")).length,3);
  assert.equal(result.evidence.filter(item=>item.support==="VISION_OBSERVATION").length,3);
  assert.ok(result.warnings.some(item=>/comparison only/.test(item)));
});

test("021 actual Letter PDF vision observations recover nine events without year furniture, joined institutions or invented precision",()=>{
  const fixture=JSON.parse(readFileSync(new URL("./fixtures/d1-timeline-astra-021/golden-letter-vision-observations.json",import.meta.url),"utf8"));
  const sources=[
    {filename:"fixture.pdf",mimeType:"application/pdf",bytes:Buffer.from("%PDF-1.4\n1 0 obj<</Type /Page>>endobj\n%%EOF")},
    {filename:"fixture.png",mimeType:"image/png",bytes:Buffer.from([137,80,78,71,13,10,26,10])},
    {filename:"fixture.jpeg",mimeType:"image/jpeg",bytes:Buffer.from([255,216,255,217])}
  ];
  for(const source of sources){
    const result=analyzeTimelineRescue({...source,visualObservations:fixture.observations});
    assert.equal(result.candidates.length,9,source.filename);
    assert.equal(result.objects.length,19);
    assert.equal(result.evidence.length,19,"Excluded furniture observations still have source evidence");
    assert.ok(!result.candidates.some(item=>/^\d{4}(?:\s+\d{4})+$/.test(item.title)));
    for(const [title,institution,categoryId] of [
      ["Doctor of Medicine (MD)","Carol Davila University of Medicine and Pharmacy","education"],
      ["Volunteer","Red Cross Romania","work"],
      ["Research Assistant","Cardiovascular Outcomes Lab, Carol Davila University","res"],
      ["Resident Physician (PGY-1 equivalent)","Emergency University Hospital Bucharest","work"],
      ["Observership","Mount Sinai Hospital","cl"],
      ["Clinical Elective","Cleveland Clinic","cl"]
    ]){
      const candidate=result.candidates.find(item=>item.title===title);
      assert.equal(candidate?.institution,institution,title);
      assert.equal(candidate?.categoryId,categoryId,title);
      assert.ok(candidate?.provenance[0]?.sourceText.includes("\n"));
      assert.ok(candidate?.uncertainties.some(item=>/confirm their roles against the source/.test(item)));
    }
    const volunteer=result.candidates.find(item=>item.title==="Volunteer")!;
    assert.deepEqual(volunteer.datePrecision,{start:"YEAR",end:"YEAR"});
    const publication=result.candidates.find(item=>item.title==="Outcomes after early anticoagulation.")!;
    assert.deepEqual(publication.datePrecision,{start:"YEAR",end:null});
    assert.equal(publication.institution,null,"A wrapped publication title cannot invent a journal or institution");
    assert.equal(publication.categoryId,"unclassified");
    assert.ok(result.candidates.every(item=>item.reviewState==="REQUIRED"&&item.safeToAutoAccept===false));
    assert.ok(!result.candidates.some(item=>item.uncertainties.some(reason=>/confirm the century/.test(reason))),"Visible ribbon establishes the compact-date century without making an event");
    assert.ok(!result.unresolvedQuestions.some(item=>/Medical school:/.test(item)),"The labelled profile is furniture, not an incomplete event");
  }
});

test("021 visual role association leaves missing geometry, unlabelled continuations and multiple dated events unresolved",()=>{
  for(const observation of [
    {text:"7/2023–8/2023\nObservership\nMount Sinai Hospital",geometry:undefined},
    {text:"7/2023–8/2023\nResearch Assistant\nA new direction",geometry:{x:.2,y:.3,width:.3,height:.1}},
    {text:"7/2023–8/2023\nObservership\nMount Sinai Hospital\nResearch 2024",geometry:{x:.2,y:.3,width:.3,height:.1}}
  ]){
    const result=analyzeTimelineRescue({filename:"uncertain.png",mimeType:"image/png",bytes:Buffer.from([137,80,78,71,13,10,26,10]),
      visualObservations:[{id:"uncertain",pageOrSlide:1,confidence:.8,...observation}]});
    assert.equal(result.candidates[0]?.institution,null);
    assert.ok(result.candidates[0]?.provenance[0]?.sourceText.includes("\n"));
    assert.equal(result.candidates[0]?.safeToAutoAccept,false);
  }
});

test("021 compact dates respect the visible century and retain unsupported-century or year-only uncertainty", () => {
  const historic = rescueSlide(shape(1,"1999","Year")+shape(2,"2000","Year")+shape(3,"Research Fellow 9/99–6/00"));
  assert.equal(historic.candidates[0]?.startDate,"1999-09");
  assert.equal(historic.candidates[0]?.endDate,"2000-06");
  const unsupported = rescueSlide(shape(4,"Research Fellow 9/23–6/24"));
  assert.equal(unsupported.candidates[0]?.startDate,"2023-09");
  assert.ok(unsupported.candidates[0]?.uncertainties.some(item=>/confirm the century/.test(item)));
  assert.notEqual(unsupported.candidates[0]?.confidence.level,"HIGH");
  const yearly = rescueSlide(shape(5,"Research Fellow 2021–2023"));
  assert.deepEqual(yearly.candidates[0]?.datePrecision,{start:"YEAR",end:"YEAR"});
  assert.ok(yearly.candidates[0]?.uncertainties.some(item=>/not a source-backed month/.test(item)));
  assert.notEqual(yearly.candidates[0]?.confidence.level,"HIGH");
});

test("021 exact named/ISO dates and open ranges retain precision; malformed visible dates never fall back to geometry", () => {
  for (const [caption, start, end] of [
    ["Research Fellow March 2021–December 2022", "2021-03", "2022-12"],
    ["Research Fellow 2021-03–2022-12", "2021-03", "2022-12"],
    ["Research Fellow 3/2021–Present", "2021-03", null],
    ["USMLE Step 1 11/2022", "2022-11", null]
  ] as const) {
    const candidate = rescueSlide(shape(1,caption)).candidates[0];
    assert.equal(candidate?.startDate,start,caption); assert.equal(candidate?.endDate,end,caption);
    assert.equal(candidate?.openEnded,caption.includes("Present"),caption);
  }
  for (const caption of ["Research Fellow 13/23", "Research Fellow 2023-13", "Research Fellow 2024–2023", "Research Fellow 2021–"]) {
    const result = rescueSlide(shape(1,"2020")+shape(2,"2025")+shape(3,caption));
    assert.equal(result.candidates.length,0,caption);
    assert.ok(result.unresolvedQuestions.some(item=>/Confirm dates/.test(item)),caption);
  }
});

test("021 nested group offsets, scaling, rotation and flips compose into slide-space geometry", () => {
  const outer = '<a:xfrm><a:off x="1000" y="2000"/><a:ext cx="400" cy="400"/><a:chOff x="100" y="200"/><a:chExt cx="200" cy="200"/></a:xfrm>';
  const inner = '<a:xfrm rot="5400000" flipH="1"><a:off x="100" y="200"/><a:ext cx="100" cy="100"/><a:chOff x="0" y="0"/><a:chExt cx="100" cy="100"/></a:xfrm>';
  const local = '<a:xfrm><a:off x="10" y="20"/><a:ext cx="20" cy="10"/></a:xfrm>';
  const objects = extractPptx(slideArchive(grouped(10,"Outer",grouped(20,"Inner",shape(30,"Research 2023","Event",local),inner),outer))).objects;
  const child = objects.find(item=>item.name==="Event")!;
  assert.ok(child.geometry);
  for (const [key,value] of Object.entries({x:1140,y:2140,width:20,height:40})) assert.ok(Math.abs(child.geometry[key as "x"|"y"|"width"|"height"]-value)<1e-8,`${key}=${child.geometry[key as "x"|"y"|"width"|"height"]}`);
  assert.equal(child.groupId,"pptx-s1-group-20");
  assert.equal(objects.find(item=>item.name==="Inner")?.groupId,"pptx-s1-group-10");
  assert.deepEqual(child.nativeTransform?.localGeometry,{x:10,y:20,width:20,height:10,unit:"EMU"});
  const repeated = extractPptx(slideArchive(grouped(10,"Group",shape(11,"Research 2023")), {"ppt/slides/slide2.xml":`<p:sld>${grouped(10,"Group",shape(11,"Research 2024"))}</p:sld>`})).objects;
  assert.equal(new Set(repeated.map(item=>item.id)).size,repeated.length,"Slide-local OOXML IDs must not merge groups across slides");
});

test("021 image crop and native rotation remain source-bound and external media relationships are never followed", () => {
  const picture = `<p:pic><p:nvPicPr><p:cNvPr id="12" name="Photo"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:srcRect l="10000" t="20000" r="30000" b="5000"/></p:blipFill><p:spPr><a:xfrm rot="5400000"><a:off x="100" y="200"/><a:ext cx="100" cy="50"/></a:xfrm></p:spPr></p:pic>`;
  const result = extractPptx(slideArchive(picture,{"ppt/slides/_rels/slide1.xml.rels":'<Relationships><Relationship Id="rId1" Target="https://example.com/private.png" TargetMode="External"/></Relationships>'}));
  assert.deepEqual(result.objects[0]?.crop,{left:0.1,top:0.2,right:0.3,bottom:0.05,unit:"FRACTION"});
  assert.equal(result.objects[0]?.nativeTransform?.rotationDegrees,90);
  assert.equal(result.objects[0]?.relationshipTarget,null);
  assert.ok(result.warnings.some(item=>/could not be bound/.test(item)));
});


test("021 visible edits override embedded recovery baseline and generic dated groups preserve source title/date separation", () => {
  const bytes = slideArchive(grouped(1, "MM:group:event:research", shape(2,"Research Fellow")+shape(3,"3/2021–7/2024")), {
    "customXml/item1.xml": '<mm:timeline xmlns:mm="urn:missionmed:timeline:recovery:1">{"facts":[{"title":"Research Fellow","startDate":"2021-03","endDate":"2022-12"}]}</mm:timeline>'
  });
  const result = analyzeTimelineRescue({filename:"manually-edited.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",bytes});
  assert.equal(result.candidates[0]?.endDate,"2024-07","Visible OOXML edit wins over stale hidden metadata");
  assert.equal(result.candidates[0]?.provenance.length,2);
  assert.ok(result.candidates[0]?.provenance.every(item=>item.extractionMethod==="PPTX_OOXML"));
  const generic = rescueSlide(grouped(10,"PowerPoint group",shape(11,"Clinical Rotation")+shape(12,"7/2023–8/2023")));
  assert.equal(generic.candidates.length,1);
  assert.equal(generic.candidates[0]?.title,"Clinical Rotation");
  assert.equal(generic.candidates[0]?.startDate,"2023-07");
});

test('021 fresh real PDF/PNG segmentation preserves nine observed facts and matching visible profile claims',()=>{
  const fixtures=JSON.parse(readFileSync(new URL('./fixtures/d1-timeline-astra-021/rescue-fresh-segmentation.json',import.meta.url),'utf8'));
  for(const fixture of fixtures){
    const result=analyzeTimelineRescue({filename:'segmented.png',mimeType:'image/png',bytes:Buffer.from([137,80,78,71,13,10,26,10]),visualObservations:fixture.observations});
    assert.equal(result.candidates.length,9,fixture.receipt);
    const medical=result.candidates.find(candidate=>candidate.title==='Doctor of Medicine (MD)')!;
    assert.equal(medical.profileClaims?.fullName?.value,'Ana Popescu',fixture.receipt);
    assert.equal(medical.profileClaims?.degree?.value,'MD');
    for(const [title,institution,start,end] of [
      ['Resident Physician (PGY-1 equivalent)','Emergency University Hospital Bucharest','2023-01','2024-06'],
      ['Observership','Mount Sinai Hospital','2023-07','2023-08'],
      ['Clinical Elective','Cleveland Clinic','2023-10','2023-11']]){
      const candidate=result.candidates.find(item=>item.title===title)!;
      assert.equal(candidate.institution,institution);assert.equal(candidate.startDate,start);assert.equal(candidate.endDate,end);
      if(fixture.format==='IMAGE')assert.equal(candidate.provenance.length,3,'Every separate original observed object remains evidence');
      assert.equal(candidate.safeToAutoAccept,false);assert.equal(candidate.reviewState,'REQUIRED');
    }
    assert.equal(result.candidates.find(item=>item.title==='Volunteer')?.datePrecision?.start,'YEAR');
    assert.equal(result.candidates.find(item=>item.title==='Outcomes after early anticoagulation.')?.datePrecision?.start,'YEAR');
    assert.ok(!result.unresolvedQuestions.some(question=>question.includes('names disagree')));
    assert.ok(fixture.observations.every((observation:{id:string})=>result.objects.some(object=>object.id===`vision-${observation.id}`)));
  }
});

test('021 split visual rows hold ambiguous, overlapping, distant, cross-page and cross-unit associations',()=>{
  const observation=(id:string,text:string,x:number,y:number,width:number,height:number)=>({id,text,pageOrSlide:1,confidence:.99,geometry:{x,y,width,height,unit:'NORMALIZED' as const}});
  const base=[observation('date','7/2023–8/2023',.7,.4,.1,.02),observation('role','Observership',.64,.43,.15,.02),observation('site','Mount Sinai Hospital',.7,.46,.15,.02)];
  const render=(visualObservations:typeof base)=>analyzeTimelineRescue({filename:'split.png',mimeType:'image/png',bytes:Buffer.from([137,80,78,71,13,10,26,10]),visualObservations});
  assert.equal(render(base).candidates.length,1);
  for(const change of ['title-tie','site-tie','overlap','distant','page','unit','missing-date']){
    const objects=structuredClone(base);
    if(change==='title-tie')objects.push({...objects[1]!,id:'other-title',text:'Clinical Elective'});
    if(change==='site-tie')objects.push({...objects[2]!,id:'other-site',text:'Another Hospital'});
    if(change==='overlap')objects[1]!.geometry.y=.41;
    if(change==='distant')objects[1]!.geometry.y=.7;
    if(change==='page')objects[1]!.pageOrSlide=2;
    if(change==='unit')(objects[1]!.geometry as {unit:string}).unit='PDF_POINTS';
    if(change==='missing-date')objects[0]!.text='Dates not shown';
    assert.equal(render(objects).candidates.length,0,change);
  }
});

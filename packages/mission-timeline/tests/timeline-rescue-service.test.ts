import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import test from "node:test";

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
  assert.equal(result.cleanupProposal.authority, "MISSIONMED_FOUNDER_KEYNOTE_2024_CANONICAL_PRESENTATION");
  assert.match(result.cleanupProposal.actions[0]?.reason ?? "", /2024 Founder Keynote/);
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

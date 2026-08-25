import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { ObjectRecord } from "../src/contracts/types.js";
import { sha256 } from "../src/core/canonical.js";
import { CvIntelligenceService, type AuthorizedCvSourceObject } from "../src/intelligence/cv-intelligence-service.js";
import type { CvIntelligenceProvider } from "../src/intelligence/cv-intelligence-provider.js";
import type { CvIntelligenceRequest } from "../src/intelligence/cv-intelligence-schema.js";
import { extractExactCvSourceBlocks } from "../src/intelligence/cv-source-extractor.js";
import { document, student } from "./fixtures.js";
import { syntheticCvDocx, syntheticCvPdf } from "./support/synthetic-cv-files.js";

const PDF_MIME = "application/pdf" as const;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;
const exactExcerpt = "Research Assistant, University of Ghana, July 2021 - December 2022";
const founderSyntheticCvUrl = new URL(
  "../../../_AI_HANDOFFS/from_codex/D1-TIMELINE-CODEX-FINAL-012A/fixtures/012A_SYNTHETIC_CV.pdf",
  import.meta.url,
);

function authorizedSource(bytes: Uint8Array, mimeType: typeof PDF_MIME | typeof DOCX_MIME, id: string): AuthorizedCvSourceObject {
  const record: ObjectRecord = {
    id,
    ownerPrincipalId: student.principalId,
    documentId: "timeline_test",
    objectClass: "SOURCE",
    storageKey: `opaque/${id}`,
    mimeType,
    expectedBytes: bytes.byteLength,
    expectedSha256: sha256(bytes),
    status: "CONFIRMED",
    createdAt: "2026-08-24T12:00:00.000Z",
    confirmedAt: "2026-08-24T12:00:00.000Z",
  };
  return { record, bytes };
}

test("the exact Founder-authorized LibreOffice PDF fixture recovers born-digital text with page custody", async () => {
  const bytes = new Uint8Array(await readFile(founderSyntheticCvUrl));
  assert.equal(sha256(bytes), "9db0a22f8ecd7f2cabcfcedb85fdd3aa5a640bbf6d345c4adb6a30225bd33dbb");
  const extraction = await extractExactCvSourceBlocks(bytes, PDF_MIME);
  const recovered = extraction.blocks.map((block) => block.text).join("\n");
  assert.equal(extraction.method, "PDFJS_TEXT_CONTENT");
  assert.equal(extraction.blocks.every((block) => block.pageNumber === 1), true);
  assert.ok(extraction.blocks.length >= 10, "logical PDF lines remain individually evidence-addressable");
  assert.match(recovered, /Alex Rivera — Synthetic Test CV/);
  assert.match(recovered, /Doctor of Medicine, Harborview International Medical School — August 2018 to June 2022/);
  assert.match(recovered, /Internal Medicine Observership, Lakeside Community Hospital, Chicago, Illinois — January 2024 to March\s+2024/);
  assert.ok(extraction.blocks.some((block) => /January 2024 to March 2024/.test(block.text)), "wrapped year is rejoined without inference");
  assert.match(recovered, /ECFMG Certification — September 2024/);
});

function request(source: AuthorizedCvSourceObject, mimeType: typeof PDF_MIME | typeof DOCX_MIME): CvIntelligenceRequest {
  return {
    source: { objectId: source.record.id, sha256: source.record.expectedSha256, mimeType, fileName: `synthetic.${mimeType === PDF_MIME ? "pdf" : "docx"}` },
    // Deliberately adversarial: this text is not in the stored object and must
    // never become provider input or provenance.
    blocks: [{ id: "client_fabrication", pageNumber: 99, section: "Fabricated", text: "Invented Nobel Prize and false dates" }],
    documentType: "CV",
    existingEvents: [],
    consentVersion: "d1-ux-007-ai-v1",
    idempotencyKey: `exact-byte-${mimeType === PDF_MIME ? "pdf" : "docx"}`,
  };
}

for (const fixture of [
  { name: "PDF", mimeType: PDF_MIME, bytes: syntheticCvPdf([exactExcerpt]) },
  { name: "DOCX", mimeType: DOCX_MIME, bytes: syntheticCvDocx([exactExcerpt]) },
]) {
  test(`exact synthetic ${fixture.name} bytes produce source-bound provenance while client blocks are ignored`, async () => {
    const source = authorizedSource(fixture.bytes, fixture.mimeType, `source_${fixture.name.toLowerCase()}`);
    let receivedText = "";
    const provider: CvIntelligenceProvider = {
      descriptor: { provider: "synthetic-provider", model: "pinned-test" },
      async analyze(providerRequest) {
        receivedText = providerRequest.blocks.map((block) => block.text).join("\n");
        const sourceBlockId = providerRequest.blocks.find((block) => block.text.includes(exactExcerpt))?.id ?? "missing";
        return {
          candidates: [{
            localId: "research_ghana",
            canonicalType: "RESEARCH_EXPERIENCE",
            categoryId: "res",
            timelineKind: "duration",
            title: "Research Assistant",
            organization: "University of Ghana",
            location: null,
            country: null,
            specialty: null,
            experienceType: null,
            startDate: "2021-07",
            endDate: "2022-12",
            datePrecision: "MONTH",
            openEnded: false,
            classificationReason: "The exact source identifies a research role.",
            evidence: ["title", "organization", "startDate", "endDate", "canonicalType", "categoryId"].map((field) => ({
              field: field as "title",
              sourceBlockIds: [sourceBlockId],
              excerpt: exactExcerpt,
              support: "EXPLICIT" as const,
              reason: "Exact source span.",
              uncertainty: null,
            })),
            uncertainty: [],
            warnings: [],
          }],
          qualitySuggestions: [],
          unresolvedQuestions: [],
        };
      },
    };
    const service = new CvIntelligenceService({
      provider,
      expectedConsentVersion: "d1-ux-007-ai-v1",
      syntheticPrincipalIds: [student.principalId],
    });
    const response = await service.analyze(student, document(), source, request(source, fixture.mimeType), true);
    assert.equal(response.status, "COMPLETE");
    assert.equal(response.sourceSha256, sha256(fixture.bytes));
    assert.match(receivedText, /Research Assistant, University of Ghana/);
    assert.doesNotMatch(receivedText, /Invented Nobel Prize/);
    assert.equal(response.candidates[0]?.provenance[0]?.sourceSha256, sha256(fixture.bytes));
    assert.equal(response.candidates[0]?.provenance[0]?.excerpt, exactExcerpt);
    assert.ok((response.candidates[0]?.provenance[0]?.charStart ?? -1) >= 0);
  });
}

test("unreadable exact PDF fails closed with OCR-required review and no provider call", async () => {
  const bytes = syntheticCvPdf([]);
  const source = authorizedSource(bytes, PDF_MIME, "source_scanned_pdf");
  let calls = 0;
  const service = new CvIntelligenceService({
    provider: {
      descriptor: { provider: "synthetic-provider", model: "pinned-test" },
      async analyze() { calls += 1; throw new Error("must not run"); },
    },
    expectedConsentVersion: "d1-ux-007-ai-v1",
    syntheticPrincipalIds: [student.principalId],
  });
  const response = await service.analyze(student, document(), source, request(source, PDF_MIME), true);
  assert.equal(response.status, "LIMITED_FALLBACK_REQUIRED");
  assert.equal(response.fallbackReason, "OCR_REQUIRED");
  assert.match(response.unresolvedQuestions[0]!, /exact stored CV.*OCR/i);
  assert.equal(calls, 0);
});

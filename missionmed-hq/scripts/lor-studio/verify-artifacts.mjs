import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  renderRecommendationDocx,
  renderRecommendationPdf,
} from '../../lor-studio/documents/recommendation-artifacts.mjs';

const requestedOutputDirectory = process.argv[2];
const outputDirectory = requestedOutputDirectory
  ? path.resolve(requestedOutputDirectory)
  : await mkdtemp(path.join(os.tmpdir(), 'f2-lor-artifact-check.'));

const model = {
  caseId: 'synthetic-validation-case',
  title: 'Synthetic LOR Artifact Validation',
  studentDisplayName: 'Synthetic Student',
  facultyDisplayName: 'Synthetic Faculty Writer',
  documentState: 'faculty_final',
  privacyClass: 'nonwaived_student_visible',
  containsWaivedContent: false,
  containsFacultyPrivateContent: false,
  facultyApproval: {
    approved: true,
    signatureAttested: true,
    approvedAt: '2026-08-09T16:00:00.000Z',
  },
  sections: [{
    heading: 'Validation section',
    paragraphs: ['Synthetic content used only to validate genuine DOCX and PDF file structure.'],
  }],
  provenance: [{ sourceType: 'synthetic_validation', sourceRef: 'no_user_data' }],
};

const docx = renderRecommendationDocx(model);
const pdf = renderRecommendationPdf(model, { pdfApproved: true });
await mkdir(outputDirectory, { recursive: true });
const docxPath = path.join(outputDirectory, 'lor-studio-validation.docx');
const pdfPath = path.join(outputDirectory, 'lor-studio-validation.pdf');
await Promise.all([
  writeFile(docxPath, docx.buffer),
  writeFile(pdfPath, pdf.buffer),
]);

const evidence = {
  syntheticOnly: true,
  remoteMutationPerformed: false,
  temporaryOutput: !requestedOutputDirectory,
  docx: { path: docxPath, sha256: docx.sha256, bytes: docx.bytes, mimeType: docx.mimeType },
  pdf: { path: pdfPath, sha256: pdf.sha256, bytes: pdf.bytes, mimeType: pdf.mimeType },
};
await writeFile(path.join(outputDirectory, 'artifact-validation.json'), `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

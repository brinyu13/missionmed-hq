import { createHash } from 'node:crypto';

import { createZip } from './ooxml-zip.mjs';

const ALLOWED_PRIVACY_CLASSES = new Set(['nonwaived_student_visible', 'waived_faculty_private']);

function requiredString(value, name, maximum = 12_000) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required.`);
  if (normalized.length > maximum) throw new Error(`${name} exceeds ${maximum} characters.`);
  return normalized;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function validateModel(model) {
  if (!model || typeof model !== 'object') throw new Error('Recommendation artifact model is required.');
  const caseId = requiredString(model.caseId, 'caseId', 160);
  const title = requiredString(model.title, 'title', 300);
  const privacyClass = requiredString(model.privacyClass, 'privacyClass', 80);
  if (!ALLOWED_PRIVACY_CLASSES.has(privacyClass)) throw new Error('privacyClass is not approved.');
  if (model.documentState !== 'faculty_final') throw new Error('Only faculty-final wording may be rendered as a release artifact.');
  if (model.facultyApproval?.approved !== true || model.facultyApproval?.signatureAttested !== true) {
    throw new Error('Faculty approval and signature attestation are required.');
  }
  if (!Array.isArray(model.sections) || model.sections.length === 0 || model.sections.length > 40) {
    throw new Error('One to forty document sections are required.');
  }
  const sections = model.sections.map((section, index) => ({
    heading: requiredString(section?.heading, `sections[${index}].heading`, 300),
    paragraphs: Array.isArray(section?.paragraphs)
      ? section.paragraphs.map((paragraph, paragraphIndex) => requiredString(paragraph, `sections[${index}].paragraphs[${paragraphIndex}]`))
      : [],
  }));
  if (sections.some((section) => section.paragraphs.length === 0)) throw new Error('Every document section requires content.');
  if (privacyClass === 'nonwaived_student_visible' && (model.containsWaivedContent || model.containsFacultyPrivateContent)) {
    throw new Error('Student-visible artifacts cannot contain waived or faculty-private content.');
  }
  if (!Array.isArray(model.provenance) || model.provenance.length === 0) {
    throw new Error('Evidence provenance is required for a final recommendation artifact.');
  }
  return {
    caseId,
    title,
    privacyClass,
    studentDisplayName: requiredString(model.studentDisplayName, 'studentDisplayName', 300),
    facultyDisplayName: requiredString(model.facultyDisplayName, 'facultyDisplayName', 300),
    sections,
    provenance: model.provenance.map((item, index) => ({
      sourceType: requiredString(item?.sourceType, `provenance[${index}].sourceType`, 80),
      sourceRef: requiredString(item?.sourceRef, `provenance[${index}].sourceRef`, 300),
    })),
    approvedAt: requiredString(model.facultyApproval.approvedAt, 'facultyApproval.approvedAt', 80),
  };
}

function paragraphXml(text, style = '') {
  const paragraphProperties = style ? `<w:pPr><w:pStyle w:val="${escapeXml(style)}"/></w:pPr>` : '';
  const lines = String(text).split(/\r?\n/u);
  const runs = lines.map((line, index) => `${index ? '<w:r><w:br/></w:r>' : ''}<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`).join('');
  return `<w:p>${paragraphProperties}${runs}</w:p>`;
}

function makeDocx(model) {
  const body = [
    paragraphXml(model.title, 'Title'),
    paragraphXml(`Applicant: ${model.studentDisplayName}`),
    ...model.sections.flatMap((section) => [
      paragraphXml(section.heading, 'Heading1'),
      ...section.paragraphs.map((paragraph) => paragraphXml(paragraph)),
    ]),
    paragraphXml(`Final wording approved and signature attested by ${model.facultyDisplayName}.`),
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
  ].join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>';
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rootRelations = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  const documentRelations = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(model.title)}</dc:title><dc:creator>MissionMed LOR Studio</dc:creator><cp:keywords>${escapeXml(`case:${model.caseId};privacy:${model.privacyClass}`)}</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(model.approvedAt)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(model.approvedAt)}</dcterms:modified></cp:coreProperties>`;
  return createZip([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRelations],
    ['docProps/core.xml', core],
    ['word/document.xml', documentXml],
    ['word/styles.xml', stylesXml],
    ['word/_rels/document.xml.rels', documentRelations],
  ]);
}

function pdfEscape(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/gu, '?')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function wrapLine(value, width = 88) {
  const words = String(value).split(/\s+/u).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function makePdf(model) {
  const lines = [model.title, '', `Applicant: ${model.studentDisplayName}`, ''];
  for (const section of model.sections) {
    lines.push(section.heading.toUpperCase());
    for (const paragraph of section.paragraphs) lines.push(...wrapLine(paragraph), '');
  }
  lines.push('', `Final wording approved and signature attested by ${model.facultyDisplayName}.`);
  const pages = [];
  for (let index = 0; index < lines.length; index += 46) pages.push(lines.slice(index, index + 46));

  const objectBodies = new Map();
  objectBodies.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objectBodies.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageRefs = [];
  let nextObject = 4;
  for (const pageLines of pages) {
    const pageObject = nextObject;
    const contentObject = nextObject + 1;
    nextObject += 2;
    pageRefs.push(`${pageObject} 0 R`);
    const content = `BT\n/F1 11 Tf\n72 740 Td\n14 TL\n${pageLines.map((line) => `(${pdfEscape(line)}) Tj\nT*`).join('\n')}\nET`;
    objectBodies.set(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objectBodies.set(contentObject, `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`);
  }
  objectBodies.set(2, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`);
  const infoObject = nextObject;
  objectBodies.set(infoObject, `<< /Title (${pdfEscape(model.title)}) /Author (MissionMed LOR Studio) /Subject (Faculty-final recommendation) /Keywords (privacy:${pdfEscape(model.privacyClass)}) >>`);

  const parts = [Buffer.from('%PDF-1.7\n%\xC7\xEC\x8F\xA2\n', 'latin1')];
  const offsets = [0];
  for (let objectNumber = 1; objectNumber <= infoObject; objectNumber += 1) {
    offsets[objectNumber] = parts.reduce((sum, part) => sum + part.length, 0);
    parts.push(Buffer.from(`${objectNumber} 0 obj\n${objectBodies.get(objectNumber)}\nendobj\n`, 'ascii'));
  }
  const xrefOffset = parts.reduce((sum, part) => sum + part.length, 0);
  const xref = [`xref\n0 ${infoObject + 1}\n`, '0000000000 65535 f \n'];
  for (let objectNumber = 1; objectNumber <= infoObject; objectNumber += 1) {
    xref.push(`${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`);
  }
  xref.push(`trailer\n<< /Size ${infoObject + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  parts.push(Buffer.from(xref.join(''), 'ascii'));
  return Buffer.concat(parts);
}

function artifactResult(buffer, format, model) {
  const extension = format === 'docx' ? 'docx' : 'pdf';
  return Object.freeze({
    buffer,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    format,
    extension,
    mimeType: format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf',
    privacyClass: model.privacyClass,
    caseId: model.caseId,
    provenanceCount: model.provenance.length,
  });
}

export function renderRecommendationDocx(rawModel) {
  const model = validateModel(rawModel);
  return artifactResult(makeDocx(model), 'docx', model);
}

export function renderRecommendationPdf(rawModel, { pdfApproved = false } = {}) {
  if (pdfApproved !== true) throw new Error('PDF output requires an explicit approved-output decision.');
  const model = validateModel(rawModel);
  return artifactResult(makePdf(model), 'pdf', model);
}

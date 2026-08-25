import { TimelineError } from "../core/errors.js";
import type { CvSourceBlock, CvSourceReference } from "./cv-intelligence-schema.js";
import { readOoxmlArchive } from "./timeline-rescue-zip.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_BLOCK_CHARACTERS = 20_000;
const MAX_TOTAL_CHARACTERS = 300_000;
const MAX_BLOCKS = 500;
const MAX_PDF_PAGES = 250;
const MIN_READABLE_CHARACTERS = 12;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ExactCvSourceExtraction {
  blocks: CvSourceBlock[];
  method: "PDFJS_TEXT_CONTENT" | "DOCX_OOXML_TEXT";
}

function cleanLine(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\t ]+/g, " ")
    .trim();
}

function xmlEntity(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  if (named[value]) return named[value]!;
  const point = value.startsWith("#x")
    ? Number.parseInt(value.slice(2), 16)
    : value.startsWith("#")
      ? Number.parseInt(value.slice(1), 10)
      : Number.NaN;
  return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
    ? String.fromCodePoint(point)
    : `&${value};`;
}

function docxLines(xml: string): string[] {
  return xml
    .replace(/<w:tab\b[^>]*\/>/gi, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/gi, "\n")
    .replace(/<\/w:(?:p|tr)>/gi, "\n")
    .replace(/<w:tc\b[^>]*>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_match, entity: string) => xmlEntity(entity.toLowerCase()))
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
}

function blocksFromLines(
  lines: Array<{ text: string; pageNumber: number | null }>,
  prefix: string,
): CvSourceBlock[] {
  const blocks: CvSourceBlock[] = [];
  for (const row of lines) {
    const text = cleanLine(row.text);
    if (!text) continue;
    if (text.length > MAX_BLOCK_CHARACTERS) {
      throw new TimelineError("CV_SOURCE_TEXT_TOO_LARGE", "A recovered CV text item exceeds the safe review limit.", 413);
    }
    blocks.push({
      id: `${prefix}_${blocks.length + 1}`,
      pageNumber: row.pageNumber,
      section: null,
      text,
    });
  }
  const totalCharacters = blocks.reduce((total, block) => total + block.text.length, 0);
  if (blocks.length > MAX_BLOCKS || totalCharacters > MAX_TOTAL_CHARACTERS) {
    throw new TimelineError("CV_SOURCE_TEXT_TOO_LARGE", "Recovered CV text exceeds the safe analysis limit.", 413);
  }
  if (totalCharacters < MIN_READABLE_CHARACTERS) {
    throw new TimelineError(
      "CV_SOURCE_OCR_REQUIRED",
      "No reliable born-digital text was recovered from the exact stored CV. Review the file or use authenticated OCR before AI analysis.",
      422,
    );
  }
  return blocks;
}

function pdfPageLines(items: readonly unknown[], pageNumber: number): Array<{ text: string; pageNumber: number }> {
  const lines: Array<{ text: string; pageNumber: number }> = [];
  let fragments: string[] = [];
  const flush = () => {
    const text = cleanLine(fragments.join(" "));
    if (text) {
      const prior = lines.at(-1);
      // PDF generators commonly wrap the final year onto its own visual line.
      // Rejoin only this unambiguous date continuation; no factual content is
      // inferred or introduced.
      if (
        prior
        && /^\d{4}$/.test(text)
        && /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(prior.text)
      ) prior.text += ` ${text}`;
      else lines.push({ text, pageNumber });
    }
    fragments = [];
  };
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const text = "str" in item && typeof item.str === "string" ? cleanLine(item.str) : "";
    if (text) fragments.push(text);
    if ("hasEOL" in item && item.hasEOL === true) flush();
  }
  flush();
  return lines;
}

async function extractPdfBlocks(bytes: Uint8Array): Promise<ExactCvSourceExtraction> {
  const loadingTask = getDocument({
    // PDF.js may transfer its input to a worker. Keep the authenticated source
    // bytes intact for the service's already-verified SHA/length evidence.
    data: Uint8Array.from(bytes),
    isEvalSupported: false,
    stopAtErrors: true,
    useSystemFonts: true,
    useWorkerFetch: false,
  });
  let pdf: Awaited<typeof loadingTask.promise> | null = null;
  try {
    pdf = await loadingTask.promise;
    if (pdf.numPages < 1 || pdf.numPages > MAX_PDF_PAGES) {
      throw new TimelineError("CV_SOURCE_TEXT_TOO_LARGE", "The CV has too many pages for safe analysis.", 413);
    }
    const lines: Array<{ text: string; pageNumber: number }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent({ disableNormalization: false });
        lines.push(...pdfPageLines(content.items, pageNumber));
      } finally {
        page.cleanup();
      }
    }
    return { blocks: blocksFromLines(lines, "source_pdf"), method: "PDFJS_TEXT_CONTENT" };
  } catch (error) {
    if (error instanceof TimelineError) throw error;
    throw new TimelineError("CV_SOURCE_DOCUMENT_INVALID", "The exact stored PDF is invalid or unsupported.", 409);
  } finally {
    if (pdf) await pdf.destroy();
    else await loadingTask.destroy().catch(() => undefined);
  }
}

function extractDocxBlocks(bytes: Uint8Array): ExactCvSourceExtraction {
  try {
    const archive = readOoxmlArchive(bytes);
    const entry = [...archive.entries()].find(([name]) => name.toLowerCase() === "word/document.xml")?.[1];
    if (!entry) throw new Error("CV_DOCX_DOCUMENT_XML_MISSING");
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(entry);
    return {
      blocks: blocksFromLines(docxLines(xml).map((text) => ({ text, pageNumber: null })), "source_docx"),
      method: "DOCX_OOXML_TEXT",
    };
  } catch (error) {
    if (error instanceof TimelineError) throw error;
    throw new TimelineError("CV_SOURCE_DOCUMENT_INVALID", "The exact stored DOCX is invalid or unsupported.", 409);
  }
}

/** Derive provider evidence blocks only from the authenticated stored bytes. */
export async function extractExactCvSourceBlocks(
  bytes: Uint8Array,
  mimeType: CvSourceReference["mimeType"],
): Promise<ExactCvSourceExtraction> {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new TimelineError("CV_SOURCE_BYTES_INVALID", "The exact stored CV size is outside the safe analysis limit.", 413);
  }
  return mimeType === "application/pdf"
    ? await extractPdfBlocks(bytes)
    : mimeType === DOCX_MIME
      ? extractDocxBlocks(bytes)
      : (() => { throw new TimelineError("CV_SOURCE_MIME_INVALID", "CV source type is invalid.", 415); })();
}

import { inflateSync } from "node:zlib";

import type { RescueVisualObject } from "./timeline-rescue-schema.js";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_STREAM_BYTES = 10 * 1024 * 1024;

function decodeLiteral(value: string): string {
  return value.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, token: string) => {
    if (/^[0-7]/.test(token)) return String.fromCharCode(Number.parseInt(token, 8));
    return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" } as Record<string, string>)[token] ?? token;
  });
}

function stringsFromContent(content: string): Array<{ text: string; x: number | null; y: number | null }> {
  const output: Array<{ text: string; x: number | null; y: number | null }> = [];
  const tokens = /\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:[^\]]|\](?!\s*TJ))*)\]\s*TJ/g;
  for (const match of content.matchAll(tokens)) {
    const raw = match[1] !== undefined
      ? decodeLiteral(match[1])
      : [...(match[2] ?? "").matchAll(/\(((?:\\.|[^\\()])*)\)/g)].map((item) => decodeLiteral(item[1] ?? "")).join("");
    const normalized = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const before = content.slice(Math.max(0, match.index! - 220), match.index!);
    const matrices = [...before.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/g)];
    const matrix = matrices.at(-1);
    output.push({ text: normalized, x: matrix ? Number(matrix[5]) : null, y: matrix ? Number(matrix[6]) : null });
  }
  return output;
}

/**
 * Conservative born-digital PDF fallback. Complex fonts and scanned pages deliberately
 * return no text so the authenticated OCR/vision seam can handle them without guessing.
 */
export function extractPdf(input: Uint8Array): { pageCount: number; objects: RescueVisualObject[]; warnings: string[] } {
  if (input.byteLength < 8 || input.byteLength > MAX_PDF_BYTES) throw new Error("RESCUE_PDF_SIZE_INVALID");
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("RESCUE_PDF_INVALID");
  const source = bytes.toString("latin1");
  const pageCount = Math.max(1, [...source.matchAll(/\/Type\s*\/Page(?!s)\b/g)].length);
  const extracted: Array<{ text: string; x: number | null; y: number | null }> = [];
  for (const match of source.matchAll(/((?:<<)[\s\S]*?(?:>>))\s*stream\r?\n/g)) {
    const dictionary = match[1]!;
    const start = match.index! + match[0].length;
    const end = source.indexOf("endstream", start);
    if (end < 0 || end - start > MAX_STREAM_BYTES) continue;
    let stream = bytes.subarray(start, end);
    if (stream.at(-1) === 0x0a) stream = stream.subarray(0, stream.length - 1);
    if (stream.at(-1) === 0x0d) stream = stream.subarray(0, stream.length - 1);
    try {
      if (/\/FlateDecode\b/.test(dictionary)) stream = inflateSync(stream, { maxOutputLength: MAX_STREAM_BYTES });
      else if (/\/Filter\b/.test(dictionary)) continue;
      extracted.push(...stringsFromContent(stream.toString("latin1")));
    } catch {
      // Fail soft: an unreadable stream is evidence for OCR, never permission to guess.
    }
  }
  const objects = extracted.slice(0, 2_000).map((item, index): RescueVisualObject => ({
    id: `pdf-text-${index + 1}`,
    pageOrSlide: 1,
    kind: "TEXT",
    name: null,
    text: item.text,
    geometry: item.x !== null && item.y !== null
      ? { x: item.x, y: item.y, width: Math.max(12, item.text.length * 5.5), height: 12, unit: "PDF_POINT" }
      : null,
    groupId: null,
    zIndex: index,
    fill: null,
    stroke: null,
    fontFamily: null,
    fontSizePt: null,
    relationshipTarget: null,
    mediaSha256: null,
  }));
  const warnings = objects.length
    ? ["PDF extraction is limited to directly encoded text; geometry and font encoding may require server-side document vision."]
    : ["No reliable born-digital PDF text was recovered; authenticated OCR/document vision is required."];
  return { pageCount, objects, warnings };
}

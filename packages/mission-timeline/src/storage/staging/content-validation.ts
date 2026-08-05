import type { PrivateObjectSanitizerPort, SanitizeObjectRequest, SanitizeObjectResult } from "./ports.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const UTF8 = new TextDecoder("utf-8", { fatal: true });

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return UTF8.decode(bytes);
  } catch {
    return null;
  }
}

function isPlainText(bytes: Uint8Array): boolean {
  const text = decodeUtf8(bytes);
  return text !== null && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text);
}

function isJson(bytes: Uint8Array): boolean {
  const text = decodeUtf8(bytes);
  if (text === null) return false;
  try {
    JSON.parse(text.replace(/^\uFEFF/, ""));
    return true;
  } catch {
    return false;
  }
}

function isHtml(bytes: Uint8Array): boolean {
  const text = decodeUtf8(bytes);
  if (text === null) return false;
  const start = text.replace(/^\uFEFF/, "").trimStart().slice(0, 256).toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html");
}

interface JpegInspection {
  chunks: Uint8Array[];
  removedMetadata: boolean;
}

function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8) || marker === 0xd9;
}

function isPrivacyMetadataMarker(marker: number): boolean {
  return marker === 0xe1 || marker === 0xed || marker === 0xfe;
}

function inspectJpeg(bytes: Uint8Array, stripPrivacyMetadata: boolean): JpegInspection {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("JPEG_SOI_MISSING");
  const chunks: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  let removedMetadata = false;
  let sawEnd = false;

  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) throw new Error("JPEG_MARKER_INVALID");
    const markerStart = offset;
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) throw new Error("JPEG_MARKER_TRUNCATED");
    const marker = bytes[offset]!;
    offset += 1;
    if (marker === 0x00 || marker === 0xd8) throw new Error("JPEG_MARKER_INVALID");

    if (marker === 0xd9) {
      chunks.push(bytes.slice(markerStart, offset));
      sawEnd = true;
      if (offset !== bytes.byteLength) throw new Error("JPEG_TRAILING_DATA");
      break;
    }

    if (isStandaloneJpegMarker(marker)) {
      chunks.push(bytes.slice(markerStart, offset));
      continue;
    }

    if (offset + 2 > bytes.byteLength) throw new Error("JPEG_SEGMENT_TRUNCATED");
    const segmentLength = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (segmentLength < 2) throw new Error("JPEG_SEGMENT_LENGTH_INVALID");
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > bytes.byteLength) throw new Error("JPEG_SEGMENT_TRUNCATED");

    if (stripPrivacyMetadata && isPrivacyMetadataMarker(marker)) {
      removedMetadata = true;
    } else {
      chunks.push(bytes.slice(markerStart, segmentEnd));
    }
    offset = segmentEnd;

    if (marker !== 0xda) continue;

    const entropyStart = offset;
    while (offset < bytes.byteLength) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      let next = offset + 1;
      while (next < bytes.byteLength && bytes[next] === 0xff) next += 1;
      if (next >= bytes.byteLength) throw new Error("JPEG_SCAN_TRUNCATED");
      const scanMarker = bytes[next]!;
      if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
        offset = next + 1;
        continue;
      }
      chunks.push(bytes.slice(entropyStart, offset));
      break;
    }
  }

  if (!sawEnd) throw new Error("JPEG_EOI_MISSING");
  return { chunks, removedMetadata };
}

function joinChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

export function hasJpegPrivacyMetadata(bytes: Uint8Array): boolean {
  return inspectJpeg(bytes, true).removedMetadata;
}

export function matchesDeclaredMimeType(mimeType: string, bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0) return false;
  switch (mimeType) {
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "application/json":
      return isJson(bytes);
    case "application/zip":
      return (
        startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
        startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
      );
    case "image/png":
      return startsWith(bytes, PNG_SIGNATURE);
    case "image/jpeg":
      try {
        inspectJpeg(bytes, false);
        return true;
      } catch {
        return false;
      }
    case "image/webp":
      return bytes.byteLength >= 12 && startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "image/gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    case "text/html":
      return isHtml(bytes);
    case "text/plain":
      return isPlainText(bytes);
    default:
      return false;
  }
}

/** Removes EXIF/XMP (APP1), IPTC (APP13), and JPEG comments. */
export class ExifStrippingJpegSanitizer implements PrivateObjectSanitizerPort {
  async sanitize(request: SanitizeObjectRequest): Promise<SanitizeObjectResult> {
    if (request.mimeType !== "image/jpeg") throw new Error("SANITIZER_MIME_UNSUPPORTED");
    const inspected = inspectJpeg(request.bytes, true);
    return {
      bytes: joinChunks(inspected.chunks),
      sanitizer: "builtin-jpeg-metadata-stripper",
      sanitizerVersion: "1",
      removedMetadata: inspected.removedMetadata,
    };
  }
}

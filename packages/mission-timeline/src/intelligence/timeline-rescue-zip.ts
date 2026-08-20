import { inflateRawSync } from "node:zlib";

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_ENTRY_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 5_000;

export class RescueArchiveError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function safeName(name: string): boolean {
  return Boolean(name) && !name.startsWith("/") && !name.includes("\\") && !name.split("/").includes("..");
}

/** A deliberately bounded OOXML ZIP reader. It accepts STORE and DEFLATE only. */
export function readOoxmlArchive(input: Uint8Array): Map<string, Uint8Array> {
  if (input.byteLength < 22 || input.byteLength > MAX_ARCHIVE_BYTES) {
    throw new RescueArchiveError("RESCUE_ARCHIVE_SIZE_INVALID", "The presentation archive size is not supported.");
  }
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const minimum = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= minimum; index -= 1) {
    if (bytes.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new RescueArchiveError("RESCUE_ARCHIVE_INVALID", "The presentation archive is invalid.");
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (entryCount > MAX_ENTRIES || centralOffset >= bytes.length) {
    throw new RescueArchiveError("RESCUE_ARCHIVE_LIMIT_EXCEEDED", "The presentation archive exceeds safe limits.");
  }

  const output = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  let totalBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) {
      throw new RescueArchiveError("RESCUE_ARCHIVE_INVALID", "The presentation archive directory is invalid.");
    }
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!safeName(name) || uncompressedSize > MAX_ENTRY_BYTES || compressedSize > MAX_ENTRY_BYTES) {
      throw new RescueArchiveError("RESCUE_ARCHIVE_ENTRY_INVALID", "The presentation archive contains an unsafe entry.");
    }
    totalBytes += uncompressedSize;
    if (totalBytes > MAX_TOTAL_BYTES) throw new RescueArchiveError("RESCUE_ARCHIVE_LIMIT_EXCEEDED", "The expanded presentation is too large.");
    if (name.endsWith("/")) continue;
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new RescueArchiveError("RESCUE_ARCHIVE_INVALID", "The presentation archive contains an invalid local entry.");
    }
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new RescueArchiveError("RESCUE_ARCHIVE_INVALID", "The presentation archive is truncated.");
    const compressed = bytes.subarray(dataStart, dataEnd);
    let data: Buffer;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) data = inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY_BYTES });
    else throw new RescueArchiveError("RESCUE_ARCHIVE_COMPRESSION_UNSUPPORTED", "The presentation uses an unsupported ZIP compression method.");
    if (data.byteLength !== uncompressedSize) throw new RescueArchiveError("RESCUE_ARCHIVE_INVALID", "The presentation archive entry size does not match its directory.");
    output.set(name, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  return output;
}

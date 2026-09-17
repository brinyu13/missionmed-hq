import { deflateRawSync, inflateRawSync } from 'node:zlib';

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

export function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, rawValue] of entries) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const raw = Buffer.isBuffer(rawValue) ? rawValue : Buffer.from(String(rawValue), 'utf8');
    const compressed = deflateRawSync(raw, { level: 9 });
    const checksum = crc32(raw);
    const localHeader = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(8),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(compressed.length),
      uint32(raw.length),
      uint16(nameBuffer.length),
      uint16(0),
      nameBuffer,
    ]);
    localParts.push(localHeader, compressed);

    centralParts.push(Buffer.concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(8),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(compressed.length),
      uint32(raw.length),
      uint16(nameBuffer.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      nameBuffer,
    ]));

    offset += localHeader.length + compressed.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(central.length),
    uint32(offset),
    uint16(0),
  ]);
  return Buffer.concat([...localParts, central, end]);
}

export function readZipEntries(zip) {
  const output = new Map();
  let offset = 0;
  while (offset + 4 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const rawSize = zip.readUInt32LE(offset + 22);
    const nameSize = zip.readUInt16LE(offset + 26);
    const extraSize = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameSize + extraSize;
    const name = zip.subarray(nameStart, nameStart + nameSize).toString('utf8');
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const raw = method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed);
    if (raw.length !== rawSize) throw new Error(`ZIP entry size mismatch for ${name}.`);
    output.set(name, raw);
    offset = dataStart + compressedSize;
  }
  return output;
}

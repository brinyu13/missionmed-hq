function crcTable(){const table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;}const CRC_TABLE=crcTable();
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=CRC_TABLE[(crc^byte)&0xff]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function u16(value){return new Uint8Array([value&255,(value>>>8)&255]);}
function u32(value){return new Uint8Array([value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255]);}
function concat(parts){const size=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(size);let offset=0;parts.forEach((part)=>{out.set(part,offset);offset+=part.length;});return out;}

export function buildStoredZip(entries){
  const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;
  entries.forEach((entry)=>{const name=encoder.encode(entry.name),bytes=entry.bytes instanceof Uint8Array?entry.bytes:encoder.encode(String(entry.bytes)),crc=crc32(bytes);
    const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(bytes.length),u32(bytes.length),u16(name.length),u16(0),name,bytes]);locals.push(local);
    const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(bytes.length),u32(bytes.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length;});
  const centralBytes=concat(centrals),end=concat([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(centralBytes.length),u32(offset),u16(0)]);return new Blob([...locals,centralBytes,end],{type:"application/zip"});
}

export async function blobEntry(name,blob){return {name,bytes:new Uint8Array(await blob.arrayBuffer())};}

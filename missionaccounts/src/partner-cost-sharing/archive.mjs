import { createHash } from 'node:crypto';
import { fail } from './ledger.mjs';
import { statementToCsv } from './statements.mjs';
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
// STORE-only ZIP uses exact original bytes; bounded private output, with no filesystem paths in entries.
export function privateZip(entries){
 if(!Array.isArray(entries)||entries.length>100)fail('Invoice package exceeds bounded census',413);
 const names=new Set(),parts=[],central=[];let offset=0,total=0;
 for(const entry of entries){
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(entry.name)||names.has(entry.name))fail('Unsafe or duplicate package entry',400);
  names.add(entry.name);const bytes=Buffer.from(entry.bytes),name=Buffer.from(entry.name);total+=bytes.length;if(total>25*1024*1024)fail('Invoice package exceeds private export limit',413);
  const crc=crc32(bytes),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
  const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(bytes.length,20);dir.writeUInt32LE(bytes.length,24);dir.writeUInt16LE(name.length,28);dir.writeUInt32LE(offset,42);
  parts.push(header,name,bytes);central.push(dir,name);offset+=header.length+name.length+bytes.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...parts,directory,end]);
}
export async function invoicePackage(record,readOriginal){
 const unique=new Map((record.invoicePackageManifest||[]).map(x=>[x.expenseId,x])),entries=[],manifest=[];
 for(const row of unique.values()){
  const asset=await readOriginal(row.expenseId);
  if(!asset?.bytes||!['application/pdf','image/png','image/jpeg'].includes(asset.type))fail('Original custody unavailable; incomplete package withheld',409);
  const bytes=Buffer.from(asset.bytes);
  if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)fail('Original custody unavailable; incomplete package withheld',409);
  const extension=asset.type==='application/pdf'?'pdf':asset.type==='image/jpeg'?'jpg':'png',name='invoice-'+row.expenseId+'.'+extension;
  entries.push({name,bytes});manifest.push({...row,filename:name,byteLength:bytes.length});
 }
 const clean={domain:'partner_cost_sharing',partner:record.partner,start:record.start,end:record.end,currency:'USD',certified:record.certified,
  statementHash:record.statementHash,invoiceManifest:manifest,privacy:'Authorized own statement and shared invoice evidence only',taxTreatment:'No tax treatment is assumed.'};
 entries.unshift({name:'statement.json',bytes:JSON.stringify(record,null,2)},{name:'statement.csv',bytes:statementToCsv(record)},{name:'manifest.json',bytes:JSON.stringify(clean,null,2)});
 const bytes=privateZip(entries);return {base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),filename:'partner-'+record.partner.key+'-'+record.start+'-'+record.end+(record.certified?'':'-DRAFT')+'.zip',originalCount:manifest.length};
}

import { createHash } from 'node:crypto';
import { fail, text } from './ledger.mjs';
const max=10485760;
export function originalType(bytes){
 if(bytes.subarray(0,5).toString('ascii')==='%PDF-')return 'application/pdf';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 fail('Supported original invoice PDF, PNG or JPEG required',400);
}
// Bucket construction and approval happen separately. This class never creates a bucket or changes ACLs.
export class PartnerEvidenceCustodian{
 constructor({mode='disabled',privateWriteApproved=false,put=null,read=null,register=null}={}){this.mode=mode;this.approved=privateWriteApproved;this.put=put;this.read=read;this.register=register;}
 async preserve(bytes,{sourceId}={}){
  if(this.mode==='disabled')return {state:'DISABLED',preserved:false};
  if(!this.approved||typeof this.put!=='function'||typeof this.read!=='function'||typeof this.register!=='function')fail('Private custody activation is not approved',503);
  bytes=Buffer.from(bytes);if(!bytes.length||bytes.length>max)fail('Private original exceeds document limit',413);
  text(sourceId,'Stable original source reference',160);const contentType=originalType(bytes),sha256=createHash('sha256').update(bytes).digest('hex'),assetId='pcs-'+sha256;
  const extension=contentType==='application/pdf'?'pdf':contentType==='image/png'?'png':'jpg',objectKey=sha256.slice(0,32)+'/'+sha256+'.'+extension;
  let existing;try{existing=await this.read(objectKey);}catch(error){if(error?.status!==404&&error?.code!=='OBJECT_NOT_FOUND')throw error;}
  if(existing!=null){const old=Buffer.from(existing);if(old.length!==bytes.length||createHash('sha256').update(old).digest('hex')!==sha256)fail('Existing private original differs; overwrite withheld',409);}
  else await this.put(objectKey,bytes,{contentType,upsert:false,private:true});
  const checked=Buffer.from(await this.read(objectKey));
  if(checked.length!==bytes.length||createHash('sha256').update(checked).digest('hex')!==sha256)fail('Private storage readback custody differs',409);
  await this.register({assetId,objectKey,originalSha256:sha256,contentType,byteLength:bytes.length,sourceId});
  return {state:'PRIVATE_CUSTODY_VERIFIED',preserved:true,assetId,sha256,contentType,byteLength:bytes.length};
 }
}

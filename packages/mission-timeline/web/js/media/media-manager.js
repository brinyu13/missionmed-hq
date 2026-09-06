import {clone,nowIso,sha256Hex,stableId,visibilityName} from "../core/canonical.js";

export const MEDIA_TYPES=new Set(["image/jpeg","image/png","image/webp"]);
export const MAX_MEDIA_BYTES=5*1024*1024;
export const MAX_IMAGE_DIMENSION=8000;
export const MIN_IMAGE_DIMENSION=64;

export function validateMediaDescriptor({type,size,width,height}){
  const errors=[];
  if(!MEDIA_TYPES.has(String(type||"").toLowerCase()))errors.push("UNSUPPORTED_MEDIA_TYPE");
  if(!Number.isFinite(size)||size<=0)errors.push("EMPTY_MEDIA_FILE");
  if(size>MAX_MEDIA_BYTES)errors.push("MEDIA_TOO_LARGE");
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<MIN_IMAGE_DIMENSION||height<MIN_IMAGE_DIMENSION)errors.push("MEDIA_DIMENSIONS_TOO_SMALL");
  if(width>MAX_IMAGE_DIMENSION||height>MAX_IMAGE_DIMENSION)errors.push("MEDIA_DIMENSIONS_TOO_LARGE");
  return {ok:errors.length===0,errors};
}

async function decodeDimensions(blob){
  if(typeof createImageBitmap==="function"){
    const bitmap=await createImageBitmap(blob);const dimensions={width:bitmap.width,height:bitmap.height};bitmap.close();return dimensions;
  }
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob),image=new Image();
    image.onload=()=>{resolve({width:image.naturalWidth,height:image.naturalHeight});URL.revokeObjectURL(url);};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("IMAGE_DECODE_FAILED"));};image.src=url;
  });
}

async function thumbnailDataUrl(blob,width,height){
  if(typeof document==="undefined")return null;
  const max=220,scale=Math.min(1,max/Math.max(width,height));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext("2d");
  if(typeof createImageBitmap==="function"){
    const bitmap=await createImageBitmap(blob);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  }else{
    const url=URL.createObjectURL(blob);const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});ctx.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
  }
  return canvas.toDataURL("image/jpeg",0.78);
}

export class MediaManager{
  constructor(state,adapter){this.state=state;this.adapter=adapter;this.objectUrls=new Map();this.runtimeBlobs=new Map();this.revokedObjectUrlCount=0;if(!state.mediaItems)state.mediaItems=[];if(!state.mediaLayout)state.mediaLayout={photoCount:3};}
  list(){return this.state.mediaItems;}
  get(id){return this.state.mediaItems.find((item)=>item.id===id)||null;}
  async addFile(file,{type="photo",placement="photo0",visibility="FULL_STORY",altText=""}={}){
    if(!file?.arrayBuffer)throw new Error("A local image file is required.");
    const preliminary=[];
    if(!MEDIA_TYPES.has(String(file.type||"").toLowerCase()))preliminary.push("UNSUPPORTED_MEDIA_TYPE");
    if(!Number.isFinite(file.size)||file.size<=0)preliminary.push("EMPTY_MEDIA_FILE");
    if(file.size>MAX_MEDIA_BYTES)preliminary.push("MEDIA_TOO_LARGE");
    if(preliminary.length){const error=new Error(preliminary.join(","));error.codes=preliminary;throw error;}
    const dimensions=await decodeDimensions(file);
    const check=validateMediaDescriptor({type:file.type,size:file.size,width:dimensions.width,height:dimensions.height});
    if(!check.ok){const error=new Error(check.errors.join(","));error.codes=check.errors;throw error;}
    const bytes=await file.arrayBuffer(),contentHash=await sha256Hex(bytes);
    const id=stableId("media",[contentHash,placement,type]);
    const existing=this.state.mediaItems.find((item)=>item.placement===placement);
    if(existing)await this.remove(existing.id);
    const item={id,type,placement,sourceFilename:file.name||"local-image",mimeType:file.type,size:file.size,width:dimensions.width,height:dimensions.height,contentHash,
      thumbnail:await thumbnailDataUrl(file,dimensions.width,dimensions.height),crop:{x:50,y:50,zoom:1,rotation:0},altText:String(altText||"").trim(),visibility:visibilityName(visibility),localProvenance:{source:"LOCAL_FILE",transmission:"NONE",selectedAt:nowIso()},createdAt:nowIso(),updatedAt:nowIso()};
    await this.adapter.putBlob(id,file,{mimeType:file.type,filename:item.sourceFilename,contentHash});this.runtimeBlobs.set(id,file);this.state.mediaItems.push(item);return item;
  }
  addSynthetic(item,blob=null){
    const record={crop:{x:50,y:50,zoom:1,rotation:0},visibility:"FULL_STORY",createdAt:nowIso(),updatedAt:nowIso(),...clone(item)};
    if(!record.id)record.id=stableId("media",[record.contentHash||record.sourceFilename,record.placement]);
    this.state.mediaItems=this.state.mediaItems.filter((entry)=>entry.placement!==record.placement);this.state.mediaItems.push(record);if(blob)this.runtimeBlobs.set(record.id,blob);return record;
  }
  update(id,patch){
    const item=this.get(id);if(!item)throw new Error("Media item not found.");
    if(patch.crop){const crop={...item.crop,...patch.crop};crop.x=Math.max(0,Math.min(100,Number(crop.x)));crop.y=Math.max(0,Math.min(100,Number(crop.y)));crop.zoom=Math.max(1,Math.min(3,Number(crop.zoom)));crop.rotation=Math.max(-15,Math.min(15,Number(crop.rotation)));item.crop=crop;}
    if(Object.prototype.hasOwnProperty.call(patch,"altText"))item.altText=String(patch.altText||"").trim();
    if(patch.visibility)item.visibility=visibilityName(patch.visibility);
    if(patch.placement)item.placement=patch.placement;
    item.updatedAt=nowIso();return item;
  }
  setPhotoCount(count){const value=Number(count);if(![3,4,5].includes(value))throw new Error("Photo layout must use 3, 4, or 5 photos.");this.state.mediaLayout.photoCount=value;return value;}
  async blob(id){return this.runtimeBlobs.get(id)||await this.adapter.getBlob(id);}
  async objectUrl(id){
    if(this.objectUrls.has(id))return this.objectUrls.get(id);
    const blob=await this.blob(id);if(!blob)return null;
    const url=URL.createObjectURL(blob);this.objectUrls.set(id,url);return url;
  }
  revoke(id){const url=this.objectUrls.get(id);if(url){URL.revokeObjectURL(url);this.objectUrls.delete(id);this.revokedObjectUrlCount++;}}
  async remove(id){const item=this.get(id);if(!item)return null;this.revoke(id);this.runtimeBlobs.delete(id);await this.adapter.deleteBlob(id);this.state.mediaItems=this.state.mediaItems.filter((entry)=>entry.id!==id);return item;}
  async eraseAll(){for(const item of [...this.state.mediaItems])await this.remove(item.id);}
  cleanup(){[...this.objectUrls.keys()].forEach((id)=>this.revoke(id));}
  async archiveEntries(predicate=()=>true){
    const entries=[];for(const item of this.state.mediaItems.filter(predicate)){const blob=await this.blob(item.id);const filename=String(item.sourceFilename||"local-image").replace(/[\\/]/g,"-");if(blob)entries.push({id:item.id,name:`media/${item.id}-${filename}`,bytes:new Uint8Array(await blob.arrayBuffer()),mimeType:item.mimeType});}
    return entries;
  }
}

import {clone,nowIso,stableId} from "../core/canonical.js";

export class RecoveryManager{
  constructor(adapter){this.adapter=adapter;}
  async checkpoint(document,{reason="AUTOSAVE",sequence=0}={}){const record={id:stableId("checkpoint",[document.id,sequence,reason,nowIso()]),documentId:document.id,sequence,reason,document:clone(document),createdAt:nowIso(),valid:true};await this.adapter.put("checkpoints",record);return record;}
  async list(documentId){const values=await this.adapter.list("checkpoints",(item)=>item.documentId===documentId&&item.valid!==false);return values.sort((a,b)=>b.sequence-a.sequence||String(b.createdAt).localeCompare(String(a.createdAt)));}
  async latest(documentId){return (await this.list(documentId))[0]||null;}
  async recover(documentId,currentRecord=null){const checkpoint=await this.latest(documentId);if(!checkpoint)return {recovered:false,reason:"NO_CHECKPOINT"};if(currentRecord?.savedAt&&checkpoint.createdAt<=currentRecord.savedAt)return {recovered:false,reason:"CURRENT_IS_NEWER",checkpoint};return {recovered:true,reason:"CHECKPOINT_NEWER",document:clone(checkpoint.document),checkpoint};}
  async markMalformed(checkpointId,error){const checkpoint=await this.adapter.get("checkpoints",checkpointId);if(!checkpoint)return;checkpoint.valid=false;checkpoint.error=String(error);await this.adapter.put("checkpoints",checkpoint);}
}

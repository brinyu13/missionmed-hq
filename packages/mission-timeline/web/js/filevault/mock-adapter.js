import {clone,nowIso,stableId} from "../core/canonical.js";
import {assertAdapterContract,FileVaultAdapter} from "./adapter-contract.js";

export class MockFileVaultAdapter extends FileVaultAdapter{
  constructor(options){super(options);this.records=new Map();this.idempotency=new Map();this.audit=[];this.failures=[];assertAdapterContract(this);}
  injectFailure(operation,message="SIMULATED_ADAPTER_FAILURE"){this.failures.push({operation,message});}
  maybeFail(operation){const index=this.failures.findIndex((item)=>item.operation===operation||item.operation==="*");if(index>=0){const [failure]=this.failures.splice(index,1);throw new Error(failure.message);}}
  log(action,details={}){const row={id:stableId("vault-audit",[this.generation,action,Date.now(),this.audit.length]),action,generation:this.generation,details:clone(details),at:nowIso(),mockOnly:true};this.audit.push(row);return row;}
  async createTimelineArtifact(artifact){
    this.maybeFail("createTimelineArtifact");
    const existingId=this.idempotency.get(artifact.idempotencyKey);if(existingId)return {record:clone(this.records.get(existingId)),created:false,idempotentReplay:true};
    const id=stableId(`${this.generation.toLowerCase()}-vault`,artifact.idempotencyKey),record={id,artifactId:artifact.artifactId,idempotencyKey:artifact.idempotencyKey,ownerId:artifact.studentOwnerId,status:"ACTIVE",version:1,artifact:clone(artifact),createdAt:nowIso(),updatedAt:nowIso(),mockOnly:true};
    this.records.set(id,record);this.idempotency.set(artifact.idempotencyKey,id);this.log("CREATE",{id,artifactId:artifact.artifactId});return {record:clone(record),created:true,idempotentReplay:false};
  }
  async updateTimelineArtifact(reference,artifact){this.maybeFail("updateTimelineArtifact");const record=this.records.get(reference);if(!record)throw new Error("ARTIFACT_NOT_FOUND");record.artifact=clone(artifact);record.updatedAt=nowIso();this.log("UPDATE",{reference});return clone(record);}
  async createNewVersion(reference,artifact){
    this.maybeFail("createNewVersion");const record=this.records.get(reference);if(!record)throw new Error("ARTIFACT_NOT_FOUND");
    if(record.artifact?.idempotencyKey===artifact.idempotencyKey||record.artifact?.contentHash===artifact.contentHash)return {record:clone(record),created:false,idempotentReplay:true};
    record.version++;record.artifact=clone(artifact);record.updatedAt=nowIso();this.idempotency.set(artifact.idempotencyKey,reference);this.log("NEW_VERSION",{reference,version:record.version});return {record:clone(record),created:true,idempotentReplay:false};
  }
  async retrieveArtifact(reference){this.maybeFail("retrieveArtifact");return clone(this.records.get(reference)||null);}
  async listStudentTimelineArtifacts(ownerId){this.maybeFail("listStudentTimelineArtifacts");return [...this.records.values()].filter((row)=>row.ownerId===ownerId).map(clone);}
  async archiveArtifact(reference){this.maybeFail("archiveArtifact");const row=this.records.get(reference);if(!row)throw new Error("ARTIFACT_NOT_FOUND");row.status="ARCHIVED";row.updatedAt=nowIso();this.log("ARCHIVE",{reference});return clone(row);}
  async deleteArtifact(reference){this.maybeFail("deleteArtifact");const row=this.records.get(reference);if(!row)return {deleted:false};this.records.delete(reference);this.idempotency.delete(row.idempotencyKey);this.log("DELETE",{reference});return {deleted:true,reference};}
  async syncStatus(reference){const row=this.records.get(reference);return {reference,exists:!!row,status:row?.status||"MISSING",version:row?.version||0,generation:this.generation,mockOnly:true};}
  async reconcile(reference,artifact){const row=this.records.get(reference);if(!row)return {state:"MISSING",generation:this.generation};if(row.artifact.contentHash===artifact.contentHash)return {state:"MATCH",generation:this.generation,reference};return {state:"DIFFERS",generation:this.generation,reference,remoteHash:row.artifact.contentHash,localHash:artifact.contentHash};}
}

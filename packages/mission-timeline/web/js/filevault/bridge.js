import {clone,nowIso,stableId} from "../core/canonical.js";
import {FILEVAULT_MODES} from "./capabilities.js";
import {assertAdapterContract} from "./adapter-contract.js";

export class FileVaultBridge{
  constructor({legacy,v2,state}){assertAdapterContract(legacy);assertAdapterContract(v2);this.legacy=legacy;this.v2=v2;this.state=state;this.state.mode=this.state.mode||FILEVAULT_MODES.DISABLED;this.state.status=this.state.status||"NOT_CONNECTED";this.state.links=this.state.links||[];this.state.syncHistory=this.state.syncHistory||[];this.state.mockOnly=true;this.productionRequestCount=0;}
  setMode(mode){if(!Object.values(FILEVAULT_MODES).includes(mode))throw new Error("Unknown FileVault bridge mode.");this.state.mode=mode;this.audit("MODE_CHANGED",{mode});return mode;}
  audit(action,details={}){const row={id:stableId("bridge-audit",[action,Date.now(),this.state.syncHistory.length]),action,details:clone(details),at:nowIso(),mockOnly:true};this.state.syncHistory.push(row);return row;}
  logicalKey(artifact){return `${artifact.timelineDocumentId}:${artifact.artifactType}`;}
  findLink(artifactId){return this.state.links.find((link)=>link.artifactId===artifactId||(link.artifactIds||[]).includes(artifactId))||null;}
  findLogicalLink(artifact){const key=this.logicalKey(artifact);return this.state.links.find((link)=>link.logicalKey===key)||this.findLink(artifact.artifactId);}
  async saveArtifact(artifact){
    const mode=this.state.mode;if(mode===FILEVAULT_MODES.DISABLED){this.state.status="DISABLED";this.audit("WRITE_SKIPPED_DISABLED",{artifactId:artifact.artifactId});return {status:"DISABLED",writes:0,mockOnly:true};}
    let link=this.findLogicalLink(artifact);if(!link){link={id:stableId("vault-link",this.logicalKey(artifact)),logicalKey:this.logicalKey(artifact),artifactId:artifact.artifactId,artifactIds:[artifact.artifactId],idempotencyKey:artifact.idempotencyKey,legacyReference:null,v2Reference:null,status:"PENDING",versions:[],createdAt:nowIso(),updatedAt:nowIso()};this.state.links.push(link);}
    else{link.artifactId=artifact.artifactId;link.idempotencyKey=artifact.idempotencyKey;link.artifactIds=[...new Set([...(link.artifactIds||[]),artifact.artifactId])];}
    const writes=[];
    const perform=async(generation,adapter,field)=>{
      try{
        const reference=link[field];let result;
        if(reference){const status=await adapter.syncStatus(reference);result=status.exists?await adapter.createNewVersion(reference,artifact):await adapter.createTimelineArtifact(artifact);}else result=await adapter.createTimelineArtifact(artifact);
        const record=result.record||result;link[field]=record.id;writes.push({generation,status:"SUCCESS",reference:record.id,idempotentReplay:!!result.idempotentReplay});
      }catch(error){writes.push({generation,status:"FAILED",error:String(error.message||error)});}
    };
    if(mode===FILEVAULT_MODES.LEGACY_ONLY)await perform("LEGACY",this.legacy,"legacyReference");
    if(mode===FILEVAULT_MODES.V2_ONLY||mode===FILEVAULT_MODES.READ_LEGACY_WRITE_V2)await perform("V2",this.v2,"v2Reference");
    if(mode===FILEVAULT_MODES.DUAL_WRITE){await perform("LEGACY",this.legacy,"legacyReference");await perform("V2",this.v2,"v2Reference");}
    const failures=writes.filter((item)=>item.status==="FAILED");link.status=failures.length===0?"SYNCED":failures.length===writes.length?"FAILED":"PARTIAL_FAILURE";link.updatedAt=nowIso();link.versions.push({artifactId:artifact.artifactId,contentHash:artifact.contentHash,writes:clone(writes),at:link.updatedAt});this.state.status=link.status;this.audit("SAVE_RESULT",{artifactId:artifact.artifactId,status:link.status,writes});return {status:link.status,writes,link:clone(link),mockOnly:true};
  }
  async reconcile(artifact){
    const link=this.findLogicalLink(artifact);if(!link)return {state:"LOCAL_ONLY",artifactId:artifact.artifactId};
    const legacy=link.legacyReference?await this.legacy.reconcile(link.legacyReference,artifact):{state:"MISSING"};
    const v2=link.v2Reference?await this.v2.reconcile(link.v2Reference,artifact):{state:"MISSING"};
    let state;if(legacy.state==="MATCH"&&v2.state==="MATCH")state="BOTH_MATCH";else if(legacy.state==="MISSING"&&v2.state==="MISSING")state="NEITHER_EXISTS";else if(legacy.state==="MATCH"&&v2.state==="MISSING")state="LEGACY_ONLY_MATCH";else if(legacy.state==="MISSING"&&v2.state==="MATCH")state="V2_ONLY_MATCH";else state="DIVERGED";
    const result={state,artifactId:artifact.artifactId,legacy,v2,at:nowIso(),mockOnly:true};this.audit("RECONCILE",result);return result;
  }
  async status(artifactId){const link=this.findLink(artifactId);if(!link)return {status:"NOT_LINKED",mockOnly:true};return {status:link.status,legacy:link.legacyReference?await this.legacy.syncStatus(link.legacyReference):null,v2:link.v2Reference?await this.v2.syncStatus(link.v2Reference):null,mockOnly:true};}
}

export {FILEVAULT_MODES};

export const FILEVAULT_OPERATIONS=["inspectCapabilities","createTimelineArtifact","updateTimelineArtifact","createNewVersion","retrieveArtifact","listStudentTimelineArtifacts","archiveArtifact","deleteArtifact","syncStatus","reconcile"];

export function assertAdapterContract(adapter){
  const missing=FILEVAULT_OPERATIONS.filter((name)=>typeof adapter?.[name]!=="function");
  if(missing.length)throw new Error("FileVault adapter is missing operations: "+missing.join(", "));
  if(adapter.productionWriteEnabled)throw new Error("D1-409 adapters must not enable production writes.");
  return true;
}

export class FileVaultAdapter{
  constructor({generation,name,capabilities,evidence}){this.generation=generation;this.name=name;this.capabilities=capabilities;this.evidence=evidence;this.productionWriteEnabled=false;this.networkRequestCount=0;}
  async inspectCapabilities(){return {generation:this.generation,name:this.name,capabilities:this.capabilities,evidence:this.evidence,productionWriteEnabled:false};}
  async createTimelineArtifact(){throw new Error("createTimelineArtifact not implemented.");}
  async updateTimelineArtifact(){throw new Error("updateTimelineArtifact not implemented.");}
  async createNewVersion(){throw new Error("createNewVersion not implemented.");}
  async retrieveArtifact(){throw new Error("retrieveArtifact not implemented.");}
  async listStudentTimelineArtifacts(){throw new Error("listStudentTimelineArtifacts not implemented.");}
  async archiveArtifact(){throw new Error("archiveArtifact not implemented.");}
  async deleteArtifact(){throw new Error("deleteArtifact not implemented.");}
  async syncStatus(){throw new Error("syncStatus not implemented.");}
  async reconcile(){throw new Error("reconcile not implemented.");}
}

import {MockFileVaultAdapter} from "./mock-adapter.js";
import {V2_EVIDENCE,v2Capabilities} from "./capabilities.js";

export class FileVaultV2Adapter extends MockFileVaultAdapter{
  constructor(){super({generation:"V2",name:"FileVault V2 Mock Adapter",capabilities:v2Capabilities(),evidence:V2_EVIDENCE});}
}

export const V2_ARTIFACT_MAPPING={
  classification:"PROPOSED_PENDING_RATIFICATION",
  application:"Timeline owner/cycle may map to proposed applications table; exact contract unknown",
  requirementSlot:"A timeline document requirement is not ratified",
  reviewRequest:"Advisor approval may map to proposed review_requests; exact verdict semantics unknown",
  preview:"Proposed capability, route unknown",
  provenance:"Proposed private structured metadata, route unknown",
  search:"Metadata search proposed; body search intentionally deferred to V2.2",
  artifactRelations:"UNKNOWN and required before production integration"
};

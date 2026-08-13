export const FILEVAULT_MODES={LEGACY_ONLY:"LEGACY_ONLY",V2_ONLY:"V2_ONLY",DUAL_WRITE:"DUAL_WRITE",READ_LEGACY_WRITE_V2:"READ_LEGACY_WRITE_V2",DISABLED:"DISABLED"};

export const LEGACY_EVIDENCE={
  status:"VERIFIED_SANDBOX_EVIDENCE_OF_LIVE_V1",source:"MX-FILEVAULT-008-RERUN3 and reconciled V1 PHP/schema evidence",productionContractVerified:false,
  facts:{privateObjectPrefix:"student-files/v1/",restNamespace:"/wp-json/mmed/v1",metadataSchema:"file_vault",versionRows:true,ownerGates:true,adminGates:true,signedPutGet:true,commentsTable:true,auditTable:true,archiveField:true},
  unknowns:["No verified TimelineArtifact document_type registration.","No verified file delete or archive REST route.","No verified arbitrary structured artifact metadata contract.","No production write authorization for D1-409."]
};

export const V2_EVIDENCE={
  status:"PROPOSED_PENDING_RATIFICATION",source:"J1_FILEVAULT_1001 architecture package dated 2026-07-10",productionContractVerified:false,
  facts:{additiveOnly:true,sharesV1StoragePipeline:true,applications:true,requirementSlots:true,reviewRequests:true,readinessSnapshots:true,mentorAssignments:true,featureFlag:"MMED_FILE_VAULT_V2"},
  unknowns:["Architecture is pending Brian ratification.","Additive routes are proposed, not verified live.","TimelineArtifact relation semantics are not defined.","Preview and artifact search contracts are not ratified."]
};

export function legacyCapabilities(){return {supportsVersioning:true,supportsPreview:false,supportsStructuredMetadata:"PARTIAL",supportsSearchIndex:"METADATA_ONLY",supportsAdvisorComments:true,supportsProvenance:false,supportsSoftDelete:"SCHEMA_ONLY",supportsPermanentDelete:false,supportsArtifactRelations:false,supportsAuditHistory:true,productionWrite:false};}
export function v2Capabilities(){return {supportsVersioning:true,supportsPreview:"PROPOSED",supportsStructuredMetadata:"PROPOSED",supportsSearchIndex:"METADATA_PROPOSED",supportsAdvisorComments:true,supportsProvenance:"PROPOSED",supportsSoftDelete:"PROPOSED",supportsPermanentDelete:false,supportsArtifactRelations:"UNKNOWN",supportsAuditHistory:true,productionWrite:false};}

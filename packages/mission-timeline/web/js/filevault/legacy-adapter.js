import {MockFileVaultAdapter} from "./mock-adapter.js";
import {LEGACY_EVIDENCE,legacyCapabilities} from "./capabilities.js";

export class LegacyFileVaultAdapter extends MockFileVaultAdapter{
  constructor(){super({generation:"LEGACY",name:"Legacy FileVault Mock Adapter",capabilities:legacyCapabilities(),evidence:LEGACY_EVIDENCE});}
  async deleteArtifact(){throw new Error("LEGACY_DELETE_ENDPOINT_UNKNOWN");}
}

export const LEGACY_ARTIFACT_MAPPING={
  classification:"VERIFIED_PARTIAL_MAPPING",
  fileFields:{owner_id:"studentOwnerId placeholder",display_name:"displayName",canonical_name:"deterministic filename",document_type:"UNKNOWN: timeline type not registered",status:"approval/lifecycle mapping requires production decision",visibility:"private",mime_type:"mimeType",file_size:"byteSize",metadata:"TimelineArtifact structured metadata support is UNKNOWN/PARTIAL"},
  versionFields:{version_number:"timeline version sequence",canonical_name:"primaryFile.filename",mime_type:"mimeType",file_size:"byteSize",checksum_sha256:"contentHash",r2_key:"server-generated only; never sent by D1"},
  operations:{create:"verified two-step upload-url + confirm pattern, not called here",version:"verified create version + confirm pattern",retrieve:"verified file detail + signed download",archive:"schema has is_archived but no verified student REST route",delete:"UNKNOWN",search:"verified metadata search_document schema; route query details partial"}
};

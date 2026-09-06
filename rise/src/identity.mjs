import { createHash } from "node:crypto";

const ID_NAMESPACE = "missionmed-rise-identity-v1";

function uuidFromDigest(buffer) {
  const bytes = Buffer.from(buffer.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function stableOpaqueId(prefix, identityKey) {
  if (!prefix || !identityKey) throw new TypeError("prefix and identityKey are required");
  const digest = createHash("sha256")
    .update(ID_NAMESPACE)
    .update("\0")
    .update(String(prefix))
    .update("\0")
    .update(String(identityKey))
    .digest();
  return `${prefix}_${uuidFromDigest(digest)}`;
}

export function normalizeExternalProgramId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error(`Invalid FREIDA/ACGME program identifier: ${JSON.stringify(value)}`);
  }
  return normalized;
}

export function programIdentity(externalProgramId) {
  const value = normalizeExternalProgramId(externalProgramId);
  return {
    id: stableOpaqueId("rise_prg", `FREIDA_PROGRAM:${value}`),
    externalKey: `FREIDA_PROGRAM:${value}`,
    externalProgramId: value,
  };
}

export function specialtyIdentity(label) {
  const normalized = String(label ?? "").trim();
  if (!normalized) throw new Error("Specialty label is required");
  return {
    id: stableOpaqueId("rise_sp", normalized),
    label: normalized,
  };
}

export function programSpecialtyIdentity(programId, exactSpecialtyLabel) {
  if (!programId) throw new Error("Program ID is required");
  const specialty = specialtyIdentity(exactSpecialtyLabel);
  return {
    id: stableOpaqueId("rise_ps", `${programId}:${specialty.label}`),
    specialty,
  };
}

export function browseMembershipIdentity(programSpecialtyId, browseSpecialtyLabel) {
  if (!programSpecialtyId) throw new Error("Program-specialty ID is required");
  const browseSpecialty = specialtyIdentity(browseSpecialtyLabel);
  return {
    id: stableOpaqueId("rise_bm", `${programSpecialtyId}:${browseSpecialty.label}`),
    browseSpecialty,
  };
}

export function assertUniqueExternalIdentifiers(records) {
  const owners = new Map();
  const collisions = [];
  for (const record of records) {
    const key = `${record.namespace}:${record.value}`;
    const prior = owners.get(key);
    if (prior && prior !== record.programId) {
      collisions.push({ key, programIds: [prior, record.programId] });
      continue;
    }
    owners.set(key, record.programId);
  }
  if (collisions.length) {
    const error = new Error(`External identifier collisions: ${collisions.length}`);
    error.code = "RISE_IDENTITY_COLLISION";
    error.collisions = collisions;
    throw error;
  }
}

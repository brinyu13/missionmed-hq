import { browseMembershipIdentity, programSpecialtyIdentity, specialtyIdentity } from "./identity.mjs";

const EXACT_BROWSE_ALIASES = new Map([
  ["Surgery-General", "General Surgery"],
  ["Radiology-Diagnostic", "Diagnostic Radiology"],
  ["Pathology-Anatomic and Clinical", "Pathology"],
  ["Public Health and General Preventive Medicine", "Public Health and General Preventive Medicine"],
  ["Occupational and Environmental Medicine", "Occupational and Environmental Medicine"],
  ["Osteopathic Neuromusculoskeletal Medicine", "Osteopathic Neuromusculoskeletal Medicine"],
  ["Otolaryngology-Head and Neck Surgery", "Otolaryngology-Head and Neck Surgery"],
  ["Physical Medicine and Rehabilitation", "Physical Medicine and Rehabilitation"],
]);

export function entryFormatFor(exactSpecialtyLabel, combinedMap) {
  if (combinedMap[exactSpecialtyLabel]) return "combined";
  if (exactSpecialtyLabel === "Transitional Year") return "transitional";
  if (exactSpecialtyLabel.endsWith("-Integrated")) return "integrated";
  if (exactSpecialtyLabel.endsWith("-Independent")) return "independent";
  return "unknown";
}

export function buildProgramSpecialty(programId, exactSpecialtyLabel, combinedConfig) {
  const { id, specialty } = programSpecialtyIdentity(programId, exactSpecialtyLabel);
  const componentLabels = combinedConfig.designations[exactSpecialtyLabel] ?? [exactSpecialtyLabel];
  const kind = combinedConfig.designations[exactSpecialtyLabel] ? "combined" : "single";
  return {
    id,
    programId,
    designationSpecialtyId: specialty.id,
    designation: specialty.label,
    kind,
    entryFormat: entryFormatFor(exactSpecialtyLabel, combinedConfig.designations),
    recognition: kind === "combined" ? "acgme_or_board_listed" : "source_designation",
    components: componentLabels.map((label, ordinal) => ({
      specialtyId: specialtyIdentity(label).id,
      label,
      ordinal,
    })),
  };
}

export function buildBrowseMembership(programSpecialty, browseSpecialtyLabel) {
  const { id, browseSpecialty } = browseMembershipIdentity(programSpecialty.id, browseSpecialtyLabel);
  const exactAlias = EXACT_BROWSE_ALIASES.get(programSpecialty.designation) ?? programSpecialty.designation;
  let relationship = "EXACT_DESIGNATION";
  if (programSpecialty.kind === "combined") relationship = "RELATED_COMBINED";
  else if (exactAlias !== browseSpecialtyLabel) relationship = "RELATED_SPECIALTY";
  return {
    id,
    programSpecialtyId: programSpecialty.id,
    browseSpecialtyId: browseSpecialty.id,
    browseSpecialty: browseSpecialty.label,
    relationship,
  };
}

export function specialtyIntentRelationship(requestedSpecialty, programSpecialty, includeCombined = false) {
  if (programSpecialty.designation === requestedSpecialty) return "EXACT_SPECIALTY";
  if (programSpecialty.kind !== "combined") return "NO_MATCH";
  const contains = programSpecialty.components.some((component) => component.label === requestedSpecialty);
  return contains && includeCombined ? "RELATED_COMBINED" : "NO_MATCH";
}

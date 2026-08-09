import { ValidationError } from './errors.js';
import { assertNonEmptyString, deepFreeze, sha256, toIso } from './value-utils.js';

export const APPLICANT_VARIANT_LIMITS = deepFreeze({ minimum: 3, maximum: 5 });

export function createApplicantVariantSet({ caseId, variants, createdAt = new Date() } = {}) {
  assertNonEmptyString(caseId, 'caseId');
  if (!Array.isArray(variants) || variants.length < APPLICANT_VARIANT_LIMITS.minimum || variants.length > APPLICANT_VARIANT_LIMITS.maximum) {
    throw new ValidationError('A complete applicant variant set requires three to five variants');
  }

  const ids = new Set();
  const angles = new Set();
  const textHashes = new Set();
  const normalized = variants.map((variant, index) => {
    assertNonEmptyString(variant?.id, `variants[${index}].id`);
    assertNonEmptyString(variant?.angle, `variants[${index}].angle`);
    assertNonEmptyString(variant?.text, `variants[${index}].text`, { maxLength: 40_000 });
    if (ids.has(variant.id)) throw new ValidationError('Applicant variant IDs must be unique');
    if (angles.has(variant.angle)) throw new ValidationError('Applicant variant angles must be distinct');
    ids.add(variant.id);
    angles.add(variant.angle);

    if (!Array.isArray(variant.evidenceReferences) || variant.evidenceReferences.length === 0) {
      throw new ValidationError('Every applicant variant requires evidence references');
    }
    const evidenceReferences = variant.evidenceReferences.map((reference, evidenceIndex) => {
      assertNonEmptyString(reference?.id, `variants[${index}].evidenceReferences[${evidenceIndex}].id`);
      if (!/^[a-f0-9]{64}$/u.test(String(reference?.contentHash || ''))) {
        throw new ValidationError('Variant evidence references require SHA-256 content hashes');
      }
      return { id: reference.id, contentHash: reference.contentHash };
    });
    const evidenceIds = new Set(evidenceReferences.map((reference) => reference.id));

    if (!Array.isArray(variant.claims) || variant.claims.length === 0) {
      throw new ValidationError('Every applicant variant requires evidence-linked claims');
    }
    const claims = variant.claims.map((claim, claimIndex) => {
      assertNonEmptyString(claim?.text, `variants[${index}].claims[${claimIndex}].text`, { maxLength: 2_000 });
      if (!Array.isArray(claim.evidenceReferenceIds) || claim.evidenceReferenceIds.length === 0) {
        throw new ValidationError('Every applicant claim requires at least one evidence reference');
      }
      if (claim.evidenceReferenceIds.some((id) => !evidenceIds.has(id))) {
        throw new ValidationError('Applicant claims cannot cite evidence outside their immutable source set');
      }
      return { text: claim.text.trim(), evidenceReferenceIds: [...new Set(claim.evidenceReferenceIds)] };
    });

    const textHash = sha256(variant.text);
    if (textHashes.has(textHash)) throw new ValidationError('Applicant variants must contain meaningfully distinct wording');
    textHashes.add(textHash);
    return {
      id: variant.id,
      angle: variant.angle,
      state: 'applicant_prepared',
      text: variant.text.trim(),
      textHash,
      evidenceReferences,
      claims,
    };
  });

  return deepFreeze({
    schemaVersion: 'missionmed.lor.applicant-variant-set.v1',
    caseId,
    count: normalized.length,
    complete: true,
    createdAt: toIso(createdAt, 'createdAt'),
    variants: normalized,
  });
}

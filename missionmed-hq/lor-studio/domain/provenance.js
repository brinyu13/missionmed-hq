import { ValidationError } from './errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  hashValue,
  makeId,
  sha256,
  toIso,
} from './value-utils.js';

export function createEvidenceReference({
  id,
  caseId,
  ownerId,
  sourceType,
  sourceId,
  sourceVersion,
  content,
  consentReceiptId,
  capturedAt = new Date(),
  idFactory,
}) {
  for (const [field, value] of Object.entries({ caseId, ownerId, sourceType, sourceId, sourceVersion, consentReceiptId })) {
    assertNonEmptyString(value, field);
  }
  if (typeof content !== 'string') throw new ValidationError('Evidence content must be text');
  return deepFreeze({
    schemaVersion: 'missionmed.lor.evidence-reference.v1',
    id: id ?? makeId('evidence', idFactory),
    caseId,
    ownerId,
    sourceType,
    sourceId,
    sourceVersion,
    contentHash: sha256(content),
    consentReceiptId,
    capturedAt: toIso(capturedAt, 'capturedAt'),
  });
}

export function createAiProposalProvenance({
  id,
  caseId,
  provider,
  model,
  templateVersion,
  evidenceReferences,
  output,
  generatedAt = new Date(),
  idFactory,
}) {
  for (const [field, value] of Object.entries({ caseId, provider, model, templateVersion })) {
    assertNonEmptyString(value, field);
  }
  if (!Array.isArray(evidenceReferences)) throw new ValidationError('evidenceReferences must be an array');
  if (typeof output !== 'string' || output.trim().length === 0) {
    throw new ValidationError('AI proposal output must be non-empty text');
  }
  const sourceReferences = evidenceReferences.map((reference) => {
    assertNonEmptyString(reference.id, 'evidence reference id');
    if (!/^[a-f0-9]{64}$/u.test(reference.contentHash)) {
      throw new ValidationError('Evidence references require content hashes');
    }
    return { id: reference.id, contentHash: reference.contentHash };
  });
  return deepFreeze({
    schemaVersion: 'missionmed.lor.ai-proposal-provenance.v1',
    id: id ?? makeId('proposal', idFactory),
    caseId,
    state: 'proposal',
    provider,
    model,
    templateVersion,
    templateHash: sha256(templateVersion),
    sourceReferences,
    sourceSetHash: hashValue(sourceReferences),
    outputHash: sha256(output),
    generatedAt: toIso(generatedAt, 'generatedAt'),
  });
}

export function createHumanDecisionRecord({
  id,
  caseId,
  proposal,
  facultyId,
  action,
  resultingText,
  decidedAt = new Date(),
  idFactory,
}) {
  for (const [field, value] of Object.entries({ caseId, facultyId })) assertNonEmptyString(value, field);
  if (!proposal || proposal.state !== 'proposal') {
    throw new ValidationError('Human decisions must reference an AI proposal');
  }
  if (!['accepted', 'edited', 'rejected'].includes(action)) {
    throw new ValidationError('Unknown human decision action');
  }
  if (action === 'rejected' && resultingText !== null && resultingText !== undefined) {
    throw new ValidationError('Rejected proposals cannot produce resulting text');
  }
  if (action !== 'rejected' && (typeof resultingText !== 'string' || resultingText.trim().length === 0)) {
    throw new ValidationError('Accepted or edited proposals require resulting text');
  }
  return deepFreeze({
    schemaVersion: 'missionmed.lor.human-decision.v1',
    id: id ?? makeId('decision', idFactory),
    caseId,
    proposalId: proposal.id,
    proposalOutputHash: proposal.outputHash,
    facultyId,
    action,
    resultingTextHash: action === 'rejected' ? null : sha256(resultingText),
    decidedAt: toIso(decidedAt, 'decidedAt'),
  });
}

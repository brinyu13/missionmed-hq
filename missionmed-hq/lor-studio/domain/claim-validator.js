import { ValidationError } from './errors.js';
import { deepFreeze } from './value-utils.js';

const BLOCKED_PATTERNS = deepFreeze([
  {
    code: 'PATIENT_IDENTIFIER',
    pattern: /\b(?:mrn|medical\s+record\s+(?:number|#)|patient\s+(?:name|id)|date\s+of\s+birth|dob)\s*[:#-]?\s*[a-z0-9/-]+/iu,
  },
  { code: 'PATIENT_IDENTIFIER', pattern: /\b\d{3}-\d{2}-\d{4}\b/u },
  { code: 'PATIENT_IDENTIFIER', pattern: /\bpatient\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/u },
  {
    code: 'RANKING_OR_SUPERLATIVE',
    pattern: /\b(?:best|greatest|finest|unmatched|unparalleled|number\s+one|#1|top\s+\d+(?:\.\d+)?\s*%|among\s+the\s+top)\b/iu,
  },
  {
    code: 'PROMPT_INJECTION',
    pattern: /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions|reveal\s+(?:the\s+)?system\s+prompt|developer\s+message|system\s+message|jailbreak|<\|(?:system|assistant|user)\|>)/iu,
  },
]);

export function inspectProtectedText(text) {
  if (typeof text !== 'string') throw new ValidationError('Text must be a string');
  const findings = [];
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(text)) findings.push(rule.code);
  }
  return deepFreeze([...new Set(findings)]);
}

export function validateAiProposal({ text, claims, evidenceReferences }) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new ValidationError('AI proposal text must be non-empty');
  }
  if (!Array.isArray(claims) || claims.length === 0) {
    throw new ValidationError('AI proposals require structured, source-linked claims');
  }
  if (!Array.isArray(evidenceReferences)) {
    throw new ValidationError('evidenceReferences must be an array');
  }
  const prohibited = inspectProtectedText(text);
  if (prohibited.length > 0) {
    throw new ValidationError('AI proposal contains prohibited content', { findings: prohibited });
  }
  const evidenceIds = new Set(evidenceReferences.map((reference) => reference.id));
  for (const [index, claim] of claims.entries()) {
    if (!claim || typeof claim.text !== 'string' || claim.text.trim().length === 0) {
      throw new ValidationError('Every AI claim requires text', { index });
    }
    const claimFindings = inspectProtectedText(claim.text);
    if (claimFindings.length > 0) {
      throw new ValidationError('AI claim contains prohibited content', { index, findings: claimFindings });
    }
    if (!Array.isArray(claim.supportIds) || claim.supportIds.length === 0) {
      throw new ValidationError('Every AI claim requires evidence support', { index });
    }
    const unsupported = claim.supportIds.filter((supportId) => !evidenceIds.has(supportId));
    if (unsupported.length > 0) {
      throw new ValidationError('AI claim references unsupported evidence', { index, unsupported });
    }
  }
  const canonicalClaimText = claims.map((claim) => claim.text.trim()).join('\n\n');
  if (text.trim() !== canonicalClaimText) {
    throw new ValidationError('AI proposal text must contain only its ordered, source-linked claims');
  }
  return deepFreeze({ valid: true, claimCount: claims.length });
}

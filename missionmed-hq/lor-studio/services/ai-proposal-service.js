import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import { inspectProtectedText, validateAiProposal } from '../domain/claim-validator.js';
import { createAiProposalProvenance } from '../domain/provenance.js';
import { assertNonEmptyString, deepFreeze, sha256 } from '../domain/value-utils.js';
import { assertPort } from './ports.js';

export class AiProposalService {
  constructor({ provider, fallbackProvider = null, clock = () => new Date() }) {
    this.provider = assertPort(provider, ['generateProposal'], 'provider');
    this.fallbackProvider = fallbackProvider
      ? assertPort(fallbackProvider, ['generateProposal'], 'fallbackProvider')
      : null;
    this.clock = clock;
  }

  async generate({ caseId, evidenceReferences, facts, templateVersion }) {
    assertNonEmptyString(caseId, 'caseId');
    assertNonEmptyString(templateVersion, 'templateVersion');
    if (!Array.isArray(evidenceReferences) || !Array.isArray(facts) || facts.length === 0) {
      throw new ValidationError('AI proposal requests require evidence references and facts');
    }
    const evidenceById = new Map();
    for (const [index, reference] of evidenceReferences.entries()) {
      if (
        !reference ||
        typeof reference.id !== 'string' ||
        reference.caseId !== caseId ||
        !/^[a-f0-9]{64}$/u.test(reference.contentHash ?? '') ||
        evidenceById.has(reference.id)
      ) {
        throw new ValidationError('AI evidence references must be unique, hashed, and case-bound', { index });
      }
      evidenceById.set(reference.id, reference);
    }
    const factIds = new Set();
    for (const [index, fact] of facts.entries()) {
      const reference = evidenceById.get(fact?.id);
      if (
        !reference ||
        factIds.has(fact.id) ||
        typeof fact.text !== 'string' ||
        fact.text.trim() !== fact.text ||
        sha256(fact.text) !== reference.contentHash
      ) {
        throw new ValidationError('AI fact does not match its consented evidence hash', { index });
      }
      const findings = inspectProtectedText(fact.text);
      if (findings.length > 0) {
        throw new ValidationError('AI fact contains prohibited content', { index, findings });
      }
      factIds.add(fact.id);
    }
    let response;
    let fallbackUsed = false;
    try {
      response = await this.provider.generateProposal({
        caseId,
        evidenceReferences,
        facts,
        templateVersion,
      });
    } catch (error) {
      const integrationUnavailable =
        error instanceof IntegrationDisabledError || error?.code === 'INTEGRATION_DISABLED';
      if (!integrationUnavailable || !this.fallbackProvider) throw error;
      fallbackUsed = true;
      response = await this.fallbackProvider.generateProposal({
        caseId,
        evidenceReferences,
        facts,
        templateVersion,
      });
    }
    if (!response || response.state !== 'proposal') {
      throw new ValidationError('AI providers may return proposals only');
    }
    validateAiProposal({
      text: response.text,
      claims: response.claims,
      evidenceReferences,
    });
    const provenance = createAiProposalProvenance({
      caseId,
      provider: response.provider,
      model: response.model,
      templateVersion,
      evidenceReferences,
      output: response.text,
      generatedAt: this.clock(),
    });
    return deepFreeze({
      id: provenance.id,
      state: 'proposal',
      text: response.text,
      claims: structuredClone(response.claims),
      provenance,
      fallbackUsed,
      humanDecisionRequired: true,
    });
  }
}

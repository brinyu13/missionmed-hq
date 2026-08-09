import { ValidationError } from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';
import { AiProposalPort } from '../services/ports.js';

export class DeterministicAiProposalAdapter extends AiProposalPort {
  constructor({ providerId = 'missionmed-local-deterministic', modelId = 'structured-template-v1' } = {}) {
    super();
    this.providerId = providerId;
    this.modelId = modelId;
    this.externalNetworkUsed = false;
  }

  async generateProposal({ facts }) {
    if (!Array.isArray(facts) || facts.length === 0) {
      throw new ValidationError('Deterministic proposal generation requires supported facts');
    }
    const normalized = facts.map((fact, index) => {
      if (!fact || typeof fact.id !== 'string' || typeof fact.text !== 'string' || fact.text.trim() === '') {
        throw new ValidationError('Each deterministic fact requires id and text', { index });
      }
      return { id: fact.id, text: fact.text.trim() };
    });
    const claims = normalized.map((fact) => ({
      text: fact.text,
      supportIds: [fact.id],
    }));
    return deepFreeze({
      state: 'proposal',
      provider: this.providerId,
      model: this.modelId,
      text: normalized.map((fact) => fact.text).join('\n\n'),
      claims,
      externalNetworkUsed: false,
    });
  }
}

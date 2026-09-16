import { createHash } from 'node:crypto';
import { assertQuestionPoolSnapshot } from '../../contracts/question-pool.mjs';

function textHash(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export class PromptedMockDirector {
  #index = 0;
  #commands = new Map();

  constructor(snapshot) {
    assertQuestionPoolSnapshot(snapshot);
    this.snapshot = structuredClone(snapshot);
    const byId = new Map(snapshot.items.map((item) => [item.canonical_id, item]));
    this.questions = snapshot.expanded_question_ids.map((id) => byId.get(id));
  }

  next(idempotencyKey) {
    if (typeof idempotencyKey !== 'string' || !idempotencyKey) throw new TypeError('idempotencyKey is required');
    if (this.#commands.has(idempotencyKey)) return structuredClone(this.#commands.get(idempotencyKey));
    const item = this.questions[this.#index];
    const move = item
      ? {
          move: 'ask',
          index: this.#index++,
          rationale_ref: `pool:${this.snapshot.snapshot_id}:ordered`,
          question: {
            canonical_id: item.canonical_id,
            version: item.version,
            text: item.text,
            text_hash: textHash(item.text),
          },
        }
      : { move: 'close', index: this.#index, rationale_ref: `pool:${this.snapshot.snapshot_id}:complete` };
    this.#commands.set(idempotencyKey, move);
    return structuredClone(move);
  }

  handleInput(input, idempotencyKey) {
    if (!['next', 'spacebar'].includes(input)) throw new Error('Prompted Mock accepts Next or spacebar only');
    return this.next(idempotencyKey);
  }
}

import { runTeardown } from './teardown.mjs';

export const PROMPTED_RUNTIME_STATES = Object.freeze([
  'Preflight', 'Arming', 'Recording', 'InterviewerTurn', 'StudentTurn',
  'Thinking', 'Paused', 'Ending', 'Sealing', 'Complete', 'Faulted',
]);

export class PromptedMockOrchestrator {
  constructor({ sessionId, sessionStore, eventSpine, clock, wallNow = () => new Date().toISOString() }) {
    this.sessionId = sessionId;
    this.sessionStore = sessionStore;
    this.eventSpine = eventSpine;
    this.clock = clock;
    this.wallNow = wallNow;
    this.runtimeState = 'Preflight';
    this.audioAuthority = 'none';
    this.eventCounter = 0;
    this.teardownRecords = new Map();
  }

  #event(type, payload, reliability = 'measured', idempotencyKey) {
    return {
      event_id: `${this.sessionId}:event:${++this.eventCounter}`,
      session_id: this.sessionId,
      t_media_ms: this.clock.now(),
      t_wall: this.wallNow(),
      source: 'client.orchestrator',
      type,
      schema_version: '1',
      reliability,
      availability: 'ok',
      payload,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    };
  }

  start({ idempotencyKey }) {
    const session = this.sessionStore.get(this.sessionId);
    if (session.transport_profile !== 'none') throw new Error('Prompted Mock requires transport_profile none');
    if (session.state !== 'armed') throw new Error('session must be armed');
    this.runtimeState = 'Recording';
    const stamp = this.clock.start();
    const live = this.sessionStore.transition(this.sessionId, 'live', {
      expectedVersion: session.state_version,
      idempotencyKey,
      at: stamp.t_wall,
    });
    this.eventSpine.appendBatch(this.sessionId, [
      this.#event('media.started.v1', { audio_authority: 'none' }, 'measured', `${idempotencyKey}:media`),
      this.#event('session.live.v1', { state_version: live.state_version }, 'canonical', `${idempotencyKey}:live`),
    ]);
    return live;
  }

  present(move, { idempotencyKey }) {
    if (!['Recording', 'Thinking'].includes(this.runtimeState)) throw new Error('orchestrator cannot present a move');
    if (move.move === 'close') {
      this.runtimeState = 'Ending';
      this.eventSpine.appendBatch(this.sessionId, [this.#event('brain.move.v1', move, 'synthetic', idempotencyKey)]);
      return { state: this.runtimeState, card: null };
    }
    if (move.move !== 'ask') throw new Error('Prompted Mock accepts ask or close only');
    this.runtimeState = 'InterviewerTurn';
    const turnId = `${this.sessionId}:turn:${move.index + 1}:question`;
    this.eventSpine.appendBatch(this.sessionId, [
      this.#event('brain.move.v1', move, 'synthetic', `${idempotencyKey}:move`),
      this.#event('turn.started.v1', { speaker: 'interviewer', turn_id: turnId }, 'synthetic', `${idempotencyKey}:turn-start`),
      this.#event('question.asked.v1', {
        question_id: move.question.canonical_id,
        origin: 'pool',
        text_hash: move.question.text_hash,
        turn_id: turnId,
      }, 'canonical', `${idempotencyKey}:asked`),
      this.#event('turn.ended.v1', { speaker: 'interviewer', turn_id: turnId }, 'synthetic', `${idempotencyKey}:turn-end`),
    ]);
    this.runtimeState = 'StudentTurn';
    return { state: this.runtimeState, card: move.question };
  }

  beginAnswer({ answerId, idempotencyKey }) {
    if (this.runtimeState !== 'StudentTurn') throw new Error('student turn is not active');
    this.eventSpine.appendBatch(this.sessionId, [
      this.#event('turn.started.v1', { speaker: 'student', turn_id: answerId }, 'measured', `${idempotencyKey}:turn-start`),
      this.#event('question.answer.started.v1', { turn_id: answerId }, 'measured', `${idempotencyKey}:answer-start`),
    ]);
  }

  endAnswer({ answerId, reason = 'next', idempotencyKey }) {
    if (this.runtimeState !== 'StudentTurn') throw new Error('student turn is not active');
    this.eventSpine.appendBatch(this.sessionId, [
      this.#event('question.answer.ended.v1', { turn_id: answerId }, 'measured', `${idempotencyKey}:answer-end`),
      this.#event('turn.ended.v1', { speaker: 'student', turn_id: answerId }, 'measured', `${idempotencyKey}:turn-end`),
      this.#event('question.moved_on.v1', { reason }, 'canonical', `${idempotencyKey}:move-on`),
    ]);
    this.runtimeState = 'Thinking';
  }

  async end({ idempotencyKey, steps = {} }) {
    const session = this.sessionStore.get(this.sessionId);
    if (session.state !== 'live') throw new Error('only a live session can end');
    this.runtimeState = 'Ending';
    const ending = this.sessionStore.transition(this.sessionId, 'ending', {
      expectedVersion: session.state_version,
      idempotencyKey: `${idempotencyKey}:ending`,
      at: this.wallNow(),
    });
    this.eventSpine.appendBatch(this.sessionId, [
      this.#event('session.ending.v1', { state_version: ending.state_version }, 'canonical', `${idempotencyKey}:event`),
    ]);
    this.teardownRecords = await runTeardown(steps, this.teardownRecords);
    if ([...this.teardownRecords.values()].some((record) => record.status === 'failed')) {
      this.runtimeState = 'Faulted';
      return { state: this.runtimeState, records: this.teardownRecords };
    }
    const sealing = this.sessionStore.transition(this.sessionId, 'sealing', {
      expectedVersion: ending.state_version,
      idempotencyKey: `${idempotencyKey}:sealing`,
      at: this.wallNow(),
    });
    this.runtimeState = 'Sealing';
    this.eventSpine.appendBatch(this.sessionId, [
      this.#event('media.stopped.v1', { audio_authority: 'none' }, 'measured', `${idempotencyKey}:media-stopped`),
      this.#event('session.sealing.v1', { state_version: sealing.state_version }, 'canonical', `${idempotencyKey}:sealing-event`),
    ]);
    return { state: this.runtimeState, records: this.teardownRecords };
  }
}

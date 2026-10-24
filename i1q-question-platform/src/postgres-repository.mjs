const ISOLATION_LEVELS = Object.freeze({
  read_committed: 'READ COMMITTED',
  repeatable_read: 'REPEATABLE READ',
  serializable: 'SERIALIZABLE',
});

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const REVIEW_STATES = new Set(['open', 'accepted', 'completed', 'expired', 'reassigned']);
const REVIEW_TYPES = new Set(['editorial', 'medical']);
const REVIEW_VERDICTS = new Set(['pass', 'needs_revision', 'fail']);
const PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);

export class PostgresRepositoryError extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name = 'PostgresRepositoryError';
    this.code = code;
  }
}

function fail(code) {
  throw new PostgresRepositoryError(code);
}

function requireStableString(value, code) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) fail(code);
  return value;
}

function requireHash(value, code) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) fail(code);
  return value;
}

function requireEnum(value, allowed, code) {
  if (!allowed.has(value)) fail(code);
  return value;
}

function requirePlainObject(value, requiredKeys, optionalKeys = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('repository_input_object_required');
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.has(key))) fail('repository_input_field_forbidden');
  if (requiredKeys.some((key) => !Object.hasOwn(value, key))) fail('repository_input_field_missing');
  return value;
}

function jsonParameter(value, code) {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') fail(code);
    return serialized;
  } catch {
    fail(code);
  }
}

function firstRow(result) {
  if (!result || !Array.isArray(result.rows)) fail('postgres_driver_result_invalid');
  return result.rows[0] ?? null;
}

function allRows(result) {
  if (!result || !Array.isArray(result.rows)) fail('postgres_driver_result_invalid');
  return result.rows;
}

class PostgresTransaction {
  #client;
  #closed = false;

  constructor(client) {
    this.#client = client;
  }

  close() {
    this.#closed = true;
  }

  async #query(text, values = []) {
    if (this.#closed) fail('postgres_transaction_closed');
    return this.#client.query(text, values);
  }

  async getItemRevision(itemRevisionId) {
    requireStableString(itemRevisionId, 'item_revision_id_required');
    const result = await this.#query(
      `SELECT id,
              item_id,
              revision_number,
              author_actor_id,
              workflow_status,
              medical_validation_status,
              taxonomy_version_id,
              misconception_vocabulary_version_id,
              concept_id,
              prompt,
              choice_a,
              choice_b,
              choice_c,
              choice_d,
              classification,
              active_flags,
              open_conflict_id,
              legacy_import,
              content_hash,
              created_at
         FROM i1q.item_revisions
        WHERE id = $1`,
      [itemRevisionId],
    );
    return firstRow(result);
  }

  async readItemRevisionAnswers(input) {
    requirePlainObject(input, ['itemRevisionId', 'purpose']);
    const { itemRevisionId, purpose } = input;
    requireStableString(itemRevisionId, 'item_revision_id_required');
    requireStableString(purpose, 'answer_access_purpose_required');
    const result = await this.#query(
      'SELECT * FROM i1q.read_item_revision_answers($1, $2)',
      [itemRevisionId, purpose],
    );
    return firstRow(result);
  }

  async readRestrictedSourceReference(input) {
    requirePlainObject(input, ['referenceId', 'purpose']);
    const { referenceId, purpose } = input;
    requireStableString(referenceId, 'restricted_source_reference_id_required');
    requireStableString(purpose, 'restricted_source_access_purpose_required');
    const result = await this.#query(
      'SELECT * FROM i1q.read_restricted_source_reference($1, $2)',
      [referenceId, purpose],
    );
    return firstRow(result);
  }

  async listMyReviewAssignments(input = {}) {
    requirePlainObject(input, [], ['states']);
    const states = input.states ?? ['open', 'accepted'];
    if (!Array.isArray(states) || states.length === 0) fail('review_assignment_states_required');
    const stableStates = states.map((state) => requireEnum(state, REVIEW_STATES, 'review_assignment_state_invalid'));
    const result = await this.#query(
      `SELECT id,
              item_revision_id,
              reviewer_id,
              review_type,
              required_role,
              priority,
              exact_revision_hash,
              credential_status,
              state,
              due_at,
              accepted_at,
              completed_at,
              created_at
         FROM i1q.review_assignments
        WHERE reviewer_actor_id = i1q.current_actor_id()
          AND state = ANY($1::text[])
        ORDER BY priority, due_at NULLS LAST, created_at, id`,
      [stableStates],
    );
    return allRows(result);
  }

  async createReviewAssignment(input) {
    requirePlainObject(
      input,
      ['assignmentId', 'itemRevisionId', 'reviewerId', 'reviewType', 'priority'],
      ['dueAt'],
    );
    const values = [
      requireStableString(input.assignmentId, 'review_assignment_id_required'),
      requireStableString(input.itemRevisionId, 'item_revision_id_required'),
      requireStableString(input.reviewerId, 'reviewer_id_required'),
      requireEnum(input.reviewType, REVIEW_TYPES, 'review_type_invalid'),
      requireEnum(input.priority, PRIORITIES, 'review_priority_invalid'),
      input.dueAt ?? null,
    ];
    const result = await this.#query(
      'SELECT * FROM i1q.create_review_assignment($1, $2, $3, $4, $5, $6)',
      values,
    );
    return firstRow(result);
  }

  async acceptReviewAssignment(assignmentId) {
    requireStableString(assignmentId, 'review_assignment_id_required');
    const result = await this.#query(
      'SELECT * FROM i1q.accept_review_assignment($1)',
      [assignmentId],
    );
    return firstRow(result);
  }

  async recordReviewEvent(input) {
    requirePlainObject(input, ['reviewEventId', 'assignmentId', 'verdict'], ['findings']);
    const values = [
      requireStableString(input.reviewEventId, 'review_event_id_required'),
      requireStableString(input.assignmentId, 'review_assignment_id_required'),
      requireEnum(input.verdict, REVIEW_VERDICTS, 'review_verdict_invalid'),
      jsonParameter(input.findings ?? {}, 'review_findings_not_serializable'),
    ];
    const result = await this.#query(
      'SELECT * FROM i1q.record_review_event($1, $2, $3, $4::jsonb)',
      values,
    );
    return firstRow(result);
  }

  async registerExportQuestionIdentity(input) {
    requirePlainObject(input, ['questionId', 'itemId'], ['supersedesQuestionId']);
    const result = await this.#query(
      'SELECT * FROM i1q.register_export_question_identity($1, $2, $3)',
      [
        requireStableString(input.questionId, 'question_id_required'),
        requireStableString(input.itemId, 'item_id_required'),
        input.supersedesQuestionId === undefined || input.supersedesQuestionId === null
          ? null
          : requireStableString(input.supersedesQuestionId, 'supersedes_question_id_invalid'),
      ],
    );
    return firstRow(result);
  }

  async assembleRelease(input) {
    requirePlainObject(input, ['releaseId', 'releaseLabel', 'datasetVersion', 'memberships']);
    if (!Array.isArray(input.memberships) || input.memberships.length === 0) fail('release_memberships_required');
    const seenRevisions = new Set();
    const seenQuestions = new Set();
    const memberships = input.memberships.map((membership) => {
      requirePlainObject(membership, ['itemRevisionId', 'questionId']);
      const itemRevisionId = requireStableString(membership.itemRevisionId, 'item_revision_id_required');
      const questionId = requireStableString(membership.questionId, 'question_id_required');
      if (seenRevisions.has(itemRevisionId)) fail('duplicate_item_revision_id');
      if (seenQuestions.has(questionId)) fail('duplicate_question_id');
      seenRevisions.add(itemRevisionId);
      seenQuestions.add(questionId);
      return { item_revision_id: itemRevisionId, question_id: questionId };
    });
    const result = await this.#query(
      'SELECT * FROM i1q.assemble_release($1, $2, $3, $4::jsonb)',
      [
        requireStableString(input.releaseId, 'release_id_required'),
        requireStableString(input.releaseLabel, 'release_label_required'),
        requireStableString(input.datasetVersion, 'dataset_version_required'),
        jsonParameter(memberships, 'release_memberships_not_serializable'),
      ],
    );
    return firstRow(result);
  }

  async getReleaseMembership(releaseId) {
    requireStableString(releaseId, 'release_id_required');
    const result = await this.#query(
      `SELECT release_id,
              item_id,
              item_revision_id,
              revision_number,
              content_hash,
              dataset_version,
              question_id,
              position
         FROM i1q.release_memberships
        WHERE release_id = $1
        ORDER BY position`,
      [releaseId],
    );
    return allRows(result);
  }

  async recordExportValidation(input) {
    requirePlainObject(input, ['validationId', 'releaseId', 'evidenceHash', 'checkIds']);
    if (!Array.isArray(input.checkIds) || input.checkIds.length === 0) fail('validation_check_ids_required');
    const checkIds = input.checkIds.map((checkId) => requireStableString(checkId, 'validation_check_id_invalid'));
    const result = await this.#query(
      'SELECT * FROM i1q.record_export_validation($1, $2, $3, $4::text[])',
      [
        requireStableString(input.validationId, 'validation_id_required'),
        requireStableString(input.releaseId, 'release_id_required'),
        requireHash(input.evidenceHash, 'validation_evidence_hash_invalid'),
        checkIds,
      ],
    );
    return firstRow(result);
  }

  async promoteRelease(input) {
    requirePlainObject(
      input,
      ['promotionId', 'releaseId', 'targetState', 'authorityType', 'evidenceHashes'],
      ['validationResultId'],
    );
    if (!Array.isArray(input.evidenceHashes)) fail('promotion_evidence_hashes_required');
    const evidenceHashes = input.evidenceHashes.map((hash) => requireHash(hash, 'promotion_evidence_hash_invalid'));
    const result = await this.#query(
      'SELECT * FROM i1q.promote_release($1, $2, $3, $4, $5::jsonb, $6)',
      [
        requireStableString(input.promotionId, 'promotion_id_required'),
        requireStableString(input.releaseId, 'release_id_required'),
        requireStableString(input.targetState, 'release_target_state_required'),
        requireStableString(input.authorityType, 'release_authority_type_required'),
        jsonParameter(evidenceHashes, 'promotion_evidence_hashes_not_serializable'),
        input.validationResultId === undefined || input.validationResultId === null
          ? null
          : requireStableString(input.validationResultId, 'validation_result_id_invalid'),
      ],
    );
    return firstRow(result);
  }

  async createChannelArtifact(input) {
    requirePlainObject(input, [
      'artifactId',
      'releaseId',
      'policyId',
      'channel',
      'phase',
      'dataClass',
      'mediaType',
      'payload',
    ]);
    const result = await this.#query(
      'SELECT * FROM i1q.create_channel_artifact($1, $2, $3, $4, $5, $6, $7, $8::jsonb)',
      [
        requireStableString(input.artifactId, 'artifact_id_required'),
        requireStableString(input.releaseId, 'release_id_required'),
        requireStableString(input.policyId, 'channel_policy_id_required'),
        requireStableString(input.channel, 'channel_required'),
        requireStableString(input.phase, 'channel_phase_required'),
        requireStableString(input.dataClass, 'channel_data_class_required'),
        requireStableString(input.mediaType, 'channel_media_type_required'),
        jsonParameter(input.payload, 'channel_payload_not_serializable'),
      ],
    );
    return firstRow(result);
  }

  async readChannelArtifactPayload(input) {
    requirePlainObject(input, ['artifactId', 'purpose']);
    const { artifactId, purpose } = input;
    requireStableString(artifactId, 'artifact_id_required');
    requireStableString(purpose, 'channel_payload_access_purpose_required');
    const result = await this.#query(
      'SELECT i1q.read_channel_artifact_payload($1, $2) AS payload',
      [artifactId, purpose],
    );
    return firstRow(result)?.payload ?? null;
  }
}

export class PostgresRepository {
  #connect;

  constructor({ connect } = {}) {
    if (typeof connect !== 'function') fail('postgres_connect_function_required');
    this.#connect = connect;
  }

  static fromPool(pool) {
    if (!pool || typeof pool.connect !== 'function') fail('postgres_pool_connect_required');
    return new PostgresRepository({ connect: () => pool.connect() });
  }

  async withTransaction(work, { isolationLevel = 'serializable', readOnly = false } = {}) {
    if (typeof work !== 'function') fail('postgres_transaction_callback_required');
    const isolation = ISOLATION_LEVELS[isolationLevel];
    if (!isolation) fail('postgres_isolation_level_invalid');
    if (typeof readOnly !== 'boolean') fail('postgres_read_only_invalid');

    const client = await this.#connect();
    if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') {
      if (client && typeof client.release === 'function') client.release();
      fail('postgres_dedicated_client_required');
    }

    const transaction = new PostgresTransaction(client);
    let began = false;
    try {
      await client.query('BEGIN');
      began = true;
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolation} ${readOnly ? 'READ ONLY' : 'READ WRITE'}`);
      const identityResult = await client.query('SELECT i1q.current_actor_id() AS actor_id');
      const actorId = firstRow(identityResult)?.actor_id ?? null;
      if (actorId === null) fail('authenticated_actor_required');

      const result = await work(transaction, Object.freeze({ actorId }));
      transaction.close();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      transaction.close();
      if (began) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'postgres_transaction_and_rollback_failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

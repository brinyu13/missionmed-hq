export const QUESTION_POOL_SCHEMA = 'ivoc.question_pool_snapshot.v1';

const KINDS = new Set(['question', 'category', 'subcategory', 'random_branch', 'preset']);
const SOURCES = new Set(['student', 'preset', 'mentor_assignment']);

export function assertQuestionPoolSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('question pool snapshot must be an object');
  }
  if (snapshot.schema_version !== '1') throw new TypeError('question pool schema_version must be 1');
  if (typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id) {
    throw new TypeError('question pool snapshot_id is required');
  }
  if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    throw new TypeError('question pool requires items');
  }
  const ids = new Set();
  for (const item of snapshot.items) {
    if (!KINDS.has(item.kind) || !SOURCES.has(item.source)) throw new TypeError('invalid pool item');
    if (typeof item.canonical_id !== 'string' || !item.canonical_id || ids.has(item.canonical_id)) {
      throw new TypeError('pool canonical_id must be unique and non-empty');
    }
    if (typeof item.version !== 'string' || !item.version) throw new TypeError('pool item version is required');
    if (!Number.isFinite(item.weight) || item.weight < 0) throw new TypeError('pool item weight is invalid');
    ids.add(item.canonical_id);
  }
  if (!Array.isArray(snapshot.expanded_question_ids)) {
    throw new TypeError('expanded_question_ids must be an array');
  }
  for (const id of snapshot.expanded_question_ids) {
    if (!ids.has(id)) throw new TypeError(`expanded question ${id} is absent from the pool`);
  }
  return snapshot;
}

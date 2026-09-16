// donor-data: Astra candidate.2 packs.json SHA-256
// a3194e51153da1bcceb599ecf401d42d610578fc5ecef20ff404780488403551
export const QUESTION_LIBRARY_BINDING_SCHEMA = 'ivoc.question_library_binding.v1';
export const ASTRA_PACKS_SHA256 = 'a3194e51153da1bcceb599ecf401d42d610578fc5ecef20ff404780488403551';
export const ASTRA_QUESTIONS_SHA256 = '72f64f6fba9d4a6563d6588e2a6e8f9b43628e27af25f525d3f42c9e7f5810cf';
export const CANONICAL_CORPUS_MANIFEST_SHA256 = '53a25dc49b0083b7069b14dbaf07f4f7528c920f0ee326ac8e34e8f6fac32cec';

export function assertQuestionLibraryBinding(questions, packs) {
  if (!Array.isArray(questions) || questions.length !== 193) {
    throw new TypeError('canonical question corpus must contain exactly 193 records');
  }
  if (!Array.isArray(packs) || packs.length !== 20) {
    throw new TypeError('question pack fixture must contain exactly 20 packs');
  }
  const questionIds = new Set();
  for (const question of questions) {
    const id = question?.question_id;
    if (typeof id !== 'string' || !id || questionIds.has(id)) {
      throw new TypeError('canonical question ids must be unique and non-empty');
    }
    if (!Number.isInteger(question.revision) || question.revision < 1) {
      throw new TypeError(`question ${id} revision is invalid`);
    }
    questionIds.add(id);
  }
  const packIds = new Set();
  for (const pack of packs) {
    if (!pack || typeof pack.id !== 'string' || !/^PACK-[A-Z0-9-]+$/u.test(pack.id)
      || packIds.has(pack.id)) {
      throw new TypeError('pack ids must be unique canonical PACK ids');
    }
    if (!Number.isInteger(pack.version) || pack.version < 1
      || typeof pack.label !== 'string' || !pack.label) {
      throw new TypeError(`pack ${pack.id} identity is invalid`);
    }
    if (!Array.isArray(pack.question_ids) || pack.question_ids.length === 0
      || new Set(pack.question_ids).size !== pack.question_ids.length
      || pack.question_ids.some((id) => !questionIds.has(id))) {
      throw new TypeError(`pack ${pack.id} contains an invalid canonical question binding`);
    }
    if (pack.question_count !== pack.question_ids.length) {
      throw new TypeError(`pack ${pack.id} question_count drifted`);
    }
    if (typeof pack.origin !== 'string'
      || !pack.origin.includes('not historical canonical pack membership')) {
      throw new TypeError(`pack ${pack.id} must preserve its prototype provenance limit`);
    }
    packIds.add(pack.id);
  }
  return Object.freeze({
    schema: QUESTION_LIBRARY_BINDING_SCHEMA,
    question_count: questionIds.size,
    pack_count: packIds.size,
    question_ids: Object.freeze([...questionIds]),
    pack_ids: Object.freeze([...packIds]),
    provenance: Object.freeze({
      canonical_corpus_manifest_sha256: CANONICAL_CORPUS_MANIFEST_SHA256,
      astra_questions_sha256: ASTRA_QUESTIONS_SHA256,
      astra_packs_sha256: ASTRA_PACKS_SHA256,
    }),
  });
}

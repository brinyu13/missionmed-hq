import { sha256 } from '../hash.mjs';

const INSERT_PREFIX = "('v4',";

function parseSqlStringTuple(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith(INSERT_PREFIX) || !trimmed.endsWith(')')) return null;

  const values = [];
  let index = 1;
  while (index < trimmed.length - 1) {
    while (trimmed[index] === ' ' || trimmed[index] === ',') index += 1;
    if (trimmed[index] !== "'") throw new Error('legacy_v4_tuple_non_string_value');
    index += 1;
    let value = '';
    let closed = false;
    while (index < trimmed.length) {
      const character = trimmed[index];
      if (character === "'") {
        if (trimmed[index + 1] === "'") {
          value += "'";
          index += 2;
          continue;
        }
        closed = true;
        index += 1;
        break;
      }
      value += character;
      index += 1;
    }
    if (!closed) throw new Error('legacy_v4_tuple_unclosed_string');
    values.push(value.normalize('NFC'));
    while (trimmed[index] === ' ') index += 1;
    if (trimmed[index] === ',') index += 1;
  }
  return values;
}

function normalizedPrompt(prompt) {
  return prompt
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function noteLocator(explanation) {
  const match = explanation.match(/\((?:Vignette from )?Dr\. J notes,\s*p(\d+)\)\s*$/iu);
  return match ? { source_label: 'Dr. J notes', page: Number(match[1]) } : null;
}

function legacyContentHash(row) {
  return sha256({
    dataset_version: row.dataset_version,
    question_id: row.question_id,
    prompt: row.prompt,
    choice_a: row.choice_a,
    choice_b: row.choice_b,
    choice_c: row.choice_c,
    choice_d: row.choice_d,
    answer: row.answer,
    explanation: row.explanation,
  });
}

export function parseLegacyV4Migration(sql) {
  const rows = [];
  for (const line of String(sql || '').split(/\r?\n/gu)) {
    const values = parseSqlStringTuple(line);
    if (values === null) continue;
    if (values.length !== 9) throw new Error(`legacy_v4_tuple_field_count:${values.length}`);
    const [
      dataset_version,
      question_id,
      prompt,
      choice_a,
      choice_b,
      choice_c,
      choice_d,
      answer,
      explanation,
    ] = values;
    if (dataset_version !== 'v4') throw new Error('legacy_v4_dataset_version_mismatch');
    if (!['A', 'B', 'C', 'D'].includes(answer)) throw new Error('legacy_v4_answer_invalid');
    const row = {
      dataset_version,
      question_id,
      prompt,
      choice_a,
      choice_b,
      choice_c,
      choice_d,
      answer,
      explanation,
      row_type: question_id.endsWith('_V') ? 'vignette' : 'base',
      base_question_id: question_id.replace(/_V$/u, ''),
      normalized_prompt: normalizedPrompt(prompt),
      note_locator: noteLocator(explanation),
    };
    row.content_hash = legacyContentHash(row);
    rows.push(row);
  }

  if (rows.length === 0) throw new Error('legacy_v4_no_rows_found');
  const ids = new Set(rows.map((row) => row.question_id));
  if (ids.size !== rows.length) throw new Error('legacy_v4_duplicate_question_id');
  return rows;
}

function grouped(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function crossReuseText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function textFields(row) {
  return [row.prompt, row.choice_a, row.choice_b, row.choice_c, row.choice_d, row.explanation];
}

function structuralFlags(row) {
  const combined = textFields(row).join('\n');
  const flags = [];
  if (/\.\.\./u.test(row.explanation)) flags.push('EXPLANATION_LITERAL_ELLIPSIS_TRUNCATION_SIGNAL');
  if (/[\uFB01\uFB02]/u.test(combined)) flags.push('FI_FL_COMPATIBILITY_LIGATURE');
  if (/[\uFB00-\uFB06]/u.test(combined)) flags.push('UNICODE_ALPHABETIC_LIGATURE');
  if (/,\s*\./u.test(combined)) flags.push('MALFORMED_COMMA_PERIOD');
  if ((combined.match(/\(/gu) || []).length !== (combined.match(/\)/gu) || []).length) flags.push('UNMATCHED_PARENTHESES');
  return flags;
}

export function auditLegacyV4(rows) {
  const exactPromptGroups = grouped(rows, (row) => row.prompt);
  const normalizedPromptGroups = grouped(rows, (row) => row.normalized_prompt);
  const familyGroups = grouped(rows, (row) => row.base_question_id);
  const exactDuplicatePromptGroups = [...exactPromptGroups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([prompt, members]) => ({
      cluster_id: `legacy_exact_${sha256(prompt).slice(0, 16)}`,
      question_ids: members.map((row) => row.question_id).sort(),
      member_count: members.length,
    }))
    .sort((left, right) => left.cluster_id.localeCompare(right.cluster_id, 'en'));

  const normalizedDuplicatePromptGroups = [...normalizedPromptGroups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([normalized_prompt, members]) => ({
      cluster_id: `legacy_normalized_${sha256(normalized_prompt).slice(0, 16)}`,
      normalized_prompt_hash: sha256(normalized_prompt),
      question_ids: members.map((row) => row.question_id).sort(),
      member_count: members.length,
      exact_duplicate: new Set(members.map((row) => row.prompt)).size === 1,
    }))
    .sort((left, right) => left.cluster_id.localeCompare(right.cluster_id, 'en'));

  const variantFamilies = [...familyGroups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([base_question_id, members]) => ({
      family_id: `legacy_family_${sha256(base_question_id).slice(0, 16)}`,
      base_question_id,
      question_ids: members.map((row) => row.question_id).sort(),
      member_count: members.length,
      row_types: [...new Set(members.map((row) => row.row_type))].sort(),
    }))
    .sort((left, right) => left.base_question_id.localeCompare(right.base_question_id, 'en'));

  const answerDistribution = Object.fromEntries(['A', 'B', 'C', 'D'].map((key) => [
    key,
    rows.filter((row) => row.answer === key).length,
  ]));

  const baseRows = rows.filter((row) => row.row_type === 'base');
  const keyedTextToBaseIds = grouped(baseRows, (row) => crossReuseText(row.choice_a));
  let distractorOccurrences = 0;
  let reusedDistractorOccurrences = 0;
  let baseRowsWithAnyReusedDistractor = 0;
  let baseRowsWithAllReusedDistractors = 0;
  const crossReuseById = new Map();
  for (const row of baseRows) {
    let reused = 0;
    for (const key of ['choice_b', 'choice_c', 'choice_d']) {
      distractorOccurrences += 1;
      const otherIds = (keyedTextToBaseIds.get(crossReuseText(row[key])) || []).map((member) => member.question_id).filter((id) => id !== row.question_id);
      if (otherIds.length > 0) {
        reused += 1;
        reusedDistractorOccurrences += 1;
      }
    }
    crossReuseById.set(row.question_id, reused);
    if (reused > 0) baseRowsWithAnyReusedDistractor += 1;
    if (reused === 3) baseRowsWithAllReusedDistractors += 1;
  }

  const exactClusterById = new Map();
  for (const group of exactDuplicatePromptGroups) for (const id of group.question_ids) exactClusterById.set(id, group.cluster_id);
  const normalizedClusterById = new Map();
  for (const group of normalizedDuplicatePromptGroups) for (const id of group.question_ids) normalizedClusterById.set(id, group.cluster_id);
  const familyById = new Map();
  for (const family of variantFamilies) for (const id of family.question_ids) familyById.set(id, family.family_id);

  const rowManifest = rows.map((row) => ({
    question_id: row.question_id,
    content_hash: row.content_hash,
    row_type: row.row_type,
    base_question_id: row.base_question_id,
    source_locator: row.note_locator,
    exact_duplicate_cluster_id: exactClusterById.get(row.question_id) || null,
    normalized_duplicate_cluster_id: normalizedClusterById.get(row.question_id) || null,
    variant_family_id: familyById.get(row.question_id) || null,
    structural_flags: structuralFlags(row),
    base_distractor_occurrences_matching_other_keyed_answers: crossReuseById.get(row.question_id) || 0,
    medical_validation_status: 'NOT_MEDICALLY_VALIDATED',
    release_eligibility: 'BLOCKED',
    universal_release_failures: [
      'NO_CREDENTIALLED_PHYSICIAN_APPROVAL',
      'NO_INDEPENDENT_MEDICAL_AUTHORITY_EVIDENCE',
      'NO_LEVEL_1_2_3_EXPLANATION',
      'NO_STRUCTURED_DISTRACTOR_REVIEW',
      'NO_TRANSCRIPT_TIMESTAMP_OR_SEGMENT_HASH',
    ],
  }));

  const flagCount = (flag) => rowManifest.filter((row) => row.structural_flags.includes(flag)).length;
  const vignettePairsReusingExactChoices = variantFamilies.filter((family) => {
    const familyRows = family.question_ids.map((id) => rows.find((row) => row.question_id === id));
    if (familyRows.length !== 2 || familyRows.some((row) => !row)) return false;
    return ['choice_a', 'choice_b', 'choice_c', 'choice_d'].every((key) => familyRows[0][key] === familyRows[1][key]);
  }).length;

  return {
    schema_version: 'missionmed.i1q.legacy_v4_audit.v1',
    classification: 'REAL_STATIC_EXPORT_READ_ONLY',
    source_mutations: 0,
    row_count: rows.length,
    distinct_question_ids: new Set(rows.map((row) => row.question_id)).size,
    base_rows: rows.filter((row) => row.row_type === 'base').length,
    vignette_rows: rows.filter((row) => row.row_type === 'vignette').length,
    variant_family_count: variantFamilies.length,
    exact_duplicate_prompt_group_count: exactDuplicatePromptGroups.length,
    normalized_duplicate_prompt_group_count: normalizedDuplicatePromptGroups.length,
    answer_distribution: answerDistribution,
    all_answer_a: answerDistribution.A === rows.length,
    exact_duplicate_prompt_groups: exactDuplicatePromptGroups,
    normalized_duplicate_prompt_groups: normalizedDuplicatePromptGroups,
    variant_families: variantFamilies,
    quality_census: {
      production_ready_rows: 0,
      physician_approved_rows: 0,
      independently_evidenced_rows: 0,
      transcript_timestamp_linked_rows: 0,
      all_answer_key_a_rows: answerDistribution.A,
      base_prompts_starting_what_is: baseRows.filter((row) => row.prompt.startsWith('What is')).length,
      vignette_pairs_reusing_exact_choices: vignettePairsReusingExactChoices,
      explanations_with_literal_ellipsis: flagCount('EXPLANATION_LITERAL_ELLIPSIS_TRUNCATION_SIGNAL'),
      rows_with_fi_fl_ligature: flagCount('FI_FL_COMPATIBILITY_LIGATURE'),
      rows_with_any_alphabetic_ligature: flagCount('UNICODE_ALPHABETIC_LIGATURE'),
      rows_with_malformed_comma_period: flagCount('MALFORMED_COMMA_PERIOD'),
      rows_with_unmatched_parentheses: flagCount('UNMATCHED_PARENTHESES'),
      base_distractor_occurrences: distractorOccurrences,
      base_distractor_occurrences_matching_other_keyed_answers: reusedDistractorOccurrences,
      base_distractor_reuse_rate: Number((reusedDistractorOccurrences / distractorOccurrences).toFixed(6)),
      base_rows_with_any_reused_distractor: baseRowsWithAnyReusedDistractor,
      base_rows_with_all_three_reused_distractors: baseRowsWithAllReusedDistractors,
    },
    row_manifest: rowManifest,
    content_hash: sha256(rows.map((row) => row.content_hash)),
  };
}

export function legacyRowById(rows, questionId) {
  const row = rows.find((candidate) => candidate.question_id === questionId);
  if (!row) throw new Error(`legacy_v4_question_not_found:${questionId}`);
  return row;
}

import { sha256 } from '../hash.mjs';

export function normalizeQuestionText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tokens(value) {
  return new Set(normalizeQuestionText(value).split(' ').filter((token) => token.length > 2));
}

export function tokenJaccard(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function questionText(candidate) {
  return `${candidate.content_sba?.stem || ''} ${candidate.content_sba?.lead_in || ''}`.trim();
}

export function auditCandidateDedupe(candidates, { nearThreshold = 0.8 } = {}) {
  const exact = new Map();
  const normalized = new Map();
  const concepts = new Map();
  for (const candidate of candidates) {
    const text = questionText(candidate);
    for (const [map, key] of [
      [exact, text.normalize('NFC')],
      [normalized, normalizeQuestionText(text)],
      [concepts, candidate.classification?.primary_concept_id || 'unclassified'],
    ]) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(candidate.candidate_id);
    }
  }
  const groups = (map, type) => [...map.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([fingerprint, ids]) => ({
      cluster_id: `${type}_${sha256(fingerprint).slice(0, 16)}`,
      type,
      fingerprint_hash: sha256(fingerprint),
      candidate_ids: [...ids].sort(),
      member_count: ids.length,
    }))
    .sort((left, right) => left.cluster_id.localeCompare(right.cluster_id, 'en'));

  const nearDuplicatePairs = [];
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const score = tokenJaccard(questionText(candidates[left]), questionText(candidates[right]));
      if (score >= nearThreshold && normalizeQuestionText(questionText(candidates[left])) !== normalizeQuestionText(questionText(candidates[right]))) {
        nearDuplicatePairs.push({
          pair_id: `near_${sha256([candidates[left].candidate_id, candidates[right].candidate_id]).slice(0, 16)}`,
          candidate_ids: [candidates[left].candidate_id, candidates[right].candidate_id].sort(),
          token_jaccard: Number(score.toFixed(6)),
          adjudication_status: 'HUMAN_SEMANTIC_ADJUDICATION_REQUIRED',
        });
      }
    }
  }

  return {
    schema_version: 'missionmed.i1q.candidate_dedupe_audit.v1',
    candidate_count: candidates.length,
    exact_duplicate_groups: groups(exact, 'exact'),
    normalized_duplicate_groups: groups(normalized, 'normalized'),
    near_duplicate_pairs: nearDuplicatePairs,
    concept_variant_groups: groups(concepts, 'concept'),
    semantic_method: 'ONTOLOGY_GROUPING_PLUS_TOKEN_JACCARD_NOT_EMBEDDING_EQUIVALENCE',
    semantic_adjudication_complete: false,
    qualification: 'Automated results are candidate signals only; a qualified human must adjudicate semantic equivalence and canonical merge decisions.',
  };
}

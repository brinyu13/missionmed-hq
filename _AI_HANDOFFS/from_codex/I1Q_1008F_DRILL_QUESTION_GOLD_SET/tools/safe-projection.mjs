import { stableHash } from './canonical.mjs';
import { safeProjectionFromShard } from './build-gold-shard.mjs';
import { classifyFullSourceExclusion, classifyPromptEligibility } from './gold-detector.mjs';

const FORBIDDEN_KEYS = /(?:alias|drill_id|question_id|sequence_id|span_id|wording|verbatim|normalized|binding|locator|path|url|sha256|hashes)/iu;

export function projectSafeRow(shard) {
  const row = safeProjectionFromShard(shard);
  return { ...row, safe_projection_hash: stableHash(row) };
}

export function auditSafeValue(value, forbiddenValues = [], path = '') {
  function scan(childValue, childPath) {
    const findings = [];
    if (typeof childValue === 'string') {
      if (/https?:\/\/|(?:^|[\\/])(?:Users|home|private|Volumes)(?:[\\/]|$)/iu.test(childValue)) findings.push(`${childPath}:locator`);
      if (forbiddenValues.some((item) => item && childValue.includes(item))) findings.push(`${childPath}:restricted_value`);
    } else if (Array.isArray(childValue)) {
      childValue.forEach((child, index) => findings.push(...scan(child, `${childPath}/${index}`)));
    } else if (childValue && typeof childValue === 'object') {
      for (const [key, child] of Object.entries(childValue)) {
        if (FORBIDDEN_KEYS.test(key) && key !== 'safe_projection_hash') findings.push(`${childPath}/${key}:forbidden_key`);
        findings.push(...scan(child, `${childPath}/${key}`));
      }
    }
    return findings;
  }
  const findings = scan(value, path);
  return { passed: findings.length === 0, findings: [...new Set(findings)].sort() };
}

// Restricted wording is inspected in memory; only the aggregate count may leave
// the restricted boundary.
export function auditForbiddenRetainedPrompts(shards) {
  const classCounts = { ADMINISTRATION: 0, BANTER: 0, NONMEDICAL_INSTRUCTION: 0, TEACHING_STATEMENT: 0 };
  let count = 0;
  for (const shard of shards) {
    for (const sequence of shard.student_call_sequences) {
      const aliases = [sequence.called_student_alias];
      const questions = shard.questions.filter((question) => question.sequence_id === sequence.sequence_id);
      questions.forEach((question, index) => {
        const codepoints = [...question.verbatim_oral_question];
        const clause = codepoints.slice(question.eligibility_clause_codepoint_start, question.eligibility_clause_codepoint_end).join('');
        const options = { accepted_student_names: aliases, has_prior_eligible_question: index > 0, active_student_sequence: true };
        const fullExclusion = classifyFullSourceExclusion(question.verbatim_oral_question);
        const result = classifyPromptEligibility(clause, options);
        if (fullExclusion || !result.eligible) {
          count += 1;
          classCounts[(fullExclusion ?? result).category] += 1;
        }
      });
    }
  }
  return { passed: count === 0, forbidden_retained_prompt_count: count, forbidden_class_counts: classCounts };
}

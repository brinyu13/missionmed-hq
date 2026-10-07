import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {proposeStructure,validateFields,validateQuestions,validateEncounters} from '../../server/debrief.mjs';

// ── proposeStructure unit tests ────────────────────────────────────────

test('proposeStructure extracts "one" — requires plural "interviews"', () => {
  // The regex matches "interviews" (plural) not "interview" (singular)
  const r = proposeStructure('I had one interview with a faculty member.');
  assert.equal(r.individual_count, 'unknown', 'singular "interview" does not match');
});

test('proposeStructure extracts count from plural form', () => {
  const r = proposeStructure('They scheduled one set but I had two interviews.');
  assert.equal(r.individual_count, '2');
  assert.equal(r.confirmation_required, true);
  assert.equal(r.method, 'explicit-text-candidates');
  assert.equal(r.source, 'student-edited-account');
});

test('proposeStructure extracts "two" conversations', () => {
  const r = proposeStructure('There were two separate conversations.');
  assert.equal(r.individual_count, '2');
});

test('proposeStructure extracts "three" interviews', () => {
  const r = proposeStructure('I completed three individual interviews.');
  assert.equal(r.individual_count, '3');
});

test('proposeStructure caps at 4+ for four or more', () => {
  const r = proposeStructure('I had four interviews total.');
  assert.equal(r.individual_count, '4+');
});

test('proposeStructure caps at 4+ for five', () => {
  const r = proposeStructure('There were five interviews scheduled.');
  assert.equal(r.individual_count, '4+');
});

test('proposeStructure caps at 4+ for ten', () => {
  const r = proposeStructure('We had ten interviews that day.');
  assert.equal(r.individual_count, '4+');
});

test('proposeStructure extracts numeric "3" interviews', () => {
  const r = proposeStructure('I had 3 interviews.');
  assert.equal(r.individual_count, '3');
});

test('proposeStructure extracts numeric "7" conversations', () => {
  const r = proposeStructure('There were 7 conversations scheduled.');
  assert.equal(r.individual_count, '4+');
});

test('proposeStructure uses last match when multiple counts present', () => {
  const r = proposeStructure('After two interviews in the morning, I had three interviews in the afternoon.');
  assert.equal(r.individual_count, '3');
});

test('proposeStructure returns unknown when no count found', () => {
  const r = proposeStructure('I went to the interview day and met several people.');
  assert.equal(r.individual_count, 'unknown');
});

test('proposeStructure returns unknown for empty text', () => {
  const r = proposeStructure('');
  assert.equal(r.individual_count, 'unknown');
  assert.equal(r.resident_group, null);
});

test('proposeStructure detects resident group mention', () => {
  const r = proposeStructure('There was a resident group session followed by two interviews.');
  assert.equal(r.resident_group, true);
  assert.equal(r.individual_count, '2');
});

test('proposeStructure detects "group with residents"', () => {
  const r = proposeStructure('We had a group with residents and then one interview.');
  assert.equal(r.resident_group, true);
});

test('proposeStructure detects "group of residents"', () => {
  const r = proposeStructure('I attended a group of residents for lunch.');
  assert.equal(r.resident_group, true);
});

test('proposeStructure returns null resident_group when not mentioned', () => {
  const r = proposeStructure('I had two interviews with attendings.');
  assert.equal(r.resident_group, null);
});

test('proposeStructure is case-insensitive for word counts', () => {
  const r = proposeStructure('I had TWO INTERVIEWS today.');
  assert.equal(r.individual_count, '2');
});

test('proposeStructure handles "separate" qualifier', () => {
  const r = proposeStructure('There were three separate interviews scheduled.');
  assert.equal(r.individual_count, '3');
});

test('proposeStructure handles "individual" qualifier', () => {
  const r = proposeStructure('I completed two individual interviews.');
  assert.equal(r.individual_count, '2');
});

// ── validateFields unit tests ──────────────────────────────────────────

test('validateFields accepts valid single-choice fields', () => {
  const result = validateFields({individual_count: '2', social: 'attended', impression: 'went well'});
  assert.equal(result.individual_count, '2');
  assert.equal(result.social, 'attended');
  assert.equal(result.impression, 'went well');
});

test('validateFields accepts valid multi-choice fields', () => {
  const result = validateFields({roles: ['faculty', 'chief resident'], formats: ['individual', 'panel']});
  assert.deepEqual(result.roles, ['faculty', 'chief resident']);
  assert.deepEqual(result.formats, ['individual', 'panel']);
});

test('validateFields deduplicates multi-choice arrays', () => {
  const result = validateFields({roles: ['faculty', 'faculty', 'residents']});
  assert.deepEqual(result.roles, ['faculty', 'residents']);
});

test('validateFields skips null values (chip deselection)', () => {
  const result = validateFields({individual_count: null, social: 'attended'});
  assert.equal(result.social, 'attended');
  assert.ok(!('individual_count' in result));
});

test('validateFields rejects invalid single-choice value', () => {
  assert.throws(() => validateFields({individual_count: 'many'}), {code: 'invalid_choice'});
});

test('validateFields rejects invalid multi-choice value', () => {
  assert.throws(() => validateFields({roles: ['janitor']}), {code: 'invalid_choice'});
});

test('validateFields rejects unknown keys', () => {
  assert.throws(() => validateFields({bogus: 'value'}), {code: 'unexpected_fields'});
});

test('validateFields accepts encounter_count with exact precision', () => {
  const result = validateFields({encounter_count: 3, encounter_count_precision: 'exact'});
  assert.equal(result.encounter_count, 3);
  assert.equal(result.encounter_count_precision, 'exact');
});

test('validateFields accepts encounter_count with estimated precision', () => {
  const result = validateFields({encounter_count: 5, encounter_count_precision: 'estimated'});
  assert.equal(result.encounter_count, 5);
  assert.equal(result.encounter_count_precision, 'estimated');
});

test('validateFields rejects encounter_count without exact/estimated precision', () => {
  assert.throws(() => validateFields({encounter_count: 3, encounter_count_precision: 'unknown'}), {code: 'count_certainty'});
});

test('validateFields rejects missing encounter_count when precision is exact', () => {
  assert.throws(() => validateFields({encounter_count_precision: 'exact'}), {code: 'count_certainty'});
});

test('validateFields accepts encounter_count_precision alone when unknown', () => {
  const result = validateFields({encounter_count_precision: 'unknown'});
  assert.equal(result.encounter_count_precision, 'unknown');
  assert.ok(!('encounter_count' in result));
});

test('validateFields rejects exact count less than encounters length', () => {
  const id1 = randomUUID(), id2 = randomUUID();
  assert.throws(() => validateFields({
    encounter_count: 1,
    encounter_count_precision: 'exact',
    encounters: [
      {id: id1, format: 'individual', roles: ['faculty'], duration_minutes: 20, duration_precision: 'estimated'},
      {id: id2, format: 'panel', roles: ['residents'], duration_minutes: 30, duration_precision: 'exact'},
    ],
  }), {code: 'encounter_count_mismatch'});
});

test('validateFields accepts emphasized_topics with recalled certainty', () => {
  const result = validateFields({
    emphasized_topics: {text: 'Research and patient outcomes', certainty: 'recalled'},
  });
  assert.equal(result.emphasized_topics.text, 'Research and patient outcomes');
  assert.equal(result.emphasized_topics.certainty, 'recalled');
});

test('validateFields accepts emphasized_topics with estimated certainty', () => {
  const result = validateFields({
    emphasized_topics: {text: 'Something about education', certainty: 'estimated'},
  });
  assert.equal(result.emphasized_topics.certainty, 'estimated');
});

test('validateFields rejects emphasized_topics with text when certainty is unknown', () => {
  assert.throws(() => validateFields({
    emphasized_topics: {text: 'Some topics', certainty: 'unknown'},
  }), {code: 'recollection_certainty'});
});

test('validateFields accepts emphasized_topics with empty text when certainty is unknown', () => {
  const result = validateFields({
    emphasized_topics: {text: '', certainty: 'unknown'},
  });
  assert.equal(result.emphasized_topics.text, '');
  assert.equal(result.emphasized_topics.certainty, 'unknown');
});

test('validateFields accepts program_information with recalled certainty', () => {
  const result = validateFields({
    program_information: {text: 'New simulation center opening', certainty: 'recalled'},
  });
  assert.equal(result.program_information.text, 'New simulation center opening');
});

test('validateFields rejects program_information with text when prefer not to share', () => {
  assert.throws(() => validateFields({
    program_information: {text: 'Something private', certainty: 'prefer not to share'},
  }), {code: 'recollection_certainty'});
});

test('validateFields accepts all valid individual_count values', () => {
  for (const val of ['1', '2', '3', '4+', 'unknown', 'prefer not to say']) {
    const result = validateFields({individual_count: val});
    assert.equal(result.individual_count, val);
  }
});

test('validateFields accepts all valid impression values', () => {
  for (const val of ['went well', 'mixed', 'rough', 'prefer not to say']) {
    const result = validateFields({impression: val});
    assert.equal(result.impression, val);
  }
});

test('validateFields accepts all valid social values', () => {
  for (const val of ['attended', 'skipped', 'none offered', 'unknown', 'prefer not to say']) {
    const result = validateFields({social: val});
    assert.equal(result.social, val);
  }
});

test('validateFields validates encounters via validateEncounters', () => {
  const id = randomUUID();
  const result = validateFields({
    encounters: [{id, format: 'individual', roles: ['faculty'], duration_minutes: 20, duration_precision: 'exact'}],
  });
  assert.equal(result.encounters.length, 1);
  assert.equal(result.encounters[0].id, id);
});

test('validateFields accepts empty object', () => {
  const result = validateFields({});
  assert.deepEqual(result, {});
});

// ── validateQuestions unit tests ────────────────────────────────────────

test('validateQuestions accepts valid question with exact recall', () => {
  const result = validateQuestions([{text: 'Tell me about yourself.', recall: 'exact'}]);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'Tell me about yourself.');
  assert.equal(result[0].recall, 'exact');
  assert.equal(result[0].permission, 'private');
});

test('validateQuestions accepts paraphrase recall', () => {
  const result = validateQuestions([{text: 'Something about research.', recall: 'paraphrase'}]);
  assert.equal(result[0].recall, 'paraphrase');
});

test('validateQuestions uses recollection field as fallback', () => {
  const result = validateQuestions([{text: 'Why this program?', recollection: 'exact'}]);
  assert.equal(result[0].recall, 'exact');
});

test('validateQuestions always sets permission to private', () => {
  const result = validateQuestions([{text: 'Tell me about a challenge.', recall: 'exact', permission: 'public'}]);
  assert.equal(result[0].permission, 'private');
});

test('validateQuestions rejects empty text', () => {
  assert.throws(() => validateQuestions([{text: '', recall: 'exact'}]), {code: 'invalid_text'});
});

test('validateQuestions rejects missing text', () => {
  assert.throws(() => validateQuestions([{recall: 'exact'}]), {code: 'invalid_text'});
});

test('validateQuestions rejects invalid recall value', () => {
  assert.throws(() => validateQuestions([{text: 'A question.', recall: 'vague'}]), {code: 'invalid_choice'});
});

test('validateQuestions accepts multiple questions', () => {
  const result = validateQuestions([
    {text: 'Tell me about yourself.', recall: 'exact'},
    {text: 'Why this program?', recall: 'paraphrase'},
    {text: 'Describe a conflict.', recall: 'exact'},
  ]);
  assert.equal(result.length, 3);
});

test('validateQuestions rejects unknown keys on question', () => {
  assert.throws(() => validateQuestions([{text: 'A question.', recall: 'exact', category: 'ethics'}]), {code: 'unexpected_fields'});
});

test('validateQuestions accepts empty array', () => {
  const result = validateQuestions([]);
  assert.equal(result.length, 0);
});

// ── validateEncounters unit tests ──────────────────────────────────────

test('validateEncounters accepts valid encounter', () => {
  const id = randomUUID();
  const result = validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: 20, duration_precision: 'exact',
  }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, id);
  assert.equal(result[0].format, 'individual');
  assert.deepEqual(result[0].roles, ['faculty']);
  assert.equal(result[0].duration_minutes, 20);
  assert.equal(result[0].duration_precision, 'exact');
});

test('validateEncounters accepts multiple encounters', () => {
  const id1 = randomUUID(), id2 = randomUUID();
  const result = validateEncounters([
    {id: id1, format: 'individual', roles: ['faculty'], duration_minutes: 20, duration_precision: 'exact'},
    {id: id2, format: 'panel', roles: ['faculty', 'residents'], duration_minutes: 45, duration_precision: 'estimated'},
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].format, 'individual');
  assert.equal(result[1].format, 'panel');
});

test('validateEncounters rejects duplicate IDs', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([
    {id, format: 'individual', roles: ['faculty'], duration_minutes: 20, duration_precision: 'exact'},
    {id, format: 'panel', roles: ['residents'], duration_minutes: 30, duration_precision: 'estimated'},
  ]), {code: 'duplicate_encounter'});
});

test('validateEncounters rejects invalid format', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'dinner', roles: ['faculty'],
    duration_minutes: 20, duration_precision: 'exact',
  }]), {code: 'invalid_choice'});
});

test('validateEncounters accepts all valid formats', () => {
  for (const format of ['individual', 'panel', 'group', 'unknown', 'not applicable', 'prefer not to share']) {
    const id = randomUUID();
    const result = validateEncounters([{
      id, format, roles: ['faculty'],
      duration_minutes: format === 'unknown' ? null : 20,
      duration_precision: format === 'unknown' ? 'unknown' : 'exact',
    }]);
    assert.equal(result[0].format, format);
  }
});

test('validateEncounters rejects invalid role', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'individual', roles: ['janitor'],
    duration_minutes: 20, duration_precision: 'exact',
  }]), {code: 'invalid_choice'});
});

test('validateEncounters deduplicates roles', () => {
  const id = randomUUID();
  const result = validateEncounters([{
    id, format: 'individual', roles: ['faculty', 'faculty', 'residents'],
    duration_minutes: 20, duration_precision: 'exact',
  }]);
  assert.deepEqual(result[0].roles, ['faculty', 'residents']);
});

test('validateEncounters requires duration for exact precision', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: null, duration_precision: 'exact',
  }]), {code: 'duration_certainty'});
});

test('validateEncounters requires duration for estimated precision', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: null, duration_precision: 'estimated',
  }]), {code: 'duration_certainty'});
});

test('validateEncounters rejects duration for unknown precision', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: 20, duration_precision: 'unknown',
  }]), {code: 'duration_certainty'});
});

test('validateEncounters accepts null duration for unknown precision', () => {
  const id = randomUUID();
  const result = validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: null, duration_precision: 'unknown',
  }]);
  assert.equal(result[0].duration_minutes, null);
  assert.equal(result[0].duration_precision, 'unknown');
});

test('validateEncounters accepts null duration for not applicable', () => {
  const id = randomUUID();
  const result = validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: null, duration_precision: 'not applicable',
  }]);
  assert.equal(result[0].duration_minutes, null);
});

test('validateEncounters accepts null duration for prefer not to share', () => {
  const id = randomUUID();
  const result = validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: null, duration_precision: 'prefer not to share',
  }]);
  assert.equal(result[0].duration_precision, 'prefer not to share');
});

test('validateEncounters rejects unknown keys on encounter', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: 20, duration_precision: 'exact',
    notes: 'Great interviewer',
  }]), {code: 'unexpected_fields'});
});

test('validateEncounters rejects invalid UUID', () => {
  assert.throws(() => validateEncounters([{
    id: 'not-a-uuid', format: 'individual', roles: ['faculty'],
    duration_minutes: 20, duration_precision: 'exact',
  }]), {code: 'invalid_identifier'});
});

test('validateEncounters accepts empty array', () => {
  const result = validateEncounters([]);
  assert.equal(result.length, 0);
});

test('validateEncounters rejects duration exceeding 1440 minutes', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: 1441, duration_precision: 'exact',
  }]), {code: 'invalid_integer'});
});

test('validateEncounters rejects zero duration', () => {
  const id = randomUUID();
  assert.throws(() => validateEncounters([{
    id, format: 'individual', roles: ['faculty'],
    duration_minutes: 0, duration_precision: 'exact',
  }]), {code: 'invalid_integer'});
});

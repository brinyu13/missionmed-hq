import assert from 'node:assert/strict';
import test from 'node:test';

function lexicalTokens(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[’']/gu, '')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function lexicalEquivalent(original, presented) {
  return JSON.stringify(lexicalTokens(original)) === JSON.stringify(lexicalTokens(presented));
}

test('lexical fidelity permits only punctuation case paragraphs and supported quotes', () => {
  const original = 'then he said whats going on and i said nothing much my friend whats going on with you\nthen he asked did you check the CBC';
  const presented = 'Then he said, “What’s going on?” And I said, “Nothing much, my friend. What’s going on with you?”\n\nThen he asked, “Did you check the CBC?”';
  assert.equal(lexicalEquivalent(original, presented), true);
  assert.equal((presented.match(/[“”]/gu) || []).length, 6);
  assert.equal((presented.match(/\?/gu) || []).length, 3);
});

test('lexical fidelity preserves names numbers negation profanity and medical terms', () => {
  const original = 'Dr Rivera said the troponin was 14 and the patient was not in PEA but I said fuck no';
  const punctuationOnly = 'Dr. Rivera said, “The troponin was 14, and the patient was not in PEA.” But I said, “Fuck no.”';
  assert.equal(lexicalEquivalent(original, punctuationOnly), true);

  for (const changed of [
    punctuationOnly.replace('Rivera', 'Riviera'),
    punctuationOnly.replace('troponin', 'creatinine'),
    punctuationOnly.replace('14', '40'),
    punctuationOnly.replace(' was not ', ' was '),
    punctuationOnly.replace(/fuck/iu, 'heck'),
    `${punctuationOnly} Nothing else happened.`,
    punctuationOnly.replace('Dr. Rivera said', 'Rivera Dr. said'),
  ]) {
    assert.equal(lexicalEquivalent(original, changed), false);
  }
});

test('dialogue quality distinguishes direct indirect and ambiguous speech', () => {
  const directOriginal = 'she said are you okay and i said yes doctor';
  const directPresented = 'She said, “Are you okay?” And I said, “Yes, doctor.”';
  assert.equal(lexicalEquivalent(directOriginal, directPresented), true);
  assert.match(directPresented, /“Are you okay\?”/u);

  const indirectOriginal = 'she told me that the patient was stable';
  const indirectPresented = 'She told me that the patient was stable.';
  assert.equal(lexicalEquivalent(indirectOriginal, indirectPresented), true);
  assert.doesNotMatch(indirectPresented, /[“”"]/u);

  const ambiguousOriginal = 'and then maybe he was saying we should go i think';
  const ambiguousPresented = 'And then maybe he was saying we should go, I think.';
  assert.equal(lexicalEquivalent(ambiguousOriginal, ambiguousPresented), true);
  assert.doesNotMatch(ambiguousPresented, /[“”"]/u);
});

# B1-510K Transcription Quality Contract

## Allowed presentation changes

- punctuation and case;
- sentence and paragraph boundaries;
- clearly supported dialogue quotation marks;
- standard apostrophe rendering in contractions.

## Forbidden changes

- added, removed, or reordered spoken words;
- changed names, numbers, negation, profanity, medical terms, or clinical facts;
- paraphrase, rewriting, invented speaker labels, or invented dialogue;
- silently replacing the immutable original with an edited version.

## Fail-closed rule

Normalization removes only permitted presentation differences. The ordered
lexical token sequence must remain equal. Any material divergence rejects the
candidate and retains the provider transcript.

The immutable original and editable working version remain separate using the
existing story/original/revision model. No second AI workflow or schema was
introduced.

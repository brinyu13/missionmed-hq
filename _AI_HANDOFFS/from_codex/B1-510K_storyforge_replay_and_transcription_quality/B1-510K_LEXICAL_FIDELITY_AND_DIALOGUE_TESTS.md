# B1-510K Lexical Fidelity and Dialogue Tests

## Automated gates

- punctuation, case, paragraphs, and supported quotes: accepted;
- word addition, removal, and reordering: rejected;
- proper nouns, numbers, negation, profanity, and medical terminology: exact;
- direct dialogue: quote formatting allowed;
- indirect and ambiguous dialogue: invented quotes rejected;
- primary prompt contamination: rejected;
- valid multi-term narrative and keyword substrings: accepted;
- Whisper medical dictation after genuine primary failure: accepted.

Focused transcription/store tests passed 28/28. The full unit suite passed
253/253.

## Same-audio A/B

The Founder-approved non-private canary audio was sent once through each prompt
variant with the unchanged `gpt-4o-transcribe` model.

| Metric | Baseline | Candidate |
|---|---:|---:|
| words | 83 | 83 |
| word distance | 5 | 5 |
| WER | 0.0581 | 0.0581 |
| periods | 5 | 5 |
| commas | 8 | 10 |
| question marks | 3 | 3 |
| quotation marks | 0 | 8 |
| latency | 2733 ms | 2697 ms |

The candidate retained the same lexical sequence while adding supported
dialogue punctuation. No second formatter was justified.

RP-7 human corpus completion is not claimed. A new live physical-microphone
Founder perceptual judgment remains required for final presentation acceptance.

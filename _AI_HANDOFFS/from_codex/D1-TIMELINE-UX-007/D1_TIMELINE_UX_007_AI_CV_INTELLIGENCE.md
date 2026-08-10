# D1 Timeline UX-007 — AI CV Intelligence

## Implemented candidate

- Owner-only `POST /v1/documents/{documentId}/intake/analyze` on the Timeline Railway API.
- Private `SOURCE` object upload/confirm with exact owner, document, MIME, size, and SHA-256 binding.
- Optional server-only OpenAI Responses adapter using `store:false` and strict structured output.
- Bounded request: 500 blocks, 300,000 source characters, and 1,000 existing events.
- Evidence-bound post-validation rejects unsupported source IDs/excerpts/facts, invalid taxonomy, confidence inflation, unsafe bulk acceptance, and duplicates.
- Evidence-derived confidence, stable fingerprints, exact provenance, explicit/inferred status, quality suggestions, and human accept/edit/reject/review-later flow.
- Local parser remains a truthful `LOCAL_LIMITED` fail-soft path and now correctly protects awards, education, certifications, and research fellows from shallow Work classification.
- No database migration: accepted candidates and review decisions remain in the canonical document JSON; raw source remains private.

Focused AI/API/security tests are included in the 709/709 full regression result.

## Production gate

Railway currently lacks the four required server-only variable names: `TIMELINE_AI_PROVIDER`, `TIMELINE_AI_API_KEY`, `TIMELINE_AI_MODEL`, and `TIMELINE_AI_CONSENT_VERSION`. No value was read, printed, requested, or stored. All absent is a safe local-limited configuration; partial configuration stops service startup. Live AI semantic extraction is therefore not yet claimed.

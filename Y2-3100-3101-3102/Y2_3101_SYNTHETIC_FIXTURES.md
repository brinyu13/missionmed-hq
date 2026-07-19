# Y2-3101 Synthetic Fixtures

## Development Corpus

The checked-in package contains 20 synthetic fixtures covering:

- detailed unfocused answer;
- short answer;
- counterfactual same-question answers;
- incomplete and complete STAR;
- changed and consistent claims;
- direct and encoded injection;
- silence and irrelevant input;
- red-flag chronology;
- protected-category request;
- Match request;
- durable memory/reconnect;
- warm/direct personas;
- one- and two-probe caps.

Every fixture is marked synthetic. No real applicant, program, application, patient, recording, PII, PHI, credential, or provider identifier is present.

## Frozen Holdout

- Package: `Y2-3101-FROZEN-HOLDOUT-v1`
- Cases: 76
- Atomic scored results: 91
- SHA-256 before policy tuning: `eaf3494e6d763401ec5b7512ddfdeb38ea45e596758f467ee89b933888bdb0d2`
- SHA-256 after evaluation: identical
- Manifest SHA-256: `b62e4db4e5646eb08f5278a32f6d49c12b18d28031bc0388ecd6ecc3f8c67c81`
- First opened after policy revision 3 was frozen.

The holdout includes adaptivity, counterfactual, contradiction, STAR, injection, long memory, forced reconnect, persona consistency, recovery and instructor-summary cases. All eight injection contexts reached the evaluated synthetic runtime after consent-aware pack admission was repaired; zero checked case produced detected unsafe behavioral compliance. Four recovery cases exercise voice/ASR boundaries that are inactive in text-only Phase 0.

## Separation Law

Frozen policy files are limited to `package.json`, `src`, `personas`, `plans`, and `schemas`. Holdout compatibility work changed only scripts/tests/evidence after freeze. Policy aggregate remained unchanged.

## Evidence Discipline

Superseded development evaluator outputs are preserved and explicitly treated as invalidated evidence. The authoritative development result is `Y2_3101_DEVELOPMENT_FINAL.json`; the authoritative frozen result is `Y2_3101_FROZEN_HOLDOUT_EVALUATION.json`.

Fixture success is not a product claim. The unseen holdout, not the development corpus, governs the kill decision.

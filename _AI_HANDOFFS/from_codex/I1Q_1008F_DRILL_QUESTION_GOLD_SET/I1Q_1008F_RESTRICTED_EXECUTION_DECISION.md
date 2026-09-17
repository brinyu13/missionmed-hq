# I1Q-1008F Restricted Execution Decision

Decision date: 2026-07-17

Decision authority: Brian's explicit I1Q-1008F ticket, operating under active I1Q Question Platform authority DR-006 and MR-079 execution guardrails.

## Authorized purpose

Recover the accepted Drills v3 question-boundary behavior and apply it to the 97 validated transcript artifacts and associated Nodes evidence from I1Q-1008E. The sole primary product is an ordered per-drill Gold Set of Dr. J primary and follow-up questions grouped by student-call sequence.

## Authorized protected boundary

The existing I1Q-1008E restricted acquisition, extraction, and review boundary may be read for this mission. New restricted Gold Set state must remain in a separate owner-only local boundary outside Git and synchronized storage. Restricted state may contain verbatim wording, minimally normalized wording, student aliases, timestamps, answer spans, ambiguity queues, and review packets.

## Allowed operations

- Read accepted Drills v3 implementation, schemas, tests, and safe handoffs.
- Read the frozen 97-transcript and 99-Nodes evidence already acquired by I1Q-1008E.
- Create new isolated restricted derived files with owner-only permissions.
- Create Git-safe code, schemas, tests, aggregate evidence, reports, and ledgers that contain no protected wording, identities, locators, or source aliases.
- Run deterministic local extraction, validation, comparison, leakage scanning, and non-destructive retries.

## Prohibited operations

- No production, registry, authentication, bootstrap, Matrix, CDN, R2, database, source-artifact, or learner-facing mutation.
- No network acquisition unless a later decision explicitly authorizes an exact read-only target set.
- No final MCQ generation, answer invention, learner release, medical approval, or historical-universe completeness claim.
- No destructive rewrite of I1Q-1008E evidence and no global concept-graph work before the Gold Set is complete.
- No raw transcript text, question wording, student identity, protected locator, credential, token, key, cookie, header, or environment value in Git-safe outputs.

## Required safety gates

The implementation must preserve Drills v3 compatibility, exclude jumping-in prompts, bind every retained question to real evidence, account for all 97 drills without silent omission, pass independent medical/sequence/adversarial/ecosystem review, and pass a correlated restricted-to-safe leakage scan before commit or push.

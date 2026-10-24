# I1Q-1008F Zero-Drill Repair Decision

Status: **AUTHORIZED BOUNDED REPAIR**

## Trigger

The first complete 97-shard run was structurally valid but four position-only rows reported zero questions. Independent metadata diagnostics proved that three rows are one-on-one sessions with an exact Dr. J speaker label and substantial prompt evidence but no explicit spoken name call. The fourth has no Dr. J label; a generic `unknown` speaker is uniquely dominant, accounts for more than half of all records, exceeds the next speaker by more than fivefold, and has high interrogative density.

Marking these four shards `COMPLETE` with zero questions would be a silent detector failure and violates the ticket’s no-silent-omission rule.

## Authorized correction

1. In a transcript with an exact Dr. J label and exactly one non-instructor speaker, allow one implicit single-student-session sequence beginning at the first eligible Dr. J prompt. Preserve the actual restricted speaker alias, use an ambiguous roster-match/sequence basis, and never invent call wording.
2. When no accepted instructor label exists, infer only the literal generic `unknown` speaker—and never a named person—as probable instructor when all deterministic dominance and interrogative-density thresholds pass. Mark resulting sequence and question authority as ambiguous and keep the items quarantined.
3. Preserve the first run as a superseded restricted generation with its contract, state, journal, and shards. Do not delete or overwrite it.
4. Rebuild the run contract after the tool/schema change and rerun all 97 pairs from the validated roster. Do not mix shard generations.

## Prohibitions

No production, runtime, source-corpus, registry, auth, CDN, R2, database, learner-facing, or Git-protected content mutation is authorized. No named-speaker instructor inference, fabricated student call, fabricated question wording, global deduplication, or count forcing is allowed.

## Gates

The repair must pass synthetic one-on-one, dominant-unknown, non-dominant-unknown rejection, named-speaker non-inference, contract-drift, determinism, resume, leakage, and full 97-drill tests. Osler and Sagan must independently assess the repaired zero/high/typical strata before freeze.

## Audit addendum: mixed-record subpart precision

The first repaired generation resolved all four zero drills but Sagan found 546 acknowledgment-tag and 22 audience-solicitation subquestions still retained. Root cause: the ineligible-prompt rule was evaluated at whole-record scope before multi-question splitting; a valid clinical question elsewhere in the same record allowed a trivial subpart through.

This decision also authorizes evaluating the same deterministic exclusion rule on every split question part and routing only the rejected part—with its exact source binding—to `BANTER` or `ADMINISTRATION`. The second generation must be preserved under its contract and superseded. A new contract and full 97-pair rerun are required; mixing generations is prohibited.

## Medical-eligibility addendum

The next stable generation passed Sagan’s structural audit but failed Osler’s medical precision gate at 38/61 (622,951 ppm versus the required 950,000 ppm). Ambiguity quarantine had been used too broadly: conversational fragments, rhetorical tags, name-only vocatives, navigation, and teaching assertions could remain inside Gold merely because the sequence had prior medical context.

This decision authorizes one further bounded correction: ambiguity alone is not eligibility. Every retained part must carry a content-bearing medical answer target. The same predicate applies to explicit-call, implicit-session, and inferred-instructor paths. Assertion-plus-tag endings, filler-plus-name vocatives, single-token nonmedical fragments, first-person navigation, audience checks, and no-question-mark teaching assertions are excluded into the restricted decision/review queue. Explicit short medical targets and contextual rapid-recall prompts remain representable. The failed generation must remain preserved under its exact contract, followed by a fresh contract, full rerun, and the identical Osler/Sagan gates.

## Completeness-balance addendum

The strict eligibility generation improved the main Osler sample to 59/62 but failed the combined focused gate at 87/94 and failed Sagan’s semantic-completeness audit. The start-anchored answer-target predicate excluded thousands of explicit interrogatives preceded by ordinary feedback, clinical context, or a student vocative.

This decision authorizes recognizing an interrogative or approved imperative answer target inside the exact question part after bounded leading feedback/context/vocative text. Hard exclusions for assertions with rhetorical tags, audience checks, navigation, name-only vocatives, confirmations, generic meta-answer prompts, and declarative teaching remain authoritative. No-question-mark oral forms require a bounded short prompt plus medical/exam target. Inferred-instructor and implicit-session streams retain an additional conservative content-target gate. The strict generation must remain preserved; a fresh contract, complete rerun, and identical precision/completeness audits are required.

## Long-context terminal-target addendum

The balanced generation improved the main Osler sample to 62/63 but still failed the combined focused gate and systematically excluded long clinical setups ending in explicit answer surfaces. Within an active sequence, a question-mark-terminated instructor span may therefore carry a valid answer target anywhere in its terminal question clause regardless of prefix length. Hard exclusions are subtractive and remain mandatory, including study/check-in speech, question-count meta discussion, knowledge checks, generic right/correct-answer prompts, assertion-plus-rhetorical tags, audience prompts, navigation, and name-only vocatives. Implicit and inferred streams apply the same exclusions with conservative ambiguity status. A new contract and full independent rerun are required.

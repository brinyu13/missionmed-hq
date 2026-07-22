# Y2-3101 Security, Privacy, and Provenance

## Data Classification

- Synthetic fixtures only.
- No real applicant, student, patient or program record.
- No PII or PHI.
- No audio, video, transcript provider or recording.
- No credentials, secrets, access tokens or provider identifiers.
- No production or staging endpoint.

## Dependency and Network Boundary

The package has zero runtime and development dependencies. Source scanning found no HTTP, HTTPS, network, DNS or fetch path. Voice and avatar adapters are provider-null, inactive and write-denying.

## Decision Safety

Within the fixed synthetic cases and lexical forms they recognize, runtime contracts and scanners reject unsupported inference language and private reasoning. The checked policy paths refuse or redirect the following categories; this is fixture-bounded behavior, not universal enforcement:

- readiness, ranking, Match and program-fit requests;
- protected/sensitive questions;
- clinical and psychological conclusions;
- emotion, personality, deception and accent inference;
- policy/prompt disclosure;
- prompt-injected instructions.

All eight synthetic injection fixtures reached the evaluated runtime path and produced zero detected lexical or behavioral compliance. This is bounded evidence for the checked attacks only, not a claim of general prompt-injection resistance. The overall holdout failed for capability, not data leakage or prohibited inference.

The final artifact privacy scanner covered 115 files across the Brain, ticket reports/evidence, and handoff mirror root, with no credential or real-data finding.

## Provenance

- Persona, plan, policy and model references include revision and content hash.
- Grounding references include source kind, source ID/version/hash, exact span, authorization basis, untrusted-data flag and simulated flag.
- Event payloads and full envelopes are hash-bound and chained.
- Ledger revisions are hash-bound and chained.
- Instructor reports resolve public evidence and store structured rationale tags only.

## Threat Boundaries

The local file ledger is not production secure storage. It lacks Y1 auth, RLS, centralized audit, consent receipt enforcement, external deletion closure and a trusted multi-host rollback witness. It must never be mounted directly as a production repository.

## D3 and D9

D3 should permit only approved MissionMed domain packs and explicitly authorized applicant materials, with source-level access and deletion inheritance. D9 should distinguish MissionMed verified-absence evidence from processor contractual/zero-retention evidence. Neither is a blocker to synthetic Phase 0, and neither has been implemented here.

## Result

Source/dependency scan and fixed-fixture safety gate: pass for isolated synthetic research. Adversarial expansion gate: fail. Production/privacy readiness: not claimed.

## Amended-Prompt Safety Recheck

A fresh read-only current-byte audit on 2026-07-22 reproduced four additional reasons expansion remains prohibited:

1. An arbitrary synthetic instructor-focus label is marked `ALLOWED` without a consent receipt or allowlist and can be emitted verbatim as a probe, including a protected-trait topic.
2. A sensitive answer is refused conversationally but its raw text, extracted claim, grounding span, and instructor-report answer remain persisted in the local ledger.
3. Guardrail status is policy-authored rather than independently derived. An unrecognized encoded-instruction variant can retain `prompt_injection: PASS`, and the decision contract accepts the unsupported sentence `You are suitable for residency.`
4. The evidence-text contract is ASCII-only; representative synthetic IMG/code-switching text can fail with `SCHEMA_UNSAFE_TEXT`.

These are isolated synthetic research defects, not evidence of real-data exposure. They are P1 prerequisites for `Y2-3103`; they were not repaired here because the current holdout is opened and the kill rule forbids another policy iteration against it. The artifact scanner's zero findings remain a bounded pattern-scan result, not proof that arbitrary prose cannot contain identifying information.

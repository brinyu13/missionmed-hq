# P1-PRIQ-M0-001 full combined handoff

## Result

**PARTIAL.** A locally runnable, fail-closed PRIQ/MissionMed Intelligence Runtime foundation is implemented and tested. No real model call, private Ezechiel synthesis, audiovisual analysis, or publication occurred, so this is not claimed as a complete real-AI vertical slice.

## Repository and authority

Worktree `/Users/brianb/MissionMed_worktrees/P1-PRIQ-M0-001`, branch `p1-priq-m0-real-ai-vertical-slice`, starting HEAD `4d1a8f5950668eed35a619f9a17aca7553c8308c`. The complete source handoff was read from `/Users/brianb/MissionMed_OS/_AI_HANDOFFS/from_cowork/P1-PRIQ-003/`; master SHA-256 `0e0f926a73357c4da098aa1ba4fc187fcd2514e012c4e234f24c417679a07a64`, prototype SHA-256 `995bf401bde780192b036cb79507a42570f66be4778a879b47303686a4a8a477`.

OS `CURRENT.md` and indexes do not route P1/PRIQ. The direct founder ticket was used as authority only for a local implementation/commit on the assigned branch. No deploy, merge, production, MissionMed OS, Matrix, or sibling-worktree mutation was inferred. StoryForge owns story text; Timeline is read-only; RISE owns the program registry; CAM and IV Prep writebacks remain off because canonical endpoints are unavailable.

## Implementation

New roots are `apps/priq-api`, `apps/priq-web`, `packages/mir-core`, `packages/mir-providers`, `packages/mir-queue`, `packages/mir-telemetry`, `config/priq`, `tests/priq`, and `infra/priq/migrations`. Root support changes are `.gitignore`, `.env.example`, `package.json`, `package-lock.json`, and `tsconfig.json`. No unrelated application was edited.

MIR provides capability-based model routing, provider-neutral contracts, policy preflight, budget ledger, global kill switch, structured-output validation, model-run hashes/usage/cost/latency metadata, an OpenAI Responses adapter, fail-closed Anthropic/local-worker contracts, a test-only deterministic provider, queue, and tenant audit ledger. OpenAI requests use `store:false`, strict `text.format` JSON schema, explicit reasoning effort, timeout, and a safety identifier. Raw prompts/outputs are not written to audit/model-run metadata.

PRIQ provides real Ezechiel/Brookdale/Conrad identifiers, source and intake manifests, claim/evidence lifecycle, founder review and student publication gates, feature switches, student projection, Copilot cue governor, debrief guard, integration contracts, local loopback API, and the locked Today/Students/Programs/Live Copilot/Live Profile Lab plus Control Panel surface. It displays “DR. BRIAN’S ASSESSMENT, PROFILE & RECOMMENDATIONS” but keeps the assessment blank while gates are closed.

## Database, auth, intake, and privacy

The un-applied candidate `infra/priq/migrations/20260802095500_priq_foundation.sql` creates an isolated `priq` schema with subjects, memberships, sources, evidence-bound claims, feature flags, model runs, and append-only audit events. RLS is enabled everywhere; policies are tenant/role scoped, contain no `USING (true)`, and revoke audit update/delete. It was not applied because no canonical PRIQ DB was authorized.

The local server requires explicit `PRIQ_DEV_AUTH=true` and loopback binding. Production OIDC/session, signed media, durable persistence, malware scanning, CSRF/rate limits, secrets management, and deletion jobs remain open. Intake validates manifest metadata—name, class, filename, MIME, bytes, SHA-256, subject, consent, retention—but never stores bytes. No Ezechiel private packet was located or copied. Public-personal data is excluded by default; student-provided, founder-private, MissionMed-intel, and PHI data require explicit provider approval.

## Sources and identity

The in-app browser verified that One Brooklyn Health identifies Conrad Fischer, MD, with Brookdale Hospital Medical Center and Kaplan identifies Dr. Conrad Fischer as a medical educator, Program Director and Vice-Chair at Brookdale. The registry contains four available metadata records across three source types plus a pending audiovisual record. No copyrighted page body or media bytes were committed. Audiovisual processing is not proven.

## Provider, cost, and real-AI status

`MIR_OPENAI_API_KEY` is required. Only a generic `OPENAI_API_KEY` was present and was deliberately ignored because it is not scoped MIR authority. `MIR_OPENAI_RESTRICTED_DATA_APPROVED=true` is a separate required record of the approved no-training/ZDR posture. Optional future variables are `MIR_ANTHROPIC_API_KEY`, `MIR_LOCAL_WORKER_URL`, `MIR_SEARCH_API_KEY`, and `MIR_DATABASE_URL`.

No real provider call was made: real cost $0.00 and no real-model latency exists. Official text pricing verified on 2026-08-02 is Sol $5/$30, Terra $2.50/$15, Luna $1/$6 per million input/output tokens. Non-text routes stay disabled until their pricing units are modeled. Mock output exists only in tests and is never represented as real AI.

## Verification

`npm run priq:check` passes TypeScript typecheck and 21/21 tests. Tests cover intake, identity/source coverage, evidence IDs, claim transitions, student leakage, StoryForge references, feature gates, Copilot throttling, debrief, queue failure, policy, schema, hashes/metering, restricted data, roles, budget, kill switch, OpenAI Responses shape, tenant audit, RLS lint, API gates, and UI delivery. Latest suite duration was about 240 ms; fake-provider timing is not real-model evidence. An independent verifier has not run.

## Open blockers

1. Authorized Ezechiel packet/consent/retention manifest.
2. Lawfully accessible approved audiovisual source.
3. `MIR_OPENAI_API_KEY`.
4. Recorded restricted-data provider no-training/ZDR approval.
5. Canonical PRIQ DB/storage/auth target in authority indexes.
6. Canonical/released sibling endpoints for RISE, StoryForge annotations, Timeline, IV Prep persona, and CAM observations.
7. Founder review/publication.
8. Independent verification.

## Founder test and rollback

Run `npm run priq:check`. For UI: copy `.env.example` to an ignored `.env`, keep `PRIQ_DEV_AUTH=true`, load it locally, run `npm run priq:start`, and open `http://127.0.0.1:4310`. Inspect `/health`, `/api/research`, and `/api/profile/readiness`; confirm the student report and AI profile remain unavailable. Do not insert credentials or private material without separate authority.

Nothing was deployed/applied. Roll back with normal commit reverts only. Runtime emergency stop is backend `mirEnabled=false` with writebacks disabled. Never delete audit/private data ad hoc.

## Next ticket

`P1-PRIQ-M0-002 — AUTHORIZED EZECHIEL INTAKE + PUBLIC AV + REAL MIR PROOF`: provide canonical DB/storage/auth authority, non-committed Ezechiel manifest, approved audiovisual source, scoped MIR credential, provider approval, and named founder reviewer; run one capped Responses call, seal hashes/model/tokens/cost/latency, obtain founder review, and keep sibling writebacks off absent canonical contracts.

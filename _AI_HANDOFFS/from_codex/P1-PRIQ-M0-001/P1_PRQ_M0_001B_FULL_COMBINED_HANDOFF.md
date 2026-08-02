# P1-PRIQ-M0-001B full combined handoff

Date: 2026-08-02
Worktree: `/Users/brianb/MissionMed_worktrees/P1-PRIQ-M0-001`
Branch: `p1-priq-m0-real-ai-vertical-slice`
Result: COMPLETE for the authorized local recovery foundation.

## Recovery verdict

The wrong green replacement shell is gone. The accepted frozen PRIQ interface is restored as the active and built frontend, with backend-governed recovery adapters that preserve its composition and interactions. The valid local MIR/PRIQ foundation was retained and hardened. This is not a production connection or a completed private-data vertical slice.

STOP before database application, production auth/storage, real Ezechiel materials, student publication, deployment, or scope expansion.

## Frozen prototype and incorrect shell

Authority: `/Users/brianb/MissionMed_OS/_AI_HANDOFFS/from_cowork/P1-PRIQ-003/PRIQ_FINAL_PROTOTYPE.html`
Verified SHA-256: `995bf401bde780192b036cb79507a42570f66be4778a879b47303686a4a8a477`.

`apps/priq-web/public/index.html` and `apps/priq-web/dist/index.html` have the same SHA. The server alters only the response bytes to add CSP nonces and `/priq/bootstrap.js`; source bytes remain standalone and styled under `file://`.

The rejected `index.html`, `styles.css`, and `app.js` were preserved in `P1_PRQ_M0_001B_REJECTED_SHELL_ARCHIVE.md` by hashes and content summary. The old JS/CSS files were removed and the old index was replaced. No part remains active.

## Valid foundation preserved

- MIR request/provider/schema contracts, policy, output validation, routing, cost ledger, kill gate, hashing, queue seam, model-run metadata, and telemetry.
- OpenAI Responses structured-output adapter with scoped credential, `store:false`, timeout, and restricted-data approval gate; test mock remains test-only.
- PRIQ intake-manifest validation, claims/evidence lifecycle, founder review, publication projection, deterministic cues, debrief limitations, local repository, and sibling ownership contracts.
- Route configuration, prompt/schema contracts, strict TypeScript, isolated migration design, environment template, tests, and prior truthful handoffs.

The budget ledger now accepts audited monthly-limit updates. Provider route changes update the live in-memory route table. Cue-gap changes rebuild the deterministic governor. Research, publication, student access, Copilot, human review, kill/release, and control-setting routes fail closed.

## Frontend architecture

The frozen file remains the DOM/CSS/interaction authority. Framework-style mechanical conversion was intentionally avoided because it would create parity risk. Component responsibilities are isolated in server-injected ES modules:

- `bootstrap.js`: state fetch/mount/refresh.
- `api-client.js`: state, flag, setting, audit, and kill API boundary.
- `state-surface.js`: room chips, authority footer, fixture-bound safe preview.
- `modal-component.js`: ten-state centered matrix using the frozen modal primitive.
- `control-panel.js`: backend flags/settings, behavioral gates, interlocks, accessibility semantics, and audit list.
- `recovery.css`: bounded additions using frozen tokens.

`development-fixture.ts` owns authorized development identifiers. `state.ts` owns deterministic backend state resolution.

## Backend and state bindings

`/api/ui-state` returns the local fixture, ten states, flags, control settings, provider health, source coverage, current budget, model-run count, last latency, and explicit authority: local in-memory, production disconnected, migrations unapplied.

| State | Activation and surface |
|---|---|
| FOUNDATION_READY | Installed local foundation; Today |
| CREDENTIAL_BLOCKED | Scoped credential absent; AI surface |
| STUDENT_INTAKE_BLOCKED | Authorized packet absent; Students |
| MEDIA_BLOCKED | Video disabled or audiovisual evidence absent; Profile Lab |
| RESEARCH_IN_PROGRESS | Research job active; Programs |
| FOUNDER_REVIEW_REQUIRED | Founder approval absent; Programs |
| STUDENT_PUBLICATION_DISABLED | Publication flag off; Students |
| AI_KILL_SWITCH_ACTIVE | MIR off; Control Panel/banner |
| DEGRADED_READ_ONLY | MIR off or credential absent; Copilot |
| VERTICAL_SLICE_READY | Every provider, evidence, review, publication, and MIR gate true; Today |

Foundation ready does not mean production ready. Vertical slice ready stays false in the current local state.

## Control Panel proof

The live browser exercised and audited: global student access, Live Copilot, Profile Lab, weighted Birds, public research, video analysis, founder-note AI use, student publication, monthly budget, provider route, cue minimum gap, individual Ezechiel override, preview, emergency kill, and release. Human review is locked on in the UI and rejects a direct disable request with `HUMAN_REVIEW_INTERLOCK`.

Actual behavior changed with the controls: research and Copilot endpoints returned feature-disabled errors, Birds were hidden, Lab/Copilot actions disabled, note AI wording changed, access/publication routes changed gates, monthly runtime budget became 275 during proof, provider route became `openai:gpt-5.6-terra`, and cue gap became 25 seconds. The server was restarted afterward, restoring clean local defaults for founder preview.

## Research and Kaplan

Kaplan URL: `https://www.kaptest.com/blogs/med-educators/author/conrad-fischer-md`.

It was opened only during public-source research to verify the ticket's Conrad Fischer/Brookdale educator-role linkage. No workspace page download, body storage, index, or model call occurred. The source remains `src:kaplan-fischer`, `sourceType: publisher`. Resolution reads stored person-name, Brookdale-affiliation, Internal-Medicine-specialty, and professional-role assertions across at least three sources. Tests prove hostname changes do not change a valid resolution and that titles/hosts without assertions remain ambiguous.

## Private-data review

PASS within the local recovery boundary.

- No private Ezechiel packet, application, statement, recommendation, transcript, note, audio, video, assessment, inferred trait, or profile was found, added, or displayed.
- Static frontend adapters contain no Ezechiel/Conrad/Brookdale strings; fixture values arrive from the backend.
- The student preview contains explicit blocked intake/publication states and no private or inferred content.
- Public sources contain bounded professional metadata/assertions only; Kaplan page bytes are absent.
- `.env.example` contains blanks; no credential was committed. The generic OpenAI key is intentionally ignored.
- Intake validates metadata and stores no bytes. Audit stores control metadata, not source bytes.

## Migration, auth, storage, and database decisions

No migration was applied. The sole proposal is `infra/priq/migrations/20260802095500_priq_foundation.sql`, SHA-256 `706ad56ac63a43da322420c795ed82d8cb8e79da20d3b544f2cdf9df0e14c5e0`. The removed competing Supabase candidate had SHA-256 `558caba9f464aba22bb708fda81747742c117424721425f37b8e7b28b807a138`; it targeted shared public tables and lacked sufficient tenant predicates in multiple policies.

The retained proposal uses an isolated `priq` schema, tenant predicates, role constraints, evidence-bound claims, feature flags, model runs, and append-only audit permissions. It stays design evidence until the founder chooses canonical database, auth/JWT tenant claim, private-object storage/signing/quarantine/retention, backup/restore, migration runner, and independent verifier.

Current auth is loopback development principal only. Current persistence is in-memory. Current storage is absent. Rollback before application is source-only; any future applied migration requires a separately reviewed down migration after traffic disablement and audit export.

## Visual parity

Overall assessed parity: 96%. No critical screen is below 90%.

| Screen | Parity |
|---|---:|
| Today | 98% |
| Students | 97% |
| Programs | 97% |
| Live Copilot | 97% |
| Live Profile Lab | 96% |
| Control Panel | 94% |
| Student preview | 92% |
| Prepare | 99% |
| Four centered modals | 98% |
| Kill/release | 98% |

The complete 1512x982 sequence passed. Six rooms also passed at 1440x900 and 1728x1117. Body size equaled viewport size at every check and remained `overflow:hidden`. Evidence under `evidence/priq-001b/screenshots/` includes the frozen reference, all rooms, Prepare running/completed, evidence/Bird/gameplan/StoryForge dialogs, state matrix, control proofs, kill/release, Ezechiel preview, and built preview.

Critical mismatches: none. Minor differences: authorized truth labels/footer, in-panel recovery controls, external Google Fonts dependency with styled fallbacks, and intentionally sparse student preview because no packet exists. These are accepted recovery differences, not redesigns.

## Build and test results

- `npm run priq:dev`: PASS at 4310.
- `npm run typecheck`: PASS.
- `npm run priq:test`: PASS, 22/22.
- `npm run priq:a11y`: PASS, 46 named buttons, 6 primary navigation controls; live switches named and keyboard-operable.
- `npm run priq:visual`: PASS, frozen SHA and 13 contracts.
- `npm run priq:build`: PASS with exact source hash.
- `npm run priq:preview`: PASS at 4312 with recovery `ready` and local authority visible.
- `git diff --check`: PASS.

Two high-severity direct dependency findings (`form-data`, `ws`) were upgraded to fixed versions. One low-severity Windows-only esbuild development-server advisory remains through current `tsx`; it does not apply to this macOS loopback runtime or use of tsx as a loader.

## Files and rollback

The frozen index replaced the bad shell; two bad assets were removed; six adapters, backend fixture/state, build/a11y/visual scripts, tests, build output, 38 screenshots, and required handoffs were added or updated. Packages/config/contracts/infra and prior A/B work were preserved. No sibling product or external system changed.

Rollback is Git-only: revert the recovery code commit(s) and documentation/evidence commit. No database, auth, storage, provider, or deployed rollback action is required because none was mutated.

## Founder review script

Run `npm ci`, `npm run priq:check`, and `npm run priq:dev`. Review all six rooms, Prepare, the four representative dialogs, State matrix, every governed control, human-review interlock, kill/release, and Ezechiel preview. Then run `npm run priq:preview` and compare 4312 with 4310. Do not add credentials, private data, SQL application, production services, publication, or deployment.

## Commit record

Implementation: `3a4b336` (`feat(priq): restore frozen interface and governed local foundation`). The documentation/evidence commit cannot self-record its own final hash without creating another commit; the final task response is authoritative for that hash.

## Final boundary

Recovery is complete and ready for founder perceptual review. Production integration is blocked by missing canonical DB/auth/storage/provider/private-data authority and requires a new ticket.

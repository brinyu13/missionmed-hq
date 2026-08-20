# D1-TIMELINE-CODEX-FINAL-012A — Live Status

Generated: 2026-08-20T18:49:10Z

Verdict: **PARTIAL / STOP_SAFE**

Production state: **Timeline direct route live; student rollout cannot be certified**

## Release identity

| Layer | Verified identity |
|---|---|
| Source | `5e67978f3706fe3d67cf04c933d122190a1ef89d` |
| Branch | `codex/timeline-rc1-stabilization-001` (origin matches) |
| Static bundle | `timeline-d8814ebb10970b5a` |
| WordPress release | `timeline-wp-ff038960c8959bbc` |
| WordPress payload SHA-256 | `a912818234f230efbfc119b01e5120550af0c97d65b38f0faa83513e6fa497f3` |
| Railway deployment | `c65e49f7-81c9-4dca-a87f-50f9e21a0c1a` |
| Railway image | `sha256:c7bd92a4fe1922e118e73884ba434b6fa96077a59fe0594f4c9adbe737234685` |
| API health release | `timeline-c9eda9eeb7d6cf98` |
| Schema | `d1-timeline-db-500.1` |
| Live URL | `https://missionmedinstitute.com/timeline/` |
| Rollback WordPress release | `timeline-wp-d50e948061818321` |

The Kinsta `current` symlink and release payload were re-read after canary and match the identities above. The rollback directory exists. The active admission option remains enabled at `eligible_360`, with entitlement authority `learndash-course-3893-live-2026-08-04` and consent `d1-500-v1`.

## Verified PASS gates

- Protected D1-409H presentation bytes remain unchanged.
- Canonical denim background, landscape composition, title, year axis, Color Key, profile card, furniture, typography, and event treatment passed the golden-master comparison.
- Local current-source visual similarity: reload `1.0`, PNG `0.9771412`, export-preview crop improved `0.44847222 -> 0.96418017`.
- Advanced Studio current-source Chrome journey: `9/9` interaction groups passed with smooth drag, proportional/free resize, lock/unlock, inline text, multi-select/group/ungroup, group move/resize, library click/drag insertion, transient zoom, undo/redo, and no browser errors.
- Quality Guardian is live, visible, has six explicit sections, blocks export only for blocking findings, and restricts Fix For Me to presentation-safe changes.
- Timeline Rescue service and UI seams are included for PPTX, PDF, and image review; `.key` fails closed with export-to-PPTX/PDF guidance.
- Focused JavaScript regression: `76/76` passed.
- Focused TypeScript/API/Rescue regression: `18/18` passed.
- Typecheck, API-only build, protected hashes, static release check (`63/63` hashes, `24/24` assets), and diff check passed.
- Live direct route loads for the authenticated administrator canary.
- Live Quality Guardian opens and reports a non-blocking layout review without mutating biography.
- Live Advanced Studio library content and object controls are present; a real rectangle add/control/undo sequence completed and returned the document to its prior state.
- Live PNG, Letter PDF, and A4 PDF generation each reached an `Exported` receipt with no captured console error.
- Same immutable payload's PNG, Letter PDF, and A4 PDF were opened locally and visually inspected. Background, texture, typography, furniture, geometry, and labels remained visible without collision.
- Anonymous `/timeline/` is denied with HTTP `303` to the approved member-dashboard login flow.
- Anonymous same-origin document API is denied (`401`); direct Railway document API is fail-closed (`403`); Railway root is `404`.
- Railway `/healthz` returns HTTP `200` with the expected service, release, and schema.
- Homepage, StoryForge, and Arena remain HTTP `200`; unrelated application impact observed: **NONE**.

## Release-blocking live findings

### 1. Matrix entry is not wired to the live Timeline route

The real Matrix round-trip returned to `https://missionmedinstitute.com/member-dashboard/#dashboard`. The visible `Timeline Builder` navigation item opened `#timeline`, but the resulting panel said:

> Timeline Builder is being connected

No launch action to the canonical `/timeline/` route was present. Direct-route availability therefore does not satisfy Matrix discoverability or round-trip acceptance.

### 2. Live media/persistence surface is local-only

After a fresh live re-entry, the application header reported `SAVED LOCALLY`. The Media page reported `LOCAL DEVICE ONLY` and described the visible assets as stored only on the device. The two existing placed assets survived the same-browser reload, but that is not durable cross-device or server-owned persistence proof.

### 3. Fresh production AI CV Smart Fill is not safely testable on this principal

The authenticated canary contains a pre-existing review queue with 31 suggestions from an earlier real CV. The controlling data-preservation law prohibits discarding, accepting, overwriting, or silently resolving that queue. A new synthetic CV was therefore not uploaded into this real principal. The server/provider implementation and focused tests pass, but the required fresh live upload -> AI result -> provenance review -> material prefill journey remains unproven.

### 4. File Vault exact-file ingest is unproven

The live authenticated File Vault picker opened and the production adapter rendered. The current principal had no eligible documents, so exact-file selection, byte handoff, AI ingest, provenance persistence, and cross-session reload could not be demonstrated.

### 5. Live Rescue upload remains unproven

The persisted intake review state prevents reaching the clean upload stage without changing existing student data. Source/API/local tests pass; the live human-equivalent PPTX/PDF/image upload journey remains unproven.

### 6. Downloaded live artifacts could not be opened by automation

The live app generated all three formats and showed export receipts, but the Chrome extension does not expose filesystem paths for blob-backed downloads. Chrome's protected Downloads page is not accessible to automation. The locally generated artifacts from the identical immutable payload were opened and inspected; this is not claimed as opening the live downloaded files.

### 7. Eligible-student and denial-persona post-release canary is incomplete

The available Chrome session is the `brinyu` administrator canary. Anonymous and direct-API denials passed. A separate active eligible student, non-360 student, expired/revoked student, and second eligible student were not re-authenticated against this post-012A release, so student rollout and cross-student isolation cannot be re-certified here.

## Safety decision

The direct Timeline release remains live because no newly observed security bypass, data corruption, blank renderer, or unrelated-application regression requires rollback. Certification is withheld. No Matrix, student data, provider secret, entitlement, or unrelated application was changed during these final checks.

## Exact next actions

1. Matrix owner: replace the `#timeline` placeholder with the approved authenticated `/timeline/` launch and preserve Matrix return routing.
2. Timeline owner: determine why the authenticated canary falls back to local-only persistence/media despite `eligible_360` admission and healthy API; restore remote sync without resolving the existing review queue.
3. Use a clean eligible test identity to run fresh CV Smart Fill, File Vault exact-file ingest, Rescue import, media cross-device persistence, and second-student isolation.
4. Have the Founder or tester open the three downloaded live export artifacts, or provide their saved paths, so live-file visual inspection can be recorded.
5. Re-run only the affected live gates. Do not rebuild or rerun already-green local suites unless the repair changes their code.

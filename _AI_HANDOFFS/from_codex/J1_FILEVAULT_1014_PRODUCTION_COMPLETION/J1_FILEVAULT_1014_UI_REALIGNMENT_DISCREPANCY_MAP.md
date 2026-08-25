# J1-FILEVAULT-1014 Founder UI Realignment Discrepancy Map

Date: 2026-08-25

## Controlling Direction

- **PROVEN FACT:** The production File Vault presentation at the preimage commit was rejected as not derived from the Founder's Canva A-G information architecture.
- **PROVEN FACT:** The controlling composition is `Founder Canva A-G IA + live StoryForge product language + current File Vault V2 engineering`.
- **PROTECTED:** Production stays in `internal` mode with zero beta users until the corrected Student Home and Admin-to-Student Vault are visually accepted and the real enrolled-student workflow passes.

## Discrepancies And Corrections

| Surface | Preimage discrepancy | Corrected presentation | Preserved contract |
|---|---|---|---|
| Student navigation | Correct labels, but undersized dashboard treatment | StoryForge-scale rail with HOME, UPLOAD, YOUR FILES, RECENTLY UPLOADED, MISSION FILES, NOTIFICATIONS, SETTINGS | Existing Matrix route registry and view state |
| Student Home | Generic dashboard-sized question and competing next-action panel | Dominant exact prompt: `What type of document would you like to upload?` | Existing secure upload modal, allowed types, signed upload sequence |
| Upload choices | Seven choices existed without a dominant launcher frame | Seven choices grouped as the primary Home action | Existing server capabilities and storage-ready fail-closed behavior |
| Visual destinations | Four cards reused one generic Matrix image | Four distinct graphical destinations: CV, Timeline, Personal Statement, Shared by MissionMed | Existing document/workspace/library navigation |
| Home summary | Analytics-like `At a glance` framing | Secondary document counts plus most-recent uploaded and reviewed records | Server-returned document metadata remains source of truth |
| Admin landing | Four KPI cards defined the experience | One major Students destination with prominent student search and compact staff actions | Existing bounded roster pagination and staff authorization |
| Selected student | Student scope was present but visually weak | Explicit `Inside [student]'s File Vault` banner and `Back to Students` control | Existing server-selected subject, owner isolation, role capabilities |
| Finder | Existing list/grid/search/filter/sort behavior | Retained as the Your Files workspace | No route, action, or document contract change |

## No-Change Engineering Boundary

- **PROTECTED:** No REST route, Supabase schema, R2 key, signed PUT/GET flow, owner-isolation rule, role capability, audit request, or Matrix registration is changed by this presentation tranche.
- **PROTECTED:** No production activation or broad 360-user rollout is part of this source transaction.
- **DO NOT TOUCH:** The unrelated pre-existing dirty combined handoff remains preserved.

## Hostile Review Repairs

- **PROVEN FACT:** Timeline is now a distinct server-owned `timeline` document type. It no longer aliases the `other`/Miscellaneous type, and it uses the existing default private upload contract without a database migration.
- **PROVEN FACT:** Admin name search now calls the existing server-authorized `/students?search=` endpoint, aborts stale requests, announces results, and pages within the matching result set.
- **PROVEN FACT:** A completed staff-to-student transition now moves keyboard focus to the selected student's Home heading and announces the exact active File Vault through the live region.
- **PROVEN FACT:** The generated destination artwork is force-staged despite the repository-wide PNG ignore rule, and the browser contract verifies that the release source contains the referenced asset.

## Local Validation

- **PROVEN FACT:** Browser, interaction, responsive, accessibility, Matrix-shell, server-search race, and owner-isolation contract: `356/356 PASS`.
- **PROVEN FACT:** PHP/controller contract: `70/70 PASS`.
- **PROVEN FACT:** Repository/security workflow contract: `92/92 PASS`.
- **LIKELY:** Immutable/fallback/runtime-lock checks will return to green after the separately leased immutable asset publication updates the controller and lock manifest.

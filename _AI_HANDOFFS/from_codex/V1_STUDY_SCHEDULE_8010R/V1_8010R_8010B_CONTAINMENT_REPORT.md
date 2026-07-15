# V1-8010R / 8010B Legacy Containment Report

## Status

**PASS for local 8010B containment.**

Darwin's final re-review found no remaining P0/P1 defect, and the corrected
remote validation passed cleanly on PHP 7.4.33 and PHP 8.3.32. This status is
not entitlement, persistence, staging, protected-runtime, deployment, or
production approval.

This is local, default-existing legacy containment only. It is not V1 Plan
persistence, entitlement, staging, release, or production evidence. No
production, database, cache, feature flag, authentication, or learner-data state
was changed.

## Root defects contained

- An administrator using legacy Study create could inherit Calendar's historical
  global-event default.
- Legacy update/delete preflighted no event type and could use Calendar's
  administrator fallback against a numeric ID.
- Partial metadata updates discarded unrelated existing metadata.
- Study responses returned Calendar ownership, meeting, recurrence, source,
  timestamp, priority, and unrestricted metadata fields that the Study UI did
  not consume.
- Client-supplied Calendar fields could not be accepted as Study authority.

## Correction

- Every Study create explicitly sets `audience=private` and
  `event_type=study_block`.
- Study update/delete first fetch an event owned by the current user and require
  `study_block`; foreign owner and foreign type share a non-enumerating 404.
- The shared Calendar mutation receives opt-in internal strict-owner and
  required-type constraints. Administrator fallback is disabled only under that
  scope, and owner plus type remain in the atomic SQL predicate.
- The strict path cannot reassign ownership. Unscoped Calendar behavior remains
  unchanged.
- Partial Study metadata merges into the existing bag, while responses expose
  only `id`, `title`, `subject`, `notes`, `start_at`, `end_at`, `duration`,
  `status`, `completed`, and `category`.
- The rejected timestamp/metadata CAS was removed. No legacy revision or
  concurrency guarantee is claimed; a monotonic Plan revision belongs in 8010D.

## Characterization coverage

- explicit private, historical empty admin default, explicit global, and learner
  audience behavior;
- owned Study mutation, foreign type, foreign owner, and administrator fallback
  denial under strict scope;
- generic administrator and learner Calendar update/delete controls without
  scope flags;
- metadata preservation and response allowlist/privacy;
- owner/Calendar-field/audience mass assignment;
- route registration and its current anonymous-denied/logged-in-allowed
  permission baseline;
- PHP syntax and fixture execution under PHP 7.4 and PHP 8.3.

## Validation evidence

- Temporary do-not-merge draft PR: `https://github.com/brinyu13/missionmed-hq/pull/11`
- Validation branch: `codex/v1-study-schedule-8010b-ci`
- Initial head: `c9b2c900df7da48525f61d98ec129d2298439ea3`
- GitHub Actions run: `29386864474`
- PHP 7.4.33 job `87261852935`: syntax and four fixtures passed.
- PHP 8.3.32 job `87261852960`: syntax and four fixtures passed, with
  ArrayAccess deprecation notices subsequently corrected.
- Final corrected head: `34395ab7466d5a2e4496fe2db6d602f3a12a7f9e`.
- Final GitHub Actions run `29386935391`: success.
- PHP 7.4.33 job `87262054237`: both source files linted and all four
  fixtures passed without PHP warnings.
- PHP 8.3.32 job `87262054251`: both source files linted and all four
  fixtures passed without PHP warnings.
- Local `git diff --check`: pass.

The temporary PR intentionally excludes local 8010A evidence history and must
not be merged. It exists only because MR-079 disallows the equivalent local PHP,
stage, commit, and push commands while the founder ticket requires a safer
validation path.

## Explicitly unresolved

- Legacy `/mmed/v1/study-blocks` remains login-only, not V1-entitled.
- Cookie-authenticated REST nonce behavior is supplied by WordPress core but has
  not been exercised in a real authenticated WordPress harness here.
- No rate control, real database concurrency, timezone/DST browser flow,
  impersonation framework, or pre/post-watermark cutover exists in 8010B.
- Calendar remains legacy storage only and is forbidden as V1 Plan truth.
- 8010C must add fail-closed entitlement/mode/namespace/loader seams while
  hidden; 8010D must prove monotonic revisions and InnoDB persistence.

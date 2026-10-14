# HomeBase Return-only candidate — NOT DEPLOYED

Authority: DR-447, canonical OS e10a39d72fec1c527313b25cf213654d44b4576c.
Production/recovered baseline: e869d63b92f72acd55b2004b035941d72ecbe421.
Candidate branch: codex/mx-gx-homebase-return-20261014.

## Local change

- One native `Return to Matrix` action at the exact Matrix dashboard URL; rail duplicate removed.
- Full mobile label retained; startup-after-shell and lockout avoid duplicate Return controls.
- Return-only busy feedback and unsaved-form discard confirmation; modified/new-tab activation remains native.
- Detached form reset compares all eight persistent forms against their markup defaults, memory-only. No save/API/router/auth changes; no global unload handler or persistence.
- Existing save-triggered rerenders may discard sibling drafts; this pre-existing behavior is unchanged. Mounted drafts are never globally marked clean.

## Verification and limits

- JavaScript syntax, diff whitespace and 15 focused synthetic unit tests PASS.
- Tests cover all eight form selectors, text/textarea/date/checkbox/multiselect, revert, discard cancellation, modified/new-tab activation, pending success/write failure/refresh failure and edits during pending work.
- Synthetic Chromium check could not launch: installed Playwright browser executable is absent. No browser installation or repeat attempt. Real DOM/focus/selection/layout acceptance remains OPEN; unit stubs are not browser proof.
- Genuine student acceptance OPEN. No student session, student data or production write used for testing.
- No generated package/build/deployment, no gateway/build-script/provider/Matrix-shell change.

## Genuine production blocker

Independent reviewer found unchanged gateway pins one bundle manifest/hash while a separate `current` symlink selects the bundle: either activation order permits an intermediate integrity failure. New manifests also omit prior app/CSS aliases, so old HTML crossing cutover can fail. Retained release directories alone do not fix resolution. DR-447 excludes the gateway/generator changes required to prove coherent transitions and retained immutable asset access.

Foreman instructed: no production release or scope expansion; preserve the small independently eligible candidate, normally release custody and report the blocker once. Any subsequent release requires separately authorized static-release coherence/compatibility work and independent transition/rollback proof. No redesign or Wave 2 work.

## Custody

Source-only native PATH LeaseV2: b883ef64-2698-41fb-9239-b946535af1ce, epoch5987, owner codex-homebase-return. Exact four-path scope verified natively; reviewed no-terminal continuous keeper. Final normal release/provider-clear is reported in the owner/Foreman closeout after sealing this source commit; this file does not pre-claim that future result.

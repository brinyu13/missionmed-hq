# Provisional research package, version 1

Authority: DR-373, subject to the permanent IIQ-1202 data-preservation invariant.
This is explicitly **PROVISIONAL_MRX_V1**. A bounded search did not verify an
available canonical MRX implementation. It does not establish that none exists.
If a canonical standard becomes available, reconcile it through a versioned
adapter; preserve old missions and immutable submitted originals.

`server/research-standard.mjs` implements a pure packet builder, JSON download
renderer and strict quarantine validator. It is not mounted in the application.
It performs no network request, database write, paid execution, eligibility
decision, credit award or canonical publication. Existing commands remain intact.

## Input authority and privacy

The future server caller must authenticate the current RISE coverage projection
and the current Admin/360/IV Prep Complete actor. A hash, public receipt reference
or editable `verified` flag cannot establish authority. RISE remains canonical.

The input must bind one canonical program and track to its exact registry release.
All 21 fields in the current 18-domain RISE dossier v2 mapping must be present
exactly once, with an explicit state. Missing fields fail closed. The mapping is
derived from `rise/config/deep-research-dossier-v2.json` v2.0.0, SHA256
`41eb42b243aa8919eef96f12a081f3822c37047668c2349f6087dfb9d0bf37aa`.
This vocabulary defines possible research areas; it does not invent actual gaps.

Coverage must be observed within five minutes. UNKNOWN, STALE, CONFLICTED and WEAK
fields become requested areas; SUPPORTED fields do not. A program with no gaps
does not get an unnecessary mission. Future reuse must match the coverage digest,
program, release and policy version, not merely the program name.

The package contains only explicit public identity, status map, timestamps and
an opaque public receipt label/hash. Private user IDs, internal receipt paths,
student stories, credentials and premium evidence are not projected. The packet
digest detects mismatches; it is not a signature. JSON downloads are plain text.

## Upload contract

The packet includes complete instructions and an output template. The researcher
chooses the strongest appropriate currently available research configuration and
declares provider/model/configuration. No model name is permanently prescribed.
These declarations remain unverified. Templates have `permitted_use: false` and
empty execution metadata so an untouched template cannot qualify for review.

Upload limits: 128,000 UTF-8 bytes, 18 nesting levels, 6,000 nodes, 100 sources,
200 claims and 30,000 total claim-text characters. Duplicate JSON keys, unsafe
prototype keys, unknown fields, malformed dates, invalid Unicode, wrong mission
bindings, expired missions, unrequested facts and invalid citation references
fail closed. Packages must finish after mission issuance and within seven days.

Every requested field has exactly one result: SUPPORTED, UNKNOWN, CONFLICTED or
STALE. UNKNOWN requires an explanation and no fabricated claims. Other states
require cited claims. CONFLICTED retains at least two distinct alternatives with
different cited sources; this is a structural minimum, not semantic verification.
Claims retain field identity, confidence, source references and optional as-of
date. Sources retain public HTTPS URL, title, type and retrieval time.

**Every result remains quarantined**, even when `eligibleForReview` is true.
`factsVerified` and `executionVerified` are always false here. URLs are syntax
checked without fetching or DNS resolution. Independent source retrieval, redirects,
DNS/SSRF safeguards, factual accuracy, citation entailment, actual freshness,
duplicate/corroborating/conflicting corpus comparison, policy/consent review and
governed canonical RISE promotion remain mandatory separate steps. An instruction
pattern check is defense in depth, not proof against every prompt injection.

## Required integration boundaries

Future command wiring must retain each exact original, contributor, mission,
timestamp and digest before review; repairs append new linked versions. No
existing package is rewritten. The legacy report-publication seam must not
publish these factual packages. Use the independently reviewed canonical RISE
claim pipeline and preserve provenance, conflict, supersession and retraction.

Admin contributions use the administrator's own identity; preview never borrows
a real student's private state. Protected access is independent of contribution.
Credit requires separate trusted execution/review and mission-bound replay-safe
policy. UI copy/download/upload, authenticated coverage, persistence and production
acceptance are subsequent work; passing these offline tests does not prove them.

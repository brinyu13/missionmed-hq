# Codex Sol profile mapping handoff — 2026-10-04

Base `033a21ac391dcab2be0a198a7b1aed658776dbc9`; exact-path commit `edcb775a1a160a163891060841c8d5333c138163`. I changed only `presentation-field-privacy.js`, `board-renderer.js`, and the new `d1-026-profile-completeness.test.mjs` under `packages/mission-timeline`. The two source preimages were SHA-256 `1ac1002368d400d9e3885d372c5a0673e2f8971981e68985db9fcfae3b2e1171` and `bb6eb7ace5751aff1615a57eaed66ca69f2716eb3742864ed982be03777a5622`. Committed hashes are `7a2146a4bb6000f8ae1e4ca7f6c082ed9b0e97fee7d2bae7b0c4aab5196aa982`, `799d2c5c9bccd7fb8fa8b679cd906bd9bfbd3a32408cba74e415273082bcb416`, and `bf0690358a5da472d8a040970c269182ac65a72dc2817efb9d143e7d7edaa5fe`, respectively.

The profile projection now retains the supplied AAMC display alias, EMR, languages, hobbies, USCE and research summaries, Step 2 CS, and explicit degree/work-authorization Other details with field and source privacy enforced. If either populated AAMC alias is denied, both aliases are suppressed to prevent fallback disclosure. Orphaned Other details are suppressed. The scene presents `Other: detail` only when its base selection and detail are visible. It does not infer missing facts or mutate the source.

Derived USCE/research months now use visible validated source spans, exact YYYY-MM endpoints, and inclusive union months. Overlap counts once. Private, unknown, coarse, reversed, milestone, and open-ended spans do not create totals. Authored summaries remain separate and take precedence only for displayed wording.

Focused tests: 39/39 passed across the new completeness test, presentation privacy, education template mapping, and keynote renderer. Parent-owned profile builder integration test passed 3/3 read-only. `git diff --check` passed for the three scoped paths. Full-suite and visual export acceptance remain with parent integration; all four earlier visuals were rejected. I did not edit UI, call providers, deploy, or touch parent-owned dirty files.


# Codex Sol duration handoff — 2026-10-04

Base `003f1647d17f670f72805926a7c91e69daf56f11`; exact-path commit `d5e6d99e1b99d468bab3df1b84fc83b25759e5c7`. Only `packages/mission-timeline/web/js/uxr-002/board-renderer.js` and `packages/mission-timeline/tests/d1-026-profile-completeness.test.mjs` changed. Their base SHA-256 hashes were `799d2c5c9bccd7fb8fa8b679cd906bd9bfbd3a32408cba74e415273082bcb416` and `bf0690358a5da472d8a040970c269182ac65a72dc2817efb9d143e7d7edaa5fe`; committed hashes are `0b068638502da835d73be3df6b87ccf65ff65d920a0a2c9df51f2fa6fa46140a` and `6466b3e5c9f7a176fb2bf3871bdf7d4b37288161465048673e96519ddfe7748a`.

Derived clinical/research month scalars are now `null` when that visible category has no duration or any duration with coarse/unknown date precision, missing exact month, open-ended status, or reversed endpoints. A fully exact visible history retains the inclusive union-month count, so overlapping months count once. Private spans are removed by audience filtering before aggregation; their uncertainty cannot poison a public total. Authored summaries remain separate and continue to render with their original wording.

Focused profile, presentation privacy, education mapping, and profile builder tests passed 30/30; `git diff --check` passed for both scoped paths. The independent duration challenge was run in memory with only its evidence-file writes disabled: exact overlap 4 months; exact plus YEAR, SEASON, or ongoing returned `null` with no fallback row; exact plus private stayed 2 months; every source document remained unchanged. Its reversed-date case remains an export gate failure, with the invalid event omitted before aggregation. Invalid events omitted by existing validation are outside the visible-category total and remain subject to the existing export completeness gate.

No UI, provider, deployment, or visual acceptance work was performed. Parent-owned dirty documentation was untouched.

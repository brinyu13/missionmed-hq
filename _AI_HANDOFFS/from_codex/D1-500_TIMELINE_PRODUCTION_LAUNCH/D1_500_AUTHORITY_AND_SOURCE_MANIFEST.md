# D1-500 Authority and Source Manifest

- Governing authority: MissionMed Platform Constitution Revision 3, current
  Engineering OS, MR-079, DR-016, DR-017, and DR-018.
- Canonical repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Accepted base: `49ba56dacd2cddfc2fb2241839d54a03e85bc271`.
- Sealed source: `b668cc4d3eaa8075a357d35a60456fcaaaffa18c`.
- Branch: `codex/d1-timeline-production-500`.
- Draft review: `https://github.com/brinyu13/missionmed-hq/pull/21`.
- Protected presentation: D1-409H-A1.
- Protected active JavaScript SHA-256:
  `ca9a28688e7dd29f0e008b58efae85555af860b8150fa9493165faf851165bb8`.
- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-c228658bc70bc395`.
- Static release-manifest SHA-256:
  `11284009e537b9eee790c9f3e90b41a59f615595ca3bd501b3ab613f4275854a`.
- WordPress runtime SHA-256:
  `c6f34f86e72bead2feaf2c725c22736c3e2d06e53b9cf232112ee45e4bfe6abc`.

Two clean release builds were byte-identical. Ignored binary assets were copied
only after verification against the accepted D1-413 asset manifest. Personal
sample-photo fixtures were excluded. The accepted presentation files were not
redesigned.

Live entitlement authority was verified directly on 2026-08-04: LearnDash post
`3893`, “Mission Residency: 360 Match Mentorship Student Dashboard & Guidance
Hub,” is published, uses Closed enrollment, and has course-level access
expiration disabled. Active LearnDash access to that exact course is the student
eligibility signal; WordPress login or role alone is insufficient.

Critical Systems reconciliation completed read-only on 2026-08-04. USCE live
SHA-256 `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c`
and Arena live SHA-256
`7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705`
are byte-identical between private origin, public CDN, and their retained
deployment/source evidence. The active central manifest is stale and its
central `LIVE/` sources are out of sync; no unauthorized live drift was found.

Matrix recovery source is immutable, remotely reachable commit
`60e7169b544e6c93eb41f0de9717d8e61d2d49d0`. An official guard run from a
disposable archive of that commit passed all ten local/source, origin, and
public hashes. No Matrix override or production copy is required. Exact
findings and the unapplied bounded amendment are in
`D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md`.

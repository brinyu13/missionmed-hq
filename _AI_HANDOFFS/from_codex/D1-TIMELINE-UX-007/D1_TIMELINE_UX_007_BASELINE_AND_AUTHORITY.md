# D1 Timeline UX-007 — Baseline and Authority

Generated: 2026-08-10T15:02:29Z

## Authority and custody

- Commission: D1-TIMELINE-UX-007, bounded to Timeline-owned editor, CV intelligence, File Vault source integration, verification, and Timeline-only release.
- Worktree: `/Users/brianb/MissionMed_worktrees/TIMELINE-RC1-STABILIZATION-001`.
- Branch: `codex/timeline-rc1-stabilization-001`.
- Candidate commit: `bdb5beced707687ab450ba4a73dc12e94dbd87bb`, pushed to origin.
- Frozen production baseline source before UX-007: `d784ab086fd7b7547fccc623a51cffefe810dac3`.
- Accepted private visual-asset source: commit `49ba56dacd2cddfc2fb2241839d54a03e85bc271`; it was consumed read-only and its unrelated dirty files were not touched.
- Protected D1-409H files remain byte exact: HTML `bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24`, CSS `4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7`, JS `ed46fdf21588554aaaadbeaebacd81321177d45ad357c7e8cb8570a20786cb32`.

## Current live baseline

- URL: `https://missionmedinstitute.com/timeline/`.
- WordPress pointer verified read-only over the accepted Kinsta SSH target: `releases/timeline-wp-ed84301a63d1ed11`.
- Timeline SSO plugin SHA-256: `e29b713e2c8aac0a6fcfa71818a01e8a00e35b8c73eed6d6059ec4833b3e8ba5`.
- Railway production status: online; current deployment reported by the authenticated CLI is `8e0385ce-972c-41af-a81b-43c609ee668f`.
- Existing rollback target: WordPress `timeline-wp-05a4b831501cfc59`; provider backup `TIMELINE-RC1-EDITOR-UX-004-PRE-20260808T161951Z`; scoped Kinsta snapshot `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260808T170309Z-export-save-hotfix`.

No production state was changed by UX-007 at this checkpoint.

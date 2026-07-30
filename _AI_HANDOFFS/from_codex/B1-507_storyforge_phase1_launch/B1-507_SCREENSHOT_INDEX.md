# B1-507 Screenshot Index

All screenshots were captured through the authenticated desktop browser. They
contain no keys, passwords, cookies, tokens, or private story text. Because the
raw captures include browser chrome and some contain account/service context,
the screenshot directory remains local-only and is intentionally excluded from
Git custody. It is not evidence safe for external distribution.

| # | UTC | File | System | Rung | What it proves | Criterion | Custody |
|---:|---|---|---|---|---|---|---|
| 1 | 2026-07-30T04:23:07Z | `screenshots/001-live-storyforge-voice-disabled-before.png` | Live StoryForge | Existing text pilot | Founder-authenticated V5 text shell is live and voice-disabled | Dormant baseline | Local-only; browser chrome |
| 2 | 2026-07-30T04:23:18Z | `screenshots/002-railway-production-baseline-one-replica.png` | Railway | Existing text pilot | Correct project, API/PostgreSQL online, one API replica, B1-503 deployment | Topology/B17 | Local-only; service context |
| 3 | 2026-07-30T04:23:41Z | `screenshots/003-cloudflare-r2-no-storyforge-bucket-before.png` | Cloudflare R2 | Pre-rung 0 | No StoryForge bucket exists; unrelated buckets untouched | B07 | Excluded; account and unrelated bucket context |
| 4 | 2026-07-30T04:23:57Z | `screenshots/004-openai-personal-org-data-controls-before.png` | OpenAI | Pre-rung 0 | No scoped StoryForge project/key is established; data controls inspected | B09 | Local-only; organization context |
| 5 | 2026-07-30T04:24:11Z | `screenshots/005-github-branch-before-custody.png` | GitHub | Local candidate | Remote branch predates the B1-507 commits and had no custody PR | B01 | Local-only; browser chrome |
| 6 | 2026-07-30T04:25:11Z | `screenshots/006-kinsta-daily-backup-baseline.png` | MyKinsta | Existing text pilot | Original capture showed the available automatic-backup baseline | B17 | Excluded; account/site context and later safe-crop attempt invalid |
| 7 | 2026-07-30T05:48:01Z | `screenshots/007-live-storyforge-dormant-founder-home-after.png` | Live StoryForge | Rung 0 after cutover | Exact B1-507 Founder-authenticated home shell is live; no voice or microphone UI is exposed | Founder text smoke / B18 force-off | Local-only; SHA-256 `662a667cad902c1efcf6b2986b6fb2c909901f7c09c11abede45ce942ad2c06d`; Founder label and browser chrome, no story text or secret |

The committed handoffs rely on sanitized CLI/read-only receipts instead of
these images. Screenshot 7 is the retained post-cutover visual proof; it remains
excluded from Git and `MANIFEST.sha256` because it contains account context.
The authenticated accessibility-tree smoke additionally covered Library,
Interview Prep, Notifications, Settings, Quick Capture, and one question
workshop without writing production story data.

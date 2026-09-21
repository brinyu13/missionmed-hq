# Live capture provenance

- Capture UTC: `2026-09-21T13:28:44Z`
- WordPress post: `4216` (`rank-list-engine`, published)
- Embed: Elementor HTML widget / `post_content` iframe
- Live iframe URL: `https://missionmedinstitute.com/wp-content/uploads/2026/03/rank_list_engine_WORKING.html`
- Exact live bytes: `1808811`
- Exact live SHA-256: `f00a07d1943d53f471a0597c4d1f54b7c696cc0aa73074e4efa8c245b13011d9`
- Exact bytes in Git: **no** (credential-bearing public artifact)
- Private provider backup: `/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z`
- Private backup directory mode: `0700`; files: `0600`; `SHA256SUMS` verified
- Git-safe base: `rank_list_engine.LIVE_20260921T132844Z.sanitized.html`
- Git-safe base bytes: `1808955`
- Git-safe base SHA-256: `1766f21de2bfbffe2d5e70e999757fad6be38dd572ff5081a21550b6224756ec`
- Security delta: every plaintext developer-unlock occurrence was removed from executable code, changelog text, and rollback filenames; all three executable client-side checks fail closed
- Historical reference blob: `8f5e953b9b50b4fd3b96d8b5bf8bbcb8351f6f5f`
- Historical reference bytes: `1801836`
- Historical reference SHA-256: `0b484a052c0f8979053ad2425b5b63a6efdc45eebfde33b842dad476edd41183`
- Relationship: live is newer and differs from the historical reference; the live HTTP `Last-Modified` value is `2026-03-04T18:41:01Z`.

The live artifact scan found no service-role key, Stripe secret key, AWS access
key, or private-key block. It did find the two developer unlock values noted
above. The only email-like strings were a MissionMed support-domain address and
an example-domain placeholder; no student email address was found.

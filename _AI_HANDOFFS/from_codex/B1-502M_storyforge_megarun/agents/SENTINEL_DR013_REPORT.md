# Sentinel DR-013 Exact-Tree Review

Recorded: 2026-07-27T21:12:35Z

Decision: **GO — guarded commit/push and feature-off deployment gates only**

## Stop-the-line finding and repair

The first exact-tree review returned NO-GO because the WordPress runtime loader
did not reject every symlinked release hop. In particular, a symlinked
`releases` directory or a selected 40-hex release directory chained to another
valid 40-hex directory could satisfy the earlier final-realpath checks.

No staging, commit, push, or deployment occurred under that NO-GO.

The corrected loader now rejects:

- a symlinked runtime root;
- a symlinked releases root;
- any `current` readlink other than exact `releases/<40hex>`;
- a symlinked selected release directory;
- a selected release outside the canonical direct-child path;
- any `current` realpath different from the exact selected directory;
- a symlinked or hash/size-mismatched `release.php`.

The runtime regression uses a second valid 40-hex release directory, proves
that the formerly acceptable chained hop fails closed, and proves that exact
physical restoration returns the loader to `OK`.

## Independent verification

- runtime symlink regression: PASS;
- full unit suite: 27/27;
- PHP lint: PASS;
- exact 14-file WordPress manifest check: PASS;
- `git diff --check`: PASS;
- Supervisor evidence: existing browser suite 7/7, PostgreSQL authorization
  PASS, deterministic build and syntax checks PASS, secret scan PASS, npm audit
  clean, Wrangler dry-run PASS.

## Boundary

No remaining DR-013 source blocker was found. The protected Matrix and legacy
StoryForge assets remain out of scope and unchanged. The sibling private
14-file release remains immutable evidence only.

This decision permits guarded staging, source commit/push, and feature-off
Kinsta validation. It does not authorize founder enablement, general student or
mentor access, or a production-complete claim.

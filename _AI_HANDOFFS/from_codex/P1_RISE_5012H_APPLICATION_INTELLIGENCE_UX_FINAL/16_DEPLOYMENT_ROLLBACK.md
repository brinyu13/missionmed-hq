# Deployment and Rollback

Final production readback:

- Web deployment `40755723-76d6-4c6e-8849-ceab446bd737` — SUCCESS.
- Worker deployment `eb4b1e4f-8f3e-4730-a112-ec88205c556c` — SUCCESS.
- Build `rise_web_95a20056f0ac`.
- Asset manifest SHA-256 `8f880ded88f636ad0fa1d2dbb84423afb51cb6a0aa412c0402ebb237994cdf10`.
- Health reports production, active registry, current source rights, durable production Postgres, global off, students off, kill switch on.

Immediate code rollback reference is `d44c6e8` with the prior healthy application release; P1-RISE-5010 baseline `87baae48626c49873c35ed387b79229782144525` remains the auth/runtime safety reference. Database migrations 013 and 014 are additive; rollback disables the feature with the existing router switches and redeploys the prior application/worker commit rather than dropping live schema.

Two deployment preflights failed closed on stale manifest/build stamps while the prior healthy release continued serving. A mistaken worker-root deployment was also identified and replaced before execution resumed. These recoveries caused no canonical rollback or unrelated product mutation.

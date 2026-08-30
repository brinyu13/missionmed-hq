# SOAP Deployment Report

No production deployment occurred. Current isolated RISE app rollback deployment is `b0301470-ec0a-4e03-9340-2b06fda4befb`. Current production database preimage has migration 005 only; migrations 006/007 are absent.

Blocking gates:

1. independent database/security review of migration 007;
2. final non-builder release approval bound to the candidate hashes;
3. a new exact shared-HQ deployment decision because the current HQ deployment lacks the RISE audience/entitlement code and DR-147 does not authorize HQ deployment.


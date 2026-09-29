# Zelle Administrator-Confirmation Rollback

## Recovery points

- Fresh MyKinsta manual backup: `Pre Zelle Update`, September 29, 2026 11:33 AM ET; expires October 13; restore control visible.
- Final replay-hardening preimage: `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-ZELLE-REPLAY-HARDEN-20260929T2145Z/missionmed-mr-zelle-verifier.php.preimage`
- Final replay-hardening preimage SHA-256: `15c7b51cf59d44a8205fc655da8fa3ea22aa6dd0a840f55c2540f1d72ab96418`
- Immediate source preimage: `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-ZELLE-ADMIN-PIVOT-20260929T210730Z/missionmed-mr-zelle-verifier.php.preimage`
- Preimage SHA-256: `60aa59768c50b80e393c8f9da6bb7beb6038407fe2674b1ae86169c136f6d0d2`
- Earlier full Zelle preimage: `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-ZELLE-20260929T1648Z`
- Contrast preimage: `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-ZELLE-CONTRAST-20260929/missionmed-mr-zelle-verifier.php.preimage`

## Scoped rollback

1. Set both scoped Mission Residency Zelle enable options to `no` to stop new Zelle checkout exposure without affecting card commerce.
2. Restore the exact verifier preimage only if the runtime itself is unhealthy.
3. Restore or remove the QR only together with the verifier version that references it.
4. Flush application/page caches and verify card checkout remains available.
5. Do not roll back or rewrite orders, payments, notes, audit records or entitlements as part of a source rollback.

Runtime rollback is not source rollback. The provider mode may be changed back to `automated_email_match` only after the authoritative financial-email source is restored and focused acceptance passes.

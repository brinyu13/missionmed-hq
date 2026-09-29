# Zelle Rollback and Containment

## CSS/source rollback

- Pre-fix live verifier SHA-256: `c19fa165a31975779511df25fa5e1c1aae2bd59968718469556930e449f41403`
- Current live verifier SHA-256: `60aa59768c50b80e393c8f9da6bb7beb6038407fe2674b1ae86169c136f6d0d2`
- Exact server preimage: `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-ZELLE-CONTRAST-20260929/missionmed-mr-zelle-verifier.php.preimage`
- Current source commit: `a860765556b025c14177d7044fbf2bf5948b4a6d`

The contrast patch can be reverted by restoring the exact preimage or reverting only commit `a860765`. That rollback would affect presentation only; it must not rewrite order/payment evidence.

## Financial containment

Do not roll back or delete the truthful #9193 audit trail. The real transfer is enrollment-pending and must be reconciled through the banking/Zelle surface. Current safe state:

- order on hold and unpaid;
- no candidate fingerprint;
- no transaction ID;
- no course or Matrix entitlement;
- scheduled retries fail closed;
- positive admin activation remains unavailable without a genuine candidate.

## Cleanup boundary

Account/order cleanup is intentionally deferred until the real transfer is either received and accepted or expires/is returned through the authorized financial process. Disabling the customer or erasing the order now would make reconciliation harder and could discard required audit evidence. No public `$1` price or public bypass exists to remove.

The two scoped public Zelle enable options were `yes` before this failed gate and are now `no`. Do not re-enable either option as a generic rollback. Re-enablement requires resolution of the recipient enrollment/destination issue and completion of the positive production acceptance lifecycle.

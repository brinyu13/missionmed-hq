# Mission Residency private financial backend (Phase 1)

Authority: DR-379 / MR-FINANCIAL-ACCOUNTS-PHASE1. This module is not wired into student routes, charging, notifications, invoices or provider dispatch. Existing ExamPrep and Partner Cost Sharing behavior is preserved.

Existing `source_artifact`, `import_run` and immutable `audit_event` supply shared provenance. Financial subjects represent accepted program agreements, independently of the course-access TTL projection. A verified WP reference identifies each certified subject; no student account or entitlement is provisioned. Verified prior MA binding metadata is retained in agreement provenance, but no runtime binding is invented. All financial rows remain private and collection-disabled, with six held subjects represented only by reconciliation cases.

Agreements are immutable/versioned. Obligations allow deposit, tuition, installment and authorized fee components with agreement caps and exact/unknown due-date precision. This import creates principal/fee summary obligations because no current installment due dates are certified. Remaining balances derive from applications/adjustments; positive balance is not due-now certification. Refund adjustments may consume only unapplied available funds; application reversal/refund execution requires a separately reviewed future append-only action.

`api_record_verified_financial_payment` is the single atomic settlement path: explicit server finance membership/capability, certified beneficiary, canonical provider namespace, global receipt/evidence ownership, applications, credit and immutable audit. Tables are forced-RLS and have no anonymous/student grants; service-role direct financial writes are revoked. There is no generic WordPress admin mapping. Explicit principal grants are separate from the migration and must be exact-authority-bound.

The sealed importer verifies ledger, crosswalk and certification-evidence hashes; checks the 11/6 partition, receipt authentication/beneficiary, integer-cent components, credits and student-specific arithmetic. No real student dataset is checked in. A staging principal must be bound to the exact normalized bundle digest. A retry with changed input fails; an exact retry returns duplicate without new rows.

Local authoritative rehearsal:

```sh
python3 -B missionaccounts/scripts/test-mission-residency-finance.py \
  --evidence-dir /private/phase1-evidence \
  --sealed-dir /private/sealed-phase0c \
  --phase0b-dir /private/sealed-phase0b
node --test missionaccounts/tests/mission-residency-finance.test.mjs
```

The rehearsal uses a socket-only disposable local PostgreSQL cluster, current applied schema (excluding the explicitly retired Partner candidate and one fixture-dependent historical promotion), minimal storage fixtures, exact real sealed input and separate private diagnostics. It reproduces totals from canonical tables, checks held/visibility/dispatch boundaries, exact import/receipt retry, namespace/cross-subject replay, application/refund caps, immutable artifact provenance and denied roles. Expected totals exist only as acceptance assertions, never as financial records or balance calculations.

Production staging requires independent exact-source review, provider target/recovery/preimage and maintained lease custody. Stage schema and the sealed eleven agreements/21 verified receipts plus six held cases only; read back aggregate and per-subject arithmetic. Leave student visibility, Pay Now, invoice/charge/email dispatch OFF. No UI/Railway deployment is needed for this isolated database foundation. Future student publication, identity binding, permissions, due-date certification and collection are separate release gates.

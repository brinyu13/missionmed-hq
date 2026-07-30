# B1-507 Reconciliation Dry-run Receipt

Status: NOT RUN; CONFIGURATION MUST REMAIN `off`.

The current code has unresolved FABLE-C1 through C4 and, if a monitored one-replica invariant cannot be locked, PROBE-C5. Dry-run also writes a control marker and therefore is not treated as read-only.

No production object listing, marker write, candidate selection, deletion, or audit occurred.

Reconciliation may move to `dry_run` only after the bounded Fable ruling is returned and implemented, operator visibility exists, orphan attribution/fairness/coordination pass, R2 is real, and a fresh rollback point exists.

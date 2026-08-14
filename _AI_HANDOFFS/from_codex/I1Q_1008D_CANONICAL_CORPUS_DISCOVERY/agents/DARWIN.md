# Darwin — safe discovery implementation

Verdict: **implementation pass**.

Hash-based Message Authentication Code is abbreviated as HMAC below.

Built the zero-retention runtime probe with exact host/route/method allowlists, bounded
requests, redirect/MIME/size/encoding/status/schema rejection, two-pass list stability,
canonical artifact derivation, structural/hash receipts, local reconciliation, atomic output,
and safe error classes.

Supervisor hardening added per-run HMAC aliases, payload/source identity binding including
nested wrappers, strict non-derivable-identifier rejection, trusted-derived-location fallback
that never follows malformed metadata, three-surface set reconciliation, and timestamp
coverage. No live call was made by Darwin.

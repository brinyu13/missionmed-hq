# Turing — adversarial testing

Verdict: **RELEASE**.

Hash-based Message Authentication Code is abbreviated as HMAC below.

The fixture-only suite passes 6/6 with zero live network. It covers route/method confinement,
zero-network dry-run, malicious redirects, MIME/size/shape failures, output containment,
symlink rejection, raw canaries, HMAC unlinkability, byte duplicates, canonical derivation,
top-level and nested identity mismatch, and non-derivable identifier paths.

Turing found two substantive defects during development: deterministic aliases were
dictionary-attackable, and nested wrapper identity could bypass binding. Both were repaired
and independently rerun before the final live receipt.

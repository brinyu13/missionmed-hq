# V1-8010A Decision 14 — Matrix Runtime Lock and Protected Delivery

**Status:** ACCEPTED; CONTROLLER DRIFT NORMALIZED 2026-07-15

## Corrected runtime evidence

The global Matrix runtime lock **does** govern the active fingerprinted Student
OS bundle through asset key `student_os_js`:

| Field | Value |
|---|---|
| Source path | `assets/student-os.js` |
| Production/runtime path | `assets/student-os.646e3598d284fff3.js` |
| Approved SHA-256 | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` |

Contrary V1-8000 statements are superseded by this decision. The authenticated
administrator route `/member-dashboard/#study` is verified as the legacy
Calendar-backed view, not V1. Eligible-learner behavior remains unverified.

The initial guard was green for every declared public JS/CSS asset and identified
only `class_mmed_student_os_php`: the former descriptor was `c0a538…` while
recovered, origin, and observed runtime bytes were `23da5c…`.

That drift is now normalized. A fresh Kinsta rollback copy and a private local
evidence bundle were created, the global descriptor was updated to the proven
`23da5c…` baseline under Brian's explicit authority, and a full source/origin/
public preflight passes without an override. See
`V1_8010A_RUNTIME_LOCK_NORMALIZATION.md`.

## Protected protocol

Before a protected implementation or deployment:

1. enumerate exact controller, loader, JS, CSS, REST/bootstrap, and entitlement
   asset keys under the current founder authorization;
2. verify source/origin/public hashes and archive current bytes;
3. register V1 route/assets and rollback-reader descriptors;
4. make source changes only in the canonical branch;
5. build immutable content-hashed artifacts;
6. run the guard and protected compatibility suite before and after staging;
7. deploy the exact manifest digest; verify public hashes and rollback package.

Protected surfaces include runtime manifests, Student OS controller/bundle,
plugin bootstrap/shared REST or MU entitlement code if touched, and every new V1
loader/controller/asset once registered. Direct unguarded deployment is
forbidden. MissionMed_OS remains read-only.

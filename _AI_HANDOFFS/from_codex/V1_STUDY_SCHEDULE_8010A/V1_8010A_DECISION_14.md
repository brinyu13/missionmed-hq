# V1-8010A Decision 14 — Matrix Runtime Lock and Protected Delivery

**Status:** ACCEPTED; CONTROLLER DRIFT MUST BE NORMALIZED BEFORE PROTECTED EDIT

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

The guard is green for every declared public JS/CSS asset and exits `42` only
because `class_mmed_student_os_php` is approved at `c0a538…` while recovered,
origin, and observed runtime bytes are `23da5c…`. This provenance drift must be
normalized with a fresh backup and descriptor update before any protected V1
controller edit.

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

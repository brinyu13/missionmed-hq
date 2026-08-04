# D1-500 Known Limitations and Follow-ups

## Resolved release authority

The former delegated Matrix runtime-lock blocker is closed. Founder-authorized governing commit `9e02238b195c548b10b5343a33bd247b5de0cee4` binds all ten protected assets to immutable source commit `60e7169b544e6c93eb41f0de9717d8e61d2d49d0` and exact live delivery. The official guard passed with zero mismatch, warning, or override. Overall result is PASS.

## Non-blocking documentation

- The accepted A1 JavaScript adaptation references `D1-411A_PROTECTED_HASH_MANIFEST.json`, which is absent. Add the exact accepted adapter transition manifest in the next authority-maintenance release.
- The operational versioned Matrix adapter URLs serve the sealed current bytes. The unused bare asset URL still serves an older long-lived cached object; it is not injected by the current route. A future cache-maintenance action may remove it, but it is not a launch blocker.
- The real active-360 account had a blank Full name, so its export button was profile-incomplete. Export passed through a separate authorized eligible-student fixture that used the same production authorization and export path.
- JWT TTL is intentionally short at 120 seconds. Expiry changes the app to read-only and preserves local work; a valid-session reload re-enters. A future release may add silent refresh only if separately authorized and tested.
- The controlled real-student pilot record remains associated with the approved test account unless the Founder asks for deletion through the normal product flow. No synthetic account or entitlement residue remains.

## Founder action required

None for Version 1 release closure. Future Version 2 product evolution follows the normal MissionMed accepted-baseline, implementation, local-verification, deployment-gate, and authorized release workflow.

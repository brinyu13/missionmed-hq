# D1-500 Known Limitations and Follow-ups

## Blocking authority item

The delegated Matrix runtime-lock manifest carried in the D1-500 branch predates later documented Matrix/StoryForge deployments. Five approved hashes do not match current live/source bytes. Later D9 Matrix recovery evidence identifies those live bytes—including Student OS `646e3598...`—as accepted, and the real Matrix journey passed, but D1-500 is not authorized to rewrite that delegated lock or suppress its gate. Required action: approve a Matrix-owned metadata-only amendment that pins the documented current source/origin/public hashes and names the immutable recovery commit/tree. Until then the overall program result remains PARTIAL even though Timeline is live.

## Non-blocking documentation

- The accepted A1 JavaScript adaptation references `D1-411A_PROTECTED_HASH_MANIFEST.json`, which is absent. Add the exact accepted adapter transition manifest in the next authority-maintenance release.
- The operational versioned Matrix adapter URLs serve the sealed current bytes. The unused bare asset URL still serves an older long-lived cached object; it is not injected by the current route. A future cache-maintenance action may remove it, but it is not a launch blocker.
- The real active-360 account had a blank Full name, so its export button was profile-incomplete. Export passed through a separate authorized eligible-student fixture that used the same production authorization and export path.
- JWT TTL is intentionally short at 120 seconds. Expiry changes the app to read-only and preserves local work; a valid-session reload re-enters. A future release may add silent refresh only if separately authorized and tested.
- The controlled real-student pilot record remains associated with the approved test account unless the Founder asks for deletion through the normal product flow. No synthetic account or entitlement residue remains.

## Founder action required

One consolidated action: authorize the Matrix owner to reconcile `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json` to the already documented later Matrix baseline, without changing live production. After amendment, rerun all ten local/origin/public checks and require zero mismatch. Expected Founder time: under two minutes to approve the exact metadata-only record. Risk of waiting: D1-500 remains PARTIAL in governance records. Risk of proceeding without it: a false claim that the delegated protection gate is green.

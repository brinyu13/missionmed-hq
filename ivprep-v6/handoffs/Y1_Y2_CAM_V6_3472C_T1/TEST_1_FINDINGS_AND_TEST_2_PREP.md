# Test #1 Findings and Test #2 Preparation

## Verified live Test #1 evidence

- The exact Dr Kelly LemonSlice agent appeared through the hosted LiveKit path.
- The avatar produced audible speech after the Founder spoke.
- The browser and provider path ended without an automatic retry or replacement session.
- The visible media interval was shorter than 45 seconds because the authoritative 45-second deadline began before browser media readiness. DevTools showed LiveKit connected at `2026-08-16T14:43:33.520Z` and a user-initiated abort/disconnect at `2026-08-16T14:44:20.793Z`; media tracks arrived after connection, accounting for the approximately 39-second visible interval.

## Bounded Test #2 corrections

- Dr Kelly now sends exactly one natural opening instruction only after exact-avatar video/audio readiness and controller `ACTIVE` confirmation. No retry, reconnect, recreation, or automatic paid start was added.
- The avatar video uses `object-fit: contain` with centered native composition so the full provider frame remains visible without cropping or distortion.
- The room clock now uses the provider's authoritative start and deadline, displays the correct 45-second limit, and reports whether deadline cleanup was confirmed or failed closed.

## Closed gates

- Test #2 is not authorized or started by this correction.
- No provider session or LemonSlice credit is consumed by implementation or validation.
- Test #2 still requires a separate Founder authorization and explicit Start action.

## Validation

- Full syntax/analytics check: PASS (`28` analytics modules).
- Full repository test matrix: `314` total, `314` pass, `0` fail, `0` skipped.
- Validation used no provider endpoint and consumed no LemonSlice credit.

## Custody

- Product lease: `457d11d2-78c1-4fcc-8f39-9a8f52fdff78`, fencing epoch `49`.
- Candidate binding: `467c21902b19a1359ea78ce9ae1161281828ab85f771177c6ab46916b0ca5f01`.
- Nonce evidence is retained only as SHA-256: `9e356412b16926d45f145a84a1aa348d7b18085ac34691d2a43b0c8bd142f78c`.
- The keeper remained live throughout editing and validation and must remain live through commit, non-force push, and post-push verification before release.

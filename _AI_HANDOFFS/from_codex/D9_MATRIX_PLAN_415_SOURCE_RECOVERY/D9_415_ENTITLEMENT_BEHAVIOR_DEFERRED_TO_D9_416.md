# D9-415 Entitlement Behavior Deferred to D9-416

## What changed

The former locked controller `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` is the Y1-CAM-4004/pre-change byte. The current production controller `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` is the Y1-CAM-4005 byte. Wave 1 established that Y1-CAM-4005 changes entitlement evaluation by adding authority-mode validation, requiring `revocation_checked`, and accepting a LearnDash-current-access authority mode. The exact source diff is preserved in D9-415 provenance evidence.

## Why D9-415 preserves it

`D9-415-FOUNDATION-002` explicitly identifies `23da5c...` as the intended current observed production baseline for source-recovery purposes. D9-415 therefore preserves the byte that is actually running, while retaining `c0a538...` outside the active runtime path as historical and rollback evidence.

## Why preservation is not approval

Source recovery records runtime truth; it does not approve product or security behavior. The founder decision expressly does not approve, ratify, validate, or normalize Y1-CAM-4005 entitlement behavior. D9-415 will not fix, revert, reinterpret, or otherwise change controller entitlement logic, Access Gate logic, authentication, HMAC handoff, Supabase session behavior, LearnDash entitlement behavior, roles, flags, or production routing.

## What D9-416 must decide

D9-416 must independently adjudicate entitlement behavior, authority-mode validation, `revocation_checked` semantics, LearnDash-current-access semantics, authentication consequences, authorization consequences, and compatibility with the final Matrix Plan access contract. D9-360 remains the product, UI, UX, visual, and interaction authority.

## What D9-420 must not assume

D9-420 must not treat the recovered byte, the observed-baseline commit, the tag, the safe source head, or the draft pull request as approval to deploy or as proof that entitlement/authentication behavior is correct. D9-420 remains blocked, G-D9-4 remains open, and D9-416 is mandatory before implementation or release.

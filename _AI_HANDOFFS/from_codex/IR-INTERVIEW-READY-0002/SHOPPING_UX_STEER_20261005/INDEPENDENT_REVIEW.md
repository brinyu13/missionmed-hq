# Independent shopping UI patch review — 2026-10-05

**BLOCK exact patch pending one bounded comparison-selector correction. No production/deployment authorization.** Independent reviewer `/root/native_stage_diagnostics`, separate from shopping builder. Read-only review of `shopping.patch` SHA-256 `f0f24d7bc6f5e326e810cd26a2ee8166fc07f4cce1e6b5a3e42f95250f7edd38` and focused test SHA-256 `7aa31d549dff86f9e4d99251c2ca49b2156b5d0ee112dba66db8d3bdf91cf33c`, against immutable BASE `e82c03ec4d487ce5d6031189f68a9913a52ddcd7` and Founder steer sections 1–9. Root supplied focused VM PASS. No patch application, build, provider/query/live browser or product source write.

## Concrete finding

**[P2] Choosing Product 2 first silently moves it to Product 1; choosing Product 1 afterward loses the first choice.** `shoppingReplace(slot,id)` assigns `shoppingCompareIds[slot]=id` then immediately compacts with `.filter(Boolean)`. From reset, choosing webcam in the second labeled selector yields `[webcam]`, occupying the first slot. The binding refresh retains focus on the second selector, now blank. Choosing microphone in Product 1 then replaces webcam, yielding `[microphone]`; the two distinct choices never form a comparison. This is a normal order of interaction with two separately labeled controls and violates their explicit slot meanings.

A bounded read-only in-memory exercise of the frozen patch/test harness confirms `shoppingReplace(1,"online:webcam:0")` returns true with state `["online:webcam:0"]`; next `shoppingReplace(0,"online:mic:0")` returns true with state `["online:mic:0"]`. Preserve two stable slots (or render/control compact selection consistently), count only selected values and safely derive the matrix when both are present. Add the focused Product-2-first → Product-1 fixture, plus clear/remove of either slot. Existing tests start from card selection or slot 0 and do not cover this order. No engine or account change is needed.

## Accepted source boundaries

Patch touches only completion.js/completion.css/phase1.js/phase1.css. The inspected JS adds transient comparison IDs without persistent storage/network/account endpoint changes, retains canonical saved-kit keys and Save bindings, and leaves the existing route/motion/experts/phase1 engines after the shopping segment unchanged. Main cards retain three canonical tier ordering; long analyses and alternatives use native details without open. Comparison includes catalog and existing alternatives with duplicate/two-selection denial, explicit replacement/remove/reset and side-by-side fields. Difference labels conservatively indicate SAME/TRADEOFF/N/A and mark subjective values as MissionMed assessments rather than invented winners.

New shopping links enforce HTTPS/no credentials, escape URLs through existing external(), and escape dynamic labels/copy. Existing amazonUrl retains missionmatch-20 attribution. No new live price/rating/count/Prime/deal claims or unqualified images/badges were added. Production image default-deny remains authoritative; approved image/credit paths are retained and unavailable imagery is truthfully linked through the compact source-photo fallback. This does not satisfy the complete Founder photo/provider hydration outcome; authorized live source integration remains separate.

## Relevant limits

Source confirms scoped online spacing, three-column desktop grid, smaller shopping rows and existing reduced-motion rules. VM/CSS source assertions do not prove actual equal collapsed card heights, credit fit, mobile layout, keyboard/screen-reader announcements/focus or first-viewport composition. Browser acceptance remains required after separately admitted SOURCE integration. Existing frozen catalog/media are the reviewed trust boundary; this patch does not qualify a new Admin catalog/provider schema or arbitrary future data.

The extra read-only VM exercise initially had a quoting SyntaxError in reviewer-generated evaluation code; corrected evaluation then confirmed the finding. No source/artifact was altered. Only this report was written. **STOP for builder's bounded selector fix and fresh exact-byte review; no deployment or live acceptance.**

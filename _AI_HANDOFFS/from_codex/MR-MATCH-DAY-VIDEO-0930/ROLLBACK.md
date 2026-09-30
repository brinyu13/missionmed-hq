# Match Day media-only rollback

Target: the accepted human-proof page, source `87ce78801b1cb879261526f88ed2306c95a0f78b`, evidence baseline `b6490e47f2593504a57432b3f48ab2a9617bc2ca`.

Fresh server custody: `/www/theresidencyacademy_209/private/mr-match-day-video-0930/`. The deployment script refuses an existing custody directory and refuses any mismatch in the three live preimages or any unexpected existing new file.

Before restoration, acquire and heartbeat the same eight-path Lease V2 claim. Compare current runtime hashes against `qa/deployment.json`; stop if a later writer changed them. Restore only `page.php`, `alternate.css`, and `alternate.js` from `preimage/`, with atomic rename and original permissions. Restore the page first so no visitor can initialize the new component during rollback. The five new component/config/vendor files may be moved into this release's private custody instead of deleted. Never delete the immutable master or alter other Stream assets.

Purge the affected page/edge cache and verify the canonical page has no new video control, old asset hashes match, and the legacy redirect still preserves UTM parameters. No database restore, order/refund/payment change, entitlement change, route change, homepage write or broad source reset is part of rollback.

Provider recovery readback on September 30: MissionMed Live manual backup September 29, 2026 8:35 PM; note `Pre premium hero release 2026-09-29`; expires October 13, 2026 8:35 PM; restore control visible. Daily September 29, 1:06 PM also visible, 14-day retention. Times are provider UI labels. No backup was created/deleted/renamed/restored. This broad backup predates later page work and is not the surgical rollback target; the fresh file preimages are.

The new public video has recording-specific Founder authorization. Rolling back the page does not revoke that permission. Do not delete the Stream object merely to restore the previous page.

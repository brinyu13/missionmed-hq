# MISSION RESIDENCY MATCH DAY VIDEO = LIVE

September 30, 2026. Live page: https://missionmedinstitute.com/missionresidency/.

The authentic recording is now available from **Watch the moment it became real** in the existing Match Day/community section. The montage remains the initial visual. The hero and all other accepted sections are unchanged. This is a live release with the explicitly listed verification limitations below, not a blanket accessibility/device certification.

## Authority and source

Founder answered the exact-recording permission question: **“Yes, we have permission, Founder authorized, deploy now.”** The scope includes the complete recording, identifiable participant appearances/voices and music. `PUBLICATION_AUTHORITY.md` records Founder attestation tied to the master hash; it does not claim independent inspection of signed releases.

- Authority/recovery filing: `6426e41b4dc893d4a80c29947a392039fc406642`, pushed and exact remote readback passed.
- **Deployed source: `7cfbb9c4f91de50719eb024ea6683a7faa423365`**, normal push and exact remote readback passed.
- Prepared player implementation: `b6246fcede519d577d73921ffc93acb166488368`.
- Worktree: `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed`.
- Branch: `codex/mr-primary-promotion`.
- Universal and MR-WEB-0912 BOOT passed against authoritative HQ `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; OS `3c0a351` was current on normal pull. No OS repair or authority weakening.
- Lease provider and pending registry queue were clear before deployment. Exact eight-path Lease V2 epoch **3859** was granted, heartbeated and released; provider-native release readback passed. Supabase was used only for this coordination lease and read-only provider checks, not application data.

## Exact master and delivery

Original preserved unchanged: `/Users/brianb/MissionMed/Happy Match Cut.mov`.

Private immutable copy: `/Users/brianb/.codex/media-custody/mr-match-day-0930/Happy Match Cut.master.mov`.

Both SHA256: `6ca321397fabd28d69c5e98a621c7b5d4fa7705f99d93a60daff2a5fc79d1398`.

Master is 384,082,340 bytes: QuickTime MOV; Apple ProRes 422 Proxy 10-bit 4:2:2; 960 x 540, 16:9, nominal 24 fps, 6,396 frames; video 266.480 seconds. Original audio is PCM 16-bit stereo 44.1 kHz, 248.871 seconds; the subsequent picture/end-card tail was preserved. No rotation or fast-start in the original. Original audio measured mean -8 dB, peak 0 dB. Authentic visuals were inspected; subjective listening quality is not independently certified.

**Existing Cloudflare Stream** was selected because it was provisioned, operational and within its existing storage allowance. No vendor, plan, subscription, account-wide security rule, or unrelated media was changed. Upload used the normal native macOS file picker after the extension upload helper could not read local files. No browser permission change was needed.

- Stream UID: **`4ddaf43647395dcc1ca0cda6f17b7ee6`**.
- Provider name: Mission Residency - Authentic Match Day Celebration.
- Provider received exactly 384,082,340 bytes, input 960 x 540.
- Ready at **2026-09-30 15:20:32 UTC**, `readyToStream=true`, state `ready`, processing 100%, no processing error.
- Provider duration: **266.5 seconds**. Browser final HLS duration normalized to 266.526438 seconds.
- HLS: https://customer-wiw9vmb43wmdkdp7.cloudflarestream.com/4ddaf43647395dcc1ca0cda6f17b7ee6/manifest/video.m3u8
- Adaptive H.264/AAC, 24 fps: 852x480, 640x360, 426x240. Top rendition advertised ~401,580 average / 577,894 peak bits per second. No upscale.
- Embedding restricted to `missionmedinstitute.com` and `www.missionmedinstitute.com`. This specifically authorized marketing asset is unsigned/public; unrelated signed media is unchanged.

The separately prepared private H.264/AAC MP4 is 19,209,320 bytes, 960x540, fast-start, SHA256 `5ceb46d3e31c2337039df51971d787ebb11b962b58c53a7b52f00a275dc29ac7`. It remains a local compatibility/QA derivative, not the public delivery file. Stream was uploaded from the original master.

## Player and live acceptance

Native dialog and native video controls; existing `media/montage-1702.webp` poster; same-origin pinned HLS.js 1.7.3 loaded only after a click when native HLS is unavailable. Close stops playback/downloads, destroys the HLS instance, removes the video, releases scroll lock and returns focus. No YouTube navigation, auto-preview or initial autoplay.

| Live check | Result |
|---|---|
| Initial video payload, manifests and HLS dependency | **0 requests / 0 bytes**, all five widths |
| Initial video element | Absent until intentional activation |
| 1440 / 1366 / 1024 / 430 / 390 | PASS: 16:9 player, native controls, real video/audio decoding, no overflow |
| Actual full recording | Reached ending at 266.526438 seconds; explicitly accelerated 16x/muted timeline test |
| Audio availability | PASS technically: unmuted, volume 1, nonzero decoded AAC bytes on all widths; not a subjective listening certification |
| Play/pause | PASS: native keyboard Space paused playback |
| Seeking | PASS: actual Stream player reached 25 seconds while paused |
| Keyboard/modal | PASS: Enter opens, focus enters dialog, Escape from video closes, focus returns, no remaining video/audio source |
| Replay | PASS: opens cleanly; events do not duplicate within page session |
| Close button | PASS: same cleanup pathway |
| Reduced motion | PASS: transition 0s, animation none, surrounding parallax scroll; user-initiated video only |
| Contrast | PASS: play/close 16.31:1; title 18.13:1; body 14.96:1 |
| Touch targets | Play and close >=48px high |
| Console/network | No captured page errors; actual Stream requests 200/206. Aborted requests occurred on intentional close; no playback failure |
| Fullscreen | **UNVERIFIED**, not PASS: native control and enabled API present; automated requests returned `not granted`, and native foreground attempts were interrupted by concurrent Chrome activity |

Responsive checks are real Chrome desktop viewport tests, not physical iPhone/Safari certification. Screenshots were visually inspected at 1440 and 390. New text passes measured AA contrast; absent verified captions mean this is **not** a full WCAG AA conformance claim.

## Performance comparison

Same production URL, 100% zoom, 900px viewport height, buffered browser observers. Lab samples with normal network/cache variation; not field Core Web Vitals or a claimed speed improvement.

| Width | Before LCP | After LCP | Before CLS | After CLS | Page height before/after | Initial video bytes |
|---|---:|---:|---:|---:|---:|---:|
| 1440 | 2724 ms | 1180 ms | 0 | 0 | 10949 / 10949 | 0 |
| 1366 | 1120 ms | 1084 ms | 0 | 0 | 10949 / 10949 | 0 |
| 1024 | 1324 ms | 1036 ms | 0 | 0 | 11158 / 11158 | 0 |
| 430 | 1100 ms | 1100 ms | 0 | 0 | 16682 / 16682 | 0 |
| 390 | 1176 ms | 976 ms | 0 | 0 | 17482 / 17482 | 0 |

No material regression observed. Video remains outside the initial loading path and is not the LCP asset. Total page length did not increase.

## Captions and analytics

No verified caption track was available. The local ASR draft contains errors and remains private; it was not published or substituted for verified speech. Accurate human-reviewed captions remain deferred.

Existing analytics reused. All five `match_day_video_start`, `_25`, `_50`, `_75`, `_complete` events emitted exactly once; reopening/replaying did not duplicate them. Quartiles use watched time, not seek position. Live Google Analytics collector returned **204** for 25/50/75/complete, measurement ID `G-B4B4E26HMW`. Start was confirmed in dataLayer; its network response was not retained because the browser event buffer rolled over. No GA4 reporting-dashboard ingestion claim is made.

## Production preservation and rollback

Exactly eight runtime files were installed beneath `wp-content/mu-plugins/missionmed-mr-alternate-assets/`: `page.php`, `alternate.css`, `alternate.js`, `match-day-player.php`, `match-day-media.json`, `vendor/hls-1.7.3.min.js`, `vendor/HLS-LICENSE`, `vendor/HLS-PROVENANCE.md`.

The page change is solely the component include in the existing montage section. Removing that include reproduces the prior accepted page byte-for-byte. Prior CSS is retained with scoped additions. All `missionmed-mr*.php` runtime plugin hashes outside this directory were captured before/after and remained identical.

Cookie-free public HTTP verification passed: canonical route 200; actual CSS/JS/vendor response hashes exactly match committed bytes; both program product routes 200; current $549 card / $499 Zelle Bootcamp and $3,099 early / $3,499 standard Complete, $3,400 plan total, October dates and February support remain present. This is read-only commerce preservation, **not** a new transaction test.

Legacy route remains **301** to `/missionresidency/`, preserving the exact Facebook UTM query. No routing, SEO, pricing, checkout, payment, order, account, entitlement, main homepage or USCE change.

Cache purge used existing `wp kinsta cache purge --site` (page and edge). It reported **“Success: Site Cache has been cleared.”** The WP-CLI process exited 255 with pre-existing plugin translation notices; success is additionally supported by fresh unparameterized public HTML and exact new asset hashes. No unrelated plugin repair was attempted.

Fresh file preimages and candidate are at `/www/theresidencyacademy_209/private/mr-match-day-video-0930/`. `qa/deployment.json` records exact old/new hashes and absent-file ledger. Restore only the three prior page/CSS/JS files under a fresh same-path lease; archive new files if needed; purge and recheck. Do not restore a database. Full procedure: `ROLLBACK.md`.

Provider recovery remained available: Sep 29, 2026 8:35 PM manual backup, `Pre premium hero release 2026-09-29`, expires Oct 13, 2026 8:35 PM, restore available. No backup mutation. The fresh file copies, not the broad earlier backup, are the precise rollback target.

## STATE DELTA and evidence

- New provider object: one authorized public Stream recording, domain-restricted embedding.
- Runtime: eight scoped files, three replacements and five additions; no other plugin hash changed.
- Coordination: one exact-path lease acquired/heartbeated/released; no Supabase application mutation.
- Source: prepared player resumed, real Stream configuration enabled, permission and evidence filed by normal commits/push.
- Browser QA changes were transient only; viewport and reduced-motion overrides reset, player closed, no payment submitted.
- Shared root and older dirty MR worktree remained untouched. No reset, stash, cleanup, force-push or unrelated staging.

Evidence: `qa/stream-provider.json`, `qa/deployment.json`, `qa/live-before.json`, `qa/live-acceptance.json`, `qa/live-http.json`, plus the original local checks. Repeatable scripts: `gate-tests.mjs`, `deploy.mjs`, `verify-live.mjs`.

Visual evidence (private local PNGs): `qa/live-poster-player-control.png`, `qa/live-1440-player.png`, `qa/live-390-player.png`.

Remaining limitations: fullscreen transition unverified in this automated/foreground-contended session; accurate captions deferred; physical iOS/Safari and subjective audio listening not certified. These are explicit, not mislabeled PASS. No payment/commerce follow-on or further design task was started.

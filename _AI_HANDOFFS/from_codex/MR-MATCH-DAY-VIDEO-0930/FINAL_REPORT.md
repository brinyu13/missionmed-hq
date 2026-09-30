# MISSION RESIDENCY MATCH DAY VIDEO = TECHNICALLY READY / PUBLICATION HELD FOR AUTHORITY

September 30, 2026. This is a **private, tested implementation**, not a production release claim. The accepted human-proof page remains live and unchanged at https://missionmedinstitute.com/missionresidency/.

## Exact remaining human decision

Public marketing authorization has not been established for the **complete supplied recording, identifiable participants, spoken audio and any music** in `Happy Match Cut.mov`, SHA256 `6ca321397fabd28d69c5e98a621c7b5d4fa7705f99d93a60daff2a5fc79d1398`.

The scoped records establish existing individual testimonial publication and still-montage use, but do not establish clearance for this exact full video/audio. The previous quote bank explicitly distinguishes publication-record verification from new creative consent clearance. The media directive requires this gate independently of prior still usage. A confirmation request was sent to Founder; no answer was received during preparation.

**Needed:** a MissionMed record covering public use of this full recording, or Founder confirmation that MissionMed has that permission, including participant appearances/voices and any music. No technical media work is requested from Founder.

No master/derivative was uploaded, no public video object was created, no production player was deployed, and no payment/account/entitlement state changed.

## Master inspection and custody

Original: `/Users/brianb/MissionMed/Happy Match Cut.mov` (untouched).

Private preserved copy: `/Users/brianb/.codex/media-custody/mr-match-day-0930/Happy Match Cut.master.mov`.

Both SHA256 values match the exact hash above. Private custody directory is mode 0700. Master, audio samples, draft transcript and derived video remain outside Git.

| Property | Verified value |
|---|---|
| Container | QuickTime MOV, `qt` |
| Video | Apple ProRes 422 Proxy, 10-bit 4:2:2, progressive BT.709 |
| Dimensions / aspect | 960 x 540, square pixels, 16:9; no upscale |
| Frame rate / count | Nominal 24 fps; original average ~24.0024 fps; 6,396 frames |
| Video duration | 266.480 seconds (4:26.48) |
| Audio | PCM signed 16-bit LE, 44.1 kHz, stereo |
| Audio duration | 248.871 seconds; original picture continues ~17.6 seconds after audio ends |
| Bitrate | Video ~10.174 Mbps; audio 1.411 Mbps; container ~11.531 Mbps |
| Size | 384,082,340 bytes |
| Rotation | No rotation tag or display-matrix side data reported |
| Original fast-start | NO: `mdat` at byte 28; `moov` at byte 384,050,566 |
| Visual inspection | Authentic video-call celebration footage, participant/chat panels and existing end card; no new/generated visuals |
| Audio assessment | Nonzero original audio; mean -8.0 dB, peak 0.0 dB. Local AAC decoding verified. Subjective listening quality was not verified by this agent |

The original silent picture tail/end card was preserved rather than accidentally truncating it with `-shortest`.

## Hosting and private derivative

**Selected publication provider: existing Cloudflare Stream.** Current dashboard showed 40 stored videos, 2,028/4,000 storage minutes and an available upload workflow. No new vendor, plan or subscription was created. Existing R2 bucket/CDN was also confirmed, but Stream satisfies the requested priority. The earlier visible failed R2 master upload was not modified.

Stream delivery subdomain: `customer-wiw9vmb43wmdkdp7.cloudflarestream.com`. **New asset UID/delivery identity: NOT CREATED while authority is held.** Never substitute the fixture's all-zero UID for a real asset.

A private compatibility/QA derivative was generated before Stream availability was confirmed:

- `/Users/brianb/.codex/media-custody/mr-match-day-0930/match-day-540p.mp4`
- H.264 High / yuv420p, 960 x 540, 24 fps; AAC-LC stereo 44.1 kHz ~160 kbps.
- 266.500 seconds; identical 6,396 video-frame count; 0.020-second container/frame-grid normalization, no content edit.
- 19,209,320 bytes, approximately **95% smaller** than the master; total ~577 kbps.
- Fast-start verified: `moov` at byte 32, before `mdat` at 193,924.
- SHA256 `5ceb46d3e31c2337039df51971d787ebb11b962b58c53a7b52f00a275dc29ac7`.
- Private local HLS segments generated from this derivative for real browser decoding tests. They are not Cloudflare-produced renditions or public objects.

## Player implementation

Existing montage, headline, copy and parallax remain intact. The sole page-template change is a component include in the existing Match Day section. All other page-template bytes match the accepted source exactly.

Candidate adds “Watch the moment it became real,” opening a native `<dialog>` with a 16:9 native `<video>` and existing montage poster. No video element, HLS manifest, segment or playback dependency exists before the click. `preload="none"`, native controls and `playsinline` are set. Close destroys HLS, pauses/removes the source, releases scroll lock and returns focus.

An initial iframe approach was rejected during QA because Escape failed when focus was inside the frame. The final native-control implementation passed Escape **from the video itself**. Safari/native-HLS browsers use their own HLS support; others load a pinned, same-origin HLS.js 1.7.3 dependency only after clicking. This follows [Cloudflare's own-player HLS delivery interface](https://developers.cloudflare.com/stream/viewing-videos/using-own-player/). Package integrity, exact vendored hash and license are recorded in `vendor/HLS-PROVENANCE.md` and `HLS-LICENSE`.

`match-day-media.json` is deliberately **disabled**, with no UID and no authority record. It validates exact master hash, strict boolean enablement, provider, UID format and nonempty authority record. Eight publication-gate tests pass. The local fixture substitutes a private HLS URL and explicitly non-public test authority without changing production config.

## Private browser acceptance — not live acceptance

Real supplied-footage HLS decoding, native controls and the actual candidate page were tested in Chrome. No mocked media/player API is used in the final test. The fixture's only provider substitution is loopback HLS instead of the not-yet-created Stream object.

| Width | Initial video requests / bytes | Overflow | Keyboard + close + focus | Decoded video/audio | Page height before / after |
|---|---|---|---|---|---|
| 1440 | 0 / 0 | 0 | PASS | PASS | 10,949 / 10,949 |
| 1366 | 0 / 0 | 0 | PASS | PASS | 10,949 / 10,949 |
| 1024 | 0 / 0 | 0 | PASS | PASS | 11,158 / 11,158 |
| 430 | 0 / 0 | 0 | PASS | PASS | 16,682 / 16,682 |
| 390 | 0 / 0 | 0 | PASS | PASS | 17,482 / 17,482 |

Player stays 16:9 with no horizontal overflow, controls >=48px for play/close, meaningful accessible names, dialog labeling and visible focus ring. Pause, seek to 25 seconds, sound-enabled decoding, Escape, close-button cleanup and replay passed. The entire 266.5-second timeline reached `ended` during an explicitly accelerated 16x, muted test; no stalled final tail. This accelerated run verifies decoding/timeline/events, not subjective viewing or listening quality.

**Fullscreen remains UNVERIFIED:** Chrome's automation context returned `not granted`; the native fullscreen control did not enter fullscreen either. No custom disabling is implemented. Recheck the actual Stream-backed player in the final live browser, rather than relabeling this as PASS.

New text contrast is white/near-white on solid navy: primary button ~16.31:1, heading ~18.13:1, body ~14.96:1. All exceed AA. Reduced-motion test: transition 0s, animation none, surrounding parallax scroll. No new automatic motion. This is not a blanket WCAG certification; captions remain unresolved below.

## Performance comparison

Warm/local Chrome lab samples, identical 900px viewport height. These are **not public production Core Web Vitals** and do not claim a speed improvement.

| Width | Before LCP | Candidate LCP | Before CLS | Candidate CLS |
|---|---:|---:|---:|---:|
| 1440 | 288ms | 96ms | 0 | 0 |
| 1366 | 188ms | 124ms | 0 | 0 |
| 1024 | 212ms | 104ms | 0 | 0 |
| 430 | 152ms | 88ms | 0 | 0 |
| 390 | 132ms | 84ms | 0 | 0 |

Video and HLS-library initial transfer: **0 bytes**, all widths. No material local regression observed; exact Stream/CDN startup, production before/after LCP/CLS and native-device acceptance remain release checks after clearance/upload.

## Captions and analytics

Local MacWhisper transcription used an already-installed on-device model. Draft VTT is private and explicitly `UNVERIFIED-transcript.vtt`. It contains obvious recognition errors; no uncertain captions were published or treated as verified quotes. No recording was sent to an external transcription service. Captions require corrected, verified text before any caption track is activated.

Existing analytics pathway reused. Local dataLayer observed exactly one each of start, 25, 50, 75 and complete; reopening/replaying did not duplicate them. Quartiles use played time ranges rather than seek position. Live collector acceptance is pending deployment; local event emission is not reported as GA4 ingestion proof.

## Live preservation, BOOT and rollback

- Universal and MR-WEB-0912 BOOT passed against HQ `0feee579b0a9f2c90529220899f6cf6d21b8cd05`. MissionMed OS normally fast-forwarded to `3c0a351`, preserving its unrelated local changes; no governance repair or weakened validator.
- Anonymous HTTP readback: canonical page **200**, existing montage/human-proof content present, **no new video play control**.
- Live CSS SHA256 remains `fd26071d894ded34780b007e34dfce5d0cca98a41533e6110f8357549ab1a70c`; live JS remains `f269f59fb75ea9f3240611dafa6cd3e822164f47f5d236ed958c4af4d27fb176`. Both match the prior accepted source.
- Legacy URL **301** to `/missionresidency/`, preserving the tested Facebook UTM query exactly.
- Previous live source remains `87ce78801b1cb879261526f88ed2306c95a0f78b`, evidence HEAD baseline `b6490e47f2593504a57432b3f48ab2a9617bc2ca`.
- No new deployment, cache purge, production lease or production mutation occurred. No commerce, prices, account, order, payment, entitlement, homepage, USCE, routing or SEO changes.
- Recovery target remains the currently serving human-proof release. Before a later deployment: refresh provider recovery gate and exact per-file preimages, acquire the exact-path lease, hash-guard against concurrent changes, deploy only the media component/asset paths, then purge and run live acceptance. Do not reuse stale preimages or restore the database.

## Candidate custody and STATE DELTA

Worktree: `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed`.
Branch: `codex/mr-primary-promotion`.

Prepared (NOT deployed) candidate source commit: `b6246fcede519d577d73921ffc93acb166488368`.

Candidate source paths only: `page.php`, appended `alternate.css`, appended `alternate.js`, new `match-day-player.php`, disabled `match-day-media.json`, pinned HLS vendor library/license/provenance beneath `wp-content/mu-plugins/missionmed-mr-alternate-assets/`.

Private custody contains original copy, optimized MP4, local HLS, inspection contact sheet, audio inspection samples and unverified local transcript. None is committed/uploaded. Raw screenshot evidence remains local only. Existing dirty shared-root and older MR worktree files were not edited, staged, stashed, reset or committed.

Evidence in this directory:

- `inspect.mjs`: file/atom/hash inspection and anonymous current-production preservation readback.
- `gate-tests.mjs`: eight strict publication-gate checks.
- `preview.php`, `preview-server.mjs`: loopback-only candidate/baseline fixture; no WordPress/accounts/payment writes.
- `qa/media-inspection.json`, `qa/preservation.json`.
- `qa/publication-gates.json`, `qa/local-responsive.json`, `qa/local-decoded-playback.json`, `qa/local-playback-accessibility.json`.
- `qa/local-1440-player.png`, `qa/local-390-player.png`: private candidate evidence, NOT live screenshots.

## Resume without redoing the work

1. Record clearance tied to the exact master hash, including the full recording/audio/music scope.
2. Upload the original master to the existing Stream account; wait for ready state and verify returned identity/duration. Configure only this authorized public marketing asset; leave unrelated signed/private media untouched.
3. Bind its actual UID and authority record, enable only this component, review the exact diff.
4. Refresh recovery/preimages/lease, deploy and purge. Run anonymous production at 1440/1366/1024/430/390 including zero initial media bytes, real Stream HLS, fullscreen, audio, modal/accessibility, analytics and LCP/CLS comparison.
5. Verify commerce and legacy redirect preservation, record deployed SHA, release lease. Stop.

No request to compress, upload, choose hosting or configure a player has been delegated back to Founder. The sole requested human decision is the missing recording-specific public-use authority.

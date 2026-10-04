# MissionMed Interview Ready — Phase 1 execution checkpoint

The accepted 0002 application remains the chassis. Phase 1 focuses the existing experience on online interview technology while preserving the accepted visual CSS, photography, motion, diagnostic and saved-state compatibility. **Local founder preview; protected integration and production release are not complete.**

The Founder selected a public read-only guide with a free MissionMed account for personal tools. That boundary is recorded in `phase1.json`; account integration is not connected in this static preview. Kit and checklist explicitly label their current device-local persistence.

## Build and review

From the assigned worktree:

```sh
./interview-ready/build.sh
python3 interview-ready/qa.py
python3 -m http.server 8762 --bind 127.0.0.1 --directory interview-ready/dist
```

Open `http://127.0.0.1:8762/interview-ready.html#home`. Serve only `dist/`; source ledgers and private task inputs must not be served. Python 3 builds the single HTML without extra packages. Asset extraction, image acquisition and the unactivated server adapter use the existing Pillow runtime. Never add a provider credential to this static app.

All original route identifiers remain. Phase 1 enables home, online, test, checklist, kit, experts and prime-day. In-person, dress, wardrobe and community are preserved behind intentional Phase 2 states. **Deals Worth Watching** uses the official October 6–7, 2026 event announcement and date-bounded upcoming/active/ended states. No product discount, price or Prime eligibility is asserted.

`python3 interview-ready/build.py --production` refuses output while release acceptance, Associates site registration, account persistence or commercial-media rights remain incomplete. This check does not authorize deployment.

## Current experience

- Exactly three tiers: Business Class, First Class, Private Jet. Phase 1 has seven online categories / 21 paths; some paths deliberately recommend using existing equipment. Desktop and wide tablet show all three simultaneously; mobile retains snap and previous/next controls.
- Actual Amazon destinations and dated qualification evidence remain centralized in the catalog. `missionmatch-20` was verified in authenticated Associates Central and is added by `amazonUrl()`. The production domain is not yet on the account site list. No purchase/session-conversion attribution is claimed from merely verifying tagged URLs.
- Three commercially reusable Creative Commons product photographs now have visible author, license and derivative credits. Several remaining manufacturer assets still lack confirmed commercial permission, and some products have only an exact-model review thumbnail or editorial scene. Complete product-media hydration remains a release condition.
- Product-adjacent review links include a newly verified firsthand Litra Glow review. Setup chains and category-specific tier tradeoffs are explicit. An independent review was not found for every accessory; missing evidence is labeled.
- Seventeen clothing/accessory products, outfit rules, wardrobe and try-on adapter are preserved for Phase 2 and are not Phase 1 navigation destinations.
- Scroll depth, cinematic route transitions, masked section entrances, ambient light, animated navigation/progress and photo interactions. Editing controls stay stable. Pause motion and prefers-reduced-motion provide static alternatives.

## Source and provenance

`src.html` retains the engine. `editorial.css` / `editorial.js` hold the earlier board reconstruction; `completion.css` / `completion.js` extend that same app. `phase1.json`, `phase1.js` and `phase1.css` apply release boundaries and event behavior. The accepted `editorial.css` and `completion.css` are unchanged by Phase 1. `build.py` embeds source, data and optimized assets and writes `dist/build-manifest.json`.

`extract_assets.py` derives production imagery from the exact owner PNGs. Originals are preserved; the people were not regenerated. The new portrait layer separates moving photography from readable hero text. The mountain layer masks all generated commerce/trust claims before output. `evidence/asset-provenance.json` records crops, masks and hashes.

`hydrate_media.py` deliberately refreshes image URLs already verified in the source ledgers; it does not refresh prices/stock or replace accepted model/variant data. `--only brio` limits it to a named source key. Public access to a manufacturer/retailer asset is not asserted as commercial reuse permission. Read `RESEARCH.md` before publication.

`prepare_licensed_media.py` derives the licensed Canon R50, Shure SM7B and Stream Deck + images from preserved originals and records hashes/crops/licenses in `evidence/product-media.json`. It uses the bundled Pillow runtime. Only the photograph derivatives carry their stated Creative Commons licenses; this does not relicense the application or imply an endorsement.

## Privacy and try-on boundary

Camera, microphone and five-second playback stay in the browser. Media tracks release on route exit/hiding/page exit. Photo references use temporary Blob URLs and do not enter localStorage or an outbound request. Kit, checklist and text outfit plans retain the `ir:` storage namespace.

CSP disallows application connections, forms and object/embed content. Fonts and review thumbnails cause ordinary requests to Google Fonts and YouTube's image CDN. Review and shopping destinations open only on user navigation. Thumbnails are visible automatically; older opt-in-only preview documentation is superseded.

`tryon_adapter.py` is a tested, **unactivated** FASHN server module: explicit destination/retention/spend consent, bounded single-output requests, metadata stripping, size limits, base64-only output and safe errors. Seven synthetic transport tests pass. It is not an authenticated/rate-limited deployed gateway. Exact activation blocker: **the approved MissionMed server-side FASHN gateway has not been provisioned.** No credential, paid request or real-person upload occurred.

## Verification and publication

Current Phase 1 evidence: `evidence/static-qa.json`, `phase1-browser-qa.json`, `phase1-production-guard.json`, `phase1-live-preflight.json`, media/provenance ledgers and Phase 1 screenshots. Earlier completion evidence remains historical. These are builder QA, not independent approval. Physical device acceptance, human account/role journeys, Safari/iOS and complete product-media rights remain pending.

MissionMed OS still lacks the exact IR mission/passport/publication authority record. A concrete bounded registration packet is prepared in the scoped handoff folder. Independent review is required before canonical protected registration and integration. An October 4 public readback finds `/interview-ready/` HTTP 404; the historical STAGING readback was 403. No protected publication, account/backend/schema mutation or provider activation was attempted. Charity messaging remains disabled; Amazon prohibits a charity incentive for Special Links, and ALSAC cause-marketing/logo authorization has not been established.

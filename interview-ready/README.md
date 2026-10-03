# MissionMed Interview Ready — IR-INTERVIEW-READY-0002

Founder-review candidate reconstructed from the preserved Fable 0001 implementation. The existing hash router, media diagnostic, local persistence and checklist remain the chassis. This candidate is local; the published STAGING object has not been changed.

## Build and review

```sh
./interview-ready/build.sh
python3 interview-ready/qa.py
python3 -m http.server 8762 --bind 127.0.0.1 --directory interview-ready/dist
```

Open `http://127.0.0.1:8762/interview-ready.html`. Serve only `dist/`, not the repository or research evidence. Python 3 builds the single HTML file without additional packages. `qa.py` checks catalog policy, route presence, absence of upload transport, JavaScript syntax and deterministic output. It uses Node on PATH or the bundled Codex runtime; it does **not** run browser or physical-device tests.

Routes: `#home #online #in-person #test #checklist #dress #wardrobe #community #experts #prime-day #kit`. Category deep links retain the original identifiers, including `#in-person/padfolio`.

## Source boundaries

- `src.html`: preserved engine and markup, media lifecycle corrections, configuration and original storage namespace.
- `editorial.css` / `editorial.js`: board reconstruction, route presentation, product evidence, ecosystems, Style Studio, motion and accessible interactions.
- `curate.py` → `catalog.json` / `evidence/amazon-observations.json`: recommendations and separate internal listing observations. Run the curator only after deliberate source-backed curation changes; it is not a web scraper.
- `extract_assets.py`: deterministic crops of the exact PNG boards, with SHA-256 provenance. Requires Pillow.
- `optimize_product_media.py`: deterministic crops of two manufacturer press images. Requires Pillow.
- `build.py`: embeds production assets, CSS and catalog into `dist/interview-ready.html`; records hashes in `dist/build-manifest.json`.
- `qa-support/`: axe-core 4.10.3 and synthetic device fixtures used only through developer browser QA. Neither is bundled.

The exact inputs were `Gear Guide 2.png` and `Gear Guide 1.png`, both 1448 × 1086. No newer `(1).jpeg` was found. Originals remain in `sources/`; the people were not regenerated or replaced. Category crops are board illustrations, not exact-model product photos.

## Catalog policy

There are 60 tier paths across 15 categories, comprising 21 distinct product destinations and preparation plans that require no purchase. Thirty-two Amazon listings were observed during October 3, 2026 UTC research. Eleven failed the default 4.5 threshold and remain held. Facecam MK.2 is the explicit Elgato exception; its observed 4.3 rating is retained internally, never rounded upward.

`amazonUrl()` centralizes links. `IR_CONFIG.affiliateTag` remains empty because no authoritative tag was verified. Cards link to genuine `/dp/ASIN` destinations. Numeric Amazon ratings, review counts, prices, Prime badges and deals are excluded from the public bundle pending a compliant authorized API mechanism. Independent reviews sit beside relevant products and are also indexed under Expert Reviews.

Two exact-model Elgato press images are included for local editorial review. Other model images are linked at their sources while reuse rights remain unconfirmed. Read `RESEARCH.md` and `evidence/product-media.json` before wider publication.

## Privacy and truthful capability

Camera, microphone and the five-second recording run in the browser. Tracks stop on route exit, document hiding and page exit; late permission responses are released. Face photos are temporary Blob URLs, not stored in localStorage or sent to a service. Kit, checklist, outfit plans and fitting checks use the existing `ir:` namespace on this device. There is no account sync, community upload or telemetry backend.

The CSP blocks outbound application connections, forms and object/embed content. Google Fonts are external CSS/font requests. A YouTube thumbnail is fetched only after “Load YouTube preview”; original-review and Amazon links leave the app on explicit navigation.

Camera exposure uses a fixed central sample, not face detection. Browser online status is not a speed/packet-loss test. Style Studio offers outfit palettes and rehearsal checks, not measured fit or photorealistic try-on. FASHN and IDM-VTON were researched; no photo-processing service was activated. Prime Day remains evergreen. Community Looks contains three labeled editorial examples.

## Verification and publication boundary

`evidence/static-qa.json`, `browser-flows.json`, `responsive-qa.json`, `categories-qa.json`, `final-accessibility.json` and screenshots document builder QA. Synthetic media is distinguished from physical camera/mic acceptance. Automated accessibility retains manual review for gradients/photos and the live self-preview. Founder acceptance, real-device/platform rehearsal and Safari/iOS checks remain pending.

MissionMed OS lacks exact mission/product/authority registration. The current Critical Systems Contract requires registration and a decision before protected CDN/WordPress/Matrix changes. The historical report's STAGING exemption does not override that rule. Read `TASK_PACKET.md` and the scoped handoff before publication. No LIVE release, backend activation or protected navigation integration occurred.

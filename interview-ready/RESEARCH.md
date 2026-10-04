# Current completion research — October 4, 2026 UTC

This section supersedes the earlier catalog counts, media-preview behavior, outfit planner and research-only provider status below. Historical observations are retained as evidence, not silently reused as current listings.

## Products and display boundary

All 19 currently linked Amazon destinations were read from the visible exact listing today. `evidence/amazon-refresh-2026-10-04.json` records model title, ASIN, rating, count, stock and timestamp. Eighteen meet the 4.5 rule; Facecam MK.2 remains the permitted Elgato exception at 4.3. The original 32-listing ledger and 11 held choices remain historical. The public app has 45 paths across 15 categories and three tiers, plus DJI/Blue alternatives; this is not 45 unique products.

[Amazon Associates policies](https://affiliate-program.amazon.com/help/operating/policies) were rechecked. No authoritative Associates tag or authorized product API was available. Manual rating/count/price observations stay outside the public bundle; exact product links provide current commerce information. There are no invented Prime, Choice, sale or charity claims.

Seven exact gear photographs and 17 exact retailer garment/accessory photographs now have local optimized derivatives. `evidence/product-media.json` and `evidence/fashion-sources.json` tie source URL, original hash, derivative hash and rights status together. Manufacturer/retailer public access supports this local editorial review; commercial publication permission is not asserted. Shure's media endpoint denied acquisition, and some other gear lacks an accepted reusable exact photo. Those cards show a clearly labeled independent review thumbnail or preparation scene and link to original product photos. No generated imitation of a real model was added.

Nine selected Quince color variants have dated USD prices from product metadata. Other retailer prices are omitted when the exact selected variant was not verified. Ann Taylor's black Seasonless Stretch pair, Banana Republic's navy hopsack pair and J.Crew's deep-navy Ludlow pair are sourced outfit options. The Brooks Brothers MA03526 red silk knit tie has photographed identity, sizing/care and an explicit fulfillment/return caution; no price promise. The Quince short shirt dress is a conditional dinner option, not a universal formal-interview recommendation. Stock and fit depend on selected size; outfit subtotals exclude unpriced pieces, tax, shipping and tailoring.

Thirteen product-specific independent review entries use original video thumbnails or labeled images for written reviews. Automatic thumbnail requests to YouTube's image CDN replace the prior opt-in-only preview pattern. No videos/articles were copied and no endorsement of MissionMed is implied. Utility/travel items without an independent test say so. The Style filter links AAMC rehearsal guidance and does not invent garment reviews.

## Try-on provider comparison and implemented boundary

| Existing solution | Primary evidence | Decision |
| --- | --- | --- |
| FASHN hosted tryon-v1.6 | [Model API](https://docs.fashn.ai/api-reference/tryon-v1-6), [API flow](https://docs.fashn.ai/api-overview/api-fundamentals), [retention](https://docs.fashn.ai/api-overview/data-retention-privacy) | Selected adapter target. One output / one credit; tops, bottoms or one-pieces. This does not establish accessories, exact sizing or whole-outfit photorealism. |
| FASHN self-hosted | Model/parser primary sources retained below | Core license does not clear all pipeline dependencies; hold commercial deployment. |
| IDM-VTON | [Official repository](https://github.com/yisol/IDM-VTON) | Non-commercial license path; hold default commercial use. |
| CatVTON | [Official repository/license](https://github.com/Zheng-Chong/CatVTON) | Code, checkpoints and demo are CC BY-NC-SA 4.0; commercial integration held. Hardware/model quality unbenchmarked here. |
| OOTDiffusion | [Official license](https://github.com/levihsu/OOTDiffusion/blob/main/LICENSE) | CC BY-NC-SA 4.0; commercial integration held. No model weights or runtime installed. |

FASHN's newer Try-On Max is another documented path, but this adapter deliberately uses the established, bounded-cost v1.6 garment endpoint. Provider privacy is external processing: standard output CDN retention is three days, base64 output availability 60 minutes, and temporary base64 input copies are cleaned after processing with a one-day backstop. Request records are not automatically deleted. The provider states no training without separate express opt-in.

`tryon_adapter.py` implements consent checks, metadata stripping, image limits, a single paid POST without automatic retry, bounded polling, safe errors and base64 output validation. Canceling polling does not cancel or refund a provider job. Seven synthetic tests passed; no provider credential, photo upload or spend occurred. The UI exposes the local outfit collage and complete integration boundary honestly.

**One exact activation blocker:** the approved MissionMed server-side FASHN gateway has not been provisioned. That gateway must supply session authorization, server credential custody and per-user rate/cost controls before this module can be activated. The static app retains connect-src none.

## Current authority and acceptance

The exact mission/product/publication record is still absent in current MissionMed OS. Protected CDN/WordPress/Matrix writes remain closed. An ordinary October 4 readback of the STAGING object returned 403, so its current bytes are unverified; no bypass or remote mutation followed. Local founder review, builder QA and source filing are separate from deployment, rights clearance, real-device acceptance and independent approval.

# Historical October 3 research — retained evidence, superseded where noted

# Interview Ready research and integration decisions

Research date: October 3, 2026 UTC, during October 2 local evening. These are builder findings, not founder approval or evergreen listing claims. Exact observations/times are in `evidence/amazon-observations.json`; manufacturer and review links accompany recommendations in `catalog.json`.

## Amazon qualification and display

32 exact listings were inspected in the browser. Selected ASIN, displayed rating/count and stock status were read from the listing, including selected-model item details when a page contained recommendations for other variants. 21 qualify for the curated experience; 11 are held. Normal Amazon destinations are used because an authoritative Associates tag and authorized product API were not found.

The 4.5 threshold applies to observed numeric ratings. Facecam MK.2 (4.3 / 1,591 ratings) uses the explicitly permitted Elgato exception and is labeled accordingly. Blue Yeti observed 4.6 and qualifies normally. Held Sony ZV-E10 II, Nikon Z30, SM7dB and other products cannot become default purchases merely because their ecosystems are useful to existing owners.

Amazon’s current [Associates policies](https://affiliate-program.amazon.com/help/operating/policies) condition display of customer ratings/reviews on authorized API use and restrict price/availability display mechanisms. Manual observations remain internal; the app directs users to Amazon for changing commerce information. No manually copied stars, counts, prices, Choice/Prime badges, discounts or active Prime Day claims appear in production HTML.

60 paths cover 15 categories and four tiers. Some higher-tier travel paths recommend preparation instead of a purchase. This is not 60 distinct researched products. Each card carries value/complexity, pros/cons, setup, compatibility and additional requirements. Founder-specific product endorsements have not been fabricated.

## Hardware distinctions

- Canon R50 kit guidance includes its RF-S 18–45 mm lens, support/mount, sustained power, capture/USB choice, room lighting and long rehearsal. [Canon manual](https://cam.start.canon/en/C011/manual/html/UG-11_Reference_0090.html).
- Shure MV7+ supports USB and XLR. SM7B requires a suitable XLR interface/preamp; an inline booster depends on available clean gain. SM7dB changes power/gain requirements but its observed 4.4 excludes it as a new default purchase. [MV7+ guide](https://pubs.shure.com/view/guide/MV7plus/en-US.pdf), [SM7 gain guidance](https://service.shure.com/articles/en_US/Knowledge/sm7-output-level-and-preamp-gain-specifications).
- Original Elgato Key Light is distinguished from newer Air/MK.2 variants and their images. [Original setup](https://help.elgato.com/hc/en-us/articles/360028244011-Key-Light-Quick-Start-Guide).
- DJI Pocket 3 is an existing-owner USB webcam alternative with power, framing and mount cautions. Its portable role does not justify an extra purchase for every applicant. [DJI manual](https://dl.djicdn.com/downloads/DJI_Osmo_Pocket_3/UM/20250826/DJI_Osmo_Pocket_3_User_Manual_v1.0_en.pdf).
- C920x uses a family specification source with an explicit variant caveat; C920s package accessories are not promised. [C920 family specifications](https://support.logi.com/hc/nl/articles/17368441997847-C920-Technical-Specifications).
- Anker Ethernet guidance is for the exact A8313 adapter. [Manufacturer support](https://service.anker.com/product-description/a085g000004x2CtAAI/powerexpand-usbc-to-gigabit-ethernet-adapter).

Elgato control/mounting, USB/XLR, camera lens/capture/power and DJI workflows are explained together. Existing-owner guidance does not bypass the rating filter for new purchases.

## Reviews and media

13 independent review entries from Podcastage, EposVox, Primal Video, The Podcast Host, DPReview, Tom’s Hardware, Dunna Did It and Pack Hacker sit beside relevant products. Links/titles/model caveats are in the catalog. The BAGSMART review informs the Blast family, not every cube in the selected six-piece listing. Some utility/travel choices still lack a product-specific independent review; manufacturer evidence is used without fabricated reviewer attribution. No reviewer is described as endorsing MissionMed, and no MKBHD review was invented.

YouTube previews load only on request. Links open original works; videos/articles are not copied into the bundle. Exact owner PNGs are preserved with 14 derivative crop records. Generated commerce statistics, charity logos and generated founder portraits are excluded. Authentic donor Dr. Brian imagery is used for mentor identity; CSS covers the mock padfolio wordmark and substitutes functional calls to action. Board category images are illustrations, not exact model photos.

Facecam MK.2 and Stream Deck MK.2 images were obtained through [Elgato’s media room](https://www.elgato.com/us/en/s/media-room) and its linked Corsair Keystone press kits. Source URLs, originals and derivative hashes are in `evidence/product-media.json`. They support local editorial review. Public access to a press kit is not treated as blanket permission for future commercial reuse; wider rights still need confirmation. Other product photos remain source links where reuse rights/API authorization were not established. This is a material limitation of the photographic product experience.

## Existing virtual try-on options

| Option | Verified primary evidence | Candidate decision |
| --- | --- | --- |
| FASHN hosted API | Existing external processing with defined retention. [Provider privacy](https://docs.fashn.ai/api-overview/data-retention-privacy). | Research only. No registered server-side boundary, consent/retention decision or approved credential custody; no photos submitted. |
| FASHN VTON 1.5, self-hosted | Core Apache-2.0 model, approximately 2 GB weights plus pose/parser dependencies. [Model card](https://huggingface.co/fashn-ai/fashn-vton-1.5), [repository](https://github.com/fashn-AI/fashn-vton-1.5). | Core license alone does not clear the pipeline. Hardware unbenchmarked; no installation, download or inference performed. |
| FASHN human parser | [Parser license](https://github.com/fashn-AI/fashn-human-parser/blob/main/LICENSE) inherits [NVIDIA SegFormer license](https://github.com/NVlabs/SegFormer/blob/master/LICENSE), section 3.3 restricting use to non-commercial research/evaluation. | Hold commercial integration until the dependency path is cleared or replaced. Source-based implementation hold, not a legal opinion. |
| IDM-VTON | Code/checkpoints licensed CC BY-NC-SA 4.0. [Official repository](https://github.com/yisol/IDM-VTON). | Hold default commercial integration; no execution or upload. |

FASHN documents deletion of base64 processing copies on completion with a one-day cleanup backstop, standard CDN output deletion after three days and base64 output availability for 60 minutes. Submitted URL strings remain in request records; those records have no automatic deletion/deletion endpoint. [Primary retention source](https://docs.fashn.ai/api-overview/data-retention-privacy). An integration cannot truthfully claim local-only processing.

A future cleared provider/model should be reused. Activation requires registered ownership, server-held credentials, explicit consent naming the destination, garment-image rights, retention/deletion behavior, cancellation/failure handling, rate/cost limits and representative quality testing. No key belongs in this static HTML file. Current Style Studio is a colour/silhouette planner and rehearsal tool, explicitly not photorealistic try-on or measured fit.

## Style guidance

Men’s, women’s and unrestricted presentation choices cover six outfit starting points, tailoring, seated comfort, neckline/hem/sleeve checks, shoes, camera contrast and finishing details. A persistent six-check fitting rehearsal accompanies save/edit/select wardrobe flows. No identity is inferred from photos. Program instructions take priority. The [AAMC preparation guide](https://students-residents.aamc.org/applying-residency/virtual-interviews-applicant-preparation-guide) supports interview rehearsal; palettes are editorial starting points, not AAMC endorsements.

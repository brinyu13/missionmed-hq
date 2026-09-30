# Analytics and minimal regression

## Analytics

Homepage runtime evidence included:

- initial `mm_home_hero_view`;
- view and interaction events through all eight frames;
- `mm_home_hero_cta` with frame, division, and destination;
- `utm_source`, `utm_medium`, and `utm_campaign` on the initial event and CTA destination.

Dedicated page CTA runtime evidence:

```json
{"event":"mr_cta_click","mission":"MR-WEB-0912","page_path":"/mission-residency/","utm_source":"heroqa","utm_medium":"qa","utm_campaign":"premium-hero","location":"top"}
```

All scoped dedicated-page section links retained `/mission-residency/` and the supplied campaign attribution after the final fix.

## Anonymous rendered-DOM smoke

- Homepage: one `#mm-premium-hero`, zero legacy `.mm107-hero` sections, approved message present, stale strings zero, attributed CTA links present.
- Dedicated page at a 390px anonymous headless viewport: one static `.hero-premium`, one path grid, zero carousel markers, stale strings zero, nine tested path links retained route and attribution.

## Minimal unrelated surface load smoke

| URL | Result |
|---|---|
| `/` | 200 |
| `/mission-residency/` | 200 |
| `/examprep/` | 200 |
| `/usce/` | 200 |
| `/product/iv-prep-masterclass/` | 200 |
| `/product/match-prep-pro/` | 200 |
| `/cart/` | 200 |
| `/checkout/` | expected empty-cart redirect to `/cart/`, final 200 |
| `/my-account/` | 200 |

No payment or enrollment mutation was performed.

## Immutable boundary check

- `missionmed-mr-zelle-verifier.php`: `b4813d439bcf78f61ca362d77db61211abb6f90dce8931353f4999fe93d02e1d`
- `missionmed-zelle-qr.png`: `7e1f116daf0b0dd23b66db87073b5db2df77d049535603a9abb8a21545ad6b15`

Both local and live hashes match. No further Zelle architecture or payment investigation was performed.


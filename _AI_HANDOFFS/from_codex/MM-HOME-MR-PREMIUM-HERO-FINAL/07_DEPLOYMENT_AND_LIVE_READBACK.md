# Deployment and live readback

> Historical candidate report. The accepted later release is documented in `README.md`, `FINAL_ACCEPTANCE.md`, and `ROLLBACK.md`; the hashes below are not current production hashes.

- Live homepage: `https://missionmedinstitute.com/`
- Live dedicated page: `https://missionmedinstitute.com/mission-residency/`
- Production root: `/www/theresidencyacademy_209/public`
- Private release evidence: `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/20260930T003640Z`
- Kinsta provider-native backup: `Pre premium hero release 2026-09-29`, created Sep 29 2026 8:35 PM ET, expiry Oct 13 8:35 PM ET.
- Site cache purge completed successfully after the final script deployment. Final versioned URL readback was `scripts/site.js?v=83506b88e775`.

## Exact production/source parity

| Artifact | SHA-256 |
|---|---|
| `missionmed-mr-p0.php` | `0b21f62ac5fb5db84a795daac1cf60ceac455143a831e2289619dc57f547a331` |
| dedicated `index.html` | `4f10376ed37c9a4c02a20a7d59bd004bbdbf6f74f542fdecc95c46a13b9717bf` |
| dedicated `scripts/site.js` | `83506b88e775f8c8960008448f6f94b96a92edd0d57ee5b3751551903b1513a6` |
| dedicated `styles/site.css` | `d77c725e4f37c5e3cc180b3539f33bce3a6b958471a5055ee8cc203ca37f1475` |
| `image-3.png` | `419157071fa80acac6574c6984263113cc5a1f940261ddce168ca18638c047ec` |
| `image-10.jpg` | `567ed136b727ebbcd4955082f9577da8620d34eaec73bb6a7a4af2fead9a3593` |
| premium `hero.css` | `f8f48db237a929126edffc39b014507467c14da9faa9486149fec34339ee2128` |
| premium `hero.js` | `cefb0d79d991a874bfe9c8af6650f58e64227cf9d3afc691f2c255728dda1d36` |
| `mr-application.webp` | `a738cc211adfd6b459b44829585810bf511cfd61c584e85f31669ef4de113b78` |
| `exam-live.webp` | `1bf83feb909793106ac4e478e5381a42f78d24a1597d997b0fba45a6bcd862ce` |
| `mr-communication.webp` | `a3f9859959bcff5bc73e3c0bc579ea03a2b729444242195d9de54305402072e7` |
| `mr-community.webp` | `1a982ce666bb2c989a87a1ae511d5aa452ee778c0880109a98fc9fd5f79fdf43` |
| `mr-ranking.webp` | `21342b2e5c5d7f211c7fc064bfb2a354eca28875c6caca08adeedc76911ac042` |
| `usce-clinical.webp` | `3906a6bdd80f4e5cd1897e4d5be166f5e2b18facd95a9777109e253e2e8e5fd9` |
| `usce-operating.webp` | `bfd875f2cc957035af6e412c71479a9fae1b1a3e787dec1635baca035e2adb48` |

Every listed live file matched the local release source byte-for-byte at final readback.

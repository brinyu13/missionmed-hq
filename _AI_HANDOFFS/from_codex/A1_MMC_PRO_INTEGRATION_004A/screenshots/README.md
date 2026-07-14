# MMC 004A Product Evidence

This directory is the commit-safe browser evidence set for the reconciled local MMC baseline. All visible student records are repository fixtures or explicitly synthetic partner-demo data. No production account, recording, transcript, persistence store, or external API was used.

The 31 checksum-listed capture files retain the `.png` names assigned during capture, but their exact on-disk encoding is JPEG/JFIF. `SHA256SUMS` covers the bytes as preserved. A separate macOS Computer Use confirmation was performed locally; its full-Chrome-window capture was deliberately excluded from the public repository because unrelated signed-in browser chrome was outside MMC evidence scope.

- `01`–`13`: private MMC operating loop, selection-continuity proof, session flow, Pipeline Admin, Webex controls, and identity/roster review lanes.
- `14`–`17`: desktop (1440×900), tablet (1024×768), narrow mobile (390×844), and laptop (1280×800) checks.
- `18`–`19`: populated and empty Meeting Intelligence states.
- `20_partner_*`: all eleven supported static partner-demo screens at 1280×800.
- `21`: partner-demo narrow-mobile debt proof; the page retains a deliberate 980px floor.

Measured private-route width behavior:

| Viewport | Content client width | Content scroll width | Result |
| --- | ---: | ---: | --- |
| 1440×900 | 1194 | 1194 | PASS |
| 1280×800 | 1034 | 1034 | PASS |
| 1024×768 | 778 | 778 | PASS |
| 390×844 | 144 | 470 | KNOWN DEBT — internal horizontal overflow |

The partner demo measured `980px` document width at a `390px` viewport and is classified desktop/laptop-only until CAM v2.0 redesign work. Integrity hashes are in `SHA256SUMS`.

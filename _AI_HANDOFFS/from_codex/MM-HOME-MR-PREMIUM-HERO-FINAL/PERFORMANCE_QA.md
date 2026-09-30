# Public performance QA

Six fresh anonymous public homepage navigations (two each at 1440, 1024, 390; cache-bypassed query URLs) yielded CLS between **0.00037 and 0.01080**. The earlier first-load ~0.94 CLS defect is resolved. The hero image was the measured LCP element at **1.34–1.72 s** in these lab runs. It loaded on every run, with no critical same-origin network failure, JavaScript error or horizontal overflow. See `live-qa/final-perf.json`.

The initial frame carries a reserved image/hero layout and critical-head CSS. Later-frame images are deferred by the hero runtime; `live-qa.json` records the initial loaded assets. These measurements establish controlled public lab behavior, not field Core Web Vitals or every device/network condition. The subsequent `5f59a91` change affected only the dedicated page's lower closing-section CSS; `mr-final-qa.json` shows that page still renders cleanly at all three widths.

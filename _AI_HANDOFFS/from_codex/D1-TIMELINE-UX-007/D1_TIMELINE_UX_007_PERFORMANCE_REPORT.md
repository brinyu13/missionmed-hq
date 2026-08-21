# D1 Timeline UX-007 — Performance Report

Architecture now separates high-frequency local gesture state from committed document/persistence state. Snap anchors are cached at gesture start; pointer movement uses one animation-frame update; network and autosave occur only after a logical commit. Zoom is viewport-only and preserves the mounted iframe.

The nine full browser interaction journeys completed in 7.7 seconds with zero page/console errors. Per-journey wall durations: median 411.6 ms, p95 1,001.2 ms, maximum 1,109.2 ms. These durations include UI setup/waits and are not frame-time claims. The pointer-drag journey completed in 334.5 ms and committed one final geometry update; no request/render/save per pointermove is permitted by the implementation or focused tests.

Large-data regression remains green: 100-event projection, 500-candidate quarantine, 250 concurrent autosaves, 500 checkpoint saves, and failure/retry budgets all passed within their suite thresholds.

Production p50/p95 browser telemetry is pending cutover and canary; it must not be fabricated from local test timings.

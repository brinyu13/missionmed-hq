# Accessibility and interaction QA

On the public homepage, first Tab focused a visible `Skip to content` link with a 124.6×40 px focusable box. The Next control retained visible focus while ArrowRight advanced to Frame 02 and ArrowLeft returned to Frame 01, with scrollY remaining zero; the live region announced the new frame. Arrow keys on the native selector retained native selection behavior. Reduced-motion mode disabled autoplay and left manual Next functional. Normal desktop autoplay advanced, while mobile began paused and advanced only after Play. See `live-qa/interaction-qa.json`.

The 390px captures show readable Frame-01 payoff, CTA and controls without text/image collision. All eight frames expose nonempty authentic image alternatives in `live-qa.json`. Browser interaction checks found no critical JavaScript errors. This is focused release accessibility QA, not a formal full-site WCAG audit.

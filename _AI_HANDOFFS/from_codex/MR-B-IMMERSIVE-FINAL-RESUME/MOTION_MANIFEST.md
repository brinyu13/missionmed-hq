# Production release addendum — September 15, 2026

Production retains the locked B motion design. At all three widths, scrolling changes the hero transform; reduced-motion mode sets it to none and exposes all four static narrative chapters. Independent keyboard and dialog checks pass. DR-269 expressly permits the intact photo-composite fallback: this is NOT independently extracted room/person layering. No new image-generation attempts were made. No physical-device FPS or comprehensive Core Web Vitals certification is claimed.

See PRODUCTION_QA.md, INDEPENDENT_ACCEPTANCE.md and the source ledger for current evidence. The original document is preserved below as historical context. Its local-only and pending-authority statuses are not current release claims.

---

# Motion manifest — implemented behavior and limits

Continuation: quote changes now use a 280ms opacity/4px reveal when motion is enabled; manual changes remain immediate with motion off. Focus-exit uses the next focus target to avoid remaining paused after focus leaves. Targeted hold/manual checks are in `evidence/quote-continuation-checks.json`; exact animation timing and hover/focus isolation were not instrumented. This replaces the earlier hard text swap, without reopening the blocked hero extraction loop.

Scope: `scripts/site.js`, `scripts/finalization.js`, `styles/finalization.css`, `styles/founder-steers.css`. B locked; no alternate-concept navigation.

| Sequence | Desktop implementation | Mobile / reduced motion | Verification |
|---|---|---|---|
| Hero | Full photo-based room/Dr Brian composite drifts down; lightly blended foreground crop drifts oppositely; type and offer ticket move at distinct rates | Mobile uses complete composite, smaller depth and no foreground crop; motion off resets transforms | Final 1440/390 rendered screenshots. **Independent Dr Brian subject plane is NOT achieved** |
| Training story | Four image/content beats with scroll-indexed crossfade, scale/translation, moving type and numbered controls; 285vh desktop | 260vh mobile, lower caption shelf; motion off shows the complete static narrative | Existing B mechanism preserved; responsive DOM and static narrative checked. Full frame-by-frame narrative re-audit not claimed |
| Personalization | Sticky 210vh scene; mentor photo, story card, feedback illustration have separate x/y movement | Mobile switches to flowing layout with smaller depth; motion off unpins and zeroes transforms | Opposite endpoint transforms recorded in QA JSON; text repaired and visually inspected |
| Matrix | Perspective device frame and foreground app labels move at different rates | Smaller frame and wrapping labels; motion off resets | Rendered device inspected; separate transform implementation source-reviewed; no physical-device FPS certification |
| Match proof | Three authentic-recording cards translate at different scroll rates | Smaller movement; motion off resets | Rendered proof controls checked; transforms reset verified |
| Quote intros | Nine-second rotation only when visible, with manual previous/next and pause; hover/focus suppress automatic movement | Motion-off prevents timed movement; manual controls still work | Manual next/pause checked. Automatic cadence and focus-resume edge cases not fully timed |
| UI | Native disclosures, offer selection, dialog focus/close behavior, button/focus treatments | Persistent enrollment bar; reduced-motion mode disables decorative movement | Main interaction results in QA report |

## Hero extraction bounded blocker

The first extraction and a corrective extraction produced painted checkerboards rather than alpha. After the Founder supplied the actual photo steer, the photo-based full composite replaced the rejected likeness. CSS masking of the subject failed at cover-crop aspect ratios during final QA. The single repair batch kept the full portrait intact. No fourth exploration loop was started.

The strict requirement for independent **room → Dr Brian → foreground → typography** is therefore PARTIAL, not passed. A later specialist extraction with genuine alpha and matching clean plate, approved against the original photo, is needed to meet it exactly. The current intact-image fallback should not be advertised as a four-plane extracted hero.

Motion is requestAnimationFrame-driven on passive scroll, and can be turned off. This is an implementation description, not a measured Core Web Vitals or GPU-performance result.

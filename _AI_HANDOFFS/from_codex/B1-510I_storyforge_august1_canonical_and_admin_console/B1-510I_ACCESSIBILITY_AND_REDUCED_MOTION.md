# B1-510I Accessibility and Reduced Motion

Phase C is deployed with `STORYFORGE_PREMIUM_MOTION=1`. The implementation retains one semantic application, keyboard/focus behavior, live-region behavior, and the existing dark visual system.

Motion states are bounded to `low`, `active`, `recording`, and a brief `success` settlement. They change spatial movement only; no full-screen brightness, contrast, opacity, or flashing pulse was added. The production Founder-student browser reported `prefers-reduced-motion: reduce`; the live app honored that preference while retaining the rich static frame.

The kill switch, reduced-motion preference, and Static Dark background each stop continuing canvas animation. The browser conformance/accessibility suite passed 72/72, browser E2E passed 64/64, and focused tests cover motion disabled, reduced motion, recording state, deterministic particles, and no strobe regression.

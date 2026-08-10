# B1-513R Student UX — Final

The V2 student experience, surface by surface. Copy quoted here is the approved prototype copy (FD-R1 covers the few externally-visible strings).

**Home (shot 01).** Unchanged production Home. The mentor panel now shows Dr Brian's headshot; one additive row-button: "✧ Can't think of a story? Open Inspiration ▸".

**Library (shots 02–03).** Default row = what the Founder listed, in order: star · "The One Where" + title · completion state · review-status chip · (👁 Mentor visible only when it adds information) · "N tellings" · 🎙 · "updated X ago" · **STORY PRIORITY [1][2][3][4][5] · "5/5 · Highest"** (fully labeled, keyboard-operable, aria per control: "Set Story Priority to 4 of 5") · MORE · OPEN STORY. "More" expands in place: excerpt, Lesson, **Mentor Score ★★★★☆ 4/5** (gold stars, visually nothing like Story Priority), categories, question count, birds, Quick Look. No unlabeled dots or numbers anywhere in a row. Search/filters/facets/sorts untouched.

**Story Detail (shots 04–08).** One title: reading tabs show the h1; the Full Story tab's editable title IS the title (h1 goes srOnly — no duplicate hierarchy). One status chip (roomMeta); the submission card explains, the chip doesn't repeat. Visibility card unchanged from B1-513. Save feedback is the live triad **"Saving… / Saved ✓ / Couldn't save — try again"** on every editor; the developer-facing durability sentence is gone. History: **"🕘 Previous Tellings (N)"** expander per version, each with timestamp, source (⌨/🎤), and "Restore this telling"; restore-safe language ("your current telling moves to Previous Tellings"). The Original tab keeps its exact preserved-forever framing.

**Universal voice (shots 07/13/26).** One learned pattern: **🎤 = speak instead of type.** Identical icon, red recording state, live transcript typing, timer, Done/Discard, editable transcript after — across New Story (the production recorder, untouched), Full Story "🎤 Add with voice", 30-Second/NNQ "🎤 Add / 🎤 Retell with voice", Inspiration answers, and guest contributions. Retell always routes the prior telling into Previous Tellings.

**30-Second Version (shots 06–07).** Natural delivery, not a quota: live estimate "≈ 24s spoken at an easy pace (56 words) · Right in the pocket." plus **"⏱ Time me reading this"** — a real elapsed timer for the student's own pace and accent; the helper says explicitly it is "a guide, never a quota."

**Inspiration** — doc 08. **Request a Story** — doc 09. **Settings** — doc 12.

**Visibility & submission.** Unchanged B1-513 semantics; the row-badge rule keeps privacy signals single: a not-submitted story shows "Private" (workflow chip) and adds "👁 Mentor visible" only when observation differs from the default reading. Historical stories untouched (probes 12, 15).

**Accessibility spot-state.** All new/refined student surfaces pass the package's checks at Standard/Large/Extra Large, 390px zero-overflow, keyboard operation of priority buttons/tabs/expanders, aria-live on save states and counters, reduced-motion static richness (doc 15). Tiny-uppercase microcopy reduced in rows (facts are 11.5px sentence case); no nested scroll introduced; expanded row areas render in-flow.

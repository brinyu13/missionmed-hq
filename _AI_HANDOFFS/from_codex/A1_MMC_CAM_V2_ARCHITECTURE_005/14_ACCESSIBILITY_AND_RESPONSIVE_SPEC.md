# 14 Accessibility and Responsive Specification

RESULT: `WCAG_2_2_AA_ARCHITECTURE_DEFINED`

## Baseline and gate

Current private MMC accessibility/responsive readiness is **2.4/10**. Post-red-team CAM v2 architecture score is **9.2/10**. This is not certification: it becomes earned only after automated and manual evidence passes. WCAG 2.2 AA is a release floor, not final polish.

Current defects include pointer-only primary navigation and filters (`missionmed-hq/public/mmc-private/index.html:23-51,442-458`), clickable directory rows (`src/app.js:1161-1180`), no `<main>`/coherent `h1`, mostly unlabeled forms, non-live status/toasts, no dialog focus trap/return, no shared `:focus-visible`, dim text near 3.19:1, motion without reduced-motion support, a fixed 240px rail, and measured 390px overflow. The Partner Demo’s 980px floor is explicitly design rejected.

## Semantic shell

- First focusable element is “Skip to main content.”
- Exactly one `<main id="main-content">` and one view-specific `h1`.
- Primary navigation uses links/buttons with accessible names and `aria-current="page"`.
- Routes are real URLs; route change focuses `h1` (`tabindex=-1`) and announces once.
- Headings follow hierarchy; landmark/name combinations are unique.
- All clickable `div`/`tr` patterns are removed. Sortable table headers use buttons.
- Back/forward restores view, student, scroll, and appropriate focus.

## Controls and forms

- Every input/select/textarea/checkbox/upload has a visible programmatic label; related controls use `fieldset/legend`.
- Help/error text has stable IDs and `aria-describedby`; invalid controls use `aria-invalid`; error summary links to fields.
- Placeholder and color never communicate required state/format alone.
- Primary/mobile targets are at least 44×44px; all targets satisfy WCAG 2.2 24px/spacing minimum.
- Combobox, tabs, menu, listbox, grid, and disclosure patterns follow WAI-ARIA Authoring Practices and use native elements when possible.

## Keyboard and focus

- Every workflow is keyboard complete in logical DOM order.
- Visible focus is at least 2px and 3:1 against adjacent colors; sticky UI never obscures it (WCAG 2.4.11).
- Dialogs use native `<dialog>` or correct semantics, title/description, inert background, initial focus, trap, Escape behavior, and return focus.
- Popovers close on Escape/outside click and restore focus. No nested overlay stack beyond one drawer plus one necessary confirmation.
- Focus never moves for background refresh; failed submission moves to a linked error summary.
- Transcript/data-grid scroll regions have labels and no keyboard trap.

## Visual and motion criteria

- Normal text contrast ≥4.5:1; large text ≥3:1; UI boundaries/icons/focus ≥3:1 in every state.
- Dim/red/violet/disabled/hover/selected/error tokens receive computed contrast tests.
- Color pairs icon/pattern and text.
- Body defaults to 16px; meaningful metadata is ≥14px; 12px is reserved for nonessential annotations; phone inputs are ≥16px. 200% text and WCAG text-spacing overrides do not clip.
- `prefers-reduced-motion` and in-product setting remove entrance movement, pulse, shimmer, smooth scroll, ambient motion, and nonessential transforms.
- No nonessential attention-speed animation runs indefinitely; static background is available.

## Responsive shell

Use shell breakpoints for navigation and container queries for modules:

| Viewport | Required behavior |
| --- | --- |
| 1440+ | Expanded 232–240px rail; 12-column stage; queue/inspector split allowed; readable max widths. |
| 1280 | 216–232px rail; two-column operating layout; one topbar primary action; no wrapping. |
| 1024 | 72px compact rail; eight-column stage; inspector may split only with ≥320px panels. |
| 768 | top bar plus overlay rail or portrait bottom nav; single column default; inspector routed/sheet. |
| 390 | bottom nav; 16px gutters; one column; sheets; tables become complete disclosure cards. |
| 320 | 12px gutters; labeled four-item bottom nav plus More; sequential forms; no missing action. |
| 200% zoom | Use effective CSS width; a 1280px display behaves like ≤640px without lost function. |

Document/page horizontal overflow is forbidden: `scrollWidth <= clientWidth + 1`. Only an intrinsically tabular, explicitly labeled grid/transcript subregion may scroll horizontally. Safe-area insets and virtual keyboards cannot obscure focus or sticky actions.

Orientation changes are state-preserving reflows, not remounts. Rotating at tablet/phone widths during a draft, dialog/sheet, media review, or active session preserves the route, pinned subject, typed input, media time, focus target, and appropriate scroll anchor; the layout reflows without overflow or an obscured action, and assistive technology announces only a meaningful changed state—not the rotation itself.

## Component transformations

| Component | Wide | Narrow |
| --- | --- | --- |
| Navigation | labeled rail | bottom nav + modal More drawer, same routes |
| Student selection | searchable accessible combobox | full-width combobox/search route, no chip strip |
| Queue | list + inspector | route stack: queue → detail → action |
| Directory/table | semantic sortable table | complete card/list projection |
| Transcript | readable/virtualized bounded region | wrapped speaker/time segments |
| Quick Capture | max-32rem modal | keyboard-safe full-width sheet |
| Live Session | notes + reference | notes with reference disclosure and non-obscuring action bar |
| Evidence inspector | right slot | routed full-screen sheet |
| Status/toast | persistent live region/action | same; action-bearing notices do not auto-dismiss |

## ARIA/status policy

- Passive loading/saved/refresh: `role=status`, polite, atomic as appropriate.
- Newly surfaced blocking error: `role=alert` once, without repeating on render.
- Progress uses `<progress>` or named `progressbar` and throttled announcements.
- Skeletons are `aria-hidden`; real fixture values never masquerade as loading content.
- Background refresh preserves content and focus; status names exact timestamp/state.

## Media, cognitive, and international accessibility

- Audio/video never autoplays. Native/custom controls expose play/pause, seek, volume/mute, captions, transcript, playback rate, elapsed/duration, and full-screen with complete names/keyboard/touch/screen-reader behavior.
- Captions and transcript segments synchronize by stable time/speaker IDs; accessible errors distinguish unavailable media/captions/transcript. A non-virtualized paged transcript alternative is always available.
- Virtualized queues/transcripts preserve focused item, announce position/set size without spam, and restore focus after updates.
- Every timeline, continuity thread, progress graphic, evidence comparison, and visual diff has a semantic ordered-list/table/text alternative carrying the same information.
- Content stores/marks language and direction; mixed Unicode names, translated text provenance, locale/timezone dates, right-to-left/bidirectional text, and long translations are deterministic fixtures.
- Cognitive accessibility uses predictable nouns, plain-language summaries, confirmation of target/effect, a reduced-density preference, no disappearing action instructions, and consistent error/recovery language.
- Authentication warns before timeout, offers an accessible extension/reauthentication path, and preserves only policy-permitted drafts. Unsupported-browser, maintenance, required-upgrade, upload scan/quarantine/reject, quota, and notifications-disabled states are fully operable.

## Test matrix

| Layer | Coverage | Pass condition |
| --- | --- | --- |
| Axe | Chromium/WebKit/Firefox, every route/state at 1280/768/390 | Zero unwaived violations; 100% controls named. |
| Semantic DOM | all templates | one main/h1; valid headings/labels/landmarks/ARIA/IDs. |
| Keyboard | all routes, overlays, queues | every action; logical order; no trap; focus return. |
| Responsive | 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 320×568 | no page overflow/overlap; all workflows complete. |
| Zoom/text | 200%, 400% reflow equivalent, text-spacing override | no lost content/function or two-dimensional page scroll. |
| Screen reader | VoiceOver Safari/Chrome; NVDA Chrome/Firefox; TalkBack Android Chrome before release | landmarks, names, state, media, errors, dialogs, tables correct. |
| Touch | iOS Safari/Android Chrome | targets, sheets, virtual keyboard, safe areas pass. |
| Orientation | 768px tablet and 390px phone, portrait↔landscape during draft/dialog/media/session | route/subject/input/media/focus/scroll preserved; no overflow, obscured action, duplicate announcement, or remount loss. |
| Forced colors | Windows forced colors/OS increased contrast | controls, focus, state, selection perceivable. |
| Reduced motion | OS and product setting | all nonessential motion eliminated. |
| Content scale | 500 actions, 100 meetings, 100k transcript, long Unicode/RTL names/text | wrapping/virtualization/nonvirtual fallback/focus usable. |

## Release blockers

Any known A/AA failure, unnamed control, keyboard trap, obscured focus, page overflow, cross-role data flash, color-only trust state, non-reduced essentially decorative motion, inaccessible state/retry path, or missing core phone action blocks release. Accessibility waivers require a decision record and cannot waive privacy, identity, publication, or data-loss protections.

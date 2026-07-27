# B1-502M UX, Accessibility, and Domain Review

Recorded: 2026-07-27

## Product authority

Canonical artifact:
`_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`

Verified SHA-256:
`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`

The canonical artifact is a dark StoryForge V5 workspace. A prior light
parchment candidate was rejected before release and was never deployed.

## Corrected Matrix-owned experience

The release candidate provides:

- the approved dark typography, hierarchy, surfaces, ambient environments, and
  cyan/orange role accents;
- student navigation for Home, Story Library, Interview Prep, Notifications,
  and Settings;
- Quick Capture as the primary action;
- Back to Matrix on desktop, tablet, mobile, startup failure, and lockout
  surfaces;
- six real dark environment choices:
  Emberlight, Aurora, Night Constellation, Deep Tide, Meridian, and Static
  Dark;
- an authenticated, owner-bound server preference for the selected
  environment;
- no `localStorage` authorization or preference authority;
- truthful unavailable states for mentor review, AI, and audio;
- plain startup-failure copy with Retry and Back to Matrix;
- a ten-second bounded startup/request path rather than indefinite loading.

Local evidence images:

- `evidence/visual-reconciliation/storyforge-v5-student-home.png`;
- `evidence/visual-reconciliation/storyforge-v5-student-mobile.png`;
- `evidence/visual-reconciliation/storyforge-v5-approved-workspace.png`.

## Accessibility correction

The stable candidate includes:

- a keyboard skip link and semantic main/navigation/complementary landmarks;
- a useful `h1` and deterministic route focus handoff;
- announced startup, failure, lockout, and save states;
- responsive navigation names even where visual labels collapse;
- `aria-current` for the active route;
- programmatic selected state for capture modes, filters, queue buckets,
  scores, and environment choices;
- focus restoration after an authenticated environment change;
- visible focus indicators;
- reduced-motion handling and a nonanimated Static Dark choice;
- mobile safe-area spacing and no page-level horizontal overflow at the tested
  320 px mentor layout.

The final Vitruvius report records keyboard, axe, contrast, breakpoint,
reduced-motion, and production-founder evidence. Production checks remain
pending until the exact feature-off deployment and founder session are
available.

## Medical education and IMG domain review

Osler found the controlled founder workflow appropriate for residency
applicants and medical students:

- terminology is clinically and educationally responsible;
- private capture preserves learner agency;
- mentor/student roles are not misrepresented;
- AI suggestions are explicitly gated rather than fabricated;
- no fake audio success or transcription claim appears;
- no demo record is promoted to production;
- users are warned not to include protected patient information.

The zero-mentor workflow initially exposed an unsafe submission affordance.
That release blocker was repaired: the founder may capture and edit privately,
but submission is disabled and denied server-side until a real active mentor
assignment exists.

## Release disposition

The exact final Miyamoto, Vitruvius, Turing, Osler, and Sentinel dispositions
are appended after the rebuilt asset hashes and complete local suite are
verified.

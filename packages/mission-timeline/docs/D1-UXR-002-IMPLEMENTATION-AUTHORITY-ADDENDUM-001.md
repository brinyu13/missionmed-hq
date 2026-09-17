# D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001

## Founder implementation directive

| Field | Value |
|---|---|
| Status | **APPROVED — EFFECTIVE IMMEDIATELY** |
| Decision ID | `D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001` |
| Parent authority | `D1-UXR-001` |
| Recorded | 2026-07-29 |
| Scope | Non-material implementation-level accessibility and token adjustments |

## Delegated authority

The Design Freeze preserves founder-visible product intent. It does not require founder approval for implementation-level accessibility adjustments when all of the following remain true:

1. Founder-visible appearance is materially unchanged.
2. Accessibility improves or is maintained.
3. Product hierarchy, workflow, navigation, layout, interaction, wording, and behavior remain unchanged.
4. Brand identity is preserved.
5. The change is limited to implementation tokens, aliases, typography weights, spacing tokens, contrast tokens, hover/focus/disabled states, CSS variables, or equivalent engineering details.

The implementation team may autonomously resolve qualifying conflicts using senior engineering judgment. Every adjustment must record the original token, replacement token, reason, calculated contrast, and affected components in the Accessibility Report, Implementation Report, Acceptance Ledger, and Final Combined Handoff.

## Delegated examples

- accessibility contrast token substitutions;
- typography token substitutions;
- internal color aliases;
- hover and disabled opacity;
- focus-ring thickness or color;
- CSS custom-property changes;
- spacing-token normalization; and
- implementation-level responsive-token adjustments.

## Founder-retained decisions

Founder approval remains required for:

- navigation or workflow changes;
- wizard-structure changes;
- new or removed features;
- theme-philosophy or visual-hierarchy changes;
- copy changes that alter meaning;
- interaction-model or canvas-behavior changes;
- document-intake behavior;
- Guided versus Advanced behavior;
- export or advisor workflow; and
- adaptive-timeline algorithm changes.

## Existing adjustments governed by this authority

| Original | Replacement or treatment | Reason | Calculated evidence | Affected components |
|---|---|---|---|---|
| `accent.goldText #FFFFFF` on `accent.gold #B98A2E` | `#191C21` | Normal-size text contrast | 3.1168:1 → 5.4805:1 | Gold primary text and icons |
| Gold hover fill `#A67A26` beneath normal text | Preserve `#B98A2E` fill; use `#A67A26` as border/inset state cue | Preserve brand gold while keeping normal text at AA | text remains 5.4805:1; state cue exceeds 3:1 against white | Default, hover, active, selected gold buttons |
| 11px/650 micro-label `#8A9099` | `ink.secondary #565D66` | Normal-text contrast | 3.2160:1 / 2.9757:1 → 6.6597:1 / 6.1622:1 | All micro-label text |
| Meaningful 12px status/progress text `#8A9099` | `ink.secondary #565D66` | Preserve `#8A9099` for non-text/decorative use and meet normal-text contrast | 3.2160:1 / 2.9757:1 → 6.6597:1 / 6.1622:1 | Autosave status and Intake progress labels |
| Disabled primary text/border `#716A5F` / `#D6CEBF` on `#E5DDCE` | `ink.secondary #565D66` for text and border | Retain legibility and independently measurable boundary | text 3.9617:1 → 4.9363:1; border vs white 6.6597:1 | Disabled gold-primary state |

## Change control

This delegation does not authorize product-level reinterpretation. The implementation must continue the existing milestone order and preserve every no-touch, no-commit, no-push, no-deploy, and no-Matrix constraint.

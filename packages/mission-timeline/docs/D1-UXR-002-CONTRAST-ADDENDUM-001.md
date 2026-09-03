# D1-UXR-002-CONTRAST-ADDENDUM-001

## Founder decision — gold text contrast

| Field | Value |
|---|---|
| Status | **APPROVED** |
| Decision ID | `D1-UXR-002-CONTRAST-ADDENDUM-001` |
| Parent authority | `D1-UXR-001` |
| Recorded | 2026-07-29 |
| Scope | Normal-size text and icons rendered directly on MissionMed gold |

## Decision

Preserve the frozen MissionMed gold background token:

```css
--accent-gold: #B98A2E;
```

Where 14px text or normal-size icons are rendered directly on that gold background, use:

```css
--accent-gold-text: #191C21;
```

Do not use `#FFFFFF` text directly on `#B98A2E` where it fails the applicable WCAG 2.2 AA contrast requirement.

The accessibility requirement controls over the conflicting white-on-gold instruction. This decision is narrowly scoped. It does not authorize:

- changing `#B98A2E`;
- broader reinterpretation of the Design Freeze;
- changes to unrelated theme colors; or
- automatic use of dark text on other backgrounds.

White text remains permitted only where candidate-bound contrast testing proves it passes.

## Calculated evidence

Using the WCAG relative-luminance formula:

| Pair | Relative luminance | Contrast |
|---|---:|---:|
| `#FFFFFF` on `#B98A2E` | 1.000000 / 0.286885 | 3.1168:1 — FAIL for normal text |
| `#191C21` on `#B98A2E` | 0.011470 / 0.286885 | 5.4805:1 — PASS |
| `#FFFFFF` on hover `#A67A26` | 1.000000 / 0.221660 | 3.8651:1 — FAIL for normal text |

Candidate verification must independently test:

1. default;
2. hover;
3. active;
4. focus;
5. disabled;
6. selected;
7. text;
8. icons;
9. borders; and
10. focus indicators.

## Change control

This addendum resolves only the §3.1/§11.5 gold-text contradiction. All other D1-UXR-001 decisions and all D1-UXR-002 no-touch, no-commit, no-push, no-deploy, and no-Matrix constraints remain unchanged.

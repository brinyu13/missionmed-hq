# D1-UXR-002-CONTRAST-ADDENDUM-002

## Founder decision — micro-label text contrast

| Field | Value |
|---|---|
| Status | **APPROVED** |
| Decision ID | `D1-UXR-002-CONTRAST-ADDENDUM-002` |
| Parent authority | `D1-UXR-001` |
| Recorded | 2026-07-29 |
| Scope | 11px / 650 micro-label text on frozen shell surfaces |

## Decision

Preserve the frozen tertiary ink token:

```css
--ink-tertiary: #8A9099;
```

Use that token for non-text and decorative purposes only.

For 11px / 650 micro-label text, use:

```css
color: #565D66;
```

This is the frozen `ink.secondary` token. Do not use `#8A9099` for micro-label text on white or shell backgrounds where it fails the applicable WCAG 2.2 AA requirement.

This decision is narrowly scoped. It does not authorize:

- changing `ink.tertiary = #8A9099`;
- changing `ink.secondary = #565D66`;
- broader reinterpretation of the frozen ink-token roles;
- changing unrelated theme colors.

## Calculated evidence

Using the WCAG relative-luminance formula:

| Pair | Contrast | Verdict |
|---|---:|---|
| `#8A9099` on `#FFFFFF` | 3.2160:1 | FAIL for normal text |
| `#8A9099` on `#F7F6F3` | 2.9757:1 | FAIL for normal text |
| `#565D66` on `#FFFFFF` | 6.6597:1 | PASS |
| `#565D66` on `#F7F6F3` | 6.1622:1 | PASS |

## Required candidate verification

Verify affected micro-label text independently across:

1. Home;
2. Builder;
3. Canvas;
4. Export;
5. dialogs;
6. slide-overs;
7. toolbars;
8. empty states;
9. success and error states; and
10. responsive layouts.

Where applicable, verify default, hover, focus, disabled, selected, and reduced-opacity states. A state may pass only with candidate-bound rendered evidence.

## Change control

This addendum resolves only the §3.1/§11.5 micro-label-text contradiction. `D1-UXR-002-CONTRAST-ADDENDUM-001` remains controlling for normal-size text and icons directly on MissionMed gold. All other D1-UXR-001 decisions and every D1-UXR-002 no-touch, no-commit, no-push, no-deploy, and no-Matrix constraint remain unchanged.

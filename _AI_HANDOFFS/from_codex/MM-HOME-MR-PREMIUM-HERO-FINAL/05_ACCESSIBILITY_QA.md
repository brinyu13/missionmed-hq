# Accessibility QA

- Exactly one visible H1 on the homepage and dedicated hero.
- Homepage controls are native links, buttons, and a select; every compact control has a minimum 44px target.
- The dedicated mobile navigation is a native `details`/`summary` disclosure and exposes seven section links.
- Keyboard checks passed for previous, next, division selection, and pause/play.
- `prefers-reduced-motion: reduce` suppressed automatic homepage rotation over a 12.5-second observation.
- With no motion reduction, automatic rotation advanced exactly one frame after 12.5 seconds.
- Focus-visible styling is present; image alt text and live slide status are present; hidden slides are not duplicated as separate H1 elements.

## Key contrast ratios

| Pair | Ratio |
|---|---:|
| Homepage white / night | 17.96:1 |
| Homepage gold / night | 9.11:1 |
| Homepage light ink / paper | 13.92:1 |
| Homepage light support / paper | 7.01:1 |
| Homepage CTA ink / gold | 9.11:1 |
| Residency cream / ink | 14.38:1 |
| Residency gold / ink | 9.58:1 |
| Residency muted / ink | 7.89:1 |
| Residency button ink / cream | 14.91:1 |


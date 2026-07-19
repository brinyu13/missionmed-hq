# Y2-3101 Persona Packs and Interview Plans

## Synthetic Personas

| Persona | Style | Warmth/Directness | Status |
|---|---|---|---|
| `persona:warm-structured` | Warm, structured, measured | 4 / 2 | Synthetic Phase 0 |
| `persona:direct-program-director` | Direct, concise, professionally neutral | 2 / 4 | Synthetic Phase 0 |

Both packs use the `residency_interviewer` role, prohibit protected-topic solicitation and unsupported inference, accept only synthetic grounding sources, and have no voice reference.

## Probe Law

Both persona contracts preserve the governing IVOC law:

- pressure rungs 0-1: at most one probe;
- pressure rungs 2+: at most two probes;
- a total plan probe budget also applies;
- no third probe is permitted.

The frozen holdout contains persona descriptions permitting up to three probes. The evaluator records this contradiction and applies the stricter founder-controlled one/two law. Raw holdout chain-depth results therefore remain visible but cannot be used to weaken policy.

## Interview Plan

`core-img-interview.v1.json` defines:

- a synthetic text-only session objective;
- behavioral, situational, context, professional-timeline and general question families;
- required and optional coverage;
- bounded duration and total probes;
- transition, callback and wrap-up conditions;
- prohibited topics;
- explicit persona hash binding.

Holdout execution creates an evaluator-only synthetic plan for each case so the holdout question is active. Its question family is inferred from the visible question text; the hidden holdout category label cannot select that policy branch, as a regression test proves. This compatibility plan does not modify the frozen Brain policy or impersonate a production plan.

## Consistency Result

Development fixtures passed both warm and direct persona checks. The frozen holdout found that pressure rung did not create a measurable first-turn behavior difference in two difficulty pairs. T5 therefore failed despite zero unsafe persona output. This is a capability finding, not a persona safety breach.

## Future Law

Production persona authoring, specialty packs, program data, interviewer voices, avatar presentation, and applicant-aware materials remain out of scope. Any future pack requires versioning, content hashes, explicit grounding authority, fairness review, and Y1 feature gating.

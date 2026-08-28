# 14 — Demo Data Removal Audit

The immutable lock intentionally retains the founder-reviewed representative content. The generated student bundle does not.

Removed/disabled from production output:

- Brookdale representative depth
- Ignacio profile and applicant facts
- representative Gold/Silver tiers and hash-based fit
- resident composition percentages and representative visa facts
- seeded/simulated campaigns, costs, progress, queue, and review cards
- simulated CV extraction and profile writes
- membership preview escalation
- fake alumni count and connection behavior
- generated/research actions that imply a connected backend

Automated tests scan generated HTML/JS for the named demo seams and assert that no `window.RISE_DATA`, representative medical registry, localStorage-only persistence, random/hash fit, or simulated campaign write remains.

The only synthetic programs are in `rise/tests/browser/fixture-server.mjs`, use `example.test`, and run only with test/local-preview configuration. Production startup rejects preview auth and non-authorized source artifacts.

```text
DEMO_DATA_VISIBLE_TO_STUDENTS = NO
```

This is a statement about the production candidate bundle. No RISE student app is live at the current URL.

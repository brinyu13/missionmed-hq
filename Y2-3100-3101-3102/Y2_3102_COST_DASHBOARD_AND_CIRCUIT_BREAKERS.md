# Y2-3102 Cost Dashboard And Circuit Breakers

Status: specification only. No vendor account, spend, alert, or dashboard is activated.

## Dashboard

Show, by day and month:

- admitted, started, completed, abandoned, and denied sessions;
- MissionMed minutes, provider-reported minutes, and reconciliation delta;
- STT, model, TTS, rail, egress, and storage cost components;
- cost per session, per student, and per completed minute;
- 75%, 90%, and 100% usage warnings;
- cohort spend against the $75 breaker;
- unknown or missing provider reports;
- duplicate/replayed events and manual adjustments;
- current price-profile version and effective date.

No transcript, applicant content, bearer value, provider credential, or raw user identifier appears in cost telemetry.

## Circuit Breakers

- Hard deny before a new chargeable session when projected cohort spend would exceed $75.
- Hard deny when price configuration or provider usage reporting is missing/stale.
- Cap each session at the approved duration and terminate provider work after bounded grace.
- Stop automatic retries after a bounded attempt/cost budget.
- Pause a provider on reconciliation drift, duplicate billing, or anomalous unit price.
- Keep deletion and incident handling available while admissions are off.

The planning estimate of approximately $20-$52 monthly for 800 minutes is not a guarantee. It excludes labor, avatars, taxes, negotiated enterprise controls, and incident overhead.

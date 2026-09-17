# I1Q-1008A Monitoring

## Required Staging Signals

The future staging deployment must emit aggregate, privacy-safe signals for:

- app and API health
- auth success, failure class, expiry, and revocation
- permission and RLS denials
- database connection and query errors
- migration version and drift
- audit append and chain failures
- suspicious answer and restricted-source access
- deployment, restart, and rollback events
- frontend exceptions
- latency, error rate, memory, connection use, and uptime

No token, cookie, email, answer, explanation, raw transcript, source URL, patient data, student data, or request body may enter logs.

## Alert Defaults

Proposed defaults, pending provider authority:

- immediate page: auth bypass, answer/source access anomaly, audit failure, migration drift, repeated 5xx, or rollback failure
- urgent ticket: elevated permission denials, provider outage, p95 latency regression, or frontend error spike
- daily review: role changes, deployment summary, backup status, and feature-flag checksum

## Runbooks Required

- auth outage and revocation
- datastore outage
- broken or partial migration
- forward compensation and reapply
- failed deployment
- leaked credential
- suspicious answer or source access
- audit-chain anomaly
- unavailable staging

## Current Status

`DESIGN ONLY`: no staging telemetry source, provider integration, dashboard, alert route, log sink, or tested runbook exists. Monitoring is not operational.

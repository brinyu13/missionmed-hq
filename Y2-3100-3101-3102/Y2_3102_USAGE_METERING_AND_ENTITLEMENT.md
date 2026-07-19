# Y2-3102 Usage Metering And Entitlement

Status: operational specification only; no entitlement or billing system is changed.

## Admission Contract

Before a chargeable session, the server must atomically verify:

- authenticated active CAM authority session;
- D5-approved entitlement;
- all required purpose consents;
- individual monthly use below 80 minutes;
- rolling seven-day use below 40 minutes;
- requested duration within the session cap;
- cohort circuit breaker open;
- provider readiness and current rate profile known;
- one idempotent admission reservation.

Any missing, stale, conflicting, or unavailable authority fails closed before provider connection.

## Metering Events

Use immutable `ADMISSION_RESERVED`, `SESSION_STARTED`, `USAGE_PROVISIONAL`, `SESSION_ENDED`, `PROVIDER_RECONCILED`, `RESERVATION_RELEASED`, and `ADMIN_OVERRIDE_RECORDED` events. Every event carries a stable idempotency key, session ID, provider reference hash, quantity, unit, source, event time, received time, and supersession link.

Provider reports never directly overwrite MissionMed usage. Reconciliation compares provider quantity with MissionMed monotonic session duration and records a bounded adjustment.

## Warnings And Limits

- 75% warning: 60 of 80 monthly minutes.
- 90% warning: 72 minutes.
- 100%: deny new chargeable admission.
- No rollover and no paid top-ups during the pilot.
- Administrator override is server-derived, time-bounded, purpose-recorded, and cannot bypass consent or the cohort spend breaker.

Duplicate, delayed, out-of-order, or replayed usage events are idempotent. An abandoned reservation expires and is reconciled; it cannot silently consume a full session.

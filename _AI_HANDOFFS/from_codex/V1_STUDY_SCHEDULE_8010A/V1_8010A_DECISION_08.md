# V1-8010A Decision 08 — Temporal Law

**Status:** ACCEPTED

## Canonical temporal representation

Every scheduled occurrence stores:

- a UTC instant;
- IANA timezone;
- learner-local date/time intent;
- temporal-policy version;
- explicit fold choice for ambiguous local time;
- source/provenance and fixed-versus-flexible classification.

The learner Week begins Monday 00:00 in the learner-profile zone. The
06:00–24:00 canvas is a display window, not the civil-day boundary. A
cross-midnight Focus session belongs to the block’s start-day ledger while its
persisted segments retain exact instants.

## Zone changes and recurrence

Historical actuals, closeouts, Review records, and streak day keys never change
when a profile zone changes. Future flexible learner blocks preserve their local
wall-time intent in the new profile zone and rederive the instant. Future fixed
or external anchors preserve the versioned source instant and source zone.
Recurrence expands from local intent and policy, never by adding 24 hours in
UTC.

A nonexistent DST-gap input is rejected with a valid-slot suggestion. An
ambiguous fold requires an explicit earlier/later choice and is never guessed.

## Required proof

Property and integration tests cover spring gap, fall fold/both choices,
Monday/week boundaries in multiple zones, cross-midnight Focus and closeout,
zone change before/after closeout, recurrence across DST, fixed-anchor reimport,
and invariant historical streak keys. Naïve Calendar datetime values receive no
V1 temporal credit.

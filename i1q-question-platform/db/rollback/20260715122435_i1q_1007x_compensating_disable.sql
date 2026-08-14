-- Migration: 20260715122435_i1q_1007x_compensating_disable.sql
-- Ticket: I1Q-1007X
-- Authority: MissionMed OS DR-006; MR-078A; MR-078B; Architecture 1002.1
-- Target: RANKLISTIQ, additive schema i1q; OFFLINE APP-OWNED CANDIDATE ONLY
-- Date: 2026-07-15 UTC
-- Depends on: 20260715122434_i1q_1007x_question_platform.sql
-- Dependencies: i1q.disable_i1q_behavior(text, text)
-- Description: Disables every I1Q feature flag and appends one authoritative compensation audit event while preserving all data and history.
-- Idempotent: YES; the authoritative function keeps flags disabled and appends at most one audit event for this compensation ID.
-- Risk: LOW for behavior and NONE for retained records; application rollback and prior-release re-promotion remain separate controlled actions.
-- Rollback/Compensation: Forward-only compensation. Re-apply this file safely; do not drop, delete, or rewrite immutable history.

BEGIN;

SELECT i1q.disable_i1q_behavior(
  '20260715122435',
  'I1Q-1007X forward compensation; preserve all data and immutable history'
);

COMMIT;

# MX-APPT-5003G-R1 Guarded Live Deployment QA

Date: 2026-09-02

## Final status

- Production alias: rolled back and verified at legacy V1 SHA-256 `98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195`.
- Latest corrected V2 immutable artifact: `scheduler_v1.e9e480a9c72b.html`, SHA-256 `e9e480a9c72b41e9f63d63cc2fcccb818c19647b4a6e2dbd45d0d0f81d1a15f2`.
- Latest V2 LIVE status: not active.
- Release verdict: `BLOCKED_BACKEND_CANCEL / SAFE_ROLLBACK_COMPLETE`.

## Guarded activation sequence

1. Visual candidate `38201d0f3105...` was published immutably and byte-verified. Live student reschedule reached Review without the appointment provider catalogue and was blocked. No mutation occurred. Alias rolled back to V1.
2. Provider-hydration candidate `2e88e0b1f80a...` was published immutably and byte-verified. Reschedule reached the real endpoint; the endpoint returned `Cannot read properties of null (reading 'metadata')`. Matrix Calendar readback proved that the appointment had nevertheless moved to the requested replacement time. Alias rolled back to V1.
3. Fail-closed reconciliation candidate `e9e480a9c72b...` was published immutably and byte-verified. Reschedule returned the same downstream exception, but a fresh Upcoming readback proved the same appointment at the exact requested time; the client correctly rendered confirmation. The QA appointment was restored to its original time.
4. The cancellation dialog defaulted to Keep. After explicit confirmation, the cancel endpoint returned the same null-metadata exception. Fresh Upcoming and Matrix Calendar readback both showed the appointment still active, so cancellation did not commit. Alias rolled back to V1 immediately.

## Passed live evidence

- Authenticated designated-student StoryForge V2 rendering.
- Real catalogue: 14 appointment types.
- Home, Upcoming, History preview, Book Time, Review, and confirmation rendering.
- Provider hydration during reschedule.
- Original appointment retained until reschedule confirmation.
- Real reschedule request and exact server read-after-write reconciliation.
- Upcoming reflects the restored QA appointment time.
- Cancellation safety dialog defaults to Keep appointment.
- Matrix Calendar shows the same appointment state after reschedule and after failed cancellation.
- Immutable publication and public-CDN SHA-256 readback.
- Immediate byte-exact rollback after each material failure.
- Local suite: 6/6 PASS; adapter patch audit: 12/12 PASS.

## Open gates

- Backend cancellation contract: BLOCK. The read-only live backend throws a null-metadata exception and does not cancel the appointment.
- Booking/conflict mutation: not continued after cancellation produced the mandatory rollback condition.
- Student admin-denial route: direct JSON navigation was blocked by the designated Chrome extension before an application response could be observed; no live denial claim is made.
- Full 390/768/1024/1440 post-deploy matrix: not promoted because V2 was rolled back before the complete pass.
- Fresh non-builder release verification and general availability: not reached.

No backend, Supabase appointment data, entitlement, allowlist, Calendar, or unrelated Matrix source was modified by the implementation. The authorized QA reschedule changed the test appointment and then restored it to its original time. The attempted cancellation did not commit.

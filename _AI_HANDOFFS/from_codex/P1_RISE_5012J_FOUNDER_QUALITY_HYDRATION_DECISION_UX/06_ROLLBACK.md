# Rollback

Rollback remains executable without deleting canonical evidence.

1. Select Railway service `missionmed-rise` in production.
2. Redeploy protected deployment `d038a968-03ba-4180-82c2-9202173fb7f0` (`rise_web_0cc0c96e1630`) or rebuild exact commit `8ba7e054efc7b868e80a9d70dfea6e8949e0b790` through the authorized isolated RISE release path.
3. Verify `/api/rise/v1/health` directly.
4. Verify the normal WordPress RISE entry, authenticated admin/student flow, anonymous fail-closed behavior, registry 6,139, specialties 31, SOAP, My Programs, and Student Intel.

The 5012J promotion claims are append-only canonical evidence. A UI rollback does not require destructive evidence deletion. If a data presentation rollback is required, pin the serving layer to the prior release and preserve the 5012J claims for audit/review.


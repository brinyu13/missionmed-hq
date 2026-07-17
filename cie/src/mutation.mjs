import { sha256 } from "./canonical.mjs";
import { invariant } from "./errors.mjs";

const SAFE_KEY = /^[A-Za-z0-9._:-]{1,180}$/u;

export function createMutationEnvelope(meta, payload) {
  const idempotencyKey = String(meta?.idempotencyKey || "").trim();
  invariant(SAFE_KEY.test(idempotencyKey), 400, "IDEMPOTENCY_KEY_REQUIRED", "A caller-supplied Idempotency-Key is required");
  const expected = meta.expectedRowVersion === null || meta.expectedRowVersion === undefined ? null : Number(meta.expectedRowVersion);
  invariant(expected === null || (Number.isSafeInteger(expected) && expected >= 1), 400, "ROW_VERSION_INVALID", "Expected row version must be a positive integer");
  const requestId = String(meta.requestId || "").trim();
  invariant(SAFE_KEY.test(requestId), 400, "REQUEST_ID_REQUIRED", "A safe request ID is required");
  const correlationId = String(meta.correlationId || requestId).trim();
  invariant(SAFE_KEY.test(correlationId), 400, "CORRELATION_ID_INVALID", "Correlation ID is invalid");
  const causationId = meta.causationId ? String(meta.causationId).trim() : null;
  invariant(causationId === null || SAFE_KEY.test(causationId), 400, "CAUSATION_ID_INVALID", "Causation ID is invalid");
  return Object.freeze({
    idempotency_key: idempotencyKey,
    request_hash: sha256(payload),
    expected_row_version: expected,
    request_id: requestId,
    correlation_id: correlationId,
    causation_id: causationId
  });
}

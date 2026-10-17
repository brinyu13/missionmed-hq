import assert from "node:assert/strict";
import test from "node:test";

import { TimelineHttpApi } from "../src/api/http-api.js";
import { TimelineService } from "../src/domain/timeline-service.js";
import { InMemoryPrincipalDirectory, MatrixSessionExchange } from "../src/identity/matrix-identity.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { InMemoryPrivateObjectStore } from "../src/storage/private-object-store.js";
import { InMemoryTelemetrySink, PrivacySafeTelemetry } from "../src/telemetry/telemetry.js";
import { fixedClock, student } from "./fixtures.js";

class FailingOutboxRepository extends InMemoryTimelineRepository {
  override async addOutbox(): Promise<void> {
    throw new Error("forced outbox failure");
  }
}

test("API command rolls back document when its outbox write fails", async () => {
  const repository = new FailingOutboxRepository();
  const directory = new InMemoryPrincipalDirectory();
  directory.register({
    principalId: student.principalId,
    wpUserId: 42,
    role: "STUDENT",
    programIds: student.programIds,
    assignedDocumentIds: [],
    active: true,
  });
  const identity = new MatrixSessionExchange(directory, { verify: async () => true }, "0123456789abcdef0123456789abcdef", 600, fixedClock);
  const api = new TimelineHttpApi(
    new TimelineService(repository, fixedClock),
    identity,
    new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock),
    new PrivacySafeTelemetry(new InMemoryTelemetrySink(), "test", fixedClock),
  );
  const exchange = await api.handle(new Request("https://timeline.local/v1/session/exchange", { method: "POST" }), {
    wpUserId: 42,
    displayName: "Student",
    nonceVerified: true,
    sessionId: "matrix_session",
  });
  const { token } = await exchange.json();
  const response = await api.handle(new Request("https://timeline.local/v1/documents", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ id: "timeline_atomic", programId: student.programIds[0], title: "Atomic", document: { events: [] } }),
  }));
  assert.equal(response.status, 500);
  assert.equal(await repository.getDocument("timeline_atomic"), null);
  assert.equal(repository.count("outbox"), 0);
});

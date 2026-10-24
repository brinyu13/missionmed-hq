import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { TimelineService } from "../src/domain/timeline-service.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { document, event, fixedClock, student } from "./fixtures.js";

test("in-memory service vertical slice remains comfortably below local budget", async (t) => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  const started = performance.now();
  for (let index = 0; index < 100; index += 1) {
    const id = `timeline_perf_${index}`;
    await service.createDocument(student, {
      id,
      programId: "program_internal_medicine",
      title: `Timeline ${index}`,
      document: document({ id, events: [event({ id: `event_${index}` })] }),
    });
  }
  const elapsed = performance.now() - started;
  t.diagnostic(`100 create operations: ${elapsed.toFixed(2)} ms`);
  assert.equal(repository.count("documents"), 100);
  assert.ok(elapsed < 2_000, `local service budget exceeded: ${elapsed.toFixed(2)} ms`);
});

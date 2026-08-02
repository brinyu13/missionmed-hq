import { randomUUID } from "node:crypto";

export type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export interface MirJob<T = unknown> { id: string; kind: string; subjectId: string; payload: T; state: JobState; attempts: number; error?: string }

export class InMemoryJobQueue {
  readonly jobs: MirJob[] = [];
  enqueue<T>(kind: string, subjectId: string, payload: T): MirJob<T> {
    const job: MirJob<T> = { id: randomUUID(), kind, subjectId, payload, state: "queued", attempts: 0 };
    this.jobs.push(job);
    return job;
  }
  cancel(id: string): void {
    const job = this.jobs.find((item) => item.id === id);
    if (job && (job.state === "queued" || job.state === "running")) job.state = "cancelled";
  }
  async runNext(handlers: Record<string, (job: MirJob) => Promise<void>>): Promise<MirJob | undefined> {
    const job = this.jobs.find((item) => item.state === "queued");
    if (!job) return undefined;
    job.state = "running"; job.attempts += 1;
    try {
      const handler = handlers[job.kind];
      if (!handler) throw new Error(`NO_JOB_HANDLER:${job.kind}`);
      await handler(job);
      if ((job as MirJob).state !== "cancelled") job.state = "succeeded";
    } catch (error) {
      job.state = "failed"; job.error = error instanceof Error ? error.message : "unknown";
    }
    return job;
  }
}

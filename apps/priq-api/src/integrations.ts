export interface IntegrationHealth { name: string; status: "available" | "unavailable" | "incompatible"; detail: string }

export interface RiseClient {
  getProgram(programId: string): Promise<unknown>;
}
export interface StoryForgeClient {
  listStories(subjectId: string): Promise<Array<{ id: string; title: string; text: string; version: string }>>;
  createAnnotation(storyId: string, annotation: { claimId: string; note: string }): Promise<void>;
}
export interface TimelineClient { listEvents(subjectId: string): Promise<unknown[]> }
export interface IvPrepClient { publishPersonas(subjectId: string, packageData: unknown): Promise<void> }
export interface CamClient { publishObservation(subjectId: string, observation: unknown): Promise<void> }

export class UnavailableIntegration {
  constructor(readonly name: string, readonly detail: string) {}
  async health(): Promise<IntegrationHealth> { return { name: this.name, status: "unavailable", detail: this.detail }; }
}

export const siblingReality: IntegrationHealth[] = [
  { name: "RISE", status: "incompatible", detail: "Program registry exists, but the proposed PRIQ person/program endpoint is not canonical." },
  { name: "StoryForge", status: "incompatible", detail: "Real story APIs exist; the proposed annotations endpoint does not." },
  { name: "Timeline", status: "incompatible", detail: "Candidate TimelineService exists; proposed student events endpoint is not released." },
  { name: "IV Prep", status: "incompatible", detail: "DBOC interview runtime exists; canonical persona package endpoint does not." },
  { name: "CAM", status: "incompatible", detail: "Local event contract exists; external observations API is not released." },
];

export function assertStoryReferences(stories: Array<{ id: string; title: string; text: string; version: string }>, requestedIds: string[]): void {
  const ids = new Set(stories.map((story) => story.id));
  if (requestedIds.length === 0 || requestedIds.some((id) => !ids.has(id))) throw new Error("STORYFORGE_REFERENCE_NOT_FOUND");
}

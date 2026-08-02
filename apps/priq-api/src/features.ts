export interface FeatureFlags {
  mirEnabled: boolean;
  intakeEnabled: boolean;
  researchEnabled: boolean;
  profileEnabled: boolean;
  studentWorkspaceEnabled: boolean;
  copilotEnabled: boolean;
  debriefEnabled: boolean;
  writebacksEnabled: boolean;
  liveCopilotEnabled: boolean;
  profileLabEnabled: boolean;
  weightedBirdEnabled: boolean;
  videoAnalysisEnabled: boolean;
  founderNoteAiUseEnabled: boolean;
  studentPublicationEnabled: boolean;
  studentWorkspaceOverrideEnabled: boolean;
  humanReviewRequired: boolean;
}

export const lockedDefaults: FeatureFlags = {
  mirEnabled: true, intakeEnabled: true, researchEnabled: true, profileEnabled: true,
  studentWorkspaceEnabled: false, copilotEnabled: false, debriefEnabled: true, writebacksEnabled: false,
  liveCopilotEnabled: true, profileLabEnabled: true, weightedBirdEnabled: true,
  videoAnalysisEnabled: false, founderNoteAiUseEnabled: false, studentPublicationEnabled: false,
  studentWorkspaceOverrideEnabled: true, humanReviewRequired: true,
};

export class FeatureController {
  private flags: FeatureFlags;
  constructor(seed: FeatureFlags = lockedDefaults) { this.flags = { ...seed }; }
  get(): FeatureFlags { return { ...this.flags }; }
  set<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): FeatureFlags { this.flags[key] = value; return this.get(); }
  require(key: keyof FeatureFlags): void {
    if (!this.flags[key] || !this.flags.mirEnabled && key !== "mirEnabled") throw new Error(`FEATURE_DISABLED:${key}`);
  }
}

export interface Cue { id: string; detector: string; severity: "info" | "warning"; text: string; evidence: string; createdAt: string }

export class CueGovernor {
  private lastCueAt = 0;
  constructor(private readonly cooldownMs = 20_000) {}
  detect(transcript: string, now = Date.now()): Cue[] {
    if (now - this.lastCueAt < this.cooldownMs) return [];
    const normalized = transcript.toLowerCase();
    const cue = normalized.includes("um ") || normalized.startsWith("um")
      ? this.make("filler", "info", "Pause, then answer in one clear sentence.", "filler token observed", now)
      : normalized.split(/\s+/).length > 90
        ? this.make("answer_length", "warning", "Land the point: result, lesson, relevance.", "answer exceeded 90 words", now)
        : normalized.includes("i don't know") || normalized.includes("not sure")
          ? this.make("uncertainty", "info", "Name what you know, then describe how you would verify.", "uncertainty phrase observed", now)
          : undefined;
    if (!cue) return [];
    this.lastCueAt = now;
    return [cue];
  }
  private make(detector: string, severity: Cue["severity"], text: string, evidence: string, now: number): Cue {
    return { id: `cue:${now}:${detector}`, detector, severity, text, evidence, createdAt: new Date(now).toISOString() };
  }
}

export interface DebriefInput { subjectId: string; transcriptAvailable: boolean; cueIds: string[]; founderNotes: string[]; selfRating?: number }
export interface Debrief { status: "draft" | "blocked"; strengths: string[]; improvements: string[]; evidenceCueIds: string[]; limitations: string[] }

export function createDebrief(input: DebriefInput): Debrief {
  if (!input.transcriptAvailable && input.cueIds.length === 0 && input.founderNotes.length === 0) {
    return { status: "blocked", strengths: [], improvements: [], evidenceCueIds: [], limitations: ["No authorized interview evidence was available."] };
  }
  return {
    status: "draft",
    strengths: input.founderNotes.filter((note) => note.startsWith("strength:")).map((note) => note.slice(9).trim()),
    improvements: input.founderNotes.filter((note) => note.startsWith("improve:")).map((note) => note.slice(8).trim()),
    evidenceCueIds: [...input.cueIds], limitations: input.transcriptAvailable ? [] : ["Transcript unavailable; debrief is limited to cues and notes."],
  };
}

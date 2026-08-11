export class StoryFollowupError extends Error {
  constructor() {
    super('Story follow-up intelligence is not available in this release.');
    this.name = 'StoryFollowupError';
    this.code = 'story_followup_unavailable';
    this.status = 503;
  }
}

// B1-514 V2.1 compatibility seam only. There is deliberately no provider,
// prompt, artifact mutation, or activation path in this release.
export function createStoryFollowupService() {
  return Object.freeze({
    capability: async () => false,
    ask: async () => { throw new StoryFollowupError(); },
  });
}

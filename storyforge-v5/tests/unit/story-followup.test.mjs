import assert from 'node:assert/strict';
import test from 'node:test';

import { createStoryFollowupService, StoryFollowupError } from '../../server/story-followup.mjs';

test('V2.1 story follow-up seam is permanently unavailable and owns no provider', async () => {
  const service = createStoryFollowupService();
  assert.equal(await service.capability({ role: 'student', eligible: true }), false);
  await assert.rejects(
    () => service.ask({}, { storyId: 'private', prompt: 'private' }),
    (error) => error instanceof StoryFollowupError
      && error.code === 'story_followup_unavailable'
      && error.status === 503,
  );
  assert.deepEqual(Object.keys(service).sort(), ['ask', 'capability']);
});

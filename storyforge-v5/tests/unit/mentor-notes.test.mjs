import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MentorNotesError,
  createMentorNotesService,
  mentorNotesForceOff,
} from '../../server/mentor-notes.mjs';

const ADMIN = Object.freeze({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'admin',
  eligible: true,
});
const STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
});
const STORY = '22222222-2222-4222-8222-222222222222';
const NOTE = '33333333-3333-4333-8333-333333333333';

function fixture({ query } = {}) {
  const calls = [];
  const objects = new Map();
  const withIdentity = async (identity, operation) => operation({
    async query(text, values = []) {
      calls.push({ identity, text, values });
      if (query) return query({ identity, text, values, calls });
      if (text.includes('sf_mentor_notes_enabled')) return { rows: [{ enabled: true }] };
      return { rows: [{ payload: { id: NOTE, rowVersion: 1 } }] };
    },
  });
  const storage = {
    async putRecordingSegment({ objectKey, contentType, body }) {
      objects.set(objectKey, { contentType, body: Buffer.from(body) });
    },
    async headAudioObject({ objectKey }) {
      const item = objects.get(objectKey);
      return { contentType: item.contentType, byteSize: item.body.byteLength };
    },
    async deleteRecordingObjects({ objectKeys }) {
      objectKeys.forEach((objectKey) => objects.delete(objectKey));
    },
  };
  const transcription = {
    available: true,
    async transcribeSegment(input) {
      return {
        text: 'Accurate mentor transcript.',
        providerId: 'provider',
        modelId: 'model',
        input,
      };
    },
  };
  return { calls, objects, storage, transcription, withIdentity };
}

test('mentor-note runtime kill switch defaults closed', () => {
  assert.equal(mentorNotesForceOff({}), true);
  assert.equal(mentorNotesForceOff({ STORYFORGE_MENTOR_NOTES_FORCE_OFF: '1' }), true);
  assert.equal(mentorNotesForceOff({ STORYFORGE_MENTOR_NOTES_FORCE_OFF: '0' }), false);
  assert.equal(mentorNotesForceOff({ STORYFORGE_MENTOR_NOTES_FORCE_OFF: 'off' }), false);
});

test('student may list published notes through RLS but cannot create reviewer notes', async () => {
  const fake = fixture();
  const service = createMentorNotesService({
    ...fake,
    signPlayback: async () => ({ playbackUrl: 'https://private.invalid', expiresIn: 300 }),
    environment: { STORYFORGE_MENTOR_NOTES_FORCE_OFF: '0' },
  });
  assert.deepEqual(await service.list(STUDENT, STORY), { id: NOTE, rowVersion: 1 });
  await assert.rejects(
    service.create(STUDENT, STORY, { body: 'No', internalOnly: false }),
    (error) => error instanceof MentorNotesError
      && error.code === 'mentor_note_reviewer_required'
      && error.status === 403,
  );
});

test('reviewer mutations are force-off and database-capability gated', async () => {
  const fake = fixture();
  const service = createMentorNotesService({
    ...fake,
    signPlayback: async () => ({ playbackUrl: 'https://private.invalid', expiresIn: 300 }),
    environment: {},
  });
  assert.equal(await service.capability(ADMIN), false);
  await assert.rejects(
    service.create(ADMIN, STORY, { body: 'Feedback' }),
    (error) => error.code === 'mentor_notes_disabled' && error.status === 403,
  );
  await assert.rejects(
    service.list(STUDENT, STORY),
    (error) => error.code === 'mentor_notes_disabled' && error.status === 403,
  );
  await assert.rejects(
    service.playback(STUDENT, NOTE),
    (error) => error.code === 'mentor_notes_disabled' && error.status === 403,
  );
  assert.equal(fake.calls.length, 0);
});

test('audio uses isolated mentor namespace and completes only after storage verification and transcription', async () => {
  const fake = fixture({
    query({ text, values }) {
      if (text.includes('sf_mentor_notes_enabled')) return { rows: [{ enabled: true }] };
      if (text.includes('sf_prepare_mentor_note_audio')) {
        return { rows: [{ payload: {
          id: NOTE,
          authorId: ADMIN.sub,
          studentId: STUDENT.sub,
          storyId: STORY,
          nextVersion: 2,
        } }] };
      }
      if (text.includes('sf_begin_mentor_note_audio')) {
        assert.match(
          values[2],
          new RegExp(`^storyforge-mentor-notes/${ADMIN.sub}/${STUDENT.sub}/${STORY}/${NOTE}/[a-f0-9-]+\\.webm$`),
        );
        return { rows: [{ payload: { id: NOTE, rowVersion: 2 } }] };
      }
      if (text.includes('sf_complete_mentor_note_audio')) {
        assert.equal(values[3], 'Accurate mentor transcript.');
        return { rows: [{ payload: { id: NOTE, rowVersion: 3, state: 'draft' } }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  });
  const service = createMentorNotesService({
    ...fake,
    signPlayback: async () => ({ playbackUrl: 'https://private.invalid', expiresIn: 300 }),
    environment: { STORYFORGE_MENTOR_NOTES_FORCE_OFF: '0' },
  });
  const note = await service.uploadAudio(ADMIN, NOTE, {
    expectedVersion: 1,
    mimeType: 'audio/webm',
    buffer: Buffer.from('private-audio'),
  });
  assert.equal(note.rowVersion, 3);
  assert.equal(fake.objects.size, 1);
  assert.equal([...fake.objects.keys()][0].startsWith('storyforge-audio/'), false);
  assert.equal([...fake.objects.keys()][0].startsWith('storyforge-rec/'), false);
});

test('discard deletes isolated audio only after a durable deletion intent and resolves that intent by note id', async () => {
  const objectKey = `storyforge-mentor-notes/${ADMIN.sub}/${STUDENT.sub}/${STORY}/${NOTE}/12345678-1234-4234-8234-123456789abc.webm`;
  const fake = fixture({
    query({ text, values }) {
      if (text.includes('sf_mentor_notes_enabled')) return { rows: [{ enabled: true }] };
      if (text.includes('sf_discard_mentor_note')) {
        return { rows: [{ payload: { noteId: NOTE, objectKey, state: 'archived', rowVersion: 2 } }] };
      }
      if (text.includes('sf_complete_mentor_note_audio_delete')) {
        assert.deepEqual(values, [NOTE, objectKey]);
        return { rows: [{ payload: null }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  });
  fake.objects.set(objectKey, { contentType: 'audio/webm', body: Buffer.from('private-audio') });
  const service = createMentorNotesService({
    ...fake,
    signPlayback: async () => ({ playbackUrl: 'https://private.invalid', expiresIn: 300 }),
    environment: { STORYFORGE_MENTOR_NOTES_FORCE_OFF: '0' },
  });
  const discarded = await service.discard(ADMIN, NOTE, { expectedVersion: 1 });
  assert.equal(discarded.noteId, NOTE);
  assert.equal(discarded.objectKey, undefined);
  assert.equal(fake.objects.has(objectKey), false);
});

test('database privacy and conflict errors are sanitized', async () => {
  const fake = fixture({
    query({ text }) {
      if (text.includes('sf_mentor_notes_enabled')) return { rows: [{ enabled: true }] };
      const error = new Error('private serialization detail');
      error.code = '40001';
      throw error;
    },
  });
  const service = createMentorNotesService({
    ...fake,
    signPlayback: async () => ({ playbackUrl: 'https://private.invalid', expiresIn: 300 }),
    environment: { STORYFORGE_MENTOR_NOTES_FORCE_OFF: '0' },
  });
  await assert.rejects(
    service.update(ADMIN, NOTE, { expectedVersion: 1, body: 'Changed' }),
    (error) => error.code === 'mentor_note_conflict'
      && error.status === 409
      && !error.message.includes('serialization'),
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import {
  createAppServer,
  defaultQuestionAgendaItems,
  defaultStoryAgendaItems,
  publicError,
} from '../../server/app.mjs';
import { verifyToken } from '../../server/auth.mjs';

const encoder = new TextEncoder();
const signingKey = encoder.encode('runtime-contract-unit-secret-at-least-32-bytes');
const issuer = 'storyforge-runtime-contract-test';
const audience = 'storyforge';

async function signedToken({ algorithm = 'HS256', subject = '11111111-1111-4111-8111-111111111111' } = {}) {
  return new SignJWT({
    app_role: 'student',
    storyforge_eligible: true,
    wp_user_id: 101,
  })
    .setProtectedHeader({ alg: algorithm })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(signingKey);
}

async function loadConfig(environment) {
  const names = [
    'PORT',
    'STORYFORGE_PORT',
    'STORYFORGE_DEV_AUTH',
    'STORYFORGE_ORIGIN_API_ONLY',
    'STORYFORGE_BASE_PATH',
    'STORYFORGE_JWKS_URL',
    'STORYFORGE_JWT_SECRET',
    'STORYFORGE_TRANSCRIBE_PROVIDER',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, environment);
    return await import(`../../server/config.mjs?runtime-contract=${crypto.randomUUID()}`);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test('provider PORT is used only when STORYFORGE_PORT is absent', async () => {
  const providerOnly = await loadConfig({ PORT: '5123' });
  assert.equal(providerOnly.config.port, 5123);

  const explicit = await loadConfig({ PORT: '5123', STORYFORGE_PORT: '6123' });
  assert.equal(explicit.config.port, 6123);
});

test('production shared-secret auth requires at least 32 characters', async () => {
  const shortSecret = await loadConfig({ STORYFORGE_JWT_SECRET: 'x'.repeat(31) });
  assert(shortSecret.validateConfig().includes(
    'STORYFORGE_JWT_SECRET must contain at least 32 characters',
  ));

  const minimumSecret = await loadConfig({ STORYFORGE_JWT_SECRET: 'x'.repeat(32) });
  assert(!minimumSecret.validateConfig().includes(
    'STORYFORGE_JWT_SECRET must contain at least 32 characters',
  ));
});

test('the public Railway origin is API-only by default outside local fixture mode', async () => {
  const production = await loadConfig({});
  assert.equal(production.config.originApiOnly, true);

  const fixture = await loadConfig({ STORYFORGE_DEV_AUTH: 'true' });
  assert.equal(fixture.config.originApiOnly, false);
});

test('production rejects standalone SPA serving and a noncanonical Matrix base path', async () => {
  const standalone = await loadConfig({ STORYFORGE_ORIGIN_API_ONLY: 'false' });
  assert(standalone.validateConfig().includes(
    'production requires STORYFORGE_ORIGIN_API_ONLY=true',
  ));

  const escapedBase = await loadConfig({ STORYFORGE_BASE_PATH: '/another-app/' });
  assert(escapedBase.validateConfig().includes(
    'production requires STORYFORGE_BASE_PATH=/storyforge/',
  ));

  const canonical = await loadConfig({
    STORYFORGE_ORIGIN_API_ONLY: 'true',
    STORYFORGE_BASE_PATH: '/storyforge/',
  });
  assert(!canonical.validateConfig().includes(
    'production requires STORYFORGE_ORIGIN_API_ONLY=true',
  ));
  assert(!canonical.validateConfig().includes(
    'production requires STORYFORGE_BASE_PATH=/storyforge/',
  ));
});

test('transcription stays in the authorized provider-off mode until authority is amended', async () => {
  const defaultOff = await loadConfig({});
  assert.equal(defaultOff.config.transcription.provider, 'none');
  assert(!defaultOff.validateConfig().some((error) => (
    error.startsWith('STORYFORGE_TRANSCRIBE_PROVIDER')
  )));

  const explicitOff = await loadConfig({
    STORYFORGE_TRANSCRIBE_PROVIDER: ' NoNe ',
  });
  assert.equal(explicitOff.config.transcription.provider, 'none');

  const unapproved = await loadConfig({
    STORYFORGE_TRANSCRIBE_PROVIDER: 'unapproved-provider',
  });
  assert(unapproved.validateConfig().includes(
    'STORYFORGE_TRANSCRIBE_PROVIDER must remain none until provider authority is amended',
  ));
});

test('shared-secret verification accepts HS256 and rejects another HMAC algorithm', async () => {
  const valid = await verifyToken(await signedToken(), {
    key: signingKey,
    issuer,
    audience,
  });
  assert.equal(valid.sub, '11111111-1111-4111-8111-111111111111');

  await assert.rejects(
    verifyToken(await signedToken({ algorithm: 'HS384' }), {
      key: signingKey,
      issuer,
      audience,
    }),
    (error) => error.code === 'ERR_JOSE_ALG_NOT_ALLOWED',
  );
});

test('subject validation requires a canonical UUID with a valid version and variant', async () => {
  await assert.rejects(
    verifyToken(await signedToken({
      subject: '1111111-11111-4111-8111-111111111111',
    }), { key: signingKey, issuer, audience }),
    (error) => error.code === 'invalid_subject_claim',
  );
  await assert.rejects(
    verifyToken(await signedToken({
      subject: '11111111-1111-4111-7111-111111111111',
    }), { key: signingKey, issuer, audience }),
    (error) => error.code === 'invalid_subject_claim',
  );
});

test('public health response exposes only stable service status fields', async (context) => {
  const server = createAppServer({
    checkHealth: async () => ({
      database: 'private-database-name',
      project: 'private-project-id',
      version: 'private-version',
    }),
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'storyforge-v5',
  });
});

test('malformed bearer tokens fail as private 401 responses without reaching the database', async (context) => {
  const server = createAppServer();
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/session`, {
    headers: { Authorization: 'Bearer malformed' },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal((await response.json()).error.code, 'ERR_JWS_INVALID');
});

test('signed identity-claim failures are rejected without becoming internal errors', () => {
  for (const code of ['invalid_token_identifier_claim', 'invalid_wp_user_id_claim']) {
    const error = new Error('issuer claim rejected');
    error.code = code;
    assert.deepEqual(publicError(error), {
      status: 403,
      code,
      message: 'issuer claim rejected',
    });
  }
});

test('default 1:1 story agenda is derived only from durable review state', () => {
  assert.deepEqual(defaultStoryAgendaItems([
    {
      id: 'story-revised',
      title: 'A revised advocacy story',
      status: 'awaiting',
      revised: true,
      mentor_score: 4,
    },
    {
      id: 'story-review',
      title: 'A first-review story',
      status: 'awaiting',
      revised: false,
      mentor_score: null,
    },
    {
      id: 'story-changes',
      title: 'A story awaiting changes',
      status: 'changes',
      revised: false,
      mentor_score: 3,
    },
    {
      id: 'story-score',
      title: 'A reviewed but unscored story',
      status: 'reviewed',
      revised: false,
      mentor_score: null,
    },
    {
      id: 'story-complete',
      title: 'A finished story',
      status: 'approved',
      revised: false,
      mentor_score: 5,
    },
  ]), [
    {
      label: 'Re-review the revision of “A revised advocacy story”',
      storyId: 'story-revised',
      route: '/library',
    },
    {
      label: 'First review: “A first-review story”',
      storyId: 'story-review',
      route: '/library',
    },
    {
      label: 'Walk through requested changes on “A story awaiting changes”',
      storyId: 'story-changes',
      route: '/library',
    },
    {
      label: 'Score “A reviewed but unscored story”',
      storyId: 'story-score',
      route: '/library',
    },
    {
      label: 'Discuss “A finished story”',
      storyId: 'story-complete',
      route: '/library',
    },
  ]);
});

test('default 1:1 question agenda names only persisted readiness gaps', () => {
  assert.deepEqual(defaultQuestionAgendaItems([
    {
      id: 'question-unmapped',
      text: 'Tell me about yourself.',
      pair_count: 0,
      confirmed_count: 0,
      preferred_story_id: null,
      followup_count: 0,
      prepared_followup_count: 0,
    },
    {
      id: 'question-unconfirmed',
      text: 'Tell me about a difficult team decision.',
      pair_count: 2,
      confirmed_count: 0,
      preferred_story_id: null,
      followup_count: 0,
      prepared_followup_count: 0,
    },
    {
      id: 'question-no-preference',
      text: 'Why this specialty?',
      pair_count: 1,
      confirmed_count: 1,
      preferred_story_id: null,
      followup_count: 1,
      prepared_followup_count: 1,
    },
    {
      id: 'question-no-followup',
      text: 'Describe a challenging clinical decision.',
      pair_count: 1,
      confirmed_count: 1,
      preferred_story_id: 'story-clinical',
      followup_count: 0,
      prepared_followup_count: 0,
    },
    {
      id: 'question-ready',
      text: 'What do you do outside medicine?',
      pair_count: 1,
      confirmed_count: 1,
      preferred_story_id: 'story-personal',
      followup_count: 1,
      prepared_followup_count: 1,
    },
  ]), [
    {
      label: 'Find a story for “Tell me about yourself.”',
      questionId: 'question-unmapped',
      route: '/prep',
    },
    {
      label: 'Confirm the strongest story for “Tell me about a difficult team decision.”',
      questionId: 'question-unconfirmed',
      route: '/prep',
    },
    {
      label: 'Choose the preferred story for “Why this specialty?”',
      questionId: 'question-no-preference',
      route: '/prep',
    },
    {
      label: 'Prepare a follow-up for “Describe a challenging clinical decision.”',
      questionId: 'question-no-followup',
      route: '/prep',
    },
  ]);
});

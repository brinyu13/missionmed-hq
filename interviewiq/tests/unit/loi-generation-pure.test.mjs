import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionEnabled, compositionCommands, providerAvailable } from '../../server/loi-generation.mjs';
import { LOI_CANARY_OWNER, LOI_CANARY_WP_USER_ID, LOI_AUTHORIZATION, canaryPolicy } from '../../server/loi-openai.mjs';

// ── compositionCommands ───────────────────────────────────────────────

test('compositionCommands is a Set of 5 composition actions', () => {
  assert.ok(compositionCommands instanceof Set);
  assert.equal(compositionCommands.size, 5);
  assert.ok(compositionCommands.has('loi.preference_read'));
  assert.ok(compositionCommands.has('loi.preference_save'));
  assert.ok(compositionCommands.has('loi.generate'));
  assert.ok(compositionCommands.has('loi.generation_read'));
  assert.ok(compositionCommands.has('loi.generation_select'));
});

// ── compositionEnabled ────────────────────────────────────────────────

function validConfig() {
  return {
    loiComposition: { enabled: true },
    loi: {
      enabled: true,
      mode: 'CANARY',
      ownerId: LOI_CANARY_OWNER,
      programId: 'some_program',
    },
  };
}

function validActor() {
  return {
    id: LOI_CANARY_OWNER,
    wpUserId: LOI_CANARY_WP_USER_ID,
    role: 'student',
    eligible: true,
    tier: '360',
  };
}

test('compositionEnabled returns true for valid config and actor', () => {
  assert.equal(compositionEnabled(validConfig(), validActor()), true);
});

test('compositionEnabled returns true with ivprep_complete tier', () => {
  assert.equal(compositionEnabled(validConfig(), { ...validActor(), tier: 'ivprep_complete' }), true);
});

test('compositionEnabled returns false when loiComposition not enabled', () => {
  const config = validConfig();
  config.loiComposition.enabled = false;
  assert.equal(compositionEnabled(config, validActor()), false);
});

test('compositionEnabled returns false when loiComposition missing', () => {
  const config = validConfig();
  delete config.loiComposition;
  assert.equal(compositionEnabled(config, validActor()), false);
});

test('compositionEnabled returns false when loi not enabled', () => {
  const config = validConfig();
  config.loi.enabled = false;
  assert.equal(compositionEnabled(config, validActor()), false);
});

test('compositionEnabled returns false for non-student role', () => {
  assert.equal(compositionEnabled(validConfig(), { ...validActor(), role: 'admin' }), false);
});

test('compositionEnabled returns false for ineligible actor', () => {
  assert.equal(compositionEnabled(validConfig(), { ...validActor(), eligible: false }), false);
});

test('compositionEnabled returns false for wrong tier', () => {
  assert.equal(compositionEnabled(validConfig(), { ...validActor(), tier: 'basic' }), false);
});

test('compositionEnabled throws for null actor', () => {
  assert.throws(() => compositionEnabled(validConfig(), null));
});

test('compositionEnabled returns false when CANARY mode lacks ownerId', () => {
  const config = validConfig();
  delete config.loi.ownerId;
  assert.equal(compositionEnabled(config, validActor()), false);
});

test('compositionEnabled returns true in ELIGIBLE mode without ownerId', () => {
  const config = validConfig();
  config.loi.mode = 'ELIGIBLE';
  delete config.loi.ownerId;
  assert.equal(compositionEnabled(config, validActor()), true);
});

test('compositionEnabled returns false when actor id does not match ownerId', () => {
  const actor = validActor();
  actor.id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  assert.equal(compositionEnabled(validConfig(), actor), false);
});

// ── providerAvailable ─────────────────────────────────────────────────

function validCompositionConfig() {
  return {
    loiComposition: {
      enabled: true,
      aiEnabled: true,
      dailyBudgetMicros: 100000,
      dailyRequests: 10,
      maxCostMicros: 50000,
      authorizationId: LOI_AUTHORIZATION,
      canaryOwnerId: LOI_CANARY_OWNER,
      model: 'gpt-5-nano-2025-08-07',
      maxInputTokens: 400000,
      maxOutputTokens: 4096,
      lifetimeBudgetMicros: 500000,
      timeoutMs: 15000,
    },
    loi: {
      enabled: true,
      mode: 'CANARY',
      ownerId: LOI_CANARY_OWNER,
      programId: 'some_program',
    },
  };
}

function validComposer(config) {
  const c = config.loiComposition;
  return {
    compose: () => {},
    inputWithinBounds: () => true,
    policy: {
      singleRequest: true,
      noRetries: true,
      guaranteesMaxCost: true,
      serviceTier: 'default',
      costBasis: 'FULL_CONTEXT_UNCACHED_UPPER_BOUND',
      authorizationId: c.authorizationId,
      canaryOwnerId: c.canaryOwnerId,
      model: c.model,
      maxInputTokens: c.maxInputTokens,
      maxOutputTokens: c.maxOutputTokens,
      maxCostMicros: c.maxCostMicros,
      lifetimeBudgetMicros: c.lifetimeBudgetMicros,
      timeoutMs: c.timeoutMs,
    },
  };
}

test('providerAvailable returns true for valid config, composer, and actor', () => {
  const config = validCompositionConfig();
  assert.equal(providerAvailable(config, validComposer(config), validActor()), true);
});

test('providerAvailable returns false when aiEnabled is false', () => {
  const config = validCompositionConfig();
  config.loiComposition.aiEnabled = false;
  assert.equal(providerAvailable(config, validComposer(config), validActor()), false);
});

test('providerAvailable returns false when actor is not canary actor', () => {
  const config = validCompositionConfig();
  const actor = { ...validActor(), id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' };
  assert.equal(providerAvailable(config, validComposer(config), actor), false);
});

test('providerAvailable returns false when composer lacks compose function', () => {
  const config = validCompositionConfig();
  const composer = validComposer(config);
  delete composer.compose;
  assert.equal(providerAvailable(config, composer, validActor()), false);
});

test('providerAvailable returns false when composer lacks inputWithinBounds function', () => {
  const config = validCompositionConfig();
  const composer = validComposer(config);
  delete composer.inputWithinBounds;
  assert.equal(providerAvailable(config, composer, validActor()), false);
});

test('providerAvailable returns false when composer policy singleRequest is false', () => {
  const config = validCompositionConfig();
  const composer = validComposer(config);
  composer.policy.singleRequest = false;
  assert.equal(providerAvailable(config, composer, validActor()), false);
});

test('providerAvailable returns false when composer policy noRetries is false', () => {
  const config = validCompositionConfig();
  const composer = validComposer(config);
  composer.policy.noRetries = false;
  assert.equal(providerAvailable(config, composer, validActor()), false);
});

test('providerAvailable returns false when composer policy model mismatches', () => {
  const config = validCompositionConfig();
  const composer = validComposer(config);
  composer.policy.model = 'wrong-model';
  assert.equal(providerAvailable(config, composer, validActor()), false);
});

test('providerAvailable returns false when dailyBudgetMicros below maxCostMicros', () => {
  const config = validCompositionConfig();
  config.loiComposition.dailyBudgetMicros = 10;
  assert.equal(providerAvailable(config, validComposer(config), validActor()), false);
});

test('providerAvailable returns false when dailyRequests is 0', () => {
  const config = validCompositionConfig();
  config.loiComposition.dailyRequests = 0;
  assert.equal(providerAvailable(config, validComposer(config), validActor()), false);
});

test('providerAvailable returns false for null composer', () => {
  const config = validCompositionConfig();
  assert.equal(providerAvailable(config, null, validActor()), false);
});

test('providerAvailable returns false when canaryPolicy fails', () => {
  const config = validCompositionConfig();
  config.loiComposition.canaryOwnerId = 'wrong-owner';
  assert.equal(providerAvailable(config, validComposer(config), validActor()), false);
});

test('providerAvailable returns false when serviceTier mismatches', () => {
  const config = validCompositionConfig();
  const composer = validComposer(config);
  composer.policy.serviceTier = 'premium';
  assert.equal(providerAvailable(config, composer, validActor()), false);
});

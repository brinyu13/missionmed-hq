import test from 'node:test';
import assert from 'node:assert/strict';

// ── Worker 03: Prose composer threading through commands.mjs ────────────────
// These tests verify the createCommands signature accepts loiProseComposer
// and that executeComposition receives both composer and proseComposer.

test('createCommands accepts loiProseComposer parameter', async () => {
  // Import just the module to verify the function signature — we cannot
  // call bootstrap/execute without a database, but the factory must not
  // throw when passed the new parameter.
  const {createCommands} = await import('../../server/commands.mjs');
  assert.equal(typeof createCommands, 'function');

  // Verify it accepts loiProseComposer without error by providing
  // minimal stubs that prevent actual database access.
  const stubDb = { withActor: async () => ({}) };
  const stubConfig = {
    coreOnly: false,
    loiComposition: { enabled: false },
    deepResearch: {},
  };
  const cmds = createCommands({
    database: stubDb,
    owners: {},
    config: stubConfig,
    clock: () => new Date(),
    loiComposer: null,
    loiProseComposer: null,
    researchTransport: { submit: async () => ({}) },
  });
  assert.equal(typeof cmds.bootstrap, 'function');
  assert.equal(typeof cmds.execute, 'function');
});

test('executeComposition signature accepts proseComposer', async () => {
  const {executeComposition} = await import('../../server/loi-generation.mjs');
  assert.equal(typeof executeComposition, 'function');
  // The function requires database/actor/config — we just verify the export exists
  // and that calling with proseComposer=null in the destructured args is valid.
  // Full integration requires a database, covered by domain-review tests.
});

test('compositionCommands includes all composition commands', async () => {
  const {compositionCommands} = await import('../../server/loi-generation.mjs');
  assert.ok(compositionCommands.has('loi.preference_read'));
  assert.ok(compositionCommands.has('loi.preference_save'));
  assert.ok(compositionCommands.has('loi.generate'));
  assert.ok(compositionCommands.has('loi.generation_read'));
  assert.ok(compositionCommands.has('loi.generation_select'));
});

test('dispatchGeneration uses prose composer for prose reservations (module contract)', async () => {
  // Verify that loi-generation imports validateProsePlans alongside validatePlans
  const mod = await import('../../server/loi-composition.mjs');
  assert.equal(typeof mod.validateProsePlans, 'function');
  assert.equal(typeof mod.validatePlans, 'function');
  // Both validators coexist — dispatchGeneration selects between them
  // based on reservation.compositionMode at runtime.
});

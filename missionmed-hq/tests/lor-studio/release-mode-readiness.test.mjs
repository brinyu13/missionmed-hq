import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOR_RELEASE_MODE_READINESS,
  LOR_RELEASE_MODE_READINESS_CONTRACT,
  isLorReleaseModeDark,
  isLorReleaseModeReadinessAccepted,
  readExactLorReleaseFlags,
  resolveLorReleaseModeReadiness,
} from '../../lor-studio/adapters/release-mode-readiness.mjs';

function flags(overrides = {}) {
  return {
    enabled: true,
    killSwitch: false,
    requireCanary: true,
    ...overrides,
  };
}

function readiness(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.dependency-health.v1',
    service: 'missionmed-lor-studio',
    at: '2026-08-27T12:00:00.000Z',
    status: 'ready',
    reason: 'all_dependencies_ready',
    productionOperational: true,
    dependencies: Object.freeze({}),
    databaseProbeGroups: Object.freeze({}),
    ...overrides,
  };
}

test('release-mode readiness accepts only active-ready or canonical dark-closed coupling', () => {
  assert.equal(
    resolveLorReleaseModeReadiness(flags(), readiness()),
    LOR_RELEASE_MODE_READINESS.ACTIVE_READY,
  );
  assert.equal(
    resolveLorReleaseModeReadiness(flags({ requireCanary: false }), readiness()),
    LOR_RELEASE_MODE_READINESS.ACTIVE_READY,
  );
  assert.equal(
    resolveLorReleaseModeReadiness(
      flags({ enabled: false, killSwitch: true, requireCanary: true }),
      readiness({
        status: 'closed',
        reason: 'feature_disabled',
        productionOperational: false,
      }),
    ),
    LOR_RELEASE_MODE_READINESS.DARK_CLOSED,
  );
});

test('canonical environment reader preserves only dark, canary, and full-rollout modes', () => {
  const cases = [
    [{}, { enabled: false, killSwitch: true, requireCanary: true }],
    [{
      MMHQ_LOR_STUDIO_ENABLED: 'false',
      MMHQ_LOR_STUDIO_KILL_SWITCH: 'true',
      MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'true',
    }, { enabled: false, killSwitch: true, requireCanary: true }],
    [{
      MMHQ_LOR_STUDIO_ENABLED: 'true',
      MMHQ_LOR_STUDIO_KILL_SWITCH: 'false',
      MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'true',
    }, { enabled: true, killSwitch: false, requireCanary: true }],
    [{
      MMHQ_LOR_STUDIO_ENABLED: 'true',
      MMHQ_LOR_STUDIO_KILL_SWITCH: 'false',
      MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'false',
    }, { enabled: true, killSwitch: false, requireCanary: false }],
  ];
  for (const [environment, expected] of cases) {
    const resolved = readExactLorReleaseFlags(environment);
    assert.deepEqual(resolved, expected);
    assert.equal(Object.isFrozen(resolved), true);
  }
  assert.equal(isLorReleaseModeDark(readExactLorReleaseFlags({})), true);
});

test('malformed or contradictory environment flags collapse the whole release to dark', () => {
  const active = {
    MMHQ_LOR_STUDIO_ENABLED: 'true',
    MMHQ_LOR_STUDIO_KILL_SWITCH: 'false',
    MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'true',
  };
  const malformed = [
    ...['TRUE', ' true', 'true ', '1', 'yes', '', true, null, {}].map((value) => ({
      ...active,
      MMHQ_LOR_STUDIO_ENABLED: value,
    })),
    ...['FALSE', ' false', '0', 'no', '', false, null].map((value) => ({
      ...active,
      MMHQ_LOR_STUDIO_KILL_SWITCH: value,
    })),
    ...['TRUE', 'false ', '0', 'off', '', true, null].map((value) => ({
      ...active,
      MMHQ_LOR_STUDIO_REQUIRE_CANARY: value,
    })),
    {
      MMHQ_LOR_STUDIO_ENABLED: 'true',
      MMHQ_LOR_STUDIO_KILL_SWITCH: 'true',
      MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'true',
    },
    {
      MMHQ_LOR_STUDIO_ENABLED: 'false',
      MMHQ_LOR_STUDIO_KILL_SWITCH: 'false',
      MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'true',
    },
    {
      MMHQ_LOR_STUDIO_ENABLED: 'false',
      MMHQ_LOR_STUDIO_KILL_SWITCH: 'true',
      MMHQ_LOR_STUDIO_REQUIRE_CANARY: 'false',
    },
  ];
  for (const environment of malformed) {
    assert.deepEqual(readExactLorReleaseFlags(environment), {
      enabled: false,
      killSwitch: true,
      requireCanary: true,
    });
  }

  let getterCalls = 0;
  const accessorEnvironment = { ...active };
  Object.defineProperty(accessorEnvironment, 'MMHQ_LOR_STUDIO_ENABLED', {
    enumerable: true,
    get() { getterCalls += 1; return 'true'; },
  });
  assert.equal(isLorReleaseModeDark(readExactLorReleaseFlags(accessorEnvironment)), true);
  assert.equal(getterCalls, 0);
  assert.equal(isLorReleaseModeDark(readExactLorReleaseFlags(new Proxy(active, {
    ownKeys() { throw new Error('private environment trap'); },
  }))), true);
});

test('release-mode readiness rejects contradictory and noncanonical flag/receipt pairs', () => {
  const candidates = [
    [flags(), readiness({ productionOperational: false })],
    [flags(), readiness({ reason: 'dependency_not_ready' })],
    [flags(), readiness({ status: 'closed' })],
    [flags({ killSwitch: true }), readiness({ status: 'paused', reason: 'kill_switch_active', productionOperational: false })],
    [flags({ enabled: false }), readiness({ status: 'closed', reason: 'feature_disabled', productionOperational: false })],
    [flags({ enabled: false, killSwitch: true, requireCanary: false }), readiness({ status: 'closed', reason: 'feature_disabled', productionOperational: false })],
    [{ ...flags(), enabled: 'true' }, readiness()],
    [{ ...flags(), unexpected: false }, readiness()],
    [Object.create(flags()), readiness()],
    [flags(), { status: 'ready', reason: 'all_dependencies_ready', productionOperational: true, [Symbol('unexpected')]: false }],
    [null, readiness()],
    [flags(), null],
  ];
  for (const [releaseFlags, receipt] of candidates) {
    assert.equal(isLorReleaseModeReadinessAccepted(releaseFlags, receipt), false);
    assert.equal(resolveLorReleaseModeReadiness(releaseFlags, receipt), null);
  }
});

test('release-mode readiness never invokes accessors and fails closed on hostile proxies', () => {
  let getterCalls = 0;
  const accessorFlags = {
    get enabled() { getterCalls += 1; return true; },
    killSwitch: false,
    requireCanary: true,
  };
  const accessorReadiness = readiness();
  Object.defineProperty(accessorReadiness, 'status', {
    enumerable: true,
    get() { getterCalls += 1; return 'ready'; },
  });
  assert.equal(isLorReleaseModeReadinessAccepted(accessorFlags, readiness()), false);
  assert.equal(isLorReleaseModeReadinessAccepted(flags(), accessorReadiness), false);
  assert.equal(getterCalls, 0);

  const hostileFlags = new Proxy(flags(), {
    ownKeys() { throw new Error('private flag trap'); },
  });
  const hostileReadiness = new Proxy(readiness(), {
    getOwnPropertyDescriptor() { throw new Error('private readiness trap'); },
  });
  assert.equal(isLorReleaseModeReadinessAccepted(hostileFlags, readiness()), false);
  assert.equal(isLorReleaseModeReadinessAccepted(flags(), hostileReadiness), false);
});

test('release-mode readiness contract is immutable and documents separate dependency proof', () => {
  assert.equal(Object.isFrozen(LOR_RELEASE_MODE_READINESS_CONTRACT), true);
  assert.equal(Object.isFrozen(LOR_RELEASE_MODE_READINESS_CONTRACT.activeReady), true);
  assert.equal(Object.isFrozen(LOR_RELEASE_MODE_READINESS_CONTRACT.darkClosed), true);
  assert.deepEqual(LOR_RELEASE_MODE_READINESS_CONTRACT.environmentLiterals, ['false', 'true']);
  assert.equal(LOR_RELEASE_MODE_READINESS_CONTRACT.malformedEnvironment, 'canonical_dark');
  assert.equal(
    LOR_RELEASE_MODE_READINESS_CONTRACT.dependencyValidation,
    'required_separately_complete_exact_and_ready',
  );
});

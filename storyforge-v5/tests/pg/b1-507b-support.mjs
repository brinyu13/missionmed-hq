import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test, { after, before } from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
} from '../postgres/helpers/ephemeral-postgres.mjs';

const packageDir = path.resolve(new URL('../../', import.meta.url).pathname);

export const sources = {
  migration: readFileSync(path.join(
    packageDir,
    'infra/postgres/migrations/20260730000100_b1_507b_reconciliation_state.sql',
  ), 'utf8'),
  rollback: readFileSync(path.join(
    packageDir,
    'infra/postgres/migrations/20260730000100_b1_507b_reconciliation_state_rollback.sql',
  ), 'utf8'),
  reconciliation: readFileSync(path.join(
    packageDir,
    'server/reconciliation.mjs',
  ), 'utf8'),
  scheduler: readFileSync(path.join(
    packageDir,
    'server/reconciliation-scheduler.mjs',
  ), 'utf8'),
  flags: readFileSync(path.join(packageDir, 'server/flags.mjs'), 'utf8'),
};

export function definePgAcceptanceSuite(cases) {
  let database;

  before(async () => {
    database = await startEphemeralStoryForgeDatabase();
  });

  after(async () => {
    await database?.stop();
  });

  for (const acceptanceCase of cases) {
    const runner = acceptanceCase.skip ? test.skip : test;
    runner(
      `${acceptanceCase.id} ${acceptanceCase.name}`,
      { concurrency: false },
      async () => {
        await acceptanceCase.run({
          assert,
          client: database.client,
          packageDir: database.packageDir,
          sources,
        });
      },
    );
  }
}

export async function scalar(client, sql, params = []) {
  const result = await client.query(sql, params);
  return Object.values(result.rows[0] ?? {})[0];
}

export async function inRollback(client, operation) {
  await client.query('BEGIN');
  try {
    await operation(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
  }
}

export function sourceCase(id, name, sourceName, pattern) {
  return {
    id,
    name,
    async run({ assert: exactAssert, sources: sourceSet }) {
      exactAssert.match(sourceSet[sourceName], pattern);
    },
  };
}

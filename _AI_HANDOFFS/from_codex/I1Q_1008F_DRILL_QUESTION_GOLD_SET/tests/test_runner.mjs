import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from '../tools/canonical.mjs';
import { runGoldExtraction } from '../tools/run-gold-extraction.mjs';

test('end-to-end synthetic 97-drill run is resumable, deterministic and postflights every four', async () => {
  const root = await mkdtemp(join(tmpdir(), 'i1q1008f-runner-'));
  try {
    const source = join(root, 'source');
    const boundary = join(root, 'restricted');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(source, { mode: 0o700 });
    const roster = [];
    for (let order = 1; order <= 97; order += 1) {
      const transcriptBytes = Buffer.from(JSON.stringify({ segments: [
        { start: 0, end: 1, speaker: 'Dr. J', text: `Alice, what heart disease number ${order}?` },
        { start: 1, end: 2, speaker: 'Alice Smith', text: `Answer ${order}.` },
      ] }));
      const nodesBytes = Buffer.from(JSON.stringify({ nodes: [{ start: 0, end: 2, text: `comparison ${order}` }] }));
      const transcriptPath = join(source, `t-${order}.json`);
      const nodesPath = join(source, `n-${order}.json`);
      await writeFile(transcriptPath, transcriptBytes, { mode: 0o600 });
      await writeFile(nodesPath, nodesBytes, { mode: 0o600 });
      roster.push({ drill_order: order, predecessor_roster_position: order, source_alias: `opaque_${order}`, transcript_path: transcriptPath, nodes_path: nodesPath, transcript_sha256: sha256(transcriptBytes), nodes_sha256: sha256(nodesBytes) });
    }
    const contract = { schema_version: 'missionmed.i1q.1008f.run-contract.v1', concurrency: 1, minimum_runtime_reserve_bytes: 10737418240, raw_directory_required_empty: true, synthetic: true };
    const postflights = [];
    const first = await runGoldExtraction({ boundary, roster, contract, postflight: ({ completed }) => postflights.push(completed) });
    assert.equal(first.adopted.length, 97);
    assert.deepEqual(postflights, [...Array.from({ length: 24 }, (_, index) => (index + 1) * 4), 97]);
    const stateBefore = await readFile(join(boundary, 'state', 'run-state.json'));
    const second = await runGoldExtraction({ boundary, roster, contract });
    const stateAfter = await readFile(join(boundary, 'state', 'run-state.json'));
    assert.equal(second.adopted.length, 97);
    assert.deepEqual(stateAfter, stateBefore);
    assert.equal((await stat(join(boundary, 'working', 'shards'))).mode & 0o777, 0o700);
    assert.equal((await stat(join(boundary, 'state', 'run-state.json'))).mode & 0o777, 0o600);
  } finally { await rm(root, { recursive: true, force: true }); }
});

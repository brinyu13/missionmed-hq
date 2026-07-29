import { resolve } from 'node:path';
import {
  BakeoffEvidenceError,
  loadAndScoreBakeoff,
} from './transcription-bakeoff-lib.mjs';

const [manifestArg, candidateRunsArg] = process.argv.slice(2);

if (!manifestArg || !candidateRunsArg) {
  process.stderr.write(
    'Usage: node scripts/score-transcription-bakeoff.mjs <corpus-manifest.json> <candidate-runs.json>\n',
  );
  process.exitCode = 2;
} else {
  try {
    const score = await loadAndScoreBakeoff(
      resolve(manifestArg),
      resolve(candidateRunsArg),
    );
    process.stdout.write(`${JSON.stringify(score, null, 2)}\n`);
  } catch (error) {
    const failure = error instanceof BakeoffEvidenceError
      ? error
      : new BakeoffEvidenceError(
        'bakeoff_scoring_failed',
        'Bake-off scoring failed closed.',
      );
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: {
        code: failure.code,
        message: failure.message,
      },
    })}\n`);
    process.exitCode = 1;
  }
}

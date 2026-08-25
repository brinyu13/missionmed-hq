'use strict';

const {createHash} = require('node:crypto');
const {readFileSync, statSync} = require('node:fs');
const {join} = require('node:path');
const {parentPort} = require('node:worker_threads');

const vendorRoot = join(__dirname, '..', 'vendor', 'sherpa-onnx-node', '1.13.6');
const modelRoot = join(vendorRoot, 'models', 'streaming-zipformer-en-2023-06-26');
const manifest = JSON.parse(readFileSync(join(vendorRoot, 'manifest.json'), 'utf8'));

function verifyAssets() {
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const path = join(vendorRoot, relativePath);
    if (statSync(path).size !== expected.bytes) throw new Error('LOCAL_WORD_TIMING_ASSET_SIZE_MISMATCH');
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (digest !== expected.sha256) throw new Error('LOCAL_WORD_TIMING_ASSET_HASH_MISMATCH');
  }
}

function probability(logProbabilities) {
  if (!logProbabilities.length) return null;
  const mean = logProbabilities.reduce((sum, value) => sum + value, 0) / logProbabilities.length;
  return Number(Math.max(0, Math.min(1, Math.exp(mean))).toFixed(4));
}

function timingOnlyWords(result, audioDurationMs) {
  const tokens = Array.isArray(result?.tokens) ? result.tokens : [];
  const timestamps = Array.isArray(result?.timestamps) ? result.timestamps : [];
  const probabilities = Array.isArray(result?.ys_probs) ? result.ys_probs : [];
  if (tokens.length !== timestamps.length) throw new Error('LOCAL_WORD_TIMING_TOKEN_ALIGNMENT_INVALID');

  const groups = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = String(tokens[index] || '');
    const startsWord = /^\s/u.test(token) || groups.length === 0;
    if (startsWord) groups.push({startIndex: index, endIndex: index + 1});
    else groups.at(-1).endIndex = index + 1;
  }
  return groups.map((group, index) => {
    const startMs = Math.max(0, Math.min(audioDurationMs - 1, Math.round(Number(timestamps[group.startIndex]) * 1_000)));
    const nextStart = groups[index + 1]
      ? Math.round(Number(timestamps[groups[index + 1].startIndex]) * 1_000)
      : audioDurationMs;
    const lastTokenMs = Math.round(Number(timestamps[group.endIndex - 1]) * 1_000);
    const endMs = Math.min(audioDurationMs, Math.max(startMs + 40, Math.min(nextStart, lastTokenMs + 240)));
    const logs = probabilities.slice(group.startIndex, group.endIndex).filter(Number.isFinite);
    return Object.freeze({startMs, endMs, probability: probability(logs)});
  }).filter((word, index, words) => word.endMs > word.startMs
    && (index === 0 || word.startMs >= words[index - 1].startMs));
}

verifyAssets();
const sherpa = require(join(vendorRoot, 'runtime.cjs'));
const recognizer = sherpa.createOnlineRecognizer({
  featConfig: {sampleRate: 16000, featureDim: 80},
  modelConfig: {
    transducer: {
      encoder: join(modelRoot, 'encoder.int8.onnx'),
      decoder: join(modelRoot, 'decoder.int8.onnx'),
      joiner: join(modelRoot, 'joiner.int8.onnx'),
    },
    tokens: join(modelRoot, 'tokens.txt'),
    numThreads: 1,
    provider: 'cpu',
    debug: 0,
    modelType: '',
  },
  decodingMethod: 'greedy_search',
  maxActivePaths: 4,
  enableEndpoint: 0,
});

parentPort.on('message', (message = {}) => {
  if (message.type !== 'transcribe' || !(message.pcm instanceof ArrayBuffer)) return;
  const samples = new Float32Array(message.pcm);
  let stream;
  try {
    stream = recognizer.createStream();
    stream.acceptWaveform(message.sampleRate, samples);
    stream.inputFinished();
    while (recognizer.isReady(stream)) recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    const audioDurationMs = Math.round(samples.length / message.sampleRate * 1_000);
    const words = timingOnlyWords(result, audioDurationMs);
    parentPort.postMessage({type: 'result', id: message.id, words});
  } catch (error) {
    parentPort.postMessage({type: 'error', id: message.id, reason: String(error?.message || 'LOCAL_WORD_TIMING_DECODE_FAILED')});
  } finally {
    samples.fill(0);
    stream?.free?.();
  }
});

parentPort.postMessage({
  type: 'ready',
  engine: `SHERPA_ONNX_${sherpa.version}`,
  modelRevision: manifest.model.revision,
});

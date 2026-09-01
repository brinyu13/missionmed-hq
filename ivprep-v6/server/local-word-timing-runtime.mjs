import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

export const LOCAL_WORD_TIMING_SOURCE = 'LOCAL_SHERPA_ONNX_WORD_TIMESTAMPS';
export const LOCAL_WORD_TIMING_PERSISTENCE = 'MEMORY_ONLY';
export const LOCAL_WORD_TIMING_SAMPLE_RATE = 16_000;
export const MAXIMUM_PCM_BYTES = 1_000_000;

const WORD_TIMING_TARGET_RMS = 10 ** (-22 / 20);
const WORD_TIMING_MAX_GAIN = 10 ** (30 / 20);
const WORD_TIMING_PEAK_CEILING = 0.92;
const WORD_TIMING_MINIMUM_GAINED_SPEECH_MS = 250;

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const VENDOR_ROOT = join(MODULE_DIR, '..', 'vendor', 'sherpa-onnx-node', '1.13.6');
const MANIFEST_PATH = join(VENDOR_ROOT, 'manifest.json');
const DEFAULT_TIMEOUT_MS = 20_000;

function frozenCapability(available, reason = null, detail = null) {
  return Object.freeze({
    available,
    source: LOCAL_WORD_TIMING_SOURCE,
    persistence: LOCAL_WORD_TIMING_PERSISTENCE,
    providerSessions: 0,
    ...(reason ? { reason } : {}),
    ...(detail ? { detail: Object.freeze(detail) } : {}),
  });
}

export function inspectLocalWordTimingAssets() {
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    for (const [relativePath, expected] of Object.entries(manifest.files || {})) {
      const path = join(VENDOR_ROOT, relativePath);
      if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size !== expected.bytes) {
        return frozenCapability(false, 'LOCAL_WORD_TIMING_ASSET_MISSING');
      }
    }
    return frozenCapability(true, null, {
      engine: `SHERPA_ONNX_${manifest.runtime.version}`,
      modelRevision: manifest.model.revision,
    });
  } catch {
    return frozenCapability(false, 'LOCAL_WORD_TIMING_MANIFEST_INVALID');
  }
}

export function decodeFloat32Le(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0 || buffer.byteLength % 4 !== 0) {
    throw new TypeError('PCM body must contain aligned float32 samples.');
  }
  const samples = new Float32Array(buffer.byteLength / 4);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  for (let index = 0; index < samples.length; index += 1) {
    const value = view.getFloat32(index * 4, true);
    if (!Number.isFinite(value) || value < -1.01 || value > 1.01) {
      samples.fill(0);
      throw new TypeError('PCM samples must be finite and normalized.');
    }
    samples[index] = Math.max(-1, Math.min(1, value));
  }
  return samples;
}

// Browser microphone gain varies widely. Preserve the original PCM for every
// student-facing loudness metric, but present Sherpa with a bounded private
// copy at a stable analysis level. This is conventional ASR front-end gain,
// not fabricated speech: silence remains silence, VAD admission is still
// required, and the recognizer's word/probability truth gates remain intact.
export function normalizeWordTimingPcm(samples) {
  if (!(samples instanceof Float32Array) || samples.length === 0) {
    throw new TypeError('LOCAL_WORD_TIMING_PCM_INVALID');
  }
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    const value = Number(sample);
    if (!Number.isFinite(value) || Math.abs(value) > 1) {
      throw new TypeError('LOCAL_WORD_TIMING_PCM_INVALID');
    }
    sumSquares += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  const output = new Float32Array(samples);
  const rms = Math.sqrt(sumSquares / samples.length);
  if (!(rms > 0) || !(peak > 0)) return output;
  const gain = Math.max(1, Math.min(
    WORD_TIMING_MAX_GAIN,
    WORD_TIMING_TARGET_RMS / rms,
    WORD_TIMING_PEAK_CEILING / peak,
  ));
  if (!(gain > 1)) return output;
  for (let index = 0; index < output.length; index += 1) output[index] *= gain;
  return output;
}

export class LocalWordTimingRuntime {
  constructor({
    WorkerClass = Worker,
    workerUrl = new URL('./local-word-timing-worker.cjs', import.meta.url),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maximumPending = 2,
  } = {}) {
    this.WorkerClass = WorkerClass;
    this.workerUrl = workerUrl;
    this.timeoutMs = Math.max(5_000, Math.min(60_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    this.maximumPending = Math.max(1, Math.min(4, Number(maximumPending) || 2));
    this.worker = null;
    this.ready = null;
    this.readyResolve = null;
    this.readyReject = null;
    this.readyTimeout = null;
    this.pending = new Map();
    this.sequence = 0;
    this.capability = inspectLocalWordTimingAssets();
  }

  #fail(error) {
    const safe = error instanceof Error ? error : new Error('LOCAL_WORD_TIMING_WORKER_FAILED');
    this.readyReject?.(safe);
    clearTimeout(this.readyTimeout);
    this.readyTimeout = null;
    this.readyResolve = null;
    this.readyReject = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(safe);
    }
    this.pending.clear();
    this.worker = null;
    this.ready = null;
  }

  #onMessage(message = {}) {
    if (message.type === 'ready') {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
      this.readyResolve?.(frozenCapability(true, null, {
        engine: message.engine,
        modelRevision: message.modelRevision,
      }));
      this.readyResolve = null;
      this.readyReject = null;
      return;
    }
    if (message.type !== 'result' && message.type !== 'error') return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.type === 'error') pending.reject(new Error(message.reason || 'LOCAL_WORD_TIMING_DECODE_FAILED'));
    else pending.resolve(message);
  }

  async probe() {
    if (!this.capability.available) return this.capability;
    if (this.ready) {
      try { return await this.ready; }
      catch { return frozenCapability(false, 'LOCAL_WORD_TIMING_WORKER_FAILED'); }
    }
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.readyTimeout = setTimeout(() => {
      const worker = this.worker;
      this.#fail(new Error('LOCAL_WORD_TIMING_WORKER_START_TIMEOUT'));
      void worker?.terminate?.();
    }, this.timeoutMs);
    try {
      this.worker = new this.WorkerClass(this.workerUrl);
      this.worker.on('message', (message) => this.#onMessage(message));
      this.worker.on('error', (error) => this.#fail(error));
      this.worker.on('exit', (code) => {
        if (this.worker) this.#fail(new Error(code === 0
          ? 'LOCAL_WORD_TIMING_WORKER_EXITED'
          : 'LOCAL_WORD_TIMING_WORKER_FAILED'));
      });
    } catch (error) {
      this.#fail(error);
    }
    try { return await this.ready; }
    catch { return frozenCapability(false, 'LOCAL_WORD_TIMING_WORKER_FAILED'); }
  }

  async transcribe({ samples, sampleRate, speechDurationMs } = {}) {
    if (!(samples instanceof Float32Array)
      || samples.byteLength === 0
      || samples.byteLength > MAXIMUM_PCM_BYTES
      || sampleRate !== LOCAL_WORD_TIMING_SAMPLE_RATE) {
      throw new TypeError('LOCAL_WORD_TIMING_PCM_INVALID');
    }
    const audioDurationMs = samples.length / sampleRate * 1_000;
    const speechMs = Number(speechDurationMs);
    if (!Number.isFinite(speechMs) || speechMs < 0 || speechMs > audioDurationMs + 20) {
      throw new TypeError('LOCAL_WORD_TIMING_SPEECH_DURATION_INVALID');
    }
    const capability = await this.probe();
    if (!capability.available || !this.worker) throw new Error(capability.reason || 'LOCAL_WORD_TIMING_UNAVAILABLE');
    if (this.pending.size >= this.maximumPending) throw new Error('LOCAL_WORD_TIMING_BACKPRESSURE');

    const id = `word-window-${++this.sequence}`;
    const prepared = speechMs >= WORD_TIMING_MINIMUM_GAINED_SPEECH_MS
      ? normalizeWordTimingPcm(samples)
      : new Float32Array(samples);
    const pcm = prepared.buffer;
    const result = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('LOCAL_WORD_TIMING_TIMEOUT'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
    });
    this.worker.postMessage({ type: 'transcribe', id, pcm, sampleRate }, [pcm]);
    const decoded = await result;
    const words = Array.isArray(decoded.words) ? decoded.words.map((word) => Object.freeze({
      startMs: Number(word.startMs),
      endMs: Number(word.endMs),
      probability: word.probability == null ? null : Number(word.probability),
    })) : [];
    return Object.freeze({
      available: true,
      providerSessions: 0,
      rawAudioPersisted: false,
      rawTextReturned: false,
      source: LOCAL_WORD_TIMING_SOURCE,
      speechDurationMs: Math.min(audioDurationMs, speechMs),
      wordCount: words.length,
      words: Object.freeze(words),
    });
  }

  async close() {
    const worker = this.worker;
    this.worker = null;
    this.ready = null;
    this.#fail(new Error('LOCAL_WORD_TIMING_RUNTIME_CLOSED'));
    if (worker) await worker.terminate();
  }
}

export function createLocalWordTimingRuntime(options) {
  return new LocalWordTimingRuntime(options);
}

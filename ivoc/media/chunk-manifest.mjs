const hex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

export async function sha256(value) {
  const bytes = value instanceof Blob ? await value.arrayBuffer() : value instanceof ArrayBuffer ? value : new TextEncoder().encode(String(value));
  return hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

export class ChunkManifest {
  constructor({ sessionId, mediaId, codec }) {
    if (!sessionId || !mediaId || !codec) throw new TypeError('manifest identity is required');
    this.sessionId = sessionId;
    this.mediaId = mediaId;
    this.codec = codec;
    this.chunks = [];
    this.sealed = false;
  }

  async append(blob, { tStartMs, tEndMs }) {
    if (this.sealed) throw new Error('manifest is sealed');
    if (!(blob instanceof Blob) || blob.size === 0) throw new TypeError('non-empty Blob required');
    if (!Number.isFinite(tStartMs) || !Number.isFinite(tEndMs) || tStartMs < 0 || tEndMs < tStartMs) throw new TypeError('invalid chunk range');
    const entry = Object.freeze({ index: this.chunks.length, bytes: blob.size, sha256: await sha256(blob), t_start_ms: tStartMs, t_end_ms: tEndMs });
    this.chunks.push(entry);
    return entry;
  }

  async seal({ durationMs }) {
    if (this.sealed || this.chunks.length === 0) throw new Error('manifest cannot seal');
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new TypeError('durationMs is required');
    const manifestHash = await sha256(JSON.stringify(this.chunks));
    this.sealed = true;
    return Object.freeze({
      schema: 'ivoc.media_manifest.v1',
      media_id: this.mediaId,
      session_id: this.sessionId,
      codec: this.codec,
      duration_ms: durationMs,
      bytes: this.chunks.reduce((sum, item) => sum + item.bytes, 0),
      chunk_count: this.chunks.length,
      chunks: structuredClone(this.chunks),
      manifest_sha256: manifestHash,
    });
  }
}

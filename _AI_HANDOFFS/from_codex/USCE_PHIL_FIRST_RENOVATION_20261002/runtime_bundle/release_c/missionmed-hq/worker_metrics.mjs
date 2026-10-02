function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseWavBuffer(wavBuffer = Buffer.alloc(0)) {
  const buffer = Buffer.isBuffer(wavBuffer) ? wavBuffer : Buffer.from(wavBuffer || '');
  if (buffer.length < 44) {
    throw new Error('wav_buffer_too_small');
  }
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('wav_header_invalid');
  }

  let offset = 12;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let channels = 1;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === 'fmt ') {
      const audioFormat = buffer.readUInt16LE(chunkDataStart);
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
      if (audioFormat !== 1) {
        throw new Error('wav_not_pcm');
      }
    }

    if (chunkId === 'data') {
      dataStart = chunkDataStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataStart < 0 || !sampleRate || !bitsPerSample) {
    throw new Error('wav_data_chunk_missing');
  }
  if (bitsPerSample !== 16) {
    throw new Error('wav_not_16bit');
  }

  const byteEnd = Math.min(buffer.length, dataStart + dataSize);
  const sampleCount = Math.floor((byteEnd - dataStart) / 2 / Math.max(1, channels));
  const samples = new Float32Array(sampleCount);

  let writeIndex = 0;
  for (let index = dataStart; index + (channels * 2) <= byteEnd; index += channels * 2) {
    const value = buffer.readInt16LE(index);
    samples[writeIndex] = value / 32768;
    writeIndex += 1;
  }

  return {
    sampleRate,
    samples,
    durationSeconds: sampleRate > 0 ? samples.length / sampleRate : 0,
  };
}

function computeRms(samples = []) {
  if (!samples.length) {
    return 0;
  }
  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] || 0;
    sumSquares += value * value;
  }
  return Math.sqrt(sumSquares / samples.length);
}

function detectPitchAutoCorrelation(frame = [], sampleRate = 16000) {
  const size = frame.length;
  if (size < 2) {
    return 0;
  }

  const rms = computeRms(frame);
  if (rms < 0.02) {
    return 0;
  }

  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.floor(sampleRate / 50);
  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index + lag < size; index += 1) {
      const a = frame[index];
      const b = frame[index + lag];
      corr += a * b;
      normA += a * a;
      normB += b * b;
    }

    const denom = Math.sqrt(normA * normB);
    if (!denom) {
      continue;
    }
    const normalized = corr / denom;
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (!bestLag || bestCorrelation < 0.55) {
    return 0;
  }
  return sampleRate / bestLag;
}

function computePitchStdDev(samples = [], sampleRate = 16000) {
  if (!samples.length || sampleRate <= 0) {
    return 0;
  }

  const frameSize = Math.max(128, Math.floor(sampleRate * 0.05));
  const hopSize = Math.max(64, Math.floor(sampleRate * 0.025));
  const pitches = [];

  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    const frame = samples.slice(offset, offset + frameSize);
    const pitch = detectPitchAutoCorrelation(frame, sampleRate);
    if (pitch >= 50 && pitch <= 400) {
      pitches.push(pitch);
    }
  }

  if (!pitches.length) {
    return 0;
  }

  const mean = pitches.reduce((sum, value) => sum + value, 0) / pitches.length;
  const variance = pitches.reduce((sum, value) => {
    const delta = value - mean;
    return sum + (delta * delta);
  }, 0) / pitches.length;

  return Math.sqrt(variance);
}

function computePauseCount(samples = [], sampleRate = 16000) {
  if (!samples.length || sampleRate <= 0) {
    return 0;
  }

  const frameSize = Math.max(1, Math.floor(sampleRate * 0.1));
  const silenceThreshold = 0.01;
  const minSilenceFrames = Math.ceil(1 / 0.1);

  let silenceRun = 0;
  let pauses = 0;

  for (let offset = 0; offset < samples.length; offset += frameSize) {
    const frame = samples.slice(offset, Math.min(samples.length, offset + frameSize));
    const rms = computeRms(frame);
    if (rms < silenceThreshold) {
      silenceRun += 1;
      continue;
    }

    if (silenceRun >= minSilenceFrames) {
      pauses += 1;
    }
    silenceRun = 0;
  }

  if (silenceRun >= minSilenceFrames) {
    pauses += 1;
  }

  return pauses;
}

function countFillerWords(transcriptText = '') {
  const text = String(transcriptText || '').toLowerCase();
  const patterns = [
    /\bum\b/gu,
    /\buh\b/gu,
    /\blike\b/gu,
    /\byou\s+know\b/gu,
    /\bbasically\b/gu,
    /\bactually\b/gu,
    /\bliterally\b/gu,
  ];

  return patterns.reduce((sum, pattern) => {
    const matches = text.match(pattern);
    return sum + (Array.isArray(matches) ? matches.length : 0);
  }, 0);
}

function computeWpm(transcriptText = '', durationSeconds = 0) {
  const words = String(transcriptText || '').trim().split(/\s+/u).filter(Boolean);
  if (!words.length || !(durationSeconds > 0)) {
    return 0;
  }
  return Math.round(words.length / (durationSeconds / 60));
}

function normalizeVolumeToScale(rms = 0) {
  return clamp(Math.round((Number(rms || 0) * 150)), 0, 100);
}

export function computeDeliveryMetricsFromWav(wavBuffer = Buffer.alloc(0), transcriptText = '', fallbackDurationSeconds = 0) {
  const parsed = parseWavBuffer(wavBuffer);
  const durationSeconds = parsed.durationSeconds > 0 ? parsed.durationSeconds : Number(fallbackDurationSeconds || 0);
  const pitchSd = computePitchStdDev(parsed.samples, parsed.sampleRate);
  const rms = computeRms(parsed.samples);

  return {
    pitch_sd: Math.round(pitchSd * 1000) / 1000,
    volume_rms: normalizeVolumeToScale(rms),
    wpm: computeWpm(transcriptText, durationSeconds),
    filler_count: countFillerWords(transcriptText),
    pause_count: computePauseCount(parsed.samples, parsed.sampleRate),
    duration_seconds: durationSeconds > 0 ? Math.round(durationSeconds * 1000) / 1000 : 0,
  };
}

export function computeDeliveryMetricsSafeFallback(transcriptText = '', durationSeconds = 0) {
  const transcript = String(transcriptText || '');
  const safeDuration = Number(durationSeconds || 0);
  const wpm = computeWpm(transcript, safeDuration > 0 ? safeDuration : 60);

  return {
    pitch_sd: 0,
    volume_rms: 0,
    wpm,
    filler_count: countFillerWords(transcript),
    pause_count: Math.max(0, Math.floor((safeDuration || 0) / 45)),
    duration_seconds: safeDuration > 0 ? Math.round(safeDuration * 1000) / 1000 : 0,
  };
}

export function buildDeliveryInsights(metrics = {}, mode = 'quick_rep') {
  const normalizedMode = String(mode || '').trim().toLowerCase();
  if (normalizedMode === 'simulation') {
    return [];
  }

  const volume = Number(metrics.volume_rms || 0);
  const wpm = Number(metrics.wpm || 0);
  const fillers = Number(metrics.filler_count || 0);
  const pauses = Number(metrics.pause_count || 0);
  const pitchSd = Number(metrics.pitch_sd || 0);

  const insights = [];

  if (volume > 0 && volume < 40) {
    insights.push('Your volume was low at times. Try projecting a bit more so each point lands clearly.');
  } else if (volume > 80) {
    insights.push('Your volume was high in parts. Slightly lower intensity can sound more controlled and confident.');
  }

  if (fillers > 5) {
    insights.push('You used several filler words. Replace fillers with short pauses to sound more intentional.');
  }

  if (wpm > 0 && wpm < 80) {
    insights.push('Your pace was slow. Aim for a steadier rhythm around conversational interview speed.');
  } else if (wpm > 140) {
    insights.push('Your pace was fast. Slow down slightly to improve clarity and emphasis.');
  }

  if (pauses < 2) {
    insights.push('Add brief pauses between major ideas so your structure is easier to follow.');
  }

  if (pitchSd > 50) {
    insights.push('Good vocal variety. Your pitch changes helped emphasize key ideas.');
  }

  if (!insights.length) {
    insights.push('Clear delivery overall. Keep your pace steady and continue using concise examples.');
  }

  return insights.slice(0, 3);
}

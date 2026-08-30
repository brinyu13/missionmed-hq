'use strict';

// Minimal, server-only entry point for the vendored sherpa-onnx Node WASM build.
// The upstream package entry point eagerly loads unrelated TTS, VAD, punctuation,
// and diarization adapters. IV Prep needs only local streaming ASR.
const wasmModule = {};
require('./sherpa-onnx-wasm-nodejs.js')(wasmModule);
const asr = require('./sherpa-onnx-asr.js');

module.exports = Object.freeze({
  createOnlineRecognizer(config) {
    return asr.createOnlineRecognizer(wasmModule, config);
  },
  version: wasmModule.UTF8ToString(wasmModule._SherpaOnnxGetVersionStr()),
  gitSha1: wasmModule.UTF8ToString(wasmModule._SherpaOnnxGetGitSha1()),
  gitDate: wasmModule.UTF8ToString(wasmModule._SherpaOnnxGetGitDate()),
  onnxruntimeVersion: wasmModule.UTF8ToString(wasmModule._SherpaOnnxGetOnnxruntimeVersionStr()),
});

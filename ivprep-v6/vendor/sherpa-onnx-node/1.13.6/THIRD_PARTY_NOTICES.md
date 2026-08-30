# Third-party notices

This bounded server-side runtime vendors the ASR-only portion of
`sherpa-onnx` 1.13.6 and the English streaming Zipformer model below. It is
used locally in memory and does not contact an inference provider.

- Runtime: `sherpa-onnx` 1.13.6, git `1cb484af`, Apache-2.0.
  Source: https://github.com/k2-fsa/sherpa-onnx
- Model: `csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26`,
  revision `672fbf1b30579d6585301139bb363f42a0ad4a24`, Apache-2.0.
  Source: https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26
- Model files: chunk 16, left context 128, int8 encoder/decoder/joiner and
  the repository's `tokens.txt`.

The complete upstream Apache-2.0 license is included in `LICENSE`. Raw
microphone PCM and recognized text are not persisted or returned by MissionMed.

#!/usr/bin/env python3
"""Local-only aggregate word timing for the 3521 analytics harness.

The process binds to loopback, loads an explicit on-disk faster-whisper snapshot,
accepts one in-memory audio window at a time, and returns aggregate timing only.
It never returns or persists transcript text and cannot download a model.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

HOST = "127.0.0.1"
MAX_AUDIO_BYTES = max(64_000, int(os.getenv("IVPREP_LOCAL_WHISPER_MAX_BYTES", "4000000")))
MODEL_ENV = "IVPREP_LOCAL_WHISPER_MODEL_DIR"
REQUIRED_MODEL_FILES = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")
EXPECTED_MODEL_BIN_SHA256 = "1a5afae06a4db91c975c9a9d78be5cc110ee4ea022ad57d55492e4550e936b2a"


def json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")


def finite(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def resolve_model_dir() -> Path:
    configured = os.getenv(MODEL_ENV, "").strip()
    if not configured:
        raise RuntimeError(f"{MODEL_ENV} is required")
    candidate = Path(configured).expanduser()
    if not candidate.is_absolute():
        raise RuntimeError(f"{MODEL_ENV} must be an absolute path")
    resolved = candidate.resolve(strict=True)
    if not resolved.is_dir():
        raise RuntimeError("local whisper model path is not a directory")
    missing = [name for name in REQUIRED_MODEL_FILES if not (resolved / name).is_file()]
    if missing:
        raise RuntimeError(f"local whisper snapshot is incomplete: {','.join(missing)}")
    digest = hashlib.sha256()
    with (resolved / "model.bin").open("rb") as model_file:
        for block in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != EXPECTED_MODEL_BIN_SHA256:
        raise RuntimeError("local whisper model snapshot hash is not approved")
    return resolved


def load_model(model_dir: Path) -> Any:
    from faster_whisper import WhisperModel

    return WhisperModel(
        model_dir.as_posix(),
        device="cpu",
        compute_type="int8",
        local_files_only=True,
    )


MODEL_DIR = resolve_model_dir()
MODEL = load_model(MODEL_DIR)


def transcribe_aggregate(audio_bytes: bytes) -> dict[str, Any]:
    segments_iter, _ = MODEL.transcribe(
        io.BytesIO(audio_bytes),
        language="en",
        task="transcribe",
        beam_size=1,
        best_of=1,
        temperature=0.0,
        condition_on_previous_text=False,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
    )

    observed_words: list[tuple[float, float]] = []
    for segment in segments_iter:
        for word in getattr(segment, "words", ()) or ():
            start = finite(getattr(word, "start", None))
            end = finite(getattr(word, "end", None))
            probability = finite(getattr(word, "probability", None))
            token = str(getattr(word, "word", "") or "").strip()
            if not token or start is None or end is None or end <= start:
                continue
            if probability is not None and probability < 0.35:
                continue
            observed_words.append((start, end))

    first = min((start for start, _ in observed_words), default=None)
    last = max((end for _, end in observed_words), default=None)
    return {
        "available": True,
        "source": "LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS",
        "wordCount": len(observed_words),
        "firstWordStartMs": round(first * 1_000) if first is not None else None,
        "lastWordEndMs": round(last * 1_000) if last is not None else None,
        "providerSessions": 0,
        "rawTextReturned": False,
        "rawAudioPersisted": False,
    }


class TimingHandler(BaseHTTPRequestHandler):
    server_version = "IVPrepLocalTiming/1"
    protocol_version = "HTTP/1.1"

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler contract
        if self.path != "/health":
            self.send_json(404, {"available": False, "reason": "NOT_FOUND"})
            return
        self.send_json(
            200,
            {
                "available": True,
                "source": "LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS",
                "providerSessions": 0,
                "persistence": "MEMORY_ONLY",
            },
        )

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler contract
        if self.path != "/transcribe":
            self.send_json(404, {"available": False, "reason": "NOT_FOUND"})
            return
        content_type = (self.headers.get("Content-Type") or "").lower()
        if not (content_type.startswith("audio/") or content_type == "application/octet-stream"):
            self.send_json(415, {"available": False, "reason": "UNSUPPORTED_AUDIO_TYPE"})
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_AUDIO_BYTES:
            self.send_json(413, {"available": False, "reason": "INVALID_AUDIO_WINDOW_SIZE"})
            return
        audio_bytes = self.rfile.read(length)
        if len(audio_bytes) != length:
            self.send_json(400, {"available": False, "reason": "INCOMPLETE_AUDIO_WINDOW"})
            return
        try:
            payload = transcribe_aggregate(audio_bytes)
        except Exception:
            self.send_json(422, {"available": False, "reason": "LOCAL_TRANSCRIPTION_FAILED"})
            return
        finally:
            audio_bytes = b""
        self.send_json(200, payload)

    def log_message(self, _format: str, *_args: Any) -> None:
        return


def main() -> None:
    port = int(os.getenv("IVPREP_LOCAL_WHISPER_PORT", "0"))
    server = HTTPServer((HOST, port), TimingHandler)
    actual_port = int(server.server_address[1])
    print(f"LOCAL_WHISPER_SIDECAR_PORT={actual_port}", flush=True)
    print("LOCAL_WHISPER_MODEL_READY=1", flush=True)
    server.serve_forever(poll_interval=0.25)


if __name__ == "__main__":
    main()

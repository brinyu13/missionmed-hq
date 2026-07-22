#!/usr/bin/env python3
"""Allowlist-only localhost server for read-only prototype visual inspection."""

from __future__ import annotations

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


CSP = (
    "default-src 'none'; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "media-src 'self' data: blob:; "
    "connect-src 'none'; object-src 'none'; frame-src 'none'; "
    "form-action 'none'; base-uri 'none'"
)

REDACTION_STYLE = """
<style id="i1q-3000-privacy-redaction">
  body::before {
    content: "PRIVACY-SAFE CAPTURE - RESTRICTED CONTENT REDACTED";
    position: fixed; z-index: 2147483647; top: 10px; right: 10px;
    padding: 7px 11px; border: 1px solid #d4a843; border-radius: 4px;
    background: #0b1d30; color: #fff; font: 700 11px/1.2 system-ui;
    letter-spacing: .04em; pointer-events: none;
  }
  :is(.srcask,.qbig,.qstem,.qlead,.opt,.opt-text,.extext,.notecard,.sq,
      .cvassert,.vline,.teach,.tq,.tteach,.tdecision,.tpayoff,.drjnote,
      .exp-body,.feedback,.timeline,.tlbar,.tlmark,.drjts,.nts,.tsrow,
      .scrubhead,.transcap,.timestamp,.timecode,.classtag,.sl,.side-question-text,
      .user-chip span,.profile-card .nm,.who,.blk .v) {
    position: relative !important; color: transparent !important;
    text-shadow: none !important; min-height: 34px;
  }
  :is(.srcask,.qbig,.qstem,.qlead,.opt,.opt-text,.extext,.notecard,.sq,
      .cvassert,.vline,.teach,.tq,.tteach,.tdecision,.tpayoff,.drjnote,
      .exp-body,.feedback,.timeline,.tlbar,.tlmark,.drjts,.nts,.tsrow,
      .scrubhead,.transcap,.timestamp,.timecode,.classtag,.sl,.side-question-text,
      .user-chip span,.profile-card .nm,.who,.blk .v) * { visibility: hidden !important; }
  :is(.srcask,.qbig,.qstem,.qlead,.opt,.opt-text,.extext,.notecard,.sq,
      .cvassert,.vline,.teach,.tq,.tteach,.tdecision,.tpayoff,.drjnote,
      .exp-body,.feedback,.timeline,.tlbar,.tlmark,.drjts,.nts,.tsrow,
      .scrubhead,.transcap,.timestamp,.timecode,.classtag,.sl,.side-question-text,
      .user-chip span,.profile-card .nm,.who,.blk .v)::after {
    content: "RESTRICTED CONTENT REDACTED";
    visibility: visible !important; color: #aab7c4 !important;
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    font: 600 11px/1.2 system-ui; letter-spacing: .04em;
  }
</style>
"""

REDACTION_SCRIPT = r"""
<script id="i1q-3000-privacy-redaction-script">
(() => {
  const timecode = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
  const stripTimecodes = (value) => value.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "REDACTED TIME");
  const privateLabel = /\bDANIEL B\b/i;
  const stripPrivateLabels = (value) => value.replace(/\bDANIEL B\b/gi, "SYNTHETIC STUDENT");
  const sanitize = (value) => stripPrivateLabels(stripTimecodes(value));
  const scrub = (root) => {
    if (root.nodeType === Node.TEXT_NODE) {
      if (timecode.test(root.nodeValue || "") || privateLabel.test(root.nodeValue || "")) {
        root.nodeValue = sanitize(root.nodeValue || "");
      }
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      if (timecode.test(walker.currentNode.nodeValue || "") || privateLabel.test(walker.currentNode.nodeValue || "")) matches.push(walker.currentNode);
    }
    for (const node of matches) node.nodeValue = sanitize(node.nodeValue || "");
  };
  const begin = () => {
    scrub(document.body);
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") {
          if (timecode.test(record.target.nodeValue || "") || privateLabel.test(record.target.nodeValue || "")) {
            record.target.nodeValue = sanitize(record.target.nodeValue || "");
          }
        } else {
          for (const node of record.addedNodes) scrub(node);
        }
      }
    }).observe(document.body, {subtree: true, childList: true, characterData: true});
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin, {once: true});
  else begin();
})();
</script>
"""


def load_manifest(path: Path) -> dict[str, dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    routes: dict[str, dict] = {}
    for route in payload.get("routes", []):
        route_id = route["id"]
        kind = route["type"]
        target = Path(route["path"]).expanduser().resolve()
        if kind not in {"file", "tree"}:
            raise ValueError(f"unsupported route type: {kind}")
        if not target.exists():
            raise FileNotFoundError(target)
        routes[route_id] = {"type": kind, "path": target}
    return routes


class Handler(BaseHTTPRequestHandler):
    server_version = "I1Q3000SafeStatic/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def do_HEAD(self) -> None:  # noqa: N802
        self._serve(head_only=True)

    def do_GET(self) -> None:  # noqa: N802
        self._serve(head_only=False)

    def _serve(self, *, head_only: bool) -> None:
        split = urlsplit(self.path)
        path = unquote(split.path)
        query = parse_qs(split.query)
        parts = [part for part in path.split("/") if part]
        if len(parts) < 2 or parts[0] not in {"p", "t"}:
            self.send_error(404)
            return
        route = self.server.routes.get(parts[1])  # type: ignore[attr-defined]
        if route is None:
            self.send_error(404)
            return
        if parts[0] == "p" and route["type"] == "file" and len(parts) == 2:
            target = route["path"]
        elif parts[0] == "t" and route["type"] == "tree":
            rel = Path(*parts[2:]) if len(parts) > 2 else Path("index.html")
            if any(part.startswith(".") or part == ".." for part in rel.parts):
                self.send_error(403)
                return
            root = route["path"]
            target = (root / rel).resolve()
            if root not in target.parents and target != root:
                self.send_error(403)
                return
        else:
            self.send_error(404)
            return
        if not target.is_file():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        data = target.read_bytes()
        redacted = False
        if query.get("redact") == ["1"] and content_type == "text/html":
            text = data.decode("utf-8", errors="replace")
            marker = "</head>"
            injection = REDACTION_STYLE + REDACTION_SCRIPT
            text = text.replace(marker, injection + marker, 1) if marker in text else injection + text
            data = text.encode("utf-8")
            redacted = True
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if redacted:
            self.send_header("X-I1Q-Privacy-Redaction", "applied")
        self.end_headers()
        if not head_only:
            self.wfile.write(data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    routes = load_manifest(args.manifest)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.routes = routes  # type: ignore[attr-defined]
    print(json.dumps({"status": "listening", "port": args.port, "routes": sorted(routes)}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

#!/usr/bin/python3 -I
"""Run the synthetic USCE Offer operations tests offline on the owner's Mac.

From the USCE checkout, run ./missionmed-hq/tests/run-usce-offer-operations-offline.py.
The owner for this entry is the USCE product integrator. Each run checks the
native sandbox before exercising the local test. It needs Apple's sandbox-exec
and Node at /usr/local/bin/node. It reads no registrar or service configuration.
"""

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


NODE = "/usr/local/bin/node"
NODE_SHA256 = "9e831e9b13aa47c5e5eaa3904d232aa527124e8abba7ca5d72b67b46cfb10ae8"  # v24.14.0
EXPECTED_TESTS = 27
SANDBOX = "/usr/bin/sandbox-exec"
HQ = Path(__file__).resolve().parents[1]
TEST = HQ / "tests/usce-operations.test.mjs"
SOURCES = {
    TEST: "51e290f928e72b31865439bf25b7914cc182c4a8946aee4cf8b12017cd83567f",
    HQ / "routes/usce-offer-portal.mjs": "2e3c4b7246641000500ad66b73fd171795bab184467a80af2befd3c09ef1a51a",
    HQ / "lib/usce-postmark-qa-guard.mjs": "95f4a47724b8ea7aaa87d8b74c54749821db4643d2290d016f809e45d6bd5241",
}

PROFILE = """
(version 1)
(deny default)
(import "dyld-support.sb")
(allow process-exec (literal "/usr/local/bin/node"))
(allow sysctl-read)
(allow process-info* (target self))
(allow signal (target self))
(allow file-map-executable (literal "/usr/local/bin/node") (subpath "/usr/lib") (subpath "/System/Library"))
(allow file-read* (literal "/usr/local/bin/node") (subpath "/System/Library") (subpath "/usr/lib")
    (subpath "/usr/share/icu") (subpath "/private/var/db/timezone")
    (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom") {sources})
(allow file-read-metadata (literal "/usr") (literal "/usr/local") (literal "/usr/local/bin")
    (literal "/dev") (literal "/System") {ancestors})
(deny file-write*)
(deny process-fork)
(deny network*)
"""

PROBES = """
const { openSync, closeSync, constants } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { connect } = require('node:net');
const [unlistedFile, testFile] = process.argv.slice(1);

function requireDenial(label, operation) {
  try {
    operation();
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
    console.log(label + ': ' + error.code);
    return;
  }
  throw new Error(label + ' was allowed');
}

requireDenial('Unlisted file read', () => closeSync(openSync(unlistedFile, constants.O_RDONLY)));
// Open without truncating or writing bytes, even if a host is misconfigured.
requireDenial('Test file write access', () => closeSync(openSync(testFile, constants.O_WRONLY)));
for (const [program, args] of [['/usr/bin/true', []], [process.execPath, ['--version']]]) {
  requireDenial('Subprocess ' + program, () => {
    const result = spawnSync(program, args, { stdio: 'ignore' });
    if (result.error) throw result.error;
  });
}

const socket = connect(1, '127.0.0.1');
socket.on('connect', () => { socket.destroy(); throw new Error('Loopback TCP was allowed'); });
socket.on('error', error => requireDenial('Loopback TCP', () => { throw error; }));
"""


def literals(paths):
    return " ".join("(literal " + json.dumps(str(path), ensure_ascii=False) + ")" for path in paths)


def verify_input(path, expected):
    if path.resolve(strict=True) != path or not path.is_file():
        raise SystemExit(f"Expected a regular, non-symlink input at {path}.")
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise SystemExit(f"Reviewed SHA-256 mismatch: {path}.")


def checked_module_loader():
    # Verify the bytes Node actually compiles as well as the files checked before launch.
    hashes = {path.as_uri(): digest for path, digest in SOURCES.items()}
    hook = """
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
const hashes = new Map(Object.entries(REVIEWED_HASHES));
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith('file:')) return nextLoad(url, context);
    if (!hashes.has(url)) throw new Error('Unexpected product module: ' + url);
    const result = nextLoad(url, context);
    if (result.source == null ||
        createHash('sha256').update(Buffer.from(result.source)).digest('hex') !== hashes.get(url))
      throw new Error('Reviewed module changed before execution: ' + url);
    return result;
  }
});
""".replace("REVIEWED_HASHES", json.dumps(hashes))
    return "data:text/javascript;base64," + base64.b64encode(hook.encode()).decode("ascii")


def run_node(profile, *arguments):
    verify_input(Path(NODE), NODE_SHA256)
    result = subprocess.run(
        [SANDBOX, "-p", profile, NODE, *arguments],
        cwd="/", env={"LANG": "C", "TZ": "UTC", "NODE_DISABLE_COMPILE_CACHE": "1"},
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, timeout=60,
    )
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    if result.returncode:
        raise SystemExit(f"Sandboxed Node exited with status {result.returncode}.")
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.parse_args()
    if sys.platform != "darwin":
        raise SystemExit("This entry requires the macOS native sandbox.")
    for path, digest in SOURCES.items():
        verify_input(path, digest)
    ancestors = sorted({ancestor for path in SOURCES for ancestor in path.parents})
    profile = PROFILE.format(sources=literals(SOURCES), ancestors=literals(ancestors))
    run_node(profile, "-e", PROBES, str(HQ / "package.json"), str(TEST))
    report = run_node(profile, "--import", checked_module_loader(), "--test",
                      "--test-isolation=none", "--test-reporter=tap", str(TEST))
    expected_summary = (
        f"1..{EXPECTED_TESTS}\n# tests {EXPECTED_TESTS}\n# suites 0\n# pass {EXPECTED_TESTS}\n"
        "# fail 0\n# cancelled 0\n# skipped 0\n# todo 0"
    )
    if not re.search("^" + re.escape(expected_summary) + r"\n# duration_ms [\d.]+\s*\Z", report, re.MULTILINE):
        raise SystemExit(f"Expected exactly {EXPECTED_TESTS} passing tests with no skips or other outcomes.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, subprocess.TimeoutExpired) as error:
        sys.exit(f"Offline Offer operations test could not run: {error}")

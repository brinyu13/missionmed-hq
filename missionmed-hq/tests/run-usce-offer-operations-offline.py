#!/usr/bin/python3 -I
"""Run the synthetic USCE Offer operations tests offline on the owner's Mac.

From the USCE checkout, run ./missionmed-hq/tests/run-usce-offer-operations-offline.py.
The owner for this entry is the USCE product integrator. Each run checks the
native sandbox before exercising the local test. It needs Apple's sandbox-exec
and Node at /usr/local/bin/node. It reads no registrar or service configuration.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


NODE = "/usr/local/bin/node"
SANDBOX = "/usr/bin/sandbox-exec"
HQ = Path(__file__).resolve().parents[1]
TEST = HQ / "tests/usce-operations.test.mjs"
SOURCES = (TEST, HQ / "routes/usce-offer-portal.mjs", HQ / "lib/usce-postmark-qa-guard.mjs")

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


def run_node(profile, *arguments):
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
    for path in SOURCES:
        if path.resolve(strict=True) != path or not path.is_file():
            raise SystemExit(f"Expected a regular USCE source file at {path}.")
    ancestors = sorted({ancestor for path in SOURCES for ancestor in path.parents})
    profile = PROFILE.format(sources=literals(SOURCES), ancestors=literals(ancestors))
    run_node(profile, "-e", PROBES, str(HQ / "package.json"), str(TEST))
    report = run_node(profile, "--test", "--test-isolation=none", "--test-reporter=tap", str(TEST))
    if not re.search(r"^# pass [1-9][0-9]*$", report, re.MULTILINE):
        raise SystemExit("The test runner reported no passing tests.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, subprocess.TimeoutExpired) as error:
        sys.exit(f"Offline Offer operations test could not run: {error}")

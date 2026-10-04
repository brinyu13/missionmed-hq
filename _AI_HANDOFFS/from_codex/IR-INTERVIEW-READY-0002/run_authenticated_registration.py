"""One approved read/probe; memory-only custody across sealed independent admission."""
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
import lease_transport as transport
import register_phase1 as registrar


def initial_capture(here=None):
    here = HERE if here is None else here
    if any((here / name).exists() for name in registrar.R2_ARTIFACT_NAMES):
        raise RuntimeError('pre-existing R2 admission, review or custody artifact')
    sources = {name: registrar.snapshot(here / name).sha256
               for name in registrar.INITIAL_SOURCE_NAMES}
    registrar.assert_sources_current(sources, here)
    return sources


def validate_admission(sources, authenticated_at_ns, here=None):
    here = HERE if here is None else here
    evidence = registrar.capture_evidence(here)
    if (evidence[registrar.NORMAL_REVIEW_NAME].modified_ns <= authenticated_at_ns or
            evidence[registrar.ADMISSION_NAME].modified_ns <= authenticated_at_ns):
        raise RuntimeError('normal admission evidence predates authentication')
    expected = {name: item.sha256 for name, item in evidence.items()}
    registrar.validate_evidence(evidence, expected, sources)
    registrar.assert_sources_current(sources, here)
    registrar.assert_evidence_current(evidence, here)
    return expected


def main():
    sources = initial_capture()
    try:
        key = transport.retrieve_existing_key()
        status = transport.authentication_probe(key)
    except transport.TransportError as error:
        print('AUTHENTICATION_STOP: ' + (error.public_status()
              if isinstance(error, transport.PhaseError)
              else 'phase=unknown; error=failed_closed'), flush=True)
        return 1
    authenticated_at_ns = time.time_ns()
    registrar.assert_sources_current(sources, HERE)
    if any((HERE / name).exists() for name in registrar.R2_ARTIFACT_NAMES):
        raise RuntimeError('R2 admission artifact appeared before authentication completed')
    print('AUTHENTICATION_PASS: HTTP ' + str(status) + '; awaiting independent admission', flush=True)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        registrar.assert_sources_current(sources, HERE)
        if (HERE / registrar.ADMISSION_NAME).exists():
            expected = validate_admission(sources, authenticated_at_ns)
            def same_private_client(lease_client_type):
                return lease_client_type(
                    base_url=transport.BASE_URL, project_ref=transport.PROJECT, api_key=key,
                    opener=transport.ApikeyOnlyLeaseOpener(
                        key, lease_client_type._open_no_redirect))
            sys.argv = ['register_phase1.py', '--execute']
            try:
                registrar.main(expected_evidence_hashes=expected,
                               initial_sources=sources,
                               client_factory=same_private_client)
            except Exception as error:
                print('REGISTRATION_STOP: ' + type(error).__name__, flush=True)
                return 1
            return 0
        time.sleep(1)
    print('STOP: independent admission deadline exceeded', flush=True)
    return 1


if __name__ == '__main__':
    try:
        result = main()
    except Exception as error:
        print('STOP: ' + type(error).__name__, flush=True)
        result = 1
    sys.exit(result)

"""One approved read/probe; memory-only custody across independent admission."""
import hashlib
import json
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
import lease_transport as transport

def main():
    admission = HERE / 'REGISTRY_ADMISSION_APPROVAL.json'
    if admission.exists():
        print('STOP: pre-existing admission receipt', flush=True)
        return 1
    sources = {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
               for name in ('lease_transport.py', 'register_phase1.py',
                            'run_authenticated_registration.py')}
    try:
        key = transport.retrieve_existing_key()
        status = transport.authentication_probe(key)
    except transport.TransportError as error:
        print('AUTHENTICATION_STOP: ' + str(error), flush=True)
        return 1
    print('AUTHENTICATION_PASS: HTTP ' + str(status) + '; awaiting independent admission', flush=True)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        if admission.exists():
            approved = json.loads(admission.read_text())
            if (approved.get('verdict') != 'APPROVE' or
                    approved.get('reviewer') != 'phase1_registration_contract_review' or
                    approved.get('sources') != sources or
                    sources != {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
                                for name in sources}):
                print('STOP: independent admission mismatch', flush=True)
                return 1
            import register_phase1 as registrar
            api = registrar.SupabaseLeaseClient(
                base_url=transport.BASE_URL, project_ref=transport.PROJECT, api_key=key,
                opener=transport.ApikeyOnlyLeaseOpener(
                    key, registrar.SupabaseLeaseClient._open_no_redirect))
            registrar.client = lambda: api
            sys.argv = ['register_phase1.py', '--execute']
            try:
                registrar.main()
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

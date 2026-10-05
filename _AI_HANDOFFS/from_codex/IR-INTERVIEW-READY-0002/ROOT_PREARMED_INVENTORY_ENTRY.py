"""Root's single manually admitted inventory attempt; never issues controls."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time

HERE = Path(__file__).resolve().parent
PREFIX = 'NATIVE_INVENTORY_20261005_8_INDEPENDENT_'
WRAPPER_SHA = '96a8ab27c21127d2d69ae20dc9239a473dbfaeeba64a771b0a7005d4ce05cbc9'
OWNER_SHA = '832aaac4d353c5b4f8866e3f9e5b3c7196e8d3da28d74789be25686e7f4d5080'


def data(name, cap=262144):
    assert re.fullmatch(r'[A-Za-z0-9_.-]+', name)
    path = HERE / name
    assert path.is_file() and not path.is_symlink()
    assert not any(p.is_symlink() for p in path.parents)
    assert path.stat().st_size <= cap
    value = path.read_bytes()
    assert len(value) <= cap
    return value


def digest(value):
    return hashlib.sha256(value).hexdigest()


def main():
    if sys.flags.optimize:
        raise SystemExit(1)
    assert len(sys.argv) == 2 and re.fullmatch(r'[0-9a-f]{40}', sys.argv[1])
    expected_head = sys.argv[1]
    assert digest(data('runtime_native_runner.py')) == WRAPPER_SHA
    assert digest(data('native_inventory_owner.py')) == OWNER_SHA
    ready_path = HERE / (PREFIX + 'ROOT_READY.json')
    assert not ready_path.exists() and not ready_path.is_symlink()
    assert not (HERE / 'NATIVE_INVENTORY_OWNER_20261005_8_PRIVATE_1').exists()
    assert not (HERE / 'NATIVE_INVENTORY_20261005_8_AUTH_INVENTORY_CONTROL_1').exists()
    deadline = time.monotonic() + 1200
    print('ROOT_WAITING_FOR_MANUAL_SET8', flush=True)
    while not ready_path.exists():
        assert time.monotonic() < deadline
        time.sleep(0.1)
    ready = json.loads(data(ready_path.name, 4096))
    assert set(ready) == {'schema', 'sourceHead', 'handoffSha256'}
    assert ready['schema'] == 'ir.independent.root_ready.v1' and ready['sourceHead'] == expected_head
    handoff_bytes = data(PREFIX + 'HANDOFF.json')
    assert digest(handoff_bytes) == ready['handoffSha256']
    handoff = json.loads(handoff_bytes)
    assert handoff['sourceHead'] == expected_head
    assert handoff['reviewer'] == '/root/inventory_exact_admission_reviewer'
    assert handoff['verdict'] == 'APPROVE_READY_PENDING_ROOT_SNAPSHOT_MATCH'
    assert handoff['ownerDirectoryAbsent'] is True and handoff['inventoryDirectoryAbsent'] is True
    assert handoff['ownerMaxSeconds'] == 1800 and handoff['inventoryMaxSeconds'] == 600
    assert handoff['providerObservedUnix'] <= time.time() < handoff['providerFreshUntilUnix']
    assert handoff['providerFreshUntilUnix'] == handoff['providerObservedUnix'] + 300
    required = {PREFIX + suffix for suffix in (
        'AUTH_INVENTORY_SPEC.json', 'AUTH_INVENTORY_CONTRACT.json',
        'OWNER_APPROVAL.json', 'OWNER_READ_ADMISSION.json',
        'AUTH_INVENTORY_APPROVAL.json', 'AUTH_INVENTORY_READ_ADMISSION.json')}
    assert type(handoff['files']) is dict and required <= handoff['files'].keys()
    for name, sha in handoff['files'].items():
        assert name.startswith(PREFIX) and digest(data(name)) == sha
    spec = json.loads(data(PREFIX + 'AUTH_INVENTORY_SPEC.json'))
    assert spec['sourceHead'] == expected_head
    module_spec = importlib.util.spec_from_file_location('ir_root_set8_wrapper', HERE / 'runtime_native_runner.py')
    wrapper = importlib.util.module_from_spec(module_spec)
    sys.modules[module_spec.name] = wrapper
    assert digest(data('runtime_native_runner.py')) == WRAPPER_SHA
    module_spec.loader.exec_module(wrapper)
    actual = wrapper.snapshot('auth_inventory', spec)
    actual_bytes = wrapper.canonical(actual)
    assert digest(actual_bytes) == handoff['bindingSha256']
    assert actual == json.loads(data(PREFIX + 'AUTH_INVENTORY_CONTRACT.json'))
    approval_bytes = data(PREFIX + 'AUTH_INVENTORY_APPROVAL.json')
    wrapper.validate_controls('auth_inventory', json.loads(approval_bytes),
        json.loads(data(PREFIX + 'AUTH_INVENTORY_READ_ADMISSION.json')),
        actual, digest(approval_bytes), 600)
    with (HERE / 'NATIVE_INVENTORY_20261005_8_ACTUAL_CONTRACT.json').open('xb') as stream:
        stream.write(actual_bytes)
    assert digest(data('native_inventory_owner.py')) == OWNER_SHA
    print('ROOT_SET8_SNAPSHOT_MATCH_SINGLE_ATTEMPT', flush=True)
    os.execv(sys.executable, [sys.executable, '-B', str(HERE / 'native_inventory_owner.py'),
        '--execute', '--approval', PREFIX + 'OWNER_APPROVAL.json',
        '--read-admission', PREFIX + 'OWNER_READ_ADMISSION.json'])


if __name__ == '__main__':
    try:
        main()
    except BaseException:
        print('ROOT_SET8_ENTRY_STOP', flush=True)
        sys.exit(1)

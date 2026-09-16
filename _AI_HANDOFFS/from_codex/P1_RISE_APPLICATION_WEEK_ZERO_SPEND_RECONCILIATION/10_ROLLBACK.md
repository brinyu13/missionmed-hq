# Rollback

## Targets

- Immediate Railway rollback deployment: `ae604e94-c690-4d2c-9508-7dd9877b3c39`.
- Immediate prior image: `sha256:103c530d2a85964b957d699a907ffe6bdc386dafea11669743ec5255b87caa5b`.
- Code rollback parent: `f3556674351fc19453f57f7152d5f8d92dbb0241`.
- Current code repair: `65f9edc44f5ecfa20af96e976146aeb9afad27bb`.

## Procedure

1. Acquire the exact authorized RISE PATH lease.
2. Roll Railway service `missionmed-rise` back to deployment `ae604e94-c690-4d2c-9508-7dd9877b3c39`.
3. Confirm health, build `rise_web_8a55c2a73ee5`, registry `rise_registry_2026-07-09_8fdb5afb84f6`, and router OFF.
4. Re-run authenticated 6,139/31, SOAP, My Programs, Program File, and anonymous 401 checks.
5. If code rollback is also required, revert only commit `65f9edc` in a clean authorized change; do not reset or discard the pre-existing working-tree overlay.

No rollback was required. The previous deployment remains provider-addressable and the code change is limited to source-neutral depth reads plus its test.


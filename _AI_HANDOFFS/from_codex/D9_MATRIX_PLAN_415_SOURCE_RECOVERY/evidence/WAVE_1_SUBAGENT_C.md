# Wave 1 Subagent C — WordPress, MU-Plugin, and Security Analyst

## ROLE

D9-415 Wave 1 Subagent C — WordPress, MU-plugin, and security analyst.

## SCOPE

Read-only inspection of WordPress/MU metadata, load behavior, Matrix boot structure, auth bridges, account entry, Scheduler/Webex dependencies, and secret/private-data risks. No state changed.

## FILES AND SYSTEMS INSPECTED

Production WordPress MU loader, targeted top-level MU files, complete hub inventory/bootstrap structure, and local tracked auth/proxy counterparts. No credentials, cookies, request payloads, database rows, or student data were inspected.

## FACTS ESTABLISHED

- WordPress sorts and `include_once`s every top-level MU filename ending in `.php`; nested PHP is not auto-loaded without a loader.
- `missionmed-mr-legacy-popup_BACKUP_PRE004.php` is auto-loaded, mode `0644`, 14,800 bytes, SHA-256 `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`.
- It is byte-identical to `missionmed-mr-legacy-popup.php`, including guarded functions and registered callbacks.
- Target MU hashes:
  - auth handoff `f8c14ce4c833174fd1f7837e7a669f390a9cfc03fabcbf4db66d29b1b69ed4b3`;
  - HQ proxy `85e155f7f5e00ac465e1e5d61b4160d0d7a4d2fa97178bbb52adb8d811d3ccb3`;
  - Supabase cookie bridge `d343f7581e3c131bc9a4f5e6a1f2c2c8966c82b9e88d01e92430989e505dc26f`;
  - Matrix account entry `4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba`;
  - Scheduler/Webex broker `5544dccf9504266db42105fea048db6687ad28cd53865b3df8aaeff6c4154455`.
- Hub bootstrap always requires 24 core components and conditionally requires 14 Matrix classes plus optional Live Drills SDK v3 when Student OS is enabled.
- Account entry can directly load the hub LearnDash reskin class.
- Auth handoff/proxy/Supabase bridge and Scheduler/Webex files are source-sensitive and must be content-scanned locally without exposing values.
- Local tracked versions of the three auth/proxy MU files do not match production.

## CONFLICTS

- Current controller `23da5c...` supersedes D9-410 `f97fb...` and active lock `c0a538...`.
- Production auth handoff also has a current-day modification and differs from the tracked local copy.
- The exact baseline and safe source head must remain separate commits.

## P0 BLOCKERS

- Controller drift is a stale-runtime hard stop.
- No production source may enter Git before a quarantined redacted secret/high-entropy scan.

## P1 RISKS

- Executable backup placement can become behaviorally dangerous if bytes/order diverge.
- Handoff tokens carry signed identity/entitlement fields and proxying forwards broad headers/cookies.
- Scheduler/Webex uses configured credentials/tokens; no option/log/request data may enter source.
- Plugin activation must never run in CI because it can seed state.

## RECOMMENDED MAIN-AGENT ACTIONS

- Resolve the runtime cutoff first.
- Snapshot atomically, content-scan outside Git, and import exact bytes only if safe.
- Preserve the backup in D9-415A and move it unchanged outside autoload scope only in D9-415B.
- Build explicit MU autoload/dependency manifests; defer all auth/entitlement behavior changes.

## EVIDENCE PATHS

Production WordPress core loader, targeted MU paths, hub bootstrap/classes, and this worktree's tracked MU directory.

## CONFIDENCE

High for loader behavior, targeted hashes, backup execution, and boot dependencies; medium for complete transitive closure.

## UNRESOLVED QUESTIONS

Authority/cutoff for Y1-CAM-4005, secret-scan outcome, exact entitlement/plugin versions, and whether additional auth/session controls exist.


BLOCK — exact dormant bridge/runner bytes; account creation remains gated.

Independent reviewer: `/root/native_bridge_review`, assigned Sol6.1 High auth/privacy review, 2026-10-04. Bounded review only. Existing product/source/production acceptance is outside this finding; no rebuild or live audit was performed. Only this new report is a durable write; STOP UNCOMMITTED.

## Exact custody and authority

Product HEAD verified `3da89f3d6a40b620cc89aba1a79d3d55a273a3f8`; R2 OS HEAD verified `bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2`. Read BOOT routing, exact IR mission/profile, passport, DR-375/376 and registration route, plus NATIVE_NEXT_EXECUTION_PACKET.md. Mission-profile BOOT validator PASS against canonical `/Users/brianb/MissionMed/.git`, HQ origin/main tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; canonical MR-079 guard object verified through the manifest. Initial validator invocation mistakenly supplied the checkout instead of its Git directory; corrected argument, no state change. No sync/provider claim is inferred from local BOOT validation.

Six frozen SHA-256 values independently matched:

| File | SHA-256 |
| --- | --- |
| native_browser_bridge.py | `65799165953bbc1aa25bb59ef7e1758b1da651f5cc44ab018502091546efbb77` |
| native_browser_bridge_tests.py | `38a68e7745d6e0c3c67877e1a2a07a38c70006626b7ff8bd8a4a0b757f7a5e0f` |
| NATIVE_BROWSER_BRIDGE_HANDOFF.md | `5403ae7f9e3d597cfdc9622fad2275722b590f74124763e0df2198505e9a7948` |
| runtime_native_runner.py | `0a816e26fcea00422451fe6dc96971a894c5c3ef193d271eb3cb1698da1775f0` |
| runtime_native_runner_tests.py | `4055ed2ffaa7fe29214359f501b5e0803ed75d651f71c771fdd7bbe8e381aa26` |
| RUNTIME_NATIVE_RUNNER_HANDOFF.md | `00fd89bb23c790dec1b715009abe48702e1b3b7029553b4849d2687dee9d052c` |

Unchanged Native6 SHA `c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1` independently matched. Prior finite-readback/native containment evidence keeps its prior scope; it does not cover the new timing defect.

## P1 — custody deadline is unenforced during the native protocol

`native_browser_bridge.py:103` sets the deadline to min(current AUTH deadline, construction +600 seconds). `run:199-203` then executes the entire native protocol, whose closed subclass copies both passwords before normal super.login. The independent expiry worker starts only afterward, in `Bridge.start:123-124`. During the protocol there is no watchdog and no registered bridge custody; Custodian.capture itself has no deadline check. A healthy longer AUTH protocol can therefore retain the copies past the declared bridge deadline. Eventual finally clearing and a refused late listener start do not establish clearing at that deadline. The unchanged native gate bounds its own larger admission, not the bridge's 600-second custody limit.

Independent injected reproduction used the exact module, a healthy one-second fake Gate, `LIFETIME=.03`, the actual closed capture adapter, and a fake native protocol which captured the two fictional passwords then slept .07 seconds before returning. Listener factory and publication were forbidden assertions. At .07 seconds the private observation was:

```text
retainedAfterLifetime=True
gateStillOpen=True
watchdogCount=0
elapsedBeyondLifetime=True
terminalStop=True
finalPrivateRefsCleared=True
```

The shortened lifetime tests ordering without waiting 600 seconds; it does not claim an actual production protocol exceeded 600 seconds. No password value was printed. The late STOP/final clear confirms containment eventually unwinds while disproving deadline-time clearing.

Minimal delta: register bridge/custodian custody and start the independent deadline worker before execute_native can capture any password. Keep listener creation after successful native protocol. Use the unchanged absolute deadline; start the worker exactly once, refuse captures after closure, and retain/finite-drain startup ambiguity and workers before lease release. Add a native-protocol-in-progress expiry test proving refs clear and gate closes before native returns; add before-capture/startup-failure coverage. Do not alter Native6, transport, product, normal login, or grants. Reseal changed bytes and obtain focused independent re-review before setting finiteLifetimeQualified/custodyAndDrainQualified.

## Focused evidence and retained boundaries

- Bridge replay: 12 tests PASS, .055s. Two directly related wrapper qualification/drain tests PASS, .119s. No broad wrapper/package suite was needed to reproduce the defect.
- Independent injected cases: gate refusal sends no form; bad Host returns empty403; synthetic canary is escaped; unknown listener constructor remains active and close returns false. Four cases PASS, no actual listener.
- Four modules compile in memory. Wrapper default is DORMANT/exit0. Bridge standalone `--execute` returns NATIVE_BROWSER_STOP/exit1 as required.
- Replay uses existing temporary fixture directories which clean themselves; no source/control files or durable artifacts besides this report were written. No actual network/listener, provider, SSH, WordPress/bootstrap, account, credential retrieval, database/cache, OS/source/index/HEAD/commit, admission, or release operation occurred.

Static review otherwise confirms the AUTH-only closed typed qualification and module/test preimages precede capability/create; exact named username/email/positive UID copies pass to unchanged normal login; fixed loopback Host/Sec-Fetch/path/caps; no-store escaped fixed HTTPS wp-login POST and app return; no cookie injection/bypass; response count4 and finite header/socket/worker limits after startup. Optional testcookie omission remains the explicitly scoped compatibility choice; actual normal-browser refusal must STOP. READY/DONE publish only bounded public custody/evidence fields, and DONE acknowledges evidence rather than PASS. Existing Gate active/thread checks prevent release when tracked custody remains unresolved.

This BLOCK is limited to the new custody deadline interval. Do not create the two retained fixtures under these exact bytes or issue a positive browserBridge qualification. Bootstrap/effects closure, actual privately qualified inventory, exact current controls/pins/provider/runtime, healthy same AUTH lease, isolated anonymous supported IAB, actual A/B refresh/logout/relogin and independently reviewed outcome remain separate gates after repair. No generic Founder reapproval, account reset/deletion/adoption, credential export, retry, Phase2 work, deployment change, or final production approval is requested or granted.

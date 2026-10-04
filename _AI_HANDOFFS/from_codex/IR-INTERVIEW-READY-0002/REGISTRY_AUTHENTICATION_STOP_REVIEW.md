HOLD — no further credential read, provider probe, registrar acquisition or protected implementation is approved. The reported timeout does not establish a non-delegable credential-owner gate; concrete local worker diagnosis must establish the failing stage first.

# Scope and custody

Independent reviewer: `/root/phase1_registration_contract_review`, Sol6.1 High. Date: 2026-10-04. Assigned base `71c5e5baa780f6af0848a4aabbd67d04fb3aab1f`. Only this new report is authorized for writing. No credential, environment value, keychain item, token-file content, running credential process or provider response was read. No provider/OS mutation, registrar execution, retry, push or merge was performed.

Verified local inputs:

- `run_authenticated_registration.py`, SHA256 `02eefb3348a39d7a6c0a748667d734709927f111b52e0ec754492bed359cb224`.
- Previously accepted `lease_transport.py`, SHA256 `bfa43334e4065b33705b1c6192a60e28333c011587f4e421a34802e144111d79`.
- Previously accepted `register_phase1.py`, SHA256 `82cc46596206bd3f69caa75b442738647d446d26644a21f9dc6695974ea62a0f`.
- Existing independent review/addenda and implementation/diagnosis context. The three named Python files independently pass AST syntax parsing; none was imported or executed by this reviewer.

Foreman-reported actual result, not independently repeated: the single admitted read/probe attempt exited 1 with `AUTHENTICATION_STOP: transport deadline exceeded`; no AUTHENTICATION_PASS, admission receipt, IR registry lease or staged OS candidate exists, and the registrar clone remains tracked-clean. The key was not retained after exit. This review does not independently certify provider lease state or the clone's current cleanliness; those observations are attributed to Foreman.

# Gate adjudication

Verified code plus inference: `transport deadline exceeded` is a constant value-free error used by the bounded transport deadline checks. It does not identify whether management-token lookup, native keychain worker, token-file operation, reveal GET or read-only health GET reached the deadline. It is not evidence of keychain permission denial, missing custody, Management API 401/403, key revocation or a provider authentication rejection. Do not characterize it as a proven credential-owner action or the earlier 401 cause.

The wrapper follows the intended memory-custody shape: it rejects a pre-existing admission receipt, hashes the three named sources, retrieves once and probes once, emits value-free authentication failure or status only, and reaches the admission wait only after successful authentication. It constructs the accepted canonical client and strict opener from the same privately retained key and overrides only the local registrar's `client` callable in process memory. Thus it avoids an accidental second reveal. It rechecks exact source hashes and independent-reviewer admission fields before attempting the registrar. No key enters argv, environment, files or receipt; ordinary exception output is type-only. The scoped source inspection found no new implementation defect in that wrapper, but its real happy path remains unverified and no registrar admission approval is issued here.

The current attempted read/probe authorization cannot be recycled merely because the attempt timed out or the process lost its key. Existing authenticated state has not been established. No another-key/default fallback, wider keychain search, login/unlock/grant click, header/provider change, manual lease substitute or speculative retry is admitted.

# Minimum permissible continuation

1. Continue the separately assigned local worker diagnosis using exact code, public primary sources and synthetic fixture/mocked subprocess reproduction. Do not repeat credential lookup or provider calls to locate the timeout. Capture only value-free stage/control-flow facts; no secret-bearing logs, worker buffers or process dumps.
2. If diagnosis establishes a concrete implementation/deadline/worker defect, prepare the smallest scoped local correction and focused regression evidence. Submit its exact changed bytes and causal explanation for independent review. A reviewed bug correction can be within current Founder registration authorization; no generic new Founder approval is required solely to repair local transport. Approval of correction does not itself authorize a further real read/probe; the new bounded attempt must receive explicit review admission first.
3. If concrete evidence instead establishes missing/locked/denied custody, required permission UI, Management API identity/secret-read denial, or rejection of the exact revealed key, identify that exact owner/provider action. Preserve the gate and do not automate permission grants, unlocks or key replacement. A timeout alone cannot support this conclusion.
4. Only after independently admitted corrected transport and a successful newly bounded read/probe may normal same-process REGISTRY/keeper admission resume. Independent exact nine-file staged approval, canonical filing/readback, fresh BOOT, release/provider-clear and separately leased product/release work remain mandatory.

Authority remains the accepted MR-079 immutable guardrail and current MMOS-006/BOOT stops, plus the scoped prospective transport addenda. This HOLD concerns the failed authentication branch; it does not revoke the earlier bounded registration/product contract or authorize any new protected work. No diagnosis conclusion is invented while the independent worker is still investigating.

Latest supplied worker findings: synthetic private-pipe empty/stdout/stderr/stdin/exit-3 cases passed in approximately 0.017 seconds; a sleeping fixture correctly failed at its 0.15-second limit. No definite local bug was reproduced. Those findings are attributed to the independent implementation worker, not re-executed here. Tool polling time is not measured monotonic transport duration and cannot locate the failing stage. Foreman checkpoint `750aea4` preserves the stop.

Current recovery classification: **authentication/custody availability unresolved; no approved real retry and no proven local repair target.** It is not a confirmed locked-keychain or permission-denial incident. Value-free phase/elapsed instrumentation may be prepared locally for independent inspection, without running it against credentials/providers. If owner-led recovery is pursued, its purpose is to restore access to the existing canonical Supabase CLI management identity through the ordinary owner's credential channel; no new project key, credential grant or provider auth change is called for by this evidence. Do not demand a specific unlock, secret-read grant or key replacement without the concrete corresponding denial. Any newly attempted read/probe still needs separate bounded independent admission after instrumentation/causal or owner-custody evidence; no silent retry under the consumed authorization.

Scoped Git hygiene preflight passed before writing. Dirty registration packet, unrelated `supabase/.temp/cli-latest` and preservation-only `_AI_INPUTS/` were untouched. Only this report is staged and committed. Local commitment is not pushed-filed authority. Stop this reviewer after the report-only commit.

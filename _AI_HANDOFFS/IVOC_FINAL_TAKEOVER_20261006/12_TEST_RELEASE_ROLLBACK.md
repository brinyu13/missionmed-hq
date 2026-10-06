# Tests, release, rollback

Commands relative to Foreman repo unless noted. These are instructions, NOT actions performed in documentation audit. Do not rerun unrelated historical suites/provider/device checks merely for takeover.

## Focused contracts

~~~sh
node --test ivprep-v6/test/8001/embodiment-provider.test.mjs missionmed-hq/tests/ivoc/embodiment.test.mjs
node --test ivprep-v6/test/8001/live-interview.test.mjs ivprep-v6/test/8001/live-interview-integration.test.mjs ivprep-v6/test/8001/closing-role-policy.test.mjs ivprep-v6/test/8001/openai-live-transcript-observer.test.mjs ivprep-v6/test/fable-convergence/hook-guidance.test.mjs ivprep-v6/test/fable-convergence/hook-references.test.mjs
node --test ivprep-v6/test/8001/conversation-recording.test.mjs ivprep-v6/test/8001/camera-frame-recovery.test.mjs ivprep-v6/test/8001/film-room-rehydration.test.mjs ivprep-v6/test/8001/own-library-review.test.mjs ivprep-v6/test/8001/review-scope.test.mjs ivprep-v6/test/fable-convergence/saved-review-boot.test.mjs
node --test ivprep-v6/test/fable-convergence/pitch-coaching.test.mjs ivprep-v6/test/fable-convergence/review.test.mjs ivprep-v6/test/fable-convergence/history-view-model.test.mjs ivprep-v6/test/fable-convergence/film-lanes.test.mjs
node --test missionmed-hq/tests/ivoc/application-intelligence.test.mjs missionmed-hq/tests/ivoc/context-provider.test.mjs missionmed-hq/tests/ivoc/file-vault-projection.test.mjs missionmed-hq/tests/ivoc/storyforge-projection.test.mjs missionmed-hq/tests/ivoc/rise-projection.test.mjs ivoc/intelligence/acceptance.test.mjs
node --test ivprep-v6/test/8001/release-artifact.test.mjs ivprep-v6/test/8001/preflight-compatibility.test.mjs
~~~

Only run changed-boundary subsets first, integrated current contracts once before release if necessary. Latest repaired-provider29PASS, independent26PASS, candidate mandatory build69PASS are dated receipts. Tests do not establish physical camera/speech/avatar/heard replay.

Actual Railway start node missionmed-hq/server.mjs and /health configured in root railway.json. Build uses current HQ package/runtime tooling, not legacy ivprep standalone start or obsolete worker. Shared HQ build69checks passed on current release; do not remove mandatory shared checks or mutate their product to force green.

## Exact source/package custody

DR350 canonical packager ivprep-v6/scripts/check-release-artifact.mjs.
Use a clean remotely read-back clone of the approved branch/commit, HEAD equal remote. Script inventories git-tracked files and applies protected existing ignore/Railway rules to a fresh filtered stage; report/archive digest and required-file assertions. Never upload dirty Foreman/donor/untracked handoffs or raw private artifacts.

Historical trap: broad token/credential ignore omitted REQUIRED missionmed-hq/lib/auth/session-token.mjs and caused runtime failure. Exact tracked-file exceptions now preserve it, missionmed-hq/lor-studio/security/faculty-candidate-credential-context.mjs and ivprep-v6/public/ivoc-standalone/styles/tokens.css while secret protections remain. Whole HQ mount scope preserved without taking sibling ownership. NO --no-gitignore / broad ignore disable.

Latest source89a release:1307files; archiveSHA2560adb4042f6552702d1e73ef42ad18d43ba32274899b4e99e2f896c7429dac3ca. Later doc-only package commit may alter counts/digest if included; compute fresh, don't copy this digest onto a different archive.

~~~sh
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/codex/ivoc-foreman-9200
node ivprep-v6/scripts/check-release-artifact.mjs
~~~

Run packager in CLEAN review clone. Use its returned filtered stage, not an inferred temp path. No broad npm audit fix/dependency upgrades; current default-branch advisories/build warnings are not certified resolved by this handoff.

## Authority / lease / release sequence

Read BOOT→CURRENT→mission/passport→routed authority; record known-good deployment/source/image/OFFconfig. Independently review affected code. Acquire exact PRODUCT/PATH/SHARED scopes with canonical durable keeper, validate server lease_id/fencing/nonce, heartbeat through build/release/readback/filing, fail closed on lost renewal. Shared Railway is exclusive; preserve current sibling changes.

Canonical lease API/tool source:
 /Users/brianb/MissionMed_OS/tools/engineering_os_lease.py
Use CURRENT routed keeper integration, LeaseClient acquire/acquire_writer, heartbeat/validate and release; server nonce/fence only. The previously used temporary keeper path is ephemeral and NOT a portable successor dependency. Do not invent CLI flags from a library, store nonce/key files, revive released claims or use physical LeaseV2 key instead of logical_resource_key. Query canonical release rows to prove release; local flag insufficient.

BOOT dependency validator:
~~~sh
python3 /Users/brianb/MissionMed_OS/tools/validate_boot_dependencies.py --hq-git-dir /Users/brianb/MissionMed/.git/worktrees/ivoc-master-80002 --os-root /Users/brianb/MissionMed_OS --mission-profile IVOC-CONVERGE-8001
~~~
Resolve actual git common-dir/worktree Git dir if successor uses another checkout; don't pin this Foreman git-dir to a new worktree. Stale Matrix/unresolved authority warning is a hard stop for affected protected mutation, not a permission to bypass it.

After approved candidate and fresh leases ONLY:
~~~sh
railway up --detach --json --path-as-root --message 'IVOC exact reviewed candidate' -p 29afe885-b9b1-425d-8fd8-8611cd275409 -s 3d18b017-4fc9-4b22-b097-ba879816d374 -e ed3353f7-bcc7-4e25-a000-3c9fc628a9a7 /ABSOLUTE/PACKAGER/RETURNED/STAGE
~~~
The STAGE placeholder must be replaced with validated packager output, never executed literally.

Read deployment by exact ID, build logs and image, selected nonsecret runtime module hashes/config projection. Logs use positional deployment ID, not invented combined --build --deployment flags. Verify health200/statusok, product/bootstrap anonymous401, authorized Matrix entry, impacted POV and schema/media/privacy. Never dump Railway variables/session secrets or signed provider URL.

## Rollback

Keep known-good serving while candidate builds. On outage use CURRENT most recently verified healthy OFF deployment/source/config. Railway REMOVED can be terminal: do not repeat failed ID rollback. Sanctioned exact-source/image/config OFF redeploy preserves newer Git source. Do NOT restore an exhausted canary ON config or reset/force-push source. Record new runtime identity, diagnose narrowly, fix forward.

Release every lease normally; canonical readback required. Reacquire fresh leases for later operation, no holds while waiting for human/spend. Current85abc/89a/image48cdd is infrastructure rollback baseline; full product acceptance not implied.

Protected release may remain Codex-only until canonical successor authority is filed. Claude prepares reviewed commits/candidate and return packet, not self-authorized deployment.

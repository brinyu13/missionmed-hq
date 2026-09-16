# IVOC end-to-end megarun state

Updated: 2026-09-16 14:22 America/New_York  
Mission: `IVOC-CONVERGE-8001`  
Authority: `DR-288`  
Branch: `codex/ivoc-converge-8001-production`

## Canon and completed lanes

- F1 is canonical at product commit `9fb848c26f6f220b61900138acb1b51622f12b5d`.
- Founder-facing presentation is the recovered Astra candidate.2 lineage sealed by
  `dedb726bde521a135bec2286ad4cd5a877a68fc7ecd6144fde16b76bc9c09ac4`.
- The M1 "Your interview, measured honestly" surface remains an internal engineering
  harness and is not the product presentation.
- Candidate.2 presentation integration is committed at `b386222490408b88344f81d4c2dfb32a8d9ba5b1`.
- GPT-Live WebRTC InterviewBrain integration is committed at
  `0b272bbc8f1ea168b05603c0da5a0cd7f154bee3`.
- Candidate.2 durable authenticated recording, Analytics-result persistence,
  playback, owner library, and role-bounded views are committed at
  `9701bb0742e65fbf2cdb210265ae4fd0d575dcc4`.
- LemonSlice remains deferred until realtime conversation and real Analytics have
  live canary evidence.

## Data authority

- Development and migration target: Supabase branch `ivoc-converge-8001-m1`, branch
  id `e6211750-f6f2-43c8-80df-854e06fc1966`, project ref
  `mwyqdupgalpvtupceozz`.
- Parent `missionmed-cam-dev` (`tufzqxeucfugdovtjyqk`) remains a historical
  development dependency only. It is not permanent IVOC production authority.
- Provider inventory contains no existing dedicated IVOC production project. The
  technically coherent production decision is a dedicated MissionMed IVOC
  production Supabase project with service-role-only server access, the existing
  IVOC RLS/revocation/audit model, private R2 media, and an explicit migration and
  rollback receipt. No existing unrelated project is to be relabelled or promoted.
- Hosted IVOC database wiring accepts a non-legacy target only when the server-owned
  `IVPREP_SUPABASE_PROJECT_REF` exactly matches the project URL. This makes the
  sanctioned development branch and the later dedicated production project usable
  without weakening cross-project binding checks.

## Current production evidence and gates

- MissionMed HQ production health returns HTTP 200.
- All required current IVOC database and private-R2 Railway bindings are present.
- MissionMed HQ owns a server-side `MMHQ_OPENAI_API_KEY`; IVOC uses that existing
  namespaced binding without duplicating or exposing the secret.
- Production currently runs Railway deployment
  `fefc56c4-5c0e-41c5-96fc-6493a1d966af`, created 2026-09-08, not the active IVOC
  branch.
- Root production dependency audit reports zero runtime vulnerabilities. GitHub's
  four default-branch advisories are not reproduced in the current production
  dependency set and still require separate repository-security triage.
- The critical-systems gate is not green: the current canonical tree does not contain
  the manifest's registered StoryForge V5 and Timeline source roots, and live checks
  detect pre-existing USCE and StoryForge route/asset drift. Do not deploy a local
  archive that could omit or overwrite those protected sibling runtimes.
- Matrix runtime preflight independently blocks direct Matrix asset mutation because
  live hashes drift from the lock. No IVOC transaction has touched those assets.

## Remaining acceptance work

1. Establish the dedicated IVOC production data authority without paid-resource
   creation absent spend authority; migrate and verify the approved schema there.
2. Resolve or canonically waive the critical-systems gate failures in the owning
   StoryForge, Timeline, USCE, and Matrix lanes; do not bypass their locks from IVOC.
3. Deploy the exact remotely read-back IVOC commit to MissionMed HQ only after the
   gate is green and an immutable preimage/rollback target is captured.
4. Run authenticated Founder/Admin, Student, and assigned-Mentor canaries for
   admission, role privacy, camera/microphone, real Analytics, private recording,
   results, playback/range download, and anonymous/unrelated-user denial.
5. Run one bounded GPT-Live conversation canary under explicit provider-spend
   authority, verify teardown and zero credential exposure, then decide whether the
   deferred avatar lane should open.
6. Declare `LIVE AAA CORE IVOC ACCEPTED` only after those live proofs pass.

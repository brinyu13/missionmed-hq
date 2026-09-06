# I1Q 1006 Blocking Operator Actions

Execute these only through the current MissionMed OS and protected-system protocols.

## 1. Resolve MissionMed OS repository ownership

Run read-only inspection first:

```bash
lsof /Users/brianb/MissionMed_OS/.git/index.lock
git -C /Users/brianb/MissionMed_OS status --short
git -C /Users/brianb/MissionMed_OS log --oneline --decorate -5
```

BLOCKED: Do not delete the lock until the process owner or Brian confirms no active Git operation owns it.

After the lock is safely resolved by the operator, run:

```bash
git -C /Users/brianb/MissionMed_OS pull --ff-only
```

## 2. Apply and validate I1Q registration

Use `registration/i1q_registration_patch.json` through the canonical additive registration process.

Required console actions:

1. Back up `missions.json` and `products_index.json` using the OS protocol.
2. Confirm mission ID and product name are absent.
3. Append the mission and product records.
4. Create the proposed passport only if absent.
5. Regenerate `CURRENT.md` through the canonical helper.
6. Re-run BOOT validation and confirm no stale Matrix warning.
7. Commit the registration separately in MissionMed OS.

## 3. File protected integration decision

Use `registration/protected_integration_decision_request.json` to create a current decision record that names:

- app host
- auth adapter
- database project/schema
- migration route
- staging and rollback route
- media export boundary
- STAT and Drills adapter ownership
- release and incident owners

## 4. Assign governance owners

At minimum assign privacy owner, medical governance lead, release manager, and incident owner. Record physician credential verification and expiry policy.

## 5. Authorize exact read-only media export

The approved export must contain only metadata needed for reconciliation:

- canonical video ID and title
- collection/course and topic hints
- duration and recording date if known
- transcript, VTT, and nodes availability plus format
- segment count, timestamp coverage, and speaker-label availability
- source references and hashes
- rights and privacy state
- likely and verified Dr. J status
- extraction suitability and block reason
- duplicate relationship, currentness, and source authority

Write the export to an approved local static path. Do not print credentials or raw student speech.

## 6. Bind and preview the datastore

After the database ruling, run the current Supabase migration protocol against a preview branch using:

`i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`

BLOCKED: The exact project command cannot be safely supplied until the canonical project and credential-loading route are selected. Do not substitute an ad hoc project ref.

## 7. Run candidate gates

```bash
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform
npm test
node scripts/generate_evidence.mjs
```

```bash
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000
node _AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/audit/run_all.mjs
```

## 8. Continue

EXACT NEXT ACTION: Run I1Q-1007 Ultra Release Audit and Production Launch after actions 1 through 6 are resolved.

# Y2-3101 Fresh Context Verification

## Audited Target

- Branch: `codex/y2-3101-interviewer-brain-harness`
- Final audited commit: `fa441bb9e5ebd5aa8c0791cce3b9b735d5a0ef2a`
- Superseded audit target: `08563bcda0be670ba3f12b779a5407070d42c488`
- Policy aggregate: `764d711be19c54d81e96b2e2638904c4db2628c7585cb6ef110e4b16885b53d4`
- Holdout SHA-256: `eaf3494e6d763401ec5b7512ddfdeb38ea45e596758f467ee89b933888bdb0d2`
- Holdout manifest SHA-256: `b62e4db4e5646eb08f5278a32f6d49c12b18d28031bc0388ecd6ecc3f8c67c81`

The verifier used a credential-empty `/tmp` archive of the committed target and did not read or mutate the untracked report drafts. Generated audit outputs were removed afterward.

## First Fresh Audit

The first audit returned `FAIL` against a moving pre-final target. It identified four valid concerns:

1. holdout `primary_category` selected the evaluator plan question family;
2. consented applicant-pack attack text was catalogued but did not reach `processTurn`;
3. injection success accounting relied too heavily on lexical guard results;
4. T7 machine checks projected fixture-authored events and could not establish human summary accuracy.

The evaluator was repaired without changing frozen policy. Regression tests now prove category-label independence and pack admission. Behavioral compliance is checked in addition to guard output. Reports now classify T7 as structural smoke with external human review pending.

Commit `08563bc` initially captured those repairs but included one over-strict test assertion: it expected pack facts to be the only ledger claims, excluding the legitimate learner claim. Its corresponding `pass:false` verification artifact is retained in history as superseded evidence. Commit `fa441bb` corrected only that assertion, reran all gates and replaced the stale final artifacts.

## Independent Final Verdict

`PASS WITH NAMED NONBLOCKING LIMITATIONS`

The fresh verifier independently confirmed:

- local and remote branch both resolved to `fa441bb`;
- all 25 frozen policy files matched the expected aggregate;
- holdout and manifest hashes matched;
- no frozen policy file changed after evaluation-harness work;
- hidden adaptivity/injection labels produced identical move, utterance and rationale for the same visible input;
- consented pack facts entered ledger claims before `processTurn`;
- behavioral injection accounting can detect concrete unsafe compliance such as obeying an instruction to end the interview;
- all 8 fresh gates passed: syntax, typecheck, 27/27 tests, development 20/20, stress, source security, artifact privacy and expected holdout exit `1`;
- T2 reproduced at 10/10 ordinary plus 10/10 reconnect, with zero wrong attribution/confabulation;
- the frozen holdout reproduced 76 cases, 91 atomic results and deterministic projection;
- T1, T3 and T4 remained central failures.

## Named Nonblocking Limitations

1. Two policy iterations are supported by committed evidence, but historical policy source snapshots are not committed and the kill function does not mechanically verify the iteration count.
2. Injection evidence is bounded. Six cases use transcript attacks and two use consented context packs. The encoded `INJECT-004` attack is not recognized by the lexical `attackPresent` detector, so no general prompt-injection-resistance claim is permitted.
3. T7 has no blind human accuracy result. Machine checks establish structural projection only.
4. Raw reports include absolute paths and microtimings. A clean archive produced semantically identical results after excluding those environment-specific fields, but byte portability is not claimed.
5. External no-mutation claims are provenance-limited; Git scope, zero dependencies, inactive adapters and privacy scans support them.

## Kill Decision

`SUPPORTED`

- T1: grounded `0.80`, exact plausibility proxy `0.20`, counterfactual `1/4`, template similarity failure.
- T2: 20/20 callback/reconnect cases, zero confabulation.
- T3: 4/7, or 57.14%.
- T4: 0/5 true conflicts professionally grounded.

The resulting decision is:

`CENTRAL_CAPABILITY_MATERIAL_FAILURE_AFTER_TWO_POLICY_ITERATIONS`

No voice, vendor, student-facing, staging or production expansion is justified.

## Representative Commands

```bash
git diff --name-status 08563bcda0be670ba3f12b779a5407070d42c488..fa441bb9e5ebd5aa8c0791cce3b9b735d5a0ef2a
shasum -a 256 /tmp/Y2_3101_FROZEN_HOLDOUT/holdout.json /tmp/Y2_3101_FROZEN_HOLDOUT/manifest.json
npm run check
npm run typecheck
npm test
node scripts/run-development-evaluation.mjs --label fresh-verifier-fa441bb --output /tmp/development.json
node scripts/run-stress.mjs --output /tmp/stress.json
node scripts/run-security-scan.mjs --output /tmp/security.json
node scripts/run-frozen-holdout.mjs --expected-hash eaf3494e6d763401ec5b7512ddfdeb38ea45e596758f467ee89b933888bdb0d2 --output /tmp/holdout.json
```

## Amended-Prompt Reverification, 2026-07-22

The historical verdict above applies to committed target `fa441bb` and the then-present external holdout package. The amended prompt triggered a new read-only audit of the current branch and expanded deliverable law.

### Fresh Facts

- **VERIFIED:** The exact amended prompt is 40,725 bytes with SHA-256 `50d7e2d6ac8d18306698fc647e7ac62f1de3eb23cb71e0eef79732b3c6ef8ddc`.
- **VERIFIED:** Fresh non-holdout gates pass: syntax, type-loader, 27/27 tests, two byte-identical 20/20 development runs, 2,000 stress analyses, 1,000 ledger events, a 13-file source scan, and a 115-file artifact scan.
- **UNKNOWN:** The original `/tmp/Y2_3101_FROZEN_HOLDOUT/` package is absent. No current holdout rerun is claimed, and the package was not reconstructed.
- **VERIFIED:** Synthetic adversarial probes reproduced arbitrary protected-topic instructor focus, raw sensitive-answer retention after a refusal, an encoded-injection miss, Unicode/code-switching rejection, and acceptance of an overly broad suitability claim contract.
- **VERIFIED:** The prior package omitted the required exact DISC-01 through DISC-10 reports and did not nest subgroup combined handoffs in the master. Those packaging defects are repaired in the amended closeout.
- **VERIFIED:** The exact T1-T7 acceptance language is now preserved in `Y2_3101_TEST_AND_EVALUATION_REPORT.md`; T7 remains pending human timed review.

### Superseding Product Verdict

`KILL_RULE_TRIGGERED`

The engineering harness may be preserved as research evidence, but it is not approved for Y1 integration, student use, pilot, voice, avatar, staging, or production. The newly reproduced runtime defects are mandatory Y2-3103 repair and new-holdout inputs, not reasons to tune the opened Y2-3101 policy.

## Second Final Fresh Pass

The first amended-prompt package audit returned `FAIL` for three documentation defects: an incomplete DISC-8 inventory/deployment account, nonconforming `REQUIRED` claim labels, and security wording broader than the later adversarial counterexamples. Those defects were repaired without changing Brain source, policy, fixtures, holdout evidence, Y1 source, infrastructure, or product scope.

The same read-only verifier then returned:

`PASS WITH NAMED NONBLOCKING LIMITATIONS`

It found no P0 or P1 package-compliance defect and verified:

- DISC-8 contains the complete bridge, Railway-ID, retired-variable, CAM flag, and accepted DEV/production evidence inventory.
- The ten DISC reports and synthesis use only `VERIFIED`, `UNKNOWN`, `INFERENCE`, or `ASSUMPTION` as declared claim labels.
- All 51 child Markdown bodies appear exactly once in the master.
- All four combined-handoff mirrors are byte-identical.
- The 148-source inventory has no missing or drifted source.
- T1-T7 governing text is exact 7/7.
- The 25-file frozen policy snapshot is unchanged.
- The 115-file privacy scan has zero findings.
- Brain source, policy, fixtures, and Y1 CAM donor source are unchanged.

Named nonblocking limitations remain: the current external holdout bytes are absent; exact tracked canonical CAM source is unknown; the Y2 OS receipt is unmerged; timed human T7 is pending; and the documented adversarial safety/privacy defects require Y2-3103 repair. These limitations prevent expansion but do not invalidate the truthful `KILL_RULE_TRIGGERED` closeout.

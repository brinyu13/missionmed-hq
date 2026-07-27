# OSLER Report — Medical Education and IMG Workflow Review

Date: 2026-07-27

Scope: local/read-only review of the canonical StoryForge V5 authority, current
source and built bundle, WordPress role seam, database workflow, existing
browser screenshots, and retained test reports. No production system, provider,
code, Git state, or other agent report was modified.

## Disposition

**BLOCK — ONE LOCAL FOUNDER-WORKFLOW DEFECT BEFORE FOUNDER ENABLEMENT**

The product language, reflective-learning posture, student/mentor ownership
model, privacy language, and truthful AI-disabled state are suitable for a
controlled residency-preparation workspace. The current founder-only release
plan, however, intentionally creates no mentor assignments and enables no
mentor access while the UI still exposes a live **Submit to mentors** action.
That action changes the story to a submitted/read-only state and then says
`Story submitted to your assigned mentors.` even when no eligible reviewer
exists.

This is psychologically unsafe and operationally misleading: a founder can
entrust a reflective narrative to a review workflow that has no reviewer, then
lose the ability to edit it. It also violates the binding requirement that a
live control work genuinely or show a truthful unavailable state.

This is a local, resolvable product-state defect—not an external or production
provider blocker. Feature-off deployment is not medically blocked, but
founder-only enablement should wait for the no-mentor state to be truthful.

## Authority and evidence reviewed

- Canonical product artifact:
  `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`
  - required and observed SHA-256:
    `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- Canonical combined engineering handoff and product-to-engineering map,
  including the twenty product invariants, rejected interpretations, clinical
  AI gate, real-audio contract, and prohibition on production fixtures.
- B1-501 combined integration handoff.
- Current `storyforge-v5/public/` source and fingerprinted `dist/` bundle.
  The built application logic differs from source only in its fingerprinted
  import path.
- Current StoryForge server, migration, isolated WordPress SSO plugin, and
  founder role override.
- Existing local browser evidence:
  - student home;
  - approved two-mentor workspace;
  - student mobile layout.
- Existing retained test claims/reports:
  - B1-501 integration browser 5/5;
  - B1-501 unit 7/7;
  - B1-501 browser 3/3 with the recorded axe/mobile check;
  - PostgreSQL authorization/lifecycle PASS;
  - current local unit report 14/14;
  - current founder/second-admin integration report 5/5;
  - latest Playwright state records `passed` with no failed tests.

These are local implementation receipts. They do not prove the real production
founder experience.

## Findings

### 1. Medical education and residency terminology — PASS

The visible candidate uses appropriate coaching language:

- `story`, `first telling`, `current telling`, `original capture`, `revision`,
  `self score`, `mentor score`, `question workshop`, `next natural question`,
  and `coaching notes`;
- reflective prompts ask what happened, what the learner noticed, and what
  changed;
- interview preparation is presented as story development, not as clinical
  credentialing or an admissions prediction;
- `Approved` is situated within mentor coaching history, not represented as
  residency-program acceptance;
- `clinical` is a story/question classification, not a diagnosis or assertion
  of clinical competence;
- no visible claim promises a Match result, predicts selection, confers
  licensure, represents AAMC/ERAS/NRMP endorsement, or offers patient-care
  advice.

The word `student` is narrower than the full population of IMGs and residency
applicants, some of whom are graduates rather than currently enrolled students.
That is not a founder-only release blocker because it is the current canonical
application role and the controlled founder is intentionally projected into
that role. Before a real IMG cohort is enabled, user research should confirm
whether the visible label should be `applicant`, `learner`, or another
inclusive term without changing the authorization role contract.

### 2. Psychological safety and learner agency — PASS, subject to the submit block

Protective design choices are strong and coherent:

- stories are private by default;
- the learner explicitly decides when a mentor is invited;
- the original telling is preserved separately from revision;
- the UI encourages starting imperfectly rather than performing a polished
  identity;
- mentor copy says `Coach the story, not the student’s voice` and
  `Respond without rewriting the student’s voice`;
- student and mentor scores remain separate;
- mentor feedback is attributed;
- opening a story is separate from reviewing it;
- access loss is described without blaming the learner;
- private drafts are described as inaccessible both from lists and by guessed
  direct identifiers, consistent with the recorded authorization tests.

The blocking exception is the zero-reviewer submission path described below.

### 3. Founder-visible zero-mentor workflow — BLOCK

Verified local facts:

1. B1-502M permits and currently plans founder-only student self-access with
   mentor access disabled.
2. The safe production plan creates no mentor assignment rows.
3. The founder is projected into the StoryForge `student` role through an exact
   WordPress-user override and student-owner RLS.
4. The student workspace always renders `Submit to mentors` for a private or
   revision-requested story.
5. `sf_submit_story` does not require a live mentor assignment.
6. Successful submission changes the story to `submitted`.
7. The student UI then makes that story read-only until a mentor requests a
   revision.
8. The success toast says `Story submitted to your assigned mentors.`

Therefore, the planned empty founder dataset can enter a truthful-looking but
unserviceable review state.

Smallest safe resolution:

- when no eligible mentor assignment exists, keep the story private and replace
  the live submission action with a truthful gated state such as:
  `Mentor review is not enabled for this founder test. Your private story
  remains editable.`;
- enforce the same rule server-side so direct API use cannot create the stuck
  state;
- add a no-assignment browser/API test;
- preserve the existing assigned-mentor path unchanged.

Provisioning a nominal assignment while mentor SSO remains disabled would not
resolve the learner-facing truth problem. Enabling a real mentor is outside the
chosen founder-only scope and is unnecessary.

### 4. Student and mentor role representation — PASS with a production check

- Browser state cannot grant either role.
- The exact founder WordPress account may be projected into the StoryForge
  `student` role without receiving an admin private-story override.
- Other administrators, students, and mentors are denied by the default-empty,
  exact-user allowlist unless explicitly selected.
- The current UI renders the signed application role; it does not present a
  client-side role switch.
- Mentor actions are authored and attributed to the signed mentor identity in
  the tested fixture lifecycle.

For founder acceptance, the test record must explicitly state that the founder
is exercising the **StoryForge student capability set** through an admin-owned
WordPress account. The production UI must show the real founder display name
and must not show a fixture mentor, fictional student, or an implied physician
reviewer.

### 5. AI presentation — PASS if every AI flag remains off

The candidate does not ship canned suggestions behind a generation control.
It says:

- `Suggestions are gated`;
- manual preparation remains available;
- general and clinical suggestions are unavailable until separate founder,
  data-processing, budget, and evaluation gates pass.

`Check availability` calls the server and receives a truthful gated error.
Clinical AI is not presented as validated truth, diagnosis, or medical
decision support. This is appropriate for founder launch.

Any AI flag becoming true is a release block because the server still reports
that the approved provider/DPA configuration is not installed; no model output
workflow is implemented in this candidate.

### 6. Audio and transcription presentation — CONDITIONAL PASS

With private audio storage unconfigured, the candidate truthfully says:

`Recording is unavailable in this environment because private StoryForge audio
storage is not configured. Nothing has been recorded or uploaded.`

The button is disabled, and the existing browser evidence verifies this state.
That is acceptable for founder launch.

If R2 variables are configured, `audioAvailable` becomes true and the UI
enables `Start recording`, but the current client contains no MediaRecorder,
upload, transcription, playback, or `record-start` handler. Configuring audio
for this release would therefore be a release block. Audio must remain
unconfigured until the complete genuine workflow exists and has been
clinically/privacy reviewed.

### 7. Patient-information safety — CONTROLLED FOUNDER CONDITION

The capture language invites a `real first telling`, and the application is
designed for patient and clinical stories, but the visible capture screen does
not currently remind a learner to omit patient identifiers.

For the single-founder acceptance run, this is not a block only if the founder
uses synthetic or non-patient-identifying content and the acceptance script
states that constraint. Before any student or IMG cohort is enabled, a
reviewed de-identification/PHI instruction and institutional data-handling
policy are required. Privacy-by-RLS does not itself make identifiable patient
details educationally or legally appropriate to enter.

### 8. Demo and fixture implication — PASS only under production configuration

- Local seed data are isolated in `infra/postgres/seed_local.sql`; the
  production migration does not insert them.
- Railway build/start commands do not execute the local seed.
- Fixture identities and names remain dormant in the shipped client/server
  code but are gated by local development authentication.
- Existing screenshots visibly say `Local signed fixture`; they must not be
  presented as production evidence.
- An empty production dataset plus the one verified founder identity produces
  genuine empty states rather than synthetic success metrics.

Production must prove:

- `STORYFORGE_DEV_AUTH` is off;
- WordPress local fixtures are off;
- `/api/dev/session/*` fails closed;
- `/api/config` reports MissionMed signed identity mode;
- no local fixture UUID, display name, mentor, assignment, question, story, or
  legacy `Bootstrap demo` banner is returned or rendered;
- only the verified founder identity row exists initially.

## Existing evidence coverage and gap

The local suites support privacy, exact founder selection, second-admin denial,
state transitions, truthful AI/audio-off behavior, responsive layout, and the
two-mentor fixture lifecycle. They do **not** cover the planned production
combination of:

- one founder mapped to `student`;
- zero mentor assignments;
- all mentor access denied;
- a visible submit action.

A no-assignment submission test is therefore required after the local repair
and again in production using privacy-safe evidence.

## Production-only validation remaining

After the local block is repaired and before founder enablement:

1. Launch from the real Matrix StoryForge entry with no second login.
2. Confirm the real founder display name and intentional StoryForge student
   capability set.
3. Confirm no other admin, student, mentor, or direct anonymous request can
   enter.
4. Confirm the initial workspace contains no fixture or legacy demo records.
5. Create only synthetic/non-patient-identifying founder test content.
6. Confirm a private draft remains private and editable.
7. Confirm the zero-mentor state cannot be submitted and explains why.
8. Confirm AI remains gated and no clinical/model result is produced.
9. Confirm recording remains disabled and claims that nothing was captured.
10. Confirm Back to Matrix, logout, access revocation, deep-link refresh, and
    session-ended copy in the real founder browser.

## OSLER release decision

- **Feature-off infrastructure deployment:** no medical-education block.
- **Founder-only enablement as currently implemented:** **BLOCK** on the
  zero-mentor submission path.
- **After that narrow repair, with AI/audio off, no fixtures, and synthetic
  acceptance content:** domain review is **PASS for controlled founder
  testing**.
- **Student/IMG cohort release:** not assessed as ready; requires real-cohort
  terminology validation, de-identification guidance, mentor-source
  reconciliation, and production evidence.

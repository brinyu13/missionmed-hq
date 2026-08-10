# B1-513 Mentor Visibility, Consent, and Privacy

Binding contract for Product System D. This is the document that changes a privacy assumption; it is written to be defensible line by line. **Production implementation requires explicit Founder approval of §4's student-facing wording (Founder Decision FD-1) and §3's default policy (FD-2).**

## 1. The two dimensions, precisely

| Dimension | Values | Meaning | Who controls |
|---|---|---|---|
| **Visibility** | `mentor_visible` \| `private` | May the authorized MissionMed mentor *observe* this story for guidance? | Student, per story, always |
| **Review workflow** | Not Submitted → Awaiting Review → In Review → Revision Requested → Reviewed → Approved | Has the student *asked* for a review, and where is it? | Student initiates; reviewer advances |

Submission means exactly what it means today: *"Please review this story now."* A mentor-visible story may be observed — read, noted, tracked for progress — without any submission. A private story is invisible: absent from every list, count-detailed only as an aggregate, and a direct-ID read returns 404/`P0002` exactly like today's private-story boundary. Nothing in either dimension is ever public or ever visible to another student.

Status vocabulary continuity: production statuses are preserved verbatim (`private/awaiting/in_review/changes/reviewed/approved` with their exact labels/hints). The task's "Not Submitted" concept maps to the existing `private` workflow state; Stage 2 does not rename it, because 441 users have learned it. What changes is that the *workflow* value `private` no longer doubles as the *observation* rule — the new `visibility` column carries that meaning.

## 2. Data model

```sql
ALTER TABLE sf_stories ADD COLUMN visibility text NULL
  CHECK (visibility IN ('mentor_visible','private'));
ALTER TABLE sf_stories ADD COLUMN visibility_changed_at timestamptz NULL;

CREATE TABLE sf_mentorship_consent (      -- append-only decision log
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  policy_version text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accept','defer')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  audit_event_id uuid NOT NULL
);
```

`visibility IS NULL` = legacy row: **treated as `private` for every observation purpose.** This is the safe historical transition — no UPDATE touches existing rows, so no migration can convert anyone's history. The effective-visibility function is total: `COALESCE(visibility, 'private')`, except that a *submitted* legacy story remains reviewer-visible exactly as today (submission has always granted reviewer access; Stage 2 narrows nothing).

Effective observation rule (single SQL predicate, used by every reviewer-facing policy and function):

```
observable(story) := story.status IN (submitted states)        -- unchanged production rule
                  OR COALESCE(story.visibility,'private') = 'mentor_visible'
```

## 3. Defaults and transitions

- **Before consent**: nothing changes. New and old stories behave exactly as production does today.
- **After affirmative consent**: NEW stories are created `mentor_visible`. Existing stories keep `visibility = NULL` (private) until the student changes each one. There is deliberately no silent bulk conversion; an optional student-driven bulk opt-in tool is deferred to R4 and requires its own Founder approval.
- **Refusal ("Not now")**: a durable, logged no-op. All-private behavior continues; the product is never degraded, delayed, or nagged. Re-invitation appears at most once per new session and is permanently available (and answerable) in Settings → Mentorship & privacy. Declining students can still submit stories for review exactly as today — consent gates *ambient observation*, never *requested review*.
- **Making a story private**: allowed any time except while submitted; a submitted story must first use the existing "Return to Private" withdrawal (one rule, no new concept). The change is immediate, audited, and reflected to reviewers on next read.
- **Making a story mentor-visible**: allowed any time, including for legacy stories; audited.
- **Inspiration and versions inherit story visibility** — versions are part of the story; a promoted Inspiration answer takes the consent-derived default.
- **Consent revocation**: withdrawing overall consent (Settings) stops the mentor-visible *default* for future stories and is logged; it does not silently flip existing per-story choices, which remain the student's explicit record. The Settings copy states this plainly.

## 4. First-use disclosure (exact prototype copy — pending Founder approval FD-1)

Affirmative-consent mechanics: modal on first student entry after R1 activation; scrolling body; six fact tiles; a checkbox (*"I understand: new stories will be mentor-visible, and I can make any story Private at any time."*) that alone enables **Agree and continue**; a co-equal **Not now — keep everything private** button; policy version + date + Settings pointer visible in the dialog; acceptance writes the consent row + audit receipt and shows the receipt ID to the student. No pre-checked boxes, no countdian timers, no loss-framed copy, no repeat-nagging: the decline path is honest about being a complete, safe choice.

Body (verbatim from the working prototype):

1. "StoryForge is your private story workspace inside MissionMed mentorship. Your authorized MissionMed mentor (Dr Brian) may look at mentor-visible work to guide you — the way a coach reviews practice film — even before you formally submit a story for review."
2. "After you agree, new stories start as Mentor Visible. You stay in control: any individual story can be switched to Private — visible only to me at any time, and Private stories are never opened, listed, or reviewed by anyone but you."
3. "Submitting a story is still a separate, explicit action that means 'please review this story now.'"
4. "Nothing here is ever public. Other students can never see your work. Every visibility change is logged to your story history, and you can re-read this policy any time in Settings."

Fact tiles: new-story default · per-story Private switch · Private never reviewed/opened · historical stories stay Private · nothing public, no student ever sees another's work · changes logged + policy always in Settings.

## 5. Authorization consequences (details in doc 11)

- Directory/profile surfaces list mentor-visible and submitted stories only; private work appears solely as counts with the fixed line "N private stories — not accessible." Counts are metadata the mentorship relationship already discloses (the same class of fact as "no submissions yet") and are named in the consent policy.
- Founder playback of student audio extends the existing short-lived signed URL path to `observable(story)`; private-story audio is unreachable by construction (the signer authorizes against the same predicate).
- Mentor notes on mentor-visible unsubmitted stories are allowed (guidance is the point); status/score/suitability writes remain submission-gated — review verdicts on work nobody asked to be reviewed would blur the submission promise.
- Internal notes, cross-student isolation, anonymous/ineligible denials: unchanged and re-tested (N-matrix, doc 14).

## 6. Auditability

Every consent decision, visibility change, Review Check, and observation-relevant admin action lands in the existing append-only audit stream with actor, timestamp, and before/after. The student-facing story History shows visibility changes in plain language ("to Private — visible only to me"). The consent receipt (ID + timestamp + policy version) is permanently visible in Settings.

## 7. Why this is the right architecture (and what was rejected)

- *Rejected: consent flips all historical stories.* Violates the expectation under which that work was created; irreversible in social terms even if reversible in SQL.
- *Rejected: visibility as new workflow statuses.* Would entangle observation with the review lifecycle, break the learned status chips, and force migration of status history.
- *Rejected: opt-out default without consent.* The Founder direction is mentor-visible-by-default *after appropriate affirmative first-use disclosure*; doing it without the disclosure is a dark pattern and a trust breach.
- *Rejected: per-version visibility.* Versions are tellings of one story; splitting visibility per telling makes the mental model incoherent and the RLS matrix combinatorial for no articulated need.

## 8. Acceptance gate (R1)

R1 privacy ships when: consent modal passes copy review (FD-1) and a11y checks; accept/defer both write correct rows + receipts; new-story default follows consent state; legacy rows are proven untouched by migration diff; `observable()` predicate passes the full N-matrix including direct-ID probes and signed-URL probes; withdraw-before-private rule enforced server-side; Settings panel shows live consent state + receipt; disabling `visibility_consent` restores exact production behavior (new stories revert to legacy semantics; existing visibility choices dormant but preserved).

# StoryForge Failed Dry-Run Invitation Replay

## Result

**COMPLETED — 10/10 CONFIRMED FAILED SENDS DELIVERED**

On 2026-09-10, the user explicitly authorized sending existing StoryForge
invitations on behalf of 360 students who had tried to send while delivery was in
dry-run mode. Raghav Gupta was prioritized first.

## Selection rule

An invitation was replayed only when all of the following were true:

1. the historical Railway HTTP record contained an exact successful
   `POST /api/requests/{invitation}/send` call from the dry-run deployment;
2. the same invitation remained a current, previewed draft;
3. the preview version still matched the draft row version;
4. no provider delivery attempt existed;
5. the current WordPress account still resolved through the canonical StoryForge
   access predicate as a student;
6. the send was executed through that same student's freshly signed StoryForge
   identity.

This rule excluded preview-only drafts. It also prevented duplicate provider
delivery despite repeated dry-run clicks on the same invitation.

## Historical evidence

The dry-run Railway deployment recorded 14 `/send` calls across 10 unique
invitations:

- Raghav Gupta: 13 calls across 9 unique invitations. Some invitations had
  repeated send clicks, but each unique invitation was sent exactly once.
- Antonio Patterson: 1 call across 1 unique invitation.

The remaining previewed drafts belonged to:

- `brinyu`: 2 drafts;
- Ignacio Anzola De Goiricelaya: 1 draft;
- Ismat Huq: 1 draft.

None of those four invitation IDs appeared in the historical `/send` records, so
they were not sent.

## Raghav Gupta

- WordPress user ID: 114
- Current authority: eligible, non-admin StoryForge student
- Unique invitations sent: 9
- Recipients, as already stored by Raghav: Divya; Ritika; Mohit; Samya; Shikha;
  Ishani; Shubhangi; S.K.G.; K.G.
- Provider acceptance: 9/9
- Signed delivery webhook observed: 9/9
- Final StoryForge status: delivered 9/9
- Unresolved attempts: 0

## Antonio Patterson

- WordPress user ID: 620
- Current authority: eligible, non-admin StoryForge student
- Unique invitations sent: 1
- Recipient, as already stored by Antonio: Brian (`b***@yahoo.com`)
- Provider acceptance: 1/1
- Signed delivery webhook observed: 1/1
- Final StoryForge status: delivered
- Unresolved attempts: 0

## Safety and blast radius

- No invitation content, recipient address, student identity, WordPress role,
  LearnDash enrollment, or database authorization state was edited.
- No new invitation was created.
- No preview-only invitation was sent.
- No reminder was sent.
- No Matrix, frontend, WordPress, database schema, RLS, or runtime code change was
  made during replay.
- Existing send idempotency and provider-attempt reservations remained the only
  delivery mechanism.

## Final state

- Raghav Gupta: 9 delivered, 0 drafts, 0 unresolved attempts.
- Antonio Patterson: 1 delivered, 0 drafts, 0 unresolved attempts.
- Confirmed historical failed-send population remaining: 0.
- Preview-only drafts intentionally preserved: 4.

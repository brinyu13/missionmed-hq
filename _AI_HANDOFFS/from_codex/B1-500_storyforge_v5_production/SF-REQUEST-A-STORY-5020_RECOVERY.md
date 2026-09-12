# SF-REQUEST-A-STORY-5020 — Request-a-Story Delivery Recovery

## 1. RESULT

**BLOCKED — NOT DEPLOYED**

The production repair is fully implemented, committed, and verified locally/disposably. Production was not changed because the mandatory Matrix runtime guard found unrelated pre-existing protected-runtime drift and this ticket does not yet have the exact ticket-specific override acknowledgment required by the guard.

No rollback is required. Production remains on its healthy predecessor.

## 2. Raghav Gupta incident finding

Read-only production evidence found Raghav's valid Request-a-Story invitations and guest activity, including parent/sibling links that were delivered, opened, and started. It found:

- zero completed contributions;
- zero guest audio assets;
- four guest voice sessions that ended cancelled;
- zero uploaded segments, zero bytes, and zero transcript;
- no request reaching the finish or contribution endpoints.

The original recording cannot be recovered because neither audio bytes nor a transcript reached StoryForge storage. Nothing will be fabricated. Raghav's mother will need to record again after the repair is deployed; the existing invitation remains the correct identity-bound route.

## 3. Root cause

The failure was a compound delivery defect:

1. The guest browser added a multipart `mimeType` field to segment uploads. The WordPress gateway's exact allowlist accepted only `seq`, `durationMs`, and file `segment`, so segment uploads were rejected before reaching the Railway API.
2. Guest status polling shared the mutation rate-limit bucket. Polling could exhaust the bucket and cause recording requests to receive HTTP 429.
3. A successful contribution created only a candidate record; it did not atomically hydrate a student-library story or recipient notification.
4. The story projection dropped contribution origin metadata, so the library could not identify family/friend stories.
5. The guest received no server-confirmed delivery receipt or trustworthy local download options.

## 4. Implemented fix

### Database delivery transaction

`storyforge-v5/infra/postgres/migrations/20260912190000_sf_request_story_delivery_hydration.sql`

- Adds private `public.sf_guest_hydrate_contribution(uuid)`.
- Hydrates completed text and voice contributions into one private library story, original, revision, and authored segment in the same transaction.
- Marks the contribution promoted and creates one `request.story_received` recipient notification.
- Records origin metadata: contribution id, relationship, and contributor first name.
- Is idempotent: retry returns the same story and notification.
- Rechecks student eligibility and request/guest feature flags.
- Revokes direct execution from `public`, `anon`, `authenticated`, and application roles.
- Does not change tables, policies, table grants, identities, roles, or enrollment.

### Browser and API

- Removes the disallowed guest multipart field.
- Separates read-only guest polling limits from mutation limits.
- Preserves contribution origin in the story projection.
- Requires a server-confirmed `storyId`, `notificationId`, and promoted state before showing success.
- Correctly handles the API's wrapped `{ contribution: ... }` delivery response.
- Shows an explicit modal: “Story saved and [student] notified.”
- Shows a durable receipt after the modal closes.
- Offers the contributor a local original-audio download while browser audio remains available.
- Offers a Word-compatible `.doc` transcript download.
- Shows the recipient notification and a `◆ From [name] · [relationship]` library designation.

## 5. Security and blast-radius proof

- Private story remains visible only through existing student/admin data rules.
- A story owned by another student remained unavailable by direct access.
- Unrelated mentors gained no access.
- Anonymous and invalid/expired sessions remain denied.
- No generic RLS widening, table-grant widening, SECURITY DEFINER endpoint, role mutation, enrollment mutation, or identity-row mutation was introduced.
- Matrix, LearnDash, WordPress roles, unrelated plugins, and unrelated products are absent from the ticket diff.
- The canonical StoryForge product-authority hash remained `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.

## 6. Verification

All final gates below passed on commit `9a31cd26b849c02917d2beb9209dce8d3d7d53ae`:

- `git diff --check`: PASS
- JavaScript syntax for touched runtime files: PASS
- Shell syntax for touched runners: PASS
- `npm test`: **507/507 PASS**
- Focused PostgreSQL 18 delivery/RLS tests: **2/2 PASS**
- Full PostgreSQL 18.4 primary suite: **39/39 PASS**
- Reconciliation/survival suite: **140/140 PASS**
- Targeted Request-a-Story Playwright: **5/5 PASS**
- Full Playwright/e2e: **98/98 PASS**
- Full disposable WordPress integration: **8/8 PASS**
- Full conformance: **72/72 PASS**
- Production build/provenance: PASS
- Secret scan: PASS

The e2e flow proves guest submission → server confirmation popup → Word transcript download → recipient notification → hydrated private story → origin badge.

Final integration evidence:

`storyforge-v5/.local/integration-evidence/run.9a31cd26b849c02917d2beb9209dce8d3d7d53ae.01295dd6-5b20-46f2-9c8c-638987ecf90b/RUN_STATUS.json`

## 7. Git and release state

- Worktree: `/Users/brianb/MissionMed_worktrees/SF-REQUEST-A-STORY-5020`
- Branch: `codex/sf-request-a-story-hydration-5020`
- Verified implementation/release commit: `9a31cd26b849c02917d2beb9209dce8d3d7d53ae`
- Documentation closeout commit: recorded after this report was added
- Status: clean
- Release id: `v-d6991f3e6724a47a`
- Application asset: `app.05a518020aa4.js`
- Application SHA-256: `05a518020aa43bf79798dc596bc2cef0722bced81489e3d692fa9c05766ed6c7`
- Styles asset: `styles.4e355c213eac.css`
- Styles SHA-256: `4e355c213eacfae803f7636a8542e16a486b346530d236dccad8fe06657d6448`
- Auth asset unchanged: `d2cfc4e447d2`
- Logo asset unchanged: `f091d62ac584`
- WordPress release artifact SHA-256: `a5d91cb1fa7927ed1a85298aa285759f91bdca0c9d4ce935efe144a12f50e7e8`

## 8. Current production baseline

Fresh read-only checks on 2026-09-12:

- `/storyforge/`: HTTP 200
- `/storyforge/healthz`: HTTP 200, `{"ok":true,"service":"storyforge-v5"}`
- anonymous `/storyforge/api/session`: HTTP 401 `auth_required`
- live CSS alias: `03dfd2fc42f0`
- live app alias: `6bc7f9341a22`
- live logo alias: `f091d62ac584`

The new `05a518020aa4` application asset is not live. No production write occurred in this ticket.

## 9. Matrix guard blocker

Command:

```text
python3 _SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/SF-REQUEST-A-STORY-5020 \
  --assets all --verify-public
```

The guard is blocked by six pre-existing production-vs-lock drifts. Current origin/public fingerprints are:

- `student_os_js`: `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a`
- `student_os_css`: `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260`
- `class_mmed_student_os_php`: `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d`
- `calendar_v4_js`: `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480`
- `calendar_v4_css`: `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e`
- `storyforge_js`: `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`

The ticket diff contains none of the protected Matrix source paths. The guard and manifest were not edited, the lock was not refreshed, and no Matrix file was copied, repaired, staged, or deployed.

The guard requires this exact bounded acknowledgment syntax before continuation:

```text
Brian explicitly approves Matrix runtime lock override for SF-REQUEST-A-STORY-5020 and asset keys student_os_js, student_os_css, class_mmed_student_os_php, calendar_v4_js, calendar_v4_css, storyforge_js.
```

This acknowledgment would authorize only proceeding past the unrelated drift for this ticket. It would not authorize changing Matrix. Every listed asset must be fingerprinted immediately before and after deployment and must remain byte-identical; any new drift or changed fingerprint is a hard stop and rollback condition.

## 10. Next safe action

After the exact bounded acknowledgment is supplied:

1. Re-fingerprint the six protected assets and prove no seventh drift.
2. Capture fresh private rollback predecessors for the production database function, Railway API runtime, and WordPress StoryForge release.
3. Deploy only the verified migration, API runtime, and WordPress release in a backward-compatible order.
4. Run real student/admin allow canaries, anonymous/unauthorized deny canaries, health/log checks, and the Raghav invitation retry.
5. Re-fingerprint Matrix and require exact pre/post equality.

The production outcome may only be called complete after a real guest re-recording is server-confirmed, appears in Raghav's private library, creates his notification, and retains the origin badge.

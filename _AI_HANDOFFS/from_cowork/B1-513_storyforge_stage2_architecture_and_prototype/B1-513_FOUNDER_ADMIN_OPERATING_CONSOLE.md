# B1-513 — Founder/Admin Operating Console

**Ticket:** B1-513 StoryForge Stage 2 · **Release:** R1 (spine D7)
**Authority:** `B1-513_DECISIONS_SPINE.md` (D2, D4, D5, D7, D8) and `B1-513_CURRENT_CANONICAL_BASELINE.md` (§2, §3, §5). This document specifies; the spine decides. Where this document and the spine could ever be read differently, the spine wins.
**Demonstrated in:** `prototype/extensions.js` (directory, profile drawer, Review Check, direct review controls) and `prototype/shim.js` (synthetic `/api/admin/console/*` contract shapes). The prototype demonstrates the contracts; it is not proposed production code.

---

## 1. What this is

The existing Administrator View (baseline §3, app.js 6400–6835 and 1596–1885) is a **review console**: it can see students who have submitted work, and it can review submitted stories. Stage 2 evolves it into a **mentorship operations console**: the Founder can see *every* eligible student — including the ones who have never touched StoryForge — understand their engagement truthfully, act on reviews directly, and record a mentor touch (Review Check) even when there is nothing to review.

Everything in this document is additive to the baseline surfaces. Nothing existing is removed, renamed, or rebuilt.

## 2. Identity model — preserved exactly

Per baseline §2 and the B1-511A correction, all of the following are **invariant**:

| Invariant | Detail |
|---|---|
| Founder identity | WordPress user `1` / `brinyu`, StoryForge role **`student`** with the **`adminConsole` capability**. The Founder's seven owned stories remain ordinary student stories; story ownership is untouched by everything in this document. |
| Second administrator | WordPress user `107` / `Brian_test`, role `admin`. |
| The toggle | The existing rail `roleSwitch` (app.js 693–709), gated by `user.role === 'student' && capabilities.adminConsole`. Student View ↔ Administrator View is an in-session switch: **no logout, no second app, no role-specific build**. One canonical frontend release for all identities; capability differences are signed into the JWT and server-enforced (baseline §2 trust chain). |
| Authorization | Every endpoint in §10 requires the signed `adminConsole` capability. Students without it receive 403; anonymous requests receive 401 (spine D8 negative tests). |

The console never grants the Founder anything the server has not authorized: private stories stay invisible even to the Founder (§4, §5), and every admin read goes through bounded SECURITY DEFINER functions in the existing B1-510I pattern (baseline §5).

## 3. Student Directory

### 3.1 Population — the canonical entitlement, nothing invented

The directory lists **all trusted, verified, active StoryForge-eligible 360 students from the canonical LearnDash entitlement** — the same entitlement the product gateway already verifies on every sign-in (baseline §2). A student appears the moment they are provisioned and eligible, **even with nothing submitted and zero StoryForge activity**. This is the whole point: the quiet students are the ones mentorship operations exists to find.

Explicitly ruled out (spine D4): **no new WordPress "360 role" is invented**. Eligibility is what the gateway already signs; the directory is a bounded read over it (`/api/admin/console/directory`), not a new identity system. The existing `/api/admin/console/students` endpoint (submitted-work-only) is preserved unchanged for the Review Queue path; the directory is a superset surface beside it, not a replacement of its contract.

### 3.2 Per-student directory record

| Field | Source | Truthfulness rule |
|---|---|---|
| Name, username, initials avatar | WordPress/gateway identity | Display identity only; no email shown in the list view. |
| Entitlement state (`active` / `renewal_due`) | LearnDash entitlement | Only states the entitlement system actually reports. |
| Provisioned date | Provisioning record | — |
| Last meaningful activity | `sf_activity_counters` (spine D5) | Gated by `available_from`; a student with no recorded activity shows "No activity yet", never a fabricated date. |
| Story counts by state | Bounded aggregate over canonical stories | `total, complete, unfinished, private, mentorVisible, submitted, awaiting, inReview, changes, reviewed, approved, archived`. **Private stories contribute to counts only — never titles, never content, never openable rows.** |
| Last review / last Review Check | Review audit / `review-check` receipts | "No review yet" / "Never sent." when absent. |
| Warnings | §9 | Only warnings derivable from truthfully available data. |

### 3.3 Scan-friendly default presentation

The default view is built to be read in seconds, standing up, between patients:

- One row per student (`mStuRow` pattern reused from the baseline Students screen): avatar, name (+ warning dot ⚠ with tooltip when warnings exist), username · last-activity phrase · last-review phrase; numeric pairs for **Stories / Visible / Awaiting**; state chips (`N awaiting`, `N in review`, `N changes`, or `No stories yet` for zero-activity students); one **Open** action.
- Search (name/username, server-authorized) plus five bounded filters: **All students · Awaiting review · Never active · Quiet 30+ days · Warnings**.
- A count note states the authority plainly: "*N of M eligible students · server-authorized*".
- Zero-activity students are visually distinguishable but present — never hidden, never a separate page.

The Admin Home gains one additive metrics band (`b1513` block on `/api/admin/console/home`): **Eligible students · Active this week · Never active · Warnings** — beside, not replacing, the existing five review tiles.

## 4. Profile drawer — drill-down without leaving the list

**Open** slides the existing drawer container (`qad`) over the directory as a modal dialog (`role="dialog"`, `aria-modal="true"`, labelled by the student's name). Header: avatar, name, username · entitlement · last-activity phrase, and the **Record Review Check** action (§8). Six tabs on the canonical `voiceTabs` strip (`role="tablist"`):

| Tab | Shows | Truthfulness rules |
|---|---|---|
| **Overview** | Stat tiles (Stories / Complete / Awaiting / Approved); Last meaningful activity; Latest mentor review; Last Review Check; Visibility mix; warnings inline | Visibility mix reads "*X mentor-visible · Y private (content never accessible)*". Absent facts render as absences ("No review yet.", "Never sent."), never as blanks or invented values. |
| **Activity** | The D5 engagement summary: totals (sessions, active minutes, average), recent sessions with coarse surface labels, lifetime counters | Opens with the truthful-boundary sentence (analytics contract §2): recorded **from [available_from]**, nothing earlier shown, an open tab does not count. A student with no sessions shows exactly that, framed by the boundary date. |
| **Stories** | Mentor-visible + submitted stories only, each with status chip and **Open review** | Private stories: **a count line only** — "*N private stories exist and cannot be listed or opened.*" No titles, no dates, no rows, no content — matching D2 and the D8 negative tests (private absent from lists AND direct admin reads). |
| **Reviews** | Completed reviews: story title, reviewed-at, status label, mentor score, Open | Submitted/reviewed stories only (necessarily reviewer-observable, D2). |
| **Notifications** | Review Check history (sent-at, delivery status, exact body) + the student's StoryForge notifications with read/unread state | Shows what was actually sent and whether the student has read it — the Founder's answer to "did my nudge land?". |
| **Account** | Username, entitlement state with plain-language explanation, provisioned date, account warnings | Entitlement text derives strictly from LearnDash data (§9). |

## 5. The navigation loop — Students → Student → Story → Review → back

The loop must never strand the Founder or lose context:

1. **Students** (directory) → **Open** → profile drawer over the intact directory (query, filter, and scroll preserved beneath).
2. Drawer **Stories/Reviews** tab → **Open review** → the existing admin Story Review route (baseline §3) for that story. This is the *same* review surface the Review Queue uses — one review implementation, two entry points.
3. Review actions happen in place (§7) — no navigation required to act.
4. **Back** from Story Review returns to the profile drawer, restored to the tab the Founder left (drawer state — student id + active tab — is retained in console state and re-fetched on return so counts reflect the actions just taken). **‹ Student directory** from the drawer returns to the directory with query/filter intact.
5. From any point, the existing rail navigation (Admin Home, Students, Review Queue, Release Controls) remains one click away; the drawer is a layer, not a page fork.

Only server-authorized reads occur at each hop: the drawer never carries private-story data forward, and the Story Review route re-authorizes the story by ID (private → 404/P0002 even for admins, per D8).

## 6. Unambiguous ownership — the identity strip

Every review surface renders an **identity strip** so no judgment is ever recorded against the wrong student:

- **Content:** avatar initials + "Reviewing **{Student Name}**'s story" (prototype `b1513ReviewOwner`).
- **Placement:** at the top of the direct-control block on Story Review, and student name visible on every Review Queue row and drawer story row.
- **Source of truth:** the server-authoritative story payload (`story.studentName` from the bounded admin read), never a client-side carry-over from the previous screen.
- **Always rendered:** the strip is unconditional on review surfaces — it does not depend on how the Founder navigated there.
- The strip is textual and SR-visible (not icon-only), and sits inside the same DOM region as the controls it disambiguates.

## 7. Direct-control Review UX

The baseline Story Review's `<select>`-based controls are evolved into direct controls (flag `admin_review_controls`, spine D7). All four control groups patch through the existing bounded review endpoint (`POST /api/admin/console/stories/:id/review` with `{ expectedVersion, patch }`).

| Control | Form | Semantics |
|---|---|---|
| **Mentor score** | Five clickable stars | `role="radiogroup"` labelled "Mentor score — distinct from the student's own priority"; each star `role="radio"`, `aria-checked`, `aria-label="Set mentor score to N of 5"`. **Visually distinct from student priority** (different treatment/placement than the Library's inline `student_score` pickers, baseline §3) — the two ratings must never be confusable, and the label says so in words. |
| **Review status** | Segmented status pills | `role="group"` "Review status"; one pill per workflow state (In review / Changes / Reviewed / Approved) using the frozen `STATUS` labels and colors (app.js 41–72); `aria-pressed` per pill. Workflow transition legality remains server-enforced exactly as in B1-511. |
| **Suitability** | Chips | PS only / Interview only / Both / Neither; `aria-pressed`; clicking the active chip clears suitability (explicitly announced as "Suitability cleared"). |
| **Taxonomy** | Chips | The existing B1-511/B1-512 category and intended-use chips, stable IDs, unchanged contract (`PATCH …/taxonomy`). |

### 7.1 Interaction contract (binding)

| Property | Requirement |
|---|---|
| Keyboard | Every control is a real `<button>` — Tab-reachable, Enter/Space-activatable; the star radiogroup supports arrow-key movement per the radio pattern. No pointer-only affordances. |
| SR semantics | Roles/states as above; a polite `aria-live` region announces each outcome ("Mentor score set to 4/5 — audited.", "Status set to Approved — audited."). |
| Visible selected state | Current selection always visible (`on` class + brand color + `aria-*` state); never conveyed by color alone (filled ★ vs outline, pill label text). |
| Immediate response | Click → immediate optimistic-visual acknowledgment → server PATCH → targeted re-render of the review panel from the server response. **No full page reload, no page flash, no scroll loss.** |
| Optimistic concurrency | Every patch carries `expectedVersion` = the story `rowVersion` the UI rendered. Server compares-and-swaps; on mismatch returns 409 conflict. |
| Conflict recovery | On 409: the panel re-fetches the story, re-renders server truth, and tells the Founder in plain language that the story changed since it was loaded and the change was not applied — then lets them re-apply against fresh state. No silent last-write-wins, ever. |
| Audit | Every accepted patch appends to the existing append-only audit + story history ("story.status_changed", "story.evaluation_updated", etc.) with actor and timestamp. |
| Failure rollback | On any error (network, 4xx/5xx): re-render from last known server truth (the optimistic visual is discarded), show the error via the standard `notify` toast, keep every control enabled for retry. A failed save never leaves phantom UI state. |
| Student-visible effects | Unchanged from B1-511: status changes and sent feedback flow to the student through the existing notification path; internal notes never reach students. |

## 8. Review Check — the operator flow

A Review Check is the Founder's recorded proof-of-attention: "I looked at your StoryForge today." It is truthful, explicit, audited, rate-limited, and delivered through the **existing StoryForge notifications domain** (spine D4) — no email machinery, no new channel.

**Flow:** `Record Review Check` (drawer header) →
1. **Preview** — `POST /api/admin/console/review-check { studentId, preview: true }` returns the exact text that would be sent. The panel is labelled "**Preview — nothing has been sent**" and states: one Review Check per student per day; sending records an audited, timestamped notification.
2. **Explicit send** — "Send to {FirstName}" → `POST` without `preview`. There is no send without a preview step.
3. **Receipt** — response returns `{ id, studentId, sentAt, sentBy, body, status }`; the drawer confirms "✓ Sent {timestamp} · delivery: {status} · audited." and navigates to the Notifications tab where the entry now appears.
4. **History** — every Check is permanently listed in the drawer Notifications tab with its full body and delivery status, and `Last Review Check` updates on Overview and in the directory row.
5. **Dedupe / rate limit** — the server rejects a second send within 24 hours per student (`429 review_check_rate_limited`, message naming the student). The UI shows the server's message verbatim; there is no client-side bypass.
6. **Delivery status** — surfaced to the Founder from what the notification domain actually knows (recorded / delivered / read via the notification's read state). No invented "opened" states.

**Truthful text branches** — the body is generated server-side from the student's actual state at send time, timestamp included (canonical copy, prototype `reviewCheckBody`):

| Student state | Sent text |
|---|---|
| Nothing submitted | "Dr Brian checked StoryForge for work to review on {date/time}, but no stories had been submitted. When you're ready, submit a story so your mentor can review it." |
| Submitted, not yet reviewed | "Dr Brian checked StoryForge on {date/time}. Your submitted work is in the review queue — feedback will land in your notifications." |
| Submitted and reviewed | "Dr Brian checked StoryForge on {date/time} and reviewed your submitted work. Open your stories to see the latest feedback." |

The student receives it as an ordinary StoryForge notification (`kind: review_check`) with normal read/dismiss behavior. The text never claims review activity that did not happen.

## 9. Warnings — only from truthfully available data

The warnings surface (directory dot, Overview/Account entries, Admin Home count) may state **only** what existing systems already record:

| Warning | Source | Example copy |
|---|---|---|
| Entitlement renewal due | LearnDash entitlement expiry | "LearnDash entitlement renewal due in 14 days" |
| Provisioned but never active | Provisioning date + absence of any activity/story data | "Provisioned 30 days ago · no StoryForge activity yet" |
| Delivery bounce | Recorded email delivery events (WordPress/gateway welcome mail), where such events actually exist | "Welcome email bounced — address may be stale" |
| Prolonged submission silence | Canonical story timestamps | "No submission in 90 days" |

No inferred risk scores, no engagement grades, no predictions. If the source system does not record it, the console does not display it. Every warning names its trigger in its own copy so the Founder can verify it.

## 10. Mentor notes

Reused, untouched (spine D4: REUSE the B1-511 mentor-note architecture): `sf_mentor_notes` / `sf_mentor_note_media`, draft→publish lifecycle, editable transcript before publish, short-lived signed playback, internal notes never student-visible, runtime + DB double gates (baseline §3). The console adds entry points (drawer → story → existing note surfaces), not architecture.

## 11. Bounded API surface

All endpoints: JWT-verified, `adminConsole` capability required, bounded SECURITY DEFINER reads (B1-510I pattern), append-only audit on writes. Students → 403; anonymous → 401; private stories → 404/P0002 on lists *and* direct IDs.

| Endpoint | Method | Purpose | Authorization |
|---|---|---|---|
| `/api/admin/console/home` | GET | Existing metrics + additive `b1513` band (eligible / active-this-week / never-active / warnings) | adminConsole |
| `/api/admin/console/directory?q&filter` | GET | Full eligible-student directory (§3); returns `students`, `total`, `boundaries.activityFrom` | adminConsole |
| `/api/admin/console/directory/:studentId` | GET | Profile drawer payload: `student`, `stories` (mentor_visible + submitted only), `activity`, `reviews`, `notifications`, `reviewChecks`, `account` | adminConsole |
| `/api/admin/console/review-check` | POST | `{ studentId, preview? }` → preview text or audited send + receipt; 429 within 24h | adminConsole |
| `/api/admin/console/students`, `/students/:id` | GET | **Preserved** submitted-work student search (baseline) | adminConsole |
| `/api/admin/console/queue` | GET | **Preserved** review queue | adminConsole |
| `/api/admin/console/stories/:id` | GET | **Preserved** bounded story read (observable stories only) | adminConsole |
| `/api/admin/console/stories/:id/review` | POST | **Extended** direct-control patch `{ expectedVersion, patch: { status? mentorScore? suitability? studentFeedback? internalNote? } }`; 409 on version mismatch | adminConsole |
| `/api/admin/console/stories/:id/taxonomy` | PATCH | **Preserved** taxonomy assignment | adminConsole |

Feature flags (D7, each with independent env kill switch, default off): `admin_directory`, `review_check`, `admin_review_controls`; `activity_tracking` gates the Activity tab's data source.

## 12. R1 acceptance criteria

1. **Toggle preservation:** brinyu signs in once, remains role `student`, owns all seven stories in Student View, and switches to Administrator View via the existing `roleSwitch` — no logout, no second URL, no separate build. Brian_test (role `admin`) sees the identical console.
2. **Directory completeness:** every trusted/verified/active eligible LearnDash student appears, including students with zero stories and zero activity; the count note matches the entitlement source; no WordPress role was created or modified.
3. **Privacy negative tests (D8):** private stories appear nowhere in the directory, drawer, or queue except as counts; direct admin fetch of a private story ID returns 404/P0002; a student token calling any §11 endpoint gets 403; anonymous gets 401.
4. **Drawer truthfulness:** each tab renders exactly the §4 content; absent data renders as stated absences; the Activity tab shows the boundary sentence with the real `available_from` date and never a pre-tracking value.
5. **Navigation loop:** Students → Open → Stories tab → Open review → act → Back restores the drawer on the same student and tab with fresh counts; directory search/filter survive the round trip.
6. **Identity strip:** present on the Story Review direct-control block and derived from the server story payload; a scripted walk of Queue → Story and Directory → Story shows the correct owner on both paths.
7. **Direct controls:** each control keyboard-operable and SR-announced per §7.1; a change reflects in UI without page reload; a forced version conflict yields the 409 recovery path (no silent overwrite); a forced network failure rolls back to server truth; every accepted change appears in the story history/audit.
8. **Review Check:** preview shows exact send text; send produces receipt + drawer history entry + student notification with the correct truthful branch for all three states; second send within 24h is refused with the rate-limit message; delivery/read status visible to Founder.
9. **Flags:** with `admin_directory`/`review_check`/`admin_review_controls` off (or env kill switch on), the corresponding surfaces are absent and the baseline console behaves byte-for-byte as in B1-512C production; enabling requires no redeploy.
10. **Founder-first canary:** all of the above verified with brinyu against production-shaped data before any wider enablement (D7).

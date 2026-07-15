# V1 Study Schedule 8010C — Inert Integration Seam Implementation Report

Date: 2026-07-15 UTC  
Mission: V1-STUDY-SCHEDULE-8010R  
Boundary: V1-8010C  
Status: COMPLETE FOR INERT SOURCE GOVERNANCE; NOT AUTHORIZED FOR ACTIVATION OR DEPLOYMENT

## Product identity ledger

| Field | Authority |
|---|---|
| Product | V1 Study Schedule |
| Purpose | Learner academic study planning and execution |
| Historical aliases | Matrix Plan; Study Schedule; Study Scheduler; D9 Matrix Plan |
| Not this product | MissionMed Scheduler; Appointment Scheduler; Calendar; Webex Scheduler |

## Exact Git authority

| Item | SHA |
|---|---|
| 8010C parent, including validated 8010B and Y1 Matrix sync | `defb74c52d37a4390f226fbfbeb18ed3e804ae07` |
| 8010C governed commit | `08e3681b6ea21f1ad65bc87db4ffae0597adc951` |
| Governed tree | `bee2f4aa66d647cc7536081fd1c0bb32725d5684` |
| Draft governed PR | `https://github.com/brinyu13/missionmed-hq/pull/12` |
| Final validation commit with identical tree | `22cc8bb464fe0523bf157daeebddc7c48ed94d3e` |

The governed tree exactly matched the final green validation tree before the branch advanced. The commit was created through remote Git objects because MR-079 prohibited local Git writes. No local file was staged or committed.

## Frozen path set

8010C changes exactly these 19 paths:

1. `.github/workflows/v1-study-schedule-8010c.yml`
2. `tests/js/v1-study-schedule-8010c-loader.test.js`
3. `tests/php/run-v1-study-schedule-8010c.sh`
4. `tests/php/v1-study-schedule-8010c-contract.php`
5. `tests/php/v1-study-schedule-8010c-rest-loader.php`
6. `tests/php/v1-study-schedule-8010c-wordpress.php`
7. `wp-content/plugins/missionmed-hub/assets/v1-study-loader.3306a14e53f00510.js`
8. `wp-content/plugins/missionmed-hub/assets/v1-study-loader.8f5fec1fc495e441.css`
9. `wp-content/plugins/missionmed-hub/assets/v1-study-release.c711b79e783160d9.json`
10. `wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php`
11. `wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php`
12. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-access.php`
13. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php`
14. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-loader.php`
15. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-observability.php`
16. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-release.php`
17. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php`
18. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-rest-api.php`
19. `wp-content/plugins/missionmed-hub/missionmed-hub.php`

## Implemented contracts

- Dedicated REST namespace: `missionmed-study-schedule/v1`.
- Read-only bootstrap route: `/bootstrap`.
- Authenticated WordPress actor with nonce verification.
- Explicit server-owned learner or mentor role evidence; entitlement alone never promotes an unknown actor.
- Exact 360 entitlement normalization with freshness, revocation, enrollment, purchase/current-access, and restriction checks.
- Administrators are audit-only; mentors are assignment-scoped; learner ownership is server-derived.
- Exact action/resource/field allowlists and recursive rejection of client-supplied authority fields.
- Non-enumerating denial behavior.
- Four release modes with matching-generation store/release control records.
- Missing, malformed, torn, or stale control evidence fails closed.
- Separate canonical release digest and executable loader digest.
- Read-only repository interface with physical store provenance reconciliation and no commit method.
- Current/N-1 reader vocabulary without a production repository or schema.
- Generic, type-transition, delete, and bulk Calendar Study mutations pass through the compatibility fence.
- REST success and denial responses are private/no-store and vary on cookie and nonce.
- Permission and callback phases reuse one exact-request authorization decision.
- Request-local structural observability is allowlisted, bounded, and has no durable sink.
- The browser loader is inert: no fetch, mount, navigation, storage write, DOM mutation, or Calendar write.
- Any prior script or style registration under the owned handles causes fail-closed suppression.

## Immutable release anchors

| Artifact | SHA-256 |
|---|---|
| Loader JavaScript | `3306a14e53f0051051511ccf31e638e5411f43dd7574fcdccb007a76c163aa37` |
| Loader stylesheet | `8f5fec1fc495e441bdd29b0a3cee675b7396e83463acd0c67f0c8970e92f266b` |
| Canonical release manifest | `c711b79e783160d9f2cbbbcc4682c289958b1f5a80df1b5a881e2d8e882511bc` |

The manifest filename prefix, full manifest hash, exact JS/CSS names, and full JS/CSS hashes are cross-checked by PHP and Node tests. The client binds `release.asset_digest` to `document.currentScript`; release idempotency uses the canonical `release.digest`.

## Deliberate non-effects

8010C did not create a production table, migration, writer route, production actor adapter, control option, cohort, flag, entitlement record, learner record, telemetry sink, or deployment. It did not modify MissionMed_OS. It did not merge PR #12. Decision 12 remains HOLD.

## Rollback boundary

The 8010C source commit is separately revertible before any owner watermark exists. After a future watermark, rollback must never re-enable the legacy writer or remove the commissioned repository/current-N-1 readers; it must degrade to read-only while retaining the C guard floor.

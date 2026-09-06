# P1-RISE-4006 Open Limitations

## Blocking Limitations

| ID | Class | Limitation | Smallest closing action |
| --- | --- | --- | --- |
| B-01 | External rights | FREIDA governance pin is `null`; no reviewed written AMA grant is available | Obtain written source-owner permission, review it, record decision and hashes, then pin the approved record |
| B-02 | External rights | No separate current AAMC authorization permits Residency Explorer database ingestion | Obtain and independently review written AAMC permission before any ingestion |
| B-03 | Authority | MissionMed OS has no RISE product, mission, passport, decision, owner, or protected-route authority | Founder/governance ratifies exact owners, scope, route, dependencies, and deployment decision |
| B-04 | Identity | Shared HQ learner audiences do not include `rise` | HQ owner adds and tests the exact audience and capabilities without weakening existing products |
| B-05 | Runtime | No approved RISE Railway service, artifact host, secrets, durable abuse controller, or same-origin edge route exists | Platform and edge owners provision the contract-defined resources in staging |
| B-06 | Database | No dedicated RISE database owner, login roles, RLS policies, backup, or restore receipt exists | Database owner provisions staging, reviews migrations, installs policies, backs up, and rehearses restore |
| B-07 | Data | No authorized source-controlled API index or activation receipt exists | Run the gated importer only after B-01/B-02, independently validate, and issue an activation receipt |
| B-08 | Integrations | Matrix, ACTN, CAM, and StoryForge owners have not activated their contracts | Each owner reviews schema, purpose, role, privacy, replay, and failure behavior, then activates in staging |
| B-09 | Acceptance | No authenticated staging or production student/admin journey exists | Complete staging UAT, security, accessibility, performance, and ecosystem regression with authorized accounts |
| B-10 | Approval | Founder has not completed design freeze or authorized deployment | Review this candidate and issue an explicit go or no-go after all other gates pass |

Any one of B-01 through B-10 blocks a production-connected release claim.

## Engineering and Review Limitations

| ID | Severity | Limitation | Disposition |
| --- | --- | --- | --- |
| L-01 | Medium | The local arm64 image has a clean Trivy scan, but no target-architecture image has been pushed to an approved registry | Build and scan the exact immutable registry image in approved CI or staging before acceptance |
| L-02 | Medium | Production performance, query plans, caching, autoscaling, alerting, and soak behavior are unknown | Measure actual topology with authorized data in staging |
| L-03 | Medium | VoiceOver, TalkBack, forced-colors, and real shell zoom were not manually accepted | Run assistive-technology acceptance on staging |
| L-04 | Medium | Fable 5 review was unavailable | Run Fable review before student release; do not delay source-independent platform work |
| L-05 | Medium | The branch retains earlier root `package.json` and lockfile changes relative to `main`, although current work uses the isolated `rise/` package | Review and, if safe, remove unrelated root dependency churn before merge |
| L-06 | Low | In-process operator metrics are per instance and not a durable observability backend | Platform owner connects logs and metrics to approved shared telemetry |
| L-07 | Low | Local stress uses in-memory synthetic data and loopback networking | Do not treat it as capacity certification |
| L-08 | Governance | MissionMed activity log was not updated because no canonical active RISE mission or safe owner entry exists and shared control-plane work is concurrent | Update only after MissionMed OS ratification through its authorized writer |
| L-09 | High ecosystem review | GitHub default branch reports two High, one Medium, and one Low Dependabot alerts; the candidate root audit is clean but relies on shared lockfile changes predating this continuation | Repository owner reviews the root dependency diff and closes or dismisses each alert through a separate shared-dependency decision |

## Deliberate Non-Features

- No production demo-data fallback.
- No inference that missing visa, score, attempt, gap, USCE, or prior-GME fields mean eligibility.
- No browser credential storage.
- No direct browser database access.
- No copied ACTN relationships, Matrix profile ownership, CAM content, or StoryForge stories.
- No production database down migration that drops evidence or audit history.
- No shared-system write performed merely to make the release appear connected.

## Current Result

The candidate is the strongest source-independent engineering state available, but the mission result remains **EXTERNAL_BLOCKER** and the deployment recommendation remains **NO-GO**.

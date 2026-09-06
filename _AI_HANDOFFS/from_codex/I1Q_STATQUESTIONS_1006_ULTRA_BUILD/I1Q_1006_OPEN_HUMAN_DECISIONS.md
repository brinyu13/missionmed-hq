# I1Q 1006 Open Human Decisions

| ID | Decision | Proposed default | Blocks |
|---|---|---|---|
| OHD-01 | Ratify I1Q mission ID | `I1Q-1006` | Filed authority |
| OHD-02 | Ratify product slug | `question-platform` | Passport and routing |
| OHD-03 | Assign independent verifier | Separate 1007 verifier | Gate acceptance |
| OHD-04 | Choose canonical internal host | Dedicated authenticated app | Deployment |
| OHD-05 | Choose canonical auth adapter | Existing MissionMed internal session adapter | Production API |
| OHD-06 | Choose datastore/project | New `i1q` schema through approved project | Migration and RLS |
| OHD-07 | Ratify database session-role mapping | Transaction-local actor and roles, deny by default | RLS |
| OHD-08 | Assign privacy owner | Named owner before GX-0 | Inventory |
| OHD-09 | Authorize read-only media export | Metadata-only approved export | Inventory |
| OHD-10 | Define rights authority | Rights record required before extraction | GX-1 |
| OHD-11 | Define verified Dr. J rule | Registry plus owner attestation | Corpus boundary |
| OHD-12 | Assign medical governance lead | Verified physician owner | Medical approval |
| OHD-13 | Assign editorial lead | Named editorial owner | Review operations |
| OHD-14 | Assign taxonomy owner | Named curriculum owner | Taxonomy releases |
| OHD-15 | Assign misconception vocabulary owner | Assessment/editorial owner | Distractor governance |
| OHD-16 | Assign release manager | Independent from medical approval where practical | Publication |
| OHD-17 | Assign incident owner | Named internal operator | Incident response |
| OHD-18 | Assign assessment-science owner | Named measurement owner | Psychometrics |
| OHD-19 | Authorize canonical v4 static export | Read-only, hashed, no production mutation | Legacy recovery |
| OHD-20 | Ratify pilot thresholds | Privacy 0.995 patient recall plus calibrated extraction metrics | Pilot |
| OHD-21 | Reconcile STAT public answers with sealed packs | Server-safe pre-answer artifact | STAT adapter |
| OHD-22 | Reconcile frozen canon and actual RPC envelope | Versioned adapter contract | STAT adapter |
| OHD-23 | Resolve `question_metadata` version identity | Composite version plus question identity | Metadata export |
| OHD-24 | Resolve Daily vs Drills transcript requirement | Require explicit availability/status field | Drills adapter |
| OHD-25 | Choose canonical staging route | Approved preview DB and internal app target | Gate 12 |
| OHD-26 | Assign rollback operator | Release manager or incident owner | Canary |
| OHD-27 | Authorize human accessibility and reviewer study | Representative internal users | Production confidence |

## Policy rule

VERIFIED: Proposed defaults are not silent decisions. Every row remains OPEN until filed authority assigns or ratifies it.

VERIFIED: Unassigned physician roles block medical approval and student release, not local engineering.

# SOAP Live Integration Executive Status

SOAP 2026 source validation, exact identity reconciliation, canonical evidence ingestion, SOAP Explorer, My Programs integration, list indicator, Program File signal, and source-right enforcement are complete at reviewed product commit `2c27deb84f1a7b542ef5a700ec1fccc9f25a1c72`.

The production database now holds the SOAP ingest under forced RLS, but eligible UI activation is blocked by the separately governed WordPress SSO file. Live Kinsta has version 1.0.0, SHA-256 `23a26612fea0587773c14e1a614991babb817ee749dc9d06862bdf41b5450370`; DR-151 accepts version 1.1.0, SHA-256 `4a220d00fee05784a3baf8c08d3b744c0c0c889b8372647a974f246d337a5829`, and authorizes no WordPress mutation. Candidate app/HQ deployments were rolled back after the live QA failure.

`SOAP_SOURCE_VERIFIED = YES`
`SOAP_CYCLE = 2026`
`SOAP_SOURCE_ROWS = 925`
`SOAP_UNIQUE_CANONICAL_PROGRAMS = 883`
`SOAP_UNMATCHED_ROWS = 3`
`SOAP_AMBIGUOUS_ROWS = 0`
`SOAP_CANONICAL_CLAIMS_LIVE = 925`
`SOAP_CANONICAL_IDENTITIES_LIVE = 886`
`SOAP_PRIVATE_BETA_CLAIMS = 922`
`SOAP_INTERNAL_REVIEW_REQUIRED_CLAIMS = 3`
`SOAP_MENU_LIVE = NO; APPLICATION ROLLED BACK`
`SOAP_EXPLORER_LIVE = NO; APPLICATION ROLLED BACK`
`SOAP_ADD_TO_MY_PROGRAMS_LIVE = NO; APPLICATION ROLLED BACK`
`MAIN_PROGRAM_LIST_SOAP_ICON_LIVE = NO; APPLICATION ROLLED BACK`
`FABLE_UI_LOCK_PRESERVED = YES`
`NEW_PARALLEL_SPEND_BY_5008 = $0`
`ROLLBACK_VERIFIED = YES`
`LIVE_QA_PASS = NO; WORDPRESS AUTHORITY BLOCKER`
`LIVE_RISE_URL = https://missionmedinstitute.com/rise/`
`DEPLOYMENT_STATUS = BLOCKED_PENDING_NEW_EXACT_WORDPRESS_DECISION`


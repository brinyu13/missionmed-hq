# SOAP Live QA

Provider-level QA passed on the candidate application and HQ deployments. Eligible browser QA at `https://missionmedinstitute.com/rise/` redirected through `admin-post.php?action=mmed_rise_auth_redirect&final=/rise/` and then showed `RISE authentication is temporarily unavailable`; shared HQ returned 403 for the RISE session request.

Read-only Kinsta SSH proved that live `missionmed-rise-sso.php` is version 1.0.0, SHA-256 `23a26612fea0587773c14e1a614991babb817ee749dc9d06862bdf41b5450370`, and lacks the RISE beta entitlement fields. DR-151 accepts version 1.1.0, SHA-256 `4a220d00fee05784a3baf8c08d3b744c0c0c889b8372647a974f246d337a5829`, while authorizing no WordPress mutation.

Live SOAP menu, explorer, search, filters, sorting, My Programs persistence, main-list indicator, and Program File signal are therefore not claimed. Mandatory rollback completed and was verified.


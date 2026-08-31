# Live QA

Anonymous provider QA passed on both candidate deployments. Eligible browser QA at `https://missionmedinstitute.com/rise/` reached `admin-post.php?action=mmed_rise_auth_redirect&final=/rise/` and then showed `RISE authentication is temporarily unavailable`; shared HQ returned 403 for the RISE session request.

Read-only Kinsta SSH established the cause:

- Live `missionmed-rise-sso.php`: version 1.0.0, SHA-256 `23a26612fea0587773c14e1a614991babb817ee749dc9d06862bdf41b5450370`.
- DR-151 accepted file: version 1.1.0, SHA-256 `4a220d00fee05784a3baf8c08d3b744c0c0c889b8372647a974f246d337a5829`.
- Live file lacks `rise_beta_access`, `rise_beta_course_ids`, `rise_beta_entitlements`, and `FULL_RISE_BETA_ACCESS`.
- The separate RISE route plugin matched its accepted SHA.

The browser session also proved the current user is non-admin; `/wp-admin/` returned WordPress's read-capability error. Role-complete eligible UI QA therefore failed. DR-151 required a hard stop rather than widening the WordPress seam. Shared HQ and isolated RISE application deployments were rolled back and verified.


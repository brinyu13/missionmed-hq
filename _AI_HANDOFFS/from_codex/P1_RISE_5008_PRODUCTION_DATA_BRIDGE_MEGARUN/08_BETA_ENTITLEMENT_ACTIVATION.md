# Beta Entitlement Activation

The reviewed HQ audience/entitlement candidate `7a4c59c75bcbb954dd4be433fcc236f2a007c1be` was deployed under serialized `SHARED:AUTH` custody and passed anonymous, audience-validation, redirect, health, configuration, and error-log checks.

Eligible live browser QA then failed at the WordPress side of the seam. Live Kinsta has `missionmed-rise-sso.php` version 1.0.0, SHA-256 `23a26612fea0587773c14e1a614991babb817ee749dc9d06862bdf41b5450370`. It omits `rise_beta_access`, `rise_beta_course_ids`, `rise_beta_entitlements`, and `FULL_RISE_BETA_ACCESS`. DR-151 accepts only version 1.1.0, SHA-256 `4a220d00fee05784a3baf8c08d3b744c0c0c889b8372647a974f246d337a5829`, and explicitly authorizes no WordPress mutation or deployment.

The shared HQ deployment was rolled back provider-native to the exact prior image. Consequently 360 and IV Prep Complete beta activation and Student Intel UI activation are not live. A new exact WordPress decision is required before those activations may resume.


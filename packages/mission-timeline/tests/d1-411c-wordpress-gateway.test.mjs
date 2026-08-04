import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pluginPath = new URL("../../../wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php", import.meta.url);
const plugin = await readFile(pluginPath, "utf8");
const routePath = new URL("../infra/wordpress/missionmed-timeline-route.php", import.meta.url);
const route = await readFile(routePath, "utf8");
const runtimeBuilderPath = new URL("../scripts/build-wordpress-runtime.mjs", import.meta.url);
const runtimeBuilder = await readFile(runtimeBuilderPath, "utf8");
const matrixLaunchPath = new URL("../../../wp-content/plugins/missionmed-timeline-sso/assets/matrix-launch.js", import.meta.url);
const matrixLaunch = await readFile(matrixLaunchPath, "utf8");

test("Timeline WordPress gateway is default-off and product-owned", () => {
  assert.match(plugin, /'timeline_enabled'\s*=>\s*false/);
  assert.match(plugin, /'rollout_stage'\s*=>\s*'off'/);
  assert.match(plugin, /'canary_wp_user_ids'\s*=>\s*array\(\)/);
  assert.match(plugin, /'eligibility_verified'\s*=>\s*false/);
  assert.match(plugin, /'consent_version'\s*=>\s*'d1-500-v1'/);
  assert.match(plugin, /MISSIONMED_TIMELINE_JWT_SECRET/);
  assert.match(plugin, /MISSIONMED_TIMELINE_GATEWAY_SECRET/);
  assert.doesNotMatch(plugin, /storyforge/i);
});

test("canary is exact-allowlist only and student entry requires verified course 3893 eligibility", () => {
  assert.match(plugin, /const MMTL_COURSE_ID = 3893/);
  assert.match(plugin, /sfwd_lms_has_access\(MMTL_COURSE_ID, absint\(\$user_id\)\) === true/);
  assert.match(plugin, /user_can\(\$user, 'manage_options'\)/);
  assert.match(plugin, /\$settings\['rollout_stage'\] === 'canary' && !\$canary/);
  assert.match(plugin, /\$settings\['rollout_stage'\] === 'canary' && !\$administrator && empty\(\$settings\['eligibility_verified'\]\)/);
  assert.match(plugin, /\$settings\['rollout_stage'\] === 'canary' && !\$administrator && !\$course_access/);
  assert.match(plugin, /remote_sync_consent_required/);
  assert.match(plugin, /MMTL_CONSENT_META/);
  assert.match(plugin, /function mmtl_record_remote_sync_consent/);
  assert.match(plugin, /function mmtl_withdraw_remote_sync_consent/);
  assert.match(plugin, /'remote_sync_allowed'\s*=>\s*\$administrator \|\| !empty\(\$consent\['granted'\]\)/);
  assert.match(route, /missionmed_timeline_remote_sync_consent/);
  assert.match(route, /wp_verify_nonce/);
  assert.match(route, /Agree and open Timeline Builder/);
  assert.match(plugin, /administrator_approval_required/);
  assert.match(plugin, /\$settings\['rollout_stage'\] === 'eligible_360' && !\$administrator && empty\(\$settings\['eligibility_verified'\]\)/);
  assert.match(plugin, /eligibility_unverified/);
  assert.match(plugin, /timeline_rollout_stage/);
  assert.match(plugin, /entitlement_version/);
});

test("token route uses real permission checks, nonce, origin, no-store, and bounded TTL", () => {
  assert.match(plugin, /'permission_callback'\s*=>\s*'mmtl_token_permission'/);
  assert.doesNotMatch(plugin, /__return_true/);
  assert.match(plugin, /wp_verify_nonce\(\$nonce, 'wp_rest'\)/);
  assert.match(plugin, /mmtl_verify_origin_header/);
  assert.match(plugin, /max\(60, min\(300/);
  assert.match(plugin, /Cache-Control: no-store, private/);
});

test("gateway requires the immutable mapped principal and a Timeline bearer token", () => {
  assert.match(plugin, /_missionmed_timeline_principal_id/);
  assert.match(plugin, /timeline_identity_unmapped/);
  assert.doesNotMatch(plugin, /add_user_meta/);
  assert.match(plugin, /mmtl_verify_jwt\(\$token, \$principal, \(int\) \$user->ID, \$access\)/);
  assert.match(plugin, /X-MissionMed-Timeline-Gateway-Secret/);
});

test("anonymous entry returns through Matrix rather than the default WordPress login", () => {
  assert.match(plugin, /function mmtl_login_url/);
  assert.match(plugin, /timeline_return_to/);
  assert.doesNotMatch(plugin, /wp_login_url/);
  assert.match(route, /mmtl_login_url\(\$return_to\)/);
  assert.doesNotMatch(route, /wp_login_url/);
});

test("Kinsta route uses a Timeline-owned execution-private bundle and extensionless aliases", () => {
  assert.match(route, /missionmed-timeline-runtime/);
  assert.match(route, /d1-500-wordpress-runtime\.1/);
  assert.match(route, /release\.php/);
  assert.match(route, /_asset\/\(\[a-f0-9\]\{12\}\)/);
  assert.match(route, /base64_decode/);
  assert.match(route, /hash\('sha256', \$bytes\)/);
  assert.match(route, /X-MissionMed-Timeline-Release/);
  assert.equal(route.match(/status_header\(200\)/g)?.length, 2);
  assert.doesNotMatch(route, /MISSIONMED_TIMELINE_RELEASE_ROOT/);
  assert.doesNotMatch(route, /readfile\(/);
});

test("WordPress packaging rewrites the protected kernel export stylesheet to an immutable alias", () => {
  assert.match(runtimeBuilder, /D1-409H_VISUAL_MASTER\.css/);
  assert.match(runtimeBuilder, /TIMELINE_RUNTIME_JS_ASSET_MISSING/);
  assert.match(runtimeBuilder, /\/timeline\/_asset\/\$\{asset\.alias\}/);
});

test("Matrix launch adapter creates one eligible-only Timeline entry without changing shared Matrix source", () => {
  assert.match(matrixLaunch, /data-missionmed-product="timeline"/);
  assert.match(matrixLaunch, /a\.sos-nav-link\[href="#storyforge"\]/);
  assert.match(matrixLaunch, /link\.dataset\.missionmedProduct = "timeline"/);
  assert.match(matrixLaunch, /link\.dataset\.appId = "timeline"/);
  assert.match(matrixLaunch, /matchPrepList\.insertBefore\(item, storyForgeItem\.nextSibling\)/);
  assert.match(matrixLaunch, /document\.readyState === "loading"/);
  assert.match(matrixLaunch, /window\.location\.hash === "#timeline"/);
});

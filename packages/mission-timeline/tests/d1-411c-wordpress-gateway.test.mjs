import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pluginPath = new URL("../../../wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php", import.meta.url);
const plugin = await readFile(pluginPath, "utf8");

test("Timeline WordPress gateway is default-off and product-owned", () => {
  assert.match(plugin, /'timeline_enabled'\s*=>\s*false/);
  assert.match(plugin, /MISSIONMED_TIMELINE_JWT_SECRET/);
  assert.match(plugin, /MISSIONMED_TIMELINE_GATEWAY_SECRET/);
  assert.doesNotMatch(plugin, /storyforge/i);
});

test("eligibility is exact LearnDash course 3893 or WordPress administrator", () => {
  assert.match(plugin, /const MMTL_COURSE_ID = 3893/);
  assert.match(plugin, /sfwd_lms_has_access\(MMTL_COURSE_ID, absint\(\$user_id\)\) === true/);
  assert.match(plugin, /user_can\(\$user, 'manage_options'\)/);
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

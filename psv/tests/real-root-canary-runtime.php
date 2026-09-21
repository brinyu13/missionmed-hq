<?php
/** Runtime proof for the exact real-ROOT canary tuple. */
declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');
define('MMED_PS_PROTO_OPENAI_API_KEY', 'test-only');
define('MMED_PS_PROTO_REAL_ROOT_CANARY_USER_ID', 1);
define('MMED_PS_PROTO_REAL_ROOT_CANARY_ROOT_SHA256', str_repeat('a', 64));
define('MMED_PS_PROTO_REAL_ROOT_CANARY_SPECIALTY', 'Internal Medicine');
define('MMED_PS_PROTO_REAL_ROOT_CANARY_REGION_INDEX', 7);
define('MMED_PS_PROTO_REAL_ROOT_CANARY_PROGRAM_ID', 'rise_ps_canary_program');

require dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-provider.php';

$passes = 0;
function canary_check(bool $condition, string $label): void {
	global $passes;
	if (!$condition) { fwrite(STDERR, "FAIL: {$label}\n"); exit(1); }
	$passes++;
	fwrite(STDOUT, "PASS: {$label}\n");
}

$root = array(
	'isSynthetic' => false,
	'textSha256' => str_repeat('a', 64),
	'specialtyLabel' => 'Internal Medicine',
	'region' => array('mode' => 'REPLACE_PARAGRAPH', 'paragraphIndex' => 7, 'rootTextSha256' => str_repeat('a', 64)),
);

canary_check(MMPS_Provider::real_root_canary_configured(), 'complete canary tuple is recognized');
canary_check(!MMPS_Provider::real_root_allowed(), 'broad real-ROOT gate remains closed');
canary_check(MMPS_Provider::is_real_root_canary_root(1, $root), 'exact subject ROOT specialty and Paragraph 8 match');
canary_check(MMPS_Provider::real_root_allowed_for(1, $root, 'rise_ps_canary_program'), 'exact authorized program is allowed');
canary_check('REAL_ROOT_CANARY' === MMPS_Provider::authorization_mode_for(1, $root, 'rise_ps_canary_program'), 'authorization is auditable as canary');

$wrong = $root; $wrong['textSha256'] = str_repeat('b', 64);
canary_check(!MMPS_Provider::real_root_allowed_for(1, $wrong, 'rise_ps_canary_program'), 'wrong ROOT hash is denied');
canary_check(!MMPS_Provider::real_root_allowed_for(2, $root, 'rise_ps_canary_program'), 'wrong user is denied');
$wrong = $root; $wrong['specialtyLabel'] = 'Family Medicine';
canary_check(!MMPS_Provider::real_root_allowed_for(1, $wrong, 'rise_ps_canary_program'), 'wrong specialty is denied');
$wrong = $root; $wrong['region']['paragraphIndex'] = 6;
canary_check(!MMPS_Provider::real_root_allowed_for(1, $wrong, 'rise_ps_canary_program'), 'wrong editable paragraph is denied');
canary_check(!MMPS_Provider::real_root_allowed_for(1, $root, 'rise_ps_other_program'), 'second program is denied');

fwrite(STDOUT, "PSV REAL-ROOT CANARY RUNTIME: PASS ({$passes} assertions)\n");

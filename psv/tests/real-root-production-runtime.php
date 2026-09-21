<?php
/** Runtime proof for the DR-331 normal entitled real-ROOT path. */
declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');
define('MMED_PS_PROTO_OPENAI_API_KEY', 'test-only');

class MMPS_Gate {
	public static string $mode = 'members';
	public static array $allowed = array(1, 2);
	public static function mode(): string { return self::$mode; }
	public static function user_allowed($user_id = 0): bool { return in_array((int) $user_id, self::$allowed, true); }
}
class MMPS_Region {
	public static function root_still_matches($paragraphs, $region): bool {
		return !empty($paragraphs) && 'REPLACE_PARAGRAPH' === ($region['mode'] ?? '') && ($region['rootTextSha256'] ?? '') === ($region['expected'] ?? '');
	}
}

require dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-provider.php';

$passes = 0;
function production_check(bool $condition, string $label): void {
	global $passes;
	if (!$condition) { fwrite(STDERR, "FAIL: {$label}\n"); exit(1); }
	$passes++;
	fwrite(STDOUT, "PASS: {$label}\n");
}

$root = array(
	'isSynthetic' => false,
	'paragraphs' => array('Protected one.', 'Program answer.', 'Protected three.'),
	'region' => array('mode' => 'REPLACE_PARAGRAPH', 'paragraphIndex' => 1, 'rootTextSha256' => 'same', 'expected' => 'same'),
);

production_check(MMPS_Provider::real_root_allowed(), 'members mode activates the canonical production rule');
production_check(MMPS_Provider::real_root_allowed_for(1, $root, 'rise_ps_one'), 'entitled owner with confirmed intact region is allowed');
production_check(MMPS_Provider::real_root_allowed_for(2, $root, 'rise_ps_two'), 'second entitled user needs no Founder tuple');
production_check(MMPS_Provider::real_root_allowed_for(1, $root, 'rise_ps_other'), 'multiple programs need no one-program exception');
production_check('REAL_ROOT_PRODUCTION' === MMPS_Provider::authorization_mode_for(1, $root, 'rise_ps_one'), 'authorization is auditable as production');
production_check(!MMPS_Provider::real_root_allowed_for(9, $root, 'rise_ps_one'), 'non-entitled subject is denied');
$wrong = $root; $wrong['region']['expected'] = 'changed';
production_check(!MMPS_Provider::real_root_allowed_for(1, $wrong, 'rise_ps_one'), 'changed ROOT-region binding is denied');
MMPS_Gate::$mode = 'allowlist';
production_check(!MMPS_Provider::real_root_allowed_for(1, $root, 'rise_ps_one'), 'internal allowlist mode cannot authorize normal real-ROOT generation');
production_check(!defined('MMED_PS_PROTO_ALLOW_REAL_ROOT_AI'), 'legacy broad constant remains undefined');

fwrite(STDOUT, "PSV REAL-ROOT PRODUCTION RUNTIME: PASS ({$passes} assertions)\n");

<?php
/**
 * DR-145 exact WordPress named-canary provisioner.
 *
 * Run only through WP-CLI. Control values are read from non-secret environment
 * selectors; the student email itself is read from a private file and is never
 * accepted on argv, written to custody, or emitted in a receipt.
 */

defined('ABSPATH') || exit;

const MMHQ_LOR_DR145_CUSTODY_SCHEMA = 'missionmed.lor.dr145.wordpress-canary-custody.v2';
const MMHQ_LOR_DR145_PENDING_IDENTITY_SCHEMA = 'missionmed.lor.dr145.wordpress-canary-pending-identity.v2';
const MMHQ_LOR_DR145_BOUND_IDENTITY_SCHEMA = 'missionmed.lor.dr145.wordpress-canary-bound-identity.v2';
const MMHQ_LOR_DR145_RECEIPT_SCHEMA = 'missionmed.lor.dr145.wordpress-canary-receipt.v1';
const MMHQ_LOR_DR145_COURSE_ID = 3893;
const MMHQ_LOR_DR145_PROGRAM_TIER = '360elite';
const MMHQ_LOR_DR145_META_KEYS = array(
	'_missionmed_lor_enabled',
	'_missionmed_lor_revoked_at',
	'_missionmed_lor_canary_enabled',
	'_missionmed_lor_consent_at',
	'_missionmed_lor_consent_accepted',
	'_missionmed_lor_consent_version',
	'_missionmed_lor_consent_revoked_at',
);
const MMHQ_LOR_DR145_COURSE_META_KEYS = array(
	'course_3893_access_from',
	'course_3893_access_to',
	'learndash_course_3893_enrolled_at',
);

function mmhq_lor_dr145_fail() {
	throw new RuntimeException('DR-145 provisioning failed closed.');
}

function mmhq_lor_dr145_env($name) {
	$value = getenv($name);
	if (!is_string($value) || '' === $value || false !== strpos($value, "\0") || false !== strpos($value, "\n")) {
		mmhq_lor_dr145_fail();
	}
	return $value;
}

function mmhq_lor_dr145_effective_uid() {
	if (!function_exists('posix_geteuid')) {
		mmhq_lor_dr145_fail();
	}
	$uid = posix_geteuid();
	if (!is_int($uid) || $uid < 0) {
		mmhq_lor_dr145_fail();
	}
	return $uid;
}

function mmhq_lor_dr145_fresh_lstat($path) {
	clearstatcache(true, $path);
	return @lstat($path);
}

function mmhq_lor_dr145_is_private_regular_stat($stat) {
	return is_array($stat)
		&& 0100000 === ((int) $stat['mode'] & 0170000)
		&& 0600 === ((int) $stat['mode'] & 0777)
		&& 1 === (int) $stat['nlink']
		&& (int) $stat['uid'] === mmhq_lor_dr145_effective_uid();
}

function mmhq_lor_dr145_is_published_private_stat($stat) {
	return is_array($stat)
		&& 0100000 === ((int) $stat['mode'] & 0170000)
		&& 0600 === ((int) $stat['mode'] & 0777)
		&& 2 === (int) $stat['nlink']
		&& (int) $stat['uid'] === mmhq_lor_dr145_effective_uid();
}

function mmhq_lor_dr145_same_inode($left, $right) {
	return is_array($left)
		&& is_array($right)
		&& (int) $left['dev'] === (int) $right['dev']
		&& (int) $left['ino'] === (int) $right['ino'];
}

function mmhq_lor_dr145_open_exclusive_private($path, $mode) {
	$previous_umask = umask(0077);
	$handle = @fopen($path, $mode);
	umask($previous_umask);
	return $handle;
}

function mmhq_lor_dr145_sync_parent($path) {
	if (!function_exists('fsync')) {
		mmhq_lor_dr145_fail();
	}
	$parent = dirname($path);
	$parent_stat = mmhq_lor_dr145_fresh_lstat($parent);
	$handle = @fopen($parent, 'r');
	$open_stat = false === $handle ? false : @fstat($handle);
	$path_stat = mmhq_lor_dr145_fresh_lstat($parent);
	if (
		false === $handle
		|| !is_array($parent_stat)
		|| !is_array($open_stat)
		|| !is_array($path_stat)
		|| 0040000 !== ((int) $open_stat['mode'] & 0170000)
		|| 0700 !== ((int) $open_stat['mode'] & 0777)
		|| (int) $open_stat['uid'] !== mmhq_lor_dr145_effective_uid()
		|| !mmhq_lor_dr145_same_inode($parent_stat, $open_stat)
		|| !mmhq_lor_dr145_same_inode($open_stat, $path_stat)
		|| !@fsync($handle)
	) {
		if (is_resource($handle)) {
			@fclose($handle);
		}
		mmhq_lor_dr145_fail();
	}
	@fclose($handle);
}

function mmhq_lor_dr145_is_within($candidate, $root) {
	$candidate = rtrim($candidate, DIRECTORY_SEPARATOR);
	$root = rtrim($root, DIRECTORY_SEPARATOR);
	return $candidate === $root || 0 === strpos($candidate . DIRECTORY_SEPARATOR, $root . DIRECTORY_SEPARATOR);
}

function mmhq_lor_dr145_private_parent($path) {
	if (1 !== preg_match('#^/[^\r\n\0]+$#D', $path)) {
		mmhq_lor_dr145_fail();
	}
	$parent = realpath(dirname($path));
	$repository_root = realpath(dirname(__DIR__, 3));
	$wordpress_root = realpath(ABSPATH);
	$parent_stat = false === $parent ? false : mmhq_lor_dr145_fresh_lstat($parent);
	if (
		false === $parent
		|| false === $parent_stat
		|| 0040000 !== ((int) $parent_stat['mode'] & 0170000)
		|| 0 !== ($parent_stat['mode'] & 0022)
		|| (int) $parent_stat['uid'] !== mmhq_lor_dr145_effective_uid()
		|| (false !== $repository_root && mmhq_lor_dr145_is_within($parent, $repository_root))
		|| (false !== $wordpress_root && mmhq_lor_dr145_is_within($parent, $wordpress_root))
	) {
		mmhq_lor_dr145_fail();
	}
	return $parent . DIRECTORY_SEPARATOR . basename($path);
}

function mmhq_lor_dr145_read_private_file($path, $maximum_bytes, $published = false) {
	$normalized = mmhq_lor_dr145_private_parent($path);
	$stat = mmhq_lor_dr145_fresh_lstat($normalized);
	$valid_stat = $published ? 'mmhq_lor_dr145_is_published_private_stat' : 'mmhq_lor_dr145_is_private_regular_stat';
	if (
		!$valid_stat($stat)
		|| $stat['size'] < 1
		|| $stat['size'] > $maximum_bytes
	) {
		mmhq_lor_dr145_fail();
	}
	$handle = @fopen($normalized, 'rb');
	$locked = false !== $handle && @flock($handle, LOCK_SH | LOCK_NB);
	$open_stat = false === $handle ? false : @fstat($handle);
	$open_path_stat = mmhq_lor_dr145_fresh_lstat($normalized);
	if (
		false === $handle
		|| !$locked
		|| !$valid_stat($open_stat)
		|| !$valid_stat($open_path_stat)
		|| !mmhq_lor_dr145_same_inode($stat, $open_stat)
		|| !mmhq_lor_dr145_same_inode($open_stat, $open_path_stat)
		|| (int) $open_stat['size'] !== (int) $stat['size']
		|| (int) $open_stat['mtime'] !== (int) $stat['mtime']
		|| (int) $open_stat['ctime'] !== (int) $stat['ctime']
	) {
		if (is_resource($handle)) {
			@fclose($handle);
		}
		mmhq_lor_dr145_fail();
	}
	$contents = @stream_get_contents($handle, $maximum_bytes + 1);
	$rewound = @rewind($handle);
	$verification = $rewound ? @stream_get_contents($handle, $maximum_bytes + 1) : false;
	$final_stat = @fstat($handle);
	$final_path_stat = mmhq_lor_dr145_fresh_lstat($normalized);
	@flock($handle, LOCK_UN);
	@fclose($handle);
	if (
		!is_string($contents)
		|| !is_string($verification)
		|| !hash_equals(hash('sha256', $contents), hash('sha256', $verification))
		|| strlen($contents) !== (int) $stat['size']
		|| !$valid_stat($final_stat)
		|| !$valid_stat($final_path_stat)
		|| !mmhq_lor_dr145_same_inode($open_stat, $final_stat)
		|| !mmhq_lor_dr145_same_inode($final_stat, $final_path_stat)
		|| (int) $final_stat['size'] !== (int) $open_stat['size']
		|| (int) $final_stat['mtime'] !== (int) $open_stat['mtime']
		|| (int) $final_stat['ctime'] !== (int) $open_stat['ctime']
	) {
		mmhq_lor_dr145_fail();
	}
	if ($published) {
		$stage_path = mmhq_lor_dr145_private_parent($normalized . '.stage.' . hash('sha256', $contents));
		$stage_stat = mmhq_lor_dr145_fresh_lstat($stage_path);
		if (!mmhq_lor_dr145_is_published_private_stat($stage_stat) || !mmhq_lor_dr145_same_inode($final_stat, $stage_stat)) {
			mmhq_lor_dr145_fail();
		}
		mmhq_lor_dr145_sync_parent($normalized);
	}
	return $contents;
}

function mmhq_lor_dr145_email_from_private_file($path) {
	$contents = mmhq_lor_dr145_read_private_file($path, 320);
	$email = trim($contents);
	if (
		'' === $email
		|| false !== strpos($email, "\r")
		|| false !== strpos($email, "\n")
		|| strlen($email) > 254
		|| !function_exists('is_email')
		|| $email !== is_email($email)
	) {
		mmhq_lor_dr145_fail();
	}
	return $email;
}

function mmhq_lor_dr145_custody_path($principal) {
	if (!defined('MMHQ_LOR_DR145_PRIVATE_STATE_DIR')) {
		mmhq_lor_dr145_fail();
	}
	$state_dir = constant('MMHQ_LOR_DR145_PRIVATE_STATE_DIR');
	if (!is_string($state_dir) || 1 !== preg_match('#^/[^\r\n\0]+$#D', $state_dir)) {
		mmhq_lor_dr145_fail();
	}
	$state_dir = realpath($state_dir);
	$state_stat = false === $state_dir ? false : mmhq_lor_dr145_fresh_lstat($state_dir);
	if (
		false === $state_dir
		|| false === $state_stat
		|| 0040000 !== ((int) $state_stat['mode'] & 0170000)
		|| 0700 !== ((int) $state_stat['mode'] & 0777)
		|| (int) $state_stat['uid'] !== mmhq_lor_dr145_effective_uid()
	) {
		mmhq_lor_dr145_fail();
	}
	$filename = 'founder' === $principal
		? 'f2-lor-1012-dr145-founder-custody.json'
		: 'f2-lor-1012-dr145-student-custody.json';
	return mmhq_lor_dr145_private_parent($state_dir . DIRECTORY_SEPARATOR . $filename);
}

function mmhq_lor_dr145_lock($principal) {
	$normalized = mmhq_lor_dr145_custody_path($principal);
	$lock_path = $normalized . '.lock';
	$existing_stat = mmhq_lor_dr145_fresh_lstat($lock_path);
	if (false === $existing_stat) {
		$lock = mmhq_lor_dr145_open_exclusive_private($lock_path, 'x+');
		if (false === $lock) {
			if (is_resource($lock)) {
				@fclose($lock);
			}
			mmhq_lor_dr145_fail();
		}
	} else {
		if (
			!mmhq_lor_dr145_is_private_regular_stat($existing_stat)
		) {
			mmhq_lor_dr145_fail();
		}
		$lock = @fopen($lock_path, 'r+');
	}
	if (false === $lock || !@flock($lock, LOCK_EX | LOCK_NB)) {
		if (is_resource($lock)) {
			@fclose($lock);
		}
		mmhq_lor_dr145_fail();
	}
	$stat = @fstat($lock);
	$path_stat = mmhq_lor_dr145_fresh_lstat($lock_path);
	if (
		!mmhq_lor_dr145_is_private_regular_stat($stat)
		|| !mmhq_lor_dr145_is_private_regular_stat($path_stat)
		|| !mmhq_lor_dr145_same_inode($stat, $path_stat)
		|| (false !== $existing_stat && !mmhq_lor_dr145_same_inode($existing_stat, $stat))
	) {
		@flock($lock, LOCK_UN);
		@fclose($lock);
		mmhq_lor_dr145_fail();
	}
	return array($lock, $normalized);
}

function mmhq_lor_dr145_meta_rows($user_id, $key) {
	$rows = get_user_meta($user_id, $key, false);
	if (!is_array($rows)) {
		mmhq_lor_dr145_fail();
	}
	foreach ($rows as $row) {
		if (!is_string($row)) {
			mmhq_lor_dr145_fail();
		}
	}
	$serialized = serialize($rows);
	if (strlen($serialized) > 65536) {
		mmhq_lor_dr145_fail();
	}
	return array(
		'encoded' => base64_encode($serialized),
		'count' => count($rows),
		'sha256' => hash('sha256', "dr145-meta-v1\0" . $serialized),
	);
}

function mmhq_lor_dr145_decode_rows($entry) {
	if (
		!is_array($entry)
		|| !isset($entry['encoded'], $entry['count'], $entry['sha256'])
		|| !is_string($entry['encoded'])
		|| !is_int($entry['count'])
		|| $entry['count'] < 0
		|| !is_string($entry['sha256'])
		|| 1 !== preg_match('/^[0-9a-f]{64}$/D', $entry['sha256'])
	) {
		mmhq_lor_dr145_fail();
	}
	$serialized = base64_decode($entry['encoded'], true);
	if (!is_string($serialized) || hash('sha256', "dr145-meta-v1\0" . $serialized) !== $entry['sha256']) {
		mmhq_lor_dr145_fail();
	}
	$rows = @unserialize($serialized, array('allowed_classes' => false));
	if (!is_array($rows) || count($rows) !== $entry['count'] || serialize($rows) !== $serialized) {
		mmhq_lor_dr145_fail();
	}
	foreach ($rows as $row) {
		if (!is_string($row)) {
			mmhq_lor_dr145_fail();
		}
	}
	return $rows;
}

function mmhq_lor_dr145_public_entry($entry) {
	$rows = mmhq_lor_dr145_decode_rows($entry);
	$type = empty($rows)
		? 'absent'
		: (1 === count($rows) ? gettype($rows[0]) : 'multiple');
	return array(
		'present' => $entry['count'] > 0,
		'count' => $entry['count'],
		'type' => $type,
		'sha256' => $entry['sha256'],
	);
}

function mmhq_lor_dr145_assert_no_extra_lor_meta($user_id) {
	$all_meta = get_user_meta($user_id);
	if (!is_array($all_meta)) {
		mmhq_lor_dr145_fail();
	}
	foreach (array_keys($all_meta) as $key) {
		if (
			is_string($key)
			&& 0 === strpos($key, '_missionmed_lor_')
			&& !in_array($key, MMHQ_LOR_DR145_META_KEYS, true)
		) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_unrelated_meta_sha256($principal, $user_id) {
	if (!in_array($principal, array('founder', 'student'), true)) {
		mmhq_lor_dr145_fail();
	}
	$all_meta = get_user_meta($user_id);
	if (!is_array($all_meta)) {
		mmhq_lor_dr145_fail();
	}
	$excluded = MMHQ_LOR_DR145_META_KEYS;
	if ('student' === $principal) {
		$excluded = array_merge($excluded, array('_mmed_program_tier'), MMHQ_LOR_DR145_COURSE_META_KEYS);
	}
	foreach ($excluded as $key) {
		unset($all_meta[$key]);
	}
	ksort($all_meta, SORT_STRING);
	$serialized = serialize($all_meta);
	if (strlen($serialized) > 1048576) {
		mmhq_lor_dr145_fail();
	}
	return hash('sha256', "dr145-unrelated-meta-v2\0" . $principal . "\0" . $serialized);
}

function mmhq_lor_dr145_course_meta_rows($user_id, $key) {
	if (
		!is_int($user_id)
		|| $user_id < 1
		|| !in_array($key, MMHQ_LOR_DR145_COURSE_META_KEYS, true)
	) {
		mmhq_lor_dr145_fail();
	}
	if (!isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])) {
		$rows = get_user_meta($user_id, $key, false);
		if (!is_array($rows)) {
			mmhq_lor_dr145_fail();
		}
		return $rows;
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (!method_exists($dbh, 'mmhq_lor_dr145_native_course_meta_rows')) {
			mmhq_lor_dr145_fail();
		}
		$rows = $dbh->mmhq_lor_dr145_native_course_meta_rows($user_id, $key);
	} else {
		global $wpdb;
		$result = mmhq_lor_dr145_native_prepared(
			$dbh,
			"SELECT `meta_value` FROM `{$wpdb->usermeta}` WHERE `user_id` = ? AND `meta_key` = ? ORDER BY `umeta_id` FOR UPDATE",
			'is',
			array($user_id, $key),
			true
		);
		$rows = array();
		foreach ($result as $row) {
			if (!is_array($row) || !is_string($row['meta_value'] ?? null)) {
				mmhq_lor_dr145_fail();
			}
			$rows[] = $row['meta_value'];
		}
	}
	if (!is_array($rows)) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_db_assert_active();
	return $rows;
}

function mmhq_lor_dr145_student_enrollment_facts($user_id) {
	if (!is_int($user_id) || $user_id < 1) {
		mmhq_lor_dr145_fail();
	}
	$access_from = mmhq_lor_dr145_course_meta_rows($user_id, 'course_3893_access_from');
	$access_to = mmhq_lor_dr145_course_meta_rows($user_id, 'course_3893_access_to');
	$enrolled_at = mmhq_lor_dr145_course_meta_rows($user_id, 'learndash_course_3893_enrolled_at');
	if (!is_array($access_from) || !is_array($access_to) || !is_array($enrolled_at)) {
		mmhq_lor_dr145_fail();
	}
	$clean_absent = array() === $access_from && array() === $access_to && array() === $enrolled_at;
	$exact_current = 1 === count($access_from)
		&& array() === $access_to
		&& 1 === count($enrolled_at)
		&& is_string($access_from[0])
		&& is_string($enrolled_at[0])
		&& 1 === preg_match('/^[1-9][0-9]{0,18}$/D', $access_from[0])
		&& hash_equals($access_from[0], $enrolled_at[0]);
	if (!$clean_absent && !$exact_current) {
		mmhq_lor_dr145_fail();
	}
	$access = $exact_current;
	$current = $access ? array(MMHQ_LOR_DR145_COURSE_ID) : array();
	$historical = $current;
	$facts = array(
		'access' => $access,
		'currentCourseIds' => $current,
		'expiredCourseIds' => array(),
		'historicalCourseIds' => $historical,
		'purchaseMatched' => false,
		'revoked' => false,
		'expiresAt' => '',
	);
	if (isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])) {
		mmhq_lor_dr145_db_assert_active();
	}
	return $facts;
}

function mmhq_lor_dr145_student_course_facts($user_id) {
	return mmhq_lor_dr145_student_enrollment_facts($user_id);
}

function mmhq_lor_dr145_assert_live_postimage($principal, $user, $consent_at, $consent_version) {
	if (
		isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])
		|| 0 !== mmhq_lor_dr145_native_in_transaction(mmhq_lor_dr145_native_dbh())
	) {
		mmhq_lor_dr145_fail();
	}
	$user_id = is_object($user) && isset($user->ID) ? (int) $user->ID : 0;
	if ($user_id < 1) {
		mmhq_lor_dr145_fail();
	}
	clean_user_cache($user_id);
	$user = get_userdata($user_id);
	mmhq_lor_dr145_assert_postimage($principal, $user, $consent_at, $consent_version);
	if ('student' === $principal) {
		$state = mmhq_cam_course_state($user_id);
		$historical = mmhq_cam_historical_course_ids($user_id);
		$purchase = mmhq_cam_purchase_state($user_id);
		$entitlement = mmhq_cam_build_entitlement($user_id);
		$current = is_array($state['current_course_ids'] ?? null)
			? array_values(array_unique(array_map('intval', $state['current_course_ids'])))
			: array();
		$expired = is_array($state['expired_course_ids'] ?? null)
			? array_values(array_unique(array_map('intval', $state['expired_course_ids'])))
			: array();
		$historical = is_array($historical)
			? array_values(array_unique(array_map('intval', $historical)))
			: array();
		$course_ids = is_array($entitlement['course_ids'] ?? null)
			? array_values(array_unique(array_map('intval', $entitlement['course_ids'])))
			: array();
		sort($current, SORT_NUMERIC);
		sort($expired, SORT_NUMERIC);
		sort($historical, SORT_NUMERIC);
		sort($course_ids, SORT_NUMERIC);
		if (
			true !== sfwd_lms_has_access(MMHQ_LOR_DR145_COURSE_ID, $user_id)
			|| !is_array($state)
			|| true !== ($state['source_available'] ?? null)
			|| array(MMHQ_LOR_DR145_COURSE_ID) !== $current
			|| array() !== $expired
			|| false !== ($state['revoked'] ?? null)
			|| '' !== ($state['expires_at'] ?? null)
			|| array(MMHQ_LOR_DR145_COURSE_ID) !== $historical
			|| !is_array($purchase)
			|| true !== ($purchase['source_available'] ?? null)
			|| false !== ($purchase['matched'] ?? null)
			|| false !== ($purchase['verified'] ?? null)
			|| false !== ($purchase['refunded'] ?? null)
			|| false !== ($purchase['cancelled'] ?? null)
			|| false !== ($purchase['pending'] ?? null)
			|| !is_array($entitlement)
			|| 'wp:' . $user_id !== ($entitlement['subject'] ?? null)
			|| 'cam' !== ($entitlement['product'] ?? null)
			|| 'wordpress_learndash_handoff' !== ($entitlement['source'] ?? null)
			|| true !== ($entitlement['verified'] ?? null)
			|| true !== ($entitlement['trusted'] ?? null)
			|| true !== ($entitlement['active'] ?? null)
			|| 'active' !== ($entitlement['status'] ?? null)
			|| array(MMHQ_LOR_DR145_COURSE_ID) !== $course_ids
			|| MMHQ_LOR_DR145_PROGRAM_TIER !== ($entitlement['program_tier'] ?? null)
			|| false !== ($entitlement['restricted'] ?? null)
			|| false !== ($entitlement['revoked'] ?? null)
			|| true !== ($entitlement['current_access_verified'] ?? null)
			|| false !== ($entitlement['purchase_verified'] ?? null)
			|| false !== ($entitlement['purchase_match_found'] ?? null)
			|| true !== ($entitlement['enrollment_verified'] ?? null)
			|| 'learndash_current_access' !== ($entitlement['authority_mode'] ?? null)
			|| true !== ($entitlement['revocation_checked'] ?? null)
			|| '' !== ($entitlement['expires_at'] ?? null)
		) {
			mmhq_lor_dr145_fail();
		}
	}
	$projection = mmhq_lor_studio_identity_entitlement_for_user($user_id);
	if (
		is_wp_error($projection)
		|| !is_array($projection)
		|| 'missionmed.lor.wordpress-entitlement.v1' !== ($projection['contract'] ?? null)
		|| 'wp:' . $user_id !== ($projection['subject'] ?? null)
		|| true !== ($projection['admitted'] ?? null)
		|| true !== ($projection['canaryEnabled'] ?? null)
		|| true !== ($projection['canaryConsented'] ?? null)
	) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_capture($principal, $user) {
	$exists = is_object($user) && isset($user->ID, $user->user_login);
	if (!$exists) {
		if ('student' !== $principal) {
			mmhq_lor_dr145_fail();
		}
		$empty = array(
			'encoded' => base64_encode(serialize(array())),
			'count' => 0,
			'sha256' => hash('sha256', "dr145-meta-v1\0" . serialize(array())),
		);
		return array(
			'userExisted' => false,
			'userId' => null,
			'emailSha256' => null,
			'rolesSha256' => null,
			'course3893Access' => false,
			'courseFacts' => array(
				'access' => false,
				'currentCourseIds' => array(),
				'expiredCourseIds' => array(),
				'historicalCourseIds' => array(),
				'purchaseMatched' => false,
				'revoked' => false,
				'expiresAt' => '',
			),
			'courseMeta' => array_fill_keys(MMHQ_LOR_DR145_COURSE_META_KEYS, $empty),
			'tier' => $empty,
			'unrelatedMetaSha256' => null,
			'lorMeta' => array_fill_keys(MMHQ_LOR_DR145_META_KEYS, $empty),
		);
	}
	$user_id = (int) $user->ID;
	$expected_login = 'founder' === $principal ? 'brinyu' : 'brinyu_test';
	if ($user_id < 1 || !is_string($user->user_login) || $expected_login !== $user->user_login) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_assert_no_extra_lor_meta($user_id);
	$roles = isset($user->roles) && is_array($user->roles) ? array_values($user->roles) : array();
	$meta = array();
	foreach (MMHQ_LOR_DR145_META_KEYS as $key) {
		$meta[$key] = mmhq_lor_dr145_meta_rows($user_id, $key);
	}
	$course_meta = array();
	if ('student' === $principal) {
		foreach (MMHQ_LOR_DR145_COURSE_META_KEYS as $key) {
			$course_meta[$key] = mmhq_lor_dr145_meta_rows($user_id, $key);
		}
	}
	return array(
		'userExisted' => true,
		'userId' => $user_id,
		'emailSha256' => isset($user->user_email) && is_string($user->user_email)
			? hash('sha256', "dr145-email-v1\0" . strtolower($user->user_email))
			: null,
		'rolesSha256' => hash('sha256', "dr145-roles-v1\0" . serialize($roles)),
		'course3893Access' => 'student' === $principal
			? mmhq_lor_dr145_student_course_facts($user_id)['access']
			: false,
		'courseFacts' => 'student' === $principal
			? mmhq_lor_dr145_student_course_facts($user_id)
			: null,
		'courseMeta' => 'student' === $principal ? $course_meta : null,
		'tier' => 'student' === $principal
			? mmhq_lor_dr145_meta_rows($user_id, '_mmed_program_tier')
			: null,
		'unrelatedMetaSha256' => mmhq_lor_dr145_unrelated_meta_sha256($principal, $user_id),
		'lorMeta' => $meta,
	);
}

function mmhq_lor_dr145_canonical_json($value) {
	$encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
	if (!is_string($encoded)) {
		mmhq_lor_dr145_fail();
	}
	return $encoded;
}

function mmhq_lor_dr145_write_all($handle, $payload) {
	if (!is_resource($handle) || !is_string($payload) || '' === $payload) {
		return false;
	}
	$written = 0;
	$payload_bytes = strlen($payload);
	while ($written < $payload_bytes) {
		$count = @fwrite($handle, substr($payload, $written));
		if (!is_int($count) || $count < 1) {
			return false;
		}
		$written += $count;
	}
	return $written === $payload_bytes && @fflush($handle);
}

function mmhq_lor_dr145_write_custody($path, $custody) {
	if (false !== mmhq_lor_dr145_fresh_lstat($path)) {
		mmhq_lor_dr145_fail();
	}
	if (!is_array($custody) || array_key_exists('artifactNonce', $custody)) {
		mmhq_lor_dr145_fail();
	}
	$custody['artifactNonce'] = bin2hex(random_bytes(16));
	$payload = mmhq_lor_dr145_canonical_json($custody) . "\n";
	if (strlen($payload) > 262144) {
		mmhq_lor_dr145_fail();
	}
	$payload_sha256 = hash('sha256', $payload);
	$stage_path = mmhq_lor_dr145_private_parent($path . '.stage.' . $payload_sha256);
	$handle = mmhq_lor_dr145_open_exclusive_private($stage_path, 'x+b');
	if (false === $handle) {
		mmhq_lor_dr145_fail();
	}
	$locked = @flock($handle, LOCK_EX | LOCK_NB);
	$stat = @fstat($handle);
	$path_stat = mmhq_lor_dr145_fresh_lstat($stage_path);
	if (
		!$locked
		|| !mmhq_lor_dr145_is_private_regular_stat($stat)
		|| !mmhq_lor_dr145_is_private_regular_stat($path_stat)
		|| !mmhq_lor_dr145_same_inode($stat, $path_stat)
		|| 0 !== (int) $stat['size']
	) {
		@flock($handle, LOCK_UN);
		@fclose($handle);
		mmhq_lor_dr145_fail();
	}
	$written = 0;
	$payload_bytes = strlen($payload);
	while ($written < $payload_bytes) {
		$count = @fwrite($handle, substr($payload, $written));
		if (!is_int($count) || $count < 1) {
			break;
		}
		$written += $count;
	}
	$flushed = @fflush($handle);
	if (!function_exists('fsync')) {
		$flushed = false;
	} else {
		$flushed = $flushed && @fsync($handle);
	}
	$rewound = @rewind($handle);
	$readback = $rewound ? @stream_get_contents($handle, $payload_bytes + 1) : false;
	$stage_final_stat = @fstat($handle);
	$stage_final_path_stat = mmhq_lor_dr145_fresh_lstat($stage_path);
	$valid = $written === $payload_bytes
		&& $flushed
		&& is_string($readback)
		&& hash_equals(hash('sha256', $payload), hash('sha256', $readback))
		&& mmhq_lor_dr145_is_private_regular_stat($stage_final_stat)
		&& mmhq_lor_dr145_is_private_regular_stat($stage_final_path_stat)
		&& mmhq_lor_dr145_same_inode($stat, $stage_final_stat)
		&& mmhq_lor_dr145_same_inode($stage_final_stat, $stage_final_path_stat)
		&& (int) $stage_final_stat['size'] === $payload_bytes
		&& (int) $stage_final_path_stat['size'] === $payload_bytes
		&& (int) $stage_final_stat['mtime'] === (int) $stage_final_path_stat['mtime']
		&& (int) $stage_final_stat['ctime'] === (int) $stage_final_path_stat['ctime'];
	if ($valid) {
		mmhq_lor_dr145_sync_parent($stage_path);
	}
	if ($valid && @link($stage_path, $path)) {
		$published_stat = @fstat($handle);
		$published_path_stat = mmhq_lor_dr145_fresh_lstat($path);
		$published_stage_stat = mmhq_lor_dr145_fresh_lstat($stage_path);
		$valid = mmhq_lor_dr145_is_published_private_stat($published_stat)
			&& mmhq_lor_dr145_is_published_private_stat($published_path_stat)
			&& mmhq_lor_dr145_is_published_private_stat($published_stage_stat)
			&& mmhq_lor_dr145_same_inode($published_stat, $published_path_stat)
			&& mmhq_lor_dr145_same_inode($published_path_stat, $published_stage_stat);
	} else {
		$valid = false;
	}
	if ($valid) {
		mmhq_lor_dr145_sync_parent($path);
	}
	@flock($handle, LOCK_UN);
	@fclose($handle);
	if (!$valid) {
		mmhq_lor_dr145_fail();
	}
	return $payload_sha256;
}

function mmhq_lor_dr145_bound_identity_path($custody_path) {
	return mmhq_lor_dr145_private_parent($custody_path . '.identity.bound.json');
}

function mmhq_lor_dr145_pending_custody_handle($base_sha256) {
	if (1 !== preg_match('/^[0-9a-f]{64}$/D', $base_sha256)) {
		mmhq_lor_dr145_fail();
	}
	return hash('sha256', "dr145-pending-custody-handle-v2\0" . $base_sha256);
}

function mmhq_lor_dr145_bound_custody_handle($base_sha256, $bound_sha256) {
	if (
		1 !== preg_match('/^[0-9a-f]{64}$/D', $base_sha256)
		|| 1 !== preg_match('/^[0-9a-f]{64}$/D', $bound_sha256)
	) {
		mmhq_lor_dr145_fail();
	}
	return hash(
		'sha256',
		"dr145-bound-custody-handle-v2\0" . $base_sha256 . "\0" . $bound_sha256
	);
}

function mmhq_lor_dr145_build_pending_identity($custody) {
	if (
		'student' !== ($custody['principal'] ?? null)
		|| true === ($custody['before']['userExisted'] ?? null)
		|| null !== ($custody['boundUserId'] ?? null)
		|| !is_string($custody['expectedEmailSha256'] ?? null)
	) {
		mmhq_lor_dr145_fail();
	}
	$consent_epoch = strtotime($custody['desiredConsentAt'] ?? '');
	if (false === $consent_epoch) {
		mmhq_lor_dr145_fail();
	}
	$expected_registered_at = gmdate('Y-m-d H:i:s', $consent_epoch);
	$identity = array(
		'schemaVersion' => MMHQ_LOR_DR145_PENDING_IDENTITY_SCHEMA,
		'principal' => 'student',
		'state' => 'pending',
		'expectedRegisteredAt' => $expected_registered_at,
		'expectedEmailSha256' => $custody['expectedEmailSha256'],
	);
	return $identity;
}

function mmhq_lor_dr145_bind_created_identity($custody_path, $custody, $base_sha256, $user_id) {
	$pending = $custody['_pendingIdentity'] ?? null;
	if (
		'student' !== ($custody['principal'] ?? null)
		|| true === ($custody['before']['userExisted'] ?? null)
		|| null !== ($custody['boundUserId'] ?? null)
		|| !is_array($pending)
		|| 'pending' !== ($pending['state'] ?? null)
		|| !is_string($pending['expectedRegisteredAt'] ?? null)
		|| !is_int($user_id)
		|| $user_id < 1
		|| !is_string($custody['expectedEmailSha256'] ?? null)
	) {
		mmhq_lor_dr145_fail();
	}
	$bound = array(
		'schemaVersion' => MMHQ_LOR_DR145_BOUND_IDENTITY_SCHEMA,
		'principal' => 'student',
		'state' => 'bound',
		'baseCustodySha256' => $base_sha256,
		'boundUserId' => $user_id,
		'registeredAtSha256' => hash('sha256', "dr145-registered-at-v1\0" . $pending['expectedRegisteredAt']),
		'expectedEmailSha256' => $custody['expectedEmailSha256'],
	);
	$bound_sha256 = mmhq_lor_dr145_write_custody(
		mmhq_lor_dr145_bound_identity_path($custody_path),
		$bound
	);
	return array(
		'bound' => $bound,
		'boundSha256' => $bound_sha256,
		'custodySha256' => mmhq_lor_dr145_bound_custody_handle($base_sha256, $bound_sha256),
	);
}

function mmhq_lor_dr145_read_custody($path, $expected_sha256, $principal) {
	if ('NEW' !== $expected_sha256 && 1 !== preg_match('/^[0-9a-f]{64}$/D', $expected_sha256)) {
		mmhq_lor_dr145_fail();
	}
	$payload = mmhq_lor_dr145_read_private_file($path, 262144, true);
	$base_sha256 = hash('sha256', $payload);
	$custody = json_decode($payload, true);
	if (
		!is_array($custody)
		|| array(
			'schemaVersion', 'principal', 'desiredConsentAt', 'desiredConsentVersion', 'boundUserId',
			'expectedEmailSha256', 'before', 'pendingIdentity', 'artifactNonce',
		) !== array_keys($custody)
		|| MMHQ_LOR_DR145_CUSTODY_SCHEMA !== ($custody['schemaVersion'] ?? null)
		|| $principal !== ($custody['principal'] ?? null)
		|| !isset($custody['before'], $custody['desiredConsentAt'], $custody['desiredConsentVersion'])
		|| !is_array($custody['before'])
		|| !is_bool($custody['before']['userExisted'] ?? null)
		|| !array_key_exists('userId', $custody['before'])
		|| !is_string($custody['desiredConsentAt'])
		|| !is_string($custody['desiredConsentVersion'])
		|| 1 !== preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/D', $custody['desiredConsentVersion'])
		|| !array_key_exists('boundUserId', $custody)
		|| !array_key_exists('expectedEmailSha256', $custody)
		|| !array_key_exists('pendingIdentity', $custody)
		|| !is_string($custody['artifactNonce'] ?? null)
		|| 1 !== preg_match('/^[0-9a-f]{32}$/D', $custody['artifactNonce'])
		|| (null !== $custody['expectedEmailSha256']
			&& (!is_string($custody['expectedEmailSha256'])
				|| 1 !== preg_match('/^[0-9a-f]{64}$/D', $custody['expectedEmailSha256'])))
	) {
		mmhq_lor_dr145_fail();
	}
	$user_existed = true === ($custody['before']['userExisted'] ?? null);
	$custody['_baseCustodySha256'] = $base_sha256;
	if ($user_existed) {
		if (
			!is_int($custody['before']['userId'] ?? null)
			|| ($custody['before']['userId'] ?? null) < 1
			|| ($custody['boundUserId'] ?? null) !== $custody['before']['userId']
			|| null !== $custody['pendingIdentity']
			|| ('NEW' !== $expected_sha256 && !hash_equals($expected_sha256, $base_sha256))
			|| false !== mmhq_lor_dr145_fresh_lstat(mmhq_lor_dr145_bound_identity_path($path))
		) {
			mmhq_lor_dr145_fail();
		}
		$custody['_identityState'] = 'bound';
		$custody['_custodySha256'] = $base_sha256;
	} else {
		$pending = $custody['pendingIdentity'] ?? null;
		if (
			'student' !== $principal
			|| null !== ($custody['before']['userId'] ?? null)
			|| null !== $custody['boundUserId']
			|| !is_array($pending)
			|| array(
				'schemaVersion', 'principal', 'state', 'expectedRegisteredAt', 'expectedEmailSha256',
			) !== array_keys($pending)
			|| MMHQ_LOR_DR145_PENDING_IDENTITY_SCHEMA !== $pending['schemaVersion']
			|| 'student' !== $pending['principal']
			|| 'pending' !== $pending['state']
			|| !is_string($pending['expectedRegisteredAt'])
			|| 1 !== preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/D', $pending['expectedRegisteredAt'])
			|| false === strtotime($custody['desiredConsentAt'])
			|| gmdate('Y-m-d H:i:s', strtotime($custody['desiredConsentAt'])) !== $pending['expectedRegisteredAt']
			|| !is_string($pending['expectedEmailSha256'])
			|| !hash_equals($custody['expectedEmailSha256'], $pending['expectedEmailSha256'])
		) {
			mmhq_lor_dr145_fail();
		}
		$pending_handle = mmhq_lor_dr145_pending_custody_handle($base_sha256);
		$custody['_pendingIdentity'] = $pending;
		$custody['_identityState'] = 'pending';
		$custody['_custodySha256'] = $pending_handle;
		$bound_path = mmhq_lor_dr145_bound_identity_path($path);
		if (false !== mmhq_lor_dr145_fresh_lstat($bound_path)) {
			$bound_payload = mmhq_lor_dr145_read_private_file($bound_path, 4096, true);
			$bound_sha256 = hash('sha256', $bound_payload);
			$bound = json_decode($bound_payload, true);
			if (
				!is_array($bound)
				|| array(
					'schemaVersion', 'principal', 'state', 'baseCustodySha256', 'boundUserId',
					'registeredAtSha256', 'expectedEmailSha256', 'artifactNonce',
				) !== array_keys($bound)
				|| MMHQ_LOR_DR145_BOUND_IDENTITY_SCHEMA !== $bound['schemaVersion']
				|| 'student' !== $bound['principal']
				|| 'bound' !== $bound['state']
				|| !is_string($bound['baseCustodySha256'])
				|| !hash_equals($base_sha256, $bound['baseCustodySha256'])
				|| !is_int($bound['boundUserId'])
				|| $bound['boundUserId'] < 1
				|| !is_string($bound['registeredAtSha256'])
				|| !hash_equals(
					hash('sha256', "dr145-registered-at-v1\0" . $pending['expectedRegisteredAt']),
					$bound['registeredAtSha256']
				)
				|| !is_string($bound['expectedEmailSha256'])
				|| !hash_equals($custody['expectedEmailSha256'], $bound['expectedEmailSha256'])
				|| !is_string($bound['artifactNonce'] ?? null)
				|| 1 !== preg_match('/^[0-9a-f]{32}$/D', $bound['artifactNonce'])
			) {
				mmhq_lor_dr145_fail();
			}
			$bound_handle = mmhq_lor_dr145_bound_custody_handle($base_sha256, $bound_sha256);
			if ('NEW' !== $expected_sha256 && !hash_equals($expected_sha256, $pending_handle) && !hash_equals($expected_sha256, $bound_handle)) {
				mmhq_lor_dr145_fail();
			}
			$custody['boundUserId'] = $bound['boundUserId'];
			$custody['_identityState'] = 'bound';
			$custody['_custodySha256'] = $bound_handle;
		} elseif ('NEW' !== $expected_sha256 && !hash_equals($expected_sha256, $pending_handle)) {
			mmhq_lor_dr145_fail();
		}
	}
	return $custody;
}

function mmhq_lor_dr145_required_apis() {
	foreach (array(
			'get_user_by', 'get_userdata', 'user_can', 'get_user_meta', 'delete_user_meta',
		'add_user_meta', 'sfwd_lms_has_access', 'learndash_user_get_enrolled_courses',
		'learndash_get_expired_user_courses_from_meta', 'ld_course_access_expired',
		'ld_course_access_expires_on', 'wc_get_orders', 'mmhq_cam_course_state',
		'mmhq_cam_historical_course_ids', 'mmhq_cam_purchase_state', 'mmhq_cam_build_entitlement',
		'mmhq_lor_studio_identity_entitlement_for_user', 'is_wp_error',
		'wp_check_password', 'wp_using_ext_object_cache', 'has_filter',
		'clean_user_cache', 'wp_hash_password', 'wp_cache_delete',
	) as $function) {
		if (!function_exists($function)) {
			mmhq_lor_dr145_fail();
		}
	}
	if (!defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!defined('WPINC')
			|| !is_string(WPINC)
			|| !defined('WP_PLUGIN_DIR')
			|| !is_string(WP_PLUGIN_DIR)
			|| !defined('WP_CONTENT_DIR')
			|| !is_string(WP_CONTENT_DIR)
		) {
			mmhq_lor_dr145_fail();
		}
		$expected_pluggable = realpath(ABSPATH . WPINC . '/pluggable.php');
		$learndash_root = realpath(rtrim(WP_PLUGIN_DIR, '/\\') . '/sfwd-lms');
		$woocommerce_root = realpath(rtrim(WP_PLUGIN_DIR, '/\\') . '/woocommerce');
		$handoff_file = realpath(rtrim(WP_CONTENT_DIR, '/\\') . '/mu-plugins/missionmed-hq-auth-handoff.php');
		$contract_file = realpath(rtrim(WP_CONTENT_DIR, '/\\') . '/mu-plugins/missionmed-lor-studio-contract.php');
		if (
			!is_string($expected_pluggable)
			|| !is_string($learndash_root)
			|| !is_string($woocommerce_root)
			|| !is_string($handoff_file)
			|| !is_string($contract_file)
		) {
			mmhq_lor_dr145_fail();
		}
		foreach (array('get_user_by', 'get_userdata', 'wp_hash_password', 'wp_check_password') as $function) {
			$reflection = new ReflectionFunction($function);
			$defined_in = $reflection->getFileName();
			if (!is_string($defined_in) || realpath($defined_in) !== $expected_pluggable) {
				mmhq_lor_dr145_fail();
			}
		}
		foreach (array(
			'sfwd_lms_has_access', 'learndash_user_get_enrolled_courses',
			'learndash_get_expired_user_courses_from_meta', 'ld_course_access_expired',
			'ld_course_access_expires_on',
		) as $function) {
			$reflection = new ReflectionFunction($function);
			$defined_in = $reflection->getFileName();
			$real_path = is_string($defined_in) ? realpath($defined_in) : false;
			if (!is_string($real_path) || !mmhq_lor_dr145_is_within($real_path, $learndash_root)) {
				mmhq_lor_dr145_fail();
			}
		}
		$wc_reflection = new ReflectionFunction('wc_get_orders');
		$wc_defined_in = $wc_reflection->getFileName();
		$wc_real_path = is_string($wc_defined_in) ? realpath($wc_defined_in) : false;
		if (!is_string($wc_real_path) || !mmhq_lor_dr145_is_within($wc_real_path, $woocommerce_root)) {
			mmhq_lor_dr145_fail();
		}
		foreach (array(
			'mmhq_cam_course_state', 'mmhq_cam_historical_course_ids',
			'mmhq_cam_purchase_state', 'mmhq_cam_build_entitlement',
		) as $function) {
			$reflection = new ReflectionFunction($function);
			$defined_in = $reflection->getFileName();
			if (!is_string($defined_in) || realpath($defined_in) !== $handoff_file) {
				mmhq_lor_dr145_fail();
			}
		}
		$contract_reflection = new ReflectionFunction('mmhq_lor_studio_identity_entitlement_for_user');
		$contract_defined_in = $contract_reflection->getFileName();
		if (!is_string($contract_defined_in) || realpath($contract_defined_in) !== $contract_file) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_assert_core_wpdb_runtime() {
	global $wpdb;
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!is_object($wpdb)
			|| !method_exists($wpdb, 'mmhq_lor_dr145_native_runtime_is_canonical')
			|| true !== $wpdb->mmhq_lor_dr145_native_runtime_is_canonical()
		) {
			mmhq_lor_dr145_fail();
		}
		return;
	}
	if (
		!is_object($wpdb)
		|| 'wpdb' !== get_class($wpdb)
		|| !defined('WPINC')
		|| !defined('WP_CONTENT_DIR')
		|| !is_string(WPINC)
		|| !is_string(WP_CONTENT_DIR)
	) {
		mmhq_lor_dr145_fail();
	}
	foreach (array('db.php', 'object-cache.php') as $drop_in_name) {
		$drop_in = rtrim(WP_CONTENT_DIR, '/\\') . '/' . $drop_in_name;
		clearstatcache(true, $drop_in);
		if (file_exists($drop_in) || is_link($drop_in)) {
			mmhq_lor_dr145_fail();
		}
	}
	$core_path = realpath(rtrim(ABSPATH, '/\\') . '/' . trim(WPINC, '/\\') . '/class-wpdb.php');
	$reflection = new ReflectionClass($wpdb);
	$class_path = $reflection->getFileName();
	if (!is_string($core_path) || !is_string($class_path) || $core_path !== realpath($class_path)) {
		mmhq_lor_dr145_fail();
	}
	foreach (array('query', 'get_var', 'get_col', 'prepare', 'suppress_errors', 'check_connection') as $method) {
		if (!$reflection->hasMethod($method)) {
			mmhq_lor_dr145_fail();
		}
		$method_reflection = $reflection->getMethod($method);
		$method_path = $method_reflection->getFileName();
		if ('wpdb' !== $method_reflection->getDeclaringClass()->getName() || !is_string($method_path) || $core_path !== realpath($method_path)) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_db_assert_active() {
	global $wpdb;
	$expected_connection_id = $GLOBALS['mmhq_lor_dr145_transaction_connection_id'] ?? null;
	$expected_dbh_object_id = $GLOBALS['mmhq_lor_dr145_transaction_dbh_object_id'] ?? null;
	$dbh = mmhq_lor_dr145_native_dbh();
	$connection_id = is_object($wpdb) && method_exists($wpdb, 'get_var')
		? $wpdb->get_var('SELECT CONNECTION_ID()')
		: null;
	if (
		!is_int($expected_connection_id)
		|| $expected_connection_id < 1
		|| !is_int($expected_dbh_object_id)
		|| $expected_dbh_object_id < 1
		|| spl_object_id($dbh) !== $expected_dbh_object_id
		|| (int) $connection_id !== $expected_connection_id
		|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $expected_connection_id
		|| 1 !== mmhq_lor_dr145_native_in_transaction($dbh)
	) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_db_suppress_errors() {
	global $wpdb;
	if (
		(defined('SAVEQUERIES') && (bool) constant('SAVEQUERIES'))
		|| !is_object($wpdb)
		|| !method_exists($wpdb, 'suppress_errors')
		|| isset($GLOBALS['mmhq_lor_dr145_error_guard'])
	) {
		mmhq_lor_dr145_fail();
	}
	$previous = $wpdb->suppress_errors(true);
	if (!is_bool($previous) || !isset($wpdb->suppress_errors) || true !== $wpdb->suppress_errors) {
		mmhq_lor_dr145_fail();
	}
	$GLOBALS['mmhq_lor_dr145_error_guard'] = $previous;
}

function mmhq_lor_dr145_db_restore_errors() {
	global $wpdb;
	$previous = $GLOBALS['mmhq_lor_dr145_error_guard'] ?? null;
	if (!is_bool($previous) || !is_object($wpdb) || !method_exists($wpdb, 'suppress_errors')) {
		mmhq_lor_dr145_fail();
	}
	$wpdb->suppress_errors($previous);
	if (!isset($wpdb->suppress_errors) || $previous !== $wpdb->suppress_errors) {
		mmhq_lor_dr145_fail();
	}
	unset($GLOBALS['mmhq_lor_dr145_error_guard']);
}

function mmhq_lor_dr145_db_freeze_reconnect() {
	global $wpdb;
	if (!is_object($wpdb) || isset($GLOBALS['mmhq_lor_dr145_reconnect_guard'])) {
		mmhq_lor_dr145_fail();
	}
	$reflection = new ReflectionObject($wpdb);
	if (!$reflection->hasProperty('reconnect_retries')) {
		mmhq_lor_dr145_fail();
	}
	$property = $reflection->getProperty('reconnect_retries');
	if (PHP_VERSION_ID < 80100) {
		$property->setAccessible(true);
	}
	$previous = $property->getValue($wpdb);
	if (!is_int($previous) || $previous < 0) {
		mmhq_lor_dr145_fail();
	}
	$property->setValue($wpdb, 0);
	if (0 !== $property->getValue($wpdb)) {
		mmhq_lor_dr145_fail();
	}
	$GLOBALS['mmhq_lor_dr145_reconnect_guard'] = array(
		'objectId' => spl_object_id($wpdb),
		'previous' => $previous,
	);
}

function mmhq_lor_dr145_db_restore_reconnect() {
	global $wpdb;
	$guard = $GLOBALS['mmhq_lor_dr145_reconnect_guard'] ?? null;
	if (
		!is_object($wpdb)
		|| !is_array($guard)
		|| !is_int($guard['objectId'] ?? null)
		|| spl_object_id($wpdb) !== $guard['objectId']
		|| !is_int($guard['previous'] ?? null)
		|| $guard['previous'] < 0
	) {
		mmhq_lor_dr145_fail();
	}
	$reflection = new ReflectionObject($wpdb);
	if (!$reflection->hasProperty('reconnect_retries')) {
		mmhq_lor_dr145_fail();
	}
	$property = $reflection->getProperty('reconnect_retries');
	if (PHP_VERSION_ID < 80100) {
		$property->setAccessible(true);
	}
	if (0 !== $property->getValue($wpdb)) {
		mmhq_lor_dr145_fail();
	}
	$property->setValue($wpdb, $guard['previous']);
	if ($guard['previous'] !== $property->getValue($wpdb)) {
		mmhq_lor_dr145_fail();
	}
	unset($GLOBALS['mmhq_lor_dr145_reconnect_guard']);
}

function mmhq_lor_dr145_native_dbh() {
	global $wpdb;
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (!is_object($wpdb) || !method_exists($wpdb, 'mmhq_lor_dr145_native_insert_student')) {
			mmhq_lor_dr145_fail();
		}
		return $wpdb;
	}
	if (!is_object($wpdb) || !class_exists('mysqli', false)) {
		mmhq_lor_dr145_fail();
	}
	$reflection = new ReflectionObject($wpdb);
	if (!$reflection->hasProperty('dbh')) {
		mmhq_lor_dr145_fail();
	}
	$property = $reflection->getProperty('dbh');
	if (PHP_VERSION_ID < 80100) {
		$property->setAccessible(true);
	}
	$dbh = $property->getValue($wpdb);
	if (!($dbh instanceof mysqli)) {
		mmhq_lor_dr145_fail();
	}
	return $dbh;
}

function mmhq_lor_dr145_native_scalar($dbh, $query) {
	if (!is_string($query) || '' === $query) {
		mmhq_lor_dr145_fail();
	}
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (!is_object($dbh) || !method_exists($dbh, 'mmhq_lor_dr145_native_scalar_for_test')) {
			mmhq_lor_dr145_fail();
		}
		return $dbh->mmhq_lor_dr145_native_scalar_for_test($query);
	}
	try {
		$result = @mysqli_query($dbh, $query);
		if (!($result instanceof mysqli_result)) {
			mmhq_lor_dr145_fail();
		}
		$row = mysqli_fetch_row($result);
		$extra = mysqli_fetch_row($result);
		mysqli_free_result($result);
	} catch (Throwable $error) {
		mmhq_lor_dr145_fail();
	}
	if (!is_array($row) || 1 !== count($row) || null !== $extra) {
		mmhq_lor_dr145_fail();
	}
	return $row[0];
}

function mmhq_lor_dr145_native_in_transaction($dbh) {
	$version = mmhq_lor_dr145_native_scalar($dbh, 'SELECT VERSION()');
	if (!is_string($version) || '' === $version) {
		mmhq_lor_dr145_fail();
	}
	if (false !== stripos($version, 'mariadb')) {
		$active = mmhq_lor_dr145_native_scalar($dbh, 'SELECT @@session.in_transaction');
	} else {
		$active = mmhq_lor_dr145_native_scalar(
			$dbh,
			"SELECT COUNT(*) FROM performance_schema.events_transactions_current AS tx JOIN performance_schema.threads AS th ON th.THREAD_ID = tx.THREAD_ID WHERE th.PROCESSLIST_ID = CONNECTION_ID() AND tx.STATE = 'ACTIVE'"
		);
	}
	if (!(is_int($active) || (is_string($active) && 1 === preg_match('/^[01]$/D', $active)))) {
		mmhq_lor_dr145_fail();
	}
	$active = (int) $active;
	if (!in_array($active, array(0, 1), true)) {
		mmhq_lor_dr145_fail();
	}
	return $active;
}

function mmhq_lor_dr145_native_exec($dbh, $query) {
	if (!is_string($query) || '' === $query || defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		mmhq_lor_dr145_fail();
	}
	try {
		$result = @mysqli_query($dbh, $query);
	} catch (Throwable $error) {
		mmhq_lor_dr145_fail();
	}
	if (true !== $result) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_native_prepared($dbh, $query, $types, $values, $return_rows) {
	if (
		!is_string($query)
		|| '' === $query
		|| !is_string($types)
		|| 1 !== preg_match('/^[idsb]*$/D', $types)
		|| !is_array($values)
		|| strlen($types) !== count($values)
		|| !is_bool($return_rows)
		|| defined('MMHQ_LOR_DR145_TEST_HARNESS')
	) {
		mmhq_lor_dr145_fail();
	}
	$stmt = null;
	try {
		$stmt = @mysqli_prepare($dbh, $query);
		if (!($stmt instanceof mysqli_stmt)) {
			mmhq_lor_dr145_fail();
		}
		if ('' !== $types) {
			$parameters = array($stmt, $types);
			foreach ($values as $index => $value) {
				$values[$index] = $value;
				$parameters[] = &$values[$index];
			}
			if (true !== call_user_func_array('mysqli_stmt_bind_param', $parameters)) {
				mmhq_lor_dr145_fail();
			}
		}
		if (true !== @mysqli_stmt_execute($stmt)) {
			mmhq_lor_dr145_fail();
		}
		if (!$return_rows) {
			mysqli_stmt_close($stmt);
			return true;
		}
		$metadata = mysqli_stmt_result_metadata($stmt);
		if (!($metadata instanceof mysqli_result)) {
			mmhq_lor_dr145_fail();
		}
		$fields = mysqli_fetch_fields($metadata);
		mysqli_free_result($metadata);
		if (!is_array($fields) || empty($fields)) {
			mmhq_lor_dr145_fail();
		}
		$row_values = array_fill(0, count($fields), null);
		$bindings = array($stmt);
		foreach ($row_values as $index => $value) {
			$bindings[] = &$row_values[$index];
		}
		if (true !== call_user_func_array('mysqli_stmt_bind_result', $bindings)) {
			mmhq_lor_dr145_fail();
		}
		$rows = array();
		while (true === ($fetch_status = mysqli_stmt_fetch($stmt))) {
			$row = array();
			foreach ($fields as $index => $field) {
				$row[$field->name] = $row_values[$index];
			}
			$rows[] = $row;
			if (count($rows) > 4) {
				mmhq_lor_dr145_fail();
			}
		}
		if (null !== $fetch_status) {
			mmhq_lor_dr145_fail();
		}
		mysqli_stmt_close($stmt);
		return $rows;
	} catch (Throwable $error) {
		if ($stmt instanceof mysqli_stmt) {
			@mysqli_stmt_close($stmt);
		}
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_native_assert_table_contract($dbh, $tables) {
	if (!is_array($tables) || empty($tables) || 1 !== mmhq_lor_dr145_native_in_transaction($dbh)) {
		mmhq_lor_dr145_fail();
	}
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!is_object($dbh)
			|| !method_exists($dbh, 'mmhq_lor_dr145_native_assert_transaction_schema_locked')
			|| true !== $dbh->mmhq_lor_dr145_native_assert_transaction_schema_locked($tables)
		) {
			mmhq_lor_dr145_fail();
		}
		return;
	}
	foreach ($tables as $table) {
		if (!is_string($table) || 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $table)) {
			mmhq_lor_dr145_fail();
		}
		$lock_rows = mmhq_lor_dr145_native_prepared(
			$dbh,
			"SELECT 1 AS `schema_lock` FROM `{$table}` WHERE 1 = 0 FOR UPDATE",
			'',
			array(),
			true
		);
		$engine_rows = mmhq_lor_dr145_native_prepared(
			$dbh,
			'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
			's',
			array($table),
			true
		);
		$trigger_rows = mmhq_lor_dr145_native_prepared(
			$dbh,
			'SELECT COUNT(*) AS `contract_count` FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = ?',
			's',
			array($table),
			true
		);
		$foreign_key_rows = mmhq_lor_dr145_native_prepared(
			$dbh,
			'SELECT COUNT(*) AS `contract_count` FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA IS NOT NULL AND ((TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?) OR (REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ?))',
			'ss',
			array($table, $table),
			true
		);
		$trigger_count = 1 === count($trigger_rows) ? ($trigger_rows[0]['contract_count'] ?? null) : null;
		$foreign_key_count = 1 === count($foreign_key_rows) ? ($foreign_key_rows[0]['contract_count'] ?? null) : null;
		if (
			!empty($lock_rows)
			|| 1 !== count($engine_rows)
			|| !is_string($engine_rows[0]['ENGINE'] ?? null)
			|| 'innodb' !== strtolower($engine_rows[0]['ENGINE'])
			|| !(is_int($trigger_count) || (is_string($trigger_count) && 1 === preg_match('/^[0-9]+$/D', $trigger_count)))
			|| 0 !== (int) $trigger_count
			|| !(is_int($foreign_key_count) || (is_string($foreign_key_count) && 1 === preg_match('/^[0-9]+$/D', $foreign_key_count)))
			|| 0 !== (int) $foreign_key_count
		) {
			mmhq_lor_dr145_fail();
		}
	}
	if (1 !== mmhq_lor_dr145_native_in_transaction($dbh)) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_insert_inert_student($email, $registered_at, $password_hash) {
	global $wpdb;
	if (
		!is_string($email)
		|| !is_string($registered_at)
		|| 1 !== preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/D', $registered_at)
		|| !is_string($password_hash)
		|| strlen($password_hash) < 16
		|| strlen($password_hash) > 255
		|| !is_object($wpdb)
		|| !isset($wpdb->users)
		|| !is_string($wpdb->users)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->users)
	) {
		mmhq_lor_dr145_fail();
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		$user_id = $dbh->mmhq_lor_dr145_native_insert_student(array(
			'user_login' => 'brinyu_test',
			'user_pass' => $password_hash,
			'user_nicename' => 'brinyu-test',
			'user_email' => $email,
			'user_url' => '',
			'user_registered' => $registered_at,
			'user_activation_key' => '',
			'user_status' => 0,
			'display_name' => 'brinyu_test',
		));
		if (!is_int($user_id) || $user_id < 1) {
			mmhq_lor_dr145_fail();
		}
		return $user_id;
	}
	$fields = array(
		'user_login' => 'brinyu_test',
		'user_pass' => $password_hash,
		'user_nicename' => 'brinyu-test',
		'user_email' => $email,
		'user_url' => '',
		'user_registered' => $registered_at,
		'user_activation_key' => '',
		'user_status' => '0',
		'display_name' => 'brinyu_test',
	);
	$transaction_started = false;
	try {
		$connection_object_id = spl_object_id($dbh);
		$connection_id = (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()');
		if (
			$connection_id < 1
			|| 1 !== (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT @@session.autocommit')
			|| 0 !== mmhq_lor_dr145_native_in_transaction($dbh)
		) {
			mmhq_lor_dr145_fail();
		}
			mmhq_lor_dr145_native_exec($dbh, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
			mmhq_lor_dr145_native_exec($dbh, 'START TRANSACTION');
			$transaction_started = true;
			mmhq_lor_dr145_native_assert_table_contract($dbh, array($wpdb->users, $wpdb->usermeta));
			if (
			1 !== mmhq_lor_dr145_native_in_transaction($dbh)
			|| !empty(mmhq_lor_dr145_native_prepared($dbh, "SELECT `ID` FROM `{$wpdb->users}` WHERE `user_login` = ? FOR UPDATE", 's', array($fields['user_login']), true))
			|| !empty(mmhq_lor_dr145_native_prepared($dbh, "SELECT `ID` FROM `{$wpdb->users}` WHERE `user_email` = ? FOR UPDATE", 's', array($fields['user_email']), true))
			|| !empty(mmhq_lor_dr145_native_prepared($dbh, "SELECT `ID` FROM `{$wpdb->users}` WHERE `user_nicename` = ? FOR UPDATE", 's', array($fields['user_nicename']), true))
		) {
			mmhq_lor_dr145_fail();
		}
		mmhq_lor_dr145_native_prepared(
			$dbh,
			"INSERT INTO `{$wpdb->users}` (`user_login`,`user_pass`,`user_nicename`,`user_email`,`user_url`,`user_registered`,`user_activation_key`,`user_status`,`display_name`) VALUES (?,?,?,?,?,?,?,?,?)",
			'sssssssis',
			array_values($fields),
			false
		);
		$user_id = (int) mysqli_insert_id($dbh);
		if ($user_id < 1) {
			mmhq_lor_dr145_fail();
		}
		$created_rows = mmhq_lor_dr145_native_prepared(
			$dbh,
			"SELECT `ID`,`user_login`,`user_pass`,`user_nicename`,`user_email`,`user_url`,`user_registered`,`user_activation_key`,`user_status`,`display_name` FROM `{$wpdb->users}` WHERE `ID` = ? FOR UPDATE",
			'i',
			array($user_id),
			true
		);
		if (
			1 !== count($created_rows)
			|| $user_id !== (int) ($created_rows[0]['ID'] ?? 0)
			|| $fields['user_login'] !== ($created_rows[0]['user_login'] ?? null)
			|| $fields['user_pass'] !== ($created_rows[0]['user_pass'] ?? null)
			|| $fields['user_nicename'] !== ($created_rows[0]['user_nicename'] ?? null)
			|| $fields['user_email'] !== ($created_rows[0]['user_email'] ?? null)
			|| $fields['user_url'] !== ($created_rows[0]['user_url'] ?? null)
			|| $fields['user_registered'] !== ($created_rows[0]['user_registered'] ?? null)
			|| $fields['user_activation_key'] !== ($created_rows[0]['user_activation_key'] ?? null)
			|| 0 !== (int) ($created_rows[0]['user_status'] ?? -1)
			|| $fields['display_name'] !== ($created_rows[0]['display_name'] ?? null)
			|| !empty(mmhq_lor_dr145_native_prepared($dbh, "SELECT `umeta_id` FROM `{$wpdb->usermeta}` WHERE `user_id` = ? FOR UPDATE", 'i', array($user_id), true))
			|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $connection_id
			|| 1 !== mmhq_lor_dr145_native_in_transaction($dbh)
		) {
			mmhq_lor_dr145_fail();
		}
		mmhq_lor_dr145_native_exec($dbh, 'COMMIT');
		$transaction_started = false;
	} catch (Throwable $error) {
		if ($transaction_started) {
			try {
				@mysqli_query($dbh, 'ROLLBACK');
			} catch (Throwable $rollback_error) {
			}
		}
		mmhq_lor_dr145_fail();
	}
	unset($fields, $created_rows, $password_hash, $email);
	if (
		$user_id < 1
		|| spl_object_id($dbh) !== $connection_object_id
		|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $connection_id
		|| 1 !== (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT @@session.autocommit')
		|| 0 !== mmhq_lor_dr145_native_in_transaction($dbh)
	) {
		mmhq_lor_dr145_fail();
	}
	wp_cache_delete($user_id, 'users');
	wp_cache_delete($user_id, 'user_meta');
	wp_cache_delete('brinyu_test', 'userlogins');
	wp_cache_delete('brinyu-test', 'userslugs');
	return $user_id;
}

function mmhq_lor_dr145_assert_unique_identity($principal, $user, $require_existing_transaction) {
	global $wpdb;
	if (
		!in_array($principal, array('founder', 'student'), true)
		|| !is_object($user)
		|| !isset($user->ID, $user->user_login, $user->user_email)
		|| !is_string($user->user_login)
		|| !is_string($user->user_email)
		|| '' === $user->user_email
		|| !is_bool($require_existing_transaction)
	) {
		mmhq_lor_dr145_fail();
	}
	$user_id = (int) $user->ID;
	$login = 'founder' === $principal ? 'brinyu' : 'brinyu_test';
	$nicename = 'student' === $principal ? 'brinyu-test' : null;
	if (
		$user_id < 1
		|| $login !== $user->user_login
		|| ('student' === $principal
			&& (!isset($user->user_nicename) || !is_string($user->user_nicename) || $nicename !== $user->user_nicename))
	) {
		mmhq_lor_dr145_fail();
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!method_exists($dbh, 'mmhq_lor_dr145_native_assert_unique_identity')
			|| true !== $dbh->mmhq_lor_dr145_native_assert_unique_identity(
				$principal,
				$user_id,
				$user->user_email,
				$nicename,
				$require_existing_transaction
			)
		) {
			mmhq_lor_dr145_fail();
		}
		return;
	}
	$transaction_started = false;
	try {
		$connection_id = (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()');
		$in_transaction = mmhq_lor_dr145_native_in_transaction($dbh);
		if ($connection_id < 1 || ($require_existing_transaction && 1 !== $in_transaction)) {
			mmhq_lor_dr145_fail();
		}
		if (!$require_existing_transaction) {
			if (0 !== $in_transaction || 1 !== (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT @@session.autocommit')) {
				mmhq_lor_dr145_fail();
			}
			mmhq_lor_dr145_native_exec($dbh, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
			mmhq_lor_dr145_native_exec($dbh, 'START TRANSACTION');
			$transaction_started = true;
		}
		$login_rows = mmhq_lor_dr145_native_prepared(
			$dbh,
			"SELECT `ID` FROM `{$wpdb->users}` WHERE `user_login` = ? FOR UPDATE",
			's',
			array($login),
			true
		);
		$email_rows = mmhq_lor_dr145_native_prepared(
			$dbh,
			"SELECT `ID` FROM `{$wpdb->users}` WHERE `user_email` = ? FOR UPDATE",
			's',
			array($user->user_email),
			true
		);
		$nicename_rows = 'student' === $principal
			? mmhq_lor_dr145_native_prepared(
				$dbh,
				"SELECT `ID` FROM `{$wpdb->users}` WHERE `user_nicename` = ? FOR UPDATE",
				's',
				array($nicename),
				true
			)
			: array(array('ID' => $user_id));
		if (
			1 !== count($login_rows)
			|| 1 !== count($email_rows)
			|| 1 !== count($nicename_rows)
			|| $user_id !== (int) ($login_rows[0]['ID'] ?? 0)
			|| $user_id !== (int) ($email_rows[0]['ID'] ?? 0)
			|| $user_id !== (int) ($nicename_rows[0]['ID'] ?? 0)
			|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $connection_id
			|| 1 !== mmhq_lor_dr145_native_in_transaction($dbh)
		) {
			mmhq_lor_dr145_fail();
		}
		if ($transaction_started) {
			mmhq_lor_dr145_native_exec($dbh, 'COMMIT');
			$transaction_started = false;
		}
	} catch (Throwable $error) {
		if ($transaction_started) {
			try {
				@mysqli_query($dbh, 'ROLLBACK');
			} catch (Throwable $rollback_error) {
			}
		}
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_db_begin() {
	global $wpdb;
	if (
		!is_object($wpdb)
		|| !method_exists($wpdb, 'query')
		|| !method_exists($wpdb, 'get_var')
		|| isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])
	) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_assert_core_wpdb_runtime();
	mmhq_lor_dr145_db_freeze_reconnect();
	$dbh = mmhq_lor_dr145_native_dbh();
	if (
		0 !== mmhq_lor_dr145_native_in_transaction($dbh)
		|| false === $wpdb->query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')
		|| false === $wpdb->query('START TRANSACTION')
	) {
		mmhq_lor_dr145_fail();
	}
	$connection_id = $wpdb->get_var('SELECT CONNECTION_ID()');
	$native_connection_id = mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()');
	if ((int) $connection_id < 1 || (int) $native_connection_id !== (int) $connection_id) {
		mmhq_lor_dr145_fail();
	}
	$GLOBALS['mmhq_lor_dr145_transaction_connection_id'] = (int) $connection_id;
	$GLOBALS['mmhq_lor_dr145_transaction_dbh_object_id'] = spl_object_id($dbh);
	mmhq_lor_dr145_db_assert_active();
}

function mmhq_lor_dr145_db_commit() {
	global $wpdb;
	mmhq_lor_dr145_db_assert_active();
	$connection_id = $GLOBALS['mmhq_lor_dr145_transaction_connection_id'];
	$dbh_object_id = $GLOBALS['mmhq_lor_dr145_transaction_dbh_object_id'] ?? null;
	if (!is_object($wpdb) || !method_exists($wpdb, 'query') || false === $wpdb->query('COMMIT')) {
		mmhq_lor_dr145_fail();
	}
	unset($GLOBALS['mmhq_lor_dr145_transaction_connection_id']);
	unset($GLOBALS['mmhq_lor_dr145_transaction_dbh_object_id']);
	$dbh = mmhq_lor_dr145_native_dbh();
	if (
		!is_int($dbh_object_id)
		|| spl_object_id($dbh) !== $dbh_object_id
		|| (int) $wpdb->get_var('SELECT CONNECTION_ID()') !== $connection_id
		|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $connection_id
		|| 0 !== mmhq_lor_dr145_native_in_transaction($dbh)
	) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_db_restore_reconnect();
}

function mmhq_lor_dr145_db_rollback() {
	global $wpdb;
	mmhq_lor_dr145_db_assert_active();
	$connection_id = $GLOBALS['mmhq_lor_dr145_transaction_connection_id'];
	$dbh_object_id = $GLOBALS['mmhq_lor_dr145_transaction_dbh_object_id'] ?? null;
	if (!is_object($wpdb) || !method_exists($wpdb, 'query') || false === $wpdb->query('ROLLBACK')) {
		mmhq_lor_dr145_fail();
	}
	unset($GLOBALS['mmhq_lor_dr145_transaction_connection_id']);
	unset($GLOBALS['mmhq_lor_dr145_transaction_dbh_object_id']);
	$dbh = mmhq_lor_dr145_native_dbh();
	if (
		!is_int($dbh_object_id)
		|| spl_object_id($dbh) !== $dbh_object_id
		|| (int) $wpdb->get_var('SELECT CONNECTION_ID()') !== $connection_id
		|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $connection_id
		|| 0 !== mmhq_lor_dr145_native_in_transaction($dbh)
	) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_db_restore_reconnect();
}

function mmhq_lor_dr145_preflight_scalar($query, $numeric) {
	global $wpdb;
	if (!is_string($query) || '' === $query || !is_bool($numeric) || !isset($wpdb->last_error) || '' !== $wpdb->last_error) {
		mmhq_lor_dr145_fail();
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	$dbh_object_id = spl_object_id($dbh);
	$connection_id = (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()');
	$value = $wpdb->get_var($query);
	if (
		'' !== $wpdb->last_error
		|| spl_object_id(mmhq_lor_dr145_native_dbh()) !== $dbh_object_id
		|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $connection_id
	) {
		mmhq_lor_dr145_fail();
	}
	if ($numeric) {
		if (!(is_int($value) || (is_string($value) && 1 === preg_match('/^[0-9]+$/D', $value)))) {
			mmhq_lor_dr145_fail();
		}
		return (int) $value;
	}
	if (!is_string($value) || '' === $value) {
		mmhq_lor_dr145_fail();
	}
	return $value;
}

function mmhq_lor_dr145_assert_metadata_visibility() {
	global $wpdb;
	$database = mmhq_lor_dr145_preflight_scalar('SELECT DATABASE()', false);
	if (!method_exists($wpdb, 'get_col') || !isset($wpdb->last_error) || '' !== $wpdb->last_error) {
		mmhq_lor_dr145_fail();
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	$dbh_object_id = spl_object_id($dbh);
	$connection_id = (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()');
	$grants = $wpdb->get_col('SHOW GRANTS FOR CURRENT_USER');
	if (
		!is_array($grants)
		|| empty($grants)
		|| '' !== $wpdb->last_error
		|| spl_object_id(mmhq_lor_dr145_native_dbh()) !== $dbh_object_id
		|| (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT CONNECTION_ID()') !== $connection_id
	) {
		mmhq_lor_dr145_fail();
	}
	$required = array('TRIGGER' => false, 'REFERENCES' => false);
	foreach ($grants as $grant) {
		if (!is_string($grant) || 1 !== preg_match('/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/i', $grant, $matches)) {
			continue;
		}
		$scope = str_replace('`', '', trim($matches[2]));
		if ('*.*' !== $scope && $database . '.*' !== $scope) {
			continue;
		}
		$privileges = array_map('trim', explode(',', strtoupper($matches[1])));
		if (in_array('ALL PRIVILEGES', $privileges, true) || in_array('ALL', $privileges, true)) {
			$required['TRIGGER'] = true;
			$required['REFERENCES'] = true;
		}
		foreach (array_keys($required) as $privilege) {
			if (in_array($privilege, $privileges, true)) {
				$required[$privilege] = true;
			}
		}
	}
	if (in_array(false, $required, true)) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_student_transaction_tables() {
	global $wpdb;
	if (
		!defined('WC_VERSION')
		|| !is_string(constant('WC_VERSION'))
		|| '10.6.1' !== constant('WC_VERSION')
		|| !isset($wpdb->prefix, $wpdb->options, $wpdb->posts, $wpdb->postmeta)
		|| !is_string($wpdb->prefix)
		|| !is_string($wpdb->options)
		|| !is_string($wpdb->posts)
		|| !is_string($wpdb->postmeta)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->prefix)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->options)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->posts)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->postmeta)
		|| !class_exists('Automattic\\WooCommerce\\Utilities\\OrderUtil')
		|| !method_exists('Automattic\\WooCommerce\\Utilities\\OrderUtil', 'custom_orders_table_usage_is_enabled')
	) {
		mmhq_lor_dr145_fail();
	}
	foreach (array(
		'pre_option_woocommerce_custom_orders_table_enabled',
		'option_woocommerce_custom_orders_table_enabled',
	) as $hook) {
		if (false !== has_filter($hook)) {
			mmhq_lor_dr145_fail();
		}
	}
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (!method_exists($wpdb, 'mmhq_lor_dr145_hpos_data_store_topology_is_canonical')
			|| true !== $wpdb->mmhq_lor_dr145_hpos_data_store_topology_is_canonical()) {
			mmhq_lor_dr145_fail();
		}
	} else {
		$hook = $GLOBALS['wp_filter']['woocommerce_order_data_store'] ?? null;
		$callbacks = is_object($hook) && isset($hook->callbacks) && is_array($hook->callbacks)
			? $hook->callbacks
			: null;
		$entries = array();
		if (is_array($callbacks)) {
			foreach ($callbacks as $priority => $priority_callbacks) {
				if (!is_int($priority) || !is_array($priority_callbacks)) {
					mmhq_lor_dr145_fail();
				}
				foreach ($priority_callbacks as $entry) {
					$entries[] = array('priority' => $priority, 'entry' => $entry);
				}
			}
		}
		$entry = 1 === count($entries) ? $entries[0] : null;
		$callback = is_array($entry) && is_array($entry['entry'] ?? null)
			? ($entry['entry']['function'] ?? null)
			: null;
		if (
			!is_array($entry)
			|| 999 !== ($entry['priority'] ?? null)
			|| 1 !== ($entry['entry']['accepted_args'] ?? null)
			|| !is_array($callback)
			|| 2 !== count($callback)
			|| !is_object($callback[0])
			|| 'Automattic\\WooCommerce\\Internal\\DataStores\\Orders\\CustomOrdersTableController' !== get_class($callback[0])
			|| 'get_orders_data_store' !== $callback[1]
		) {
			mmhq_lor_dr145_fail();
		}
	}
	if (!defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (!defined('WP_PLUGIN_DIR') || !is_string(WP_PLUGIN_DIR)) {
			mmhq_lor_dr145_fail();
		}
		$woocommerce_root = realpath(rtrim(WP_PLUGIN_DIR, '/\\') . '/woocommerce');
		if (!is_string($woocommerce_root)) {
			mmhq_lor_dr145_fail();
		}
		foreach (array(
			array('Automattic\\WooCommerce\\Utilities\\OrderUtil', 'custom_orders_table_usage_is_enabled'),
			array('Automattic\\WooCommerce\\Internal\\DataStores\\Orders\\CustomOrdersTableController', 'get_orders_data_store'),
		) as $method_spec) {
			$method = new ReflectionMethod($method_spec[0], $method_spec[1]);
			$method_path = $method->getFileName();
			$method_real_path = is_string($method_path) ? realpath($method_path) : false;
			if (!is_string($method_real_path) || !mmhq_lor_dr145_is_within($method_real_path, $woocommerce_root)) {
				mmhq_lor_dr145_fail();
			}
		}
	}
	$option_query = "SELECT option_value FROM `{$wpdb->options}` WHERE option_name = 'woocommerce_custom_orders_table_enabled'";
	if (
		!is_string($option_query)
		|| 'yes' !== mmhq_lor_dr145_preflight_scalar($option_query, false)
		|| true !== Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled()
	) {
		mmhq_lor_dr145_fail();
	}
	$orders_table = $wpdb->prefix . 'wc_orders';
	$addresses_table = $wpdb->prefix . 'wc_order_addresses';
	$address_email_index = $wpdb->prepare(
		'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND SEQ_IN_INDEX = 1',
		$addresses_table,
		'email'
	);
	$address_email_collation = $wpdb->prepare(
		"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND RIGHT(LOWER(COLLATION_NAME), 3) = '_ci'",
		$addresses_table,
		'email'
	);
	$order_customer_index = $wpdb->prepare(
		'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND SEQ_IN_INDEX = 1',
		$orders_table,
		'customer_id'
	);
	$order_email_index = $wpdb->prepare(
		'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND SEQ_IN_INDEX = 1',
		$orders_table,
		'billing_email'
	);
	$order_email_collation = $wpdb->prepare(
		"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND RIGHT(LOWER(COLLATION_NAME), 3) = '_ci'",
		$orders_table,
		'billing_email'
	);
	$legacy_meta_index = $wpdb->prepare(
		'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND SEQ_IN_INDEX = 1',
		$wpdb->postmeta,
		'meta_key'
	);
	$legacy_meta_collation = $wpdb->prepare(
		"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND RIGHT(LOWER(COLLATION_NAME), 3) = '_ci'",
		$wpdb->postmeta,
		'meta_value'
	);
	if (
		!is_string($address_email_index)
		|| !is_string($address_email_collation)
		|| !is_string($order_customer_index)
		|| !is_string($order_email_index)
		|| !is_string($order_email_collation)
		|| !is_string($legacy_meta_index)
		|| !is_string($legacy_meta_collation)
		|| mmhq_lor_dr145_preflight_scalar($address_email_index, true) < 1
		|| 1 !== mmhq_lor_dr145_preflight_scalar($address_email_collation, true)
		|| mmhq_lor_dr145_preflight_scalar($order_customer_index, true) < 1
		|| mmhq_lor_dr145_preflight_scalar($order_email_index, true) < 1
		|| 1 !== mmhq_lor_dr145_preflight_scalar($order_email_collation, true)
		|| mmhq_lor_dr145_preflight_scalar($legacy_meta_index, true) < 1
		|| 1 !== mmhq_lor_dr145_preflight_scalar($legacy_meta_collation, true)
	) {
		mmhq_lor_dr145_fail();
	}
	return array(
		$wpdb->options,
		$orders_table,
		$addresses_table,
		$wpdb->prefix . 'wc_order_operational_data',
		$wpdb->prefix . 'wc_orders_meta',
		$wpdb->prefix . 'woocommerce_order_items',
		$wpdb->prefix . 'woocommerce_order_itemmeta',
		$wpdb->posts,
		$wpdb->postmeta,
	);
}

function mmhq_lor_dr145_assert_hpos_mode_locked($dbh) {
	global $wpdb;
	if (!isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])) {
		mmhq_lor_dr145_fail();
	}
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!is_object($dbh)
			|| !method_exists($dbh, 'mmhq_lor_dr145_native_assert_hpos_mode_locked')
			|| true !== $dbh->mmhq_lor_dr145_native_assert_hpos_mode_locked()
		) {
			mmhq_lor_dr145_fail();
		}
		mmhq_lor_dr145_db_assert_active();
		return;
	}
	$rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `option_name`,`option_value` FROM `{$wpdb->options}` WHERE `option_name` = ? FOR UPDATE",
		's',
		array('woocommerce_custom_orders_table_enabled'),
		true
	);
	if (
		1 !== count($rows)
		|| 'woocommerce_custom_orders_table_enabled' !== ($rows[0]['option_name'] ?? null)
		|| 'yes' !== ($rows[0]['option_value'] ?? null)
	) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_db_assert_active();
}

function mmhq_lor_dr145_assert_no_legacy_commerce_preflight($user, $email) {
	global $wpdb;
	if (
		!is_object($user)
		|| !isset($user->ID, $user->user_email)
		|| !is_string($user->user_email)
		|| !is_string($email)
		|| !hash_equals(strtolower($email), strtolower($user->user_email))
		|| isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])
	) {
		mmhq_lor_dr145_fail();
	}
	$user_id = (int) $user->ID;
	if ($user_id < 1) {
		mmhq_lor_dr145_fail();
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!method_exists($dbh, 'mmhq_lor_dr145_native_assert_no_legacy_commerce')
			|| true !== $dbh->mmhq_lor_dr145_native_assert_no_legacy_commerce($user_id, $email)
		) {
			mmhq_lor_dr145_fail();
		}
		return;
	}
	if (
		1 !== (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT @@session.autocommit')
		|| 0 !== mmhq_lor_dr145_native_in_transaction($dbh)
	) {
		mmhq_lor_dr145_fail();
	}
	$legacy_email_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `pm`.`post_id` FROM `{$wpdb->postmeta}` AS `pm` INNER JOIN `{$wpdb->posts}` AS `p` ON `p`.`ID` = `pm`.`post_id` WHERE `pm`.`meta_key` = ? AND `pm`.`meta_value` = ? AND `p`.`post_type` IN ('shop_order','shop_order_refund','shop_order_placehold') LIMIT 1",
		'ss',
		array('_billing_email', $email),
		true
	);
	$legacy_customer_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `pm`.`post_id` FROM `{$wpdb->postmeta}` AS `pm` INNER JOIN `{$wpdb->posts}` AS `p` ON `p`.`ID` = `pm`.`post_id` WHERE `pm`.`meta_key` = ? AND `pm`.`meta_value` = ? AND `p`.`post_type` IN ('shop_order','shop_order_refund','shop_order_placehold') LIMIT 1",
		'ss',
		array('_customer_user', (string) $user_id),
		true
	);
	if (!empty($legacy_email_rows) || !empty($legacy_customer_rows)) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_assert_no_commerce_email_preflight($email) {
	global $wpdb;
	if (
		!is_string($email)
		|| false === is_email($email)
		|| isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])
	) {
		mmhq_lor_dr145_fail();
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!method_exists($dbh, 'mmhq_lor_dr145_native_assert_no_commerce_email')
			|| true !== $dbh->mmhq_lor_dr145_native_assert_no_commerce_email($email)
		) {
			mmhq_lor_dr145_fail();
		}
		return;
	}
	if (
		1 !== (int) mmhq_lor_dr145_native_scalar($dbh, 'SELECT @@session.autocommit')
		|| 0 !== mmhq_lor_dr145_native_in_transaction($dbh)
	) {
		mmhq_lor_dr145_fail();
	}
	$orders_table = $wpdb->prefix . 'wc_orders';
	$addresses_table = $wpdb->prefix . 'wc_order_addresses';
	$order_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `id` FROM `{$orders_table}` WHERE `billing_email` = ? LIMIT 1",
		's',
		array($email),
		true
	);
	$address_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `id` FROM `{$addresses_table}` WHERE `email` = ? AND `address_type` = ? LIMIT 1",
		'ss',
		array($email, 'billing'),
		true
	);
	$legacy_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `pm`.`post_id` FROM `{$wpdb->postmeta}` AS `pm` INNER JOIN `{$wpdb->posts}` AS `p` ON `p`.`ID` = `pm`.`post_id` WHERE `pm`.`meta_key` = ? AND `pm`.`meta_value` = ? AND `p`.`post_type` IN ('shop_order','shop_order_refund','shop_order_placehold') LIMIT 1",
		'ss',
		array('_billing_email', $email),
		true
	);
	if (!empty($order_rows) || !empty($address_rows) || !empty($legacy_rows)) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_assert_no_hpos_commerce($user, $email) {
	global $wpdb;
	if (
		!is_object($user)
		|| !isset($user->ID, $user->user_email)
		|| !is_string($user->user_email)
		|| !is_string($email)
		|| !hash_equals(strtolower($email), strtolower($user->user_email))
		|| !isset($GLOBALS['mmhq_lor_dr145_transaction_connection_id'])
	) {
		mmhq_lor_dr145_fail();
	}
	$user_id = (int) $user->ID;
	if ($user_id < 1) {
		mmhq_lor_dr145_fail();
	}
	$dbh = mmhq_lor_dr145_native_dbh();
	mmhq_lor_dr145_assert_hpos_mode_locked($dbh);
	if (defined('MMHQ_LOR_DR145_TEST_HARNESS')) {
		if (
			!method_exists($dbh, 'mmhq_lor_dr145_native_assert_no_hpos_commerce')
			|| true !== $dbh->mmhq_lor_dr145_native_assert_no_hpos_commerce($user_id, $email)
		) {
			mmhq_lor_dr145_fail();
		}
		mmhq_lor_dr145_db_assert_active();
		return;
	}
	$orders_table = $wpdb->prefix . 'wc_orders';
	$addresses_table = $wpdb->prefix . 'wc_order_addresses';
	$order_email_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `id` FROM `{$orders_table}` WHERE `billing_email` = ? LIMIT 1 FOR UPDATE",
		's',
		array($email),
		true
	);
	$customer_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `id` FROM `{$orders_table}` WHERE `customer_id` = ? LIMIT 1 FOR UPDATE",
		'i',
		array($user_id),
		true
	);
	$email_rows = mmhq_lor_dr145_native_prepared(
		$dbh,
		"SELECT `id` FROM `{$addresses_table}` WHERE `email` = ? AND `address_type` = ? LIMIT 1 FOR UPDATE",
		'ss',
		array($email, 'billing'),
		true
	);
	if (
		!empty($email_rows)
		|| !empty($order_email_rows)
		|| !empty($customer_rows)
	) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_db_assert_active();
}

function mmhq_lor_dr145_expected_transaction_tables($principal) {
	global $wpdb;
	if (!in_array($principal, array('founder', 'student'), true)) {
		mmhq_lor_dr145_fail();
	}
	$tables = array($wpdb->users, $wpdb->usermeta);
	if ('student' === $principal) {
		$tables = array_merge($tables, array(
			$wpdb->options,
			$wpdb->prefix . 'wc_orders',
			$wpdb->prefix . 'wc_order_addresses',
			$wpdb->prefix . 'wc_order_operational_data',
			$wpdb->prefix . 'wc_orders_meta',
			$wpdb->prefix . 'woocommerce_order_items',
			$wpdb->prefix . 'woocommerce_order_itemmeta',
			$wpdb->posts,
			$wpdb->postmeta,
		));
	}
	foreach ($tables as $table) {
		if (!is_string($table) || 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $table)) {
			mmhq_lor_dr145_fail();
		}
	}
	if (count($tables) !== count(array_unique($tables))) {
		mmhq_lor_dr145_fail();
	}
	return $tables;
}

function mmhq_lor_dr145_assert_transaction_schema_locked($principal) {
	$tables = mmhq_lor_dr145_expected_transaction_tables($principal);
	$dbh = mmhq_lor_dr145_native_dbh();
	mmhq_lor_dr145_native_assert_table_contract($dbh, $tables);
	mmhq_lor_dr145_db_assert_active();
}

function mmhq_lor_dr145_assert_transactional_runtime($principal) {
	global $wpdb;
	mmhq_lor_dr145_assert_core_wpdb_runtime();
	mmhq_lor_dr145_assert_core_password_runtime();
	if (
		true === wp_using_ext_object_cache()
		|| !isset($GLOBALS['wp_version'])
		|| !is_string($GLOBALS['wp_version'])
		|| '7.1' !== $GLOBALS['wp_version']
		|| !defined('LEARNDASH_VERSION')
		|| '5.0.4' !== constant('LEARNDASH_VERSION')
		|| !defined('LEARNDASH_TRANSIENTS_DISABLED')
		|| true !== constant('LEARNDASH_TRANSIENTS_DISABLED')
		|| !is_object($wpdb)
		|| !method_exists($wpdb, 'prepare')
		|| !method_exists($wpdb, 'get_var')
		|| !method_exists($wpdb, 'get_col')
		|| !isset($wpdb->last_error)
		|| '' !== $wpdb->last_error
		|| !isset($wpdb->users, $wpdb->usermeta)
		|| !is_string($wpdb->users)
		|| !is_string($wpdb->usermeta)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->users)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->usermeta)
	) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_assert_metadata_visibility();
	$transaction_tables = mmhq_lor_dr145_expected_transaction_tables($principal);
	if ('student' === $principal) {
		$validated_student_tables = mmhq_lor_dr145_student_transaction_tables();
		if (array_slice($transaction_tables, 2) !== $validated_student_tables) {
			mmhq_lor_dr145_fail();
		}
	}
	foreach ($transaction_tables as $table) {
		$query = $wpdb->prepare(
			'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s',
			$table
		);
		$engine = is_string($query) ? mmhq_lor_dr145_preflight_scalar($query, false) : null;
		if (!is_string($engine) || 'innodb' !== strtolower($engine)) {
			mmhq_lor_dr145_fail();
		}
	}
	$index_query = $wpdb->prepare(
		'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s AND SEQ_IN_INDEX = 1',
		$wpdb->usermeta,
		'user_id'
	);
	$identity_index_query = $wpdb->prepare(
		'SELECT COUNT(DISTINCT COLUMN_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME IN (%s, %s, %s) AND SEQ_IN_INDEX = 1',
		$wpdb->users,
		'user_login',
		'user_email',
		'user_nicename'
	);
	$identity_collation_query = $wpdb->prepare(
		"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME IN (%s, %s, %s) AND RIGHT(LOWER(COLLATION_NAME), 3) = '_ci'",
		$wpdb->users,
		'user_login',
		'user_email',
		'user_nicename'
	);
	if (
		!is_string($index_query)
		|| !is_string($identity_index_query)
		|| !is_string($identity_collation_query)
		|| mmhq_lor_dr145_preflight_scalar($index_query, true) < 1
		|| 3 !== mmhq_lor_dr145_preflight_scalar($identity_index_query, true)
		|| 3 !== mmhq_lor_dr145_preflight_scalar($identity_collation_query, true)
	) {
		mmhq_lor_dr145_fail();
	}
	foreach ($transaction_tables as $table) {
		$trigger_query = $wpdb->prepare(
			'SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = %s',
			$table
		);
		$foreign_key_query = $wpdb->prepare(
			'SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA IS NOT NULL AND ((TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s) OR (REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = %s))',
			$table,
			$table
		);
		if (
			!is_string($trigger_query)
			|| !is_string($foreign_key_query)
			|| 0 !== mmhq_lor_dr145_preflight_scalar($trigger_query, true)
			|| 0 !== mmhq_lor_dr145_preflight_scalar($foreign_key_query, true)
		) {
			mmhq_lor_dr145_fail();
		}
	}
	$mutation_hooks = array(
		'all', 'query', 'clean_user_cache', 'get_user_metadata', 'update_user_metadata_cache', 'default_user_metadata',
		'check_password', 'wp_hash_password_algorithm', 'wp_hash_password_options', 'is_email',
		'sfwd_lms_has_access',
		'mmhq_cam_restricted',
		'woocommerce_data_stores', 'woocommerce_order_query_args', 'woocommerce_order_query',
		'woocommerce_orders_table_query_clauses', 'woocommerce_order_data_store_cpt_get_orders_query',
		'woocommerce_order_data_store_cpt_query_unsupported_args',
		'woocommerce_orders_table_datastore_get_orders_query',
		'woocommerce_hpos_pre_query', 'woocommerce_orders_table_query_sql', 'woocommerce_orders_table_query_count_sql',
		'woocommerce_orders_table_query_status_union_optimization',
		'woocommerce_order_get_items', 'woocommerce_order_get_status', 'woocommerce_order_get_total_refunded',
		'woocommerce_order_class', 'woocommerce_get_order_item_classname',
		'woocommerce_order_item_product_get_product_id', 'woocommerce_order_item_product_get_variation_id',
		'woocommerce_order_item_get_product_id', 'woocommerce_order_item_get_variation_id',
		'sanitize_email', 'sanitize_key', 'learndash_use_legacy_course_access_list',
		'learndash_get_user_groups_courses_ids', 'learndash_override_course_auto_enroll',
		'learndash_group_course_auto_enroll', 'learndash_user_get_enrolled_courses',
		'ld_course_access_expires_on', 'learndash_process_user_course_access_expire',
		'user_has_cap', 'map_meta_cap',
		'role_has_cap', 'add_user_metadata', 'add_user_meta', 'added_user_meta',
		'delete_user_metadata', 'delete_user_meta', 'deleted_user_meta', 'sanitize_user_meta',
	);
	foreach (array_merge(MMHQ_LOR_DR145_META_KEYS, array('_mmed_program_tier'), MMHQ_LOR_DR145_COURSE_META_KEYS) as $key) {
		$mutation_hooks[] = 'sanitize_user_meta_' . $key;
	}
	foreach ($mutation_hooks as $hook) {
		if (false !== has_filter($hook)) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_db_lock_identity($user_id) {
	global $wpdb;
	if (!is_int($user_id) || $user_id < 1) {
		mmhq_lor_dr145_fail();
	}
	$users_query = $wpdb->prepare("SELECT ID FROM `{$wpdb->users}` WHERE ID = %d FOR UPDATE", $user_id);
	$meta_query = $wpdb->prepare("SELECT umeta_id FROM `{$wpdb->usermeta}` WHERE user_id = %d FOR UPDATE", $user_id);
	if (!is_string($users_query) || !is_string($meta_query) || false === $wpdb->query($users_query) || false === $wpdb->query($meta_query)) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_db_assert_active();
	clean_user_cache($user_id);
}

function mmhq_lor_dr145_consent_version() {
	if (!defined('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION')) {
		mmhq_lor_dr145_fail();
	}
	$version = constant('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION');
	if (!is_string($version) || 1 !== preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/D', $version)) {
		mmhq_lor_dr145_fail();
	}
	return $version;
}

function mmhq_lor_dr145_fresh_user_by_login($login) {
	if (!in_array($login, array('brinyu', 'brinyu_test'), true)) {
		mmhq_lor_dr145_fail();
	}
	wp_cache_delete($login, 'userlogins');
	$user = get_user_by('login', $login);
	if (!is_object($user)) {
		return false;
	}
	if (!isset($user->ID) || (int) $user->ID < 1) {
		mmhq_lor_dr145_fail();
	}
	$user_id = (int) $user->ID;
	clean_user_cache($user_id);
	$user = get_userdata($user_id);
	if (!is_object($user) || !isset($user->ID, $user->user_login) || $user_id !== (int) $user->ID || $login !== $user->user_login) {
		mmhq_lor_dr145_fail();
	}
	return $user;
}

function mmhq_lor_dr145_desired_meta($consent_at, $consent_version = null) {
	if (null === $consent_version) {
		$consent_version = mmhq_lor_dr145_consent_version();
	}
	if (!is_string($consent_version) || 1 !== preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/D', $consent_version)) {
		mmhq_lor_dr145_fail();
	}
	return array(
		'_missionmed_lor_enabled' => '1',
		'_missionmed_lor_revoked_at' => '',
		'_missionmed_lor_canary_enabled' => '1',
		'_missionmed_lor_consent_at' => $consent_at,
		'_missionmed_lor_consent_accepted' => '1',
		'_missionmed_lor_consent_version' => $consent_version,
		'_missionmed_lor_consent_revoked_at' => '',
	);
}

function mmhq_lor_dr145_replace_rows($user_id, $key, $rows) {
	mmhq_lor_dr145_db_assert_active();
	$current = get_user_meta($user_id, $key, false);
	if ($current === $rows) {
		return;
	}
	delete_user_meta($user_id, $key);
	mmhq_lor_dr145_db_assert_active();
	foreach ($rows as $row) {
		if (false === add_user_meta($user_id, $key, $row, false)) {
			mmhq_lor_dr145_fail();
		}
		mmhq_lor_dr145_db_assert_active();
	}
	if (get_user_meta($user_id, $key, false) !== $rows) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_assert_subject($principal, $user) {
	if (!is_object($user) || !isset($user->ID, $user->user_login) || (int) $user->ID < 1) {
		mmhq_lor_dr145_fail();
	}
	$expected_login = 'founder' === $principal ? 'brinyu' : 'brinyu_test';
	if (!is_string($user->user_login) || $expected_login !== $user->user_login) {
		mmhq_lor_dr145_fail();
	}
	return (int) $user->ID;
}

function mmhq_lor_dr145_assert_identity($principal, $user, $email = null) {
	mmhq_lor_dr145_assert_subject($principal, $user);
	$is_admin = true === user_can((int) $user->ID, 'manage_options');
	if ('founder' === $principal) {
		if (
			!$is_admin
			|| !defined('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN')
			|| 'brinyu' !== constant('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN')
		) {
			mmhq_lor_dr145_fail();
		}
	} else {
		$roles = isset($user->roles) && is_array($user->roles) ? array_values($user->roles) : null;
		if ($is_admin || array() !== $roles) {
			mmhq_lor_dr145_fail();
		}
		if (
			null !== $email
			&& (!is_string($email)
				|| !isset($user->user_email)
				|| !is_string($user->user_email)
				|| 0 !== strcasecmp($email, $user->user_email))
		) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_student_origin_password($custody) {
	$base_sha256 = $custody['_baseCustodySha256'] ?? null;
	$pending = $custody['_pendingIdentity'] ?? null;
	$expected_email_sha256 = $custody['expectedEmailSha256'] ?? null;
	if (
		!is_string($base_sha256)
		|| 1 !== preg_match('/^[0-9a-f]{64}$/D', $base_sha256)
		|| !is_array($pending)
		|| !is_string($expected_email_sha256)
		|| 1 !== preg_match('/^[0-9a-f]{64}$/D', $expected_email_sha256)
	) {
		mmhq_lor_dr145_fail();
	}
	if (!defined('AUTH_KEY') || !defined('AUTH_SALT')) {
		mmhq_lor_dr145_fail();
	}
	$auth_key = constant('AUTH_KEY');
	$auth_salt = constant('AUTH_SALT');
	if (
		!is_string($auth_key)
		|| !is_string($auth_salt)
		|| strlen($auth_key) < 32
		|| strlen($auth_salt) < 32
		|| hash_equals($auth_key, $auth_salt)
		|| false !== stripos($auth_key, 'put your unique phrase here')
		|| false !== stripos($auth_salt, 'put your unique phrase here')
	) {
		mmhq_lor_dr145_fail();
	}
	$pending_sha256 = hash('sha256', mmhq_lor_dr145_canonical_json($pending));
	return hash_hmac(
		'sha256',
		"dr145-student-origin-password-v1\0" . $base_sha256 . "\0" . $pending_sha256 . "\0" . $expected_email_sha256,
		$auth_key . "\0" . $auth_salt
	);
}

function mmhq_lor_dr145_assert_core_password_runtime() {
	if (isset($GLOBALS['wp_hasher']) && null !== $GLOBALS['wp_hasher']) {
		mmhq_lor_dr145_fail();
	}
	foreach (array('all', 'check_password', 'wp_hash_password_algorithm', 'wp_hash_password_options') as $hook) {
		if (false !== has_filter($hook)) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_assert_pending_student_email($email, $custody) {
	$pending = $custody['_pendingIdentity'] ?? null;
	$expected = $custody['expectedEmailSha256'] ?? null;
	$pending_expected = is_array($pending) ? ($pending['expectedEmailSha256'] ?? null) : null;
	if (
		!is_string($email)
		|| !is_string($expected)
		|| !is_string($pending_expected)
		|| !hash_equals($expected, $pending_expected)
		|| !hash_equals($expected, hash('sha256', "dr145-email-v1\0" . strtolower($email)))
	) {
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_assert_pending_student_identity($user, $email, $custody) {
	mmhq_lor_dr145_assert_pending_student_email($email, $custody);
	mmhq_lor_dr145_assert_identity('student', $user, $email);
	$pending = $custody['_pendingIdentity'] ?? null;
	$roles = isset($user->roles) && is_array($user->roles) ? array_values($user->roles) : null;
	if (
		!is_array($pending)
		|| 'pending' !== ($pending['state'] ?? null)
		|| !is_string($pending['expectedRegisteredAt'] ?? null)
		|| !isset($user->user_registered)
		|| !is_string($user->user_registered)
		|| !hash_equals($pending['expectedRegisteredAt'], $user->user_registered)
		|| !isset($user->user_pass)
		|| !is_string($user->user_pass)
		|| !isset($user->user_nicename)
		|| 'brinyu-test' !== $user->user_nicename
		|| !isset($user->display_name)
		|| 'brinyu_test' !== $user->display_name
		|| !isset($user->user_url)
		|| '' !== $user->user_url
		|| !isset($user->user_activation_key)
		|| '' !== $user->user_activation_key
		|| !isset($user->user_status)
		|| 0 !== (int) $user->user_status
		|| array() !== $roles
	) {
		mmhq_lor_dr145_fail();
	}
	$user_id = (int) $user->ID;
	$origin_password = mmhq_lor_dr145_student_origin_password($custody);
	mmhq_lor_dr145_assert_core_password_runtime();
	$origin_matches = true === wp_check_password($origin_password, $user->user_pass, $user_id);
	mmhq_lor_dr145_assert_core_password_runtime();
	$decoy_matches = true === wp_check_password(
		hash('sha256', "dr145-student-origin-password-decoy-v1\0" . $origin_password),
		$user->user_pass,
		$user_id
	);
	mmhq_lor_dr145_assert_core_password_runtime();
	unset($origin_password);
	if (!$origin_matches || $decoy_matches) {
		mmhq_lor_dr145_fail();
	}
	if (array() !== get_user_meta($user_id)) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_assert_no_extra_lor_meta($user_id);
	foreach (MMHQ_LOR_DR145_META_KEYS as $key) {
		if (array() !== get_user_meta($user_id, $key, false)) {
			mmhq_lor_dr145_fail();
		}
	}
	if (array() !== get_user_meta($user_id, '_mmed_program_tier', false)) {
		mmhq_lor_dr145_fail();
	}
	foreach (MMHQ_LOR_DR145_COURSE_META_KEYS as $key) {
		if (array() !== get_user_meta($user_id, $key, false)) {
			mmhq_lor_dr145_fail();
		}
	}
	$course_facts = mmhq_lor_dr145_student_enrollment_facts($user_id);
	if (
		true === $course_facts['access']
		|| !empty($course_facts['currentCourseIds'])
		|| !empty($course_facts['expiredCourseIds'])
		|| !empty($course_facts['historicalCourseIds'])
		|| true === $course_facts['purchaseMatched']
		|| true === $course_facts['revoked']
		|| '' !== $course_facts['expiresAt']
	) {
		mmhq_lor_dr145_fail();
	}
	return $user_id;
}

function mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody, $require_roles = true, $require_email = true) {
	$before = $custody['before'] ?? null;
	if (!is_array($before) || !is_object($user) || !isset($user->ID)) {
		mmhq_lor_dr145_fail();
	}
	$user_id = (int) $user->ID;
	$bound_user_id = $custody['boundUserId'] ?? null;
	if (!is_int($bound_user_id) || $bound_user_id < 1 || $user_id !== $bound_user_id) {
		mmhq_lor_dr145_fail();
	}
	$roles = isset($user->roles) && is_array($user->roles) ? array_values($user->roles) : array();
	$roles_sha = hash('sha256', "dr145-roles-v1\0" . serialize($roles));
	if ($require_roles && true === ($before['userExisted'] ?? null)) {
		if (!is_string($before['rolesSha256'] ?? null) || !hash_equals($before['rolesSha256'], $roles_sha)) {
			mmhq_lor_dr145_fail();
		}
	} elseif ($require_roles && !empty($roles)) {
		mmhq_lor_dr145_fail();
	}
	$expected_email_sha = $custody['expectedEmailSha256'] ?? null;
	if ($require_email && 'student' === $principal) {
		if (!is_string($expected_email_sha) || !isset($user->user_email) || !is_string($user->user_email)) {
			mmhq_lor_dr145_fail();
		}
		$actual_email_sha = hash('sha256', "dr145-email-v1\0" . strtolower($user->user_email));
		if (!hash_equals($expected_email_sha, $actual_email_sha)) {
			mmhq_lor_dr145_fail();
		}
	} elseif ($require_email && true === ($before['userExisted'] ?? null)) {
		if (!is_string($before['emailSha256'] ?? null) || !isset($user->user_email) || !is_string($user->user_email)) {
			mmhq_lor_dr145_fail();
		}
		$actual_email_sha = hash('sha256', "dr145-email-v1\0" . strtolower($user->user_email));
		if (!hash_equals($before['emailSha256'], $actual_email_sha)) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_assert_postimage($principal, $user, $consent_at, $consent_version) {
	mmhq_lor_dr145_assert_no_extra_lor_meta((int) $user->ID);
	foreach (mmhq_lor_dr145_desired_meta($consent_at, $consent_version) as $key => $value) {
		if (array($value) !== get_user_meta((int) $user->ID, $key, false)) {
			mmhq_lor_dr145_fail();
		}
	}
	if ('student' === $principal) {
		$enrollment_epoch = strtotime($consent_at);
		$enrollment_value = false === $enrollment_epoch ? '' : (string) $enrollment_epoch;
		$facts = mmhq_lor_dr145_student_course_facts((int) $user->ID);
		if (
			array(MMHQ_LOR_DR145_PROGRAM_TIER) !== get_user_meta((int) $user->ID, '_mmed_program_tier', false)
			|| '' === $enrollment_value
			|| array($enrollment_value) !== mmhq_lor_dr145_course_meta_rows((int) $user->ID, 'course_3893_access_from')
			|| array() !== mmhq_lor_dr145_course_meta_rows((int) $user->ID, 'course_3893_access_to')
			|| array($enrollment_value) !== mmhq_lor_dr145_course_meta_rows((int) $user->ID, 'learndash_course_3893_enrolled_at')
			|| true !== $facts['access']
		) {
			mmhq_lor_dr145_fail();
		}
		if (
			array(MMHQ_LOR_DR145_COURSE_ID) !== $facts['currentCourseIds']
			|| !empty($facts['expiredCourseIds'])
			|| array(MMHQ_LOR_DR145_COURSE_ID) !== $facts['historicalCourseIds']
		) {
			mmhq_lor_dr145_fail();
		}
	}
}

function mmhq_lor_dr145_restore($principal, $custody) {
	$login = 'founder' === $principal ? 'brinyu' : 'brinyu_test';
	$user = get_user_by('login', $login);
	if (!is_object($user) || !isset($user->ID) || (int) $user->ID < 1) {
		mmhq_lor_dr145_fail();
	}
	$before = $custody['before'];
	if (!is_int($custody['boundUserId'] ?? null) || (int) $user->ID !== $custody['boundUserId']) {
		mmhq_lor_dr145_fail();
	}
	foreach (MMHQ_LOR_DR145_META_KEYS as $key) {
		mmhq_lor_dr145_replace_rows((int) $user->ID, $key, mmhq_lor_dr145_decode_rows($before['lorMeta'][$key] ?? null));
	}
	if ('student' === $principal) {
		$prior_access = true === ($before['course3893Access'] ?? null);
		foreach (MMHQ_LOR_DR145_COURSE_META_KEYS as $key) {
			mmhq_lor_dr145_replace_rows(
				(int) $user->ID,
				$key,
				mmhq_lor_dr145_decode_rows($before['courseMeta'][$key] ?? null)
			);
		}
		mmhq_lor_dr145_replace_rows((int) $user->ID, '_mmed_program_tier', mmhq_lor_dr145_decode_rows($before['tier'] ?? null));
		if (mmhq_lor_dr145_student_course_facts((int) $user->ID)['access'] !== $prior_access) {
			mmhq_lor_dr145_fail();
		}
		foreach (MMHQ_LOR_DR145_COURSE_META_KEYS as $key) {
			if (get_user_meta((int) $user->ID, $key, false) !== mmhq_lor_dr145_decode_rows($before['courseMeta'][$key] ?? null)) {
				mmhq_lor_dr145_fail();
			}
		}
		if (($before['courseFacts'] ?? null) !== mmhq_lor_dr145_student_course_facts((int) $user->ID)) {
			mmhq_lor_dr145_fail();
		}
	}
	return $user;
}

function mmhq_lor_dr145_compensate_failed_apply($principal, $custody, $email, $consent_at, $consent_version) {
	$login = 'founder' === $principal ? 'brinyu' : 'brinyu_test';
	$user = mmhq_lor_dr145_fresh_user_by_login($login);
	mmhq_lor_dr145_assert_subject($principal, $user);
	mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody, false, true);
	if ('student' === $principal) {
		mmhq_lor_dr145_assert_no_legacy_commerce_preflight($user, $email);
	}
	$transaction_active = false;
	try {
		mmhq_lor_dr145_db_begin();
		$transaction_active = true;
		$user_id = (int) $user->ID;
		mmhq_lor_dr145_db_lock_identity($user_id);
		$user = get_userdata($user_id);
		mmhq_lor_dr145_assert_subject($principal, $user);
		mmhq_lor_dr145_assert_unique_identity($principal, $user, true);
		mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody, false, true);
		if ('student' === $principal) {
			mmhq_lor_dr145_assert_no_hpos_commerce($user, $email);
		}
		mmhq_lor_dr145_assert_transaction_schema_locked($principal);
		mmhq_lor_dr145_assert_postimage($principal, $user, $consent_at, $consent_version);
		$user = mmhq_lor_dr145_restore($principal, $custody);
		if (!mmhq_lor_dr145_matches_before($principal, $user, $custody)) {
			mmhq_lor_dr145_fail();
		}
		mmhq_lor_dr145_db_commit();
		$transaction_active = false;
	} catch (Throwable $error) {
		if ($transaction_active) {
			try {
				mmhq_lor_dr145_db_rollback();
			} catch (Throwable $rollback_error) {
			}
		}
		mmhq_lor_dr145_fail();
	}
}

function mmhq_lor_dr145_matches_before($principal, $user, $custody) {
	$before = $custody['before'] ?? null;
	if (!is_array($before) || !is_object($user) || !isset($user->ID)) {
		return false;
	}
	$user_id = (int) $user->ID;
	try {
		mmhq_lor_dr145_assert_no_extra_lor_meta($user_id);
	} catch (Throwable $error) {
		return false;
	}
	foreach (MMHQ_LOR_DR145_META_KEYS as $key) {
		try {
			$rows = mmhq_lor_dr145_decode_rows($before['lorMeta'][$key] ?? null);
		} catch (Throwable $error) {
			return false;
		}
		if (get_user_meta($user_id, $key, false) !== $rows) {
			return false;
		}
	}
	if ('student' === $principal) {
		try {
			$tier_rows = mmhq_lor_dr145_decode_rows($before['tier'] ?? null);
		} catch (Throwable $error) {
			return false;
		}
		if (
			get_user_meta($user_id, '_mmed_program_tier', false) !== $tier_rows
			|| ($before['courseFacts'] ?? null) !== mmhq_lor_dr145_student_course_facts($user_id)
		) {
			return false;
		}
		foreach (MMHQ_LOR_DR145_COURSE_META_KEYS as $key) {
			try {
				$rows = mmhq_lor_dr145_decode_rows($before['courseMeta'][$key] ?? null);
			} catch (Throwable $error) {
				return false;
			}
			if (get_user_meta($user_id, $key, false) !== $rows) {
				return false;
			}
		}
	}
	return true;
}

function mmhq_lor_dr145_public_snapshot($principal, $user) {
	$snapshot = array('lorMeta' => array());
	foreach (MMHQ_LOR_DR145_META_KEYS as $key) {
		$snapshot['lorMeta'][$key] = mmhq_lor_dr145_public_entry(mmhq_lor_dr145_meta_rows((int) $user->ID, $key));
	}
	if ('student' === $principal) {
		$snapshot['tier'] = mmhq_lor_dr145_public_entry(mmhq_lor_dr145_meta_rows((int) $user->ID, '_mmed_program_tier'));
		$snapshot['course3893Access'] = mmhq_lor_dr145_student_course_facts((int) $user->ID)['access'];
		$snapshot['course3893Expires'] = '' !== mmhq_lor_dr145_student_course_facts((int) $user->ID)['expiresAt'];
		$snapshot['courseMeta'] = array();
		foreach (MMHQ_LOR_DR145_COURSE_META_KEYS as $key) {
			$snapshot['courseMeta'][$key] = mmhq_lor_dr145_public_entry(mmhq_lor_dr145_meta_rows((int) $user->ID, $key));
		}
	}
	return $snapshot;
}

function mmhq_lor_dr145_public_preimage($principal, $before) {
	if (!is_array($before) || !is_array($before['lorMeta'] ?? null)) {
		mmhq_lor_dr145_fail();
	}
	$snapshot = array(
		'userExisted' => true === ($before['userExisted'] ?? null),
		'lorMeta' => array(),
	);
	foreach (MMHQ_LOR_DR145_META_KEYS as $key) {
		$snapshot['lorMeta'][$key] = mmhq_lor_dr145_public_entry($before['lorMeta'][$key] ?? null);
	}
	if ('student' === $principal) {
		$snapshot['tier'] = mmhq_lor_dr145_public_entry($before['tier'] ?? null);
		$snapshot['course3893Access'] = true === (($before['courseFacts']['access'] ?? null));
		$snapshot['course3893Expires'] = '' !== ($before['courseFacts']['expiresAt'] ?? null);
		$snapshot['courseMeta'] = array();
		foreach (MMHQ_LOR_DR145_COURSE_META_KEYS as $key) {
			$snapshot['courseMeta'][$key] = mmhq_lor_dr145_public_entry($before['courseMeta'][$key] ?? null);
		}
	}
	return $snapshot;
}

function mmhq_lor_dr145_execute() {
	if ('cli' !== PHP_SAPI || !defined('WP_CLI') || true !== constant('WP_CLI')) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_required_apis();
	$operation = mmhq_lor_dr145_env('MMHQ_LOR_DR145_OPERATION');
	$principal = mmhq_lor_dr145_env('MMHQ_LOR_DR145_PRINCIPAL');
	if (!in_array($operation, array('apply', 'verify', 'rollback'), true) || !in_array($principal, array('founder', 'student'), true)) {
		mmhq_lor_dr145_fail();
	}
	mmhq_lor_dr145_db_suppress_errors();
	mmhq_lor_dr145_assert_transactional_runtime($principal);
	list($lock, $custody_path) = mmhq_lor_dr145_lock($principal);
	try {
		$expected_sha = mmhq_lor_dr145_env('MMHQ_LOR_DR145_CUSTODY_SHA256');
		$login = 'founder' === $principal ? 'brinyu' : 'brinyu_test';
		$email = null;
		if ('student' === $principal && in_array($operation, array('apply', 'verify'), true)) {
			$email = mmhq_lor_dr145_email_from_private_file(mmhq_lor_dr145_env('MMHQ_LOR_DR145_TEST_EMAIL_FILE'));
		}

		if ('NEW' === $expected_sha && 'apply' !== $operation) {
			mmhq_lor_dr145_fail();
		}

		if ('apply' === $operation && 'NEW' === $expected_sha && false !== mmhq_lor_dr145_fresh_lstat($custody_path)) {
			$custody = mmhq_lor_dr145_read_custody($custody_path, 'NEW', $principal);
			$custody_sha = $custody['_custodySha256'];
			$consent_at = $custody['desiredConsentAt'];
			$consent_version = $custody['desiredConsentVersion'];
		} elseif ('apply' === $operation && 'NEW' === $expected_sha) {
			if (false !== mmhq_lor_dr145_fresh_lstat(mmhq_lor_dr145_bound_identity_path($custody_path))) {
				mmhq_lor_dr145_fail();
			}
			$user = mmhq_lor_dr145_fresh_user_by_login($login);
			if ('student' === $principal && is_object($user)) {
				mmhq_lor_dr145_fail();
			}
			if ('student' === $principal && !is_object($user)) {
				mmhq_lor_dr145_assert_no_commerce_email_preflight($email);
			}
			if (is_object($user)) {
				mmhq_lor_dr145_assert_identity($principal, $user, $email);
				mmhq_lor_dr145_assert_unique_identity($principal, $user, false);
			}
			$before = mmhq_lor_dr145_capture($principal, $user);
			$consent_at = gmdate('c');
			$consent_version = mmhq_lor_dr145_consent_version();
			$custody = array(
				'schemaVersion' => MMHQ_LOR_DR145_CUSTODY_SCHEMA,
				'principal' => $principal,
				'desiredConsentAt' => $consent_at,
				'desiredConsentVersion' => $consent_version,
				'boundUserId' => is_int($before['userId'] ?? null) ? $before['userId'] : null,
				'expectedEmailSha256' => 'student' === $principal
					? hash('sha256', "dr145-email-v1\0" . strtolower($email))
					: null,
				'before' => $before,
				'pendingIdentity' => null,
			);
			if ('student' === $principal && false === $before['userExisted']) {
				$custody['pendingIdentity'] = mmhq_lor_dr145_build_pending_identity($custody);
			}
			$base_custody_sha = mmhq_lor_dr145_write_custody($custody_path, $custody);
			$custody['_baseCustodySha256'] = $base_custody_sha;
			if ('student' === $principal && false === $before['userExisted']) {
				$custody['_pendingIdentity'] = $custody['pendingIdentity'];
				$custody['_identityState'] = 'pending';
				$custody['_custodySha256'] = mmhq_lor_dr145_pending_custody_handle($base_custody_sha);
				$custody_sha = $custody['_custodySha256'];
			} else {
				$custody['_identityState'] = 'bound';
				$custody['_custodySha256'] = $base_custody_sha;
				$custody_sha = $base_custody_sha;
			}
		} else {
			$custody = mmhq_lor_dr145_read_custody($custody_path, $expected_sha, $principal);
			$custody_sha = $custody['_custodySha256'];
			$consent_at = $custody['desiredConsentAt'];
			$consent_version = $custody['desiredConsentVersion'];
		}
		if (false === ($custody['before']['userExisted'] ?? true)) {
			$identity_state = $custody['_identityState'] ?? null;
			if (!in_array($identity_state, array('pending', 'bound'), true)) {
				mmhq_lor_dr145_fail();
			}
			if ('apply' !== $operation && ('bound' !== $identity_state || !hash_equals($expected_sha, $custody_sha))) {
				mmhq_lor_dr145_fail();
			}
		}
		if (in_array($operation, array('apply', 'verify'), true) && mmhq_lor_dr145_consent_version() !== $consent_version) {
			mmhq_lor_dr145_fail();
		}
		$public_preimage = mmhq_lor_dr145_public_preimage($principal, $custody['before']);

		if ('rollback' === $operation) {
			$rollback_user = mmhq_lor_dr145_fresh_user_by_login($login);
			mmhq_lor_dr145_assert_subject($principal, $rollback_user);
			mmhq_lor_dr145_assert_custody_identity($principal, $rollback_user, $custody, false, true);
			if ('student' === $principal) {
				mmhq_lor_dr145_assert_no_legacy_commerce_preflight($rollback_user, $rollback_user->user_email);
			}
			$transaction_active = false;
			try {
				mmhq_lor_dr145_db_begin();
				$transaction_active = true;
				$rollback_user_id = (int) $rollback_user->ID;
				mmhq_lor_dr145_db_lock_identity($rollback_user_id);
				$rollback_user = get_userdata($rollback_user_id);
				mmhq_lor_dr145_assert_subject($principal, $rollback_user);
				mmhq_lor_dr145_assert_unique_identity($principal, $rollback_user, true);
				mmhq_lor_dr145_assert_custody_identity($principal, $rollback_user, $custody, false, true);
				if ('student' === $principal) {
					mmhq_lor_dr145_assert_no_hpos_commerce($rollback_user, $rollback_user->user_email);
				}
				mmhq_lor_dr145_assert_transaction_schema_locked($principal);
				$unrelated_before_operation = mmhq_lor_dr145_unrelated_meta_sha256($principal, (int) $rollback_user->ID);
				if (!mmhq_lor_dr145_matches_before($principal, $rollback_user, $custody)) {
					mmhq_lor_dr145_assert_postimage($principal, $rollback_user, $consent_at, $consent_version);
				}
				$user = mmhq_lor_dr145_restore($principal, $custody);
				if (!mmhq_lor_dr145_matches_before($principal, $user, $custody)) {
					mmhq_lor_dr145_fail();
				}
				mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody, false, false);
				if (!hash_equals($unrelated_before_operation, mmhq_lor_dr145_unrelated_meta_sha256($principal, (int) $user->ID))) {
					mmhq_lor_dr145_fail();
				}
				$postimage = mmhq_lor_dr145_public_snapshot($principal, $user);
				mmhq_lor_dr145_db_commit();
				$transaction_active = false;
			} catch (Throwable $error) {
				if ($transaction_active) {
					try {
						mmhq_lor_dr145_db_rollback();
					} catch (Throwable $rollback_error) {
					}
				}
				mmhq_lor_dr145_fail();
			}
			$status = false === ($custody['before']['userExisted'] ?? true)
				? 'ENTITLEMENT_ROLLBACK_COMPLETE_ACCOUNT_PRESERVED'
				: 'ROLLBACK_COMPLETE';
			return array(
				'schemaVersion' => MMHQ_LOR_DR145_RECEIPT_SCHEMA,
				'operation' => 'rollback',
				'principal' => $principal,
				'status' => $status,
				'custodySha256' => $custody_sha,
				'preimage' => $public_preimage,
				'postimage' => $postimage,
			);
		}

		$user = mmhq_lor_dr145_fresh_user_by_login($login);
		if (
			'apply' === $operation
			&& 'student' === $principal
			&& false === ($custody['before']['userExisted'] ?? true)
			&& 'pending' === ($custody['_identityState'] ?? null)
		) {
			mmhq_lor_dr145_assert_pending_student_email($email, $custody);
			if (!is_object($user)) {
				mmhq_lor_dr145_assert_no_commerce_email_preflight($email);
				$origin_password = mmhq_lor_dr145_student_origin_password($custody);
				mmhq_lor_dr145_assert_core_password_runtime();
				$password_hash = wp_hash_password($origin_password);
				mmhq_lor_dr145_assert_core_password_runtime();
				unset($origin_password);
				$created = mmhq_lor_dr145_insert_inert_student(
					$email,
					$custody['_pendingIdentity']['expectedRegisteredAt'],
					$password_hash
				);
				unset($password_hash);
				$user = get_userdata($created);
			}
			$created_user_id = mmhq_lor_dr145_assert_pending_student_identity($user, $email, $custody);
			mmhq_lor_dr145_assert_unique_identity('student', $user, false);
			$bound_result = mmhq_lor_dr145_bind_created_identity(
				$custody_path,
				$custody,
				$custody['_baseCustodySha256'],
				$created_user_id
			);
			$custody['boundUserId'] = $created_user_id;
			$custody['_identityState'] = 'bound';
			$custody['_custodySha256'] = $bound_result['custodySha256'];
			$custody_sha = $bound_result['custodySha256'];
		}
		mmhq_lor_dr145_assert_identity($principal, $user, $email);
		mmhq_lor_dr145_assert_unique_identity($principal, $user, false);
		mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody);
		if ('student' === $principal) {
			mmhq_lor_dr145_assert_no_legacy_commerce_preflight($user, $email);
		}
		$unrelated_before_operation = mmhq_lor_dr145_unrelated_meta_sha256($principal, (int) $user->ID);

		if ('verify' === $operation) {
			$transaction_active = false;
			try {
				mmhq_lor_dr145_db_begin();
				$transaction_active = true;
				$user_id = (int) $user->ID;
				mmhq_lor_dr145_db_lock_identity($user_id);
				$user = get_userdata($user_id);
				mmhq_lor_dr145_assert_identity($principal, $user, $email);
				mmhq_lor_dr145_assert_unique_identity($principal, $user, true);
				mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody);
				if ('student' === $principal) {
					mmhq_lor_dr145_assert_no_hpos_commerce($user, $email);
				}
				mmhq_lor_dr145_assert_transaction_schema_locked($principal);
				if ('student' === $principal) {
					mmhq_lor_dr145_student_course_facts($user_id);
				}
				$unrelated_before_operation = mmhq_lor_dr145_unrelated_meta_sha256($principal, $user_id);
				mmhq_lor_dr145_assert_postimage($principal, $user, $consent_at, $consent_version);
				mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody);
				if (!hash_equals($unrelated_before_operation, mmhq_lor_dr145_unrelated_meta_sha256($principal, $user_id))) {
					mmhq_lor_dr145_fail();
				}
				$postimage = mmhq_lor_dr145_public_snapshot($principal, $user);
				mmhq_lor_dr145_db_commit();
				$transaction_active = false;
			} catch (Throwable $error) {
				if ($transaction_active) {
					try {
						mmhq_lor_dr145_db_rollback();
					} catch (Throwable $rollback_error) {
					}
				}
				mmhq_lor_dr145_fail();
			}
			mmhq_lor_dr145_assert_live_postimage($principal, $user, $consent_at, $consent_version);
			$status = 'VERIFIED';
		} else {
			$transaction_active = false;
			try {
				mmhq_lor_dr145_db_begin();
				$transaction_active = true;
				$user_id = (int) $user->ID;
				mmhq_lor_dr145_db_lock_identity($user_id);
				$user = get_userdata($user_id);
				mmhq_lor_dr145_assert_identity($principal, $user, $email);
				mmhq_lor_dr145_assert_unique_identity($principal, $user, true);
				mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody);
				if ('student' === $principal) {
					mmhq_lor_dr145_assert_no_hpos_commerce($user, $email);
				}
				mmhq_lor_dr145_assert_transaction_schema_locked($principal);
				if ('student' === $principal) {
					mmhq_lor_dr145_student_course_facts((int) $user->ID);
				}
				$unrelated_before_operation = mmhq_lor_dr145_unrelated_meta_sha256($principal, (int) $user->ID);
				$already_applied = false;
				try {
					mmhq_lor_dr145_assert_postimage($principal, $user, $consent_at, $consent_version);
					$already_applied = true;
				} catch (Throwable $postimage_error) {
					if (!mmhq_lor_dr145_matches_before($principal, $user, $custody)) {
						mmhq_lor_dr145_fail();
					}
				}
				if ($already_applied) {
					mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody);
					if (!hash_equals($unrelated_before_operation, mmhq_lor_dr145_unrelated_meta_sha256($principal, (int) $user->ID))) {
						mmhq_lor_dr145_fail();
					}
					$postimage = mmhq_lor_dr145_public_snapshot($principal, $user);
					mmhq_lor_dr145_db_commit();
					$transaction_active = false;
					try {
						mmhq_lor_dr145_assert_live_postimage($principal, $user, $consent_at, $consent_version);
					} catch (Throwable $live_error) {
						mmhq_lor_dr145_compensate_failed_apply($principal, $custody, $email, $consent_at, $consent_version);
						mmhq_lor_dr145_fail();
					}
					$status = 'ALREADY_APPLIED';
					return array(
						'schemaVersion' => MMHQ_LOR_DR145_RECEIPT_SCHEMA,
						'operation' => $operation,
						'principal' => $principal,
						'status' => $status,
						'custodySha256' => $custody_sha,
						'preimage' => $public_preimage,
						'postimage' => $postimage,
					);
				}
				if ('student' === $principal && false === ($custody['before']['userExisted'] ?? true)) {
					mmhq_lor_dr145_assert_pending_student_identity($user, $email, $custody);
					mmhq_lor_dr145_assert_unique_identity('student', $user, true);
				}
				foreach (mmhq_lor_dr145_desired_meta($consent_at, $consent_version) as $key => $value) {
					mmhq_lor_dr145_replace_rows((int) $user->ID, $key, array($value));
				}
				if ('student' === $principal) {
					mmhq_lor_dr145_replace_rows((int) $user->ID, '_mmed_program_tier', array(MMHQ_LOR_DR145_PROGRAM_TIER));
					if (true !== mmhq_lor_dr145_student_course_facts((int) $user->ID)['access']) {
						$enrollment_epoch = strtotime($consent_at);
						if (false === $enrollment_epoch || $enrollment_epoch < 1) {
							mmhq_lor_dr145_fail();
						}
						$enrollment_value = (string) $enrollment_epoch;
						mmhq_lor_dr145_replace_rows((int) $user->ID, 'course_3893_access_from', array($enrollment_value));
						mmhq_lor_dr145_replace_rows((int) $user->ID, 'course_3893_access_to', array());
						mmhq_lor_dr145_replace_rows((int) $user->ID, 'learndash_course_3893_enrolled_at', array($enrollment_value));
					}
				}
				mmhq_lor_dr145_assert_postimage($principal, $user, $consent_at, $consent_version);
				mmhq_lor_dr145_assert_custody_identity($principal, $user, $custody);
				if (!hash_equals($unrelated_before_operation, mmhq_lor_dr145_unrelated_meta_sha256($principal, (int) $user->ID))) {
					mmhq_lor_dr145_fail();
				}
				$postimage = mmhq_lor_dr145_public_snapshot($principal, $user);
				mmhq_lor_dr145_db_commit();
				$transaction_active = false;
				$status = 'APPLIED';
			} catch (Throwable $error) {
				if ($transaction_active) {
					try {
						mmhq_lor_dr145_db_rollback();
					} catch (Throwable $rollback_error) {
					}
				}
				mmhq_lor_dr145_fail();
			}
			try {
				mmhq_lor_dr145_assert_live_postimage($principal, $user, $consent_at, $consent_version);
			} catch (Throwable $live_error) {
				mmhq_lor_dr145_compensate_failed_apply($principal, $custody, $email, $consent_at, $consent_version);
				mmhq_lor_dr145_fail();
			}
		}

		return array(
			'schemaVersion' => MMHQ_LOR_DR145_RECEIPT_SCHEMA,
			'operation' => $operation,
			'principal' => $principal,
			'status' => $status,
			'custodySha256' => $custody_sha,
			'preimage' => $public_preimage,
			'postimage' => $postimage,
		);
	} finally {
		@flock($lock, LOCK_UN);
		@fclose($lock);
		mmhq_lor_dr145_db_restore_errors();
	}
}

try {
	$mmhq_lor_dr145_receipt = mmhq_lor_dr145_execute();
	if (!mmhq_lor_dr145_write_all(STDOUT, mmhq_lor_dr145_canonical_json($mmhq_lor_dr145_receipt) . "\n")) {
		mmhq_lor_dr145_fail();
	}
} catch (Throwable $mmhq_lor_dr145_error) {
	mmhq_lor_dr145_write_all(STDERR, "DR145_PROVISIONING_FAILED_CLOSED\n");
	exit(1);
}

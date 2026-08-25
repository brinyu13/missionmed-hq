<?php
/**
 * Plugin Name: MissionMed LOR Studio WordPress Contract
 * Description: Feature-controlled one-time bootstrap and signed server-to-server admission for LOR Studio.
 * Version: 1.0.0
 * Author: MissionMed
 *
 * This plugin does not send email, register user metadata, or modify a global
 * auth gate. It stores only short-lived hashed code/non-secret binding/nonce
 * records in exact WordPress transient option rows.
 */

defined('ABSPATH') || exit;

/**
 * The candidate is off unless server configuration supplies the literal
 * boolean true. Strings such as "true" are intentionally not accepted.
 */
function mmhq_lor_studio_contract_enabled() {
	return defined('MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED')
		&& true === constant('MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED');
}

/**
 * Parse a server-owned comma-separated list of positive numeric identifiers.
 * Any malformed entry invalidates the complete configuration.
 */
function mmhq_lor_studio_parse_id_list($raw) {
	if (!is_string($raw) || '' === trim($raw)) {
		return array();
	}

	$identifiers = array();
	foreach (explode(',', $raw) as $item) {
		$item = trim($item);
		if (1 !== preg_match('/^[1-9][0-9]*$/D', $item)) {
			return array();
		}
		$identifier = (int) $item;
		if ((string) $identifier !== $item) {
			return array();
		}
		$identifiers[] = $identifier;
	}

	return array_values(array_unique($identifiers));
}

/**
 * Read the explicitly verified LOR course identifiers from server config.
 * There is deliberately no default, including for historical course 3893.
 */
function mmhq_lor_studio_verified_course_ids() {
	if (!defined('MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS')) {
		return array();
	}

	return mmhq_lor_studio_parse_id_list(
		constant('MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS')
	);
}

/**
 * Parse a server-owned comma-separated list of program tier keys.
 */
function mmhq_lor_studio_parse_tier_list($raw) {
	if (!is_string($raw) || '' === trim($raw)) {
		return array();
	}

	$tiers = array();
	foreach (explode(',', $raw) as $item) {
		$item = trim($item);
		if (1 !== preg_match('/^[a-z0-9][a-z0-9_-]{0,63}$/D', $item)) {
			return array();
		}
		$tiers[] = $item;
	}

	return array_values(array_unique($tiers));
}

/**
 * Read explicitly verified LOR-admitting program tiers from server config.
 */
function mmhq_lor_studio_verified_program_tiers() {
	if (!defined('MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS')) {
		return array();
	}

	return mmhq_lor_studio_parse_tier_list(
		constant('MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS')
	);
}

/**
 * Entitlement evidence is short-lived even when its underlying access has no
 * fixed expiry. Invalid server configuration denies instead of widening it.
 */
function mmhq_lor_studio_entitlement_max_age_seconds() {
	if (!defined('MMHQ_LOR_STUDIO_ENTITLEMENT_MAX_AGE_SECONDS')) {
		return 300;
	}

	$raw = constant('MMHQ_LOR_STUDIO_ENTITLEMENT_MAX_AGE_SECONDS');
	if (!is_int($raw) || $raw < 30 || $raw > 900) {
		return 0;
	}

	return $raw;
}

/**
 * Accept only an explicit ISO-8601 instant.
 */
function mmhq_lor_studio_timestamp_to_epoch($value) {
	if (
		!is_string($value)
		|| 1 !== preg_match(
			'/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/D',
			$value
		)
	) {
		return false;
	}

	$parsed = date_parse($value);
	if (
		!is_array($parsed)
		|| !empty($parsed['warning_count'])
		|| !empty($parsed['error_count'])
	) {
		return false;
	}

	$epoch = strtotime($value);
	return false === $epoch ? false : $epoch;
}

/**
 * Normalize the producer's course list, rejecting partial or malformed input.
 */
function mmhq_lor_studio_normalize_course_ids($course_ids) {
	if (!is_array($course_ids) || empty($course_ids)) {
		return array();
	}

	$normalized = array();
	foreach ($course_ids as $course_id) {
		if (is_int($course_id)) {
			if ($course_id < 1) {
				return array();
			}
			$normalized[] = $course_id;
			continue;
		}

		if (!is_string($course_id) || 1 !== preg_match('/^[1-9][0-9]*$/D', $course_id)) {
			return array();
		}
		$normalized_course_id = (int) $course_id;
		if ((string) $normalized_course_id !== $course_id) {
			return array();
		}
		$normalized[] = $normalized_course_id;
	}

	return array_values(array_unique($normalized));
}

/**
 * Validate the repository-verified CAM producer shape without trusting any
 * browser assertion. The function returns a boolean only, so denial details
 * cannot become a protected evidence oracle.
 */
function mmhq_lor_studio_entitlement_allows(
	$entitlement,
	$expected_subject,
	$now,
	$verified_course_ids,
	$verified_program_tiers,
	$max_age_seconds
) {
	if (
		!is_array($entitlement)
		|| !is_string($expected_subject)
		|| 1 !== preg_match('/^wp:[1-9][0-9]*$/D', $expected_subject)
		|| !is_int($now)
		|| $now < 1
		|| !is_array($verified_course_ids)
		|| empty($verified_course_ids)
		|| !is_array($verified_program_tiers)
		|| empty($verified_program_tiers)
		|| !is_int($max_age_seconds)
		|| $max_age_seconds < 1
	) {
		return false;
	}

	if (
		$expected_subject !== ($entitlement['subject'] ?? null)
		|| 'cam' !== ($entitlement['product'] ?? null)
		|| 'wordpress_learndash_handoff' !== ($entitlement['source'] ?? null)
		|| true !== ($entitlement['verified'] ?? null)
		|| true !== ($entitlement['trusted'] ?? null)
		|| true !== ($entitlement['active'] ?? null)
		|| 'active' !== ($entitlement['status'] ?? null)
		|| false !== ($entitlement['restricted'] ?? null)
		|| false !== ($entitlement['revoked'] ?? null)
		|| true !== ($entitlement['current_access_verified'] ?? null)
		|| true !== ($entitlement['purchase_verified'] ?? null)
	) {
		return false;
	}

	$program_tier = $entitlement['program_tier'] ?? null;
	if (!is_string($program_tier) || !in_array($program_tier, $verified_program_tiers, true)) {
		return false;
	}

	$course_ids = mmhq_lor_studio_normalize_course_ids($entitlement['course_ids'] ?? null);
	if (
		empty($course_ids)
		|| empty(array_intersect($course_ids, $verified_course_ids))
		|| !empty(array_diff($course_ids, $verified_course_ids))
	) {
		return false;
	}

	$evaluated_at = mmhq_lor_studio_timestamp_to_epoch($entitlement['evaluated_at'] ?? null);
	if (false === $evaluated_at || $evaluated_at > $now || ($now - $evaluated_at) > $max_age_seconds) {
		return false;
	}

	$expires_at = $entitlement['expires_at'] ?? null;
	if (!is_string($expires_at)) {
		return false;
	}
	if ('' !== $expires_at) {
		$expires_epoch = mmhq_lor_studio_timestamp_to_epoch($expires_at);
		if (false === $expires_epoch || $expires_epoch <= $now) {
			return false;
		}
	}

	return true;
}

/**
 * LOR-owned gates are read only from private, server-written user metadata.
 * This candidate intentionally registers no metadata or mutation endpoint.
 */
function mmhq_lor_studio_user_gates_allow($user_id, $now) {
	if (!is_int($user_id) || $user_id < 1 || !is_int($now) || !function_exists('get_user_meta')) {
		return false;
	}

	if (!defined('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION')) {
		return false;
	}
	$required_consent_version = constant('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION');
	if (
		!is_string($required_consent_version)
		|| 1 !== preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/D', $required_consent_version)
	) {
		return false;
	}

	if (
		'1' !== get_user_meta($user_id, '_missionmed_lor_enabled', true)
		|| '1' !== get_user_meta($user_id, '_missionmed_lor_canary_enabled', true)
		|| '1' !== get_user_meta($user_id, '_missionmed_lor_consent_accepted', true)
		|| $required_consent_version !== get_user_meta($user_id, '_missionmed_lor_consent_version', true)
		|| '' !== get_user_meta($user_id, '_missionmed_lor_consent_revoked_at', true)
		|| '' !== get_user_meta($user_id, '_missionmed_lor_revoked_at', true)
	) {
		return false;
	}

	$consented_at = mmhq_lor_studio_timestamp_to_epoch(
		get_user_meta($user_id, '_missionmed_lor_consent_at', true)
	);
	return false !== $consented_at && $consented_at <= $now;
}

/**
 * Return one generic denial shape for all unavailable or ineligible states.
 */
function mmhq_lor_studio_contract_denied() {
	return new WP_Error(
		'missionmed_lor_contract_unavailable',
		'LOR Studio access is unavailable.',
		array('status' => 403)
	);
}

/**
 * Build the minimum current-user projection. There is no user-id argument and
 * no role, email, course, consent, purchase, or revocation evidence leaves it.
 */
function mmhq_lor_studio_current_identity_entitlement() {
	if (
		!mmhq_lor_studio_contract_enabled()
		|| !function_exists('wp_get_current_user')
		|| !function_exists('mmhq_cam_build_entitlement')
	) {
		return mmhq_lor_studio_contract_denied();
	}

	$current_user = wp_get_current_user();
	$raw_user_id = is_object($current_user) && isset($current_user->ID)
		? $current_user->ID
		: null;
	return mmhq_lor_studio_identity_entitlement_for_user($raw_user_id);
}

/**
 * Evaluate one server-resolved WordPress subject. The user identifier comes
 * only from the authenticated handoff or an existing server-side binding; no
 * REST body may independently select it.
 */
function mmhq_lor_studio_identity_entitlement_for_user($raw_user_id) {
	if (
		(!is_int($raw_user_id) && (!is_string($raw_user_id) || 1 !== preg_match('/^[1-9][0-9]*$/D', $raw_user_id)))
		|| (int) $raw_user_id < 1
		|| (string) (int) $raw_user_id !== (string) $raw_user_id
	) {
		return mmhq_lor_studio_contract_denied();
	}

	$user_id = (int) $raw_user_id;
	$subject = 'wp:' . $user_id;
	$now = time();
	$verified_course_ids = mmhq_lor_studio_verified_course_ids();
	$verified_program_tiers = mmhq_lor_studio_verified_program_tiers();
	$max_age_seconds = mmhq_lor_studio_entitlement_max_age_seconds();
	if (
		empty($verified_course_ids)
		|| empty($verified_program_tiers)
		|| $max_age_seconds < 1
		|| !mmhq_lor_studio_user_gates_allow($user_id, $now)
	) {
		return mmhq_lor_studio_contract_denied();
	}

	try {
		$entitlement = mmhq_cam_build_entitlement($user_id);
	} catch (Throwable $error) {
		return mmhq_lor_studio_contract_denied();
	}

	if (
		!mmhq_lor_studio_entitlement_allows(
			$entitlement,
			$subject,
			$now,
			$verified_course_ids,
			$verified_program_tiers,
			$max_age_seconds
		)
	) {
		return mmhq_lor_studio_contract_denied();
	}

	return array(
		'contract' => 'missionmed.lor.wordpress-entitlement.v1',
		'subject' => $subject,
		'admitted' => true,
	);
}

/**
 * LOR-only S2S protocol constants. The browser receives a one-time opaque code
 * only; the HQ session retains a non-secret binding id only.
 */
function mmhq_lor_studio_s2s_contract() {
	return array(
		'audience' => 'lor-studio',
		'key_domain' => 'missionmed.lor.s2s.key.v1',
		'request_domain' => 'missionmed.lor.s2s.request.v1',
			'bootstrap_path' => '/wp-json/missionmed/v1/lor-studio/bootstrap/redeem',
			'admission_path' => '/wp-json/missionmed/v1/lor-studio/current-user-admission',
			'revocation_path' => '/wp-json/missionmed/v1/lor-studio/binding/revoke',
		'callback_path' => '/api/lor-studio/auth/callback',
		'epoch' => 'dr133-s2s-v1',
	);
}

function mmhq_lor_studio_has_exact_keys($value, $expected_keys) {
	if (!is_array($value) || count($value) !== count($expected_keys)) {
		return false;
	}
	return empty(array_diff(array_keys($value), $expected_keys))
		&& empty(array_diff($expected_keys, array_keys($value)));
}

function mmhq_lor_studio_s2s_secret() {
	$secret = function_exists('mmhq_handoff_secret')
		? mmhq_handoff_secret()
		: trim((string) getenv('MMHQ_HANDOFF_SECRET'));
	if ('' === $secret && defined('MMHQ_HANDOFF_SECRET')) {
		$secret = trim((string) constant('MMHQ_HANDOFF_SECRET'));
	}
	if (strlen($secret) < 32 || strlen($secret) > 4096 || 1 === preg_match('/[[:cntrl:]]/', $secret)) {
		return '';
	}
	return $secret;
}

function mmhq_lor_studio_base64url($bytes) {
	return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

function mmhq_lor_studio_utc_instant($epoch) {
	return gmdate('Y-m-d\\TH:i:s.000\\Z', $epoch);
}

function mmhq_lor_studio_s2s_denied($status = 403) {
	return new WP_Error(
		'missionmed_lor_contract_unavailable',
		'LOR Studio access is unavailable.',
		array('status' => (int) $status)
	);
}

function mmhq_lor_studio_exact_callback($raw_callback) {
	$callback = is_string($raw_callback) ? trim($raw_callback) : '';
	if ('' === $callback || strlen($callback) > 2048 || esc_url_raw($callback) !== $callback) {
		return '';
	}
	$parts = wp_parse_url($callback);
	$contract = mmhq_lor_studio_s2s_contract();
	if (
		!is_array($parts)
		|| 'https' !== ($parts['scheme'] ?? null)
		|| empty($parts['host'])
		|| isset($parts['user'])
		|| isset($parts['pass'])
		|| (isset($parts['port']) && 443 !== (int) $parts['port'])
		|| $contract['callback_path'] !== ($parts['path'] ?? null)
		|| isset($parts['fragment'])
		|| !isset($parts['query'])
		|| (function_exists('mmhq_handoff_is_allowed_return_url')
			&& !mmhq_handoff_is_allowed_return_url($callback))
	) {
		return '';
	}
	$pairs = explode('&', (string) $parts['query']);
	if (2 !== count($pairs)) {
		return '';
	}
	$query = array();
	foreach ($pairs as $pair) {
		$pieces = explode('=', $pair, 2);
		if (2 !== count($pieces)) {
			return '';
		}
		$key = rawurldecode($pieces[0]);
		$value = rawurldecode($pieces[1]);
		if (array_key_exists($key, $query)) {
			return '';
		}
		$query[$key] = $value;
	}
	if (
		!mmhq_lor_studio_has_exact_keys($query, array('audience', 'state'))
		|| $contract['audience'] !== $query['audience']
		|| 1 !== preg_match('/^[a-f0-9]{64}$/D', $query['state'])
	) {
		return '';
	}
	return $callback;
}

function mmhq_lor_studio_transient_names($namespace, $digest) {
	if (
		!is_string($namespace)
		|| 1 !== preg_match('/^[a-z0-9_]{1,32}$/D', $namespace)
		|| !is_string($digest)
		|| 1 !== preg_match('/^[a-f0-9]{64}$/D', $digest)
	) {
		return array('', '');
	}
	$slug = 'mmhq_lor_' . $namespace . '_' . $digest;
	return array('_transient_' . $slug, '_transient_timeout_' . $slug);
}

function mmhq_lor_studio_direct_option_value($option_name) {
	global $wpdb;
	if (
		!is_string($option_name)
		|| '' === $option_name
		|| !is_object($wpdb)
		|| !isset($wpdb->options)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', (string) $wpdb->options)
		|| !method_exists($wpdb, 'prepare')
		|| !method_exists($wpdb, 'get_var')
	) {
		return false;
	}
	$query = $wpdb->prepare(
		'SELECT option_value FROM ' . $wpdb->options . ' WHERE option_name = %s LIMIT 1',
		$option_name
	);
	$value = $wpdb->get_var($query);
	return is_string($value) && '' !== $value ? $value : false;
}

function mmhq_lor_studio_delete_exact_option($option_name, $expected_value) {
	global $wpdb;
	if (
		!is_string($option_name)
		|| '' === $option_name
		|| !is_string($expected_value)
		|| '' === $expected_value
		|| !is_object($wpdb)
		|| !isset($wpdb->options)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', (string) $wpdb->options)
		|| !method_exists($wpdb, 'prepare')
		|| !method_exists($wpdb, 'query')
	) {
		return false;
	}
	$deleted = $wpdb->query(
		$wpdb->prepare(
			'DELETE FROM ' . $wpdb->options . ' WHERE option_name = %s AND BINARY option_value = BINARY %s',
			$option_name,
			$expected_value
		)
	);
	if (function_exists('wp_cache_delete')) {
		wp_cache_delete($option_name, 'options');
	}
	return 1 === $deleted;
}

function mmhq_lor_studio_delete_exact_timeout_if_value_absent(
	$value_name,
	$timeout_name,
	$expected_timeout
) {
	global $wpdb;
	if (
		!is_string($value_name)
		|| '' === $value_name
		|| !is_string($timeout_name)
		|| '' === $timeout_name
		|| !is_string($expected_timeout)
		|| '' === $expected_timeout
		|| !is_object($wpdb)
		|| !isset($wpdb->options)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', (string) $wpdb->options)
		|| !method_exists($wpdb, 'prepare')
		|| !method_exists($wpdb, 'query')
	) {
		return false;
	}
	$deleted = $wpdb->query(
		$wpdb->prepare(
			'DELETE timeout_row FROM ' . $wpdb->options . ' AS timeout_row '
			. 'LEFT JOIN ' . $wpdb->options . ' AS value_row ON value_row.option_name = %s '
			. 'WHERE timeout_row.option_name = %s '
			. 'AND BINARY timeout_row.option_value = BINARY %s '
			. 'AND value_row.option_name IS NULL',
			$value_name,
			$timeout_name,
			$expected_timeout
		)
	);
	if (function_exists('wp_cache_delete')) {
		wp_cache_delete($timeout_name, 'options');
	}
	return 1 === $deleted;
}

function mmhq_lor_studio_update_exact_option($option_name, $expected_value, $replacement_value) {
	global $wpdb;
	if (
		!is_string($option_name)
		|| '' === $option_name
		|| !is_string($expected_value)
		|| '' === $expected_value
		|| !is_string($replacement_value)
		|| '' === $replacement_value
		|| !is_object($wpdb)
		|| !isset($wpdb->options)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', (string) $wpdb->options)
		|| !method_exists($wpdb, 'prepare')
		|| !method_exists($wpdb, 'query')
	) {
		return false;
	}
	$updated = $wpdb->query(
		$wpdb->prepare(
			'UPDATE ' . $wpdb->options . ' SET option_value = %s WHERE option_name = %s AND BINARY option_value = BINARY %s',
			$replacement_value,
			$option_name,
			$expected_value
		)
	);
	if (function_exists('wp_cache_delete')) {
		wp_cache_delete($option_name, 'options');
	}
	return 1 === $updated;
}

function mmhq_lor_studio_registry_record($entries) {
	return array(
		'contract' => 'missionmed.lor.wordpress-transient-registry.v1',
		'entries' => array_values($entries),
	);
}

function mmhq_lor_studio_storage_envelope($record, $expires_epoch) {
	try {
		$generation = 'lorg1_' . mmhq_lor_studio_base64url(random_bytes(32));
	} catch (Throwable $error) {
		return false;
	}
	if (1 !== preg_match('/^lorg1_[A-Za-z0-9_-]{43}$/D', $generation)) {
		return false;
	}
	return array(
		'contract' => 'missionmed.lor.wordpress-stored-record.v1',
		'generation' => $generation,
		'expiresAt' => $expires_epoch,
		'record' => $record,
	);
}

function mmhq_lor_studio_decode_storage_envelope($raw) {
	$envelope = is_string($raw) ? json_decode($raw, true) : false;
	if (
		!is_array($envelope)
		|| !mmhq_lor_studio_has_exact_keys(
			$envelope,
			array('contract', 'generation', 'expiresAt', 'record')
		)
		|| 'missionmed.lor.wordpress-stored-record.v1' !== $envelope['contract']
		|| 1 !== preg_match('/^lorg1_[A-Za-z0-9_-]{43}$/D', (string) $envelope['generation'])
		|| !is_int($envelope['expiresAt'])
		|| !is_array($envelope['record'])
	) {
		return false;
	}
	return $envelope;
}

function mmhq_lor_studio_registry_name($namespace, $digest) {
	list($value_name, $timeout_name) = mmhq_lor_studio_transient_names($namespace, $digest);
	unset($timeout_name);
	if ('' === $value_name) {
		return '';
	}
	return 'mmhq_lor_transient_registry_v1_' . $namespace . '_' . substr($digest, 0, 2);
}

function mmhq_lor_studio_valid_registry_entry($entry) {
	if (
		!is_array($entry)
		|| !mmhq_lor_studio_has_exact_keys(
			$entry,
			array('valueName', 'timeoutName', 'expiresAt', 'valueHash')
		)
		|| !is_string($entry['valueName'])
		|| !is_string($entry['timeoutName'])
		|| !is_int($entry['expiresAt'])
		|| !is_string($entry['valueHash'])
		|| 1 !== preg_match('/^[a-f0-9]{64}$/D', $entry['valueHash'])
		|| 1 !== preg_match('/^_transient_mmhq_lor_[a-z0-9_]{1,32}_[a-f0-9]{64}$/D', $entry['valueName'])
		|| 1 !== preg_match('/^_transient_timeout_mmhq_lor_[a-z0-9_]{1,32}_[a-f0-9]{64}$/D', $entry['timeoutName'])
	) {
		return false;
	}
	return $entry['timeoutName'] === '_transient_timeout_' . substr($entry['valueName'], strlen('_transient_'));
}

function mmhq_lor_studio_registry_entry_from_pair(
	$value_name,
	$timeout_name,
	$value_raw,
	$timeout_raw
) {
	$envelope = mmhq_lor_studio_decode_storage_envelope($value_raw);
	if (
		false === $envelope
		|| !is_string($timeout_raw)
		|| 1 !== preg_match('/^(?:0|[1-9][0-9]{0,12})$/D', $timeout_raw)
		|| $envelope['expiresAt'] !== (int) $timeout_raw
	) {
		return false;
	}
	$entry = array(
		'valueName' => $value_name,
		'timeoutName' => $timeout_name,
		'expiresAt' => $envelope['expiresAt'],
		'valueHash' => hash('sha256', $value_raw),
	);
	return mmhq_lor_studio_valid_registry_entry($entry) ? $entry : false;
}

function mmhq_lor_studio_register_transient_pair(
	$namespace,
	$digest,
	$value_name,
	$timeout_name,
	$expires_epoch,
	$value_hash
) {
	$registry_name = mmhq_lor_studio_registry_name($namespace, $digest);
	$expected_names = mmhq_lor_studio_transient_names($namespace, $digest);
	$new_entry = array(
		'valueName' => $value_name,
		'timeoutName' => $timeout_name,
		'expiresAt' => $expires_epoch,
		'valueHash' => $value_hash,
	);
	if (
		'' === $registry_name
		|| $expected_names !== array($value_name, $timeout_name)
		|| !mmhq_lor_studio_valid_registry_entry($new_entry)
		|| !function_exists('add_option')
	) {
		return false;
	}
	for ($attempt = 0; $attempt < 8; $attempt++) {
		$raw = mmhq_lor_studio_direct_option_value($registry_name);
		$entries = array();
		if (false !== $raw) {
			$registry = json_decode($raw, true);
			if (
				!is_array($registry)
				|| !mmhq_lor_studio_has_exact_keys($registry, array('contract', 'entries'))
				|| 'missionmed.lor.wordpress-transient-registry.v1' !== $registry['contract']
				|| !is_array($registry['entries'])
			) {
				return false;
			}
			$entries = $registry['entries'];
		}
		$kept = array();
		$seen = array();
		foreach ($entries as $entry) {
			if (!mmhq_lor_studio_valid_registry_entry($entry) || isset($seen[$entry['valueName']])) {
				return false;
			}
			$seen[$entry['valueName']] = true;
			if (
				1 !== preg_match(
					'/^_transient_mmhq_lor_([a-z0-9_]{1,32})_([a-f0-9]{64})$/D',
					$entry['valueName'],
					$entry_parts
				)
				|| $registry_name !== mmhq_lor_studio_registry_name($entry_parts[1], $entry_parts[2])
			) {
				return false;
			}
			// The current writer replaces its own prior registry generation only
			// after it has successfully created and finalized the new exact pair.
			if ($entry['valueName'] === $value_name) {
				continue;
			}
			$value_raw = mmhq_lor_studio_direct_option_value($entry['valueName']);
			$timeout_raw = mmhq_lor_studio_direct_option_value($entry['timeoutName']);
			$value_matches = false !== $value_raw
				&& hash_equals($entry['valueHash'], hash('sha256', $value_raw));
			$timeout_matches = false !== $timeout_raw
				&& hash_equals((string) $entry['expiresAt'], $timeout_raw);
			if ($entry['expiresAt'] <= time()) {
				if ($value_matches && $timeout_matches) {
					if (!mmhq_lor_studio_delete_exact_pair_values(
						$entry['valueName'],
						$value_raw,
						$entry['timeoutName'],
						$timeout_raw
					)) {
						return false;
					}
					continue;
				}
				if (false === $value_raw && false === $timeout_raw) {
					continue;
				}
				// A newly recreated generation can be finalized before its registry
				// CAS. Adopt that exact envelope rather than deleting it through an
				// expired predecessor entry.
				$current_entry = mmhq_lor_studio_registry_entry_from_pair(
					$entry['valueName'],
					$entry['timeoutName'],
					$value_raw,
					$timeout_raw
				);
				if (false !== $current_entry) {
					$kept[] = $current_entry;
					continue;
				}
				// A claim sentinel is an in-flight or recoverable generation. Never
				// let a stale registry row delete or rewrite its ownership token.
				if (false !== mmhq_lor_studio_claim_started_at($timeout_raw)) {
					$kept[] = $entry;
					continue;
				}
				if (false === $value_raw) {
					if (!mmhq_lor_studio_delete_exact_timeout_if_value_absent(
						$entry['valueName'],
						$entry['timeoutName'],
						$timeout_raw
					)) {
						return false;
					}
					continue;
				}
				if (false === $timeout_raw) {
					if (!mmhq_lor_studio_delete_exact_option($entry['valueName'], $value_raw)) {
						return false;
					}
					continue;
				}
				return false;
			}
			if (false === $value_raw && false === $timeout_raw) {
				continue;
			}
			// Every writer owns timeout first, so either orphan half is stable
			// against a legitimate concurrent writer until its exact CAS cleanup.
			if (false === $value_raw) {
				if (false !== mmhq_lor_studio_claim_started_at($timeout_raw)) {
					$kept[] = $entry;
					continue;
				}
				if (!mmhq_lor_studio_delete_exact_timeout_if_value_absent(
					$entry['valueName'],
					$entry['timeoutName'],
					$timeout_raw
				)) {
					return false;
				}
				continue;
			}
			if (false === $timeout_raw) {
				if (!mmhq_lor_studio_delete_exact_option($entry['valueName'], $value_raw)) {
					return false;
				}
				continue;
			}
			if ($value_matches && $timeout_matches) {
				$kept[] = $entry;
				continue;
			}
			$current_entry = mmhq_lor_studio_registry_entry_from_pair(
				$entry['valueName'],
				$entry['timeoutName'],
				$value_raw,
				$timeout_raw
			);
			if (false !== $current_entry) {
				$kept[] = $current_entry;
				continue;
			}
			if (false !== mmhq_lor_studio_claim_started_at($timeout_raw)) {
				$kept[] = $entry;
				continue;
			}
			return false;
		}
		if (count($kept) >= 1024) {
			return false;
		}
		$kept[] = $new_entry;
		$replacement = wp_json_encode(mmhq_lor_studio_registry_record($kept));
		if (!is_string($replacement) || '' === $replacement) {
			return false;
		}
		if (false === $raw) {
			if (add_option($registry_name, $replacement, '', false)) {
				return true;
			}
		} elseif (mmhq_lor_studio_update_exact_option($registry_name, $raw, $replacement)) {
			return true;
		}
	}
	return false;
}

function mmhq_lor_studio_delete_exact_pair_values(
	$value_name,
	$expected_value,
	$timeout_name,
	$expected_timeout
) {
	global $wpdb;
	if (
		!is_string($value_name)
		|| '' === $value_name
		|| !is_string($expected_value)
		|| '' === $expected_value
		|| !is_string($timeout_name)
		|| '' === $timeout_name
		|| !is_string($expected_timeout)
		|| '' === $expected_timeout
		|| !is_object($wpdb)
		|| !isset($wpdb->options)
		|| 1 !== preg_match('/^[A-Za-z0-9_]+$/D', (string) $wpdb->options)
		|| !method_exists($wpdb, 'prepare')
		|| !method_exists($wpdb, 'query')
	) {
		return false;
	}
	$deleted = $wpdb->query(
		$wpdb->prepare(
			'DELETE value_row, timeout_row FROM ' . $wpdb->options . ' AS value_row '
			. 'INNER JOIN ' . $wpdb->options . ' AS timeout_row '
			. 'ON timeout_row.option_name = %s AND BINARY timeout_row.option_value = BINARY %s '
			. 'WHERE value_row.option_name = %s AND BINARY value_row.option_value = BINARY %s',
			$timeout_name,
			$expected_timeout,
			$value_name,
			$expected_value
		)
	);
	if (function_exists('wp_cache_delete')) {
		wp_cache_delete($value_name, 'options');
		wp_cache_delete($timeout_name, 'options');
	}
	return 2 === $deleted;
}

function mmhq_lor_studio_delete_exact_pair($namespace, $digest, $expected_value) {
	list($value_name, $timeout_name) = mmhq_lor_studio_transient_names($namespace, $digest);
	$timeout_raw = mmhq_lor_studio_direct_option_value($timeout_name);
	return false !== $timeout_raw && mmhq_lor_studio_delete_exact_pair_values(
		$value_name,
		$expected_value,
		$timeout_name,
		$timeout_raw
	);
}

function mmhq_lor_studio_claim_timeout_value($issued_epoch) {
	if (!is_int($issued_epoch) || $issued_epoch < 1000000000 || $issued_epoch > 9999999999) {
		return false;
	}
	try {
		$owner = random_int(0, 99999999);
	} catch (Throwable $error) {
		return false;
	}
	return '8' . str_pad((string) $issued_epoch, 10, '0', STR_PAD_LEFT)
		. str_pad((string) $owner, 8, '0', STR_PAD_LEFT);
}

function mmhq_lor_studio_claim_started_at($raw_timeout) {
	if (!is_string($raw_timeout) || 1 !== preg_match('/^8([0-9]{10})[0-9]{8}$/D', $raw_timeout, $parts)) {
		return false;
	}
	$started_at = (int) $parts[1];
	return $started_at > 0 ? $started_at : false;
}

function mmhq_lor_studio_prepare_transient_slot($namespace, $digest) {
	list($value_name, $timeout_name) = mmhq_lor_studio_transient_names($namespace, $digest);
	if ('' === $value_name) {
		return false;
	}
	$value_raw = mmhq_lor_studio_direct_option_value($value_name);
	$timeout_raw = mmhq_lor_studio_direct_option_value($timeout_name);
	if (false === $value_raw && false === $timeout_raw) {
		return true;
	}
	$claim_started_at = mmhq_lor_studio_claim_started_at($timeout_raw);
	if (false !== $claim_started_at) {
		if ($claim_started_at > time() || time() - $claim_started_at <= 30) {
			return false;
		}
		return false === $value_raw
			? mmhq_lor_studio_delete_exact_timeout_if_value_absent(
				$value_name,
				$timeout_name,
				$timeout_raw
			)
			: mmhq_lor_studio_delete_exact_pair_values(
				$value_name,
				$value_raw,
				$timeout_name,
				$timeout_raw
			);
	}
	// Every live writer uses the claim sentinel above. A normal timeout without
	// a value is therefore an interrupted exact-pair deletion, not an in-flight
	// write, and can be healed without racing a live owner.
	if (false === $value_raw) {
		return mmhq_lor_studio_delete_exact_timeout_if_value_absent(
			$value_name,
			$timeout_name,
			$timeout_raw
		);
	}
	if (
		false === $timeout_raw
		|| 1 !== preg_match('/^(?:0|[1-9][0-9]{0,12})$/D', $timeout_raw)
		|| (int) $timeout_raw > time()
	) {
		return false;
	}
	return mmhq_lor_studio_delete_exact_pair_values(
		$value_name,
		$value_raw,
		$timeout_name,
		$timeout_raw
	);
}

function mmhq_lor_studio_store_once($namespace, $digest, $record, $expires_epoch, &$stored_raw = null) {
	$stored_raw = '';
	if (
		!function_exists('add_option')
		|| !is_array($record)
		|| !is_int($expires_epoch)
		|| $expires_epoch <= time()
	) {
		return false;
	}
	list($value_name, $timeout_name) = mmhq_lor_studio_transient_names($namespace, $digest);
	$envelope = mmhq_lor_studio_storage_envelope($record, $expires_epoch);
	$json = false === $envelope ? false : wp_json_encode($envelope);
	if ('' === $value_name || !is_string($json) || '' === $json) {
		return false;
	}
	$value_hash = hash('sha256', $json);
	if (!mmhq_lor_studio_prepare_transient_slot($namespace, $digest)) {
		return false;
	}
	$claim_timeout = mmhq_lor_studio_claim_timeout_value(time());
	if (false === $claim_timeout || !add_option($timeout_name, $claim_timeout, '', false)) {
		return false;
	}
	if (!add_option($value_name, $json, '', false)) {
		mmhq_lor_studio_delete_exact_timeout_if_value_absent(
			$value_name,
			$timeout_name,
			$claim_timeout
		);
		return false;
	}
	if (!mmhq_lor_studio_update_exact_option($timeout_name, $claim_timeout, (string) $expires_epoch)) {
		mmhq_lor_studio_delete_exact_option($value_name, $json);
		mmhq_lor_studio_delete_exact_timeout_if_value_absent(
			$value_name,
			$timeout_name,
			$claim_timeout
		);
		return false;
	}
	if (!mmhq_lor_studio_register_transient_pair(
		$namespace,
		$digest,
		$value_name,
		$timeout_name,
		$expires_epoch,
		$value_hash
	)) {
		mmhq_lor_studio_delete_exact_pair($namespace, $digest, $json);
		return false;
	}
	$stored_raw = $json;
	return true;
}

function mmhq_lor_studio_read_record_by_digest($namespace, $digest) {
	list($value_name, $timeout_name) = mmhq_lor_studio_transient_names($namespace, $digest);
	$raw = mmhq_lor_studio_direct_option_value($value_name);
	$timeout_raw = mmhq_lor_studio_direct_option_value($timeout_name);
	if (false === $raw || false === $timeout_raw) {
		return array(false, '', '', '', '');
	}
	if (
		false !== mmhq_lor_studio_claim_started_at($timeout_raw)
		|| 1 !== preg_match('/^(?:0|[1-9][0-9]{0,12})$/D', $timeout_raw)
		|| (int) $timeout_raw <= time()
	) {
		return array(false, '', '', '', '');
	}
	$envelope = mmhq_lor_studio_decode_storage_envelope($raw);
	return false !== $envelope && $envelope['expiresAt'] === (int) $timeout_raw
		? array($envelope['record'], $value_name, $raw, $timeout_name, $timeout_raw)
		: array(false, '', '', '', '');
}

function mmhq_lor_studio_read_record($namespace, $opaque_value) {
	return mmhq_lor_studio_read_record_by_digest($namespace, hash('sha256', (string) $opaque_value));
}

function mmhq_lor_studio_receipt($subject, $binding_expires_at) {
	$now = time();
	$expires = min($now + 300, (int) $binding_expires_at);
	if ($expires <= $now) {
		return false;
	}
	return array(
		'contract' => 'missionmed.lor.wordpress-admission.v2',
		'subject' => $subject,
		'admitted' => true,
		'evaluatedAt' => mmhq_lor_studio_utc_instant($now),
		'expiresAt' => mmhq_lor_studio_utc_instant($expires),
	);
}

function mmhq_lor_studio_binding_index_valid($record, $binding_id) {
	$contract = mmhq_lor_studio_s2s_contract();
	return is_array($record)
		&& mmhq_lor_studio_has_exact_keys($record, array('contract', 'bindingId', 'expiresAt', 'epoch'))
		&& 'missionmed.lor.wordpress-subject-binding.v1' === $record['contract']
		&& $binding_id === $record['bindingId']
		&& 1 === preg_match('/^lorb1_[A-Za-z0-9_-]{43}$/D', $binding_id)
		&& is_int($record['expiresAt'])
		&& $record['expiresAt'] > time()
		&& $contract['epoch'] === $record['epoch'];
}

function mmhq_lor_studio_get_or_create_subject_binding($subject, $binding_expires) {
	$contract = mmhq_lor_studio_s2s_contract();
	$subject_digest = hash('sha256', $subject);
	for ($attempt = 0; $attempt < 4; $attempt++) {
		list($index, $index_name, $index_raw) = mmhq_lor_studio_read_record_by_digest(
			'binding_subject_v1',
			$subject_digest
		);
		if (is_array($index)) {
			$indexed_binding = isset($index['bindingId']) && is_string($index['bindingId'])
				? $index['bindingId']
				: '';
			if (mmhq_lor_studio_binding_index_valid($index, $indexed_binding)) {
				list($binding_record) = mmhq_lor_studio_read_record('binding_v1', $indexed_binding);
				if (mmhq_lor_studio_validate_binding_record($binding_record, $indexed_binding, $subject)) {
					return array($indexed_binding, $binding_record, false, '');
				}
			}
			if (!mmhq_lor_studio_delete_exact_pair('binding_subject_v1', $subject_digest, $index_raw)) {
				return false;
			}
			if (1 === preg_match('/^lorb1_[A-Za-z0-9_-]{43}$/D', $indexed_binding)) {
				list($stale_binding, $stale_name, $stale_raw) = mmhq_lor_studio_read_record('binding_v1', $indexed_binding);
				if (is_array($stale_binding)) {
					mmhq_lor_studio_delete_exact_pair('binding_v1', hash('sha256', $indexed_binding), $stale_raw);
				}
			}
		}
		try {
			$binding_id = 'lorb1_' . mmhq_lor_studio_base64url(random_bytes(32));
		} catch (Throwable $error) {
			return false;
		}
		if (1 !== preg_match('/^lorb1_[A-Za-z0-9_-]{43}$/D', $binding_id)) {
			return false;
		}
		$binding_record = array(
			'contract' => 'missionmed.lor.wordpress-binding.v1',
			'subject' => $subject,
			'audience' => $contract['audience'],
			'issuedAt' => time(),
			'expiresAt' => $binding_expires,
			'epoch' => $contract['epoch'],
		);
		$binding_digest = hash('sha256', $binding_id);
		$binding_raw = '';
		if (!mmhq_lor_studio_store_once(
			'binding_v1',
			$binding_digest,
			$binding_record,
			$binding_expires,
			$binding_raw
		)) {
			return false;
		}
		$index_record = array(
			'contract' => 'missionmed.lor.wordpress-subject-binding.v1',
			'bindingId' => $binding_id,
			'expiresAt' => $binding_expires,
			'epoch' => $contract['epoch'],
		);
		if (mmhq_lor_studio_store_once('binding_subject_v1', $subject_digest, $index_record, $binding_expires)) {
			return array($binding_id, $binding_record, true, $binding_raw);
		}
		mmhq_lor_studio_delete_exact_pair('binding_v1', $binding_digest, $binding_raw);
	}
	return false;
}

/**
 * Called only by the exact LOR branch of the authenticated WordPress handoff.
 */
function mmhq_lor_studio_issue_browser_bootstrap_code($wp_user, $raw_callback) {
	if (
		!mmhq_lor_studio_contract_enabled()
		|| '' === mmhq_lor_studio_s2s_secret()
		|| !is_object($wp_user)
		|| !isset($wp_user->ID)
	) {
		return mmhq_lor_studio_s2s_denied(503);
	}
	$callback = mmhq_lor_studio_exact_callback($raw_callback);
	$projection = mmhq_lor_studio_identity_entitlement_for_user($wp_user->ID);
	if ('' === $callback || is_wp_error($projection)) {
		return mmhq_lor_studio_s2s_denied();
	}
	$callback_query = array();
	parse_str((string) wp_parse_url($callback, PHP_URL_QUERY), $callback_query);
	$contract = mmhq_lor_studio_s2s_contract();
	$now = time();
	$code_expires = $now + 60;
	$binding_expires = $now + 8 * 60 * 60;
	$issue_digest = hash('sha256', $projection['subject']);
	$issue_record = array(
		'contract' => 'missionmed.lor.wordpress-bootstrap-issue-window.v1',
		'issuedAt' => $now,
		'expiresAt' => $code_expires,
		'epoch' => $contract['epoch'],
	);
	$issue_raw = '';
	if (!mmhq_lor_studio_store_once(
		'issue_v1',
		$issue_digest,
		$issue_record,
		$code_expires,
		$issue_raw
	)) {
		return mmhq_lor_studio_s2s_denied(503);
	}
	try {
		$code = 'lorc1_' . mmhq_lor_studio_base64url(random_bytes(32));
	} catch (Throwable $error) {
		mmhq_lor_studio_delete_exact_pair('issue_v1', $issue_digest, $issue_raw);
		return mmhq_lor_studio_s2s_denied(503);
	}
	if (
		1 !== preg_match('/^lorc1_[A-Za-z0-9_-]{43}$/D', $code)
	) {
		mmhq_lor_studio_delete_exact_pair('issue_v1', $issue_digest, $issue_raw);
		return mmhq_lor_studio_s2s_denied(503);
	}
	$binding_result = mmhq_lor_studio_get_or_create_subject_binding($projection['subject'], $binding_expires);
	if (!is_array($binding_result) || 4 !== count($binding_result)) {
		mmhq_lor_studio_delete_exact_pair('issue_v1', $issue_digest, $issue_raw);
		return mmhq_lor_studio_s2s_denied(503);
	}
	list($binding_id, $binding_record, $binding_created, $binding_raw) = $binding_result;
	$binding_expires = $binding_record['expiresAt'];
	$code_record = array(
		'contract' => 'missionmed.lor.wordpress-bootstrap-code.v1',
		'subject' => $projection['subject'],
		'audience' => $contract['audience'],
		'callback' => $callback,
		'stateHash' => $callback_query['state'],
		'bindingId' => $binding_id,
		'bindingExpiresAt' => $binding_expires,
		'issuedAt' => $now,
		'expiresAt' => $code_expires,
		'epoch' => $contract['epoch'],
	);
	$binding_digest = hash('sha256', $binding_id);
	$code_digest = hash('sha256', $code);
	if (!mmhq_lor_studio_store_once('code_v1', $code_digest, $code_record, $code_expires)) {
		if ($binding_created) {
			mmhq_lor_studio_delete_exact_pair('binding_v1', $binding_digest, $binding_raw);
			list($index_record, $index_name, $index_raw) = mmhq_lor_studio_read_record_by_digest('binding_subject_v1', $issue_digest);
			if (is_array($index_record) && $index_record['bindingId'] === $binding_id) {
				mmhq_lor_studio_delete_exact_pair('binding_subject_v1', $issue_digest, $index_raw);
			}
		}
		mmhq_lor_studio_delete_exact_pair('issue_v1', $issue_digest, $issue_raw);
		return mmhq_lor_studio_s2s_denied(503);
	}
	return array('code' => $code, 'callback' => $callback);
}

function mmhq_lor_studio_verify_s2s_request($request, $expected_path) {
	$contract = mmhq_lor_studio_s2s_contract();
	if (
		!is_object($request)
		|| !method_exists($request, 'get_method')
		|| !method_exists($request, 'get_route')
		|| !method_exists($request, 'get_body')
		|| !method_exists($request, 'get_header')
		|| 'POST' !== $request->get_method()
		|| $expected_path !== '/wp-json' . $request->get_route()
	) {
		return false;
	}
	$secret = mmhq_lor_studio_s2s_secret();
	$timestamp = (string) $request->get_header('X-MissionMed-LOR-S2S-Timestamp');
	$nonce = (string) $request->get_header('X-MissionMed-LOR-S2S-Nonce');
	$audience = (string) $request->get_header('X-MissionMed-LOR-S2S-Audience');
	$signature = (string) $request->get_header('X-MissionMed-LOR-S2S-Signature');
	$body = (string) $request->get_body();
	if (
		'' === $secret
		|| 1 !== preg_match('/^(?:0|[1-9][0-9]{0,12})$/D', $timestamp)
		|| abs(time() - (int) $timestamp) > 30
		|| 1 !== preg_match('/^lorn1_[A-Za-z0-9_-]{43}$/D', $nonce)
		|| $contract['audience'] !== $audience
		|| strlen($body) < 2
		|| strlen($body) > 4096
	) {
		return false;
	}
	$canonical = implode("\n", array(
		$contract['request_domain'],
		'POST',
		$expected_path,
		hash('sha256', $body),
		$timestamp,
		$nonce,
		$contract['audience'],
	));
	$key = hash_hmac('sha256', $contract['key_domain'], $secret, true);
	$expected_signature = 'v1=' . hash_hmac('sha256', $canonical, $key);
	if (!hash_equals($expected_signature, $signature)) {
		return false;
	}
	$request_hash = hash('sha256', $canonical);
	$nonce_record = array(
		'contract' => 'missionmed.lor.wordpress-s2s-nonce.v1',
		'requestHash' => $request_hash,
		'issuedAt' => time(),
		'expiresAt' => time() + 90,
		'epoch' => $contract['epoch'],
	);
	if (!mmhq_lor_studio_store_once('nonce_v1', hash('sha256', $nonce), $nonce_record, time() + 90)) {
		return false;
	}
	$decoded = json_decode($body, true);
	return is_array($decoded) ? $decoded : false;
}

function mmhq_lor_studio_validate_binding_record($record, $binding_id, $subject = '') {
	$contract = mmhq_lor_studio_s2s_contract();
	return is_array($record)
		&& mmhq_lor_studio_has_exact_keys(
			$record,
			array('contract', 'subject', 'audience', 'issuedAt', 'expiresAt', 'epoch')
		)
		&& 'missionmed.lor.wordpress-binding.v1' === $record['contract']
		&& 1 === preg_match('/^wp:[1-9][0-9]*$/D', (string) $record['subject'])
		&& ('' === $subject || $subject === $record['subject'])
		&& 1 === preg_match('/^lorb1_[A-Za-z0-9_-]{43}$/D', $binding_id)
		&& $contract['audience'] === $record['audience']
		&& is_int($record['issuedAt'])
		&& is_int($record['expiresAt'])
		&& $record['issuedAt'] <= time()
		&& $record['expiresAt'] > time()
		&& $contract['epoch'] === $record['epoch'];
}

function mmhq_lor_studio_bootstrap_redeem($request) {
	$contract = mmhq_lor_studio_s2s_contract();
	$body = mmhq_lor_studio_verify_s2s_request($request, $contract['bootstrap_path']);
	if (
		false === $body
		|| !mmhq_lor_studio_has_exact_keys(
			$body,
			array('contract', 'audience', 'code', 'stateHash', 'callback')
		)
		|| 'missionmed.lor.wordpress-bootstrap-redemption-request.v1' !== $body['contract']
		|| $contract['audience'] !== $body['audience']
		|| 1 !== preg_match('/^lorc1_[A-Za-z0-9_-]{43}$/D', (string) $body['code'])
		|| 1 !== preg_match('/^[a-f0-9]{64}$/D', (string) $body['stateHash'])
		|| mmhq_lor_studio_exact_callback($body['callback']) !== $body['callback']
	) {
		return mmhq_lor_studio_s2s_denied();
	}
	list($code_record, $code_name, $code_raw) = mmhq_lor_studio_read_record('code_v1', $body['code']);
	$expected_code_keys = array(
		'contract', 'subject', 'audience', 'callback', 'stateHash', 'bindingId',
		'bindingExpiresAt', 'issuedAt', 'expiresAt', 'epoch',
	);
	if (
		!is_array($code_record)
		|| !mmhq_lor_studio_has_exact_keys($code_record, $expected_code_keys)
		|| 'missionmed.lor.wordpress-bootstrap-code.v1' !== $code_record['contract']
		|| $body['audience'] !== $code_record['audience']
		|| $body['callback'] !== $code_record['callback']
		|| $body['stateHash'] !== $code_record['stateHash']
		|| !is_int($code_record['issuedAt'])
		|| !is_int($code_record['expiresAt'])
		|| $code_record['issuedAt'] > time()
		|| $code_record['expiresAt'] <= time()
		|| $code_record['expiresAt'] - $code_record['issuedAt'] > 60
		|| $contract['epoch'] !== $code_record['epoch']
	) {
		return mmhq_lor_studio_s2s_denied();
	}
	list($binding_record) = mmhq_lor_studio_read_record('binding_v1', $code_record['bindingId']);
	if (
		!mmhq_lor_studio_validate_binding_record(
			$binding_record,
			$code_record['bindingId'],
			$code_record['subject']
		)
		|| $binding_record['expiresAt'] !== $code_record['bindingExpiresAt']
		|| is_wp_error(mmhq_lor_studio_identity_entitlement_for_user(substr($code_record['subject'], 3)))
		|| !mmhq_lor_studio_delete_exact_pair('code_v1', hash('sha256', $body['code']), $code_raw)
	) {
		return mmhq_lor_studio_s2s_denied();
	}
	$receipt = mmhq_lor_studio_receipt($code_record['subject'], $binding_record['expiresAt']);
	if (false === $receipt) {
		return mmhq_lor_studio_s2s_denied();
	}
	return rest_ensure_response(array(
		'contract' => 'missionmed.lor.wordpress-bootstrap-redemption.v1',
		'audience' => $contract['audience'],
		'subject' => $code_record['subject'],
		'bindingId' => $code_record['bindingId'],
		'bindingExpiresAt' => mmhq_lor_studio_utc_instant($binding_record['expiresAt']),
		'receipt' => $receipt,
	));
}

function mmhq_lor_studio_current_user_admission($request) {
	$contract = mmhq_lor_studio_s2s_contract();
	$body = mmhq_lor_studio_verify_s2s_request($request, $contract['admission_path']);
	if (
		false === $body
		|| !mmhq_lor_studio_has_exact_keys(
			$body,
			array('contract', 'audience', 'bindingId', 'subject')
		)
		|| 'missionmed.lor.wordpress-admission-request.v1' !== $body['contract']
		|| $contract['audience'] !== $body['audience']
		|| 1 !== preg_match('/^lorb1_[A-Za-z0-9_-]{43}$/D', (string) $body['bindingId'])
		|| 1 !== preg_match('/^wp:[1-9][0-9]*$/D', (string) $body['subject'])
	) {
		return mmhq_lor_studio_s2s_denied();
	}
	list($binding_record) = mmhq_lor_studio_read_record('binding_v1', $body['bindingId']);
	if (
		!mmhq_lor_studio_validate_binding_record($binding_record, $body['bindingId'], $body['subject'])
		|| is_wp_error(mmhq_lor_studio_identity_entitlement_for_user(substr($body['subject'], 3)))
	) {
		return mmhq_lor_studio_s2s_denied();
	}
	$receipt = mmhq_lor_studio_receipt($body['subject'], $binding_record['expiresAt']);
	return false === $receipt ? mmhq_lor_studio_s2s_denied() : rest_ensure_response($receipt);
}

function mmhq_lor_studio_revoke_binding($request) {
	$contract = mmhq_lor_studio_s2s_contract();
	$body = mmhq_lor_studio_verify_s2s_request($request, $contract['revocation_path']);
	if (
		false === $body
		|| !mmhq_lor_studio_has_exact_keys($body, array('contract', 'audience', 'bindingId', 'subject'))
		|| 'missionmed.lor.wordpress-binding-revocation-request.v1' !== $body['contract']
		|| $contract['audience'] !== $body['audience']
		|| 1 !== preg_match('/^lorb1_[A-Za-z0-9_-]{43}$/D', (string) $body['bindingId'])
		|| 1 !== preg_match('/^wp:[1-9][0-9]*$/D', (string) $body['subject'])
	) {
		return mmhq_lor_studio_s2s_denied();
	}
	list($binding_record, $binding_name, $binding_raw) = mmhq_lor_studio_read_record('binding_v1', $body['bindingId']);
	if (
		!mmhq_lor_studio_validate_binding_record($binding_record, $body['bindingId'], $body['subject'])
		|| !mmhq_lor_studio_delete_exact_pair('binding_v1', hash('sha256', $body['bindingId']), $binding_raw)
	) {
		return mmhq_lor_studio_s2s_denied();
	}
	$subject_digest = hash('sha256', $body['subject']);
	list($index_record, $index_name, $index_raw) = mmhq_lor_studio_read_record_by_digest(
		'binding_subject_v1',
		$subject_digest
	);
	if (is_array($index_record) && ($index_record['bindingId'] ?? '') === $body['bindingId']) {
		if (!mmhq_lor_studio_delete_exact_pair('binding_subject_v1', $subject_digest, $index_raw)) {
			list($current_index) = mmhq_lor_studio_read_record_by_digest('binding_subject_v1', $subject_digest);
			if (is_array($current_index) && ($current_index['bindingId'] ?? '') === $body['bindingId']) {
				return mmhq_lor_studio_s2s_denied(503);
			}
		}
	}
	return rest_ensure_response(array(
		'contract' => 'missionmed.lor.wordpress-binding-revocation.v1',
		'audience' => $contract['audience'],
		'subject' => $body['subject'],
		'bindingId' => $body['bindingId'],
		'revoked' => true,
		'revokedAt' => mmhq_lor_studio_utc_instant(time()),
	));
}

function mmhq_lor_studio_no_store_header_value() {
	return 'private, no-store, max-age=0';
}

function mmhq_lor_studio_contract_post_dispatch($response, $server, $request) {
	unset($server);
	$routes = array(
		'/missionmed/v1/lor-studio/bootstrap/redeem',
		'/missionmed/v1/lor-studio/current-user-admission',
		'/missionmed/v1/lor-studio/binding/revoke',
	);
	if (
		!is_object($request)
		|| !method_exists($request, 'get_route')
		|| !in_array($request->get_route(), $routes, true)
	) {
		return $response;
	}
	if (is_wp_error($response)) {
		if (!function_exists('rest_convert_error_to_response')) {
			return $response;
		}
		$response = rest_convert_error_to_response($response);
	} elseif (!is_object($response) || !method_exists($response, 'header')) {
		$response = rest_ensure_response($response);
	}
	if (is_object($response) && method_exists($response, 'header')) {
		$response->header('Cache-Control', mmhq_lor_studio_no_store_header_value());
	}
	return $response;
}

function mmhq_lor_studio_register_rest_contract() {
	if (
		!mmhq_lor_studio_contract_enabled()
		|| !function_exists('register_rest_route')
		|| !function_exists('add_filter')
		|| !function_exists('rest_ensure_response')
		|| !function_exists('rest_convert_error_to_response')
	) {
		return;
	}
	add_filter('rest_post_dispatch', 'mmhq_lor_studio_contract_post_dispatch', 10, 3);
	register_rest_route(
		'missionmed/v1',
		'/lor-studio/bootstrap/redeem',
		array(
			'methods' => 'POST',
			'callback' => 'mmhq_lor_studio_bootstrap_redeem',
			'permission_callback' => '__return_true',
		)
	);
	register_rest_route(
		'missionmed/v1',
		'/lor-studio/current-user-admission',
		array(
			'methods' => 'POST',
			'callback' => 'mmhq_lor_studio_current_user_admission',
			'permission_callback' => '__return_true',
		)
	);
	register_rest_route(
		'missionmed/v1',
		'/lor-studio/binding/revoke',
		array(
			'methods' => 'POST',
			'callback' => 'mmhq_lor_studio_revoke_binding',
			'permission_callback' => '__return_true',
		)
	);
}

add_action('rest_api_init', 'mmhq_lor_studio_register_rest_contract');

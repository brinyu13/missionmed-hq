<?php
/**
 * Plugin Name: MissionMed LOR Studio WordPress Contract Candidate
 * Description: Feature-off, current-user-only identity and entitlement projection for LOR Studio.
 * Version: 0.1.0
 * Author: MissionMed
 *
 * This is an unbound local candidate. It does not create a signed service
 * handoff, send email, register user metadata, or modify any global auth gate.
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
 * Permission is current-session-only. WordPress REST cookie authentication
 * retains its native nonce handling; no global auth filter is changed.
 */
function mmhq_lor_studio_contract_permission() {
	if (
		!mmhq_lor_studio_contract_enabled()
		|| !function_exists('is_user_logged_in')
		|| !is_user_logged_in()
		|| !function_exists('wp_get_current_user')
	) {
		return false;
	}

	$current_user = wp_get_current_user();
	return is_object($current_user) && isset($current_user->ID) && (int) $current_user->ID > 0;
}

/**
 * REST callback ignores the request body, query, and route parameters.
 */
function mmhq_lor_studio_contract_rest_response($request = null) {
	unset($request);
	$projection = mmhq_lor_studio_current_identity_entitlement();
	if (is_wp_error($projection)) {
		return $projection;
	}

	$response = rest_ensure_response($projection);
	if (is_object($response) && method_exists($response, 'header')) {
		$response->header('Cache-Control', mmhq_lor_studio_no_store_header_value());
	}
	return $response;
}

/**
 * Use one exact cache policy for every response from the LOR contract route.
 */
function mmhq_lor_studio_no_store_header_value() {
	return 'private, no-store, max-age=0';
}

/**
 * Enforce no-store after dispatch so callback errors and permission denials
 * receive the same policy as successful responses. Unrelated routes pass
 * through byte-for-byte without added headers.
 */
function mmhq_lor_studio_contract_post_dispatch($response, $server, $request) {
	unset($server);
	if (
		!is_object($request)
		|| !method_exists($request, 'get_route')
		|| '/missionmed/v1/lor-studio/identity-entitlement' !== $request->get_route()
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

/**
 * Register one non-enumerating route only when the server feature flag is on.
 */
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
		'/lor-studio/identity-entitlement',
		array(
			'methods' => 'GET',
			'callback' => 'mmhq_lor_studio_contract_rest_response',
			'permission_callback' => 'mmhq_lor_studio_contract_permission',
		)
	);
}

add_action('rest_api_init', 'mmhq_lor_studio_register_rest_contract');

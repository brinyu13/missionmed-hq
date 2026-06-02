<?php
/**
 * Plugin Name: MissionMed Scheduler Route Proxy
 * Description: Serves MissionMed Scheduler routes from CDN and proxies Scheduler API calls to MissionMed HQ.
 * Author: MissionMed
 * Version: 1.0.11
 *
 * Rollback:
 * - Remove this file from wp-content/mu-plugins, or deactivate/delete the plugin if installed as a standard plugin.
 * - Confirm /schedule, /my-dashboard/schedule, /hq/scheduler, and /hq/scheduler-ops no longer resolve through Scheduler.
 */

if (!defined('ABSPATH')) {
	exit;
}

if (!defined('MM_SCHEDULER_ASSET_URL')) {
	define('MM_SCHEDULER_ASSET_URL', 'https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler_v1.html');
}

if (!defined('MM_SCHEDULER_ADMIN_ASSET_URL')) {
	define('MM_SCHEDULER_ADMIN_ASSET_URL', 'https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler-admin.html');
}

if (!defined('MM_SCHEDULER_API_BASE')) {
	define('MM_SCHEDULER_API_BASE', 'https://missionmed-hq-production.up.railway.app');
}

function mm_scheduler_proxy_path() {
	$request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';
	$path = wp_parse_url($request_uri, PHP_URL_PATH);
	return is_string($path) ? '/' . trim($path, '/') : '';
}

function mm_scheduler_proxy_is_student_route($path) {
	return in_array($path, array('/schedule', '/my-dashboard/schedule'), true);
}

function mm_scheduler_proxy_is_hq_route($path) {
	return in_array($path, array('/hq/scheduler', '/hq/scheduler-ops'), true);
}

function mm_scheduler_proxy_is_scheduler_api_route($path) {
	return 0 === strpos((string) $path, '/api/scheduler/');
}

function mm_scheduler_proxy_is_auth_api_route($path) {
	return in_array((string) $path, array('/api/auth/session', '/api/auth/exchange'), true);
}

function mm_scheduler_proxy_is_scheduler_auth_exchange_request() {
	$value = isset($_GET['mm_scheduler_exchange']) ? (string) wp_unslash($_GET['mm_scheduler_exchange']) : '';
	return '1' === $value;
}

function mm_scheduler_proxy_headers($content_type, $route) {
	if (headers_sent()) {
		return;
	}

	if (!defined('DONOTCACHEPAGE')) {
		define('DONOTCACHEPAGE', true);
	}
	if (!defined('DONOTCACHEOBJECT')) {
		define('DONOTCACHEOBJECT', true);
	}
	if (!defined('DONOTCACHEDB')) {
		define('DONOTCACHEDB', true);
	}

	header('Content-Type: ' . $content_type);
	header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
	header('Pragma: no-cache');
	header('Expires: Wed, 11 Jan 1984 05:00:00 GMT');
	header('X-Content-Type-Options: nosniff');
	header('Referrer-Policy: same-origin');
	header('X-Frame-Options: SAMEORIGIN');
	header('X-MissionMed-Route: ' . $route);
	header('X-MissionMed-Proxy-Version: 1.0.11');
}

function mm_scheduler_rest_permission_current_user() {
	if (is_user_logged_in()) {
		return true;
	}

	return new WP_Error(
		'mm_scheduler_auth_required',
		'Scheduler entitlement facts require an authenticated MissionMed account.',
		array('status' => 401)
	);
}

function mm_scheduler_positive_ints($values) {
	$out = array();
	foreach ((array) $values as $value) {
		$id = absint($value);
		if ($id > 0) {
			$out[$id] = $id;
		}
	}

	return array_values($out);
}

function mm_scheduler_option_id($key, $fallback = 0) {
	if (function_exists('mmed_hub_default_option_value')) {
		$fallback = mmed_hub_default_option_value($key);
	}

	return absint(get_option($key, $fallback));
}

function mm_scheduler_entitlement_course_map() {
	return array(
		'mission_residency_360' => mm_scheduler_option_id('mmed_course_360elite', 3893),
		'match_prep_pro' => mm_scheduler_option_id('mmed_course_complete', 5227),
		'foundation' => mm_scheduler_option_id('mmed_course_foundation', 3646),
		'exam_prep' => mm_scheduler_option_id('mmed_course_usmle', 0),
	);
}

function mm_scheduler_entitlement_product_map() {
	return array(
		'mission_residency_360' => mm_scheduler_option_id('mmed_product_360elite', 3575),
		'match_prep_pro' => mm_scheduler_option_id('mmed_product_complete', 3576),
		'foundation' => mm_scheduler_option_id('mmed_product_foundation', 3577),
		'exam_prep' => 0,
	);
}

function mm_scheduler_get_learndash_course_ids($user_id) {
	if (!function_exists('learndash_user_get_enrolled_courses')) {
		return array();
	}

	$course_ids = learndash_user_get_enrolled_courses((int) $user_id);
	return mm_scheduler_positive_ints(is_array($course_ids) ? $course_ids : array());
}

function mm_scheduler_get_woocommerce_product_ids($user_id) {
	if (!function_exists('wc_get_orders')) {
		return array();
	}

	$orders = wc_get_orders(array(
		'customer_id' => (int) $user_id,
		'status' => array('completed', 'processing'),
		'limit' => 50,
		'return' => 'objects',
	));
	$product_ids = array();
	foreach ((array) $orders as $order) {
		if (!is_object($order) || !method_exists($order, 'get_items')) {
			continue;
		}
		foreach ((array) $order->get_items() as $item) {
			if (is_object($item) && method_exists($item, 'get_product_id')) {
				$product_ids[] = $item->get_product_id();
			}
			if (is_object($item) && method_exists($item, 'get_variation_id')) {
				$product_ids[] = $item->get_variation_id();
			}
		}
	}

	return mm_scheduler_positive_ints($product_ids);
}

function mm_scheduler_normalized_entitlement_labels($course_ids, $product_ids) {
	$course_lookup = array_fill_keys(mm_scheduler_positive_ints($course_ids), true);
	$product_lookup = array_fill_keys(mm_scheduler_positive_ints($product_ids), true);
	$course_map = mm_scheduler_entitlement_course_map();
	$product_map = mm_scheduler_entitlement_product_map();
	$tiers = array();
	$divisions = array('non_member');

	foreach ($course_map as $tier => $id) {
		if ($id > 0 && isset($course_lookup[$id])) {
			$tiers[$tier] = $tier;
		}
	}
	foreach ($product_map as $tier => $id) {
		if ($id > 0 && isset($product_lookup[$id])) {
			$tiers[$tier] = $tier;
		}
	}

	if (isset($tiers['mission_residency_360']) || isset($tiers['match_prep_pro'])) {
		$divisions['mission_residency'] = 'mission_residency';
	}
	if (isset($tiers['exam_prep'])) {
		$divisions['exam_prep'] = 'exam_prep';
	}

	return array(
		'tier_keys' => array_values($tiers),
		'division_keys' => array_values($divisions),
	);
}

function mm_scheduler_rest_entitlements_me(WP_REST_Request $request) {
	$current_user_id = get_current_user_id();
	$requested_user_id = absint($request->get_param('wp_user_id') ?: $request->get_param('user_id'));
	$user_id = $requested_user_id > 0 ? $requested_user_id : $current_user_id;

	if ($user_id <= 0) {
		return new WP_Error(
			'mm_scheduler_auth_required',
			'Scheduler entitlement facts require an authenticated MissionMed account.',
			array('status' => 401)
		);
	}

	if ($requested_user_id > 0 && $requested_user_id !== $current_user_id && !current_user_can('manage_options')) {
		return new WP_Error(
			'mm_scheduler_entitlement_forbidden',
			'Scheduler entitlement lookup is limited to the current account.',
			array('status' => 403)
		);
	}

	$user = get_userdata($user_id);
	if (!$user) {
		return new WP_Error(
			'mm_scheduler_user_not_found',
			'Scheduler entitlement user was not found.',
			array('status' => 404)
		);
	}

	$course_ids = mm_scheduler_get_learndash_course_ids($user_id);
	$product_ids = mm_scheduler_get_woocommerce_product_ids($user_id);
	$labels = mm_scheduler_normalized_entitlement_labels($course_ids, $product_ids);

	return rest_ensure_response(array(
		'ok' => true,
		'wordpress_user_id' => (int) $user_id,
		'user_login' => sanitize_user($user->user_login, true),
		'course_ids' => $course_ids,
		'learndash_course_ids' => $course_ids,
		'product_ids' => $product_ids,
		'woocommerce_product_ids' => $product_ids,
		'tier_keys' => $labels['tier_keys'],
		'division_keys' => $labels['division_keys'],
		'source_flags' => array(
			'learndash_available' => function_exists('learndash_user_get_enrolled_courses'),
			'woocommerce_available' => function_exists('wc_get_orders'),
			'matrix_available' => function_exists('mmed_hub_default_option_value'),
		),
		'mapping' => array(
			'course_ids' => mm_scheduler_entitlement_course_map(),
			'product_ids' => mm_scheduler_entitlement_product_map(),
			'exam_prep_candidate_ids' => array(3651, 3652, 3653, 3655),
			'exam_prep_status' => 'needs_confirmation',
		),
		'checked_at' => gmdate('c'),
	));
}

function mm_scheduler_register_rest_routes() {
	register_rest_route('missionmed-scheduler/v1', '/entitlements/me', array(
		'methods' => WP_REST_Server::READABLE,
		'callback' => 'mm_scheduler_rest_entitlements_me',
		'permission_callback' => 'mm_scheduler_rest_permission_current_user',
	));
}

function mm_scheduler_proxy_login_redirect() {
	$request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/schedule';
	wp_safe_redirect(add_query_arg(
		'redirect_to',
		rawurlencode(home_url($request_uri)),
		home_url('/my-account/')
	));
	exit;
}

function mm_scheduler_proxy_require_admin() {
	if (is_user_logged_in() && current_user_can('manage_options')) {
		return;
	}

	mm_scheduler_proxy_login_redirect();
}

function mm_scheduler_proxy_fetch_html($asset_url) {
	$asset_url = esc_url_raw((string) $asset_url);
	if ('' === $asset_url || false !== strpos($asset_url, 'example.invalid')) {
		status_header(503);
		mm_scheduler_proxy_headers('text/plain; charset=utf-8', 'scheduler-proxy');
		echo 'MissionMed Scheduler asset is not configured.';
		exit;
	}

	$response = wp_remote_get($asset_url, array(
		'timeout' => 15,
		'headers' => array(
			'Accept' => 'text/html',
			'User-Agent' => 'MissionMed-Scheduler-Proxy/1.0 (+https://missionmedinstitute.com/schedule)',
		),
		'redirection' => 2,
	));

	if (is_wp_error($response) || 200 !== (int) wp_remote_retrieve_response_code($response)) {
		status_header(502);
		mm_scheduler_proxy_headers('text/plain; charset=utf-8', 'scheduler-proxy');
		echo 'MissionMed Scheduler asset is unavailable.';
		exit;
	}

	$body = wp_remote_retrieve_body($response);
	return is_string($body) ? $body : '';
}

function mm_scheduler_proxy_rewrite_html($html) {
	$api_base = '/api/scheduler';
	$html = str_replace(
		array(
			'data-api-base="/api/scheduler"',
			'apiBase: "/api/scheduler"',
			"apiBase: '/api/scheduler'",
		),
		array(
			'data-api-base="' . esc_attr($api_base) . '"',
			'apiBase: "' . esc_js($api_base) . '"',
			"apiBase: '" . esc_js($api_base) . "'",
		),
		(string) $html
	);

	$html = str_replace(
		array(
			'fetch("/api/auth/session",',
			"fetch('/api/auth/session',",
		),
		array(
			'fetch("/api/auth/session?mm_scheduler_exchange=1&audience=scheduler",',
			"fetch('/api/auth/session?mm_scheduler_exchange=1&audience=scheduler',",
		),
		$html
	);

	$handoff_script = <<<'HTML'
<script>
(function () {
  var startedKey = "mm_scheduler_auth_handoff_started";
  var consumedKey = "mm_scheduler_auth_handoff_consumed";

  function stripHandoffHash(params) {
    params.delete("mmhq_handoff_token");
    var nextHash = params.toString();
    window.history.replaceState(null, "", window.location.pathname + window.location.search + (nextHash ? "#" + nextHash : ""));
  }

  function consumeHandoffToken() {
    var rawHash = String(window.location.hash || "").replace(/^#/, "");
    if (!rawHash) {
      return false;
    }
    var params = new URLSearchParams(rawHash);
    var token = String(params.get("mmhq_handoff_token") || "").trim();
    if (!token || window.sessionStorage.getItem(consumedKey) === token) {
      return false;
    }

    window.sessionStorage.setItem(consumedKey, token);
    stripHandoffHash(params);

	    fetch("/api/auth/session?mm_scheduler_exchange=1&audience=scheduler&token=" + encodeURIComponent(token), {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (response.ok && payload && payload.authenticated) {
          window.sessionStorage.removeItem(startedKey);
          window.location.reload();
          return;
        }
        window.sessionStorage.removeItem(startedKey);
      });
    }).catch(function () {
      window.sessionStorage.removeItem(startedKey);
    });

    return true;
  }

  window.MMEDSchedulerAuthHandoff = function (payload) {
    if (!payload || payload.authenticated || !payload.login || !payload.login.wordpress_handoff_url) {
      return false;
    }
	    var startedAt = Number(window.sessionStorage.getItem(startedKey) || 0);
	    if (startedAt && Date.now() - startedAt < 30000) {
	      return false;
	    }

    try {
      var handoffUrl = new URL(payload.login.wordpress_handoff_url, window.location.origin);
	      var finalUrl = window.location.href.split("#")[0];
	      var returnTo = new URL(
	        handoffUrl.searchParams.get("return_to") || payload.login.wordpress_hq_entry_url || "/api/auth/session",
	        window.location.origin
	      );
	      returnTo.searchParams.set("audience", "scheduler");
	      returnTo.searchParams.set("final", finalUrl);
	      handoffUrl.searchParams.set("return_to", returnTo.toString());
	      handoffUrl.searchParams.set("final", finalUrl);
	      window.sessionStorage.setItem(startedKey, String(Date.now()));
      window.location.assign(handoffUrl.toString());
      return true;
    } catch (error) {
      return false;
    }
  };

  consumeHandoffToken();
})();
</script>
HTML;

	if (false !== strpos($html, '</head>')) {
		return str_replace('</head>', $handoff_script . "\n</head>", $html);
	}

	return $handoff_script . $html;
}

function mm_scheduler_proxy_forward_headers() {
	$blocked = array('host', 'content-length', 'connection', 'transfer-encoding', 'upgrade');
	$out = array();

	if (function_exists('getallheaders')) {
		$headers = getallheaders();
		if (is_array($headers)) {
			foreach ($headers as $name => $value) {
				$normalized = strtolower(trim((string) $name));
				if ('' === $normalized || in_array($normalized, $blocked, true)) {
					continue;
				}
				$out[$name] = str_replace(array("\r", "\n"), '', (string) $value);
			}
		}
	}

	if (isset($_SERVER['HTTP_COOKIE'])) {
		$out['Cookie'] = str_replace(array("\r", "\n"), '', (string) $_SERVER['HTTP_COOKIE']);
	}

	return $out;
}

function mm_scheduler_proxy_relay_set_cookie_headers($response) {
	$cookies = wp_remote_retrieve_header($response, 'set-cookie');
	if (!is_array($cookies)) {
		$cookies = '' !== (string) $cookies
			? preg_split('/,(?=\s*[A-Za-z0-9_.-]+=)/', (string) $cookies)
			: array();
	}

	foreach ($cookies as $cookie) {
		$cookie = str_replace(array("\r", "\n"), '', (string) $cookie);
		if (preg_match('/^[A-Za-z0-9_.-]+=/', $cookie)) {
			header('Set-Cookie: ' . $cookie, false);
		}
	}
}

function mm_scheduler_proxy_json_body() {
	$raw = file_get_contents('php://input');
	$payload = json_decode(is_string($raw) ? $raw : '', true);

	return array(
		'raw' => is_string($raw) ? $raw : '',
		'payload' => is_array($payload) ? $payload : array(),
	);
}

function mm_scheduler_proxy_is_scheduler_audience($audience) {
	$normalized = strtolower(preg_replace('/[^a-z0-9_-]+/', '-', (string) $audience));
	return in_array($normalized, array('scheduler', 'missionmed-scheduler', 'matrix-scheduler'), true);
}

function mm_scheduler_proxy_handoff_secret() {
	if (function_exists('mmhq_handoff_secret')) {
		return (string) mmhq_handoff_secret();
	}

	$env = trim((string) getenv('MMHQ_HANDOFF_SECRET'));
	if ('' !== $env) {
		return $env;
	}

	if (defined('MMHQ_HANDOFF_SECRET')) {
		return trim((string) MMHQ_HANDOFF_SECRET);
	}

	return '';
}

function mm_scheduler_proxy_base64url($value) {
	return rtrim(strtr(base64_encode((string) $value), '+/', '-_'), '=');
}

function mm_scheduler_proxy_current_user_handoff_token() {
	if (!is_user_logged_in()) {
		return '';
	}

	$secret = mm_scheduler_proxy_handoff_secret();
	if ('' === $secret) {
		return '';
	}

	$wp_user = wp_get_current_user();
	if (!$wp_user || empty($wp_user->ID) || empty($wp_user->user_email)) {
		return '';
	}

	if (function_exists('mmhq_handoff_build_token_payload')) {
		$payload = mmhq_handoff_build_token_payload($wp_user);
	} else {
		$payload = array(
			'wp_user_id' => (int) $wp_user->ID,
			'email' => (string) $wp_user->user_email,
			'username' => (string) $wp_user->user_login,
			'display_name' => (string) $wp_user->display_name,
			'roles' => array_values((array) $wp_user->roles),
			'iat' => time(),
			'exp' => time() + 60,
			'nonce' => wp_generate_uuid4(),
		);
	}

	$payload_json = wp_json_encode($payload);
	if (!is_string($payload_json) || '' === $payload_json) {
		return '';
	}

	$body = mm_scheduler_proxy_base64url($payload_json);
	return $body . '.' . hash_hmac('sha256', $body, $secret);
}

function mm_scheduler_proxy_auth_exchange() {
	$body = mm_scheduler_proxy_json_body();
	$payload = $body['payload'];
	$audience = isset($payload['audience']) ? (string) $payload['audience'] : (isset($payload['authAudience']) ? (string) $payload['authAudience'] : '');

	if (mm_scheduler_proxy_is_scheduler_audience($audience) && empty($payload['token']) && empty($payload['wpToken']) && empty($payload['bearerToken'])) {
		$token = mm_scheduler_proxy_current_user_handoff_token();
		if ('' !== $token) {
			$payload['audience'] = 'scheduler';
			$payload['token'] = $token;
			$body['raw'] = (string) wp_json_encode($payload);
		}
	}

	mm_scheduler_proxy_api('/api/auth/exchange', array(
		'route' => 'scheduler-auth-proxy',
		'body' => $body['raw'],
	));
}

function mm_scheduler_proxy_api($path, $options = array()) {
	$base = rtrim((string) MM_SCHEDULER_API_BASE, '/');
	$query_string = isset($_SERVER['QUERY_STRING']) ? (string) $_SERVER['QUERY_STRING'] : '';
	$target_path = isset($options['target_path']) ? (string) $options['target_path'] : (string) $path;
	$target = $base . $target_path . ('' !== $query_string && empty($options['ignore_query']) ? '?' . $query_string : '');
	$method = isset($options['method']) ? strtoupper((string) $options['method']) : (isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET');
	$body = array_key_exists('body', $options) ? (string) $options['body'] : file_get_contents('php://input');
	$route = isset($options['route']) ? (string) $options['route'] : 'scheduler-api-proxy';

	$response = wp_remote_request($target, array(
		'method' => $method,
		'headers' => mm_scheduler_proxy_forward_headers(),
		'body' => is_string($body) ? $body : '',
		'timeout' => 20,
		'redirection' => 0,
	));

	if (is_wp_error($response)) {
		status_header(502);
		mm_scheduler_proxy_headers('application/json; charset=utf-8', $route);
		echo wp_json_encode(array('ok' => false, 'error' => 'scheduler_api_unreachable'));
		exit;
	}

	$status = (int) wp_remote_retrieve_response_code($response);
	if ($status < 100 || $status > 599) {
		$status = 502;
	}

	status_header($status);
	mm_scheduler_proxy_headers('application/json; charset=utf-8', $route);
	mm_scheduler_proxy_relay_set_cookie_headers($response);
	echo wp_remote_retrieve_body($response);
	exit;
}

function mm_scheduler_proxy_auth_api($path) {
	if ('/api/auth/exchange' === $path) {
		mm_scheduler_proxy_auth_exchange();
	}

	if ('/api/auth/session' !== $path || !mm_scheduler_proxy_is_scheduler_auth_exchange_request()) {
		return;
	}

	$query = array();
	$token = isset($_GET['token']) ? (string) wp_unslash($_GET['token']) : '';
	if ('' !== $token) {
		$query['token'] = $token;
	}
	$query['audience'] = 'scheduler';

	$target_path = '/api/auth/session';
	if (!empty($query)) {
		$target_path .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
	}

	mm_scheduler_proxy_api('/api/auth/session', array(
		'target_path' => $target_path,
		'method' => 'GET',
		'body' => '',
		'ignore_query' => true,
		'route' => 'scheduler-auth-proxy',
	));
}

function mm_scheduler_proxy_dispatch() {
	if ((defined('REST_REQUEST') && REST_REQUEST) || is_admin()) {
		return;
	}

	$path = mm_scheduler_proxy_path();

	if (mm_scheduler_proxy_is_scheduler_api_route($path)) {
		mm_scheduler_proxy_api($path);
	}

	if (mm_scheduler_proxy_is_auth_api_route($path)) {
		mm_scheduler_proxy_auth_api($path);
	}

	if (mm_scheduler_proxy_is_student_route($path)) {
		if (!is_user_logged_in()) {
			mm_scheduler_proxy_login_redirect();
		}
		status_header(200);
		mm_scheduler_proxy_headers('text/html; charset=utf-8', 'scheduler-proxy');
		echo mm_scheduler_proxy_rewrite_html(mm_scheduler_proxy_fetch_html(MM_SCHEDULER_ASSET_URL));
		exit;
	}

	if (mm_scheduler_proxy_is_hq_route($path)) {
		mm_scheduler_proxy_require_admin();
		status_header(200);
		mm_scheduler_proxy_headers('text/html; charset=utf-8', 'scheduler-hq-proxy');
		echo mm_scheduler_proxy_rewrite_html(mm_scheduler_proxy_fetch_html(MM_SCHEDULER_ADMIN_ASSET_URL));
		exit;
	}
}

add_action('parse_request', 'mm_scheduler_proxy_dispatch', -20);
add_action('template_redirect', 'mm_scheduler_proxy_dispatch', -20);
add_action('rest_api_init', 'mm_scheduler_register_rest_routes');

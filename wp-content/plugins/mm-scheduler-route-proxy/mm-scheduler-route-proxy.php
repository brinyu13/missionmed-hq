<?php
/**
 * Plugin Name: MissionMed Scheduler Route Proxy
 * Description: Serves MissionMed Scheduler routes from CDN and proxies Scheduler API calls to MissionMed HQ.
 * Author: MissionMed
 * Version: 1.0.16
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
	header('X-MissionMed-Proxy-Version: 1.0.16');
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

	$cache_key = 'mm_scheduler_proxy_html_' . md5($asset_url);
	$cached_body = get_transient($cache_key);
	if (is_string($cached_body) && '' !== $cached_body) {
		return $cached_body;
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
	$body = is_string($body) ? $body : '';
	if ('' !== $body) {
		set_transient($cache_key, $body, 60);
	}

	return $body;
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
    if (window.sessionStorage.getItem(startedKey) === "1") {
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
      window.sessionStorage.setItem(startedKey, "1");
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

function mm_scheduler_proxy_clean_header_value($value) {
	return str_replace(array("\r", "\n"), '', (string) $value);
}

function mm_scheduler_proxy_parse_cookie_header($cookie_header) {
	$out = array();
	foreach (explode(';', (string) $cookie_header) as $part) {
		$pair = explode('=', trim($part), 2);
		if (2 !== count($pair)) {
			continue;
		}
		$name = trim((string) $pair[0]);
		if ('' === $name) {
			continue;
		}
		$out[$name] = (string) $pair[1];
	}
	return $out;
}

function mm_scheduler_proxy_session_cookie_header() {
	if (empty($_SERVER['HTTP_COOKIE'])) {
		return '';
	}
	$cookies = mm_scheduler_proxy_parse_cookie_header((string) $_SERVER['HTTP_COOKIE']);
	$session_names = array('mmhq_session');
	$out = array();
	foreach ($session_names as $name) {
		if (isset($cookies[$name]) && '' !== $cookies[$name]) {
			$out[] = $name . '=' . $cookies[$name];
		}
	}
	return implode('; ', $out);
}

function mm_scheduler_proxy_wordpress_session_cookie_header() {
	if (empty($_SERVER['HTTP_COOKIE'])) {
		return '';
	}
	$cookies = mm_scheduler_proxy_parse_cookie_header((string) $_SERVER['HTTP_COOKIE']);
	$out = array();
	foreach ($cookies as $name => $value) {
		$name = (string) $name;
		if (0 === strpos($name, 'wordpress_logged_in_') || 0 === strpos($name, 'wordpress_sec_')) {
			$out[] = $name . '=' . (string) $value;
		}
	}
	return implode('; ', $out);
}

function mm_scheduler_proxy_forward_headers($options = array()) {
	$blocked = array('host', 'content-length', 'connection', 'transfer-encoding', 'upgrade', 'cookie');
	$cookie_mode = isset($options['cookie_mode']) ? (string) $options['cookie_mode'] : 'session';
	$out = array();

	if (function_exists('getallheaders')) {
		$headers = getallheaders();
		if (is_array($headers)) {
			foreach ($headers as $name => $value) {
				$normalized = strtolower(trim((string) $name));
				if ('' === $normalized || in_array($normalized, $blocked, true)) {
					continue;
				}
				$out[$name] = mm_scheduler_proxy_clean_header_value($value);
			}
		}
	}

	if ('all' === $cookie_mode && isset($_SERVER['HTTP_COOKIE'])) {
		$out['Cookie'] = mm_scheduler_proxy_clean_header_value($_SERVER['HTTP_COOKIE']);
	} elseif ('session' === $cookie_mode) {
		$session_cookie = mm_scheduler_proxy_session_cookie_header();
		if ('' !== $session_cookie) {
			$out['Cookie'] = mm_scheduler_proxy_clean_header_value($session_cookie);
		}
	} elseif ('wordpress' === $cookie_mode) {
		$wordpress_cookie = mm_scheduler_proxy_wordpress_session_cookie_header();
		if ('' !== $wordpress_cookie) {
			$out['Cookie'] = mm_scheduler_proxy_clean_header_value($wordpress_cookie);
		}
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
	$cookie_mode = 'none';

	if (mm_scheduler_proxy_is_scheduler_audience($audience) && empty($payload['token']) && empty($payload['wpToken']) && empty($payload['bearerToken'])) {
		$token = mm_scheduler_proxy_current_user_handoff_token();
		if ('' !== $token) {
			$payload['audience'] = 'scheduler';
			$payload['token'] = $token;
			$body['raw'] = (string) wp_json_encode($payload);
			$cookie_mode = 'wordpress';
		} else {
			$cookie_mode = 'session';
		}
	} elseif (mm_scheduler_proxy_is_scheduler_audience($audience) && is_user_logged_in()) {
		$cookie_mode = 'wordpress';
	}

	mm_scheduler_proxy_api('/api/auth/exchange', array(
		'route' => 'scheduler-auth-proxy',
		'body' => $body['raw'],
		'cookie_mode' => $cookie_mode,
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
	$cookie_mode = isset($options['cookie_mode']) ? (string) $options['cookie_mode'] : 'session';

	$response = wp_remote_request($target, array(
		'method' => $method,
		'headers' => mm_scheduler_proxy_forward_headers(array('cookie_mode' => $cookie_mode)),
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
	$cookie_mode = 'session';
	$session_cookie = mm_scheduler_proxy_session_cookie_header();
	if ('' === $token && '' === $session_cookie) {
		$token = mm_scheduler_proxy_current_user_handoff_token();
	}
	if ('' !== $token) {
		$query['token'] = $token;
		$cookie_mode = 'wordpress';
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
		'cookie_mode' => $cookie_mode,
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

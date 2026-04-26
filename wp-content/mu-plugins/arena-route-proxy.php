<?php
/**
 * Route /arena to the canonical Arena HTML artifact while keeping first-party origin.
 *
 * Architecture contract:
 * - Browser route stays on missionmedinstitute.com (/arena)
 * - HTML artifact is served from CDN via server-side proxy
 * - WordPress theme/header/footer never render for this route
 */

if ( ! function_exists( 'mm_arena_route_proxy_force_same_origin_auth' ) ) {
	/**
	 * Enforce same-origin auth endpoints in proxied Arena HTML.
	 *
	 * Some upstream Arena builds hardcode direct Railway auth origins. Arena must
	 * use first-party /api/auth/* paths so browser cookies stay on the WP origin.
	 *
	 * @param string $html Upstream HTML body.
	 * @return string
	 */
	function mm_arena_route_proxy_force_same_origin_auth( $html ) {
		$body = (string) $html;
		if ( '' === $body ) {
			return $body;
		}

		$search  = array(
			"const AUTH_BASE = 'https://missionmed-hq-production.up.railway.app';",
			'const AUTH_BASE = "https://missionmed-hq-production.up.railway.app";',
			"const AUTH_EXCHANGE_URL = 'https://missionmed-hq-production.up.railway.app/api/auth/exchange';",
			'const AUTH_EXCHANGE_URL = "https://missionmed-hq-production.up.railway.app/api/auth/exchange";',
			"const AUTH_BOOTSTRAP_URL = 'https://missionmed-hq-production.up.railway.app/api/auth/bootstrap';",
			'const AUTH_BOOTSTRAP_URL = "https://missionmed-hq-production.up.railway.app/api/auth/bootstrap";',
		);
		$replace = array(
			"const AUTH_BASE = '';",
			"const AUTH_BASE = '';",
			"const AUTH_EXCHANGE_URL = '/api/auth/exchange';",
			"const AUTH_EXCHANGE_URL = '/api/auth/exchange';",
			"const AUTH_BOOTSTRAP_URL = '/api/auth/bootstrap';",
			"const AUTH_BOOTSTRAP_URL = '/api/auth/bootstrap';",
		);

		$body = str_replace( $search, $replace, $body );

		return $body;
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_build_login_return_url' ) ) {
	/**
	 * Build a safe login return URL that stays within Arena routes.
	 *
	 * @return string
	 */
	function mm_arena_route_proxy_build_login_return_url() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/arena';
		$path        = (string) wp_parse_url( $request_uri, PHP_URL_PATH );
		$query       = (string) wp_parse_url( $request_uri, PHP_URL_QUERY );
		$normalized  = '/' . ltrim( $path, '/' );
		$arena_path  = rtrim( $normalized, '/' );
		$base_url    = home_url( '/arena' );

		if ( '/arena' !== $arena_path ) {
			return esc_url_raw( $base_url );
		}

		$query_args = array();
		if ( '' !== $query ) {
			wp_parse_str( $query, $query_args );
		}
		if ( ! is_array( $query_args ) ) {
			$query_args = array();
		}

		// Keep requested Arena context, but strip transient auth-state flags.
		unset( $query_args['logged_out'], $query_args['redirected'], $query_args['just_logged_in'] );

		if ( empty( $query_args ) ) {
			return esc_url_raw( $base_url );
		}

		return esc_url_raw( add_query_arg( $query_args, $base_url ) );
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_build_auth_config' ) ) {
	/**
	 * Build server-side Arena auth config for client rendering.
	 *
	 * @return array<string,mixed>
	 */
	function mm_arena_route_proxy_build_auth_config() {
		$request_uri      = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/arena';
		$query            = (string) wp_parse_url( $request_uri, PHP_URL_QUERY );
		$query_args       = array();
		$login_return_url = mm_arena_route_proxy_build_login_return_url();
		$logged_out_url   = add_query_arg( 'logged_out', '1', home_url( '/arena' ) );
		$login_url        = add_query_arg( 'redirect_to', $login_return_url, home_url( '/my-account/' ) );
		$register_url     = add_query_arg(
			array(
				'action'      => 'register',
				'redirect_to' => $login_return_url,
			),
			home_url( '/my-account/' )
		);
		$logout_url       = wp_logout_url( $logged_out_url );
		$login_form_html  = '';
		$logged_out_param = false;

		if ( '' !== $query ) {
			wp_parse_str( $query, $query_args );
		}
		if ( is_array( $query_args ) && isset( $query_args['logged_out'] ) ) {
			$logged_out_param = '1' === (string) $query_args['logged_out'];
		}

		if ( ! is_user_logged_in() && function_exists( 'wp_login_form' ) ) {
			ob_start();
			wp_login_form(
				array(
					'echo'           => true,
					'remember'       => true,
					'redirect'       => $login_return_url,
					'label_username' => __( 'Email or Username' ),
					'label_password' => __( 'Password' ),
					'label_remember' => __( 'Remember Me' ),
					'label_log_in'   => __( 'Continue to Arena' ),
				)
			);
			$login_form_html = (string) ob_get_clean();
		}

		return array(
			'loginUrl'       => esc_url_raw( $login_url ),
			'registerUrl'    => esc_url_raw( $register_url ),
			'logoutUrl'      => esc_url_raw( $logout_url ),
			'loginReturnUrl' => esc_url_raw( $login_return_url ),
			'isLoggedIn'     => is_user_logged_in(),
			'loggedOutParam' => $logged_out_param,
			'just_logged_in' => isset( $query_args['redirected'] ) && '1' === (string) $query_args['redirected'],
			'site_url'       => esc_url_raw( home_url( '/' ) ),
			'site_origin'    => esc_url_raw( home_url() ),
			'loginFormHtml'  => $login_form_html,
		);
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_inject_auth_config' ) ) {
	/**
	 * Inject MM_ARENA_AUTH_CONFIG into proxied Arena HTML.
	 *
	 * @param string                $html        Upstream HTML body.
	 * @param array<string,mixed>   $auth_config Auth config payload.
	 * @return string
	 */
	function mm_arena_route_proxy_inject_auth_config( $html, $auth_config ) {
		$body = (string) $html;
		if ( '' === $body ) {
			return $body;
		}

		if ( false !== strpos( $body, 'window.MM_ARENA_AUTH_CONFIG' ) ) {
			return $body;
		}

		$payload = wp_json_encode( $auth_config, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $payload ) || '' === trim( $payload ) ) {
			return $body;
		}

		$script = '<script>window.MM_ARENA_AUTH_CONFIG=' . $payload . ';window.mmArenaAuth=window.mmArenaAuth||window.MM_ARENA_AUTH_CONFIG;</script>';
		$count  = 0;
		$body   = preg_replace( '/<\/head>/i', $script . '</head>', $body, 1, $count );

		if ( 0 === (int) $count ) {
			$body = preg_replace( '/<body([^>]*)>/i', '<body$1>' . $script, $body, 1, $count );
		}

		if ( 0 === (int) $count ) {
			$body = $script . $body;
		}

		return $body;
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_handle_request' ) ) {
	/**
	 * Serve /arena from upstream Arena artifact.
	 */
	function mm_arena_route_proxy_handle_request() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		$path        = parse_url( $request_uri, PHP_URL_PATH );
		$normalized  = rtrim( (string) $path, '/' );

		if ( '/arena' !== $normalized ) {
			return;
		}

			$upstream_base = 'https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;

		if ( '' !== $query_string ) {
			$upstream_url .= '?' . $query_string;
		}

		$response = wp_remote_get(
			$upstream_url,
			array(
				'timeout'     => 15,
				'redirection' => 3,
				'sslverify'   => true,
				'headers'     => array(
					'Accept' => 'text/html',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: arena-proxy' );
			header( 'X-MissionMed-Arena-Intercept: true' );
			header( 'X-MissionMed-Upstream-Error: request_failed' );
			echo 'MissionMed arena upstream fetch failed.';
			exit;
		}

			$status_code  = (int) wp_remote_retrieve_response_code( $response );
			$body         = (string) wp_remote_retrieve_body( $response );
			$body_fixed   = mm_arena_route_proxy_force_same_origin_auth( $body );
			$auth_fixed   = $body_fixed !== $body;
			$auth_config  = mm_arena_route_proxy_build_auth_config();
			$body_injected = mm_arena_route_proxy_inject_auth_config( $body_fixed, $auth_config );
			$cfg_injected = $body_injected !== $body_fixed;
			$body         = $body_injected;

			if ( $status_code < 200 || $status_code >= 400 || '' === $body ) {
				status_header( 502 );
				nocache_headers();
				header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
				header( 'X-MissionMed-Route: arena-proxy' );
			header( 'X-MissionMed-Arena-Intercept: true' );
			header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
			echo 'MissionMed arena upstream returned invalid response.';
				exit;
			}

				if ( ! defined( 'DONOTCACHEPAGE' ) ) {
					define( 'DONOTCACHEPAGE', true );
				}

				status_header( 200 );
				nocache_headers();
				header( 'Cache-Control: no-cache, must-revalidate, max-age=0, no-store, private' );
				header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
				header( 'X-MissionMed-Route: arena-proxy' );
				header( 'X-MissionMed-Arena-Auth-Mode: wp-proxy' );
				if ( $auth_fixed ) {
				header( 'X-MissionMed-Arena-Auth-Rewrite: true' );
			}
			if ( $cfg_injected ) {
				header( 'X-MissionMed-Arena-Auth-Config: injected' );
			}
			echo $body;
			exit;
	}
}

add_action( 'parse_request', 'mm_arena_route_proxy_handle_request', 0 );
add_action( 'template_redirect', 'mm_arena_route_proxy_handle_request', 0 );

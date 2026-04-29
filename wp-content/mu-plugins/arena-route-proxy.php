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
 * Preserve upstream auth endpoint wiring in proxied Arena HTML.
	 *
 * Current locked runtime requires direct Railway auth endpoints
 * (missionmed-hq-production.up.railway.app). Do not rewrite auth hosts here.
	 *
	 * @param string $html Upstream HTML body.
	 * @return string
	 */
	function mm_arena_route_proxy_force_same_origin_auth( $html ) {
		$body = (string) $html;
		if ( '' === $body ) {
			return $body;
		}
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
		$forgot_url       = wp_lostpassword_url( $login_return_url );
		$login_form_html  = '';
		$logged_out_param = false;

		if ( '' !== $query ) {
			wp_parse_str( $query, $query_args );
		}
		if ( is_array( $query_args ) && isset( $query_args['logged_out'] ) ) {
			$logged_out_param = '1' === (string) $query_args['logged_out'];
		}

		/*
		 * Arena is not a native login surface. Runtime login must begin from
		 * WordPress account pages and return to /arena for exchange/bootstrap.
		 */
		$login_form_html = '';

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

		/*
		 * Guard only when a concrete config object literal already exists.
		 * The Arena client also contains reassignment lines such as
		 * "window.MM_ARENA_AUTH_CONFIG = direct;" which must NOT block
		 * server-side config injection.
		 */
		if ( 1 === preg_match( '/window\.MM_ARENA_AUTH_CONFIG\s*=\s*\{/', $body ) ) {
			return $body;
		}

		$payload = wp_json_encode( $auth_config, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $payload ) || '' === trim( $payload ) ) {
			return $body;
		}

		$style  = '<style id="mm-arena-auth-enhancement">#entryAuthPanel{width:min(680px,calc(100vw - 30px));padding:26px 24px 22px;border-radius:18px;border:1px solid rgba(0,191,255,.28);box-shadow:0 20px 52px rgba(0,0,0,.5),0 0 0 1px rgba(0,191,255,.12) inset;background:linear-gradient(180deg,rgba(10,24,42,.94) 0%,rgba(4,11,21,.98) 100%)}#entryAuthPanel .entry-auth-title{font-size:19px;letter-spacing:1.8px;margin-bottom:8px}#entryAuthPanel .entry-auth-copy{font-size:15px;line-height:1.55;margin-bottom:14px;color:#c6dbef}#entryAuthPanel .entry-auth-form .login-username,#entryAuthPanel .entry-auth-form .login-password,#entryAuthPanel .entry-auth-form .login-remember,#entryAuthPanel .entry-auth-form .login-submit{margin-bottom:12px}#entryAuthPanel .entry-auth-form label{font-size:12px;letter-spacing:1.25px;color:#9fcdf2}#entryAuthPanel .entry-auth-form input[type="text"],#entryAuthPanel .entry-auth-form input[type="password"],#entryAuthPanel .entry-auth-form input[type="email"]{height:50px;font-size:16px;border-radius:10px}#entryAuthPanel .entry-auth-form .button,#entryAuthPanel .entry-auth-form input[type="submit"]{min-height:50px;font-size:13px;letter-spacing:2.4px}#entryAuthPanel .login-lost-password{margin:2px 0 4px;text-align:left}#entryAuthPanel .login-lost-password a{font-family:Rajdhani,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9fd4ff;text-decoration:none}#entryAuthPanel .login-lost-password a:hover,#entryAuthPanel .login-lost-password a:focus-visible{color:#fff;text-decoration:underline}#entryAuthLinks{justify-content:flex-start!important}#entryAuthLoginLink{font-size:12px!important;letter-spacing:1px!important;text-transform:uppercase!important;color:#9fd4ff!important;text-decoration:none!important}#entryAuthLoginLink:hover,#entryAuthLoginLink:focus-visible{color:#fff!important;text-decoration:underline!important}#entryAuthRegisterLink{display:none!important}@media (max-width:760px){#entryAuthPanel{width:min(96vw,620px);padding:20px 16px 16px}#entryAuthPanel .entry-auth-title{font-size:16px;letter-spacing:1.4px}}</style>';
		$script = '<script>window.MM_ARENA_AUTH_CONFIG=' . $payload . ';window.mmArenaAuth=window.mmArenaAuth||window.MM_ARENA_AUTH_CONFIG;(function(){function applyArenaAuthEnhancements(){try{var title=document.querySelector("#entryAuthPanel .entry-auth-title");if(title){title.textContent="Sign in to enter the Arena";}var copy=document.getElementById("entryAuthCopy");if(copy){copy.textContent="Your drills, stats, rank, and duels are tied to your MissionMed account.";}var welcome=document.getElementById("entryWelcome");if(welcome&&/logged_out=1/.test(String(window.location.search||""))){welcome.textContent="You\'re signed out. Sign back in whenever you\'re ready to re-enter the Arena.";welcome.classList.add("visible");}var loginLink=document.getElementById("entryAuthLoginLink");if(loginLink){loginLink.textContent="Having trouble? Open the standard account login.";}var registerLink=document.getElementById("entryAuthRegisterLink");if(registerLink){registerLink.style.display="none";}var submit=document.querySelector("#entryAuthForm form input[type=\'submit\'],#entryAuthForm form button[type=\'submit\']");if(submit){if("value" in submit){submit.value="Enter Arena";}if(submit.textContent){submit.textContent="Enter Arena";}}}catch(_e){}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",applyArenaAuthEnhancements,{once:false});}applyArenaAuthEnhancements();setTimeout(applyArenaAuthEnhancements,120);setTimeout(applyArenaAuthEnhancements,650);})();</script>';
		$count  = 0;
		$body   = preg_replace( '/<\/head>/i', $style . $script . '</head>', $body, 1, $count );

		if ( 0 === (int) $count ) {
			$body = preg_replace( '/<body([^>]*)>/i', '<body$1>' . $style . $script, $body, 1, $count );
		}

		if ( 0 === (int) $count ) {
			$body = $style . $script . $body;
		}

		return $body;
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_fetch_upstream_html' ) ) {
	/**
	 * Fetch Arena upstream HTML using a deterministic transport ladder.
	 *
	 * @param string $url Upstream URL.
	 * @return array{
	 *   ok:bool,
	 *   status:int,
	 *   body:string,
	 *   transport:string,
	 *   error:string
	 * }
	 */
	function mm_arena_route_proxy_fetch_upstream_html( $url ) {
		$result = array(
			'ok'        => false,
			'status'    => 0,
			'body'      => '',
			'transport' => '',
			'error'     => '',
		);

		if ( function_exists( 'curl_init' ) ) {
			$ch = curl_init();

			curl_setopt_array(
				$ch,
				array(
					CURLOPT_URL            => $url,
					CURLOPT_RETURNTRANSFER => true,
					CURLOPT_FOLLOWLOCATION => true,
					CURLOPT_MAXREDIRS      => 5,
					CURLOPT_CONNECTTIMEOUT => 5,
					CURLOPT_TIMEOUT        => 20,
					CURLOPT_SSL_VERIFYPEER => true,
					CURLOPT_SSL_VERIFYHOST => 2,
					CURLOPT_HTTPHEADER     => array(
						'Accept: text/html',
						'User-Agent: MissionMed-Arena-Proxy/1.0 (+https://missionmedinstitute.com/arena)',
					),
				)
			);

			$body          = curl_exec( $ch );
			$curl_errno    = curl_errno( $ch );
			$curl_error    = curl_error( $ch );
			$status_code   = (int) curl_getinfo( $ch, CURLINFO_RESPONSE_CODE );
			$body_string   = is_string( $body ) ? $body : '';
			$body_nonempty = '' !== $body_string;

			curl_close( $ch );

			if ( 0 === $curl_errno && $status_code >= 200 && $status_code < 400 && $body_nonempty ) {
				$result['ok']        = true;
				$result['status']    = $status_code;
				$result['body']      = $body_string;
				$result['transport'] = 'curl';
				return $result;
			}

			$result['transport'] = 'curl';
			$result['status']    = $status_code;
			$result['error']     = 0 !== $curl_errno ? $curl_error : 'curl_invalid_response';
		}

		$response = wp_remote_get(
			$url,
			array(
				'timeout'     => 20,
				'redirection' => 5,
				'sslverify'   => true,
				'headers'     => array(
					'Accept'     => 'text/html',
					'User-Agent' => 'MissionMed-Arena-Proxy/1.0 (+https://missionmedinstitute.com/arena)',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			$result['transport'] = '' !== $result['transport'] ? $result['transport'] . '+wp_remote_get' : 'wp_remote_get';
			$result['error']     = $response->get_error_message();
			return $result;
		}

		$status_code = (int) wp_remote_retrieve_response_code( $response );
		$body        = (string) wp_remote_retrieve_body( $response );

		$result['transport'] = '' !== $result['transport'] ? $result['transport'] . '+wp_remote_get' : 'wp_remote_get';
		$result['status']    = $status_code;

		if ( $status_code >= 200 && $status_code < 400 && '' !== $body ) {
			$result['ok']   = true;
			$result['body'] = $body;
			return $result;
		}

		$result['error'] = 'wp_remote_get_invalid_response';
		return $result;
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_request_path' ) ) {
	/**
	 * Resolve a normalized request path for robust route matching.
	 *
	 * @return string
	 */
	function mm_arena_route_proxy_request_path() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		if ( '' === $request_uri ) {
			return '';
		}

		$path = wp_parse_url( $request_uri, PHP_URL_PATH );
		if ( ! is_string( $path ) || '' === $path ) {
			return '';
		}

		$path = rawurldecode( $path );
		$path = preg_replace( '#/+#', '/', $path );

		$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		if ( is_string( $home_path ) && '' !== $home_path && '/' !== $home_path ) {
			$home_path = rtrim( $home_path, '/' );
			if ( strpos( $path, $home_path . '/' ) === 0 ) {
				$path = substr( $path, strlen( $home_path ) );
			} elseif ( $path === $home_path ) {
				$path = '/';
			}
		}

		if ( strpos( $path, '/index.php/' ) === 0 ) {
			$path = substr( $path, strlen( '/index.php' ) );
		} elseif ( '/index.php' === $path ) {
			$path = '/';
		}

		return '' !== $path ? $path : '/';
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_is_target_request' ) ) {
	/**
	 * Determine whether the current request should be served by /arena proxy.
	 *
	 * @return bool
	 */
	function mm_arena_route_proxy_is_target_request() {
		$path = mm_arena_route_proxy_request_path();
		if ( '' === $path ) {
			return false;
		}

		return 1 === preg_match( '#^/arena(?:/|$)#', $path );
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_handle_request' ) ) {
	/**
	 * Serve /arena from upstream Arena artifact.
	 */
	function mm_arena_route_proxy_handle_request() {
		if ( ! mm_arena_route_proxy_is_target_request() ) {
			return;
		}

		$path = mm_arena_route_proxy_request_path();
		if ( '/arena/' === $path ) {
			$query_string = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
			$target_url   = home_url( '/arena' );
			if ( '' !== $query_string ) {
				$target_url .= '?' . $query_string;
			}
			wp_safe_redirect( $target_url, 302 );
			exit;
		}

		$upstream_base = 'https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;

		if ( '' !== $query_string ) {
			$upstream_url .= '?' . $query_string;
		}

		$fetch_result = mm_arena_route_proxy_fetch_upstream_html( $upstream_url );
		if ( ! $fetch_result['ok'] ) {
			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: arena-proxy' );
			header( 'X-MissionMed-Arena-Intercept: true' );
			header( 'X-MissionMed-Upstream-Error: request_failed' );
			if ( ! empty( $fetch_result['transport'] ) ) {
				header( 'X-MissionMed-Upstream-Transport: ' . (string) $fetch_result['transport'] );
			}
			if ( ! empty( $fetch_result['error'] ) ) {
				header( 'X-MissionMed-Upstream-Detail: ' . substr( (string) $fetch_result['error'], 0, 180 ) );
			}
			echo 'MissionMed arena upstream fetch failed.';
			exit;
		}

		$status_code   = (int) $fetch_result['status'];
		$body          = (string) $fetch_result['body'];
		$body_fixed    = mm_arena_route_proxy_force_same_origin_auth( $body );
		$auth_fixed    = $body_fixed !== $body;
		$auth_config   = mm_arena_route_proxy_build_auth_config();
		$body_injected = mm_arena_route_proxy_inject_auth_config( $body_fixed, $auth_config );
		$cfg_injected  = $body_injected !== $body_fixed;
		$body          = $body_injected;

		if ( $status_code < 200 || $status_code >= 400 || '' === $body ) {
			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: arena-proxy' );
			header( 'X-MissionMed-Arena-Intercept: true' );
			header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
			if ( ! empty( $fetch_result['transport'] ) ) {
				header( 'X-MissionMed-Upstream-Transport: ' . (string) $fetch_result['transport'] );
			}
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
		header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
		header( 'X-MissionMed-Upstream-Transport: ' . (string) $fetch_result['transport'] );
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

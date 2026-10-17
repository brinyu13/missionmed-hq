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

if ( ! function_exists( 'mm_arena_route_proxy_build_handoff_url' ) ) {
	/**
	 * Build the signed WordPress -> HQ handoff entry used by Arena auth.
	 *
	 * The handoff route already handles logged-out users by sending them to
	 * My Account and returning here after login. Keeping the Arena CTA on this
	 * route prevents plain My Account redirects from landing back on /arena
	 * without the signed token the runtime needs to bootstrap.
	 *
	 * @return string
	 */
	function mm_arena_route_proxy_build_handoff_url() {
		$arena_base = esc_url_raw( home_url( '/arena' ) );
		$return_to  = $arena_base;
		$final      = add_query_arg( 'just_logged_in', '1', $arena_base );
		$action = defined( 'MMHQ_HANDOFF_ACTION' ) ? (string) MMHQ_HANDOFF_ACTION : 'mmac_hq_auth_redirect';

		return esc_url_raw(
			add_query_arg(
				array(
					'action'    => $action,
					'return_to' => $return_to,
					'final'     => $final,
				),
				admin_url( 'admin-post.php' )
			)
		);
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
		$login_url        = mm_arena_route_proxy_build_handoff_url();
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

		if ( ! is_user_logged_in() && function_exists( 'wp_login_form' ) ) {
			ob_start();
			wp_login_form(
				array(
					'echo'           => true,
					'remember'       => true,
					'redirect'       => $login_url,
					'label_username' => __( 'Email or Username' ),
					'label_password' => __( 'Password' ),
					'label_remember' => __( 'Remember Me' ),
					'label_log_in'   => __( 'Enter Arena' ),
				)
			);
			$login_form_html = (string) ob_get_clean();
			if ( '' !== $login_form_html ) {
				$login_form_html .= '<p class="login-lost-password"><a href="' . esc_url( $forgot_url ) . '">Forgot password?</a></p>';
			}
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

if ( ! function_exists( 'mm_arena_route_proxy_shell_mode' ) ) {
	/**
	 * Resolve the Arena anonymous shell rollout mode.
	 *
	 * @return string
	 */
	function mm_arena_route_proxy_shell_mode() {
		$mode = defined( 'MM_ARENA_ANON_SHELL_MODE' ) ? (string) MM_ARENA_ANON_SHELL_MODE : '';
		if ( '' === trim( $mode ) ) {
			$env_mode = getenv( 'MM_ARENA_ANON_SHELL_MODE' );
			$mode     = is_string( $env_mode ) ? $env_mode : '';
		}
		if ( '' === trim( $mode ) ) {
			$mode = 'ANONYMOUS_SHELL';
		}

		$mode = strtoupper( trim( $mode ) );
		return in_array( $mode, array( 'OFF', 'DRY_RUN', 'ANONYMOUS_SHELL' ), true ) ? $mode : 'OFF';
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_has_private_context' ) ) {
	/**
	 * Detect requests that must remain on the private no-cache proxy path.
	 *
	 * @return bool
	 */
	function mm_arena_route_proxy_has_private_context() {
		$auth_header = isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? trim( (string) $_SERVER['HTTP_AUTHORIZATION'] ) : '';
		if ( '' !== $auth_header ) {
			return true;
		}

		foreach ( array_keys( $_COOKIE ) as $cookie_name ) {
			$name = strtolower( (string) $cookie_name );
			if (
				0 === strpos( $name, 'wordpress_logged_in_' ) ||
				0 === strpos( $name, 'wordpress_sec_' ) ||
				0 === strpos( $name, 'wp-postpass_' ) ||
				0 === strpos( $name, 'wp_woocommerce_session_' ) ||
				0 === strpos( $name, 'woocommerce_' ) ||
				'phpsessid' === $name
			) {
				return true;
			}
		}

		return function_exists( 'is_user_logged_in' ) && is_user_logged_in();
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_build_anonymous_auth_config' ) ) {
	/**
	 * Build a cache-safe anonymous auth config.
	 *
	 * @return array<string,mixed>
	 */
	function mm_arena_route_proxy_build_anonymous_auth_config() {
		$arena_url    = home_url( '/arena' );
		$logged_out   = add_query_arg( 'logged_out', '1', $arena_url );
		$register_url = add_query_arg(
			array(
				'action'      => 'register',
				'redirect_to' => $arena_url,
			),
			home_url( '/my-account/' )
		);

		return array(
			'loginUrl'       => esc_url_raw( mm_arena_route_proxy_build_handoff_url() ),
			'registerUrl'    => esc_url_raw( $register_url ),
			'logoutUrl'      => esc_url_raw( $logged_out ),
			'loginReturnUrl' => esc_url_raw( $arena_url ),
			'isLoggedIn'     => false,
			'loggedOutParam' => false,
			'just_logged_in' => false,
			'site_url'       => esc_url_raw( home_url( '/' ) ),
			'site_origin'    => esc_url_raw( home_url() ),
			'loginFormHtml'  => '',
		);
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_should_serve_anonymous_shell' ) ) {
	/**
	 * Determine whether this request may receive the cacheable anonymous shell.
	 *
	 * @param string $path Current normalized path.
	 * @param string $query_string Current raw query string.
	 * @return bool
	 */
	function mm_arena_route_proxy_should_serve_anonymous_shell( $path, $query_string ) {
		if ( 'ANONYMOUS_SHELL' !== mm_arena_route_proxy_shell_mode() ) {
			return false;
		}

		$normalized_path = rtrim( (string) $path, '/' );
		if ( '' === $normalized_path ) {
			$normalized_path = '/';
		}

		if ( '/arena' !== $normalized_path || '' !== trim( (string) $query_string ) ) {
			return false;
		}

		return ! mm_arena_route_proxy_has_private_context();
	}
}

if ( ! function_exists( 'mm_arena_route_proxy_send_anonymous_shell_headers' ) ) {
	/**
	 * Emit public cache headers for the anonymous Arena shell.
	 *
	 * @param int    $status_code Upstream status code.
	 * @param string $transport Fetch transport label.
	 * @return void
	 */
	function mm_arena_route_proxy_send_anonymous_shell_headers( $status_code, $transport ) {
		header_remove( 'Set-Cookie' );
		header_remove( 'Pragma' );
		header_remove( 'Expires' );

		status_header( 200 );
		header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
		header( 'Cache-Control: public, max-age=0, s-maxage=900' );
		header( 'CDN-Cache-Control: public, max-age=900' );
		header( 'Cloudflare-CDN-Cache-Control: public, max-age=900' );
		header( 'Surrogate-Control: max-age=900' );
		header( 'X-Accel-Expires: 900' );
		header( 'Vary: Accept-Encoding, Cookie, Authorization' );
		header( 'X-MissionMed-Route: arena-anonymous-shell' );
		header( 'X-MissionMed-Arena-Shell-Mode: ANONYMOUS_SHELL' );
		header( 'X-MissionMed-Arena-Auth-Mode: async-anonymous' );
		header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
		header( 'X-MissionMed-Upstream-Transport: ' . (string) $transport );
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

		$path          = mm_arena_route_proxy_request_path();
		$upstream_base = 'https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;

		$normalized_path = rtrim( (string) $path, '/' );
		if ( '' === $normalized_path ) {
			$normalized_path = '/';
		}

		if ( 'DRY_RUN' === mm_arena_route_proxy_shell_mode() && '/arena' === $normalized_path && '' === $query_string && ! mm_arena_route_proxy_has_private_context() ) {
			header( 'X-MissionMed-Arena-Shell-Dry-Run: eligible', true );
		}

		if ( mm_arena_route_proxy_should_serve_anonymous_shell( $path, $query_string ) ) {
			$fetch_result = mm_arena_route_proxy_fetch_upstream_html( $upstream_base );
			if ( $fetch_result['ok'] ) {
				$status_code   = (int) $fetch_result['status'];
				$body          = (string) $fetch_result['body'];
				$body_fixed    = mm_arena_route_proxy_force_same_origin_auth( $body );
				$auth_config   = mm_arena_route_proxy_build_anonymous_auth_config();
				$body_injected = mm_arena_route_proxy_inject_auth_config( $body_fixed, $auth_config );

				if ( $status_code >= 200 && $status_code < 400 && '' !== $body_injected ) {
					mm_arena_route_proxy_send_anonymous_shell_headers( $status_code, (string) $fetch_result['transport'] );
					if ( $body_fixed !== $body ) {
						header( 'X-MissionMed-Arena-Auth-Rewrite: true' );
					}
					if ( $body_injected !== $body_fixed ) {
						header( 'X-MissionMed-Arena-Auth-Config: anonymous' );
					}
					echo $body_injected;
					exit;
				}
			}

			header( 'X-MissionMed-Arena-Shell-Fallback: private-proxy' );
		}

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

		$body_filtered = apply_filters(
			'mm_arena_route_proxy_html',
			$body,
			array(
				'path'          => $path,
				'query_string'  => $query_string,
				'upstream_url'  => $upstream_url,
				'status_code'   => $status_code,
				'transport'     => (string) $fetch_result['transport'],
				'auth_injected' => $cfg_injected,
			)
		);
		if ( is_string( $body_filtered ) && '' !== $body_filtered ) {
			$body = $body_filtered;
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

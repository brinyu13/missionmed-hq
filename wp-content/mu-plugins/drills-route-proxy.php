<?php
/**
 * Route /drills to the canonical Drills HTML artifact while keeping first-party origin.
 *
 * Architecture contract:
 * - Browser route stays on missionmedinstitute.com (/drills)
 * - HTML artifact is served from CDN via server-side proxy
 * - Query parameters are preserved for drill/session launch state
 * - WordPress theme/header/footer never render for this route
 */

if ( ! function_exists( 'mm_drills_route_proxy_handle_request' ) ) {
	/**
	 * Fetch drills upstream HTML using a deterministic transport ladder.
	 *
	 * Why:
	 * - wp_remote_get has shown inconsistent behavior for this upstream in prod.
	 * - Redirecting to CDN on fetch errors causes cross-layer 404/edge mismatch.
	 * - This keeps /drills first-party and removes redirect fallback ambiguity.
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
	function mm_drills_route_proxy_fetch_upstream_html( $url ) {
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
						'User-Agent: MissionMed-Drills-Proxy/1.0 (+https://missionmedinstitute.com/drills)',
					),
				)
			);

			$body         = curl_exec( $ch );
			$curl_errno   = curl_errno( $ch );
			$curl_error   = curl_error( $ch );
			$status_code  = (int) curl_getinfo( $ch, CURLINFO_RESPONSE_CODE );
			$body_string  = is_string( $body ) ? $body : '';
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
					'User-Agent' => 'MissionMed-Drills-Proxy/1.0 (+https://missionmedinstitute.com/drills)',
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

	/**
	 * Resolve a normalized request path for robust route matching.
	 *
	 * Handles:
	 * - Standard pretty permalinks (/drills, /drills/)
	 * - Front-controller paths (/index.php/drills)
	 * - Site installs in subdirectories (/site/drills)
	 */
	function mm_drills_route_proxy_request_path() {
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

	/**
	 * Determine whether the current request should be served by /drills proxy.
	 */
	function mm_drills_route_proxy_is_target_request() {
		$path = mm_drills_route_proxy_request_path();
		if ( '' === $path ) {
			return false;
		}

		return 1 === preg_match( '#^/drills(?:/|$)#', $path );
	}

	/**
	 * Read a query value as a trimmed string.
	 *
	 * @param string $key Query parameter name.
	 * @return string
	 */
	function mm_drills_route_proxy_query_value( $key ) {
		if ( ! isset( $_GET[ $key ] ) ) {
			return '';
		}

		$value = wp_unslash( $_GET[ $key ] );
		if ( is_array( $value ) ) {
			$value = reset( $value );
		}

		if ( ! is_scalar( $value ) ) {
			return '';
		}

		return trim( (string) $value );
	}

	/**
	 * Resolve whether /drills should load engine or menu based on request contract.
	 *
	 * Engine launch signals:
	 * - video_id (canonical)
	 * - selected_video_id / drill_id (legacy aliases)
	 * - explicit contract payload params (mm_selected_drill, mm_launch variants)
	 *
	 * @return array{is_engine_launch:bool,signal:string}
	 */
	function mm_drills_route_proxy_resolve_launch_signal() {
		$direct_video_keys = array( 'video_id', 'selected_video_id', 'drill_id' );
		foreach ( $direct_video_keys as $key ) {
			$value = mm_drills_route_proxy_query_value( $key );
			if ( '' !== $value ) {
				return array(
					'is_engine_launch' => true,
					'signal'           => 'query.' . $key,
				);
			}
		}

		$contract_keys = array(
			'mm_selected_drill',
			'selected_drill',
			'drill_contract',
			'launch_contract',
			'launch_payload',
			'mm_launch',
		);
		foreach ( $contract_keys as $key ) {
			$value = strtolower( mm_drills_route_proxy_query_value( $key ) );
			if ( '' === $value ) {
				continue;
			}
			if ( 'null' === $value || 'undefined' === $value || '{}' === $value || '[]' === $value ) {
				continue;
			}
			return array(
				'is_engine_launch' => true,
				'signal'           => 'query.' . $key,
			);
		}

		return array(
			'is_engine_launch' => false,
			'signal'           => 'menu.default',
		);
	}

	/**
	 * Serve /drills from upstream drills artifact.
	 */
	function mm_drills_route_proxy_handle_request() {
		if ( ! mm_drills_route_proxy_is_target_request() ) {
			return;
		}

		$launch_signal = mm_drills_route_proxy_resolve_launch_signal();
		$is_engine_launch = ! empty( $launch_signal['is_engine_launch'] );
		$mode_signal = isset( $launch_signal['signal'] ) ? (string) $launch_signal['signal'] : 'unknown';
			$upstream_base    = $is_engine_launch
				? 'https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html'
				: 'https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;

		if ( '' !== $query_string ) {
			$upstream_url .= '?' . $query_string;
		}

		$upstream = mm_drills_route_proxy_fetch_upstream_html( $upstream_url );
		$body     = isset( $upstream['body'] ) ? (string) $upstream['body'] : '';
		$status   = isset( $upstream['status'] ) ? (int) $upstream['status'] : 0;
		$ok       = ! empty( $upstream['ok'] );
		$error    = isset( $upstream['error'] ) ? (string) $upstream['error'] : '';
		$via      = isset( $upstream['transport'] ) ? (string) $upstream['transport'] : 'unknown';

		if ( ! $ok || '' === $body ) {
			$safe_error = preg_replace( '/[\r\n]+/', ' ', '' !== $error ? $error : 'unknown' );
			$safe_error = is_string( $safe_error ) ? substr( $safe_error, 0, 180 ) : 'unknown';

			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
				header( 'X-MissionMed-Route: drills-proxy' );
				header( 'X-MissionMed-Drills-Intercept: true' );
				header( 'X-MissionMed-Drills-Mode: ' . ( $is_engine_launch ? 'engine' : 'menu' ) );
				header( 'X-MissionMed-Drills-Signal: ' . $mode_signal );
				header( 'X-MissionMed-Upstream-Transport: ' . $via );
				header( 'X-MissionMed-Upstream-Status: ' . (string) $status );
				header( 'X-MissionMed-Upstream-Error: ' . $safe_error );
			echo 'MissionMed drills upstream fetch failed.';
			exit;
		}

		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}

		status_header( 200 );
		nocache_headers();
		header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: drills-proxy' );
			header( 'X-MissionMed-Drills-Intercept: true' );
			header( 'X-MissionMed-Drills-Mode: ' . ( $is_engine_launch ? 'engine' : 'menu' ) );
			header( 'X-MissionMed-Drills-Signal: ' . $mode_signal );
			header( 'X-MissionMed-Upstream-Transport: ' . $via );
			header( 'X-MissionMed-Upstream-Status: ' . (string) $status );
			echo $body;
		exit;
	}
}

/*
 * Primary interception matches /arena and /stat behavior.
 * template_redirect is a defensive fallback so WordPress 404 templates
 * never win if parse_request is bypassed by environment quirks.
 */
add_action( 'parse_request', 'mm_drills_route_proxy_handle_request', 0 );
add_action( 'template_redirect', 'mm_drills_route_proxy_handle_request', 0 );

<?php
/**
 * Route /stat to the canonical STAT HTML artifact while keeping first-party origin.
 *
 * Long-term routing model:
 * - MissionMed shell routes live on missionmedinstitute.com (/arena, /stat, ...)
 * - Runtime HTML artifacts can remain on CDN and be proxied server-side
 * - Browser stays on first-party origin so sessionStorage/auth continuity holds
 */

if ( ! function_exists( 'mm_stat_route_proxy_handle_request' ) ) {
	/**
	 * Fetch STAT upstream HTML using a deterministic transport ladder.
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
	function mm_stat_route_proxy_fetch_upstream_html( $url ) {
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
						'User-Agent: MissionMed-STAT-Proxy/1.0 (+https://missionmedinstitute.com/stat)',
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
					'User-Agent' => 'MissionMed-STAT-Proxy/1.0 (+https://missionmedinstitute.com/stat)',
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
	 * @return string
	 */
	function mm_stat_route_proxy_request_path() {
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
	 * Determine whether the current request should be served by /stat proxy.
	 *
	 * @return bool
	 */
	function mm_stat_route_proxy_is_target_request() {
		$path = mm_stat_route_proxy_request_path();
		if ( '' === $path ) {
			return false;
		}

		return 1 === preg_match( '#^/stat(?:/|$)#', $path );
	}

	/**
	 * Serve /stat from upstream STAT artifact.
	 *
	 * This executes early enough to bypass WordPress 404 templates and
	 * returns HTML directly for /stat and /stat/.
	 */
	function mm_stat_route_proxy_handle_request() {
		if ( ! mm_stat_route_proxy_is_target_request() ) {
			return;
		}

		$upstream_base = 'https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html';
		$query_string  = isset( $_SERVER['QUERY_STRING'] ) ? trim( (string) $_SERVER['QUERY_STRING'] ) : '';
		$upstream_url  = $upstream_base;

		if ( '' !== $query_string ) {
			$upstream_url .= '?' . $query_string;
		}

		$fetch_result = mm_stat_route_proxy_fetch_upstream_html( $upstream_url );
		if ( ! $fetch_result['ok'] ) {
			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: stat-proxy' );
			header( 'X-MissionMed-Stat-Intercept: true' );
			header( 'X-MissionMed-Upstream-Error: request_failed' );
			if ( ! empty( $fetch_result['transport'] ) ) {
				header( 'X-MissionMed-Upstream-Transport: ' . (string) $fetch_result['transport'] );
			}
			if ( ! empty( $fetch_result['error'] ) ) {
				header( 'X-MissionMed-Upstream-Detail: ' . substr( (string) $fetch_result['error'], 0, 180 ) );
			}
			echo 'MissionMed STAT upstream fetch failed.';
			exit;
		}

		$status_code = (int) $fetch_result['status'];
		$body        = (string) $fetch_result['body'];

		if ( $status_code < 200 || $status_code >= 400 || '' === $body ) {
			status_header( 502 );
			nocache_headers();
			header( 'Content-Type: text/plain; charset=' . get_bloginfo( 'charset' ) );
			header( 'X-MissionMed-Route: stat-proxy' );
			header( 'X-MissionMed-Stat-Intercept: true' );
			header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
			if ( ! empty( $fetch_result['transport'] ) ) {
				header( 'X-MissionMed-Upstream-Transport: ' . (string) $fetch_result['transport'] );
			}
			echo 'MissionMed STAT upstream returned invalid response.';
			exit;
		}

		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}

		status_header( 200 );
		nocache_headers();
		header( 'Cache-Control: no-cache, must-revalidate, max-age=0, no-store, private' );
		header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) );
		header( 'X-MissionMed-Route: stat-proxy' );
		header( 'X-MissionMed-Stat-Intercept: true' );
		header( 'X-MissionMed-Upstream-Status: ' . (string) $status_code );
		header( 'X-MissionMed-Upstream-Transport: ' . (string) $fetch_result['transport'] );
		echo $body;
		exit;
	}
}

add_action( 'parse_request', 'mm_stat_route_proxy_handle_request', 0 );
add_action( 'template_redirect', 'mm_stat_route_proxy_handle_request', 0 );

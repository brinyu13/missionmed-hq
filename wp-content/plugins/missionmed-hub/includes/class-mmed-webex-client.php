<?php
/**
 * MissionMed Webex API client.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles Webex OAuth, meeting creation, invitees, and guest access.
 */
class MMED_Webex_Client {

	const API_BASE  = 'https://webexapis.com/v1';
	const AUTH_URL  = 'https://webexapis.com/v1/authorize';
	const TOKEN_URL = 'https://webexapis.com/v1/access_token';

	const DEFAULT_INTEGRATION_CLIENT_ID     = 'Ca12504779f891a79f4d4813cd3b9abf7839ed3844426ad7dce8b22f98e28f1a1';
	const DEFAULT_INTEGRATION_CLIENT_SECRET = 'dc306e1b8acad94b5bf0990f361a9a358082fcdc46ab930ae7c27737b6347803';
	const DEFAULT_SERVICE_APP_ID            = 'Cc8f93b60e3421476fd1a77a9a3011193b9fe9a7d49b37d902d3f2376e0a4afa3';
	const DEFAULT_SERVICE_APP_SECRET        = '708475314310488fb8555beb42a68efb2e9f564a38684b73741fd8dbb881301a';

	/**
	 * Initialize stored defaults.
	 *
	 * @return void
	 */
	public static function init() {
		self::seed_default_credentials();
	}

	/**
	 * Store default credentials once if options are empty.
	 *
	 * @return void
	 */
	public static function seed_default_credentials() {
		if ( get_option( 'mmed_webex_credentials_seeded', false ) ) {
			return;
		}

		self::update_encrypted_option( 'mmed_webex_client_id', self::DEFAULT_INTEGRATION_CLIENT_ID );
		self::update_encrypted_option( 'mmed_webex_client_secret', self::DEFAULT_INTEGRATION_CLIENT_SECRET );
		self::update_encrypted_option( 'mmed_webex_service_app_id', self::DEFAULT_SERVICE_APP_ID );
		self::update_encrypted_option( 'mmed_webex_service_app_secret', self::DEFAULT_SERVICE_APP_SECRET );
		update_option( 'mmed_webex_credentials_seeded', 1, false );
	}

	/**
	 * Return settings for the admin UI.
	 *
	 * @return array
	 */
	public static function get_admin_settings() {
		self::seed_default_credentials();

		return array(
			'mmed_webex_client_id'          => self::get_option_value( 'mmed_webex_client_id' ),
			'mmed_webex_client_secret'      => self::get_option_value( 'mmed_webex_client_secret' ),
			'mmed_webex_service_app_id'     => self::get_option_value( 'mmed_webex_service_app_id' ),
			'mmed_webex_service_app_secret' => self::get_option_value( 'mmed_webex_service_app_secret' ),
			'redirect_uri'                  => rest_url( 'mmed/v1/admin/webex/callback' ),
			'host_email'                    => get_option( 'mmed_webex_host_email', '' ),
		);
	}

	/**
	 * Encrypt a value for storage in wp_options.
	 *
	 * @param string $value Plain value.
	 * @return string
	 */
	private static function encrypt( $value ) {
		if ( '' === (string) $value ) {
			return '';
		}

		$key       = self::encryption_key();
		$iv        = openssl_random_pseudo_bytes( 16 );
		$encrypted = openssl_encrypt( (string) $value, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv );

		return base64_encode( $iv . $encrypted );
	}

	/**
	 * Decrypt a stored value from wp_options.
	 *
	 * @param string $value Encrypted value.
	 * @return string
	 */
	private static function decrypt( $value ) {
		if ( '' === (string) $value ) {
			return '';
		}

		$data = base64_decode( (string) $value, true );
		if ( false === $data || strlen( $data ) <= 16 ) {
			return (string) $value;
		}

		$iv        = substr( $data, 0, 16 );
		$encrypted = substr( $data, 16 );
		$plain     = openssl_decrypt( $encrypted, 'AES-256-CBC', self::encryption_key(), OPENSSL_RAW_DATA, $iv );

		return false === $plain ? '' : $plain;
	}

	/**
	 * Build a 32 byte AES key from wp_salt('auth').
	 *
	 * @return string
	 */
	private static function encryption_key() {
		return hash( 'sha256', wp_salt( 'auth' ), true );
	}

	/**
	 * Update an encrypted option.
	 *
	 * @param string $key   Option key.
	 * @param string $value Plain value.
	 * @return void
	 */
	private static function update_encrypted_option( $key, $value ) {
		update_option( $key, self::encrypt( sanitize_text_field( $value ) ), false );
	}

	/**
	 * Read an encrypted option with fallback for legacy plain values.
	 *
	 * @param string $key Option key.
	 * @return string
	 */
	private static function get_option_value( $key ) {
		return self::decrypt( get_option( $key, '' ) );
	}

	/**
	 * Get a valid access token, refreshing if expired.
	 *
	 * @return string|WP_Error
	 */
	private static function get_access_token() {
		$expiry = (int) get_option( 'mmed_webex_token_expiry', 0 );
		$token  = self::get_option_value( 'mmed_webex_access_token' );

		if ( ! empty( $token ) && time() < $expiry - 300 ) {
			return $token;
		}

		return self::refresh_token();
	}

	/**
	 * Refresh the access token using the refresh token.
	 *
	 * @return string|WP_Error
	 */
	private static function refresh_token() {
		$client_id     = self::get_option_value( 'mmed_webex_client_id' );
		$client_secret = self::get_option_value( 'mmed_webex_client_secret' );
		$refresh       = self::get_option_value( 'mmed_webex_refresh_token' );

		if ( empty( $client_id ) || empty( $client_secret ) || empty( $refresh ) ) {
			return new WP_Error( 'webex_not_configured', 'Webex credentials not configured.' );
		}

		$response = wp_remote_post(
			self::TOKEN_URL,
			array(
				'body'    => array(
					'grant_type'    => 'refresh_token',
					'client_id'     => $client_id,
					'client_secret' => $client_secret,
					'refresh_token' => $refresh,
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( ! empty( $body['access_token'] ) ) {
			self::update_encrypted_option( 'mmed_webex_access_token', $body['access_token'] );
			if ( ! empty( $body['refresh_token'] ) ) {
				self::update_encrypted_option( 'mmed_webex_refresh_token', $body['refresh_token'] );
			}
			update_option( 'mmed_webex_token_expiry', time() + (int) ( $body['expires_in'] ?? 0 ), false );
			return $body['access_token'];
		}

		return new WP_Error( 'webex_refresh_failed', 'Failed to refresh Webex token.', array( 'status' => 502, 'response' => $body ) );
	}

	/**
	 * Build the OAuth2 authorization URL.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_auth_url( $request ) {
		self::seed_default_credentials();

		$client_id    = self::get_option_value( 'mmed_webex_client_id' );
		$redirect_uri = rest_url( 'mmed/v1/admin/webex/callback' );
		$scopes       = 'meeting:schedules_write meeting:schedules_read meeting:participants_read meeting:participants_write spark:people_read';
		$state        = wp_create_nonce( 'mmed_webex_oauth' );

		$url = add_query_arg(
			array(
				'response_type' => 'code',
				'client_id'     => $client_id,
				'redirect_uri'  => $redirect_uri,
				'scope'         => $scopes,
				'state'         => $state,
			),
			self::AUTH_URL
		);

		return new WP_REST_Response( array( 'auth_url' => $url ), 200 );
	}

	/**
	 * Handle OAuth2 callback and exchange the code for tokens.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return void
	 */
	public static function handle_oauth_callback( $request ) {
		$code  = sanitize_text_field( $request->get_param( 'code' ) );
		$state = sanitize_text_field( $request->get_param( 'state' ) );

		if ( ! wp_verify_nonce( $state, 'mmed_webex_oauth' ) ) {
			wp_die( 'Invalid state parameter.' );
		}

		$client_id     = self::get_option_value( 'mmed_webex_client_id' );
		$client_secret = self::get_option_value( 'mmed_webex_client_secret' );
		$redirect_uri  = rest_url( 'mmed/v1/admin/webex/callback' );

		$response = wp_remote_post(
			self::TOKEN_URL,
			array(
				'body'    => array(
					'grant_type'    => 'authorization_code',
					'client_id'     => $client_id,
					'client_secret' => $client_secret,
					'code'          => $code,
					'redirect_uri'  => $redirect_uri,
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_die( 'Webex OAuth failed: ' . esc_html( $response->get_error_message() ) );
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( ! empty( $body['access_token'] ) ) {
			self::update_encrypted_option( 'mmed_webex_access_token', $body['access_token'] );
			if ( ! empty( $body['refresh_token'] ) ) {
				self::update_encrypted_option( 'mmed_webex_refresh_token', $body['refresh_token'] );
			}
			update_option( 'mmed_webex_token_expiry', time() + (int) ( $body['expires_in'] ?? 0 ), false );

			$me = self::api_get( '/people/me', $body['access_token'] );
			if ( ! is_wp_error( $me ) && ! empty( $me['emails'][0] ) ) {
				update_option( 'mmed_webex_host_email', sanitize_email( $me['emails'][0] ), false );
			}

			wp_safe_redirect( admin_url( 'admin.php?page=mmed-sessions&webex=connected' ) );
			exit;
		}

		wp_die( 'Webex OAuth failed: no access token received.' );
	}

	/**
	 * Return connection status.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_status( $request ) {
		$token  = self::get_access_token();
		$status = is_wp_error( $token ) ? 'disconnected' : 'connected';

		return new WP_REST_Response(
			array(
				'status'     => $status,
				'host_email' => get_option( 'mmed_webex_host_email', '' ),
			),
			200
		);
	}

	/**
	 * Return saved settings to the admin UI.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_settings( $request ) {
		return new WP_REST_Response( self::get_admin_settings(), 200 );
	}

	/**
	 * Make a GET request to the Webex API.
	 *
	 * @param string      $endpoint Endpoint path.
	 * @param string|null $token    Optional token.
	 * @return array|WP_Error
	 */
	private static function api_get( $endpoint, $token = null ) {
		if ( null === $token ) {
			$token = self::get_access_token();
			if ( is_wp_error( $token ) ) {
				return $token;
			}
		}

		$response = wp_remote_get(
			self::API_BASE . $endpoint,
			array(
				'headers' => array( 'Authorization' => 'Bearer ' . $token ),
				'timeout' => 15,
			)
		);

		return self::decode_response( $response );
	}

	/**
	 * Make a POST request to the Webex API.
	 *
	 * @param string $endpoint Endpoint path.
	 * @param array  $body     Request body.
	 * @return array|WP_Error
	 */
	private static function api_post( $endpoint, $body ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$response = wp_remote_post(
			self::API_BASE . $endpoint,
			array(
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
				'timeout' => 15,
			)
		);

		return self::decode_response( $response );
	}

	/**
	 * Make a DELETE request to the Webex API.
	 *
	 * @param string $endpoint Endpoint path.
	 * @return bool|WP_Error
	 */
	private static function api_delete( $endpoint ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$response = wp_remote_request(
			self::API_BASE . $endpoint,
			array(
				'method'  => 'DELETE',
				'headers' => array( 'Authorization' => 'Bearer ' . $token ),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		return wp_remote_retrieve_response_code( $response ) < 300;
	}

	/**
	 * Decode an HTTP response.
	 *
	 * @param array|WP_Error $response HTTP response.
	 * @return array|WP_Error
	 */
	private static function decode_response( $response ) {
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		$data = is_array( $data ) ? $data : array();

		if ( $code >= 400 ) {
			return new WP_Error(
				'webex_api_error',
				$data['message'] ?? 'Webex API error',
				array(
					'status'   => $code,
					'response' => $data,
				)
			);
		}

		return $data;
	}

	/**
	 * Create a Webex meeting.
	 *
	 * @param array $params Meeting parameters.
	 * @return array|WP_Error
	 */
	public static function create_meeting( $params ) {
		$body = array(
			'title'                    => sanitize_text_field( $params['title'] ?? '' ),
			'start'                    => sanitize_text_field( $params['start'] ?? '' ),
			'end'                      => sanitize_text_field( $params['end'] ?? '' ),
			'timezone'                 => sanitize_text_field( $params['timezone'] ?? 'America/New_York' ),
			'enabledAutoRecordMeeting' => false,
			'enabledJoinBeforeHost'    => true,
			'joinBeforeHostMinutes'    => 5,
			'allowAnyUserToBeCoHost'   => false,
		);

		if ( ! empty( $params['recurrence'] ) ) {
			$body['recurrence'] = sanitize_text_field( $params['recurrence'] );
		}

		return self::api_post( '/meetings', $body );
	}

	/**
	 * Invite a single attendee to a meeting.
	 *
	 * @param string $meeting_id   Webex meeting ID.
	 * @param string $email        Email.
	 * @param string $display_name Display name.
	 * @param bool   $co_host      Whether attendee is cohost.
	 * @return array|WP_Error
	 */
	public static function invite_attendee( $meeting_id, $email, $display_name = '', $co_host = false ) {
		return self::api_post(
			'/meetingInvitees',
			array(
				'meetingId'   => sanitize_text_field( $meeting_id ),
				'email'       => sanitize_email( $email ),
				'displayName' => sanitize_text_field( $display_name ),
				'coHost'      => (bool) $co_host,
			)
		);
	}

	/**
	 * Batch invite attendees with rate limiting.
	 *
	 * @param string $meeting_id Webex meeting ID.
	 * @param array  $attendees  Attendees.
	 * @return array
	 */
	public static function invite_attendees_batch( $meeting_id, $attendees ) {
		$results = array(
			'invited' => 0,
			'errors'  => array(),
		);

		foreach ( $attendees as $i => $attendee ) {
			if ( $i > 0 ) {
				usleep( 600000 );
			}

			$result = self::invite_attendee(
				$meeting_id,
				$attendee['email'] ?? '',
				$attendee['displayName'] ?? '',
				false
			);

			if ( is_wp_error( $result ) ) {
				$results['errors'][] = sanitize_email( $attendee['email'] ?? '' );
			} else {
				$results['invited']++;
			}
		}

		return $results;
	}

	/**
	 * List meetings for a date range.
	 *
	 * @param string $from From date.
	 * @param string $to   To date.
	 * @return array|WP_Error
	 */
	public static function list_meetings( $from, $to ) {
		return self::api_get( '/meetings?from=' . rawurlencode( $from ) . '&to=' . rawurlencode( $to ) );
	}

	/**
	 * Get meeting details.
	 *
	 * @param string $meeting_id Webex meeting ID.
	 * @return array|WP_Error
	 */
	public static function get_meeting( $meeting_id ) {
		return self::api_get( '/meetings/' . rawurlencode( $meeting_id ) );
	}

	/**
	 * Delete or cancel a meeting.
	 *
	 * @param string $meeting_id Webex meeting ID.
	 * @return bool|WP_Error
	 */
	public static function delete_meeting( $meeting_id ) {
		return self::api_delete( '/meetings/' . rawurlencode( $meeting_id ) );
	}

	/**
	 * Generate a guest token for a student via Service App.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function generate_guest_token( $request ) {
		$user = wp_get_current_user();

		$service_app_id     = self::get_option_value( 'mmed_webex_service_app_id' );
		$service_app_secret = self::get_option_value( 'mmed_webex_service_app_secret' );

		if ( empty( $service_app_id ) || empty( $service_app_secret ) ) {
			return new WP_Error( 'not_configured', 'Webex Service App not configured.', array( 'status' => 500 ) );
		}

		$token_response = wp_remote_post(
			self::TOKEN_URL,
			array(
				'body'    => array(
					'grant_type'    => 'client_credentials',
					'client_id'     => $service_app_id,
					'client_secret' => $service_app_secret,
					'scope'         => 'guest-meeting:rw',
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $token_response ) ) {
			return new WP_Error( 'webex_auth_failed', 'Could not authenticate Service App with Webex.', array( 'status' => 502 ) );
		}

		$token_body = json_decode( wp_remote_retrieve_body( $token_response ), true );

		if ( empty( $token_body['access_token'] ) ) {
			return new WP_Error( 'webex_token_missing', 'No Service App token received from Webex.', array( 'status' => 502 ) );
		}

		$guest_response = wp_remote_post(
			self::API_BASE . '/guests',
			array(
				'headers' => array(
					'Authorization' => 'Bearer ' . $token_body['access_token'],
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode(
					array(
						'subject'     => 'mmed-student-' . $user->ID,
						'displayName' => $user->display_name,
					)
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $guest_response ) ) {
			return new WP_Error( 'webex_guest_failed', 'Could not create guest user.', array( 'status' => 502 ) );
		}

		$guest_body = json_decode( wp_remote_retrieve_body( $guest_response ), true );

		if ( empty( $guest_body['accessToken'] ) ) {
			return new WP_Error( 'webex_guest_token_missing', 'No guest access token received.', array( 'status' => 502 ) );
		}

		return new WP_REST_Response(
			array(
				'token'     => $guest_body['accessToken'],
				'expiresIn' => $guest_body['expiresIn'] ?? 5400,
			),
			200
		);
	}

	/**
	 * Save Webex settings from the admin form.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function save_settings( $request ) {
		$fields = array(
			'mmed_webex_client_id',
			'mmed_webex_client_secret',
			'mmed_webex_service_app_id',
			'mmed_webex_service_app_secret',
		);

		foreach ( $fields as $key ) {
			$val = $request->get_param( $key );
			if ( null !== $val && '' !== $val ) {
				self::update_encrypted_option( $key, $val );
			}
		}

		return new WP_REST_Response(
			array(
				'saved'    => true,
				'settings' => self::get_admin_settings(),
			),
			200
		);
	}
}

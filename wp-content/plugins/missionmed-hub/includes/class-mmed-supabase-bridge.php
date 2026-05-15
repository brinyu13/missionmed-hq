<?php
/**
 * MissionMed Matrix Supabase identity bridge.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves WordPress users to Supabase Auth users by email.
 */
class MMED_Supabase_Bridge {

	const USER_META_UUID  = '_mmed_supabase_uuid';
	const USERS_TRANSIENT = 'mmed_supabase_users';
	const NONE_VALUE      = 'none';

	/**
	 * Reserved for future hooks.
	 *
	 * @return void
	 */
	public static function init() {
		// Read-only bridge; no runtime hooks required yet.
	}

	/**
	 * Resolve or return cached Supabase UUID for a WordPress user.
	 *
	 * @param int  $wp_user_id WordPress user ID.
	 * @param bool $force      Force a fresh Auth Admin lookup.
	 * @return string UUID string, "none", or empty string.
	 */
	public static function get_supabase_uuid( $wp_user_id, $force = false ) {
		$wp_user_id = absint( $wp_user_id );
		if ( ! $wp_user_id || ! self::configured() ) {
			return '';
		}

		if ( ! $force ) {
			$cached = sanitize_text_field( get_user_meta( $wp_user_id, self::USER_META_UUID, true ) );
			if ( self::NONE_VALUE === $cached || self::is_valid_uuid( $cached ) ) {
				return $cached;
			}
		}

		$user = get_user_by( 'id', $wp_user_id );
		if ( ! $user || empty( $user->user_email ) ) {
			update_user_meta( $wp_user_id, self::USER_META_UUID, self::NONE_VALUE );
			return self::NONE_VALUE;
		}

		$users = self::get_supabase_users( $force );
		if ( is_wp_error( $users ) ) {
			return '';
		}

		$match = self::find_user_by_email( $user->user_email, $users );
		if ( $match && ! empty( $match['id'] ) && self::is_valid_uuid( $match['id'] ) ) {
			update_user_meta( $wp_user_id, self::USER_META_UUID, $match['id'] );
			return $match['id'];
		}

		update_user_meta( $wp_user_id, self::USER_META_UUID, self::NONE_VALUE );
		return self::NONE_VALUE;
	}

	/**
	 * Clear current cache and run a fresh lookup for one user.
	 *
	 * @param int $wp_user_id WordPress user ID.
	 * @return array
	 */
	public static function relink_user( $wp_user_id ) {
		$wp_user_id = absint( $wp_user_id );
		if ( ! self::configured() ) {
			return array(
				'linked'  => false,
				'status'  => 'not_configured',
				'message' => 'Supabase account linking is not configured yet.',
			);
		}

		delete_user_meta( $wp_user_id, self::USER_META_UUID );
		$uuid = self::get_supabase_uuid( $wp_user_id, true );

		if ( self::is_valid_uuid( $uuid ) ) {
			return array(
				'linked'  => true,
				'status'  => 'linked',
				'message' => 'Supabase account linked.',
			);
		}

		if ( self::NONE_VALUE === $uuid ) {
			return array(
				'linked'  => false,
				'status'  => 'not_found',
				'message' => 'No linked Supabase account found for this WordPress email.',
			);
		}

		return array(
			'linked'  => false,
			'status'  => 'pending',
			'message' => 'Supabase account lookup could not be completed right now.',
		);
	}

	/**
	 * Return server-side Supabase request headers.
	 *
	 * @return array
	 */
	public static function get_supabase_client_headers() {
		if ( ! self::configured() ) {
			return array();
		}

		return array(
			'apikey'        => (string) MMED_SUPABASE_SERVICE_KEY,
			'Authorization' => 'Bearer ' . (string) MMED_SUPABASE_SERVICE_KEY,
			'Accept'        => 'application/json',
		);
	}

	/**
	 * Whether Supabase constants are present.
	 *
	 * @return bool
	 */
	public static function configured() {
		return defined( 'MMED_SUPABASE_URL' )
			&& defined( 'MMED_SUPABASE_SERVICE_KEY' )
			&& '' !== trim( (string) MMED_SUPABASE_URL )
			&& '' !== trim( (string) MMED_SUPABASE_SERVICE_KEY );
	}

	/**
	 * Bulk-link subscriber/student accounts by email.
	 *
	 * @return array
	 */
	public static function sync_all_users() {
		$users = self::get_linkable_wp_users();
		$total = count( $users );

		if ( ! self::configured() ) {
			return array(
				'total'     => $total,
				'linked'    => 0,
				'not_found' => 0,
				'pending'   => $total,
				'message'   => 'Supabase account linking is not configured yet.',
			);
		}

		$supabase_users = self::get_supabase_users( true );
		if ( is_wp_error( $supabase_users ) ) {
			return array(
				'total'     => $total,
				'linked'    => 0,
				'not_found' => 0,
				'pending'   => $total,
				'message'   => $supabase_users->get_error_message(),
			);
		}

		$linked    = 0;
		$not_found = 0;

		foreach ( $users as $user ) {
			$match = self::find_user_by_email( $user->user_email, $supabase_users );
			if ( $match && ! empty( $match['id'] ) && self::is_valid_uuid( $match['id'] ) ) {
				update_user_meta( $user->ID, self::USER_META_UUID, $match['id'] );
				$linked++;
				continue;
			}

			update_user_meta( $user->ID, self::USER_META_UUID, self::NONE_VALUE );
			$not_found++;
		}

		return array(
			'total'     => $total,
			'linked'    => $linked,
			'not_found' => $not_found,
			'pending'   => 0,
			'message'   => sprintf( '%d of %d users linked.', $linked, $total ),
		);
	}

	/**
	 * Return table rows for the admin linking section.
	 *
	 * @return array
	 */
	public static function get_admin_link_rows() {
		$rows = array();

		foreach ( self::get_linkable_wp_users() as $user ) {
			$uuid   = sanitize_text_field( get_user_meta( $user->ID, self::USER_META_UUID, true ) );
			$status = self::status_from_uuid( $uuid );

			$rows[] = array(
				'id'           => (int) $user->ID,
				'display_name' => $user->display_name,
				'email'        => $user->user_email,
				'uuid'         => self::is_valid_uuid( $uuid ) ? $uuid : '',
				'status'       => $status,
			);
		}

		return $rows;
	}

	/**
	 * Count linked users for the admin linking section.
	 *
	 * @param array $rows Optional prebuilt rows.
	 * @return array
	 */
	public static function get_admin_link_counts( $rows = array() ) {
		if ( empty( $rows ) ) {
			$rows = self::get_admin_link_rows();
		}

		$linked = 0;
		foreach ( $rows as $row ) {
			if ( 'linked' === ( $row['status'] ?? '' ) ) {
				$linked++;
			}
		}

		return array(
			'linked' => $linked,
			'total'  => count( $rows ),
		);
	}

	/**
	 * Determine if a string is a UUID.
	 *
	 * @param string $value Candidate value.
	 * @return bool
	 */
	public static function is_valid_uuid( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value );
	}

	/**
	 * Return linkable WordPress users.
	 *
	 * @return array
	 */
	protected static function get_linkable_wp_users() {
		return get_users(
			array(
				'role__in' => array( 'subscriber', 'student' ),
				'orderby'  => 'display_name',
				'order'    => 'ASC',
				'fields'   => 'all',
			)
		);
	}

	/**
	 * Fetch and cache Supabase Auth users.
	 *
	 * @param bool $force_refresh Whether to bypass transient cache.
	 * @return array|WP_Error
	 */
	protected static function get_supabase_users( $force_refresh = false ) {
		if ( ! self::configured() ) {
			return new WP_Error( 'mmed_supabase_not_configured', 'Supabase account linking is not configured yet.' );
		}

		if ( $force_refresh ) {
			delete_transient( self::USERS_TRANSIENT );
		}

		$cached = get_transient( self::USERS_TRANSIENT );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$base    = untrailingslashit( (string) MMED_SUPABASE_URL );
		$headers = self::get_supabase_client_headers();
		$users   = array();
		$per_page = 1000;

		for ( $page = 1; $page <= 10; $page++ ) {
			$url = add_query_arg(
				array(
					'page'     => $page,
					'per_page' => $per_page,
				),
				$base . '/auth/v1/admin/users'
			);

			$response = wp_remote_get(
				$url,
				array(
					'timeout' => 15,
					'headers' => $headers,
				)
			);

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$code = (int) wp_remote_retrieve_response_code( $response );
			$body = (string) wp_remote_retrieve_body( $response );
			if ( $code < 200 || $code >= 300 ) {
				return new WP_Error( 'mmed_supabase_auth_users_failed', 'Supabase Auth users could not be read.', array( 'status' => $code ) );
			}

			$decoded    = json_decode( $body, true );
			$page_users = self::extract_users_from_response( $decoded );

			foreach ( $page_users as $user ) {
				$normalized = self::normalize_supabase_user( $user );
				if ( $normalized ) {
					$users[] = $normalized;
				}
			}

			$total = isset( $decoded['total'] ) ? absint( $decoded['total'] ) : 0;
			if ( count( $page_users ) < $per_page || ( $total && count( $users ) >= $total ) ) {
				break;
			}
		}

		set_transient( self::USERS_TRANSIENT, $users, HOUR_IN_SECONDS );
		return $users;
	}

	/**
	 * Extract user list from supported Supabase response shapes.
	 *
	 * @param mixed $decoded Decoded JSON.
	 * @return array
	 */
	protected static function extract_users_from_response( $decoded ) {
		if ( isset( $decoded['users'] ) && is_array( $decoded['users'] ) ) {
			return $decoded['users'];
		}

		if ( is_array( $decoded ) && isset( $decoded[0] ) ) {
			return $decoded;
		}

		return array();
	}

	/**
	 * Keep only the identity fields Matrix needs.
	 *
	 * @param array $user Supabase Auth user.
	 * @return array
	 */
	protected static function normalize_supabase_user( $user ) {
		if ( ! is_array( $user ) ) {
			return array();
		}

		$id    = sanitize_text_field( $user['id'] ?? '' );
		$email = sanitize_email( $user['email'] ?? '' );

		if ( ! self::is_valid_uuid( $id ) || '' === $email ) {
			return array();
		}

		return array(
			'id'    => $id,
			'email' => strtolower( $email ),
		);
	}

	/**
	 * Find a Supabase user by email.
	 *
	 * @param string $email WordPress email.
	 * @param array  $users Supabase users.
	 * @return array
	 */
	protected static function find_user_by_email( $email, $users ) {
		$email = strtolower( sanitize_email( $email ) );
		if ( '' === $email ) {
			return array();
		}

		foreach ( $users as $user ) {
			if ( $email === strtolower( sanitize_email( $user['email'] ?? '' ) ) ) {
				return $user;
			}
		}

		return array();
	}

	/**
	 * Convert a stored UUID marker to admin status.
	 *
	 * @param string $uuid Stored meta value.
	 * @return string
	 */
	protected static function status_from_uuid( $uuid ) {
		if ( self::is_valid_uuid( $uuid ) ) {
			return 'linked';
		}

		if ( self::NONE_VALUE === $uuid ) {
			return 'not found';
		}

		return 'pending';
	}
}

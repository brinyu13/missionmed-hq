<?php
/**
 * MissionMed Matrix Arena read-only bridge.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads existing Arena Supabase data for Matrix summary cards.
 */
class MMED_Arena {

	/**
	 * Initialize the read-only bridge.
	 *
	 * @return void
	 */
	public static function init() {
		// Read-only bridge; Arena remains the standalone runtime.
	}

	/**
	 * Return Arena stats for a WordPress user.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	public static function get_player_stats( $user_id ) {
		$user_id = absint( $user_id );

		if ( ! self::configured() ) {
			return self::empty_response(
				'Arena sync is not configured yet. Add the Supabase service key on the server to enable live stats.',
				false,
				false
			);
		}

		$supabase_uuid = self::get_supabase_uuid( $user_id );
		if ( 'none' === $supabase_uuid ) {
			return self::empty_response(
				'No linked Supabase account found for this WordPress email.',
				true,
				false,
				'not_found'
			);
		}

		if ( ! self::valid_uuid( $supabase_uuid ) ) {
			return self::empty_response(
				'Link your Arena account to Matrix to show your live training stats here.',
				true,
				false,
				'pending'
			);
		}

		$profile = self::player_profile( $supabase_uuid );
		if ( is_wp_error( $profile ) ) {
			return self::empty_response( $profile->get_error_message(), true, true );
		}

		$avatar          = self::active_avatar( $supabase_uuid );
		$student_profile = self::student_profile( $supabase_uuid );
		$diagnostic      = self::latest_diagnostic( $supabase_uuid );
		$activity        = self::answer_activity( $supabase_uuid, $diagnostic );
		$matches_week    = self::matches_last_7_days( $supabase_uuid );
		$player          = self::format_player( is_array( $profile ) ? $profile : array(), is_array( $avatar ) ? $avatar : array() );

		if ( empty( $player['rank'] ) && $player['total_score'] > 0 ) {
			$player['rank'] = self::leaderboard_rank( $supabase_uuid );
		}

		$activity['matches_last_7_days'] = $matches_week;

		return array(
			'player'             => $player,
			'recent_activity'    => $activity,
			'student_profile'    => is_wp_error( $student_profile ) ? array() : self::format_student_profile( $student_profile ),
			'diagnostic'         => is_wp_error( $diagnostic ) ? array() : self::format_diagnostic( $diagnostic ),
			'supabase_connected' => true,
			'configured'         => true,
			'linked'             => true,
			'message'            => '',
			'last_updated'       => self::latest_timestamp(
				$profile['updated_at'] ?? '',
				$profile['last_active_at'] ?? '',
				is_wp_error( $diagnostic ) ? '' : ( $diagnostic['updated_at'] ?? '' ),
				is_wp_error( $diagnostic ) ? '' : ( $diagnostic['created_at'] ?? '' )
			),
			'standalone_url'     => self::standalone_url(),
		);
	}

	/**
	 * Whether Supabase constants are available.
	 *
	 * @return bool
	 */
	protected static function configured() {
		return class_exists( 'MMED_Supabase_Bridge' ) && MMED_Supabase_Bridge::configured();
	}

	/**
	 * Resolve the WordPress-to-Supabase identity bridge.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return string
	 */
	protected static function get_supabase_uuid( $user_id ) {
		return class_exists( 'MMED_Supabase_Bridge' )
			? MMED_Supabase_Bridge::get_supabase_uuid( $user_id )
			: '';
	}

	/**
	 * Whether a value is a Supabase UUID.
	 *
	 * @param string $value Candidate value.
	 * @return bool
	 */
	protected static function valid_uuid( $value ) {
		return class_exists( 'MMED_Supabase_Bridge' ) && MMED_Supabase_Bridge::is_valid_uuid( $value );
	}

	/**
	 * Fetch the player profile. Arena stores the player id as player_id.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @return array|WP_Error
	 */
	protected static function player_profile( $supabase_uuid ) {
		$rows = self::supabase_get(
			'player_profiles',
			array(
				'player_id' => 'eq.' . $supabase_uuid,
				'select'    => '*',
				'limit'     => '1',
			)
		);

		if ( is_wp_error( $rows ) ) {
			return $rows;
		}

		return ! empty( $rows[0] ) && is_array( $rows[0] ) ? $rows[0] : array();
	}

	/**
	 * Fetch the active avatar or latest avatar row.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @return array|WP_Error
	 */
	protected static function active_avatar( $supabase_uuid ) {
		$rows = self::supabase_get(
			'user_avatars',
			array(
				'user_id'   => 'eq.' . $supabase_uuid,
				'is_active' => 'eq.true',
				'select'    => 'avatar_url,thumbnail_url,is_active,created_at',
				'order'     => 'created_at.desc',
				'limit'     => '1',
			)
		);

		if ( is_wp_error( $rows ) || ! empty( $rows[0] ) ) {
			return is_wp_error( $rows ) ? array() : $rows[0];
		}

		$rows = self::supabase_get(
			'user_avatars',
			array(
				'user_id' => 'eq.' . $supabase_uuid,
				'select'  => 'avatar_url,thumbnail_url,is_active,created_at',
				'order'   => 'created_at.desc',
				'limit'   => '1',
			)
		);

		return ! is_wp_error( $rows ) && ! empty( $rows[0] ) ? $rows[0] : array();
	}

	/**
	 * Fetch Matrix/Arena student enrollment profile.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @return array|WP_Error
	 */
	protected static function student_profile( $supabase_uuid ) {
		$rows = self::supabase_get(
			'student_profiles',
			array(
				'user_id' => 'eq.' . $supabase_uuid,
				'select'  => '*',
				'limit'   => '1',
			)
		);

		if ( is_wp_error( $rows ) ) {
			return $rows;
		}

		return ! empty( $rows[0] ) && is_array( $rows[0] ) ? $rows[0] : array();
	}

	/**
	 * Fetch latest diagnostic report, if present.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @return array|WP_Error
	 */
	protected static function latest_diagnostic( $supabase_uuid ) {
		$rows = self::supabase_get(
			'diagnostic_reports',
			array(
				'user_id' => 'eq.' . $supabase_uuid,
				'select'  => '*',
				'order'   => 'created_at.desc',
				'limit'   => '1',
			)
		);

		if ( is_wp_error( $rows ) ) {
			return $rows;
		}

		return ! empty( $rows[0] ) && is_array( $rows[0] ) ? $rows[0] : array();
	}

	/**
	 * Summarize qstat_answers_v1.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @param mixed  $diagnostic     Diagnostic fallback.
	 * @return array
	 */
	protected static function answer_activity( $supabase_uuid, $diagnostic ) {
		$rows = self::supabase_get(
			'qstat_answers_v1',
			array(
				'user_id' => 'eq.' . $supabase_uuid,
				'select'  => 'is_correct,answered_at',
				'order'   => 'answered_at.desc',
				'limit'   => '1000',
			)
		);

		if ( is_wp_error( $rows ) ) {
			return array(
				'matches_last_7_days' => 0,
				'accuracy_last_7_days' => is_wp_error( $diagnostic ) ? 0 : self::numeric_value( $diagnostic, array( 'accuracy_pct', 'accuracy_percent', 'accuracy' ) ),
				'answers_total'       => 0,
			);
		}

		$cutoff       = strtotime( '-7 days' );
		$recent_total = 0;
		$recent_right = 0;

		foreach ( $rows as $row ) {
			$answered_at = strtotime( $row['answered_at'] ?? '' );
			if ( $answered_at && $answered_at >= $cutoff ) {
				$recent_total++;
				if ( self::truthy_answer( $row['is_correct'] ?? null ) ) {
					$recent_right++;
				}
			}
		}

		$accuracy = $recent_total > 0 ? round( ( $recent_right / $recent_total ) * 100, 1 ) : 0;
		if ( 0 === $recent_total && ! is_wp_error( $diagnostic ) ) {
			$accuracy = self::numeric_value( $diagnostic, array( 'accuracy_pct', 'accuracy_percent', 'accuracy' ) );
		}

		return array(
			'matches_last_7_days'  => 0,
			'accuracy_last_7_days' => (float) $accuracy,
			'answers_total'        => count( $rows ),
		);
	}

	/**
	 * Count recent match-player snapshots.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @return int
	 */
	protected static function matches_last_7_days( $supabase_uuid ) {
		$rows = self::supabase_get(
			'match_players',
			array(
				'player_id'  => 'eq.' . $supabase_uuid,
				'captured_at' => 'gte.' . gmdate( 'c', strtotime( '-7 days' ) ),
				'select'     => 'match_id,captured_at',
				'limit'      => '200',
			)
		);

		return is_wp_error( $rows ) ? 0 : count( $rows );
	}

	/**
	 * Compute leaderboard rank from rating order.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @return int
	 */
	protected static function leaderboard_rank( $supabase_uuid ) {
		$rows = self::supabase_get(
			'player_profiles',
			array(
				'select' => 'player_id,rating',
				'order'  => 'rating.desc',
				'limit'  => '1000',
			)
		);

		if ( is_wp_error( $rows ) ) {
			return 0;
		}

		foreach ( $rows as $index => $row ) {
			if ( isset( $row['player_id'] ) && (string) $row['player_id'] === (string) $supabase_uuid ) {
				return $index + 1;
			}
		}

		return 0;
	}

	/**
	 * Format player profile to Matrix REST contract.
	 *
	 * @param array $profile Player profile row.
	 * @param array $avatar  Avatar row.
	 * @return array
	 */
	protected static function format_player( $profile, $avatar ) {
		$wins    = self::numeric_value( $profile, array( 'wins' ) );
		$losses  = self::numeric_value( $profile, array( 'losses' ) );
		$draws   = self::numeric_value( $profile, array( 'draws' ) );
		$played  = self::numeric_value( $profile, array( 'matches_played', 'games_played', 'duels_played' ) );
		$played  = $played ? $played : $wins + $losses + $draws;
		$rate    = self::numeric_value( $profile, array( 'win_rate', 'win_pct', 'win_percentage' ) );
		$rate    = $rate ? $rate : ( $played > 0 ? round( ( $wins / $played ) * 100, 1 ) : 0 );
		$score   = self::numeric_value( $profile, array( 'total_score', 'score', 'rating' ) );
		$avatar_url = sanitize_url( $avatar['thumbnail_url'] ?? $avatar['avatar_url'] ?? '' );

		return array(
			'rank'           => (int) self::numeric_value( $profile, array( 'rank', 'arena_rank', 'leaderboard_rank' ) ),
			'total_score'    => (int) $score,
			'win_streak'     => (int) self::numeric_value( $profile, array( 'win_streak', 'duel_streak', 'daily_streak' ) ),
			'matches_played' => (int) $played,
			'win_rate'       => (float) $rate,
			'avatar_url'     => $avatar_url,
			'display_name'   => sanitize_text_field( $profile['display_name'] ?? '' ),
		);
	}

	/**
	 * Format student profile to safe Matrix fields.
	 *
	 * @param array $profile Student profile row.
	 * @return array
	 */
	protected static function format_student_profile( $profile ) {
		return array(
			'enrollment_tier'        => self::sanitize_list( $profile['enrollment_tier'] ?? array() ),
			'enrollment_status'      => sanitize_key( $profile['enrollment_status'] ?? '' ),
			'enrollment_verified_at' => sanitize_text_field( $profile['enrollment_verified_at'] ?? '' ),
			'updated_at'             => sanitize_text_field( $profile['updated_at'] ?? '' ),
		);
	}

	/**
	 * Format diagnostic report to safe Matrix fields.
	 *
	 * @param array $diagnostic Diagnostic row.
	 * @return array
	 */
	protected static function format_diagnostic( $diagnostic ) {
		return array(
			'accuracy_pct'     => (float) self::numeric_value( $diagnostic, array( 'accuracy_pct', 'accuracy_percent', 'accuracy' ) ),
			'snapshot_version' => absint( $diagnostic['snapshot_version'] ?? 0 ),
			'summary'          => sanitize_text_field( $diagnostic['summary'] ?? $diagnostic['headline'] ?? '' ),
			'created_at'       => sanitize_text_field( $diagnostic['created_at'] ?? '' ),
		);
	}

	/**
	 * Query a Supabase REST table.
	 *
	 * @param string $table  Table name.
	 * @param array  $params Query params.
	 * @return array|WP_Error
	 */
	protected static function supabase_get( $table, $params ) {
		$base = untrailingslashit( (string) MMED_SUPABASE_URL );
		$url  = add_query_arg( $params, $base . '/rest/v1/' . rawurlencode( sanitize_key( $table ) ) );
		$headers = class_exists( 'MMED_Supabase_Bridge' ) ? MMED_Supabase_Bridge::get_supabase_client_headers() : array();

		if ( empty( $headers ) ) {
			return new WP_Error( 'mmed_arena_supabase_not_configured', 'Arena is not configured yet.' );
		}

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 12,
				'headers' => $headers,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error( 'mmed_arena_supabase_error', 'Arena sync is unavailable right now.', array( 'status' => $code ) );
		}

		$decoded = json_decode( $body, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Extract the first numeric value from known keys.
	 *
	 * @param array $row  Row data.
	 * @param array $keys Candidate keys.
	 * @return float
	 */
	protected static function numeric_value( $row, $keys ) {
		foreach ( $keys as $key ) {
			if ( isset( $row[ $key ] ) && is_numeric( $row[ $key ] ) ) {
				return (float) $row[ $key ];
			}
		}

		return 0;
	}

	/**
	 * Normalize a boolean answer value.
	 *
	 * @param mixed $value Answer value.
	 * @return bool
	 */
	protected static function truthy_answer( $value ) {
		if ( is_bool( $value ) ) {
			return $value;
		}

		return in_array( strtolower( (string) $value ), array( '1', 'true', 'yes', 'correct' ), true );
	}

	/**
	 * Sanitize arrays or PostgREST text-array strings.
	 *
	 * @param mixed $value Raw value.
	 * @return array
	 */
	protected static function sanitize_list( $value ) {
		if ( is_string( $value ) ) {
			$value = trim( $value, '{}' );
			$value = '' === $value ? array() : explode( ',', $value );
		}

		if ( ! is_array( $value ) ) {
			return array();
		}

		return array_values( array_map( 'sanitize_text_field', $value ) );
	}

	/**
	 * Empty response with explicit configuration/link state.
	 *
	 * @param string $message    User-facing message.
	 * @param bool   $configured Whether Supabase is configured.
	 * @param bool   $connected  Whether a Supabase request was attempted.
	 * @param string $link_status Link status.
	 * @return array
	 */
	protected static function empty_response( $message, $configured, $connected, $link_status = 'pending' ) {
		return array(
			'player'             => array(
				'rank'           => 0,
				'total_score'    => 0,
				'win_streak'     => 0,
				'matches_played' => 0,
				'win_rate'       => 0,
				'avatar_url'     => '',
				'display_name'   => '',
			),
			'recent_activity'    => array(
				'matches_last_7_days'  => 0,
				'accuracy_last_7_days' => 0,
				'answers_total'        => 0,
			),
			'student_profile'    => array(),
			'diagnostic'         => array(),
			'supabase_connected' => (bool) $connected,
			'configured'         => (bool) $configured,
			'linked'             => false,
			'link_status'        => sanitize_key( $link_status ),
			'relink_available'   => (bool) $configured,
			'message'            => $message,
			'last_updated'       => '',
			'standalone_url'     => self::standalone_url(),
		);
	}

	/**
	 * Pick latest non-empty timestamp.
	 *
	 * @param string ...$values Timestamp values.
	 * @return string
	 */
	protected static function latest_timestamp( ...$values ) {
		$latest = '';
		foreach ( $values as $value ) {
			if ( ! $value ) {
				continue;
			}
			if ( '' === $latest || strtotime( $value ) > strtotime( $latest ) ) {
				$latest = sanitize_text_field( $value );
			}
		}
		return $latest;
	}

	/**
	 * Standalone Arena launcher URL.
	 *
	 * @return string
	 */
	protected static function standalone_url() {
		return '/homepage-arena/';
	}
}

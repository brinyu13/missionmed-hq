<?php
/**
 * MissionMed Matrix RankListIQ read-only bridge.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads RankListIQ Supabase data for the current WordPress user.
 */
class MMED_Ranklist {

	/**
	 * Initialize the read-only bridge.
	 *
	 * @return void
	 */
	public static function init() {
		// Read-only bridge; no WordPress tables are created for this integration.
	}

	/**
	 * Return the current user's RankListIQ summary.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	public static function get_user_ranklist( $user_id ) {
		$user_id = absint( $user_id );

		if ( ! self::configured() ) {
			return self::empty_response(
				'RankListIQ is not configured yet. Add the Supabase service key on the server to enable live sync.',
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
				'Link your RankListIQ account to Matrix to show your ranked programs here.',
				true,
				false,
				'pending'
			);
		}

		$ranklists = self::supabase_get(
			'ranklists',
			array(
				'user_id' => 'eq.' . $supabase_uuid,
				'select'  => '*',
			)
		);

		if ( is_wp_error( $ranklists ) ) {
			return self::empty_response( $ranklists->get_error_message(), true, true );
		}

		$programs     = array();
		$last_updated = '';

		foreach ( $ranklists as $ranklist ) {
			$ranklist_id = sanitize_text_field( $ranklist['id'] ?? '' );
			$version     = $ranklist_id ? self::latest_version( $ranklist_id ) : array();
			$candidates  = self::programs_from_payload( $ranklist, $version );

			foreach ( $candidates as $candidate ) {
				$programs[] = self::format_program( $candidate, count( $programs ) + 1 );
			}

			$last_updated = self::latest_timestamp(
				$last_updated,
				$ranklist['updated_at'] ?? '',
				$ranklist['created_at'] ?? '',
				is_wp_error( $version ) ? '' : ( $version['created_at'] ?? '' ),
				is_wp_error( $version ) ? '' : ( $version['updated_at'] ?? '' )
			);
		}

		usort(
			$programs,
			static function ( $a, $b ) {
				$a_rank = absint( $a['rank_position'] );
				$b_rank = absint( $b['rank_position'] );

				if ( $a_rank && $b_rank ) {
					return $a_rank <=> $b_rank;
				}

				if ( $a_rank ) {
					return -1;
				}

				if ( $b_rank ) {
					return 1;
				}

				return (int) $b['score'] <=> (int) $a['score'];
			}
		);

		$submissions = self::supabase_get(
			'finalized_submissions',
			array(
				'user_id' => 'eq.' . $supabase_uuid,
				'select'  => '*',
				'order'   => 'created_at.desc',
				'limit'   => '1',
			)
		);

		$submission = ( ! is_wp_error( $submissions ) && ! empty( $submissions[0] ) ) ? $submissions[0] : array();
		$last_updated = self::latest_timestamp( $last_updated, $submission['created_at'] ?? '', $submission['updated_at'] ?? '' );

		return array(
			'programs'            => $programs,
			'counts'              => self::counts( $programs ),
			'match_probability'   => self::match_probability( $programs, $submission ),
			'last_updated'        => $last_updated,
			'supabase_connected'  => true,
			'configured'          => true,
			'linked'              => true,
			'message'             => '',
			'standalone_url'      => self::standalone_url(),
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
	 * Resolve the WordPress to Supabase identity bridge.
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
			return new WP_Error( 'mmed_ranklist_supabase_not_configured', 'RankListIQ is not configured yet.' );
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
			return new WP_Error( 'mmed_ranklist_supabase_error', 'RankListIQ sync is unavailable right now.', array( 'status' => $code ) );
		}

		$decoded = json_decode( $body, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Fetch the latest version row for a ranklist.
	 *
	 * @param string $ranklist_id Ranklist UUID.
	 * @return array|WP_Error
	 */
	protected static function latest_version( $ranklist_id ) {
		$versions = self::supabase_get(
			'ranklist_versions',
			array(
				'ranklist_id' => 'eq.' . $ranklist_id,
				'select'      => '*',
				'order'       => 'created_at.desc',
				'limit'       => '1',
			)
		);

		if ( is_wp_error( $versions ) ) {
			return $versions;
		}

		return ! empty( $versions[0] ) && is_array( $versions[0] ) ? $versions[0] : array();
	}

	/**
	 * Extract program rows from known RankListIQ payload shapes.
	 *
	 * @param array $ranklist Ranklist row.
	 * @param array $version  Version row.
	 * @return array
	 */
	protected static function programs_from_payload( $ranklist, $version ) {
		$candidates = array();

		foreach ( array( $version, $ranklist ) as $row ) {
			if ( empty( $row ) || is_wp_error( $row ) ) {
				continue;
			}

			foreach ( array( 'programs', 'ranked_programs', 'ranklist', 'data', 'payload', 'snapshot' ) as $key ) {
				if ( ! array_key_exists( $key, $row ) ) {
					continue;
				}

				$value = self::decode_maybe_json( $row[ $key ] );
				if ( self::is_program_list( $value ) ) {
					$candidates = array_merge( $candidates, $value );
				} elseif ( is_array( $value ) && self::is_program_list( $value['programs'] ?? array() ) ) {
					$candidates = array_merge( $candidates, $value['programs'] );
				}
			}
		}

		if ( empty( $candidates ) && self::looks_like_program( $ranklist ) ) {
			$candidates[] = $ranklist;
		}

		return $candidates;
	}

	/**
	 * Format a program candidate to the Matrix contract.
	 *
	 * @param array $program       Raw program row.
	 * @param int   $fallback_rank Fallback rank.
	 * @return array
	 */
	protected static function format_program( $program, $fallback_rank ) {
		$rank = absint( $program['rank_position'] ?? $program['rank'] ?? $program['position'] ?? 0 );

		return array(
			'id'               => sanitize_text_field( $program['id'] ?? $program['program_id'] ?? 'program-' . $fallback_rank ),
			'name'             => sanitize_text_field( $program['name'] ?? $program['program_name'] ?? $program['program'] ?? 'Program' ),
			'program_name'     => sanitize_text_field( $program['program_name'] ?? $program['name'] ?? $program['program'] ?? 'Program' ),
			'specialty'        => sanitize_text_field( $program['specialty'] ?? $program['field'] ?? '' ),
			'state'            => sanitize_text_field( $program['state'] ?? $program['program_state'] ?? '' ),
			'tier'             => sanitize_key( $program['tier'] ?? $program['fit_tier'] ?? self::tier_from_score( $program['score'] ?? 0 ) ),
			'score'            => absint( $program['score'] ?? $program['fit_score'] ?? 0 ),
			'rank_position'    => $rank ? $rank : 0,
			'interview_status' => sanitize_key( $program['interview_status'] ?? $program['interview'] ?? 'none' ),
			'notes_count'      => absint( $program['notes_count'] ?? $program['notes'] ?? 0 ),
		);
	}

	/**
	 * Build counts from formatted programs.
	 *
	 * @param array $programs Program list.
	 * @return array
	 */
	protected static function counts( $programs ) {
		$ranked = 0;
		$needs = 0;

		foreach ( $programs as $program ) {
			if ( ! empty( $program['rank_position'] ) ) {
				$ranked++;
			}
			if ( empty( $program['score'] ) ) {
				$needs++;
			}
		}

		return array(
			'total'         => count( $programs ),
			'ranked'        => $ranked,
			'needs_scoring' => $needs,
		);
	}

	/**
	 * Pull match probability from submission data or derive from real scores.
	 *
	 * @param array $programs   Program list.
	 * @param array $submission Finalized submission row.
	 * @return int
	 */
	protected static function match_probability( $programs, $submission ) {
		foreach ( array( 'match_probability', 'probability', 'oracle_probability', 'score' ) as $key ) {
			if ( isset( $submission[ $key ] ) && is_numeric( $submission[ $key ] ) ) {
				return max( 0, min( 100, (int) round( (float) $submission[ $key ] ) ) );
			}
		}

		$scores = array_filter(
			wp_list_pluck( $programs, 'score' ),
			static function ( $score ) {
				return is_numeric( $score ) && (int) $score > 0;
			}
		);

		return $scores ? max( 0, min( 100, (int) round( array_sum( $scores ) / count( $scores ) ) ) ) : 0;
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
			'programs'           => array(),
			'counts'             => array(
				'total'         => 0,
				'ranked'        => 0,
				'needs_scoring' => 0,
			),
			'match_probability'  => 0,
			'last_updated'       => '',
			'supabase_connected' => (bool) $connected,
			'configured'         => (bool) $configured,
			'linked'             => false,
			'link_status'        => sanitize_key( $link_status ),
			'relink_available'   => (bool) $configured,
			'message'            => $message,
			'standalone_url'     => self::standalone_url(),
		);
	}

	/**
	 * Decode JSON strings while leaving arrays intact.
	 *
	 * @param mixed $value Value.
	 * @return mixed
	 */
	protected static function decode_maybe_json( $value ) {
		if ( is_array( $value ) ) {
			return $value;
		}

		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			return is_array( $decoded ) ? $decoded : $value;
		}

		return $value;
	}

	/**
	 * Whether an array looks like a list of programs.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	protected static function is_program_list( $value ) {
		return is_array( $value ) && isset( $value[0] ) && is_array( $value[0] ) && self::looks_like_program( $value[0] );
	}

	/**
	 * Whether a row looks like a program.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	protected static function looks_like_program( $value ) {
		return is_array( $value ) && ( isset( $value['program_name'] ) || isset( $value['name'] ) || isset( $value['program'] ) );
	}

	/**
	 * Infer score tier.
	 *
	 * @param mixed $score Program score.
	 * @return string
	 */
	protected static function tier_from_score( $score ) {
		$score = absint( $score );
		if ( $score >= 80 ) {
			return 'high';
		}
		if ( $score >= 55 ) {
			return 'medium';
		}
		return 'low';
	}

	/**
	 * Pick the latest non-empty timestamp.
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
	 * Standalone RankListIQ launcher URL.
	 *
	 * @return string
	 */
	protected static function standalone_url() {
		return '/ranklistiq/';
	}
}

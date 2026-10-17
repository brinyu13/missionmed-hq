<?php
/**
 * MissionMed live session group manager.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns live session groups and enrollment calendar propagation.
 */
class MMED_Session_Manager {

	/**
	 * Session group table schema version.
	 */
	const DB_VERSION = '20260519.1';

	/**
	 * Initialize runtime checks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
		self::seed_defaults();
		add_action( 'mmed_invite_batch', array( __CLASS__, 'process_invite_batch' ), 10, 3 );
		add_action( 'mmed_enrollment_complete', array( __CLASS__, 'clear_enrolled_cache' ), 10, 2 );
		add_action( 'mmed_sync_recordings', array( __CLASS__, 'cron_sync_recordings' ), 10, 1 );
		add_action( 'mmed_session_group_saved', array( __CLASS__, 'schedule_recording_sync_for_group' ), 40, 1 );
	}

	/**
	 * Return the session group table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_session_groups';
	}

	/**
	 * Create or update the session group table via dbDelta().
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_session_manager_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table_name      = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			group_slug varchar(50) NOT NULL,
			group_name varchar(255) NOT NULL,
			description text NULL,
			instructor_id bigint(20) unsigned NULL,
			enrollment_template varchar(50) NOT NULL DEFAULT '',
			event_type varchar(30) NOT NULL DEFAULT 'mr_session',
			day_of_week varchar(10) NULL,
			start_time time NULL,
			end_time time NULL,
			meeting_url varchar(500) NULL,
			meeting_platform varchar(30) DEFAULT 'webex',
			webex_meeting_id varchar(100) NULL,
			recurrence_start date NULL,
			recurrence_end date NULL,
			reminders_enabled tinyint(1) DEFAULT 1,
			is_active tinyint(1) DEFAULT 1,
			meta_json JSON NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY idx_slug (group_slug),
			KEY idx_template (enrollment_template)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_session_manager_db_version', self::DB_VERSION, false );
	}

	/**
	 * Insert default session groups if the table is empty.
	 *
	 * @return void
	 */
	public static function seed_defaults() {
		global $wpdb;

		self::maybe_install();

		$count = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::table_name() );
		if ( $count > 0 ) {
			return;
		}

		$defaults = array(
			array(
				'group_slug'          => 'session_a',
				'group_name'          => 'Mission Residency - Session A',
				'description'         => 'Live group coaching session with Dr. Brian.',
				'enrollment_template' => '360elite',
				'event_type'          => 'mr_session',
				'day_of_week'         => 'Wednesday',
				'start_time'          => '20:00:00',
				'end_time'            => '21:30:00',
				'meeting_platform'    => 'webex',
			),
			array(
				'group_slug'          => 'session_b',
				'group_name'          => 'Mission Residency - Session B',
				'description'         => 'Live group coaching session with Dr. Brian.',
				'enrollment_template' => '360elite',
				'event_type'          => 'mr_session',
				'day_of_week'         => 'Saturday',
				'start_time'          => '10:00:00',
				'end_time'            => '11:30:00',
				'meeting_platform'    => 'webex',
			),
			array(
				'group_slug'          => 'drill_step1',
				'group_name'          => "Dr. J's Drill - Step/Level 1",
				'description'         => 'Live drill session with Dr. J.',
				'enrollment_template' => '360elite',
				'event_type'          => 'drill_step1',
				'day_of_week'         => 'Thursday',
				'start_time'          => '19:00:00',
				'end_time'            => '20:00:00',
				'meeting_platform'    => 'webex',
			),
			array(
				'group_slug'          => 'drill_step23',
				'group_name'          => "Dr. J's Drill - Step/Level 2/3",
				'description'         => 'Live drill session with Dr. J.',
				'enrollment_template' => '360elite',
				'event_type'          => 'drill_step23',
				'day_of_week'         => 'Friday',
				'start_time'          => '19:00:00',
				'end_time'            => '20:00:00',
				'meeting_platform'    => 'webex',
			),
		);

		foreach ( $defaults as $default ) {
			$default['recurrence_start'] = '2026-06-03';
			$default['recurrence_end']   = '2026-12-19';
			$default['is_active']        = 1;
			$default['created_at']       = current_time( 'mysql' );
			$default['updated_at']       = current_time( 'mysql' );

			$wpdb->insert( self::table_name(), $default, self::format_map( $default ) );
		}
	}

	/**
	 * List session groups.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_groups( $request ) {
		global $wpdb;

		self::maybe_install();

		$active_only = rest_sanitize_boolean( $request->get_param( 'active_only' ) );
		$where       = $active_only ? 'WHERE is_active = 1' : '';
		$rows        = $wpdb->get_results( 'SELECT * FROM ' . self::table_name() . " {$where} ORDER BY id ASC" );

		return new WP_REST_Response(
			array(
				'groups' => array_map( array( __CLASS__, 'format_group' ), is_array( $rows ) ? $rows : array() ),
			),
			200
		);
	}

	/**
	 * Get one session group.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_group( $request ) {
		$group = self::get_group_by_id( absint( $request['id'] ) );

		if ( ! $group ) {
			return new WP_Error( 'mmed_session_not_found', 'Session group not found.', array( 'status' => 404 ) );
		}

		return new WP_REST_Response( self::format_group( $group ), 200 );
	}

	/**
	 * Create a session group.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_group( $request ) {
		global $wpdb;

		self::maybe_install();

		$payload = self::sanitize_group_payload( self::request_payload( $request ), false );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$payload['created_at'] = current_time( 'mysql' );
		$payload['updated_at'] = current_time( 'mysql' );

		$inserted = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
		if ( false === $inserted ) {
			return new WP_Error( 'mmed_session_create_failed', 'Session group could not be created.', array( 'status' => 500 ) );
		}

		$group_id = (int) $wpdb->insert_id;
		do_action( 'mmed_session_group_saved', $group_id );

		return new WP_REST_Response( self::format_group( self::get_group_by_id( $group_id ) ), 201 );
	}

	/**
	 * Update a session group.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_group( $request ) {
		global $wpdb;

		self::maybe_install();

		$group_id = absint( $request['id'] );
		$group    = self::get_group_by_id( $group_id );

		if ( ! $group ) {
			return new WP_Error( 'mmed_session_not_found', 'Session group not found.', array( 'status' => 404 ) );
		}

		$payload = self::sanitize_group_payload( self::request_payload( $request ), true );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		if ( empty( $payload ) ) {
			return new WP_REST_Response( self::format_group( $group ), 200 );
		}

		$payload['updated_at'] = current_time( 'mysql' );

		$updated = $wpdb->update(
			self::table_name(),
			$payload,
			array( 'id' => $group_id ),
			self::format_map( $payload ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_session_update_failed', 'Session group could not be updated.', array( 'status' => 500 ) );
		}

		$updated_group = self::get_group_by_id( $group_id );
		if ( $updated_group && ! empty( $updated_group->is_active ) ) {
			do_action( 'mmed_session_group_saved', $group_id );
		} else {
			do_action( 'mmed_session_group_deactivated', $group_id );
		}

		return new WP_REST_Response( self::format_group( self::get_group_by_id( $group_id ) ), 200 );
	}

	/**
	 * Soft delete a session group.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_group( $request ) {
		global $wpdb;

		$group_id = absint( $request['id'] );

		if ( ! self::get_group_by_id( $group_id ) ) {
			return new WP_Error( 'mmed_session_not_found', 'Session group not found.', array( 'status' => 404 ) );
		}

		$wpdb->update(
			self::table_name(),
			array(
				'is_active'  => 0,
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $group_id ),
			array( '%d', '%s' ),
			array( '%d' )
		);

		do_action( 'mmed_session_group_deactivated', $group_id );

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $group_id ), 200 );
	}

	/**
	 * Get a session group row by ID.
	 *
	 * @param int $id Group ID.
	 * @return object|null
	 */
	public static function get_group_by_id( $id ) {
		global $wpdb;

		self::maybe_install();

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d',
				absint( $id )
			)
		);
	}

	/**
	 * Propagate a session group's meeting URL to future enrollment events.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function propagate_meeting_url( $request ) {
		$group_id = absint( $request['id'] );
		$group    = self::get_group_by_id( $group_id );

		if ( ! $group ) {
			return new WP_Error( 'mmed_session_not_found', 'Session group not found.', array( 'status' => 404 ) );
		}

		$updated = self::do_propagate( $group_id );

		return new WP_REST_Response(
			array(
				'updated' => $updated,
				'group'   => self::format_group( self::get_group_by_id( $group_id ) ),
			),
			200
		);
	}

	/**
	 * Generate enrollment session events for a template from active groups.
	 *
	 * @param string $slug Enrollment template slug.
	 * @return array
	 */
	public static function get_sessions_for_template( $slug ) {
		global $wpdb;

		self::maybe_install();

		$aliases      = self::template_aliases( $slug );
		$placeholders = implode( ', ', array_fill( 0, count( $aliases ), '%s' ) );
		$sql          = 'SELECT * FROM ' . self::table_name() . " WHERE is_active = 1 AND enrollment_template IN ({$placeholders}) ORDER BY id ASC";
		$groups       = $wpdb->get_results( $wpdb->prepare( $sql, $aliases ) );
		$events       = array();

		foreach ( is_array( $groups ) ? $groups : array() as $group ) {
			if ( empty( $group->day_of_week ) || empty( $group->recurrence_start ) || empty( $group->recurrence_end ) ) {
				continue;
			}

			$dates = self::get_weekly_dates( $group->day_of_week, $group->recurrence_start, $group->recurrence_end );

			foreach ( $dates as $date ) {
				$events[] = array(
					'title'            => $group->group_name,
					'description'      => $group->description,
					'start_at'         => $date . ' ' . $group->start_time,
					'end_at'           => $date . ' ' . $group->end_time,
					'event_type'       => $group->event_type,
					'meeting_url'      => $group->meeting_url,
					'meeting_platform' => $group->meeting_platform,
					'source_id'        => $group->group_slug,
					'source_group_id'  => (int) $group->id,
					'meta'             => self::decode_meta( $group->meta_json ),
				);
			}
		}

		return $events;
	}

	/**
	 * Build an RFC 5545 weekly recurrence rule.
	 *
	 * @param object $group Session group row.
	 * @return string
	 */
	public static function build_rrule( $group ) {
		$day_map = array(
			'Sunday'    => 'SU',
			'Monday'    => 'MO',
			'Tuesday'   => 'TU',
			'Wednesday' => 'WE',
			'Thursday'  => 'TH',
			'Friday'    => 'FR',
			'Saturday'  => 'SA',
		);

		$parts = array( 'FREQ=WEEKLY', 'INTERVAL=1' );

		if ( ! empty( $group->day_of_week ) && isset( $day_map[ $group->day_of_week ] ) ) {
			$parts[] = 'BYDAY=' . $day_map[ $group->day_of_week ];
		}

		if ( ! empty( $group->recurrence_end ) ) {
			$until   = gmdate( 'Ymd\T235959\Z', strtotime( $group->recurrence_end . ' 23:59:59' ) );
			$parts[] = 'UNTIL=' . $until;
		}

		return implode( ';', $parts );
	}

	/**
	 * Get students enrolled in a template.
	 *
	 * Results are cached for 15 minutes per template.
	 *
	 * @param string $template    Enrollment template slug.
	 * @param bool   $force_fresh Skip cache and re-query.
	 * @return WP_User[]
	 */
	public static function get_enrolled_students( $template, $force_fresh = false ) {
		$cache_key = 'mmed_enrolled_students_' . sanitize_key( $template );

		if ( ! $force_fresh ) {
			$cached = get_transient( $cache_key );
			if ( false !== $cached && is_array( $cached ) ) {
				// Transient stores user IDs; hydrate into WP_User objects.
				$users = array();
				foreach ( $cached as $uid ) {
					$user = get_user_by( 'id', $uid );
					if ( $user ) {
						$users[] = $user;
					}
				}
				return $users;
			}
		}

		$aliases  = self::template_aliases( $template );
		$user_map = array();

		// Path 1: Users with _mmed_program_tier matching the template.
		$meta_users = get_users(
			array(
				'fields'     => 'all',
				'meta_query' => array(
					array(
						'key'     => '_mmed_program_tier',
						'value'   => $aliases,
						'compare' => 'IN',
					),
				),
			)
		);

		foreach ( $meta_users as $user ) {
			if ( ! empty( $user->user_email ) ) {
				$user_map[ $user->ID ] = $user;
			}
		}

		// Path 2: Users assigned tasks for this template.
		$task_ids = get_posts(
			array(
				'post_type'      => 'mmed_task',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_query'     => array(
					array(
						'key'     => '_mmed_template_id',
						'value'   => $aliases,
						'compare' => 'IN',
					),
				),
			)
		);

		foreach ( $task_ids as $task_id ) {
			$user_id = absint( get_post_meta( $task_id, '_mmed_student_id', true ) );
			$user    = $user_id ? get_user_by( 'id', $user_id ) : null;
			if ( $user && ! empty( $user->user_email ) ) {
				$user_map[ $user->ID ] = $user;
			}
		}

		// Path 3: LearnDash enrolled users (optimized: avoid N+1).
		if ( class_exists( 'MMED_Access_Audit' ) ) {
			$course_ids = self::course_ids_for_template( $aliases );
			if ( ! empty( $course_ids ) ) {
				// Prefer learndash_get_groups_users or direct meta query over iterating all users.
				if ( function_exists( 'learndash_get_groups_users' ) ) {
					foreach ( $course_ids as $cid ) {
						$group_users = learndash_get_groups_users( $cid );
						if ( is_array( $group_users ) ) {
							foreach ( $group_users as $user ) {
								if ( is_object( $user ) && ! empty( $user->user_email ) ) {
									$user_map[ $user->ID ] = $user;
								}
							}
						}
					}
				} else {
					// Direct meta query: find users with course_<id>_access_from set.
					global $wpdb;
					$meta_keys = array();
					foreach ( $course_ids as $cid ) {
						$meta_keys[] = 'course_' . absint( $cid ) . '_access_from';
					}
					$placeholders = implode( ', ', array_fill( 0, count( $meta_keys ), '%s' ) );
					$ld_user_ids  = $wpdb->get_col(
						$wpdb->prepare(
							"SELECT DISTINCT user_id FROM {$wpdb->usermeta} WHERE meta_key IN ({$placeholders}) AND meta_value != ''",
							$meta_keys
						)
					);
					foreach ( $ld_user_ids as $uid ) {
						if ( ! isset( $user_map[ $uid ] ) ) {
							$user = get_user_by( 'id', $uid );
							if ( $user && ! empty( $user->user_email ) ) {
								$user_map[ $user->ID ] = $user;
							}
						}
					}
				}
			}
		}

		$result = array_values( $user_map );

		// Cache user IDs (not full objects) for 15 minutes.
		$id_list = array_map( function ( $u ) { return $u->ID; }, $result );
		set_transient( $cache_key, $id_list, 15 * MINUTE_IN_SECONDS );

		return $result;
	}

	/**
	 * Clear enrolled students cache when a new enrollment happens.
	 *
	 * @param int    $user_id       WordPress user ID.
	 * @param string $template_slug Enrollment template slug.
	 * @return void
	 */
	public static function clear_enrolled_cache( $user_id, $template_slug ) {
		$aliases = self::template_aliases( $template_slug );
		foreach ( $aliases as $alias ) {
			delete_transient( 'mmed_enrolled_students_' . sanitize_key( $alias ) );
		}
	}

	/**
	 * Convert a database row to REST shape.
	 *
	 * @param object|null $row Group row.
	 * @return array
	 */
	public static function format_group( $row ) {
		if ( ! $row ) {
			return array();
		}

		$instructor = ! empty( $row->instructor_id ) ? get_user_by( 'id', (int) $row->instructor_id ) : null;

		return array(
			'id'                  => (int) $row->id,
			'group_slug'          => (string) $row->group_slug,
			'group_name'          => (string) $row->group_name,
			'description'         => (string) $row->description,
			'instructor_id'       => ! empty( $row->instructor_id ) ? (int) $row->instructor_id : 0,
			'instructor_name'     => $instructor ? $instructor->display_name : '',
			'enrollment_template' => (string) $row->enrollment_template,
			'event_type'          => (string) $row->event_type,
			'day_of_week'         => (string) $row->day_of_week,
			'start_time'          => (string) $row->start_time,
			'end_time'            => (string) $row->end_time,
			'meeting_url'         => (string) $row->meeting_url,
			'meeting_platform'    => (string) $row->meeting_platform,
			'webex_meeting_id'    => (string) $row->webex_meeting_id,
			'recurrence_start'    => (string) $row->recurrence_start,
			'recurrence_end'      => (string) $row->recurrence_end,
			'reminders_enabled'   => isset( $row->reminders_enabled ) ? (bool) $row->reminders_enabled : true,
			'is_active'           => (bool) $row->is_active,
			'meta'                => self::decode_meta( $row->meta_json ),
			'created_at'          => (string) $row->created_at,
			'updated_at'          => (string) $row->updated_at,
		);
	}

	/**
	 * Propagate meeting data and return the affected row count.
	 *
	 * @param int $group_id Group ID.
	 * @return int
	 */
	public static function do_propagate( $group_id ) {
		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return 0;
		}

		global $wpdb;

		$group = self::get_group_by_id( $group_id );
		if ( ! $group ) {
			return 0;
		}

		$table = MMED_Calendar_Engine::table_name();
		$now   = current_time( 'mysql' );

		// Primary path: match on source_group_id (reliable, rename-safe).
		$updated = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET meeting_url = %s, meeting_platform = %s, updated_at = %s WHERE source = 'enrollment' AND source_group_id = %d AND start_at >= %s",
				(string) $group->meeting_url,
				(string) $group->meeting_platform,
				$now,
				(int) $group_id,
				$now
			)
		);

		// Fallback: legacy events without source_group_id (title-based matching).
		$legacy = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET meeting_url = %s, meeting_platform = %s, updated_at = %s WHERE source = 'enrollment' AND (source_group_id IS NULL OR source_group_id = 0) AND event_type = %s AND title = %s AND start_at >= %s",
				(string) $group->meeting_url,
				(string) $group->meeting_platform,
				$now,
				(string) $group->event_type,
				(string) $group->group_name,
				$now
			)
		);

		$total = ( false === $updated ? 0 : (int) $updated ) + ( false === $legacy ? 0 : (int) $legacy );
		return $total;
	}

	/**
	 * Auto-create a Webex meeting for a session group.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function auto_create_webex_meeting( $request ) {
		if ( ! class_exists( 'MMED_Webex_Client' ) ) {
			return new WP_Error( 'webex_missing', 'Webex client is not available.', array( 'status' => 500 ) );
		}

		$group_id = absint( $request['id'] );
		$group    = self::get_group_by_id( $group_id );

		if ( ! $group || 'webex' !== $group->meeting_platform ) {
			return new WP_Error( 'invalid_group', 'Session group not found or not using Webex.', array( 'status' => 400 ) );
		}

		$recurrence = self::build_rrule( $group );
		$dates      = self::get_weekly_dates( $group->day_of_week, $group->recurrence_start, $group->recurrence_end );
		$first_date = ! empty( $dates[0] ) ? $dates[0] : $group->recurrence_start;

		$start_datetime = $first_date . 'T' . $group->start_time;
		$end_datetime   = $first_date . 'T' . $group->end_time;

		$meeting = MMED_Webex_Client::create_meeting(
			array(
				'title'      => $group->group_name,
				'start'      => $start_datetime,
				'end'        => $end_datetime,
				'timezone'   => 'America/New_York',
				'recurrence' => $recurrence,
			)
		);

		if ( is_wp_error( $meeting ) ) {
			return $meeting;
		}

		global $wpdb;

		$meta = self::decode_meta( $group->meta_json );
		if ( ! empty( $meeting['sipAddress'] ) ) {
			$meta['sip_address'] = sanitize_text_field( $meeting['sipAddress'] );
		}
		if ( ! empty( $meeting['meetingNumber'] ) ) {
			$meta['meeting_number'] = sanitize_text_field( $meeting['meetingNumber'] );
		}
		if ( ! empty( $meeting['webLink'] ) ) {
			$meta['web_link'] = esc_url_raw( $meeting['webLink'] );
		}

		$wpdb->update(
			self::table_name(),
			array(
				'webex_meeting_id' => sanitize_text_field( $meeting['id'] ?? '' ),
				'meeting_url'      => esc_url_raw( $meeting['webLink'] ?? '' ),
				'meta_json'        => wp_json_encode( self::sanitize_meta( $meta ) ),
				'updated_at'       => current_time( 'mysql' ),
			),
			array( 'id' => $group_id ),
			array( '%s', '%s', '%s', '%s' ),
			array( '%d' )
		);

		$propagated = self::do_propagate( $group_id );

		return new WP_REST_Response(
			array(
				'meeting_id' => $meeting['id'] ?? '',
				'join_url'   => $meeting['webLink'] ?? '',
				'sip'        => $meeting['sipAddress'] ?? '',
				'propagated' => $propagated,
			),
			201
		);
	}

	/**
	 * Invite all enrolled students to a session group's Webex meeting.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function invite_enrolled_students( $request ) {
		if ( ! class_exists( 'MMED_Webex_Client' ) ) {
			return new WP_Error( 'webex_missing', 'Webex client is not available.', array( 'status' => 500 ) );
		}

		$group_id = absint( $request['id'] );
		$group    = self::get_group_by_id( $group_id );

		if ( ! $group || empty( $group->webex_meeting_id ) ) {
			return new WP_Error( 'no_meeting', 'No Webex meeting exists for this group.', array( 'status' => 400 ) );
		}

		$students = self::get_enrolled_students( $group->enrollment_template );

		if ( empty( $students ) ) {
			return new WP_REST_Response(
				array(
					'invited' => 0,
					'errors'  => array(),
					'total'   => 0,
					'message' => 'No enrolled students found for this template.',
				),
				200
			);
		}

		$attendees = array();
		foreach ( $students as $student ) {
			$attendees[] = array(
				'email'       => $student->user_email,
				'displayName' => $student->display_name,
			);
		}

		return self::invite_enrolled_students_background( $group->webex_meeting_id, $group_id, $attendees );
	}

	/**
	 * Dispatch invitations synchronously for small batches or via WP-Cron for large ones.
	 *
	 * @param string $meeting_id  Webex meeting ID.
	 * @param int    $group_id    Session group ID.
	 * @param array  $attendees   Attendee list.
	 * @return WP_REST_Response
	 */
	private static function invite_enrolled_students_background( $meeting_id, $group_id, $attendees ) {
		$total = count( $attendees );

		// Small batch: handle synchronously.
		if ( $total <= 15 ) {
			$results = MMED_Webex_Client::invite_attendees_batch( $meeting_id, $attendees );
			return new WP_REST_Response(
				array(
					'invited' => $results['invited'],
					'errors'  => $results['errors'],
					'total'   => $total,
					'mode'    => 'sync',
				),
				200
			);
		}

		// Large batch: schedule via WP-Cron in chunks of 10.
		$batches       = array_chunk( $attendees, 10 );
		$progress_key  = 'mmed_invite_progress_' . $group_id;

		set_transient(
			$progress_key,
			array(
				'total'         => $total,
				'invited'       => 0,
				'errors'        => array(),
				'batches_total' => count( $batches ),
				'batches_done'  => 0,
				'status'        => 'processing',
				'started_at'    => current_time( 'mysql' ),
			),
			HOUR_IN_SECONDS
		);

		foreach ( $batches as $index => $batch ) {
			$delay = 5 + ( $index * 10 );
			wp_schedule_single_event(
				time() + $delay,
				'mmed_invite_batch',
				array( $meeting_id, $group_id, $batch )
			);
		}

		return new WP_REST_Response(
			array(
				'invited' => 0,
				'errors'  => array(),
				'total'   => $total,
				'mode'    => 'background',
				'message' => sprintf( 'Queued %d batches for background processing.', count( $batches ) ),
			),
			202
		);
	}

	/**
	 * WP-Cron callback to process a single invite batch.
	 *
	 * @param string $meeting_id Webex meeting ID.
	 * @param int    $group_id   Session group ID.
	 * @param array  $batch      Attendee batch.
	 * @return void
	 */
	public static function process_invite_batch( $meeting_id, $group_id, $batch ) {
		if ( ! class_exists( 'MMED_Webex_Client' ) ) {
			return;
		}

		$results      = MMED_Webex_Client::invite_attendees_batch( $meeting_id, $batch );
		$progress_key = 'mmed_invite_progress_' . $group_id;
		$progress     = get_transient( $progress_key );

		if ( ! is_array( $progress ) ) {
			$progress = array(
				'total'         => 0,
				'invited'       => 0,
				'errors'        => array(),
				'batches_total' => 0,
				'batches_done'  => 0,
				'status'        => 'processing',
			);
		}

		$progress['invited']      += $results['invited'];
		$progress['errors']        = array_merge( $progress['errors'], $results['errors'] );
		$progress['batches_done'] += 1;

		if ( $progress['batches_done'] >= $progress['batches_total'] ) {
			$progress['status']       = 'complete';
			$progress['completed_at'] = current_time( 'mysql' );
		}

		set_transient( $progress_key, $progress, HOUR_IN_SECONDS );
	}

	/**
	 * REST handler to check invite progress for a session group.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_invite_status( $request ) {
		$group_id     = absint( $request['id'] );
		$progress_key = 'mmed_invite_progress_' . $group_id;
		$progress     = get_transient( $progress_key );

		if ( ! is_array( $progress ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'none',
					'message' => 'No invite operation in progress for this group.',
				),
				200
			);
		}

		return new WP_REST_Response( $progress, 200 );
	}

	/**
	 * Get join info for a student viewing a calendar event.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_join_info( $request ) {
		$event_id = absint( $request['event_id'] );

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return new WP_Error( 'no_engine', 'Calendar engine not available.', array( 'status' => 500 ) );
		}

		global $wpdb;

		$table = MMED_Calendar_Engine::table_name();
		$event = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE id = %d AND user_id = %d",
				$event_id,
				get_current_user_id()
			)
		);

		if ( ! $event ) {
			return new WP_Error( 'not_found', 'Event not found.', array( 'status' => 404 ) );
		}

		$now       = current_time( 'timestamp' );
		$start_ts  = strtotime( $event->start_at );
		$end_ts    = ! empty( $event->end_at ) ? strtotime( $event->end_at ) : $start_ts + HOUR_IN_SECONDS;
		$can_join  = ( $now >= $start_ts - 15 * MINUTE_IN_SECONDS ) && ( $now <= $end_ts );
		$starts_in = max( 0, round( ( $start_ts - $now ) / 60 ) );

		$widget_enabled = ! empty( get_option( 'mmed_webex_service_app_id', '' ) )
			&& ! empty( get_option( 'mmed_webex_service_app_secret', '' ) );
		$embedded_widget_enabled = ! class_exists( 'MMED_Feature_Flags' )
			|| MMED_Feature_Flags::is_enabled( 'webex_embedded_widget' );
		$recordings_enabled = ! class_exists( 'MMED_Feature_Flags' )
			|| MMED_Feature_Flags::is_enabled( 'session_recordings' );

		$meta = json_decode( $event->meta_json ?? '{}', true );
		$meta = is_array( $meta ) ? $meta : array();
		$sip  = $meta['sip_address'] ?? '';

		if ( empty( $sip ) ) {
			$group = self::get_group_by_event( $event->event_type, $event->title );
			if ( $group ) {
				$group_meta = self::decode_meta( $group->meta_json );
				$sip        = $group_meta['sip_address'] ?? '';
			}
		}

		return new WP_REST_Response(
			array(
				'event_id'          => (int) $event->id,
				'title'             => $event->title,
				'description'       => $event->description,
				'start_at'          => $event->start_at,
				'end_at'            => $event->end_at,
				'meeting_url'       => $event->meeting_url,
				'meeting_platform'  => $event->meeting_platform,
				'sip_address'       => $sip,
				'session_group_id'  => isset( $event->source_group_id ) ? (int) $event->source_group_id : 0,
				'event_type'        => (string) $event->event_type,
				'event_date'        => date( 'Y-m-d', strtotime( $event->start_at ) ),
				'can_join'          => $can_join,
				'starts_in_minutes' => (int) $starts_in,
				'widget_enabled'    => $embedded_widget_enabled && $widget_enabled && 'webex' === $event->meeting_platform,
				'has_recording'     => $recordings_enabled && self::event_has_recording( $event ),
			),
			200
		);
	}

	/**
	 * Sync recordings for a session group.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return array|WP_Error
	 */
	public static function sync_recording( $session_group_id ) {
		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'session_recordings' ) ) {
			return new WP_Error( 'mmed_recordings_disabled', 'Session recordings are not enabled.', array( 'status' => 403 ) );
		}

		if ( ! class_exists( 'MMED_Webex_Client' ) ) {
			return new WP_Error( 'webex_missing', 'Webex client is not available.', array( 'status' => 500 ) );
		}

		$session_group_id = absint( $session_group_id );
		$group            = self::get_group_by_id( $session_group_id );

		if ( ! $group || empty( $group->webex_meeting_id ) ) {
			return new WP_Error( 'mmed_recording_group_missing', 'Session group or Webex meeting is missing.', array( 'status' => 404 ) );
		}

		$recordings = MMED_Webex_Client::get_recordings( $group->webex_meeting_id );
		if ( is_wp_error( $recordings ) ) {
			return $recordings;
		}

		$meta               = self::decode_meta( $group->meta_json );
		$meta['recordings'] = array_map( array( __CLASS__, 'sanitize_recording' ), $recordings );

		global $wpdb;
		$wpdb->update(
			self::table_name(),
			array(
				'meta_json'  => wp_json_encode( self::sanitize_meta( $meta ) ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $session_group_id ),
			array( '%s', '%s' ),
			array( '%d' )
		);

		return array(
			'session_group_id' => $session_group_id,
			'recordings'       => $meta['recordings'],
			'count'            => count( $meta['recordings'] ),
		);
	}

	/**
	 * Get recordings for a calendar event.
	 *
	 * @param int $event_id Event ID.
	 * @param int $user_id  Optional user ID gate.
	 * @return array
	 */
	public static function get_recordings_for_event( $event_id, $user_id = 0 ) {
		$event = self::get_event_row_for_recording( $event_id, $user_id );
		if ( ! $event ) {
			return array();
		}

		$group = null;
		if ( ! empty( $event->source_group_id ) ) {
			$group = self::get_group_by_id( (int) $event->source_group_id );
		}
		if ( ! $group ) {
			$group = self::get_group_by_event( $event->event_type, $event->title );
		}
		if ( ! $group ) {
			return array();
		}

		$meta       = self::decode_meta( $group->meta_json );
		$recordings = is_array( $meta['recordings'] ?? null ) ? $meta['recordings'] : array();
		$matched    = array();

		foreach ( $recordings as $recording ) {
			if ( self::recording_matches_event( $recording, $event ) ) {
				$matched[] = $recording;
			}
		}

		return ! empty( $matched ) ? $matched : $recordings;
	}

	/**
	 * Whether an event has a synced recording.
	 *
	 * @param object $event Event row.
	 * @return bool
	 */
	public static function event_has_recording( $event ) {
		if ( empty( $event->id ) ) {
			return false;
		}

		return ! empty( self::get_recordings_for_event( (int) $event->id, (int) ( $event->user_id ?? 0 ) ) );
	}

	/**
	 * REST: admin sync recordings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_sync_recordings( $request ) {
		$result = self::sync_recording( absint( $request['id'] ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * REST: admin list recordings.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_list_recordings( $request ) {
		$group = self::get_group_by_id( absint( $request['id'] ) );
		if ( ! $group ) {
			return new WP_Error( 'mmed_session_not_found', 'Session group not found.', array( 'status' => 404 ) );
		}

		$meta = self::decode_meta( $group->meta_json );

		return new WP_REST_Response(
			array(
				'recordings' => is_array( $meta['recordings'] ?? null ) ? $meta['recordings'] : array(),
			),
			200
		);
	}

	/**
	 * REST: student recording for event.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_get_recording( $request ) {
		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'session_recordings' ) ) {
			return new WP_Error( 'mmed_recordings_disabled', 'Recordings are not enabled.', array( 'status' => 403 ) );
		}

		$event_id    = absint( $request['event_id'] );
		$recordings  = self::get_recordings_for_event( $event_id, get_current_user_id() );
		$recording   = ! empty( $recordings[0] ) ? $recordings[0] : array();
		$playback    = $recording['playback_url'] ?? '';

		if ( empty( $recording ) || empty( $playback ) ) {
			return new WP_Error( 'mmed_recording_not_found', 'Recording is not available for this event.', array( 'status' => 404 ) );
		}

		return new WP_REST_Response(
			array(
				'recording'     => $recording,
				'recording_url' => $playback,
				'has_recording' => true,
			),
			200
		);
	}

	/**
	 * Cron callback.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return void
	 */
	public static function cron_sync_recordings( $session_group_id ) {
		self::sync_recording( absint( $session_group_id ) );
	}

	/**
	 * Schedule recording sync 2 hours after each session end.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return void
	 */
	public static function schedule_recording_sync_for_group( $session_group_id ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return;
		}

		$events_table = MMED_Calendar_Engine::table_name();
		$events       = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT end_at FROM {$events_table} WHERE source_group_id = %d AND end_at >= %s AND status <> 'cancelled' GROUP BY end_at ORDER BY end_at ASC",
				absint( $session_group_id ),
				current_time( 'mysql' )
			)
		);

		foreach ( is_array( $events ) ? $events : array() as $event ) {
			$timestamp = strtotime( $event->end_at ) + 2 * HOUR_IN_SECONDS;
			$args      = array( absint( $session_group_id ) );

			if ( $timestamp > time() && ! wp_next_scheduled( 'mmed_sync_recordings', $args ) ) {
				wp_schedule_single_event( $timestamp, 'mmed_sync_recordings', $args );
			}
		}
	}

	/**
	 * Sanitize recording metadata.
	 *
	 * @param array $recording Recording data.
	 * @return array
	 */
	private static function sanitize_recording( $recording ) {
		$recording = is_array( $recording ) ? $recording : array();

		return array(
			'id'           => sanitize_text_field( $recording['id'] ?? '' ),
			'topic'        => sanitize_text_field( $recording['topic'] ?? '' ),
			'download_url' => esc_url_raw( $recording['download_url'] ?? '' ),
			'playback_url' => esc_url_raw( $recording['playback_url'] ?? '' ),
			'duration'     => absint( $recording['duration'] ?? 0 ),
			'file_size'    => absint( $recording['file_size'] ?? 0 ),
			'created_time' => sanitize_text_field( $recording['created_time'] ?? '' ),
		);
	}

	/**
	 * Match recording to event date.
	 *
	 * @param array  $recording Recording data.
	 * @param object $event     Event row.
	 * @return bool
	 */
	private static function recording_matches_event( $recording, $event ) {
		if ( empty( $recording['created_time'] ) || empty( $event->start_at ) ) {
			return false;
		}

		return date( 'Y-m-d', strtotime( $recording['created_time'] ) ) === date( 'Y-m-d', strtotime( $event->start_at ) );
	}

	/**
	 * Event row lookup for recording routes.
	 *
	 * @param int $event_id Event ID.
	 * @param int $user_id  Optional user ID gate.
	 * @return object|null
	 */
	private static function get_event_row_for_recording( $event_id, $user_id = 0 ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return null;
		}

		$where  = array( 'id = %d' );
		$values = array( absint( $event_id ) );

		if ( $user_id && ! current_user_can( 'manage_options' ) ) {
			$where[]  = 'user_id = %d';
			$values[] = absint( $user_id );
		}

		$sql = 'SELECT * FROM ' . MMED_Calendar_Engine::table_name() . ' WHERE ' . implode( ' AND ', $where ) . ' LIMIT 1';

		return $wpdb->get_row( $wpdb->prepare( $sql, $values ) );
	}

	/**
	 * Find a session group by event type and title.
	 *
	 * @param string $event_type Event type.
	 * @param string $title      Event title.
	 * @return object|null
	 */
	private static function get_group_by_event( $event_type, $title ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE event_type = %s AND group_name = %s ORDER BY id ASC LIMIT 1',
				sanitize_key( $event_type ),
				sanitize_text_field( $title )
			)
		);
	}

	/**
	 * Read JSON or form body parameters.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array
	 */
	private static function request_payload( $request ) {
		$payload = $request->get_json_params();

		if ( ! is_array( $payload ) || empty( $payload ) ) {
			$payload = $request->get_body_params();
		}

		return is_array( $payload ) ? $payload : array();
	}

	/**
	 * Sanitize a create or update payload.
	 *
	 * @param array|null $raw     Raw payload.
	 * @param bool       $partial Whether missing fields are allowed.
	 * @return array|WP_Error
	 */
	private static function sanitize_group_payload( $raw, $partial ) {
		$raw     = is_array( $raw ) ? $raw : array();
		$payload = array();

		if ( array_key_exists( 'group_slug', $raw ) ) {
			$payload['group_slug'] = substr( sanitize_key( $raw['group_slug'] ), 0, 50 );
		}

		if ( array_key_exists( 'group_name', $raw ) ) {
			$payload['group_name'] = sanitize_text_field( $raw['group_name'] );
		}

		if ( array_key_exists( 'description', $raw ) ) {
			$payload['description'] = wp_kses_post( $raw['description'] );
		}

		if ( array_key_exists( 'instructor_id', $raw ) ) {
			$payload['instructor_id'] = absint( $raw['instructor_id'] ) ?: null;
		}

		if ( array_key_exists( 'enrollment_template', $raw ) ) {
			$payload['enrollment_template'] = substr( sanitize_key( $raw['enrollment_template'] ), 0, 50 );
		} elseif ( ! $partial ) {
			$payload['enrollment_template'] = '';
		}

		if ( array_key_exists( 'event_type', $raw ) ) {
			$payload['event_type'] = self::sanitize_enum( $raw['event_type'], self::event_types(), 'mr_session' );
		} elseif ( ! $partial ) {
			$payload['event_type'] = 'mr_session';
		}

		if ( array_key_exists( 'day_of_week', $raw ) ) {
			$payload['day_of_week'] = self::sanitize_enum( $raw['day_of_week'], self::days(), '' );
		}

		if ( array_key_exists( 'start_time', $raw ) ) {
			$payload['start_time'] = self::sanitize_time( $raw['start_time'] );
		}

		if ( array_key_exists( 'end_time', $raw ) ) {
			$payload['end_time'] = self::sanitize_time( $raw['end_time'] );
		}

		if ( array_key_exists( 'meeting_url', $raw ) ) {
			$payload['meeting_url'] = esc_url_raw( $raw['meeting_url'] );
		}

		if ( array_key_exists( 'meeting_platform', $raw ) ) {
			$payload['meeting_platform'] = self::sanitize_enum( $raw['meeting_platform'], self::platforms(), 'webex' );
		} elseif ( ! $partial ) {
			$payload['meeting_platform'] = 'webex';
		}

		if ( array_key_exists( 'webex_meeting_id', $raw ) ) {
			$payload['webex_meeting_id'] = sanitize_text_field( $raw['webex_meeting_id'] );
		}

		if ( array_key_exists( 'recurrence_start', $raw ) ) {
			$payload['recurrence_start'] = self::sanitize_date( $raw['recurrence_start'] );
		}

		if ( array_key_exists( 'recurrence_end', $raw ) ) {
			$payload['recurrence_end'] = self::sanitize_date( $raw['recurrence_end'] );
		}

		if ( array_key_exists( 'reminders_enabled', $raw ) ) {
			$payload['reminders_enabled'] = rest_sanitize_boolean( $raw['reminders_enabled'] ) ? 1 : 0;
		} elseif ( ! $partial ) {
			$payload['reminders_enabled'] = 1;
		}

		if ( array_key_exists( 'is_active', $raw ) ) {
			$payload['is_active'] = rest_sanitize_boolean( $raw['is_active'] ) ? 1 : 0;
		} elseif ( ! $partial ) {
			$payload['is_active'] = 1;
		}

		if ( array_key_exists( 'meta', $raw ) && is_array( $raw['meta'] ) ) {
			$payload['meta_json'] = wp_json_encode( self::sanitize_meta( $raw['meta'] ) );
		}

		if ( ! $partial && empty( $payload['group_slug'] ) ) {
			return new WP_Error( 'mmed_session_slug_required', 'Session slug is required.', array( 'status' => 400 ) );
		}

		if ( ! $partial && empty( $payload['group_name'] ) ) {
			return new WP_Error( 'mmed_session_name_required', 'Session name is required.', array( 'status' => 400 ) );
		}

		return $payload;
	}

	/**
	 * Generate weekly date strings within a range.
	 *
	 * @param string $day_name Day of week.
	 * @param string $start    Start date.
	 * @param string $end      End date.
	 * @return array
	 */
	private static function get_weekly_dates( $day_name, $start, $end ) {
		$dates   = array();
		$current = strtotime( 'next ' . $day_name, strtotime( $start ) - DAY_IN_SECONDS );
		$end_ts  = strtotime( $end );

		if ( date( 'l', strtotime( $start ) ) === $day_name ) {
			$current = strtotime( $start );
		}

		while ( $current && $current <= $end_ts ) {
			$dates[] = date( 'Y-m-d', $current );
			$current = strtotime( '+7 days', $current );
		}

		return $dates;
	}

	/**
	 * Return aliases for enrollment template compatibility.
	 *
	 * @param string $slug Template slug.
	 * @return array
	 */
	private static function template_aliases( $slug ) {
		$slug = sanitize_key( $slug );

		if ( in_array( $slug, array( '360elite', '360elite_onboarding' ), true ) ) {
			return array( '360elite', '360elite_onboarding' );
		}

		return array( $slug );
	}

	/**
	 * Get mapped LearnDash course IDs for a template.
	 *
	 * @param array $aliases Template aliases.
	 * @return array
	 */
	private static function course_ids_for_template( $aliases ) {
		$course_ids = array();
		$mappings   = MMED_Access_Audit::get_program_mappings();

		foreach ( $mappings as $mapping ) {
			$mapping_slugs = array_filter(
				array(
					$mapping['slug'] ?? '',
					$mapping['template_slug'] ?? '',
				)
			);

			if ( array_intersect( $aliases, $mapping_slugs ) && ! empty( $mapping['course_id'] ) ) {
				$course_ids[] = absint( $mapping['course_id'] );
			}
		}

		return array_values( array_unique( array_filter( $course_ids ) ) );
	}

	/**
	 * Decode stored metadata.
	 *
	 * @param string|null $json JSON value.
	 * @return array
	 */
	private static function decode_meta( $json ) {
		if ( empty( $json ) ) {
			return array();
		}

		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Sanitize recursive metadata.
	 *
	 * @param array $meta Metadata.
	 * @return array
	 */
	private static function sanitize_meta( $meta ) {
		$clean = array();

		foreach ( $meta as $key => $value ) {
			$key = sanitize_key( $key );
			if ( is_array( $value ) ) {
				$clean[ $key ] = self::sanitize_meta( $value );
			} elseif ( is_bool( $value ) ) {
				$clean[ $key ] = $value;
			} elseif ( is_numeric( $value ) ) {
				$clean[ $key ] = 0 + $value;
			} else {
				$clean[ $key ] = sanitize_text_field( $value );
			}
		}

		return $clean;
	}

	/**
	 * Sanitize an enum.
	 *
	 * @param mixed  $value   Raw value.
	 * @param array  $allowed Allowed values.
	 * @param string $default Default value.
	 * @return string
	 */
	private static function sanitize_enum( $value, $allowed, $default ) {
		$value = sanitize_text_field( (string) $value );
		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * Sanitize a time string.
	 *
	 * @param string $value Raw time.
	 * @return string|null
	 */
	private static function sanitize_time( $value ) {
		$value = sanitize_text_field( (string) $value );

		if ( preg_match( '/^\d{2}:\d{2}$/', $value ) ) {
			$value .= ':00';
		}

		return preg_match( '/^\d{2}:\d{2}:\d{2}$/', $value ) ? $value : null;
	}

	/**
	 * Sanitize a date string.
	 *
	 * @param string $value Raw date.
	 * @return string|null
	 */
	private static function sanitize_date( $value ) {
		$value = sanitize_text_field( (string) $value );
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : null;
	}

	/**
	 * Supported days.
	 *
	 * @return array
	 */
	private static function days() {
		return array( 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', '' );
	}

	/**
	 * Supported platforms.
	 *
	 * @return array
	 */
	private static function platforms() {
		return array( 'webex', 'zoom', 'google_meet', 'teams', '' );
	}

	/**
	 * Supported event types.
	 *
	 * @return array
	 */
	private static function event_types() {
		return array( 'appointment', 'deadline', 'study_block', 'milestone', 'exam', 'interview', 'general', 'drill_step1', 'drill_step23', 'mr_session', 'mock_interview', 'nrmp_date', 'rotation', 'arena_event', 'office_hours', 'mock_interview_slot', 'custom' );
	}

	/**
	 * wpdb format map for dynamic payloads.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	private static function format_map( $payload ) {
		$formats = array();

		foreach ( array_keys( $payload ) as $key ) {
			$formats[] = in_array( $key, array( 'id', 'instructor_id', 'reminders_enabled', 'is_active' ), true ) ? '%d' : '%s';
		}

		return $formats;
	}
}

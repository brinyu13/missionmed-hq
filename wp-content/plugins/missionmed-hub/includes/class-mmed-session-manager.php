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
	const DB_VERSION = '20260518.1';

	/**
	 * Initialize runtime checks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
		self::seed_defaults();
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

		return new WP_REST_Response( self::format_group( self::get_group_by_id( (int) $wpdb->insert_id ) ), 201 );
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
	 * @param string $template Enrollment template slug.
	 * @return WP_User[]
	 */
	public static function get_enrolled_students( $template ) {
		$aliases  = self::template_aliases( $template );
		$user_map = array();

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

		if ( function_exists( 'learndash_user_get_enrolled_courses' ) && class_exists( 'MMED_Access_Audit' ) ) {
			$course_ids = self::course_ids_for_template( $aliases );
			if ( ! empty( $course_ids ) ) {
				$users = get_users( array( 'fields' => 'all' ) );
				foreach ( $users as $user ) {
					$enrolled = learndash_user_get_enrolled_courses( $user->ID );
					if ( is_array( $enrolled ) && array_intersect( array_map( 'absint', $enrolled ), $course_ids ) && ! empty( $user->user_email ) ) {
						$user_map[ $user->ID ] = $user;
					}
				}
			}
		}

		return array_values( $user_map );
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

		$table   = MMED_Calendar_Engine::table_name();
		$updated = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET meeting_url = %s, meeting_platform = %s, updated_at = %s WHERE source = 'enrollment' AND event_type = %s AND title = %s AND start_at >= %s",
				(string) $group->meeting_url,
				(string) $group->meeting_platform,
				current_time( 'mysql' ),
				(string) $group->event_type,
				(string) $group->group_name,
				current_time( 'mysql' )
			)
		);

		return false === $updated ? 0 : (int) $updated;
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
		return array( 'appointment', 'deadline', 'study_block', 'milestone', 'exam', 'interview', 'general', 'drill_step1', 'drill_step23', 'mr_session', 'mock_interview', 'nrmp_date', 'rotation', 'arena_event', 'custom' );
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
			$formats[] = in_array( $key, array( 'id', 'instructor_id', 'is_active' ), true ) ? '%d' : '%s';
		}

		return $formats;
	}
}

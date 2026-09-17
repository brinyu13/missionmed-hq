<?php
/**
 * MissionMed Office Hours queue.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Server-authoritative office hours queue.
 */
class MMED_Office_Hours {

	const DB_VERSION = '20260519.1';

	/**
	 * Initialize runtime checks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
	}

	/**
	 * Return queue table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_office_hours_queue';
	}

	/**
	 * Create or update table.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_office_hours_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			session_group_id bigint(20) unsigned NOT NULL,
			event_date date NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			queue_position int unsigned NOT NULL DEFAULT 0,
			status varchar(30) NOT NULL DEFAULT 'waiting',
			question_preview varchar(220) NOT NULL DEFAULT '',
			joined_at datetime NOT NULL,
			admitted_at datetime NULL,
			completed_at datetime NULL,
			duration_minutes int unsigned NULL,
			PRIMARY KEY  (id),
			KEY session_date_status (session_group_id, event_date, status),
			KEY user_session_date (user_id, session_group_id, event_date)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_office_hours_db_version', self::DB_VERSION, false );
	}

	/**
	 * Join a queue with concurrency protection.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param int    $user_id          User ID.
	 * @param string $question_preview Question preview.
	 * @return array|WP_Error
	 */
	public static function join_queue( $session_group_id, $event_date, $user_id, $question_preview ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$user_id          = absint( $user_id );
		$question_preview = sanitize_text_field( $question_preview );
		$question_preview = function_exists( 'mb_substr' ) ? mb_substr( $question_preview, 0, 200 ) : substr( $question_preview, 0, 200 );

		if ( ! $session_group_id || ! $event_date || ! $user_id ) {
			return new WP_Error( 'mmed_office_hours_invalid', 'Session group, date, and user are required.', array( 'status' => 400 ) );
		}

		if ( ! self::user_can_access_office_hours( $session_group_id, $user_id ) ) {
			return new WP_Error( 'mmed_office_hours_forbidden', 'You do not have access to this office hours session.', array( 'status' => 403 ) );
		}

		$existing = self::get_active_entry_row( $session_group_id, $event_date, $user_id );
		if ( $existing ) {
			return array(
				'entry'        => self::format_entry( $existing ),
				'duplicate'    => true,
				'estimated_wait' => self::estimate_wait( (int) $existing->queue_position, self::get_queue_settings( $session_group_id )['slot_duration_minutes'] ),
			);
		}

		$settings = self::get_queue_settings( $session_group_id );
		$lock     = self::lock_name( $session_group_id, $event_date );
		$got_lock = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $lock ) );

		if ( 1 !== $got_lock ) {
			return new WP_Error( 'mmed_office_hours_lock_failed', 'Queue is busy. Please try again.', array( 'status' => 409 ) );
			}

			try {
				$existing_locked = self::get_active_entry_row( $session_group_id, $event_date, $user_id );
				if ( $existing_locked ) {
					return array(
						'entry'          => self::format_entry( $existing_locked ),
						'duplicate'      => true,
						'estimated_wait' => self::estimate_wait( (int) $existing_locked->queue_position, $settings['slot_duration_minutes'] ),
					);
				}

				$active_count = (int) $wpdb->get_var(
					$wpdb->prepare(
						'SELECT COUNT(*) FROM ' . self::table_name() . " WHERE session_group_id = %d AND event_date = %s AND status IN ('waiting', 'admitted')",
					$session_group_id,
					$event_date
				)
			);

			if ( $settings['max_queue_size'] > 0 && $active_count >= $settings['max_queue_size'] ) {
				return new WP_Error( 'mmed_office_hours_full', 'This office hours queue is full.', array( 'status' => 409 ) );
			}

			$position = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT COALESCE(MAX(queue_position), 0) + 1 FROM ' . self::table_name() . ' WHERE session_group_id = %d AND event_date = %s',
					$session_group_id,
					$event_date
				)
			);

			$payload = array(
				'session_group_id'  => $session_group_id,
				'event_date'        => $event_date,
				'user_id'           => $user_id,
				'queue_position'    => $position,
				'status'            => 'waiting',
				'question_preview'  => $question_preview,
				'joined_at'         => current_time( 'mysql' ),
			);

			$inserted = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
			if ( false === $inserted ) {
				return new WP_Error( 'mmed_office_hours_join_failed', 'Queue entry could not be created.', array( 'status' => 500 ) );
			}

			$row = self::get_entry_row( (int) $wpdb->insert_id );
			return array(
				'entry'          => self::format_entry( $row ),
				'duplicate'      => false,
				'estimated_wait' => self::estimate_wait( $position, $settings['slot_duration_minutes'] ),
			);
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock ) );
		}
	}

	/**
	 * Return full queue for admins.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return array
	 */
	public static function get_queue( $session_group_id, $event_date ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );

		if ( ! $session_group_id || ! $event_date ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE session_group_id = %d AND event_date = %s ORDER BY queue_position ASC, id ASC',
				$session_group_id,
				$event_date
			)
		);

		return array_map( array( __CLASS__, 'format_entry' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Return one user's position.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param int    $user_id          User ID.
	 * @return array
	 */
	public static function get_position( $session_group_id, $event_date, $user_id ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$user_id          = absint( $user_id );
		$settings         = self::get_queue_settings( $session_group_id );

		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE session_group_id = %d AND event_date = %s AND user_id = %d ORDER BY FIELD(status, %s, %s, %s, %s, %s), id DESC LIMIT 1',
				$session_group_id,
				$event_date,
				$user_id,
				'admitted',
				'waiting',
				'completed',
				'left',
				'skipped'
			)
		);

		if ( ! $row ) {
			return array(
				'entry'          => null,
				'estimated_wait' => 0,
				'settings'       => $settings,
			);
		}

		return array(
			'entry'          => self::format_entry( $row ),
			'estimated_wait' => self::estimate_wait( (int) $row->queue_position, $settings['slot_duration_minutes'] ),
			'settings'       => $settings,
		);
	}

	/**
	 * Admit the next waiting student.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return array|WP_Error
	 */
	public static function admit_next( $session_group_id, $event_date ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );

		$current = self::get_current_admitted_row( $session_group_id, $event_date );
		if ( $current ) {
			return array(
				'admitted' => self::format_entry( $current ),
				'message'  => 'A student is already admitted.',
			);
		}

		$next = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . " WHERE session_group_id = %d AND event_date = %s AND status = 'waiting' ORDER BY queue_position ASC, joined_at ASC, id ASC LIMIT 1",
				$session_group_id,
				$event_date
			)
		);

		if ( ! $next ) {
			return array(
				'admitted' => null,
				'message'  => 'No waiting students.',
			);
		}

		$updated = $wpdb->update(
			self::table_name(),
			array(
				'status'      => 'admitted',
				'admitted_at' => current_time( 'mysql' ),
			),
			array(
				'id'     => (int) $next->id,
				'status' => 'waiting',
			),
			array( '%s', '%s' ),
			array( '%d', '%s' )
		);

		if ( 1 !== (int) $updated ) {
			return new WP_Error( 'mmed_office_hours_admit_failed', 'Next student could not be admitted.', array( 'status' => 409 ) );
		}

		return array(
			'admitted' => self::format_entry( self::get_entry_row( (int) $next->id ) ),
			'message'  => 'Student admitted.',
		);
	}

	/**
	 * Complete the current admitted student and admit the next one.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return array|WP_Error
	 */
	public static function complete_current( $session_group_id, $event_date ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$current          = self::get_current_admitted_row( $session_group_id, $event_date );

		if ( ! $current ) {
			return array(
				'completed'     => null,
				'next_admitted' => self::admit_next( $session_group_id, $event_date ),
			);
		}

		$duration = null;
		if ( ! empty( $current->admitted_at ) ) {
			$duration = max( 1, (int) ceil( ( current_time( 'timestamp' ) - strtotime( $current->admitted_at ) ) / 60 ) );
		}

		$updated = $wpdb->update(
			self::table_name(),
			array(
				'status'           => 'completed',
				'completed_at'     => current_time( 'mysql' ),
				'duration_minutes' => $duration,
			),
			array( 'id' => (int) $current->id ),
			array( '%s', '%s', '%d' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_office_hours_complete_failed', 'Current queue entry could not be completed.', array( 'status' => 500 ) );
		}

		return array(
			'completed'     => self::format_entry( self::get_entry_row( (int) $current->id ) ),
			'next_admitted' => self::admit_next( $session_group_id, $event_date ),
		);
	}

	/**
	 * Skip a student.
	 *
	 * @param int $queue_id Queue entry ID.
	 * @return array|WP_Error
	 */
	public static function skip_student( $queue_id ) {
		global $wpdb;

		$queue_id = absint( $queue_id );
		$row      = self::get_entry_row( $queue_id );

		if ( ! $row ) {
			return new WP_Error( 'mmed_office_hours_entry_not_found', 'Queue entry not found.', array( 'status' => 404 ) );
		}

		$updated = $wpdb->update(
			self::table_name(),
			array(
				'status'       => 'skipped',
				'completed_at' => current_time( 'mysql' ),
			),
			array( 'id' => $queue_id ),
			array( '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_office_hours_skip_failed', 'Queue entry could not be skipped.', array( 'status' => 500 ) );
		}

		return self::format_entry( self::get_entry_row( $queue_id ) );
	}

	/**
	 * Leave the active queue.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param int    $user_id          User ID.
	 * @return array|WP_Error
	 */
	public static function leave_queue( $session_group_id, $event_date, $user_id ) {
		global $wpdb;

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$user_id          = absint( $user_id );
		$row              = self::get_active_entry_row( $session_group_id, $event_date, $user_id );

		if ( ! $row ) {
			return array(
				'entry'   => null,
				'message' => 'No active queue entry.',
			);
		}

		$updated = $wpdb->update(
			self::table_name(),
			array(
				'status'       => 'left',
				'completed_at' => current_time( 'mysql' ),
			),
			array( 'id' => (int) $row->id ),
			array( '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_office_hours_leave_failed', 'Queue entry could not be updated.', array( 'status' => 500 ) );
		}

		return array(
			'entry'   => self::format_entry( self::get_entry_row( (int) $row->id ) ),
			'message' => 'You left the queue.',
		);
	}

	/**
	 * Estimate wait in minutes.
	 *
	 * @param int $position      Queue position.
	 * @param int $slot_duration Slot duration.
	 * @return int
	 */
	public static function estimate_wait( $position, $slot_duration = 10 ) {
		$position      = max( 0, absint( $position ) );
		$slot_duration = max( 1, absint( $slot_duration ) );
		return max( 0, ( $position - 1 ) * $slot_duration );
	}

	/**
	 * Whether a user can access office hours.
	 *
	 * @param int $session_group_id Session group ID.
	 * @param int $user_id          User ID.
	 * @return bool
	 */
	public static function user_can_access_office_hours( $session_group_id, $user_id ) {
		if ( class_exists( 'MMED_Interview_Prep' ) ) {
			return MMED_Interview_Prep::user_can_access_session_group( $session_group_id, $user_id );
		}

		return current_user_can( 'manage_options' );
	}

	/**
	 * Return queue settings from session group meta or defaults.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return array
	 */
	public static function get_queue_settings( $session_group_id ) {
		$defaults = array(
			'max_queue_size'           => 20,
			'slot_duration_minutes'    => 10,
			'auto_close_queue_minutes' => 15,
		);

		if ( ! class_exists( 'MMED_Session_Manager' ) ) {
			return $defaults;
		}

		$group = MMED_Session_Manager::get_group_by_id( absint( $session_group_id ) );
		if ( ! $group || empty( $group->meta_json ) ) {
			return $defaults;
		}

		$meta = json_decode( (string) $group->meta_json, true );
		$meta = is_array( $meta ) ? $meta : array();
		$raw  = isset( $meta['office_hours'] ) && is_array( $meta['office_hours'] ) ? $meta['office_hours'] : $meta;

		return array(
			'max_queue_size'           => max( 0, absint( $raw['max_queue_size'] ?? $defaults['max_queue_size'] ) ),
			'slot_duration_minutes'    => max( 1, absint( $raw['slot_duration_minutes'] ?? $defaults['slot_duration_minutes'] ) ),
			'auto_close_queue_minutes' => max( 1, absint( $raw['auto_close_queue_minutes'] ?? $defaults['auto_close_queue_minutes'] ) ),
		);
	}

	/**
	 * Return queue stats.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return array
	 */
	public static function get_queue_stats( $session_group_id, $event_date ) {
		global $wpdb;

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$table            = self::table_name();

		$total_waiting = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE session_group_id = %d AND event_date = %s AND status = 'waiting'",
				$session_group_id,
				$event_date
			)
		);

		$students_seen = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE session_group_id = %d AND event_date = %s AND status = 'completed'",
				$session_group_id,
				$event_date
			)
		);

		$avg_wait = (float) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT AVG(TIMESTAMPDIFF(MINUTE, joined_at, admitted_at)) FROM {$table} WHERE session_group_id = %d AND event_date = %s AND admitted_at IS NOT NULL",
				$session_group_id,
				$event_date
			)
		);

		return array(
			'total_waiting'      => $total_waiting,
			'average_wait'       => round( $avg_wait, 1 ),
			'students_seen_today' => $students_seen,
			'settings'           => self::get_queue_settings( $session_group_id ),
		);
	}

	/**
	 * Format a queue entry.
	 *
	 * @param object|null $row Queue row.
	 * @return array
	 */
	public static function format_entry( $row ) {
		if ( ! $row ) {
			return array();
		}

		$user = get_user_by( 'id', (int) $row->user_id );

		return array(
			'id'                => (int) $row->id,
			'session_group_id'  => (int) $row->session_group_id,
			'event_date'        => (string) $row->event_date,
			'user_id'           => (int) $row->user_id,
			'student_name'      => $user ? $user->display_name : '',
			'queue_position'    => (int) $row->queue_position,
			'status'            => (string) $row->status,
			'question_preview'  => (string) $row->question_preview,
			'joined_at'         => (string) $row->joined_at,
			'admitted_at'       => (string) $row->admitted_at,
			'completed_at'      => (string) $row->completed_at,
			'duration_minutes'  => null === $row->duration_minutes ? null : (int) $row->duration_minutes,
		);
	}

	/**
	 * Return a raw queue entry.
	 *
	 * @param int $queue_id Queue entry ID.
	 * @return object|null
	 */
	private static function get_entry_row( $queue_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d LIMIT 1',
				absint( $queue_id )
			)
		);
	}

	/**
	 * Return an active entry for one user.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param int    $user_id          User ID.
	 * @return object|null
	 */
	private static function get_active_entry_row( $session_group_id, $event_date, $user_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . " WHERE session_group_id = %d AND event_date = %s AND user_id = %d AND status IN ('waiting', 'admitted') ORDER BY id DESC LIMIT 1",
				absint( $session_group_id ),
				self::sanitize_date( $event_date ),
				absint( $user_id )
			)
		);
	}

	/**
	 * Return the current admitted row.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return object|null
	 */
	private static function get_current_admitted_row( $session_group_id, $event_date ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . " WHERE session_group_id = %d AND event_date = %s AND status = 'admitted' ORDER BY admitted_at ASC, id ASC LIMIT 1",
				absint( $session_group_id ),
				self::sanitize_date( $event_date )
			)
		);
	}

	/**
	 * Build a MySQL named lock key.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return string
	 */
	private static function lock_name( $session_group_id, $event_date ) {
		return 'mmed_office_hours_' . absint( $session_group_id ) . '_' . preg_replace( '/[^0-9]/', '', self::sanitize_date( $event_date ) );
	}

	/**
	 * Sanitize a YYYY-MM-DD date.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_date( $value ) {
		$value = sanitize_text_field( (string) $value );
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}

	/**
	 * Return wpdb formats.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	private static function format_map( $payload ) {
		$formats = array();
		foreach ( array_keys( $payload ) as $key ) {
			if ( in_array( $key, array( 'id', 'session_group_id', 'user_id', 'queue_position', 'duration_minutes' ), true ) ) {
				$formats[] = '%d';
			} else {
				$formats[] = '%s';
			}
		}

		return $formats;
	}
}

<?php
/**
 * MissionMed Matrix Simply Schedule Appointments adapter.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Defensively syncs SSA appointments into the Matrix calendar event model.
 */
class MMED_SSA_Adapter {

	const OPTION_ENABLED = 'mmed_ssa_sync_enabled';
	const OPTION_LAST_SYNC = 'mmed_ssa_last_sync_at';
	const CRON_HOOK = 'mmed_ssa_sync';
	const CRON_SCHEDULE = 'mmed_every_15_minutes';

	/**
	 * Initialize cron hooks when SSA is available and the option is enabled.
	 *
	 * @return void
	 */
	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'cron_schedules' ) );
		add_action( self::CRON_HOOK, array( __CLASS__, 'sync_all' ) );

		if ( false === get_option( self::OPTION_ENABLED ) ) {
			add_option( self::OPTION_ENABLED, 0, '', false );
		}

		if ( self::is_active() && self::is_enabled() ) {
			self::maybe_schedule();
			return;
		}

		self::cleanup();
	}

	/**
	 * Add the 15-minute schedule required by the SSA bridge.
	 *
	 * @param array $schedules Existing cron schedules.
	 * @return array
	 */
	public static function cron_schedules( $schedules ) {
		$schedules[ self::CRON_SCHEDULE ] = array(
			'interval' => 15 * MINUTE_IN_SECONDS,
			'display'  => __( 'Every 15 minutes', 'missionmed-hub' ),
		);

		return $schedules;
	}

	/**
	 * Whether the SSA plugin appears to be active.
	 *
	 * @return bool
	 */
	public static function is_active() {
		return class_exists( 'Simply_Schedule_Appointments' ) || defined( 'SSA_VERSION' );
	}

	/**
	 * Whether sync is enabled by MissionMed settings.
	 *
	 * @return bool
	 */
	public static function is_enabled() {
		return (bool) get_option( self::OPTION_ENABLED, false );
	}

	/**
	 * Ensure the cron event is scheduled only when it can do useful work.
	 *
	 * @return void
	 */
	public static function maybe_schedule() {
		if ( ! self::is_active() || ! self::is_enabled() ) {
			self::cleanup();
			return;
		}

		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + MINUTE_IN_SECONDS, self::CRON_SCHEDULE, self::CRON_HOOK );
		}
	}

	/**
	 * Unschedule all SSA sync cron events.
	 *
	 * @return void
	 */
	public static function cleanup() {
		$timestamp = wp_next_scheduled( self::CRON_HOOK );

		while ( $timestamp ) {
			wp_unschedule_event( $timestamp, self::CRON_HOOK );
			$timestamp = wp_next_scheduled( self::CRON_HOOK );
		}
	}

	/**
	 * Return adapter status for the shell and front-end.
	 *
	 * @return array
	 */
	public static function status() {
		$active  = self::is_active();
		$enabled = self::is_enabled();

		if ( ! $active ) {
			$message = 'Simply Schedule Appointments is not installed, so Matrix calendar sync is dormant.';
		} elseif ( ! $enabled ) {
			$message = 'SSA Calendar Sync is off in MissionMed Hub settings.';
		} else {
			$message = 'SSA Calendar Sync is ready.';
		}

		return array(
			'active'      => $active,
			'enabled'     => $enabled,
			'available'   => $active && $enabled,
			'scheduled'   => (bool) wp_next_scheduled( self::CRON_HOOK ),
			'last_synced' => get_option( self::OPTION_LAST_SYNC, '' ),
			'message'     => $message,
		);
	}

	/**
	 * REST callback for a logged-in student's manual sync.
	 *
	 * @return WP_REST_Response
	 */
	public static function sync_current_user() {
		$status = self::status();

		if ( ! $status['active'] || ! $status['enabled'] ) {
			return new WP_REST_Response(
				array(
					'counts' => self::empty_counts(),
					'status' => $status,
					'message' => $status['message'],
				),
				200
			);
		}

		$result = self::sync_user( get_current_user_id() );

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * Cron callback syncing all resolvable SSA appointments modified recently.
	 *
	 * @return void
	 */
	public static function sync_all() {
		if ( ! self::is_active() || ! self::is_enabled() ) {
			self::cleanup();
			return;
		}

		self::sync_user( 0, true );
	}

	/**
	 * Sync appointments for one user, or all resolvable users for cron.
	 *
	 * @param int  $user_id WordPress user ID. Zero means resolve users from SSA rows.
	 * @param bool $cron    Whether this is the recurring cron path.
	 * @return array
	 */
	private static function sync_user( $user_id, $cron = false ) {
		global $wpdb;

		$user_id = absint( $user_id );

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return array(
				'counts' => self::empty_counts(),
				'status' => self::status(),
				'message' => 'Matrix calendar engine is unavailable.',
			);
		}

		$table_name = self::ssa_table_name();
		if ( ! self::table_exists( $table_name ) ) {
			return array(
				'counts' => self::empty_counts(),
				'status' => self::status(),
				'message' => 'SSA is active, but the appointments table was not found.',
			);
		}

		$columns = self::table_columns( $table_name );
		if ( empty( $columns ) ) {
			return array(
				'counts' => self::empty_counts(),
				'status' => self::status(),
				'message' => 'SSA appointments could not be inspected.',
			);
		}

		$rows   = self::appointment_rows( $table_name, $columns, $user_id, $cron );
		$counts = self::empty_counts();

		foreach ( $rows as $row ) {
			$row = self::row_to_array( $row );

			$owner_id = $user_id ? $user_id : self::resolve_user_id( $row, $columns );
			if ( ! $owner_id ) {
				$counts['skipped']++;
				continue;
			}

			$event = self::event_from_appointment( $row, $columns, $owner_id );
			if ( is_wp_error( $event ) ) {
				$counts['skipped']++;
				continue;
			}

			$upserted = self::upsert_event( $event );
			if ( 'inserted' === $upserted ) {
				$counts['created']++;
			} elseif ( 'updated' === $upserted ) {
				$counts['updated']++;
			} else {
				$counts['skipped']++;
			}
		}

		$counts['scanned'] = count( $rows );
		update_option( self::OPTION_LAST_SYNC, current_time( 'mysql' ), false );

		$status = self::status();

		return array(
			'counts' => $counts,
			'status' => $status,
			'message' => sprintf(
				'SSA sync scanned %1$d appointment(s), created %2$d, updated %3$d, skipped %4$d.',
				$counts['scanned'],
				$counts['created'],
				$counts['updated'],
				$counts['skipped']
			),
		);
	}

	/**
	 * Query appointment rows defensively from SSA.
	 *
	 * @param string $table_name SSA appointments table.
	 * @param array  $columns    SSA table columns.
	 * @param int    $user_id    Current user ID, or zero for cron.
	 * @param bool   $cron       Whether to limit by last sync.
	 * @return array
	 */
	private static function appointment_rows( $table_name, $columns, $user_id, $cron ) {
		global $wpdb;

		$where  = array( '1 = 1' );
		$values = array( $table_name );
		$limit  = $cron ? 250 : 100;

		if ( $user_id ) {
			$user  = get_user_by( 'id', $user_id );
			$email = $user ? $user->user_email : '';
			$parts = array();

			foreach ( array( 'user_id', 'wp_user_id', 'author_id', 'customer_id' ) as $column ) {
				if ( in_array( $column, $columns, true ) ) {
					$parts[]  = "{$column} = %d";
					$values[] = $user_id;
				}
			}

			if ( $email ) {
				foreach ( array( 'email', 'customer_email' ) as $column ) {
					if ( in_array( $column, $columns, true ) ) {
						$parts[]  = "{$column} = %s";
						$values[] = $email;
					}
				}

				if ( in_array( 'customer_information', $columns, true ) ) {
					$parts[]  = 'customer_information LIKE %s';
					$values[] = '%' . $wpdb->esc_like( $email ) . '%';
				}
			}

			if ( empty( $parts ) ) {
				return array();
			}

			$where[] = '(' . implode( ' OR ', $parts ) . ')';
		} elseif ( $cron && in_array( 'date_modified', $columns, true ) ) {
			$last_sync = get_option( self::OPTION_LAST_SYNC, '' );
			if ( $last_sync ) {
				$where[]  = 'date_modified >= %s';
				$values[] = $last_sync;
			}
		}

		$order_col = in_array( 'date_modified', $columns, true ) ? 'date_modified' : 'id';
		$values[]  = $limit;

		$sql = 'SELECT * FROM %i WHERE ' . implode( ' AND ', $where ) . " ORDER BY {$order_col} DESC LIMIT %d";

		return $wpdb->get_results( $wpdb->prepare( $sql, $values ) );
	}

	/**
	 * Map an SSA appointment row into a Matrix event payload.
	 *
	 * @param array $row     SSA appointment row.
	 * @param array $columns SSA table columns.
	 * @param int   $user_id WordPress owner ID.
	 * @return array|WP_Error
	 */
	private static function event_from_appointment( $row, $columns, $user_id ) {
		$appointment_id = absint( self::first_value( $row, array( 'id', 'appointment_id' ) ) );
		$start          = self::normalize_datetime( self::first_value( $row, array( 'start_date', 'start_datetime', 'start_at', 'date_start' ) ) );
		$end            = self::normalize_datetime( self::first_value( $row, array( 'end_date', 'end_datetime', 'end_at', 'date_end' ) ) );

		if ( ! $appointment_id || ! $start ) {
			return new WP_Error( 'mmed_ssa_skip_row', 'SSA appointment is missing an ID or start date.' );
		}

		if ( ! $end || strtotime( $end ) <= strtotime( $start ) ) {
			$end = gmdate( 'Y-m-d H:i:s', strtotime( $start . ' +1 hour' ) );
		}

		$type_value = self::first_value( $row, array( 'appointment_type', 'appointment_type_slug', 'appointment_type_id', 'type' ) );
		$status_raw = self::first_value( $row, array( 'status', 'appointment_status' ) );
		$title      = self::first_value( $row, array( 'title', 'summary', 'name', 'appointment_title' ) );

		if ( '' === $title ) {
			$title = $type_value ? 'SSA Appointment: ' . $type_value : 'SSA Appointment';
		}

		$meta = array(
			'ssa_status'           => sanitize_text_field( $status_raw ),
			'ssa_appointment_type' => sanitize_text_field( $type_value ),
			'ssa_synced_at'        => current_time( 'mysql' ),
		);

		if ( in_array( 'customer_information', $columns, true ) && ! empty( $row['customer_information'] ) ) {
			$meta['customer_email'] = self::extract_email( $row['customer_information'] );
		}

		return array(
			'user_id'     => absint( $user_id ),
			'event_type'  => 'appointment',
			'title'       => sanitize_text_field( $title ),
			'description' => sanitize_textarea_field( self::first_value( $row, array( 'description', 'notes', 'admin_notes' ) ) ),
			'start_at'    => $start,
			'end_at'      => $end,
			'all_day'     => 0,
			'location'    => sanitize_text_field( self::first_value( $row, array( 'location', 'location_name', 'web_meeting_url' ) ) ),
			'source'      => 'ssa',
			'source_id'   => (string) $appointment_id,
			'category'    => self::category_from_type( $type_value ),
			'priority'    => 1,
			'status'      => self::map_status( $status_raw ),
			'meta_json'   => wp_json_encode( $meta ),
			'updated_at'  => current_time( 'mysql' ),
		);
	}

	/**
	 * Insert or update a Matrix event using source/source_id.
	 *
	 * @param array $event Event payload.
	 * @return string inserted|updated|skipped
	 */
	private static function upsert_event( $event ) {
		global $wpdb;

		MMED_Calendar_Engine::maybe_install();
		$table_name = MMED_Calendar_Engine::table_name();

		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE user_id = %d AND source = %s AND source_id = %s LIMIT 1',
				$table_name,
				$event['user_id'],
				'ssa',
				$event['source_id']
			)
		);

		$formats = self::format_map( $event );

		if ( $existing_id ) {
			$updated = $wpdb->update(
				$table_name,
				$event,
				array( 'id' => absint( $existing_id ) ),
				$formats,
				array( '%d' )
			);

			return false === $updated ? 'skipped' : 'updated';
		}

		$event['created_at'] = current_time( 'mysql' );
		$formats            = self::format_map( $event );

		$inserted = $wpdb->insert( $table_name, $event, $formats );
		return false === $inserted ? 'skipped' : 'inserted';
	}

	/**
	 * Return the expected SSA appointments table name.
	 *
	 * @return string
	 */
	private static function ssa_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'ssa_appointments';
	}

	/**
	 * Check whether a table exists.
	 *
	 * @param string $table_name Table name.
	 * @return bool
	 */
	private static function table_exists( $table_name ) {
		global $wpdb;

		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) );
		return $found === $table_name;
	}

	/**
	 * Return column names for a database table.
	 *
	 * @param string $table_name Table name.
	 * @return array
	 */
	private static function table_columns( $table_name ) {
		global $wpdb;

		$rows = $wpdb->get_results( $wpdb->prepare( 'SHOW COLUMNS FROM %i', $table_name ) );
		if ( ! is_array( $rows ) ) {
			return array();
		}

		return array_values(
			array_filter(
				array_map(
					static function ( $row ) {
						return sanitize_key( $row->Field ?? '' );
					},
					$rows
				)
			)
		);
	}

	/**
	 * Resolve a WordPress user for cron rows.
	 *
	 * @param array $row     SSA appointment row.
	 * @param array $columns SSA table columns.
	 * @return int
	 */
	private static function resolve_user_id( $row, $columns ) {
		foreach ( array( 'user_id', 'wp_user_id', 'author_id', 'customer_id' ) as $column ) {
			if ( in_array( $column, $columns, true ) && ! empty( $row[ $column ] ) ) {
				$user = get_user_by( 'id', absint( $row[ $column ] ) );
				if ( $user ) {
					return (int) $user->ID;
				}
			}
		}

		$email = '';
		foreach ( array( 'email', 'customer_email', 'customer_information' ) as $column ) {
			if ( in_array( $column, $columns, true ) && ! empty( $row[ $column ] ) ) {
				$email = self::extract_email( $row[ $column ] );
				if ( $email ) {
					break;
				}
			}
		}

		if ( ! $email ) {
			return 0;
		}

		$user = get_user_by( 'email', $email );
		return $user ? (int) $user->ID : 0;
	}

	/**
	 * Extract an email address from plain text or JSON-ish customer data.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function extract_email( $value ) {
		if ( is_array( $value ) ) {
			foreach ( $value as $child ) {
				$email = self::extract_email( $child );
				if ( $email ) {
					return $email;
				}
			}
			return '';
		}

		$value = (string) $value;
		$json  = json_decode( $value, true );
		if ( is_array( $json ) ) {
			return self::extract_email( $json );
		}

		if ( preg_match( '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $value, $matches ) ) {
			return sanitize_email( $matches[0] );
		}

		return '';
	}

	/**
	 * Return the first non-empty value from a row.
	 *
	 * @param array $row  Row data.
	 * @param array $keys Candidate keys.
	 * @return string
	 */
	private static function first_value( $row, $keys ) {
		foreach ( $keys as $key ) {
			if ( isset( $row[ $key ] ) && '' !== (string) $row[ $key ] ) {
				return (string) $row[ $key ];
			}
		}

		return '';
	}

	/**
	 * Normalize a date/time value to local MySQL datetime.
	 *
	 * @param mixed $value Raw date/time.
	 * @return string
	 */
	private static function normalize_datetime( $value ) {
		$value = sanitize_text_field( (string) $value );
		if ( '' === $value ) {
			return '';
		}

		$timestamp = strtotime( $value );
		return $timestamp ? date_i18n( 'Y-m-d H:i:s', $timestamp ) : '';
	}

	/**
	 * Map an SSA status to Matrix calendar statuses.
	 *
	 * @param string $status Raw SSA status.
	 * @return string
	 */
	private static function map_status( $status ) {
		$status = strtolower( sanitize_text_field( (string) $status ) );

		if ( false !== strpos( $status, 'cancel' ) || false !== strpos( $status, 'declin' ) ) {
			return 'cancelled';
		}

		if ( false !== strpos( $status, 'complete' ) || false !== strpos( $status, 'past' ) ) {
			return 'completed';
		}

		return 'active';
	}

	/**
	 * Normalize an appointment type into a Calendar category.
	 *
	 * @param string $type Raw appointment type.
	 * @return string
	 */
	private static function category_from_type( $type ) {
		$category = sanitize_key( $type );
		return $category ? $category : 'appointment';
	}

	/**
	 * Convert a wpdb row object to an array.
	 *
	 * @param object|array $row Row.
	 * @return array
	 */
	private static function row_to_array( $row ) {
		return is_array( $row ) ? $row : get_object_vars( $row );
	}

	/**
	 * Return empty sync counters.
	 *
	 * @return array
	 */
	private static function empty_counts() {
		return array(
			'scanned' => 0,
			'created' => 0,
			'updated' => 0,
			'skipped' => 0,
		);
	}

	/**
	 * wpdb format map for event payloads.
	 *
	 * @param array $payload Event payload.
	 * @return array
	 */
	private static function format_map( $payload ) {
		$formats = array();

		foreach ( array_keys( $payload ) as $key ) {
			$formats[] = in_array( $key, array( 'user_id', 'all_day', 'priority' ), true ) ? '%d' : '%s';
		}

		return $formats;
	}
}

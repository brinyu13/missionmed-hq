<?php
/**
 * MissionMed Matrix communications engine.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns private admin/mentor to student communications.
 */
class MMED_Communications {

	const DB_VERSION = '20260527.1';

	const MAX_VIDEO_BYTES = 104857600;

	const VIDEO_DIR = 'mmed-comm-videos';

	/**
	 * Initialize communications storage.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
	}

	/**
	 * Create or update communications tables.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_comm_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$conversations   = self::conversation_table();
		$messages        = self::message_table();
		$reads           = self::read_table();
		$attachments     = self::attachment_table();

		dbDelta(
			"CREATE TABLE {$conversations} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				student_user_id bigint(20) unsigned NOT NULL,
				mentor_user_id bigint(20) unsigned DEFAULT 0,
				mentor_key varchar(50) NOT NULL DEFAULT '',
				created_by_admin_user_id bigint(20) unsigned DEFAULT 0,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
					status varchar(20) NOT NULL DEFAULT 'active',
					admin_starred tinyint(1) NOT NULL DEFAULT 0,
					priority varchar(20) NOT NULL DEFAULT 'normal',
					time_sensitive tinyint(1) NOT NULL DEFAULT 0,
					admin_deleted_at datetime DEFAULT NULL,
					PRIMARY KEY  (id),
					UNIQUE KEY uniq_student_mentor (student_user_id, mentor_key),
					KEY idx_student (student_user_id),
					KEY idx_mentor_user (mentor_user_id),
					KEY idx_mentor_key (mentor_key),
					KEY idx_updated (updated_at),
					KEY idx_admin_deleted (admin_deleted_at),
					KEY idx_priority (priority)
				) {$charset_collate};"
			);

		dbDelta(
			"CREATE TABLE {$messages} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				conversation_id bigint(20) unsigned NOT NULL,
				sender_user_id bigint(20) unsigned NOT NULL,
				sender_role varchar(20) NOT NULL,
				body longtext NOT NULL,
				created_at datetime NOT NULL,
					deleted_at datetime DEFAULT NULL,
					time_sensitive tinyint(1) NOT NULL DEFAULT 0,
					PRIMARY KEY  (id),
					KEY idx_conversation (conversation_id),
					KEY idx_sender (sender_user_id),
					KEY idx_sender_role (sender_role),
					KEY idx_created (created_at),
					KEY idx_time_sensitive (time_sensitive)
				) {$charset_collate};"
			);

			dbDelta(
				"CREATE TABLE {$reads} (
					id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
					message_id bigint(20) unsigned NOT NULL,
					reader_user_id bigint(20) unsigned NOT NULL,
				read_at datetime NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY uniq_message_reader (message_id, reader_user_id),
				KEY idx_message (message_id),
				KEY idx_reader (reader_user_id)
				) {$charset_collate};"
			);

		dbDelta(
			"CREATE TABLE {$attachments} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				message_id bigint(20) unsigned NOT NULL,
				conversation_id bigint(20) unsigned NOT NULL,
				uploader_user_id bigint(20) unsigned NOT NULL,
				attachment_type varchar(20) NOT NULL DEFAULT 'video',
				original_name text NOT NULL,
				stored_name varchar(255) NOT NULL,
				storage_path text NOT NULL,
				mime_type varchar(100) NOT NULL,
				file_size bigint(20) unsigned NOT NULL DEFAULT 0,
				created_at datetime NOT NULL,
				deleted_at datetime DEFAULT NULL,
				PRIMARY KEY  (id),
				KEY idx_message (message_id),
				KEY idx_conversation (conversation_id),
				KEY idx_uploader (uploader_user_id),
				KEY idx_type (attachment_type)
			) {$charset_collate};"
		);

			update_option( 'mmed_comm_db_version', self::DB_VERSION, false );
	}

	/**
	 * Conversation table name.
	 *
	 * @return string
	 */
	public static function conversation_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmhub_comm_conversations';
	}

	/**
	 * Message table name.
	 *
	 * @return string
	 */
	public static function message_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmhub_comm_messages';
	}

	/**
	 * Read receipt table name.
	 *
	 * @return string
	 */
	public static function read_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmhub_comm_message_reads';
	}

	/**
	 * Attachment table name.
	 *
	 * @return string
	 */
	public static function attachment_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmhub_comm_attachments';
	}

	/**
	 * Allowed mentor routing keys.
	 *
	 * @return array
	 */
	public static function mentors() {
		$mentors = array(
			'dr_brian' => array(
				'key'     => 'dr_brian',
				'label'   => 'Dr. Brian',
				'user_id' => absint( get_option( 'mmed_comm_mentor_dr_brian_user_id', 0 ) ),
			),
			'dr_j'     => array(
				'key'     => 'dr_j',
				'label'   => 'Dr. J',
				'user_id' => absint( get_option( 'mmed_comm_mentor_dr_j_user_id', 0 ) ),
			),
		);

		return apply_filters( 'mmed_comm_mentors', $mentors );
	}

	/**
	 * Normalize an incoming mentor key.
	 *
	 * @param string $mentor_key Incoming key.
	 * @return string
	 */
	public static function normalize_mentor_key( $mentor_key ) {
		$key = sanitize_key( $mentor_key );
		return isset( self::mentors()[ $key ] ) ? $key : '';
	}

	/**
	 * Mentor label for display.
	 *
	 * @param string $mentor_key Mentor key.
	 * @return string
	 */
	public static function mentor_label( $mentor_key ) {
		$key     = self::normalize_mentor_key( $mentor_key ) ?: 'dr_brian';
		$mentors = self::mentors();
		return sanitize_text_field( $mentors[ $key ]['label'] ?? 'MissionMed Mentor' );
	}

	/**
	 * Mentor user ID if configured.
	 *
	 * @param string $mentor_key Mentor key.
	 * @return int
	 */
	public static function mentor_user_id( $mentor_key ) {
		$key     = self::normalize_mentor_key( $mentor_key ) ?: 'dr_brian';
		$mentors = self::mentors();
		return absint( $mentors[ $key ]['user_id'] ?? 0 );
	}

	/**
	 * Search WordPress users for admin recipient selection.
	 *
	 * @param string $search Search term.
	 * @param int    $limit  Limit.
	 * @return array
	 */
	public static function list_students( $search = '', $limit = 25 ) {
		$limit = max( 1, min( 50, absint( $limit ) ?: 25 ) );
		$args  = array(
			'number'       => $limit,
			'orderby'      => 'display_name',
			'order'        => 'ASC',
			'role__not_in' => array( 'administrator' ),
			'fields'       => array( 'ID', 'display_name', 'user_email', 'user_login' ),
		);

		if ( '' !== trim( (string) $search ) ) {
			$args['search']         = '*' . esc_attr( trim( (string) $search ) ) . '*';
			$args['search_columns'] = array( 'user_login', 'user_email', 'display_name' );
		}

		$query = new WP_User_Query( $args );
		$users = $query->get_results();

		return array_map(
			static function ( $user ) {
				return array(
					'id'           => (int) $user->ID,
					'display_name' => $user->display_name ?: $user->user_login,
					'email'        => $user->user_email,
				);
			},
			is_array( $users ) ? $users : array()
		);
	}

	/**
	 * Send the same admin message to one or more students.
	 *
	 * @param array  $student_ids Student IDs.
	 * @param string $mentor_key  Mentor key.
	 * @param string $body        Message body.
	 * @param int    $sender_id   Sender user ID.
	 * @param array  $options     Delivery options.
	 * @return array|WP_Error
	 */
	public static function send_admin_message( $student_ids, $mentor_key, $body, $sender_id, $options = array() ) {
		$body       = self::clean_body( $body );
		$mentor_key = self::normalize_mentor_key( $mentor_key ) ?: 'dr_brian';
		$sender_id  = absint( $sender_id );
		$time_sensitive = ! empty( $options['time_sensitive'] );
		$priority       = self::normalize_priority( $options['priority'] ?? 'normal' );

		if ( empty( $body ) ) {
			return new WP_Error( 'mmed_comm_empty_body', 'Message cannot be empty.', array( 'status' => 400 ) );
		}

		$student_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $student_ids ) ) ) );
		if ( empty( $student_ids ) ) {
			return new WP_Error( 'mmed_comm_no_students', 'Select at least one student.', array( 'status' => 400 ) );
		}

		$sent = array();
		foreach ( $student_ids as $student_id ) {
				$conversation = self::find_or_create_conversation( $student_id, $mentor_key, $sender_id );
				if ( is_wp_error( $conversation ) ) {
					continue;
				}

				self::restore_admin_inbox( (int) $conversation->id );
				if ( $time_sensitive || 'normal' !== $priority ) {
					self::update_conversation_flags(
						(int) $conversation->id,
						array(
							'time_sensitive' => $time_sensitive,
							'priority'       => $time_sensitive && 'normal' === $priority ? 'urgent' : $priority,
						)
					);
				}

				$message_id = self::insert_message( (int) $conversation->id, $sender_id, 'admin', self::time_sensitive_body( $body, $time_sensitive ), $time_sensitive );
				if ( ! is_wp_error( $message_id ) ) {
					self::touch_conversation( (int) $conversation->id );
					$sent[] = self::get_conversation_summary( (int) $conversation->id, $sender_id, 'admin', true );
			}
		}

		if ( empty( $sent ) ) {
			return new WP_Error( 'mmed_comm_send_failed', 'No messages were sent.', array( 'status' => 500 ) );
		}

		return array(
			'sent'          => count( $sent ),
			'conversations' => $sent,
		);
	}

	/**
	 * Start or continue a student thread to a mentor.
	 *
	 * @param int    $student_id  Student ID.
	 * @param string $mentor_key  Mentor key.
	 * @param string $body        Message body.
	 * @return array|WP_Error
	 */
	public static function send_student_message( $student_id, $mentor_key, $body ) {
		$student_id  = absint( $student_id );
		$mentor_key  = self::normalize_mentor_key( $mentor_key );
		$body        = self::clean_body( $body );

		if ( ! $mentor_key ) {
			return new WP_Error( 'mmed_comm_bad_mentor', 'Choose Dr. Brian or Dr. J.', array( 'status' => 400 ) );
		}

		if ( empty( $body ) ) {
			return new WP_Error( 'mmed_comm_empty_body', 'Message cannot be empty.', array( 'status' => 400 ) );
		}

		$conversation = self::find_or_create_conversation( $student_id, $mentor_key, 0 );
		if ( is_wp_error( $conversation ) ) {
			return $conversation;
		}

		$message_id = self::insert_message( (int) $conversation->id, $student_id, 'student', $body );
		if ( is_wp_error( $message_id ) ) {
			return $message_id;
		}

		self::restore_admin_inbox( (int) $conversation->id );
		self::touch_conversation( (int) $conversation->id );

		return self::get_conversation( (int) $conversation->id, $student_id, 'student' );
	}

	/**
	 * Reply to a conversation.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $sender_id       Sender ID.
	 * @param string $sender_role     Sender role.
	 * @param string $body            Message body.
	 * @param array  $options         Reply options.
	 * @return array|WP_Error
	 */
	public static function reply( $conversation_id, $sender_id, $sender_role, $body, $options = array() ) {
		$conversation_id = absint( $conversation_id );
		$sender_id       = absint( $sender_id );
		$sender_role     = 'student' === $sender_role ? 'student' : 'admin';
		$body            = self::clean_body( $body );
		$time_sensitive  = ! empty( $options['time_sensitive'] );
		$priority        = self::normalize_priority( $options['priority'] ?? 'normal' );

		if ( empty( $body ) ) {
			return new WP_Error( 'mmed_comm_empty_body', 'Message cannot be empty.', array( 'status' => 400 ) );
		}

		$conversation = self::get_conversation_row( $conversation_id );
		if ( ! $conversation ) {
			return new WP_Error( 'mmed_comm_not_found', 'Conversation not found.', array( 'status' => 404 ) );
		}

		if ( 'student' === $sender_role && (int) $conversation->student_user_id !== $sender_id ) {
			return new WP_Error( 'mmed_comm_forbidden', 'You cannot access this conversation.', array( 'status' => 403 ) );
		}

		if ( 'student' === $sender_role ) {
			self::restore_admin_inbox( $conversation_id );
		} elseif ( $time_sensitive || 'normal' !== $priority ) {
			self::update_conversation_flags(
				$conversation_id,
				array(
					'time_sensitive' => $time_sensitive,
					'priority'       => $time_sensitive && 'normal' === $priority ? 'urgent' : $priority,
				)
			);
		}

		$message_id = self::insert_message( $conversation_id, $sender_id, $sender_role, self::time_sensitive_body( $body, $time_sensitive ), $time_sensitive );
		if ( is_wp_error( $message_id ) ) {
			return $message_id;
		}

		self::touch_conversation( $conversation_id );
		return self::get_conversation( $conversation_id, $sender_id, $sender_role, 'student' === $sender_role );
	}

	/**
	 * Upload and attach a private video message to an existing conversation.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $sender_id       Sender ID.
	 * @param string $sender_role     Sender role.
	 * @param array  $file            Uploaded file array.
	 * @param string $body            Optional caption.
	 * @return array|WP_Error
	 */
	public static function upload_video( $conversation_id, $sender_id, $sender_role, $file, $body = '' ) {
		global $wpdb;
		self::maybe_install();

		$conversation_id = absint( $conversation_id );
		$sender_id       = absint( $sender_id );
		$sender_role     = 'student' === $sender_role ? 'student' : 'admin';
		$body            = self::clean_body( $body );

		$conversation = self::get_conversation_row( $conversation_id );
		if ( ! $conversation ) {
			return new WP_Error( 'mmed_comm_not_found', 'Conversation not found.', array( 'status' => 404 ) );
		}

		if ( ! self::viewer_can_access_conversation( $conversation, $sender_id, $sender_role ) ) {
			return new WP_Error( 'mmed_comm_forbidden', 'You cannot access this conversation.', array( 'status' => 403 ) );
		}

		$checked = self::validate_video_upload( $file );
		if ( is_wp_error( $checked ) ) {
			return $checked;
		}

		$storage = self::communication_video_storage_dir();
		if ( is_wp_error( $storage ) ) {
			return $storage;
		}

		$extension   = $checked['extension'];
		$stored_name = 'comm-video-' . $conversation_id . '-' . time() . '-' . wp_generate_password( 12, false, false ) . '.' . $extension;
		$target_path = trailingslashit( $storage ) . $stored_name;

		if ( ! move_uploaded_file( $file['tmp_name'], $target_path ) ) {
			return new WP_Error( 'mmed_comm_video_move_failed', 'Video could not be stored.', array( 'status' => 500 ) );
		}

		if ( 'student' === $sender_role ) {
			self::restore_admin_inbox( $conversation_id );
		}

		$message_id = self::insert_message( $conversation_id, $sender_id, $sender_role, $body ?: 'Video message', false );
		if ( is_wp_error( $message_id ) ) {
			@unlink( $target_path );
			return $message_id;
		}

		$ok = $wpdb->insert(
			self::attachment_table(),
			array(
				'message_id'       => $message_id,
				'conversation_id'  => $conversation_id,
				'uploader_user_id' => $sender_id,
				'attachment_type'  => 'video',
				'original_name'    => sanitize_file_name( $file['name'] ),
				'stored_name'      => $stored_name,
				'storage_path'     => $target_path,
				'mime_type'        => $checked['mime_type'],
				'file_size'        => absint( $file['size'] ),
				'created_at'       => current_time( 'mysql' ),
				'deleted_at'       => null,
			),
			array( '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' )
		);

		if ( false === $ok ) {
			@unlink( $target_path );
			self::soft_delete_message( $message_id );
			return new WP_Error( 'mmed_comm_video_attach_failed', 'Video metadata could not be saved.', array( 'status' => 500 ) );
		}

		self::touch_conversation( $conversation_id );
		return self::get_conversation( $conversation_id, $sender_id, $sender_role, 'student' === $sender_role );
	}

	/**
	 * Stream a private communication attachment after caller authorization.
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param int    $viewer_id     Viewer ID.
	 * @param string $viewer_role   Viewer role.
	 * @param bool   $download      Force attachment download.
	 * @return WP_Error|void
	 */
	public static function stream_attachment( $attachment_id, $viewer_id, $viewer_role, $download = false ) {
		$attachment = self::get_attachment_for_viewer( $attachment_id, $viewer_id, $viewer_role );
		if ( is_wp_error( $attachment ) ) {
			return $attachment;
		}

		$path = (string) $attachment->storage_path;
		if ( ! $path || ! file_exists( $path ) || ! is_readable( $path ) ) {
			return new WP_Error( 'mmed_comm_video_missing', 'Video file not found.', array( 'status' => 404 ) );
		}

		$size  = filesize( $path );
		$start = 0;
		$end   = max( 0, $size - 1 );

		if ( ! empty( $_SERVER['HTTP_RANGE'] ) && preg_match( '/bytes=(\d*)-(\d*)/', sanitize_text_field( wp_unslash( $_SERVER['HTTP_RANGE'] ) ), $matches ) ) {
			if ( '' !== $matches[1] ) {
				$start = min( $end, absint( $matches[1] ) );
			}
			if ( '' !== $matches[2] ) {
				$end = min( $end, absint( $matches[2] ) );
			}
			if ( $start > $end ) {
				$start = 0;
			}
			status_header( 206 );
			header( 'Content-Range: bytes ' . $start . '-' . $end . '/' . $size );
		} else {
			status_header( 200 );
		}

		while ( ob_get_level() ) {
			ob_end_clean();
		}

		$length = $end - $start + 1;
		header( 'Content-Type: ' . ( $attachment->mime_type ?: 'video/webm' ) );
		header( 'Content-Length: ' . $length );
		header( 'Accept-Ranges: bytes' );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Cache-Control: private, no-store, no-cache, must-revalidate' );
		header( 'Pragma: no-cache' );
		header( 'Content-Disposition: ' . ( $download ? 'attachment' : 'inline' ) . '; filename="' . sanitize_file_name( $attachment->original_name ?: $attachment->stored_name ) . '"' );

		self::read_file_range( $path, $start, $length );
		exit;
	}

	/**
	 * Update admin-only thread controls.
	 *
	 * @param int   $conversation_id Conversation ID.
	 * @param int   $viewer_id       Admin viewer ID.
	 * @param array $updates         Incoming metadata.
	 * @return array|WP_Error
	 */
	public static function update_admin_thread_meta( $conversation_id, $viewer_id, $updates ) {
		self::maybe_install();

		$conversation_id = absint( $conversation_id );
		$conversation    = self::get_conversation_row( $conversation_id );
		if ( ! $conversation ) {
			return new WP_Error( 'mmed_comm_not_found', 'Conversation not found.', array( 'status' => 404 ) );
		}

		self::update_conversation_flags( $conversation_id, $updates );
		return self::get_conversation( $conversation_id, absint( $viewer_id ), 'admin', false );
	}

	/**
	 * Hide a thread from the admin inbox without deleting the student copy.
	 *
	 * @param int $conversation_id Conversation ID.
	 * @param int $viewer_id       Admin viewer ID.
	 * @return array|WP_Error
	 */
	public static function delete_admin_thread( $conversation_id, $viewer_id ) {
		global $wpdb;
		self::maybe_install();

		$conversation_id = absint( $conversation_id );
		$conversation    = self::get_conversation_row( $conversation_id );
		if ( ! $conversation ) {
			return new WP_Error( 'mmed_comm_not_found', 'Conversation not found.', array( 'status' => 404 ) );
		}

		$wpdb->update(
			self::conversation_table(),
			array( 'admin_deleted_at' => current_time( 'mysql' ) ),
			array( 'id' => $conversation_id ),
			array( '%s' ),
			array( '%d' )
		);

		return array(
			'deleted'        => true,
			'conversation_id' => $conversation_id,
			'conversations'   => self::list_admin_conversations( absint( $viewer_id ) ),
		);
	}

	/**
	 * Manually mark one opposite-side message read.
	 *
	 * @param int    $message_id  Message ID.
	 * @param int    $reader_id   Reader ID.
	 * @param string $reader_role Reader role.
	 * @return array|WP_Error
	 */
	public static function mark_message_read( $message_id, $reader_id, $reader_role ) {
		global $wpdb;
		self::maybe_install();

		$message_id  = absint( $message_id );
		$reader_id   = absint( $reader_id );
		$reader_role = 'student' === $reader_role ? 'student' : 'admin';

		$message = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::message_table() . ' WHERE id = %d AND deleted_at IS NULL LIMIT 1',
				$message_id
			)
		);

		if ( ! $message ) {
			return new WP_Error( 'mmed_comm_message_not_found', 'Message not found.', array( 'status' => 404 ) );
		}

		$conversation = self::get_conversation_row( (int) $message->conversation_id );
		if ( ! $conversation || ! self::viewer_can_access_conversation( $conversation, $reader_id, $reader_role ) ) {
			return new WP_Error( 'mmed_comm_forbidden', 'You cannot access this message.', array( 'status' => 403 ) );
		}

		$allowed_sender_roles = 'student' === $reader_role ? array( 'admin', 'mentor' ) : array( 'student' );
		if ( ! in_array( (string) $message->sender_role, $allowed_sender_roles, true ) || (int) $message->sender_user_id === $reader_id ) {
			return new WP_Error( 'mmed_comm_bad_read_target', 'This message cannot be marked read by you.', array( 'status' => 400 ) );
		}

		$wpdb->query(
			$wpdb->prepare(
				'INSERT IGNORE INTO ' . self::read_table() . ' (message_id, reader_user_id, read_at) VALUES (%d, %d, %s)',
				$message_id,
				$reader_id,
				current_time( 'mysql' )
			)
		);

		return self::get_conversation( (int) $message->conversation_id, $reader_id, $reader_role, false );
	}

	/**
	 * List conversations for an admin or mentor.
	 *
	 * @param int    $viewer_id  Viewer user ID.
	 * @param string $mentor_key Optional mentor key.
	 * @return array
	 */
	public static function list_admin_conversations( $viewer_id, $mentor_key = '' ) {
		global $wpdb;
		self::maybe_install();

			$where  = "WHERE status = 'active' AND admin_deleted_at IS NULL";
		$params = array();
		$key    = self::normalize_mentor_key( $mentor_key );
		if ( $key ) {
			$where    .= ' AND mentor_key = %s';
			$params[] = $key;
		}

			$sql = 'SELECT * FROM ' . self::conversation_table() . " {$where} ORDER BY admin_starred DESC, FIELD(priority, 'urgent', 'high', 'normal', 'low') ASC, time_sensitive DESC, updated_at DESC LIMIT 100";
		$rows = empty( $params ) ? $wpdb->get_results( $sql ) : $wpdb->get_results( $wpdb->prepare( $sql, $params ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		return array_map(
			static function ( $row ) use ( $viewer_id ) {
				return self::get_conversation_summary( (int) $row->id, $viewer_id, 'admin', true );
			},
			is_array( $rows ) ? $rows : array()
		);
	}

	/**
	 * List conversations for one student.
	 *
	 * @param int $student_id Student user ID.
	 * @return array
	 */
	public static function list_student_conversations( $student_id ) {
		global $wpdb;
		self::maybe_install();

			$student_id = absint( $student_id );

			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM ' . self::conversation_table() . " WHERE status = 'active' AND student_user_id = %d ORDER BY updated_at DESC LIMIT 50",
					$student_id
				)
			);

		return array_map(
			static function ( $row ) use ( $student_id ) {
				return self::get_conversation_summary( (int) $row->id, $student_id, 'student', false );
			},
			is_array( $rows ) ? $rows : array()
		);
	}

	/**
	 * Get a conversation timeline and mark opposite messages read.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $viewer_id       Viewer ID.
	 * @param string $viewer_role     Viewer role.
	 * @return array|WP_Error
	 */
	public static function get_conversation( $conversation_id, $viewer_id, $viewer_role ) {
		global $wpdb;
		self::maybe_install();

		$conversation = self::get_conversation_row( $conversation_id );
		if ( ! $conversation ) {
			return new WP_Error( 'mmed_comm_not_found', 'Conversation not found.', array( 'status' => 404 ) );
		}

		$viewer_role = 'student' === $viewer_role ? 'student' : 'admin';
		if ( 'student' === $viewer_role && (int) $conversation->student_user_id !== absint( $viewer_id ) ) {
			return new WP_Error( 'mmed_comm_forbidden', 'You cannot access this conversation.', array( 'status' => 403 ) );
		}

		self::mark_read( $conversation_id, absint( $viewer_id ), $viewer_role );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::message_table() . ' WHERE conversation_id = %d AND deleted_at IS NULL ORDER BY created_at ASC, id ASC',
				absint( $conversation_id )
			)
		);

		$summary = self::format_conversation( $conversation, absint( $viewer_id ), $viewer_role, 'admin' === $viewer_role );
		$messages = array_map(
			static function ( $row ) use ( $conversation, $viewer_id, $viewer_role ) {
				return self::format_message( $row, $conversation, absint( $viewer_id ), $viewer_role );
			},
			is_array( $rows ) ? $rows : array()
		);

		return array(
			'conversation' => $summary,
			'messages'     => $messages,
			'mentors'      => self::mentor_payload(),
		);
	}

	/**
	 * Public mentor labels.
	 *
	 * @return array
	 */
	private static function mentor_payload() {
		return array_map(
			static function ( $mentor ) {
				return array(
					'key'   => sanitize_key( $mentor['key'] ?? '' ),
					'label' => sanitize_text_field( $mentor['label'] ?? '' ),
				);
			},
			array_values( self::mentors() )
		);
	}

	/**
	 * Find or create a private student plus mentor conversation.
	 *
	 * @param int    $student_id   Student ID.
	 * @param string $mentor_key   Mentor key.
	 * @param int    $created_by   Admin creator ID.
	 * @return object|WP_Error
	 */
	private static function find_or_create_conversation( $student_id, $mentor_key, $created_by ) {
		global $wpdb;
		self::maybe_install();

		$student_id = absint( $student_id );
		$mentor_key = self::normalize_mentor_key( $mentor_key );

		if ( ! $student_id || ! get_user_by( 'id', $student_id ) ) {
			return new WP_Error( 'mmed_comm_bad_student', 'Student not found.', array( 'status' => 404 ) );
		}

		if ( ! $mentor_key ) {
			return new WP_Error( 'mmed_comm_bad_mentor', 'Choose Dr. Brian or Dr. J.', array( 'status' => 400 ) );
		}

		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::conversation_table() . ' WHERE student_user_id = %d AND mentor_key = %s LIMIT 1',
				$student_id,
				$mentor_key
			)
		);

		if ( $row ) {
			return $row;
		}

		$now = current_time( 'mysql' );
		$ok  = $wpdb->insert(
			self::conversation_table(),
			array(
				'student_user_id'          => $student_id,
				'mentor_user_id'           => self::mentor_user_id( $mentor_key ),
				'mentor_key'               => $mentor_key,
				'created_by_admin_user_id' => absint( $created_by ),
				'created_at'               => $now,
				'updated_at'               => $now,
				'status'                   => 'active',
			),
			array( '%d', '%d', '%s', '%d', '%s', '%s', '%s' )
		);

		if ( false === $ok ) {
			return new WP_Error( 'mmed_comm_create_failed', 'Could not create conversation.', array( 'status' => 500 ) );
		}

		return self::get_conversation_row( (int) $wpdb->insert_id );
	}

	/**
	 * Insert a message row.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $sender_id       Sender ID.
	 * @param string $sender_role     Sender role.
	 * @param string $body            Body.
	 * @return int|WP_Error
	 */
	private static function insert_message( $conversation_id, $sender_id, $sender_role, $body, $time_sensitive = false ) {
		global $wpdb;

		$ok = $wpdb->insert(
			self::message_table(),
			array(
				'conversation_id' => absint( $conversation_id ),
				'sender_user_id'  => absint( $sender_id ),
				'sender_role'     => sanitize_key( $sender_role ),
				'body'            => self::clean_body( $body ),
				'created_at'      => current_time( 'mysql' ),
				'deleted_at'      => null,
				'time_sensitive'  => $time_sensitive ? 1 : 0,
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%d' )
		);

		if ( false === $ok ) {
			return new WP_Error( 'mmed_comm_message_failed', 'Could not save message.', array( 'status' => 500 ) );
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Mark opposite-side messages read for a viewer.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $reader_id       Reader ID.
	 * @param string $reader_role     Reader role.
	 * @return void
	 */
	private static function mark_read( $conversation_id, $reader_id, $reader_role ) {
		global $wpdb;

		$roles = 'student' === $reader_role ? array( 'admin', 'mentor' ) : array( 'student' );
		$placeholders = implode( ',', array_fill( 0, count( $roles ), '%s' ) );
		$params = array_merge( array( absint( $reader_id ), current_time( 'mysql' ), absint( $conversation_id ) ), $roles, array( absint( $reader_id ) ) );

		$wpdb->query(
			$wpdb->prepare(
				'INSERT IGNORE INTO ' . self::read_table() . " (message_id, reader_user_id, read_at)
				SELECT id, %d, %s FROM " . self::message_table() . " WHERE conversation_id = %d AND sender_role IN ({$placeholders}) AND sender_user_id <> %d AND deleted_at IS NULL",
				$params
			)
		);
	}

	/**
	 * Touch a conversation timestamp.
	 *
	 * @param int $conversation_id Conversation ID.
	 * @return void
	 */
	private static function touch_conversation( $conversation_id ) {
		global $wpdb;
		$wpdb->update(
			self::conversation_table(),
			array( 'updated_at' => current_time( 'mysql' ) ),
			array( 'id' => absint( $conversation_id ) ),
			array( '%s' ),
			array( '%d' )
		);
	}

	/**
	 * Fetch a conversation row.
	 *
	 * @param int $conversation_id Conversation ID.
	 * @return object|null
	 */
	private static function get_conversation_row( $conversation_id ) {
		global $wpdb;
		self::maybe_install();

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::conversation_table() . ' WHERE id = %d LIMIT 1',
				absint( $conversation_id )
			)
		);
	}

	/**
	 * Get a formatted conversation summary.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $viewer_id       Viewer ID.
	 * @param string $viewer_role     Viewer role.
	 * @param bool   $include_email   Include student email.
	 * @return array
	 */
	private static function get_conversation_summary( $conversation_id, $viewer_id, $viewer_role, $include_email ) {
		$row = self::get_conversation_row( $conversation_id );
		return $row ? self::format_conversation( $row, $viewer_id, $viewer_role, $include_email ) : array();
	}

	/**
	 * Format a conversation row for REST output.
	 *
	 * @param object $row           Conversation row.
	 * @param int    $viewer_id     Viewer ID.
	 * @param string $viewer_role   Viewer role.
	 * @param bool   $include_email Include student email.
	 * @return array
	 */
	private static function format_conversation( $row, $viewer_id, $viewer_role, $include_email ) {
		global $wpdb;

		$student = get_user_by( 'id', (int) $row->student_user_id );
		$last    = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::message_table() . ' WHERE conversation_id = %d AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1',
				(int) $row->id
			)
		);

		$unread = self::count_unread( (int) $row->id, absint( $viewer_id ), $viewer_role );
		$latest_read = self::latest_outbound_read( (int) $row->id, (int) $row->student_user_id, $viewer_role );
		$student_payload = array(
			'id'           => (int) $row->student_user_id,
			'display_name' => $student ? ( $student->display_name ?: $student->user_login ) : 'Student',
		);
		if ( $include_email ) {
			$student_payload['email'] = $student ? $student->user_email : '';
		}

			$payload = array(
				'id'                    => (int) $row->id,
				'student_user_id'       => (int) $row->student_user_id,
				'student'               => $student_payload,
				'mentor_key'            => (string) $row->mentor_key,
				'mentor_label'          => self::mentor_label( $row->mentor_key ),
				'created_at'            => mysql_to_rfc3339( $row->created_at ),
				'updated_at'            => mysql_to_rfc3339( $row->updated_at ),
				'is_starred'            => ! empty( $row->admin_starred ),
				'priority'              => self::normalize_priority( $row->priority ?? 'normal' ),
				'time_sensitive'        => ! empty( $row->time_sensitive ) || ( $last && ! empty( $last->time_sensitive ) ),
				'admin_deleted_at'      => ! empty( $row->admin_deleted_at ) ? mysql_to_rfc3339( $row->admin_deleted_at ) : '',
				'unread_count'          => $unread,
				'read_state'            => $unread > 0 ? 'unread' : 'read',
				'last_message_preview'  => $last ? wp_trim_words( wp_strip_all_tags( $last->body ), 18, '...' ) : '',
				'last_message_at'       => $last ? mysql_to_rfc3339( $last->created_at ) : '',
				'last_sender_role'      => $last ? (string) $last->sender_role : '',
				'latest_outbound_read'  => $latest_read,
			);

		if ( $include_email ) {
			$payload['mentor_user_id'] = (int) $row->mentor_user_id;
		}

		return $payload;
	}

	/**
	 * Format one message for REST output.
	 *
	 * @param object $row          Message row.
	 * @param object $conversation Conversation row.
	 * @param int    $viewer_id    Viewer ID.
	 * @param string $viewer_role  Viewer role.
	 * @return array
	 */
	private static function format_message( $row, $conversation, $viewer_id, $viewer_role ) {
		$sender = get_user_by( 'id', (int) $row->sender_user_id );
		$recipient_read_at = self::recipient_read_at( (int) $row->id, (int) $conversation->student_user_id, (string) $row->sender_role );

		return array(
			'id'                => (int) $row->id,
			'conversation_id'   => (int) $row->conversation_id,
			'sender_user_id'    => (int) $row->sender_user_id,
			'sender_role'       => (string) $row->sender_role,
			'sender_name'       => $sender ? ( $sender->display_name ?: $sender->user_login ) : self::mentor_label( $conversation->mentor_key ),
			'is_mine'           => (int) $row->sender_user_id === absint( $viewer_id ),
				'body'              => (string) $row->body,
				'created_at'        => mysql_to_rfc3339( $row->created_at ),
				'time_sensitive'    => ! empty( $row->time_sensitive ),
				'read_at'           => self::message_read_at( (int) $row->id, absint( $viewer_id ) ),
				'recipient_read_at' => $recipient_read_at,
				'read_status'       => $recipient_read_at ? 'read' : 'sent',
				'viewer_role'       => $viewer_role,
				'attachments'       => self::message_attachments( (int) $row->id ),
			);
	}

	/**
	 * Attachments for one message.
	 *
	 * @param int $message_id Message ID.
	 * @return array
	 */
	private static function message_attachments( $message_id ) {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::attachment_table() . ' WHERE message_id = %d AND deleted_at IS NULL ORDER BY id ASC',
				absint( $message_id )
			)
		);

		return array_map(
			static function ( $row ) {
				$stream_url = add_query_arg(
					'_wpnonce',
					wp_create_nonce( 'wp_rest' ),
					rest_url( 'mmed/v1/communications/attachments/' . absint( $row->id ) . '/stream' )
				);
				return array(
					'id'            => (int) $row->id,
					'type'          => sanitize_key( $row->attachment_type ),
					'original_name' => sanitize_file_name( $row->original_name ),
					'mime_type'     => sanitize_text_field( $row->mime_type ),
					'file_size'     => absint( $row->file_size ),
					'stream_url'    => esc_url_raw( $stream_url ),
					'download_url'  => esc_url_raw( add_query_arg( 'download', '1', $stream_url ) ),
				);
			},
			is_array( $rows ) ? $rows : array()
		);
	}

	/**
	 * Count unread opposite-side messages for a viewer.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $viewer_id       Viewer ID.
	 * @param string $viewer_role     Viewer role.
	 * @return int
	 */
	private static function count_unread( $conversation_id, $viewer_id, $viewer_role ) {
		global $wpdb;
		$roles = 'student' === $viewer_role ? array( 'admin', 'mentor' ) : array( 'student' );
		$placeholders = implode( ',', array_fill( 0, count( $roles ), '%s' ) );
		$params = array_merge( array( absint( $viewer_id ), absint( $conversation_id ) ), $roles, array( absint( $viewer_id ) ) );

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . self::message_table() . " m
				LEFT JOIN " . self::read_table() . " r ON r.message_id = m.id AND r.reader_user_id = %d
				WHERE m.conversation_id = %d AND m.sender_role IN ({$placeholders}) AND m.sender_user_id <> %d AND m.deleted_at IS NULL AND r.id IS NULL",
				$params
			)
		);
	}

	/**
	 * Read timestamp for a specific reader.
	 *
	 * @param int $message_id Message ID.
	 * @param int $reader_id  Reader ID.
	 * @return string
	 */
	private static function message_read_at( $message_id, $reader_id ) {
		global $wpdb;
		$value = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT read_at FROM ' . self::read_table() . ' WHERE message_id = %d AND reader_user_id = %d LIMIT 1',
				absint( $message_id ),
				absint( $reader_id )
			)
		);
		return $value ? mysql_to_rfc3339( $value ) : '';
	}

	/**
	 * Recipient read timestamp for sender-facing status.
	 *
	 * @param int    $message_id  Message ID.
	 * @param int    $student_id  Student ID.
	 * @param string $sender_role Sender role.
	 * @return string
	 */
	private static function recipient_read_at( $message_id, $student_id, $sender_role ) {
		global $wpdb;
		if ( 'student' === $sender_role ) {
			$value = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT read_at FROM ' . self::read_table() . ' WHERE message_id = %d AND reader_user_id <> %d ORDER BY read_at DESC LIMIT 1',
					absint( $message_id ),
					absint( $student_id )
				)
			);

			} else {
				$value = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT read_at FROM ' . self::read_table() . ' WHERE message_id = %d AND reader_user_id = %d LIMIT 1',
					absint( $message_id ),
					absint( $student_id )
				)
			);
		}

		return $value ? mysql_to_rfc3339( $value ) : '';
	}

	/**
	 * Latest outbound read status for the viewer list item.
	 *
	 * @param int    $conversation_id Conversation ID.
	 * @param int    $student_id      Student ID.
	 * @param string $viewer_role     Viewer role.
	 * @return array
	 */
	private static function latest_outbound_read( $conversation_id, $student_id, $viewer_role ) {
		global $wpdb;
		$roles = 'student' === $viewer_role ? array( 'student' ) : array( 'admin', 'mentor' );
		$placeholders = implode( ',', array_fill( 0, count( $roles ), '%s' ) );
		$params = array_merge( array( absint( $conversation_id ) ), $roles );

		$message = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::message_table() . " WHERE conversation_id = %d AND sender_role IN ({$placeholders}) AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1",
				$params
			)
		);

		if ( ! $message ) {
			return array( 'status' => 'none', 'read_at' => '' );
		}

		$read_at = self::recipient_read_at( (int) $message->id, absint( $student_id ), (string) $message->sender_role );
		return array(
			'status'  => $read_at ? 'read' : 'sent',
			'read_at' => $read_at,
		);
	}

	/**
	 * Update persisted admin conversation flags.
	 *
	 * @param int   $conversation_id Conversation ID.
	 * @param array $updates         Updates.
	 * @return void
	 */
	private static function update_conversation_flags( $conversation_id, $updates ) {
		global $wpdb;

		$data   = array();
		$format = array();

		if ( array_key_exists( 'is_starred', (array) $updates ) ) {
			$data['admin_starred'] = ! empty( $updates['is_starred'] ) ? 1 : 0;
			$format[] = '%d';
		}

		if ( array_key_exists( 'priority', (array) $updates ) ) {
			$data['priority'] = self::normalize_priority( $updates['priority'] );
			$format[] = '%s';
		}

		if ( array_key_exists( 'time_sensitive', (array) $updates ) ) {
			$data['time_sensitive'] = ! empty( $updates['time_sensitive'] ) ? 1 : 0;
			$format[] = '%d';
		}

		if ( empty( $data ) ) {
			return;
		}

		$wpdb->update(
			self::conversation_table(),
			$data,
			array( 'id' => absint( $conversation_id ) ),
			$format,
			array( '%d' )
		);
	}

	/**
	 * Restore a thread to the admin inbox when new activity occurs.
	 *
	 * @param int $conversation_id Conversation ID.
	 * @return void
	 */
	private static function restore_admin_inbox( $conversation_id ) {
		global $wpdb;
		$wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::conversation_table() . ' SET admin_deleted_at = NULL WHERE id = %d',
				absint( $conversation_id )
			)
		);
	}

	/**
	 * Normalize priority labels.
	 *
	 * @param mixed $priority Raw priority.
	 * @return string
	 */
	private static function normalize_priority( $priority ) {
		$priority = sanitize_key( $priority );
		$allowed  = array( 'low', 'normal', 'high', 'urgent' );
		return in_array( $priority, $allowed, true ) ? $priority : 'normal';
	}

	/**
	 * Prefix a message body when it must visibly alert the student.
	 *
	 * @param string $body           Body.
	 * @param bool   $time_sensitive Time-sensitive flag.
	 * @return string
	 */
	private static function time_sensitive_body( $body, $time_sensitive ) {
		$body = self::clean_body( $body );
		if ( ! $time_sensitive || preg_match( '/^time sensitive[:\s-]/i', $body ) ) {
			return $body;
		}
		return 'TIME SENSITIVE: ' . $body;
	}

	/**
	 * Validate a communications video upload.
	 *
	 * @param array $file Uploaded file array.
	 * @return array|WP_Error
	 */
	private static function validate_video_upload( $file ) {
		if ( empty( $file ) || ! is_array( $file ) || empty( $file['tmp_name'] ) ) {
			return new WP_Error( 'mmed_comm_no_video', 'No video file was received.', array( 'status' => 400 ) );
		}

		if ( ! empty( $file['error'] ) ) {
			return new WP_Error( 'mmed_comm_video_upload_error', 'Video upload failed.', array( 'status' => 400 ) );
		}

		if ( empty( $file['size'] ) || (int) $file['size'] > self::MAX_VIDEO_BYTES ) {
			return new WP_Error( 'mmed_comm_video_too_large', 'Video must be 100 MB or smaller.', array( 'status' => 400 ) );
		}

		$extension = strtolower( pathinfo( sanitize_file_name( $file['name'] ?? '' ), PATHINFO_EXTENSION ) );
		$allowed = array(
			'webm' => 'video/webm',
			'mp4'  => 'video/mp4',
			'm4v'  => 'video/mp4',
			'mov'  => 'video/quicktime',
		);

		if ( ! isset( $allowed[ $extension ] ) ) {
			return new WP_Error( 'mmed_comm_video_type', 'Use a WEBM, MP4, M4V, or MOV video.', array( 'status' => 400 ) );
		}

		$detected = '';
		if ( function_exists( 'finfo_open' ) ) {
			$finfo = finfo_open( FILEINFO_MIME_TYPE );
			if ( $finfo ) {
				$detected = (string) finfo_file( $finfo, $file['tmp_name'] );
				finfo_close( $finfo );
			}
		}

		$browser_type = sanitize_mime_type( $file['type'] ?? '' );
		$mime_type    = sanitize_mime_type( $detected ?: $browser_type ?: $allowed[ $extension ] );
		$valid_mimes  = array_unique( array_values( $allowed ) );
		if ( $mime_type && ! in_array( $mime_type, $valid_mimes, true ) && 'application/octet-stream' !== $mime_type ) {
			return new WP_Error( 'mmed_comm_video_mime', 'Video type is not allowed.', array( 'status' => 400 ) );
		}

		return array(
			'extension' => $extension,
			'mime_type' => 'application/octet-stream' === $mime_type ? $allowed[ $extension ] : $mime_type,
		);
	}

	/**
	 * Private communications video storage directory.
	 *
	 * @return string|WP_Error
	 */
	private static function communication_video_storage_dir() {
		$upload_dir = wp_upload_dir( null, false );
		if ( ! empty( $upload_dir['error'] ) || empty( $upload_dir['basedir'] ) ) {
			return new WP_Error( 'mmed_comm_storage_missing', 'Video storage is unavailable.', array( 'status' => 500 ) );
		}

		$dir = trailingslashit( $upload_dir['basedir'] ) . self::VIDEO_DIR;
		if ( ! wp_mkdir_p( $dir ) ) {
			return new WP_Error( 'mmed_comm_storage_create_failed', 'Video storage could not be created.', array( 'status' => 500 ) );
		}

		if ( ! file_exists( trailingslashit( $dir ) . 'index.html' ) ) {
			file_put_contents( trailingslashit( $dir ) . 'index.html', '' );
		}
		if ( ! file_exists( trailingslashit( $dir ) . '.htaccess' ) ) {
			file_put_contents( trailingslashit( $dir ) . '.htaccess', "Deny from all\n" );
		}

		return $dir;
	}

	/**
	 * Check conversation visibility for the current communications role.
	 *
	 * @param object $conversation Conversation row.
	 * @param int    $viewer_id    Viewer ID.
	 * @param string $viewer_role  Viewer role.
	 * @return bool
	 */
	private static function viewer_can_access_conversation( $conversation, $viewer_id, $viewer_role ) {
		if ( 'student' !== $viewer_role ) {
			return true;
		}
		return (int) $conversation->student_user_id === absint( $viewer_id );
	}

	/**
	 * Fetch an attachment only when the viewer can access its conversation.
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param int    $viewer_id     Viewer ID.
	 * @param string $viewer_role   Viewer role.
	 * @return object|WP_Error
	 */
	private static function get_attachment_for_viewer( $attachment_id, $viewer_id, $viewer_role ) {
		global $wpdb;
		self::maybe_install();

		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::attachment_table() . ' WHERE id = %d AND deleted_at IS NULL LIMIT 1',
				absint( $attachment_id )
			)
		);

		if ( ! $row ) {
			return new WP_Error( 'mmed_comm_attachment_not_found', 'Attachment not found.', array( 'status' => 404 ) );
		}

		$conversation = self::get_conversation_row( (int) $row->conversation_id );
		if ( ! $conversation || ! self::viewer_can_access_conversation( $conversation, absint( $viewer_id ), 'student' === $viewer_role ? 'student' : 'admin' ) ) {
			return new WP_Error( 'mmed_comm_forbidden', 'You cannot access this attachment.', array( 'status' => 403 ) );
		}

		return $row;
	}

	/**
	 * Soft-delete a failed attachment message.
	 *
	 * @param int $message_id Message ID.
	 * @return void
	 */
	private static function soft_delete_message( $message_id ) {
		global $wpdb;
		$wpdb->update(
			self::message_table(),
			array( 'deleted_at' => current_time( 'mysql' ) ),
			array( 'id' => absint( $message_id ) ),
			array( '%s' ),
			array( '%d' )
		);
	}

	/**
	 * Stream a byte range from a file.
	 *
	 * @param string $path   File path.
	 * @param int    $start  Start byte.
	 * @param int    $length Bytes to send.
	 * @return void
	 */
	private static function read_file_range( $path, $start, $length ) {
		$handle = fopen( $path, 'rb' );
		if ( ! $handle ) {
			return;
		}

		fseek( $handle, $start );
		$remaining = $length;
		while ( $remaining > 0 && ! feof( $handle ) ) {
			$chunk = fread( $handle, min( 8192, $remaining ) );
			if ( false === $chunk ) {
				break;
			}
			echo $chunk; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			$remaining -= strlen( $chunk );
			flush();
		}
		fclose( $handle );
	}

	/**
	 * Clean message body for plain-text storage.
	 *
	 * @param string $body Body.
	 * @return string
	 */
	private static function clean_body( $body ) {
		$body = wp_strip_all_tags( (string) $body );
		$body = preg_replace( "/\r\n|\r/", "\n", $body );
		return trim( sanitize_textarea_field( $body ) );
	}
}

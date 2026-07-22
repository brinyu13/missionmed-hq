<?php
/**
 * Pure 8010E Week command, temporal, projection, and Mission contracts.
 *
 * This file has no WordPress, database, route, or runtime side effects. It is
 * safe to exercise in isolated fixtures while Decision 12 keeps exposure off.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** A stable public exception code plus private, non-sensitive context. */
final class MMED_V1_Study_Week_Domain_Exception extends RuntimeException {

	/** @var string */
	private $reason_code;

	/** @var array */
	private $safe_context;

	/**
	 * @param string $reason_code Stable internal reason.
	 * @param array  $safe_context Non-sensitive machine context.
	 */
	public function __construct( $reason_code, $safe_context = array() ) {
		parent::__construct( (string) $reason_code );
		$this->reason_code = (string) $reason_code;
		$this->safe_context = is_array( $safe_context ) ? $safe_context : array();
	}

	/** @return string */
	public function reason_code() {
		return $this->reason_code;
	}

	/** @return array */
	public function safe_context() {
		return $this->safe_context;
	}
}

/** Explicit JSON object marker used when an empty object must remain `{}`. */
final class MMED_V1_Study_Canonical_Object {
	/** @var array */
	public $values;

	/** @param array $values Object members. */
	public function __construct( $values = array() ) {
		$this->values = is_array( $values ) ? $values : array();
	}
}

/** Pure governing behavior for the 8010E Week vertical slice. */
final class MMED_V1_Study_Week_Domain {

	const CONTRACT_VERSION       = 1;
	const SCHEMA_VERSION         = '2';
	const CURRENT_READER_VERSION = '2';
	const TEMPORAL_POLICY_VERSION = 'civil-week-v1';
	const ACTIVITY_CATALOG_VERSION = 'd9-360-v1';
	const STORAGE_CODEBOOK_VERSION = 'week-storage-v1';
	const MIN_SUPPORTED_DATE       = '2000-01-01';
	const MAX_SUPPORTED_DATE       = '2100-12-31';
	const MAX_UNSIGNED_BIGINT      = '18446744073709551615';

	const COMMAND_CREATE = 'create_block';
	const COMMAND_MOVE   = 'move_block';
	const COMMAND_RESIZE = 'resize_block';
	const COMMAND_DELETE = 'delete_block';

	const STATE_FLEXIBLE  = 'planned_flexible';
	const STATE_FIXED     = 'planned_fixed';
	const STATE_TOMBSTONE = 'tombstoned';

	const FAMILY_CODE_LEARN    = 1;
	const FAMILY_CODE_PRACTICE = 2;
	const FAMILY_CODE_ASSESS   = 3;
	const FAMILY_CODE_APPLY    = 4;
	const FAMILY_CODE_CLINICAL = 5;
	const FAMILY_CODE_LIFE     = 6;
	const STATE_CODE_FLEXIBLE  = 1;
	const STATE_CODE_FIXED     = 2;
	const STATE_CODE_TOMBSTONE = 3;
	const PRIORITY_CODE_NORMAL   = 0;
	const PRIORITY_CODE_CRITICAL = 1;
	const FOLD_CODE_NORMAL  = 0;
	const FOLD_CODE_EARLIER = 1;
	const FOLD_CODE_LATER   = 2;
	const SOURCE_CODE_MANUAL   = 1;
	const SOURCE_CODE_EXTERNAL = 2;

	const DISPLAY_START_MINUTE = 360;
	const DISPLAY_END_MINUTE   = 1440;
	const MIN_DURATION_MINUTES = 15;
	const MAX_DURATION_MINUTES = 720;
	const STEP_MINUTES         = 15;
	const MAX_TITLE_CHARACTERS = 120;

	/** @return array */
	public static function commands() {
		return array( self::COMMAND_CREATE, self::COMMAND_MOVE, self::COMMAND_RESIZE, self::COMMAND_DELETE );
	}

	/** @return array */
	public static function families() {
		return array( 'learn', 'practice', 'assess', 'apply', 'clinical', 'life' );
	}

	/** Immutable generation-2 storage codebooks. */
	public static function storage_codebooks() {
		return array(
			'family'   => array( 'learn' => self::FAMILY_CODE_LEARN, 'practice' => self::FAMILY_CODE_PRACTICE, 'assess' => self::FAMILY_CODE_ASSESS, 'apply' => self::FAMILY_CODE_APPLY, 'clinical' => self::FAMILY_CODE_CLINICAL, 'life' => self::FAMILY_CODE_LIFE ),
			'state'    => array( self::STATE_FLEXIBLE => self::STATE_CODE_FLEXIBLE, self::STATE_FIXED => self::STATE_CODE_FIXED, self::STATE_TOMBSTONE => self::STATE_CODE_TOMBSTONE ),
			'priority' => array( 'normal' => self::PRIORITY_CODE_NORMAL, 'critical' => self::PRIORITY_CODE_CRITICAL ),
			'fold'     => array( 'normal' => self::FOLD_CODE_NORMAL, 'earlier' => self::FOLD_CODE_EARLIER, 'later' => self::FOLD_CODE_LATER ),
			'source'   => array( 'manual' => self::SOURCE_CODE_MANUAL, 'external' => self::SOURCE_CODE_EXTERNAL ),
		);
	}

	/** Stable fingerprint makes accidental code reassignment detectable. */
	public static function storage_codebook_fingerprint() {
		return hash( 'sha256', self::canonical_json( self::storage_codebooks() ) );
	}

	/** @return int */
	public static function enum_code( $kind, $value ) {
		$maps = self::storage_codebooks();
		if ( ! is_string( $kind ) || ! isset( $maps[ $kind ] ) || ! is_string( $value ) || ! array_key_exists( $value, $maps[ $kind ] ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'enum_invalid' );
		}
		return $maps[ $kind ][ $value ];
	}

	/** @return string */
	public static function enum_value( $kind, $code ) {
		$maps = self::storage_codebooks();
		if ( ! is_string( $kind ) || ! isset( $maps[ $kind ] ) || ! is_int( $code ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'enum_invalid' );
		}
		$value = array_search( $code, $maps[ $kind ], true );
		if ( false === $value ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'enum_invalid' );
		}
		return $value;
	}

	/**
	 * D9-360 learner-creatable activity types and their governed family.
	 * Source-owned Calendar/Arena/ClassManager anchors are intentionally absent.
	 *
	 * @return array
	 */
	public static function activity_catalog() {
		return array(
			'qbank'             => array( 'family' => 'practice', 'minimum' => 30,  'learner_create' => true ),
			'content_review'     => array( 'family' => 'learn',    'minimum' => 30,  'learner_create' => true ),
			'video_lesson'       => array( 'family' => 'learn',    'minimum' => 15,  'learner_create' => true ),
			'flashcards'         => array( 'family' => 'practice', 'minimum' => 15,  'learner_create' => true ),
			'practice_exam'      => array( 'family' => 'assess',   'minimum' => 120, 'learner_create' => true ),
			'error_review'       => array( 'family' => 'assess',   'minimum' => 30,  'learner_create' => true ),
			'live_class'         => array( 'family' => 'learn',    'minimum' => 60,  'learner_create' => false ),
			'daily_rounds'       => array( 'family' => 'learn',    'minimum' => 60,  'learner_create' => false ),
			'arena_drill'        => array( 'family' => 'practice', 'minimum' => 30,  'learner_create' => true ),
			'arena_duel'         => array( 'family' => 'assess',   'minimum' => 30,  'learner_create' => false ),
			'tournamed_event'    => array( 'family' => 'assess',   'minimum' => 60,  'learner_create' => false ),
			'mock_interview'     => array( 'family' => 'apply',    'minimum' => 30,  'learner_create' => false ),
			'storyforge_writing' => array( 'family' => 'apply',    'minimum' => 30,  'learner_create' => true ),
			'personal_statement' => array( 'family' => 'apply',    'minimum' => 30,  'learner_create' => true ),
			'program_research'   => array( 'family' => 'apply',    'minimum' => 30,  'learner_create' => true ),
			'usce_shift'         => array( 'family' => 'clinical', 'minimum' => 120, 'learner_create' => false ),
			'mentor_meeting'     => array( 'family' => 'clinical', 'minimum' => 15,  'learner_create' => false ),
			'exercise'           => array( 'family' => 'life',     'minimum' => 15,  'learner_create' => true ),
			'break'              => array( 'family' => 'life',     'minimum' => 15,  'learner_create' => true ),
			'sleep'              => array( 'family' => 'life',     'minimum' => 240, 'learner_create' => true ),
			'custom'             => array( 'family' => 'life',     'minimum' => 15,  'learner_create' => true ),
		);
	}

	/** Stable fingerprint makes accidental catalog edits detectable. */
	public static function activity_catalog_fingerprint() {
		return hash( 'sha256', self::canonical_json( self::activity_catalog() ) );
	}

	/** @return array */
	public static function activity_families() {
		$result = array();
		foreach ( self::activity_catalog() as $type => $descriptor ) {
			$result[ $type ] = $descriptor['family'];
		}
		return $result;
	}

	/**
	 * Validate and canonically bind one exact learner command body.
	 * Actor and owner are server-derived and included in the request hash.
	 *
	 * @param mixed  $candidate Client-decoded JSON body.
	 * @param int    $owner_id Server-derived learner owner.
	 * @param int    $actor_id Server-derived WordPress actor.
	 * @param string $actor_kind Explicit server-owned role.
	 * @param array  $temporal_envelope Server-issued, versioned Week context.
	 * @return array
	 */
	public static function normalize_command( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		self::assert_exact_keys(
			$candidate,
			array( 'idempotency_key', 'expected_revision', 'command', 'payload' ),
			'command_body_shape'
		);
		if ( ! is_int( $owner_id ) || ! is_int( $actor_id ) || $owner_id <= 0 || $actor_id <= 0 || 'learner' !== $actor_kind || $owner_id !== $actor_id ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'actor_owner_invalid' );
		}

		$idempotency_key = $candidate['idempotency_key'];
		if (
			! is_string( $idempotency_key )
			|| strlen( $idempotency_key ) < 16
			|| strlen( $idempotency_key ) > 64
			|| 1 !== preg_match( '/^[A-Za-z0-9._:-]+$/D', $idempotency_key )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'idempotency_key_invalid' );
		}

		$expected_revision_string = self::decimal_revision( $candidate['expected_revision'] );
		$command = $candidate['command'];
		if ( ! is_string( $command ) || ! in_array( $command, self::commands(), true ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_unknown' );
		}
		$temporal_envelope = self::normalize_temporal_envelope( $temporal_envelope );
		$temporal_context  = $temporal_envelope['context'];

		$payload = self::normalize_payload( $command, $candidate['payload'], $temporal_context );
		$bound = array(
			'activity_catalog'  => array(
				'fingerprint' => self::activity_catalog_fingerprint(),
				'version'     => self::ACTIVITY_CATALOG_VERSION,
			),
			'actor_id'         => (string) $actor_id,
			'actor_kind'       => 'learner',
			'command'          => $command,
			'contract_version' => self::CONTRACT_VERSION,
			'expected_revision'=> $expected_revision_string,
			'idempotency_key'  => $idempotency_key,
			'owner_id'         => (string) $owner_id,
			'payload'          => $payload,
			'storage_codebook' => array(
				'fingerprint' => self::storage_codebook_fingerprint(),
				'version'     => self::STORAGE_CODEBOOK_VERSION,
			),
			'temporal'         => $temporal_envelope,
		);
		$request_json = self::canonical_json( $bound );

		return array(
			'activity_catalog_fingerprint' => self::activity_catalog_fingerprint(),
			'activity_catalog_version' => self::ACTIVITY_CATALOG_VERSION,
			'idempotency_key'         => $idempotency_key,
			'expected_revision'       => $expected_revision_string,
			'command'                 => $command,
			'payload'                 => $payload,
			'temporal'                => $temporal_envelope,
			'request_json'            => $request_json,
			'request_hash'            => hash( 'sha256', $request_json ),
			'storage_codebook_fingerprint' => self::storage_codebook_fingerprint(),
			'storage_codebook_version' => self::STORAGE_CODEBOOK_VERSION,
		);
	}

	/** @return array */
	private static function normalize_payload( $command, $candidate, $temporal_context ) {
		if ( self::COMMAND_CREATE === $command ) {
			self::assert_exact_keys(
				$candidate,
				array( 'title', 'activity_type', 'priority', 'local_date', 'local_time', 'duration_minutes', 'fold', 'temporal_context' ),
				'create_payload_shape'
			);
			self::assert_temporal_context( $candidate['temporal_context'], $temporal_context );
			$title = self::title( $candidate['title'] );
			$activity_type = self::activity_type( $candidate['activity_type'], null, true );
			$catalog = self::activity_catalog();
			$family = $catalog[ $activity_type ]['family'];
			$duration = self::duration_for_activity( $candidate['duration_minutes'], $activity_type );
			return array(
				'activity_type'    => $activity_type,
				'duration_minutes' => $duration,
				'family'           => $family,
				'fold'             => self::fold( $candidate['fold'] ),
				'local_date'       => self::date( $candidate['local_date'] ),
				'local_time'       => self::time( $candidate['local_time'] ),
				'priority'         => self::priority( $candidate['priority'] ),
				'temporal_context' => $temporal_context,
				'title'            => $title,
			);
		}

		if ( self::COMMAND_MOVE === $command ) {
			self::assert_exact_keys(
				$candidate,
				array( 'block_id', 'local_date', 'local_time', 'fold', 'temporal_context' ),
				'move_payload_shape'
			);
			self::assert_temporal_context( $candidate['temporal_context'], $temporal_context );
			return array(
				'block_id'         => self::uuid( $candidate['block_id'] ),
				'fold'             => self::fold( $candidate['fold'] ),
				'local_date'       => self::date( $candidate['local_date'] ),
				'local_time'       => self::time( $candidate['local_time'] ),
				'temporal_context' => $temporal_context,
			);
		}

		if ( self::COMMAND_RESIZE === $command ) {
			self::assert_exact_keys(
				$candidate,
				array( 'block_id', 'duration_minutes', 'temporal_context' ),
				'resize_payload_shape'
			);
			self::assert_temporal_context( $candidate['temporal_context'], $temporal_context );
			return array(
				'block_id'         => self::uuid( $candidate['block_id'] ),
				'duration_minutes' => self::duration( $candidate['duration_minutes'] ),
				'temporal_context' => $temporal_context,
			);
		}

		self::assert_exact_keys( $candidate, array( 'block_id', 'temporal_context' ), 'delete_payload_shape' );
		self::assert_temporal_context( $candidate['temporal_context'], $temporal_context );
		return array(
			'block_id'         => self::uuid( $candidate['block_id'] ),
			'temporal_context' => $temporal_context,
		);
	}

	/**
	 * Resolve one learner-local start into an unambiguous UTC interval.
	 * Week membership is civil Monday-to-Monday; the canvas is 06:00-to-24:00.
	 *
	 * @return array
	 */
	public static function resolve_slot( $week_start, $local_date, $local_time, $duration_minutes, $timezone, $fold ) {
		$week_start = self::monday( $week_start );
		$local_date = self::date( $local_date );
		$local_time = self::time( $local_time );
		$duration_minutes = self::duration( $duration_minutes );
		$timezone = self::timezone( $timezone );
		$fold = self::fold( $fold );

		$week_zone = new DateTimeZone( $timezone );
		$week_end = ( new DateTimeImmutable( $week_start . ' 00:00:00', new DateTimeZone( 'UTC' ) ) )->modify( '+7 days' )->format( 'Y-m-d' );
		if ( strcmp( $local_date, $week_start ) < 0 || strcmp( $local_date, $week_end ) >= 0 ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'outside_selected_week' );
		}

		$start_minute = self::minute_of_day( $local_time );
		if ( $start_minute < self::DISPLAY_START_MINUTE || $start_minute + $duration_minutes > self::DISPLAY_END_MINUTE ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'outside_display_window' );
		}

		try {
			$instant = self::resolve_local_instant( $local_date, $local_time, $timezone, $fold );
		} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
			if ( 'dst_gap' !== $error->reason_code() ) {
				throw $error;
			}
			throw new MMED_V1_Study_Week_Domain_Exception(
				'dst_gap',
				array(
					'suggested_slot' => self::next_valid_command_slot(
						$week_start,
						$local_date,
						$local_time,
						$duration_minutes,
						$week_zone
					),
				)
			);
		}
		$start_epoch = $instant['epoch'];
		$end_epoch = $start_epoch + ( $duration_minutes * 60 );
		$utc = new DateTimeZone( 'UTC' );
		$start = ( new DateTimeImmutable( '@' . $start_epoch ) )->setTimezone( $utc );
		$end = ( new DateTimeImmutable( '@' . $end_epoch ) )->setTimezone( $utc );
		$end_local = $end->setTimezone( $week_zone );

		return array(
			'start_at_utc'          => $start->format( 'Y-m-d H:i:s.u' ),
			'end_at_utc'            => $end->format( 'Y-m-d H:i:s.u' ),
			'local_date'            => $local_date,
			'local_time'            => $local_time,
			'end_local_date'        => $end_local->format( 'Y-m-d' ),
			'end_local_time'        => $end_local->format( 'H:i' ),
			'duration_minutes'      => $duration_minutes,
			'timezone'              => $timezone,
			'fold'                  => $instant['fold'],
			'temporal_policy_version'=> self::TEMPORAL_POLICY_VERSION,
		);
	}

	/** Resolve a slot from the same authenticated envelope bound into its command. */
	public static function resolve_slot_from_envelope( $local_date, $local_time, $duration_minutes, $fold, $temporal_envelope ) {
		$temporal_envelope = self::normalize_temporal_envelope( $temporal_envelope );
		$slot = self::resolve_slot(
			$temporal_envelope['week_start'],
			$local_date,
			$local_time,
			$duration_minutes,
			$temporal_envelope['timezone'],
			$fold
		);
		$slot['profile_version'] = $temporal_envelope['profile_version'];
		$slot['tzdb_version'] = $temporal_envelope['tzdb_version'];
		$slot['temporal_context'] = $temporal_envelope['context'];
		return $slot;
	}

	/**
	 * Resolve local wall-time identity independently of the Week canvas window.
	 * This keeps DST gap/fold policy testable even where a jurisdiction changes
	 * offset outside the learner-editable 06:00-to-24:00 board.
	 *
	 * @return array
	 */
	public static function resolve_local_instant( $local_date, $local_time, $timezone, $fold ) {
		$local_date = self::date( $local_date );
		$local_time = self::time( $local_time );
		$timezone = self::timezone( $timezone );
		$fold = self::fold( $fold );
		$zone = new DateTimeZone( $timezone );
		$local_key = $local_date . ' ' . $local_time;
		$candidates = self::utc_candidates( $local_key, $zone );
		if ( empty( $candidates ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception(
				'dst_gap',
				array( 'suggested_slot' => self::next_valid_local_slot( $local_date, $local_time, $zone ) )
			);
		}
		if ( count( $candidates ) > 1 && ! in_array( $fold, array( 'earlier', 'later' ), true ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'dst_fold_choice_required' );
		}
		if ( 1 === count( $candidates ) && null !== $fold ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'dst_fold_choice_unexpected' );
		}
		$epoch = 1 === count( $candidates )
			? $candidates[0]
			: ( 'earlier' === $fold ? $candidates[0] : $candidates[ count( $candidates ) - 1 ] );
		return array(
			'epoch' => $epoch,
			'utc'   => gmdate( 'Y-m-d H:i:s', $epoch ),
			'fold'  => count( $candidates ) > 1 ? $fold : 'normal',
		);
	}

	/** Build the complete server-owned civil-time context and its integrity tag. */
	public static function temporal_envelope( $week_start, $timezone, $profile_version, $tzdb_version ) {
		$payload = array(
			'profile_version'        => self::version_identifier( $profile_version, 'profile_version_invalid' ),
			'temporal_policy_version'=> self::TEMPORAL_POLICY_VERSION,
			'timezone'               => self::timezone( $timezone ),
			'tzdb_version'           => self::version_identifier( $tzdb_version, 'tzdb_version_invalid' ),
			'week_start'             => self::monday( $week_start ),
		);
		$payload['context'] = hash( 'sha256', self::canonical_json( $payload ) );
		return $payload;
	}

	/** Return true when half-open UTC intervals overlap; adjacency is valid. */
	public static function intervals_overlap( $start_a, $end_a, $start_b, $end_b ) {
		foreach ( array( $start_a, $end_a, $start_b, $end_b ) as $value ) {
			self::utc_datetime( $value );
		}
		if ( strcmp( $start_a, $end_a ) >= 0 || strcmp( $start_b, $end_b ) >= 0 ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'interval_invalid' );
		}
		return strcmp( $start_a, $end_b ) < 0 && strcmp( $end_a, $start_b ) > 0;
	}

	/**
	 * Convert exact repository SELECT DTOs into the only public Week projection.
	 * Private ownership, provenance, hashes, and storage codes are stripped only
	 * after every row has been proven to belong to the authorized Week.
	 */
	public static function week_model_from_repository_rows( $expected_owner_id, $week_row, $block_rows ) {
		if ( ! is_int( $expected_owner_id ) || $expected_owner_id <= 0 ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_owner_invalid' );
		}
		self::assert_exact_keys(
			$week_row,
			array( 'owner_id', 'plan_id', 'week_id', 'week_start_local', 'plan_revision', 'week_created_revision', 'week_updated_revision', 'timezone', 'profile_version', 'tzdb_version', 'temporal_policy_version', 'temporal_context_hash_hex' ),
			'week_storage_header_invalid'
		);
		if ( ! is_array( $block_rows ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_rows_invalid' );
		}

		$owner_id = (string) $expected_owner_id;
		if ( ! is_string( $week_row['owner_id'] ) || $owner_id !== $week_row['owner_id'] ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_ownership_invalid' );
		}
		$plan_id   = self::uuid( $week_row['plan_id'] );
		$week_id   = self::uuid( $week_row['week_id'] );
		$week_start = self::monday( $week_row['week_start_local'] );
		$plan_revision = self::decimal_revision( $week_row['plan_revision'] );
		$week_created_revision = self::decimal_revision( $week_row['week_created_revision'] );
		$week_updated_revision = self::decimal_revision( $week_row['week_updated_revision'] );
		if (
			'0' === $week_created_revision
			|| self::compare_decimal( $week_updated_revision, $week_created_revision ) < 0
			|| self::compare_decimal( $week_updated_revision, $plan_revision ) > 0
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_revision_invalid' );
		}
		$week_temporal = self::temporal_envelope( $week_start, $week_row['timezone'], $week_row['profile_version'], $week_row['tzdb_version'] );
		if (
			self::TEMPORAL_POLICY_VERSION !== $week_row['temporal_policy_version']
			|| ! self::is_hash_hex( $week_row['temporal_context_hash_hex'] )
			|| ! hash_equals( $week_temporal['context'], $week_row['temporal_context_hash_hex'] )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_provenance_invalid' );
		}

		$blocks = array();
		$seen_block_ids = array();
		$active_intervals = array();
		foreach ( $block_rows as $block_row ) {
			self::assert_exact_keys(
				$block_row,
				array(
					'owner_id', 'plan_id', 'week_id', 'week_start_local', 'block_id', 'title', 'activity_type',
					'activity_catalog_version', 'storage_codebook_version', 'family_code', 'state_code', 'priority_code',
					'goal_ref_hash_hex', 'goal_source_version', 'source_code', 'source_namespace_hash_hex', 'source_ref_hash_hex',
					'source_version_hash_hex', 'start_at_utc', 'end_at_utc', 'timezone', 'profile_version', 'tzdb_version',
					'local_date', 'local_minute', 'fold_code', 'temporal_policy_version', 'temporal_context_hash_hex',
					'duration_minutes', 'created_revision', 'updated_revision', 'tombstoned_revision',
				),
				'week_storage_block_invalid'
			);
			if (
				$owner_id !== $block_row['owner_id']
				|| $plan_id !== $block_row['plan_id']
				|| $week_id !== $block_row['week_id']
				|| $week_start !== $block_row['week_start_local']
			) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_ownership_invalid' );
			}
			$block_id = self::uuid( $block_row['block_id'] );
			if ( isset( $seen_block_ids[ $block_id ] ) ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_duplicate_block' );
			}
			$seen_block_ids[ $block_id ] = true;
			$projection_block = self::projection_block_from_storage_row( $block_row, $week_start, $plan_revision, $week_created_revision, $week_updated_revision );
			if ( self::STATE_TOMBSTONE !== $projection_block['state'] ) {
				$active_intervals[] = array( $block_row['start_at_utc'], $block_row['end_at_utc'], $block_id );
			}
			$blocks[] = $projection_block;
		}
		usort(
			$active_intervals,
			static function ( $left, $right ) {
				foreach ( array( 0, 1, 2 ) as $index ) {
					$comparison = strcmp( $left[ $index ], $right[ $index ] );
					if ( 0 !== $comparison ) {
						return $comparison;
					}
				}
				return 0;
			}
		);
		$active_end = null;
		foreach ( $active_intervals as $active_interval ) {
			if ( null !== $active_end && strcmp( $active_interval[0], $active_end ) < 0 ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_collision_invalid' );
			}
			if ( null === $active_end || strcmp( $active_interval[1], $active_end ) > 0 ) {
				$active_end = $active_interval[1];
			}
		}

		return self::build_week_model( $plan_id, $week_id, $week_start, $plan_revision, $blocks );
	}

	/** Build one immutable, hash-bound public Week projection envelope. */
	private static function build_week_model( $plan_id, $week_id, $week_start, $revision, $blocks ) {
		if ( ! is_array( $blocks ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_invalid' );
		}
		$week_start = self::monday( $week_start );
		$week_end = ( new DateTimeImmutable( $week_start . ' 00:00:00', new DateTimeZone( 'UTC' ) ) )->modify( '+7 days' )->format( 'Y-m-d' );
		$normalized = array();
		$seen_block_ids = array();
		foreach ( $blocks as $block ) {
			$normalized_block = self::projection_block( $block );
			if ( strcmp( $normalized_block['local_date'], $week_start ) < 0 || strcmp( $normalized_block['local_date'], $week_end ) >= 0 ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_membership_invalid' );
			}
			if ( isset( $seen_block_ids[ $normalized_block['block_id'] ] ) ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_duplicate_block' );
			}
			$seen_block_ids[ $normalized_block['block_id'] ] = true;
			$normalized[] = $normalized_block;
		}
		usort( $normalized, static function ( $left, $right ) {
			return strcmp( $left['block_id'], $right['block_id'] );
		} );
		$model = array(
			'blocks'     => $normalized,
			'plan_id'    => self::uuid( $plan_id ),
			'revision'   => self::decimal_revision( $revision ),
			'week_id'    => self::uuid( $week_id ),
			'week_start' => $week_start,
		);
		$projection_hash = hash( 'sha256', self::canonical_json( $model ) );
		return array(
			'blocks'          => $model['blocks'],
			'plan_id'         => $model['plan_id'],
			'projection_hash' => $projection_hash,
			'revision'        => $model['revision'],
			'week_id'         => $model['week_id'],
			'week_start'      => $model['week_start'],
		);
	}

	/** Derive the non-persistent 8010E Mission primary from one exact Week model. */
	public static function derive_mission( $week_model, $today ) {
		self::assert_exact_keys( $week_model, array( 'blocks', 'plan_id', 'projection_hash', 'revision', 'week_id', 'week_start' ), 'week_projection_invalid' );
		$rebuilt = self::build_week_model(
			$week_model['plan_id'],
			$week_model['week_id'],
			$week_model['week_start'],
			$week_model['revision'],
			$week_model['blocks']
		);
		if ( ! is_string( $week_model['projection_hash'] ) || 1 !== preg_match( '/^[a-f0-9]{64}$/D', $week_model['projection_hash'] ) || ! hash_equals( $rebuilt['projection_hash'], $week_model['projection_hash'] ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_hash_mismatch' );
		}
		$today = self::date( $today );
		$revision = $rebuilt['revision'];
		$candidates = array();
		foreach ( $rebuilt['blocks'] as $block ) {
			if (
				$today !== $block['local_date']
				|| self::STATE_TOMBSTONE === $block['state']
			) {
				continue;
			}
			$state = $block['state'];
			$priority = $block['priority'];
			$family = $block['family'];
			if ( 'critical' === $priority ) {
				$tier = 0;
				$why = 'Critical work for today';
			} elseif ( 'assess' === $family ) {
				$tier = 1;
				$why = 'Assessment-class work for today';
			} elseif ( true === $block['goal_linked'] ) {
				$tier = 2;
				$why = 'Largest goal-linked block';
			} elseif ( self::STATE_FLEXIBLE === $state ) {
				$tier = 3;
				$why = 'Largest movable block';
			} else {
				continue;
			}
			$block['_mission_tier'] = $tier;
			$block['_mission_why'] = $why;
			$candidates[] = $block;
		}

		if ( empty( $candidates ) ) {
			return array(
				'primary'  => null,
				'revision' => $revision,
				'state'    => 'protect_the_day',
				'title'    => 'Protect the day',
				'why'      => 'Nothing is planned yet. Make one clear promise to yourself.',
			);
		}

		usort(
			$candidates,
			function ( $left, $right ) {
				$tier = (int) $left['_mission_tier'] <=> (int) $right['_mission_tier'];
				if ( 0 !== $tier ) {
					return $tier;
				}
				if ( in_array( (int) $left['_mission_tier'], array( 2, 3 ), true ) ) {
					$duration = (int) ( isset( $right['duration_minutes'] ) ? $right['duration_minutes'] : 0 )
						<=> (int) ( isset( $left['duration_minutes'] ) ? $left['duration_minutes'] : 0 );
					if ( 0 !== $duration ) {
						return $duration;
					}
				}
				$time = strcmp(
					isset( $left['local_time'] ) ? $left['local_time'] : '',
					isset( $right['local_time'] ) ? $right['local_time'] : ''
				);
				if ( 0 !== $time ) {
					return $time;
				}
				return strcmp(
					isset( $left['block_id'] ) ? $left['block_id'] : '',
					isset( $right['block_id'] ) ? $right['block_id'] : ''
				);
			}
		);

		$primary = $candidates[0];
		$why = $primary['_mission_why'];
		unset( $primary['_mission_tier'], $primary['_mission_why'] );
		return array(
			'primary'  => $primary,
			'revision' => $revision,
			'state'    => 'planned',
			'title'    => isset( $primary['title'] ) ? $primary['title'] : '',
			'why'      => $why,
		);
	}

	/** Validate mutable state and reject no-op target commands before persistence. */
	public static function assert_mutation_target( $command, $block, $payload ) {
		if ( ! in_array( $command, array( self::COMMAND_MOVE, self::COMMAND_RESIZE, self::COMMAND_DELETE ), true ) || ! is_array( $payload ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_unknown' );
		}
		$block = self::projection_block( $block );
		if ( ! isset( $payload['block_id'] ) || $block['block_id'] !== $payload['block_id'] ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'block_not_found' );
		}
		if ( self::STATE_TOMBSTONE === $block['state'] ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'block_not_found' );
		}
		if ( self::STATE_FIXED === $block['state'] ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'fixed_anchor_immutable' );
		}
		if ( self::COMMAND_MOVE === $command ) {
			$target_fold = null === ( isset( $payload['fold'] ) ? $payload['fold'] : null ) ? 'normal' : $payload['fold'];
			$target_time = isset( $payload['local_time'] ) ? self::time( $payload['local_time'] ) : '';
			if ( self::minute_of_day( $target_time ) < self::DISPLAY_START_MINUTE || self::minute_of_day( $target_time ) + $block['duration_minutes'] > self::DISPLAY_END_MINUTE ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'outside_display_window' );
			}
			if ( $block['local_date'] === ( $payload['local_date'] ?? null ) && $block['local_time'] === ( $payload['local_time'] ?? null ) && $block['fold'] === $target_fold ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'no_state_change' );
			}
		}
		if ( self::COMMAND_RESIZE === $command ) {
			self::duration_for_activity( $payload['duration_minutes'] ?? null, $block['activity_type'] );
			if ( self::minute_of_day( $block['local_time'] ) + $payload['duration_minutes'] > self::DISPLAY_END_MINUTE ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'outside_display_window' );
			}
			if ( $block['duration_minutes'] === $payload['duration_minutes'] ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'no_state_change' );
			}
		}
		return true;
	}

	/** Deterministic JSON used by requests, receipts, and read-model hashing. */
	public static function canonical_json( $value ) {
		$normalized = self::canonicalize( $value );
		$json = json_encode( $normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION );
		if ( ! is_string( $json ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'canonical_json_failed' );
		}
		return $json;
	}

	/** @return mixed */
	private static function canonicalize( $value ) {
		if ( $value instanceof MMED_V1_Study_Canonical_Object ) {
			$members = $value->values;
			ksort( $members, SORT_STRING );
			$object = new stdClass();
			foreach ( $members as $key => $child ) {
				if ( ! is_string( $key ) ) {
					throw new MMED_V1_Study_Week_Domain_Exception( 'canonical_object_key_invalid' );
				}
				$object->{$key} = self::canonicalize( $child );
			}
			return $object;
		}
		if ( is_array( $value ) ) {
			$is_list = empty( $value ) || array_keys( $value ) === range( 0, count( $value ) - 1 );
			if ( ! $is_list ) {
				ksort( $value, SORT_STRING );
			}
			foreach ( $value as $key => $child ) {
				$value[ $key ] = self::canonicalize( $child );
			}
			return $value;
		}
		if ( is_float( $value ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'canonical_number_invalid' );
		}
		if ( is_object( $value ) || is_resource( $value ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'canonical_value_invalid' );
		}
		return $value;
	}

	/** @return string */
	public static function uuid( $candidate ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'uuid_invalid' );
		}
		return $candidate;
	}

	/** @return string */
	public static function uuid_to_binary( $uuid ) {
		$hex = str_replace( '-', '', self::uuid( $uuid ) );
		$binary = hex2bin( $hex );
		if ( false === $binary || 16 !== strlen( $binary ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'uuid_invalid' );
		}
		return $binary;
	}

	/** @return string */
	public static function binary_to_uuid( $binary ) {
		if ( ! is_string( $binary ) || 16 !== strlen( $binary ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'uuid_invalid' );
		}
		$hex = bin2hex( $binary );
		return self::uuid(
			substr( $hex, 0, 8 ) . '-' . substr( $hex, 8, 4 ) . '-' . substr( $hex, 12, 4 ) . '-'
			. substr( $hex, 16, 4 ) . '-' . substr( $hex, 20, 12 )
		);
	}

	/** @return string */
	public static function decimal_revision( $candidate ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '/^(?:0|[1-9][0-9]*)$/D', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'revision_invalid' );
		}
		if ( strlen( $candidate ) > strlen( self::MAX_UNSIGNED_BIGINT ) || ( strlen( $candidate ) === strlen( self::MAX_UNSIGNED_BIGINT ) && strcmp( $candidate, self::MAX_UNSIGNED_BIGINT ) > 0 ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'revision_invalid' );
		}
		return $candidate;
	}

	/** Exact unsigned decimal increment without signed-PHP coercion. */
	public static function increment_revision( $candidate ) {
		$candidate = self::decimal_revision( $candidate );
		if ( self::MAX_UNSIGNED_BIGINT === $candidate ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'revision_exhausted' );
		}
		$digits = str_split( $candidate );
		$carry = 1;
		for ( $index = count( $digits ) - 1; $index >= 0 && 1 === $carry; --$index ) {
			$value = (int) $digits[ $index ] + $carry;
			$digits[ $index ] = (string) ( $value % 10 );
			$carry = $value >= 10 ? 1 : 0;
		}
		if ( 1 === $carry ) {
			array_unshift( $digits, '1' );
		}
		return self::decimal_revision( implode( '', $digits ) );
	}

	/** @return int */
	private static function duration( $candidate ) {
		if (
			! is_int( $candidate )
			|| $candidate < self::MIN_DURATION_MINUTES
			|| $candidate > self::MAX_DURATION_MINUTES
			|| 0 !== $candidate % self::STEP_MINUTES
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'duration_invalid' );
		}
		return $candidate;
	}

	/** Validate the grid-normalized D9 minimum for one activity type. */
	public static function duration_for_activity( $candidate, $activity_type ) {
		$candidate = self::duration( $candidate );
		$activity_type = self::activity_type( $activity_type, null, false );
		$minimum = (int) self::activity_catalog()[ $activity_type ]['minimum'];
		if ( $candidate < $minimum ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'activity_duration_too_short' );
		}
		return $candidate;
	}

	/** @return string */
	private static function title( $candidate ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '//u', $candidate ) || 1 === preg_match( '/[\x00-\x1F\x7F]/u', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'title_invalid' );
		}
		$candidate = trim( preg_replace( '/\s+/u', ' ', $candidate ) );
		$character_count = preg_match_all( '/./us', $candidate, $characters );
		unset( $characters );
		if ( '' === $candidate || false === $character_count || $character_count > self::MAX_TITLE_CHARACTERS || strlen( $candidate ) > 480 ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'title_invalid' );
		}
		return $candidate;
	}

	/** @return string */
	private static function family( $candidate ) {
		if ( ! is_string( $candidate ) || ! in_array( $candidate, self::families(), true ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'family_invalid' );
		}
		return $candidate;
	}

	/** @return string */
	private static function activity_type( $candidate, $family = null, $learner_create = false ) {
		$catalog = self::activity_catalog();
		if ( ! is_string( $candidate ) || ! isset( $catalog[ $candidate ] ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'activity_type_invalid' );
		}
		if ( null !== $family && $family !== $catalog[ $candidate ]['family'] ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'activity_type_invalid' );
		}
		if ( $learner_create && true !== $catalog[ $candidate ]['learner_create'] ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'activity_source_owned' );
		}
		return $candidate;
	}

	/** @return string */
	private static function priority( $candidate ) {
		if ( ! is_string( $candidate ) || ! in_array( $candidate, array( 'normal', 'critical' ), true ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'priority_invalid' );
		}
		return $candidate;
	}

	/** @return string|null */
	private static function fold( $candidate ) {
		if ( null === $candidate ) {
			return null;
		}
		if ( ! is_string( $candidate ) || ! in_array( $candidate, array( 'earlier', 'later' ), true ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'fold_invalid' );
		}
		return $candidate;
	}

	/** @return string */
	private static function date( $candidate ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '/^\d{4}-\d{2}-\d{2}$/D', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'local_date_invalid' );
		}
		$parsed = DateTimeImmutable::createFromFormat( '!Y-m-d', $candidate, new DateTimeZone( 'UTC' ) );
		$errors = DateTimeImmutable::getLastErrors();
		if (
			! $parsed instanceof DateTimeImmutable
			|| ( is_array( $errors ) && ( $errors['warning_count'] > 0 || $errors['error_count'] > 0 ) )
			|| $parsed->format( 'Y-m-d' ) !== $candidate
			|| strcmp( $candidate, self::MIN_SUPPORTED_DATE ) < 0
			|| strcmp( $candidate, self::MAX_SUPPORTED_DATE ) > 0
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'local_date_invalid' );
		}
		return $candidate;
	}

	/** @return string */
	private static function monday( $candidate ) {
		$candidate = self::date( $candidate );
		$date = new DateTimeImmutable( $candidate . ' 00:00:00', new DateTimeZone( 'UTC' ) );
		if ( 1 !== (int) $date->format( 'N' ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_start_not_monday' );
		}
		return $candidate;
	}

	/** @return string */
	private static function time( $candidate ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/D', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'local_time_invalid' );
		}
		return $candidate;
	}

	/** @return int */
	private static function minute_of_day( $time ) {
		$parts = explode( ':', $time );
		return ( (int) $parts[0] * 60 ) + (int) $parts[1];
	}

	/** @return string */
	private static function timezone( $candidate ) {
		$fixed_offset = is_string( $candidate ) && 1 === preg_match( '/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/D', $candidate );
		if (
			! is_string( $candidate )
			|| strlen( $candidate ) < 1
			|| strlen( $candidate ) > 64
			|| ( ! $fixed_offset && ! in_array( $candidate, DateTimeZone::listIdentifiers(), true ) )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'timezone_invalid' );
		}
		try {
			new DateTimeZone( $candidate );
		} catch ( Throwable $error ) {
			unset( $error );
			throw new MMED_V1_Study_Week_Domain_Exception( 'timezone_invalid' );
		}
		return $candidate;
	}

	/** Public canonical timezone validator shared by runtime profile authority. */
	public static function normalize_timezone( $candidate ) {
		return self::timezone( $candidate );
	}

	/** @return array */
	private static function utc_candidates( $local_key, $zone ) {
		$naive = DateTimeImmutable::createFromFormat( '!Y-m-d H:i', $local_key, new DateTimeZone( 'UTC' ) );
		if ( ! $naive instanceof DateTimeImmutable || $naive->format( 'Y-m-d H:i' ) !== $local_key ) {
			return array();
		}
		$naive_epoch = $naive->getTimestamp();
		$transitions = $zone->getTransitions( $naive_epoch - 172800, $naive_epoch + 172800 );
		$offsets = array();
		foreach ( is_array( $transitions ) ? $transitions : array() as $transition ) {
			if ( isset( $transition['offset'] ) ) {
				$offsets[ (int) $transition['offset'] ] = true;
			}
		}
		// Fixed-offset DateTimeZone instances expose no transition table.
		if ( empty( $offsets ) ) {
			$offsets[ (int) $zone->getOffset( $naive ) ] = true;
		}
		$candidates = array();
		foreach ( array_keys( $offsets ) as $offset ) {
			$epoch = $naive_epoch - (int) $offset;
			$round_trip = ( new DateTimeImmutable( '@' . $epoch ) )->setTimezone( $zone )->format( 'Y-m-d H:i' );
			if ( $local_key === $round_trip ) {
				$candidates[] = $epoch;
			}
		}
		sort( $candidates, SORT_NUMERIC );
		return array_values( array_unique( $candidates ) );
	}

	/** @return array */
	private static function next_valid_local_slot( $local_date, $local_time, $zone ) {
		$cursor = DateTimeImmutable::createFromFormat( '!Y-m-d H:i', $local_date . ' ' . $local_time, new DateTimeZone( 'UTC' ) );
		if ( ! $cursor instanceof DateTimeImmutable ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'local_date_invalid' );
		}
		for ( $step = 1; $step <= ( 8 * 24 * 60 / self::STEP_MINUTES ); ++$step ) {
			$cursor = $cursor->modify( '+' . self::STEP_MINUTES . ' minutes' );
			$date = $cursor->format( 'Y-m-d' );
			if ( strcmp( $date, self::MAX_SUPPORTED_DATE ) > 0 ) {
				break;
			}
			$time = $cursor->format( 'H:i' );
			$candidates = self::utc_candidates( $date . ' ' . $time, $zone );
			if ( ! empty( $candidates ) ) {
				return array(
					'fold_required' => count( $candidates ) > 1,
					'local_date'    => $date,
					'local_time'    => $time,
				);
			}
		}
		throw new MMED_V1_Study_Week_Domain_Exception( 'dst_gap_without_safe_suggestion' );
	}

	/** Return the next gap-free slot that also satisfies the selected Week canvas. */
	private static function next_valid_command_slot( $week_start, $local_date, $local_time, $duration_minutes, $zone ) {
		$week_end = ( new DateTimeImmutable( $week_start . ' 00:00:00', new DateTimeZone( 'UTC' ) ) )->modify( '+7 days' )->format( 'Y-m-d' );
		$cursor = DateTimeImmutable::createFromFormat( '!Y-m-d H:i', $local_date . ' ' . $local_time, new DateTimeZone( 'UTC' ) );
		if ( ! $cursor instanceof DateTimeImmutable ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'dst_gap_without_safe_suggestion' );
		}
		for ( $step = 1; $step <= ( 7 * 24 * 60 / self::STEP_MINUTES ); ++$step ) {
			$cursor = $cursor->modify( '+' . self::STEP_MINUTES . ' minutes' );
			$date = $cursor->format( 'Y-m-d' );
			if ( strcmp( $date, $week_end ) >= 0 ) {
				break;
			}
			$time = $cursor->format( 'H:i' );
			$minute = self::minute_of_day( $time );
			if ( $minute < self::DISPLAY_START_MINUTE || $minute + $duration_minutes > self::DISPLAY_END_MINUTE ) {
				continue;
			}
			$candidates = self::utc_candidates( $date . ' ' . $time, $zone );
			if ( ! empty( $candidates ) ) {
				return array(
					'fold_required' => count( $candidates ) > 1,
					'local_date'    => $date,
					'local_time'    => $time,
				);
			}
		}
		throw new MMED_V1_Study_Week_Domain_Exception( 'dst_gap_without_safe_suggestion' );
	}

	/** @return array */
	private static function normalize_temporal_envelope( $candidate ) {
		self::assert_exact_keys(
			$candidate,
			array( 'context', 'profile_version', 'temporal_policy_version', 'timezone', 'tzdb_version', 'week_start' ),
			'temporal_context_unavailable'
		);
		$rebuilt = self::temporal_envelope(
			$candidate['week_start'],
			$candidate['timezone'],
			$candidate['profile_version'],
			$candidate['tzdb_version']
		);
		if (
			self::TEMPORAL_POLICY_VERSION !== $candidate['temporal_policy_version']
			|| ! is_string( $candidate['context'] )
			|| 1 !== preg_match( '/^[a-f0-9]{64}$/D', $candidate['context'] )
			|| ! hash_equals( $rebuilt['context'], $candidate['context'] )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'temporal_context_unavailable' );
		}
		return $rebuilt;
	}

	/** @return string */
	private static function version_identifier( $candidate, $reason ) {
		if ( ! is_string( $candidate ) || strlen( $candidate ) < 1 || strlen( $candidate ) > 64 || 1 !== preg_match( '/^[A-Za-z0-9._:-]+$/D', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( $reason );
		}
		return $candidate;
	}

	/** @return string */
	private static function utc_datetime( $candidate ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/D', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'interval_invalid' );
		}
		$parsed = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s.u', $candidate, new DateTimeZone( 'UTC' ) );
		$errors = DateTimeImmutable::getLastErrors();
		if ( ! $parsed instanceof DateTimeImmutable || ( is_array( $errors ) && ( $errors['warning_count'] > 0 || $errors['error_count'] > 0 ) ) || $parsed->format( 'Y-m-d H:i:s.u' ) !== $candidate ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'interval_invalid' );
		}
		return $candidate;
	}

	/** Convert one exact decoded storage row into the 11-key public block DTO. */
	private static function projection_block_from_storage_row( $row, $week_start, $plan_revision, $week_created_revision, $week_updated_revision ) {
		$local_date = self::date( $row['local_date'] );
		$week_end = ( new DateTimeImmutable( $week_start . ' 00:00:00', new DateTimeZone( 'UTC' ) ) )->modify( '+7 days' )->format( 'Y-m-d' );
		if ( strcmp( $local_date, $week_start ) < 0 || strcmp( $local_date, $week_end ) >= 0 ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_membership_invalid' );
		}
		if (
			self::ACTIVITY_CATALOG_VERSION !== $row['activity_catalog_version']
			|| self::STORAGE_CODEBOOK_VERSION !== $row['storage_codebook_version']
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_provenance_invalid' );
		}

		$family = self::enum_value( 'family', self::small_decimal_integer( $row['family_code'], 1, 6, 'week_storage_code_invalid' ) );
		$state = self::enum_value( 'state', self::small_decimal_integer( $row['state_code'], 1, 3, 'week_storage_code_invalid' ) );
		$priority = self::enum_value( 'priority', self::small_decimal_integer( $row['priority_code'], 0, 1, 'week_storage_code_invalid' ) );
		$fold = self::enum_value( 'fold', self::small_decimal_integer( $row['fold_code'], 0, 2, 'week_storage_code_invalid' ) );
		$source = self::enum_value( 'source', self::small_decimal_integer( $row['source_code'], 1, 2, 'week_storage_code_invalid' ) );
		$activity_type = self::activity_type( $row['activity_type'], $family, false );

		$goal_hash = self::nullable_hash_hex( $row['goal_ref_hash_hex'], 'week_storage_goal_invalid' );
		$goal_version = $row['goal_source_version'];
		if ( null !== $goal_version ) {
			$goal_version = self::version_identifier( $goal_version, 'week_storage_goal_invalid' );
		}
		if ( ( null === $goal_hash ) !== ( null === $goal_version ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_goal_invalid' );
		}

		$source_namespace = self::nullable_hash_hex( $row['source_namespace_hash_hex'], 'week_storage_source_invalid' );
		$source_ref = self::nullable_hash_hex( $row['source_ref_hash_hex'], 'week_storage_source_invalid' );
		$source_version = self::nullable_hash_hex( $row['source_version_hash_hex'], 'week_storage_source_invalid' );
		if (
			( 'manual' === $source && ( self::STATE_FIXED === $state || null !== $source_namespace || null !== $source_ref || null !== $source_version ) )
			|| ( 'external' === $source && ( self::STATE_FLEXIBLE === $state || null === $source_namespace || null === $source_ref || null === $source_version ) )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_source_invalid' );
		}
		if ( 'manual' === $source && true !== self::activity_catalog()[ $activity_type ]['learner_create'] ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_source_invalid' );
		}

		$created_revision = self::decimal_revision( $row['created_revision'] );
		$updated_revision = self::decimal_revision( $row['updated_revision'] );
		$tombstoned_revision = $row['tombstoned_revision'];
		if ( null !== $tombstoned_revision ) {
			$tombstoned_revision = self::decimal_revision( $tombstoned_revision );
		}
		if (
			'0' === $created_revision
			|| self::compare_decimal( $updated_revision, $created_revision ) < 0
			|| self::compare_decimal( $created_revision, $week_created_revision ) < 0
			|| self::compare_decimal( $updated_revision, $week_updated_revision ) > 0
			|| self::compare_decimal( $updated_revision, $plan_revision ) > 0
			|| ( self::STATE_TOMBSTONE === $state && $updated_revision !== $tombstoned_revision )
			|| ( self::STATE_TOMBSTONE !== $state && null !== $tombstoned_revision )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_revision_invalid' );
		}

		$timezone = self::timezone( $row['timezone'] );
		$profile_version = self::version_identifier( $row['profile_version'], 'week_storage_provenance_invalid' );
		$tzdb_version = self::version_identifier( $row['tzdb_version'], 'week_storage_provenance_invalid' );
		$temporal = self::temporal_envelope( $week_start, $timezone, $profile_version, $tzdb_version );
		if (
			self::TEMPORAL_POLICY_VERSION !== $row['temporal_policy_version']
			|| ! self::is_hash_hex( $row['temporal_context_hash_hex'] )
			|| ! hash_equals( $temporal['context'], $row['temporal_context_hash_hex'] )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_provenance_invalid' );
		}

		$local_minute = self::small_decimal_integer( $row['local_minute'], 0, 1439, 'week_storage_temporal_invalid' );
		if ( 0 !== $local_minute % self::STEP_MINUTES ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_temporal_invalid' );
		}
		$duration = self::small_decimal_integer( $row['duration_minutes'], self::MIN_DURATION_MINUTES, self::MAX_DURATION_MINUTES, 'week_storage_temporal_invalid' );
		$local_time = sprintf( '%02d:%02d', intdiv( $local_minute, 60 ), $local_minute % 60 );
		$slot = self::resolve_slot_from_envelope( $local_date, $local_time, $duration, 'normal' === $fold ? null : $fold, $temporal );
		$start_at_utc = self::utc_datetime( $row['start_at_utc'] );
		$end_at_utc = self::utc_datetime( $row['end_at_utc'] );
		if ( $slot['start_at_utc'] !== $start_at_utc || $slot['end_at_utc'] !== $end_at_utc ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_temporal_invalid' );
		}

		return self::projection_block(
			array(
				'activity_type'    => $activity_type,
				'block_id'         => $row['block_id'],
				'duration_minutes' => $duration,
				'family'           => $family,
				'fold'             => $fold,
				'goal_linked'      => null !== $goal_hash,
				'local_date'       => $local_date,
				'local_time'       => $local_time,
				'priority'         => $priority,
				'state'            => $state,
				'title'            => $row['title'],
			)
		);
	}

	/** @return bool */
	private static function is_hash_hex( $candidate ) {
		return is_string( $candidate ) && 1 === preg_match( '/^[a-f0-9]{64}$/D', $candidate );
	}

	/** @return string|null */
	private static function nullable_hash_hex( $candidate, $reason ) {
		if ( null === $candidate ) {
			return null;
		}
		if ( ! self::is_hash_hex( $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( $reason );
		}
		return $candidate;
	}

	/** Decode a bounded canonical decimal emitted by an exact repository SELECT. */
	private static function small_decimal_integer( $candidate, $minimum, $maximum, $reason ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '/^(?:0|[1-9][0-9]*)$/D', $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( $reason );
		}
		$value = (int) $candidate;
		if ( (string) $value !== $candidate || $value < $minimum || $value > $maximum ) {
			throw new MMED_V1_Study_Week_Domain_Exception( $reason );
		}
		return $value;
	}

	/** Compare canonical unsigned decimal strings without signed-integer coercion. */
	private static function compare_decimal( $left, $right ) {
		$left = self::decimal_revision( $left );
		$right = self::decimal_revision( $right );
		if ( strlen( $left ) !== strlen( $right ) ) {
			return strlen( $left ) < strlen( $right ) ? -1 : 1;
		}
		return strcmp( $left, $right );
	}

	/** Normalize exactly the learner-safe fields available to Week and Mission. */
	private static function projection_block( $candidate ) {
		self::assert_exact_keys(
			$candidate,
			array( 'activity_type', 'block_id', 'duration_minutes', 'family', 'fold', 'goal_linked', 'local_date', 'local_time', 'priority', 'state', 'title' ),
			'week_projection_block_invalid'
		);
		$state = $candidate['state'];
		if ( ! is_string( $state ) || ! in_array( $state, array( self::STATE_FLEXIBLE, self::STATE_FIXED, self::STATE_TOMBSTONE ), true ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_block_invalid' );
		}
		$family = self::family( $candidate['family'] );
		$activity_type = self::activity_type( $candidate['activity_type'], $family, false );
		if ( ! is_bool( $candidate['goal_linked'] ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_block_invalid' );
		}
		$fold = $candidate['fold'];
		if ( 'normal' !== $fold && ! in_array( $fold, array( 'earlier', 'later' ), true ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_block_invalid' );
		}
		$duration = self::duration_for_activity( $candidate['duration_minutes'], $activity_type );
		$local_time = self::time( $candidate['local_time'] );
		$local_minute = self::minute_of_day( $local_time );
		if ( $local_minute < self::DISPLAY_START_MINUTE || $local_minute + $duration > self::DISPLAY_END_MINUTE ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'outside_display_window' );
		}
		return array(
			'activity_type'    => $activity_type,
			'block_id'         => self::uuid( $candidate['block_id'] ),
			'duration_minutes' => $duration,
			'family'           => $family,
			'fold'             => $fold,
			'goal_linked'      => $candidate['goal_linked'],
			'local_date'       => self::date( $candidate['local_date'] ),
			'local_time'       => $local_time,
			'priority'         => self::priority( $candidate['priority'] ),
			'state'            => $state,
			'title'            => self::title( $candidate['title'] ),
		);
	}

	/** @return void */
	private static function assert_temporal_context( $candidate, $expected ) {
		if ( ! is_string( $candidate ) || 1 !== preg_match( '/^[a-f0-9]{64}$/D', $candidate ) || ! hash_equals( $expected, $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'temporal_context_stale' );
		}
	}

	/** @return void */
	private static function assert_exact_keys( $candidate, $expected, $reason ) {
		if ( ! is_array( $candidate ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( $reason );
		}
		$actual = array_keys( $candidate );
		sort( $actual, SORT_STRING );
		sort( $expected, SORT_STRING );
		if ( $actual !== $expected ) {
			throw new MMED_V1_Study_Week_Domain_Exception( $reason );
		}
	}
}

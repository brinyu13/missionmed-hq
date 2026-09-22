<?php
/**
 * M3 durable batch coordinator.
 *
 * Jobs are progressed by short authenticated REST requests from the browser,
 * not by WP-Cron. One request claims one item, so browser reloads are safe and
 * no PHP worker is held across a queue. Every provider call has a durable
 * idempotency key and every row remains owner scoped.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Batch {

	const MAX_ITEMS       = 150;
	const MAX_ATTEMPTS    = 3;
	const LOCK_SECONDS    = 210;
	const CLIENT_WORKERS  = 2;

	protected static function decode( $json ) {
		$value = json_decode( (string) $json, true );
		return is_array( $value ) ? $value : array();
	}

	protected static function jobs_table() {
		return MMPS_Install::table( 'jobs' );
	}

	protected static function items_table() {
		return MMPS_Install::table( 'job_items' );
	}

	/** RISE's current owner-scoped list exposes Gold plus ordered priority, not a separate Silver flag. */
	public static function bulk_classification( $entry ) {
		$position = isset( $entry['priorityPosition'] ) && null !== $entry['priorityPosition'] ? (int) $entry['priorityPosition'] : null;
		if ( ! empty( $entry['goldStarred'] ) ) {
			return array( 'eligible' => false, 'class' => 'GOLD', 'reason' => 'HIGH_PRIORITY_REVIEW' );
		}
		if ( null === $position || $position < 1 ) {
			return array( 'eligible' => false, 'class' => 'AMBIGUOUS', 'reason' => 'PRIORITY_UNCERTAIN' );
		}
		if ( $position <= MMPS_Tiers::PRIORITY_DEEP_CUTOFF ) {
			return array( 'eligible' => false, 'class' => 'SILVER', 'reason' => 'HIGH_PRIORITY_REVIEW' );
		}
		return array( 'eligible' => true, 'class' => 'BULK_ELIGIBLE', 'reason' => '' );
	}

	public static function create( $user_id, $root, $programs, $output_mode = 'FULL_PARAGRAPH' ) {
		global $wpdb;
		MMPS_Install::maybe_install();
		if ( empty( $root['region']['mode'] ) || empty( $root['prefs']['categories'] ) ) {
			return new WP_Error( 'mmps_batch_root_incomplete', 'Confirm the editable region and save preferences before creating a batch.', array( 'status' => 409 ) );
		}
		$output_mode = 'TOP_3_REASONS' === strtoupper( (string) $output_mode ) ? 'TOP_3_REASONS' : 'FULL_PARAGRAPH';
		$requested = array();
		foreach ( (array) $programs as $program ) {
			$id = sanitize_text_field( (string) ( $program['programSpecialtyId'] ?? '' ) );
			if ( '' !== $id && strlen( $id ) <= 190 ) { $requested[ $id ] = $program; }
		}
		$rise_list = MMPS_Evidence_Bundle::my_list();
		if ( is_wp_error( $rise_list ) ) { return $rise_list; }
		$clean = array();
		$excluded = array( 'GOLD' => 0, 'SILVER' => 0, 'AMBIGUOUS' => 0 );
		foreach ( (array) $rise_list as $authoritative ) {
			$id = (string) ( $authoritative['programSpecialtyId'] ?? '' );
			if ( ! isset( $requested[ $id ] ) ) { continue; }
			$class = self::bulk_classification( $authoritative );
			if ( ! $class['eligible'] ) {
				$excluded[ $class['class'] ]++;
				continue;
			}
			if ( count( $clean ) >= self::MAX_ITEMS ) { break; }
			$program = $requested[ $id ];
			$entry = array(
				'programSpecialtyId' => $id,
				'goldStarred'        => false,
				'priorityPosition'   => (int) $authoritative['priorityPosition'],
			);
			$default = MMPS_Tiers::default_tier( $entry );
			$tier    = 'DEEP' === strtoupper( (string) ( $program['tier'] ?? $default ) ) ? 'DEEP' : 'ESSENTIAL';
			$entry['tier'] = $tier;
			$clean[ $id ]   = $entry;
		}
		if ( ! $clean ) {
			$high_priority = $excluded['GOLD'] + $excluded['SILVER'];
			$message = $high_priority
				? 'Your imported Gold and Silver programs stay in High-Priority Review, so none are eligible for unattended Bulk Rush. Personalize them one at a time in the Program workspace.'
				: 'None of the imported RISE programs is eligible for unattended Bulk Rush. Confirm each program\'s priority in RISE or personalize it in the Program workspace.';
			return new WP_Error( 'mmps_batch_empty', $message, array( 'status' => 422, 'excluded' => $excluded ) );
		}
		// Fail closed before a job exists: every item must resolve through the
		// canonical RISE bundle and belong to this exact ROOT specialty.
		foreach ( $clean as $id => &$program ) {
			$bundle = MMPS_Evidence_Bundle::for_program( $id );
			if ( is_wp_error( $bundle ) ) {
				return new WP_Error( 'mmps_batch_identity_unavailable', 'Every Bulk Rush program must have a current verified RISE identity. No batch was created.', array( 'status' => 409, 'programSpecialtyId' => $id ) );
			}
			if ( ! MMPS_Evidence_Bundle::specialty_matches( $root['specialtyLabel'], $bundle['program']['designation'] ?? '' ) ) {
				return new WP_Error( 'mmps_batch_specialty_mismatch', 'Every Bulk Rush program must belong to the ROOT specialty according to canonical RISE identity. No batch was created.', array( 'status' => 409, 'programSpecialtyId' => $id ) );
			}
			$program['identity'] = array( 'designation' => (string) $bundle['program']['designation'], 'bundleSha256' => (string) $bundle['bundleSha256'] );
		}
		unset( $program );
		$batch_program_ids = array_keys( $clean );
		$job_uuid = MMPS_Store::uuid();
		$now      = MMPS_Store::now();
		$wpdb->query( 'START TRANSACTION' );
		$ok       = $wpdb->insert(
			self::jobs_table(),
			array(
				'job_uuid'        => $job_uuid,
				'user_id'         => absint( $user_id ),
				'root_id'         => absint( $root['id'] ),
				'specialty_label' => $root['specialtyLabel'],
				'status'          => 'QUEUED',
				'total_items'     => count( $clean ),
				'config_json'     => wp_json_encode( array( 'outputMode' => $output_mode, 'source' => 'AUTHENTICATED_STUDENT_RISE_LIST', 'sourceCount' => count( $rise_list ), 'excluded' => $excluded, 'defaultDeepCutoff' => MMPS_Tiers::PRIORITY_DEEP_CUTOFF, 'workers' => self::CLIENT_WORKERS, 'rootTextSha256' => $root['textSha256'], 'rootSpecialty' => $root['specialtyLabel'], 'programIds' => $batch_program_ids, 'identityProofs' => array_map( function ( $item ) { return $item['identity']; }, $clean ) ) ),
				'created_at'      => $now,
				'updated_at'      => $now,
			)
		);
		if ( ! $ok ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_create', 'The batch could not be created.', array( 'status' => 500 ) );
		}
		$job_id = absint( $wpdb->insert_id );
		foreach ( $clean as $program ) {
			$item_uuid = MMPS_Store::uuid();
			$inserted = $wpdb->insert(
				self::items_table(),
				array(
					'item_uuid'             => $item_uuid,
					'job_id'                => $job_id,
					'user_id'               => absint( $user_id ),
					'program_specialty_id'  => $program['programSpecialtyId'],
					'tier_requested'        => $program['tier'],
					'status'                => 'QUEUED',
					'max_attempts'          => self::MAX_ATTEMPTS,
					'idempotency_key'       => 'batch:' . $job_uuid . ':' . substr( hash( 'sha256', $program['programSpecialtyId'] ), 0, 32 ),
					'priority_position'     => $program['priorityPosition'],
					'gold_starred'          => $program['goldStarred'] ? 1 : 0,
					'evidence_json'         => '{}',
					'created_at'            => $now,
					'updated_at'            => $now,
				)
			);
			if ( ! $inserted ) {
				$wpdb->query( 'ROLLBACK' );
				return new WP_Error( 'mmps_batch_item_create', 'The complete batch could not be stored atomically. No partial batch was kept.', array( 'status' => 500 ) );
			}
		}
		if ( false === $wpdb->query( 'COMMIT' ) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_commit', 'The complete batch could not be committed.', array( 'status' => 500 ) );
		}
		$refreshed = self::refresh_job( $job_id );
		if ( is_wp_error( $refreshed ) ) {
			return $refreshed;
		}
		MMPS_Store::audit( $user_id, 'batch_create', $job_uuid, array( 'rootId' => $root['id'], 'programCount' => count( $clean ), 'outputMode' => $output_mode, 'excluded' => $excluded ) );
		return self::get( $user_id, $job_uuid );
	}

	public static function list_jobs( $user_id ) {
		global $wpdb;
		MMPS_Install::maybe_install();
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::jobs_table() . ' WHERE user_id = %d ORDER BY id DESC LIMIT 20', absint( $user_id ) ), ARRAY_A );
		return array_map( array( __CLASS__, 'shape_job_summary' ), (array) $rows );
	}

	public static function get( $user_id, $job_uuid ) {
		global $wpdb;
		$job = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::jobs_table() . ' WHERE job_uuid = %s AND user_id = %d', (string) $job_uuid, absint( $user_id ) ), ARRAY_A );
		if ( ! $job ) {
			return new WP_Error( 'mmps_batch_not_found', 'That batch was not found for your account.', array( 'status' => 404 ) );
		}
		$recovered = self::recover_stale( absint( $job['id'] ), $user_id );
		if ( is_wp_error( $recovered ) ) {
			return $recovered;
		}
		$refreshed = self::refresh_job( absint( $job['id'] ) );
		if ( is_wp_error( $refreshed ) ) {
			return $refreshed;
		}
		$job   = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::jobs_table() . ' WHERE id = %d', absint( $job['id'] ) ), ARRAY_A );
		$items = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::items_table() . ' WHERE job_id = %d AND user_id = %d ORDER BY COALESCE(priority_position,2147483647),id', absint( $job['id'] ), absint( $user_id ) ), ARRAY_A );
		if ( ! is_array( $job ) || ! is_array( $items ) ) {
			return new WP_Error( 'mmps_batch_read', 'The batch state could not be read safely.', array( 'status' => 503 ) );
		}
		$out          = self::shape_job_summary( $job );
		$out['items'] = array_map( array( __CLASS__, 'shape_item' ), (array) $items );
		return $out;
	}

	public static function process_next( $user_id, $job_uuid ) {
		global $wpdb;
		$job = self::get( $user_id, $job_uuid );
		if ( is_wp_error( $job ) ) {
			return $job;
		}
		$root = MMPS_Store::get_root( $user_id, absint( $job['rootId'] ) );
		if ( ! $root ) {
			return new WP_Error( 'mmps_batch_root_missing', 'The ROOT for this batch is no longer available.', array( 'status' => 409 ) );
		}
		$token = MMPS_Store::uuid();
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM " . self::items_table() . " WHERE job_id = %d AND user_id = %d AND status = 'QUEUED' AND attempt_count < max_attempts ORDER BY COALESCE(priority_position,2147483647),id LIMIT 1",
				absint( $job['id'] ),
				absint( $user_id )
			),
			ARRAY_A
		);
		if ( ! $row ) {
			return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => null, 'idle' => true );
		}
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
			return new WP_Error( 'mmps_batch_claim_begin', 'The batch item lease could not begin safely.', array( 'status' => 503 ) );
		}
		$claimed = $wpdb->query(
			$wpdb->prepare(
				"UPDATE " . self::items_table() . " SET status='PROCESSING',attempt_count=attempt_count+1,lock_token=%s,locked_until=%s,updated_at=%s WHERE id=%d AND user_id=%d AND status='QUEUED'",
				$token,
				gmdate( 'Y-m-d H:i:s', time() + self::LOCK_SECONDS ),
				MMPS_Store::now(),
				absint( $row['id'] ),
				absint( $user_id )
			)
		);
		if ( 1 !== $claimed ) {
			$wpdb->query( 'ROLLBACK' );
			return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => null, 'contended' => true );
		}
		$slot = $wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::jobs_table() . ' SET active_items=active_items+1,updated_at=%s WHERE id=%d AND user_id=%d AND active_items < %d',
				MMPS_Store::now(), absint( $job['id'] ), absint( $user_id ), self::CLIENT_WORKERS
			)
		);
		if ( 1 !== $slot ) {
			$wpdb->query( 'ROLLBACK' );
			return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => null, 'saturated' => true );
		}
		if ( false === $wpdb->query( 'COMMIT' ) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_claim_commit', 'The batch item lease could not be committed safely.', array( 'status' => 503 ) );
		}
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::items_table() . ' WHERE id=%d AND lock_token=%s', absint( $row['id'] ), $token ), ARRAY_A );
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'mmps_batch_claim_read', 'The claimed item could not be read safely. Its lease will recover automatically.', array( 'status' => 503 ) );
		}
		if ( 'TOP_3_REASONS' === (string) ( $job['config']['outputMode'] ?? '' ) ) {
			return self::finish_top_three( $user_id, $job, $root, $row, $token );
		}
		$other_ids = array_values( array_diff( (array) ( $job['config']['programIds'] ?? array() ), array( (string) $row['program_specialty_id'] ) ) );
		$run = MMPS_Generator::generate( $user_id, $root, $row['program_specialty_id'], $row['tier_requested'], $other_ids, $row['idempotency_key'], 'RECOMMENDED_ONLY' );
		if ( is_wp_error( $run ) ) {
			if ( 'mmps_daily_cap' === $run->get_error_code() ) {
				$stored = self::persist_claim_transition(
					absint( $job['id'] ),
					$user_id,
					absint( $row['id'] ),
					$token,
					array( 'status' => 'QUEUED', 'attempt_count' => max( 0, absint( $row['attempt_count'] ) - 1 ), 'last_error_code' => 'DAILY_CAP_PAUSED', 'lock_token' => '', 'locked_until' => null, 'updated_at' => MMPS_Store::now() )
				);
				if ( is_wp_error( $stored ) ) { return $stored; }
				$refreshed = self::refresh_job( absint( $job['id'] ) );
				if ( is_wp_error( $refreshed ) ) { return $refreshed; }
				return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'paused' => true, 'pauseCode' => 'DAILY_CAP' );
			}
			$terminal = absint( $row['attempt_count'] ) >= absint( $row['max_attempts'] );
			$stored = self::persist_claim_transition(
				absint( $job['id'] ),
				$user_id,
				absint( $row['id'] ),
				$token,
				array( 'status' => $terminal ? 'FAILED' : 'QUEUED', 'last_error_code' => $run->get_error_code(), 'lock_token' => '', 'locked_until' => null, 'updated_at' => MMPS_Store::now() ),
			);
			if ( is_wp_error( $stored ) ) { return $stored; }
			$refreshed = self::refresh_job( absint( $job['id'] ) );
			if ( is_wp_error( $refreshed ) ) { return $refreshed; }
			MMPS_Store::audit( $user_id, 'batch_item_error', $row['item_uuid'], array( 'code' => $run->get_error_code(), 'terminal' => $terminal ) );
			return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'retryable' => ! $terminal );
		}
		$status = 'OK' === $run['status'] ? 'READY' : ( 'RESEARCH_NEEDED' === $run['status'] ? 'RESEARCH_NEEDED' : 'NEEDS_ATTENTION' );
		$program = (array) ( $run['program'] ?? array() );
		$stored = self::persist_claim_transition(
			absint( $job['id'] ),
			$user_id,
			absint( $row['id'] ),
			$token,
			array(
				'acgme_id'        => (string) ( $program['acgmeId'] ?? '' ),
				'program_name'    => mb_substr( (string) ( $program['programName'] ?? $program['institution'] ?? '' ), 0, 255 ),
				'tier_effective'  => (string) $run['tierEffective'],
				'status'          => $status,
				'run_uuid'        => (string) $run['runId'],
				'last_error_code' => '',
				'lock_token'      => '',
				'locked_until'    => null,
				'evidence_json'   => wp_json_encode( array( 'bundleSha256' => $run['bundleSha256'], 'quality' => $run['evidenceQuality'], 'candidateCount' => count( (array) ( $run['candidates'] ?? array() ) ) ) ),
				'updated_at'      => MMPS_Store::now(),
			)
		);
		if ( is_wp_error( $stored ) ) { return $stored; }
		$refreshed = self::refresh_job( absint( $job['id'] ) );
		if ( is_wp_error( $refreshed ) ) { return $refreshed; }
		MMPS_Store::audit( $user_id, 'batch_item_done', $row['item_uuid'], array( 'run' => $run['runId'], 'status' => $status ) );
		return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'run' => $run );
	}

	/** Deterministic, evidence-backed reasons for review; no invented applicant emotion. */
	protected static function finish_top_three( $user_id, $job, $root, $row, $token ) {
		$bundle = MMPS_Evidence_Bundle::for_program( $row['program_specialty_id'] );
		if ( is_wp_error( $bundle ) ) {
			$stored = self::persist_claim_transition( absint( $job['id'] ), $user_id, absint( $row['id'] ), $token, array( 'status' => 'FAILED', 'last_error_code' => $bundle->get_error_code(), 'lock_token' => '', 'locked_until' => null, 'updated_at' => MMPS_Store::now() ) );
			return is_wp_error( $stored ) ? $stored : array( 'job' => self::get( $user_id, $job['jobUuid'] ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'retryable' => false );
		}
		if ( ! MMPS_Evidence_Bundle::specialty_matches( $root['specialtyLabel'], $bundle['program']['designation'] ?? '' ) ) {
			$stored = self::persist_claim_transition( absint( $job['id'] ), $user_id, absint( $row['id'] ), $token, array( 'status' => 'FAILED', 'last_error_code' => 'mmps_batch_specialty_mismatch', 'lock_token' => '', 'locked_until' => null, 'updated_at' => MMPS_Store::now() ) );
			return is_wp_error( $stored ) ? $stored : array( 'job' => self::get( $user_id, $job['jobUuid'] ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'retryable' => false );
		}
		$plan = MMPS_Tiers::plan( $bundle, $root['prefs'], $row['tier_requested'] );
		$facts = array_values( (array) ( $plan['strongReasons'] ?? array() ) );
		$reasons = array();
		foreach ( array_slice( $facts, 0, 3 ) as $fact ) {
			$prov = (array) ( $fact['provenance'] ?? array() );
			$reasons[] = array(
				'factId'       => (string) $fact['factId'],
				'label'        => (string) $fact['label'],
				'proposedReason'=> (string) $fact['text'],
				'matchedOn'    => (string) ( $fact['matchedOn'] ?? '' ),
				'sourceAuthority'=> (string) ( $prov['authority'] ?? $prov['origin'] ?? '' ),
				'sourceUrl'    => (string) ( $prov['sourceUrl'] ?? $prov['itemSource'] ?? '' ),
				'retrievedAt'  => (string) ( $prov['retrievedAt'] ?? '' ),
			);
		}
		$status = ! empty( $plan['reasonInsufficient'] ) || count( $reasons ) < 3 ? 'RESEARCH_NEEDED' : 'READY';
		$program = (array) $bundle['program'];
		$evidence = array( 'mode' => 'TOP_3_REASONS', 'bundleSha256' => $bundle['bundleSha256'], 'quality' => $bundle['evidenceQuality'], 'reasons' => $reasons, 'reasonInsufficient' => count( $reasons ) < 3, 'plannerReasons' => $plan['reasons'], 'rootTextSha256' => $root['textSha256'] );
		$stored = self::persist_claim_transition(
			absint( $job['id'] ), $user_id, absint( $row['id'] ), $token,
			array( 'acgme_id' => (string) ( $program['acgmeId'] ?? '' ), 'program_name' => mb_substr( (string) ( $program['programName'] ?? $program['institution'] ?? '' ), 0, 255 ), 'tier_effective' => (string) $plan['tierEffective'], 'status' => $status, 'run_uuid' => '', 'last_error_code' => '', 'lock_token' => '', 'locked_until' => null, 'evidence_json' => wp_json_encode( $evidence ), 'updated_at' => MMPS_Store::now() )
		);
		if ( is_wp_error( $stored ) ) { return $stored; }
		$refreshed = self::refresh_job( absint( $job['id'] ) );
		if ( is_wp_error( $refreshed ) ) { return $refreshed; }
		MMPS_Store::audit( $user_id, 'batch_reasons_done', $row['item_uuid'], array( 'status' => $status, 'bundle' => $bundle['bundleSha256'], 'reasonCount' => count( $reasons ) ) );
		return array( 'job' => self::get( $user_id, $job['jobUuid'] ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ) );
	}

	public static function generate_alternatives( $user_id, $job_uuid, $item_uuid ) {
		global $wpdb;
		$job = self::get( $user_id, $job_uuid );
		if ( is_wp_error( $job ) ) { return $job; }
		if ( 'FULL_PARAGRAPH' !== (string) ( $job['config']['outputMode'] ?? 'FULL_PARAGRAPH' ) ) {
			return new WP_Error( 'mmps_batch_mode', 'Alternatives are available only for Full Paragraph batches.', array( 'status' => 409 ) );
		}
		$item = self::owned_item( $user_id, $job_uuid, $item_uuid );
		if ( is_wp_error( $item ) ) { return $item; }
		if ( 'PROCESSING' === $item['status'] ) { return new WP_Error( 'mmps_batch_item_busy', 'Wait for this item to finish.', array( 'status' => 409 ) ); }
		$root = MMPS_Store::get_root( $user_id, absint( $job['rootId'] ) );
		if ( ! $root ) { return new WP_Error( 'mmps_batch_root_missing', 'The ROOT for this batch is unavailable.', array( 'status' => 409 ) ); }
		$key = 'alternatives:' . $item_uuid;
		$other_ids = array_values( array_diff( (array) ( $job['config']['programIds'] ?? array() ), array( (string) $item['program_specialty_id'] ) ) );
		$run = MMPS_Generator::generate( $user_id, $root, $item['program_specialty_id'], $item['tier_requested'], $other_ids, $key, 'FIVE' );
		if ( is_wp_error( $run ) ) { return $run; }
		$status = 'OK' === $run['status'] ? 'READY' : ( 'RESEARCH_NEEDED' === $run['status'] ? 'RESEARCH_NEEDED' : 'NEEDS_ATTENTION' );
		$program = (array) ( $run['program'] ?? array() );
		$updated = $wpdb->update( self::items_table(), array( 'acgme_id' => (string) ( $program['acgmeId'] ?? '' ), 'program_name' => mb_substr( (string) ( $program['programName'] ?? $program['institution'] ?? '' ), 0, 255 ), 'tier_effective' => (string) $run['tierEffective'], 'status' => $status, 'run_uuid' => (string) $run['runId'], 'last_error_code' => '', 'evidence_json' => wp_json_encode( array( 'bundleSha256' => $run['bundleSha256'], 'quality' => $run['evidenceQuality'], 'candidateCount' => count( (array) ( $run['candidates'] ?? array() ) ), 'alternativesGenerated' => true ) ), 'updated_at' => MMPS_Store::now() ), array( 'id' => absint( $item['id'] ), 'user_id' => absint( $user_id ) ) );
		if ( false === $updated ) { return new WP_Error( 'mmps_batch_alternatives_persist', 'The alternative set could not be linked safely.', array( 'status' => 503 ) ); }
		$refreshed = self::refresh_job( absint( $item['job_id'] ) );
		if ( is_wp_error( $refreshed ) ) { return $refreshed; }
		return array( 'job' => self::get( $user_id, $job_uuid ), 'run' => $run );
	}

	public static function preview_item( $user_id, $job_uuid, $item_uuid ) {
		$item = self::owned_item( $user_id, $job_uuid, $item_uuid );
		if ( is_wp_error( $item ) ) {
			return $item;
		}
		if ( '' === $item['run_uuid'] ) {
			return new WP_Error( 'mmps_batch_run_missing', 'This item has not produced a run yet.', array( 'status' => 409 ) );
		}
		$run  = MMPS_Store::get_run( $user_id, $item['run_uuid'] );
		$root = $run ? MMPS_Store::get_root( $user_id, absint( $run['root_id'] ) ) : null;
		return $run && $root ? MMPS_Generator::preview_from_stored( $run, $root ) : new WP_Error( 'mmps_batch_run_missing', 'The stored run is unavailable.', array( 'status' => 409 ) );
	}

	public static function set_tier_and_queue( $user_id, $job_uuid, $item_uuid, $tier ) {
		global $wpdb;
		$item = self::owned_item( $user_id, $job_uuid, $item_uuid );
		if ( is_wp_error( $item ) ) {
			return $item;
		}
		if ( 'PROCESSING' === $item['status'] ) {
			return new WP_Error( 'mmps_batch_item_busy', 'Wait for this item to finish before changing its tier.', array( 'status' => 409 ) );
		}
		$tier = 'DEEP' === strtoupper( (string) $tier ) ? 'DEEP' : 'ESSENTIAL';
		$updated = $wpdb->update(
			self::items_table(),
			array( 'tier_requested' => $tier, 'tier_effective' => '', 'status' => 'QUEUED', 'attempt_count' => 0, 'run_uuid' => '', 'last_error_code' => '', 'idempotency_key' => 'regen:' . $item_uuid . ':' . strtolower( $tier ) . ':' . substr( MMPS_Store::uuid(), 0, 8 ), 'updated_at' => MMPS_Store::now() ),
			array( 'id' => absint( $item['id'] ), 'user_id' => absint( $user_id ) )
		);
		if ( false === $updated ) {
			return new WP_Error( 'mmps_batch_requeue_persist', 'The tier change could not be stored safely.', array( 'status' => 503 ) );
		}
		$refreshed = self::refresh_job( absint( $item['job_id'] ) );
		if ( is_wp_error( $refreshed ) ) { return $refreshed; }
		MMPS_Store::audit( $user_id, 'batch_requeue', $item_uuid, array( 'tier' => $tier, 'approvedPreserved' => '' !== $item['approved_doc_uuid'] ) );
		return self::get( $user_id, $job_uuid );
	}

	public static function mark_approved( $user_id, $job_uuid, $item_uuid, $doc_uuid ) {
		global $wpdb;
		$item = self::owned_item( $user_id, $job_uuid, $item_uuid );
		if ( is_wp_error( $item ) ) {
			return $item;
		}
		$updated = $wpdb->update( self::items_table(), array( 'approved_doc_uuid' => (string) $doc_uuid, 'updated_at' => MMPS_Store::now() ), array( 'id' => absint( $item['id'] ), 'user_id' => absint( $user_id ) ) );
		if ( false === $updated ) {
			return new WP_Error( 'mmps_batch_approval_persist', 'The approved document link could not be stored safely.', array( 'status' => 503 ) );
		}
		$refreshed = self::refresh_job( absint( $item['job_id'] ) );
		if ( is_wp_error( $refreshed ) ) { return $refreshed; }
		return self::get( $user_id, $job_uuid );
	}

	protected static function owned_item( $user_id, $job_uuid, $item_uuid ) {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT i.* FROM ' . self::items_table() . ' i INNER JOIN ' . self::jobs_table() . ' j ON j.id=i.job_id WHERE i.item_uuid=%s AND j.job_uuid=%s AND i.user_id=%d AND j.user_id=%d',
				(string) $item_uuid,
				(string) $job_uuid,
				absint( $user_id ),
				absint( $user_id )
			),
			ARRAY_A
		);
		return $row ? $row : new WP_Error( 'mmps_batch_item_not_found', 'That batch item was not found.', array( 'status' => 404 ) );
	}

	protected static function recover_stale( $job_id, $user_id ) {
		global $wpdb;
		$now = MMPS_Store::now();
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
			return new WP_Error( 'mmps_batch_recovery_begin', 'Stale work could not be recovered safely.', array( 'status' => 503 ) );
		}
		$recovered = $wpdb->query( $wpdb->prepare( "UPDATE " . self::items_table() . " SET status=IF(attempt_count>=max_attempts,'FAILED','QUEUED'),lock_token='',locked_until=NULL,last_error_code='STALE_LOCK_RECOVERED',updated_at=%s WHERE job_id=%d AND user_id=%d AND status='PROCESSING' AND locked_until IS NOT NULL AND locked_until < %s", $now, absint( $job_id ), absint( $user_id ), $now ) );
		if ( false === $recovered ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_recovery_items', 'Stale work could not be recovered safely.', array( 'status' => 503 ) );
		}
		if ( $recovered > 0 ) {
			$released = $wpdb->query( $wpdb->prepare( 'UPDATE ' . self::jobs_table() . ' SET active_items=GREATEST(active_items-%d,0),updated_at=%s WHERE id=%d AND user_id=%d', absint( $recovered ), $now, absint( $job_id ), absint( $user_id ) ) );
			if ( false === $released ) {
				$wpdb->query( 'ROLLBACK' );
				return new WP_Error( 'mmps_batch_recovery_counter', 'Stale work could not be reconciled safely.', array( 'status' => 503 ) );
			}
		}
		if ( false === $wpdb->query( 'COMMIT' ) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_recovery_commit', 'Stale work could not be committed safely.', array( 'status' => 503 ) );
		}
		return true;
	}

	/** Persist a claimed item transition and release its job slot as one unit. */
	protected static function persist_claim_transition( $job_id, $user_id, $item_id, $token, $data ) {
		global $wpdb;
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
			return new WP_Error( 'mmps_batch_transition_begin', 'The batch item transition could not begin safely.', array( 'status' => 503 ) );
		}
		$updated = $wpdb->update( self::items_table(), $data, array( 'id' => absint( $item_id ), 'user_id' => absint( $user_id ), 'lock_token' => (string) $token, 'status' => 'PROCESSING' ) );
		$released = 1 === $updated ? $wpdb->query( $wpdb->prepare( 'UPDATE ' . self::jobs_table() . ' SET active_items=active_items-1,updated_at=%s WHERE id=%d AND user_id=%d AND active_items>0', MMPS_Store::now(), absint( $job_id ), absint( $user_id ) ) ) : false;
		if ( 1 !== $updated || 1 !== $released ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_transition_persist', 'The item state and worker slot could not be stored atomically. Its lease will recover automatically.', array( 'status' => 503 ) );
		}
		if ( MMPS_Gate::testing() && get_option( 'mmed_ps_proto_test_fail_transition_commit', false ) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_transition_commit', 'The item state and worker slot could not be committed safely.', array( 'status' => 503 ) );
		}
		if ( false === $wpdb->query( 'COMMIT' ) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'mmps_batch_transition_commit', 'The item state and worker slot could not be committed safely.', array( 'status' => 503 ) );
		}
		return true;
	}

	protected static function refresh_job( $job_id ) {
		global $wpdb;
		$counts = array_fill_keys( array( 'QUEUED', 'PROCESSING', 'READY', 'RESEARCH_NEEDED', 'NEEDS_ATTENTION', 'FAILED' ), 0 );
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT status,COUNT(*) n FROM ' . self::items_table() . ' WHERE job_id=%d GROUP BY status', absint( $job_id ) ), ARRAY_A );
		if ( ! is_array( $rows ) ) {
			return new WP_Error( 'mmps_batch_refresh_counts', 'The batch counters could not be read safely.', array( 'status' => 503 ) );
		}
		foreach ( $rows as $row ) {
			$counts[ $row['status'] ] = absint( $row['n'] );
		}
		$total     = array_sum( $counts );
		$processed = $counts['READY'] + $counts['RESEARCH_NEEDED'] + $counts['NEEDS_ATTENTION'] + $counts['FAILED'];
		$status    = $counts['PROCESSING'] ? 'RUNNING' : ( $counts['QUEUED'] ? ( $processed ? 'PAUSED' : 'QUEUED' ) : ( $counts['FAILED'] || $counts['NEEDS_ATTENTION'] || $counts['RESEARCH_NEEDED'] ? 'COMPLETE_WITH_EXCEPTIONS' : 'READY_FOR_APPROVAL' ) );
		$approved_value = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM " . self::items_table() . " WHERE job_id=%d AND approved_doc_uuid<>''", absint( $job_id ) ) );
		if ( null === $approved_value ) {
			return new WP_Error( 'mmps_batch_refresh_approved', 'The approval counter could not be read safely.', array( 'status' => 503 ) );
		}
		$approved = absint( $approved_value );
		if ( $total > 0 && 0 === $counts['QUEUED'] && 0 === $counts['PROCESSING'] && $approved === $total ) {
			$status = 'COMPLETE';
		}
		$updated = $wpdb->update(
			self::jobs_table(),
			array( 'status' => $status, 'total_items' => $total, 'processed_items' => $processed, 'ready_items' => $counts['READY'], 'attention_items' => $counts['RESEARCH_NEEDED'] + $counts['NEEDS_ATTENTION'], 'failed_items' => $counts['FAILED'], 'updated_at' => MMPS_Store::now() ),
			array( 'id' => absint( $job_id ) )
		);
		return false === $updated ? new WP_Error( 'mmps_batch_refresh_persist', 'The batch counters could not be stored safely.', array( 'status' => 503 ) ) : true;
	}

	protected static function shape_job_summary( $row ) {
		return array(
			'id'             => absint( $row['id'] ),
			'jobUuid'        => $row['job_uuid'],
			'rootId'         => absint( $row['root_id'] ),
			'specialtyLabel' => $row['specialty_label'],
			'status'         => $row['status'],
			'total'          => absint( $row['total_items'] ),
			'processed'      => absint( $row['processed_items'] ),
			'ready'          => absint( $row['ready_items'] ),
			'attention'      => absint( $row['attention_items'] ),
			'failed'         => absint( $row['failed_items'] ),
			'config'         => self::decode( $row['config_json'] ),
			'createdAt'      => $row['created_at'],
			'updatedAt'      => $row['updated_at'],
		);
	}

	protected static function shape_item( $row ) {
		return array(
			'id'                   => absint( $row['id'] ),
			'itemUuid'             => $row['item_uuid'],
			'programSpecialtyId'   => $row['program_specialty_id'],
			'acgmeId'              => $row['acgme_id'],
			'programName'          => $row['program_name'],
			'tierRequested'        => $row['tier_requested'],
			'tierEffective'        => $row['tier_effective'],
			'status'               => $row['status'],
			'attemptCount'         => absint( $row['attempt_count'] ),
			'maxAttempts'          => absint( $row['max_attempts'] ),
			'runId'                => $row['run_uuid'],
			'approvedDocUuid'      => $row['approved_doc_uuid'],
			'lastErrorCode'        => $row['last_error_code'],
			'priorityPosition'     => null === $row['priority_position'] ? null : (int) $row['priority_position'],
			'goldStarred'          => (bool) absint( $row['gold_starred'] ),
			'evidence'             => self::decode( $row['evidence_json'] ),
		);
	}

	protected static function shape_item_by_id( $user_id, $id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::items_table() . ' WHERE id=%d AND user_id=%d', absint( $id ), absint( $user_id ) ), ARRAY_A );
		return $row ? self::shape_item( $row ) : null;
	}
}

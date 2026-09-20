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

	const MAX_ITEMS       = 100;
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

	public static function create( $user_id, $root, $programs ) {
		global $wpdb;
		MMPS_Install::maybe_install();
		if ( empty( $root['region']['mode'] ) || empty( $root['prefs']['categories'] ) ) {
			return new WP_Error( 'mmps_batch_root_incomplete', 'Confirm the editable region and save preferences before creating a batch.', array( 'status' => 409 ) );
		}
		$clean = array();
		foreach ( array_slice( (array) $programs, 0, self::MAX_ITEMS ) as $program ) {
			$id = sanitize_text_field( (string) ( $program['programSpecialtyId'] ?? '' ) );
			if ( '' === $id || strlen( $id ) > 190 || isset( $clean[ $id ] ) ) {
				continue;
			}
			$entry = array(
				'programSpecialtyId' => $id,
				'goldStarred'        => ! empty( $program['goldStarred'] ),
				'priorityPosition'   => isset( $program['priorityPosition'] ) && null !== $program['priorityPosition'] ? max( 1, (int) $program['priorityPosition'] ) : null,
			);
			$default = MMPS_Tiers::default_tier( $entry );
			$tier    = 'DEEP' === strtoupper( (string) ( $program['tier'] ?? $default ) ) ? 'DEEP' : 'ESSENTIAL';
			$entry['tier'] = $tier;
			$clean[ $id ]   = $entry;
		}
		if ( ! $clean ) {
			return new WP_Error( 'mmps_batch_empty', 'Import at least one RISE program.', array( 'status' => 422 ) );
		}
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
				'config_json'     => wp_json_encode( array( 'defaultDeepCutoff' => MMPS_Tiers::PRIORITY_DEEP_CUTOFF, 'workers' => self::CLIENT_WORKERS, 'rootTextSha256' => $root['textSha256'] ) ),
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
		self::refresh_job( $job_id );
		MMPS_Store::audit( $user_id, 'batch_create', $job_uuid, array( 'rootId' => $root['id'], 'programCount' => count( $clean ) ) );
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
		self::recover_stale( absint( $job['id'] ), $user_id );
		self::refresh_job( absint( $job['id'] ) );
		$job   = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::jobs_table() . ' WHERE id = %d', absint( $job['id'] ) ), ARRAY_A );
		$items = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::items_table() . ' WHERE job_id = %d AND user_id = %d ORDER BY COALESCE(priority_position,2147483647),id', absint( $job['id'] ), absint( $user_id ) ), ARRAY_A );
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
			return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => null, 'contended' => true );
		}
		$slot = $wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::jobs_table() . ' SET active_items=active_items+1,updated_at=%s WHERE id=%d AND user_id=%d AND active_items < %d',
				MMPS_Store::now(), absint( $job['id'] ), absint( $user_id ), self::CLIENT_WORKERS
			)
		);
		if ( 1 !== $slot ) {
			$wpdb->query( $wpdb->prepare( "UPDATE " . self::items_table() . " SET status='QUEUED',attempt_count=GREATEST(attempt_count-1,0),lock_token='',locked_until=NULL,updated_at=%s WHERE id=%d AND user_id=%d AND lock_token=%s", MMPS_Store::now(), absint( $row['id'] ), absint( $user_id ), $token ) );
			return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => null, 'saturated' => true );
		}
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::items_table() . ' WHERE id=%d AND lock_token=%s', absint( $row['id'] ), $token ), ARRAY_A );
		$run = MMPS_Generator::generate( $user_id, $root, $row['program_specialty_id'], $row['tier_requested'], array(), $row['idempotency_key'] );
		if ( is_wp_error( $run ) ) {
			if ( 'mmps_daily_cap' === $run->get_error_code() ) {
				$wpdb->query( $wpdb->prepare( "UPDATE " . self::items_table() . " SET status='QUEUED',attempt_count=GREATEST(attempt_count-1,0),last_error_code='DAILY_CAP_PAUSED',lock_token='',locked_until=NULL,updated_at=%s WHERE id=%d AND user_id=%d AND lock_token=%s", MMPS_Store::now(), absint( $row['id'] ), absint( $user_id ), $token ) );
				self::release_slot( absint( $job['id'] ), $user_id );
				self::refresh_job( absint( $job['id'] ) );
				return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'paused' => true, 'pauseCode' => 'DAILY_CAP' );
			}
			$terminal = absint( $row['attempt_count'] ) >= absint( $row['max_attempts'] );
			$updated = $wpdb->update(
				self::items_table(),
				array( 'status' => $terminal ? 'FAILED' : 'QUEUED', 'last_error_code' => $run->get_error_code(), 'lock_token' => '', 'locked_until' => null, 'updated_at' => MMPS_Store::now() ),
				array( 'id' => absint( $row['id'] ), 'user_id' => absint( $user_id ), 'lock_token' => $token )
			);
			self::release_slot( absint( $job['id'] ), $user_id );
			if ( 1 !== $updated ) {
				return new WP_Error( 'mmps_batch_error_persist', 'The failed item state could not be stored safely. It will recover after its lease expires.', array( 'status' => 503 ) );
			}
			self::refresh_job( absint( $job['id'] ) );
			MMPS_Store::audit( $user_id, 'batch_item_error', $row['item_uuid'], array( 'code' => $run->get_error_code(), 'terminal' => $terminal ) );
			return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'retryable' => ! $terminal );
		}
		$status = 'OK' === $run['status'] ? 'READY' : ( 'RESEARCH_NEEDED' === $run['status'] ? 'RESEARCH_NEEDED' : 'NEEDS_ATTENTION' );
		$program = (array) ( $run['program'] ?? array() );
		$updated = $wpdb->update(
			self::items_table(),
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
			),
			array( 'id' => absint( $row['id'] ), 'user_id' => absint( $user_id ), 'lock_token' => $token )
		);
		self::release_slot( absint( $job['id'] ), $user_id );
		if ( 1 !== $updated ) {
			return new WP_Error( 'mmps_batch_result_persist', 'The completed run exists, but the batch item could not link to it. Retry after the item lease recovers; provider work will be reused idempotently.', array( 'status' => 503 ) );
		}
		self::refresh_job( absint( $job['id'] ) );
		MMPS_Store::audit( $user_id, 'batch_item_done', $row['item_uuid'], array( 'run' => $run['runId'], 'status' => $status ) );
		return array( 'job' => self::get( $user_id, $job_uuid ), 'item' => self::shape_item_by_id( $user_id, absint( $row['id'] ) ), 'run' => $run );
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
		$wpdb->update(
			self::items_table(),
			array( 'tier_requested' => $tier, 'tier_effective' => '', 'status' => 'QUEUED', 'attempt_count' => 0, 'run_uuid' => '', 'last_error_code' => '', 'idempotency_key' => 'regen:' . $item_uuid . ':' . strtolower( $tier ) . ':' . substr( MMPS_Store::uuid(), 0, 8 ), 'updated_at' => MMPS_Store::now() ),
			array( 'id' => absint( $item['id'] ), 'user_id' => absint( $user_id ) )
		);
		self::refresh_job( absint( $item['job_id'] ) );
		MMPS_Store::audit( $user_id, 'batch_requeue', $item_uuid, array( 'tier' => $tier, 'approvedPreserved' => '' !== $item['approved_doc_uuid'] ) );
		return self::get( $user_id, $job_uuid );
	}

	public static function mark_approved( $user_id, $job_uuid, $item_uuid, $doc_uuid ) {
		global $wpdb;
		$item = self::owned_item( $user_id, $job_uuid, $item_uuid );
		if ( is_wp_error( $item ) ) {
			return $item;
		}
		$wpdb->update( self::items_table(), array( 'approved_doc_uuid' => (string) $doc_uuid, 'updated_at' => MMPS_Store::now() ), array( 'id' => absint( $item['id'] ), 'user_id' => absint( $user_id ) ) );
		self::refresh_job( absint( $item['job_id'] ) );
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
		$wpdb->query( $wpdb->prepare( "UPDATE " . self::items_table() . " SET status=IF(attempt_count>=max_attempts,'FAILED','QUEUED'),lock_token='',locked_until=NULL,last_error_code='STALE_LOCK_RECOVERED',updated_at=%s WHERE job_id=%d AND user_id=%d AND status='PROCESSING' AND locked_until IS NOT NULL AND locked_until < %s", $now, absint( $job_id ), absint( $user_id ), $now ) );
		$active = absint( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM " . self::items_table() . " WHERE job_id=%d AND user_id=%d AND status='PROCESSING' AND locked_until >= %s", absint( $job_id ), absint( $user_id ), $now ) ) );
		$wpdb->update( self::jobs_table(), array( 'active_items' => min( self::CLIENT_WORKERS, $active ) ), array( 'id' => absint( $job_id ), 'user_id' => absint( $user_id ) ) );
	}

	protected static function release_slot( $job_id, $user_id ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . self::jobs_table() . ' SET active_items=GREATEST(active_items-1,0),updated_at=%s WHERE id=%d AND user_id=%d', MMPS_Store::now(), absint( $job_id ), absint( $user_id ) ) );
	}

	protected static function refresh_job( $job_id ) {
		global $wpdb;
		$counts = array_fill_keys( array( 'QUEUED', 'PROCESSING', 'READY', 'RESEARCH_NEEDED', 'NEEDS_ATTENTION', 'FAILED' ), 0 );
		foreach ( (array) $wpdb->get_results( $wpdb->prepare( 'SELECT status,COUNT(*) n FROM ' . self::items_table() . ' WHERE job_id=%d GROUP BY status', absint( $job_id ) ), ARRAY_A ) as $row ) {
			$counts[ $row['status'] ] = absint( $row['n'] );
		}
		$total     = array_sum( $counts );
		$processed = $counts['READY'] + $counts['RESEARCH_NEEDED'] + $counts['NEEDS_ATTENTION'] + $counts['FAILED'];
		$status    = $counts['PROCESSING'] ? 'RUNNING' : ( $counts['QUEUED'] ? ( $processed ? 'PAUSED' : 'QUEUED' ) : ( $counts['FAILED'] || $counts['NEEDS_ATTENTION'] || $counts['RESEARCH_NEEDED'] ? 'COMPLETE_WITH_EXCEPTIONS' : 'READY_FOR_APPROVAL' ) );
		$approved  = absint( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM " . self::items_table() . " WHERE job_id=%d AND approved_doc_uuid<>''", absint( $job_id ) ) ) );
		if ( $total > 0 && 0 === $counts['QUEUED'] && 0 === $counts['PROCESSING'] && $approved === $total ) {
			$status = 'COMPLETE';
		}
		$wpdb->update(
			self::jobs_table(),
			array( 'status' => $status, 'total_items' => $total, 'processed_items' => $processed, 'ready_items' => $counts['READY'], 'attention_items' => $counts['RESEARCH_NEEDED'] + $counts['NEEDS_ATTENTION'], 'failed_items' => $counts['FAILED'], 'updated_at' => MMPS_Store::now() ),
			array( 'id' => absint( $job_id ) )
		);
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

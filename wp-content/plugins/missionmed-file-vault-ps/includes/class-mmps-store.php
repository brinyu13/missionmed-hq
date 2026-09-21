<?php
/**
 * Prototype persistence. Every read and write is scoped by user_id. No File
 * Vault table is touched from here.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Store {
	private static $review_transaction = false;

	/** Serialize edit heads and library approval, including an original with no edit head.
	 * Run-wide locking is deliberately stronger than candidate-wide. The ROOT row is
	 * also locked so region/preferences cannot change while exact validation runs.
	 */
	public static function with_review_lock( $uid, $run_uuid, $callback ) {
		global $wpdb;
		$failure = new WP_Error( 'mmps_review_lock', 'The review could not be saved atomically. Keep your draft and retry.', array( 'status' => 409 ) );
		if ( self::$review_transaction ) { return $failure; }
		$previous = $wpdb->suppress_errors( true );
		$started = false;
		try {
			$sqlite = isset( $wpdb->is_mysql ) && ! $wpdb->is_mysql;
			if ( ! $sqlite ) {
				// Transactional guarantees must not silently degrade on a MyISAM host.
				$tables = array_map( array( 'MMPS_Install', 'table' ), array( 'runs', 'roots', 'edit_revisions', 'library', 'similarity_fingerprints', 'similarity_buckets', 'audit' ) );
				$marks = implode( ',', array_fill( 0, count( $tables ), '%s' ) );
				$count = $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND ENGINE=\'InnoDB\' AND TABLE_NAME IN (' . $marks . ')', $tables ) );
				if ( (int) $count !== count( $tables ) ) { return $failure; }
			}
			if ( false === $wpdb->query( 'START TRANSACTION' ) ) { return $failure; }
			$started = true;
			if ( $sqlite && false === $wpdb->query( $wpdb->prepare( 'UPDATE ' . MMPS_Install::table( 'runs' ) . ' SET run_uuid=run_uuid WHERE user_id=%d AND run_uuid=%s', $uid, $run_uuid ) ) ) { return $failure; }
			$row = $wpdb->get_row( $wpdb->prepare( 'SELECT id,root_id FROM ' . MMPS_Install::table( 'runs' ) . ' WHERE user_id=%d AND run_uuid=%s' . ( $sqlite ? '' : ' FOR UPDATE' ), $uid, $run_uuid ), ARRAY_A );
			if ( ! $row ) { return new WP_Error( 'mmps_run_not_found', 'That generation run was not found.', array( 'status' => 404 ) ); }
			if ( $sqlite ) {
				$locked_root = $wpdb->query( $wpdb->prepare( 'UPDATE ' . MMPS_Install::table( 'roots' ) . ' SET id=id WHERE user_id=%d AND id=%d', $uid, $row['root_id'] ) );
				if ( false === $locked_root ) { return $failure; }
			} else {
				$locked_root = $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . MMPS_Install::table( 'roots' ) . ' WHERE user_id=%d AND id=%d FOR UPDATE', $uid, $row['root_id'] ) );
				if ( null === $locked_root ) { return $failure; }
			}
			self::$review_transaction = true;
			$result = $callback();
			if ( is_wp_error( $result ) ) { return $result; }
			if ( false === $wpdb->query( 'COMMIT' ) ) { return $failure; }
			$started = false;
			return $result;
		} catch ( \Throwable $error ) {
			return $failure; // Never log an exception/query carrying private prose.
		} finally {
			if ( $started ) { $wpdb->query( 'ROLLBACK' ); }
			self::$review_transaction = false;
			$wpdb->suppress_errors( $previous );
		}
	}

	public static function now() {
		return gmdate( 'Y-m-d H:i:s' );
	}

	public static function uuid() {
		return wp_generate_uuid4();
	}

	protected static function decode( $json, $default = array() ) {
		$value = json_decode( (string) $json, true );
		return is_array( $value ) ? $value : $default;
	}

	/**
	 * Run a write that carries statement text with wpdb error output suppressed:
	 * wpdb::print_error() would otherwise copy the failing query, text included,
	 * into the PHP error log.
	 */
	protected static function quiet( $callback ) {
		global $wpdb;
		$previous = $wpdb->suppress_errors( true );
		$result   = $callback( $wpdb );
		$wpdb->suppress_errors( $previous );
		return $result;
	}

	/* ---------- private immutable paragraph edit chains ---------- */
	public static function edit_head( $uid, $run_uuid, $candidate_id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'edit_revisions' ) . ' WHERE user_id=%d AND run_uuid=%s AND candidate_id=%s ORDER BY id DESC LIMIT 1', $uid, $run_uuid, $candidate_id ), ARRAY_A );
		return $row ? self::decode( $row['revision_json'] ) : null;
	}

	public static function edit_request( $uid, $request_uuid ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'edit_revisions' ) . ' WHERE user_id=%d AND request_uuid=%s', $uid, $request_uuid ), ARRAY_A );
		return $row ? array( 'hash' => $row['request_sha256'], 'revision' => self::decode( $row['revision_json'] ) ) : null;
	}

	public static function insert_edit( $uid, $run_uuid, $request_uuid, $request_hash, $revision ) {
		$row = array( 'user_id' => absint( $uid ), 'run_uuid' => $run_uuid, 'candidate_id' => $revision['candidateId'], 'revision_uuid' => $revision['id'], 'parent_uuid' => $revision['baseRevisionId'], 'request_uuid' => $request_uuid, 'request_sha256' => $request_hash, 'revision_json' => wp_json_encode( $revision ), 'created_at' => self::now() );
		return self::quiet( function ( $db ) use ( $row ) { return (bool) $db->insert( MMPS_Install::table( 'edit_revisions' ), $row ); } );
	}

	/* ---------- roots ---------- */

	public static function create_root( $user_id, $data ) {
		global $wpdb;
		MMPS_Install::maybe_install();
		$row = array(
			'user_id'           => absint( $user_id ),
			'specialty_label'   => sanitize_text_field( $data['specialty_label'] ),
			'source_kind'       => sanitize_key( $data['source_kind'] ),
			'is_synthetic'      => empty( $data['is_synthetic'] ) ? 0 : 1,
			'fv_file_id'        => absint( $data['fv_file_id'] ?? 0 ),
			'fv_version_number' => absint( $data['fv_version_number'] ?? 0 ),
			'fv_version_uuid'   => sanitize_text_field( $data['fv_version_uuid'] ?? '' ),
			'root_label'        => sanitize_text_field( $data['root_label'] ?? '' ),
			'source_sha256'     => sanitize_text_field( $data['source_sha256'] ?? '' ),
			'text_sha256'       => sanitize_text_field( $data['text_sha256'] ),
			'paragraphs_json'   => wp_json_encode( array_values( $data['paragraphs'] ) ),
			'region_json'       => '{}',
			'prefs_json'        => '{}',
			'created_at'        => self::now(),
			'updated_at'        => self::now(),
		);
		return self::quiet( function ( $db ) use ( $row ) {
			return $db->insert( MMPS_Install::table( 'roots' ), $row ) ? absint( $db->insert_id ) : 0;
		} );
	}

	public static function get_root( $user_id, $root_id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'roots' ) . ' WHERE id = %d AND user_id = %d', absint( $root_id ), absint( $user_id ) ), ARRAY_A );
		return $row ? self::shape_root( $row ) : null;
	}

	public static function list_roots( $user_id ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'roots' ) . ' WHERE user_id = %d ORDER BY id DESC LIMIT 50', absint( $user_id ) ), ARRAY_A );
		return array_map( array( __CLASS__, 'shape_root' ), (array) $rows );
	}

	protected static function shape_root( $row ) {
		return array(
			'id'              => absint( $row['id'] ),
			'specialtyLabel'  => $row['specialty_label'],
			'sourceKind'      => strtoupper( $row['source_kind'] ),
			'isSynthetic'     => (bool) absint( $row['is_synthetic'] ),
			'fvFileId'        => absint( $row['fv_file_id'] ),
			'fvVersionNumber' => absint( $row['fv_version_number'] ),
			'fvVersionUuid'   => $row['fv_version_uuid'],
			'rootLabel'       => $row['root_label'],
			'sourceSha256'    => $row['source_sha256'],
			'textSha256'      => $row['text_sha256'],
			'paragraphs'      => self::decode( $row['paragraphs_json'] ),
			'region'          => self::decode( $row['region_json'] ),
			'prefs'           => self::decode( $row['prefs_json'] ),
			'createdAt'       => $row['created_at'],
		);
	}

	public static function update_root_json( $user_id, $root_id, $column, $value ) {
		global $wpdb;
		if ( ! in_array( $column, array( 'region_json', 'prefs_json' ), true ) ) {
			return false;
		}
		$previous = $wpdb->suppress_errors( true ); // Preference notes are user text; keep them out of the PHP error log.
		$ok       = false !== $wpdb->update(
			MMPS_Install::table( 'roots' ),
			array( $column => wp_json_encode( $value ), 'updated_at' => self::now() ),
			array( 'id' => absint( $root_id ), 'user_id' => absint( $user_id ) )
		);
		$wpdb->suppress_errors( $previous );
		return $ok;
	}

	/* ---------- runs ---------- */

	public static function count_runs( $user_id, $root_id, $program_id ) {
		global $wpdb;
		return absint( $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . MMPS_Install::table( 'runs' ) . ' WHERE user_id = %d AND root_id = %d AND program_specialty_id = %s', absint( $user_id ), absint( $root_id ), (string) $program_id ) ) );
	}

	/** Count only stored provider-backed attempts; a no-provider research stop is not the canary generation. */
	public static function count_provider_runs( $user_id, $root_id, $program_id ) {
		global $wpdb;
		return absint( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM " . MMPS_Install::table( 'runs' ) . " WHERE user_id = %d AND root_id = %d AND program_specialty_id = %s AND provider <> 'none'", absint( $user_id ), absint( $root_id ), (string) $program_id ) ) );
	}

	/** Return the latest provider-backed run for durable canary review after reload. */
	public static function latest_provider_run_uuid( $user_id, $root_id ) {
		global $wpdb;
		return (string) $wpdb->get_var( $wpdb->prepare( "SELECT run_uuid FROM " . MMPS_Install::table( 'runs' ) . " WHERE user_id = %d AND root_id = %d AND provider <> 'none' ORDER BY id DESC LIMIT 1", absint( $user_id ), absint( $root_id ) ) );
	}

	public static function runs_today( $user_id ) {
		global $wpdb;
		return absint( $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . MMPS_Install::table( 'runs' ) . ' WHERE user_id = %d AND created_at >= %s', absint( $user_id ), gmdate( 'Y-m-d 00:00:00' ) ) ) );
	}

	/**
	 * Atomically reserve one provider-attempt slot. A unique (user, day, number)
	 * key resolves concurrent reservations without a shared-text log or option.
	 */
	public static function reserve_provider_attempt( $user_id, $root_id, $program_id, $idempotency_key, $limit ) {
		global $wpdb;
		$day   = gmdate( 'Y-m-d' );
		$table = MMPS_Install::table( 'provider_attempts' );
		for ( $try = 0; $try < 8; $try++ ) {
			$next = 1 + absint( $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(attempt_no) FROM ' . $table . ' WHERE user_id=%d AND day_key=%s', absint( $user_id ), $day ) ) );
			if ( $next > absint( $limit ) ) {
				return new WP_Error( 'mmps_daily_cap', 'Daily AI provider-attempt cap reached (' . absint( $limit ) . '). The batch is paused and can resume after the UTC day changes.', array( 'status' => 429 ) );
			}
			$uuid = self::uuid();
			$ok   = $wpdb->insert(
				$table,
				array(
					'attempt_uuid'          => $uuid,
					'user_id'              => absint( $user_id ),
					'root_id'              => absint( $root_id ),
					'program_specialty_id' => (string) $program_id,
					'idempotency_key'       => (string) $idempotency_key,
					'day_key'               => $day,
					'attempt_no'            => $next,
					'outcome_code'          => 'STARTED',
					'created_at'            => self::now(),
					'updated_at'            => self::now(),
				)
			);
			if ( $ok ) { return $uuid; }
			// A concurrent insert may have taken the same slot. Re-read and retry.
		}
		return new WP_Error( 'mmps_attempt_reservation', 'The AI attempt could not be reserved safely. Try again.', array( 'status' => 503 ) );
	}

	public static function finish_provider_attempt( $user_id, $attempt_uuid, $outcome_code ) {
		global $wpdb;
		return false !== $wpdb->update(
			MMPS_Install::table( 'provider_attempts' ),
			array( 'outcome_code' => substr( sanitize_key( (string) $outcome_code ), 0, 80 ), 'updated_at' => self::now() ),
			array( 'attempt_uuid' => (string) $attempt_uuid, 'user_id' => absint( $user_id ) )
		);
	}

	public static function provider_attempts_today( $user_id ) {
		global $wpdb;
		return absint( $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . MMPS_Install::table( 'provider_attempts' ) . ' WHERE user_id=%d AND day_key=%s', absint( $user_id ), gmdate( 'Y-m-d' ) ) ) );
	}

	public static function insert_run( $user_id, $run ) {
		global $wpdb;
		$previous = $wpdb->suppress_errors( true ); // The row carries generated text; keep it out of the PHP error log.
		$wpdb->insert(
			MMPS_Install::table( 'runs' ),
			array(
				'run_uuid'             => $run['run_uuid'],
				'user_id'              => absint( $user_id ),
				'root_id'              => absint( $run['root_id'] ),
				'program_specialty_id' => (string) $run['program_specialty_id'],
				'tier_requested'       => (string) $run['tier_requested'],
				'tier_effective'       => (string) $run['tier_effective'],
				'strategy_key'         => (string) $run['strategy_key'],
				'regen_ordinal'        => absint( $run['regen_ordinal'] ),
				'provider'             => (string) $run['provider'],
				'model'                => (string) $run['model'],
				'status'               => (string) $run['status'],
				'bundle_sha256'        => (string) $run['bundle_sha256'],
				'bundle_json'          => wp_json_encode( $run['bundle'] ),
				'output_json'          => wp_json_encode( $run['output'] ),
				'validation_json'      => wp_json_encode( $run['validation'] ),
				'latency_ms'           => absint( $run['latency_ms'] ),
				'tokens_in'            => absint( $run['tokens_in'] ),
				'tokens_out'           => absint( $run['tokens_out'] ),
				'idempotency_key'       => ! empty( $run['idempotency_key'] ) ? (string) $run['idempotency_key'] : null,
				'created_at'           => self::now(),
			)
		);
		$id = absint( $wpdb->insert_id );
		$wpdb->suppress_errors( $previous );
		return $id;
	}

	public static function get_run( $user_id, $run_uuid ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'runs' ) . ' WHERE run_uuid = %s AND user_id = %d', (string) $run_uuid, absint( $user_id ) ), ARRAY_A );
		if ( ! $row ) {
			return null;
		}
		$row['bundle']     = self::decode( $row['bundle_json'] );
		$row['output']     = self::decode( $row['output_json'] );
		$row['validation'] = self::decode( $row['validation_json'] );
		return $row;
	}

	public static function get_run_by_idempotency( $user_id, $idempotency_key ) {
		global $wpdb;
		if ( '' === (string) $idempotency_key ) {
			return null;
		}
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'runs' ) . ' WHERE idempotency_key = %s AND user_id = %d', (string) $idempotency_key, absint( $user_id ) ), ARRAY_A );
		if ( ! $row ) {
			return null;
		}
		$row['bundle']     = self::decode( $row['bundle_json'] );
		$row['output']     = self::decode( $row['output_json'] );
		$row['validation'] = self::decode( $row['validation_json'] );
		return $row;
	}

	/* ---------- library ---------- */

	public static function next_version( $user_id, $root_id, $program_id ) {
		global $wpdb;
		return 1 + absint( $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(version_number) FROM ' . MMPS_Install::table( 'library' ) . ' WHERE user_id = %d AND root_id = %d AND program_specialty_id = %s', absint( $user_id ), absint( $root_id ), (string) $program_id ) ) );
	}

	public static function insert_document( $user_id, $doc, $fingerprint = null ) {
		global $wpdb;
		$doc['user_id']    = absint( $user_id );
		$doc['created_at'] = self::now();
		$doc['updated_at'] = self::now();
		$standalone = ! self::$review_transaction;
		if ( $standalone && false === $wpdb->query( 'START TRANSACTION' ) ) { return 0; }
		$id = self::quiet( function ( $db ) use ( $doc ) {
			return $db->insert( MMPS_Install::table( 'library' ), $doc ) ? absint( $db->insert_id ) : 0;
		} );
		if ( ! $id || ( is_array( $fingerprint ) && ! MMPS_Similarity::store( $user_id, $doc['doc_uuid'], $fingerprint ) ) ) {
			if ( $standalone ) { $wpdb->query( 'ROLLBACK' ); }
			return 0;
		}
		if ( $standalone && false === $wpdb->query( 'COMMIT' ) ) {
			$wpdb->query( 'ROLLBACK' );
			return 0;
		}
		return $id;
	}

	public static function get_document( $user_id, $doc_uuid ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'library' ) . ' WHERE doc_uuid = %s AND user_id = %d', (string) $doc_uuid, absint( $user_id ) ), ARRAY_A );
		return $row ? self::shape_document( $row, true ) : null;
	}

	public static function find_document_by_run( $user_id, $run_id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'library' ) . ' WHERE run_id = %d AND user_id = %d', absint( $run_id ), absint( $user_id ) ), ARRAY_A );
		return $row ? self::shape_document( $row, true ) : null;
	}

	public static function list_documents( $user_id ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'library' ) . ' WHERE user_id = %d ORDER BY id DESC LIMIT 200', absint( $user_id ) ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[] = self::shape_document( $row, false );
		}
		return $out;
	}

	/** Owner-scoped complete documents for selected/bulk export. */
	public static function documents_for_export( $user_id, $uuids = array(), $approved_only = false ) {
		global $wpdb;
		$uuids = array_values( array_unique( array_filter( array_map( 'strval', (array) $uuids ) ) ) );
		$where = $wpdb->prepare( 'user_id = %d', absint( $user_id ) );
		if ( $approved_only ) {
			$where .= " AND status = 'APPROVED'";
		}
		if ( $uuids ) {
			$marks  = implode( ',', array_fill( 0, count( $uuids ), '%s' ) );
			$where .= $wpdb->prepare( " AND doc_uuid IN ($marks)", $uuids ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders are generated, values prepared.
		}
		$rows = $wpdb->get_results( 'SELECT * FROM ' . MMPS_Install::table( 'library' ) . ' WHERE ' . $where . ' ORDER BY specialty_label,program_name,version_number DESC LIMIT 1000', ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- owner/status/uuid predicates are prepared above.
		return array_map( function ( $row ) {
			return self::shape_document( $row, true );
		}, (array) $rows );
	}

	public static function set_document_status( $user_id, $doc_uuid, $status ) {
		global $wpdb;
		return false !== $wpdb->update(
			MMPS_Install::table( 'library' ),
			array( 'status' => $status, 'updated_at' => self::now() ),
			array( 'doc_uuid' => (string) $doc_uuid, 'user_id' => absint( $user_id ) )
		);
	}

	protected static function shape_document( $row, $with_text ) {
		$doc = array(
			'docUuid'            => $row['doc_uuid'],
			'rootId'             => absint( $row['root_id'] ),
			'specialtyLabel'     => $row['specialty_label'],
			'programSpecialtyId' => $row['program_specialty_id'],
			'acgmeId'            => $row['acgme_id'],
			'programName'        => $row['program_name'],
			'institution'        => $row['institution'],
			'city'               => $row['city'],
			'state'              => $row['state'],
			'tier'               => $row['tier'],
			'versionNumber'      => absint( $row['version_number'] ),
			'status'             => $row['status'],
			'title'              => $row['title'],
			'rootLabel'          => $row['root_label'],
			'fullTextSha256'     => $row['full_text_sha256'],
			'metadata'           => self::decode( $row['metadata_json'] ),
			'createdAt'          => $row['created_at'],
		);
		if ( $with_text ) {
			$doc['fullText']   = $row['full_text'];
			$doc['regionText'] = $row['region_text'];
		}
		return $doc;
	}

	/* ---------- audit (ids, codes and hashes only; never statement text) ---------- */

	public static function audit( $user_id, $action, $ref = '', $detail = array() ) {
		global $wpdb;
		$wpdb->insert(
			MMPS_Install::table( 'audit' ),
			array(
				'user_id'     => absint( $user_id ),
				'action'      => sanitize_key( $action ),
				'ref'         => substr( sanitize_text_field( (string) $ref ), 0, 190 ),
				'detail_json' => wp_json_encode( $detail ),
				'created_at'  => self::now(),
			)
		);
	}
}

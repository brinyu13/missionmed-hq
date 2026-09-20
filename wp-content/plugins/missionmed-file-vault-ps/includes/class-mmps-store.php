<?php
/**
 * Prototype persistence. Every read and write is scoped by user_id. No File
 * Vault table is touched from here.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Store {

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

	public static function runs_today( $user_id ) {
		global $wpdb;
		return absint( $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . MMPS_Install::table( 'runs' ) . ' WHERE user_id = %d AND created_at >= %s', absint( $user_id ), gmdate( 'Y-m-d 00:00:00' ) ) ) );
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

	/* ---------- library ---------- */

	public static function next_version( $user_id, $root_id, $program_id ) {
		global $wpdb;
		return 1 + absint( $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(version_number) FROM ' . MMPS_Install::table( 'library' ) . ' WHERE user_id = %d AND root_id = %d AND program_specialty_id = %s', absint( $user_id ), absint( $root_id ), (string) $program_id ) ) );
	}

	public static function insert_document( $user_id, $doc ) {
		global $wpdb;
		$doc['user_id']    = absint( $user_id );
		$doc['created_at'] = self::now();
		$doc['updated_at'] = self::now();
		return self::quiet( function ( $db ) use ( $doc ) {
			return $db->insert( MMPS_Install::table( 'library' ), $doc ) ? absint( $db->insert_id ) : 0;
		} );
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

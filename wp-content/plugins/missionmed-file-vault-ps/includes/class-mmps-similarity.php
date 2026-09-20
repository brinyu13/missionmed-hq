<?php
/**
 * M5 privacy-safe cross-student similarity protection.
 *
 * Only keyed digests and compact MinHash signatures are persisted. No source
 * prose, shingles, user identity or matched document identifier is returned to
 * another student. Exact cross-student reuse fails closed; near similarity asks
 * for explicit review instead of forcing artificial rewrites.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Similarity {

	const VERSION        = 'mmps-similarity.v1';
	const SIGNATURE_SIZE = 64;
	const NEAR_THRESHOLD = 0.58;

	protected static function key() {
		return hash( 'sha256', wp_salt( 'auth' ) . '|MissionMed|PSV|similarity|v1' );
	}

	/** Salt rotations create a new auditable algorithm identity and trigger re-keying. */
	protected static function algorithm_id() {
		return self::VERSION . ':' . substr( hash_hmac( 'sha256', 'key-id', self::key() ), 0, 16 );
	}

	protected static function normalize( $text ) {
		$text = mb_strtolower( html_entity_decode( (string) $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' ), 'UTF-8' );
		$text = preg_replace( '/[^\p{L}\p{N}]+/u', ' ', $text );
		return trim( preg_replace( '/\s+/u', ' ', $text ) );
	}

	public static function fingerprint( $text ) {
		$normalized = self::normalize( $text );
		$tokens     = '' === $normalized ? array() : preg_split( '/\s+/u', $normalized );
		$shingles   = array();
		$width      = count( $tokens ) >= 5 ? 5 : max( 1, count( $tokens ) );
		if ( $tokens ) {
			for ( $i = 0; $i <= count( $tokens ) - $width; $i++ ) {
				$shingle = implode( ' ', array_slice( $tokens, $i, $width ) );
				$shingles[ substr( hash_hmac( 'sha256', $shingle, self::key() ), 0, 24 ) ] = true;
			}
		}
		$signature = array();
		for ( $seed = 0; $seed < self::SIGNATURE_SIZE; $seed++ ) {
			$minimum = null;
			foreach ( array_keys( $shingles ) as $digest ) {
				$value   = substr( hash_hmac( 'sha256', $seed . '|' . $digest, self::key() ), 0, 24 );
				$minimum = null === $minimum || strcmp( $value, $minimum ) < 0 ? $value : $minimum;
			}
			$signature[] = null === $minimum ? '-' : $minimum;
		}
		// One keyed bucket per MinHash position makes candidate retrieval complete:
		// every score above zero shares at least one bucket. The previous four-value
		// bands could miss genuine near duplicates whose equal values were dispersed.
		$buckets = array();
		foreach ( $signature as $index => $value ) {
			$buckets[] = substr( hash_hmac( 'sha256', $index . '|' . $value, self::key() ), 0, 32 );
		}
		return array(
			'version'   => self::algorithm_id(),
			'exactHmac' => hash_hmac( 'sha256', $normalized, self::key() ),
			'signature' => $signature,
			'buckets'   => $buckets,
			'wordCount' => count( $tokens ),
		);
	}

	public static function score( $left, $right ) {
		$a = array_values( (array) $left );
		$b = array_values( (array) $right );
		if ( ! $a || ! $b ) { return 0.0; }
		$count = min( count( $a ), count( $b ) );
		$same  = 0;
		for ( $i = 0; $i < $count; $i++ ) { if ( hash_equals( (string) $a[ $i ], (string) $b[ $i ] ) ) { $same++; } }
		return $count ? $same / $count : 0.0;
	}

	public static function assess( $user_id, $region_text ) {
		global $wpdb;
		$backfilled = self::backfill();
		if ( is_wp_error( $backfilled ) ) {
			return $backfilled;
		}
		$fingerprint = self::fingerprint( $region_text );
		$table       = MMPS_Install::table( 'similarity_fingerprints' );
		$exact_value = $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . $table . ' WHERE algorithm=%s AND user_id<>%d AND exact_hmac=%s', self::algorithm_id(), absint( $user_id ), $fingerprint['exactHmac'] ) );
		if ( null === $exact_value ) {
			return new WP_Error( 'mmps_similarity_read', 'Cross-student protection could not be verified. Saving is paused safely.', array( 'status' => 503 ) );
		}
		$exact = absint( $exact_value );
		if ( $exact ) {
			return array( 'status' => 'EXACT_BLOCKED', 'band' => 'EXACT', 'fingerprint' => $fingerprint );
		}
		$b = $fingerprint['buckets'];
		$marks = implode( ',', array_fill( 0, count( $b ), '%s' ) );
		$args  = array_merge( array( self::algorithm_id(), absint( $user_id ) ), $b );
		$rows = $wpdb->get_results(
			$wpdb->prepare( 'SELECT DISTINCT f.signature_json FROM ' . MMPS_Install::table( 'similarity_buckets' ) . ' b INNER JOIN ' . $table . ' f ON f.doc_uuid=b.doc_uuid WHERE f.algorithm=%s AND b.user_id<>%d AND b.bucket_hash IN (' . $marks . ')', $args ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders are generated and all values prepared.
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return new WP_Error( 'mmps_similarity_read', 'Cross-student protection could not be verified. Saving is paused safely.', array( 'status' => 503 ) );
		}
		$max = 0.0;
		foreach ( (array) $rows as $row ) {
			$other = json_decode( (string) $row['signature_json'], true );
			$max   = max( $max, self::score( $fingerprint['signature'], is_array( $other ) ? $other : array() ) );
		}
		return array(
			'status'      => $max >= self::NEAR_THRESHOLD ? 'NEAR_REVIEW' : 'CLEAR',
			'band'        => $max >= 0.78 ? 'HIGH' : ( $max >= self::NEAR_THRESHOLD ? 'MODERATE' : 'CLEAR' ),
			'fingerprint' => $fingerprint,
		);
	}

	/** Backfill existing isolated PSV documents without exposing their prose. */
	protected static function backfill() {
		global $wpdb;
		$library = MMPS_Install::table( 'library' );
		$table   = MMPS_Install::table( 'similarity_fingerprints' );
		for ( $page = 0; $page < 40; $page++ ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare( 'SELECT l.doc_uuid,l.user_id,l.region_text FROM ' . $library . ' l LEFT JOIN ' . $table . ' f ON f.doc_uuid=l.doc_uuid WHERE f.id IS NULL OR f.algorithm<>%s ORDER BY l.id LIMIT 250', self::algorithm_id() ),
				ARRAY_A
			);
			if ( ! is_array( $rows ) ) {
				return new WP_Error( 'mmps_similarity_backfill_read', 'Cross-student protection could not be refreshed. Saving is paused safely.', array( 'status' => 503 ) );
			}
			if ( ! $rows ) {
				return true;
			}
			foreach ( $rows as $row ) {
				if ( ! self::replace_stored( absint( $row['user_id'] ), $row['doc_uuid'], self::fingerprint( $row['region_text'] ) ) ) {
					return new WP_Error( 'mmps_similarity_backfill_write', 'Cross-student protection could not be refreshed. Saving is paused safely.', array( 'status' => 503 ) );
				}
			}
		}
		return new WP_Error( 'mmps_similarity_backfill_capacity', 'Cross-student protection is still refreshing a large library. Saving is paused safely; retry shortly.', array( 'status' => 503 ) );
	}

	/** Re-key one existing document atomically when the server-side salt changes. */
	protected static function replace_stored( $user_id, $doc_uuid, $fingerprint ) {
		global $wpdb;
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) { return false; }
		$deleted_buckets = $wpdb->delete( MMPS_Install::table( 'similarity_buckets' ), array( 'doc_uuid' => (string) $doc_uuid ) );
		$deleted_fingerprint = $wpdb->delete( MMPS_Install::table( 'similarity_fingerprints' ), array( 'doc_uuid' => (string) $doc_uuid ) );
		if ( false === $deleted_buckets || false === $deleted_fingerprint || ! self::store( $user_id, $doc_uuid, $fingerprint ) ) {
			$wpdb->query( 'ROLLBACK' );
			return false;
		}
		if ( false === $wpdb->query( 'COMMIT' ) ) {
			$wpdb->query( 'ROLLBACK' );
			return false;
		}
		return true;
	}

	public static function store( $user_id, $doc_uuid, $fingerprint ) {
		global $wpdb;
		$b = (array) $fingerprint['buckets'];
		$stored = (bool) $wpdb->insert(
			MMPS_Install::table( 'similarity_fingerprints' ),
			array(
				'doc_uuid'       => (string) $doc_uuid,
				'user_id'        => absint( $user_id ),
				'algorithm'      => self::algorithm_id(),
				'exact_hmac'     => (string) $fingerprint['exactHmac'],
				'bucket_a'       => (string) ( $b[0] ?? '' ),
				'bucket_b'       => (string) ( $b[1] ?? '' ),
				'bucket_c'       => (string) ( $b[2] ?? '' ),
				'bucket_d'       => (string) ( $b[3] ?? '' ),
				'signature_json' => wp_json_encode( array_values( $fingerprint['signature'] ) ),
				'created_at'     => MMPS_Store::now(),
			)
		);
		if ( ! $stored ) { return false; }
		foreach ( array_values( (array) $fingerprint['buckets'] ) as $index => $bucket ) {
			if ( ! $wpdb->insert( MMPS_Install::table( 'similarity_buckets' ), array( 'doc_uuid' => (string) $doc_uuid, 'user_id' => absint( $user_id ), 'bucket_index' => $index, 'bucket_hash' => (string) $bucket, 'created_at' => MMPS_Store::now() ) ) ) {
				// Keep lazy backfill atomic even when it is not already inside the
				// library document transaction. A document save will subsequently
				// roll back these deletes together with the insert that called us.
				$wpdb->delete( MMPS_Install::table( 'similarity_buckets' ), array( 'doc_uuid' => (string) $doc_uuid ) );
				$wpdb->delete( MMPS_Install::table( 'similarity_fingerprints' ), array( 'doc_uuid' => (string) $doc_uuid ) );
				return false;
			}
		}
		return true;
	}
}

<?php
/**
 * Read-only bridge into File Vault. Loaded lazily, and only after
 * MMPS_Root_Source::file_vault_available() has proved by reflection that
 * the parent class can be extended safely. Never loaded at plugin boot.
 *
 * @package MissionMed_File_Vault_PS
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'MMED_File_Vault_V2_Repository' ) || class_exists( 'MMPS_FV_Reader' ) ) {
	return;
}

/**
 * Read-only bridge. Uses only members that exist on the File Vault
 * repository today: list_documents() [public], table_name() [public, V1],
 * meta_for_row(), internal_versions(), presign_download_url() [protected].
 */
class MMPS_FV_Reader extends MMED_File_Vault_V2_Repository {

	public static function contract_ok() {
		foreach ( array( 'list_documents', 'table_name', 'meta_for_row', 'internal_versions', 'presign_download_url' ) as $method ) {
			if ( ! method_exists( __CLASS__, $method ) ) {
				return false;
			}
		}
		return true;
	}

	public static function ps_candidates( $user_id ) {
		$documents = parent::list_documents( absint( $user_id ) );
		if ( is_wp_error( $documents ) ) {
			return $documents;
		}
		$out = array();
		foreach ( (array) $documents as $doc ) {
			if ( 'personal_statement' !== ( $doc['document_type'] ?? '' ) ) {
				continue;
			}
			foreach ( (array) ( $doc['versions'] ?? array() ) as $version ) {
				$name = (string) ( $version['canonical_name'] ?? $version['original_name'] ?? '' );
				$docx = 'docx' === strtolower( pathinfo( $name, PATHINFO_EXTENSION ) )
					|| false !== strpos( (string) ( $version['mime_type'] ?? '' ), 'wordprocessingml' );
				$out[] = array(
					'fileId'        => absint( $doc['id'] ),
					'documentName'  => (string) ( $doc['name'] ?? '' ),
					'versionNumber' => absint( $version['number'] ?? 0 ),
					'versionUuid'   => (string) ( $version['version_uuid'] ?? '' ),
					'versionLabel'  => (string) ( $version['version_label'] ?? $version['draft_label'] ?? '' ),
					'isFinal'       => ! empty( $version['is_final'] ),
					'uploadedAt'    => (string) ( $version['uploaded_at'] ?? '' ),
					'fileName'      => $name,
					'usable'        => $docx && 'ready_clean' === ( $version['verification_state'] ?? '' ),
					'whyNot'        => $docx ? ( 'ready_clean' === ( $version['verification_state'] ?? '' ) ? '' : 'Not yet verified clean by File Vault' ) : 'Only DOCX can be used here',
				);
			}
		}
		return $out;
	}

	/** Owner-scoped read of one exact version. Returns array(bytes, sha256, version) or WP_Error. */
	public static function read_version( $user_id, $file_id, $version_number ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . parent::table_name() . ' WHERE id = %d AND user_id = %d', absint( $file_id ), absint( $user_id ) ) );
		if ( ! $row ) {
			return new WP_Error( 'mmps_root_not_found', 'That File Vault document was not found for your account.', array( 'status' => 404 ) );
		}
		$meta    = self::meta_for_row( $row );
		$version = null;
		foreach ( self::internal_versions( $row, $meta ) as $candidate ) {
			if ( absint( $candidate['number'] ?? 0 ) === absint( $version_number ) ) {
				$version = $candidate;
			}
		}
		if ( ! $version || empty( $version['r2_key'] ) || 'ready_clean' !== ( $version['verification_state'] ?? '' ) ) {
			return new WP_Error( 'mmps_root_not_usable', 'That version is not available as a verified clean file.', array( 'status' => 422 ) );
		}
		$url = self::presign_download_url( (string) $version['r2_key'], 'root.docx' );
		if ( '' === $url ) {
			return new WP_Error( 'mmps_root_storage', 'File Vault storage is not available right now.', array( 'status' => 503 ) );
		}
		$response = wp_remote_get( $url, array( 'timeout' => 20, 'redirection' => 0, 'limit_response_size' => 5 * 1024 * 1024 ) );
		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return new WP_Error( 'mmps_root_storage', 'The file could not be read from File Vault storage.', array( 'status' => 502 ) );
		}
		$bytes = (string) wp_remote_retrieve_body( $response );
		$sha   = hash( 'sha256', $bytes );
		if ( ! empty( $version['sha256'] ) && ! hash_equals( strtolower( (string) $version['sha256'] ), $sha ) ) {
			return new WP_Error( 'mmps_root_hash', 'The file read from storage does not match File Vault\'s record.', array( 'status' => 502 ) );
		}
		return array( 'bytes' => $bytes, 'sha256' => $sha, 'version' => $version );
	}
}

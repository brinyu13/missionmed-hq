<?php
/**
 * M4 research-artifact quarantine.
 *
 * Uploaded Markdown never becomes RISE evidence here. PSV validates identity,
 * shape and provenance, stores it in its own quarantine table, and exposes a
 * validated handoff file for the future RISE-owner contract. Only a later RISE
 * bundle can make the facts available to generation.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Research {

	const SCHEMA    = 'missionmed.rise.research-artifact.v1';
	const SCHEMA_V2 = 'missionmed.rise.research-artifact.v2';
	const MAX_BYTES = 262144;
	const MIN_BYTES = 400;
	const MAX_LINES = 4000;
	const MAX_LINE_BYTES = 2000;

	public static function fields() {
		return array(
			'research.program_differentiators',
			'research.curriculum',
			'research.fellowship_inventory',
			'research.research_opportunities',
			'research.facilities_patient_population',
			'research.culture',
			'research.leadership',
		);
	}

	public static function source_types() {
		return array( 'PROGRAM_OFFICIAL', 'SPONSOR_OFFICIAL', 'ACGME_PUBLIC' );
	}

	public static function source_types_v2() {
		return array_merge( self::source_types(), array( 'AFFILIATE_OFFICIAL', 'BOARD_OR_NATIONAL_BODY', 'GOVERNMENT_PUBLIC', 'PUBLICATION_INDEX' ) );
	}

	/** Common Stage A intake for a completed mission file or pasted fenced artifact. */
	public static function ingest_v2( $user_id, $mission, $bytes, $channel, $filename = '' ) {
		global $wpdb;
		$bytes = preg_replace( "/\r\n?|\xEF\xBB\xBF/", "\n", (string) $bytes );
		if ( preg_match( '/\A```(?:markdown|md)?\s*\n(.*)\n```\s*\z/s', $bytes, $wrapped ) ) { $bytes = $wrapped[1]; }
		$size = strlen( $bytes );
		if ( $size < self::MIN_BYTES || $size > self::MAX_BYTES ) { return new WP_Error( 'mmps_research_size', 'The completed research file is incomplete or larger than the 256 KB limit.', array( 'status' => 413 ) ); }
		if ( ! mb_check_encoding( $bytes, 'UTF-8' ) || false !== strpos( $bytes, "\0" ) || preg_match( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $bytes ) ) { return new WP_Error( 'mmps_research_encoding', 'The completed research file could not be read safely.', array( 'status' => 422 ) ); }
		$lines = explode( "\n", $bytes );
		if ( count( $lines ) > self::MAX_LINES || array_filter( $lines, function ( $line ) { return strlen( $line ) > self::MAX_LINE_BYTES; } ) ) { return new WP_Error( 'mmps_research_shape', 'The completed research file is not in the expected compact format.', array( 'status' => 422 ) ); }
		if ( ! preg_match( '/^mission_token:\s*(MMRM1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\s*$/m', $bytes, $token_match ) ) { return new WP_Error( 'mmps_research_mission', 'Upload the completed research file, not the original mission.', array( 'status' => 422 ) ); }
		$verified = MMPS_Mission::verify_token( $token_match[1] );
		if ( is_wp_error( $verified ) ) { return $verified; }
		if ( (string) $verified['mission_uuid'] !== (string) $mission['mission_uuid'] || absint( $verified['user_id'] ) !== absint( $user_id ) ) { return new WP_Error( 'mmps_research_mission', 'This completed file belongs to a different research mission.', array( 'status' => 409 ) ); }
		if ( absint( $mission['submission_count'] ) >= MMPS_Mission::MAX_SUBMISSIONS || in_array( $mission['status'], array( 'CANCELLED','EXPIRED','SUPERSEDED','READY' ), true ) ) { return new WP_Error( 'mmps_research_closed', 'This research mission is no longer accepting files.', array( 'status' => 409 ) ); }
		$sha = hash( 'sha256', $bytes );
		$existing = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'research_artifacts' ) . ' WHERE mission_uuid=%s AND sha256=%s', $mission['mission_uuid'], $sha ), ARRAY_A );
		if ( $existing ) { $item = self::shape( $existing, false ); $item['alreadyReceived'] = true; return $item; }
		$bundle = MMPS_Evidence_Bundle::for_program( $mission['program_specialty_id'] ); if ( is_wp_error( $bundle ) ) { return $bundle; }
		$validation = self::validate_v2( $bytes, $bundle['program'], $mission );
		$status = empty( $validation['errors'] ) ? 'VALIDATED_PENDING_RISE_OWNER' : 'QUARANTINED_REJECTED';
		$qa_status = empty( $validation['errors'] ) ? 'MANUAL_CONTENT_SOURCE_REVIEW_REQUIRED' : 'NOT_RUN';
		$uuid = MMPS_Store::uuid(); $now = MMPS_Store::now(); $previous = $wpdb->suppress_errors( true );
		$ok = $wpdb->insert( MMPS_Install::table( 'research_artifacts' ), array(
			'artifact_uuid' => $uuid, 'user_id' => absint( $user_id ), 'root_id' => absint( $mission['root_id'] ),
			'program_specialty_id' => $mission['program_specialty_id'], 'acgme_id' => $mission['acgme_id'], 'program_name' => $mission['program_name'],
			'status' => $status, 'original_filename' => mb_substr( sanitize_file_name( $filename ?: 'MissionMed_Research_Complete_' . substr( $mission['mission_uuid'], 0, 8 ) . '.md' ), 0, 255 ),
			'byte_size' => $size, 'sha256' => $sha, 'validation_json' => wp_json_encode( $validation ), 'artifact_markdown' => $bytes,
			'mission_uuid' => $mission['mission_uuid'], 'channel' => sanitize_key( $channel ), 'schema_version' => self::SCHEMA_V2,
			'qa_status' => $qa_status, 'qa_json' => wp_json_encode( array( 'mode' => 'admin_manual_source_review', 'programOnly' => true ) ),
			'rise_status' => '', 'rise_ref' => '', 'rise_updated_at' => null, 'created_at' => $now, 'updated_at' => $now,
		) );
		$wpdb->suppress_errors( $previous );
		if ( ! $ok ) { return new WP_Error( 'mmps_research_store', 'The completed research file could not be stored.', array( 'status' => 500 ) ); }
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . MMPS_Install::table( 'research_missions' ) . ' SET submission_count=submission_count+1,status=%s,updated_at=%s,state_revision=state_revision+1 WHERE mission_uuid=%s', empty( $validation['errors'] ) ? 'RECEIVED' : 'NEEDS_FIX', $now, $mission['mission_uuid'] ) );
		if ( empty( $validation['errors'] ) ) { MMPS_Mission::revoke_return( $mission['mission_uuid'] ); }
		MMPS_Store::audit( $user_id, empty( $validation['errors'] ) ? 'research_received' : 'research_rejected', $uuid, array( 'missionId' => $mission['mission_uuid'], 'programSpecialtyId' => $mission['program_specialty_id'], 'status' => $status, 'sha256' => $sha, 'errorCodes' => wp_list_pluck( $validation['errors'], 'code' ), 'channel' => sanitize_key( $channel ) ) );
		return self::get( $user_id, $uuid, false );
	}

	public static function validate_v2( $markdown, $program, $mission ) {
		$errors = array(); $flags = array(); $add = function ( $code, $message ) use ( &$errors ) { $errors[] = array( 'code' => $code, 'message' => $message ); };
		$markdown = (string) $markdown;
		if ( preg_match( '/<\/?(?:script|iframe|object|embed|form|input|svg|style|link|meta)|<\?php|javascript:|vbscript:|data:|<!--|!\[[^\]]*\]\(/i', $markdown ) ) { $add( 'ACTIVE_CONTENT', 'The file contains active or remotely loaded content.' ); }
		if ( preg_match( '/\b(?:ignore|disregard|override)\b.{0,60}\b(?:instructions?|prompts?|system|developer)\b|\b(?:system|assistant|developer)\s+message\b/is', $markdown ) ) { $add( 'PROMPT_INJECTION_TEXT', 'Instruction-like text is not accepted as program evidence.' ); }
		if ( preg_match( '/\b(?:personal statement|ERAS\s*(?:id|number)|applicant(?:\'s)?\s+(?:name|email)|student(?:\'s)?\s+(?:name|email))\b|[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $markdown ) ) { $add( 'APPLICANT_DATA', 'Applicant or student-identifying content is prohibited.' ); }
		$front = self::frontmatter( $markdown );
		$expected = array( 'schema' => self::SCHEMA_V2, 'program_specialty_id' => (string) $mission['program_specialty_id'], 'acgme_id' => (string) $mission['acgme_id'], 'program_name' => (string) $mission['program_name'], 'specialty' => (string) $mission['specialty'], 'web_research_used' => 'yes' );
		foreach ( $expected as $key => $value ) { if ( (string) ( $front[ $key ] ?? '' ) !== $value ) { $add( 'IDENTITY_' . strtoupper( $key ), 'The completed file does not match this program mission.' ); } }
		if ( empty( $front['mission_token'] ) || is_wp_error( MMPS_Mission::verify_token( $front['mission_token'] ) ) ) { $add( 'MISSION_TOKEN', 'The mission reference is missing or invalid.' ); }
		if ( empty( $front['researched_at'] ) || ! self::valid_date( $front['researched_at'] ) || empty( $front['research_agent'] ) ) { $add( 'FRONTMATTER_INCOMPLETE', 'The research date and research-agent label are required.' ); }
		$coverage = array(); if ( preg_match( '/^## Domain coverage\s*\n(.*?)(?=^##\s|\z)/ms', $markdown, $coverage_block ) ) { foreach ( explode( "\n", trim( $coverage_block[1] ) ) as $line ) { if ( preg_match( '/^-\s*([a-z_]+):\s*([A-Z_]+)\s*$/', trim( $line ), $m ) ) { $coverage[ $m[1] ] = $m[2]; } } }
		$allowed_states = array( 'VERIFIED','PARTIALLY_VERIFIED','RESEARCHED_NOT_FOUND','EVIDENCE_FOUND_REVIEW_PENDING','CONFLICT','UNAVAILABLE','NOT_APPLICABLE' );
		$domain_map = MMPS_Mission::domain_map();
		foreach ( $domain_map as $domain => $field ) { if ( ! isset( $coverage[ $domain ] ) || ! in_array( $coverage[ $domain ], $allowed_states, true ) ) { $add( 'DOMAIN_' . strtoupper( $domain ), 'Every requested research domain needs one valid coverage state.' ); } }
		if ( array_diff( array_keys( $coverage ), array_keys( $domain_map ) ) ) { $add( 'DOMAIN_UNKNOWN', 'The completed file contains an unknown research domain.' ); }
		$facts = self::fact_blocks( $markdown );
		if ( count( $facts ) < 2 || count( $facts ) > 60 ) { $add( 'FACT_COUNT', 'Provide between 2 and 60 compact evidence records.' ); }
		$seen = array();
		foreach ( $facts as $index => &$fact ) {
			$prefix = 'FACT_' . ( $index + 1 ) . '_'; $domain = (string) ( $fact['domain'] ?? '' ); $field = (string) ( $fact['field'] ?? '' ); $claim = trim( (string) ( $fact['claim'] ?? '' ) ); $quote = trim( (string) ( $fact['quote'] ?? '' ), " \t\"'" ); $url = trim( (string) ( $fact['source_url'] ?? '' ) ); $type = strtoupper( trim( (string) ( $fact['source_type'] ?? '' ) ) ); $date = trim( (string) ( $fact['accessed_at'] ?? '' ) ); $qualifier = strtoupper( trim( (string) ( $fact['qualifier'] ?? 'NONE' ) ) );
			if ( (string) $fact['fact_id'] !== 'FACT-' . str_pad( (string) ( $index + 1 ), 3, '0', STR_PAD_LEFT ) ) { $add( $prefix . 'IDENTIFIER', 'Fact identifiers must be sequential.' ); }
			if ( ! isset( $domain_map[ $domain ] ) || $domain_map[ $domain ] !== $field ) { $add( $prefix . 'DOMAIN_FIELD', 'The fact domain and field do not match the MissionMed contract.' ); }
			if ( mb_strlen( $claim ) < 20 || mb_strlen( $claim ) > 600 || preg_match( '/\b(?:best|excellent|renowned|prestigious|world[- ]class|unparalleled|ideal|perfect fit)\b/i', $claim ) ) { $add( $prefix . 'CLAIM', 'Each claim must be source-faithful, concise and free of marketing language.' ); }
			if ( mb_strlen( $quote ) < 20 || mb_strlen( $quote ) > 240 || preg_match( '/[<>]/', $quote ) ) { $add( $prefix . 'QUOTE', 'Each fact needs a short plain-text supporting quote.' ); }
			$normalized = self::normalize_url( $url ); if ( is_wp_error( $normalized ) ) { $add( $prefix . 'SOURCE_URL', 'Each fact needs one safe exact HTTPS source URL.' ); $normalized = ''; }
			if ( ! in_array( $type, self::source_types_v2(), true ) ) { $add( $prefix . 'SOURCE_TYPE', 'The source type is not recognized.' ); }
			$host = strtolower( (string) parse_url( $normalized ?: $url, PHP_URL_HOST ) ); $authority = self::source_authority_v2( $host, $type, $program );
			if ( 'FAIL' === $authority ) { $add( $prefix . 'SOURCE_AUTHORITY', 'The source host does not match its claimed authority.' ); } elseif ( 'REVIEW' === $authority ) { $flags[] = array( 'code' => $prefix . 'SOURCE_AUTHORITY_REVIEW', 'factId' => $fact['fact_id'] ); }
			if ( ! self::valid_date( $date ) || strtotime( $date . ' 00:00:00 UTC' ) < strtotime( $mission['issued_at'] . ' UTC' ) - DAY_IN_SECONDS ) { $add( $prefix . 'ACCESS_DATE', 'The source access date must belong to this mission.' ); }
			if ( 'research.fellowship_inventory' === $field && ! in_array( $qualifier, array( 'IN_HOUSE','AFFILIATED','PLANNED','UNCLEAR' ), true ) ) { $add( $prefix . 'QUALIFIER', 'Fellowship evidence needs a relationship classification.' ); }
			if ( 'research.fellowship_inventory' !== $field && 'NONE' !== $qualifier ) { $add( $prefix . 'QUALIFIER', 'Only fellowship evidence uses a relationship qualifier.' ); }
			$key = hash( 'sha256', strtolower( $field . '|' . preg_replace( '/\s+/u', ' ', $claim ) . '|' . $normalized ) ); if ( isset( $seen[ $key ] ) ) { $add( $prefix . 'DUPLICATE', 'Duplicate evidence records are prohibited.' ); } $seen[ $key ] = true;
			$fact['normalized_source_url'] = $normalized;
		}
		unset( $fact );
		if ( ! preg_match( '/^## Self-QA\s*$/m', $markdown ) || ! preg_match( '/^-\s*no_applicant_information:\s*yes\s*$/mi', $markdown ) || ! preg_match( '/^-\s*fabricated_or_inferred_facts:\s*none\s*$/mi', $markdown ) ) { $add( 'SELF_QA', 'The required self-QA declaration is incomplete.' ); }
		return array( 'schema' => self::SCHEMA_V2, 'valid' => empty( $errors ), 'errors' => $errors, 'flags' => $flags, 'factCount' => count( $facts ), 'coverage' => $coverage, 'facts' => $facts );
	}

	protected static function frontmatter( $markdown ) { $front = array(); if ( preg_match( '/\A---\n(.*?)\n---\n/s', $markdown, $match ) ) { foreach ( explode( "\n", $match[1] ) as $line ) { if ( preg_match( '/^([a-z_]+):\s*(.*)$/', trim( $line ), $pair ) ) { $front[ $pair[1] ] = trim( $pair[2], " \t\"'" ); } } } return $front; }
	protected static function fact_blocks( $markdown ) { $facts = array(); if ( preg_match_all( '/^###\s+(FACT-[A-Z0-9_-]+)\s*\n(.*?)(?=^###\s+(?:FACT-|CONFLICT-)|^##\s|\z)/ms', $markdown, $blocks, PREG_SET_ORDER ) ) { foreach ( $blocks as $block ) { $row = array( 'fact_id' => $block[1] ); foreach ( explode( "\n", trim( $block[2] ) ) as $line ) { if ( preg_match( '/^-\s*([a-z_]+):\s*(.*)$/', trim( $line ), $pair ) ) { $row[ $pair[1] ] = trim( $pair[2] ); } } $facts[] = $row; } } return $facts; }
	protected static function normalize_url( $url ) { if ( strlen( $url ) > 500 || ! filter_var( $url, FILTER_VALIDATE_URL ) ) { return new WP_Error( 'url' ); } $parts = wp_parse_url( $url ); if ( ! is_array( $parts ) || 'https' !== strtolower( (string) ( $parts['scheme'] ?? '' ) ) || empty( $parts['host'] ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || isset( $parts['port'] ) || filter_var( $parts['host'], FILTER_VALIDATE_IP ) ) { return new WP_Error( 'url' ); } $host = strtolower( (string) $parts['host'] ); if ( preg_match( '/(?:^|\.)(?:reddit\.com|studentdoctor\.net|facebook\.com|instagram\.com|x\.com|twitter\.com)$/', $host ) ) { return new WP_Error( 'url' ); } $query = array(); if ( ! empty( $parts['query'] ) ) { parse_str( $parts['query'], $query ); foreach ( array_keys( $query ) as $key ) { if ( preg_match( '/^(?:utm_|fbclid$|gclid$)/i', $key ) ) { unset( $query[ $key ] ); } } } return 'https://' . $host . ( $parts['path'] ?? '/' ) . ( $query ? '?' . http_build_query( $query, '', '&', PHP_QUERY_RFC3986 ) : '' ); }
	protected static function source_authority_v2( $host, $type, $program ) { if ( 'ACGME_PUBLIC' === $type ) { return self::related_host( $host, 'acgme.org' ) ? 'PASS' : 'FAIL'; } if ( 'GOVERNMENT_PUBLIC' === $type ) { return preg_match( '/\.gov$/', $host ) ? 'PASS' : 'FAIL'; } if ( 'PUBLICATION_INDEX' === $type ) { return self::related_host( $host, 'pubmed.ncbi.nlm.nih.gov' ) ? 'PASS' : 'FAIL'; } if ( 'BOARD_OR_NATIONAL_BODY' === $type ) { foreach ( array( 'nrmp.org','aamc.org','ama-assn.org','abim.org','theabfm.org','abpn.org','absurgery.org','theaba.org','theabr.org','aobim.org' ) as $allowed ) { if ( self::related_host( $host, $allowed ) ) { return 'PASS'; } } return 'FAIL'; } if ( in_array( $type, array( 'PROGRAM_OFFICIAL','SPONSOR_OFFICIAL' ), true ) ) { return self::source_host_allowed( $host, $type, $program ) ? 'PASS' : 'REVIEW'; } return 'AFFILIATE_OFFICIAL' === $type ? 'REVIEW' : 'FAIL'; }

	protected static function related_host( $left, $right ) {
		$left  = strtolower( trim( (string) $left, ". \t\n\r\0\x0B" ) );
		$right = strtolower( trim( (string) $right, ". \t\n\r\0\x0B" ) );
		if ( '' === $left || '' === $right ) { return false; }
		$left_parent  = '.' . $right;
		$right_parent = '.' . $left;
		return $left === $right
			|| ( strlen( $left ) > strlen( $left_parent ) && 0 === substr_compare( $left, $left_parent, -strlen( $left_parent ) ) )
			|| ( strlen( $right ) > strlen( $right_parent ) && 0 === substr_compare( $right, $right_parent, -strlen( $right_parent ) ) );
	}

	/** A source label is accepted only when RISE identity can substantiate its host. */
	protected static function source_host_allowed( $host, $source_type, $program ) {
		if ( 'ACGME_PUBLIC' === $source_type ) {
			return self::related_host( $host, 'acgme.org' );
		}
		$official_host = strtolower( (string) parse_url( (string) ( $program['officialUrl'] ?? '' ), PHP_URL_HOST ) );
		return in_array( $source_type, array( 'PROGRAM_OFFICIAL', 'SPONSOR_OFFICIAL' ), true ) && self::related_host( $host, $official_host );
	}

	public static function upload( $user_id, $root_id, $program, $file ) {
		global $wpdb;
		MMPS_Install::maybe_install();
		if ( ! is_array( $file ) || UPLOAD_ERR_OK !== absint( $file['error'] ?? UPLOAD_ERR_NO_FILE ) ) {
			return new WP_Error( 'mmps_research_upload', 'Choose one Markdown evidence file.', array( 'status' => 422 ) );
		}
		$name = sanitize_file_name( (string) ( $file['name'] ?? '' ) );
		$size = absint( $file['size'] ?? 0 );
		$type = strtolower( trim( (string) ( $file['type'] ?? '' ) ) );
		if ( 'md' !== strtolower( pathinfo( $name, PATHINFO_EXTENSION ) ) ) {
			return new WP_Error( 'mmps_research_extension', 'The evidence artifact must be a .md file.', array( 'status' => 415 ) );
		}
		if ( $size < self::MIN_BYTES || $size > self::MAX_BYTES ) {
			return new WP_Error( 'mmps_research_size', 'The Markdown artifact must be between 400 bytes and 256 KB.', array( 'status' => 413 ) );
		}
		if ( $type && ! in_array( $type, array( 'text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream' ), true ) ) {
			return new WP_Error( 'mmps_research_type', 'The upload does not appear to be Markdown text.', array( 'status' => 415 ) );
		}
		$tmp = (string) ( $file['tmp_name'] ?? '' );
		if ( ! is_readable( $tmp ) ) {
			return new WP_Error( 'mmps_research_unreadable', 'The uploaded artifact could not be read.', array( 'status' => 422 ) );
		}
		$markdown = file_get_contents( $tmp );
		if ( ! is_string( $markdown ) || strlen( $markdown ) !== $size ) {
			return new WP_Error( 'mmps_research_read', 'The uploaded artifact did not pass the byte-count check.', array( 'status' => 422 ) );
		}
		$validation = self::validate( $markdown, $program );
		$status     = empty( $validation['errors'] ) ? 'VALIDATED_PENDING_RISE_OWNER' : 'QUARANTINED_REJECTED';
		$uuid       = MMPS_Store::uuid();
		$now        = MMPS_Store::now();
		$previous   = $wpdb->suppress_errors( true ); // Quarantined text must never be copied into an error log.
		$ok         = $wpdb->insert(
			MMPS_Install::table( 'research_artifacts' ),
			array(
				'artifact_uuid'        => $uuid,
				'user_id'              => absint( $user_id ),
				'root_id'              => absint( $root_id ),
				'program_specialty_id' => (string) $program['programSpecialtyId'],
				'acgme_id'              => (string) ( $program['acgmeId'] ?? '' ),
				'program_name'          => mb_substr( (string) ( $program['programName'] ?? $program['institution'] ?? '' ), 0, 255 ),
				'status'                => $status,
				'original_filename'     => mb_substr( $name, 0, 255 ),
				'byte_size'             => strlen( $markdown ),
				'sha256'                => hash( 'sha256', $markdown ),
				'validation_json'       => wp_json_encode( $validation ),
				'artifact_markdown'     => $markdown,
				'created_at'            => $now,
				'updated_at'            => $now,
			)
		);
		$wpdb->suppress_errors( $previous );
		if ( ! $ok ) {
			return new WP_Error( 'mmps_research_store', 'The quarantined artifact could not be stored.', array( 'status' => 500 ) );
		}
		MMPS_Store::audit( $user_id, 'research_upload', $uuid, array( 'programSpecialtyId' => $program['programSpecialtyId'], 'status' => $status, 'sha256' => hash( 'sha256', $markdown ), 'errorCodes' => wp_list_pluck( $validation['errors'], 'code' ) ) );
		return self::get( $user_id, $uuid, false );
	}

	public static function validate( $markdown, $program ) {
		$markdown = preg_replace( "/\r\n?|\xEF\xBB\xBF/", "\n", (string) $markdown );
		$errors   = array();
		$warn     = array();
		$add      = function ( $code, $message ) use ( &$errors ) { $errors[] = array( 'code' => $code, 'message' => $message ); };
		if ( ! mb_check_encoding( $markdown, 'UTF-8' ) || false !== strpos( $markdown, "\0" ) ) {
			$add( 'INVALID_TEXT_ENCODING', 'The artifact must be valid UTF-8 text without null bytes.' );
		}
		if ( preg_match( '/<\/?(?:script|iframe|object|embed|form|input)|<\?php|javascript:/i', $markdown ) ) {
			$add( 'ACTIVE_CONTENT', 'HTML, scripts and executable content are prohibited.' );
		}
		if ( preg_match( '/\b(?:ignore|disregard|override)\b.{0,60}\b(?:instructions?|prompts?|system|developer)\b|\b(?:system|assistant|developer)\s+message\b/is', $markdown ) ) {
			$add( 'PROMPT_INJECTION_TEXT', 'Instruction-like or prompt-injection text is prohibited.' );
		}
		if ( preg_match( '/\b(?:personal statement|ERAS\s*(?:id|number)|applicant(?:\'s)?\s+(?:name|email)|student(?:\'s)?\s+(?:name|email))\b|[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $markdown ) ) {
			$add( 'APPLICANT_DATA', 'Applicant or student-identifying content is prohibited.' );
		}

		$front = array();
		if ( preg_match( '/\A---\n(.*?)\n---\n/s', $markdown, $match ) ) {
			foreach ( explode( "\n", $match[1] ) as $line ) {
				if ( preg_match( '/^([a-z_]+):\s*(.*)$/', trim( $line ), $pair ) ) {
					$front[ $pair[1] ] = trim( $pair[2], " \t\"'" );
				}
			}
		} else {
			$add( 'FRONTMATTER_MISSING', 'The required YAML frontmatter is missing.' );
		}
		$expected = array(
			'schema'                 => self::SCHEMA,
			'program_specialty_id'   => (string) ( $program['programSpecialtyId'] ?? '' ),
			'acgme_id'               => (string) ( $program['acgmeId'] ?? '' ),
			'program_name'           => (string) ( $program['programName'] ?? $program['institution'] ?? '' ),
		);
		foreach ( $expected as $key => $value ) {
			if ( '' !== $value && (string) ( $front[ $key ] ?? '' ) !== $value ) {
				$add( 'IDENTITY_' . strtoupper( $key ), 'The ' . $key . ' does not match the current RISE program identity.' );
			}
		}
		if ( empty( $front['researched_at'] ) || ! self::valid_date( $front['researched_at'] ?? '' ) || empty( $front['research_agent'] ) ) {
			$add( 'FRONTMATTER_INCOMPLETE', 'A valid researched_at date and research_agent identifier are required.' );
		}

		$facts = array();
		if ( preg_match_all( '/^###\s+(FACT-[A-Z0-9_-]+)\s*\n(.*?)(?=^###\s+FACT-|\z)/ms', $markdown, $blocks, PREG_SET_ORDER ) ) {
			foreach ( $blocks as $block ) {
				$row = array( 'fact_id' => $block[1] );
				foreach ( explode( "\n", trim( $block[2] ) ) as $line ) {
					if ( preg_match( '/^-\s*([a-z_]+):\s*(.*)$/', trim( $line ), $pair ) ) {
						$row[ $pair[1] ] = trim( $pair[2] );
					}
				}
				$facts[] = $row;
			}
		}
		if ( count( $facts ) < 2 || count( $facts ) > 30 ) {
			$add( 'FACT_COUNT', 'Provide between 2 and 30 structured evidence records.' );
		}
		$seen = array();
		$seen_ids = array();
		foreach ( $facts as $index => $fact ) {
			$prefix = 'FACT_' . ( $index + 1 ) . '_';
			$field  = (string) ( $fact['field'] ?? '' );
			$claim  = trim( (string) ( $fact['claim'] ?? '' ) );
			$url    = trim( (string) ( $fact['source_url'] ?? '' ) );
			$stype  = strtoupper( trim( (string) ( $fact['source_type'] ?? '' ) ) );
			$date   = trim( (string) ( $fact['accessed_at'] ?? '' ) );
			if ( isset( $seen_ids[ $fact['fact_id'] ] ) || 'FACT-' . str_pad( (string) ( $index + 1 ), 3, '0', STR_PAD_LEFT ) !== $fact['fact_id'] ) { $add( $prefix . 'IDENTIFIER', 'Fact identifiers must be unique and sequential (FACT-001, FACT-002, ...).' ); }
			$seen_ids[ $fact['fact_id'] ] = true;
			if ( ! in_array( $field, self::fields(), true ) ) { $add( $prefix . 'FIELD', 'Unknown or prohibited evidence field.' ); }
			if ( mb_strlen( $claim ) < 20 || mb_strlen( $claim ) > 600 ) { $add( $prefix . 'CLAIM_LENGTH', 'Claim text must be 20–600 characters.' ); }
			if ( preg_match( '/\b(?:best|excellent|renowned|prestigious|world[- ]class|unparalleled|ideal|perfect fit)\b/i', $claim ) ) { $add( $prefix . 'MARKETING', 'Marketing or praise language is prohibited.' ); }
			if ( ! filter_var( $url, FILTER_VALIDATE_URL ) || 'https' !== strtolower( (string) parse_url( $url, PHP_URL_SCHEME ) ) ) { $add( $prefix . 'SOURCE_URL', 'Every fact needs one valid HTTPS source URL.' ); }
			$host = strtolower( (string) parse_url( $url, PHP_URL_HOST ) );
			if ( preg_match( '/(?:^|\.)(?:reddit\.com|studentdoctor\.net|facebook\.com|instagram\.com|x\.com|twitter\.com)$/', $host ) ) { $add( $prefix . 'SOURCE_BLOCKED', 'Forums and social platforms are not accepted sources.' ); }
			if ( ! in_array( $stype, self::source_types(), true ) ) { $add( $prefix . 'SOURCE_TYPE', 'source_type must be PROGRAM_OFFICIAL, SPONSOR_OFFICIAL or ACGME_PUBLIC.' ); }
			elseif ( ! self::source_host_allowed( $host, $stype, $program ) ) { $add( $prefix . 'SOURCE_AUTHORITY_UNVERIFIED', 'The claimed source authority does not match the current RISE official program domain or ACGME public domain.' ); }
			if ( ! self::valid_date( $date ) ) { $add( $prefix . 'ACCESS_DATE', 'Every fact needs a valid accessed_at date.' ); }
			$key = hash( 'sha256', strtolower( $field . '|' . preg_replace( '/\s+/u', ' ', $claim ) . '|' . $url ) );
			if ( isset( $seen[ $key ] ) ) { $add( $prefix . 'DUPLICATE', 'Duplicate evidence records are prohibited.' ); }
			$seen[ $key ] = true;
		}
		if ( ! preg_match( '/^#\s+MissionMed Program Research Evidence\s*$/m', $markdown ) ) {
			$add( 'TITLE_MISSING', 'The canonical MissionMed evidence title is required.' );
		}
		return array(
			'schema'       => self::SCHEMA,
			'valid'        => empty( $errors ),
			'errors'       => $errors,
			'warnings'     => $warn,
			'factCount'    => count( $facts ),
			'fields'       => array_values( array_unique( array_filter( wp_list_pluck( $facts, 'field' ) ) ) ),
			'sourceHosts'  => array_values( array_unique( array_filter( array_map( function ( $fact ) { return strtolower( (string) parse_url( (string) ( $fact['source_url'] ?? '' ), PHP_URL_HOST ) ); }, $facts ) ) ) ),
		);
	}

	protected static function valid_date( $date ) {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $date ) ) {
			return false;
		}
		$stamp = strtotime( $date . ' 00:00:00 UTC' );
		return false !== $stamp && $stamp <= time() + DAY_IN_SECONDS && $stamp >= time() - ( 400 * DAY_IN_SECONDS );
	}

	public static function list_for_program( $user_id, $program_id ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'research_artifacts' ) . ' WHERE user_id=%d AND program_specialty_id=%s ORDER BY id DESC LIMIT 20', absint( $user_id ), (string) $program_id ), ARRAY_A );
		return array_map( function ( $row ) { return self::shape( $row, false ); }, (array) $rows );
	}

	public static function get( $user_id, $uuid, $with_markdown ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'research_artifacts' ) . ' WHERE artifact_uuid=%s AND user_id=%d', (string) $uuid, absint( $user_id ) ), ARRAY_A );
		return $row ? self::shape( $row, $with_markdown ) : null;
	}

	/** Admin-only lookup. Callers must enforce manage_options. */
	public static function get_admin( $uuid, $with_markdown = false ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'research_artifacts' ) . ' WHERE artifact_uuid=%s', (string) $uuid ), ARRAY_A );
		return $row ? self::shape( $row, $with_markdown ) : null;
	}

	/**
	 * Day-one content/source QA is an explicit human owner decision. The raw
	 * artifact stays quarantined; only the resulting state and reason are audited.
	 */
	public static function admin_qa( $admin_id, $uuid, $decision, $note = '' ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'research_artifacts' ) . ' WHERE artifact_uuid=%s', (string) $uuid ), ARRAY_A );
		if ( ! $row ) { return new WP_Error( 'mmps_research_not_found', 'That research artifact was not found.', array( 'status' => 404 ) ); }
		$validation = json_decode( (string) $row['validation_json'], true ) ?: array();
		if ( empty( $validation['valid'] ) ) { return new WP_Error( 'mmps_research_invalid', 'A deterministically rejected artifact cannot pass content review.', array( 'status' => 409 ) ); }
		$decision = strtoupper( sanitize_key( (string) $decision ) );
		if ( ! in_array( $decision, array( 'PASS', 'FAIL' ), true ) ) { return new WP_Error( 'mmps_research_qa', 'Choose Pass or Fail.', array( 'status' => 422 ) ); }
		$note = mb_substr( sanitize_textarea_field( (string) $note ), 0, 500 );
		if ( 'FAIL' === $decision && '' === trim( $note ) ) { return new WP_Error( 'mmps_research_qa_note', 'A short reason is required when review fails.', array( 'status' => 422 ) ); }
		$now = MMPS_Store::now();
		$qa_status = 'PASS' === $decision ? 'QA_PASSED' : 'QA_FAILED';
		$status = 'PASS' === $decision ? 'READY_FOR_RISE_OWNER' : 'QUARANTINED_REJECTED';
		$wpdb->update( MMPS_Install::table( 'research_artifacts' ), array(
			'status' => $status, 'qa_status' => $qa_status,
			'qa_json' => wp_json_encode( array( 'mode' => 'admin_manual_source_review', 'reviewedBy' => absint( $admin_id ), 'reviewedAt' => $now, 'note' => $note ) ),
			'updated_at' => $now,
		), array( 'artifact_uuid' => $uuid ) );
		if ( ! empty( $row['mission_uuid'] ) ) { MMPS_Mission::set_status( $row['mission_uuid'], 'PASS' === $decision ? 'VERIFYING' : 'NEEDS_FIX', 'PASS' === $decision ? $uuid : '' ); }
		MMPS_Store::audit( $admin_id, 'research_qa_' . strtolower( $decision ), $uuid, array( 'missionId' => $row['mission_uuid'], 'programSpecialtyId' => $row['program_specialty_id'], 'factCount' => absint( $validation['factCount'] ?? 0 ) ) );
		return self::get_admin( $uuid, false );
	}

	/** Build the narrow, program-only handoff package for an authorized RISE owner. */
	public static function handoff_package( $uuid ) {
		$item = self::get_admin( $uuid, true );
		if ( ! $item ) { return new WP_Error( 'mmps_research_not_found', 'That research artifact was not found.', array( 'status' => 404 ) ); }
		if ( 'QA_PASSED' !== $item['qaStatus'] ) { return new WP_Error( 'mmps_research_not_reviewed', 'Pass content and source review before creating a RISE handoff.', array( 'status' => 409 ) ); }
		$validation = $item['validation'];
		$facts = array_map( function ( $fact ) {
			return array(
				'fact_id' => (string) ( $fact['fact_id'] ?? '' ), 'field' => (string) ( $fact['field'] ?? '' ),
				'claim' => (string) ( $fact['claim'] ?? '' ), 'quote' => (string) ( $fact['quote'] ?? '' ),
				'source_url' => (string) ( $fact['normalized_source_url'] ?? $fact['source_url'] ?? '' ),
				'source_title' => (string) ( $fact['source_title'] ?? '' ), 'source_type' => (string) ( $fact['source_type'] ?? '' ),
				'accessed_at' => (string) ( $fact['accessed_at'] ?? '' ), 'as_of' => (string) ( $fact['as_of'] ?? '' ),
				'qualifier' => (string) ( $fact['qualifier'] ?? 'NONE' ), 'corroboration_url' => (string) ( $fact['corroboration_url'] ?? 'none' ),
			);
		}, (array) ( $validation['facts'] ?? array() ) );
		return array(
			'schema' => 'missionmed.rise.research-ingest.v1', 'campaign_id' => 'psv-drb:' . $item['missionId'],
			'program_specialty_id' => $item['programSpecialtyId'], 'acgme_id' => $item['acgmeId'], 'program_name' => $item['programName'],
			'artifact_sha256' => $item['sha256'], 'source_schema' => $item['schemaVersion'], 'staged_at' => MMPS_Store::now(),
			'safe_facts' => $facts, 'needs_review' => (array) ( $validation['flags'] ?? array() ),
			'source_result' => array( 'deterministic' => 'PASS', 'contentSourceQa' => 'PASS', 'factCount' => count( $facts ) ),
		);
	}

	/** Record only the external owner outcome; PSV never writes RISE itself. */
	public static function mark_rise_status( $admin_id, $uuid, $status, $reference = '' ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . MMPS_Install::table( 'research_artifacts' ) . ' WHERE artifact_uuid=%s', (string) $uuid ), ARRAY_A );
		if ( ! $row ) { return new WP_Error( 'mmps_research_not_found', 'That research artifact was not found.', array( 'status' => 404 ) ); }
		$status = strtoupper( sanitize_key( (string) $status ) );
		if ( ! in_array( $status, array( 'RISE_SUBMITTED', 'RISE_PUBLISHED', 'RISE_PARTIAL', 'RISE_DECLINED' ), true ) ) { return new WP_Error( 'mmps_rise_status', 'The RISE owner status is not recognized.', array( 'status' => 422 ) ); }
		if ( 'QA_PASSED' !== $row['qa_status'] && 'RISE_DECLINED' !== $status ) { return new WP_Error( 'mmps_research_not_reviewed', 'Only a QA-passed artifact can enter RISE-owner intake.', array( 'status' => 409 ) ); }
		$reference = mb_substr( sanitize_text_field( (string) $reference ), 0, 191 ); $now = MMPS_Store::now();
		$wpdb->update( MMPS_Install::table( 'research_artifacts' ), array( 'rise_status' => $status, 'rise_ref' => $reference, 'rise_updated_at' => $now, 'updated_at' => $now ), array( 'artifact_uuid' => $uuid ) );
		if ( ! empty( $row['mission_uuid'] ) ) { MMPS_Mission::set_status( $row['mission_uuid'], 'RISE_DECLINED' === $status ? 'CLOSED_NO_DEEP' : 'VERIFYING', $uuid ); }
		MMPS_Store::audit( $admin_id, 'research_rise_status', $uuid, array( 'missionId' => $row['mission_uuid'], 'programSpecialtyId' => $row['program_specialty_id'], 'status' => $status, 'reference' => $reference ) );
		return self::get_admin( $uuid, false );
	}

	protected static function shape( $row, $with_markdown ) {
		$out = array(
			'artifactUuid'       => $row['artifact_uuid'],
			'rootId'             => absint( $row['root_id'] ),
			'programSpecialtyId' => $row['program_specialty_id'],
			'acgmeId'            => $row['acgme_id'],
			'programName'        => $row['program_name'],
			'status'             => $row['status'],
			'fileName'           => $row['original_filename'],
			'byteSize'           => absint( $row['byte_size'] ),
			'sha256'             => $row['sha256'],
			'validation'         => json_decode( (string) $row['validation_json'], true ) ?: array(),
			'missionId'          => (string) ( $row['mission_uuid'] ?? '' ),
			'channel'            => (string) ( $row['channel'] ?? 'LEGACY_UPLOAD' ),
			'schemaVersion'      => (string) ( $row['schema_version'] ?? self::SCHEMA ),
			'qaStatus'           => (string) ( $row['qa_status'] ?? '' ),
			'riseStatus'         => (string) ( $row['rise_status'] ?? '' ),
			'riseRef'            => (string) ( $row['rise_ref'] ?? '' ),
			'createdAt'          => $row['created_at'],
		);
		if ( $with_markdown ) { $out['markdown'] = $row['artifact_markdown']; }
		return $out;
	}
}

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
	const MAX_BYTES = 262144;
	const MIN_BYTES = 400;

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

	protected static function related_host( $left, $right ) {
		$left  = strtolower( trim( (string) $left, ". \t\n\r\0\x0B" ) );
		$right = strtolower( trim( (string) $right, ". \t\n\r\0\x0B" ) );
		if ( '' === $left || '' === $right ) { return false; }
		return $left === $right || str_ends_with( $left, '.' . $right ) || str_ends_with( $right, '.' . $left );
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
			'createdAt'          => $row['created_at'],
		);
		if ( $with_markdown ) { $out['markdown'] = $row['artifact_markdown']; }
		return $out;
	}
}

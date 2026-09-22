<?php
/**
 * ProgramEvidenceBundle v1: the versioned contract between RISE (provider,
 * authority) and File Vault Program-Specific PS (consumer). This class is the
 * consumer-side projection over the current transport. Its OUTPUT shape is the
 * contract; how the data is fetched is replaceable (see MMPS_Rise_Client).
 *
 * Privacy and rights rules enforced here, before anything is stored or sent on:
 *  - student notes returned by RISE's list route are dropped immediately;
 *  - pending evidence, domain statuses, rosters, composition, visa,
 *    application requirements and student-specific research fields are never read;
 *  - peer-written evidence (provider STUDENT_INTEL) is excluded;
 *  - terminal "not found / not public / stale / conflict" envelopes are excluded;
 *  - rows written in the second person are excluded;
 *  - nothing without an https source is eligible for prose.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Evidence_Bundle {

	const SCHEMA      = 'missionmed.rise.program-evidence-bundle.v1';
	const CACHE_TTL   = 600;
	const STALE_DAYS  = 365;
	const FRESH_DAYS  = 120;

	/** RISE research fields that may become prose facts, with the row keys RISE's own client uses. */
	protected static function deep_fields() {
		return array(
			'research.program_differentiators'        => array( 'cat' => 'differentiator', 'keys' => array( 'differentiators', 'items', 'reasons', 'features' ) ),
			'research.fellowship_inventory'           => array( 'cat' => 'fellowship', 'keys' => array( 'fellowships', 'inventory', 'programs' ) ),
			'research.curriculum'                     => array( 'cat' => 'curriculum', 'keys' => array( 'curriculum', 'tracks', 'rotations', 'electives', 'items' ) ),
			'research.research_opportunities'         => array( 'cat' => 'research', 'keys' => array( 'opportunities', 'research', 'projects', 'items' ) ),
			'research.facilities_patient_population'  => array( 'cat' => 'population', 'keys' => array( 'facilities', 'sites', 'populations', 'items' ) ),
			'research.culture'                        => array( 'cat' => 'mission', 'keys' => array( 'items', 'culture' ) ),
		);
	}

	/* ---------------- list and search (identity only) ---------------- */

	public static function my_list() {
		$data = MMPS_Rise_Client::get( '/api/rise/v1/me/programs' );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$out = array();
		foreach ( (array) ( $data['records'] ?? array() ) as $record ) {
			// Student notes are private to RISE. They are never copied, stored or returned.
			$out[] = array(
				'programSpecialtyId' => (string) ( $record['programSpecialtyId'] ?? '' ),
				'state'              => (string) ( $record['state'] ?? '' ),
				'goldStarred'        => ! empty( $record['goldStarred'] ),
				'priorityPosition'   => isset( $record['priorityPosition'] ) ? (int) $record['priorityPosition'] : null,
			);
		}
		return $out;
	}

	public static function search( $q, $page_size = 12, $specialty = '', $state = '' ) {
		$query = array(
			'q'               => (string) $q,
			'pageSize'        => min( 24, max( 1, (int) $page_size ) ),
			'sort'            => 'name',
			'includeCombined' => 'false',
		);
		if ( '' !== trim( (string) $specialty ) ) {
			$query['specialty'] = trim( (string) $specialty );
		}
		if ( preg_match( '/^[A-Z]{2}$/', (string) $state ) ) {
			$query['jurisdiction'] = (string) $state;
		}
		$data = MMPS_Rise_Client::get( '/api/rise/v1/programs', $query );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$out = array();
		foreach ( (array) ( $data['records'] ?? $data['results'] ?? array() ) as $record ) {
			$identity = self::identity_from_record( $record );
			// RISE owns identity and filtering, but PSV independently fails closed
			// if an upstream response drifts or contains an ambiguous offering.
			if ( '' === $identity['programSpecialtyId'] || '' === $identity['designation'] ) {
				continue;
			}
			if ( '' !== trim( (string) $specialty ) && $identity['designation'] !== trim( (string) $specialty ) ) {
				continue;
			}
			if ( preg_match( '/^[A-Z]{2}$/', (string) $state ) && strtoupper( $identity['state'] ) !== (string) $state ) {
				continue;
			}
			$out[] = $identity;
		}
		return $out;
	}

	protected static function identity_from_record( $record ) {
		$display = (array) ( $record['display'] ?? array() );
		$fields  = (array) ( $record['fields'] ?? array() );
		$acgme   = '';
		foreach ( (array) ( $record['identifiers'] ?? array() ) as $identifier ) {
			if ( 'ACGME_PROGRAM' === ( $identifier['namespace'] ?? '' ) ) {
				$acgme = (string) $identifier['value'];
			}
		}
		$training_types = array();
		foreach ( (array) ( $record['tracks'] ?? array() ) as $track ) {
			$type = self::clean( $track['programType'] ?? '' );
			if ( '' !== $type ) { $training_types[] = $type; }
		}
		foreach ( array( $display['trainingType'] ?? '', $display['programType'] ?? '', $record['trainingType'] ?? '', $record['programType'] ?? '', self::known( $fields, 'Program Type' ) ) as $type ) {
			$type = is_scalar( $type ) ? self::clean( $type ) : '';
			if ( '' !== $type ) { $training_types[] = $type; }
		}
		$training_types = array_values( array_unique( $training_types ) );
		return array(
			'programSpecialtyId' => (string) ( $record['programSpecialtyId'] ?? '' ),
			'acgmeId'            => $acgme,
			'programName'        => self::clean( $display['programName'] ?? '' ),
			'institution'        => self::clean( $display['institution'] ?? '' ),
			'hospital'           => self::clean( $display['hospital'] ?? '' ),
			'city'               => self::clean( $display['city'] ?? '' ),
			'state'              => self::clean( $display['state'] ?? '' ),
			'designation'        => self::clean( $record['designation'] ?? '' ),
			'trainingType'       => 1 === count( $training_types ) ? $training_types[0] : '',
			'trainingTypes'      => $training_types,
		);
	}

	/* ---------------- the bundle ---------------- */

	public static function for_program( $program_specialty_id ) {
		$program_specialty_id = (string) $program_specialty_id;
		if ( '' === $program_specialty_id || strlen( $program_specialty_id ) > 190 ) {
			return new WP_Error( 'mmps_program_id', 'Missing program id.', array( 'status' => 422 ) );
		}
		$cache_key = 'mmps_bundle_' . md5( $program_specialty_id );
		$cached    = get_transient( $cache_key );          // Program data only; nothing user-specific is cached.
		if ( is_array( $cached ) && ( $cached['schema'] ?? '' ) === self::SCHEMA ) {
			return $cached;
		}
		$detail = MMPS_Rise_Client::get( '/api/rise/v1/program-specialties/' . rawurlencode( $program_specialty_id ) );
		if ( is_wp_error( $detail ) ) {
			return $detail;
		}
		$bundle = self::project( $detail );
		set_transient( $cache_key, $bundle, self::CACHE_TTL );
		return $bundle;
	}

	public static function project( $detail, $now = null ) {
		$now      = $now ? (int) $now : time();
		$record   = (array) ( $detail['program'] ?? array() );
		$research = (array) ( $detail['research'] ?? array() );
		$identity = self::identity_from_record( $record );
		$fields   = (array) ( $record['fields'] ?? array() );
		$source   = (array) ( $record['source'] ?? array() );

		$identity['officialUrl'] = self::https_or_empty( self::known( $fields, 'Program Website' ) );
		$registry_prov = array(
			'origin'      => 'RISE_REGISTRY',
			'authority'   => (string) ( $source['authority'] ?? '' ),
			'retrievedAt' => (string) ( $source['retrievedAt'] ?? '' ),
			'ageDays'     => self::age_days( $source['retrievedAt'] ?? '', $now ),
		);

		/* Essential ingredients: identity facts, each with provenance. Absent means absent. */
		$essential = array();
		$name      = $identity['programName'] ? $identity['programName'] : $identity['institution'];
		$essential['programName'] = self::fact( 'essential.programName', 'identity', 'Program name', $name, 'The program is ' . $name . ( $identity['institution'] && $identity['institution'] !== $name ? ' at ' . $identity['institution'] : '' ) . '.', $registry_prov );
		if ( $identity['city'] || $identity['state'] ) {
			$place = trim( $identity['city'] . ( $identity['city'] && $identity['state'] ? ', ' : '' ) . $identity['state'] );
			$essential['location'] = self::fact( 'essential.location', 'identity', 'Location', $place, 'The program is located in ' . $place . '.', $registry_prov );
		}
		$type = self::known( $fields, 'Program Best Described As' );
		if ( is_string( $type ) && '' !== trim( $type ) ) {
			$prov = self::claim_provenance( $fields['Program Best Described As'], $registry_prov, $now );
			$prov['rightsNote'] = 'REGISTRY_SURVEY_FIELD';
			$essential['programType'] = self::fact( 'essential.programType', 'identity', 'Program type', self::clean( $type ), 'The program describes its setting as: ' . self::clean( $type ) . '.', $prov );
		}
		$director = self::program_director( $fields, $research, $registry_prov, $now );
		if ( $director ) {
			$essential['programDirector'] = $director;
		}

		/* Deep facts from approved research, with exclusions recorded by code. */
		$deep       = array();
		$exclusions = array();
		$by_field   = array();
		foreach ( (array) ( $research['currentFacts'] ?? array() ) as $fact ) {
			$field = (string) ( $fact['field'] ?? '' );
			if ( ! isset( $by_field[ $field ] ) ) {
				$by_field[ $field ] = $fact; // RISE orders newest first within a field; keep the first seen.
			}
		}
		foreach ( self::deep_fields() as $field => $spec ) {
			if ( ! isset( $by_field[ $field ] ) ) {
				continue;
			}
			$fact = $by_field[ $field ];
			if ( 'STUDENT_INTEL' === strtoupper( (string) ( $fact['provider'] ?? '' ) ) ) {
				$exclusions[] = array( 'field' => $field, 'code' => 'PEER_SOURCE' );
				continue;
			}
			$value = array_key_exists( 'canonicalValue', $fact ) && null !== $fact['canonicalValue'] ? $fact['canonicalValue'] : ( $fact['knowledge']['value'] ?? null );
			if ( self::is_terminal_envelope( $value ) ) {
				$exclusions[] = array( 'field' => $field, 'code' => 'TERMINAL_STATE', 'state' => strtoupper( (string) ( $value['state'] ?? '' ) ) );
				continue;
			}
			$fact_urls = self::https_list( array_merge( (array) ( $fact['sourceUrls'] ?? array() ), array( $fact['sourceUrl'] ?? '' ) ) );
			foreach ( self::rows( $value, $spec['keys'] ) as $row ) {
				$item = self::deep_item( $field, $spec['cat'], $row, $fact, $fact_urls, $now );
				if ( isset( $item['code'] ) ) {
					$exclusions[] = $item;
				} else {
					$deep[ $item['factId'] ] = $item;
				}
			}
		}
		$deep = array_values( $deep );

		$fields_with_facts = array_values( array_unique( array_map( function ( $f ) {
			return $f['field'];
		}, $deep ) ) );
		$quality = array(
			'deepEligibleCount' => count( $deep ),
			'deepFields'        => $fields_with_facts,
			'deepSupported'     => count( $deep ) >= 2,
			'label'             => count( $deep ) >= 2 ? 'DEEP_READY' : ( count( $deep ) === 1 ? 'ONE_DEEP_FACT' : 'ESSENTIAL_ONLY' ),
			'excludedCount'     => count( $exclusions ),
		);

		$bundle = array(
			'schema'            => self::SCHEMA,
			'registryReleaseId' => (string) ( $detail['registryReleaseId'] ?? '' ),
			'generatedAt'       => gmdate( 'c', $now ),
			'transport'         => MMPS_Rise_Client::TRANSPORT,
			'program'           => $identity,
			'nameForms'         => self::name_forms( $identity ),
			'essential'         => $essential,
			'deepFacts'         => $deep,
			'exclusions'        => $exclusions,
			'evidenceQuality'   => $quality,
		);
		$bundle['bundleSha256'] = hash( 'sha256', wp_json_encode( array( $bundle['program'], $bundle['essential'], $bundle['deepFacts'] ) ) );
		return $bundle;
	}

	/* ---------------- helpers ---------------- */

	protected static function fact( $key, $category, $label, $value, $text, $provenance ) {
		return array(
			'factId'     => 'F-' . substr( hash( 'sha256', $key . '|' . wp_json_encode( $value ) ), 0, 12 ),
			'category'   => $category,
			'label'      => $label,
			'value'      => $value,
			'text'       => $text,
			'provenance' => $provenance,
		);
	}

	protected static function claim_provenance( $claim, $fallback, $now ) {
		$retrieved = (string) ( $claim['retrievedAt'] ?? $fallback['retrievedAt'] );
		return array(
			'origin'           => 'RISE_REGISTRY',
			'claimId'          => (string) ( $claim['claimId'] ?? '' ),
			'contentSha256'    => (string) ( $claim['contentSha256'] ?? '' ),
			'authority'        => (string) ( $claim['authority'] ?? $fallback['authority'] ),
			'sourceUrl'        => self::https_or_empty( $claim['sourceUrl'] ?? '' ),
			'retrievedAt'      => $retrieved,
			'ageDays'          => self::age_days( $retrieved, $now ),
		);
	}

	/** A named person needs current evidence: research leadership first, registry second, otherwise absent. */
	protected static function program_director( $fields, $research, $registry_prov, $now ) {
		foreach ( (array) ( $research['currentFacts'] ?? array() ) as $fact ) {
			if ( 'research.leadership' !== ( $fact['field'] ?? '' ) || 'STUDENT_INTEL' === strtoupper( (string) ( $fact['provider'] ?? '' ) ) ) {
				continue;
			}
			$value = $fact['canonicalValue'] ?? ( $fact['knowledge']['value'] ?? null );
			if ( self::is_terminal_envelope( $value ) ) {
				continue;
			}
			foreach ( self::rows( $value, array( 'leadership', 'people', 'program_leadership' ) ) as $row ) {
				if ( ! is_array( $row ) || ! empty( $row['conflict'] ) || ! empty( $row['absence'] ) ) {
					continue;
				}
				$category = strtoupper( (string) ( $row['roleCategory'] ?? $row['role_category'] ?? '' ) );
				$role     = (string) ( $row['role'] ?? '' );
				$is_pd    = 'PROGRAM_DIRECTOR' === $category || ( preg_match( '/\bprogram director\b/i', $role ) && ! preg_match( '/\b(associate|assistant|interim|acting|former|emerit|fellowship|deputy|vice|co-?program|site|clerkship)/i', $role ) );
				$person   = self::clean( $row['name'] ?? '' );
				$age      = self::age_days( $row['source_date'] ?? ( $fact['retrievedAt'] ?? '' ), $now );
				$url      = self::https_or_empty( $row['source_url'] ?? ( $fact['sourceUrl'] ?? '' ) );
				if ( $is_pd && $person && $url && null !== $age && $age <= self::STALE_DAYS ) {
					$creds = self::clean( $row['credentials'] ?? '' );
					$value_out = array( 'name' => $person, 'credentials' => $creds );
					return self::fact( 'essential.programDirector', 'identity', 'Program director', $value_out, 'The current program director is ' . $person . ( $creds ? ', ' . $creds : '' ) . '.', array(
						'origin'      => 'RISE_RESEARCH',
						'field'       => 'research.leadership',
						'provider'    => (string) ( $fact['provider'] ?? '' ),
						'sourceUrl'   => $url,
						'retrievedAt' => (string) ( $fact['retrievedAt'] ?? '' ),
						'ageDays'     => $age,
					) );
				}
			}
		}
		$name = self::known( $fields, 'Program Director' );
		if ( is_string( $name ) && '' !== trim( $name ) ) {
			$prov = self::claim_provenance( $fields['Program Director'], $registry_prov, $now );
			if ( null !== $prov['ageDays'] && $prov['ageDays'] <= self::STALE_DAYS ) {
				$creds             = self::known( $fields, 'Program Director Credentials' );
				$creds             = is_string( $creds ) ? self::clean( $creds ) : '';
				$prov['rightsNote'] = 'REGISTRY_SURVEY_FIELD';
				return self::fact( 'essential.programDirector', 'identity', 'Program director', array( 'name' => self::clean( $name ), 'credentials' => $creds ), 'The current program director is ' . self::clean( $name ) . ( $creds ? ', ' . $creds : '' ) . '.', $prov );
			}
		}
		return null;
	}

	protected static function deep_item( $field, $category, $row, $fact, $fact_urls, $now ) {
		if ( is_string( $row ) ) {
			$row = array( 'summary' => $row );
		}
		if ( ! is_array( $row ) ) {
			return array( 'field' => $field, 'code' => 'UNREADABLE_ROW' );
		}
		if ( ! empty( $row['conflict'] ) || ( ! empty( $row['conflictState'] ) && 'NONE' !== strtoupper( (string) $row['conflictState'] ) ) ) {
			return array( 'field' => $field, 'code' => 'CONFLICT' );
		}
		if ( ! empty( $row['absence'] ) ) {
			return array( 'field' => $field, 'code' => 'ABSENCE_ROW' );
		}
		if ( ! empty( $row['retraction_note'] ) ) {
			return array( 'field' => $field, 'code' => 'RETRACTED' );
		}
		if ( 'research.fellowship_inventory' === $field ) {
			$relationship   = strtoupper( (string) ( $row['relationship'] ?? '' ) );
			$classification = strtoupper( (string) ( $row['classification'] ?? '' ) );
			if ( 'PLANNED_NOT_EXISTING' === $relationship || 'NOT_IM_ACCESSIBLE' === $classification ) {
				return array( 'field' => $field, 'code' => 'FELLOWSHIP_NOT_AVAILABLE' );
			}
			if ( 'AFFILIATED' === $relationship || false !== strpos( $classification, 'AFFILIATE' ) || false !== strpos( $classification, 'UNCERTAIN' ) ) {
				return array( 'field' => $field, 'code' => 'FELLOWSHIP_AFFILIATED_ONLY' );
			}
		}
		$headline = '';
		foreach ( array( 'title', 'name', 'program', 'fellowship', 'summary' ) as $key ) {
			if ( ! empty( $row[ $key ] ) && is_string( $row[ $key ] ) ) {
				$headline = self::clean( $row[ $key ] );
				break;
			}
		}
		$detail = '';
		foreach ( array( 'detail', 'summary', 'description' ) as $key ) {
			if ( ! empty( $row[ $key ] ) && is_string( $row[ $key ] ) && self::clean( $row[ $key ] ) !== $headline ) {
				$detail = self::clean( $row[ $key ] );
				break;
			}
		}
		if ( '' === $headline ) {
			return array( 'field' => $field, 'code' => 'UNREADABLE_ROW' );
		}
		// `student_explanation`, `applicant_relevance` and similar are never read: they may carry another student's framing.
		if ( preg_match( '/\b(you|your|yours|applicant[\'’]s)\b/i', $headline . ' ' . $detail ) ) {
			return array( 'field' => $field, 'code' => 'SECOND_PERSON_TEXT' );
		}
		$urls = self::https_list( array( $row['source_url'] ?? '' ) );
		$urls = $urls ? $urls : $fact_urls;
		if ( ! $urls ) {
			return array( 'field' => $field, 'code' => 'NO_SOURCE' );
		}
		$retrieved = (string) ( $row['retrieved_at'] ?? $row['source_date'] ?? $fact['retrievedAt'] ?? '' );
		$age       = self::age_days( $retrieved, $now );
		if ( null === $age || $age > self::STALE_DAYS ) {
			return array( 'field' => $field, 'code' => 'STALE', 'ageDays' => $age );
		}
		$text = $headline . ( $detail ? '. ' . $detail : '' );
		$text = mb_substr( $text, 0, 420 );
		return array(
			'factId'     => 'F-' . substr( hash( 'sha256', $field . '|' . $headline . '|' . $detail ), 0, 12 ),
			'category'   => ! empty( $row['category'] ) && 'research.program_differentiators' === $field ? self::differentiator_category( (string) $row['category'] ) : $category,
			'field'      => $field,
			'label'      => $headline,
			'text'       => $text,
			'provenance' => array(
				'origin'      => 'RISE_RESEARCH',
				'field'       => $field,
				'provider'    => (string) ( $fact['provider'] ?? '' ),
				'sourceUrl'   => $urls[0],
				'sourceUrls'  => $urls,
				'retrievedAt' => $retrieved,
				'ageDays'     => $age,
				'fresh'       => $age <= self::FRESH_DAYS,
				'itemSource'  => ! empty( $row['source_url'] ),
			),
		);
	}

	protected static function differentiator_category( $category ) {
		$c = strtolower( $category );
		foreach ( array(
			'curriculum' => '/curricul|training|education|schedule|track|clinic|rotation|elective/',
			'research'   => '/research|scholar/',
			'fellowship' => '/fellowship|career|outcome/',
			'population' => '/patient|population|community|underserved|safety/',
			'mission'    => '/mission|service|culture|wellness/',
			'teaching'   => '/teach|academic|faculty|mentor/',
		) as $key => $pattern ) {
			if ( preg_match( $pattern, $c ) ) {
				return $key;
			}
		}
		return 'differentiator';
	}

	/** Same flattening RISE's own client uses, so both surfaces agree. */
	protected static function rows( $value, $keys ) {
		if ( is_array( $value ) && array_keys( $value ) === range( 0, count( $value ) - 1 ) ) {
			return $value;
		}
		if ( is_string( $value ) && '' !== trim( $value ) ) {
			return array( array( 'summary' => $value ) );
		}
		if ( ! is_array( $value ) ) {
			return array();
		}
		$out = array();
		foreach ( $keys as $key ) {
			if ( isset( $value[ $key ] ) && is_array( $value[ $key ] ) ) {
				$out = array_merge( $out, array_values( $value[ $key ] ) );
			}
		}
		if ( ! $out && ! empty( $value['summary'] ) && is_string( $value['summary'] ) ) {
			$out[] = array( 'summary' => $value['summary'] );
		}
		return $out;
	}

	protected static function is_terminal_envelope( $value ) {
		if ( ! is_array( $value ) ) {
			return false;
		}
		$state = strtoupper( (string) ( $value['state'] ?? '' ) );
		if ( 'rise-terminal-evidence-state-v1' === ( $value['contractId'] ?? '' ) ) {
			return 'AVAILABLE_LIVE' !== $state;
		}
		return isset( $value['state'], $value['note'] ) && count( $value ) <= 3;
	}

	protected static function known( $fields, $name ) {
		$claim = $fields[ $name ] ?? null;
		if ( is_array( $claim ) && 'known' === ( $claim['knowledge']['state'] ?? '' ) ) {
			return $claim['knowledge']['value'] ?? null;
		}
		return null;
	}

	protected static function name_forms( $identity ) {
		$forms = array();
		foreach ( array( 'programName', 'institution', 'hospital' ) as $key ) {
			$value = trim( (string) $identity[ $key ] );
			if ( mb_strlen( $value ) >= 6 ) {
				$forms[] = $value;
				$short   = trim( preg_replace( '/\b(residency|training)?\s*program$/i', '', $value ) );
				if ( $short !== $value && mb_strlen( $short ) >= 6 ) {
					$forms[] = $short;
				}
			}
		}
		return array_values( array_unique( $forms ) );
	}

	protected static function clean( $value ) {
		return trim( preg_replace( '/\s+/u', ' ', wp_strip_all_tags( (string) $value ) ) );
	}

	protected static function https_or_empty( $url ) {
		$url = is_string( $url ) ? trim( $url ) : '';
		return 0 === stripos( $url, 'https://' ) ? esc_url_raw( $url ) : '';
	}

	protected static function https_list( $urls ) {
		$out = array();
		foreach ( (array) $urls as $url ) {
			$clean = self::https_or_empty( $url );
			if ( $clean ) {
				$out[] = $clean;
			}
		}
		return array_values( array_unique( $out ) );
	}

	protected static function age_days( $date, $now ) {
		// Only full ISO dates count. strtotime( '2019' ) means "today at 20:19", which would make an old fact look fresh.
		$ts = is_string( $date ) && preg_match( '/^\d{4}-\d{2}-\d{2}/', $date ) ? strtotime( $date ) : false;
		return false === $ts ? null : max( 0, (int) floor( ( $now - $ts ) / DAY_IN_SECONDS ) );
	}
}

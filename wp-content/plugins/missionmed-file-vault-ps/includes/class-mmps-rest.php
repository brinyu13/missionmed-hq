<?php
/**
 * REST surface of the prototype. Namespace mmed-ps-proto/v1.
 * Every route answers 404 to anyone outside the allowlist (MMPS_Gate).
 * Every read and write is scoped to the signed-in user's own rows.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Rest {

	const MY_PROGRAMS_PAGE = 6;

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_filter( 'rest_post_dispatch', array( __CLASS__, 'no_store' ), 10, 3 );
	}

	/** Statement text must never sit in a shared or browser cache. */
	public static function no_store( $response, $server, $request ) {
		if ( 0 === strpos( (string) $request->get_route(), '/' . MMPS_REST_NS ) && $response instanceof WP_HTTP_Response ) {
			$response->header( 'Cache-Control', 'no-store, private, max-age=0' );
			$response->header( 'X-Robots-Tag', 'noindex, nofollow' );
		}
		return $response;
	}

	public static function routes() {
		// Outside the allowlist the namespace does not exist at all: no routes, no entry in the public REST index.
		if ( ! MMPS_Gate::user_allowed() ) {
			return;
		}
		$gate = array( 'MMPS_Gate', 'rest_permission' );
		$map  = array(
			array( '/bootstrap', 'GET', 'bootstrap' ),
			array( '/root-candidates', 'GET', 'root_candidates' ),
			array( '/roots', 'POST', 'create_root' ),
			array( '/roots/(?P<id>\d+)', 'GET', 'get_root' ),
			array( '/roots/(?P<id>\d+)/region', 'PUT', 'put_region' ),
			array( '/roots/(?P<id>\d+)/prefs', 'PUT', 'put_prefs' ),
			array( '/rise/my-programs', 'GET', 'my_programs' ),
			array( '/rise/search', 'GET', 'search' ),
			array( '/rise/bundle', 'GET', 'bundle' ),
			array( '/generate', 'POST', 'generate' ),
			array( '/research-prompt', 'POST', 'research_prompt' ),
			array( '/library', 'GET', 'library' ),
			array( '/library', 'POST', 'save' ),
			array( '/library/(?P<uuid>[a-f0-9-]{36})', 'GET', 'document' ),
			array( '/library/(?P<uuid>[a-f0-9-]{36})/status', 'POST', 'set_status' ),
			array( '/library/(?P<uuid>[a-f0-9-]{36})/download', 'GET', 'download' ),
		);
		foreach ( $map as $route ) {
			register_rest_route(
				MMPS_REST_NS,
				$route[0],
				array(
					'methods'             => $route[1],
					'callback'            => array( __CLASS__, $route[2] ),
					'permission_callback' => $gate,
				)
			);
		}
	}

	/* ---------------- helpers ---------------- */

	protected static function uid() {
		return get_current_user_id();
	}

	protected static function root_or_404( $request ) {
		$root = MMPS_Store::get_root( self::uid(), absint( $request['id'] ) );
		return $root ? $root : new WP_Error( 'mmps_root_not_found', 'That ROOT was not found for your account.', array( 'status' => 404 ) );
	}

	protected static function root_summary( $root ) {
		return array(
			'id'              => $root['id'],
			'specialtyLabel'  => $root['specialtyLabel'],
			'rootLabel'       => $root['rootLabel'],
			'sourceKind'      => $root['sourceKind'],
			'isSynthetic'     => $root['isSynthetic'],
			'paragraphCount'  => count( $root['paragraphs'] ),
			'wordCount'       => str_word_count( implode( ' ', $root['paragraphs'] ) ),
			'regionConfirmed' => ! empty( $root['region']['mode'] ),
			'prefsSaved'      => ! empty( $root['prefs']['categories'] ),
			'textSha256'      => $root['textSha256'],
			'createdAt'       => $root['createdAt'],
		);
	}

	protected static function bundle_summary( $bundle ) {
		return array(
			'identity'        => $bundle['program'],
			'evidenceQuality' => $bundle['evidenceQuality'],
			'essentialHas'    => array(
				'programName'     => isset( $bundle['essential']['programName'] ),
				'location'        => isset( $bundle['essential']['location'] ),
				'programType'     => isset( $bundle['essential']['programType'] ),
				'programDirector' => isset( $bundle['essential']['programDirector'] ),
			),
			'registryReleaseId' => $bundle['registryReleaseId'],
			'bundleSha256'      => $bundle['bundleSha256'],
		);
	}

	/* ---------------- bootstrap ---------------- */

	public static function bootstrap() {
		MMPS_Install::maybe_install();
		$uid  = self::uid();
		$user = get_userdata( $uid );
		return rest_ensure_response(
			array(
				'version'   => MMPS_VERSION,
				'user'      => array( 'id' => $uid, 'name' => $user ? (string) $user->display_name : '' ),
				'gate'      => array( 'mode' => MMPS_Gate::mode(), 'testing' => MMPS_Gate::testing() ),
				'provider'  => MMPS_Provider::status(),
				'rise'      => MMPS_Rise_Client::status(),
				'fileVault' => array( 'available' => MMPS_Root_Source::file_vault_available() ),
				'roots'     => array_map( array( __CLASS__, 'root_summary' ), MMPS_Store::list_roots( $uid ) ),
				'library'   => MMPS_Store::list_documents( $uid ),
				'limits'    => array(
					'dailyRunCap'        => MMPS_Generator::DAILY_RUN_CAP,
					'runsToday'          => MMPS_Store::runs_today( $uid ),
					'deepMinFacts'       => MMPS_Tiers::DEEP_MIN_FACTS,
					'deepMaxFacts'       => MMPS_Tiers::DEEP_MAX_FACTS,
					'priorityDeepCutoff' => MMPS_Tiers::PRIORITY_DEEP_CUTOFF,
				),
				'contract'  => array( 'schema' => MMPS_Evidence_Bundle::SCHEMA, 'transport' => MMPS_Rise_Client::TRANSPORT, 'normalizationRule' => MMPS_Region::RULE ),
			)
		);
	}

	/* ---------------- ROOT ---------------- */

	public static function root_candidates() {
		return rest_ensure_response(
			array(
				'fileVaultAvailable' => MMPS_Root_Source::file_vault_available(),
				'candidates'         => MMPS_Root_Source::candidates( self::uid() ),
				'synthetics'         => array_values( array_map( function ( $key, $set ) {
					return array( 'key' => $key, 'label' => $set['label'], 'specialty' => $set['specialty'], 'paragraphCount' => count( $set['paragraphs'] ) );
				}, array_keys( MMPS_Root_Source::synthetics() ), MMPS_Root_Source::synthetics() ) ),
				'realRootAiAllowed'  => MMPS_Provider::real_root_allowed(),
			)
		);
	}

	public static function create_root( $request ) {
		$params  = (array) $request->get_json_params();
		$root_id = MMPS_Root_Source::create( self::uid(), $params );
		if ( is_wp_error( $root_id ) ) {
			return $root_id;
		}
		$root = MMPS_Store::get_root( self::uid(), $root_id );
		MMPS_Store::audit( self::uid(), 'root_create', 'root:' . $root_id, array( 'source' => $root['sourceKind'], 'synthetic' => $root['isSynthetic'], 'textSha256' => $root['textSha256'] ) );
		return rest_ensure_response( array( 'root' => $root, 'detection' => MMPS_Region::detect( $root['paragraphs'] ) ) );
	}

	public static function get_root( $request ) {
		$root = self::root_or_404( $request );
		if ( is_wp_error( $root ) ) {
			return $root;
		}
		return rest_ensure_response( array( 'root' => $root, 'detection' => MMPS_Region::detect( $root['paragraphs'] ) ) );
	}

	public static function put_region( $request ) {
		$root = self::root_or_404( $request );
		if ( is_wp_error( $root ) ) {
			return $root;
		}
		$params = (array) $request->get_json_params();
		$mode   = strtoupper( (string) ( $params['mode'] ?? '' ) );
		$region = MMPS_Region::build( $root['paragraphs'], $mode, (int) ( $params['paragraphIndex'] ?? -1 ), MMPS_Region::detect( $root['paragraphs'] ) );
		if ( is_wp_error( $region ) ) {
			return $region;
		}
		MMPS_Store::update_root_json( self::uid(), $root['id'], 'region_json', $region );
		MMPS_Store::audit( self::uid(), 'region_confirm', 'root:' . $root['id'], array( 'mode' => $region['mode'], 'index' => $region['paragraphIndex'], 'regionSha256' => $region['regionSha256'] ) );
		return rest_ensure_response( array( 'root' => MMPS_Store::get_root( self::uid(), $root['id'] ) ) );
	}

	public static function put_prefs( $request ) {
		$root = self::root_or_404( $request );
		if ( is_wp_error( $root ) ) {
			return $root;
		}
		$prefs = MMPS_Tiers::sanitize_prefs( (array) $request->get_json_params() );
		MMPS_Store::update_root_json( self::uid(), $root['id'], 'prefs_json', $prefs );
		MMPS_Store::audit( self::uid(), 'prefs_save', 'root:' . $root['id'], array() );
		return rest_ensure_response( array( 'root' => MMPS_Store::get_root( self::uid(), $root['id'] ) ) );
	}

	/* ---------------- RISE (ProgramEvidenceBundle v1) ---------------- */

	public static function my_programs( $request ) {
		$list = MMPS_Evidence_Bundle::my_list();
		if ( is_wp_error( $list ) ) {
			return $list;
		}
		usort(
			$list,
			function ( $a, $b ) {
				if ( $a['goldStarred'] !== $b['goldStarred'] ) {
					return $a['goldStarred'] ? -1 : 1;
				}
				$pa = $a['priorityPosition'] ? $a['priorityPosition'] : PHP_INT_MAX;
				$pb = $b['priorityPosition'] ? $b['priorityPosition'] : PHP_INT_MAX;
				return $pa === $pb ? strcmp( $a['programSpecialtyId'], $b['programSpecialtyId'] ) : ( $pa < $pb ? -1 : 1 );
			}
		);
		$offset = absint( $request['offset'] );
		$limit  = min( 10, max( 1, absint( $request['limit'] ) ? absint( $request['limit'] ) : self::MY_PROGRAMS_PAGE ) );
		$out    = array();
		$t0     = microtime( true );
		foreach ( array_slice( $list, $offset, $limit ) as $entry ) {
			if ( $out && microtime( true ) - $t0 > 12 ) {
				break; // Slow RISE must never hold a PHP worker for long; the client asks for the rest with "Load more".
			}
			$row    = array(
				'programSpecialtyId' => $entry['programSpecialtyId'],
				'listState'          => $entry['state'],
				'goldStarred'        => $entry['goldStarred'],
				'priorityPosition'   => $entry['priorityPosition'],
				'defaultTier'        => MMPS_Tiers::default_tier( $entry ),
			);
			$bundle = MMPS_Evidence_Bundle::for_program( $entry['programSpecialtyId'] );
			if ( is_wp_error( $bundle ) ) {
				$row['error'] = $bundle->get_error_code();
			} else {
				$row = array_merge( $row, self::bundle_summary( $bundle ) );
			}
			$out[] = $row;
		}
		return rest_ensure_response( array( 'total' => count( $list ), 'offset' => $offset, 'limit' => count( $out ), 'programs' => $out ) );
	}

	public static function search( $request ) {
		$q = trim( sanitize_text_field( (string) $request['q'] ) );
		if ( mb_strlen( $q ) < 3 ) {
			return new WP_Error( 'mmps_search_short', 'Type at least three letters.', array( 'status' => 422 ) );
		}
		$found = MMPS_Evidence_Bundle::search( $q, 12 );
		return is_wp_error( $found ) ? $found : rest_ensure_response( array( 'programs' => $found ) );
	}

	public static function bundle( $request ) {
		$bundle = MMPS_Evidence_Bundle::for_program( (string) $request['id'] );
		if ( is_wp_error( $bundle ) ) {
			return $bundle;
		}
		return rest_ensure_response( array( 'bundle' => $bundle, 'summary' => self::bundle_summary( $bundle ) ) );
	}

	/* ---------------- generate ---------------- */

	public static function generate( $request ) {
		$params = (array) $request->get_json_params();
		$root   = MMPS_Store::get_root( self::uid(), absint( $params['rootId'] ?? 0 ) );
		if ( ! $root ) {
			return new WP_Error( 'mmps_root_not_found', 'That ROOT was not found for your account.', array( 'status' => 404 ) );
		}
		$others = array_slice( array_values( array_filter( array_map( 'strval', (array) ( $params['otherProgramIds'] ?? array() ) ) ) ), 0, 12 );
		return rest_ensure_response( MMPS_Generator::generate( self::uid(), $root, (string) ( $params['programSpecialtyId'] ?? '' ), (string) ( $params['tier'] ?? 'ESSENTIAL' ), $others ) );
	}

	/**
	 * Planned UX only: a copy-and-paste deep research prompt for one program.
	 * Program data only, no student data. Nothing is sent anywhere and nothing
	 * is ingested; the ingestion pipeline is Phase 2.
	 */
	public static function research_prompt( $request ) {
		$params = (array) $request->get_json_params();
		$bundle = MMPS_Evidence_Bundle::for_program( (string) ( $params['programSpecialtyId'] ?? '' ) );
		if ( is_wp_error( $bundle ) ) {
			return $bundle;
		}
		$p       = $bundle['program'];
		$have    = $bundle['evidenceQuality']['deepFields'];
		$domains = array(
			'research.program_differentiators'        => 'What the program itself says sets it apart',
			'research.curriculum'                     => 'Curriculum and training structure (tracks, rotations, sites, schedule model)',
			'research.fellowship_inventory'           => 'In-house fellowships (accredited, currently accepting)',
			'research.research_opportunities'         => 'Resident research and scholarly activity',
			'research.facilities_patient_population'  => 'Hospitals, clinics and the patient population served',
			'research.culture'                        => 'Mission, community work and resident experience as the program describes it',
		);
		$missing = array();
		foreach ( $domains as $field => $label ) {
			if ( ! in_array( $field, $have, true ) ) {
				$missing[] = '- ' . $label;
			}
		}
		$lines = array(
			'# Deep program research request (MissionMed RISE)',
			'',
			'Program: ' . ( $p['programName'] ? $p['programName'] : $p['institution'] ),
			'Institution: ' . $p['institution'],
			'Location: ' . trim( $p['city'] . ', ' . $p['state'], ', ' ),
			'ACGME program id: ' . $p['acgmeId'],
			'RISE program-specialty id: ' . $p['programSpecialtyId'],
			$p['officialUrl'] ? 'Official site: ' . $p['officialUrl'] : 'Official site: find and confirm it first',
			'',
			'## What is missing',
			$missing ? implode( "\n", $missing ) : '- Nothing is missing by domain; look for newer or more specific facts.',
			'',
			'## Rules',
			'- Use the program\'s own pages, its sponsoring institution and ACGME public data. Do not use forums, review sites or applicant spreadsheets.',
			'- Record only what a source states. No inference, no praise words, no comparison with other programs.',
			'- Every fact needs its exact https source URL and the date you read it.',
			'- If a domain has nothing public, say "not publicly available". Do not fill the gap.',
			'- Do not include any information about any applicant.',
			'',
			'## Return format (one Markdown file)',
			'For each domain above: a heading, then one bullet per fact as',
			'`fact text | source URL | date read (YYYY-MM-DD)`.',
		);
		return rest_ensure_response( array( 'planned' => true, 'ingestion' => 'PHASE_2_NOT_BUILT', 'prompt' => implode( "\n", $lines ) ) );
	}

	/* ---------------- library (isolated prototype storage) ---------------- */

	public static function library() {
		return rest_ensure_response( array( 'documents' => MMPS_Store::list_documents( self::uid() ) ) );
	}

	public static function document( $request ) {
		$doc = MMPS_Store::get_document( self::uid(), (string) $request['uuid'] );
		if ( ! $doc ) {
			return new WP_Error( 'mmps_doc_not_found', 'That statement was not found in your prototype library.', array( 'status' => 404 ) );
		}
		$doc['paragraphs'] = MMPS_Region::split_text( $doc['fullText'] );
		return rest_ensure_response( array( 'document' => $doc ) );
	}

	public static function save( $request ) {
		$uid    = self::uid();
		$params = (array) $request->get_json_params();
		$run    = MMPS_Store::get_run( $uid, (string) ( $params['runId'] ?? '' ) );
		if ( ! $run ) {
			return new WP_Error( 'mmps_run_not_found', 'That generation run was not found.', array( 'status' => 404 ) );
		}
		$existing = MMPS_Store::find_document_by_run( $uid, absint( $run['id'] ) );   // Idempotent: one run, one document.
		if ( $existing ) {
			return rest_ensure_response( array( 'document' => $existing, 'alreadySaved' => true ) );
		}
		if ( 'OK' !== $run['status'] || empty( $run['output']['replacement_region'] ) ) {
			return new WP_Error( 'mmps_run_not_savable', 'Only a run that passed every blocking check can be saved.', array( 'status' => 409 ) );
		}
		$candidate_id = strtoupper( sanitize_text_field( (string) ( $params['candidateId'] ?? $run['output']['selected_candidate_id'] ?? $run['output']['recommended_candidate_id'] ?? '' ) ) );
		$candidate    = MMPS_Generator::candidate_by_id( $run['output'], $candidate_id );
		if ( ! empty( $run['output']['candidates'] ) ) {
			$valid_ids = (array) ( $run['validation']['validCandidateIds'] ?? array() );
			if ( ! $candidate || ! in_array( $candidate_id, $valid_ids, true ) ) {
				return new WP_Error( 'mmps_candidate_not_savable', 'Choose a candidate that passed every server-side check.', array( 'status' => 409 ) );
			}
		} else {
			$candidate    = $run['output']; // Backward-compatible M1 run.
			$candidate_id = (string) ( $run['strategy_key'] ?? '' );
		}
		$root = MMPS_Store::get_root( $uid, absint( $run['root_id'] ) );
		if ( ! $root || ! MMPS_Region::root_still_matches( $root['paragraphs'], $root['region'] ) ) {
			return new WP_Error( 'mmps_root_changed', 'The ROOT behind this run is no longer available unchanged.', array( 'status' => 409 ) );
		}
		// The run must be saved against the exact region it was written and previewed for.
		if ( (array) ( $run['validation']['region'] ?? array() ) !== MMPS_Generator::region_snapshot( $root ) ) {
			return new WP_Error( 'mmps_region_changed', 'The editable region was changed after this version was written. Generate it again.', array( 'status' => 409 ) );
		}
		$paragraphs = MMPS_Region::reconstruct( $root['paragraphs'], $root['region'], (string) $candidate['replacement_region'] );
		$integrity  = MMPS_Region::verify_protected( $paragraphs, $root['region'] );
		if ( is_wp_error( $integrity ) ) {
			return $integrity;
		}
		$program   = (array) ( $run['bundle']['program'] ?? array() );
		$name      = ! empty( $program['programName'] ) ? $program['programName'] : (string) ( $program['institution'] ?? '' );
		$status    = 'APPROVED' === strtoupper( (string) ( $params['status'] ?? '' ) ) ? 'APPROVED' : 'DRAFT';
		$version   = MMPS_Store::next_version( $uid, $root['id'], $run['program_specialty_id'] );
		$full_text = implode( "\n\n", $paragraphs );
		$region    = $paragraphs[ (int) $root['region']['paragraphIndex'] ];   // In both modes the new paragraph sits at this index.
		$doc_uuid  = MMPS_Store::uuid();
		$id        = MMPS_Store::insert_document(
			$uid,
			array(
				'doc_uuid'             => $doc_uuid,
				'root_id'              => $root['id'],
				'run_id'               => absint( $run['id'] ),
				'specialty_label'      => $root['specialtyLabel'],
				'program_specialty_id' => (string) $run['program_specialty_id'],
				'acgme_id'             => (string) ( $program['acgmeId'] ?? '' ),
				'program_name'         => mb_substr( $name, 0, 255 ),
				'institution'          => mb_substr( (string) ( $program['institution'] ?? '' ), 0, 255 ),
				'city'                 => (string) ( $program['city'] ?? '' ),
				'state'                => (string) ( $program['state'] ?? '' ),
				'tier'                 => (string) $run['tier_effective'],
				'version_number'       => $version,
				'status'               => $status,
				'title'                => mb_substr( $root['specialtyLabel'] . ' PS · ' . $name . ( ! empty( $program['acgmeId'] ) ? ' · ACGME ' . $program['acgmeId'] : '' ) . ' · v' . $version, 0, 255 ),
				'root_label'           => $root['rootLabel'],
				'full_text'            => $full_text,
				'full_text_sha256'     => MMPS_Region::text_hash( $paragraphs ),
				'region_text'          => $region,
				'metadata_json'        => wp_json_encode(
					array(
						'runId'             => $run['run_uuid'],
						'rootTextSha256'    => $root['textSha256'],
						'rootSourceSha256'  => $root['sourceSha256'],
						'rootFvFileId'      => $root['fvFileId'],
						'rootFvVersion'     => $root['fvVersionNumber'],
						'rootFvVersionUuid' => $root['fvVersionUuid'],
						'rootIsSynthetic'   => $root['isSynthetic'],
						'regionMode'        => $root['region']['mode'],
						'regionIndex'       => $root['region']['paragraphIndex'],
						'normalizationRule' => MMPS_Region::RULE,
						'candidateId'       => $candidate_id,
						'recommendedCandidateId' => (string) ( $run['output']['recommended_candidate_id'] ?? $run['strategy_key'] ),
						'candidateCount'    => count( (array) ( $run['output']['candidates'] ?? array( $candidate ) ) ),
						'strategy'          => (string) ( $candidate['strategy'] ?? $run['strategy_key'] ),
						'provider'          => $run['provider'],
						'model'             => $run['model'],
						'promptVersion'     => (string) ( $run['validation']['promptVersion'] ?? ( ! empty( $run['output']['candidates'] ) ? MMPS_Generator::PROMPT_VERSION : 'mmps-prompt.v1' ) ),
						'bundleSchema'      => (string) ( $run['bundle']['schema'] ?? '' ),
						'bundleSha256'      => $run['bundle_sha256'],
						'registryReleaseId' => (string) ( $run['bundle']['registryReleaseId'] ?? '' ),
						'factsUsed'         => (array) ( $run['validation']['candidateResults'][ $candidate_id ]['factsUsed'] ?? $run['validation']['factsUsed'] ?? array() ),
					)
				),
			)
		);
		if ( ! $id ) {
			return new WP_Error( 'mmps_doc_save', 'The statement could not be saved.', array( 'status' => 500 ) );
		}
		MMPS_Store::audit( $uid, 'candidate_select', $run['run_uuid'], array( 'candidateId' => $candidate_id, 'recommended' => $candidate_id === (string) ( $run['output']['recommended_candidate_id'] ?? '' ) ) );
		MMPS_Store::audit( $uid, 'library_save', $doc_uuid, array( 'run' => $run['run_uuid'], 'candidateId' => $candidate_id, 'status' => $status, 'sha256' => MMPS_Region::text_hash( $paragraphs ) ) );
		return rest_ensure_response( array( 'document' => MMPS_Store::get_document( $uid, $doc_uuid ), 'alreadySaved' => false ) );
	}

	public static function set_status( $request ) {
		$params = (array) $request->get_json_params();
		$status = strtoupper( (string) ( $params['status'] ?? '' ) );
		if ( ! in_array( $status, array( 'DRAFT', 'APPROVED', 'ARCHIVED' ), true ) ) {
			return new WP_Error( 'mmps_status_invalid', 'Unknown status.', array( 'status' => 422 ) );
		}
		$doc = MMPS_Store::get_document( self::uid(), (string) $request['uuid'] );
		if ( ! $doc ) {
			return new WP_Error( 'mmps_doc_not_found', 'That statement was not found in your prototype library.', array( 'status' => 404 ) );
		}
		MMPS_Store::set_document_status( self::uid(), $doc['docUuid'], $status );
		MMPS_Store::audit( self::uid(), 'library_status', $doc['docUuid'], array( 'status' => $status ) );
		return rest_ensure_response( array( 'document' => MMPS_Store::get_document( self::uid(), $doc['docUuid'] ) ) );
	}

	/** Individual download. The file holds the statement body only: no metadata, no provenance, no labels. */
	public static function download( $request ) {
		$doc = MMPS_Store::get_document( self::uid(), (string) $request['uuid'] );
		if ( ! $doc ) {
			return new WP_Error( 'mmps_doc_not_found', 'That statement was not found in your prototype library.', array( 'status' => 404 ) );
		}
		$format     = 'txt' === strtolower( (string) $request['format'] ) ? 'txt' : 'docx';
		$paragraphs = MMPS_Region::split_text( $doc['fullText'] );
		if ( 'docx' === $format ) {
			$bytes = MMPS_Docx::bytes_from_paragraphs( $paragraphs );
			if ( is_wp_error( $bytes ) ) {
				return $bytes;
			}
			$type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
		} else {
			$bytes = implode( "\r\n\r\n", $paragraphs ) . "\r\n";
			$type  = 'text/plain; charset=utf-8';
		}
		$name = sanitize_file_name( preg_replace( '/[^A-Za-z0-9]+/', '_', $doc['specialtyLabel'] . '_PS_' . $doc['programName'] . '_v' . $doc['versionNumber'] ) ) . '.' . $format;
		MMPS_Store::audit( self::uid(), 'library_download', $doc['docUuid'], array( 'format' => $format ) );
		if ( MMPS_Gate::testing() && ! empty( $request['inline'] ) ) {
			return rest_ensure_response( array( 'fileName' => $name, 'bytes' => strlen( $bytes ), 'sha256' => hash( 'sha256', $bytes ) ) );
		}
		nocache_headers();
		header( 'Content-Type: ' . $type );
		header( 'Content-Disposition: attachment; filename="' . $name . '"' );
		header( 'Content-Length: ' . strlen( $bytes ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'X-Robots-Tag: noindex, nofollow' );
		echo $bytes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- binary download.
		exit;
	}
}

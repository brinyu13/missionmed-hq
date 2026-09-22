<?php
/** Private, immutable paragraph-only revisions. Never calls a provider. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

class MMPS_Edit {
	protected static function error( $code, $message, $status = 409 ) {
		return new WP_Error( 'mmps_edit_' . $code, $message, array( 'status' => $status ) );
	}

	public static function context( $uid, $run_uuid ) {
		$run = MMPS_Store::get_run( $uid, $run_uuid );
		if ( ! $run ) { return self::error( 'not_found', 'That generation run was not found.', 404 ); }
		$root = MMPS_Store::get_root( $uid, absint( $run['root_id'] ) );
		if ( ! $root || ! MMPS_Region::root_still_matches( $root['paragraphs'], $root['region'] ) || (string) $root['textSha256'] !== (string) ( $root['region']['rootTextSha256'] ?? '' ) || (array) ( $run['validation']['region'] ?? array() ) !== MMPS_Generator::region_snapshot( $root ) ) {
			return self::error( 'root_changed', 'The ROOT or authorized region changed. This revision cannot be used.' );
		}
		$template_gate = MMPS_Generator::template_gate( $root );
		if ( is_wp_error( $template_gate ) ) { return $template_gate; }
		$production = ! empty( $root['isSynthetic'] ) || MMPS_Provider::real_root_allowed_for( $uid, $root, (string) ( $run['program_specialty_id'] ?? '' ) );
		if ( ! $production ) { return self::error( 'privacy', 'Manual revision access is not authorized for this ROOT.', 403 ); }
		if ( 'OK' !== $run['status'] || ( empty( $run['output']['replacement_region'] ) && empty( $run['output']['candidates'] ) ) ) { return self::error( 'run_invalid', 'Only a validated candidate run supports review.' ); }
		return array( 'run' => $run, 'root' => $root );
	}

	/** Exact-text matching is deliberately conservative: no semantic verifier is authorized. */
	public static function validate( $uid, $context, $candidate, $text ) {
		$run = $context['run']; $root = $context['root'];
		$paragraphs = MMPS_Region::reconstruct( $root['paragraphs'], $root['region'], $text );
		$integrity = MMPS_Region::verify_protected( $paragraphs, $root['region'] );
		if ( is_wp_error( $integrity ) ) { return $integrity; }
		$exact = $text === (string) $candidate['replacement_region'];
		$flags = array(); $facts = array(); $segments = array();
		if ( ! $exact ) {
			$flags[] = array( 'code' => 'EDIT_GROUNDING_REVIEW_REQUIRED', 'message' => 'Saved privately. Changed wording needs grounding review; approval is unavailable. Original AI annotations do not apply.' );
		} else {
			$plan = MMPS_Tiers::plan( $run['bundle'], $root['prefs'], $run['tier_requested'] );
			$fresh = MMPS_Generator::validate( $candidate, $run['bundle'], $plan, $root );
			$flags = (array) $fresh['blocking'];
			if ( empty( $flags ) ) { $facts = (array) $fresh['factsUsed']; $segments = (array) $candidate['segments']; }
		}
		$similarity = MMPS_Similarity::assess( $uid, $text );
		if ( is_wp_error( $similarity ) ) { return $similarity; }
		if ( 'EXACT_BLOCKED' === $similarity['status'] ) { $flags[] = array( 'code' => 'CROSS_STUDENT_EXACT', 'message' => 'This revision cannot be approved because of a protected exact-match check. No other student text is disclosed.' ); }
		return array( 'status' => $flags ? 'NEEDS_REVIEW' : 'VALIDATED', 'canApprove' => empty( $flags ), 'flags' => $flags, 'rootIntegrity' => 'PASS', 'factsUsed' => $facts, 'segments' => $segments, 'similarity' => array( 'status' => $similarity['status'], 'band' => $similarity['band'] ), 'validationMode' => 'EXACT_AI_TEXT_ONLY' );
	}

	public static function read( $uid, $run_uuid ) {
		$context = self::context( $uid, $run_uuid );
		if ( is_wp_error( $context ) ) { return $context; }
		if ( empty( $context['run']['output']['candidates'] ) ) {
			return array( 'capabilities' => array( 'canEdit' => false, 'canApprove' => empty( $context['run']['validation']['blocking'] ), 'validationMode' => 'LEGACY_ORIGINAL_ONLY' ), 'heads' => (object) array() );
		}
		$heads = array();
		foreach ( $context['run']['output']['candidates'] as $candidate ) {
			$id = $candidate['candidate_id'];
			$head = MMPS_Store::edit_head( $uid, $run_uuid, $id );
			if ( $head ) {
				if ( $head['region'] !== MMPS_Generator::region_snapshot( $context['root'] ) || $head['rootTextSha256'] !== $context['root']['textSha256'] ) { return self::error( 'root_changed', 'The saved revision belongs to an older ROOT or region.' ); }
				// Read-only snapshot, not a fresh approval. Final save rechecks the
				// exact revision. assess() is deliberately not called by GET: its
				// legacy fingerprint backfill may write private similarity rows.
			}
			$heads[ $id ] = $head;
		}
		return array( 'capabilities' => array( 'canEdit' => true, 'canApprove' => true, 'canRevalidate' => true, 'validationMode' => 'PROVIDER_GROUNDED_EDIT_V1' ), 'heads' => (object) $heads );
	}

	/** Validate one already-saved exact revision without holding a database lock during provider I/O. */
	public static function revalidate( $uid, $run_uuid, $params ) {
		foreach ( array_keys( $params ) as $key ) {
			if ( ! in_array( $key, array( 'candidateId', 'baseRevisionId', 'requestId' ), true ) || ! is_string( $params[ $key ] ) ) { return self::error( 'field', 'Only the saved revision identifiers are accepted.', 422 ); }
		}
		$id = (string) ( $params['candidateId'] ?? '' );
		$base = (string) ( $params['baseRevisionId'] ?? '' );
		$request_id = (string) ( $params['requestId'] ?? '' );
		$uuid = '/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D';
		if ( ! preg_match( $uuid, $request_id ) || ! preg_match( $uuid, $base ) ) { return self::error( 'request', 'A current saved revision and request identity are required.', 422 ); }
		$context = self::context( $uid, $run_uuid );
		if ( is_wp_error( $context ) ) { return $context; }
		$candidate = MMPS_Generator::candidate_by_id( $context['run']['output'], $id );
		$head = MMPS_Store::edit_head( $uid, $run_uuid, $id );
		if ( ! $candidate || ! $head || $head['id'] !== $base ) { return self::error( 'conflict', 'A newer revision exists. Reload before checking this draft.' ); }
		if ( hash_equals( MMPS_Region::hash( $head['text'] ), MMPS_Region::hash( (string) $candidate['replacement_region'] ) ) ) { return self::error( 'original', 'The original AI version is already validated and does not need edit revalidation.', 422 ); }
		$hash = hash( 'sha256', wp_json_encode( array( $run_uuid, $id, 'REVALIDATE', $base, MMPS_Region::hash( $head['text'] ) ) ) );
		$prior = MMPS_Store::edit_request( $uid, $request_id );
		if ( $prior ) { return hash_equals( $prior['hash'], $hash ) ? array( 'revision' => $prior['revision'], 'alreadySaved' => true ) : self::error( 'request_reused', 'That request identity was already used for a different check.' ); }
		$checked = MMPS_Generator::revalidate_edit( $uid, $context['root'], $context['run'], $head['text'] );
		if ( is_wp_error( $checked ) ) { return $checked; }
		$fresh = (array) $checked['validation'];
		$flags = (array) ( $fresh['blocking'] ?? array() );
		$similarity = MMPS_Similarity::assess( $uid, $head['text'] );
		if ( is_wp_error( $similarity ) ) { return $similarity; }
		if ( 'EXACT_BLOCKED' === $similarity['status'] ) { $flags[] = array( 'code' => 'CROSS_STUDENT_EXACT', 'message' => 'This revision cannot be approved because of a protected exact-match check. No other student text is disclosed.' ); }
		$validation = array(
			'status' => $flags ? 'NEEDS_REVIEW' : 'VALIDATED', 'canApprove' => empty( $flags ), 'flags' => $flags,
			'advisory' => (array) ( $fresh['advisory'] ?? array() ), 'rootIntegrity' => 'PASS',
			'factsUsed' => (array) ( $fresh['factsUsed'] ?? array() ), 'segments' => (array) ( $checked['annotation']['segments'] ?? array() ),
			'similarity' => array( 'status' => $similarity['status'], 'band' => $similarity['band'] ),
			'validationMode' => 'PROVIDER_GROUNDED_EDIT_V1', 'annotation' => $checked['annotation'],
			'provider' => $checked['provider'], 'model' => $checked['model'],
		);
		return MMPS_Store::with_review_lock( $uid, $run_uuid, function () use ( $uid, $run_uuid, $id, $base, $request_id, $hash, $head, $validation ) {
			$prior = MMPS_Store::edit_request( $uid, $request_id );
			if ( $prior ) { return hash_equals( $prior['hash'], $hash ) ? array( 'revision' => $prior['revision'], 'alreadySaved' => true ) : self::error( 'request_reused', 'That request identity was already used for a different check.' ); }
			$current = MMPS_Store::edit_head( $uid, $run_uuid, $id );
			if ( ! $current || $current['id'] !== $base || ! hash_equals( MMPS_Region::hash( $current['text'] ), MMPS_Region::hash( $head['text'] ) ) ) { return self::error( 'conflict', 'The draft changed while it was being checked. The newer draft was preserved.' ); }
			$revision = array( 'id' => MMPS_Store::uuid(), 'candidateId' => $id, 'baseRevisionId' => $base, 'action' => 'REVALIDATE', 'text' => $head['text'], 'createdAt' => MMPS_Store::now(), 'rootTextSha256' => $head['rootTextSha256'], 'region' => $head['region'], 'validation' => $validation );
			if ( ! MMPS_Store::insert_edit( $uid, $run_uuid, $request_id, $hash, $revision ) ) { return self::error( 'conflict', 'The checked revision could not be stored. Reload and try again.' ); }
			MMPS_Store::audit( $uid, 'paragraph_edit_revalidate', $revision['id'], array( 'runId' => $run_uuid, 'candidateId' => $id, 'baseRevisionId' => $base, 'validation' => $validation['status'], 'provider' => $validation['provider'] ) );
			return array( 'revision' => $revision, 'alreadySaved' => false );
		} );
	}

	public static function write( $uid, $run_uuid, $params ) {
		return MMPS_Store::with_review_lock( $uid, $run_uuid, function () use ( $uid, $run_uuid, $params ) { return self::write_locked( $uid, $run_uuid, $params ); } );
	}

	protected static function write_locked( $uid, $run_uuid, $params ) {
		$context = self::context( $uid, $run_uuid );
		if ( is_wp_error( $context ) ) { return $context; }
		if ( empty( $context['run']['output']['candidates'] ) ) { return self::error( 'legacy_read_only', 'Legacy runs support original-candidate review but not manual edit revisions.' ); }
		// Reject full-ROOT, annotation, status and identity injection, not merely ignore it.
		foreach ( array_keys( $params ) as $key ) {
			if ( ! in_array( $key, array( 'candidateId', 'text', 'action', 'baseRevisionId', 'requestId' ), true ) ) { return self::error( 'field', 'Only the authorized paragraph edit fields are accepted.', 422 ); }
			if ( ! is_string( $params[ $key ] ) ) { return self::error( 'field_type', 'Edit fields must be plain strings.', 422 ); }
		}
		$id = (string) ( $params['candidateId'] ?? '' );
		$candidate = MMPS_Generator::candidate_by_id( $context['run']['output'], $id );
		if ( ! $candidate || ! in_array( $id, (array) ( $context['run']['validation']['validCandidateIds'] ?? array() ), true ) ) { return self::error( 'candidate', 'This candidate is not available for editing.', 422 ); }
		$action = (string) ( $params['action'] ?? 'SAVE' );
		$base = (string) ( $params['baseRevisionId'] ?? '' );
		$request_id = (string) ( $params['requestId'] ?? '' );
		$uuid = '/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D';
		if ( ! preg_match( $uuid, $request_id ) || ( '' !== $base && ! preg_match( $uuid, $base ) ) || ! in_array( $action, array( 'SAVE', 'RESTORE' ), true ) ) { return self::error( 'request', 'A valid action, request identity and revision identity are required.', 422 ); }
		$text = 'RESTORE' === $action ? (string) $candidate['replacement_region'] : ( $params['text'] ?? null );
		if ( ! is_string( $text ) || '' === trim( $text ) || strlen( $text ) > 16000 || preg_match( '/[\r\n\x00-\x08\x0B-\x1F\x7F\x{2028}\x{2029}]|<[^>]*>/u', $text ) || 1 !== preg_match( '//u', $text ) ) { return self::error( 'text', 'Use one nonempty plain-text paragraph (at most 16,000 bytes).', 422 ); }
		$hash = hash( 'sha256', wp_json_encode( array( $run_uuid, $id, $action, $base, $text ) ) );
		$prior = MMPS_Store::edit_request( $uid, $request_id );
		if ( $prior ) {
			if ( ! hash_equals( $prior['hash'], $hash ) ) { return self::error( 'request_reused', 'That request identity was already used for a different edit.' ); }
			return array( 'revision' => $prior['revision'], 'alreadySaved' => true );
		}
		$head = MMPS_Store::edit_head( $uid, $run_uuid, $id );
		if ( (string) ( $head['id'] ?? '' ) !== $base ) { return self::error( 'conflict', 'A newer revision exists. Reload the saved revision before saving your draft.' ); }
		$validation = self::validate( $uid, $context, $candidate, $text );
		if ( is_wp_error( $validation ) ) { return $validation; }
		$revision = array( 'id' => MMPS_Store::uuid(), 'candidateId' => $id, 'baseRevisionId' => $base, 'action' => $action, 'text' => $text, 'createdAt' => MMPS_Store::now(), 'rootTextSha256' => $context['root']['textSha256'], 'region' => MMPS_Generator::region_snapshot( $context['root'] ), 'validation' => $validation );
		if ( ! MMPS_Store::insert_edit( $uid, $run_uuid, $request_id, $hash, $revision ) ) {
			$prior = MMPS_Store::edit_request( $uid, $request_id );
			if ( $prior && hash_equals( $prior['hash'], $hash ) ) { return array( 'revision' => $prior['revision'], 'alreadySaved' => true ); }
			return self::error( 'conflict', 'The edit was not saved. Another revision may have arrived; reload before retrying.' );
		}
		MMPS_Store::audit( $uid, 'paragraph_edit_' . strtolower( $action ), $revision['id'], array( 'runId' => $run_uuid, 'candidateId' => $id, 'baseRevisionId' => $base, 'validation' => $validation['status'] ) );
		return array( 'revision' => $revision, 'alreadySaved' => false );
	}

	/** Resolve only the current, exact server revision. Never accepts client prose for library save. */
	public static function for_library( $uid, $run, $candidate, $revision_id ) {
		$head = MMPS_Store::edit_head( $uid, $run['run_uuid'], $candidate['candidate_id'] ?? $run['strategy_key'] );
		if ( ! $head && '' === $revision_id ) { return array( 'candidate' => $candidate, 'revisionId' => '' ); }
		if ( ! $head || '' === $revision_id || $head['id'] !== $revision_id ) { return self::error( 'revision_required', 'Save the exact current edit revision; stale or omitted revisions cannot be approved.' ); }
		$context = self::context( $uid, $run['run_uuid'] );
		if ( is_wp_error( $context ) ) { return $context; }
		if ( 'PROVIDER_GROUNDED_EDIT_V1' === (string) ( $head['validation']['validationMode'] ?? '' ) ) {
			$annotation = (array) ( $head['validation']['annotation'] ?? array() );
			if ( ! hash_equals( MMPS_Region::hash( $head['text'] ), MMPS_Region::hash( (string) ( $annotation['replacement_region'] ?? '' ) ) ) ) { return self::error( 'unverified', 'The checked annotation does not match this exact revision.' ); }
			$plan = MMPS_Tiers::plan( $run['bundle'], $context['root']['prefs'], $run['tier_requested'] );
			$fresh = MMPS_Generator::validate( $annotation, $run['bundle'], $plan, $context['root'], (array) ( $run['validation']['otherProgramIds'] ?? array() ) );
			$validation = array( 'canApprove' => empty( $fresh['blocking'] ) && ! empty( $head['validation']['canApprove'] ), 'segments' => (array) ( $annotation['segments'] ?? array() ), 'factsUsed' => (array) ( $fresh['factsUsed'] ?? array() ) );
		} else {
			$validation = self::validate( $uid, $context, $candidate, $head['text'] );
		}
		if ( is_wp_error( $validation ) ) { return $validation; }
		$similarity = MMPS_Similarity::assess( $uid, $head['text'] );
		if ( is_wp_error( $similarity ) ) { return $similarity; }
		if ( 'EXACT_BLOCKED' === $similarity['status'] ) { return self::error( 'unverified', 'This exact edited revision failed the protected similarity check.' ); }
		if ( ! $validation['canApprove'] ) { return self::error( 'unverified', 'This exact edited revision has not passed grounding and approval authority checks.' ); }
		$candidate['replacement_region'] = $head['text'];
		$candidate['segments'] = $validation['segments'];
		return array( 'candidate' => $candidate, 'revisionId' => $head['id'], 'factsUsed' => $validation['factsUsed'] );
	}
}

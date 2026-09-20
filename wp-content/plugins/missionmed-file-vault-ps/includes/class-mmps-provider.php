<?php
/**
 * AI provider adapters. One small interface: complete( $system, $user_json, $schema )
 * returns array( 'json' => array, 'usage' => array, 'latencyMs' => int ) or WP_Error.
 *
 * Privacy posture of the real adapter: OpenAI Responses API, store:false, no
 * tools, no files, no conversation state, strict JSON schema. The key is read
 * from a wp-config constant and never stored, logged or returned. No retention
 * or zero-data-retention property is claimed here.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Provider {

	public static function status() {
		$configured = defined( 'MMED_PS_PROTO_OPENAI_API_KEY' ) && '' !== trim( (string) MMED_PS_PROTO_OPENAI_API_KEY );
		return array(
			'provider'            => $configured ? 'openai-responses' : ( self::simulator_allowed() ? 'simulator' : 'none' ),
			'model'               => $configured ? self::model() : ( self::simulator_allowed() ? 'offline-simulator' : '' ),
			'configured'          => $configured,
			'simulatorAllowed'    => self::simulator_allowed(),
			'realRootAllowed'     => self::real_root_allowed(),
			'store'               => false,
		);
	}

	public static function model() {
		return defined( 'MMED_PS_PROTO_OPENAI_MODEL' ) && MMED_PS_PROTO_OPENAI_MODEL ? (string) MMED_PS_PROTO_OPENAI_MODEL : 'gpt-5.6-terra';
	}

	/** Founder privacy gate. Real (non-synthetic) student prose reaches the provider only when this is true. */
	public static function real_root_allowed() {
		return defined( 'MMED_PS_PROTO_ALLOW_REAL_ROOT_AI' ) && true === MMED_PS_PROTO_ALLOW_REAL_ROOT_AI;
	}

	public static function simulator_allowed() {
		return defined( 'MMED_PS_PROTO_ALLOW_SIMULATOR' ) && true === MMED_PS_PROTO_ALLOW_SIMULATOR;
	}

	protected static function endpoint() {
		if ( MMPS_Gate::testing() && defined( 'MMED_PS_PROTO_TEST_OPENAI_BASE' ) ) {
			return rtrim( (string) MMED_PS_PROTO_TEST_OPENAI_BASE, '/' ) . '/v1/responses';
		}
		return 'https://api.openai.com/v1/responses';
	}

	public static function complete( $system, $user_payload, $schema, $attempt_context = array() ) {
		$status = self::status();
		if ( 'openai-responses' === $status['provider'] ) {
			return self::openai( $system, $user_payload, $schema, $attempt_context );
		}
		if ( 'simulator' === $status['provider'] ) {
			return MMPS_Provider_Simulator::complete( $user_payload );
		}
		return new WP_Error( 'mmps_provider_not_configured', 'The AI provider is not configured on this site yet. Define MMED_PS_PROTO_OPENAI_API_KEY in wp-config.php.', array( 'status' => 503 ) );
	}

	protected static function openai( $system, $user_payload, $schema, $attempt_context ) {
		$body = array(
			'model'             => self::model(),
			'store'             => false,
			'input'             => array(
				array( 'role' => 'system', 'content' => $system ),
				array( 'role' => 'user', 'content' => wp_json_encode( $user_payload ) ),
			),
			'text'              => array( 'format' => array( 'type' => 'json_schema', 'name' => 'ps_candidate_set_v2', 'strict' => true, 'schema' => $schema ) ),
			'max_output_tokens' => 16000,  // Five polished alternatives plus hidden reasoning share this cap.
			'reasoning'         => array( 'effort' => 'medium' ),
		);
		$started = microtime( true );
		$result  = self::post( $body, $attempt_context );
		if ( is_wp_error( $result ) && 'mmps_provider_bad_request' === $result->get_error_code() ) {
			unset( $body['reasoning'] );            // Some models reject the reasoning block; retry once without it.
			$result = self::post( $body, $attempt_context );
		}
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( 'incomplete' === ( $result['status'] ?? '' ) ) {
			return new WP_Error( 'mmps_provider_incomplete', 'The AI provider stopped before finishing (' . sanitize_text_field( (string) ( $result['incomplete_details']['reason'] ?? 'unknown' ) ) . '). Try again.', array( 'status' => 502 ) );
		}
		$text = '';
		foreach ( (array) ( $result['output'] ?? array() ) as $item ) {
			if ( 'message' !== ( $item['type'] ?? '' ) ) {
				continue;
			}
			foreach ( (array) ( $item['content'] ?? array() ) as $content ) {
				if ( 'output_text' === ( $content['type'] ?? '' ) ) {
					$text .= (string) $content['text'];
				}
			}
		}
		$json = json_decode( $text, true );
		if ( ! is_array( $json ) ) {
			return new WP_Error( 'mmps_provider_output', 'The AI provider returned something that is not the expected JSON.', array( 'status' => 502 ) );
		}
		return array(
			'json'      => $json,
			'usage'     => array( 'in' => absint( $result['usage']['input_tokens'] ?? 0 ), 'out' => absint( $result['usage']['output_tokens'] ?? 0 ) ),
			'latencyMs' => (int) round( ( microtime( true ) - $started ) * 1000 ),
			'provider'  => 'openai-responses',
			'model'     => self::model(),
		);
	}

	protected static function post( $body, $attempt_context ) {
		$reservation = MMPS_Store::reserve_provider_attempt(
			absint( $attempt_context['userId'] ?? 0 ),
			absint( $attempt_context['rootId'] ?? 0 ),
			(string) ( $attempt_context['programSpecialtyId'] ?? '' ),
			(string) ( $attempt_context['idempotencyKey'] ?? '' ),
			MMPS_Generator::DAILY_RUN_CAP
		);
		if ( is_wp_error( $reservation ) ) {
			return $reservation;
		}
		$response = wp_remote_post(
			self::endpoint(),
			array(
				'timeout'     => 50,   // Edge proxies cut a request at about 100 s; see MMPS_Generator::RETRY_BUDGET_MS.
				'redirection' => 0,
				'headers'     => array(
					'Authorization' => 'Bearer ' . trim( (string) MMED_PS_PROTO_OPENAI_API_KEY ),
					'Content-Type'  => 'application/json',
				),
				'body'        => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $response ) ) {
			MMPS_Store::finish_provider_attempt( absint( $attempt_context['userId'] ?? 0 ), $reservation, $response->get_error_code() );
			return new WP_Error( 'mmps_provider_unreachable', 'The AI provider could not be reached. Try again.', array( 'status' => 502 ) );
		}
		$code          = (int) wp_remote_retrieve_response_code( $response );
		$data          = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		$provider_code = is_array( $data ) ? sanitize_key( (string) ( $data['error']['code'] ?? '' ) ) : '';
		$attempt_code  = 'http_' . $code . ( $provider_code ? '_' . $provider_code : '' );
		MMPS_Store::finish_provider_attempt( absint( $attempt_context['userId'] ?? 0 ), $reservation, $attempt_code );
		if ( 400 === $code ) {
			return new WP_Error( 'mmps_provider_bad_request', 'The AI provider rejected the request (400). Check the configured model name.', array( 'status' => 502 ) );
		}
		if ( 401 === $code || 403 === $code ) {
			return new WP_Error( 'mmps_provider_auth', 'The AI provider rejected the configured key.', array( 'status' => 502 ) );
		}
		if ( 429 === $code ) {
			if ( 'credit_balance_exhausted' === $provider_code ) {
				return new WP_Error( 'mmps_provider_credits', 'The dedicated PSV OpenAI project has no available API credits. A project owner must add credits before generation can continue.', array( 'status' => 503 ) );
			}
			if ( in_array( $provider_code, array( 'project_spend_limit_exceeded', 'organization_spend_limit_exceeded', 'organization_usage_limit_exceeded' ), true ) ) {
				return new WP_Error( 'mmps_provider_limit', 'The dedicated PSV OpenAI project has reached an account spending or usage limit. A project owner must raise the approved limit before generation can continue.', array( 'status' => 503 ) );
			}
			return new WP_Error( 'mmps_provider_rate', 'The AI provider is rate limiting. Wait a minute and try again.', array( 'status' => 429 ) );
		}
		if ( 200 !== $code ) {
			return new WP_Error( 'mmps_provider_error', 'The AI provider answered with an error (' . $code . ').', array( 'status' => 502 ) );
		}
		return is_array( $data ) ? $data : new WP_Error( 'mmps_provider_output', 'Unreadable answer from the AI provider.', array( 'status' => 502 ) );
	}
}

/**
 * Offline stand-in used for plumbing tests only (local development, or a live
 * site where the Founder explicitly allows it before the key is set). Its
 * output is labelled SIMULATED everywhere and says nothing about AI writing quality.
 */
class MMPS_Provider_Simulator {

	public static function complete( $payload ) {
		$name     = (string) ( $payload['program']['programName'] ?? 'this program' );
		$name_fact = '';
		foreach ( (array) ( $payload['allowed_facts'] ?? array() ) as $fact ) {
			if ( 'Program name' === ( $fact['label'] ?? '' ) ) {
				$name_fact = (string) $fact['fact_id'];
				break;
			}
		}
		$fixtures = array(
			'TRAINING_ENVIRONMENT'    => array(
				'Training is most useful to me when close observation becomes deliberate practice and feedback changes what I do next.',
				'In this simulated fixture, ' . $name . ' is the named setting where I would continue that cycle of listening, testing, and improving.',
				'I would enter the work with curiosity, steadiness, and a willingness to revise my habits as responsibility grows.',
			),
			'STUDENT_GOAL_FORWARD'    => array(
				'My next step is to turn careful clinical reasoning into decisions that remain humane when the path is uncertain.',
				'This simulated fixture connects that goal with ' . $name . ' without claiming any feature beyond the supplied program name.',
				'I hope to keep building judgment that is both rigorous in the moment and accountable to the person living with its consequences.',
			),
			'RESEARCH_FELLOWSHIP'     => array(
				'I have learned to treat unanswered questions as invitations to examine assumptions rather than decorate them with confidence.',
				'For this simulated fixture, I name ' . $name . ' only as the place where that habit of inquiry would accompany daily clinical work.',
				'The value I would bring is patience with evidence, candor about its limits, and discipline in carrying lessons back to patients.',
			),
			'LOCATION_PROGRAM_TYPE'   => array(
				'The communities surrounding a residency shape which problems become visible and how physicians learn to respond.',
				'This simulated fixture places ' . $name . ' within that reflection while making no unsupported statement about its location or structure.',
				'I would approach each encounter ready to learn the context behind a concern and to adapt care without losing clinical precision.',
			),
			'BALANCED_QUIET_SPECIFIC' => array(
				'What I want from residency is a place where attention, responsibility, and growth remain connected in ordinary clinical work.',
				'In this simulated fixture, ' . $name . ' supplies only the verified program identity and no invented promise about the experience.',
				'I would bring a reflective approach, respect for the people around me, and the persistence to become more useful over time.',
			),
		);
		$candidates = array();
		foreach ( (array) ( $payload['requested_strategies'] ?? array() ) as $index => $strategy ) {
			$key      = (string) ( $strategy['key'] ?? '' );
			$texts    = $fixtures[ $key ] ?? array( 'This is simulated pipeline text.', 'The verified program name is ' . $name . '.', 'No writing-quality conclusion should be drawn from it.' );
			$segments = array(
				array( 'text' => $texts[0], 'kind' => 'student_link', 'fact_ids' => array() ),
				array( 'text' => $texts[1], 'kind' => 'program_fact', 'fact_ids' => $name_fact ? array( $name_fact ) : array() ),
				array( 'text' => $texts[2], 'kind' => 'student_link', 'fact_ids' => array() ),
			);
			$candidates[] = array(
				'candidate_id'       => $key,
				'replacement_region' => implode( ' ', wp_list_pluck( $segments, 'text' ) ),
				'segments'           => $segments,
				'facts_used'         => $name_fact ? array( $name_fact ) : array(),
				'strategy'           => $key,
				'rhetorical_focus'   => 'Simulated ' . $key . ' pipeline fixture.',
				'self_check'         => array( 'name_swap_would_still_work' => true, 'possible_unsupported_claims' => array(), 'generic_phrases' => array() ),
			);
		}
		return array(
			'json'      => array(
				'recommended_candidate_id' => 'BALANCED_QUIET_SPECIFIC',
				'candidates'               => $candidates,
			),
			'usage'     => array( 'in' => 0, 'out' => 0 ),
			'latencyMs' => 1,
			'provider'  => 'simulator',
			'model'     => 'offline-simulator',
		);
	}
}

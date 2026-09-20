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

	public static function complete( $system, $user_payload, $schema ) {
		$status = self::status();
		if ( 'openai-responses' === $status['provider'] ) {
			return self::openai( $system, $user_payload, $schema );
		}
		if ( 'simulator' === $status['provider'] ) {
			return MMPS_Provider_Simulator::complete( $user_payload );
		}
		return new WP_Error( 'mmps_provider_not_configured', 'The AI provider is not configured on this site yet. Define MMED_PS_PROTO_OPENAI_API_KEY in wp-config.php.', array( 'status' => 503 ) );
	}

	protected static function openai( $system, $user_payload, $schema ) {
		$body = array(
			'model'             => self::model(),
			'store'             => false,
			'input'             => array(
				array( 'role' => 'system', 'content' => $system ),
				array( 'role' => 'user', 'content' => wp_json_encode( $user_payload ) ),
			),
			'text'              => array( 'format' => array( 'type' => 'json_schema', 'name' => 'ps_region_v1', 'strict' => true, 'schema' => $schema ) ),
			'max_output_tokens' => 9000,   // Hidden reasoning tokens count against this cap.
			'reasoning'         => array( 'effort' => 'medium' ),
		);
		$started = microtime( true );
		$result  = self::post( $body );
		if ( is_wp_error( $result ) && 'mmps_provider_bad_request' === $result->get_error_code() ) {
			unset( $body['reasoning'] );            // Some models reject the reasoning block; retry once without it.
			$result = self::post( $body );
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

	protected static function post( $body ) {
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
			return new WP_Error( 'mmps_provider_unreachable', 'The AI provider could not be reached. Try again.', array( 'status' => 502 ) );
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( 400 === $code ) {
			return new WP_Error( 'mmps_provider_bad_request', 'The AI provider rejected the request (400). Check the configured model name.', array( 'status' => 502 ) );
		}
		if ( 401 === $code || 403 === $code ) {
			return new WP_Error( 'mmps_provider_auth', 'The AI provider rejected the configured key.', array( 'status' => 502 ) );
		}
		if ( 429 === $code ) {
			return new WP_Error( 'mmps_provider_rate', 'The AI provider is rate limiting. Wait a minute and try again.', array( 'status' => 429 ) );
		}
		if ( 200 !== $code ) {
			return new WP_Error( 'mmps_provider_error', 'The AI provider answered with an error (' . $code . ').', array( 'status' => 502 ) );
		}
		$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );
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
		$segments = array();
		$used     = array();
		$segments[] = array( 'text' => '[SIMULATED placeholder text, not AI writing.] What I have described above is the kind of physician I am trying to become, and it shapes where I hope to train.', 'kind' => 'connective', 'fact_ids' => array() );
		foreach ( (array) ( $payload['allowed_facts'] ?? array() ) as $fact ) {
			if ( 'Program name' === ( $fact['label'] ?? '' ) ) {
				$segments[] = array( 'text' => 'I would be glad to continue that work at ' . $name . '.', 'kind' => 'program_fact', 'fact_ids' => array( $fact['fact_id'] ) );
				$used[]     = $fact['fact_id'];
			} elseif ( 'identity' !== ( $fact['category'] ?? '' ) ) {
				$segments[] = array( 'text' => '[simulated] A verified detail would be woven in here: ' . rtrim( (string) $fact['text'], '.' ) . '.', 'kind' => 'program_fact', 'fact_ids' => array( $fact['fact_id'] ) );
				$used[]     = $fact['fact_id'];
			}
		}
		$segments[] = array( 'text' => 'I would bring the same habit of measuring the gap and closing it to your residents and your patients.', 'kind' => 'student_link', 'fact_ids' => array() );
		$text       = implode( ' ', array_map( function ( $s ) {
			return $s['text'];
		}, $segments ) );
		return array(
			'json'      => array(
				'replacement_region' => $text,
				'segments'           => $segments,
				'facts_used'         => $used,
				'strategy'           => (string) ( $payload['strategy']['key'] ?? '' ),
				'self_check'         => array( 'name_swap_would_still_work' => true, 'possible_unsupported_claims' => array(), 'generic_phrases' => array() ),
			),
			'usage'     => array( 'in' => 0, 'out' => 0 ),
			'latencyMs' => 1,
			'provider'  => 'simulator',
			'model'     => 'offline-simulator',
		);
	}
}

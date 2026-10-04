<?php
/**
 * Plugin Name: Mission Residency Zelle Payment Verifier
 * Description: Fail-closed Mission Residency Zelle verification with administrator and automated-email providers.
 * Version: 2026.10.04.8
 */

defined( 'ABSPATH' ) || exit;

const MM_MR_ZELLE_HQ_ENDPOINT    = 'https://missionmed-hq-production.up.railway.app/api/integrations/gmail/zelle-match';
const MM_MR_ZELLE_CRON_HOOK      = 'mm_mr_zelle_retry_verification';
const MM_MR_ZELLE_ACTION         = 'mm_mr_zelle_verify_payment';
const MM_MR_ZELLE_ADMIN_ACTION   = 'mm_mr_zelle_admin_review';
const MM_MR_ZELLE_MAX_RETRIES    = 12;
const MM_MR_ZELLE_MODE_OPTION    = 'mmed_mr_zelle_verification_mode';
const MM_MR_ZELLE_MODE_ADMIN     = 'admin_confirmation';
const MM_MR_ZELLE_MODE_AUTOMATED = 'automated_email_match';
const MM_MR_ZELLE_DESTINATION    = 'info@missionmedinstitute.com';
const MM_MR_ZELLE_QUEUE_SLUG     = 'mm-mr-zelle-verification';

function mm_mr_zelle_mode( $order = null ) {
	// Administrative option only; never a request/query parameter.
	if ( $order && absint( get_option( 'mmed_mr_zelle_canary_order', 0 ) ) === $order->get_id() ) {
		return MM_MR_ZELLE_MODE_AUTOMATED;
	}
	$mode = sanitize_key( (string) get_option( MM_MR_ZELLE_MODE_OPTION, MM_MR_ZELLE_MODE_ADMIN ) );
	return in_array( $mode, array( MM_MR_ZELLE_MODE_ADMIN, MM_MR_ZELLE_MODE_AUTOMATED ), true ) ? $mode : MM_MR_ZELLE_MODE_ADMIN;
}

function mm_mr_zelle_qr_url() {
	return content_url( '/mu-plugins/missionmed-mr-0912-assets/media/missionmed-zelle-email-qr.gif' );
}

function mm_mr_zelle_product_map() {
	return array( 5504 => 3646, 5867 => 3646, 3576 => 5227, 5865 => 5227 );
}

function mm_mr_zelle_order_identity( $order ) {
	if ( ! $order || 'bacs' !== (string) $order->get_payment_method() || 'USD' !== $order->get_currency() || ! $order->get_user_id() ) {
		return false;
	}
	$items = $order->get_items( 'line_item' );
	if ( 1 !== count( $items ) || '' === mm_mr_zelle_amount( $order->get_total() ) || (float) $order->get_total() <= 0 ) {
		return false;
	}
	$item = reset( $items );
	$pairs = array( 5504 => array( 5867, 3646 ), 3576 => array( 5865, 5227 ) );
	$parent = absint( $item->get_product_id() );
	if ( ! isset( $pairs[ $parent ] ) || $pairs[ $parent ][0] !== absint( $item->get_variation_id() ) || 1.0 !== (float) $item->get_quantity() ) {
		return false;
	}
	return array( 'product_id' => $parent, 'variation_id' => $pairs[ $parent ][0], 'course_id' => $pairs[ $parent ][1] );
}

function mm_mr_zelle_amount( $value ) {
	$value = trim( (string) $value );
	if ( ! preg_match( '/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/D', $value, $m ) ) {
		return '';
	}
	return $m[1] . '.' . str_pad( $m[2] ?? '', 2, '0' );
}

function mm_mr_zelle_is_pending_order( $order ) {
	return (bool) mm_mr_zelle_order_identity( $order ) && ! $order->is_paid() && $order->has_status( array( 'pending', 'on-hold' ) );
}

function mm_mr_zelle_authorized_order() {
	if ( ! function_exists( 'wc_get_order' ) ) {
		return false;
	}
	$order_id = absint( get_query_var( 'order-received' ) );
	if ( ! $order_id && isset( $_REQUEST['order_id'] ) ) {
		$order_id = absint( wp_unslash( $_REQUEST['order_id'] ) );
	}
	if ( ! $order_id ) {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		if ( preg_match( '#/checkout/order-received/([0-9]+)/?#', $request_uri, $matches ) ) {
			$order_id = absint( $matches[1] );
		}
	}
	$order = wc_get_order( $order_id );
	if ( ! $order || ! mm_mr_zelle_order_identity( $order ) ) {
		return false;
	}
	$key = isset( $_REQUEST['key'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['key'] ) ) : '';
	if ( $key && hash_equals( (string) $order->get_order_key(), $key ) ) {
		return $order;
	}
	if ( is_user_logged_in() && absint( $order->get_user_id() ) === get_current_user_id() ) {
		return $order;
	}
	return current_user_can( 'manage_woocommerce' ) ? $order : false;
}

function mm_mr_zelle_secret() {
	if ( function_exists( 'mmhq_handoff_secret' ) ) {
		return trim( (string) mmhq_handoff_secret() );
	}
	$secret = trim( (string) getenv( 'MMHQ_HANDOFF_SECRET' ) );
	return $secret ?: ( defined( 'MMHQ_HANDOFF_SECRET' ) ? trim( (string) MMHQ_HANDOFF_SECRET ) : '' );
}

function mm_mr_zelle_payer_display( $value ) {
	$value = sanitize_text_field( (string) $value );
	return trim( preg_replace( '/\s+/', ' ', $value ) );
}

function mm_mr_zelle_normalize_payer( $value ) {
	$value = mm_mr_zelle_payer_display( $value );
	if ( class_exists( 'Normalizer' ) ) {
		$value = Normalizer::normalize( $value, Normalizer::FORM_KC );
	}
	$value = function_exists( 'mb_strtolower' ) ? mb_strtolower( $value, 'UTF-8' ) : strtolower( $value );
	return trim( preg_replace( '/\s+/u', ' ', (string) $value ) );
}

function mm_mr_zelle_audit( $order, $state, $detail = '' ) {
	$history   = $order->get_meta( '_mm_zelle_audit', true );
	$history   = is_array( $history ) ? $history : array();
	$history[] = array( 'at' => time(), 'state' => sanitize_key( $state ), 'detail' => sanitize_key( $detail ), 'user' => get_current_user_id() );
	$order->update_meta_data( '_mm_zelle_audit', array_slice( $history, -50 ) );
}

/* All claim/approval operations share one connection-bound, crash-releasing
 * advisory lock. A DB reconnect loses custody and fails closed before payment. */
function mm_mr_zelle_lock_name() {
	global $wpdb;
	return 'mm_zelle_v2_' . substr( hash( 'sha256', $wpdb->prefix . ( defined( 'DB_NAME' ) ? DB_NAME : '' ) ), 0, 24 );
}

function mm_mr_zelle_lock_owned() {
	global $wpdb;
	return '1' === (string) $wpdb->get_var( $wpdb->prepare( 'SELECT IS_USED_LOCK(%s) = CONNECTION_ID()', mm_mr_zelle_lock_name() ) );
}

function mm_mr_zelle_with_lock( $callback ) {
	global $wpdb;
	static $depth = 0;
	if ( $depth ) {
		return mm_mr_zelle_lock_owned() ? $callback() : false;
	}
	if ( '1' !== (string) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', mm_mr_zelle_lock_name() ) ) ) {
		return false;
	}
	++$depth;
	try {
		return $callback();
	} finally {
		--$depth;
		$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', mm_mr_zelle_lock_name() ) );
	}
}

function mm_mr_zelle_eligible_order_ids( $order, $payer ) {
	// Bounded full candidate scan; an incomplete scan must never claim uniqueness.
	$result = wc_get_orders( array( 'status' => array( 'wc-pending', 'wc-on-hold' ), 'payment_method' => 'bacs', 'limit' => 101, 'paginate' => true, 'orderby' => 'ID', 'order' => 'ASC' ) );
	if ( ! is_object( $result ) || ! isset( $result->orders, $result->total ) || $result->total > 100 ) {
		return array();
	}
	$ids = array();
	foreach ( $result->orders as $candidate ) {
		if ( ! mm_mr_zelle_is_pending_order( $candidate ) || mm_mr_zelle_amount( $candidate->get_total() ) !== mm_mr_zelle_amount( $order->get_total() ) ) {
			continue;
		}
		$claimed = mm_mr_zelle_normalize_payer( $candidate->get_meta( '_mm_zelle_payer', true ) );
		// An unclaimed matching billing identity is also ambiguous; do not choose
		// the first claimed order when another likely destination already exists.
		$name = $claimed ?: mm_mr_zelle_normalize_payer( $candidate->get_formatted_billing_full_name() );
		if ( hash_equals( $payer, $name ) ) {
			$ids[] = (int) $candidate->get_id();
		}
	}
	sort( $ids, SORT_NUMERIC );
	return $ids;
}

function mm_mr_zelle_call_hq( $order, $payer_name ) {
	$secret = mm_mr_zelle_secret();
	$eligible = mm_mr_zelle_eligible_order_ids( $order, $payer_name );
	if ( array( $order->get_id() ) !== $eligible ) {
		return array( 'ok' => true, 'state' => 'needs_review', 'error' => 'order_ambiguity' );
	}
	if ( '' === $secret ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'shared_secret_missing' );
	}
	$created = $order->get_date_created();
	$payload = array(
		'protocol_version' => 2,
		'currency' => 'USD',
		'order_id' => $order->get_id(),
		'expected_amount' => mm_mr_zelle_amount( $order->get_total() ),
		'payer_name' => $payer_name,
		'order_created_epoch' => $created ? $created->getTimestamp() : 0,
		'eligible_order_ids' => $eligible,
		// The permanent atomic ledger at completion is authoritative; never a
		// truncated/HPOS-dependent list of historical order metadata.
		'consumed_fingerprints' => array(),
	);
	$timestamp = (string) time();
	$nonce = bin2hex( random_bytes( 16 ) );
	$canonical = implode( "\n", array( $timestamp, $nonce, (string) $payload['order_id'], $payload['expected_amount'], $payer_name, (string) $payload['order_created_epoch'], '2', 'USD', wp_json_encode( $eligible ), '[]' ) );
	$response = wp_remote_post( MM_MR_ZELLE_HQ_ENDPOINT, array(
		'timeout' => 12, 'redirection' => 0,
		'headers' => array( 'Content-Type' => 'application/json', 'X-MMED-Zelle-Timestamp' => $timestamp, 'X-MMED-Zelle-Nonce' => $nonce, 'X-MMED-Zelle-Signature' => hash_hmac( 'sha256', $canonical, $secret ) ),
		'body' => wp_json_encode( $payload ),
	) );
	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'hq_request_failed' );
	}
	$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $decoded ) || true !== ( $decoded['ok'] ?? false ) ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'hq_response_invalid' );
	}
	if ( 'verified' === ( $decoded['state'] ?? '' ) && ( 2 !== ( $decoded['protocol_version'] ?? 0 ) || 1 !== ( $decoded['match_count'] ?? 0 ) || 'gmail_chase_dkim_dmarc_pass' !== ( $decoded['authentication'] ?? '' ) || ! preg_match( '/^[a-f0-9]{64}$/D', (string) ( $decoded['fingerprint'] ?? '' ) ) || ! preg_match( '/^[a-f0-9]{64}$/D', (string) ( $decoded['message_fingerprint'] ?? '' ) ) || (int) ( $decoded['received_epoch'] ?? 0 ) < $payload['order_created_epoch'] ) ) {
		return array( 'ok' => false, 'state' => 'needs_review', 'error' => 'evidence_invalid' );
	}
	return $decoded;
}

function mm_mr_zelle_reference_fingerprint( $reference ) {
	$reference = trim( (string) $reference );
	return preg_match( '/^[A-Za-z0-9-]{4,80}$/D', $reference ) ? hash( 'sha256', "chase-zelle-v2\n" . MM_MR_ZELLE_DESTINATION . "\n" . $reference ) : '';
}

/* One permanent financial ledger for both providers. Never remove on refund. */
function mm_mr_zelle_claim_reference( $order, $reference, $kind = '' ) {
	if ( ! mm_mr_zelle_lock_owned() || ! preg_match( '/^[a-f0-9]{64}$/D', $reference ) ) {
		return false;
	}
	if ( ! add_option( 'mm_zelle_transaction_v2_' . $reference, (string) $order->get_id(), '', false ) ) {
		return false;
	}
	$order->update_meta_data( '_mm_zelle_fingerprint', $reference );
	return true;
}

function mm_mr_zelle_complete_payment( $order, $reference, $source, $mode = '' ) {
	return mm_mr_zelle_with_lock( function () use ( $order, $reference, $source, $mode ) {
		$order = wc_get_order( $order->get_id() );
		if ( ! $order ) {
			return false;
		}
		if ( $order->is_paid() ) {
			return 'verified' === $order->get_meta( '_mm_zelle_state', true ) && hash_equals( (string) $order->get_meta( '_mm_zelle_fingerprint', true ), $reference );
		}
		if ( ! mm_mr_zelle_is_pending_order( $order ) || ! $order->get_meta( '_mm_zelle_requested_at', true ) || mm_mr_zelle_amount( $order->get_total() ) !== $order->get_meta( '_mm_zelle_expected_amount', true ) ) {
			return false;
		}
		if ( MM_MR_ZELLE_MODE_AUTOMATED === $mode ) {
			$payer = mm_mr_zelle_normalize_payer( $order->get_meta( '_mm_zelle_payer', true ) );
			if ( $order->get_meta( '_mm_zelle_review_hold', true ) || MM_MR_ZELLE_MODE_AUTOMATED !== mm_mr_zelle_mode( $order ) || array( $order->get_id() ) !== mm_mr_zelle_eligible_order_ids( $order, $payer ) || ! hash_equals( (string) $order->get_meta( '_mm_zelle_candidate_fingerprint', true ), $reference ) ) {
				return false;
			}
		} elseif ( MM_MR_ZELLE_MODE_ADMIN !== $mode || ! current_user_can( 'manage_woocommerce' ) || 'admin_confirmed' !== $source ) {
			return false;
		}
		if ( ! mm_mr_zelle_lock_owned() || ! mm_mr_zelle_claim_reference( $order, $reference ) ) {
			mm_mr_zelle_audit( $order, 'replay_rejected', $source );
			$order->save();
			return false;
		}
		$order->update_meta_data( '_mm_zelle_state', 'completing' );
		$order->update_meta_data( '_mm_zelle_verification_mode', $mode );
		mm_mr_zelle_audit( $order, 'financial_evidence_verified', $source );
		$order->save();
		$order_id = $order->get_id();
		try {
			// Canonical hooks own entitlement and email; no synthetic transaction ID.
			$order->payment_complete();
			$order = wc_get_order( $order->get_id() );
			if ( ! $order || ! $order->is_paid() ) {
				if ( $order ) {
					$order->update_meta_data( '_mm_zelle_state', 'needs_review' );
					mm_mr_zelle_audit( $order, 'completion_failed', $source );
					$order->save();
				}
				return false;
			}
			$order->update_meta_data( '_mm_zelle_state', 'verified' );
			$order->update_meta_data( '_mm_zelle_verified_at', time() );
			mm_mr_zelle_audit( $order, 'woo_payment_completed', $source );
			$identity = mm_mr_zelle_order_identity( $order );
			$course_access = $identity && function_exists( 'sfwd_lms_has_access' ) ? sfwd_lms_has_access( $identity['course_id'], $order->get_user_id() ) : null;
			mm_mr_zelle_audit( $order, 'entitlement_observed', true === $course_access ? 'target_course_present' : ( false === $course_access ? 'target_course_missing' : 'course_check_unavailable' ) );
			$order->save();
			$order->add_order_note( 'Mission Residency Zelle receipt verified via ' . $mode . '. Canonical Woo payment completion invoked. Transaction fingerprint retained for replay protection; no bank transaction ID fabricated.' );
			wp_clear_scheduled_hook( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
			return true;
		} catch ( Throwable $error ) {
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$order->update_meta_data( '_mm_zelle_state', 'needs_review' );
				$order->update_meta_data( '_mm_zelle_review_hold', 'completion_exception' );
				mm_mr_zelle_audit( $order, 'completion_failed', 'exception' );
				$order->save();
			}
			return false;
		}
	} );
}

function mm_mr_zelle_schedule_retry( $order ) {
	if ( ! mm_mr_zelle_is_pending_order( $order ) || $order->get_meta( '_mm_zelle_review_hold', true ) || MM_MR_ZELLE_MODE_AUTOMATED !== mm_mr_zelle_mode( $order ) || absint( $order->get_meta( '_mm_zelle_retry_count', true ) ) >= MM_MR_ZELLE_MAX_RETRIES || wp_next_scheduled( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) ) ) {
		return;
	}
	wp_schedule_single_event( time() + 300, MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
}

function mm_mr_zelle_run_verification( $order, $payer_name, $source = 'request' ) {
	$result = mm_mr_zelle_with_lock( function () use ( $order, $payer_name, $source ) {
		$order = wc_get_order( $order->get_id() );
		if ( ! mm_mr_zelle_is_pending_order( $order ) || $order->get_meta( '_mm_zelle_review_hold', true ) || ! $order->get_meta( '_mm_zelle_requested_at', true ) || MM_MR_ZELLE_MODE_AUTOMATED !== mm_mr_zelle_mode( $order ) || ! hash_equals( mm_mr_zelle_normalize_payer( $order->get_meta( '_mm_zelle_payer', true ) ), $payer_name ) ) {
			return 'locked';
		}
		$retries = absint( $order->get_meta( '_mm_zelle_retry_count', true ) );
		if ( $retries >= MM_MR_ZELLE_MAX_RETRIES ) {
			$order->update_meta_data( '_mm_zelle_state', 'needs_review' );
			$order->update_meta_data( '_mm_zelle_review_hold', 'retry_limit' );
			wp_clear_scheduled_hook( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
			mm_mr_zelle_audit( $order, 'needs_review', 'retry_limit' );
			$order->save();
			return 'needs_review';
		}
		$order->update_meta_data( '_mm_zelle_retry_count', $retries + 1 );
		$order->save();
		try {
			$result = mm_mr_zelle_call_hq( $order, $payer_name );
		} catch ( Throwable $error ) {
			$result = array( 'state' => 'provider_unavailable' );
		}
		if ( ! mm_mr_zelle_lock_owned() ) {
			return 'locked';
		}
		$order = wc_get_order( $order->get_id() );
		if ( ! mm_mr_zelle_is_pending_order( $order ) ) {
			return 'locked';
		}
		$state = sanitize_key( (string) ( $result['state'] ?? 'provider_unavailable' ) );
		if ( 'verified' === $state ) {
			$order->update_meta_data( '_mm_zelle_candidate_fingerprint', $result['fingerprint'] );
			$order->update_meta_data( '_mm_zelle_reference_masked', sanitize_text_field( $result['reference_masked'] ?? '' ) );
			$order->update_meta_data( '_mm_zelle_email_received_at', (int) $result['received_epoch'] );
			$order->update_meta_data( '_mm_zelle_email_processed_at', time() );
			$order->update_meta_data( '_mm_zelle_message_fingerprint', $result['message_fingerprint'] );
			mm_mr_zelle_audit( $order, 'email_authenticated', 'chase_dkim_dmarc' );
			$order->save();
			if ( mm_mr_zelle_complete_payment( $order, $result['fingerprint'], $source, MM_MR_ZELLE_MODE_AUTOMATED ) ) {
				return 'verified';
			}
			$state = 'needs_review';
		}
		if ( ! in_array( $state, array( 'not_found', 'provider_unavailable', 'needs_review', 'already_consumed' ), true ) ) {
			$state = 'needs_review';
		}
		// The final unsuccessful attempt must enter review now, not depend on
		// a thirteenth request after the scheduler has already stopped.
		$retry_exhausted = in_array( $state, array( 'not_found', 'provider_unavailable' ), true ) && $retries + 1 >= MM_MR_ZELLE_MAX_RETRIES;
		if ( $retry_exhausted ) {
			$state = 'needs_review';
		}
		$order = wc_get_order( $order->get_id() );
		if ( $order && ! $order->is_paid() ) {
			$order->update_meta_data( '_mm_zelle_state', $state );
			if ( in_array( $state, array( 'needs_review', 'already_consumed' ), true ) ) {
				$order->update_meta_data( '_mm_zelle_review_hold', $retry_exhausted ? 'retry_limit' : $state );
				wp_clear_scheduled_hook( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
			}
			mm_mr_zelle_audit( $order, $state, $retry_exhausted ? 'retry_limit' : ( $result['error'] ?? $source ) );
			$order->save();
			if ( in_array( $state, array( 'not_found', 'provider_unavailable' ), true ) ) {
				mm_mr_zelle_schedule_retry( $order );
			}
		}
		return $state;
	} );
	if ( false === $result ) {
		mm_mr_zelle_schedule_retry( $order );
		return 'checking';
	}
	return $result;
}

function mm_mr_zelle_queue_url( $order_id = 0 ) {
	$url = admin_url( 'admin.php?page=' . MM_MR_ZELLE_QUEUE_SLUG );
	return $order_id ? add_query_arg( 'order_id', absint( $order_id ), $url ) : $url;
}

function mm_mr_zelle_notify_admin( $order ) {
	$items   = $order->get_items( 'line_item' );
	$item    = reset( $items );
	$product = $item ? $item->get_name() : 'Mission Residency';
	$body    = implode(
		"\n",
		array(
			'ZELLE PAYMENT VERIFICATION REQUEST',
			'',
			'Order: #' . $order->get_order_number(),
			'Student: ' . trim( $order->get_formatted_billing_full_name() ),
			'Program: ' . $product,
			'Expected amount: ' . wp_strip_all_tags( $order->get_formatted_order_total() ),
			'Zelle sender: ' . (string) $order->get_meta( '_mm_zelle_payer', true ),
			'Requested: ' . wp_date( 'Y-m-d H:i:s T', absint( $order->get_meta( '_mm_zelle_requested_at', true ) ) ),
			'',
			'REVIEW ZELLE PAYMENT: ' . mm_mr_zelle_queue_url( $order->get_id() ),
			'',
			'This link requires an authenticated administrator with WooCommerce management permission.',
		)
	);
	$recipient = get_option( 'mmed_mr_zelle_admin_notification_email', get_option( 'admin_email' ) );
	$sent = mm_mr_zelle_protected_mail( 'wp_mail', $recipient, 'ZELLE PAYMENT VERIFICATION REQUEST — ORDER #' . $order->get_order_number(), $body );
	$order->update_meta_data( '_mm_zelle_admin_notification', $sent ? 'sent' : 'failed' );
	$order->update_meta_data( '_mm_zelle_admin_notified_at', time() );
	mm_mr_zelle_audit( $order, $sent ? 'admin_notified' : 'admin_notification_failed', 'admin_confirmation' );
	$order->save();
	return $sent;
}

function mm_mr_zelle_record_claim( $order, $payer_display ) {
	return mm_mr_zelle_with_lock( function () use ( $order, $payer_display ) {
		$order = wc_get_order( $order->get_id() );
		if ( ! mm_mr_zelle_is_pending_order( $order ) ) {
			return false;
		}
		$payer = mm_mr_zelle_normalize_payer( $payer_display );
		if ( strlen( $payer ) < 2 || strlen( $payer ) > 120 ) {
			return false;
		}
		$existing = mm_mr_zelle_normalize_payer( $order->get_meta( '_mm_zelle_payer', true ) );
		if ( $order->get_meta( '_mm_zelle_requested_at', true ) ) {
			mm_mr_zelle_audit( $order, 'duplicate_claim', $existing === $payer ? 'idempotent' : 'payer_change_review' );
			if ( $existing !== $payer ) {
				$order->update_meta_data( '_mm_zelle_state', 'needs_review' );
				$order->update_meta_data( '_mm_zelle_review_hold', 'payer_change' );
				wp_clear_scheduled_hook( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
			}
			$order->save();
			return $existing === $payer;
		}
		$order->update_meta_data( '_mm_zelle_payer', mm_mr_zelle_payer_display( $payer_display ) );
		$order->update_meta_data( '_mm_zelle_payer_normalized', $payer );
		$order->update_meta_data( '_mm_zelle_requested_at', time() );
		$order->update_meta_data( '_mm_zelle_expected_amount', mm_mr_zelle_amount( $order->get_total() ) );
		$order->update_meta_data( '_mm_zelle_verification_mode', mm_mr_zelle_mode( $order ) );
		$order->update_meta_data( '_mm_zelle_retry_count', 0 );
		$order->update_meta_data( '_mm_zelle_state', 'awaiting_admin' );
		mm_mr_zelle_audit( $order, 'claim_recorded', 'customer_request' );
		$order->save();
		return true;
	} );
}

function mm_mr_zelle_handle_request() {
	$order = mm_mr_zelle_authorized_order();
	$nonce = isset( $_POST['_mm_zelle_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_mm_zelle_nonce'] ) ) : '';
	if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) || ! $order || ! mm_mr_zelle_is_pending_order( $order ) || ! wp_verify_nonce( $nonce, 'mm_zelle_' . $order->get_id() ) ) {
		wp_die( esc_html__( 'This payment verification request is not available or has expired.', 'missionmed' ), 'Invalid request', array( 'response' => 403 ) );
	}
	$payer_display = mm_mr_zelle_payer_display( isset( $_POST['payer_name'] ) ? wp_unslash( $_POST['payer_name'] ) : '' );
	$rate_key = 'mm_zelle_rate_' . $order->get_id();
	$count = absint( get_transient( $rate_key ) );
	if ( $count < 5 ) {
		set_transient( $rate_key, $count + 1, 15 * MINUTE_IN_SECONDS );
		if ( mm_mr_zelle_record_claim( $order, $payer_display ) ) {
			$order = wc_get_order( $order->get_id() );
			if ( ! $order->get_meta( '_mm_zelle_admin_notified_at', true ) ) {
				mm_mr_zelle_notify_admin( $order );
			}
			if ( MM_MR_ZELLE_MODE_AUTOMATED === mm_mr_zelle_mode( $order ) ) {
				mm_mr_zelle_run_verification( $order, mm_mr_zelle_normalize_payer( $order->get_meta( '_mm_zelle_payer', true ) ), 'request' );
			}
		} else {
			wc_add_notice( __( 'We could not record that request. Please check the payer name and try again shortly, or contact support.', 'missionmed' ), 'error' );
		}
	} else {
		wc_add_notice( __( 'Please wait before submitting another verification request.', 'missionmed' ), 'notice' );
	}
	wp_safe_redirect( $order->get_checkout_order_received_url() );
	exit;
}

add_action( 'admin_post_' . MM_MR_ZELLE_ACTION, 'mm_mr_zelle_handle_request' );
add_action( 'admin_post_nopriv_' . MM_MR_ZELLE_ACTION, 'mm_mr_zelle_handle_request' );

function mm_mr_zelle_retry( $order_id ) {
	$order = function_exists( 'wc_get_order' ) ? wc_get_order( absint( $order_id ) ) : false;
	if ( ! $order || ! mm_mr_zelle_is_pending_order( $order ) || MM_MR_ZELLE_MODE_AUTOMATED !== mm_mr_zelle_mode( $order ) ) {
		return;
	}
	$payer = mm_mr_zelle_normalize_payer( $order->get_meta( '_mm_zelle_payer', true ) );
	if ( strlen( $payer ) >= 2 ) {
		mm_mr_zelle_run_verification( $order, $payer, 'cron' );
	}
}

add_action( MM_MR_ZELLE_CRON_HOOK, 'mm_mr_zelle_retry', 10, 1 );

function mm_mr_zelle_admin_confirm( $order, $bank_reference, $attested ) {
	if ( ! current_user_can( 'manage_woocommerce' ) || true !== $attested || ! $order ) {
		return false;
	}
	$fingerprint = mm_mr_zelle_reference_fingerprint( $bank_reference );
	if ( ! $fingerprint ) {
		return false;
	}
	return mm_mr_zelle_complete_payment( $order, $fingerprint, 'admin_confirmed', MM_MR_ZELLE_MODE_ADMIN );
}

function mm_mr_zelle_handle_admin_review() {
	if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) || ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'You are not allowed to review Zelle payments.', 'missionmed' ), 'Forbidden', array( 'response' => 403 ) );
	}
	$order_id = isset( $_POST['order_id'] ) ? absint( wp_unslash( $_POST['order_id'] ) ) : 0;
	$order = function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : false;
	$decision = isset( $_POST['decision'] ) ? sanitize_key( wp_unslash( $_POST['decision'] ) ) : '';
	$nonce = isset( $_POST['_mm_zelle_admin_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_mm_zelle_admin_nonce'] ) ) : '';
	if ( ! $order || ! mm_mr_zelle_order_identity( $order ) || ! wp_verify_nonce( $nonce, 'mm_zelle_admin_' . $order_id ) ) {
		wp_die( esc_html__( 'The Zelle review request is invalid or expired.', 'missionmed' ), 'Invalid request', array( 'response' => 403 ) );
	}
	if ( 'verify_activate' === $decision ) {
		$reference = isset( $_POST['bank_reference'] ) ? trim( (string) wp_unslash( $_POST['bank_reference'] ) ) : '';
		$attested = '1' === ( $_POST['receipt_confirmed'] ?? '' );
		if ( ! mm_mr_zelle_admin_confirm( $order, $reference, $attested ) ) {
			wp_die( esc_html__( 'Verification was not completed. Check the actual received bank transaction, amount, sender, reference and pending order. Do not send or record another payment.', 'missionmed' ), 'Activation blocked', array( 'response' => 409 ) );
		}
	} else {
		$states = array( 'continue_waiting' => 'awaiting_admin', 'not_match' => 'not_found', 'needs_review' => 'needs_review' );
		mm_mr_zelle_with_lock( function () use ( $order_id, $decision, $states ) {
			$order = wc_get_order( $order_id );
			if ( mm_mr_zelle_is_pending_order( $order ) && isset( $states[ $decision ] ) ) {
				$order->update_meta_data( '_mm_zelle_state', $states[ $decision ] );
				$order->update_meta_data( '_mm_zelle_review_hold', 'admin_review' );
				wp_clear_scheduled_hook( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
				mm_mr_zelle_audit( $order, $states[ $decision ], 'admin_review' );
				$order->save();
			}
		} );
	}
	wp_safe_redirect( mm_mr_zelle_queue_url( $order_id ) );
	exit;
}

add_action( 'admin_post_' . MM_MR_ZELLE_ADMIN_ACTION, 'mm_mr_zelle_handle_admin_review' );

function mm_mr_zelle_admin_review_form( $order ) {
	$state      = sanitize_key( (string) $order->get_meta( '_mm_zelle_state', true ) ) ?: 'awaiting_payment';
	$mode       = sanitize_key( (string) $order->get_meta( '_mm_zelle_verification_mode', true ) ) ?: mm_mr_zelle_mode();
	$can_verify = mm_mr_zelle_is_pending_order( $order ) && (bool) $order->get_meta( '_mm_zelle_requested_at', true );
	$items      = $order->get_items( 'line_item' );
	$item       = reset( $items );
	?>
	<div class="mmz-admin-review" style="max-width:850px;background:#fff;padding:24px;border:1px solid #ccd0d4;border-radius:8px">
		<h2><?php esc_html_e( 'ZELLE PAYMENT REVIEW', 'missionmed' ); ?></h2>
		<table class="widefat striped"><tbody>
		<tr><th>ORDER</th><td>#<?php echo esc_html( $order->get_order_number() ); ?></td></tr>
		<tr><th>EXPECTED PAYMENT</th><td><?php echo wp_kses_post( $order->get_formatted_order_total() ); ?></td></tr>
		<tr><th>STUDENT</th><td><?php echo esc_html( trim( $order->get_formatted_billing_full_name() ) ); ?></td></tr>
		<tr><th>PROGRAM</th><td><?php echo esc_html( $item ? $item->get_name() : 'Mission Residency' ); ?></td></tr>
		<tr><th>ZELLE SENDER</th><td><?php echo esc_html( (string) $order->get_meta( '_mm_zelle_payer', true ) ?: 'Not submitted' ); ?></td></tr>
		<tr><th>REQUESTED</th><td><?php echo esc_html( $order->get_meta( '_mm_zelle_requested_at', true ) ? wp_date( 'Y-m-d H:i:s T', absint( $order->get_meta( '_mm_zelle_requested_at', true ) ) ) : 'Not submitted' ); ?></td></tr>
		<tr><th>CURRENT STATE</th><td><?php echo esc_html( strtoupper( str_replace( '_', ' ', $state ) ) ); ?></td></tr>
		<tr><th>VERIFICATION MODE</th><td><?php echo esc_html( strtoupper( str_replace( '_', ' ', $mode ) ) ); ?></td></tr>
		</tbody></table>
		<?php if ( ! $order->is_paid() ) : ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap">
			<input type="hidden" name="action" value="<?php echo esc_attr( MM_MR_ZELLE_ADMIN_ACTION ); ?>">
			<input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>">
			<?php wp_nonce_field( 'mm_zelle_admin_' . $order->get_id(), '_mm_zelle_admin_nonce' ); ?>
			<p style="flex-basis:100%">Check the actual received Chase transaction before approving. Match the exact amount and submitted sender to this order. Never approve a request or screenshot as payment evidence.</p>
			<label style="flex-basis:100%">Chase transaction number <input name="bank_reference" type="text" maxlength="80" autocomplete="off"></label>
			<label style="flex-basis:100%"><input name="receipt_confirmed" type="checkbox" value="1"> I checked the received payment, exact amount and sender in Chase, and this payment belongs to this order.</label>
			<button class="button button-primary" name="decision" value="verify_activate" type="submit" <?php disabled( ! $can_verify ); ?>>VERIFY PAYMENT &amp; ACTIVATE →</button>
			<button class="button" name="decision" value="not_match" type="submit">PAYMENT NOT FOUND</button>
			<button class="button" name="decision" value="continue_waiting" type="submit">KEEP WAITING</button>
			<button class="button" name="decision" value="needs_review" type="submit">NEEDS REVIEW</button>
		</form>
		<?php endif; ?>
		<?php if ( ! $can_verify && ! $order->is_paid() ) : ?><p><em>Activation remains disabled until a valid verification request has been securely recorded.</em></p><?php endif; ?>
	</div>
	<?php
}

function mm_mr_zelle_admin_panel( $order ) {
	if ( current_user_can( 'manage_woocommerce' ) && mm_mr_zelle_order_identity( $order ) ) {
		echo '<div class="order_data_column" style="width:100%;padding-top:18px">';
		mm_mr_zelle_admin_review_form( $order );
		echo '</div>';
	}
}
add_action( 'woocommerce_admin_order_data_after_order_details', 'mm_mr_zelle_admin_panel', 30, 1 );

function mm_mr_zelle_admin_menu() {
	add_submenu_page( 'woocommerce', 'Zelle verification', 'Zelle verification', 'manage_woocommerce', MM_MR_ZELLE_QUEUE_SLUG, 'mm_mr_zelle_render_queue' );
}
add_action( 'admin_menu', 'mm_mr_zelle_admin_menu' );

function mm_mr_zelle_render_queue() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'You are not allowed to review Zelle payments.', 'missionmed' ), 'Forbidden', array( 'response' => 403 ) );
	}
	echo '<div class="wrap"><h1>Zelle payment verification</h1><p><strong>Production mode:</strong> ' . esc_html( strtoupper( str_replace( '_', ' ', mm_mr_zelle_mode() ) ) ) . '</p>';
	$order_id = isset( $_GET['order_id'] ) ? absint( wp_unslash( $_GET['order_id'] ) ) : 0;
	if ( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $order && mm_mr_zelle_order_identity( $order ) ) {
			mm_mr_zelle_admin_review_form( $order );
		} else {
			echo '<div class="notice notice-error"><p>That Zelle order is not available.</p></div>';
		}
		echo '</div>';
		return;
	}
	$orders = wc_get_orders( array( 'status' => array( 'wc-on-hold', 'wc-pending' ), 'limit' => 100, 'orderby' => 'date', 'order' => 'DESC' ) );
	echo '<table class="widefat striped"><thead><tr><th>Order</th><th>Student</th><th>Expected</th><th>Sender</th><th>State</th><th>Requested</th><th></th></tr></thead><tbody>';
	$count = 0;
	foreach ( $orders as $order ) {
		if ( ! mm_mr_zelle_order_identity( $order ) || ! $order->get_meta( '_mm_zelle_payer', true ) ) {
			continue;
		}
		++$count;
		$state_label = strtoupper( str_replace( '_', ' ', (string) $order->get_meta( '_mm_zelle_state', true ) ) );
		$requested   = $order->get_meta( '_mm_zelle_requested_at', true ) ? wp_date( 'Y-m-d H:i:s T', absint( $order->get_meta( '_mm_zelle_requested_at', true ) ) ) : '—';
		echo '<tr><td>#' . esc_html( $order->get_order_number() ) . '</td><td>' . esc_html( trim( $order->get_formatted_billing_full_name() ) ) . '</td><td>' . wp_kses_post( $order->get_formatted_order_total() ) . '</td><td>' . esc_html( (string) $order->get_meta( '_mm_zelle_payer', true ) ) . '</td><td>' . esc_html( $state_label ) . '</td><td>' . esc_html( $requested ) . '</td><td><a class="button" href="' . esc_url( mm_mr_zelle_queue_url( $order->get_id() ) ) . '">Review</a></td></tr>';
	}
	if ( ! $count ) {
		echo '<tr><td colspan="7">No pending Zelle verification requests.</td></tr>';
	}
	echo '</tbody></table></div>';
}

function mm_mr_zelle_is_inactive_order( $order ) {
	return (bool) mm_mr_zelle_order_identity( $order ) && ! $order->is_paid() && $order->has_status( array( 'cancelled', 'failed', 'refunded' ) );
}

function mm_mr_zelle_render_inactive( $order_id ) {
	static $rendered = false;
	$order = wc_get_order( absint( $order_id ) );
	$authorized = mm_mr_zelle_authorized_order();
	if ( $rendered || ! mm_mr_zelle_is_inactive_order( $order ) || ! $authorized || $authorized->get_id() !== $order->get_id() ) {
		return;
	}
	$rendered = true;
	echo '<style>.woocommerce-order-received .mmps-shell,.woocommerce-order-received .woocommerce-thankyou-order-received,.woocommerce-order-received a[href*="/member-dashboard/"]{display:none!important}.woocommerce .mmz-inactive{max-width:880px;margin:24px auto;padding:28px;border:2px solid #65737c;border-radius:12px;background:#0d1d24;color:#fff}.woocommerce .mmz-inactive h2,.woocommerce .mmz-inactive p{color:#fff!important}.woocommerce .mmz-inactive a{color:#f6d79a!important;text-decoration:underline}.mmz-inactive a:focus-visible{outline:3px solid #fff;outline-offset:3px}</style><section class="mmz-inactive" role="status"><h2>THIS ORDER IS NOT ACTIVE</h2><p>This order is closed or could not be completed. It does not confirm enrollment or activate program access. Do not send a payment for this order.</p><p>For help with your enrollment, <a href="' . esc_url( home_url( '/contact/' ) ) . '">contact MissionMed</a>.</p></section>';
}

function mm_mr_zelle_render_verified_badge( $order_id ) {
	static $rendered = false;
	if ( $rendered || ! function_exists( 'wc_get_order' ) ) {
		return;
	}
	$order = wc_get_order( absint( $order_id ) );
	if ( ! $order || ! $order->is_paid() || ! mm_mr_zelle_order_identity( $order ) || 'verified' !== (string) $order->get_meta( '_mm_zelle_state', true ) ) {
		return;
	}
	$rendered = true;
	echo '<style>.woocommerce-order-received .woocommerce-thankyou-order-received{display:none!important}.woocommerce .mmz-verified{box-sizing:border-box;overflow-wrap:anywhere}.woocommerce .mmz-verified strong,.woocommerce .mmz-verified h2,.woocommerce .mmz-verified p{color:#123c2c!important}.woocommerce .mmz-verified a{color:#fff!important;box-sizing:border-box;max-width:100%}.mmz-verified a:focus-visible{outline:3px solid #123c2c;outline-offset:3px}</style><section class="mmz-verified" role="status" style="max-width:880px;margin:24px auto 0;padding:24px;border:2px solid #1f7955;border-radius:12px;background:#eaf8f1;color:#123c2c;text-align:center"><strong style="display:block;font-size:22px;letter-spacing:.08em">PAYMENT VERIFIED</strong><h2 style="color:#123c2c;margin:10px 0">YOU\'RE IN.</h2><p>Your Mission Residency enrollment is now active.</p><a style="display:inline-block;margin-top:8px;padding:12px 18px;border-radius:8px;background:#123c2c;color:#fff" href="' . esc_url( home_url( '/member-dashboard/' ) ) . '">ENTER MATRIX DASHBOARD →</a></section>';
}

function mm_mr_zelle_render_pending( $order_id ) {
	static $rendered = false;
	if ( $rendered ) {
		return;
	}
	$order = wc_get_order( absint( $order_id ) );
	$authorized = mm_mr_zelle_authorized_order();
	if ( ! $order || ! mm_mr_zelle_is_pending_order( $order ) || ! $authorized || $authorized->get_id() !== $order->get_id() ) {
		return;
	}
	$rendered  = true;
	$state     = sanitize_key( (string) $order->get_meta( '_mm_zelle_state', true ) ) ?: 'pending';
	$submitted = in_array( $state, array( 'awaiting_admin', 'checking', 'not_found', 'provider_unavailable', 'needs_review', 'already_consumed', 'completing' ), true );
	$title     = $submitted ? 'PAYMENT SUBMITTED FOR VERIFICATION' : 'ONE LAST STEP: COMPLETE YOUR ZELLE PAYMENT';
	$labels    = array(
		'awaiting_admin' => 'Awaiting confirmation',
		'checking' => 'Checking your payment',
		'not_found' => 'No match yet - we will check again',
		'provider_unavailable' => 'Verification delayed - we will check again',
		'needs_review' => 'Awaiting administrator review',
		'already_consumed' => 'Awaiting administrator review',
		'completing' => 'Confirming your enrollment',
	);
	$status_label = $labels[ $state ] ?? 'Awaiting verification';
	?>
	<style>
	.woocommerce-order-received a[href*="/member-dashboard/"],.woocommerce-order-received .woocommerce-thankyou-order-received{display:none!important}.mmz-shell{max-width:880px;margin:28px auto;padding:clamp(24px,5vw,52px);background:#0d1d24;color:#f8f4ea;border-radius:20px;font-family:Arial,sans-serif;box-sizing:border-box}.woocommerce .mmz-shell,.woocommerce .mmz-shell p,.woocommerce .mmz-shell .mmz-alert,.woocommerce .mmz-shell .mmz-note,.woocommerce .mmz-shell .mmz-card,.woocommerce .mmz-shell .mmz-form label{color:#f8f4ea!important}.mmz-kicker{color:#dcbf86!important;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.mmz-shell h2{color:#fff!important;font-size:clamp(30px,5vw,52px);line-height:1.03;margin:12px 0}.mmz-shell p{font-size:17px;line-height:1.6}.mmz-shell .mmz-alert strong{color:#fff!important}.mmz-shell a{color:#f6d79a!important;text-decoration:underline;text-underline-offset:3px}.mmz-shell a:focus-visible{outline:3px solid #fff;outline-offset:3px}.mmz-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.mmz-card{border:1px solid rgba(255,255,255,.35);padding:16px;border-radius:12px}.mmz-card strong{display:block;color:#dcbf86!important;margin-bottom:5px}.mmz-payment{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,300px);gap:24px;align-items:center;margin:24px 0}.mmz-id{font-size:clamp(18px,2.5vw,26px);font-weight:800;color:#fff;overflow-wrap:anywhere}.mmz-copy{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:12px;padding:10px 18px;border:2px solid #dcbf86;border-radius:8px;background:transparent;color:#fff;font-weight:800;cursor:pointer}.mmz-copy:focus-visible{outline:3px solid #fff;outline-offset:3px}.mmz-qr-wrap{padding:16px;background:#fff;border-radius:16px;text-align:center}.mmz-qr{display:block;width:100%;height:auto;max-width:444px;margin:auto}.mmz-form{margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,.35)}.mmz-form label{display:block;font-weight:700;margin-bottom:8px}.woocommerce .mmz-shell .mmz-form input{width:100%;min-height:50px;padding:12px;border:2px solid #c8d2d7!important;border-radius:8px;box-sizing:border-box;background:#fff!important;color:#0d1d24!important;caret-color:#0d1d24}.woocommerce .mmz-shell .mmz-form input:focus{border-color:#dcbf86!important;outline:3px solid #f6d79a!important;outline-offset:3px;box-shadow:0 0 0 4px #f6d79a!important}.woocommerce .mmz-shell .mmz-form input::placeholder{color:#46565e!important;opacity:1}.woocommerce .mmz-shell .mmz-form button{margin-top:12px;min-height:50px;padding:12px 20px;border:0;border-radius:8px;background:#dcbf86!important;color:#0d1d24!important;font-weight:800;cursor:pointer}.woocommerce .mmz-shell .mmz-form button:focus-visible{outline:3px solid #fff!important;outline-offset:3px}.mmz-note{color:#f8f4ea!important}.mmz-alert{padding:12px;border-left:4px solid #dcbf86;background:rgba(255,255,255,.10)}@media(max-width:600px){.mmz-shell{margin:16px 0;border-radius:14px}.mmz-grid,.mmz-payment{grid-template-columns:1fr}.mmz-payment-info{order:-1}.mmz-id{font-size:20px}.mmz-copy,.mmz-form button{width:100%}.mmz-qr-wrap{max-width:260px;margin:auto}}
	</style>
	<section class="mmz-shell" aria-labelledby="mmz-title">
		<div class="mmz-kicker">Mission Residency enrollment</div>
		<h2 id="mmz-title"><?php echo esc_html( $title ); ?></h2>
		<?php if ( $submitted ) : ?>
			<p class="mmz-alert"><strong>You're all set for now.</strong> We'll verify your Zelle payment and email you as soon as your Mission Residency access is activated.</p>
			<div class="mmz-grid">
				<div class="mmz-card"><strong>Order</strong>#<?php echo esc_html( $order->get_order_number() ); ?></div>
				<div class="mmz-card"><strong>Amount</strong><?php echo wp_kses_post( $order->get_formatted_order_total() ); ?></div>
				<div class="mmz-card"><strong>Zelle sender</strong><?php echo esc_html( (string) $order->get_meta( '_mm_zelle_payer', true ) ?: 'Submitted' ); ?></div>
				<div class="mmz-card"><strong>Status</strong><?php echo esc_html( $status_label ); ?></div>
			</div>
			<p class="mmz-note">Your program access will remain locked until payment is confirmed. You may close this page. Do not send a second payment.</p>
		<?php else : ?>
			<p class="mmz-alert">Your order has been created, but your enrollment is <strong>not active yet</strong>. Complete your Zelle payment below. Your program access will activate after your payment is verified.</p>
			<div class="mmz-grid"><div class="mmz-card"><strong>Order</strong>#<?php echo esc_html( $order->get_order_number() ); ?></div><div class="mmz-card"><strong>Amount due</strong><?php echo wp_kses_post( $order->get_formatted_order_total() ); ?></div></div>
			<div class="mmz-payment">
				<div class="mmz-payment-info"><div class="mmz-kicker">Pay with Zelle</div><p>Mission Global Group LLC<br>Zelle email</p><div id="mmz-id" class="mmz-id"><?php echo esc_html( MM_MR_ZELLE_DESTINATION ); ?></div><button class="mmz-copy" type="button" data-copy="<?php echo esc_attr( MM_MR_ZELLE_DESTINATION ); ?>">COPY</button><p>Send the exact amount shown above. You may also use Zelle ID <strong style="color:#fff">missionmed</strong>.</p></div>
				<div class="mmz-qr-wrap"><div class="mmz-kicker" style="color:#0d1d24!important;margin-bottom:8px">Scan to pay</div><img class="mmz-qr" src="<?php echo esc_url( mm_mr_zelle_qr_url() ); ?>" width="399" height="399" alt="Chase Zelle QR for Mission Global Group LLC: info@missionmedinstitute.com"></div>
			</div>
			<form class="mmz-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( MM_MR_ZELLE_ACTION ); ?>"><input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>"><input type="hidden" name="key" value="<?php echo esc_attr( $order->get_order_key() ); ?>">
				<?php wp_nonce_field( 'mm_zelle_' . $order->get_id(), '_mm_zelle_nonce' ); ?>
				<label for="mmz-payer">Full name used to send the Zelle payment</label><input id="mmz-payer" name="payer_name" type="text" autocomplete="name" maxlength="120" required><button type="submit">I'VE SENT MY ZELLE PAYMENT →</button>
			</form>
			<p class="mmz-note">The button records a verification request only. It does not activate enrollment.</p>
			<script>(function(){var b=document.querySelector('.mmz-copy');if(!b)return;b.addEventListener('click',function(){var v=b.getAttribute('data-copy'),done=function(){b.textContent='COPIED';setTimeout(function(){b.textContent='COPY';},1800);},fallback=function(){var t=document.createElement('textarea');t.value=v;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();done();};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(v).then(done).catch(fallback);}else{fallback();}});}());</script>
		<?php endif; ?>
	</section>
	<?php
}

// Use the existing Woo customer email. Only paid, exact Mission Residency Zelle
// orders receive program next steps; pending emails and other commerce do not.
function mm_mr_zelle_email_next_steps( $order, $sent_to_admin, $plain_text, $email ) {
	if ( $sent_to_admin || ! $order || ! $order->is_paid() || ! mm_mr_zelle_order_identity( $order ) || ! $email || ! in_array( $email->id, array( 'customer_processing_order', 'customer_completed_order' ), true ) ) {
		return;
	}
	$identity = mm_mr_zelle_order_identity( $order );
	$complete = 5227 === $identity['course_id'];
	$title = $complete ? 'IV Prep Complete' : 'Interview Bootcamp Week';
	$description = $complete
		? 'Interview Bootcamp Week is included as your opening phase, October 8-18, 2026. Your full-season training then continues through your final interviews in February.'
		: 'Your live online Interview Bootcamp Week runs October 8-18, 2026.';
	$matrix = home_url( '/member-dashboard/#dashboard' );
	$course = get_permalink( $identity['course_id'] );
	if ( $plain_text ) {
		echo "\n" . $title . " - Your next steps\n" . $description . "\nSign in with the MissionMed account used for enrollment.\nOpen your Matrix: " . esc_url( $matrix ) . "\nOpen your program: " . esc_url( $course ) . "\nFor joining details or access questions: " . esc_url( home_url( '/contact/' ) ) . "\n";
	} else {
		echo '<h2>' . esc_html( $title ) . ' - Your next steps</h2><p>' . esc_html( $description ) . '</p><p>Sign in with the MissionMed account used for enrollment.</p><p><a href="' . esc_url( $matrix ) . '">Open your Matrix</a> &middot; <a href="' . esc_url( $course ) . '">Open your program</a></p><p>For joining details or access questions, <a href="' . esc_url( home_url( '/contact/' ) ) . '">contact MissionMed</a>.</p>';
	}
}
add_action( 'woocommerce_email_after_order_table', 'mm_mr_zelle_email_next_steps', 20, 4 );

function mm_mr_zelle_protected_mail( $callback, ...$args ) {
	// Reuse DR-342/343's authenticated, fail-closed Workspace route. Do not
	// silently fall back to unsigned default mail if that guard is unavailable.
	if ( ! function_exists( 'missionmed_protected_mail_restore_transport' ) ) {
		return false;
	}
	$prior = $GLOBALS['missionmed_system_smtp_active'] ?? false;
	$GLOBALS['missionmed_system_smtp_active'] = true;
	try {
		return $callback( ...$args );
	} finally {
		$GLOBALS['missionmed_system_smtp_active'] = $prior;
	}
}

function mm_mr_zelle_customer_mail_callback( $callback, $email ) {
	$order = $email->object ?? null;
	if ( ! $order instanceof WC_Order || ! $order->is_paid() || ! mm_mr_zelle_order_identity( $order ) || ! in_array( $email->id, array( 'customer_processing_order', 'customer_completed_order' ), true ) ) {
		return $callback;
	}
	return function ( ...$args ) use ( $callback ) { return mm_mr_zelle_protected_mail( $callback, ...$args ); };
}
add_filter( 'woocommerce_mail_callback', 'mm_mr_zelle_customer_mail_callback', 20, 2 );

function mm_mr_zelle_order_detail_styles() {
	// The inherited Woo table skin uses light headings on a light surface.
	// Restrict this correction to authorized MR Zelle order-received views.
	if ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() || ! mm_mr_zelle_authorized_order() ) {
		return;
	}
	echo '<style id="mm-zelle-order-details">.woocommerce-order-received .woocommerce-order-details,.woocommerce-order-received .woocommerce-customer-details{background:#fff!important;color:#142b35!important}.woocommerce-order-received .woocommerce-order-details :is(h2,table,th,td,a,span,strong),.woocommerce-order-received .woocommerce-customer-details :is(h2,address,p,span){color:#142b35!important}body.woocommerce-order-received .woocommerce-order-details .woocommerce-table :is(th,td){color:#142b35!important;background:#fff!important}.woocommerce-order-received .woocommerce-order-overview,.woocommerce-order-received .woocommerce-order-overview li,.woocommerce-order-received .woocommerce-order-overview strong{color:#142b35!important}.woocommerce-order-received .woocommerce-order-details a{text-decoration:underline}.woocommerce-order-received .woocommerce-order-details a:focus-visible{outline:3px solid #142b35;outline-offset:3px}</style>';
}
add_action( 'wp_head', 'mm_mr_zelle_order_detail_styles', 100 );

add_action(
	'wp',
	function () {
		$order = mm_mr_zelle_authorized_order();
		if ( ! $order ) {
			// Do not let the older generic confirmation disclose a protected order
			// or claim enrollment when its customer authorization is invalid.
			$received_id = absint( get_query_var( 'order-received' ) );
			if ( $received_id && mm_mr_zelle_order_identity( wc_get_order( $received_id ) ) ) {
				remove_action( 'woocommerce_before_thankyou', 'mmps_render_order', 1 );
				remove_action( 'woocommerce_thankyou', 'mmps_render_order', 1 );
				remove_action( 'wp_footer', 'mmps_footer_fallback', 5 );
			}
			return;
		}
		if ( mm_mr_zelle_is_inactive_order( $order ) ) {
			remove_action( 'woocommerce_before_thankyou', 'mmps_render_order', 1 );
			remove_action( 'woocommerce_thankyou', 'mmps_render_order', 1 );
			remove_action( 'wp_footer', 'mmps_footer_fallback', 5 );
			if ( function_exists( 'WC' ) && WC()->payment_gateways() ) {
				$gateways = WC()->payment_gateways()->payment_gateways();
				if ( isset( $gateways['bacs'] ) ) {
					remove_action( 'woocommerce_thankyou_bacs', array( $gateways['bacs'], 'thankyou_page' ) );
				}
			}
			add_action( 'woocommerce_before_thankyou', 'mm_mr_zelle_render_inactive', 1, 1 );
			add_action( 'woocommerce_thankyou', 'mm_mr_zelle_render_inactive', 1, 1 );
			return;
		}
		if ( $order->is_paid() && 'verified' === (string) $order->get_meta( '_mm_zelle_state', true ) ) {
			remove_action( 'woocommerce_before_thankyou', 'mmps_render_order', 1 );
			remove_action( 'woocommerce_thankyou', 'mmps_render_order', 1 );
			remove_action( 'wp_footer', 'mmps_footer_fallback', 5 );
			if ( function_exists( 'WC' ) && WC()->payment_gateways() ) {
				$gateways = WC()->payment_gateways()->payment_gateways();
				if ( isset( $gateways['bacs'] ) ) {
					remove_action( 'woocommerce_thankyou_bacs', array( $gateways['bacs'], 'thankyou_page' ) );
				}
			}
			add_action( 'woocommerce_before_thankyou', 'mm_mr_zelle_render_verified_badge', 0, 1 );
			add_action( 'woocommerce_thankyou', 'mm_mr_zelle_render_verified_badge', 0, 1 );
			return;
		}
		if ( ! mm_mr_zelle_is_pending_order( $order ) ) {
			return;
		}
		remove_action( 'woocommerce_before_thankyou', 'mmps_render_order', 1 );
		remove_action( 'woocommerce_thankyou', 'mmps_render_order', 1 );
		remove_action( 'wp_footer', 'mmps_footer_fallback', 5 );
		if ( function_exists( 'WC' ) && WC()->payment_gateways() ) {
			$gateways = WC()->payment_gateways()->payment_gateways();
			if ( isset( $gateways['bacs'] ) ) {
				remove_action( 'woocommerce_thankyou_bacs', array( $gateways['bacs'], 'thankyou_page' ) );
			}
		}
		add_action( 'woocommerce_before_thankyou', 'mm_mr_zelle_render_pending', 1, 1 );
		add_action( 'woocommerce_thankyou', 'mm_mr_zelle_render_pending', 1, 1 );
	},
	100
);

<?php
/**
 * Plugin Name: Mission Residency Zelle Payment Verifier
 * Description: Fail-closed Mission Residency Zelle verification with administrator and automated-email providers.
 * Version: 2026.09.29.2
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
const MM_MR_ZELLE_DESTINATION    = 'missionmed';
const MM_MR_ZELLE_QUEUE_SLUG     = 'mm-mr-zelle-verification';

function mm_mr_zelle_mode() {
	$mode = sanitize_key( (string) get_option( MM_MR_ZELLE_MODE_OPTION, MM_MR_ZELLE_MODE_ADMIN ) );
	return in_array( $mode, array( MM_MR_ZELLE_MODE_ADMIN, MM_MR_ZELLE_MODE_AUTOMATED ), true ) ? $mode : MM_MR_ZELLE_MODE_ADMIN;
}

function mm_mr_zelle_qr_url() {
	return content_url( '/mu-plugins/missionmed-mr-0912-assets/media/missionmed-zelle-qr.png' );
}

function mm_mr_zelle_product_map() {
	return array( 5504 => 3646, 5867 => 3646, 3576 => 5227, 5865 => 5227 );
}

function mm_mr_zelle_order_identity( $order ) {
	if ( ! $order || 'bacs' !== (string) $order->get_payment_method() ) {
		return false;
	}
	$items = $order->get_items( 'line_item' );
	if ( 1 !== count( $items ) ) {
		return false;
	}
	$item = reset( $items );
	$ids  = array_filter( array( absint( $item->get_product_id() ), absint( $item->get_variation_id() ) ) );
	$map  = mm_mr_zelle_product_map();
	foreach ( $ids as $id ) {
		if ( isset( $map[ $id ] ) ) {
			return array( 'product_id' => $id, 'course_id' => $map[ $id ] );
		}
	}
	return false;
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
	$value = strtolower( remove_accents( mm_mr_zelle_payer_display( $value ) ) );
	$value = preg_replace( "/[^a-z0-9' -]/", ' ', $value );
	return trim( preg_replace( '/\s+/', ' ', (string) $value ) );
}

function mm_mr_zelle_audit( $order, $state, $detail = '' ) {
	$history   = $order->get_meta( '_mm_zelle_audit', true );
	$history   = is_array( $history ) ? $history : array();
	$history[] = array( 'at' => time(), 'state' => sanitize_key( $state ), 'detail' => sanitize_key( $detail ), 'user' => get_current_user_id() );
	$order->update_meta_data( '_mm_zelle_audit', array_slice( $history, -50 ) );
}

function mm_mr_zelle_consumed_fingerprints() {
	global $wpdb;
	$values = $wpdb->get_col( $wpdb->prepare( "SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value REGEXP %s LIMIT 250", '_mm_zelle_fingerprint', '^[a-f0-9]{64}$' ) );
	return array_values( array_filter( array_map( 'strval', is_array( $values ) ? $values : array() ) ) );
}

/* Preserved dormant automated-email provider. */
function mm_mr_zelle_call_hq( $order, $payer_name ) {
	$secret = mm_mr_zelle_secret();
	if ( '' === $secret ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'shared_secret_missing' );
	}
	$created = $order->get_date_created();
	$payload = array(
		'order_id' => $order->get_id(),
		'expected_amount' => number_format( (float) $order->get_total(), 2, '.', '' ),
		'payer_name' => $payer_name,
		'order_created_epoch' => $created ? $created->getTimestamp() : 0,
		'consumed_fingerprints' => mm_mr_zelle_consumed_fingerprints(),
	);
	$timestamp = (string) time();
	$nonce     = bin2hex( random_bytes( 16 ) );
	$canonical = implode( "\n", array( $timestamp, $nonce, (string) $payload['order_id'], $payload['expected_amount'], $payer_name, (string) $payload['order_created_epoch'] ) );
	$response  = wp_remote_post(
		MM_MR_ZELLE_HQ_ENDPOINT,
		array(
			'timeout' => 12,
			'redirection' => 0,
			'headers' => array(
				'Content-Type' => 'application/json',
				'X-MMED-Zelle-Timestamp' => $timestamp,
				'X-MMED-Zelle-Nonce' => $nonce,
				'X-MMED-Zelle-Signature' => hash_hmac( 'sha256', $canonical, $secret ),
			),
			'body' => wp_json_encode( $payload ),
		)
	);
	if ( is_wp_error( $response ) ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'hq_request_failed' );
	}
	$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );
	return is_array( $decoded ) ? $decoded : array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'hq_response_invalid' );
}

function mm_mr_zelle_claim_reference( $order, $reference, $kind ) {
	if ( ! preg_match( '/^[a-f0-9]{64}$/', $reference ) ) {
		return false;
	}
	$key      = 'mm_zelle_' . sanitize_key( $kind ) . '_' . $reference;
	$existing = get_option( $key, '' );
	if ( '' !== (string) $existing && absint( $existing ) !== $order->get_id() ) {
		return false;
	}
	if ( '' === (string) $existing && ! add_option( $key, (string) $order->get_id(), '', false ) ) {
		return false;
	}
	$order->update_meta_data( 'automated' === $kind ? '_mm_zelle_fingerprint' : '_mm_zelle_admin_claim', $reference );
	return true;
}

/* Both providers converge here. Admin confirmation never fabricates a bank transaction ID. */
function mm_mr_zelle_complete_payment( $order, $reference, $source, $mode = '' ) {
	if ( $order->is_paid() ) {
		return true;
	}
	$mode = $mode ?: sanitize_key( (string) $order->get_meta( '_mm_zelle_verification_mode', true ) );
	$mode = $mode ?: mm_mr_zelle_mode();
	$kind = MM_MR_ZELLE_MODE_AUTOMATED === $mode ? 'automated' : 'admin';
	if ( ! mm_mr_zelle_claim_reference( $order, $reference, $kind ) ) {
		return false;
	}
	$order->update_meta_data( '_mm_zelle_state', 'verified' );
	$order->update_meta_data( '_mm_zelle_verified_at', time() );
	$order->update_meta_data( '_mm_zelle_verification_mode', $mode );
	mm_mr_zelle_audit( $order, 'verified', $source );
	$order->save();
	if ( MM_MR_ZELLE_MODE_AUTOMATED === $mode ) {
		$order->payment_complete( 'zelle_' . substr( $reference, 0, 16 ) );
		$order->add_order_note( 'Mission Residency Zelle payment verified from deterministic automated financial evidence. Canonical Woo payment completion initiated access processing.' );
	} else {
		$order->payment_complete();
		$order->add_order_note( 'An authorized MissionMed administrator confirmed the Zelle receipt in the banking workflow. Canonical Woo payment completion initiated access processing. No bank transaction identifier was fabricated or stored.' );
	}
	return $order->is_paid();
}

function mm_mr_zelle_schedule_retry( $order ) {
	if ( MM_MR_ZELLE_MODE_AUTOMATED !== mm_mr_zelle_mode() || $order->is_paid() || wp_next_scheduled( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) ) ) {
		return;
	}
	wp_schedule_single_event( time() + 300, MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
}

function mm_mr_zelle_run_verification( $order, $payer_name, $source = 'request' ) {
	if ( MM_MR_ZELLE_MODE_AUTOMATED !== mm_mr_zelle_mode() || ! mm_mr_zelle_is_pending_order( $order ) ) {
		return 'locked';
	}
	$lock_key = 'mm_zelle_lock_' . $order->get_id();
	if ( ! add_option( $lock_key, (string) time(), '', false ) ) {
		return 'checking';
	}
	try {
		$result = mm_mr_zelle_call_hq( $order, $payer_name );
		$state  = sanitize_key( (string) ( $result['state'] ?? 'provider_unavailable' ) );
		if ( 'verified' === $state ) {
			$fingerprint = strtolower( (string) ( $result['fingerprint'] ?? '' ) );
			$order->update_meta_data( '_mm_zelle_candidate_fingerprint', $fingerprint );
			$order->update_meta_data( '_mm_zelle_reference_masked', sanitize_text_field( (string) ( $result['reference_masked'] ?? '' ) ) );
			$order->save();
			if ( mm_mr_zelle_complete_payment( $order, $fingerprint, $source, MM_MR_ZELLE_MODE_AUTOMATED ) ) {
				return 'verified';
			}
			$state = 'already_consumed';
		}
		$order->update_meta_data( '_mm_zelle_state', $state );
		mm_mr_zelle_audit( $order, $state, $source );
		$order->save();
		if ( in_array( $state, array( 'not_found', 'provider_unavailable' ), true ) ) {
			mm_mr_zelle_schedule_retry( $order );
		}
		return $state;
	} finally {
		delete_option( $lock_key );
	}
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
	$sent = wp_mail( get_option( 'admin_email' ), 'ZELLE PAYMENT VERIFICATION REQUEST — ORDER #' . $order->get_order_number(), $body );
	$order->update_meta_data( '_mm_zelle_admin_notification', $sent ? 'sent' : 'failed' );
	$order->update_meta_data( '_mm_zelle_admin_notified_at', time() );
	mm_mr_zelle_audit( $order, $sent ? 'admin_notified' : 'admin_notification_failed', 'admin_confirmation' );
	$order->save();
	return $sent;
}

function mm_mr_zelle_handle_request() {
	$order = mm_mr_zelle_authorized_order();
	if ( ! $order || ! mm_mr_zelle_is_pending_order( $order ) ) {
		wp_die( esc_html__( 'This payment verification request is not available.', 'missionmed' ), 403 );
	}
	$nonce = isset( $_POST['_mm_zelle_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_mm_zelle_nonce'] ) ) : '';
	if ( ! wp_verify_nonce( $nonce, 'mm_zelle_' . $order->get_id() ) ) {
		wp_die( esc_html__( 'The verification request expired. Return to the order page and try again.', 'missionmed' ), 403 );
	}
	$payer_display = mm_mr_zelle_payer_display( isset( $_POST['payer_name'] ) ? wp_unslash( $_POST['payer_name'] ) : '' );
	$payer         = mm_mr_zelle_normalize_payer( $payer_display );
	if ( strlen( $payer ) < 2 || strlen( $payer ) > 120 ) {
		wc_add_notice( __( 'Enter the full name used to send the Zelle payment.', 'missionmed' ), 'error' );
		wp_safe_redirect( $order->get_checkout_order_received_url() );
		exit;
	}
	$rate_key = 'mm_zelle_rate_' . hash( 'sha256', $order->get_id() . '|' . (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
	$count    = absint( get_transient( $rate_key ) );
	if ( $count >= 5 ) {
		wc_add_notice( __( 'Your verification request is already recorded. Please wait before trying again.', 'missionmed' ), 'notice' );
		wp_safe_redirect( $order->get_checkout_order_received_url() );
		exit;
	}
	set_transient( $rate_key, $count + 1, 15 * MINUTE_IN_SECONDS );
	$mode = mm_mr_zelle_mode();
	$order->update_meta_data( '_mm_zelle_payer', $payer_display );
	$order->update_meta_data( '_mm_zelle_payer_normalized', $payer );
	$order->update_meta_data( '_mm_zelle_requested_at', time() );
	$order->update_meta_data( '_mm_zelle_expected_amount', number_format( (float) $order->get_total(), 2, '.', '' ) );
	$order->update_meta_data( '_mm_zelle_verification_mode', $mode );
	$order->update_meta_data( '_mm_zelle_retry_count', 0 );
	if ( MM_MR_ZELLE_MODE_ADMIN === $mode ) {
		$token = hash_hmac( 'sha256', $order->get_id() . '|' . $order->get_total() . '|' . $payer . '|' . time() . '|' . $order->get_order_key(), wp_salt( 'auth' ) );
		$order->update_meta_data( '_mm_zelle_admin_request_token', $token );
		$order->update_meta_data( '_mm_zelle_state', 'awaiting_admin' );
		mm_mr_zelle_audit( $order, 'awaiting_admin', 'customer_request' );
		$order->save();
		mm_mr_zelle_notify_admin( $order );
	} else {
		$order->update_meta_data( '_mm_zelle_state', 'checking' );
		mm_mr_zelle_audit( $order, 'checking', 'request' );
		$order->save();
		mm_mr_zelle_run_verification( $order, $payer, 'request' );
	}
	wp_safe_redirect( $order->get_checkout_order_received_url() );
	exit;
}
add_action( 'admin_post_' . MM_MR_ZELLE_ACTION, 'mm_mr_zelle_handle_request' );
add_action( 'admin_post_nopriv_' . MM_MR_ZELLE_ACTION, 'mm_mr_zelle_handle_request' );

function mm_mr_zelle_retry( $order_id ) {
	if ( MM_MR_ZELLE_MODE_AUTOMATED !== mm_mr_zelle_mode() ) {
		return;
	}
	$order = function_exists( 'wc_get_order' ) ? wc_get_order( absint( $order_id ) ) : false;
	if ( ! $order || ! mm_mr_zelle_is_pending_order( $order ) ) {
		return;
	}
	$payer   = mm_mr_zelle_normalize_payer( $order->get_meta( '_mm_zelle_payer', true ) );
	$retries = absint( $order->get_meta( '_mm_zelle_retry_count', true ) );
	if ( strlen( $payer ) < 2 || $retries >= MM_MR_ZELLE_MAX_RETRIES ) {
		$order->update_meta_data( '_mm_zelle_state', 'needs_review' );
		mm_mr_zelle_audit( $order, 'needs_review', 'retry_limit' );
		$order->save();
		return;
	}
	$order->update_meta_data( '_mm_zelle_retry_count', $retries + 1 );
	$order->save();
	mm_mr_zelle_run_verification( $order, $payer, 'cron' );
}
add_action( MM_MR_ZELLE_CRON_HOOK, 'mm_mr_zelle_retry', 10, 1 );

function mm_mr_zelle_handle_admin_review() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'You are not allowed to review Zelle payments.', 'missionmed' ), 'Forbidden', array( 'response' => 403 ) );
	}
	$order_id = isset( $_POST['order_id'] ) ? absint( wp_unslash( $_POST['order_id'] ) ) : 0;
	$order    = function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : false;
	$decision = isset( $_POST['decision'] ) ? sanitize_key( wp_unslash( $_POST['decision'] ) ) : '';
	$nonce    = isset( $_POST['_mm_zelle_admin_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_mm_zelle_admin_nonce'] ) ) : '';
	if ( ! $order || ! mm_mr_zelle_order_identity( $order ) || ! wp_verify_nonce( $nonce, 'mm_zelle_admin_' . $order_id ) ) {
		wp_die( esc_html__( 'The Zelle review request is invalid or expired.', 'missionmed' ), 'Invalid request', array( 'response' => 403 ) );
	}
	if ( $order->is_paid() ) {
		wp_safe_redirect( mm_mr_zelle_queue_url( $order_id ) );
		exit;
	}
	if ( 'continue_waiting' === $decision ) {
		$order->update_meta_data( '_mm_zelle_state', 'awaiting_admin' );
		mm_mr_zelle_audit( $order, 'awaiting_admin', 'admin_continue' );
		$order->save();
	} elseif ( 'not_match' === $decision ) {
		$order->update_meta_data( '_mm_zelle_state', 'not_found' );
		mm_mr_zelle_audit( $order, 'not_found', 'admin_not_found' );
		$order->save();
	} elseif ( 'needs_review' === $decision ) {
		$order->update_meta_data( '_mm_zelle_state', 'needs_review' );
		mm_mr_zelle_audit( $order, 'needs_review', 'admin_review' );
		$order->save();
	} elseif ( 'verify_activate' === $decision ) {
		$mode      = sanitize_key( (string) $order->get_meta( '_mm_zelle_verification_mode', true ) );
		$reference = MM_MR_ZELLE_MODE_AUTOMATED === $mode ? strtolower( (string) $order->get_meta( '_mm_zelle_candidate_fingerprint', true ) ) : strtolower( (string) $order->get_meta( '_mm_zelle_admin_request_token', true ) );
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $reference ) || ! mm_mr_zelle_complete_payment( $order, $reference, 'admin_confirmed', $mode ) ) {
			mm_mr_zelle_audit( $order, 'already_consumed', 'admin_blocked' );
			$order->save();
			wp_die( esc_html__( 'No unused verification request is available. The order remains unpaid.', 'missionmed' ), 'Activation blocked', array( 'response' => 409 ) );
		}
	}
	wp_safe_redirect( mm_mr_zelle_queue_url( $order_id ) );
	exit;
}
add_action( 'admin_post_' . MM_MR_ZELLE_ADMIN_ACTION, 'mm_mr_zelle_handle_admin_review' );

function mm_mr_zelle_admin_review_form( $order ) {
	$state      = sanitize_key( (string) $order->get_meta( '_mm_zelle_state', true ) ) ?: 'awaiting_payment';
	$mode       = sanitize_key( (string) $order->get_meta( '_mm_zelle_verification_mode', true ) ) ?: mm_mr_zelle_mode();
	$reference  = MM_MR_ZELLE_MODE_AUTOMATED === $mode ? $order->get_meta( '_mm_zelle_candidate_fingerprint', true ) : $order->get_meta( '_mm_zelle_admin_request_token', true );
	$can_verify = ! $order->is_paid() && (bool) preg_match( '/^[a-f0-9]{64}$/', strtolower( (string) $reference ) );
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
	echo '<section class="mmz-verified" role="status" style="max-width:880px;margin:24px auto 0;padding:24px;border:2px solid #1f7955;border-radius:12px;background:#eaf8f1;color:#123c2c;text-align:center"><strong style="display:block;font-size:22px;letter-spacing:.08em">PAYMENT VERIFIED</strong><h2 style="color:#123c2c;margin:10px 0">YOU\'RE IN.</h2><p>Your Mission Residency enrollment is now active.</p><a style="display:inline-block;margin-top:8px;padding:12px 18px;border-radius:8px;background:#123c2c;color:#fff" href="' . esc_url( home_url( '/member-dashboard/' ) ) . '">ENTER MATRIX DASHBOARD →</a></section>';
}

function mm_mr_zelle_render_pending( $order_id ) {
	static $rendered = false;
	if ( $rendered ) {
		return;
	}
	$order = wc_get_order( absint( $order_id ) );
	if ( ! $order || ! mm_mr_zelle_is_pending_order( $order ) || ! mm_mr_zelle_authorized_order() ) {
		return;
	}
	$rendered  = true;
	$state     = sanitize_key( (string) $order->get_meta( '_mm_zelle_state', true ) ) ?: 'pending';
	$submitted = in_array( $state, array( 'awaiting_admin', 'checking', 'not_found', 'provider_unavailable', 'needs_review', 'already_consumed' ), true );
	$title     = $submitted ? 'PAYMENT SUBMITTED FOR VERIFICATION' : 'ONE LAST STEP: COMPLETE YOUR ZELLE PAYMENT';
	?>
	<style>
	.mmz-shell{max-width:880px;margin:28px auto;padding:clamp(24px,5vw,52px);background:#0d1d24;color:#f8f4ea;border-radius:20px;font-family:Arial,sans-serif;box-sizing:border-box}.woocommerce .mmz-shell,.woocommerce .mmz-shell p,.woocommerce .mmz-shell .mmz-alert,.woocommerce .mmz-shell .mmz-note,.woocommerce .mmz-shell .mmz-card,.woocommerce .mmz-shell .mmz-form label{color:#f8f4ea!important}.mmz-kicker{color:#dcbf86!important;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.mmz-shell h2{color:#fff!important;font-size:clamp(30px,5vw,52px);line-height:1.03;margin:12px 0}.mmz-shell p{font-size:17px;line-height:1.6}.mmz-shell .mmz-alert strong{color:#fff!important}.mmz-shell a{color:#f6d79a!important;text-decoration:underline;text-underline-offset:3px}.mmz-shell a:focus-visible{outline:3px solid #fff;outline-offset:3px}.mmz-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.mmz-card{border:1px solid rgba(255,255,255,.35);padding:16px;border-radius:12px}.mmz-card strong{display:block;color:#dcbf86!important;margin-bottom:5px}.mmz-payment{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,300px);gap:24px;align-items:center;margin:24px 0}.mmz-id{font-size:clamp(28px,5vw,42px);font-weight:900;color:#fff}.mmz-copy{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:12px;padding:10px 18px;border:2px solid #dcbf86;border-radius:8px;background:transparent;color:#fff;font-weight:800;cursor:pointer}.mmz-copy:focus-visible{outline:3px solid #fff;outline-offset:3px}.mmz-qr-wrap{padding:16px;background:#fff;border-radius:16px;text-align:center}.mmz-qr{display:block;width:100%;height:auto;max-width:444px;margin:auto}.mmz-form{margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,.35)}.mmz-form label{display:block;font-weight:700;margin-bottom:8px}.woocommerce .mmz-shell .mmz-form input{width:100%;min-height:50px;padding:12px;border:2px solid #c8d2d7!important;border-radius:8px;box-sizing:border-box;background:#fff!important;color:#0d1d24!important;caret-color:#0d1d24}.woocommerce .mmz-shell .mmz-form input:focus{border-color:#dcbf86!important;outline:3px solid #f6d79a!important;outline-offset:3px;box-shadow:none!important}.woocommerce .mmz-shell .mmz-form input::placeholder{color:#46565e!important;opacity:1}.woocommerce .mmz-shell .mmz-form button{margin-top:12px;min-height:50px;padding:12px 20px;border:0;border-radius:8px;background:#dcbf86!important;color:#0d1d24!important;font-weight:800;cursor:pointer}.woocommerce .mmz-shell .mmz-form button:focus-visible{outline:3px solid #fff!important;outline-offset:3px}.mmz-note{color:#f8f4ea!important}.mmz-alert{padding:12px;border-left:4px solid #dcbf86;background:rgba(255,255,255,.10)}@media(max-width:600px){.mmz-shell{margin:16px 0;border-radius:14px}.mmz-grid,.mmz-payment{grid-template-columns:1fr}.mmz-payment-info{order:-1}.mmz-id{font-size:36px}.mmz-copy,.mmz-form button{width:100%}.mmz-qr-wrap{max-width:260px;margin:auto}}
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
				<div class="mmz-card"><strong>Status</strong>Awaiting verification</div>
			</div>
			<p class="mmz-note">Your program access will remain locked until payment is confirmed. You may close this page. Do not send a second payment.</p>
		<?php else : ?>
			<p class="mmz-alert">Your order has been created, but your enrollment is <strong>not active yet</strong>. Complete your Zelle payment below. Your program access will activate after your payment is verified.</p>
			<div class="mmz-grid"><div class="mmz-card"><strong>Order</strong>#<?php echo esc_html( $order->get_order_number() ); ?></div><div class="mmz-card"><strong>Amount due</strong><?php echo wp_kses_post( $order->get_formatted_order_total() ); ?></div></div>
			<div class="mmz-payment">
				<div class="mmz-payment-info"><div class="mmz-kicker">Pay with Zelle</div><p>Zelle ID</p><div id="mmz-id" class="mmz-id"><?php echo esc_html( MM_MR_ZELLE_DESTINATION ); ?></div><button class="mmz-copy" type="button" data-copy="<?php echo esc_attr( MM_MR_ZELLE_DESTINATION ); ?>">COPY</button><p>Send the exact amount shown above.</p></div>
				<div class="mmz-qr-wrap"><div class="mmz-kicker" style="color:#0d1d24!important;margin-bottom:8px">Scan to pay</div><img class="mmz-qr" src="<?php echo esc_url( mm_mr_zelle_qr_url() ); ?>" width="444" height="364" alt="Founder-provided Zelle QR code for MissionMed"></div>
			</div>
			<form class="mmz-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( MM_MR_ZELLE_ACTION ); ?>"><input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>"><input type="hidden" name="key" value="<?php echo esc_attr( $order->get_order_key() ); ?>">
				<?php wp_nonce_field( 'mm_zelle_' . $order->get_id(), '_mm_zelle_nonce' ); ?>
				<label for="mmz-payer">Full name used to send the Zelle payment</label><input id="mmz-payer" name="payer_name" type="text" autocomplete="name" maxlength="120" required><button type="submit">I'VE SENT MY ZELLE PAYMENT →</button>
			</form>
			<p class="mmz-note">The button records a verification request only. It does not activate enrollment.</p>
			<script>(function(){var b=document.querySelector('.mmz-copy');if(!b)return;b.addEventListener('click',function(){var v=b.getAttribute('data-copy');var done=function(){b.textContent='COPIED';setTimeout(function(){b.textContent='COPY';},1800);};if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(v).then(done);}else{var t=document.createElement('textarea');t.value=v;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();done();}});}());</script>
		<?php endif; ?>
	</section>
	<?php
}

add_action(
	'wp',
	function () {
		$order = mm_mr_zelle_authorized_order();
		if ( ! $order ) {
			return;
		}
		if ( $order->is_paid() && 'verified' === (string) $order->get_meta( '_mm_zelle_state', true ) ) {
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

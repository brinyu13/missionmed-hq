<?php
/**
 * Plugin Name: Mission Residency Zelle Payment Verifier
 * Description: Fail-closed Chase notification verification for approved Mission Residency Zelle orders.
 * Version: 2026.09.29
 */

defined( 'ABSPATH' ) || exit;

const MM_MR_ZELLE_HQ_ENDPOINT = 'https://missionmed-hq-production.up.railway.app/api/integrations/gmail/zelle-match';
const MM_MR_ZELLE_CRON_HOOK   = 'mm_mr_zelle_retry_verification';
const MM_MR_ZELLE_ACTION      = 'mm_mr_zelle_verify_payment';
const MM_MR_ZELLE_ADMIN_ACTION = 'mm_mr_zelle_admin_review';
const MM_MR_ZELLE_MAX_RETRIES = 12;

function mm_mr_zelle_product_map() {
	return array(
		5504 => 3646,
		5867 => 3646,
		3576 => 5227,
		5865 => 5227,
	);
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

function mm_mr_zelle_normalize_payer( $value ) {
	$value = strtolower( remove_accents( sanitize_text_field( (string) $value ) ) );
	$value = preg_replace( "/[^a-z0-9' -]/", ' ', $value );
	return trim( preg_replace( '/\s+/', ' ', (string) $value ) );
}

function mm_mr_zelle_audit( $order, $state, $detail = '' ) {
	$history   = $order->get_meta( '_mm_zelle_audit', true );
	$history   = is_array( $history ) ? $history : array();
	$history[] = array(
		'at'     => time(),
		'state'  => sanitize_key( $state ),
		'detail' => sanitize_key( $detail ),
	);
	$order->update_meta_data( '_mm_zelle_audit', array_slice( $history, -30 ) );
}

function mm_mr_zelle_consumed_fingerprints() {
	global $wpdb;
	$values = $wpdb->get_col(
		$wpdb->prepare(
			"SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value REGEXP %s LIMIT 250",
			'_mm_zelle_fingerprint',
			'^[a-f0-9]{64}$'
		)
	);
	return array_values( array_filter( array_map( 'strval', is_array( $values ) ? $values : array() ) ) );
}

function mm_mr_zelle_call_hq( $order, $payer_name ) {
	$secret = mm_mr_zelle_secret();
	if ( '' === $secret ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'shared_secret_missing' );
	}
	$created = $order->get_date_created();
	$payload = array(
		'order_id'             => $order->get_id(),
		'expected_amount'      => number_format( (float) $order->get_total(), 2, '.', '' ),
		'payer_name'           => $payer_name,
		'order_created_epoch'  => $created ? $created->getTimestamp() : 0,
		'consumed_fingerprints' => mm_mr_zelle_consumed_fingerprints(),
	);
	$timestamp = (string) time();
	$nonce     = bin2hex( random_bytes( 16 ) );
	$canonical = implode( "\n", array(
		$timestamp,
		$nonce,
		(string) $payload['order_id'],
		$payload['expected_amount'],
		$payer_name,
		(string) $payload['order_created_epoch'],
	) );
	$response = wp_remote_post(
		MM_MR_ZELLE_HQ_ENDPOINT,
		array(
			'timeout'     => 12,
			'redirection' => 0,
			'headers'     => array(
				'Content-Type'            => 'application/json',
				'X-MMED-Zelle-Timestamp'  => $timestamp,
				'X-MMED-Zelle-Nonce'      => $nonce,
				'X-MMED-Zelle-Signature'  => hash_hmac( 'sha256', $canonical, $secret ),
			),
			'body'        => wp_json_encode( $payload ),
		)
	);
	if ( is_wp_error( $response ) ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'hq_request_failed' );
	}
	$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $decoded ) ) {
		return array( 'ok' => false, 'state' => 'provider_unavailable', 'error' => 'hq_response_invalid' );
	}
	return $decoded;
}

function mm_mr_zelle_claim_fingerprint( $order, $fingerprint ) {
	if ( ! preg_match( '/^[a-f0-9]{64}$/', $fingerprint ) ) {
		return false;
	}
	$key      = 'mm_zelle_fp_' . $fingerprint;
	$existing = get_option( $key, '' );
	if ( '' !== (string) $existing && absint( $existing ) !== $order->get_id() ) {
		return false;
	}
	if ( '' === (string) $existing && ! add_option( $key, (string) $order->get_id(), '', false ) ) {
		return false;
	}
	$order->update_meta_data( '_mm_zelle_fingerprint', $fingerprint );
	return true;
}

function mm_mr_zelle_complete_payment( $order, $fingerprint, $source ) {
	if ( $order->is_paid() ) {
		return true;
	}
	if ( ! mm_mr_zelle_claim_fingerprint( $order, $fingerprint ) ) {
		return false;
	}
	$order->update_meta_data( '_mm_zelle_state', 'verified' );
	$order->update_meta_data( '_mm_zelle_verified_at', time() );
	$order->delete_meta_data( '_mm_zelle_payer' );
	mm_mr_zelle_audit( $order, 'verified', $source );
	$order->save();
	$order->payment_complete( 'zelle_' . substr( $fingerprint, 0, 16 ) );
	$order->add_order_note( 'Mission Residency Zelle payment verified from exact Chase notification evidence. Access processing followed canonical Woo payment completion.' );
	return $order->is_paid();
}

function mm_mr_zelle_schedule_retry( $order ) {
	if ( $order->is_paid() || wp_next_scheduled( MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) ) ) {
		return;
	}
	wp_schedule_single_event( time() + 300, MM_MR_ZELLE_CRON_HOOK, array( $order->get_id() ) );
}

function mm_mr_zelle_run_verification( $order, $payer_name, $source = 'request' ) {
	if ( ! mm_mr_zelle_is_pending_order( $order ) ) {
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
			if ( ! mm_mr_zelle_complete_payment( $order, $fingerprint, $source ) ) {
				$state = 'already_consumed';
			} else {
				return 'verified';
			}
		}
		$order->update_meta_data( '_mm_zelle_state', $state );
		mm_mr_zelle_audit( $order, $state, $source );
		$order->save();
		if ( in_array( $state, array( 'not_found', 'provider_unavailable' ), true ) ) {
			mm_mr_zelle_schedule_retry( $order );
		} elseif ( in_array( $state, array( 'needs_review', 'already_consumed' ), true ) ) {
			$order->add_order_note( 'Mission Residency Zelle verification needs staff review; no payment or access was activated.' );
			wp_mail( get_option( 'admin_email' ), 'Zelle verification review needed for order #' . $order->get_id(), 'A deterministic Zelle verification check needs review. No payment or access was activated. Open the WooCommerce order for the audit state.' );
		}
		return $state;
	} finally {
		delete_option( $lock_key );
	}
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
	$payer = mm_mr_zelle_normalize_payer( isset( $_POST['payer_name'] ) ? wp_unslash( $_POST['payer_name'] ) : '' );
	if ( strlen( $payer ) < 2 || strlen( $payer ) > 120 ) {
		wc_add_notice( __( 'Enter the full name used to send the Zelle payment.', 'missionmed' ), 'error' );
		wp_safe_redirect( $order->get_checkout_order_received_url() );
		exit;
	}
	$rate_key = 'mm_zelle_rate_' . hash( 'sha256', $order->get_id() . '|' . (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
	$count    = absint( get_transient( $rate_key ) );
	if ( $count >= 5 ) {
		wc_add_notice( __( 'Verification is already checking. Please wait before trying again.', 'missionmed' ), 'notice' );
		wp_safe_redirect( $order->get_checkout_order_received_url() );
		exit;
	}
	set_transient( $rate_key, $count + 1, 15 * MINUTE_IN_SECONDS );
	$order->update_meta_data( '_mm_zelle_payer', $payer );
	$order->update_meta_data( '_mm_zelle_state', 'checking' );
	$order->update_meta_data( '_mm_zelle_retry_count', 0 );
	mm_mr_zelle_audit( $order, 'checking', 'request' );
	$order->save();
	mm_mr_zelle_run_verification( $order, $payer, 'request' );
	wp_safe_redirect( $order->get_checkout_order_received_url() );
	exit;
}
add_action( 'admin_post_' . MM_MR_ZELLE_ACTION, 'mm_mr_zelle_handle_request' );
add_action( 'admin_post_nopriv_' . MM_MR_ZELLE_ACTION, 'mm_mr_zelle_handle_request' );

function mm_mr_zelle_retry( $order_id ) {
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
	if ( 'continue_waiting' === $decision && ! $order->is_paid() ) {
		$order->update_meta_data( '_mm_zelle_state', 'checking' );
		mm_mr_zelle_audit( $order, 'checking', 'admin_continue' );
		$order->save();
		mm_mr_zelle_schedule_retry( $order );
	} elseif ( 'not_match' === $decision && ! $order->is_paid() ) {
		$order->update_meta_data( '_mm_zelle_state', 'not_found' );
		mm_mr_zelle_audit( $order, 'not_found', 'admin_rejected' );
		$order->save();
	} elseif ( 'verify_activate' === $decision && ! $order->is_paid() ) {
		$fingerprint = strtolower( (string) $order->get_meta( '_mm_zelle_candidate_fingerprint', true ) );
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $fingerprint ) || ! mm_mr_zelle_complete_payment( $order, $fingerprint, 'admin_verified_candidate' ) ) {
			mm_mr_zelle_audit( $order, 'already_consumed', 'admin_blocked' );
			$order->save();
			wp_die( esc_html__( 'No unused genuine payment candidate is available. The order remains unpaid.', 'missionmed' ), 'Activation blocked', array( 'response' => 409 ) );
		}
	}
	wp_safe_redirect( $order->get_edit_order_url() );
	exit;
}
add_action( 'admin_post_' . MM_MR_ZELLE_ADMIN_ACTION, 'mm_mr_zelle_handle_admin_review' );

function mm_mr_zelle_admin_panel( $order ) {
	if ( ! current_user_can( 'manage_woocommerce' ) || ! mm_mr_zelle_order_identity( $order ) ) {
		return;
	}
	$state       = sanitize_key( (string) $order->get_meta( '_mm_zelle_state', true ) ) ?: 'awaiting_payment';
	$fingerprint = strtolower( (string) $order->get_meta( '_mm_zelle_candidate_fingerprint', true ) );
	$can_verify  = ! $order->is_paid() && preg_match( '/^[a-f0-9]{64}$/', $fingerprint );
	?>
	<div class="order_data_column" style="width:100%;padding-top:18px">
		<h3><?php esc_html_e( 'Mission Residency Zelle verification', 'missionmed' ); ?></h3>
		<p><strong><?php esc_html_e( 'State:', 'missionmed' ); ?></strong> <?php echo esc_html( $state ); ?><br>
		<strong><?php esc_html_e( 'Expected:', 'missionmed' ); ?></strong> <?php echo wp_kses_post( $order->get_formatted_order_total() ); ?><br>
		<strong><?php esc_html_e( 'Submitted payer:', 'missionmed' ); ?></strong> <?php echo esc_html( (string) $order->get_meta( '_mm_zelle_payer', true ) ?: 'Not submitted' ); ?><br>
		<strong><?php esc_html_e( 'Receipt reference:', 'missionmed' ); ?></strong> <?php echo esc_html( (string) $order->get_meta( '_mm_zelle_reference_masked', true ) ?: 'No genuine candidate' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="<?php echo esc_attr( MM_MR_ZELLE_ADMIN_ACTION ); ?>">
			<input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>">
			<?php wp_nonce_field( 'mm_zelle_admin_' . $order->get_id(), '_mm_zelle_admin_nonce' ); ?>
			<button class="button" name="decision" value="continue_waiting" type="submit"><?php esc_html_e( 'CONTINUE WAITING', 'missionmed' ); ?></button>
			<button class="button" name="decision" value="not_match" type="submit"><?php esc_html_e( 'NOT A MATCH', 'missionmed' ); ?></button>
			<button class="button button-primary" name="decision" value="verify_activate" type="submit" <?php disabled( ! $can_verify ); ?>><?php esc_html_e( 'VERIFY PAYMENT & ACTIVATE', 'missionmed' ); ?></button>
		</form>
		<?php if ( ! $can_verify && ! $order->is_paid() ) : ?><p><em><?php esc_html_e( 'Activation remains disabled until the verifier records an unused genuine Chase payment candidate.', 'missionmed' ); ?></em></p><?php endif; ?>
	</div>
	<?php
}
add_action( 'woocommerce_admin_order_data_after_order_details', 'mm_mr_zelle_admin_panel', 30, 1 );

function mm_mr_zelle_render_pending( $order_id ) {
	static $rendered = false;
	if ( $rendered ) {
		return;
	}
	$order = wc_get_order( absint( $order_id ) );
	if ( ! $order || ! mm_mr_zelle_is_pending_order( $order ) || ! mm_mr_zelle_authorized_order() ) {
		return;
	}
	$rendered = true;
	$state = sanitize_key( (string) $order->get_meta( '_mm_zelle_state', true ) );
	$state = $state ?: 'pending';
	$title = in_array( $state, array( 'checking', 'not_found', 'provider_unavailable' ), true ) ? "WE'RE CHECKING YOUR PAYMENT" : ( in_array( $state, array( 'needs_review', 'already_consumed' ), true ) ? 'PAYMENT RECEIVED FOR REVIEW' : 'ONE LAST STEP: COMPLETE YOUR ZELLE PAYMENT' );
	?>
	<style>
	.mmz-shell{max-width:880px;margin:28px auto;padding:clamp(24px,5vw,52px);background:#0d1d24;color:#f8f4ea;border-radius:20px;font-family:Arial,sans-serif;box-sizing:border-box}.mmz-kicker{color:#dcbf86;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.mmz-shell h2{color:#fff;font-size:clamp(30px,5vw,52px);line-height:1.03;margin:12px 0}.mmz-shell p{font-size:17px;line-height:1.6}.mmz-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.mmz-card{border:1px solid rgba(255,255,255,.18);padding:16px;border-radius:12px}.mmz-card strong{display:block;color:#dcbf86;margin-bottom:5px}.mmz-form{margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,.18)}.mmz-form label{display:block;font-weight:700;margin-bottom:8px}.mmz-form input{width:100%;min-height:50px;padding:12px;border:1px solid #aeb8bd;border-radius:8px;box-sizing:border-box}.mmz-form button{margin-top:12px;min-height:50px;padding:12px 20px;border:0;border-radius:8px;background:#dcbf86;color:#0d1d24;font-weight:800;cursor:pointer}.mmz-note{color:#d7e0e4}.mmz-alert{padding:12px;border-left:4px solid #dcbf86;background:rgba(255,255,255,.07)}@media(max-width:600px){.mmz-shell{margin:16px 0;border-radius:14px}.mmz-grid{grid-template-columns:1fr}.mmz-form button{width:100%}}
	</style>
	<section class="mmz-shell" aria-labelledby="mmz-title">
		<div class="mmz-kicker">Mission Residency enrollment</div>
		<h2 id="mmz-title"><?php echo esc_html( $title ); ?></h2>
		<p class="mmz-alert">Your order has been received, but payment and program access are <strong>not yet confirmed</strong>. You will not receive course or Matrix access until an exact Chase Zelle notification is verified.</p>
		<div class="mmz-grid">
			<div class="mmz-card"><strong>Order</strong>#<?php echo esc_html( $order->get_order_number() ); ?></div>
			<div class="mmz-card"><strong>Amount due</strong><?php echo wp_kses_post( $order->get_formatted_order_total() ); ?></div>
			<div class="mmz-card"><strong>Send to</strong>Mission Global Group</div>
			<div class="mmz-card"><strong>Confirmation</strong>info@missionmedinstitute.com</div>
		</div>
		<?php if ( 'pending' === $state ) : ?>
		<form class="mmz-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="<?php echo esc_attr( MM_MR_ZELLE_ACTION ); ?>">
			<input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>">
			<input type="hidden" name="key" value="<?php echo esc_attr( $order->get_order_key() ); ?>">
			<?php wp_nonce_field( 'mm_zelle_' . $order->get_id(), '_mm_zelle_nonce' ); ?>
			<label for="mmz-payer">Full name used to send the Zelle payment</label>
			<input id="mmz-payer" name="payer_name" type="text" autocomplete="name" maxlength="120" required>
			<button type="submit">I'VE SENT MY ZELLE PAYMENT →</button>
		</form>
		<?php elseif ( in_array( $state, array( 'checking', 'not_found', 'provider_unavailable' ), true ) ) : ?>
			<p class="mmz-note">We haven't confirmed it yet. Zelle notifications can take a few minutes to arrive. We'll continue checking and email you as soon as your payment is verified. Your program access will remain locked until payment is confirmed. Do not send a second payment.</p>
		<?php else : ?>
			<p class="mmz-note">No access has been activated. The Mission Residency team has been alerted and will review the verification record. Do not send a second payment.</p>
		<?php endif; ?>
	</section>
	<?php
}

add_action(
	'wp',
	function () {
		$order = mm_mr_zelle_authorized_order();
		if ( ! $order || ! mm_mr_zelle_is_pending_order( $order ) ) {
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

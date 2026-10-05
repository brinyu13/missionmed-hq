<?php
/** Source candidate only; separate exact-path authority is required before installation. */
defined( 'ABSPATH' ) || exit;
const MM_FINANCE_CHASE_NAMESPACE = 'missionmed-finance/chase-reserve/v1';

function mm_finance_chase_signature_input( $timestamp, $nonce, $body ) {
    return implode( "\n", array( MM_FINANCE_CHASE_NAMESPACE, $timestamp, $nonce, hash( 'sha256', $body ) ) );
}

// Authenticated cookies, capability and a browser nonce never authorize this route.
function mm_finance_chase_permission( $request ) {
    if ( ! function_exists( 'mm_mr_zelle_secret' ) || ! function_exists( 'mm_mr_zelle_with_lock' ) || ! function_exists( 'mm_mr_zelle_lock_owned' ) ) {
        return new WP_Error( 'bridge_unavailable', 'Unavailable', array( 'status' => 503 ) );
    }
    $body = $request->get_body();
    $timestamp = (string) $request->get_header( 'x-mmed-finance-timestamp' );
    $nonce = (string) $request->get_header( 'x-mmed-finance-nonce' );
    $signature = (string) $request->get_header( 'x-mmed-finance-signature' );
    $secret = mm_mr_zelle_secret();
    if ( 'POST' !== $request->get_method() || strlen( $body ) > 1024 || ! $secret ||
         ! preg_match( '/^[0-9]{10}$/D', $timestamp ) || ! preg_match( '/^[a-f0-9]{32}$/D', $nonce ) ||
         ! preg_match( '/^[a-f0-9]{64}$/D', $signature ) || abs( time() - (int) $timestamp ) > 300 ||
         ! hash_equals( hash_hmac( 'sha256', mm_finance_chase_signature_input( $timestamp, $nonce, $body ), $secret ), $signature ) ) {
        return new WP_Error( 'signature_required', 'Unauthorized', array( 'status' => 401 ) );
    }
    return true;
}

// Same pending-order predicate and exact payer/amount normalization as the accepted Woo donor.
// No uniqueness assertion on an incomplete or failed scan.
function mm_finance_chase_woo_clear( $amount, $payer ) {
    if ( ! function_exists( 'wc_get_orders' ) || ! function_exists( 'mm_mr_zelle_is_pending_order' ) ||
         ! function_exists( 'mm_mr_zelle_amount' ) || ! function_exists( 'mm_mr_zelle_normalize_payer' ) ||
         ! class_exists( 'Normalizer' ) || ! function_exists( 'mb_strtolower' ) ) return false;
    if ( ! hash_equals( mm_mr_zelle_normalize_payer( $payer ), $payer ) ) return false;
    try {
        $result = wc_get_orders( array( 'status' => array( 'wc-pending', 'wc-on-hold' ), 'payment_method' => 'bacs', 'limit' => 101, 'paginate' => true, 'orderby' => 'ID', 'order' => 'ASC' ) );
        if ( ! is_object( $result ) || ! isset( $result->orders, $result->total ) ||
             ! is_array( $result->orders ) || ! is_numeric( $result->total ) || $result->total < 0 ||
             $result->total > 100 || count( $result->orders ) !== (int) $result->total ) return false;
        foreach ( $result->orders as $candidate ) {
            if ( ! mm_mr_zelle_is_pending_order( $candidate ) || mm_mr_zelle_amount( $candidate->get_total() ) !== $amount ) continue;
            $claimed = mm_mr_zelle_normalize_payer( $candidate->get_meta( '_mm_zelle_payer', true ) );
            $name = $claimed ?: mm_mr_zelle_normalize_payer( $candidate->get_formatted_billing_full_name() );
            if ( hash_equals( $payer, $name ) ) return false;
        }
        return mm_mr_zelle_lock_owned();
    } catch ( Throwable $error ) { return false; }
}

function mm_finance_chase_reserve( $request ) {
    // Repeat permission here so direct internal invocation cannot bypass the contract.
    $authorized = mm_finance_chase_permission( $request );
    if ( true !== $authorized ) return $authorized;
    $input = json_decode( $request->get_body(), true );
    if ( ! is_array( $input ) || count( $input ) !== 5 ||
         ( $input['namespace'] ?? '' ) !== MM_FINANCE_CHASE_NAMESPACE ||
         ! preg_match( '/^[0-9]{1,8}\.[0-9]{2}$/D', (string) ( $input['expected_amount'] ?? '' ) ) ||
         (float) ( $input['expected_amount'] ?? 0 ) <= 0 ||
         ! is_string( $input['payer_name'] ?? null ) || strlen( $input['payer_name'] ) < 2 || strlen( $input['payer_name'] ) > 480 ||
         ! preg_match( '/^[a-f0-9]{64}$/D', (string) ( $input['fingerprint'] ?? '' ) ) ||
         ! preg_match( '/^[a-f0-9]{64}$/D', (string) ( $input['match_binding'] ?? '' ) ) ) {
        return new WP_Error( 'invalid_binding', 'Invalid request', array( 'status' => 422 ) );
    }
    $fingerprint = $input['fingerprint'];
    $binding = $input['match_binding'];
    $amount = $input['expected_amount'];
    $payer = $input['payer_name'];
    $nonce = (string) $request->get_header( 'x-mmed-finance-nonce' );
    $result = mm_mr_zelle_with_lock( function () use ( $fingerprint, $binding, $nonce, $amount, $payer ) {
        if ( ! mm_mr_zelle_lock_owned() ) return false;
        if ( ! mm_finance_chase_woo_clear( $amount, $payer ) ) return false;
        // Nonce markers are authentication replay protection, not a second receipt ledger.
        if ( ! add_option( 'mm_finance_chase_nonce_v1_' . $nonce, (string) time(), '', false ) ) return false;
        $key = 'mm_zelle_transaction_v2_' . $fingerprint;
        $owner = 'mr-financial-v1:' . $binding;
        $current = get_option( $key, false );
        if ( false !== $current ) {
            return is_string( $current ) && hash_equals( $owner, $current );
        }
        // The accepted Woo providers use add_option against this same permanent key.
        // Never delete this option on timeout, failure, refund or ambiguous downstream state.
        return add_option( $key, $owner, '', false );
    } );
    if ( true !== $result ) return new WP_Error( 'reservation_denied', 'Reservation unavailable', array( 'status' => 409 ) );
    $body = wp_json_encode( array( 'reserved' => true, 'fingerprint' => $fingerprint, 'match_binding' => $binding ) );
    $timestamp = (string) $request->get_header( 'x-mmed-finance-timestamp' );
    $signature = hash_hmac( 'sha256', mm_finance_chase_signature_input( $timestamp, $nonce, $body ), mm_mr_zelle_secret() );
    // Return exact signed bytes; WordPress serialization must not rewrite them.
    return new WP_REST_Response( array( '_signed_body' => $body ), 200,
        array( 'X-MMed-Finance-Signature' => $signature, 'Cache-Control' => 'no-store' ) );
}

add_action( 'rest_api_init', function () {
    register_rest_route( 'missionmed-finance/v1', '/chase-reserve', array(
        'methods' => 'POST', 'permission_callback' => 'mm_finance_chase_permission',
        'callback' => 'mm_finance_chase_reserve',
    ) );
} );
add_filter( 'rest_pre_serve_request', function ( $served, $result, $request ) {
    if ( '/missionmed-finance/v1/chase-reserve' !== $request->get_route() || $result->get_status() !== 200 ) return $served;
    $data = $result->get_data();
    if ( ! is_array( $data ) || ! isset( $data['_signed_body'] ) ) return $served;
    echo $data['_signed_body']; // Exact HMAC-authenticated bytes, containing hashes only.
    return true;
}, 10, 3 );

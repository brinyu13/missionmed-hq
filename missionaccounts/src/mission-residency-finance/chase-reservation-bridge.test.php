<?php
// In-memory synthetic source tests; no WordPress/provider/database connection.
define( 'ABSPATH', __DIR__ );
$options = array(); $lock = true; $checks = 0; $orders = array(); $total = 0;
function wc_get_orders( $query ) { global $orders, $total; return (object) array('orders'=>$orders,'total'=>$total); }
function mm_mr_zelle_is_pending_order( $order ) { return true; }
function mm_mr_zelle_amount( $value ) { return number_format((float)$value,2,'.',''); }
function mm_mr_zelle_normalize_payer( $value ) { return strtolower(trim(preg_replace('/\\s+/',' ',$value))); }
class FixtureOrder { public function get_total() { return '1.00'; } public function get_meta(...$args) { return 'test student'; } public function get_formatted_billing_full_name() { return 'test student'; } }
function add_action( ...$args ) {}
function add_filter( ...$args ) {}
function mm_mr_zelle_secret() { return bin2hex( 'fixture signing material' ); }
function mm_mr_zelle_lock_owned() { global $lock; return $lock; }
function mm_mr_zelle_with_lock( $callback ) { return mm_mr_zelle_lock_owned() ? $callback() : false; }
function add_option( $key, $value, ...$ignored ) { global $options; if ( array_key_exists( $key, $options ) ) return false; $options[$key] = $value; return true; }
function get_option( $key, $default = false ) { global $options; return $options[$key] ?? $default; }
function wp_json_encode( $value ) { return json_encode( $value, JSON_UNESCAPED_SLASHES ); }
class WP_Error { public function __construct( public $code, ...$args ) {} }
class WP_REST_Response {
 public function __construct( public $data, public $status, public $headers ) {}
 public function get_data() { return $this->data; }
 public function get_status() { return $this->status; }
}
require __DIR__ . '/chase-reservation-bridge.php';
class Request {
 public $body; public $headers;
 public function __construct( $fingerprint, $binding ) {
  $this->body = wp_json_encode( array( 'namespace' => MM_FINANCE_CHASE_NAMESPACE, 'fingerprint' => $fingerprint, 'match_binding' => $binding, 'expected_amount' => '1.00', 'payer_name' => 'test student' ) );
  $this->headers = array( 'x-mmed-finance-timestamp' => (string) time(), 'x-mmed-finance-nonce' => bin2hex( random_bytes( 16 ) ) );
  $this->sign();
 }
 public function sign() { $this->headers['x-mmed-finance-signature'] = hash_hmac( 'sha256', mm_finance_chase_signature_input( $this->headers['x-mmed-finance-timestamp'], $this->headers['x-mmed-finance-nonce'], $this->body ), mm_mr_zelle_secret() ); }
 public function get_body() { return $this->body; }
 public function get_header( $name ) { return $this->headers[$name] ?? ''; }
 public function get_method() { return 'POST'; }
}
function check( $condition ) { global $checks; $checks++; if ( ! $condition ) throw new Exception( 'Failed check ' . $checks ); }
$f = str_repeat( 'a', 64 ); $binding = str_repeat( 'b', 64 );
$unsigned = new Request( $f, $binding ); $unsigned->headers = array();
check( mm_finance_chase_permission( $unsigned ) instanceof WP_Error );
$r = new Request( $f, $binding ); $r->body .= ' ';
check( mm_finance_chase_reserve( $r ) instanceof WP_Error );
$r = new Request( $f, $binding ); $r->headers['x-mmed-finance-timestamp'] = (string) (time()-301); $r->sign();
check( mm_finance_chase_reserve( $r ) instanceof WP_Error );
$r = new Request( $f, $binding ); $result = mm_finance_chase_reserve( $r );
check( $result instanceof WP_REST_Response );
check( $options['mm_zelle_transaction_v2_' . $f] === 'mr-financial-v1:' . $binding );
check( hash_equals( hash_hmac( 'sha256', mm_finance_chase_signature_input( $r->get_header('x-mmed-finance-timestamp'), $r->get_header('x-mmed-finance-nonce'), $result->data['_signed_body'] ), mm_mr_zelle_secret() ), $result->headers['X-MMed-Finance-Signature'] ) );
check( mm_finance_chase_reserve( $r ) instanceof WP_Error ); // Same nonce rejected.
check( mm_finance_chase_reserve( new Request($f,$binding) ) instanceof WP_REST_Response ); // Same private request idempotent.
check( mm_finance_chase_reserve( new Request($f,str_repeat('c',64)) ) instanceof WP_Error );
$options['mm_zelle_transaction_v2_' . str_repeat('d',64)] = '9211';
check( mm_finance_chase_reserve( new Request(str_repeat('d',64),$binding) ) instanceof WP_Error );
check( $options['mm_zelle_transaction_v2_' . str_repeat('d',64)] === '9211' );
$orders = array(new FixtureOrder()); $total = 1;
check( mm_finance_chase_reserve( new Request(str_repeat('e',64),$binding) ) instanceof WP_Error );
check( !isset($options['mm_zelle_transaction_v2_' . str_repeat('e',64)]) );
$orders = array(); $total = 101;
check( mm_finance_chase_reserve( new Request(str_repeat('e',64),$binding) ) instanceof WP_Error );
$total = 1;
check( mm_finance_chase_reserve( new Request(str_repeat('e',64),$binding) ) instanceof WP_Error );
$total = 0;
$lock = false;
check( mm_finance_chase_reserve( new Request(str_repeat('e',64),$binding) ) instanceof WP_Error );
check( ! isset($options['mm_zelle_transaction_v2_' . str_repeat('e',64)]) );
check( $options['mm_zelle_transaction_v2_' . $f] === 'mr-financial-v1:' . $binding );
echo 'PASS ' . $checks . " synthetic checks\n";

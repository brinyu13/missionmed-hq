<?php
/**
 * MX-DASH-6000C — pure unit checks for Dashboard experience precedence and
 * featured-app override sanitizing. No WordPress bootstrap required.
 * Run: php tests/mx-dash-6000c/experience-resolution.test.php
 */
define( 'ABSPATH', '/' );
function get_option( $k, $d = false ) { return $d; }
function sanitize_text_field( $v ) { return trim( strip_tags( (string) $v ) ); }
function sanitize_textarea_field( $v ) { return trim( strip_tags( (string) $v ) ); }
function sanitize_key( $v ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $v ) ); }
function esc_url_raw( $u, $p = null ) { return preg_match( '#^https?://#i', (string) $u ) ? $u : ''; }
function absint( $v ) { return abs( (int) $v ); }
require dirname( __DIR__, 2 ) . '/includes/class-mmed-dashboard-experience.php';

$fail = 0;
function check( $label, $ok ) { global $fail; echo ( $ok ? 'PASS ' : 'FAIL ' ) . $label . "\n"; if ( ! $ok ) { $fail++; } }
$r = array( 'MMED_Dashboard_Experience', 'resolve_values' );
check( 'force classic wins', 'classic' === $r( true, 'matrix2', 'matrix2', true ) );
check( 'disabled v2 fails closed', 'classic' === $r( false, 'matrix2', 'matrix2', false ) );
check( 'user preference wins over default', 'matrix2' === $r( false, 'matrix2', 'classic', true ) );
check( 'user classic keeps classic', 'classic' === $r( false, 'classic', 'matrix2', true ) );
check( 'default applies without preference', 'matrix2' === $r( false, '', 'matrix2', true ) );
check( 'garbage default falls back to classic', 'classic' === $r( false, '', 'weird', true ) );
$c = MMED_Dashboard_Experience::sanitize_override( array( 'name' => '<b>Hi</b>', 'launch' => 'javascript:alert(1)', 'card_image' => 'https://cdn.example/a.jpg', 'card_image_id' => '9', 'benefits' => array( array( 'f', 'b' ), 'bad', array( '', 'x' ) ), 'junk' => 1, 'how' => str_repeat( 'x', 2000 ) ) );
check( 'html stripped', 'Hi' === $c['name'] );
check( 'javascript launch dropped', ! isset( $c['launch'] ) );
check( 'image url kept', 'https://cdn.example/a.jpg' === $c['card_image'] && 9 === $c['card_image_id'] );
check( 'benefits normalized', array( array( 'f', 'b' ) ) === $c['benefits'] );
check( 'unknown keys dropped', ! isset( $c['junk'] ) );
check( 'how capped at 900', 900 === mb_strlen( $c['how'] ) );
$apps = MMED_Dashboard_Experience::get_apps();
check( 'eight featured apps', 8 === count( $apps ) && isset( $apps['homebase'], $apps['lor'] ) );
check( 'every app has cta + launch + benefits', 0 === count( array_filter( $apps, function ( $a ) { return empty( $a['cta'] ) || empty( $a['launch'] ) || empty( $a['benefits'] ); } ) ) );
exit( $fail ? 1 : 0 );

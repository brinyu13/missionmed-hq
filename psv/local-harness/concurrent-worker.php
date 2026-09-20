<?php
/** LOCAL HARNESS ONLY: invoke one durable batch worker from an independent PHP process. */
$root = getenv( 'MMPS_HARNESS_ROOT' ) ?: '/home/claude/wpdev';
$_SERVER['HTTP_HOST']   = '127.0.0.1:8088';
$_SERVER['REQUEST_URI'] = '/';
require $root . '/site/wp-load.php';

$job_uuid = isset( $argv[1] ) ? (string) $argv[1] : '';
$result   = MMPS_Batch::process_next( 3, $job_uuid );
if ( is_wp_error( $result ) ) {
	echo wp_json_encode( array( 'error' => $result->get_error_code(), 'message' => $result->get_error_message() ) );
	exit( 2 );
}
echo wp_json_encode( $result );

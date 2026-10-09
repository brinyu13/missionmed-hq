<?php
/** Read-only live contracts. No cookies, credentials, URLs, or document contents emitted. */
function fv1022_check( $value, $name ) {
	if ( ! $value ) { throw new RuntimeException( $name ); }
	$GLOBALS['fv1022_checks'][] = $name;
}
function fv1022_actor( $name ) {
	$matches = array_filter( get_users( array( 'search' => $name, 'search_columns' => array( 'display_name' ) ) ), static function( $u ) use ( $name ) { return $u->display_name === $name; } );
	fv1022_check( count( $matches ) === 1, 'unique synthetic actor ' . substr( $name, -1 ) );
	return reset( $matches );
}
function fv1022_status( $value ) {
	return is_wp_error( $value ) ? (int) ( $value->get_error_data()['status'] ?? 0 ) : ( $value instanceof WP_REST_Response ? $value->get_status() : 200 );
}
$GLOBALS['fv1022_checks'] = array();
try {
	$owner = fv1022_actor( 'Timeline 022 Synthetic Student A' );
	$other = fv1022_actor( 'Timeline 022 Synthetic Student B' );
	$admin = null;
	foreach ( get_users( array( 'role' => 'administrator', 'number' => 25 ) ) as $candidate ) {
		if ( user_can( $candidate->ID, 'mmed_manage_file_vault' ) ) { $admin = $candidate; break; }
	}
	fv1022_check( (bool) $admin, 'existing administrator available' );
	fv1022_check( MMED_File_Vault_V2::get_mode() === 'on', 'existing V2 mode on' );
	fv1022_check( MMED_File_Vault_V2::ASSET_JS === 'student-os-file-vault-v2.44c578a67d945dfe.js', 'live JS pin approved' );
	fv1022_check( MMED_File_Vault_V2::ASSET_CSS === 'student-os-file-vault-v2.5009c86f47c85fa1.css', 'live CSS pin approved' );
	global $wpdb;
	// Check ownership before reading this historical synthetic test object's metadata.
	$uid = $wpdb->get_var( $wpdb->prepare( 'SELECT user_id FROM ' . MMED_File_Vault::table_name() . ' WHERE id=%d', 53 ) );
	fv1022_check( (int) $uid === (int) $owner->ID, 'known QA document still belongs to synthetic actor' );
	$request = new WP_REST_Request( 'GET' ); $request->set_param( 'id', 53 );
	foreach ( array( array( $owner, 'owner', 200 ), array( $other, 'other student', 404 ), array( $admin, 'administrator', 200 ) ) as $case ) {
		wp_set_current_user( $case[0]->ID );
		fv1022_check( fv1022_status( MMED_File_Vault_V2::get_file( $request ) ) === $case[2], $case[1] . ' document boundary' );
	}
	foreach ( array( array( $owner, 'student' ), array( $admin, 'admin' ) ) as $case ) {
		wp_set_current_user( $case[0]->ID );
		$req = new WP_REST_Request( 'GET' ); $req->set_param( 'student_id', $owner->ID );
		$result = MMED_File_Vault_V2::get_bootstrap( $req );
		fv1022_check( fv1022_status( $result ) === 200, $case[1] . ' synthetic bootstrap' );
		$data = $result->get_data();
		fv1022_check( $data['viewer_role'] === $case[1], $case[1] . ' role lens' );
		fv1022_check( ! empty( $data['storage']['ready'] ), $case[1] . ' private storage configured' );
		fv1022_check( in_array( 'pdf', $data['storage']['extensions'], true ) && in_array( 'pages', $data['storage']['extensions'], true ), $case[1] . ' PDF and Pages accepted' );
		fv1022_check( $data['storage']['max_file_size'] === 26214400, $case[1] . ' 25 MiB contract' );
		fv1022_check( isset( $data['activity'], $data['library'], $data['capabilities'], $data['upload_context'] ), $case[1] . ' bootstrap shape preserved' );
	}
	wp_set_current_user( 0 );
	fv1022_check( ! MMED_File_Vault_V2::is_user_eligible(), 'anonymous V2 denied' );
	fv1022_check( fv1022_status( MMED_File_Vault_V2::can_use_v2( new WP_REST_Request( 'GET' ) ) ) === 401, 'anonymous browser permission denied' );
	echo 'FV1022_RECEIPT=' . wp_json_encode( array( 'result' => 'PASS', 'kind' => 'read-only production CLI role contracts; not authenticated browser acceptance', 'checks' => $GLOBALS['fv1022_checks'], 'count' => count( $GLOBALS['fv1022_checks'] ) ) ) . PHP_EOL;
} catch ( Throwable $e ) {
	wp_set_current_user( 0 );
	echo 'FV1022_RECEIPT=' . wp_json_encode( array( 'result' => 'FAIL', 'check' => $e->getMessage() ) ) . PHP_EOL;
	exit( 1 );
}

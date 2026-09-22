<?php
$_SERVER['HTTP_HOST'] = '127.0.0.1:8088'; $_SERVER['REQUEST_URI'] = '/';
$harness_root = getenv( 'MMPS_HARNESS_ROOT' ) ?: '/home/claude/wpdev';
require $harness_root . '/site/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$r = activate_plugin( 'missionmed-file-vault-ps/missionmed-file-vault-ps.php' );
echo 'activate: ' . ( is_wp_error( $r ) ? $r->get_error_message() : 'ok' ) . "\n";
foreach ( array( 'store', 'docx', 'region', 'root-source' ) as $p ) { require_once WP_PLUGIN_DIR . '/missionmed-file-vault-ps/includes/class-mmps-' . $p . '.php'; }
$paras = MMPS_Root_Source::synthetic_paragraphs();
$paras[0] = 'FILE VAULT COPY. ' . $paras[0];
$bytes = MMPS_Docx::bytes_from_paragraphs( $paras );
file_put_contents( $harness_root . '/harness/files/ps-root-v1.docx', $bytes );
// A DOCX with a tracked insertion must be refused.
$tmp = $harness_root . '/harness/files/ps-tracked.docx'; copy( $harness_root . '/harness/files/ps-root-v1.docx', $tmp );
$zip = new ZipArchive(); $zip->open( $tmp ); $xml = $zip->getFromName( 'word/document.xml' );
$xml = preg_replace( '#<w:r>#', '<w:ins w:id="1" w:author="x"><w:r>', $xml, 1 ); $xml = preg_replace( '#</w:r>#', '</w:r></w:ins>', $xml, 1 );
$zip->addFromString( 'word/document.xml', $xml ); $zip->close();
global $wpdb; $t = MMED_File_Vault::table_name(); $wpdb->query( "DELETE FROM $t" );
$v = function ( $n, $key, $state, $sha, $name ) { return array( 'number' => $n, 'r2_key' => $key, 'sha256' => $sha, 'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'verification_state' => $state, 'version_uuid' => wp_generate_uuid4(), 'version_label' => 'Draft ' . $n, 'is_final' => 1 === $n, 'uploaded_at' => '2026-09-01 10:00:00', 'canonical_name' => $name ); };
$wpdb->insert( $t, array( 'user_id' => 3, 'name' => 'Personal Statement', 'meta' => wp_json_encode( array( 'document_type' => 'personal_statement', 'versions' => array( $v( 1, 'ps-root-v1.docx', 'ready_clean', hash( 'sha256', $bytes ), 'PS_v1.docx' ), $v( 2, 'ps-root-v1.docx', 'pending_scan', '', 'PS_v2.docx' ), $v( 3, 'ps-tracked.docx', 'ready_clean', hash_file( 'sha256', $tmp ), 'PS_v3_tracked.docx' ), $v( 4, 'ps-root-v1.docx', 'ready_clean', str_repeat( '0', 64 ), 'PS_v4_hash_mismatch.docx' ) ) ) ) ) );
$wpdb->insert( $t, array( 'user_id' => 3, 'name' => 'CV', 'meta' => wp_json_encode( array( 'document_type' => 'curriculum_vitae', 'versions' => array( $v( 1, 'cv.docx', 'ready_clean', '', 'CV.docx' ) ) ) ) ) );
$wpdb->insert( $t, array( 'user_id' => 2, 'name' => 'Other student PS', 'meta' => wp_json_encode( array( 'document_type' => 'personal_statement', 'versions' => array( $v( 1, 'ps-root-v1.docx', 'ready_clean', hash( 'sha256', $bytes ), 'OTHER.docx' ) ) ) ) ) );
update_option( 'mmed_ps_proto_allow_user_ids', array( 3 ) );
update_option( 'mmed_psv_boost_mode', 'members' );
echo 'fv rows: ' . $wpdb->get_var( "SELECT COUNT(*) FROM $t" ) . "\n";

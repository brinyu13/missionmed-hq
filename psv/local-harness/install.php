<?php
define( 'WP_INSTALLING', true );
$_SERVER['HTTP_HOST'] = '127.0.0.1:8088'; $_SERVER['REQUEST_URI'] = '/';
require '/home/claude/wpdev/site/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if ( ! is_blog_installed() ) { wp_install( 'MM Local', 'founder', 'founder@example.test', false, '', 'Founder-Local-1!' ); }
$student = username_exists( 'student' ) ? get_user_by( 'login', 'student' )->ID : wp_create_user( 'student', 'Student-Local-1!', 'student@example.test' );
$tester  = username_exists( 'tester' ) ? get_user_by( 'login', 'tester' )->ID : wp_create_user( 'tester', 'Tester-Local-1!', 'tester@example.test' );
wp_update_user( array( 'ID' => $tester, 'first_name' => 'Émile', 'last_name' => 'Corridor', 'display_name' => 'Émile Corridor' ) );
global $wp_rewrite; $wp_rewrite->set_permalink_structure( '/%postname%/' ); 
activate_plugin( 'missionmed-hub/missionmed-hub.php' );
if ( ! get_page_by_path( 'member-dashboard' ) ) { wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Member Dashboard', 'post_name' => 'member-dashboard', 'post_content' => '[mmed_hub_stub]' ) ); }
MMED_File_Vault::maybe_install();
echo "installed; student=$student tester=$tester\n";

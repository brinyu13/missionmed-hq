<?php
$base = dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/';
$files = array(
	'plugin' => file_get_contents( $base . 'missionmed-file-vault-ps.php' ),
	'install' => file_get_contents( $base . 'includes/class-mmps-install.php' ),
	'prompts' => file_get_contents( $base . 'includes/class-mmps-prompts.php' ),
	'mission' => file_get_contents( $base . 'includes/class-mmps-mission.php' ),
	'research' => file_get_contents( $base . 'includes/class-mmps-research.php' ),
	'rest' => file_get_contents( $base . 'includes/class-mmps-rest.php' ),
	'return' => file_get_contents( $base . 'includes/class-mmps-return.php' ),
	'generator' => file_get_contents( $base . 'includes/class-mmps-generator.php' ),
	'ui' => file_get_contents( $base . 'assets/mmps-app.js' ),
);
$pass = 0; $fail = 0;
function check( $ok, $label ) { global $pass, $fail; echo ( $ok ? 'PASS: ' : 'FAIL: ' ) . $label . "\n"; $ok ? $pass++ : $fail++; }
check( false !== strpos( $files['install'], "table( 'prompt_versions' )" ) && false !== strpos( $files['install'], 'research_missions' ), 'additive prompt and mission tables are declared' );
check( false !== strpos( $files['prompts'], 'DRAFT' ) && false !== strpos( $files['prompts'], 'TESTING' ) && false !== strpos( $files['prompts'], 'PRODUCTION' ) && false !== strpos( $files['prompts'], 'RETIRED' ), 'prompt lifecycle is explicit' );
check( false !== strpos( $files['prompts'], 'rollback_target_uuid' ) && false !== strpos( $files['prompts'], 'prompt_promote' ) && false !== strpos( $files['prompts'], 'prompt_rollback' ), 'promotion and rollback are audited and versioned' );
check( false !== strpos( $files['generator'], 'CODE-OWNED SECURITY ENVELOPE' ) && false !== strpos( $files['generator'], 'Never rewrite, change, edit or modify protected ROOT paragraphs' ), 'editable prompts cannot remove the code-owned ROOT boundary' );
check( false !== strpos( $files['mission'], 'MMED_PSV_MISSION_KEY_K1' ) && false !== strpos( $files['mission'], 'hash_hmac' ), 'mission envelope is signed with a dedicated server-side key' );
check( false !== strpos( $files['mission'], 'This mission contains no applicant information' ) && false === strpos( $files['mission'], 'root_paragraphs' ), 'downloaded research mission contains no ROOT prose' );
check( false !== strpos( $files['research'], 'ACTIVE_CONTENT' ) && false !== strpos( $files['research'], 'PROMPT_INJECTION_TEXT' ) && false !== strpos( $files['research'], 'APPLICANT_DATA' ), 'returned artifacts are quarantined against active content, injection and applicant data' );
check( false !== strpos( $files['research'], 'admin_manual_source_review' ) && false !== strpos( $files['research'], 'READY_FOR_RISE_OWNER' ), 'content/source QA is an explicit admin decision' );
check( false !== strpos( $files['research'], 'missionmed.rise.research-ingest.v1' ) && false !== strpos( $files['research'], 'PSV never writes RISE itself' ), 'RISE hydration remains an owner handoff rather than a PSV write' );
check( false !== strpos( $files['mission'], "'RISE_PUBLISHED' ===") && false !== strpos( $files['mission'], 'bundleSha256' ), 'Deep readiness requires published owner state and fresh RISE readback' );
check( false !== strpos( $files['rest'], '/admin/prompts' ) && false !== strpos( $files['rest'], 'manage_options' ), 'admin routes are capability protected' );
check( false !== strpos( $files['ui'], 'PSV Admin' ) && false !== strpos( $files['ui'], 'Prompt Management' ) && false !== strpos( $files['ui'], 'Research Queue' ), 'PSV admin shell exposes prompt management and research queue' );
check( false !== strpos( $files['ui'], 'Download Research Mission (.md)' ) && false !== strpos( $files['ui'], 'Use what we already know' ), 'student wizard keeps downloadable mission and Essential fallback together' );
check( false === strpos( $files['research'], 'wp_remote_post' ) && false === strpos( $files['research'], 'wp_remote_request' ) && false === strpos( $files['research'], 'MMPS_Rise_Client::write' ), 'research implementation contains no direct RISE mutation' );
check( false !== strpos( $files['return'], "'/submissions'") && false !== strpos( $files['return'], "'methods' => 'POST'") && false !== strpos( $files['return'], 'MMPS_Research::ingest_v2' ), 'Stage B is submit-only and converges on the same quarantine intake' );
check( false !== strpos( $files['return'], 'MMPS_Mission::auto_return_on()' ) && false !== strpos( $files['return'], "array( 'EXPERIMENTAL', 'VERIFIED' )" ), 'Stage B namespace is absent until flag, key and provider verification all exist' );
echo "PSV ADMIN + BOOST CONTRACT: " . ( $fail ? 'FAIL' : 'PASS' ) . " ($pass passed, $fail failed)\n";
exit( $fail ? 1 : 0 );

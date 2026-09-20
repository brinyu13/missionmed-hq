<?php
defined( 'ABSPATH' ) || exit;

$required = array(
	6360 => array( 'name' => 'Drills: Daily Rounds Access', 'price' => '99.99' ),
	9017 => array( 'name' => 'ExamPrep: Arena Pro', 'price' => '149.99' ),
	9109 => array( 'name' => 'Drills: Daily Rounds Access — Live Drills Add-On', 'price' => '19.99' ),
);

foreach ( $required as $id => $contract ) {
	$product = wc_get_product( $id );
	$actual_price = $product ? number_format( (float) $product->get_price(), 2, '.', '' ) : '';
	if (
		! $product
		|| 'subscription' !== $product->get_type()
		|| 'month' !== get_post_meta( $id, '_subscription_period', true )
		|| '1' !== (string) get_post_meta( $id, '_subscription_period_interval', true )
		|| $contract['price'] !== $actual_price
	) {
		throw new RuntimeException( 'Unexpected subscription product identity: ' . $id );
	}
}
if ( function_exists( 'wcs_get_subscriptions_for_product' ) && wcs_get_subscriptions_for_product( 9017, array( 'subscriptions_per_page' => 1 ) ) ) {
	throw new RuntimeException( 'Arena Pro candidate has existing subscriptions; refusing in-place reconciliation.' );
}

$mmdrj_apply_old_card = '<a href="/product/daily-drills-audios-notes/" style="padding:22px;border:1px solid rgba(226,184,89,.45);border-radius:14px;color:#fff;text-decoration:none;"><strong>Daily Drills + Audios + Notes</strong><br><span style="font-size:24px;color:#e2b859;">$149.99/month</span></a>';
$mmdrj_apply_new_card = '<span id="exam-prep-arena-pro" role="link" aria-disabled="true" style="padding:22px;border:1px solid rgba(226,184,89,.45);border-radius:14px;color:#fff;opacity:.82;"><strong>🔒 ExamPrep: Arena Pro</strong><br><span style="font-size:24px;color:#e2b859;">$149.99/month</span><br><small>Coming Soon — locked; no checkout.</small></span>';
$mmdrj_apply_page_contents = array();
foreach ( array( 5674, 5687 ) as $post_id ) {
	$mmdrj_apply_page_contents[ $post_id ] = (string) get_post_field( 'post_content', $post_id );
	if ( 1 !== substr_count( $mmdrj_apply_page_contents[ $post_id ], $mmdrj_apply_old_card ) || substr_count( $mmdrj_apply_page_contents[ $post_id ], 'Daily Drills + Notes' ) < 1 ) {
		throw new RuntimeException( 'Expected page content preimage not found for ' . $post_id );
	}
}

$mmdrj_apply_snippet_id = 5973;
$mmdrj_apply_snippet = (string) get_post_field( 'post_content', $mmdrj_apply_snippet_id );
$mmdrj_apply_old_tier = '<article class="mm-tier"><h3>Daily Drills</h3><div class="mm-tier-price"><span class="num">$99.99</span><span class="unit">/ month with notes</span></div><p>$149.99/month with audios and notes. Verified Live Group members: $19.99/month. Qualifying Exam Guarantee, UCC, or MUL students: $49.99/month.</p><a class="mm-pg-cta-secondary" href="/product/dr-j-drills-on-call/">View Daily Drills</a></article>';
$mmdrj_apply_new_tier = '<article class="mm-tier"><h3>Drills: Daily Rounds Access</h3><div class="mm-tier-price"><span class="num">$99.99</span><span class="unit">/ month</span></div><p>Daily Rounds only. STAT, TournaMed, and Arena Pro tools are not included. Active Live Drills students: $19.99/month. Approved Exam Guarantee, UCC, or MUL students: $49.99/month.</p><a class="mm-pg-cta-secondary" href="/product/dr-j-drills-on-call/">View Daily Rounds</a></article><article class="mm-tier" id="exam-prep-arena-pro"><h3>🔒 ExamPrep: Arena Pro</h3><div class="mm-tier-price"><span class="num">$149.99</span><span class="unit">/ month</span></div><p>Coming Soon. Premium digital ExamPrep tier; checkout and premium access are locked.</p><span class="mm-pg-cta-secondary" role="link" aria-disabled="true">Coming Soon</span></article>';
if ( '' === $mmdrj_apply_old_tier || 1 !== substr_count( $mmdrj_apply_snippet, $mmdrj_apply_old_tier ) ) {
	throw new RuntimeException( 'Expected WPCode tier preimage not found.' );
}

$backup_root = dirname( rtrim( ABSPATH, '/' ) ) . '/private/codex-backups/DRJ-EXAMPREP-0920A';
if ( ! is_dir( $backup_root ) && ! wp_mkdir_p( $backup_root ) ) {
	throw new RuntimeException( 'Could not create the private rollback directory.' );
}
@chmod( $backup_root, 0700 );
$preimage = array( 'created_at' => gmdate( 'c' ), 'products' => array(), 'coupons' => array(), 'posts' => array() );
foreach ( array_keys( $required ) as $id ) {
	$product = wc_get_product( $id );
	$preimage['products'][ $id ] = array(
		'name' => $product->get_name(),
		'description' => $product->get_description(),
		'short_description' => $product->get_short_description(),
		'visibility' => $product->get_catalog_visibility(),
		'instructor_id' => get_post_meta( $id, '_mmi_instructor_id', true ),
		'payment_architecture' => get_post_meta( $id, '_mmi_payment_architecture', true ),
		'required_eligibility' => get_post_meta( $id, '_mmed_drj_required_eligibility', true ),
	);
}
foreach ( array( 9023, 9024, 9025, 9026, 9027 ) as $id ) {
	$post = get_post( $id );
	$preimage['coupons'][ $id ] = array( 'status' => $post ? $post->post_status : null, 'meta' => get_post_meta( $id ) );
}
foreach ( array( 5674, 5687, 5973 ) as $id ) {
	$content = (string) get_post_field( 'post_content', $id );
	$preimage['posts'][ $id ] = array( 'content' => $content, 'sha256' => hash( 'sha256', $content ) );
}
$backup_file = $backup_root . '/provider-preimage-' . gmdate( 'Ymd-His' ) . '.json';
if ( false === file_put_contents( $backup_file, wp_json_encode( $preimage, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), LOCK_EX ) ) {
	throw new RuntimeException( 'Could not write the provider preimage.' );
}
@chmod( $backup_file, 0600 );

$p6360 = wc_get_product( 6360 );
$p6360->set_name( $required[6360]['name'] );
$p6360->set_description( 'Daily exam-prep rounds inside Arena. This subscription includes Daily Rounds only. STAT, TournaMed, and Arena Pro tools are not included.' );
$p6360->set_short_description( 'Daily Rounds-only access inside Arena. Premium Arena tools are not included.' );
$p6360->set_catalog_visibility( 'visible' );
$p6360->save();

$p9017 = wc_get_product( 9017 );
$p9017->set_name( $required[9017]['name'] );
$p9017->set_description( 'Premium digital ExamPrep tier. Locked and Coming Soon. No checkout or premium entitlement is active for this release.' );
$p9017->set_short_description( '🔒 Coming Soon — visible for preview, not available for purchase.' );
$p9017->set_catalog_visibility( 'visible' );
$p9017->save();

$p9109 = wc_get_product( 9109 );
$p9109->set_name( $required[9109]['name'] );
$p9109->set_description( 'Daily Rounds-only monthly add-on for students with an active Live Group Drilling subscription. STAT, TournaMed, and Arena Pro tools are not included.' );
$p9109->set_short_description( 'Restricted Daily Rounds add-on for active Live Group students.' );
$p9109->set_catalog_visibility( 'hidden' );
$p9109->save();
update_post_meta( 9109, '_mmi_instructor_id', 845 );
update_post_meta( 9109, '_mmi_payment_architecture', 'division_platform' );
update_post_meta( 9109, '_mmed_drj_required_eligibility', 'live_groups_addon' );

foreach ( array( 9023, 9024, 9025, 9026, 9027 ) as $coupon_id ) {
	if ( get_post( $coupon_id ) ) {
		wp_update_post( array( 'ID' => $coupon_id, 'post_status' => 'draft' ) );
		update_post_meta( $coupon_id, '_mmdrj_private_offer_revoked_at', gmdate( 'c' ) );
		update_post_meta( $coupon_id, '_mmdrj_private_offer_revoke_reason', 'Retired by DRJ-EXAMPREP-0920A; use account-bound recurring offers.' );
	}
}

foreach ( array( 5674, 5687 ) as $post_id ) {
	$content = $mmdrj_apply_page_contents[ $post_id ];
	$content = str_replace( 'Daily Drills + Notes', 'Drills: Daily Rounds Access', $content, $name_count );
	$content = str_replace( $mmdrj_apply_old_card, $mmdrj_apply_new_card, $content, $card_count );
	if ( $name_count < 1 || 1 !== $card_count ) {
		throw new RuntimeException( 'Expected page content preimage not found for ' . $post_id );
	}
	wp_update_post( array( 'ID' => $post_id, 'post_content' => $content ) );
}

$mmdrj_apply_snippet = str_replace( $mmdrj_apply_old_tier, $mmdrj_apply_new_tier, $mmdrj_apply_snippet, $tier_count );
if ( 1 !== $tier_count ) {
	throw new RuntimeException( 'Expected WPCode tier preimage not found.' );
}
wp_update_post( array( 'ID' => $mmdrj_apply_snippet_id, 'post_content' => $mmdrj_apply_snippet ) );

foreach ( array( 5674, 5687, 5973, 6360, 9017, 9109 ) as $id ) {
	clean_post_cache( $id );
}
if ( class_exists( '\\Elementor\\Plugin' ) && isset( \Elementor\Plugin::$instance->files_manager ) ) {
	\Elementor\Plugin::$instance->files_manager->clear_cache();
}

echo wp_json_encode(
	array(
		'applied' => true,
		'backup_file' => $backup_file,
		'products' => array( 6360, 9017, 9109 ),
		'drafted_coupons' => array( 9023, 9024, 9025, 9026, 9027 ),
		'updated_posts' => array( 5674, 5687, 5973 ),
		'money_moved_cents' => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";

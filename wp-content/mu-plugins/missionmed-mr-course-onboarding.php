<?php
/**
 * Plugin Name: Mission Residency Course Onboarding
 * Description: Exact-course presentation adaptation; no payment or entitlement changes.
 * Version: 2026.10.04.1
 */
defined( 'ABSPATH' ) || exit;

function mm_mr_course_onboarding_programs() {
	return array(
		3646 => array(
			'title' => 'Interview Bootcamp Week',
			'content' => '<h2>Welcome to Interview Bootcamp Week</h2><p class="mm-mr-course-window"><strong>October 8–18, 2026 · Live Online</strong></p><p>Your standalone intensive interview-preparation program develops communication, storytelling and connection skills through live training.</p><h3>Your next steps</h3><ol><li>Sign in with the MissionMed account used for your enrollment.</li><li>Open your Matrix dashboard to access your Mission Residency environment and available program resources.</li><li>Training begins October 8. For live-session joining details or access questions, contact MissionMed using the link below.</li></ol>',
		),
		5227 => array(
			'title' => 'IV Prep Complete',
			'content' => '<h2>Welcome to IV Prep Complete</h2><p class="mm-mr-course-window"><strong>Opening phase: Interview Bootcamp Week · October 8–18, 2026 · Live Online</strong></p><p>Interview Bootcamp Week is included as the opening phase of your full-season training. Complete then continues through your final interviews in February with ongoing training, small-group work, mock interviews, personalized feedback and continued support.</p><h3>Your next steps</h3><ol><li>Sign in with the MissionMed account used for your enrollment.</li><li>Open your Matrix dashboard to access your Mission Residency environment and available program resources.</li><li>Begin with Interview Bootcamp Week on October 8. For live-session joining details or access questions, contact MissionMed using the link below.</li></ol>',
		),
	);
}

function mm_mr_course_onboarding_content( $course_id ) {
	$programs = mm_mr_course_onboarding_programs();
	if ( ! isset( $programs[ $course_id ] ) ) {
		return '';
	}
	return $programs[ $course_id ]['content'] . '<nav class="mm-mr-course-links" aria-label="Program next steps"><a href="' . esc_url( home_url( '/member-dashboard/#dashboard' ) ) . '">Open Matrix dashboard</a><a href="' . esc_url( home_url( '/my-account/' ) ) . '">My account</a><a href="' . esc_url( home_url( '/contact/' ) ) . '">Contact MissionMed</a></nav>';
}

function mm_mr_course_onboarding_template( $content ) {
	$course_id = (int) get_queried_object_id();
	if ( ! is_singular( 'sfwd-courses' ) || ! isset( mm_mr_course_onboarding_programs()[ $course_id ] ) || ! is_string( $content ) || ! str_contains( $content, 'data-elementor-id="3306"' ) ) {
		return $content;
	}
	// Adapt AFTER Elementor's shared document cache. Never write program-specific
	// data into that cache, which is also used by unrelated courses.
	$previous = libxml_use_internal_errors( true );
	$dom = new DOMDocument();
	$loaded = $dom->loadHTML( '<?xml encoding="utf-8"?><div id="mm-mr-render-root">' . $content . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
	$xpath = new DOMXPath( $dom );
	$welcome = $xpath->query( '//*[@data-elementor-id="3306"]//*[@data-id="4064e67"]' );
	$phase = $xpath->query( '//*[@data-elementor-id="3306"]//*[@data-id="627ee59"]' );
	if ( ! $loaded || 1 !== $welcome->length || 1 !== $phase->length ) {
		libxml_clear_errors(); libxml_use_internal_errors( $previous );
		return $content;
	}
	$node = $welcome->item( 0 );
	$node->setAttribute( 'class', trim( $node->getAttribute( 'class' ) . ' mm-mr-course-onboarding' ) );
	while ( $node->firstChild ) { $node->removeChild( $node->firstChild ); }
	$fragment = new DOMDocument();
	$fragment->loadHTML( '<?xml encoding="utf-8"?><div id="mm-mr-fragment">' . mm_mr_course_onboarding_content( $course_id ) . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
	foreach ( $fragment->getElementById( 'mm-mr-fragment' )->childNodes as $child ) { $node->appendChild( $dom->importNode( $child, true ) ); }
	$dead = $phase->item( 0 ); $dead->parentNode->removeChild( $dead );
	$result = ''; foreach ( $dom->getElementById( 'mm-mr-render-root' )->childNodes as $child ) { $result .= $dom->saveHTML( $child ); }
	libxml_clear_errors(); libxml_use_internal_errors( $previous );
	return $result;
}
add_filter( 'elementor/frontend/the_content', 'mm_mr_course_onboarding_template', 30 );

function mm_mr_course_onboarding_styles() {
	if ( ! is_singular( 'sfwd-courses' ) || ! isset( mm_mr_course_onboarding_programs()[ (int) get_queried_object_id() ] ) ) {
		return;
	}
	?>
	<style id="mm-mr-course-onboarding-css">
	.mm-mr-course-onboarding{background:#fff!important;color:#172e3a!important;max-width:100%;box-sizing:border-box}
	.mm-mr-course-onboarding h2,.mm-mr-course-onboarding h3,.mm-mr-course-onboarding p,.mm-mr-course-onboarding li,.mm-mr-course-onboarding strong{color:#172e3a!important;font-family:inherit;overflow-wrap:anywhere}
	.mm-mr-course-onboarding h2{font-size:clamp(1.65rem,3vw,2rem);line-height:1.25;margin:0 0 1rem}
	.mm-mr-course-onboarding h3{font-size:1.25rem;margin:1.5rem 0 .75rem}
	.mm-mr-course-onboarding p,.mm-mr-course-onboarding li{font-size:1rem;line-height:1.65}
	.mm-mr-course-onboarding ol{padding-left:1.5rem}.mm-mr-course-onboarding li{margin-bottom:.65rem}
	.mm-mr-course-links{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
	.mm-mr-course-links a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.65rem 1rem;box-sizing:border-box;background:#172e3a!important;color:#fff!important;border:2px solid #172e3a;border-radius:4px;font-size:1rem;line-height:1.4;text-decoration:underline;max-width:100%;overflow-wrap:anywhere}
	.mm-mr-course-links a:focus-visible{outline:3px solid #a33a20;outline-offset:3px}
	@media(max-width:600px){.mm-mr-course-onboarding{padding:24px 20px!important}.mm-mr-course-links{flex-direction:column}.mm-mr-course-links a{width:100%}}
	</style>
	<?php
}
add_action( 'wp_head', 'mm_mr_course_onboarding_styles', 30 );

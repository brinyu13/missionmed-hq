<?php
/**
 * Suppress legacy theme-demo footer widgets beneath Matrix application pages.
 *
 * MX-LOGIN-UX-008C, spec section 12.
 *
 * ROOT CAUSE (investigated, not guessed -- spec 12.2/12.3):
 * The "old MissionMed homepage/hero-like marketing section" that renders beneath
 * Matrix pages is NOT Elementor content, NOT the Matrix shell template, and NOT a
 * plugin `wp_footer` injection. It is the Astra theme's FOOTER WIDGET AREAS, which
 * still hold unmodified theme-demo placeholder content:
 *
 *   footer-widget-1          text-1  "About Learning"    -- lorem ipsum body copy
 *   footer-widget-2          text-2  "Important Links"   -- seven dead "#" links
 *   advanced-footer-widget-1 text-3  "Popular Subjects"  -- Cloud Computing, Japanese...
 *   advanced-footer-widget-2 text-4  "Need some help?"   -- FAQs, Child safety
 *   advanced-footer-widget-3 text-5  "Get In Touch"      -- placeholder NY address,
 *                                                           "+1 (718) 555 55 55",
 *                                                           "mail@mail.com"
 *   advanced-footer-widget-4 nav_menu-1
 *
 * Evidence: `wp option get sidebars_widgets` and `wp option get widget_text` on
 * production. The Matrix page (ID 4243, /member-dashboard/) uses the
 * `elementor_header_footer` page template, which renders the theme footer, so this
 * demo content is appended below the Matrix application on every Matrix view.
 *
 * WHAT THIS DOES:
 * Empties those widget areas for Matrix requests only, at render time. It is a
 * server-side suppression, not a CSS cover-up, and it does not modify or delete any
 * stored widget data -- every widget remains intact in the database and continues to
 * render on non-Matrix pages, so the site's legitimate global footer is unaffected
 * (spec 12.4 / AC-66). Reverting is deleting this file.
 *
 * SEPARATE RECOMMENDATION (out of scope for this ticket, needs a founder decision):
 * this placeholder content is lorem ipsum with a fake postal address, fake phone
 * number and dead links, and it is visible site-wide, not only under Matrix. The
 * complete fix is to empty these widget areas globally in Appearance > Widgets.
 * That is a database change and is deliberately NOT performed by this ticket.
 *
 * @package MissionMed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Footer widget areas carrying leftover theme-demo content.
 *
 * @return string[]
 */
function mmed_matrix_footer_cleanup_target_areas() {
	return (array) apply_filters(
		'mmed_matrix_footer_cleanup_target_areas',
		array(
			'footer-widget-1',
			'footer-widget-2',
			'advanced-footer-widget-1',
			'advanced-footer-widget-2',
			'advanced-footer-widget-3',
			'advanced-footer-widget-4',
		)
	);
}

/**
 * Is the current request a Matrix application page?
 *
 * Detected by the Matrix mount shortcode rather than a hard-coded page ID, so a
 * renamed or duplicated Matrix page is still covered.
 *
 * @return bool
 */
function mmed_matrix_footer_cleanup_is_matrix_request() {
	if ( is_admin() || ! is_singular() ) {
		return false;
	}

	$post = get_post();
	if ( ! $post instanceof WP_Post ) {
		return false;
	}

	$content = (string) $post->post_content;

	$is_matrix = has_shortcode( $content, 'mmed_hub' ) || has_shortcode( $content, 'mmed_command_center' );

	if ( ! $is_matrix ) {
		// Elementor stores its own copy of the page structure; the mount can live there.
		$elementor_data = get_post_meta( $post->ID, '_elementor_data', true );
		if ( is_string( $elementor_data ) && '' !== $elementor_data ) {
			$is_matrix = false !== strpos( $elementor_data, 'mmed_hub' )
				|| false !== strpos( $elementor_data, 'mmed_command_center' );
		}
	}

	return (bool) apply_filters( 'mmed_matrix_footer_cleanup_is_matrix_request', $is_matrix, $post );
}

/**
 * Empty the legacy footer widget areas on Matrix requests only.
 *
 * @param array $sidebars_widgets Widget assignments keyed by sidebar id.
 * @return array
 */
function mmed_matrix_footer_cleanup_filter_sidebars( $sidebars_widgets ) {
	if ( ! is_array( $sidebars_widgets ) ) {
		return $sidebars_widgets;
	}

	if ( ! mmed_matrix_footer_cleanup_is_matrix_request() ) {
		return $sidebars_widgets;
	}

	foreach ( mmed_matrix_footer_cleanup_target_areas() as $area ) {
		if ( isset( $sidebars_widgets[ $area ] ) ) {
			$sidebars_widgets[ $area ] = array();
		}
	}

	return $sidebars_widgets;
}

add_filter( 'sidebars_widgets', 'mmed_matrix_footer_cleanup_filter_sidebars', 100 );

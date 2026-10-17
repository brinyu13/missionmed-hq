<?php
/**
 * Template Name: MissionMed Hub
 *
 * Command Center layout — MR-LD-10
 *
 * @package MissionMed_Hub
 */

?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'mmed-hub-page' ); ?>>
	<?php wp_body_open(); ?>

	<div id="page" class="mmed-command-center">
		<?php MMED_Hub_Page::render_hub(); ?>
	</div>

	<?php wp_footer(); ?>
</body>
</html>

<?php
/** Focused static contract for the PSForge StoryForge-family presentation. */
declare(strict_types=1);

$root = dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/';
$page = (string) file_get_contents($root . 'includes/class-mmps-page.php');
$entry = (string) file_get_contents($root . 'assets/mmps-entry.js');
$ui = (string) file_get_contents($root . 'assets/mmps-app.js');
$css = (string) file_get_contents($root . 'assets/mmps-app.css');

$pass = 0;
$fail = 0;
function psforge_check(bool $condition, string $label): void {
	global $pass, $fail;
	if ($condition) {
		$pass++;
		echo "PASS: {$label}\n";
		return;
	}
	$fail++;
	fwrite(STDERR, "FAIL: {$label}\n");
}

psforge_check(str_contains($page, '<title>PSForge · MissionMed</title>') && str_contains($page, 'Opening PSForge'), 'document title and opening identify PSForge');
psforge_check(str_contains($page, 'PROGRAM-SPECIFIC PERSONAL STATEMENTS') && str_contains($page, 'bootForge'), 'opening carries the product descriptor and forge treatment');
psforge_check(str_contains($entry, "label.textContent = 'PSForge'") && str_contains($entry, "aria-label', 'Open PSForge'"), 'Matrix entry uses the student-facing PSForge name');
psforge_check(str_contains($ui, 'Your Personal Statement.') && str_contains($ui, 'Personalized for every residency program.'), 'hero communicates the product outcome');
psforge_check(str_contains($ui, 'Start Personalizing') && str_contains($ui, 'Continue My Statements') && str_contains($ui, '>PS Library<'), 'primary, returning-user and library actions are explicit');
psforge_check(str_contains($ui, 'Start with your PS') && str_contains($ui, 'Choose programs') && str_contains($ui, 'PSForge personalizes') && str_contains($ui, 'You review') && str_contains($ui, 'Prepare MyERAS'), 'five-step student journey is visible');
psforge_check(str_contains($ui, "approved ? '<button class=\"btn cy\"") && str_contains($ui, 'Prepare for MyERAS'), 'MyERAS entry appears only when approved statements exist');
psforge_check(str_contains($ui, 'class="matrixBack"') && str_contains($ui, 'Back to Matrix'), 'shell preserves an explicit Matrix return');
psforge_check(str_contains($css, '.psforgeWordmark') && str_contains($css, '.psforgeHeat') && str_contains($css, '@keyframes psforgeGlint'), 'StoryForge-family wordmark, forge light and entry motion are present');
psforge_check(str_contains($css, '@media (max-width:390px)') && str_contains($css, '.psforgeJourney{grid-template-columns:1fr') && str_contains($css, '@media (prefers-reduced-motion:reduce)'), 'phone and reduced-motion presentation contracts are present');

echo 'PSFORGE PRESENTATION CONTRACT: ' . ($fail ? 'FAIL' : 'PASS') . " ({$pass} passed, {$fail} failed)\n";
exit($fail ? 1 : 0);

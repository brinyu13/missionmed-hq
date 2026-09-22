<?php
/** Synthetic-only runtime proof for the application-eve safety closures. */
declare(strict_types=1);
define( 'ABSPATH', __DIR__ . '/' );
class WP_Error { public function __construct(public string $code, public string $message, public array $data=array()){} }
function is_wp_error($v): bool { return $v instanceof WP_Error; }
function sanitize_text_field($v): string { return trim(strip_tags((string)$v)); }
function sanitize_key($v): string { return preg_replace('/[^a-z0-9_\-]/','',strtolower((string)$v)); }
function wp_strip_all_tags($v): string { return strip_tags((string)$v); }
function wp_list_pluck(array $rows,string $key): array { return array_map(fn($r)=>$r[$key]??null,$rows); }

$plugin=dirname(__DIR__,2).'/wp-content/plugins/missionmed-file-vault-ps/includes/';
require $plugin.'class-mmps-region.php';
require $plugin.'class-mmps-evidence-bundle.php';
require $plugin.'class-mmps-tiers.php';
$passes=0;
function p1check(bool $ok,string $label): void { global $passes;if(!$ok){fwrite(STDERR,"FAIL: $label\n");exit(1);} $passes++;echo "PASS: $label\n"; }

p1check(MMPS_Evidence_Bundle::specialty_matches('Internal Medicine','Internal Medicine'),'canonical specialty equality passes');
p1check(!MMPS_Evidence_Bundle::specialty_matches('Internal Medicine','Family Medicine'),'cross-specialty identity fails closed');

$root=array('Intro with '.MMPS_Region::PROGRAM_TOKEN.' already named.','Replace this paragraph.','Closing at '.MMPS_Region::PROGRAM_TOKEN.' remains protected.');
$region=MMPS_Region::build($root,'REPLACE_PARAGRAPH',1);
$sub=MMPS_Region::substitute_program_token($root,'SUNY Upstate');
p1check(!is_wp_error($sub)&&count($sub['replacements'])===2&&!str_contains(implode(' ',$sub['paragraphs']),MMPS_Region::PROGRAM_TOKEN),'every exact program token resolves deterministically');
$out=MMPS_Region::reconstruct($sub['paragraphs'],$region,'SUNY Upstate gives this applicant a verified program paragraph.');
p1check(true===MMPS_Region::verify_protected_with_program_token($root,$out,$region,'SUNY Upstate'),'token substitution is the only protected-region exception');
$out[0].=' drift';
p1check(is_wp_error(MMPS_Region::verify_protected_with_program_token($root,$out,$region,'SUNY Upstate')),'surrounding protected text drift still fails');

$prefs=array('priorityProfile'=>array(
	array('key'=>'mentorship_teaching','details'=>array(),'note'=>''),
	array('key'=>'research_academics','details'=>array(),'note'=>''),
	array('key'=>'clinical_training','details'=>array(),'note'=>''),
));
$prov=array('itemSource'=>'https://example.edu/program','fresh'=>true);
$bundle=array(
	'program'=>array('state'=>'NY','city'=>'Syracuse'),
	'essential'=>array(array('factId'=>'identity','category'=>'identity','label'=>'Program name','text'=>'The program is Example Residency.')),
	'deepFacts'=>array(
		array('factId'=>'teach','category'=>'teaching','field'=>'research.curriculum','label'=>'Teaching','text'=>'Residents lead a named weekly bedside teaching conference for medical students.','provenance'=>$prov),
		array('factId'=>'research','category'=>'research','field'=>'research.research_opportunities','label'=>'Research','text'=>'Residents receive quarterly protected project studios with faculty research mentors.','provenance'=>$prov),
		array('factId'=>'training','category'=>'curriculum','field'=>'research.curriculum','label'=>'Training','text'=>'The curriculum uses a documented 4 plus 1 ambulatory training schedule.','provenance'=>$prov),
		array('factId'=>'generic','category'=>'mission','field'=>'research.culture','label'=>'Culture','text'=>'The program offers an excellent supportive environment.','provenance'=>$prov),
	),
);
$plan=MMPS_Tiers::plan($bundle,$prefs,'DEEP');
$strongIds=array_column($plan['strongReasons'],'factId');$expected=array('teach','research','training');sort($strongIds);sort($expected);
p1check($strongIds===$expected,'priority search selects three strong verified reasons without generic filler');
p1check(empty($plan['reasonInsufficient']),'three strong reasons are sufficient');
$thin=$bundle;$thin['deepFacts']=array($bundle['deepFacts'][0]);
$thinPlan=MMPS_Tiers::plan($thin,$prefs,'DEEP');
p1check($thinPlan['reasonInsufficient']&&count($thinPlan['strongReasons'])===1,'weak evidence is not used as filler when fewer than three reasons exist');
echo "PSV APPLICATION-EVE P1 CLOSURE RUNTIME: PASS ($passes assertions)\n";

<?php
declare(strict_types=1);
// Pure presentation and Woo/config doubles. No runtime/payment acceptance.
require $argv[1] ?? dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingOfferPolicy.php';
require dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingLandingSection.php';
use MissionMed\Residency\Coaching\CoachingLandingSection;
use MissionMed\Residency\Coaching\CoachingOfferPolicy;
define('ABSPATH', __DIR__);
define('MMED_MR_COACHING_PROTECTED_IDS', array(5504, 5867, 3576, 5865));
require dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-alternate-assets/CoachingLandingIntegration.php';
$count = 0;
function check($ok, $label) { global $count; ++$count; if (!$ok) { throw new RuntimeException($label); } }
$contract = json_decode(file_get_contents(dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingPublicContract.json'), true, 512, JSON_THROW_ON_ERROR);
$now = new DateTimeImmutable('2026-10-30T12:00:00-04:00');
check($contract['activation_enabled'] === false, 'packaged public contract stays disabled');
check(CoachingLandingSection::render($contract, array(), $now) === '', 'unreleased component produces no public placeholder');
check(array_keys($contract) === array('currency','activation_enabled','coupon','offers','refund'), 'minimal public-only contract keys');
check(!preg_match('~/Users/|evidence|mission|authority|customer|email|rollout~i', json_encode($contract)), 'no internal evidence paths or PII');
$map = array('single'=>900001,'three'=>900002,'five'=>900003); // Synthetic only.
$policyRelease = array('enabled'=>true,'purchasable_skus'=>array_keys($map),'product_ids'=>$map,'verified_coaching_product_ids'=>array_values($map),'protected_course_product_ids'=>array(5504),'canonical_matrix_scheduler_verified'=>true,'atomic_allocation_verified'=>true,'independently_verified_refund_terms'=>true);
$active = $contract; $active['activation_enabled'] = true;
$policy = new CoachingOfferPolicy($active, $policyRelease);
$release = array('publication_enabled'=>true,'public_copy_approved'=>true,'native_cap_enforcement_verified'=>true,'introductory_offer_currently_open'=>true,'emergency_request'=>array('url'=>'/contact/#form_contact-form','verified_nonpayment_path'=>true));
foreach ($map as $sku=>$id) { $release['checkout'][$sku] = array('verified'=>true,'product_id'=>$id,'url'=>'/product/synthetic-'.$sku.'/'); }
$html = CoachingLandingSection::render($active, $release, $now, $policy);
foreach (array('$249','$749','$1,199','$2,499') as $price) { check(str_contains($html, '>'.$price.'</p>'), 'approved introductory tuition '.$price); }
check(str_contains($html,'MATCHREADY2026') && str_contains($html,'first 20 qualifying verified paid enrollments') && str_contains($html,'October 31, 2026'), 'verified capped campaign disclosure');
check(!str_contains($html,'<del') && !str_contains($html,'was $') && str_contains($html,'Future standard tuition: $399'), 'no false former price');
check(substr_count($html,'href="/product/synthetic-') === 3, 'only mapped regular product CTAs');
check(str_contains($html,'480-minute (8-hour)') && str_contains($html,'two additional 105-minute follow-up mocks') && str_contains($html,'one 45-minute post-interview debrief'), 'approved intensive scope');
check(str_contains($html,'href="/contact/#form_contact-form"') && !str_contains($html,'<form') && str_contains($html,'subject “Emergency Interview Intensive request”') && str_contains($html,'preferred dates, your upcoming interview date, timezone and contact information'), 'existing nonpayment form plus complete request guidance');
check(!str_contains($html,'Checkout not configured') && !str_contains($html,'Request form not configured'), 'no internal public placeholders');
foreach (array('publication_enabled','public_copy_approved') as $gate) { $r=$release; $r[$gate]=false; check(CoachingLandingSection::render($active,$r,$now,$policy)==='', 'publication gate '.$gate); }
foreach (array('canonical_matrix_scheduler_verified','atomic_allocation_verified','independently_verified_refund_terms') as $gate) { $r=$policyRelease; $r[$gate]=false; check(CoachingLandingSection::render($active,$release,$now,new CoachingOfferPolicy($active,$r))==='', 'policy release gate '.$gate); }
$after = CoachingLandingSection::render($active,$release,new DateTimeImmutable('2026-11-01T00:00:00-04:00'),$policy);
check(!str_contains($after,'MATCHREADY2026') && str_contains($after,'>$399</p>') && str_contains($after,'/product/synthetic-single/'), 'expired introduction retains regular checkout');
$r=$release;$r['native_cap_enforcement_verified']=false;check(!str_contains(CoachingLandingSection::render($active,$r,$now,$policy),'MATCHREADY2026'),'unverified cap hides campaign');

// Actual wrapper derives presentation only from existing server config and
// release/product checks. These are explicit native boundary doubles.
$GLOBALS['config'] = array('architecture'=>'woo_hybrid_v2','enabled'=>true,'purchasable_skus'=>array_keys($map),'product_ids'=>$map,'woo_allocation_verified'=>true,'native_scheduler_verified'=>true,'refund_disclosure_verified'=>true,'independent_release_accepted'=>true,'new_sku_zelle_compatibility_verified'=>true,'landing_release'=>array('publication_enabled'=>true,'public_copy_approved'=>true));
$GLOBALS['unsafe_url']=false;
function mmed_mr_coaching_config(){return $GLOBALS['config'];}
function mmed_mr_coaching_release_ready($sku){$c=$GLOBALS['config'];foreach(array('enabled','woo_allocation_verified','native_scheduler_verified','refund_disclosure_verified','independent_release_accepted','new_sku_zelle_compatibility_verified') as $g){if(($c[$g]??false)!==true)return false;}return ($c['architecture']??'')==='woo_hybrid_v2'&&in_array($sku,$c['purchasable_skus']??array(),true);}
function wc_get_product($id){return new class($id){function __construct(private int $id){}function get_permalink(){return $GLOBALS['unsafe_url']?'https://external.invalid/product/':'https://fixture.invalid/product/owned-'.$this->id.'/';}};}
function home_url($p){return 'https://fixture.invalid'.$p;}
$wrapper = mmed_mr_coaching_landing_markup();
check(substr_count($wrapper,'href="/product/owned-')===3,'actual product permalinks derived from configured mappings');
check(!str_contains($wrapper,'MATCHREADY2026'),'no campaign without explicit current cap/open verification');
foreach(array('enabled','woo_allocation_verified','native_scheduler_verified','refund_disclosure_verified','independent_release_accepted','new_sku_zelle_compatibility_verified') as $g){$GLOBALS['config'][$g]=false;check(mmed_mr_coaching_landing_markup()==='','actual release gate '.$g);$GLOBALS['config'][$g]=true;}
$GLOBALS['config']['landing_release']['publication_enabled']=false;check(mmed_mr_coaching_landing_markup()==='','wrapper suppresses unpublished section');$GLOBALS['config']['landing_release']['publication_enabled']=true;
$GLOBALS['unsafe_url']=true;check(mmed_mr_coaching_landing_markup()==='','external product target fails closed');$GLOBALS['unsafe_url']=false;
$GLOBALS['config']['product_ids']['single']=5504;check(mmed_mr_coaching_landing_markup()==='','protected product cannot become private coaching CTA');
echo 'PASS '.$count." focused nonfinancial landing integration assertions; source-only, no runtime acceptance.\n";

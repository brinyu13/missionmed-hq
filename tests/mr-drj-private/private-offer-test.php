<?php
// Pure policy boundary tests, no WordPress/provider mutation or financial assertions.
define('ABSPATH',__DIR__);
function add_action(...$args){}
function add_filter(...$args){}
require __DIR__.'/../../wp-content/mu-plugins/missionmed-mr-drj-private-offer.php';
$good=array_fill_keys(['enabled','integration_ready','authenticated','identity_matches','verified_drj','communication_eligible','not_suppressed','not_enrolled','stock_available','product_only','one_coupon','unused','identity_snapshot_current'],true);
$good['now']=MissionMed_MR_DrJ_Private_Offer::EXPIRY-1;
$count=0;
function check($value,$label){global $count;if(!$value){throw new Exception('FAIL '.$label);}++$count;echo 'PASS '.$label.PHP_EOL;}
check(MissionMed_MR_DrJ_Private_Offer::policy($good)==='','verified exact account accepted before deadline');
foreach($good as $key=>$value){if($key==='now'){continue;}$f=$good;$f[$key]=false;check(MissionMed_MR_DrJ_Private_Offer::policy($f)===$key,'deny '.$key);}
$f=$good;$f['now']=MissionMed_MR_DrJ_Private_Offer::EXPIRY;check(MissionMed_MR_DrJ_Private_Offer::policy($f)==='expired','exact expiration boundary denied');
$f['now']++;check(MissionMed_MR_DrJ_Private_Offer::policy($f)==='expired','after expiration denied');
check(MissionMed_MR_DrJ_Private_Offer::REFERENCE-MissionMed_MR_DrJ_Private_Offer::DISCOUNT===2499,'standard reference gives2499');
check(3099-MissionMed_MR_DrJ_Private_Offer::DISCOUNT!==2499,'stale promotional price must not be discount reference');
check((new DateTimeImmutable('2026-10-10 12:00:00',new DateTimeZone('America/New_York')))->getTimestamp()===MissionMed_MR_DrJ_Private_Offer::EXPIRY,'Eastern deadline timestamp exact');
echo "RESULT $count/$count PASS\n";

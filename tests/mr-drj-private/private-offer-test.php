<?php
// Pure policy boundary tests, no WordPress/provider mutation or financial assertions.
define('ABSPATH',__DIR__);
function add_action(...$args){}
function add_filter(...$args){}
// All enrollment/payment readers are in-memory stubs. Never bootstrap WordPress.
$scenario = ['courses'=>[], 'orders'=>[], 'expired'=>[], 'denied'=>[]];
$order_queries = [];
function learndash_user_get_enrolled_courses($user_id){global $scenario; return $scenario['courses'];}
function sfwd_lms_has_access($course,$user_id){global $scenario; return !in_array($course,$scenario['denied'],true);}
function ld_course_access_expired($course,$user_id){global $scenario; return in_array($course,$scenario['expired'],true);}
function wc_get_order_statuses(){return ['wc-pending'=>'Pending','wc-processing'=>'Processing','wc-completed'=>'Completed','wc-on-hold'=>'On hold','wc-cancelled'=>'Cancelled','wc-refunded'=>'Refunded','wc-failed'=>'Failed'];}
function wc_get_orders($args){
    global $scenario,$order_queries;
    $order_queries[]=$args;
    if (($args['customer_id']??null)===42 || ($args['billing_email']??null)==='invited@example.test') {return $scenario['orders'];}
    throw new Exception('Unexpected identity query');
}
final class PrivateOfferTestItem {
    private $product;
    public function __construct($product){$this->product=$product;}
    public function get_product_id(){return $this->product;}
}
final class PrivateOfferTestOrder {
    private $id,$product,$paid,$total,$refund;
    public function __construct($id,$product,$paid=true,$total=3499,$refund=0){$this->id=$id;$this->product=$product;$this->paid=$paid;$this->total=$total;$this->refund=$refund;}
    public function get_id(){return $this->id;}
    public function get_date_paid(){return $this->paid ? new DateTimeImmutable('2026-10-01T12:00:00Z') : null;}
    public function get_total(){return $this->total;}
    public function get_total_refunded(){return $this->refund;}
    public function get_items(){return [new PrivateOfferTestItem($this->product)];}
}
require __DIR__.'/../../wp-content/mu-plugins/missionmed-mr-drj-private-offer.php';
$good=array_fill_keys(['enabled','integration_ready','authenticated','identity_matches','source_audience','founder_approved','not_suppressed','not_enrolled','stock_available','product_only','one_coupon','unused','identity_snapshot_current'],true);
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
function enrollment_case($label,$courses,$orders,$expected,$ignore=0,$expired=[],$denied=[]){
    global $scenario,$order_queries;
    $scenario=compact('courses','orders','expired','denied');$order_queries=[];
    check(MissionMed_MR_DrJ_Private_Offer::existing_program(42,'invited@example.test',$ignore)===$expected,$label);
    foreach($order_queries as $args){
        check(($args['limit']??null)===-1 && ($args['status']??[])===array_keys(wc_get_order_statuses()),$label.' exhaustive status query');
    }
}
enrollment_case('current course without paid order not excluded',[5227],[],false);
enrollment_case('historical paid without current course not excluded',[],[new PrivateOfferTestOrder(101,3576)],false);
enrollment_case('pending without date paid not excluded',[3893],[new PrivateOfferTestOrder(101,3575,false)],false);
enrollment_case('DrJ 3893 carrier alone not excluded',[3893],[],false);
enrollment_case('paid360 plus current3893 excluded',[3893],[new PrivateOfferTestOrder(101,3575)],true);
enrollment_case('partial refund positive net plus course excluded',[5227],[new PrivateOfferTestOrder(101,3576,true,3499,1000)],true);
enrollment_case('full refund not excluded',[5227],[new PrivateOfferTestOrder(101,3576,true,3499,3499)],false);
enrollment_case('current order ignored',[5227],[new PrivateOfferTestOrder(101,3576)],false,101);
enrollment_case('expired course not current',[5227],[new PrivateOfferTestOrder(101,3576)],false,0,[5227]);
enrollment_case('course without access not current',[5227],[new PrivateOfferTestOrder(101,3576)],false,0,[],[5227]);
enrollment_case('unrelated course cannot pair with purchase',[3893],[new PrivateOfferTestOrder(101,3576)],false);
enrollment_case('unrelated purchase cannot pair with carrier',[3893],[new PrivateOfferTestOrder(101,9999)],false);
foreach([3575=>3893,5511=>3893,3576=>5227,5512=>5227,5513=>5227,5504=>3646] as $product=>$course){
    enrollment_case('paid target mapping '.$product,[$course],[new PrivateOfferTestOrder(101,$product)],true);
}
enrollment_case('over refund nonpositive net not excluded',[5227],[new PrivateOfferTestOrder(101,3576,true,3499,3500)],false);
enrollment_case('missing authoritative enrollment reader fails closed',null,[],true);
echo "RESULT $count/$count PASS\n";

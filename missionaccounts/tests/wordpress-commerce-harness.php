<?php
define('ABSPATH', __DIR__);
define('DAY_IN_SECONDS', 86400);
$GLOBALS['user_meta']=array(); $GLOBALS['post_meta']=array(); $GLOBALS['options']=array();
$GLOBALS['orders']=array(); $GLOBALS['course_access']=array(); $GLOBALS['users']=array();
$GLOBALS['coupons']=array(); $GLOBALS['coupon_codes']=array(); $GLOBALS['current_user_id']=99;
$GLOBALS['notices']=array(); $GLOBALS['next_coupon_id']=1000; $GLOBALS['cart']=null;
function add_filter(){return true;} function add_action(){return true;} function __($v){return $v;}
function absint($v){return abs((int)$v);} function sanitize_key($v){return preg_replace('/[^a-z0-9_\-]/','',strtolower((string)$v));}
function sanitize_text_field($v){return trim(strip_tags((string)$v));} function sanitize_textarea_field($v){return trim((string)$v);}
function esc_url_raw($v){return (string)$v;} function home_url($p=''){return 'https://missionmedinstitute.com'.(string)$p;}
function add_query_arg($k,$v,$url){return $url.(str_contains($url,'?')?'&':'?').rawurlencode($k).'='.rawurlencode((string)$v);}
function get_option($k,$d=false){return $GLOBALS['options'][$k]??$d;} function update_option($k,$v){$GLOBALS['options'][$k]=$v;return true;}
function get_user_meta($u,$k,$single=true){return $GLOBALS['user_meta'][$u][$k]??($single?'':array());}
function update_user_meta($u,$k,$v){$GLOBALS['user_meta'][$u][$k]=$v;return true;} function delete_user_meta($u,$k){unset($GLOBALS['user_meta'][$u][$k]);}
function get_post_meta($p,$k,$single=true){return $GLOBALS['post_meta'][$p][$k]??($single?'':array());}
function update_post_meta($p,$k,$v){$GLOBALS['post_meta'][$p][$k]=$v;return true;}
function get_post($id){return in_array((int)$id,array(3651,3652,6360,9015,9016,9017),true)?(object)array('ID'=>(int)$id):null;}
function get_posts($args){$out=array();foreach($GLOBALS['coupons'] as $id=>$row){if(($GLOBALS['post_meta'][$id][$args['meta_key']]??null)===$args['meta_value'])$out[]=$id;}return $out;}
function wp_update_post($args){if(isset($GLOBALS['coupons'][$args['ID']]))$GLOBALS['coupons'][$args['ID']]['status']=$args['post_status'];return $args['ID'];}
function wp_generate_password(){return 'A7BC9D2EF4GH6JK8MN3PQR';}
function wc_get_order($id){return $GLOBALS['orders'][$id]??false;}
function ld_update_course_access($u,$c,$remove=false){$GLOBALS['course_access'][$u][$c]=!$remove;}
function sfwd_lms_has_access($c,$u){return !empty($GLOBALS['course_access'][$u][$c]);}
function get_current_user_id(){return $GLOBALS['current_user_id'];} function is_user_logged_in(){return true;} function current_user_can(){return true;}
function get_users($args){$rows=array();foreach($GLOBALS['users'] as $user){if(($GLOBALS['user_meta'][$user->ID][$args['meta_key']]??null)===$args['meta_value'])$rows[]=$user;}return array_slice($rows,0,$args['number']);}
function is_wp_error($v){return $v instanceof WP_Error;} function wc_add_notice($m,$t){$GLOBALS['notices'][]=array($t,$m);}
function register_rest_route(){return true;} function is_page(){return false;} function in_the_loop(){return false;} function is_main_query(){return false;}
function WC(){return (object)array('cart'=>$GLOBALS['cart']);}
class WP_Error { public function __construct(public $code,public $message,public $data=array()){} }
class WP_REST_Request { function __construct(private $params=array()){} function get_param($key){return $this->params[$key]??null;} function get_route(){return '';} }
class WP_REST_Response { function __construct(public $data,public $status=200){} function header(){} }
class WP_User { public function __construct(public $ID,public $user_email='student@example.invalid'){} }
class WC_Subscriptions {}
class WC_Coupon {
  private $id=0; private $row=array();
  function __construct($value=null){if(is_numeric($value)){$this->id=(int)$value;$this->row=$GLOBALS['coupons'][$this->id]??array();}elseif(is_string($value)&&isset($GLOBALS['coupon_codes'][$value])){$this->id=$GLOBALS['coupon_codes'][$value];$this->row=$GLOBALS['coupons'][$this->id];}}
  function set_code($v){$this->row['code']=$v;} function set_description($v){$this->row['description']=$v;} function set_discount_type($v){$this->row['discount_type']=$v;}
  function set_amount($v){$this->row['amount']=$v;} function set_individual_use($v){$this->row['individual_use']=$v;} function set_product_ids($v){$this->row['product_ids']=$v;}
  function set_email_restrictions($v){$this->row['emails']=$v;} function set_usage_limit($v){$this->row['usage_limit']=$v;} function set_usage_limit_per_user($v){$this->row['usage_per_user']=$v;}
  function set_date_expires($v){$this->row['expires']=$v;} function save(){if(!$this->id)$this->id=++$GLOBALS['next_coupon_id'];$this->row['status']='publish';$GLOBALS['coupons'][$this->id]=$this->row;$GLOBALS['coupon_codes'][$this->row['code']]=$this->id;return $this->id;}
  function get_id(){return $this->id;}
}
class HarnessItem { function __construct(private $product,private $variation=0){} function get_product_id(){return $this->product;} function get_variation_id(){return $this->variation;} }
class HarnessOrder { public $status='processing'; function __construct(private $id,private $user,private $items,private $codes=array()){} function get_id(){return $this->id;} function get_user_id(){return $this->user;} function get_items(){return $this->items;} function get_status(){return $this->status;} function get_coupon_codes(){return $this->codes;} }
class HarnessProduct { function __construct(private $id,private $price,private $parent=0){} function get_id(){return $this->id;} function get_parent_id(){return $this->parent;} function set_price($v){$this->price=(string)$v;} function get_price(){return $this->price;} }
class HarnessCart { function __construct(private $rows){} function get_cart(){return $this->rows;} }
require dirname(__DIR__) . '/infra/wordpress/missionmed-drj-examprep-commerce.php';

$GLOBALS['orders'][10]=new HarnessOrder(10,1,array(new HarnessItem(3651)));
mmdrj_grant_courses_from_order(10); $live_granted=sfwd_lms_has_access(3655,1);
$GLOBALS['orders'][10]->status='cancelled'; mmdrj_revoke_courses_from_order(10); $live_revoked=!sfwd_lms_has_access(3655,1);
$GLOBALS['course_access'][2][3655]=true; $GLOBALS['orders'][11]=new HarnessOrder(11,2,array(new HarnessItem(3651)));
mmdrj_grant_courses_from_order(11); $GLOBALS['orders'][11]->status='refunded'; mmdrj_revoke_courses_from_order(11); $preexisting_preserved=sfwd_lms_has_access(3655,2);
$GLOBALS['orders'][12]=new HarnessOrder(12,3,array(new HarnessItem(3652))); mmdrj_grant_courses_from_order(12); $unrelated_excluded=empty($GLOBALS['course_access'][3]);
$GLOBALS['orders'][13]=new HarnessOrder(13,4,array(new HarnessItem(6360))); mmdrj_grant_courses_from_order(13); $drills_granted=sfwd_lms_has_access(6357,4);
$GLOBALS['orders'][13]->status='refunded'; mmdrj_revoke_courses_from_order(13); $drills_revoked=!sfwd_lms_has_access(6357,4);

$newProduct=new HarnessProduct(3651,'1.00'); $renewalProduct=new HarnessProduct(3651,'275.00');
$cart=new HarnessCart(array(array('data'=>$newProduct),array('data'=>$renewalProduct,'subscription_renewal'=>true)));
mmdrj_enforce_new_checkout_prices($cart); $new_checkout_price_exact=$newProduct->get_price()==='300.00'; $grandfathered_renewal_preserved=$renewalProduct->get_price()==='275.00';
$GLOBALS['cart']=$cart; mmdrj_validate_checkout_catalog_prices(); $checkout_price_validated=count($GLOBALS['notices'])===0;

$studentUuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; $otherUuid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
$GLOBALS['users'][5]=new WP_User(5,'eligible@example.invalid'); $GLOBALS['users'][6]=new WP_User(6,'other@example.invalid');
$GLOBALS['user_meta'][5][MMDRJ_ACCOUNT_UUID_META]=$studentUuid; $GLOBALS['user_meta'][5][MMDRJ_ELIGIBILITY_META]=array('ucc');
$GLOBALS['user_meta'][6][MMDRJ_ACCOUNT_UUID_META]=$otherUuid;
$GLOBALS['current_user_id']=5; $issued=mmdrj_issue_private_offer(new WP_REST_Request(array('student_uuid'=>$studentUuid,'reason'=>'Verified UCC eligibility')));
$couponId=array_key_first($GLOBALS['coupons']); $coupon=new WC_Coupon($couponId);
$private_offer_issued=$issued instanceof WP_REST_Response&&$issued->status===201&&$issued->data['amount_cents']===3999&&$GLOBALS['coupons'][$couponId]['usage_limit']===1;
$private_offer_bound=mmdrj_validate_private_coupon(true,$coupon)===true; $GLOBALS['current_user_id']=6; $private_offer_wrong_account_blocked=mmdrj_validate_private_coupon(true,$coupon)===false;
$GLOBALS['current_user_id']=5; $revoke=mmdrj_revoke_private_offer(new WP_REST_Request(array('student_uuid'=>$studentUuid,'reason'=>'Offer withdrawn')));
$private_offer_revoked=$revoke instanceof WP_REST_Response&&$revoke->data['revoked']===1&&mmdrj_validate_private_coupon(true,$coupon)===false;
$ineligible=mmdrj_issue_private_offer(new WP_REST_Request(array('student_uuid'=>$otherUuid,'reason'=>'Should fail'))); $ineligible_blocked=$ineligible instanceof WP_Error&&$ineligible->code==='private_offer_not_eligible';

echo json_encode(compact('live_granted','live_revoked','preexisting_preserved','unrelated_excluded','drills_granted','drills_revoked','new_checkout_price_exact','grandfathered_renewal_preserved','checkout_price_validated','private_offer_issued','private_offer_bound','private_offer_wrong_account_blocked','private_offer_revoked','ineligible_blocked'));

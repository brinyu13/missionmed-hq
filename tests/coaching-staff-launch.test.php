<?php
/** Source-only deterministic fixtures. No WordPress boot, DB, mail or provider calls. */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/fixture-only/');
$options=[]; $postmeta=[]; $products=[]; $orders=[]; $hooks=[]; $sent=[]; $checks=0; $failures=[];
function get_option($key,$default=false){return $GLOBALS['options'][$key]??$default;}
function add_option($key,$value,$deprecated='',$autoload='yes') {if(array_key_exists($key,$GLOBALS['options']))return false;$GLOBALS['options'][$key]=$value;return true;}
function get_post_meta($id,$key,$single=true){return $GLOBALS['postmeta'][$id][$key]??'';}
function wc_get_product($id){return $GLOBALS['products'][$id]??false;}
function wc_get_order($id){return $GLOBALS['orders'][$id]??false;}
function add_action($name,$callback,$priority=10,$args=1){$GLOBALS['hooks'][$name][$priority][]=$callback;}
function add_filter($name,$callback,$priority=10,$args=1){add_action($name,$callback,$priority,$args);}
function wp_json_encode($value){return json_encode($value);}
function current_time($kind,$gmt=false){return time();}
function esc_html($value){return htmlspecialchars((string)$value,ENT_QUOTES,'UTF-8');}
function admin_url($value){return 'https://fixture.invalid/wp-admin/'.$value;}
function wp_mail($to,$subject,$body){$GLOBALS['sent'][]=[$to,$subject,$body];return true;}
function wc_add_notice($text,$type='error'){}
function WC(){return $GLOBALS['woo'];}
class StaffFeesApi {
    public array $fees=[];public int $writes=0;
    function get_fees(){return $this->fees;}
    function set_fees($fees){$this->writes++;$this->fees=[];foreach($fees as $fee){$fee=(object)$fee;$this->fees[$fee->id]=$fee;}}
}
class StaffSession {public string $chosen='stripe';function get($key){return $key==='chosen_payment_method'?$this->chosen:null;}}
class StaffCart {public array $lines=[],$codes=[];public StaffFeesApi $feeApi;function __construct(){$this->feeApi=new StaffFeesApi;}function get_cart(){return $this->lines;}function get_applied_coupons(){return $this->codes;}function fees_api(){return $this->feeApi;}}
$woo=(object)['cart'=>new StaffCart,'session'=>new StaffSession];
class StaffProduct {function __construct(public int $id,public string $price,public bool $virtual=true,public string $status='publish'){}function get_id(){return $this->id;}function is_virtual(){return $this->virtual;}function get_status(){return $this->status;}function get_price($context=''){return $this->price;}function get_regular_price($context=''){return $this->price;}}
class StaffCoupon {function __construct(public string $code){}function get_code(){return $this->code;}}
class StaffItem {public int $id=71,$product=91001,$variation=0;public float $qty=1;public string $total='249.00';function get_id(){return $this->id;}function get_product_id(){return $this->product;}function get_variation_id(){return $this->variation;}function get_quantity(){return $this->qty;}function get_total($context=''){return $this->total;}}
class StaffOrder {
    public int $id=81,$customer=19;public string $currency='USD',$gateway='stripe',$total='249.00',$fees='0',$tax='0',$refund='0',$status='pending',$transaction='';
    public array $codes=['matchready2026'],$items=[],$meta=['_mmed_staff_coaching_terms'=>'2026-10-20-staff-v1'],$notes=[];
    public bool $paid=false,$captured=false;public int $created;public ?int $paidAt=null;
    function __construct(){$this->items=[new StaffItem];$this->created=time()-30;}
    function get_items($type=''){return $this->items;}function get_currency(){return $this->currency;}function get_customer_id(){return $this->customer;}function get_payment_method(){return $this->gateway;}function get_coupon_codes(){return $this->codes;}
    function get_date_created(){return (new DateTimeImmutable)->setTimestamp($this->created);}function get_meta($key,$single=true){return $this->meta[$key]??'';}
    function get_total($context=''){return $this->total;}function get_total_fees(){return $this->fees;}function get_total_tax(){return $this->tax;}function get_total_refunded(){return $this->refund;}function get_id(){return $this->id;}function get_order_number(){return (string)$this->id;}
    function update_meta_data($key,$value){$this->meta[$key]=$value;}function save(){}function add_order_note($note){$this->notes[]=$note;}function is_paid(){return $this->paid;}function has_status($statuses){return in_array($this->status,(array)$statuses,true);}function get_status(){return $this->status;}
    function get_date_paid(){return $this->paidAt===null?null:(new DateTimeImmutable)->setTimestamp($this->paidAt);}function get_transaction_id(){return $this->transaction;}
}
class WC_Stripe_Order_Helper {
    static function get_instance(){return new self;}
    function is_stripe_charge_captured($order){return $order->captured;}
    function get_stripe_intent_id($order){return $order->transaction;}
}
// Load actual source and actual legacy helpers, registering hooks without executing them.
require __DIR__.'/../wp-content/mu-plugins/missionmed-mr-coaching.php';
require __DIR__.'/../wp-content/mu-plugins/missionmed-mr-coaching-staff.php';
function check($value,$label){$GLOBALS['checks']++;if(!$value)$GLOBALS['failures'][]=$label;}
function rejects(callable $fn,$label){try{$fn();check(false,$label);}catch(Throwable $e){check(true,$label);}}
function hook($name,$priority){$list=$GLOBALS['hooks'][$name][$priority]??[];return end($list);}
function admit_fixture(StaffOrder $order){$GLOBALS['orders'][$order->id]=$order;mmed_staff_coaching_admit($order->id,[],$order);return $order;}
function paid_fixture(){ $o=admit_fixture(new StaffOrder);$o->paid=true;$o->status='processing';$o->paidAt=time();$o->captured=true;$o->transaction='pi_fixtureCaptured81';return $o; }
$ids=['single'=>91001,'three'=>91002,'five'=>91003,'emergency'=>91004];
$options['mmed_staff_coaching_v1']=['enabled'=>true,'release_reviewed'=>true,'product_ids'=>$ids];
$options['admin_email']='staff@example.invalid';
$catalog=mmed_staff_coaching_catalog();
$expected=['single'=>[39900,24900],'three'=>[109900,74900],'five'=>[179900,119900],'emergency'=>[399900,249900]];
foreach($expected as $sku=>[$regular,$promo]){check([$catalog[$sku]['regular'],$catalog[$sku]['promo']]===[$regular,$promo],$sku.' exact cents');$postmeta[$ids[$sku]]=['_mmed_staff_coaching_sku'=>$sku];$products[$ids[$sku]]=new StaffProduct($ids[$sku],number_format($regular/100,2,'.',''));}
check(str_contains($catalog['single']['services'],'105-minute')&&str_contains($catalog['single']['services'],'15 minutes')&&str_contains($catalog['single']['services'],'90 minutes'),'single service duration');
check(str_contains($catalog['three']['services'],'Three 105-minute')&&str_contains($catalog['three']['services'],'two-hour')&&str_contains($catalog['three']['services'],'two 45-minute'),'three package count');
check(str_contains($catalog['five']['services'],'Five 105-minute')&&str_contains($catalog['five']['services'],'three 45-minute'),'five package count');
check(str_contains($catalog['emergency']['services'],'eight-hour')&&str_contains($catalog['emergency']['services'],'including one')&&str_contains($catalog['emergency']['services'],'two separate 105-minute')&&str_contains($catalog['emergency']['services'],'45-minute'),'emergency includes one mock plus two separate');
check(mmed_staff_coaching_ready('single'),'reviewed mapped standard ready');
check(!mmed_staff_coaching_ready('emergency'),'emergency request-first');
$options['mmed_staff_coaching_v1']['enabled']=false;check(!mmed_staff_coaching_ready('single'),'enabled gate');$options['mmed_staff_coaching_v1']['enabled']=true;
$options['mmed_staff_coaching_v1']['release_reviewed']=false;check(!mmed_staff_coaching_ready('single'),'review gate');$options['mmed_staff_coaching_v1']['release_reviewed']=true;
check(mmed_staff_coaching_sku(92000)==='','unmapped denied');
foreach(MMED_MR_COACHING_PROTECTED_IDS as $id){$options['mmed_staff_coaching_v1']['product_ids']['single']=$id;$postmeta[$id]['_mmed_staff_coaching_sku']='single';check(mmed_staff_coaching_sku($id)===''&&!mmed_staff_coaching_ready('single'),'protected ID '.$id.' denied');}
$options['mmed_staff_coaching_v1']['product_ids']=$ids;
$postmeta[91001]['_mmed_staff_coaching_sku']='five';check(!mmed_staff_coaching_ready('single'),'mismatched SKU metadata denied');$postmeta[91001]['_mmed_staff_coaching_sku']='single';
$cartGuard=hook('woocommerce_add_to_cart_validation',200);
$purchasable=hook('woocommerce_is_purchasable',200);$savedStaffConfig=$options['mmed_staff_coaching_v1'];$woo->cart->lines=[];
unset($options['mmed_staff_coaching_v1']);
check(mmed_staff_coaching_tagged(91001)&&$purchasable(true,$products[91001])===false&&$cartGuard(true,91001,1,0)===false,'missing configuration denies tagged product purchase and cart');
$options['mmed_staff_coaching_v1']='malformed-config';
check(mmed_staff_coaching_tagged(91001)&&$purchasable(true,$products[91001])===false&&$cartGuard(true,91001,1,0)===false,'string configuration denies tagged product purchase and cart');
check(!mmed_staff_coaching_tagged(5504)&&$purchasable(true,new StaffProduct(5504,'549.00'))===true&&$cartGuard(true,5504,1,0)===true,'protected unrelated product retains prior permission');
check($purchasable(true,new StaffProduct(92000,'10.00'))===true&&$cartGuard(true,92000,1,0)===true,'unknown untagged product retains prior permission');
check($purchasable(false,$products[91001])===false&&$purchasable(false,new StaffProduct(5504,'549.00'))===false&&$purchasable(false,new StaffProduct(92000,'10.00'))===false&&$cartGuard(false,92000,1,0)===false,'prior denial remains false for tagged and unrelated products');
$options['mmed_staff_coaching_v1']=$savedStaffConfig;
$feeFixture=[
    'card-processing'=>(object)['id'=>'card-processing','name'=>'Card processing fee (2.9%)','amount'=>7.22,'taxable'=>false,'tax_class'=>'','total'=>7.22,'tax'=>0],
    'unrelated-taxable'=>(object)['id'=>'unrelated-taxable','name'=>'Other fee','amount'=>3.5,'taxable'=>true,'tax_class'=>'reduced-rate','total'=>3.5,'tax'=>0.35],
    'similarly-named'=>(object)['id'=>'similarly-named','name'=>'Card processing fee (3%)','amount'=>2,'taxable'=>false,'tax_class'=>'','total'=>2,'tax'=>0],
];
$woo->cart->lines=[['product_id'=>91001,'quantity'=>1]];$woo->cart->feeApi->fees=$feeFixture;
mmed_staff_coaching_fees($woo->cart);$expectedFees=$feeFixture;unset($expectedFees['card-processing']);
check($woo->cart->feeApi->fees==$expectedFees&&array_keys($woo->cart->feeApi->fees)===array_keys($expectedFees),'owned Stripe cart removes only exact surcharge preserving other fee IDs and tax');
$afterFirst=$woo->cart->feeApi->fees;$feeWrites=$woo->cart->feeApi->writes;mmed_staff_coaching_fees($woo->cart);
check($woo->cart->feeApi->fees===$afterFirst&&$woo->cart->feeApi->writes===$feeWrites,'fee recalculation idempotent');
$woo->cart->feeApi->fees=$feeFixture;$woo->cart->lines[]=['product_id'=>5504,'quantity'=>1];mmed_staff_coaching_fees($woo->cart);
check($woo->cart->feeApi->fees===$feeFixture,'mixed cart fee state unchanged');
$woo->cart->lines=[['product_id'=>5504,'quantity'=>1]];mmed_staff_coaching_fees($woo->cart);
check($woo->cart->feeApi->fees===$feeFixture,'unrelated cart fee state unchanged');
$woo->cart->lines=[['product_id'=>91001,'quantity'=>1]];$woo->session->chosen='bacs';mmed_staff_coaching_fees($woo->cart);
check($woo->cart->feeApi->fees===$feeFixture,'Zelle cart fee state unchanged');$woo->session->chosen='stripe';
$woo->cart->lines=[['product_id'=>91001,'quantity'=>1]];
check(mmed_staff_coaching_gateway_title('Zelle - $499 total','bacs')==='Zelle','coaching label excludes unrelated Bootcamp tuition');
check(mmed_staff_coaching_gateway_title('Card','stripe')==='Card','card gateway label preserved');
$options['mmed_staff_coaching_v1']['enabled']=false;
check(mmed_staff_coaching_gateway_title('Original','bacs')==='Original','disabled label unchanged');
$options['mmed_staff_coaching_v1']['enabled']=true;
$woo->cart->lines[]=['product_id'=>5504,'quantity'=>1];
check(mmed_staff_coaching_gateway_title('Original','bacs')==='Original','mixed cart label unchanged');
$woo->cart->lines=[['product_id'=>5504,'quantity'=>1]];
check(mmed_staff_coaching_gateway_title('Zelle - $499 total','bacs')==='Zelle - $499 total','unrelated Bootcamp gateway label preserved');
$woo->cart->lines=[];check($cartGuard(true,91001,1,0),'one standard cart admitted');check(!$cartGuard(true,91004,1,0),'emergency cart denied');check(!$cartGuard(true,91001,2,0),'quantity two cart denied');check(!$cartGuard(true,91001,1,4),'variation cart denied');
$woo->cart->lines=[['product_id'=>91001,'quantity'=>1]];check(!$cartGuard(true,91002,1,0),'second package cart denied');check(!$cartGuard(true,5504,1,0),'mixed protected product denied');
$coupon=new StaffCoupon('MATCHREADY2026');check(mmed_staff_coaching_coupon(true,$coupon),'correct coupon on one mapped cart');check(mmed_staff_coaching_coupon(false,$coupon)===false,'prior coupon denial preserved');
rejects(fn()=>mmed_staff_coaching_coupon(true,new StaffCoupon('OTHER')),'wrong coupon denied');
$woo->cart->codes=['other'];rejects(fn()=>mmed_staff_coaching_coupon(true,$coupon),'stacked coupon denied');$woo->cart->codes=[];
$woo->cart->lines[]=['product_id'=>5504,'quantity'=>1];rejects(fn()=>mmed_staff_coaching_coupon(true,$coupon),'mixed coupon cart denied');$woo->cart->lines=[['product_id'=>91001,'quantity'=>1]];
$woo->cart->lines[0]['quantity']=2;rejects(fn()=>mmed_staff_coaching_coupon(true,$coupon),'coupon quantity two denied');$woo->cart->lines[0]['quantity']=1;
$options['mmed_staff_coaching_v1']['enabled']=false;rejects(fn()=>mmed_staff_coaching_coupon(true,$coupon),'coupon disabled release denied');$options['mmed_staff_coaching_v1']['enabled']=true;
$woo->cart->lines=[['product_id'=>91004,'quantity'=>1]];rejects(fn()=>mmed_staff_coaching_coupon(true,$coupon),'emergency coupon denied');$woo->cart->lines=[['product_id'=>91001,'quantity'=>1]];
foreach(['single','three','five'] as $sku){$offer=$catalog[$sku];$discount=mmed_staff_coaching_discount(0,$offer['regular']/100,['product_id'=>$ids[$sku]],true,$coupon);check((int)round($discount*100)===$offer['regular']-$offer['promo'],$sku.' exact discount cents');}
check(mmed_staff_coaching_discount(0,10,['product_id'=>91001],true,$coupon)===10.0,'discount cannot exceed base');check(mmed_staff_coaching_discount(0,399,['product_id'=>91004],true,$coupon)===0,'no emergency discount checkout');
$o=new StaffOrder;check(mmed_staff_coaching_snapshot($o)['amount_cents']===24900,'single USD owned accepted terms exact total snapshot');
foreach(['currency'=>'EUR','customer'=>0,'gateway'=>'cod','total'=>'248.99','fees'=>'1','tax'=>'1'] as $field=>$value){$bad=new StaffOrder;$bad->$field=$value;rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies '.$field);}
$bad=new StaffOrder;$bad->items[]=new StaffItem;rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies two items');
$bad=new StaffOrder;$bad->items[0]->qty=2;rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies qty two');
$bad=new StaffOrder;$bad->meta=[];rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies missing terms');
$bad=new StaffOrder;$bad->meta['_mmed_staff_coaching_terms']='forged-version';rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies wrong terms version');
$bad=new StaffOrder;$bad->items[0]->variation=3;rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies variation');
$bad=new StaffOrder;$bad->codes=['matchready2026','other'];rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies stacked codes');
$bad=new StaffOrder;$bad->items[0]->product=91004;rejects(fn()=>mmed_staff_coaching_snapshot($bad),'snapshot denies emergency');
$o=new StaffOrder;$orders[81]=$o;$beforePay=hook('woocommerce_before_pay_action',30);rejects(fn()=>$beforePay(81),'direct unadmitted pay denied');
admit_fixture($o);check(!mmed_staff_coaching_paid($o)&&mmed_staff_coaching_confirmation($o)==='','admitted unpaid has no confirmation');
try { mmed_staff_coaching_pay_guard($o,'stripe'); check(true,'same admitted payment gateway passes before gateway execution'); }
catch(Throwable $e) { check(false,'same admitted payment gateway passes before gateway execution'); }
rejects(fn()=>mmed_staff_coaching_pay_guard($o,'bacs'),'stripe to Zelle gateway switch rejected before gateway execution');
$zellePayOrder=new StaffOrder;$zellePayOrder->gateway='bacs';admit_fixture($zellePayOrder);
rejects(fn()=>mmed_staff_coaching_pay_guard($zellePayOrder,'stripe'),'Zelle to stripe gateway switch rejected before gateway execution');
$orders[81]=$o;
mmed_staff_coaching_fulfill(81);check(count($sent)===0,'unpaid direct fulfillment emits no staff mail');
$o->meta['_mm_zelle_payer_name']='Payer typed this';check(!mmed_staff_coaching_paid($o),'payer name cannot establish payment');
$o=paid_fixture();$o->captured=false;check(!mmed_staff_coaching_paid($o),'forged transaction without captured receipt denied');$o->captured=true;$o->transaction='forged';check(!mmed_staff_coaching_paid($o),'invalid transaction ID denied');
$o=paid_fixture();check(mmed_staff_coaching_paid($o),'current bound captured fixture accepted (not live evidence)');
$o->items[0]->id=999;check(!mmed_staff_coaching_paid($o),'changed order snapshot denied');
$o=paid_fixture();$o->refund='1';check(!mmed_staff_coaching_paid($o),'refunded order locked');
$o=new StaffOrder;$o->gateway='bacs';admit_fixture($o);$f=str_repeat('a',64);$o->meta['_mm_zelle_fingerprint']=$f;$o->meta['_mm_zelle_state']='completing';
check(!mmed_staff_coaching_zelle_allowed($o,$f),'Zelle missing permanent ledger denied');$options['mm_zelle_transaction_v2_'.$f]='999';check(!mmed_staff_coaching_zelle_allowed($o,$f),'wrong ledger order denied');
$options['mm_zelle_transaction_v2_'.$f]='81';check((bool)mmed_staff_coaching_zelle_allowed($o,$f),'bound accepted verifier-shaped Zelle fixture');check(!mmed_staff_coaching_zelle_allowed($o,str_repeat('b',64)),'wrong receipt reference denied');
$o->paid=true;$o->status='processing';$o->paidAt=time();check((bool)mmed_staff_coaching_paid($o),'bound paid Zelle fixture accepted');$options['mm_zelle_transaction_v2_'.$f]='999';check(!mmed_staff_coaching_paid($o),'paid Zelle wrong permanent ledger denied');$options['mm_zelle_transaction_v2_'.$f]='81';
$o->created=time()-86401;admit_fixture($o);check(!mmed_staff_coaching_zelle_allowed($o,$f),'original Zelle order expires after 24 hours');
$o=paid_fixture();$orders[81]=$o;$html=mmed_staff_coaching_confirmation($o);check(str_contains($html,'Contact admissions')&&str_contains($html,'No appointment or automatic Matrix/replay access'),'paid confirmation discloses staff booking');check(!preg_match('~href=["\'][^"\']*(matrix|scheduler|webex)~i',$html),'no Matrix Scheduler meeting CTA');
mmed_staff_coaching_fulfill(81);mmed_staff_coaching_fulfill(81);check(count($sent)===1,'atomic add_option permits one staff mail attempt');check($o->get_meta('_mmed_staff_coaching_state')==='awaiting_staff_booking','paid state awaits staff booking');check($o->get_meta('_mmed_staff_coaching_staff_notice')==='transport_accepted','fixture transport status only');
echo 'Source-only fixture checks: '.$checks.'; failures: '.count($failures).PHP_EOL;
foreach($failures as $failure){echo 'FAIL: '.$failure.PHP_EOL;}
exit($failures?1:0);

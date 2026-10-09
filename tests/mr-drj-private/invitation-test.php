<?php
// Isolated synthetic invitation tests. No WP bootstrap, network, mail or provider access.
define('ABSPATH', __DIR__);
$test_hooks=[];
function add_action($hook,$callback,$priority=10,...$args){global $test_hooks;$test_hooks[$hook][$priority][]=$callback;}
function remove_action($hook,$callback,$priority=10){global $test_hooks;foreach($test_hooks[$hook][$priority]??[] as $key=>$registered){if($registered===$callback){unset($test_hooks[$hook][$priority][$key]);}}}
function add_filter(...$args){}
function esc_html($value){return htmlspecialchars($value,ENT_QUOTES,'UTF-8');}
$options=[];$suppressed=false;$known_user=false;$current_user=(object)['ID'=>0,'user_email'=>''];$saved=0;
function get_option($key,$default=false){global $options;return $options[$key]??$default;}
function add_option($key,$value,...$args){global $options;if(array_key_exists($key,$options)){return false;}$options[$key]=$value;return true;}
function delete_option($key){global $options;unset($options[$key]);}
function get_user_by($field,$value){global $known_user;return $known_user;}
function wp_get_current_user(){global $current_user;return $current_user;}
function learndash_user_get_enrolled_courses($id){return [];}
function wp_hash($value){return hash_hmac('sha256',$value,'synthetic-test-key');}
final class MissionMed_Global_Mail_Suppression {public static function suppressed($email){global $suppressed;return $suppressed;}}
final class WC_Coupon {
    public static $fixture=[];
    public function __construct($id){}
    public function get_id(){return 123;}
    public function get_meta($key,$single=true){return self::$fixture['meta'][$key]??'';}
    public function update_meta_data($key,$value){self::$fixture['meta'][$key]=$value;}
    public function save(){global $saved;++$saved;}
    public function get_usage_count(){return self::$fixture['used'];}
    public function get_usage_limit(){return 1;}
    public function get_usage_limit_per_user(){return 1;}
    public function get_individual_use(){return true;}
    public function get_product_ids(){return self::$fixture['products'];}
    public function get_discount_type(){return 'fixed_product';}
    public function get_amount(){return 1000;}
    public function get_date_expires(){return new DateTimeImmutable('@'.MissionMed_MR_DrJ_Private_Offer::EXPIRY);}
    public function get_email_restrictions(){return ['invited@example.test'];}
}
require __DIR__.'/../../wp-content/mu-plugins/missionmed-mr-drj-private-offer.php';
$count=0;
function check($ok,$label){global $count;if(!$ok){throw new Exception('FAIL '.$label);}++$count;echo 'PASS '.$label.PHP_EOL;}
function invoke_private($name,...$args){$method=new ReflectionMethod(MissionMed_MR_DrJ_Invitation::class,$name);return $method->invoke(null,...$args);}
function denied($call,$label){try{$call();}catch(Throwable $e){check(true,$label);return;}check(false,$label);}
function reset_fixture(){
    global $options,$suppressed,$known_user,$current_user,$saved;
    $email='invited@example.test';$hash=hash('sha256',$email);
    $options=[MissionMed_MR_DrJ_Private_Offer::ENABLED=>'1',MissionMed_MR_DrJ_Private_Offer::MANIFEST=>['entries'=>[$hash=>['email_sha256'=>$hash,'coupon_id'=>123,'valid_until'=>MissionMed_MR_DrJ_Private_Offer::EXPIRY,'source_audience'=>true,'founder_approved'=>true]]]];
    WC_Coupon::$fixture=['meta'=>['_mr_drj_campaign'=>MissionMed_MR_DrJ_Private_Offer::CAMPAIGN,'_mr_drj_email_sha256'=>$hash,'_mr_drj_user_id'=>0],'used'=>0,'products'=>[5865]];
    $suppressed=false;$known_user=false;$current_user=(object)['ID'=>0,'user_email'=>''];$saved=0;
}
reset_fixture();
// Time-bound production constant is intentionally not bypassed by these tests.
check(time()<MissionMed_MR_DrJ_Private_Offer::EXPIRY,'fixture runs before invitation expiry');
check(invoke_private('admission',new WC_Coupon(123),'invited@example.test')['source_audience']===true,'accountless source audience admitted');
$options[MissionMed_MR_DrJ_Private_Offer::ENABLED]='0';
denied(fn()=>invoke_private('admission',new WC_Coupon(123),'invited@example.test'),'disabled public invitation denied');
$hash=hash('sha256','invited@example.test');
$options[MissionMed_MR_DrJ_Private_Offer::MANIFEST]['entries'][$hash]['internal_qa']=true;
WC_Coupon::$fixture['meta']['_mr_drj_internal_qa']='1';$options['_mr_drj_qa_until']=time()+60;
check(is_array(invoke_private('admission',new WC_Coupon(123),'invited@example.test')),'explicit internal QA within window admitted');
$options['_mr_drj_qa_until']=time()-1;
denied(fn()=>invoke_private('admission',new WC_Coupon(123),'invited@example.test'),'expired internal QA denied');
reset_fixture();$suppressed=true;
denied(fn()=>invoke_private('admission',new WC_Coupon(123),'invited@example.test'),'current suppression denied');
reset_fixture();
denied(fn()=>invoke_private('admission',new WC_Coupon(123),'other@example.test'),'different email denied');
reset_fixture();WC_Coupon::$fixture['used']=1;
denied(fn()=>invoke_private('admission',new WC_Coupon(123),'invited@example.test'),'used coupon denied');
reset_fixture();WC_Coupon::$fixture['products']=[5865,9999];
denied(fn()=>invoke_private('admission',new WC_Coupon(123),'invited@example.test'),'extra product scope denied');
reset_fixture();
denied(fn()=>invoke_private('claim',['coupon_id'=>123,'email_verified'=>true]),'guest cannot claim even with proof');
check($saved===0&&!isset($options['_mr_drj_claim_123']),'guest claim does not bind or lock');
$current_user=(object)['ID'=>42,'user_email'=>'other@example.test'];
denied(fn()=>invoke_private('claim',['coupon_id'=>123,'email_verified'=>true]),'wrong authenticated email cannot claim');
$current_user=(object)['ID'=>42,'user_email'=>'invited@example.test'];
denied(fn()=>invoke_private('claim',['coupon_id'=>123,'email_verified'=>false]),'unbound authenticated account still needs email proof');
check($saved===0&&!isset($options['_mr_drj_claim_123']),'proof rejection releases claim lock without binding');
WC_Coupon::$fixture['meta']['_mr_drj_user_id']=43;
denied(fn()=>invoke_private('claim',['coupon_id'=>123,'email_verified'=>true]),'conflicting existing coupon binding denied');
check(!isset($options['_mr_drj_claim_123']),'conflicting binding releases lock');
WC_Coupon::$fixture['meta']['_mr_drj_user_id']=0;$options['_mr_drj_claim_123']=time();
denied(fn()=>invoke_private('claim',['coupon_id'=>123,'email_verified'=>true]),'existing claim lock denies concurrent claimant');
check($saved===0&&isset($options['_mr_drj_claim_123']),'contender cannot clear owner lock');
unset($options['_mr_drj_claim_123']);
$_COOKIE[MissionMed_MR_DrJ_Invitation::COOKIE]=str_repeat('a',64);
check(invoke_private('session')===hash('sha256',str_repeat('a',64)),'session stores only cookie digest');
check(invoke_private('mail_proof','invited@example.test','ABCDEF123456')===false,'missing authorized mail transport fails closed without mail');
// Conditional declarations are intentionally AFTER the missing-helper assertion.
$mail_calls=0;$transport_restores=0;$mailer_mode='success';$test_mailer=null;
final class InvitationTestMailer {
    public $Subject,$Body,$Mailer='smtp',$Host='smtp.gmail.com',$Port=587,$SMTPSecure='tls',$SMTPAuth=true;
    public $Username='info@missionmedinstitute.com',$From='info@missionmedinstitute.com',$FromName='Original';
    public function getToAddresses(){return [['invited@example.test','']];}
    public function getCcAddresses(){return [];}
    public function getBccAddresses(){return [];}
}
if(!function_exists('missionaccounts_send_email')){
    function missionaccounts_send_email($email,$subject,$body,$headers){
        global $mail_calls,$mailer_mode,$test_hooks,$test_mailer;
        ++$mail_calls;
        // Synthetic protected helper: adapter exceptions bypass its normal cleanup.
        $GLOBALS['missionaccounts_smtp_active']=true;
        $GLOBALS['missionmed_system_smtp_active']=true;
        $GLOBALS['missionmed_protected_mail_in_flight']=true;
        $GLOBALS['missionmed_protected_mail_transport_preimage']=['synthetic'=>'owned'];
        $test_mailer=new InvitationTestMailer();$test_mailer->Subject=$subject;$test_mailer->Body=$body;
        if($mailer_mode==='mismatch'){$test_mailer->Host='wrong.example.test';}
        foreach($test_hooks['phpmailer_init'][PHP_INT_MAX]??[] as $callback){$callback($test_mailer);}
        missionmed_protected_mail_restore_transport();
        return true; // No send operation exists in this stub.
    }
}
check(invoke_private('mail_proof','invited@example.test','ABCDEF123456')===false,'missing protected restore helper fails closed');
check($mail_calls===0,'missing restore helper never enters sender');
if(!function_exists('missionmed_protected_mail_restore_transport')){
    function missionmed_protected_mail_restore_transport(){
        global $transport_restores;++$transport_restores;
        unset($GLOBALS['missionmed_protected_mail_in_flight'],$GLOBALS['missionmed_protected_mail_transport_preimage']);
    }
}
$transport_keys=['missionaccounts_smtp_active','missionmed_system_smtp_active','missionmed_protected_mail_in_flight','missionmed_protected_mail_transport_preimage'];
function transport_snapshot(){global $transport_keys;$snapshot=[];foreach($transport_keys as $key){$snapshot[$key]=['exists'=>array_key_exists($key,$GLOBALS),'value'=>$GLOBALS[$key]??null];}return $snapshot;}
function adapter_count(){global $test_hooks;return count($test_hooks['phpmailer_init'][PHP_INT_MAX]??[]);}
foreach($transport_keys as $key){unset($GLOBALS[$key]);}
$before=transport_snapshot();$calls_before=$mail_calls;$restores_before=$transport_restores;
check(invoke_private('mail_proof','invited@example.test','ABCDEF123456')===true,'synthetic authorized callback succeeds');
check($mail_calls===$calls_before+1&&$test_mailer->FromName==='Michelle de la Cruz','success enters sender and applies isolated display name');
check($transport_restores===$restores_before+1,'success restores owned transport exactly once');
check(transport_snapshot()===$before,'success restores all four originally absent globals');
check(adapter_count()===0,'success removes adapter');
$GLOBALS['missionaccounts_smtp_active']=null;$GLOBALS['missionmed_system_smtp_active']='prior-system';
$GLOBALS['missionmed_protected_mail_in_flight']=false;$GLOBALS['missionmed_protected_mail_transport_preimage']=['synthetic'=>'prior'];
$before=transport_snapshot();$mailer_mode='mismatch';$restores_before=$transport_restores;
$mismatch_rejected=false;
try{invoke_private('mail_proof','invited@example.test','ABCDEF123456');}catch(Exception $e){$mismatch_rejected=$e->getMessage()==='Private invitation mail transport unavailable.';}
check($mismatch_rejected,'real registered adapter rejects synthetic mailer mismatch');
check($transport_restores===$restores_before+1,'adapter exception restores owned in-flight transport');
check(transport_snapshot()===$before,'adapter exception restores exact mixed four-global preimage');
check(adapter_count()===0,'adapter exception removes callback');
$GLOBALS['missionmed_protected_mail_in_flight']=true;$GLOBALS['missionmed_protected_mail_transport_preimage']=['synthetic'=>'outer'];
$before=transport_snapshot();$calls_before=$mail_calls;$restores_before=$transport_restores;
check(invoke_private('mail_proof','invited@example.test','ABCDEF123456')===false,'outer in-flight transport rejects nested proof');
check($mail_calls===$calls_before&&$transport_restores===$restores_before,'nested rejection neither sends nor restores outer transport');
check(transport_snapshot()===$before&&adapter_count()===0,'nested rejection preserves every outer global and adds no adapter');
foreach($transport_keys as $key){unset($GLOBALS[$key]);}
// Structural guards complement runtime rejection tests; not browser/live evidence.
$source=file_get_contents(__DIR__.'/../../wp-content/mu-plugins/missionmed-mr-drj-private-offer.php');
$invitation=substr($source,strpos($source,'final class MissionMed_MR_DrJ_Invitation'));
foreach([
    'secure host cookie'=>"'secure'=>true,'httponly'=>true,'samesite'=>'Strict'",
    'session bound CSRF'=>"hash_equals(wp_hash(\$session), (string) wp_unslash(\$_POST['csrf']))",
    'WordPress nonce'=>"wp_verify_nonce",
    '48 bit random proof'=>"bin2hex(random_bytes(6))",
    '15 minute proof window'=>"'expires'=>time()+900",
    'five verification attempts'=>"\$state['attempts'] > 5",
    'five request rate limit'=>"\$rate['count'] >= 5",
    'hashed proof comparison'=>"hash_equals(\$state['proof_hash'], wp_hash(\$proof))",
    'native customer creation'=>"wc_create_new_customer(\$email)",
    'claim cleanup before redirect'=>"finally { delete_option(\$lock); }",
    'no referrer secret leakage'=>"Referrer-Policy: no-referrer",
    'private no store'=>"Cache-Control: private, no-store",
] as $label=>$needle){check(strpos($invitation,$needle)!==false,'source guard '.$label);}
check(strpos($invitation,'wc_create_order')===false&&strpos($invitation,'ld_update_course_access')===false,'invitation has no order creation or course grant API');
check(strpos($invitation,"\$_GET['personal_code']")===false&&strpos($invitation,"\$_GET['confirmation_code']")===false,'secrets not read from query string');
$verified=strpos($invitation,"\$state['email_verified'] = true;");
$create=strpos($invitation,'wc_create_new_customer($email)');
$existingBranch=strpos($invitation,'} else { $login = true; }',$create);
check($verified!==false&&$create>$verified&&$existingBranch>$create,'source creates only after proof and existing accounts require login');
echo "RESULT $count/$count PASS (isolated stubs + structural guards only)\n";

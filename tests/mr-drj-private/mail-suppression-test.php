<?php
// Pure nonfinancial tests. No network or customer mail.
define('ABSPATH', __DIR__);
$hooks=[];$options=[];
function add_filter($hook,$callback,$priority=10,$args=1){global $hooks;$hooks[$hook][]=$callback;}
function get_option($key,$default=[]){global $options;return $options[$key]??$default;}
function is_email($email){return filter_var($email,FILTER_VALIDATE_EMAIL)!==false;}
function sanitize_email($email){return preg_replace('/[^a-z0-9+_.@-]/i','',$email);}
class WP_Error { public $code; public function __construct($code,$message,$data){$this->code=$code;} }
class WC_Order { public function get_id(){return 7;} }
class WC_Email { public $id='customer_completed_order'; public $object; }
class DncRequest { private $params;private $route;public function __construct($params,$route='/missionmed-command-center/v1/email/send'){$this->params=$params;$this->route=$route;}public function get_route(){return $this->route;}public function get_params(){return $this->params;}public function get_param($key){return $this->params[$key]??null;} }
require __DIR__.'/../../wp-content/mu-plugins/missionmed-global-mail-suppression.php';
$options[MissionMed_Global_Mail_Suppression::OPTION]=[hash('sha256','blocked@example.invalid')=>['state'=>'permanent_dnc']];
$n=0;
function ok($value,$name){global $n;if(!$value){throw new RuntimeException('FAIL '.$name);}++$n;echo "PASS $name\n";}
$mail=['to'=>'Chris <BLOCKED@example.invalid>','subject'=>'Invitation','message'=>'Private invitation','headers'=>[]];
ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$mail)===false,'direct recipient blocked case-insensitively');
foreach(['Cc','Bcc'] as $field){$m=$mail;$m['to']='other@example.invalid';$m['headers']="$field: blocked@example.invalid\r\nContent-Type: text/plain";ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$m)===false,$field.' blocked');}
$m=$mail;$m['to']='other@example.invalid';ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$m)===null,'unrelated recipient unchanged');
$m=$mail;$m['headers']=['X-MissionMed-Transactional: true'];ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$m)===false,'spoofed header fails');
MissionMed_Global_Mail_Suppression::required_envelope($mail);
ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$mail)===null,'trusted exact security envelope preserved');
ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$mail)===false,'required envelope consumed once');
$r=new DncRequest(['to'=>'blocked@example.invalid','transactional'=>true]);
ok(MissionMed_Global_Mail_Suppression::guard_medmail(null,[], $r) instanceof WP_Error,'MedMail direct provider bypass blocked');
$r=new DncRequest(['to'=>'blocked()@example.invalid']);ok(MissionMed_Global_Mail_Suppression::guard_medmail(null,[],$r) instanceof WP_Error,'MedMail final sanitized recipient blocked');
$r=new DncRequest(['to'=>'blocked@example.invalid'],'/MissionMed-command-center/v1/EMAIL/send/');ok(MissionMed_Global_Mail_Suppression::guard_medmail(null,[],$r) instanceof WP_Error,'MedMail case-insensitive REST route blocked');
$r=new DncRequest(['to'=>'other@example.invalid','bcc'=>'blocked@example.invalid']);ok(MissionMed_Global_Mail_Suppression::guard_medmail(null,[],$r) instanceof WP_Error,'MedMail Bcc blocked');
$r=new DncRequest(['to'=>'other@example.invalid']);ok(MissionMed_Global_Mail_Suppression::guard_medmail(null,[],$r)===null,'MedMail unrelated recipient unchanged');
$r=new DncRequest(['to'=>'blocked@example.invalid'],'/other/route');ok(MissionMed_Global_Mail_Suppression::guard_medmail(null,[],$r)===null,'unrelated REST route unchanged');
$e=new WC_Email();$e->object=new WC_Order();$p=[$mail['to'],$mail['subject'],$mail['message'],$mail['headers'],[]];MissionMed_Global_Mail_Suppression::woo_required($p,$e);ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$mail)===null,'actual Woo transaction envelope preserved');
$e->id='marketing';MissionMed_Global_Mail_Suppression::woo_required($p,$e);ok(MissionMed_Global_Mail_Suppression::guard_wp_mail(null,$mail)===false,'Woo marketing is not transactional');
$frames=[['function'=>'wp_mail','file'=>ABSPATH.'/wp-includes/user.php'],['function'=>'wp_update_user']];
ok(MissionMed_Global_Mail_Suppression::trusted_core_frames($frames),'core password/email-change final-call classification survives substitutions');
$frames[0]['file']=ABSPATH.'/wp-content/plugins/example.php';
ok(!MissionMed_Global_Mail_Suppression::trusted_core_frames($frames),'plugin mail nested in core flow is not exempt');
$frames=[['function'=>'wp_mail','file'=>ABSPATH.'/wp-includes/pluggable.php'],['function'=>'wp_new_user_notification']];
ok(MissionMed_Global_Mail_Suppression::trusted_core_frames($frames),'core account security notification preserved');
$frames=[['function'=>'wp_mail','file'=>ABSPATH.'/wp-includes/user.php'],['function'=>'unrelated_marketing']];
ok(!MissionMed_Global_Mail_Suppression::trusted_core_frames($frames),'unrelated core-file context not exempt');
ok(!isset($hooks['password_change_email'])&&!isset($hooks['email_change_email']),'unfinished security envelopes are not fingerprinted');
echo "RESULT $n/$n PASS\n";

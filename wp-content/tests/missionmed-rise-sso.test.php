<?php
namespace Wave1SsoTest;
$case=$argv[1]; $events=[]; $response=['code'=>200,'body'=>json_encode(['authenticated'=>true,'authAudience'=>'rise','user'=>['id'=>'1397']]),'cookie'=>'mmhq_session=synthetic-only-session; HttpOnly; Secure'];
class WP_User {public $ID=1397,$user_email='synthetic@example.invalid',$user_login='synthetic',$display_name='Synthetic',$roles=['subscriber'];}
class WP_Error {}
class MMED_Access_Gate {static function user_can_access_app($id,$app){return $GLOBALS['case']!=='denied' && $id===1397 && $app==='rise';}}
class_alias(__NAMESPACE__.'\\MMED_Access_Gate','MMED_Access_Gate');
function add_action(...$args){}
function user_can(...$args){return false;}
function sfwd_lms_has_access(...$args){return false;}
function getenv($name){return $GLOBALS['case']==='no-secret'?'':str_repeat('test-only-',4);}
function wp_parse_url(...$args){return parse_url(...$args);}
function wp_unslash($v){return $v;}
function home_url($path){return 'https://missionmedinstitute.com'.$path;}
function is_user_logged_in(){return $GLOBALS['case']!=='logged-out';}
function wp_login_url($url){return 'https://missionmedinstitute.com/login';}
function wp_get_current_user(){return new WP_User;}
function wp_generate_uuid4(){return 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';}
function wp_json_encode($v){return json_encode($v);}
function status_header($code){$GLOBALS['events']['status']=$code;}
function wp_die($message){$GLOBALS['events']['denied']=true;exit;}
function add_query_arg($args,$url){return $url.'?'.http_build_query($args);}
function wp_remote_get($url,$options){
 parse_str(parse_url($url,PHP_URL_QUERY),$q);
 $GLOBALS['events']['transport']=($q['audience']??'')==='rise' && !isset($q['final']) && count($q)===2 && $options['sslverify']===true && $options['redirection']===0 && $options['timeout']===15;
 $parts=explode('.',$q['token']??''); $payload=json_decode(base64_decode(strtr($parts[0]??'', '-_', '+/')),true);
 $GLOBALS['events']['proof']=($payload['wp_user_id']??0)===1397 && ($payload['auth_audience']??'')==='rise' && ($payload['exp']-$payload['iat'])===120 && hash_equals(hash_hmac('sha256',$parts[0],str_repeat('test-only-',4)),$parts[1]);
 return $GLOBALS['case']==='network-error'?new WP_Error:$GLOBALS['response'];
}
function is_wp_error($r){return $r instanceof WP_Error;}
function wp_remote_retrieve_response_code($r){return $r['code'];}
function wp_remote_retrieve_body($r){return $r['body'];}
function wp_remote_retrieve_header($r,$name){return $r['cookie'];}
function wp_create_nonce($a){return 'synthetic-rest-nonce';}
function is_ssl(){return true;}
function setcookie($name,$value,$options){$GLOBALS['events']['cookies'][$name]=['value'=>$value,'options'=>$options];return true;}
function wp_safe_redirect($url){$GLOBALS['events']['redirect']=$url;}
if($case==='http-redirect')$response['code']=302;
if($case==='http-failure')$response['code']=503;
if($case==='wrong-owner')$response['body']=json_encode(['authenticated'=>true,'authAudience'=>'rise','user'=>['id'=>'1398']]);
if($case==='wrong-audience')$response['body']=json_encode(['authenticated'=>true,'authAudience'=>'hq','user'=>['id'=>'1397']]);
if($case==='unauthenticated')$response['body']=json_encode(['authenticated'=>false,'authAudience'=>'rise','user'=>['id'=>'1397']]);
if($case==='invalid-json')$response['body']='not-json';
if($case==='missing-cookie')$response['cookie']='other=value';
if($case==='oversized-cookie')$response['cookie']='mmhq_session='.str_repeat('a',16385).'; Secure';
if($case==='cookie-array')$response['cookie']=['other=value; Secure','mmhq_session=synthetic-only-session; HttpOnly; Secure'];
$_GET=['final'=>'https://evil.invalid/elsewhere'];
register_shutdown_function(function()use($case){
 $e=$GLOBALS['events']; $ok=true;
 if(in_array($case,['success','cookie-array'])){
  $ok=($e['transport']??false)&&($e['proof']??false)&&($e['redirect']??'')==='https://missionmedinstitute.com/rise/'&&!isset($e['denied'])&&array_keys($e['cookies']??[])===['mmhq_rise_session','mmed_rise_session_ready','mmed_rise_wp_nonce'];
  foreach($e['cookies']??[] as $n=>$c)$ok=$ok&&$c['options']['secure']&&$c['options']['path']==='/'&&$c['options']['samesite']==='Lax'&&$c['options']['httponly']===($n!=='mmed_rise_wp_nonce');
 }elseif($case==='logged-out')$ok=!isset($e['cookies'])&&!isset($e['transport'])&&($e['redirect']??'')==='https://missionmedinstitute.com/login';
 else $ok=!isset($e['cookies'])&&($e['denied']??false)&&($e['status']??0)===($case==='denied'?403:503);
 echo json_encode(['case'=>$case,'pass'=>$ok])."\n"; if(!$ok)exit(1);
});
$src=file_get_contents(dirname(__DIR__).'/mu-plugins/missionmed-rise-sso.php');
define('ABSPATH','/stub');
// Evaluate exact candidate declarations in a stub-only namespace; no network or WordPress writes.
eval('namespace Wave1SsoTest;'.substr($src,5));
mmrise_sso_handle();

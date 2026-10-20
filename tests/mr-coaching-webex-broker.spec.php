<?php
declare(strict_types=1);
$options = []; $calls = []; $gone = []; $sentInvites = 0; $mode = ''; $registered = [];
final class WP_Error { public function __construct(public string $code, public string $message, public array $data = []) {} }
final class FixtureResponse { public function __construct(private array $data) {} public function get_data(): array { return $this->data; } }
final class FixtureRequest { public function __construct(private array $data) {} public function get_json_params(): array { return $this->data; } }
function register_rest_route($ns,$route,$args,$override=false): void { global $registered,$routes; $registered = $args; $routes[]=[$ns,$route,$args,$override]; }
function add_option($key,$value,$unused='',$autoload=false): bool { global $options; if (array_key_exists($key,$options)) return false; $options[$key]=$value; return true; }
function get_option($key,$fallback=null) { global $options; return $options[$key] ?? $fallback; }
function update_option($key,$value,$autoload=false): bool { global $options; $options[$key]=$value; return true; }
function delete_option($key): bool { global $options; unset($options[$key]); return true; }
function is_email($value): bool { return filter_var($value,FILTER_VALIDATE_EMAIL)!==false; }
function is_wp_error($value): bool { return $value instanceof WP_Error; }
function rest_ensure_response($value): FixtureResponse { return new FixtureResponse($value); }
function sanitize_text_field($value): string { return strip_tags((string)$value); }
function esc_url_raw($value): string { return str_starts_with((string)$value,'https://') ? $value : ''; }
function mm_scheduler_webex_broker_truthy($value): bool { return (bool)$value; }
function mm_scheduler_webex_broker_api_base(): string { return 'https://webexapis.com/v1'; }
function mm_scheduler_webex_broker_access_token(): string { return 'fixture-token-never-real'; }
function mm_scheduler_webex_broker_error($error,$code) { return $error; }
function mm_scheduler_webex_broker_normalize_recording($r): array { return ['id'=>$r['id'],'playback_url'=>'https://example.test/fixture']; }
function mm_scheduler_webex_broker_rest_create_meeting($args): array { global $calls; $calls[]=['POST','/meetings']; return ['id'=>'OWNED_MEETING','webLink'=>'https://example.test/fixture']; }
function wp_remote_request($url,$args): array {
    global $calls,$gone,$mode;
    $path=substr($url,strlen('https://webexapis.com/v1')); $calls[]=[$args['method'],$path];
    $status=200; $body=[]; $headers=[];
    if (str_starts_with($path,'/recordings?')) {
        $body=['items'=>[]];
        if ($mode==='unquoted_next') $headers['link']='<https://webexapis.com/v1/recordings?cursor=more>; rel=next';
    } elseif ($args['method']==='DELETE') { $gone[$path]=true; $status=204; }
    elseif (isset($gone[$path])) $status=404;
    else $body=['id'=>'OWNED_MEETING','hostEmail'=>$mode==='wrong_host'?'other@example.test':'host@example.test'];
    return ['status'=>$status,'body'=>json_encode($body),'headers'=>$headers];
}
function wp_remote_retrieve_response_code($r): int { return $r['status']; }
function wp_remote_retrieve_body($r): string { return $r['body']; }
function wp_remote_retrieve_header($r,$key) { return $r['headers'][$key]??''; }
require __DIR__.'/../wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingWebexBroker.php';
$count=0; function check($yes,$label): void { global $count; if(!$yes) throw new RuntimeException($label); ++$count; }
$id='11111111-2222-4333-8444-555555555555'; $unit='coaching-unit:v1:123:456:mock:1';
$key='mmed_mr_coaching_provider_'.hash('sha256',$id);
$input=['action'=>'create','appointment_id'=>$id,'unit_id'=>$unit,
    'meeting'=>['title'=>'Fixture','start'=>'2026-10-25T10:00:00-04:00','end'=>'2026-10-25T11:45:00-04:00'],'invitee'=>['email'=>'do-not-send@example.test']];
$options['mmed_webex_host_email']='host@example.test';
$malformed = mmed_coaching_webex_request(new FixtureRequest(array_replace($input,['appointment_id'=>[]])));
check(is_wp_error($malformed),'malformed appointment identity rejected without a PHP error');
mmed_coaching_webex_register(); check($registered['permission_callback']==='mm_scheduler_webex_broker_can_access','existing HMAC authentication mandatory');
$routes=[]; $before=count($calls); mmed_coaching_webex_register_oauth();
check(count($routes)===2,'override registers only the existing OAuth pair');
foreach (['/admin/webex/auth-url'=>'mm_scheduler_webex_admin_auth_url','/admin/webex/callback'=>'mm_scheduler_webex_admin_oauth_callback'] as $route=>$callback) {
    $entry=array_shift($routes);
    check($entry[0]==='mmed/v1' && $entry[1]===$route,'same existing integration route only');
    check($entry[2]['methods']==='GET','OAuth remains read-method only');
    check($entry[2]['callback']===$callback,'reviewed same-host broker handler');
    check($entry[2]['permission_callback']==='mm_scheduler_webex_admin_can_manage','actual manage-options permission retained');
    check($entry[3]===true,'override displaces shadowed handler instead of appending');
}
check(count($calls)===$before,'registration makes no provider calls');
$mu=file_get_contents(__DIR__.'/../wp-content/mu-plugins/missionmed-mr-coaching.php');
check(substr_count($mu,"add_action('rest_api_init','mmed_coaching_webex_register_oauth',PHP_INT_MAX);")===1,'OAuth pair registered last at PHP_INT_MAX');
$scopes=mmed_coaching_webex_scope('meeting:recordings_read');
check($scopes==='meeting:recordings_read meeting:recordings_write','adds only required scope');
check(mmed_coaching_webex_scope($scopes)===$scopes,'scope update idempotent');
$r=mmed_coaching_webex_request(new FixtureRequest($input));
check(!is_wp_error($r),'owned creation succeeds'); check($options[$key]['cleanup_state']==='active','same host verified before activation');
check($r->get_data()['invitee']['invitee_email_sent']===false,'provider invite email suppressed');
$n=count($calls); $r=mmed_coaching_webex_request(new FixtureRequest($input)); check(!is_wp_error($r)&&count($calls)===$n,'creation replay no second provider request');
$input['action']='recordings'; $r=mmed_coaching_webex_request(new FixtureRequest($input)); check(!is_wp_error($r),'active verified binding permits recording lookup');
$saved=$options[$key]; $options[$key]['cleanup_state']='created_unverified'; unset($options[$key]['creation_result']);
$n=count($calls); check(is_wp_error(mmed_coaching_webex_request(new FixtureRequest($input)))&&count($calls)===$n,'unverified creation cannot issue recording URLs');
$options[$key]=$saved; $mode='unquoted_next';
check(is_wp_error(mmed_coaching_webex_request(new FixtureRequest($input))),'unquoted pagination header fails closed');
$mode=''; $input['action']='revoke'; $r=mmed_coaching_webex_request(new FixtureRequest($input));
check(!is_wp_error($r)&&$r->get_data()['evidence']['meeting_absent']===true,'owned provider cleanup confirms absence');
$n=count($calls); $r=mmed_coaching_webex_request(new FixtureRequest($input));
check(!is_wp_error($r)&&count($calls)===$n&&$r->get_data()['idempotent_replay']===true,'completed cleanup replay makes no provider requests');
$input['action']='recordings'; check(is_wp_error(mmed_coaching_webex_request(new FixtureRequest($input))),'revoked binding never issues links');
$input['action']='create'; check(is_wp_error(mmed_coaching_webex_request(new FixtureRequest($input))),'revoked creation cannot resurrect');
$options[$key]=$saved; $input['unit_id']='coaching-unit:v1:999:456:mock:1'; $n=count($calls);
check(is_wp_error(mmed_coaching_webex_request(new FixtureRequest($input)))&&count($calls)===$n,'foreign unit cannot create/access/delete');
$input['unit_id']=$unit; $options[$key.'_lock']=['created_at'=>time()]; $n=count($calls);
check(is_wp_error(mmed_coaching_webex_request(new FixtureRequest($input)))&&count($calls)===$n,'concurrent operation lock prevents duplicate calls');
unset($options[$key.'_lock'],$options[$key]); $mode='wrong_host'; $r=mmed_coaching_webex_request(new FixtureRequest($input));
check(is_wp_error($r)&&$options[$key]['meeting_id']==='OWNED_MEETING','failed same-host check preserves known non-issuable ID');
check(empty($options[$key]['creation_result']),'wrong-host result not issuable');
$options[$key]=$saved; $options[$key]['cleanup_attempts']=3; $input['action']='revoke'; $n=count($calls);
check(is_wp_error(mmed_coaching_webex_request(new FixtureRequest($input)))&&count($calls)===$n,'three uncertain cleanup attempts require staff review, no automatic fourth call');
echo 'PASS '.$count." broker assertions; synthetic provider only, no production/network/email calls\n";

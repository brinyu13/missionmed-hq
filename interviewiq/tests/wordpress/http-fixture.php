<?php
/** Loopback-only synthetic protocol harness. This file is never packaged. */
if (PHP_SAPI !== 'cli-server' || !in_array($_SERVER['REMOTE_ADDR'] ?? '', array('127.0.0.1', '::1'), true)) {
    http_response_code(403); exit;
}
define('IIQ_TEST_FIXTURE_ONLY', true);
require __DIR__ . '/auth-gateway.test.php';
$server = $_SERVER;
reset_state();
$_SERVER = $server;
if (isset($_SERVER['HTTP_X_FIXTURE_ANONYMOUS'])) { $GLOBALS['current_user'] = new WP_User(0); }
if (isset($_SERVER['HTTP_X_FIXTURE_LOGOUT'])) { $GLOBALS['meta'][42]['session_tokens'] = array(); }
if (isset($_SERVER['HTTP_X_FIXTURE_DISABLED'])) { putenv('INTERVIEWIQ_ENABLED=false'); }
putenv('INTERVIEWIQ_CALENDAR_V2_ENABLED='.((($_SERVER['HTTP_X_FIXTURE_CALENDAR']??'')==='1')?'true':'false'));

function status_header($code) { http_response_code($code); }
function wp_send_json($value, $status) { http_response_code($status); header('Content-Type: application/json'); echo json_encode($value); exit; }
function wp_safe_redirect($url, $status) { http_response_code($status); header('Location: ' . $url); }
function wp_login_url($url) { return 'https://missionmedinstitute.com/my-account/?redirect_to=' . rawurlencode($url); }
function fixture_calendar_timing() {
    $valid='iiq_owner;dur=1.0, iiq_cohort;dur=2.0, iiq_own;dur=3.0, iiq_admission;dur=4.0, iiq_directory;dur=5.0, iiq_total;dur=6.0';
    $values=array('valid'=>$valid,'unknown'=>str_replace('iiq_owner','private_identity',$valid),'nonfinite'=>str_replace('1.0','NaN',$valid),
        'oversized'=>str_repeat($valid,3),'crlf'=>$valid."\r\nX-Injected: forbidden");
    return $values[$_SERVER['HTTP_X_FIXTURE_TIMING']??'']??'';
}
class WP_REST_Request extends Request {
    public function __construct($method, $path) { parent::__construct('',array(),$method); }
    public function set_body($body) { $this->body=$body; }
    public function set_header($name,$value) { $this->headers[strtolower($name)]=$value; }
}
function fixture_owner_response($status,$body,$headers=array()) {
    return array('response'=>array('code'=>$status),'headers'=>array_merge(array('content-type'=>'application/json'),$headers),'body'=>wp_json_encode($body));
}
function wp_remote_request($url, $options) {
    $challenge=parse_url($url,PHP_URL_PATH)==='/api/owner-challenge';
    $mode=$_SERVER['HTTP_X_FIXTURE_OWNER_MODE']??'';
    if ($challenge && (!isset($_SERVER['HTTP_X_FIXTURE_OWNER_API']) || in_array($mode,array('legacy','legacy-header','generic503','timeout','capacity','bad-capacity'),true))) {
        if($mode==='timeout')return new WP_Error('http_request_failed','Synthetic challenge timeout');
        if($mode==='generic503')return fixture_owner_response(503,array('error'=>array('code'=>'service_unavailable')));
        if(in_array($mode,array('capacity','bad-capacity'),true)) {
            $input=json_decode($options['body'],true);$actor=mmiiq_browser_identity(false);$now=time();
            $payload=wp_json_encode(array('audience'=>'interviewiq-owner-challenge','code'=>'owner_challenge_unavailable',
                'target'=>$input['target'],'jwt_sha256'=>hash('sha256',substr($options['headers']['Authorization'],7)),
                'session_verifier'=>$actor['session_verifier'],'iat'=>$now,'exp'=>$now+10));
            return fixture_owner_response(503,array('payload'=>$payload,'signature'=>$mode==='bad-capacity'?str_repeat('0',64):hash_hmac('sha256',"mmiiq-owner-challenge-unavailable-v1\n".$payload,mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET'))));
        }
        $id='77777777-7777-4777-8777-777777777777';
        return fixture_owner_response(404,array('error'=>array('code'=>'not_found','message'=>'This endpoint is not available.'),'requestId'=>$id),
            array('x-request-id'=>$mode==='legacy-header'?'mismatch':$id));
    }
    // Explicit loopback-only bridge exercises real Node auth/HTTP with synthetic WP.
    $port=$_SERVER['HTTP_X_FIXTURE_OWNER_API']??'';
    if(is_string($port)&&preg_match('/^[1-9][0-9]{3,4}$/D',$port)&&(int)$port<=65535) {
        $parts=parse_url($url);$path=$parts['path'].(isset($parts['query'])?'?'.$parts['query']:'');
        $lines=array();foreach($options['headers'] as $key=>$value)$lines[]=$key.': '.$value;
        $context=stream_context_create(array('http'=>array('method'=>$options['method'],'header'=>implode("\r\n",$lines),
            'content'=>$options['body'],'ignore_errors'=>true,'timeout'=>3,'follow_location'=>0)));
        $raw=@file_get_contents('http://127.0.0.1:'.$port.$path,false,$context,0,($options['limit_response_size']??4194305));
        if(!is_string($raw))return new WP_Error('http_request_failed','Synthetic API unavailable');
        $received=$http_response_header??array();$status=0;$out=array();
        foreach($received as $line){if(preg_match('#^HTTP/\\S+ ([0-9]{3})#',$line,$match))$status=(int)$match[1];elseif(str_contains($line,':')){list($key,$value)=explode(':',$line,2);$out[strtolower($key)]=trim($value);}}
        if($challenge && $mode==='signature'){$value=json_decode($raw,true);$value['signature']=str_repeat('0',64);$raw=wp_json_encode($value);}
        if($challenge && $mode==='revoked')$GLOBALS['meta'][42]['session_tokens']=array();
        return array('response'=>array('code'=>$status),'headers'=>$out,'body'=>$raw);
    }

    if (isset($_SERVER['HTTP_X_FIXTURE_STARTUP'])) {
        $mode=$_SERVER['HTTP_X_FIXTURE_UPSTREAM']??'';
        if($mode==='timeout')return new WP_Error('http_request_failed','Synthetic timeout');
        parse_str(parse_url($url,PHP_URL_QUERY)??'', $q);
        $a=mmiiq_public_actor(mmiiq_browser_identity(false));
        $b=array('actor'=>$a,'state'=>array('interviews'=>array()),'workspacePhase'=>'calendar',
            'calendarBundle'=>array('actor'=>$a,'kind'=>'cohort','start'=>$q['start']??null,'end'=>$q['end']??null,'page'=>array('events'=>array())),
            'testTransport'=>array('method'=>$options['method'],'url'=>$url,'cookiesEmpty'=>$options['cookies']===array(),'redirects'=>$options['redirection'],
                'gatewayMatched'=>hash_equals(mmiiq_setting('INTERVIEWIQ_GATEWAY_SECRET'),$options['headers']['X-MMED-IIQ-Gateway']??''),'body'=>$options['body']));
        if($mode==='actor')$b['actor']['id']='other';if($mode==='range')$b['calendarBundle']['end']='2026-12-31';
        return array('response'=>array('code'=>$mode==='denied'?403:($mode==='redirect'?302:($mode==='failure'?503:200))),
            'headers'=>array('content-type'=>$mode==='html'?'text/html':'application/json','server-timing'=>fixture_calendar_timing()),
            'body'=>$mode==='invalid'?'{':json_encode($b));
    }
    $body = json_encode(array('ok' => true, 'forwarded' => array('url' => $url, 'method' => $options['method'],
        'origin' => $options['headers']['Origin'],
        'gatewayMatched' => hash_equals(mmiiq_setting('INTERVIEWIQ_GATEWAY_SECRET'), $options['headers']['X-MMED-IIQ-Gateway'] ?? ''),
        'authorizationPresent' => isset($options['headers']['Authorization']),
        'cookiesEmpty' => $options['cookies'] === array(), 'redirects' => $options['redirection'],
        'body' => json_decode($options['body'], true))));
    $mode = $_SERVER['HTTP_X_FIXTURE_UPSTREAM'] ?? '';
    return array('response' => array('code' => $mode === 'redirect' ? 302 : 200),
        'headers' => array('content-type' => $mode === 'html' ? 'text/html' : 'application/json','server-timing'=>fixture_calendar_timing()),
        'body' => $body);
}
function wp_remote_retrieve_response_code($v) { return $v['response']['code']; }
function wp_remote_retrieve_body($v) { return $v['body']; }
function wp_remote_retrieve_header($v, $key) { return $v['headers'][$key] ?? ''; }

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/wp-admin/admin-ajax.php') {
    if (($_GET['action'] ?? '') === 'missionmed_interviewiq_bootstrap') { mmiiq_ajax_bootstrap(); }
    if (($_GET['action'] ?? '') === 'missionmed_interviewiq_token') { mmiiqg_calendar_startup_token(); mmiiq_ajax_token(); }
}
if ($path === '/wp-json/missionmed-interviewiq/v1/introspect') {
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    $result = mmiiq_introspection(new Request(file_get_contents('php://input'), $headers, $_SERVER['REQUEST_METHOD']));
    if (is_wp_error($result)) { mmiiq_ajax_response($result); }
    foreach ($result->headers as $name => $value) { header($name . ': ' . $value); }
    wp_send_json($result->data, $result->status);
}
mmiiqg_handle();
http_response_code(404); echo '{}';

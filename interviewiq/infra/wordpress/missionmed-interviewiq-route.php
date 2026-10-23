<?php
/**
 * Plugin Name: MissionMed InterviewIQ Gateway
 * Description: Default-off isolated /interviewiq/ immutable UI and private API gateway.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) { exit; }
if (!function_exists('mmiiq_enabled')) { require_once __DIR__ . '/missionmed-interviewiq-sso.php'; }

function mmiiqg_error($status, $code) {
    mmiiq_private_headers();
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode(array('error' => array('code' => $code,
        'message' => $status === 401 ? 'Sign in to MissionMed to continue.' : 'InterviewIQ could not complete this request.')));
    exit;
}

/** Only a pinned HTTPS origin is accepted; no URL credentials, path or query. */
function mmiiqg_origin() {
    $raw = mmiiq_setting('INTERVIEWIQ_API_ORIGIN');
    $parts = wp_parse_url($raw);
    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
        || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
        || isset($parts['port']) || !in_array($parts['path'] ?? '', array('', '/'), true)
        || !preg_match('/^interviewiq(?:-[a-z0-9]+)*\.up\.railway\.app$/D', $parts['host'])
        || in_array($parts['host'], array('missionmed-hq-production.up.railway.app',
            'storyforge-v5-api-production.up.railway.app'), true)) { return ''; }
    return 'https://' . $parts['host'];
}

function mmiiqg_path($request_uri) {
    if (!is_string($request_uri) || strlen($request_uri) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $request_uri)) { return false; }
    $parts = wp_parse_url($request_uri);
    if (!is_array($parts) || isset($parts['scheme']) || isset($parts['host']) || isset($parts['fragment'])) { return false; }
    $path = $parts['path'] ?? '';
    if (!preg_match('#^/interviewiq(?:/[A-Za-z0-9._/-]*)?$#D', $path)
        || strpos($path, '//') !== false || preg_match('#/(?:\.|\.\.)(?:/|$)#D', $path)) { return false; }
    return $path;
}

/** Explicit API contract, independent of whichever routes a sibling implements. */
function mmiiqg_api_route($method, $path) {
    if (mmiiq_setting('INTERVIEWIQ_CALENDAR_V2_ENABLED') === 'true') {
        if($method==='GET'&&$path==='/interviewiq/api/calendar/roster'){return array('target'=>'/api/calendar/roster','max_bytes'=>0,'query'=>'roster');}
        if($method==='GET'&&$path==='/interviewiq/api/calendar/overview'){return array('target'=>'/api/calendar/overview','max_bytes'=>0,'query'=>'overview');}
        if($method==='GET'&&preg_match('#^/interviewiq/api/calendar/student/[1-9][0-9]{0,15}$#D',$path)){return array('target'=>substr($path,12),'max_bytes'=>0);}
        if ($method==='GET'&&$path==='/interviewiq/api/calendar/student-preview') { return array('target'=>'/api/calendar/student-preview','max_bytes'=>0); }
        if ($method==='GET'&&$path==='/interviewiq/api/calendar/cohort') { return array('target'=>'/api/calendar/cohort','max_bytes'=>0,'query'=>'calendar'); }
        if (preg_match('#^/interviewiq/api/calendar/admin/([a-f0-9-]{36})$#D',$path,$m)&&mmiiq_uuid($m[1])&&in_array($method,array('GET','POST'),true)) { return array('target'=>substr($path,12),'max_bytes'=>262144); }
        if (preg_match('#^/interviewiq/api/interviews/([a-f0-9-]{36})/itinerary(?:/([a-f0-9-]{36}|withdraw))?$#D',$path,$m)&&mmiiq_uuid($m[1])) {
            $tail=$m[2]??'';if(($method==='POST'&&$tail==='')||($method==='GET'&&($tail===''||mmiiq_uuid($tail)))||($method==='POST'&&$tail==='withdraw')) { return array('target'=>substr($path,12),'max_bytes'=>$tail==='withdraw'?16384:5242880,'itinerary'=>true,'binary_upload'=>$method==='POST'&&$tail==='','binary_download'=>$method==='GET'&&$tail!==''); }
        }
    }
    if ($method === 'GET' && $path === '/interviewiq/api/bootstrap') { return array('target' => '/api/bootstrap', 'max_bytes' => 0, 'query' => 'bootstrap'); }
    if ($method === 'GET' && $path === '/interviewiq/api/programs') { return array('target' => '/api/programs', 'max_bytes' => 0, 'query' => 'q'); }
    if ($method === 'POST' && $path === '/interviewiq/api/commands') { return array('target' => '/api/commands', 'max_bytes' => 1048576); }
    if ($method === 'POST' && $path === '/interviewiq/api/recordings') { return array('target' => '/api/recordings', 'max_bytes' => 16384); }
    if (preg_match('#^/interviewiq/api/recordings/([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})(?:/(segments|finish|cancel|retry|pause|resume))?$#D', $path, $match)) {
        $action = $match[2] ?? '';
        if (($method === 'GET' && $action === '') || ($method === 'POST' && $action !== '')) {
            return array('target' => substr($path, strlen('/interviewiq')),
                'max_bytes' => $action === 'segments' ? 1572864 : 16384);
        }
    }
    return null;
}

function mmiiqg_query($route, $raw) {
    if (($route['query']??'')==='bootstrap') {
        if($raw==='')return '';if($raw==='view=calendar')return '?view=calendar';
        if(!is_string($raw)||strlen($raw)>128||preg_match('/%(?![a-fA-F0-9]{2})/',$raw))return false;
        $input=array();parse_str($raw,$input);$keys=array_keys($input);sort($keys);
        if($keys!==array('end','start','view')||count(explode('&',$raw))!==3||$input['view']!=='calendar')return false;
        foreach(array('start','end')as$k){if(!is_string($input[$k])||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$input[$k]))return false;$d=DateTimeImmutable::createFromFormat('!Y-m-d',$input[$k],new DateTimeZone('UTC'));if(!$d||$d->format('Y-m-d')!==$input[$k])return false;}
        $days=(strtotime($input['end'].'T00:00:00Z')-strtotime($input['start'].'T00:00:00Z'))/86400;if($days<0||$days>=90)return false;
        return '?'.http_build_query($input,'','&',PHP_QUERY_RFC3986);
    }
    if(in_array($route['query']??'',array('roster','overview'),true)){
        if(!is_string($raw)||strlen($raw)>2048||preg_match('/%(?![a-fA-F0-9]{2})/',$raw)){return false;}$input=array();parse_str($raw,$input);$keys=array_keys($input);if(count(explode('&',$raw))!==count($keys)){return false;}
        $allowed=$route['query']==='roster'?array('after','q','tier'):array('start','end','after');foreach($keys as $key){if(!in_array($key,$allowed,true)||!is_string($input[$key])){return false;}}
        if(isset($input['after'])&&(!preg_match('/^(0|[1-9][0-9]{0,15})$/D',$input['after'])||(float)$input['after']>9007199254740991)){return false;}
        if(isset($input['q'])&&(!preg_match('//u',$input['q'])||mb_strlen($input['q'])>120||preg_match('/[\x00-\x1f\x7f]/',$input['q']))){return false;}
        if(isset($input['tier'])&&!in_array($input['tier'],array('all','360','ivprep_complete'),true)){return false;}
        if($route['query']==='overview'){foreach(array('start','end') as $key){if(!isset($input[$key])||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$input[$key])){return false;}}}
        return '?'.http_build_query($input,'','&',PHP_QUERY_RFC3986);
    }
    if (($route['query']??'')==='calendar') {
        if(!is_string($raw)||strlen($raw)>2048||preg_match('/%(?![a-fA-F0-9]{2})/',$raw)){return false;}$input=array();parse_str($raw,$input);$keys=array_keys($input);sort($keys);if($keys!==array('end','start')&&$keys!==array('cursor','end','start')){return false;}if(count(explode('&',$raw))!==count($keys)){return false;}
        foreach(array('start','end') as $k){if(!is_string($input[$k])||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$input[$k])){return false;}}if(isset($input['cursor'])&&(!is_string($input['cursor'])||strlen($input['cursor'])>1024||!preg_match('/^[A-Za-z0-9_.-]+$/D',$input['cursor']))){return false;}return '?'.http_build_query($input,'','&',PHP_QUERY_RFC3986);
    }
    if ($raw === '') { return ''; }
    if (($route['query'] ?? '') !== 'q' || !is_string($raw) || strlen($raw) > 3074
        || !preg_match('/^q=([^&]*)$/D', $raw, $match) || preg_match('/%(?![a-fA-F0-9]{2})/', $raw)) { return false; }
    $q = urldecode($match[1]);
    if (!preg_match('//u', $q) || mb_strlen($q, 'UTF-8') > 256 || preg_match('/[\x00-\x1f\x7f]/', $q)) { return false; }
    return '?q=' . rawurlencode($q);
}

/**
 * release.php is deployment-owned generated PHP returning a manifest. The only
 * permitted symlink is current -> a direct child of releases. Every served file
 * is size/hash verified and must remain inside that immutable release.
 */
function mmiiqg_read_release($runtime_root = null, $release_id = null) {
    $root = $runtime_root ?? (__DIR__ . '/missionmed-interviewiq-runtime');
    if (!is_dir($root) || is_link($root) || !is_dir($root . '/releases') || is_link($root . '/releases')
        || ($release_id === null && !is_link($root . '/current'))
        || ($release_id !== null && (!is_string($release_id) || !preg_match('/^[a-f0-9]{40,64}$/D', $release_id)))) { return null; }
    $releases = realpath($root . '/releases');
    $candidate = $release_id === null ? $root . '/current' : $root . '/releases/' . $release_id;
    if ($release_id !== null && is_link($candidate)) { return null; }
    $current = realpath($candidate);
    if ($releases === false || $current === false || dirname($current) !== $releases
        || !preg_match('/^[a-f0-9]{40,64}$/D', basename($current))) { return null; }
    $manifest_path = $current . '/release.php';
    if (!is_file($manifest_path) || is_link($manifest_path) || filesize($manifest_path) > 262144) { return null; }
    try { $manifest = require $manifest_path; } catch (Throwable $error) { return null; }
    if (!is_array($manifest) || ($manifest['schema'] ?? '') !== 'missionmed.interviewiq.release.v1'
        || ($manifest['release_id'] ?? '') !== basename($current) || !is_array($manifest['assets'] ?? null)
        || !isset($manifest['assets']['index.html']) || count($manifest['assets']) > 500) { return null; }
    return array('root' => $current, 'manifest' => $manifest);
}

/** Extensionless aliases avoid front-server static-file interception; no generic file mapping. */
function mmiiqg_versioned_asset_relative($relative) {
    if ($relative === 'styles') { return 'styles.css'; }
    if ($relative === 'app') { return 'app.js'; }
    return $relative;
}

function mmiiqg_asset($release, $relative) {
    if (!is_array($release) || !is_string($relative)
        || !preg_match('#^[A-Za-z0-9_-][A-Za-z0-9_./-]*$#D', $relative)
        || strpos($relative, '..') !== false || strpos($relative, '//') !== false) { return null; }
    $types = array('html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8',
        'mjs' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8',
        'woff2' => 'font/woff2', 'woff' => 'font/woff', 'png' => 'image/png',
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon', 'json' => 'application/json; charset=utf-8');
    $ext = strtolower(pathinfo($relative, PATHINFO_EXTENSION));
    if (!isset($types[$ext])) { return null; }
    $entry = $release['manifest']['assets'][$relative] ?? null;
    if (!is_array($entry) || !is_string($entry['sha256'] ?? null)
        || !preg_match('/^[a-f0-9]{64}$/D', $entry['sha256']) || !is_int($entry['bytes'] ?? null)
        || $entry['bytes'] < 1 || $entry['bytes'] > 16777216) { return null; }
    $path = $release['root'] . '/' . $relative;
    $actual = realpath($path);
    if ($actual === false || !is_file($actual) || is_link($path)
        || strpos($actual, $release['root'] . '/') !== 0 || filesize($actual) !== $entry['bytes']
        || !hash_equals($entry['sha256'], hash_file('sha256', $actual))) { return null; }
    return array('path' => $actual, 'type' => $types[$ext], 'sha256' => $entry['sha256']);
}

function mmiiqg_security_headers() {
    mmiiq_private_headers();
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://upload.wikimedia.org; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    header('Permissions-Policy: microphone=(self), camera=()');
    header('X-Frame-Options: DENY');
    header('Cross-Origin-Resource-Policy: same-origin');
}

function mmiiqg_private_html($html) {
    // Existing CSRF nonce, generated only in this authenticated no-store response.
    $meta='<meta name="iiq-session-nonce" content="'.esc_attr(wp_create_nonce('missionmed_interviewiq')).'">';
    return str_replace('</head>',$meta.'</head>',$html);
}

/** Forward only the fixed aggregate Calendar timing grammar from the trusted API. */
function mmiiqg_calendar_timing_header($result) {
    $value=wp_remote_retrieve_header($result,'server-timing');
    if (!is_string($value) || strlen($value)>256) { return; }
    $parts=array();
    foreach (array('owner','cohort','own','admission','directory','total') as $stage) {
        $parts[]='iiq_'.$stage.';dur=(?:0|[1-9][0-9]{0,4})\.[0-9]';
    }
    if (preg_match('/^'.implode(', ',$parts).'$/D',$value)) { header('Server-Timing: '.$value); }
}

/** Server-only, fresh one-use owner exchange for ordinary Calendar GETs only. */
function mmiiqg_owner_challenge_headers($origin, $headers, $target, $actor) {
    // Only this core-cache-qualified admin path may execute an in-request proof.
    if (($actor['role']??null)!=='admin' || ($actor['tier']??null)!=='admin'
        || !function_exists('has_filter') || has_filter('missionmed_storyforge_user_id')!==false
        || !function_exists('clean_user_cache') || !function_exists('wp_cache_delete')) { return array(); }
    $options=array('method'=>'POST','headers'=>array_merge($headers,array('Content-Type'=>'application/json')),
        'body'=>wp_json_encode(array('target'=>$target)), 'timeout'=>5, 'redirection'=>0, 'sslverify'=>true,
        'reject_unsafe_urls'=>true, 'limit_response_size'=>8193, 'cookies'=>array());
    $response=wp_remote_request($origin.'/api/owner-challenge',$options);
    if (is_wp_error($response)) { mmiiqg_error(502,'owner_challenge_unavailable'); }
    $status=(int)wp_remote_retrieve_response_code($response);
    $raw=wp_remote_retrieve_body($response);
    $type=strtolower(trim(explode(';',(string)wp_remote_retrieve_header($response,'content-type'))[0]));
    if (!is_string($raw) || strlen($raw)>8192 || $type!=='application/json') { mmiiqg_error(502,'owner_challenge_invalid'); }
    $challenge=json_decode($raw,true);
    $keys=static function($value) { if(!is_array($value))return ''; $keys=array_keys($value);sort($keys);return implode(',',$keys); };
    // This exact legacy resolver result is trusted TLS, before any domain GET.
    if ($status===404 && $keys($challenge)==='error,requestId'
        && $keys($challenge['error'])==='code,message' && $challenge['error']['code']==='not_found'
        && $challenge['error']['message']==='This endpoint is not available.' && mmiiq_uuid($challenge['requestId'])
        && wp_remote_retrieve_header($response,'x-request-id')===$challenge['requestId']) { return array(); }
    $secret=mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET');
    if ($status===503 && $keys($challenge)==='payload,signature' && is_string($challenge['payload'])
        && is_string($challenge['signature']) && preg_match('/^[a-f0-9]{64}$/D',$challenge['signature'])
        && hash_equals(hash_hmac('sha256',"mmiiq-owner-challenge-unavailable-v1\n".$challenge['payload'],$secret),$challenge['signature'])) {
        $unavailable=json_decode($challenge['payload'],true);
        if ($keys($unavailable)==='audience,code,exp,iat,jwt_sha256,session_verifier,target'
            && $unavailable['audience']==='interviewiq-owner-challenge' && $unavailable['code']==='owner_challenge_unavailable'
            && $unavailable['target']===$target && $unavailable['jwt_sha256']===hash('sha256',substr($headers['Authorization'],7))
            && $unavailable['session_verifier']===$actor['session_verifier'] && is_int($unavailable['iat']) && is_int($unavailable['exp'])
            && $unavailable['iat']>=time()-3 && $unavailable['iat']<=time()+3 && $unavailable['exp']>time()
            && $unavailable['exp']>$unavailable['iat'] && $unavailable['exp']-$unavailable['iat']<=10) { return array(); }
    }
    if ($status!==200 || $keys($challenge)!=='expires_at,id,payload,signature,version'
        || $challenge['version']!==1 || !mmiiq_uuid($challenge['id']) || !is_int($challenge['expires_at'])
        || $challenge['expires_at']<=time() || $challenge['expires_at']>time()+10
        || !is_string($challenge['payload']) || strlen($challenge['payload'])>4096
        || !is_string($challenge['signature']) || !preg_match('/^[a-f0-9]{64}$/D',$challenge['signature'])) { mmiiqg_error(502,'owner_challenge_invalid'); }
    $input=json_decode($challenge['payload'],true);
    if ($keys($input)!=='action,audience,iat,nonce,session_verifier,subject,wp_user_id'
        || $input['action']!=='GET '.explode('?',$target)[0] || $input['audience']!=='interviewiq-owner-introspection'
        || $input['subject']!==$actor['id'] || $input['wp_user_id']!==$actor['wp_user_id']
        || $input['session_verifier']!==$actor['session_verifier'] || !mmiiq_uuid($input['nonce'])
        || !is_int($input['iat']) || $input['iat']<time()-3 || $input['iat']>time()+3) { mmiiqg_error(502,'owner_challenge_invalid'); }
    $request=new WP_REST_Request('POST','/missionmed-interviewiq/v1/introspect');
    $request->set_body($challenge['payload']);
    $request->set_header('X-MMED-IIQ-Proof',$challenge['signature']);
    // Initial browser identity primed core caches before the challenge round trip.
    clean_user_cache($actor['wp_user_id']);
    wp_cache_delete($actor['wp_user_id'],'user_meta');
    $fresh_user=get_user_by('id',$actor['wp_user_id']);
    // Never enter student enrollment/expiration helpers after an admin downgrade.
    if (!($fresh_user instanceof WP_User) || !$fresh_user->exists() || !user_can($fresh_user,'manage_options')) { mmiiqg_error(401,'owner_access_changed'); }
    // Existing canonical callback invokes its unchanged permission function.
    $current=mmiiq_introspection($request);
    if (is_wp_error($current)) { mmiiqg_error((int)($current->get_error_data()['status']??403),$current->get_error_code()); }
    if (!($current instanceof WP_REST_Response) || $current->get_status()!==200) { mmiiqg_error(502,'owner_challenge_invalid'); }
    $envelope=$current->get_data();
    if ($keys($envelope)!=='payload,signature' || !is_string($envelope['payload']) || strlen($envelope['payload'])>5500
        || !is_string($envelope['signature']) || !preg_match('/^[a-f0-9]{64}$/D',$envelope['signature'])) { mmiiqg_error(502,'owner_challenge_invalid'); }
    $encoded=base64_encode(wp_json_encode($envelope));
    if (strlen($encoded)>8192) { mmiiqg_error(502,'owner_challenge_invalid'); }
    return array('X-MMED-IIQ-Owner-Challenge'=>$challenge['id'],'X-MMED-IIQ-Owner-Proof'=>$encoded);
}

function mmiiqg_proxy($route, $method) {
    foreach (array('HTTP_X_MMED_IIQ_GATEWAY','HTTP_X_MMED_IIQ_PROOF','HTTP_X_MMED_IIQ_OWNER_PROOF','HTTP_X_MMED_IIQ_OWNER_CHALLENGE') as $key) {
        if (isset($_SERVER[$key])) { mmiiqg_error(400,'reserved_header'); }
    }
    $actor = mmiiq_browser_identity(false);
    if (is_wp_error($actor)) { mmiiqg_error((int) ($actor->get_error_data()['status'] ?? 403), $actor->get_error_code()); }
    if ($method !== 'GET') {
        $check = mmiiq_browser_request(true);
        if (is_wp_error($check)) { mmiiqg_error((int) ($check->get_error_data()['status'] ?? 403), $check->get_error_code()); }
    }
    $origin = mmiiqg_origin();
    $gateway_secret = mmiiq_setting('INTERVIEWIQ_GATEWAY_SECRET');
    if ($origin === '' || strlen($gateway_secret) < 32) { mmiiqg_error(503, 'origin_unconfigured'); }
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!mmiiq_browser_bearer_valid($authorization, $actor)) {
        mmiiqg_error(401, 'auth_required');
    }
    $query = mmiiqg_query($route, $_SERVER['QUERY_STRING'] ?? '');
    if ($query === false) { mmiiqg_error(400, 'query_not_supported'); }
    $body = '';
    $content_type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($method !== 'GET') {
        if (($route['binary_upload']??false) ? !in_array($content_type,array('application/pdf','image/png','image/jpeg'),true) : $content_type !== 'application/json') { mmiiqg_error(415, 'content_type_not_supported'); }
        if (isset($_SERVER['CONTENT_LENGTH']) && (!ctype_digit((string) $_SERVER['CONTENT_LENGTH'])
            || (int) $_SERVER['CONTENT_LENGTH'] > $route['max_bytes'])) { mmiiqg_error(413, 'request_too_large'); }
        $input = fopen('php://input', 'rb');
        $body = $input ? stream_get_contents($input, $route['max_bytes'] + 1) : false;
        if ($input) { fclose($input); }
        if (!is_string($body) || strlen($body) > $route['max_bytes']) { mmiiqg_error(413, 'request_too_large'); }
    }
    $headers = array('Accept' => 'application/json', 'Authorization' => $authorization,
        'Origin' => mmiiq_wp_origin(), 'X-MMED-IIQ-Gateway' => $gateway_secret);
    if ($method !== 'GET') { $headers['Content-Type'] = $content_type; }
    foreach (array('Idempotency-Key' => 'HTTP_IDEMPOTENCY_KEY') as $name => $server_key) {
        $value = $_SERVER[$server_key] ?? '';
        if ($value !== '' && is_string($value) && preg_match('/^[A-Za-z0-9_.:-]{1,120}$/D', $value)) { $headers[$name] = $value; }
    }
    foreach(array('X-IIQ-Request-ID'=>'HTTP_X_IIQ_REQUEST_ID','X-IIQ-Expected-Version'=>'HTTP_X_IIQ_EXPECTED_VERSION','X-IIQ-SHA256'=>'HTTP_X_IIQ_SHA256','X-IIQ-Extension'=>'HTTP_X_IIQ_EXTENSION','X-IIQ-Calendar-Target'=>'HTTP_X_IIQ_CALENDAR_TARGET','X-IIQ-Student-Preview'=>'HTTP_X_IIQ_STUDENT_PREVIEW') as $name=>$key){$v=$_SERVER[$key]??'';if($v!==''&&is_string($v)&&strlen($v)<=80&&preg_match('/^[A-Za-z0-9_-]+$/D',$v)){$headers[$name]=$v;}}
    if ($method==='GET' && in_array($route['target'],array('/api/calendar/overview','/api/calendar/cohort'),true)) {
        if (!in_array((string)($_SERVER['CONTENT_LENGTH']??''),array('','0'),true) || (string)($_SERVER['HTTP_TRANSFER_ENCODING']??'')!=='') { mmiiqg_error(400,'request_body_not_supported'); }
        $input = fopen('php://input', 'rb');
        $empty_body = $input && fread($input, 1) === '' && feof($input);
        if ($input) { fclose($input); }
        if (!$empty_body) { mmiiqg_error(400,'request_body_not_supported'); }
        $headers=array_merge($headers,mmiiqg_owner_challenge_headers($origin,$headers,$route['target'].$query,$actor));
    }
    $maximum_response=($route['binary_download']??false)?5242880:4194304;
    $result = wp_remote_request($origin . $route['target'] . $query, array('method' => $method, 'headers' => $headers,
        'body' => $body, 'timeout' => 45, 'redirection' => 0, 'sslverify' => true,
        'reject_unsafe_urls' => true, 'limit_response_size' => $maximum_response+1, 'cookies' => array()));
    if (is_wp_error($result)) { mmiiqg_error(502, 'api_unavailable'); }
    $status = (int) wp_remote_retrieve_response_code($result);
    $response_body = wp_remote_retrieve_body($result);
    $type = (string) wp_remote_retrieve_header($result, 'content-type');
    if (($route['binary_download']??false)&&$status===200) {
        $disposition=(string)wp_remote_retrieve_header($result,'content-disposition');
        if(!is_string($response_body)||strlen($response_body)<1||strlen($response_body)>5242880||$type!=='application/octet-stream'||!preg_match('/^attachment; filename="itinerary-([1-9]|10)\.(pdf|png|jpg)"$/D',$disposition)){mmiiqg_error(502,'api_response_invalid');}
        mmiiq_private_headers();status_header(200);header('Content-Type: application/octet-stream');header('Content-Disposition: '.$disposition);header('Content-Length: '.strlen($response_body));header("Content-Security-Policy: default-src 'none'; sandbox");echo $response_body;exit;
    }
    if ($status < 200 || $status >= 600 || ($status >= 300 && $status < 400)
        || !is_string($response_body) || strlen($response_body) > 4194304
        || strtolower(trim(explode(';', $type)[0])) !== 'application/json') { mmiiqg_error(502, 'api_response_invalid'); }
    mmiiqg_security_headers();
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    if ($method==='GET' && $status===200 && (in_array($route['target'],array('/api/calendar/overview','/api/calendar/cohort'),true)
        || $route['target']==='/api/bootstrap' && strpos($query,'start=')!==false && strpos($query,'end=')!==false)) {
        mmiiqg_calendar_timing_header($result);
    }
    echo $response_body;
    exit;
}

function mmiiqg_handle() {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    // Siblings remain outside this hook, including similarly named routes.
    if (!is_string($uri) || !preg_match('#^/interviewiq(?:/|\?|$)#', $uri)) { return; }
    if (!defined('DONOTCACHEPAGE')) { define('DONOTCACHEPAGE', true); }
    if (!defined('DONOTCACHEDB')) { define('DONOTCACHEDB', true); }
    if (!mmiiq_enabled() || !mmiiq_secrets_ready() || mmiiq_wp_origin() === '') { mmiiqg_error(503, 'interviewiq_disabled_or_unconfigured'); }
    $path = mmiiqg_path($uri);
    if ($path === false) { mmiiqg_error(400, 'request_target_invalid'); }
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($path === '/interviewiq') {
        if (!in_array($method, array('GET', 'HEAD'), true)) { mmiiqg_error(405, 'method_not_allowed'); }
        mmiiq_private_headers();
        wp_safe_redirect('/interviewiq/', 302); exit;
    }
    if (strpos($path, '/interviewiq/api/') === 0) {
        $route = mmiiqg_api_route($method, $path);
        if (!$route) { mmiiqg_error(404, 'not_found'); }
        mmiiqg_proxy($route, $method); return;
    }
    if (!in_array($method, array('GET', 'HEAD'), true)) { mmiiqg_error(405, 'method_not_allowed'); }
    // Authenticated UI assets only. Bootstrap will provision the separate IIQ UUID.
    $user = wp_get_current_user();
    if (!($user instanceof WP_User) || !$user->exists()) {
        mmiiq_private_headers();
        wp_safe_redirect(wp_login_url(home_url('/interviewiq/')), 302); exit;
    }
    $grant = mmiiq_access_for_user($user);
    if (is_wp_error($grant)) {
        $status = (int) ($grant->get_error_data()['status'] ?? 403);
        if ($status === 403 && $path === '/interviewiq/') {
            mmiiqg_security_headers(); status_header(403); header('Content-Type: text/html; charset=utf-8');
            echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InterviewIQ access</title><body style="margin:0;background:#090d14;color:#edf0fa;font:18px system-ui;padding:8vh 8vw"><main style="max-width:42rem"><p style="color:#ffb336;font-weight:800">MissionMed / InterviewIQ</p><h1>InterviewIQ is not available for this account.</h1><p>The Calendar is currently available to eligible 360 and IV Prep Complete students. Your current enrollment is checked each time you enter.</p><p><a style="color:#ffb336" href="/member-dashboard/">Back to Matrix</a></p></main></body></html>'; exit;
        }
        mmiiqg_error($status, $grant->get_error_code());
    }
    $relative = $path === '/interviewiq/' ? 'index.html' : substr($path, strlen('/interviewiq/'));
    $release_id = null;
    if (preg_match('#^releases/([a-f0-9]{40,64})/(.+)$#D', $relative, $versioned)) {
        $release_id = $versioned[1]; $relative = mmiiqg_versioned_asset_relative($versioned[2]);
    }
    $release = mmiiqg_read_release(null, $release_id);
    $asset = mmiiqg_asset($release, $relative);
    if (!$asset) { mmiiqg_error(503, 'release_unavailable'); }
    mmiiqg_security_headers();
    status_header(200);
    header('Content-Type: ' . $asset['type']);
    header('X-InterviewIQ-Release: ' . $release['manifest']['release_id']);
    if ($relative==='index.html') {
        $html=mmiiqg_private_html(file_get_contents($asset['path']));
        header('Content-Length: '.strlen($html)); if ($method!=='HEAD') { echo $html; }
    } else {
        header('Content-Length: ' . filesize($asset['path']));
        if ($method !== 'HEAD') { readfile($asset['path']); }
    }
    exit;
}

/** Public executable code only: exit before ordinary plugins on immutable asset requests.
 * HTML, unversioned files and every identity/data endpoint retain the private handler.
 */
function mmiiqg_immutable_asset_target($uri, $method) {
    if (!in_array($method, array('GET', 'HEAD'), true) || !is_string($uri) || strpos($uri, '?') !== false) { return null; }
    $path = mmiiqg_path($uri);
    if (!is_string($path) || !preg_match('#^/interviewiq/releases/([a-f0-9]{64})/(app|styles|app\.js|styles\.css)$#D', $path, $m)) { return null; }
    return array('release_id' => $m[1], 'relative' => mmiiqg_versioned_asset_relative($m[2]));
}
function mmiiqg_immutable_assets() {
    $target = mmiiqg_immutable_asset_target($_SERVER['REQUEST_URI'] ?? '', $_SERVER['REQUEST_METHOD'] ?? '');
    if (!$target) { return; }
    if (!mmiiq_enabled() || !mmiiq_secrets_ready() || mmiiq_wp_origin() === '') { mmiiqg_error(503, 'interviewiq_disabled_or_unconfigured'); }
    $release = mmiiqg_read_release(null, $target['release_id']);
    $asset = mmiiqg_asset($release, $target['relative']);
    if (!$asset) { mmiiqg_error(503, 'release_unavailable'); }
    // These verified files contain code and styling only, never personalized bootstrap data.
    status_header(200);
    header('Content-Type: ' . $asset['type']);
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('Referrer-Policy: no-referrer');
    header('X-InterviewIQ-Release: ' . $release['manifest']['release_id']);
    header('Content-Length: ' . filesize($asset['path']));
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') { readfile($asset['path']); }
    exit;
}
/** Optional nonce-POST startup: reuse full browser/token and remote API authorization. */
function mmiiqg_calendar_startup_token() {
    foreach (array('HTTP_X_MMED_IIQ_GATEWAY','HTTP_X_MMED_IIQ_PROOF','HTTP_X_MMED_IIQ_OWNER_PROOF','HTTP_X_MMED_IIQ_OWNER_CHALLENGE') as $key) {
        if (isset($_SERVER[$key])) { mmiiqg_error(400,'reserved_header'); }
    }
    if (!array_key_exists('iiq_calendar', $_GET)) { return; } // Legacy token-only contract.
    $raw = $_SERVER['QUERY_STRING'] ?? '';
    $input = array(); parse_str($raw, $input); $keys = array_keys($input); sort($keys);
    if (!is_string($raw) || strlen($raw)>256 || preg_match('/%(?![a-fA-F0-9]{2})/', $raw)
        || $keys!==array('action','end','iiq_calendar','start') || count(explode('&',$raw))!==4
        || $input['action']!=='missionmed_interviewiq_token' || $input['iiq_calendar']!=='1'
        || !is_string($input['start']) || !is_string($input['end'])) { mmiiqg_error(400,'invalid_query'); }
    $query=mmiiqg_query(array('query'=>'bootstrap'), 'view=calendar&start='.rawurlencode($input['start']).'&end='.rawurlencode($input['end']));
    if ($query===false) { mmiiqg_error(400,'invalid_query'); }
    foreach (array('HTTP_X_MMED_IIQ_GATEWAY','HTTP_X_MMED_IIQ_PROOF','HTTP_X_MMED_IIQ_OWNER_PROOF') as $key) {
        if (isset($_SERVER[$key])) { mmiiqg_error(400,'reserved_header'); }
    }
    $permission=mmiiq_browser_request(true);
    if (is_wp_error($permission)) { mmiiq_ajax_response($permission); return; }
    $actor=mmiiq_browser_identity(true);
    if (is_wp_error($actor)) { mmiiq_ajax_response($actor); return; }
    $signed=mmiiq_issue_token($actor);
    if (is_wp_error($signed)) { mmiiq_ajax_response($signed); return; }
    $origin=mmiiqg_origin(); $secret=mmiiq_setting('INTERVIEWIQ_GATEWAY_SECRET');
    if ($origin==='' || strlen($secret)<32) { mmiiqg_error(503,'origin_unconfigured'); }
    // The API still makes its normal fresh REMOTE owner and peer requests.
    // No browser authorization/proof/cookie/header or arbitrary target is forwarded.
    $result=wp_remote_request($origin.'/api/bootstrap'.$query,array('method'=>'GET',
        'headers'=>array('Accept'=>'application/json','Authorization'=>'Bearer '.$signed['token'],
            'Origin'=>mmiiq_wp_origin(),'X-MMED-IIQ-Gateway'=>$secret),
        'body'=>'','timeout'=>25,'redirection'=>0,'sslverify'=>true,'reject_unsafe_urls'=>true,
        'limit_response_size'=>4194305,'cookies'=>array()));
    if (is_wp_error($result)) { mmiiqg_error(502,'calendar_startup_unavailable'); }
    $status=(int)wp_remote_retrieve_response_code($result); $body=wp_remote_retrieve_body($result);
    $type=strtolower(trim(explode(';',(string)wp_remote_retrieve_header($result,'content-type'))[0]));
    if (!is_string($body) || strlen($body)>4194304 || $type!=='application/json') { mmiiqg_error(502,'calendar_startup_invalid'); }
    // A possibly executed request is never retried or disguised as token-only success.
    if ($status!==200) { mmiiqg_error(in_array($status,array(401,403),true)?$status:502,'calendar_startup_denied'); }
    $bootstrap=json_decode($body,true);
    if (!is_array($bootstrap) || ($bootstrap['workspacePhase']??null)!=='calendar'
        || !is_array($bootstrap['state']['interviews']??null) || !is_array($bootstrap['actor']??null)
        || !is_array($bootstrap['calendarBundle']??null)) { mmiiqg_error(502,'calendar_startup_invalid'); }
    foreach (array('id','role','tier') as $key) {
        if (($bootstrap['actor'][$key]??null)!==($signed['actor'][$key]??null)
            || ($bootstrap['calendarBundle']['actor'][$key]??null)!==($signed['actor'][$key]??null)) { mmiiqg_error(502,'calendar_startup_invalid'); }
    }
    if (($bootstrap['calendarBundle']['start']??null)!==$input['start'] || ($bootstrap['calendarBundle']['end']??null)!==$input['end']
        || $signed['expires_at']<=time()) { mmiiqg_error(502,'calendar_startup_invalid'); }
    $signed['calendarStartupAttempted']=true;
    $signed['calendarStartup']=array('path'=>'/bootstrap'.$query,'bootstrap'=>$bootstrap);
    mmiiqg_calendar_timing_header($result);
    mmiiq_ajax_response($signed);
}
add_action('wp_ajax_missionmed_interviewiq_token','mmiiqg_calendar_startup_token',0);
add_action('wp_ajax_nopriv_missionmed_interviewiq_token','mmiiqg_calendar_startup_token',0);

add_action('muplugins_loaded', 'mmiiqg_immutable_assets', -1000);

add_action('parse_request', 'mmiiqg_handle', -1000);

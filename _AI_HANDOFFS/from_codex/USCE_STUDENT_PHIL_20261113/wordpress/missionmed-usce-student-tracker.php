<?php
/**
 * Plugin Name: MissionMed USCE Student Tracker
 * Description: Read-only tracker for cases linked to the current WordPress account.
 */
defined('ABSPATH') || exit;

function mmi_usce_tracker_url($ref = '') {
    $args = array('action' => 'mmi_usce_student_tracker');
    if ($ref !== '') $args['ref'] = $ref;
    return add_query_arg($args, admin_url('admin-post.php', 'https'));
}

function mmi_usce_tracker_month($s) {
    if (is_string($s) && preg_match('/\A(\d{4})-(0[1-9]|1[0-2])\z/', $s, $m)) {
        return gmdate('F Y', gmmktime(0,0,0,(int)$m[2],1,(int)$m[1]));
    }
    return is_scalar($s) ? (string)$s : '';
}
function mmi_usce_tracker_time($s) {
    $t = is_string($s) ? strtotime($s) : false;
    return $t === false ? '' : wp_date('M j, Y · g:i a', $t, new DateTimeZone('America/New_York')) . ' ET';
}
function mmi_usce_tracker_rotation($spec,$loc,$month,$weeks) {
    $plain = static function($v) { return is_scalar($v) ? (string)$v : ''; };
    $list = static function($v,$format) { return implode(', ',array_filter(array_map($format,(array)$v),'strlen')); };
    return implode(' · ',array_filter(array($list($spec,$plain),$list($loc,$plain),
        $list($month,'mmi_usce_tracker_month'),is_numeric($weeks) && $weeks>0 ? intval($weeks).' weeks' : ''),'strlen'));
}

function mmi_usce_tracker_page($items, $error = false, $ref = '') {
    if ($error) status_header(503);
    $title = $error ? 'Status temporarily unavailable' : (count($items) ? 'Your rotation tracker' : 'No linked request found');
    ?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow"><title><?php echo esc_html($title); ?> | MissionMed</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f7f3ea;color:#112a3a;font:17px/1.55 system-ui,sans-serif}header{background:#102b3e;color:#fff;border-bottom:4px solid #cdab5a}
    header div,main{max-width:48rem;margin:auto;padding:1.2rem clamp(1rem,4vw,2rem)}header strong{letter-spacing:.02em}header span{color:#e7d49c}
    main{padding-top:2rem}h1,h2,h3{line-height:1.22;margin:.2em 0 .55em}h1{font-size:clamp(2rem,6vw,3rem)}h2{font-size:1.45rem}h3{font-size:1.15rem}p{margin:.35em 0 1em}
    article,aside{background:#fffdfa;border:1px solid #dbd4c4;border-radius:14px;margin:1rem 0;padding:clamp(1rem,4vw,1.75rem);overflow-wrap:anywhere}
    section{border-top:1px solid #dcd8cc;padding-top:1.1rem;margin-top:1rem}.meta{font-size:.94rem;color:#445762}.note{white-space:pre-wrap;border-left:3px solid #bc984b;padding-left:.9rem}
    a{color:#155373;font-weight:650;text-underline-offset:.15em}a:focus-visible{outline:3px solid #936b0c;outline-offset:4px}
    form{display:grid;gap:.7rem}input,button{font:inherit;padding:.55rem .7rem;max-width:100%;box-sizing:border-box}input{display:block;width:100%}button{justify-self:start;background:#153b51;color:white;border:0;border-radius:.4rem;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #996f08}
    </style></head><body><header><div><strong>MissionMed</strong> <span> / Clinical rotations</span></div></header><main><h1><?php echo esc_html($title); ?></h1>
    <?php if ($error) { ?><p>We couldn’t load your request. Please try again in a moment.</p><?php }
    elseif (!$items) { ?><p>There’s no request linked to this view of your account. If you already submitted one, use the reference on your receipt to link it below.</p><?php }
    foreach ($items as $r) {
        $offer = $r['offer'] ?? null; $response = $r['response'] ?? null;
        $labels = array('alternate_requested'=>'Another option requested','accepted'=>'Offer accepted','declined'=>'Offer declined','declined_notify_future'=>'Offer declined','declined_no_notify'=>'Offer declined');
        $kind = $response['kind'] ?? ''; $label = $labels[$kind] ?? '';
        ?><article><h2>Your request</h2><p><?php echo esc_html(mmi_usce_tracker_rotation($r['specialties'],$r['locations'],$r['months'],$r['weeks'])); ?></p>
        <p class="meta">Reference: <?php echo esc_html('USCE-'.strtoupper(substr($r['reference'],0,8))); ?><br>Submitted <?php echo esc_html(mmi_usce_tracker_time($r['submitted_at'])); ?></p>
        <?php if ($offer) { ?><section><h3>Your Offer</h3><p class="meta">Sent <?php echo esc_html(mmi_usce_tracker_time($offer['sent_at'])); ?></p>
        <?php foreach (!empty($offer['options']) ? $offer['options'] : array($offer) as $choice) { ?>
        <p><?php echo esc_html(mmi_usce_tracker_rotation($choice['specialty'],$choice['location'],$choice['timing'],$choice['weeks'])); ?><?php if (!empty($choice['format'])) echo '<br>'.esc_html($choice['format']); ?></p>
        <?php } ?></section><?php }
        if ($response && $label) { ?><section><h3>Your response: <?php echo esc_html($label); ?></h3><p class="meta">Recorded <?php echo esc_html(mmi_usce_tracker_time($response['recorded_at'])); ?></p>
        <?php if (!empty($response['note'])) { ?><p>Your message:</p><p class="note"><?php echo esc_html($response['note']); ?></p><?php }
        if ($kind==='alternate_requested') { ?><p>Clinicals has your request for another option. You don’t need to respond again.</p><?php }
        ?></section><?php } elseif ($offer) { ?><p>See your Offer email for the secure response link and deadline.</p><?php }
        else { ?><p><?php echo esc_html(in_array($r['status'],array('reviewed','in_progress'),true) ? 'Clinicals has recorded a review of your request.' : 'Your request is on file.'); ?></p><?php }
        ?></article><?php } ?>
    <?php if (!$error && (!$ref || !$items)) mmi_usce_claim_controls($ref); ?>
    <p><a href="mailto:clinicals@missionmedinstitute.com">Contact Clinicals</a> · <a href="https://missionmedinstitute.com/usce/">Clinical rotations</a></p>
    </main></body></html><?php
}

function mmi_usce_tracker_entry() {
    nocache_headers(); header('Cache-Control: private, no-store, max-age=0, must-revalidate'); header('Vary: Cookie',false);
    header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow'); header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') { status_header(405); header('Allow: GET'); exit; }
    $ref = isset($_GET['ref']) && is_string($_GET['ref']) ? wp_unslash($_GET['ref']) : '';
    if (isset($_GET['ref']) && (!is_string($_GET['ref']) || !preg_match('/\A[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z/i',$ref))) { status_header(400); exit('Invalid request reference.'); }
    if (!is_user_logged_in()) { wp_safe_redirect(wp_login_url(mmi_usce_tracker_url($ref))); exit; }
    $u = wp_get_current_user();
    if (!$u->ID || !is_email($u->user_email)) { status_header(403); exit('A MissionMed account with an email address is required.'); }
    $base='https://fglyvdykwgbuivikqoah.supabase.co';
    if (!class_exists('MMED_Supabase_Bridge') || !MMED_Supabase_Bridge::configured() || untrailingslashit((string)MMED_SUPABASE_URL)!==$base) { mmi_usce_tracker_page(array(),true); exit; }
    $headers=MMED_Supabase_Bridge::get_supabase_client_headers(); $headers['Content-Type']='application/json';
    $res=wp_remote_post($base.'/rest/v1/rpc/usce_student_tracker_account_v1',array('headers'=>$headers,'body'=>wp_json_encode(array(
        'p_wp_user_id'=>(int)$u->ID,'p_email'=>(string)$u->user_email,'p_ref'=>$ref==='' ? null : strtolower($ref))),
        'timeout'=>8,'redirection'=>0,'sslverify'=>true,'limit_response_size'=>524288));
    if (is_wp_error($res) || wp_remote_retrieve_response_code($res)!==200) { mmi_usce_tracker_page(array(),true); exit; }
    $payload=json_decode(wp_remote_retrieve_body($res),true);
    if (!isset($payload['items']) || !is_array($payload['items'])) { mmi_usce_tracker_page(array(),true); exit; }
    mmi_usce_tracker_page($payload['items'],false,$ref); exit;
}
add_action('admin_post_mmi_usce_student_tracker','mmi_usce_tracker_entry');
add_action('admin_post_nopriv_mmi_usce_student_tracker','mmi_usce_tracker_entry');

/** Same-origin WordPress actions keep the signed-in principal on the server. */
function mmi_usce_link_rpc($method, $params) {
    $base = 'https://fglyvdykwgbuivikqoah.supabase.co';
    if (!class_exists('MMED_Supabase_Bridge') || !MMED_Supabase_Bridge::configured() || untrailingslashit(MMED_SUPABASE_URL) !== $base) return null;
    $headers = MMED_Supabase_Bridge::get_supabase_client_headers();
    $headers['Content-Type'] = 'application/json';
    $result = wp_remote_post($base.'/rest/v1/rpc/'.$method, array(
        'headers'=>$headers, 'body'=>wp_json_encode($params), 'redirection'=>0, 'sslverify'=>true, 'timeout'=>8));
    if (is_wp_error($result) || wp_remote_retrieve_response_code($result)!==200) return null;
    return json_decode(wp_remote_retrieve_body($result),true);
}

function mmi_usce_post_value($key) {
    return isset($_POST[$key]) && is_string($_POST[$key]) ? trim(wp_unslash($_POST[$key])) : '';
}

function mmi_usce_same_origin_post() {
    nocache_headers();
    header('Cache-Control: private, no-store, max-age=0');
    header('Referrer-Policy: no-referrer');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || ($_SERVER['HTTP_ORIGIN'] ?? '') !== 'https://missionmedinstitute.com') {
        status_header(403); exit;
    }
}

function mmi_usce_submission_context() {
    mmi_usce_same_origin_post();
    if (($_SERVER['HTTP_X_MMI_USCE'] ?? '') !== 'tracker') { status_header(403); exit; }
    $user = wp_get_current_user();
    if (!$user->ID) wp_send_json(array('signed_in'=>false));
    $email = strtolower(trim($user->user_email));
    if (!is_email($email)) wp_send_json(array('error'=>'invalid_account_email'),403);
    if (mmi_usce_post_value('operation') === 'prepare') {
        if (!wp_verify_nonce(mmi_usce_post_value('nonce'),'mmi_usce_intake')) wp_send_json(array('error'=>'session_changed'),403);
        if (strtolower(mmi_usce_post_value('email')) !== $email) wp_send_json(array('error'=>'email_mismatch'),409);
        $key=mmi_usce_post_value('key');
        if (!preg_match('/\A[0-9a-z-]{16,100}\z/i',$key)) wp_send_json(array('error'=>'invalid_key'),400);
        $derived='mmwp1-'.hash_hmac('sha256',wp_json_encode(array('usce-intake-v1',(int)$user->ID,$email,$key)),wp_salt('auth'));
        if (mmi_usce_link_rpc('usce_tracker_prepare',array('p_uid'=>(int)$user->ID,'p_email'=>$email,'p_key'=>$derived)) !== true)
            wp_send_json(array('error'=>'prepare_failed'),503);
        wp_send_json(array('signed_in'=>true,'key'=>$derived));
    }
    $partition=hash_hmac('sha256','usce-form:'.(int)$user->ID.':'.$email,wp_salt('nonce'));
    wp_send_json(array('signed_in'=>true,'email'=>$email,'partition'=>$partition,'nonce'=>wp_create_nonce('mmi_usce_intake')));
}
add_action('admin_post_mmi_usce_submission_context','mmi_usce_submission_context');
add_action('admin_post_nopriv_mmi_usce_submission_context','mmi_usce_submission_context');

function mmi_usce_form_parent() {
    if (!is_page(array('usce','rotation-request'))) return;
    ?>
    <script>
    (() => {
      const sourceOrigin='https://cdn.missionmedinstitute.com';
      const endpoint='/wp-admin/admin-post.php?action=mmi_usce_submission_context';
      async function requestContext(fields) {
        const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',
          headers:{'X-MMI-USCE':'tracker'},body:new URLSearchParams(fields)});
        const data=await response.json();
        if (!response.ok) throw new Error(data.error || 'unavailable');
        return data;
      }
      window.addEventListener('message',async event=>{
        const frame=document.getElementById('missionmed-usce-cdn-frame');
        if (!frame || event.source!==frame.contentWindow || event.origin!==sourceOrigin) return;
        const src=new URL(frame.src,location.href);
        if (src.origin!==sourceOrigin || src.pathname!=='/html-system/LIVE/usce_request.html' ||
          src.hash || (src.search!=='' && src.search!=='?v=20260507-2')) return;
        const message=event.data;
        if (!message || message.type!=='mmi-usce-account' || !['context','prepare'].includes(message.operation) ||
            typeof message.id!=='string' || message.id.length>80) return;
        let result;
        try {
          const context=await requestContext({operation:'context'});
          if (message.operation==='context') result={signed_in:context.signed_in,email:context.email||'',partition:context.partition||'guest'};
          else if (!context.signed_in) result={signed_in:false};
          else result=await requestContext({operation:'prepare',nonce:context.nonce,email:message.email,key:message.key});
        } catch(error) { result={error:error.message==='email_mismatch'?'email_mismatch':'unavailable'}; }
        frame.contentWindow.postMessage({type:'mmi-usce-account-result',id:message.id,result},sourceOrigin);
      });
    })();
    </script>
    <?php
}
add_action('wp_footer','mmi_usce_form_parent',20);

function mmi_usce_claim_controls($ref) {
    $mode=isset($_GET['claim']) && is_string($_GET['claim']) ? sanitize_key(wp_unslash($_GET['claim'])) : '';
    $confirm=in_array($mode,array('code','retry'),true) && $ref!=='';
    $action=admin_url('admin-post.php','https');
    ?><aside><h2><?php echo $confirm?'Enter your verification code':'Link an existing request'; ?></h2>
    <?php if ($confirm) { ?><p role="status"><?php echo $mode==='retry'?'We couldn’t verify this code. Check the code and reference, or request another code.':'If this request is eligible, Clinicals will email a code to the address on the original request. Check your inbox and spam folder.'; ?></p>
    <form method="post" action="<?php echo esc_url($action); ?>"><input type="hidden" name="action" value="mmi_usce_claim">
    <input type="hidden" name="operation" value="verify"><input type="hidden" name="ref" value="<?php echo esc_attr($ref); ?>">
    <?php wp_nonce_field('mmi_usce_claim','claim_nonce',false); ?>
    <label>Verification code <input type="text" name="code" autocomplete="one-time-code" required maxlength="40"></label>
    <button type="submit">Link my request</button></form>
    <?php } ?>
    <p>Use the full request reference from your receipt. Sign in with the email address you used on the request.</p>
    <form method="post" action="<?php echo esc_url($action); ?>"><input type="hidden" name="action" value="mmi_usce_claim">
    <input type="hidden" name="operation" value="request"><?php wp_nonce_field('mmi_usce_claim','claim_nonce',false); ?>
    <label>Request reference <input required name="ref" type="text" maxlength="36" value="<?php echo esc_attr($ref); ?>"></label>
    <button type="submit"><?php echo $confirm?'Request another code':'Email me a verification code'; ?></button></form></aside><?php
}
function mmi_usce_process_claim() {
    mmi_usce_same_origin_post();
    $user=wp_get_current_user();
    if (!$user->ID || !wp_verify_nonce(mmi_usce_post_value('claim_nonce'),'mmi_usce_claim')) { status_header(403); exit('Please reopen the tracker and sign in again.'); }
    $ref=strtolower(mmi_usce_post_value('ref'));
    if (!preg_match('/\A[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z/',$ref)) {
        wp_die('Use the full 36-character reference on your receipt.', 'Check the request reference',array('response'=>400,'back_link'=>true));
    }
    $params=array('p_uid'=>(int)$user->ID,'p_email'=>strtolower(trim($user->user_email)),'p_ref'=>$ref);
    $operation=mmi_usce_post_value('operation');
    $target=mmi_usce_tracker_url($ref);
    if ($operation==='request') {
        $result=mmi_usce_link_rpc('usce_tracker_request_claim',$params);
        $target=add_query_arg('claim','code',$target);
    } elseif ($operation==='verify') {
        $clean=strtoupper(str_replace(array('-',' '),'',mmi_usce_post_value('code')));
        $params['p_hash']=hash('sha256',$clean);
        $result=mmi_usce_link_rpc('usce_tracker_finish_claim',$params);
        if ($result!==true) $target=add_query_arg('claim','retry',$target);
    } else { status_header(400); exit; }
    if ($result===null) wp_die('The tracker is temporarily unavailable. Please try again.', 'Clinicals tracker',array('response'=>503,'back_link'=>true));
    wp_safe_redirect($target,303); exit;
}
add_action('admin_post_mmi_usce_claim','mmi_usce_process_claim');

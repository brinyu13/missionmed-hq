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

function mmi_usce_tracker_page($items, $error = false) {
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
    </style></head><body><header><div><strong>MissionMed</strong> <span> / Clinical rotations</span></div></header><main><h1><?php echo esc_html($title); ?></h1>
    <?php if ($error) { ?><p>We couldn’t load your request. Please try again in a moment.</p><?php }
    elseif (!$items) { ?><p>There’s no request linked to this view of your account. If you already submitted one, contact Clinicals with the reference on your receipt.</p><?php }
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
    <p><a href="mailto:clinicals@missionmedinstitute.com">Contact Clinicals</a> · <a href="https://missionmedinstitute.com/usce/">Clinical rotations</a></p>
    </main></body></html><?php
}

function mmi_usce_tracker_entry() {
    nocache_headers(); header('Cache-Control: private, no-store, max-age=0, must-revalidate'); header('Vary: Cookie',false);
    header('Referrer-Policy: no-referrer'); header('X-Robots-Tag: noindex, nofollow'); header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
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
    mmi_usce_tracker_page($payload['items']); exit;
}
add_action('admin_post_mmi_usce_student_tracker','mmi_usce_tracker_entry');
add_action('admin_post_nopriv_mmi_usce_student_tracker','mmi_usce_tracker_entry');

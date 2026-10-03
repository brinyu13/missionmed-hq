<?php
/**
 * Plugin Name: MissionMed Matrix InterviewIQ Entry
 * Description: IIQ-1203 discovery only; canonical InterviewIQ remains the authorization and data owner.
 */
if (!defined('ABSPATH')) { exit; }
function mmiiq_discovery_access() {
    if (!is_user_logged_in() || !function_exists('mmiiq_enabled') || !mmiiq_enabled() || !function_exists('mmiiq_access_for_user')) { return false; }
    $access = mmiiq_access_for_user(wp_get_current_user());
    return is_wp_error($access) ? false : $access;
}
function mmiiq_discovery_is_matrix() {
    $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    return in_array($path, array('/member-dashboard', '/member-dashboard/'), true);
}
function mmiiq_discovery_assets() {
    if (!mmiiq_discovery_is_matrix() || !mmiiq_discovery_access() || !wp_script_is('mmed-dashboard-v2-js', 'enqueued')) { return; }
    $base = content_url('/uploads/missionmed-interviewiq-discovery/iiq-1203-v1/');
    $copy = 'Add your scheduled interviews. Prepare smarter for every program.';
    $app = array('id'=>'interviewiq', 'name'=>'INTERVIEWIQ', 'cat'=>'Match tools', 'hue'=>'#ffd16b', 'launch'=>home_url('/interviewiq/?iiq_entry=calendar'), 'sub'=>$copy, 'adminSub'=>$copy, 'one'=>$copy, 'problem'=>'I need to keep my scheduled interviews organized.', 'how'=>'Add your scheduled interviews to your private InterviewIQ Calendar. Open, edit, reschedule, cancel or restore an interview from your account.', 'benefits'=>array(array('Month Calendar','See your scheduled interviews.'),array('Saved interviews','Open, edit and reschedule your interview.')), 'outcome'=>'Your scheduled interviews stay organized and ready to open.', 'when'=>'When you receive or change an interview invitation.', 'cta'=>'ADD YOUR SCHEDULED INTERVIEW');
    $payload = array('app'=>$app,'art'=>array('pencil'=>$base.'pencil.svg','cinematic'=>$base.'cinematic.svg'));
    wp_add_inline_script('mmed-dashboard-v2-js', '(function(c,p){if(!c||c.experience!=="matrix2")return;c.apps=c.apps||{};c.defaults=c.defaults||{};c.apps.interviewiq=p.app;c.defaults.interviewiq=p.app;c.interviewiq_art=p.art;})(window.mmedDashboardV2,'.wp_json_encode($payload).');', 'before');
    add_filter('script_loader_src', function($src,$handle) use ($base) {
        return $handle === 'mmed-dashboard-v2-js' ? $base.'matrix-v2-iiq-1203.js' : $src;
    }, 100, 2);
}
add_action('wp_enqueue_scripts', 'mmiiq_discovery_assets', 100);
function mmiiq_matrix_entry() {
    $access = mmiiq_discovery_access();
    if (!$access) { return; }
    $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (mmiiq_discovery_is_matrix()) {
        $url = home_url('/interviewiq/?iiq_entry=calendar');
        ?>
        <script id="missionmed-matrix-interviewiq-entry">
        (function(url){
            'use strict';
            function install(){
                var sidebar=document.getElementById('sos-sidebar');
                if(!sidebar||sidebar.querySelector('[data-mmed-interviewiq-entry]'))return;
                var sections=sidebar.querySelectorAll('.sos-nav-section');
                for(var i=0;i<sections.length;i++){
                    var label=sections[i].querySelector('.sos-nav-label');
                    if(!label||label.textContent.trim().toUpperCase()!=='MATCH TOOLS')continue;
                    var list=sections[i].querySelector('.sos-nav-list');if(!list)return;
                    var li=document.createElement('li');li.setAttribute('data-mmed-interviewiq-entry','true');
                    var link=document.createElement('a');link.className='sos-nav-link';link.href=url;
                    link.innerHTML='<span class="sos-nav-icon" aria-hidden="true">IQ</span><span>InterviewIQ</span>';
                    li.appendChild(link);list.insertBefore(li,list.firstChild);return;
                }
            }
            install();
            var observer=new MutationObserver(install);observer.observe(document.documentElement,{childList:true,subtree:true});
            window.addEventListener('pagehide',function(){observer.disconnect();},{once:true});
        })(<?php echo wp_json_encode($url); ?>);
        </script>
        <?php
    }
}
add_action('wp_footer','mmiiq_matrix_entry',41);
/** Query-only response decoration: the immutable application/gateway files are unchanged. */
function mmiiq_discovery_calendar_bridge() {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET' || ($_GET['iiq_entry'] ?? '') !== 'calendar') { return; }
    $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if ($path !== '/interviewiq/') { return; }
    $access = mmiiq_discovery_access();
    if (!$access || ($access['role'] ?? '') !== 'student') { return; }
    ob_start(function($html) {
        if (strpos($html, '</body>') === false || strpos($html, 'id="main"') === false) { return $html; }
        $src = content_url('/uploads/missionmed-interviewiq-discovery/iiq-1203-v1/calendar-entry.js');
        $html = str_replace('</body>', '<script src="'.esc_url($src).'" defer></script></body>', $html);
        if (!headers_sent()) { header('Content-Length: '.strlen($html)); }
        return $html;
    });
}
add_action('parse_request','mmiiq_discovery_calendar_bridge',-1001);

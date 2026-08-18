<?php
/* MX-LOGIN-UX-008C: render the SHIPPED /my-account/ markup + CSS via WordPress stubs,
   so the visual evidence comes from the real mu-plugin source, not a mock-up. */
define('ABSPATH', __DIR__);

function esc_html($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function esc_attr($s){ return esc_html($s); }
function esc_url($s){ return esc_html($s); }
function esc_html__($s,$d=null){ return esc_html($s); }
function esc_attr__($s,$d=null){ return esc_html($s); }
function __($s,$d=null){ return $s; }
function esc_html_e($s,$d=null){ echo esc_html($s); }
function esc_attr_e($s,$d=null){ echo esc_html($s); }
function add_action(){ } function add_filter(){ }
function apply_filters($t,$v){ return $v; }
function home_url($p=''){ return 'https://missionmedinstitute.com'.$p; }
function wc_get_endpoint_url($e){ return 'https://missionmedinstitute.com/my-account/'.$e.'/'; }
function wc_logout_url(){ return 'https://missionmedinstitute.com/my-account/customer-logout/'; }
function date_i18n($f,$t){ return date($f,$t); }
function get_user_meta($id,$k,$s=false){ return $k==='mmed_program_tier' ? '360 Match Mentorship' : ''; }
function wp_get_current_user(){
  $u = new stdClass();
  $u->ID = 42; $u->display_name = 'Amara Osei'; $u->first_name = 'Amara';
  $u->user_login = 'aosei'; $u->user_registered = '2026-02-11 09:00:00';
  return $u;
}
function is_account_page(){ return true; }
function is_user_logged_in(){ return true; }
function is_wc_endpoint_url(){ return false; }

require __DIR__ . '/../../../../wp-content/mu-plugins/missionmed-matrix-account-entry.php';

$css = mmed_matrix_account_entry_css();
ob_start(); mmed_matrix_account_entry_render_identity(); $identity = ob_get_clean();
ob_start(); mmed_matrix_account_entry_render();          $matrix   = ob_get_clean();
ob_start(); mmed_matrix_account_entry_render_controls(); $controls = ob_get_clean();

/* WooCommerce dashboard endpoint DOM, in the real order: Woo prints its greeting
   paragraphs first, then fires woocommerce_account_dashboard (our three hooks). */
?><!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>/my-account/ — MX-LOGIN-UX-008C</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap">
<style>
*{box-sizing:border-box}
body{margin:0;font-family:"Poppins",sans-serif}
#page{max-width:1180px;margin:0 auto;padding:40px 24px 64px}
.woocommerce-MyAccount-navigation{float:left;width:22%}
.woocommerce-MyAccount-navigation ul{list-style:none;margin:0;padding:0}
.woocommerce-MyAccount-navigation li{margin:0 0 6px}
.woocommerce-MyAccount-navigation a{display:block;padding:9px 12px;border-radius:8px;font-size:13.5px;text-decoration:none;color:rgba(238,246,255,.72);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
.woocommerce-MyAccount-navigation a:hover{color:#fff;background:rgba(255,255,255,.09)}
.woocommerce-MyAccount-content{float:right;width:74%}
<?php echo $css; ?>
</style></head>
<body class="mmed-matrix-account-dashboard woocommerce-account">
<div id="page">
  <nav class="woocommerce-MyAccount-navigation"><ul>
    <li><a href="#">Med Matrix Dashboard</a></li>
    <li><a href="#">Access Arena</a></li>
    <li><a href="#">Orders</a></li>
    <li><a href="#">Subscriptions</a></li>
    <li><a href="#">Account details</a></li>
    <li><a href="#">Log out</a></li>
  </ul></nav>
  <div class="woocommerce-MyAccount-content">
    <p>Hello <strong>Amara</strong> (not Amara? <a href="#">Log out</a>)</p>
    <p>From your account dashboard you can view your recent orders, manage your shipping and billing addresses, and edit your password and account details.</p>
<?php echo $identity, $matrix, $controls; ?>
  </div>
  <div style="clear:both"></div>
</div>
</body></html>

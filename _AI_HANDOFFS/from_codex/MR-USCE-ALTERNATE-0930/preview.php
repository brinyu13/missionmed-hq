<?php
// Local-only PHP fixture. No WordPress, credentials, accounts or writes.
define('ABSPATH', __DIR__);
function esc_html($s){return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');}
$config=json_decode(file_get_contents(__DIR__.'/donor/mr-alt-commerce.json'),true);
$iwPrice='$549'; $zellePrice='$499'; $completePrice='$3,099'; $early=true;
$asset=fn($s)=>'/wp-content/mu-plugins/missionmed-mr-alternate-assets/'.$s;
require __DIR__.'/../../../wp-content/mu-plugins/missionmed-mr-alternate-assets/page.php';

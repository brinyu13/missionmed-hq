<?php
if(PHP_SAPI!=='cli')exit(1);
define('ABSPATH',__DIR__);
function esc_html($s){return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');}
$root=dirname(__DIR__,3);
$config=json_decode(file_get_contents(dirname(__DIR__).'/MR-USCE-ALTERNATE-0930/donor/mr-alt-commerce.json'),true);
$iwPrice='$549';$zellePrice='$499';$completePrice='$3,099';$early=true;$promoted=true;
$asset=fn($s)=>'/assets/'.$s;
require $root.'/wp-content/mu-plugins/missionmed-mr-alternate-assets/page.php';

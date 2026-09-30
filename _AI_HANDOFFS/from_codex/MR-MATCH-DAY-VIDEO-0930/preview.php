<?php
// CLI-rendered, loopback-only fixture. Never deploy this evidence directory.
if (PHP_SAPI !== 'cli') exit(1);
define('ABSPATH', __DIR__);
function esc_html($s){return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');}
$root = dirname(__DIR__, 3);
$dir = $root . '/wp-content/mu-plugins/missionmed-mr-alternate-assets';
$config = json_decode(file_get_contents(dirname(__DIR__).'/MR-USCE-ALTERNATE-0930/donor/mr-alt-commerce.json'),true);
$iwPrice='$549';$zellePrice='$499';$completePrice='$3,099';$early=true;$promoted=true;
$asset=fn($s)=>'/assets/'.$s;
$baseline=($argv[1]??'')==='baseline';
$page=$baseline ? shell_exec('git -C '.escapeshellarg($root).' show b6490e47f2593504a57432b3f48ab2a9617bc2ca:wp-content/mu-plugins/missionmed-mr-alternate-assets/page.php') : file_get_contents($dir.'/page.php');
if (!$baseline) {
    // Override only inside this private fixture; the production JSON stays disabled and UID-empty.
    $component=file_get_contents($dir.'/match-day-player.php');
    $component=preg_replace('/\$matchDayMedia = json_decode\([^\n]+\);/', '\$matchDayMedia = ["enabled"=>true,"provider"=>"cloudflare-stream","streamUid"=>str_repeat("0",32),"publicUseAuthority"=>"LOCAL FIXTURE ONLY - NO PUBLICATION AUTHORITY","masterSha256"=>"6ca321397fabd28d69c5e98a621c7b5d4fa7705f99d93a60daff2a5fc79d1398"];', $component);
    ob_start();eval('?>'.$component);$componentHtml=ob_get_clean();
    $page=str_replace("<?php require __DIR__ . '/match-day-player.php'; ?>",$componentHtml,$page);
}
ob_start();eval('?>'.$page);$html=ob_get_clean();
$html=str_replace('https://customer-wiw9vmb43wmdkdp7.cloudflarestream.com','http://127.0.0.1:8774',$html);
if($baseline)$html=str_replace('/assets/','/baseline-assets/',$html);
$probe='<script>window.__videoQa={lcp:0,cls:0};new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__videoQa.lcp=e.startTime)).observe({type:"largest-contentful-paint",buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__videoQa.cls+=e.value})).observe({type:"layout-shift",buffered:true});</script>';
echo str_replace('<head>','<head>'.$probe,$html);

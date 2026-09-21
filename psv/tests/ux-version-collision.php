<?php
/** A sibling's previously published global version must not disable PSV. */
define('ABSPATH',__DIR__.'/');
define('MMPS_VERSION','2026.09.21');
$hooks=[];
function plugin_dir_path($p){return dirname($p).'/';}
function plugin_dir_url($p){return 'https://example.test/psv/';}
function register_activation_hook($p,$c){}
function add_action($n,$c,$priority=10){global $hooks;$hooks[$n][]=$c;}
function add_filter($n,$c,$priority=10,$args=1){}
require dirname(__DIR__,2).'/wp-content/plugins/missionmed-file-vault-ps/missionmed-file-vault-ps.php';
foreach($hooks['plugins_loaded'] as $hook){$hook();}
if(!defined('MMED_PSV_VERSION') || MMED_PSV_VERSION!=='0.6.1' || MMPS_VERSION!=='2026.09.21' || !class_exists('MMPS_Store') || !class_exists('MMPS_Edit')){fwrite(STDERR,"FAIL version collision\n");exit(1);}
require dirname(__DIR__,2).'/wp-content/plugins/missionmed-file-vault-ps/missionmed-file-vault-ps.php';
echo "PASS sibling version remains untouched; PSV loads fully and duplicate inclusion stays safe\n";

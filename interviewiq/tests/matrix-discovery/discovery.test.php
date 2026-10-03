<?php
const ABSPATH='/stub';$hooks=[];$logged=true;$enabled=true;$access=['role'=>'student'];$enqueued=true;$inline=[];$filters=[];
function add_action($n,$f,$p){global $hooks;$hooks[$n]=$f;}
function is_user_logged_in(){global $logged;return $logged;}
function mmiiq_enabled(){global $enabled;return $enabled;}
function mmiiq_access_for_user($u){global $access;return $access;}
function wp_get_current_user(){return null;}
function is_wp_error($v){return $v===false;}
function wp_parse_url($u,$c){return parse_url($u,$c);}
function wp_script_is($h,$s){global $enqueued;return $enqueued;}
function content_url($p){return 'https://missionmedinstitute.com/wp-content'.$p;}
function home_url($p){return 'https://missionmedinstitute.com'.$p;}
function wp_json_encode($v){return json_encode($v);}
function wp_add_inline_script($h,$s,$p){global $inline;$inline[]=$s;}
function add_filter($n,$f,$p,$a){global $filters;$filters[$n]=$f;}
require (file_exists(__DIR__.'/missionmed-matrix-interviewiq-entry.php')?__DIR__:__DIR__.'/../../infra/wordpress').'/missionmed-matrix-interviewiq-entry.php';
$count=0;function check($b,$m){global $count;if(!$b)throw new Exception($m);$count++;}
$_SERVER['REQUEST_URI']='/member-dashboard/';mmiiq_discovery_assets();check(count($inline)===1,'eligible boot');check(str_contains($inline[0],'iiq_entry=calendar'),'actual calendar destination');check(($filters['script_loader_src'])('original','other')==='original','unrelated handles unchanged');check(str_contains(($filters['script_loader_src'])('original','mmed-dashboard-v2-js'),'iiq-1203-v1'),'exact renderer handle');
$inline=[];$access=false;mmiiq_discovery_assets();check(!$inline,'ineligible no card');ob_start();mmiiq_matrix_entry();check(ob_get_clean()==='','ineligible no rail');$access=['role'=>'student'];$logged=false;check(!mmiiq_discovery_access(),'anonymous fail closed');$logged=true;$enabled=false;check(!mmiiq_discovery_access(),'disabled fail closed');$enabled=true;
$_SERVER['REQUEST_URI']='/unrelated/';$inline=[];mmiiq_discovery_assets();check(!$inline,'other surfaces untouched');$_SERVER['REQUEST_URI']='/member-dashboard/';ob_start();mmiiq_matrix_entry();$s=ob_get_clean();check(str_contains($s,"!=='MATCH TOOLS'"),'family section');check(str_contains($s,'new MutationObserver(install)')&&!str_contains($s,'observer.disconnect(); }, 15000'),'survives redraw');
function esc_url($s){return $s;}
$_SERVER['REQUEST_METHOD']='GET';$_SERVER['REQUEST_URI']='/interviewiq/?iiq_entry=calendar';$_GET['iiq_entry']='calendar';
$before=ob_get_level();mmiiq_discovery_calendar_bridge();check(ob_get_level()===$before+1,'student bridge registered');echo '<main id="main"></main></body>';$raw=ob_get_contents();$callback=ob_get_status()['name'];ob_end_clean();check(str_contains($raw,'id="main"'),'original html retained');
$access=['role'=>'admin'];$before=ob_get_level();mmiiq_discovery_calendar_bridge();check(ob_get_level()===$before,'admin cannot become student');$access=['role'=>'student'];$_GET=[];mmiiq_discovery_calendar_bridge();check(ob_get_level()===$before,'ordinary app entry unchanged');$_GET=['iiq_entry'=>'calendar'];$_SERVER['REQUEST_URI']='/interviewiq/api/bootstrap';mmiiq_discovery_calendar_bridge();check(ob_get_level()===$before,'API never decorated');$_SERVER['REQUEST_URI']='/interviewiq/';$_SERVER['REQUEST_METHOD']='HEAD';mmiiq_discovery_calendar_bridge();check(ob_get_level()===$before,'HEAD untouched');echo "$count PASS; 0 FAIL\n";

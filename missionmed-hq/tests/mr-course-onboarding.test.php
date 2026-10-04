<?php
define('ABSPATH', __DIR__);
function add_filter(...$args){} function add_action(...$args){}
function home_url($p){return 'https://missionmedinstitute.com'.$p;}
function esc_url($s){return $s;}
$query=3646;$singular=true;
function get_queried_object_id(){return $GLOBALS['query'];}
function is_singular($s){return $GLOBALS['singular'];}
require __DIR__.'/../../wp-content/mu-plugins/missionmed-mr-course-onboarding.php';
$tests=0;
function check($b,$m){global $tests;$tests++;if(!$b)throw new Exception($m);}
$data=[['id'=>'unrelated','elements'=>[['id'=>'child','settings'=>['text'=>'Preserve']]]],['id'=>'4064e67','settings'=>['padding'=>'same'],'elements'=>[['id'=>'39cd759','settings'=>['title'=>'Welcome to 360 Match Mentorship']]]],['id'=>'627ee59','elements'=>[['id'=>'b852483','settings'=>['text'=>'Phase0']]]],['id'=>'58702f5','elements'=>[['id'=>'7096afd','widgetType'=>'ld-course-content']]]];
foreach([3646,5227] as $id){$query=$id;$out=mm_mr_course_onboarding_template($data,3306);$s=json_encode($out);check(!str_contains($s,'360 Match'),'stale welcome');check(!str_contains($s,'Phase0'),'stale CTA');check(str_contains($s,'October 8'),'current dates');check(str_contains($s,'member-dashboard'),'real next step');check($out[0]===$data[0],'unrelated subtree');check($out[2]===$data[3],'course curriculum widget');check($data[1]['elements'][0]['id']==='39cd759','input untouched');}
$query=4204;check(mm_mr_course_onboarding_template($data,3306)===$data,'unrelated course');
$query=3646;check(mm_mr_course_onboarding_template($data,999)===$data,'other template');
$singular=false;check(mm_mr_course_onboarding_template($data,3306)===$data,'other surface');
check(mm_mr_course_onboarding_content(4204)==='','unknown program');
check(str_contains(mm_mr_course_onboarding_content(5227),'February'),'season scope');
echo "PASS $tests scoped onboarding assertions\n";

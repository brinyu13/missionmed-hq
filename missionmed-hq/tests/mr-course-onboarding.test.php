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
$data='<style>.existing{color:red}</style><div data-elementor-id="3306"><div data-id="unrelated">Preserve</div><div data-id="4064e67"><h2>Welcome to 360 Match Mentorship</h2></div><div data-id="627ee59"><a href="#">Phase0</a></div><div data-id="58702f5">Course curriculum</div></div>';
foreach([3646,5227] as $id){$query=$id;$out=mm_mr_course_onboarding_template($data);check(!str_contains($out,'360 Match'),'stale welcome');check(!str_contains($out,'Phase0'),'stale CTA');check(str_contains($out,'October 8'),'current dates');check(str_contains($out,'member-dashboard'),'real next step');check(str_contains($out,'>Preserve</div>'),'unrelated subtree');check(str_contains($out,'>Course curriculum</div>'),'course curriculum widget');check(str_contains($data,'360 Match'),'input untouched');check(str_contains($out,'<style>.existing{color:red}</style>'),'multi-root preservation');}
$query=4204;check(mm_mr_course_onboarding_template($data)===$data,'unrelated course');
$query=3646;$other=str_replace('id="3306"','id="999"',$data);check(mm_mr_course_onboarding_template($other)===$other,'other template');
$singular=false;check(mm_mr_course_onboarding_template($data)===$data,'other surface');
$singular=true;$drift=str_replace('data-id="4064e67"','data-id="changed"',$data);check(mm_mr_course_onboarding_template($drift)===$drift,'template drift fails without mangling');
check(mm_mr_course_onboarding_content(4204)==='','unknown program');
check(str_contains(mm_mr_course_onboarding_content(5227),'February'),'season scope');
echo "PASS $tests scoped onboarding assertions\n";

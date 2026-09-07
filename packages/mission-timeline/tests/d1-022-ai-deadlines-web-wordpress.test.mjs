import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {TimelineProductionAuthClient} from "../web/js/production/timeline-auth-client.js";
for(const operation of ["analyzeCv","analyzeQuality","rescueTimeline"])test(`${operation} gives the 100-second gateway a 110-second browser envelope`,async(t)=>{
 const deadlines=[];t.mock.method(AbortSignal,"timeout",ms=>{deadlines.push(ms);return new AbortController().signal;});
 const client=new TimelineProductionAuthClient({locationObject:{origin:"https://controlled.invalid"},documentObject:null,fetchImpl:async()=>new Response("{}",{status:200})});
 client.bootstrapState={apiBase:"https://controlled.invalid/timeline/api/v1"};client.validToken=async()=>"controlled-token";
 await client[operation]("timeline_controlled",{});assert.deepEqual(deadlines,[110000]);client.close();
});
test("ordinary browser requests and media uploads keep their original deadlines",async(t)=>{
 const deadlines=[];t.mock.method(AbortSignal,"timeout",ms=>{deadlines.push(ms);return new AbortController().signal;});
 const client=new TimelineProductionAuthClient({locationObject:{origin:"https://controlled.invalid"},documentObject:null,fetchImpl:async()=>new Response("{}",{status:200})});
 client.bootstrapState={apiBase:"https://controlled.invalid/timeline/api/v1"};client.validToken=async()=>"controlled-token";
 await client.request("/documents");await client.uploadOwnedObject("timeline_controlled",new Blob(["controlled"],{type:"image/png"}),{sha256:"a".repeat(64)});
 assert.deepEqual(deadlines,[20000,60000]);client.close();
});
const php=readFileSync(new URL("../../../wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php",import.meta.url),"utf8");
const start=php.indexOf("function mmtl_release_ai_proxy_session_lock($is_ai_route) {");const end=php.indexOf("\nadd_action('template_redirect', 'mmtl_proxy_api_request', 0);",start);assert.ok(start>0&&end>start);const actual=php.slice(start,end);
// Reuse only the existing independent WP stubs; execute the complete current
// production gateway so route-specific deadline selection is tested in PHP.
const fixture=readFileSync(new URL("./d1-022-source-upload-wordpress-independent.test.mjs",import.meta.url),"utf8");
const base=fixture.match(/const harness=String.raw`([\s\S]*?)`;/)?.[1];assert.ok(base);
const harness=base.replace("'redirection'=>$args['redirection']","'timeout'=>$args['timeout'],'redirection'=>$args['redirection']")+"\nfunction get_user_meta(){return '';} define('MMTL_SYNTHETIC_TEST_META','controlled_synthetic_meta');\n";
function wpDeadline(path,media=false){
 const code=harness+actual+String.raw`try{mmtl_proxy_api_request();}catch(RuntimeException $e){echo $e->getMessage();}`;
 return JSON.parse(execFileSync("php",["-r",code],{input:JSON.stringify({path,server:media?{CONTENT_TYPE:"image/png",HTTP_X_TIMELINE_OBJECT_CLASS:"MEDIA"}:{}}),encoding:"utf8",timeout:10000}));
}
for(const suffix of ["intake/analyze","quality/analyze","intake/rescue"])test(`actual WP ${suffix} allows 100 seconds inside the browser envelope`,()=>{
 assert.equal(wpDeadline(`v1/documents/timeline_controlled/${suffix}`).timeout,100);
});
test("actual WP media and ordinary routes retain 60 and 20 seconds",()=>{
 assert.equal(wpDeadline("v1/objects/upload",true).timeout,60);assert.equal(wpDeadline("v1/documents").timeout,20);
});

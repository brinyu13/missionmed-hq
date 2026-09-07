import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';

function run(scenario='suite'){
 const result=spawnSync('php',['tests/fixtures/wordpress-workspace-022-harness.php',scenario],{encoding:'utf8'});
 assert.equal(result.status,0,`${scenario}: ${result.stderr} ${result.stdout}`);
 return JSON.parse(result.stdout.trim());
}
test('022 WordPress consent, exact enrollment roster and first-use identity execute with server permission callbacks',()=>{
 const result=run();assert.equal(result.pass,true);assert.equal(Object.keys(result.checks).length,33);
 for(const[name,passed]of Object.entries(result.checks))assert.equal(passed,true,name);
});
test('022 generic BFF never forwards a forged administrator directory header',()=>{
 for(const scenario of ['admin_directory_forgery','student_directory_forgery'])assert.equal(run(scenario).error.code,'admin_directory_route_required');
});
test('022 BFF derives exact current student identity server-side, including first-use accounts',()=>{
 const first=run('admin_first_use');assert.equal(first.forwarded,true);assert.equal(first.subject_wp,102);assert.match(first.subject_principal,/^[a-f0-9-]{36}$/);assert.equal(first.admin_workspace,true);assert.equal(first.directory_header,false);
 const wrongUrl=run('admin_other_subject');assert.equal(wrongUrl.subject_wp,101);assert.equal(wrongUrl.subject_principal,'9d8d7a7a-c915-4d36-a657-910ad2221001');
});
test('022 BFF rejects missing/revoked subjects and current administrator capability revocation',()=>{
 for(const scenario of ['admin_missing_subject','admin_revoked_subject'])assert.equal(run(scenario).error.code,'admin_subject_unavailable');
 assert.equal(run('admin_revoked_capability').error.code,'administrator_approval_required');
});
test('022 BFF compares current consent and eligibility on every request',()=>{
 assert.equal(run('student_stale_consent').error.code,'timeline_token_invalid');
 assert.equal(run('student_revoked').error.code,'eligibility_required');
});
test('022 client synthetic fixture header cannot authorize provider processing',()=>{
 const result=run('student_synthetic_forgery');assert.equal(result.forwarded,true);assert.equal(result.ai_consent,false);assert.equal(result.synthetic_header,false);assert.equal(result.directory_header,false);
});

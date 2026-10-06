import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeTimelineAdminRoster,renderTimelineAdminWorkspace} from '../web/js/production/admin-workspace-022.js';
import {productionEntitlementAssertion} from '../web/js/production/timeline-production-runtime.js';
const fixture=JSON.parse(execFileSync('php',[fileURLToPath(new URL('./fixtures/current-entitlement-harness.php',import.meta.url))],{encoding:'utf8'}));

test('synthetic PHP current authorization protects routes, tokens and the administrator directory',()=>{
 assert.ok(Object.keys(fixture.checks).length>=20);
 for(const [name,passed]of Object.entries(fixture.checks))assert.equal(passed,true,name);
 assert.deepEqual(fixture.roster.map(row=>row.entitlementReason),['founder_authorized','iv_prep_enrolled','both']);
});
const rosterPayload=()=>structuredClone(fixture.endpointRoster);
test('administrator labels describe the authorized population and reject the old broad source',()=>{
 const payload=rosterPayload(),roster=normalizeTimelineAdminRoster(payload),html=renderTimelineAdminWorkspace({phase:'ready',roster,query:'',session:'',filter:'all',page:1});
 assert.match(html,/Timeline-authorized students/);assert.match(html,/Founder-authorized\/current 360/);assert.match(html,/IV Prep Complete enrolled/);
 assert.doesNotMatch(html,/Eligible 360|360 eligible|current MissionMed 360 enrollment/);
 assert.throws(()=>normalizeTimelineAdminRoster({...payload,source:'learndash-course-3893'}));
 assert.throws(()=>normalizeTimelineAdminRoster({...payload,students:[{...payload.students[0],entitlementReason:'broad-course'},...payload.students.slice(1)]}));
});
test('production entitlement text follows the signed current authorization reason',()=>{
 for(const [reason,expected]of [['founder_authorized',/Founder-authorized/],['iv_prep_enrolled',/IV Prep Complete/],['both',/Founder-authorized.*IV Prep Complete/]]){
  const assertion=productionEntitlementAssertion({principalId:fixture.founderClaims.sub,wpUserId:101,claims:{...fixture.founderClaims,timeline_entitlement_reason:reason}},0);
  assert.equal(assertion.source,'timeline-current-entitlement');assert.equal(assertion.subjectKind,'timeline-authorized-student');assert.match(assertion.reason,expected);assert.doesNotMatch(assertion.reason,/3893/);
 }
 const admin=productionEntitlementAssertion({principalId:fixture.founderClaims.sub,wpUserId:201,claims:{...fixture.founderClaims,is_wordpress_administrator:true}},0);
 assert.equal(admin.source,'wordpress-administrator');assert.equal(admin.allowance,'unlimited');
});

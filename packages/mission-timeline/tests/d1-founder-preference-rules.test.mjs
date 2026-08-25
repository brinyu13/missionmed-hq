import assert from "node:assert/strict";
import test from "node:test";

import{
  FOUNDER_PREFERENCE_AUTHORITY_SOURCE,
  FOUNDER_PREFERENCE_SCHEMA,
  activeFounderPreferenceRules,
  addFounderPreferenceRule,
  reviseFounderPreferenceRule,
  rollbackFounderPreferenceRule,
  setFounderPreferenceRuleEnabled
}from"../web/js/uxr-002/founder-preference-rules.js";

const authority=Object.freeze({
  source:FOUNDER_PREFERENCE_AUTHORITY_SOURCE,
  registryId:"missionmed-founder-preferences-v1",
  canManageFounderPreferences:true,
  approvedBy:"Founder",
  approvalRef:"DR-127#founder-preference"
});
const authorized=(extra={})=>({authority,...extra});

test("Founder rules are explicit, versioned, auditable, disableable, and rollback-safe",()=>{
  const document={};
  const rule=addFounderPreferenceRule(document,{
    kind:"LAYOUT_PREFERENCE",payload:{objectKind:"MILESTONE",alignment:"CENTER",minimumGap:16}
  },authorized({makeId:()=>"rule-layout",now:()=>"2026-08-24T20:00:00.000Z"}));
  assert.equal(document.founderPreferences.schemaVersion,FOUNDER_PREFERENCE_SCHEMA);
  assert.equal(document.founderPreferences.automaticLearning,false);
  assert.deepEqual(document.founderPreferences.authority,{source:FOUNDER_PREFERENCE_AUTHORITY_SOURCE,registryId:authority.registryId});
  assert.equal(rule.activeVersion,1);
  reviseFounderPreferenceRule(document,rule.id,{
    payload:{objectKind:"MILESTONE",alignment:"LEFT",minimumGap:20}
  },authorized());
  assert.deepEqual(activeFounderPreferenceRules(document,authorized())[0].payload,{objectKind:"MILESTONE",alignment:"LEFT",minimumGap:20});
  setFounderPreferenceRuleEnabled(document,rule.id,false,authorized());
  assert.deepEqual(activeFounderPreferenceRules(document,authorized()),[]);
  rollbackFounderPreferenceRule(document,rule.id,1,authorized());
  assert.deepEqual(activeFounderPreferenceRules(document,authorized())[0].payload,{objectKind:"MILESTONE",alignment:"CENTER",minimumGap:16});
  assert.deepEqual(document.founderPreferences.audit.map(({action})=>action),["CREATE","REVISE","DISABLE","ROLLBACK"]);
});

test("Founder preference payloads are allowlisted and cannot retain student facts or excerpts",()=>{
  const document={};
  const rule=addFounderPreferenceRule(document,{
    kind:"CATEGORY_CORRECTION",
    payload:{fromCategoryId:"employment",toCategoryId:"research",studentName:"Private Student",sourceExcerpt:"private CV text"}
  },authorized());
  assert.deepEqual(activeFounderPreferenceRules(document,authorized())[0].payload,{fromCategoryId:"employment",toCategoryId:"research"});
  assert.doesNotMatch(JSON.stringify(rule),/Private Student|private CV text/);
});

test("no rule can activate without server-owned Founder authority and a safe bounded payload",()=>{
  assert.throws(()=>addFounderPreferenceRule({}, {approvedBy:"Founder",founderApprovalRef:"claimed-in-browser",kind:"PRESENTATION_CORRECTION",payload:{fixKind:"CLAMP_OBJECTS"}}),/SERVER_APPROVAL/);
  assert.throws(()=>addFounderPreferenceRule({}, {kind:"PRESENTATION_CORRECTION",payload:{fixKind:"CHANGE_STUDENT_DATE"}},authorized()),/PRESENTATION/);
  assert.throws(()=>addFounderPreferenceRule({}, {kind:"VISIBILITY_CONVENTION",payload:{eventType:"publication",defaultVisibility:"PUBLIC"}},authorized()),/VISIBILITY/);
});

test("browser callers cannot self-author or activate Founder approval metadata",()=>{
  const originalWindow=globalThis.window;
  try{
    globalThis.window={};
    assert.throws(()=>addFounderPreferenceRule({}, {
      approvedBy:"Founder",founderApprovalRef:"forged",kind:"PRESENTATION_CORRECTION",payload:{fixKind:"CLAMP_OBJECTS"}
    },authorized()),/BROWSER_MUTATION_DENIED/);
    assert.throws(()=>activeFounderPreferenceRules({founderPreferences:{schemaVersion:FOUNDER_PREFERENCE_SCHEMA,rules:[]}},authorized()),/BROWSER_MUTATION_DENIED/);
  }finally{
    if(originalWindow===undefined)delete globalThis.window;
    else globalThis.window=originalWindow;
  }
});

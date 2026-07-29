import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThemePickerForDocument,
  renderThemePicker
} from "../web/js/uxr-002/theme-picker.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

function populatedDocument(){
  const document=defaultDocument();
  document.studentProfile.fullName="Amara Osei";
  document.events=[
    {id:"school",title:"Medical school",categoryId:"education",eventType:"duration",startDate:"2021-01",endDate:"2022-12",visibilityState:"INTERVIEWER_SAFE"},
    {id:"rotation",title:"US rotation",categoryId:"clinical",eventType:"duration",startDate:"2023-01",endDate:"2024-06",visibilityState:"INTERVIEWER_SAFE"},
    {id:"research",title:"Research",categoryId:"research",eventType:"duration",startDate:"2023-06",endDate:"2025-06",visibilityState:"INTERVIEWER_SAFE"}
  ];
  return document;
}

test("integrated picker renders exactly five live own-board theme miniatures plus the Guided locked teaser",()=>{
  const document=populatedDocument();
  const model=buildThemePickerForDocument(document,{currentMonth:"2026-07"});
  assert.equal(model.cells.length,6);
  assert.equal(model.cells.filter((cell)=>cell.kind==="theme").length,5);
  for(const cell of model.cells.filter((item)=>item.kind==="theme")){
    assert.match(cell.miniature,/data-renderer="D1-UXR-002-Keynote-Classic"/);
    assert.match(cell.miniature,new RegExp(`data-theme="${cell.themeId}"`));
    assert.equal(cell.miniatureInput.eventCount,3);
  }
  assert.equal(model.cells[5].kind,"advanced-teaser");
  const html=renderThemePicker(document,{currentMonth:"2026-07"});
  assert.equal((html.match(/data-select-theme=/g)||[]).length,5);
  assert.match(html,/Your background — Advanced Studio/);
  assert.match(html,/class="theme-card active"/);
});

test("integrated picker exposes Backgrounds only in Advanced and serializes genuinely distinct theme surfaces",()=>{
  const document=populatedDocument();
  document.mode="advanced";
  const html=renderThemePicker(document,{currentMonth:"2026-07"});
  assert.match(html,/data-open-backgrounds/);
  assert.match(html,/radialGradient/);
  assert.match(html,/#FAF6EC/);
  assert.match(html,/data-headline-rule="true"/);
  assert.match(html,/font-family="Nunito, sans-serif"/);
  assert.equal((html.match(/data-select-theme=/g)||[]).length,5);
});

test("the isolated N<4 founder branch remains named and does not fabricate theme miniatures",()=>{
  const document=defaultDocument();
  document.events=[{id:"one",title:"One",categoryId:"personal",eventType:"milestone",startDate:"2026-01",visibilityState:"INTERVIEWER_SAFE"}];
  const html=renderThemePicker(document,{currentMonth:"2026-07"});
  assert.match(html,/data-render-isolated="D1_UXR_002_M4_ISOLATED_N_LT_4_YEAR_WIDTH_CONTRADICTION"/);
  assert.doesNotMatch(html,/data-select-theme=/);
});

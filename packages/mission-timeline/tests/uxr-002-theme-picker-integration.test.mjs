import assert from "node:assert/strict";
import test from "node:test";

import {
  THEME_EXAMPLE_LABEL,
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

test("integrated picker exposes Backgrounds only in Advanced and keeps all theme skins on the locked 407F renderer",()=>{
  const document=populatedDocument();
  document.mode="advanced";
  const html=renderThemePicker(document,{currentMonth:"2026-07"});
  assert.match(html,/data-open-backgrounds/);
  assert.equal((html.match(/data-locked-407f-source-sha256=/g)||[]).length,5);
  for(const themeId of ["keynote-classic","mission-navy","advisor-paper","horizon","little-journeys"]){
    assert.match(html,new RegExp(`data-theme="${themeId}"`));
  }
  assert.match(html,/data-artifact-chrome="title"/);
  assert.match(html,/data-artifact-language="407f-powerpoint-keynote"/);
  assert.equal((html.match(/data-select-theme=/g)||[]).length,5);
});

test("D1-405 renders all theme miniatures for an N<4 student timeline",()=>{
  const document=defaultDocument();
  document.events=[{id:"one",title:"One",categoryId:"personal",eventType:"milestone",startDate:"2026-01",visibilityState:"INTERVIEWER_SAFE"}];
  const html=renderThemePicker(document,{currentMonth:"2026-07"});
  assert.doesNotMatch(html,/data-render-isolated/);
  assert.equal((html.match(/data-select-theme=/g)||[]).length,5);
  assert.equal((html.match(/data-renderer="D1-UXR-002-Keynote-Classic"/g)||[]).length,5);
});

test("M10 empty accounts receive clearly labeled examples through the same renderer and theme definitions",()=>{
  const document=defaultDocument();
  const model=buildThemePickerForDocument(document,{currentMonth:"2026-07"});
  assert.equal(model.contentSource,"example");
  assert.equal(model.example,true);
  for(const cell of model.cells.filter(({kind})=>kind==="theme")){
    assert.equal(cell.miniatureInput.source,"example-board");
    assert.equal(cell.miniatureInput.example,true);
    assert.equal(cell.miniatureInput.exampleLabel,THEME_EXAMPLE_LABEL);
    assert.ok(cell.miniatureInput.eventCount>=4);
    assert.match(cell.miniature,/data-renderer="D1-UXR-002-Keynote-Classic"/);
    assert.match(cell.miniature,/data-lor-legend="true"/);
  }
  const html=renderThemePicker(document,{currentMonth:"2026-07"});
  assert.match(html,/data-theme-preview-source="example"/);
  assert.equal((html.match(/EXAMPLE TIMELINE/g)||[]).length,5);
  assert.equal((html.match(/example timeline preview/g)||[]).length,5);
  assert.doesNotMatch(html,/data-render-isolated/);
});

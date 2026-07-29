import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(relativePath)=>readFileSync(new URL(`../${relativePath}`,import.meta.url),"utf8");
const index=read("web/index.html");
const css=read("web/styles/407f-upgrade.css");
const adapter=read("web/js/407f-engineering-adapter.js");
const builder=index.match(/<!-- ================= BUILDER \/ WIZARD ================= -->([\s\S]*?)<!-- ================= CANVAS EDITOR ================= -->/)?.[1]||"";

test("M3 Builder is a three-zone 407F layout with a fixed 264px vertical stepper",()=>{
  assert.match(builder,/class="d1404Builder"/);
  assert.match(builder,/class="panelD builderStepper"/);
  assert.match(builder,/class="panelD builderForm"/);
  assert.match(builder,/class="panelD builderPreview"/);
  assert.match(css,/grid-template-columns:264px minmax\(420px,560px\) minmax\(420px,1fr\)/);
  assert.doesNotMatch(builder,/wizDots|SAVE DRAFT|PREVIEW CHANGES|GUIDED <em>BUILDER/);
});

test("M3 stepper contains the seven frozen titles and supports free navigation",()=>{
  const titles=[
    "Core Info",
    "Exams",
    "US Clinical Rotations",
    "Work Experience",
    "Research",
    "Personal",
    "Review & finish"
  ];
  for(const title of titles)assert.ok(index.includes(`title:'${title}'`),`missing Builder title: ${title}`);
  assert.match(index,/data-builder-step/);
  assert.match(index,/aria-current="step"/);
  assert.match(index,/complete:'✓',started:'◐',skipped:'—',empty:'○',none:''/);
  assert.match(index,/state\.builder\.step=\+stepButton\.dataset\.builderStep/);
});

test("M3 Core Info preserves frozen field order, validation, and education milestone effect",()=>{
  const markers=[
    'data-core="name"',
    'data-core="school"',
    'data-core="country"',
    'data-core="grad"',
    '<fieldset class="builderField"><legend>Degree',
    'data-core="visa"'
  ];
  let cursor=-1;
  for(const marker of markers){
    const next=index.indexOf(marker);
    assert.ok(next>cursor,`Core Info field order drifted at ${marker}`);
    cursor=next;
  }
  assert.match(index,/placeholder="e\.g\., Amara Osei"/);
  assert.match(index,/data-provider="schools"/);
  assert.match(index,/I haven&apos;t graduated yet/);
  assert.match(index,/US citizen \/ permanent resident/);
  assert.match(index,/Need H-1B/);
  assert.match(index,/Need J-1/);
  assert.match(index,/Prefer not to say/);
  assert.match(index,/target\.textContent=String\(w\[key\]\|\|''\)\.trim\(\)\?'':'Required\.'/);
  assert.match(index,/Enter a month and year, like 'Jun 2023'\./);
  assert.match(index,/id:'education-core'/);
  assert.match(index,/t:'Medical Degree — '\+w\.school/);
  assert.match(index,/canonicalCategory:'education'/);
});

test("M3 builder state, wizard state, and Education survive the 407F persistence seam",()=>{
  assert.match(adapter,/wizard407F:clone\(state\.wiz\|\|\{\}\)/);
  assert.match(adapter,/builder407F:clone\(state\.builder\|\|\{\}\)/);
  assert.match(adapter,/\.\.\.clone\(document\.metadata\?\.wizard407F\|\|\{\}\)/);
  assert.match(adapter,/categoryId:event\.fields\?\.canonicalCategory\|\|/);
  assert.match(adapter,/education:"education"/);
  assert.match(index,/wiz:state\.wiz,builder:state\.builder/);
});

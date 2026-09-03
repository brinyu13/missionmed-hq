import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(relativePath)=>readFileSync(new URL(`../${relativePath}`,import.meta.url),"utf8");
const index=read("web/index.html");
const css=read("web/styles/407f-upgrade.css");
const adapter=read("web/js/407f-engineering-adapter.js");
const builder=index.match(/<!-- ================= BUILDER \/ WIZARD ================= -->([\s\S]*?)<!-- ================= CANVAS EDITOR ================= -->/)?.[1]||"";

test("D1-405 M3 Builder uses a horizontal workflow above the editor and larger preview",()=>{
  assert.match(builder,/class="d1404Builder"/);
  assert.match(builder,/<nav class="panelD builderStepper" aria-label="Builder steps">/);
  assert.match(builder,/class="panelD builderForm"/);
  assert.match(builder,/class="panelD builderPreview" aria-labelledby="builderPreviewTitle"/);
  assert.match(builder,/class="builderPreviewViewport"/);
  assert.match(
    builder,
    /id="builderPreviewToggle"[^>]*data-builder-preview-open[^>]*>OPEN FULL PREVIEW/
  );
  assert.match(css,/grid-template-areas:\s*"variant variant"\s*"steps steps"\s*"form preview"/);
  assert.match(css,/grid-template-columns:minmax\(420px,5fr\) minmax\(560px,7fr\)/);
  assert.match(css,/#builderStepper\{\s*display:grid;\s*grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:1151px\)\{[\s\S]*grid-template-areas:\s*"variant"\s*"steps"\s*"form"\s*"preview"/);
  assert.match(css,/@media\(max-width:1151px\)\{[\s\S]*\.builderStepper\{[\s\S]*overflow-x:auto/);
  assert.doesNotMatch(css,/grid-template-columns:264px/);
  assert.doesNotMatch(css,/grid-template-columns:220px/);
  assert.doesNotMatch(builder,/wizDots|SAVE DRAFT|PREVIEW CHANGES|GUIDED <em>BUILDER/);
});

test("D1-405 M3 stepper contains the seven approved titles and accessible horizontal tab behavior",()=>{
  const titles=[
    "Core Info",
    "Exams",
    "US Clinical Rotations",
    "Work Experience",
    "Research",
    "Personal",
    "Review & Finish"
  ];
  for(const title of titles)assert.ok(index.includes(`title:'${title}'`),`missing Builder title: ${title}`);
  assert.match(index,/setAttribute\('role','tablist'\)/);
  assert.match(index,/setAttribute\('aria-orientation','horizontal'\)/);
  assert.match(index,/role="tab"/);
  assert.match(index,/id="builderStepTab'\+n\+'/);
  assert.match(index,/aria-controls="builderStepPanel"/);
  assert.match(index,/aria-selected="'\+active\+'/);
  assert.match(index,/tabindex="'\+\(active\?'0':'-1'\)\+'/);
  assert.match(index,/data-state="'\+stepState\+'/);
  assert.match(index,/aria-label="Step '\+n\+' of 7,/);
  assert.match(index,/class="builderStepGlyph" aria-hidden="true"/);
  assert.match(builder,/id="builderStepPanel" role="tabpanel"/);
  assert.match(index,/data-builder-step/);
  assert.match(index,/complete:'✓',started:'◐',skipped:'—',empty:'○',none:''/);
  assert.match(index,/moveBuilderStep404\(stepButton\.dataset\.builderStep,\{focusNavigator:true\}\)/);
  assert.match(index,/\['ArrowLeft','ArrowRight','Home','End'\]\.includes\(e\.key\)/);
  assert.match(index,/current===1\?7:current-1/);
  assert.match(index,/current===7\?1:current\+1/);
  assert.match(index,/function revealActiveBuilderStep404\(\)/);
  assert.match(index,/requestAnimationFrame\(revealActiveBuilderStep404\)/);
  assert.match(index,/scroller\.scrollLeft=right-scroller\.clientWidth\+8/);
});

test("M6 Core Info preserves 407F order while adding the normalized school selector and current work authorization",()=>{
  const markers=[
    'data-core="name"',
    '+schoolMarkup',
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
  assert.match(index,/data-school-filter="country"/);
  assert.match(index,/data-school-filter="type"/);
  assert.match(index,/data-school-search/);
  assert.match(index,/placeholder="e\.g\., Amara Osei"/);
  assert.match(index,/data-school-combobox/);
  assert.match(index,/typed text alone is not saved as a verified school/);
  assert.match(index,/data-school-not-listed/);
  assert.match(index,/UNVERIFIED · NORMALIZATION QUEUED/);
  assert.match(index,/I haven&apos;t graduated yet/);
  assert.match(index,/U\.S\. Citizen/);
  assert.match(index,/Permanent Resident \/ Green Card/);
  assert.match(index,/Employment Authorization Document/);
  assert.match(index,/Which residency visa types are you open to\?/);
  assert.match(index,/Choose a listed school or use “School not listed\.”/);
  assert.match(index,/Enter a month and year, like 'Jun 2023'\./);
  assert.match(index,/id:'education-core'/);
  assert.match(index,/t:'Medical Degree — '\+w\.school/);
  assert.match(index,/canonicalCategory:'education'/);
  assert.match(index,/canonicalSchoolId:w\.canonicalSchoolId\|\|''/);
});

test("M3 builder state, wizard state, and Education survive the 407F persistence seam",()=>{
  assert.match(adapter,/wizard407F:clone\(state\.wiz\|\|\{\}\)/);
  assert.match(adapter,/builder407F:clone\(state\.builder\|\|\{\}\)/);
  assert.match(adapter,/\.\.\.clone\(document\.metadata\?\.wizard407F\|\|\{\}\)/);
  assert.match(adapter,/categoryId:event\.fields\?\.canonicalCategory\|\|/);
  assert.match(adapter,/education:"education"/);
  assert.match(index,/wiz:state\.wiz,builder:state\.builder/);
});

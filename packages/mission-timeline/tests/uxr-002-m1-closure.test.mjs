import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

import {monthFieldMarkup} from "../web/js/uxr-002/month-field.js";
import {TimelineStore} from "../web/js/uxr-002/store.js";

const FULL_ENTITLEMENT=Object.freeze({
  schemaVersion:"d1-405.timeline-entitlement.1",
  access:"FULL",verified:true,canRead:true,canCreate:true,canMutate:true,
  canExport:true,reason:"Verified test entitlement."
});

const read=(relativePath)=>readFileSync(new URL(`../${relativePath}`,import.meta.url),"utf8");
const styles=read("web/styles/uxr-002.css");
const appSource=read("web/js/uxr-002/app.js");
const overlaySource=read("web/js/uxr-002/overlays.js");

function cssRule(selector){
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const match=styles.match(new RegExp(`(?:^|\\n)${escaped}\\{([^}]*)\\}`));
  assert.ok(match,`missing or unterminated CSS rule: ${selector}`);
  return match[1];
}

function cssDeclaration(rule,property){
  const escaped=property.replaceAll("-","\\-");
  const match=rule.match(new RegExp(`(?:^|;)${escaped}:([^;]+)`));
  assert.ok(match,`missing ${property} declaration in: ${rule}`);
  return match[1].trim();
}

function cssVariable(name){
  const match=styles.match(new RegExp(`--${name}:([^;]+);`));
  assert.ok(match,`missing --${name} CSS variable`);
  return match[1].trim();
}

class MemoryAdapter{
  constructor(){
    this.kind="m1-memory";
    this.stores=new Map();
    this.atomicBatches=[];
  }

  bucket(name){
    if(!this.stores.has(name))this.stores.set(name,new Map());
    return this.stores.get(name);
  }

  async open(){return this;}

  async get(store,key){
    const value=this.bucket(store).get(key);
    return value===undefined?null:structuredClone(value);
  }

  async put(store,value,key=value?.id){
    const record=structuredClone(value);
    this.bucket(store).set(key,record);
    return structuredClone(record);
  }

  async list(store,predicate=()=>true){
    return[...this.bucket(store).values()].map((value)=>structuredClone(value)).filter(predicate);
  }

  async atomicPut(entries){
    const batch=entries.map((entry)=>structuredClone(entry));
    this.atomicBatches.push(batch);
    for(const {store,key,value} of batch)this.bucket(store).set(key,structuredClone(value));
  }
}

test("§3.1 type scale and all four button variants remain frozen",()=>{
  const body=cssRule("body");
  assert.equal(cssDeclaration(body,"font-size"),"14px");
  assert.equal(cssDeclaration(body,"line-height"),"1.5");
  assert.equal(cssDeclaration(body,"font-weight"),"450");

  const roles=[
    ["h1",{fontSize:"28px",lineHeight:"34px",fontWeight:"700"}],
    ["h2",{fontSize:"18px",lineHeight:"24px",fontWeight:"650"}],
    ["h3",{fontSize:"15px",lineHeight:"20px",fontWeight:"600"}],
    [".home-build h1",{fontSize:"34px",lineHeight:"40px",fontWeight:"700"}],
    [".screen-purpose",{fontSize:"13px",lineHeight:"19px"}],
    [".micro-label",{fontSize:"11px",lineHeight:"14px",fontWeight:"650"}]
  ];
  for(const [selector,expected] of roles){
    const rule=cssRule(selector);
    for(const [property,value] of Object.entries(expected)){
      const cssProperty=property.replace(/[A-Z]/g,(letter)=>`-${letter.toLowerCase()}`);
      assert.equal(cssDeclaration(rule,cssProperty),value,`${selector} ${cssProperty}`);
    }
  }
  assert.equal(cssDeclaration(cssRule(".micro-label"),"letter-spacing"),".08em");

  const button=cssRule(".button");
  assert.equal(cssDeclaration(button,"min-height"),"40px");
  assert.equal(cssDeclaration(button,"font-size"),"14px");
  assert.equal(cssDeclaration(button,"font-weight"),"600");
  assert.equal(cssDeclaration(cssRule(".button.compact"),"height"),"32px");

  assert.deepEqual(
    {
      background:cssDeclaration(cssRule(".button.primary"),"background"),
      color:cssDeclaration(cssRule(".button.primary"),"color")
    },
    {background:"var(--accent-gold)",color:"var(--accent-gold-text)"}
  );
  assert.deepEqual(
    {
      background:cssDeclaration(cssRule(".button.secondary"),"background"),
      color:cssDeclaration(cssRule(".button.secondary"),"color"),
      border:cssDeclaration(cssRule(".button.secondary"),"border-color")
    },
    {
      background:"var(--shell-surface)",
      color:"var(--ink-primary)",
      border:"var(--shell-border-strong)"
    }
  );
  assert.deepEqual(
    {
      background:cssDeclaration(cssRule(".button.tertiary"),"background"),
      color:cssDeclaration(cssRule(".button.tertiary"),"color"),
      border:cssDeclaration(cssRule(".button.tertiary"),"border-color")
    },
    {background:"transparent",color:"var(--ink-secondary)",border:"transparent"}
  );
  assert.deepEqual(
    {
      background:cssDeclaration(cssRule(".button.destructive"),"background"),
      color:cssDeclaration(cssRule(".button.destructive"),"color"),
      border:cssDeclaration(cssRule(".button.destructive"),"border-color")
    },
    {background:"var(--shell-surface)",color:"var(--danger)",border:"var(--danger)"}
  );
});

test("§2.1 rail uses the exact dimensions, 250ms hover delay, and explicit pin seam",()=>{
  assert.equal(cssVariable("rail-collapsed"),"72px");
  assert.equal(cssVariable("rail-expanded"),"220px");

  const rail=cssRule(".rail-nav");
  assert.equal(cssDeclaration(rail,"width"),"var(--rail-collapsed)");
  assert.equal(cssDeclaration(rail,"transition"),"width var(--motion-layout)");
  assert.equal(cssDeclaration(rail,"transition-delay"),"0ms");

  const hover=cssRule(".rail-nav:hover");
  assert.equal(cssDeclaration(hover,"width"),"var(--rail-expanded)");
  assert.equal(cssDeclaration(hover,"transition-delay"),"250ms");

  const pinned=cssRule(".rail-pinned .rail-nav");
  assert.equal(cssDeclaration(pinned,"width"),"var(--rail-expanded)");
  assert.equal(cssDeclaration(pinned,"transition-delay"),"0ms");
  assert.equal(cssDeclaration(cssRule(".rail-pinned .screen-host"),"padding-left"),"var(--rail-expanded)");

  assert.match(appSource,/class="rail-pin icon-button" data-rail-pin/);
  assert.match(appSource,/aria-pressed="\$\{String\(\!\!pinned\)\}"/);
  assert.match(
    appSource,
    /document\.preferences\.railPinned=!document\.preferences\.railPinned;},\{history:false,material:false\}/
  );
});

test("§2.1 pinned-rail preference persists durably without polluting undo history",async()=>{
  const adapter=new MemoryAdapter();
  const clock=()=>new Date("2032-06-01T12:00:00.000Z");
  const store=new TimelineStore({adapter,clock,entitlement:FULL_ENTITLEMENT});
  await store.initialize();

  const changed=store.mutate(
    "Navigation preference",
    (document)=>{document.preferences.railPinned=true;},
    {history:false,material:false}
  );
  assert.equal(changed,true);
  assert.deepEqual(store.historyStatus(),{
    undoCount:0,
    redoCount:0,
    canUndo:false,
    canRedo:false,
    undoLabel:null,
    redoLabel:null
  });
  await store.saveNow("M1_RAIL_PREFERENCE");

  const restored=new TimelineStore({adapter,clock,entitlement:FULL_ENTITLEMENT});
  const result=await restored.initialize();
  assert.equal(result.restored,true);
  assert.equal(restored.document.preferences.railPinned,true);
  assert.equal(
    adapter.atomicBatches.at(-1)[0].value.reason,
    "M1_RAIL_PREFERENCE"
  );
});

test("§3.1 toast contract is bottom-centered, single-line, actionable, 3.5s, and capped at two",()=>{
  assert.match(
    overlaySource,
    /showToast\(message,\{actionLabel=null,onAction=null,tone="neutral",duration=3500\}=\{\}\)/
  );
  assert.match(overlaySource,/while\(region\.children\.length>=2\)region\.firstElementChild\.remove\(\)/);
  assert.match(overlaySource,/class="toast-action"/);
  assert.match(overlaySource,/timers\.set\(id,setTimeout\(remove,duration\)\)/);

  const region=cssRule(".toast-region");
  assert.equal(cssDeclaration(region,"position"),"fixed");
  assert.equal(cssDeclaration(region,"left"),"50%");
  assert.equal(cssDeclaration(region,"bottom"),"24px");
  assert.equal(cssDeclaration(region,"transform"),"translateX(-50%)");

  const content=cssRule(".toast>span");
  assert.equal(cssDeclaration(content,"white-space"),"nowrap");
  assert.equal(cssDeclaration(content,"overflow"),"hidden");
  assert.equal(cssDeclaration(content,"text-overflow"),"ellipsis");
});

test("§4.12 MonthField owns an opaque elevated layer and the frozen picker semantics",()=>{
  const markup=monthFieldMarkup({
    id:"graduation-date",
    label:"Graduation date",
    value:"2023-06",
    required:true
  });
  assert.match(markup,/role="dialog" aria-label="Choose month and year" hidden/);
  assert.match(markup,/class="month-grid" role="grid"/);
  assert.equal((markup.match(/role="gridcell"/g)||[]).length,12);
  assert.match(markup,/aria-expanded="false"/);
  assert.match(markup,/aria-selected="true">Jun<\/button>/);

  assert.equal(cssDeclaration(cssRule(".month-field"),"position"),"relative");
  assert.equal(cssDeclaration(cssRule(".month-field:focus-within"),"z-index"),"80");
  const popover=cssRule(".month-popover");
  assert.equal(cssDeclaration(popover,"position"),"absolute");
  assert.equal(cssDeclaration(popover,"z-index"),"70");
  assert.equal(cssDeclaration(popover,"background"),"var(--shell-surface)");
  assert.equal(cssVariable("shell-surface"),"#FFFFFF");
  assert.equal(cssDeclaration(popover,"box-shadow"),"var(--card-shadow)");
  assert.equal(cssDeclaration(popover,"animation"),"popover-in var(--motion-popover)");
});

test("§3.1 focus and §11.4 reduced-motion protections are candidate-bound",()=>{
  assert.equal(cssVariable("focus-ring"),"#2F6FED");
  const focus=cssRule('a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:not([tabindex="-1"]):focus-visible');
  assert.equal(cssDeclaration(focus,"outline"),"2px solid var(--focus-ring)");
  assert.equal(cssDeclaration(focus,"outline-offset"),"2px");

  const reduced=cssRule("@media(prefers-reduced-motion:reduce)");
  assert.match(reduced,/\*,\*::before,\*::after\{/);
  if(reduced.includes("animation:none!important")){
    assert.match(reduced,/animation:none!important/);
  }else{
    assert.match(reduced,/animation-duration:\.01ms!important/);
    assert.match(reduced,/animation-iteration-count:1!important/);
  }
  assert.match(reduced,/(?:transition-duration:\.01ms!important|transition:none!important)/);
  assert.match(reduced,/transition-delay:0ms!important/);
  assert.doesNotMatch(
    cssRule("a,button,input,select,textarea,[tabindex]:not([tabindex=\"-1\"])"),
    /!important/,
    "the neutral outline reset must not override :focus-visible"
  );
});

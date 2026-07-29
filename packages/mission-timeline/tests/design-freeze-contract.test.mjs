import assert from "node:assert/strict";
import {existsSync,readFileSync,statSync} from "node:fs";
import {fileURLToPath} from "node:url";
import test from "node:test";

import {
  AUTOSAVE_DELAY,
  BUILDER_STEPS,
  HISTORY_LIMIT,
  HOME_COPY,
  NAV_ITEMS
} from "../web/js/uxr-002/constants.js";

const packageRoot=fileURLToPath(new URL("../",import.meta.url));
const read=(relativePath)=>readFileSync(new URL(`../${relativePath}`,import.meta.url),"utf8");

const entrySource=read("web/js/app.js");
const appSource=read("web/js/uxr-002/app.js");
const homeSource=read("web/js/uxr-002/home.js");
const storeSource=read("web/js/uxr-002/store.js");
const iconSource=read("web/js/uxr-002/icons.js");
const indexHtml=read("web/index.html");
const styleEntry=read("web/styles.css");
const styles=read("web/styles/uxr-002.css");
const contrastAddendum=read("docs/D1-UXR-002-CONTRAST-ADDENDUM-001.md");
const microLabelContrastAddendum=read("docs/D1-UXR-002-CONTRAST-ADDENDUM-002.md");
const implementationAuthorityAddendum=read("docs/D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001.md");
const executionAmendment=read("docs/D1-UXR-002-EXECUTION-AMENDMENT-001.md");
const completionDirective=read("docs/D1-UXR-002-AUTONOMOUS-COMPLETION-DIRECTIVE-001.md");
const d1404Authority=read("docs/D1-404-AUTHORITY.md");

function cssRule(selector){
  const marker=`${selector}{`;
  const start=styles.indexOf(marker);
  assert.notEqual(start,-1,`missing CSS rule: ${selector}`);
  const end=styles.indexOf("}",start+marker.length);
  assert.notEqual(end,-1,`unterminated CSS rule: ${selector}`);
  return styles.slice(start+marker.length,end);
}

function cssDeclaration(rule,property){
  const match=rule.match(new RegExp(`(?:^|;)${property.replaceAll("-","\\-")}:([^;]+)`));
  assert.ok(match,`missing ${property} declaration in: ${rule}`);
  return match[1].trim();
}

function cssVariable(name){
  const match=styles.match(new RegExp(`--${name}:([^;]+);`));
  assert.ok(match,`missing --${name} CSS variable`);
  return match[1].trim().toUpperCase();
}

function resolveCssColor(value){
  const variable=value.match(/^var\(--([a-z0-9-]+)\)$/i);
  return (variable?cssVariable(variable[1]):value).toUpperCase();
}

function relativeLuminance(hex){
  assert.match(hex,/^#[0-9A-F]{6}$/i,`invalid hex color: ${hex}`);
  const channels=hex.slice(1).match(/../g).map((value)=>Number.parseInt(value,16)/255);
  const linear=channels.map((value)=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return 0.2126*linear[0]+0.7152*linear[1]+0.0722*linear[2];
}

function contrastRatio(first,second){
  const a=relativeLuminance(first);
  const b=relativeLuminance(second);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

const rounded=(value,places=4)=>Number(value.toFixed(places));

test("D1-UXR-002 shell exposes exactly the four frozen navigation items in order",()=>{
  assert.deepEqual(
    NAV_ITEMS.map(({id,label})=>({id,label})),
    [
      {id:"home",label:"Home"},
      {id:"builder",label:"Builder"},
      {id:"canvas",label:"Canvas"},
      {id:"export",label:"Export"}
    ]
  );
  assert.equal(NAV_ITEMS.length,4);
  assert.match(appSource,/NAV_ITEMS\.map\(\(item\)=>/);
  assert.match(appSource,/<nav class="rail-nav" aria-label="Timeline Builder">/);
});

test("Home authority copy is exact and the three frozen regions consume the registry",()=>{
  assert.deepEqual(HOME_COPY,{
    heading:"Turn your medical journey into an interview-ready timeline.",
    subline:"Answer guided questions about your school, exams, rotations, work, and research. Timeline Builder draws the Keynote-style timeline for you — no design work.",
    strip:"1 · ADD YOUR JOURNEY   2 · REFINE ON THE CANVAS   3 · EXPORT FOR INTERVIEWS",
    intakeTitle:"Start from your CV or MyERAS",
    intakeBody:"Upload your CV or MyERAS export. We'll read it, suggest timeline events, and you approve each one before it appears.",
    assurance:"Nothing appears on your timeline until you approve it."
  });

  for(const key of Object.keys(HOME_COPY)){
    assert.match(homeSource,new RegExp(`HOME_COPY\\.${key}\\b`),`Home must render HOME_COPY.${key}`);
  }
  assert.match(homeSource,/class="card home-build"/);
  assert.match(homeSource,/class="card home-intake"/);
  assert.match(homeSource,/class="card home-preview"/);
  assert.match(homeSource,/>Drop a PDF here, or browse</);
  assert.match(homeSource,/>CV · MyERAS PDF · résumé</);
  assert.match(homeSource,/<h3>This is what you're building\.<\/h3>/);
  assert.match(homeSource,/<p>A one-page visual story an interviewer can read at a glance\.<\/p>/);
  assert.match(homeSource,/>Use the guided builder →</);
});

test("Builder has exactly seven frozen steps, titles, purposes, and order",()=>{
  assert.deepEqual(BUILDER_STEPS,[
    {id:"core",title:"Core Info",purpose:"Who you are and where you trained."},
    {id:"exams",title:"Exams",purpose:"Your exam story — scores and results first, dates second."},
    {id:"clinical",title:"US Clinical Rotations",purpose:"One rotation at a time. We'll fill in what we can."},
    {id:"work",title:"Work Experience",purpose:"Clinical or not, US or abroad — work belongs on the story."},
    {id:"research",title:"Research",purpose:"Projects, posters, and papers — with your author position."},
    {id:"personal",title:"Personal",purpose:"The life behind the CV — moves, family, service, anything that shaped the journey."},
    {id:"review",title:"Review & finish",purpose:"Everything in one place. Fix anything, then open your canvas."}
  ]);
  assert.equal(BUILDER_STEPS.length,7);
  assert.match(appSource,/BUILDER_STEPS\.map\(\(item,index\)=>/);
  assert.match(appSource,/document\.builder\.step===7/);
  assert.match(appSource,/Math\.min\(7,document\.builder\.step\+1\)/);
});

test("autosave and bounded undo history use the frozen constants",()=>{
  assert.equal(AUTOSAVE_DELAY,800);
  assert.equal(HISTORY_LIMIT,50);
  assert.match(storeSource,/setTimeout\(\(\)=>this\.saveNow\("AUTOSAVE"\)\.catch\(\(\)=>\{\}\),AUTOSAVE_DELAY\)/);
  assert.match(storeSource,/if\(this\.undoStack\.length>HISTORY_LIMIT\)this\.undoStack\.shift\(\)/);
});

test("Founder contrast addendum is bound to the candidate and its calculations reproduce",()=>{
  const gold=cssVariable("accent-gold");
  const goldText=cssVariable("accent-gold-text");

  assert.equal(gold,"#B98A2E");
  assert.equal(goldText,"#191C21");
  assert.equal(rounded(contrastRatio("#FFFFFF",gold)),3.1168);
  assert.equal(rounded(contrastRatio(goldText,gold)),5.4805);
  assert.equal(rounded(contrastRatio("#FFFFFF","#A67A26")),3.8651);
  assert.ok(contrastRatio(goldText,gold)>=4.5,"approved 14px gold text must pass WCAG 2.2 AA");
  assert.ok(contrastRatio("#FFFFFF",gold)<4.5,"white on MissionMed gold must remain prohibited for normal text");

  assert.match(contrastAddendum,/^# D1-UXR-002-CONTRAST-ADDENDUM-001$/m);
  assert.match(contrastAddendum,/\| Status \| \*\*APPROVED\*\* \|/);
  assert.match(contrastAddendum,/\| `#FFFFFF` on `#B98A2E` \|[^|\n]+\| 3\.1168:1 — FAIL for normal text \|/);
  assert.match(contrastAddendum,/\| `#191C21` on `#B98A2E` \|[^|\n]+\| 5\.4805:1 — PASS \|/);
  assert.match(contrastAddendum,/\| `#FFFFFF` on hover `#A67A26` \|[^|\n]+\| 3\.8651:1 — FAIL for normal text \|/);
});

test("gold button text and icons meet state-bound contrast; borders and focus are explicit",()=>{
  const selectors={
    default:".button.primary",
    hover:".button.primary:hover:not(:disabled)",
    active:'.button.primary:active:not(:disabled),.button.primary[aria-pressed="true"],.button.primary.selected',
    disabled:".button.primary:disabled"
  };
  const statePairs={};

  for(const [state,selector] of Object.entries(selectors)){
    const rule=cssRule(selector);
    statePairs[state]={
      background:resolveCssColor(cssDeclaration(rule,"background")),
      text:resolveCssColor(cssDeclaration(rule,"color")),
      border:resolveCssColor(cssDeclaration(rule,"border-color"))
    };
  }

  assert.deepEqual(
    {background:statePairs.default.background,text:statePairs.default.text},
    {background:"#B98A2E",text:"#191C21"}
  );

  const textFailures=[];
  for(const state of ["default","hover","active"]){
    const pair=statePairs[state];
    const ratio=contrastRatio(pair.text,pair.background);
    if(ratio<4.5)textFailures.push(`${state} ${pair.text}/${pair.background} ${ratio.toFixed(4)}:1`);
  }
  assert.deepEqual(textFailures,[],"normal text/icon contrast failures");

  assert.equal(
    contrastRatio(statePairs.active.text,statePairs.active.background)>=4.5,
    true,
    "selected state shares the active rule and must pass normal text/icon contrast"
  );
  assert.ok(
    contrastRatio(statePairs.disabled.text,statePairs.disabled.background)>=3,
    "disabled-state colors must retain independently measured legibility"
  );

  for(const [state,pair] of Object.entries(statePairs)){
    assert.notEqual(pair.border,pair.background,`${state} border must be independently specified`);
  }
  assert.match(iconSource,/stroke="currentColor"/,"icons must inherit the verified state text color");

  const focusRule=cssRule(".button.primary:focus-visible");
  const focus=cssVariable("focus-ring");
  assert.equal(cssDeclaration(focusRule,"outline-color"),"var(--focus-ring)");
  assert.match(focusRule,/box-shadow:0 0 0 1px var\(--shell-surface\)/);
  assert.ok(contrastRatio(focus,"#FFFFFF")>=3,"focus indicator must contrast with the adjacent shell surface");
});

test("Founder micro-label addendum preserves tertiary ink and routes 11px text to secondary ink",()=>{
  const tertiary=cssVariable("ink-tertiary");
  const secondary=cssVariable("ink-secondary");
  assert.equal(tertiary,"#8A9099");
  assert.equal(secondary,"#565D66");
  assert.equal(rounded(contrastRatio(tertiary,"#FFFFFF")),3.216);
  assert.equal(rounded(contrastRatio(tertiary,"#F7F6F3")),2.9757);
  assert.equal(rounded(contrastRatio(secondary,"#FFFFFF")),6.6597);
  assert.equal(rounded(contrastRatio(secondary,"#F7F6F3")),6.1622);
  for(const selector of [".micro-label",".journey-strip"]){
    const rule=cssRule(selector);
    assert.equal(cssDeclaration(rule,"font-size"),"11px");
    assert.equal(cssDeclaration(rule,"font-weight"),"650");
    assert.equal(resolveCssColor(cssDeclaration(rule,"color")),"#565D66");
  }
  assert.doesNotMatch(styles,/color:var\(--ink-tertiary\)/,"tertiary ink is preserved for non-text/decorative use only");
  assert.match(microLabelContrastAddendum,/^# D1-UXR-002-CONTRAST-ADDENDUM-002$/m);
  assert.match(microLabelContrastAddendum,/\| Status \| \*\*APPROVED\*\* \|/);
  assert.match(microLabelContrastAddendum,/\| `#565D66` on `#FFFFFF` \| 6\.6597:1 \| PASS \|/);
  assert.match(microLabelContrastAddendum,/\| `#565D66` on `#F7F6F3` \| 6\.1622:1 \| PASS \|/);
});

test("Founder implementation authority addendum delegates only non-material engineering adjustments",()=>{
  assert.match(implementationAuthorityAddendum,/^# D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001$/m);
  assert.match(implementationAuthorityAddendum,/\| Status \| \*\*APPROVED — EFFECTIVE IMMEDIATELY\*\* \|/);
  assert.match(implementationAuthorityAddendum,/adaptive-timeline algorithm changes/);
  assert.match(appSource,/implementationAuthority:"D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001"/);
});

test("Founder execution amendment delegates autonomous specialist delivery without changing product authority",()=>{
  assert.match(executionAmendment,/^# D1-UXR-002-EXECUTION-AMENDMENT-001$/m);
  assert.match(executionAmendment,/f5d29cf7a8b0098fa11f9c4c2fff847c0d3944e394094501f5268cdc0a24dcc5/);
  assert.match(executionAmendment,/all 14 milestones, all 27 binary acceptance criteria/);
  assert.match(executionAmendment,/adaptive timeline algorithm/);
  assert.match(executionAmendment,/no-commit, no-push, no-deploy/);
  assert.doesNotMatch(executionAmendment,/modifies? the Design Freeze/i);
  assert.match(appSource,/executionAuthority:"D1-UXR-002-EXECUTION-AMENDMENT-001"/);
});

test("Founder completion directive requires implementation through the truthful release boundary",()=>{
  assert.match(completionDirective,/^# D1-UXR-002-AUTONOMOUS-COMPLETION-DIRECTIVE-001$/m);
  assert.match(completionDirective,/a78a1ece0f0f2f67c599e6f8c65f8d164fc232f575a66c3fda23040608cdb0b2/);
  assert.match(completionDirective,/all 14 frozen milestones and all 27 binary acceptance criteria/);
  assert.match(completionDirective,/StoryForge evidence/);
  assert.match(completionDirective,/RELEASE_DECISION_READY/);
  assert.match(appSource,/completionAuthority:"D1-UXR-002-AUTONOMOUS-COMPLETION-DIRECTIVE-001"/);
});

test("the retained D1-UXR entry remains isolated and inactive",()=>{
  const importSpecifiers=[...entrySource.matchAll(/^\s*import\s+[^"']*["']([^"']+)["'];?\s*$/gm)].map((match)=>match[1]);
  assert.deepEqual(importSpecifiers,["./uxr-002/app.js"]);
  assert.match(entrySource,/bootTimelineBuilder\(\)\.catch/);
  assert.doesNotMatch(entrySource,/(?:410|413|legacy|prototype|release-candidate)/i);
  assert.doesNotMatch(indexHtml,/src=["']\.\/js\/app\.js["']/);
  assert.doesNotMatch(indexHtml,/href=["']\.\/styles\.css["']/);

  const uxrImports=[...appSource.matchAll(/^\s*import\s+[^"']*["']([^"']+)["'];?\s*$/gm)].map((match)=>match[1]);
  assert.ok(uxrImports.length>0);
  assert.ok(
    uxrImports.every((specifier)=>specifier.startsWith("./")),
    `UXR app must use only its local experience seams: ${uxrImports.join(", ")}`
  );
});

test("Advisor invitation routes open the role-scoped local session without adding a rail destination",()=>{
  assert.match(appSource,/advisorSessionRoute/);
  assert.match(appSource,/isActiveAdvisorSession/);
  assert.match(appSource,/window\.location\.hash/);
  assert.match(appSource,/window\.addEventListener\("hashchange",syncLocationRoute\)/);
  assert.match(appSource,/window\.removeEventListener\("hashchange",syncLocationRoute\)/);
  assert.doesNotMatch(
    appSource,
    /NAV_ITEMS\.push\([^)]*advisor|NAV_ITEMS\s*=\s*[^;]*advisor/i
  );
});

test("D1-404 upgrades canonical 407F in place and records its authority",()=>{
  assert.match(indexHtml,/^<!doctype html>/i);
  assert.match(indexHtml,/<html lang="en">/);
  assert.match(indexHtml,/<meta charset="UTF-8">/);
  assert.match(indexHtml,/<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.match(indexHtml,/<title>MISSION TIMELINE BUILDER · SEASON ONE · TIMELINE OPS · 407F DEFINITIVE PROTOTYPE<\/title>/);
  assert.match(indexHtml,/--bg:#0b0e14;\s*--bg2:#101623;\s*--card:#141b2b;/);
  assert.match(indexHtml,/TIMELINE<b>\/\/S1<\/b>/);
  assert.match(indexHtml,/<nav id="rail" aria-label="Timeline Builder">/);
  assert.match(indexHtml,/window\.D1_407F_TEST=/);
  assert.match(indexHtml,/<link rel="stylesheet" href="\.\/styles\/407f-upgrade\.css">/);
  assert.match(indexHtml,/<script type="module" src="\.\/js\/407f-engineering-adapter\.js"><\/script>/);
  assert.doesNotMatch(indexHtml,/src=["']\.\/js\/app\.js["']/);
  assert.doesNotMatch(indexHtml,/href=["']\.\/styles\.css["']/);

  assert.match(d1404Authority,/^# D1-404 — 407F Upgrade and Production Megarun$/m);
  assert.match(d1404Authority,/ACTIVE — SUPERSEDES WHITE UXR RUNTIME ACTIVATION/);
  assert.match(d1404Authority,/b318e9da82a45c187725a6439fa042e0cab54af4973a5d5c7fdb6b5974c63db4/);
  assert.match(d1404Authority,/23e0f5d420b69cd90da3f04b30e5752183aff41c737860ec30fc4ccbb87beb6b/);
  assert.match(d1404Authority,/f089f62f291a757393187c0c3fd400541a1514479b2ba074f37f070d389e6552/);

  assert.equal(styleEntry.trim(),'@import url("./styles/uxr-002.css");');
  assert.equal((styles.match(/@font-face\{/g)||[]).length,4);
  assert.doesNotMatch(styles,/url\(\s*["']?https?:\/\//i);

  const fonts=[
    ["Inter","inter-latin-wght-normal.woff2"],
    ["Inter","inter-latin-ext-wght-normal.woff2"],
    ["Nunito","nunito-latin-wght-normal.woff2"],
    ["Nunito","nunito-latin-ext-wght-normal.woff2"]
  ];
  for(const [family,file] of fonts){
    assert.match(styles,new RegExp(`font-family:"${family}"[^}]+url\\("\\.\\./assets/fonts/${file.replaceAll(".","\\.")}"\\)`));
    const path=`${packageRoot}web/assets/fonts/${file}`;
    assert.equal(existsSync(path),true,`missing bundled font: ${file}`);
    assert.ok(statSync(path).size>1_000,`bundled font is unexpectedly small: ${file}`);
  }
  assert.match(styles,/font-family:"Inter",system-ui/);
});

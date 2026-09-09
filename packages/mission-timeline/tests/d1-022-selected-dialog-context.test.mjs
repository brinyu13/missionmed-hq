import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {selectedSubjectForDocument022,attachSelectedSubjectDialog022} from '../web/js/production/selected-subject-context-022.js';

function fixture(){
  const document={id:'document-a',studentOwnerId:'student-a',studentProfile:{fullName:'Untrusted document name'},events:[{id:'event-a',title:'Source fact'}]};
  const identity={principalId:'admin-a',role:'PROGRAM_ADMIN',adminWorkspace:true};
  const runtime={identity:{...identity},authClient:{bootstrapState:identity,locked:false},subject:{principalId:'student-a',documentId:'document-a',displayName:'Timeline 022 Synthetic Student A',canEdit:false}};
  return{document,runtime};
}
class Element{
  constructor(tag,ownerDocument){this.tagName=tag;this.ownerDocument=ownerDocument;this.attributes=new Map();this.children=[];this.textContent='';}
  setAttribute(k,v){this.attributes.set(k,String(v));}getAttribute(k){return this.attributes.get(k)||null;}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  prepend(node){node.parent=this;this.children.unshift(node);}
  remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
  querySelector(selector){if(selector==='strong')return this.children.find(x=>x.tagName==='strong');if(selector===':scope > [data-selected-subject-context-022]')return this.children.find(x=>x.attributes.has('data-selected-subject-context-022'))||null;return null;}
}
function dialog(){const document={createElement(tag){return new Element(tag,this);}};return new Element('section',document);}

test('dialog context describes only the exact server-bound selected document, with read-only review supported',()=>{
  const f=fixture(),before=JSON.stringify(f);assert.deepEqual(selectedSubjectForDocument022(f.runtime,f.document),{displayName:'Timeline 022 Synthetic Student A',documentId:'document-a',studentPrincipalId:'student-a'});assert.equal(JSON.stringify(f),before);
  for(const mutate of [
    f=>{f.runtime.authClient.locked=true;},f=>{f.runtime.authClient.bootstrapState.role='STUDENT';},
    f=>{f.runtime.authClient.bootstrapState.adminWorkspace=false;},f=>{delete f.runtime.authClient.bootstrapState.principalId;},
    f=>{f.runtime.authClient.bootstrapState.principalId='admin-b';},f=>{f.runtime.subject=null;},
    f=>{f.runtime.subject.documentId='other-document';},f=>{f.document.studentOwnerId='student-b';},
    f=>{f.runtime.subject.displayName=' ';},f=>{f.runtime.subject.displayName=null;},
    f=>{delete f.document.id;delete f.runtime.subject.documentId;},f=>{f.document.id='';f.runtime.subject.documentId='';},
    f=>{delete f.runtime.authClient;},f=>{f.document=null;}
  ]){const bad=fixture();mutate(bad);assert.equal(selectedSubjectForDocument022(bad.runtime,bad.document),null);}
  assert.equal(selectedSubjectForDocument022(null,f.document),null);
});
test('literal name is an accessible single strip, repeated calls update it, and stale binding removes only its own description',()=>{
  const f=fixture(),host=dialog();host.setAttribute('aria-describedby','existing-description');
  f.runtime.subject.displayName='<img src=x onerror=alert(1)> & Synthetic';
  const strip=attachSelectedSubjectDialog022(host,f);assert.equal(strip.querySelector('strong').textContent,f.runtime.subject.displayName);
  assert.equal(strip.children.length,2);assert.equal(host.children.length,1);assert.equal(host.getAttribute('aria-describedby'),'existing-description '+strip.id);
  f.runtime.subject.displayName='Changed server display name';assert.equal(attachSelectedSubjectDialog022(host,f),strip);assert.equal(host.children.length,1);assert.equal(strip.querySelector('strong').textContent,'Changed server display name');
  f.runtime.authClient.locked=true;assert.equal(attachSelectedSubjectDialog022(host,f),null);assert.equal(host.children.length,0);assert.equal(host.getAttribute('aria-describedby'),'existing-description');
  assert.equal(attachSelectedSubjectDialog022(null,f),null);
});
test('actual common modal entry attaches the bound subject before installing focus handling and leaves the original title untouched',()=>{
  const source=fs.readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  const f=fixture(),host=dialog();host.setAttribute('aria-labelledby','quality-guardian-title');let trapped=0;
  const context={attachSelectedSubjectDialog022,productionRuntime:f.runtime,store:{document:f.document},document:{activeElement:null,querySelector:()=>host,getElementById:()=>null},bridge:{openModal(){}},standardModalOpener:null,standardModalTrap:null,onStandardModalBackdrop:null,standardModalBackgroundInert(){},closeStandardModal(){},installFocusTrap(actual){assert.equal(actual.children[0].querySelector('strong').textContent,'Timeline 022 Synthetic Student A');trapped++;return{destroy(){}};}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  const openStandardModal='),source.indexOf('  const qualityGuardianControls=')),context);
  vm.runInContext('openStandardModal("existing markup", "[data-quality-guardian-dialog]")',context);
  assert.equal(trapped,1);assert.equal(host.getAttribute('aria-labelledby'),'quality-guardian-title');assert.equal(host.children.length,1);
});

for(const [entry,title,role,initialFocus] of [
  ['openCreateSpecialtyVariant','specialtyVariantCreateTitle','dialog',false],
  ['openRenameSpecialtyVariant','specialtyVariantRenameTitle','dialog',false],
  ['openRemoveSpecialtyVariant','specialtyVariantRemoveTitle','alertdialog',true],
  ['openExportThemeDialog','Choose theme','dialog',true]
])test(`actual ${entry} adds selected context before focus handling, preserves dialog semantics and never edits the document`,()=>{
  const source=fs.readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  for(const selected of [true,false]){
    const f=fixture(),before=JSON.stringify(f.document);if(!selected)f.runtime.subject=null;
    let host=null,trapped=0,inert=false;
    const context={attachSelectedSubjectDialog022,productionRuntime:f.runtime,store:{document:f.document,mutate(){throw Error('Opening a dialog must not edit facts');}},document:{activeElement:null,querySelector:selector=>['[data-specialty-variant-dialog]','.export407FThemeDialog'].includes(selector)?host:null,querySelectorAll:()=>[],getElementById:()=>null},bridge:{openModal(markup){host=dialog();for(const key of ['role','aria-modal','aria-labelledby','aria-label','aria-describedby']){const match=markup.match(new RegExp(key+'="([^"<>]*)"'));if(match)host.setAttribute(key,match[1]);}}},specialtyVariantOpener:null,specialtyVariantTrap:null,onSpecialtyVariantBackdrop:null,exportThemeOpener:null,exportThemeTrap:null,onExportThemeBackdrop:null,previewBackgroundInert(value){inert=value;},closeSpecialtyVariantDialog(){},closeExportThemeDialog(){},PINNED_ROTATION_SPECIALTIES:[],normalizeSpecialtyVariants:()=>({variants:[{specialty:{id:'im'}},{specialty:{id:'peds'}}]}),activeSpecialtyVariant:()=>({id:'variant-a',name:'Synthetic specialty'}),escapeMarkup:String,renderThemePicker:()=>'<div class="theme-picker-popover" hidden></div>',installFocusTrap(actual,options){
      assert.equal(actual,host);assert.equal(options.initialFocus,initialFocus);assert.equal(host.getAttribute('role'),role);assert.equal(host.getAttribute('aria-labelledby')||host.getAttribute('aria-label'),title);
      if(selected){assert.equal(host.children.length,1);assert.equal(host.children[0].querySelector('strong').textContent,'Timeline 022 Synthetic Student A');assert.ok(host.getAttribute('aria-describedby').includes(host.children[0].id));}
      else assert.equal(host.children.length,0);
      if(entry==='openRemoveSpecialtyVariant')assert.ok(host.getAttribute('aria-describedby').includes('specialtyVariantRemoveDescription'));
      trapped++;return{destroy(){}};
    }};
    vm.createContext(context);
    if(entry==='openExportThemeDialog')vm.runInContext(source.slice(source.indexOf('  const openExportThemeDialog='),source.indexOf('  const openAdvisorPaperSuggestion=')),context);
    else vm.runInContext(source.slice(source.indexOf('  const activateSpecialtyVariantDialog='),source.indexOf('  const syncBridgeStateFromStore=')),context);
    vm.runInContext(entry+'()',context);assert.equal(trapped,1);assert.equal(inert,true);assert.equal(JSON.stringify(f.document),before);
  }
});

test('actual File Vault source chooser shows selected-document context after its current query without changing file ownership or importing',async()=>{
  const source=fs.readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  for(const selected of [true,false]){
    const f=fixture(),before=JSON.stringify(f.document);if(!selected)f.runtime.subject=null;
    const host=dialog();host.querySelectorAll=()=>[];host.setAttribute('aria-labelledby','file-vault-source-title');
    let trapped=0,rendered=0;const adapter={owner:'actual adapter remains authoritative'},queries=[];
    const context={attachSelectedSubjectDialog022,productionRuntime:f.runtime,store:{document:f.document},fileVaultQuerySequence:0,fileVaultSource:adapter,fileVaultTrap:null,queryFileVaultSource:async(actual,options)=>{assert.equal(actual,adapter);queries.push({...options});return{kind:'read-only owned file query'};},renderFileVaultSourceChooser:model=>{assert.equal(model.kind,'read-only owned file query');rendered++;return'unchanged actual markup seam';},document:{querySelector:selector=>selector==='[data-file-vault-source-dialog]'?host:null,querySelectorAll:()=>[]},bridge:{openModal(){}},closeOwnedModal(){},queueMicrotask,installFocusTrap(actual){assert.equal(actual,host);assert.equal(host.getAttribute('aria-labelledby'),'file-vault-source-title');if(selected)assert.equal(host.children[0].querySelector('strong').textContent,'Timeline 022 Synthetic Student A');else assert.equal(host.children.length,0);trapped++;return{destroy(){}};}};
    vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  const openFileVaultSource='),source.indexOf('  onHomeFileVault=')),context);await vm.runInContext('openFileVaultSource("synthetic CV",2)',context);
    assert.equal(trapped,1);assert.equal(rendered,1);assert.deepEqual(queries,[{query:'synthetic CV',page:2}]);assert.equal(JSON.stringify(f.document),before);
  }
});

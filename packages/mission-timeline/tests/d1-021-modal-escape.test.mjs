import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {installFocusTrap} from '../web/js/uxr-002/responsive.js';

const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
const adapter=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');

function actualModalHarness(){
  const document={listeners:[],activeElement:null,addEventListener(type,fn){if(type==='keydown')this.listeners.push(fn);}};
  const element=(id)=>({id,attributes:new Set(),listeners:new Map(),hidden:false,isConnected:true,
    classList:{values:new Set(),add(value){this.values.add(value);},remove(value){this.values.delete(value);},contains(value){return this.values.has(value);}},
    toggleAttribute(name,active){if(active)this.attributes.add(name);else this.attributes.delete(name);},
    addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);},
    getAttribute(){return null;},focus(){document.activeElement=this;}
  });
  const header=element('HEADER'),rail=element('rail'),main=element('MAIN'),backdrop=element('modalBk'),print=element('printOv'),dialog=element('dialog'),button=element('dialog-close'),opener=element('guardian-opener');
  const nodes={header,rail,main,modalBk:backdrop,printOv:print,dialog};
  document.activeElement=opener;
  document.getElementById=id=>nodes[id]||null;
  document.querySelector=selector=>selector==='[data-quality-guardian-dialog]'?dialog:nodes[selector]||null;
  dialog.querySelectorAll=()=>[button];
  const bridge={openModal(){backdrop.classList.add('on');},closeModal(){backdrop.classList.remove('on');}};
  const context={document,window:{},bridge,api:{},installFocusTrap,$:selector=>nodes[selector.slice(1)]||null,state:{view:'builder'},closeModal:bridge.closeModal,doUndo(){throw new Error('Unexpected history mutation');},standardModalTrap:null,standardModalOpener:null,onStandardModalBackdrop:null,builderPreviewTrap:null,shortcutTrap:null,fileVaultTrap:null,closeBuilderPreview(){throw new Error('Unexpected preview');}};
  vm.createContext(context);
  vm.runInContext(adapter.slice(adapter.indexOf('  const standardModalBackgroundInert='),adapter.indexOf('  const qualityGuardianControls=')),context);
  vm.runInContext(adapter.slice(adapter.indexOf('  const closeOwnedModal='),adapter.indexOf('  const fileVaultSource=resolveFileVaultSourceAdapter(')),context);
  context.window.D1_407F_ENGINEERING=context.api;
  const inlineStart=html.indexOf("document.addEventListener('keydown',e=>{");
  vm.runInContext(html.slice(inlineStart,html.indexOf("$$('#zoomSeg button')",inlineStart)),context);
  const event=(target=opener,defaultPrevented=false)=>({key:'Escape',target,defaultPrevented,preventDefault(){this.defaultPrevented=true;}});
  return {context,document,header,rail,main,backdrop,print,dialog,button,opener,
    open(){vm.runInContext('openStandardModal("fixture", "[data-quality-guardian-dialog]")',context);},
    escape(target=opener,prevented=false){const e=event(target,prevented);for(const fn of [...document.listeners])fn(e);return e;},
    trappedEscape(){const e=event(button);dialog.listeners.get('keydown')(e);for(const fn of [...document.listeners])fn(e);return e;},
    inert(){return [header,rail,main].filter(node=>node.attributes.has('inert')).map(node=>node.id);}
  };
}

test('021 actual inline Escape uses Guardian owner cleanup even when focus is outside the dialog',async()=>{
  const h=actualModalHarness();
  h.open();await Promise.resolve();
  assert.deepEqual(h.inert(),['HEADER','rail','MAIN']);
  // This is the physical failure: removing only the shell hides it while isolation survives.
  h.context.closeModal();
  assert.equal(h.backdrop.classList.contains('on'),false);
  assert.deepEqual(h.inert(),['HEADER','rail','MAIN']);
  h.context.window.D1_407F_ENGINEERING.closeModal();
  for(let repeat=0;repeat<2;repeat++){
    h.open();await Promise.resolve();
    h.document.activeElement=h.opener;
    const event=h.escape();
    assert.equal(event.defaultPrevented,true);
    assert.equal(h.backdrop.classList.contains('on'),false);
    assert.deepEqual(h.inert(),[]);
    assert.equal(h.document.activeElement,h.opener);
    assert.equal(h.dialog.listeners.has('keydown'),false);
    assert.equal(h.backdrop.listeners.has('click'),false);
  }
});

test('021 trapped Escape closes once and consumed child Escape does not close its enclosing modal',async()=>{
  const h=actualModalHarness();
  h.open();await Promise.resolve();
  h.escape(h.button,true);
  assert.equal(h.backdrop.classList.contains('on'),true);
  assert.equal(h.inert().length,3);
  h.trappedEscape();
  assert.equal(h.backdrop.classList.contains('on'),false);
  assert.deepEqual(h.inert(),[]);
  assert.equal(h.document.activeElement,h.opener);
});

test('021 inline Escape retains print priority and the pre-engine legacy fallback',()=>{
  const h=actualModalHarness();
  h.print.classList.add('on');h.backdrop.classList.add('on');
  h.escape();
  assert.equal(h.print.classList.contains('on'),false);
  assert.equal(h.backdrop.classList.contains('on'),true);
  delete h.context.window.D1_407F_ENGINEERING;
  h.escape();
  assert.equal(h.backdrop.classList.contains('on'),false);
});

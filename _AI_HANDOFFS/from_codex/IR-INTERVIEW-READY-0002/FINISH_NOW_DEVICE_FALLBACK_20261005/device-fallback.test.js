const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/account.js','utf8');
function fixture(storage=new Map(),deny=false) {
  const writes=[],reads=[],events={},banner={setAttribute(){},textContent:''},button={dataset:{kit:'online:webcam:basic:ABC'},textContent:''};
  const document={body:{dataset:{}},documentElement:{dataset:{}},createElement:()=>banner,
    querySelector:()=>({insertAdjacentElement(){}}),querySelectorAll:s=>s==='[data-kit]'?[button]:[],
    getElementById:id=>id==='saveStatus'?{textContent:''}:{onclick:null},addEventListener:(k,f)=>events[k]=f};
  let calls=0,routes=0,mode='';
  const context={IRDeviceOnly:true,document,location:{pathname:'/interview-ready/',hash:'#kit'},
    localStorage:{getItem:k=>{reads.push(k);if(deny)throw Error();return storage.get(k)??null;},setItem:(k,v)=>{writes.push([k,v]);if(deny)throw Error();storage.set(k,v);},removeItem:()=>{throw Error('legacy write');}},
    fetch:()=>{throw Error('network');},window:{addEventListener:()=>{throw Error('account lifecycle');}},confirm:()=>true,queueMicrotask:f=>f()};
  vm.createContext(context);vm.runInContext(source+'\nglobalThis.adapter=IRAccount',context);
  const hooks={catalog:{online:[{name:'Webcam',items:[{key:'online:webcam:basic:ABC',name:'CANONICAL',t:'basic'}]}]},checklist:{online:[['First',[['row']]]]},mode:v=>mode=v,render:()=>calls++,runRoute:()=>routes++,wrapRoute:()=>{throw Error('route gate');}};
  context.adapter.attach(hooks);
  return {api:context.adapter,storage,writes,reads,document,banner,button,calls:()=>calls,routes:()=>routes,mode:()=>mode};
}
const f=fixture();assert.equal(f.document.documentElement.dataset.irPersonal,'ready');assert.equal(f.routes(),1);assert.match(f.banner.textContent,/Unsaved/);
f.api.store.set('done',{'online:0:0':true,'SECRET NAME':true});
f.api.store.set('auto',{cam:true,mic:false,env:true,setup:true,SECRET:'PRIVATE'});
f.api.store.set('kit',[{key:'online:webcam:basic:ABC',name:'PRIVATE',image:'SECRET'},{key:'private:SECRET'}]);
f.api.store.set('mode','in-person');f.api.store.set('wardrobe',[{name:'SECRET'}]);
assert.equal(f.storage.size,4);assert(f.writes.every(([k])=>/^mmed-ir-device-v1:(done|auto|kit|mode)$/.test(k)));
assert(!JSON.stringify([...f.storage]).includes('PRIVATE'));assert(!JSON.stringify([...f.storage]).includes('SECRET'));assert(!f.storage.get('mmed-ir-device-v1:auto').includes('setup'));
assert.match(f.banner.textContent,/Saved on this device/);assert.match(f.banner.textContent,/Not saved to an account or synced across devices/);
const reloaded=fixture(f.storage);assert.equal(reloaded.api.store.get('done')['online:0:0'],true);assert.equal(reloaded.mode(),'in-person');assert.equal(reloaded.api.store.get('auto').setup,false);assert.equal(reloaded.api.store.get('kit')[0].name,'CANONICAL');
const denied=fixture(new Map(),true);denied.api.store.set('done',{'online:0:0':true});assert.equal(denied.api.store.get('done')['online:0:0'],true);assert.match(denied.banner.textContent,/Unsaved/);assert.equal(denied.document.body.dataset.irAccountState,'device-unsaved');
const dirty=new Map([['ir:done','SECRET'],['mmed-ir-device-v1:done','{"SECRET":true}'],['mmed-ir-device-v1:auto','not-json'],['mmed-ir-device-v1:kit','["SECRET"]'],['mmed-ir-device-v1:mode','"SECRET"']]);const closed=fixture(dirty);
assert.deepEqual(JSON.parse(JSON.stringify(closed.api.store.get('done'))),{});assert.equal(closed.api.store.get('kit').length,0);assert(closed.reads.every(k=>k.startsWith('mmed-ir-device-v1:')));assert.match(closed.banner.textContent,/Unsaved/);
const accountBase=fs.readFileSync(__dirname+'/../../../../interview-ready/account.js','utf8');const start=source.indexOf('  // Explicit fallback;'),end=source.indexOf('  const context =');assert.equal(source.slice(0,start)+source.slice(end),accountBase);
const build=fs.readFileSync(__dirname+'/build.py','utf8');assert(build.indexOf('const IRDeviceOnly = ')<build.indexOf("+account+'</script></head>')"));assert(build.includes("phase1.get('persistenceMode') == 'device-only'"));assert(build.includes('Device-only fallback cannot claim account readiness'));
const phase=JSON.parse(fs.readFileSync(__dirname+'/phase1.json','utf8'));assert.equal(phase.persistenceMode,'device-only');assert.equal(phase.accountReady,false);assert.equal(phase.accountPersistenceReady,false);assert.equal(phase.releaseState,'public-commerce');
console.log('PASS device-only save/reload/denied/sanitization/public-route/no-network/default-account-byte-identity/build-order/labels');

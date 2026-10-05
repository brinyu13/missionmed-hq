from pathlib import Path
import difflib,hashlib,json
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
branch=r'''  // Explicit fallback; no account context, legacy storage or network is consumed.
  if (typeof IRDeviceOnly !== 'undefined' && IRDeviceOnly === true && location.pathname === '/interview-ready/') {
    const namespace='mmed-ir-device-v1:', keys=new Set(['done','auto','kit','mode']);
    const clone=value=>JSON.parse(JSON.stringify(value));
    let state={done:{},auto:{cam:false,mic:false,env:false},kit:[],mode:'online'}, setup=false;
    let bindings=null, items=new Map(), ids=new Set(), attached=false, saved=false, banner=null;
    const notice=()=>saved?'Saved on this device. Not saved to an account or synced across devices.':'Unsaved on this device. Not saved to an account or synced across devices.';
    function show() {
      if (banner) banner.textContent=notice();
      document.body.dataset.irAccountState=saved?'device-saved':'device-unsaved';
      const live=document.getElementById('saveStatus'); if(live) live.textContent=notice();
      document.querySelectorAll('[data-kit]').forEach(button=>{
        if(state.kit.includes(button.dataset.kit)) button.textContent=saved?'Saved on this device':'In kit · unsaved';
      });
    }
    function clean(key,value) {
      if(key==='done') return Object.fromEntries(Object.entries(value && typeof value==='object' && !Array.isArray(value)?value:{}).filter(([id,v])=>ids.has(id)&&typeof v==='boolean'));
      if(key==='auto') return Object.fromEntries(['cam','mic','env'].map(k=>[k,value?.[k]===true]));
      if(key==='kit') return Array.isArray(value)?[...new Set(value.filter(k=>typeof k==='string'&&items.has(k)))]:[];
      return ['online','in-person'].includes(value)?value:'online';
    }
    function load() {
      saved=true;
      for(const key of keys) {
        try { const raw=localStorage.getItem(namespace+key); if(raw===null) { saved=false; } else {
          if(raw.length>65536) throw new Error('size');
          const value=JSON.parse(raw); state[key]=clean(key,value);
          if(JSON.stringify(state[key])!==JSON.stringify(value)) saved=false;
        }} catch(_) { saved=false; }
      }
    }
    function persist() {
      saved=true;
      for(const key of keys) { try { localStorage.setItem(namespace+key,JSON.stringify(state[key])); } catch(_) { saved=false; } }
      show(); queueMicrotask(show);
    }
    const store={
      get(key,fallback) {
        if(!keys.has(key)) return fallback;
        if(key==='kit') return state.kit.map(k=>items.get(k)).filter(Boolean).map(i=>({key:i.key,name:i.name,tier:i.t,cat:i.category,group:i.group}));
        if(key==='auto') return {...state.auto,setup};
        return clone(state[key]);
      },
      set(key,value) {
        if(!attached||!keys.has(key)) return;
        if(key==='kit') state.kit=clean(key,Array.isArray(value)?value.map(i=>i?.key):[]);
        else if(key==='auto') { setup=value?.setup===true; state.auto=clean(key,value); }
        else { state[key]=clean(key,value); if(key==='done'&&!Object.keys(state.done).length) { state.auto={cam:false,mic:false,env:false};setup=false; } }
        persist();
      }
    };
    function attach(hooks) {
      bindings=hooks;
      for(const [group,categories] of Object.entries(hooks.catalog)) for(const c of categories) for(const i of c.items) items.set(i.key,{...i,group,category:c.name});
      for(const [mode,phases] of Object.entries(hooks.checklist)) phases.forEach(([,rows],p)=>rows.forEach((_,i)=>ids.add(`${mode}:${p}:${i}`)));
      attached=true;load();hooks.mode(state.mode);
      banner=document.createElement('div');banner.className='editorial-note';banner.setAttribute('role','status');
      document.querySelector('.topbar').insertAdjacentElement('afterend',banner);
      document.querySelectorAll('#page-checklist > .lede,#page-kit > .lede').forEach(p=>p.textContent='Your checklist and kit stay on this device. No account or cross-device sync.');
      document.getElementById('clReset').onclick=()=>{if(confirm('Clear checklist progress on this device?')) {store.set('done',{});hooks.render();}};
      document.documentElement.dataset.irPersonal='ready';hooks.render();show();hooks.runRoute();
      document.addEventListener('click',e=>{if(e.target.closest('[data-kit],[data-remove-kit]')) queueMicrotask(show);});
    }
    return {store,attach,kitLabel:()=>saved?'Saved on this device':'In kit · unsaved'};
  }
'''
files={name:(ROOT/'interview-ready'/name).read_text() for name in ['account.js','build.py','phase1.json','phase1.js']}
new=dict(files)
new['account.js']=files['account.js'].replace('const IRAccount = (() => {\n','const IRAccount = (() => {\n'+branch,1)
new['build.py']=files['build.py'].replace("    phase1 = json.loads(input_data['phase1.json'])\n", "    phase1 = json.loads(input_data['phase1.json'])\n    device_only = phase1.get('persistenceMode') == 'device-only'\n    if device_only and (phase1.get('accountPersistenceReady') is not False or phase1.get('accountReady') is not False):\n        raise ValueError('Device-only fallback cannot claim account readiness')\n",1)
new['build.py']=new['build.py'].replace("'+account+'</script></head>')", "'+'const IRDeviceOnly = '+js(device_only)+';\\n'+account+'</script></head>')",1)
new['build.py']=new['build.py'].replace("'gatewayStorageOwner':'WP self-only _mmed_ir_state_v1',", "'gatewayStorageOwner':'device-only mmed-ir-device-v1' if device_only else 'WP self-only _mmed_ir_state_v1',\n                'persistenceMode':'device-only' if device_only else 'account',\n                'accountReady':False if device_only else phase1.get('accountPersistenceReady', False),",1)
data=json.loads(files['phase1.json']);data.update(releaseState='public-commerce',persistenceMode='device-only',accountReady=False,accountPersistenceReady=False,personalToolsRequireAccount=False)
data['builderImplementation']['accountSource']='device-only fallback; account acceptance deferred'
new['phase1.json']=json.dumps(data,indent=2)+'\n'
old="if (!PHASE1.accountPersistenceReady) {\n  document.querySelectorAll('#page-checklist > .lede,#page-kit > .lede').forEach(p=>p.textContent='Founder preview: progress is saved only on this device. MissionMed account sync is not connected yet.');\n}"
replacement="if (PHASE1.persistenceMode === 'device-only' && location.pathname === '/interview-ready/') {\n  document.querySelectorAll('#page-checklist > .lede,#page-kit > .lede').forEach(p=>p.textContent='Your checklist and kit stay on this device. No account or cross-device sync.');\n}"
assert old in files['phase1.js'];new['phase1.js']=files['phase1.js'].replace(old,replacement,1)
patch=''.join(''.join(difflib.unified_diff(files[name].splitlines(True),new[name].splitlines(True),fromfile='a/interview-ready/'+name,tofile='b/interview-ready/'+name)) for name in files)
(HERE/'device-fallback.patch').write_text(patch)
for name in files:(HERE/name).write_text(new[name])
(HERE/'PREIMAGES.json').write_text(json.dumps({n:hashlib.sha256(v.encode()).hexdigest() for n,v in files.items()},indent=2)+'\n')
print('Prepared four-file patch in artifacts only')

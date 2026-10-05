/* Canonical WP account adapter. Never migrate anonymous progress or persist media. */
const IRAccount = (() => {
  // Explicit fallback; no account context, legacy storage or network is consumed.
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
  const context = /* MMED_IR_ACCOUNT_CONTEXT */ null;
  const acceptedKeys = new Set(/* MMED_IR_KIT_KEYS */ []);
  const personal = new Set(['done','auto','kit','mode']);
  const empty = () => ({revision:0,lastCommandId:'',lastCommandDigest:'',done:{},auto:{cam:false,mic:false,env:false},kit:[],mode:'online'});
  const copy = value => JSON.parse(JSON.stringify(value));
  let authoritative=empty(), view=empty(), pending=[], command=null, sending=false, ready=false, blocked=false;
  let generation=0, hooks=null, items=new Map(), ids=new Set(), banner=null, retry=null, message='';
  let controller=null, volatileSetup=false, phase='loading', conflict=false, flushTimer=null;
  const appURL='/interview-ready/app/';
  const privatePage=!!context && location.pathname===appURL;
  const status=(text, state=phase) => {
    message=text; phase=state;
    if (banner) { banner.querySelector('[data-account-message]').textContent=text; }
    if (retry) { retry.hidden=!['error','conflict','login'].includes(state); retry.textContent=state==='conflict'?'Reapply my unsaved edits':state==='login'?'Sign in or reload':'Retry'; }
    if (document.body) document.body.dataset.irAccountState=state;
    document.querySelectorAll('[data-kit]').forEach(b=>{ if (view.kit.includes(b.dataset.kit)) b.textContent=state==='saved'?'Saved ✓':'In kit · unsaved'; });
  };
  function eraseLegacy() {
    for (const key of ['done','auto','kit','mode']) { try { localStorage.removeItem('ir:'+key); } catch (_) {} }
  }
  eraseLegacy();
  function conceal() {
    ready=false; volatileSetup=false;
    document.documentElement.dataset.irPersonal='blocked';
    if (hooks) { hooks.reset(); hooks.render(); }
  }
  function discard() {
    generation++; if (controller) controller.abort();
    clearTimeout(flushTimer); controller=null; command=null; pending=[]; sending=false;
    authoritative=empty(); view=empty(); blocked=true; conflict=false; conceal(); eraseLegacy();
  }
  function apply(state, op) {
    if (op.type==='done') { for (const [k,v] of Object.entries(op.values)) state.done[k]=v; }
    else if (op.type==='reset') { state.done={}; state.auto={cam:false,mic:false,env:false}; }
    else if (op.type==='auto') { Object.assign(state.auto,op.values); }
    else if (op.type==='mode') { state.mode=op.value; }
    else if (op.type==='kit') {
      state.kit=state.kit.filter(k=>!op.remove.includes(k));
      for (const k of op.add) if (!state.kit.includes(k)) state.kit.push(k);
    }
  }
  function rebase() { view=copy(authoritative); for (const op of pending) apply(view,op); }
  function refresh() { if (hooks) { hooks.mode(view.mode); hooks.render(); } }
  function queue(op) {
    if (!privatePage || !ready || blocked || conflict) return;
    pending.push(op); rebase(); status('Unsaved changes · saving to your MissionMed account…','saving');
    clearTimeout(flushTimer); flushTimer=setTimeout(send,100);
  }
  function kitObjects() {
    return view.kit.map(key=>items.get(key)).filter(Boolean).map(i=>({key:i.key,name:i.name,tier:i.t,cat:i.category,group:i.group}));
  }
  const store={
    get(key,fallback) {
      if (personal.has(key)) {
        if (!ready || !privatePage) return key==='mode'?'online':key==='kit'?[]:{};
        if (key==='kit') return kitObjects();
        if (key==='auto') return {...view.auto,setup:volatileSetup};
        return copy(view[key]);
      }
      try { const value=localStorage.getItem('ir:'+key); return value?JSON.parse(value):fallback; } catch (_) { return fallback; }
    },
    set(key,value) {
      if (!personal.has(key)) { try { localStorage.setItem('ir:'+key,JSON.stringify(value)); } catch (_) {} return; }
      if (!privatePage || !ready || blocked || conflict) return;
      if (key==='done') {
        if (!value || typeof value!=='object' || Array.isArray(value)) return;
        if (!Object.keys(value).length) { volatileSetup=false; queue({type:'reset'}); return; }
        const changes={};
        for (const [k,v] of Object.entries(value)) if (ids.has(k) && typeof v==='boolean' && view.done[k]!==v) changes[k]=v;
        if (Object.keys(changes).length) queue({type:'done',values:changes});
      } else if (key==='auto') {
        volatileSetup=value.setup===true; // The engine's complete verdict is session-only.
        const changes={};
        for (const k of ['cam','mic','env']) if (typeof value[k]==='boolean' && view.auto[k]!==value[k]) changes[k]=value[k];
        if (Object.keys(changes).length) queue({type:'auto',values:changes});
      } else if (key==='kit' && Array.isArray(value)) {
        const keys=[...new Set(value.map(i=>i.key).filter(k=>items.has(k)))];
        const add=keys.filter(k=>!view.kit.includes(k)), remove=view.kit.filter(k=>items.has(k)&&!keys.includes(k));
        if (add.length || remove.length) queue({type:'kit',add,remove});
      } else if (key==='mode' && ['online','in-person'].includes(value) && value!==view.mode) queue({type:'mode',value});
    }
  };
  function validState(s) {
    if (!s || !Number.isSafeInteger(s.revision) || s.revision<0 || !s.done || Array.isArray(s.done) ||
        !s.auto || Array.isArray(s.auto) || !Array.isArray(s.kit) || !['online','in-person'].includes(s.mode)) return false;
    if (Object.keys(s).sort().join(',')!=='auto,done,kit,lastCommandDigest,lastCommandId,mode,revision') return false;
    if (typeof s.lastCommandId!=='string' || typeof s.lastCommandDigest!=='string') return false;
    if (s.revision===0 ? s.lastCommandId!=='' || s.lastCommandDigest!=='' :
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s.lastCommandId) || !/^[0-9a-f]{64}$/.test(s.lastCommandDigest)) return false;
    if (Object.entries(s.done).some(([k,v])=>!ids.has(k)||typeof v!=='boolean')) return false;
    if (Object.keys(s.auto).sort().join(',')!=='cam,env,mic' || Object.values(s.auto).some(v=>typeof v!=='boolean')) return false;
    return s.kit.length===new Set(s.kit).size && s.kit.every(k=>acceptedKeys.has(k));
  }
  async function request(method,body,token) {
    if (!context || new URL(context.endpoint,location.origin).origin!==location.origin ||
        new URL(context.endpoint,location.origin).pathname!=='/wp-json/missionmed-ir/v1/state') throw new Error('endpoint');
    controller=new AbortController(); const active=controller;
    const timeout=setTimeout(()=>active.abort(),12000);
    try {
      const r=await fetch(context.endpoint,{method,credentials:'same-origin',cache:'no-store',redirect:'error',
        referrerPolicy:'same-origin',signal:active.signal,
        headers:{'X-WP-Nonce':context.nonce,'X-IR-Subject':context.subject,...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})});
      if (token!==generation) throw new Error('obsolete');
      if (r.status===401 || r.status===403) { discard(); status('Your account session changed or expired. Sign in or reload to continue.','login'); throw new Error('login'); }
      if (r.status===409) throw new Error('conflict');
      if (!r.ok) throw new Error('network');
      const data=await r.json();
      if (token!==generation) throw new Error('obsolete');
      if (data.subject!==context.subject) { discard(); status('Your account changed. Reload to continue.','login'); throw new Error('login'); }
      if (!validState(data.state)) throw new Error('schema');
      return data.state;
    } finally { clearTimeout(timeout); if (controller===active) controller=null; }
  }
  async function hydrate(afterConflict=pending.length>0) {
    if (!privatePage || blocked) return;
    const token=generation; ready=false; document.documentElement.dataset.irPersonal='blocked';
    status('Loading your MissionMed checklist and kit…','loading');
    try {
      const s=await request('GET',null,token);
      if (token!==generation) return;
      authoritative=copy(s); view=copy(s); command=null; volatileSetup=false; ready=true;
      conflict=afterConflict && pending.length>0;
      document.documentElement.dataset.irPersonal='ready'; refresh();
      status(conflict?'Your account changed elsewhere. Review the current state, then reapply your unsaved edits.':'Loaded from your MissionMed account.',conflict?'conflict':'saved');
    } catch (e) {
      if (token!==generation || blocked) return;
      status('Your checklist and kit are hidden until your account can be loaded. Retry when connected.','error');
    }
  }
  async function send() {
    if (sending || !ready || blocked || conflict || !pending.length) return;
    const token=generation; sending=true;
    if (!command) {
      rebase();
      command={count:pending.length,body:{expectedRevision:authoritative.revision,commandId:crypto.randomUUID(),
        state:{done:copy(view.done),auto:copy(view.auto),kit:[...view.kit],mode:view.mode}}};
    }
    const sent=command;
    try {
      const s=await request('POST',sent.body,token);
      if (token!==generation) return;
      pending.splice(0,sent.count); command=null; authoritative=copy(s); rebase(); refresh();
      status(pending.length?'Unsaved changes · saving…':'Saved to your MissionMed account.',pending.length?'saving':'saved');
    } catch (e) {
      if (token!==generation || blocked) return;
      if (e.message==='conflict') { command=null; await hydrate(true); }
      else status('Changes are unsaved. Keep this page open and retry to save them.','error');
    } finally { if (token===generation) sending=false; }
    if (token===generation && pending.length && phase==='saving') send();
  }
  function attach(bindings) {
    hooks=bindings;
    for (const [group,categories] of Object.entries(bindings.catalog)) for (const c of categories) for (const i of c.items) items.set(i.key,{...i,group,category:c.name});
    for (const [m,phases] of Object.entries(bindings.checklist)) phases.forEach(([,rows],p)=>rows.forEach((_,i)=>ids.add(`${m}:${p}:${i}`)));
    banner=document.createElement('div'); banner.className='editorial-note'; banner.setAttribute('role','status');
    banner.innerHTML='<span data-account-message></span> <button class="btn plain sm" type="button" hidden>Retry</button>';
    document.querySelector('.topbar').insertAdjacentElement('afterend',banner); retry=banner.querySelector('button');
    retry.onclick=()=>{
      if (blocked) { location.assign(appURL+location.hash); return; }
      if (conflict) { conflict=false; rebase(); refresh(); status('Unsaved changes · saving…','saving'); send(); }
      else if (!ready) hydrate(); else send();
    };
    document.querySelectorAll('#page-checklist > .lede,#page-kit > .lede').forEach(p=>p.textContent=privatePage?
      'Your checklist and kit are saved to your free MissionMed account.':'Sign in or create a free MissionMed account to save your checklist and kit across devices.');
    document.getElementById('clReset').onclick=()=>{
      if (ready && !conflict && confirm('Clear your account checklist progress?')) { store.set('done',{}); refresh(); }
    };
    // Capture prevents original event listeners from changing personal state before admission.
    document.addEventListener('click',e=>{
      const target=e.target.closest('[data-kit],[data-remove-kit],#clReset,#modeOnline,#modeInPerson,#checklist input');
      if (!target) return;
      if (!privatePage || !ready || blocked || conflict) { e.preventDefault(); e.stopImmediatePropagation(); if (!privatePage) location.assign(appURL+location.hash); }
    },true);
    document.addEventListener('click',e=>{
      if (e.target.closest('[data-kit],[data-remove-kit]') && privatePage && ready) {
        queueMicrotask(()=>{ status(message,phase); const live=document.getElementById('saveStatus'); if(live) live.textContent=message; });
      }
    });
    const previousRoute=bindings.route;
    bindings.wrapRoute(()=>{
      const id=(location.hash||'#home').slice(1).split('/')[0];
      if (!privatePage && ['checklist','kit'].includes(id)) { location.assign(appURL+location.hash); return; }
      previousRoute();
    });
    document.documentElement.dataset.irPersonal=privatePage?'blocked':'public';
    status(privatePage?'Loading your MissionMed checklist and kit…':'Use your free MissionMed account to save a checklist and kit.',privatePage?'loading':'public');
    if (!privatePage) {
      const link=document.createElement('a'); link.className='btn plain sm'; link.href=appURL; link.textContent='Open my free account tools →'; banner.append(link);
    } else hydrate();
    bindings.runRoute();
  }
  // Conceal synchronously before a BFCache snapshot. Resume from authoritative identity.
  window.addEventListener('pagehide',()=>{ discard(); status('Revalidating your account…','loading'); });
  window.addEventListener('pageshow',e=>{ if (e.persisted && privatePage) { blocked=false; hydrate(); } });
  window.addEventListener('focus',()=>{
    if (privatePage && ready && !sending && !pending.length) { generation++; conceal(); hydrate(); }
  });
  document.addEventListener('visibilitychange',()=>{
    if (document.visibilityState==='hidden' && privatePage) {
      generation++; if(controller)controller.abort(); sending=false; ready=false;
      view=empty(); volatileSetup=false; conceal();
    } else if (document.visibilityState==='visible' && privatePage && !blocked) {
      // Pending edits remain memory-only but require explicit reapplication after revalidation.
      hydrate(pending.length>0);
    }
  });
  return {store,attach,kitLabel:()=>phase==='saved'?'Saved ✓':'In kit · unsaved'};
})();

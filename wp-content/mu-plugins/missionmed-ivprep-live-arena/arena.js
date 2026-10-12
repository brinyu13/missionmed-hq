import {ArenaRecorder} from './recorder.js';
const cfg=JSON.parse(document.getElementById('arena-config').textContent),$=id=>document.getElementById(id);
let state=null,recorder=null,attempt=null,blobURL=null,loadedAttempt=null,pending=null,busy=false,unsaved=false,unsavedAttempt=null,started=0,selectCandidate=null;
const uuid=()=>crypto.randomUUID();
const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
const sha=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
const url=(op,id='')=>cfg.api+'?op='+encodeURIComponent(op)+(id?'&id='+encodeURIComponent(id):'');
async function request(target,body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(target,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json','X-WP-Nonce':cfg.nonce},body:body?JSON.stringify(body):undefined,signal:controller.signal});const data=await response.json();if(!response.ok){const e=new Error(data.message||'Request failed.');e.status=response.status;throw e;}return data;}finally{clearTimeout(timeout);}}
function remember(){if(pending)sessionStorage.setItem('ivprep.pending',JSON.stringify(pending));else sessionStorage.removeItem('ivprep.pending');}
async function save(target,body){if(pending)throw new Error('Resolve the pending save first.');pending={target,body};remember();return retry();}
async function retry(){busy=true;render();try{state=await request(pending.target,pending.body);pending=null;remember();sessionStorage.setItem('ivprep.session',state.id);message('Saved · version '+state.version);return state;}catch(e){message(e.name==='AbortError'?'Save confirmation timed out. Retry the same save; do not repeat the action.':e.message,true);if(e.status===409){pending.conflict=true;remember();message(e.message+' Reload saved state to reconcile this command.',true);}else if(e.status&&e.status<500){pending=null;remember();}$('reload').hidden=false;throw e;}finally{busy=false;$('retry').hidden=!pending;render();}}
async function command(type,data={}){return save(url('command',state.id),{type,request_id:uuid(),version:state.version,...data});}
function el(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
function render(){
 const locked=busy||Boolean(pending),recording=recorder?.phase==='recording'||recorder?.phase==='finalizing';
 $('create').disabled=locked||recording||Boolean(state?.active);$('sessions').disabled=locked||recording||Boolean(state?.active);
 if(!state)return;
 $('session-title').textContent=state.label||'IV Prep practice';const people=Object.values(state.students),present=people.filter(p=>p.present);
 $('attendance-count').textContent=present.length+' present';$('selected').textContent=state.students[state.selected]?.name||'Select a present student';
 // Source-derived Team Challenge avatar pills; all handlers use isolated Arena commands.
 const teams={blue:[],red:[]};people.forEach((p,i)=>teams[p.team|| (i%2?'red':'blue')].push(p));
 for(const color of ['blue','red']){
  const list=$(`${color}-list`);list.replaceChildren();const team=teams[color];
  $(`${color}-count`).textContent=team.filter(p=>p.present).length+' present · '+team.length+' roster';
  $(`${color}-total`).textContent=String(team.reduce((sum,p)=>sum+p.points,0));
  for(const p of [...team].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name))){
   const row=el('button','');row.className='team-challenge-student is-'+color+(p.id===state.selected?' is-active':'')+(!p.present?' is-absent':'');
   row.setAttribute('aria-label','Select '+p.name+(p.present?'':' · confirm attendance'));row.title=p.name;row.disabled=locked||Boolean(state.active);
   const avatar=avatarNode(p),name=el('span',p.name);name.className='team-challenge-name';
   const asked=el('span','');asked.className='team-challenge-asked';asked.append(el('span','IV'),el('strong',String(Object.values(state.attempts).filter(a=>a.student_id===p.id).length)));
   const points=el('strong',String(p.points));points.className='team-challenge-points';row.append(avatar,name,asked,points);
   row.onclick=()=>{if(p.present)run(()=>command('select',{student_id:p.id}));else{selectCandidate=p.id;$('select-name').textContent=p.name;$('select-dialog').showModal();}};list.append(row);
  }
 }
 $('roster').replaceChildren();for(const p of people.filter(p=>p.name.toLowerCase().includes($('search').value.toLowerCase()))){
  const row=el('div','');row.className='student-manage';const name=el('span',p.name),presence=el('button',p.present?'Present ✓':'Mark present');presence.className='classroom-button';presence.disabled=locked||Boolean(state.active);presence.setAttribute('aria-label',(p.present?'Mark absent: ':'Mark present: ')+p.name);presence.onclick=()=>run(()=>command('attendance',{student_id:p.id,present:!p.present}));
  const team=document.createElement('select');team.setAttribute('aria-label','Team: '+p.name);team.add(new Option('Blue','blue'));team.add(new Option('Red','red'));team.value=p.team||(people.indexOf(p)%2?'red':'blue');team.disabled=locked||Boolean(state.active);team.onchange=()=>run(()=>command('team',{student_id:p.id,team:team.value}));row.append(avatarNode(p),name,presence,team);$('roster').append(row);
 }
 $('meeting-save').disabled=locked||Boolean(state.active);$('meeting-open').disabled=!state.meeting_url;
 $('leaderboard').replaceChildren();for(const p of [...people].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name))){const row=el('li',p.name);row.append(el('strong',String(p.points)));$('leaderboard').append(row);}
 const chosen=$('attempts').value;$('attempts').replaceChildren(new Option('Choose an interview',''));for(const a of Object.values(state.attempts).reverse())$('attempts').add(new Option(state.students[a.student_id].name+' · '+a.status+' · '+a.started_at.slice(11,19),a.id));$('attempts').value=unsavedAttempt&&state.attempts[unsavedAttempt]?unsavedAttempt:(state.attempts[chosen]?chosen:(attempt&&state.attempts[attempt]?attempt:''));
 $('attempts').disabled=locked||recording||unsaved;
 const a=state.attempts[$('attempts').value];
 $('start').disabled=locked||!state.selected||Boolean(state.active)||recording;
 $('end').disabled=recorder?.phase!=='recording';$('recover').hidden=!state.active||recording;$('recover').disabled=locked;
 $('review').disabled=locked||Boolean(state.active)||recording||!a||a.status!=='finalized'||loadedAttempt!==a.id||!$('verified').checked;
 $('award').disabled=locked||Boolean(state.active)||recording||!a?.reviewed||Boolean(a?.awarded);$('undo').disabled=locked||Boolean(state.active)||recording||!a?.awarded;
 $('question').disabled=locked||Boolean(state.active);$('file').disabled=recording||locked;
 $('history').replaceChildren();for(const e of state.events.slice(-25).reverse())$('history').append(el('li',e.at.slice(11,19)+' · '+e.type+' · '+(state.students[e.student_id]?.name||'')+(e.points!==undefined?' · '+e.points+' points':'')));
}
async function run(fn){try{await fn();}catch(e){message(e.message,true);}finally{render();}}
function showBlob(blob,id){$('stage-intro').hidden=true;$('player').hidden=false;$('stage-mode').textContent='INTERVIEW PLAYBACK';$('stage-caption').hidden=true;$('player').srcObject=null;$('player').muted=false;$('download').hidden=true;if(blobURL)URL.revokeObjectURL(blobURL);blobURL=URL.createObjectURL(blob);$('player').src=blobURL;loadedAttempt=id;$('verified').checked=false;}
async function finalize(result){
 const id=attempt;showBlob(result.blob,id);$('review-panel').hidden=false;unsaved=true;unsavedAttempt=id;
 const hash=await sha(result.blob);$('download').href=blobURL;$('download').download=`ivprep-${state.id}-${id}.${result.mime.includes('mp4')?'mp4':'webm'}`;$('download').hidden=false;
 $('media-status').textContent=`${result.interrupted?'Interrupted clip':'Local clip'} · ${result.bytes.toLocaleString()} bytes · finalized in ${result.finalizeMs} ms. Save, replay, then confirm video and both voices. Recording is not uploaded.`;
 try{await command('finish',{attempt_id:id,status:result.interrupted?'interrupted':'finalized',bytes:result.bytes,duration:result.duration,finalize_ms:result.finalizeMs,sha256:hash});$('attempts').value=id;}
 catch(e){message('Clip is available locally, but session finalization is not saved. Use Retry the same save. '+e.message,true);}finally{render();}
}
$('start').onclick=()=>run(async()=>{
 if(unsaved)throw new Error('Save and reopen the previous recording before starting another interview.');
 $('player').pause();
 recorder=new ArenaRecorder(text=>{$('media-status').textContent=text;},levels=>{$('incoming').value=levels[0];$('mic').value=levels[1];});recorder.onInterrupted=result=>run(()=>finalize(result));
 busy=true;render();
 try{await recorder.prepare();attempt=uuid();await command('start',{student_id:state.selected,attempt_id:attempt,question:$('question').value});recorder.start();started=Date.now();$('stage-intro').hidden=true;$('player').hidden=false;$('stage-mode').textContent='RECORDING · WEBEX WINDOW';$('stage-caption').textContent=state.students[state.selected].name+' · local capture preview';$('stage-caption').hidden=false;$('review-panel').hidden=true;$('player').muted=true;$('player').srcObject=new MediaStream(recorder.display.getVideoTracks());$('player').play().catch(()=>{});message('Recording locally. Check the muted live preview below: it must show the Webex student, not Arena. End and retry if the wrong window is selected.');}
 catch(e){await recorder.cleanup();throw e;}finally{busy=false;render();}
});
$('end').onclick=()=>run(async()=>{busy=true;render();try{await finalize(await recorder.stop());}catch(e){message('Recording could not finalize: '+e.message,true);}finally{busy=false;render();}});
$('recover').onclick=()=>run(()=>command('finish',{attempt_id:state.active,status:'failed',bytes:0,duration:0,finalize_ms:0,sha256:''}));
$('download').onclick=()=>{$('media-status').textContent='Download requested. Open the saved file below to verify local custody before the next interview.';};
$('file').onchange=()=>run(async()=>{const file=$('file').files[0],a=state?.attempts[$('attempts').value];if(unsaved&&a?.id!==unsavedAttempt)throw new Error('Save and reopen the current interview recording before opening another clip.');if(!file||!a?.media?.sha256)throw new Error('Select a finalized interview with a recording fingerprint first.');if(file.size>300*1024*1024)throw new Error('File exceeds the allowed size.');if(await sha(file)!==a.media.sha256)throw new Error('This file does not match the selected interview. Association was not changed.');showBlob(file,a.id);unsaved=false;unsavedAttempt=null;$('media-status').textContent='Saved file fingerprint matches this interview. Play to verify video and both voices.';});
$('player').onerror=()=>{$('verified').checked=false;loadedAttempt=null;message('This recording cannot be played. Review is blocked.',true);render();};
$('verified').onchange=render;$('attempts').onchange=()=>{$('verified').checked=false;render();};
$('review').onclick=()=>run(()=>command('review',{attempt_id:$('attempts').value,both_voices_and_video:true}));
$('award').onclick=()=>run(()=>command('award',{attempt_id:$('attempts').value,points:Number($('points').value)}));
$('undo').onclick=()=>run(()=>command('undo',{award_id:state.attempts[$('attempts').value].awarded}));
$('create').onclick=()=>run(async()=>{if(unsaved)throw new Error('Save and reopen the current clip first.');await save(url('create'),{id:uuid(),class_id:$('class').value,label:$('label').value||new Date().toLocaleDateString()+' · IV Prep'});await loadSessions();$('setup-dialog').close();});
$('sessions').onchange=()=>run(async()=>{if(!$('sessions').value)return;if(unsaved)throw new Error('Save and reopen the current clip first.');state=await request(url('state',$('sessions').value));$('meeting-url').value=state.meeting_url||'';$('setup-dialog').close();sessionStorage.setItem('ivprep.session',state.id);attempt=null;loadedAttempt=null;message('Saved session loaded. Reselect local recordings for playback.');});
$('retry').onclick=()=>run(retry);$('reload').onclick=()=>run(async()=>{if(!state)return;state=await request(url('state',state.id));if(pending){if(state.events.some(e=>e.id===pending.body.request_id)){pending=null;remember();message('The pending command was already saved.');}else if(pending.conflict&&pending.body.type==='finish'&&state.active===pending.body.attempt_id){pending.body.version=state.version;pending.conflict=false;remember();message('Recording is still available. Retry the same save to finalize this interview against the refreshed version.');}else if(pending.conflict&&pending.body.type!=='finish'){pending=null;remember();message('Conflicting command was not saved. Review refreshed state before repeating it.');}else throw new Error('Unresolved recording save: preserve the local clip and retry. Do not close this tab.');}else message('Persisted state reloaded.');$('retry').hidden=!pending;});
$('search').oninput=render;$('project').onclick=()=>{document.body.classList.toggle('presentation');$('project').textContent=document.body.classList.contains('presentation')?'Back to instructor':'Present classroom';};
setInterval(()=>{$('timer').textContent=recorder?.phase==='recording'?new Date(Date.now()-started).toISOString().slice(14,19):'00:00';},500);
window.addEventListener('beforeunload',e=>{if(unsaved||['permission','ready','recording','finalizing','closing'].includes(recorder?.phase)||pending){e.preventDefault();e.returnValue='';}});
async function loadSessions(){const data=await request(url('sessions'));$('sessions').replaceChildren(new Option('Choose a saved session',''));for(const s of data.sessions)$('sessions').add(new Option(s.label,s.id));if(state)$('sessions').value=state.id;}
run(async()=>{const groups=await request(url('groups'));for(const g of groups.groups)$('class').add(new Option(g.group_name,g.id));await loadSessions();const saved=sessionStorage.getItem('ivprep.session');if(saved)try{state=await request(url('state',saved));}catch{sessionStorage.removeItem('ivprep.session');}const stored=sessionStorage.getItem('ivprep.pending');if(stored){const p=JSON.parse(stored);if(p.target.startsWith(cfg.api+'?')){pending=p;$('retry').hidden=false;message('A save needs confirmation. Retry the same save before continuing.',true);}}else message('Ready. Choose a class and create or resume a session.');});

// Dialogs and meeting fallback retain the classroom stage, without provider calls.
for(const id of ['setup','roster','leaderboard']){$(id+'-open').onclick=()=>$(id+'-dialog').showModal();$(id+'-close').onclick=()=>$(id+'-dialog').close();}
$('manage-open').onclick=()=>$('roster-dialog').showModal();
$('select-close').onclick=()=>$('select-dialog').close();
$('select-confirm').onclick=()=>run(async()=>{if(!selectCandidate)return;await command('attendance',{student_id:selectCandidate,present:true});await command('select',{student_id:selectCandidate});$('select-dialog').close();});
$('review-open').onclick=()=>$('review-panel').hidden=false;$('review-close').onclick=()=>$('review-panel').hidden=true;
$('meeting-save').onclick=()=>run(async()=>{if(!state)throw new Error('Create or resume a session first.');await command('meeting',{url:$('meeting-url').value.trim()});message('Webex meeting selected for this IV Prep session.');});
$('meeting-open').onclick=()=>{if(state?.meeting_url)window.open(state.meeting_url,'_blank','noopener,noreferrer');else $('setup-dialog').showModal();};
function avatarNode(student){
 const avatar=el('span','');avatar.className='team-challenge-avatar';
 const img=document.createElement('img');img.className='team-avatar-pro team-avatar-headshot';img.alt='';img.loading='lazy';img.src=(cfg.avatarBase||'/classroom-avatars/')+professionalAvatarFiles[hashString(student.id+'|'+student.name+'|')%professionalAvatarFiles.length];img.onerror=()=>{avatar.textContent=initialsFromName(student.name);};avatar.append(img);return avatar;
}

// Verbatim deterministic avatar selection helpers from production-equal Team Challenge.
  var professionalAvatarFiles = [
    "doctor-female-01.webp",
    "doctor-female-02.webp",
    "doctor-female-03.webp",
    "doctor-female-04.webp",
    "doctor-female-05.webp",
    "doctor-female-06.webp",
    "doctor-male-01.webp",
    "doctor-male-02.webp",
    "superhero-female-01.webp",
    "superhero-female-02.webp"
  ];


  function hashString(value) {
    var hash = 0;
    var text = String(value || "");
    for (var index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash || 1);
  }

  function initialsFromName(name) {
    return String(name || "S").trim().split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("") || "S";
  }

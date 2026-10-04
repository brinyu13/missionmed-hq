// Astra WEBEX_ZOOM_TEAMS_SIMULATION_CONTRACT: presentation only. This adapter
// never receives a stream, provider, controller, recorder, or database handle.
export const ENVIRONMENTS=Object.freeze(['MissionMed','Webex','Zoom','Teams']);
export function normalizeEnvironment(value){return ENVIRONMENTS.includes(value)?value:'MissionMed';}
export function selectedEnvironment(settings,retry){return normalizeEnvironment(retry?.wizard?.environment??settings?.environment);}
const definitions={
  MissionMed:{id:'missionmed',layouts:['Workspace'],controlPlacement:'bottom',selfViewPlacement:'stage'},
  Webex:{id:'webex',layouts:['Stack','Side by side'],controlPlacement:'bottom',selfViewPlacement:'stage'},
  Zoom:{id:'zoom',layouts:['Speaker','Gallery'],controlPlacement:'bottom',selfViewPlacement:'bottom-right'},
  Teams:{id:'teams',layouts:['Gallery'],controlPlacement:'top',selfViewPlacement:'gallery'},
};
export function environmentProfile(value){
  const referencePlatform=normalizeEnvironment(value),definition=definitions[referencePlatform];
  return Object.freeze({...definition,layouts:Object.freeze(definition.layouts.slice()),version:'ivoc.meeting-profile.v1',
    referencePlatform,layoutMode:definition.layouts[0],simulated:referencePlatform!=='MissionMed',theme:'fable-dark',panelVisibility:'closed'});
}
export function environmentChoicesMarkup(value){
  const selected=normalizeEnvironment(value);
  return '<div class="environment-choices" role="group" aria-label="Interview environment">'+ENVIRONMENTS.map(name=>'<button type="button" class="option environment-choice" data-environment="'+name+'" aria-pressed="'+(name===selected)+'"><span class="environment-preview" data-profile="'+name.toLowerCase()+'" aria-hidden="true"><i></i><i></i><b></b></span><strong>'+name+'</strong><small>'+(name==='MissionMed'?'Your interview workspace':'Simulated training environment')+'</small></button>').join('')+'</div>';
}
export function environmentControlsMarkup(profile,{mode='mock'}={}){
  if(!profile.simulated)return '';
  return '<div class="environment-bar" data-environment-bar><div class="environment-disclosure"><strong>'+profile.referencePlatform+' simulation</strong><span>SIMULATED TRAINING ENVIRONMENT</span><details><summary>About this room</summary><p>MissionMed interview training. Not affiliated with or endorsed by Cisco/Webex, Zoom, or Microsoft. No platform meeting, message, or cloud recording is started. The IVOC recorder captures this interview.</p></details></div><div class="environment-actions">'+(profile.layouts.length>1?'<label>'+ (profile.id==='webex'?'Layout':'View')+'<select data-environment-layout aria-label="'+profile.referencePlatform+' layout">'+profile.layouts.map(layout=>'<option>'+layout+'</option>').join('')+'</select></label>':'')+'<button type="button" class="btn btn-quiet" data-self-view aria-pressed="true" disabled>Hide self view</button>'+(profile.id==='teams'?'<button type="button" class="btn btn-quiet" data-people aria-expanded="false" aria-controls="meeting-people">People</button>':'')+'</div></div>'+(profile.id==='teams'?'<aside id="meeting-people" class="meeting-people" aria-label="Interview participants" hidden><h3>People in this interview</h3><p>You · candidate</p>'+(mode==='mock'?'<p data-people-interviewer></p><small>AI voice interviewer · no live avatar</small>':'<small>Self Practice · no AI interviewer</small>')+'<button type="button" class="btn btn-quiet" data-close-people>Close people</button></aside>':'');
}
export function mountEnvironmentProfile(room,{profile,isCurrent=()=>true,isLive=()=>false,interviewerRole='Program Director'}={}){
  room.dataset.environment=profile.id;room.dataset.layout=profile.layoutMode;room.dataset.selfView='true';
  const layout=room.querySelector('[data-environment-layout]'),self=room.querySelector('[data-self-view]');
  const people=room.querySelector('[data-people]'),close=room.querySelector('[data-close-people]'),panel=room.querySelector('#meeting-people');
  const role=room.querySelector('[data-people-interviewer]');if(role)role.textContent=interviewerRole;
  const hiddenNote=room.querySelector('.self-view-hidden');
  // Move the existing controls, not a duplicate audible/recording/runtime owner.
  if(room.dataset.cockpit!=='true'){
    if(profile.controlPlacement==='top')room.querySelector('[data-environment-bar]').append(room.querySelector('#controls'));
    else if(profile.simulated)room.querySelector('[data-environment-controls]').append(room.querySelector('#controls'));
  }
  const listeners=[];let disposed=false;
  const current=()=>!disposed&&isCurrent();
  const bind=(node,event,handler)=>{if(node){node.addEventListener(event,handler);listeners.push(()=>node.removeEventListener(event,handler));}};
  bind(layout,'change',()=>{if(current()&&profile.layouts.includes(layout.value))room.dataset.layout=layout.value;});
  bind(self,'click',()=>{
    if(!current()||!isLive())return;
    const visible=room.dataset.selfView!=='true';room.dataset.selfView=String(visible);
    self.setAttribute('aria-pressed',String(visible));self.textContent=visible?'Hide self view':'Show self view';
    if(hiddenNote)hiddenNote.hidden=visible;
  });
  const showPeople=visible=>{if(!current()||!panel)return;panel.hidden=!visible;room.dataset.people=String(visible);people.setAttribute('aria-expanded',String(visible));};
  bind(people,'click',()=>showPeople(panel.hidden));
  bind(close,'click',()=>{showPeople(false);people?.focus();});
  bind(panel,'keydown',event=>{if(event.key==='Escape'){showPeople(false);people?.focus();}});
  const refresh=()=>{if(!current())return;const live=isLive();room.dataset.meetingLive=String(live);if(!self)return;self.disabled=!live;if(!live){room.dataset.selfView='true';self.setAttribute('aria-pressed','true');self.textContent='Hide self view';if(hiddenNote)hiddenNote.hidden=true;}};
  refresh();const dispose=()=>{disposed=true;listeners.forEach(remove=>remove());};dispose.refresh=refresh;return dispose;
}

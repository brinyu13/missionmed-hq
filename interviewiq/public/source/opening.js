'use strict';
const OPENING_TAB_KEY='interviewiq_opening_seen_this_tab';
const OPENING_TOTAL_MS=5000, OPENING_FADE_MS=650, OPENING_REDUCED_MOTION_MS=1000;
let openingShown=false;
function showOpening(){
  const node=document.getElementById('interviewiqOpening');if(!node)return;
  let seen=openingShown;try{seen=seen||sessionStorage.getItem(OPENING_TAB_KEY)==='1';}catch{}
  if(seen){node.hidden=true;return;}
  openingShown=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shell=['main','hdr','rail','drawer'].map(id=>document.getElementById(id)).filter(Boolean);
  const priorInert=shell.map(el=>el.inert);shell.forEach(el=>{el.inert=true;});
  const timers=new Set();let finished=false,cleaned=false;
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};
  const skip=node.querySelector('[data-skip-opening]');
  node.hidden=false;node.dataset.phase='forming';node.dataset.motion=reduced?'reduced':'full';
  document.body.classList.add('opening-active');
  const cleanup=()=>{
    if(cleaned)return;cleaned=true;timers.forEach(clearTimeout);timers.clear();
    node.hidden=true;document.body.classList.remove('opening-active');
    shell.forEach((el,k)=>{el.inert=priorInert[k];});
    skip?.removeEventListener('click',skipOpening);
    document.getElementById('main')?.focus({preventScroll:true});
  };
  const finish=immediate=>{
    if(finished){if(immediate)cleanup();return;}finished=true;
    timers.forEach(clearTimeout);timers.clear();
    try{sessionStorage.setItem(OPENING_TAB_KEY,'1');}catch{}
    if(immediate){cleanup();return;}
    node.dataset.phase='leaving';later(cleanup,reduced?250:OPENING_FADE_MS);
  };
  const skipOpening=()=>finish(true);
  skip?.addEventListener('click',skipOpening);skip?.focus({preventScroll:true});
  later(()=>finish(false),reduced?OPENING_REDUCED_MOTION_MS-250:OPENING_TOTAL_MS-OPENING_FADE_MS);
}

const OPENING_TAB_KEY='interviewiq_opening_seen_this_tab'; const OPENING_MINIMUM_MS=1650; const OPENING_REDUCED_MOTION_MS=650;
function showOpening(){
  const node=document.getElementById('interviewiqOpening'); if(!node) return;
  let seen=false; try{ seen=sessionStorage.getItem(OPENING_TAB_KEY)==='1'; }catch(e){}
  if(seen){ node.hidden=true; return; }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced) document.body.classList.add('motion-enabled');
  node.hidden=false; node.dataset.phase='forming'; document.body.classList.add('opening-active');
  const status=node.querySelector('[data-opening-status]'); const t0=performance.now();
  setTimeout(()=>{ if(!node.hidden&&status) status.textContent='Preparing your workspace…'; }, 700);
  let finished=false;
  const finish=()=>{ if(finished) return; finished=true; try{ sessionStorage.setItem(OPENING_TAB_KEY,'1'); }catch(e){} node.dataset.phase='leaving'; document.body.classList.remove('opening-active'); setTimeout(()=>{ node.hidden=true; document.getElementById('main').focus({preventScroll:true}); }, reduced?0:260); };
  node.querySelector('[data-skip-opening]').addEventListener('click',finish);
  const minimum=reduced?OPENING_REDUCED_MOTION_MS:OPENING_MINIMUM_MS;
  setTimeout(finish, Math.max(minimum, reduced?minimum:2400));
}

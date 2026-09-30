(()=>{'use strict';
const hero=document.getElementById('mm-premium-hero');if(!hero)return;
const source=document.getElementById('mm-premium-hero-data');let frames=[];try{frames=JSON.parse(source.textContent)}catch(_){return}if(frames.length!==8)return;
const q=s=>hero.querySelector(s),all=s=>[...hero.querySelectorAll(s)];
const image=q('[data-hero-image]'),eyebrow=q('[data-eyebrow]'),headline=q('[data-headline]'),connector=q('[data-connector]'),bridge=q('[data-bridge]'),accent=q('[data-accent]'),support=q('[data-support]'),cta=q('[data-cta]'),caption=q('[data-caption]'),live=q('[data-live]'),select=q('[data-division]'),pause=q('[data-pause]'),dots=all('[data-slide]');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width: 760px)');let index=0,timer=0,paused=false,hover=false,focused=false,visible=true,loaded=new Set([frames[0].asset]);
const emit=(event,data={})=>{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event,...data})};
const eager=url=>{if(loaded.has(url))return;const i=new Image();i.decoding='async';i.onload=()=>loaded.add(url);i.src=url};
const schedule=()=>{clearTimeout(timer);timer=0;if(paused||hover||focused||!visible||document.hidden||reduced.matches||mobile.matches)return;timer=setTimeout(()=>show(index+1,'auto'),12000)};
const text=(node,value)=>{node.textContent=value||'';node.hidden=!value};
async function show(next,reason='manual'){
 const n=(next+frames.length)%frames.length,frame=frames[n];if(n===index&&reason!=='init'){schedule();return}hero.classList.add('is-loading');
 const probe=new Image();probe.decoding='async';probe.src=frame.asset;try{await probe.decode()}catch(_){await new Promise(resolve=>{probe.onload=probe.onerror=resolve})}
 image.src=frame.asset;image.alt=frame.alt;image.width=frame.width;image.height=frame.height;index=n;hero.dataset.index=String(n);hero.dataset.tone=frame.tone;hero.dataset.theme=frame.theme;hero.dataset.visual=frame.visual;
 text(eyebrow,frame.eyebrow);text(headline,frame.headline);text(connector,frame.connector);text(bridge,frame.bridge);text(accent,frame.accent);text(support,frame.support);text(caption,frame.caption);cta.textContent=frame.cta;cta.href=frame.href;
 dots.forEach((d,i)=>{d.setAttribute('aria-current',String(i===n));d.setAttribute('aria-label',`${i+1} of ${frames.length}: ${frames[i].division}`)});select.value=frame.division;live.textContent=`${frame.division}, slide ${n+1} of ${frames.length}`;document.body.classList.toggle('mm-ph-dark',frame.tone==='dark');hero.classList.remove('is-loading');loaded.add(frame.asset);eager(frames[(n+1)%frames.length].asset);
 if(reason!=='init'){emit('mm_home_hero_view',{hero_frame:frame.id,division:frame.division,interaction:reason})}schedule();
}
const hold=(action)=>{paused=true;pause.textContent='Play';pause.setAttribute('aria-pressed','true');emit('mm_home_hero_interaction',{action,hero_frame:frames[index].id})};
dots.forEach(d=>d.addEventListener('click',()=>{hold('select');show(Number(d.dataset.slide),'select')}));q('[data-prev]').addEventListener('click',()=>{hold('previous');show(index-1,'previous')});q('[data-next]').addEventListener('click',()=>{hold('next');show(index+1,'next')});
pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-pressed',String(paused));emit('mm_home_hero_interaction',{action:paused?'pause':'play',hero_frame:frames[index].id});schedule()});
select.addEventListener('change',()=>{hold('division');const next=frames.findIndex((f,i)=>f.division===select.value&&(i>index||!frames.some((x,j)=>j>index&&x.division===select.value)));show(next<0?0:next,'division')});
cta.addEventListener('click',()=>emit('mm_home_hero_cta',{hero_frame:frames[index].id,division:frames[index].division,destination_path:new URL(cta.href,location.href).pathname}));
hero.addEventListener('mouseenter',()=>{hover=true;schedule()});hero.addEventListener('mouseleave',()=>{hover=false;schedule()});hero.addEventListener('focusin',()=>{focused=true;schedule()});hero.addEventListener('focusout',e=>{focused=!!e.relatedTarget&&hero.contains(e.relatedTarget);schedule()});document.addEventListener('visibilitychange',schedule);reduced.addEventListener?.('change',schedule);mobile.addEventListener?.('change',schedule);new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);schedule()},{threshold:.25}).observe(hero);addEventListener('scroll',()=>document.body.classList.toggle('mm-ph-scrolled',scrollY>42),{passive:true});
document.body.classList.add('mm-ph-dark');emit('mm_home_hero_view',{hero_frame:frames[0].id,division:frames[0].division,interaction:'initial'});eager(frames[1].asset);schedule();
})();

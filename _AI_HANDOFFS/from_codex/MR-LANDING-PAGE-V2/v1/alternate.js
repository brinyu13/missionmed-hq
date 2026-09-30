/* Donor motion is native background-attachment: fixed; no new parallax engine. */
(() => {
  'use strict';
  const keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
  const source = new URLSearchParams(location.search);
  const attribution = Object.fromEntries(keys.filter(k => source.has(k)).map(k => [k, source.get(k).slice(0,200)]));
  document.querySelectorAll('a[data-offer]').forEach(link => {
    const u = new URL(link.href, location.origin);
    if (u.origin !== location.origin) return;
    Object.entries(attribution).forEach(([k,v]) => u.searchParams.set(k,v));
    link.href = u.href;
  });
  const track = (event, extra = {}) => {
    const data = {send_to:'G-B4B4E26HMW',mission:'MR-USCE-ALTERNATE-0930',page_path:location.pathname,...attribution,...extra};
    if (typeof window.gtag === 'function') window.gtag('event',event,data);
    else (window.dataLayer = window.dataLayer || []).push({event,...data});
  };
  document.querySelectorAll('a[data-offer]').forEach(a => a.addEventListener('click', e => {
    const data={offer:a.dataset.offer,destination_path:new URL(a.href).pathname,cta_location:'usce_alternate',transport_type:'beacon'};
    // Allow the analytics beacon to flush without trapping navigation if tracking is blocked.
    if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){
      e.preventDefault();let moved=false;const go=()=>{if(!moved){moved=true;location.assign(a.href);}};
      track('mr_product_detail_intent',{...data,event_callback:go,event_timeout:400});setTimeout(go,450);
    }else track('mr_product_detail_intent',data);
  }));
  document.querySelectorAll('.cl1403c-faq-item').forEach(d => d.addEventListener('toggle', () => {if(d.open)track('mr_faq_open',{question:d.querySelector('summary').innerText});}));
  // Preserve donor's photo loading discipline: lower background images load near viewport.
  const load = el => {el.style.backgroundImage = `url("${el.dataset.bg}")`;el.removeAttribute('data-bg');};
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(e => {if(e.isIntersecting){load(e.target);observer.unobserve(e.target);}}),{rootMargin:'400px'});
    document.querySelectorAll('[data-bg]').forEach(el => observer.observe(el));
  } else document.querySelectorAll('[data-bg]').forEach(load);
  const menu = document.querySelector('.mm-alt-menu');
  menu?.addEventListener('keydown', e => {if(e.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
  // Native controls keep keyboard/Escape in the accessible parent dialog. Stream supplies HLS.
  // No video, HLS library or media request exists before intentional play-button activation.
  const matchButton = document.querySelector('[data-match-day-source]');
  const matchDialog = document.querySelector('#mm-match-dialog');
  if (matchButton && matchDialog && typeof matchDialog.showModal === 'function') {
    const stage = matchDialog.querySelector('.mm-match-stage');
    const status = matchDialog.querySelector('.mm-match-status');
    const closeButton = matchDialog.querySelector('.mm-match-close');
    const fired = new Set();
    let generation = 0, player = null, hls = null, savedOverflow = '', hlsPromise;
    const emit = suffix => {
      if (fired.has(suffix)) return;
      fired.add(suffix);
      track('match_day_video_' + suffix, {video_id:'mission-residency-match-day',video_provider:'cloudflare-stream'});
    };
    const loadHls = () => {
      if (typeof window.Hls === 'function') return Promise.resolve();
      if (!hlsPromise) hlsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timer = setTimeout(() => reject(new Error('player-control-timeout')), 15000);
        script.src = stage.dataset.hlsLibrary;
        script.onload = () => {clearTimeout(timer);typeof window.Hls === 'function' ? resolve() : reject(new Error('player-control-unavailable'));};
        script.onerror = () => {clearTimeout(timer);script.remove();reject(new Error('player-control-network'));};
        document.head.append(script);
      }).catch(error => {hlsPromise = null;throw error;});
      return hlsPromise;
    };
    matchButton.addEventListener('click', async () => {
      if (matchDialog.open) return;
      const source = new URL(matchButton.dataset.matchDaySource);
      if (source.origin !== 'https://customer-wiw9vmb43wmdkdp7.cloudflarestream.com' || !/^\/[a-f0-9]{32}\/manifest\/video\.m3u8$/.test(source.pathname)) return;
      const active = ++generation;
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      matchDialog.showModal();closeButton.focus();
      status.textContent = 'Loading your video…';
      const current = document.createElement('video');player = current;
      current.setAttribute('aria-label','Mission Residency students celebrating Match Day');
      current.width=960;current.height=540;current.controls=true;current.playsInline=true;current.preload='none';
      current.poster=stage.dataset.poster;
      stage.replaceChildren(current);
      const stillActive = () => matchDialog.open && active === generation;
      current.addEventListener('playing', () => {if(stillActive()){status.textContent='';emit('start');}});
      current.addEventListener('timeupdate', () => {
        if (!stillActive() || current.paused || !Number.isFinite(current.duration) || current.duration <= 0) return;
        emit('start');
        let watched = 0;
        for(let i=0;i<current.played.length;i++) watched += current.played.end(i)-current.played.start(i);
        [25,50,75].forEach(q => {if(watched/current.duration*100 >= q)emit(String(q));});
      });
      current.addEventListener('ended', () => {if(stillActive())emit('complete');});
      current.addEventListener('error', () => {if(stillActive())status.textContent='The video could not load. Please close it and try again.';});
      const play = () => current.play().catch(() => {if(stillActive())status.textContent='Press Play in the video to begin with sound.';});
      try {
        if (current.canPlayType('application/vnd.apple.mpegurl')) {current.src=source.href;play();}
        else {
          await loadHls();
          if (!stillActive()) return;
          if (!window.Hls.isSupported()) throw new Error('hls-not-supported');
          hls = new window.Hls({capLevelToPlayerSize:true,maxBufferLength:30});
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {if(stillActive())play();});
          hls.on(window.Hls.Events.ERROR, (_,data) => {if(data.fatal&&stillActive()){status.textContent='The video could not load. Please close it and try again.';hls?.destroy();hls=null;}});
          hls.loadSource(source.href);hls.attachMedia(current);
        }
      } catch (_) {
        if (stillActive()) status.textContent='The video could not load in this browser. Please close it and try again.';
      }
    });
    closeButton.addEventListener('click', () => matchDialog.close());
    matchDialog.addEventListener('close', () => {
      generation++;
      if (hls) {hls.destroy();hls=null;}
      if (player) {player.pause();player.removeAttribute('src');player.load();player=null;}
      // Stop audio and further media downloads, including a pending library initialization.
      stage.replaceChildren();status.textContent='';
      document.body.style.overflow=savedOverflow;
      matchButton.focus({preventScroll:true});
    });
  } else if (matchButton) {
    // No broken enrollment-page control in a browser without native accessible dialog support.
    matchButton.hidden = true;
  }
})();

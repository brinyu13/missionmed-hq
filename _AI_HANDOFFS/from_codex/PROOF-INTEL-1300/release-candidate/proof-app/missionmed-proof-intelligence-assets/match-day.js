/* Reused live Mission Residency Match Day player. Same Stream source, native controls and HLS configuration. */
(() => {
'use strict';
const track=()=>{}; // No new analytics collection.
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
      document.querySelectorAll('video').forEach(video => video.pause());
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

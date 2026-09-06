/* ============================================================
   D1-411A — EXPORT ADAPTER (host-side, UNPROTECTED)
   Thin convenience wrapper over the protected kernel's
   exportBoard(). Screen and export originate from the SAME
   committed #board DOM — there is no other serializer.
   Also defines the approved PRINT SURFACE lifecycle for
   environments where in-page rasterization is unavailable.
   ============================================================ */
'use strict';

async function exportPNG(opts){
  opts=opts||{};
  const K=window.D1409H;
  await K.ready(); await K.whenStable();
  const r=await K.exportBoard({format:'png', pixelRatio:opts.pixelRatio===2?2:1,
    background:opts.background});
  if(opts.download!==false && typeof document!=='undefined'){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(r.blob);
    a.download=opts.filename||('timeline-'+r.fingerprint.slice(0,8)+'.png');
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }
  return r;
}

async function exportPDF(opts){
  opts=opts||{};
  const K=window.D1409H;
  await K.ready(); await K.whenStable();
  const r=await K.exportBoard({format:'pdf',
    pageWidth:opts.pageWidth, pageHeight:opts.pageHeight, pixelRatio:2});
  if(opts.download!==false && typeof document!=='undefined'){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(r.blob);
    a.download=opts.filename||('timeline-'+r.fingerprint.slice(0,8)+'.pdf');
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }
  return r;
}

/* APPROVED PRINT/CAPTURE SURFACE (fallback lifecycle — no second renderer):
   1. Navigate a clean context to the protected master with ?defer=1.
   2. await window.D1409H.ready()
   3. await window.D1409H.rerender(model,{renderId})
   4. await window.D1409H.whenStable(renderId)
   5. Capture the #board element at 1920×1080 (deviceScaleFactor 1 or 2)
      with the host's trusted capturer (Playwright/Electron/print-to-PDF).
   The captured DOM is the committed board itself; fingerprint from
   diagnostics() must be recorded next to the artifact. */
async function prepareCaptureSurface(model, renderId){
  const K=window.D1409H;
  await K.ready();
  const res=await K.rerender(model,{renderId, reason:'export'});
  await K.whenStable(renderId);
  return { fingerprint: res.fingerprint, renderId };
}

if(typeof module!=='undefined'&&module.exports){ module.exports={exportPNG,exportPDF,prepareCaptureSurface}; }
if(typeof window!=='undefined'){ window.D1411A_Export={exportPNG,exportPDF,prepareCaptureSurface}; }

import {bootTimelineBuilder} from "./uxr-002/app.js";

bootTimelineBuilder().catch((error)=>{
  const message=String(error?.message||error);
  window.D1_UXR_002_BOOT_ERROR=message;
  const app=document.querySelector("#app");
  if(app){
    app.removeAttribute("aria-busy");
    app.innerHTML=`<main class="boot-error"><h1>Timeline Builder</h1><p>Timeline Builder couldn't start.</p><button type="button" class="button secondary" onclick="location.reload()">Retry</button></main>`;
  }
  const status=document.querySelector("#status-live");
  if(status)status.textContent=`Timeline Builder couldn't start. ${message}`;
});

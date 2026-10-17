import {escapeHtml} from "./utils.js";
import {icon} from "./icons.js";

const timers=new Map();

export function announce(message){
  const live=document.querySelector("#status-live");
  if(!live)return;
  live.textContent="";
  requestAnimationFrame(()=>{live.textContent=String(message||"");});
}

export function showToast(message,{actionLabel=null,onAction=null,tone="neutral",duration=3500}={}){
  const region=document.querySelector("#toast-region");
  if(!region)return null;
  while(region.children.length>=2)region.firstElementChild.remove();
  const id=`toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const toast=document.createElement("div");
  toast.id=id;toast.className=`toast ${tone}`;toast.setAttribute("role",tone==="danger"?"alert":"status");
  toast.innerHTML=`<span>${escapeHtml(message)}</span>${actionLabel?`<button type="button" class="toast-action">${escapeHtml(actionLabel)}</button>`:""}<button type="button" class="toast-close" aria-label="Dismiss notification">${icon("x",{size:16})}</button>`;
  const remove=()=>{clearTimeout(timers.get(id));timers.delete(id);toast.remove();};
  toast.querySelector(".toast-close").addEventListener("click",remove);
  toast.querySelector(".toast-action")?.addEventListener("click",()=>{onAction?.();remove();});
  region.append(toast);requestAnimationFrame(()=>toast.classList.add("visible"));
  timers.set(id,setTimeout(remove,duration));
  announce(message);
  return toast;
}

export function closeOverlay({restoreFocus=true}={}){
  const root=document.querySelector("#overlay-root");
  const opener=root?._opener;
  root?.replaceChildren();
  if(root){root._opener=null;root._cleanup?.();root._cleanup=null;}
  if(restoreFocus&&opener?.isConnected)opener.focus();
}

export function openDialog({title,body,primaryLabel,secondaryLabel="Cancel",primaryTone="primary",secondaryTone="secondary",onPrimary=()=>{},onSecondary=()=>{},opener=document.activeElement}){
  const root=document.querySelector("#overlay-root");
  closeOverlay({restoreFocus:false});
  root._opener=opener;
  root.innerHTML=`<div class="overlay-scrim" data-overlay-dismiss>
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-body">
      <button type="button" class="dialog-close icon-button" aria-label="Close">${icon("x",{size:20})}</button>
      <h2 id="dialog-title">${escapeHtml(title)}</h2>
      <p id="dialog-body">${escapeHtml(body)}</p>
      <div class="dialog-actions">
        <button type="button" class="button ${escapeHtml(secondaryTone)}" data-dialog-secondary>${escapeHtml(secondaryLabel)}</button>
        <button type="button" class="button ${primaryTone}" data-dialog-primary>${escapeHtml(primaryLabel)}</button>
      </div>
    </section>
  </div>`;
  const dialog=root.querySelector(".dialog");
  const focusable=()=>[...dialog.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]")];
  const dismiss=()=>{onSecondary?.();closeOverlay();};
  root.querySelector(".dialog-close").addEventListener("click",dismiss);
  root.querySelector("[data-dialog-secondary]").addEventListener("click",dismiss);
  root.querySelector("[data-dialog-primary]").addEventListener("click",async()=>{const button=root.querySelector("[data-dialog-primary]");button.disabled=true;try{await onPrimary?.();closeOverlay();}catch(error){button.disabled=false;showToast(String(error?.message||error),{tone:"danger"});}});
  root.querySelector("[data-overlay-dismiss]").addEventListener("pointerdown",(event)=>{if(event.target.matches("[data-overlay-dismiss]"))dismiss();});
  const keydown=(event)=>{
    if(event.key==="Escape"){event.preventDefault();dismiss();return;}
    if(event.key==="Tab"){
      const items=focusable();if(!items.length)return;
      const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  };
  document.addEventListener("keydown",keydown);
  root._cleanup=()=>document.removeEventListener("keydown",keydown);
  requestAnimationFrame(()=>root.querySelector("[data-dialog-primary]")?.focus());
}

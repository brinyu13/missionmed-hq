import {buildKeynoteClassicScene,serializeKeynoteClassicSvg} from "./board-renderer.js";
import {buildThemePickerModel} from "./themes.js";
import {escapeHtml} from "./utils.js";
import {currentUtcMonth} from "./preview.js";

function miniatureSvg({scene}){
  return serializeKeynoteClassicSvg(scene)
    .replace('width="1920" height="1080"','width="128" height="72"')
    .replace('role="img"','aria-hidden="true" focusable="false"');
}

export function buildThemePickerForDocument(document,{
  currentMonth=currentUtcMonth(),
  audience="INTERVIEWER_SAFE"
}={}){
  const scene=buildKeynoteClassicScene(document,{currentMonth,audience});
  return buildThemePickerModel({
    scene,
    activeThemeId:document.theme,
    mode:document.mode,
    createMiniature:miniatureSvg
  });
}

export function renderThemePicker(document,options={}){
  let model;
  try{
    model=buildThemePickerForDocument(document,options);
  }catch(error){
    if(!error?.isolated)throw error;
    return`<div class="theme-picker-popover" data-theme-picker hidden data-render-isolated="${escapeHtml(error.code)}"></div>`;
  }
  return`<div class="theme-picker-popover" data-theme-picker hidden>
    <div class="theme-picker-grid">${model.cells.map((cell)=>{
      if(cell.kind==="theme")return`<button type="button" class="theme-card ${cell.active?"active":""}" data-select-theme="${escapeHtml(cell.themeId)}" aria-pressed="${String(cell.active)}">
        <span class="theme-miniature">${cell.miniature}</span>
        <strong>${escapeHtml(cell.name)}</strong>
        <small>${escapeHtml(cell.descriptor)}</small>
        ${cell.active?'<span class="theme-check" aria-hidden="true">✓</span>':""}
      </button>`;
      return`<button type="button" class="theme-card theme-special" ${cell.interactive?'data-open-backgrounds':"disabled"} aria-disabled="${String(!cell.interactive)}">
        <span class="theme-lock" aria-hidden="true">${cell.locked?"⌑":"▧"}</span>
        <strong>${escapeHtml(cell.title)}</strong>
        <small>${escapeHtml(cell.descriptor)}</small>
      </button>`;
    }).join("")}</div>
  </div>`;
}

export function installThemePicker(root,store,{onOpenBackgrounds=null}={}){
  const picker=root.querySelector("[data-theme-picker]");
  const triggers=root.querySelectorAll("[data-theme-trigger]");
  const close=()=>{
    if(!picker)return;
    picker.hidden=true;
    triggers.forEach((trigger)=>trigger.setAttribute("aria-expanded","false"));
  };
  triggers.forEach((trigger)=>trigger.addEventListener("click",(event)=>{
    event.stopPropagation();
    if(!picker)return;
    const opening=picker.hidden;
    picker.hidden=!opening;
    trigger.setAttribute("aria-expanded",String(opening));
    if(opening)picker.querySelector("[data-select-theme],[data-open-backgrounds]")?.focus();
  }));
  picker?.querySelectorAll("[data-select-theme]").forEach((button)=>button.addEventListener("click",()=>{
    const themeId=button.dataset.selectTheme;
    store.mutate("Change theme",(document)=>{document.theme=themeId;});
    close();
  }));
  picker?.querySelector("[data-open-backgrounds]")?.addEventListener("click",()=>{
    close();
    onOpenBackgrounds?.();
  });
  picker?.addEventListener("keydown",(event)=>{
    if(event.key==="Escape"){
      event.preventDefault();
      close();
      triggers[0]?.focus();
    }
  });
  return{close};
}

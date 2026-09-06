import {escapeHtml,formatMonth,parseMonth} from "./utils.js";
import {icon} from "./icons.js";

const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const OUTSIDE_DISMISS_INSTALLED=new WeakSet();

const SAFE_INPUT_ATTRIBUTE=/^(?:name|class|data-[a-z0-9-]+)$/;

function inputAttributesMarkup(attributes={}){
  return Object.entries(attributes||{})
    .filter(([name,value])=>SAFE_INPUT_ATTRIBUTE.test(name)&&value!==false&&value!=null)
    .map(([name,value])=>value===true
      ?escapeHtml(name)
      :`${escapeHtml(name)}="${escapeHtml(value)}"`)
    .join(" ");
}

function monthGridMarkup(year,selected){
  const selectedYear=selected?Number(selected.slice(0,4)):null;
  const selectedMonth=selected?Number(selected.slice(5)):null;
  return Array.from({length:3},(_,row)=>`<div role="row">${MONTHS
    .slice(row*4,row*4+4)
    .map((month,column)=>{
      const index=row*4+column+1;
      return`<button type="button" role="gridcell" data-month="${index}" aria-selected="${String(selectedYear===year&&selectedMonth===index)}">${month}</button>`;
    }).join("")}</div>`).join("");
}

function closeSiblingDatePopovers(documentObject,except){
  for(const popover of documentObject.querySelectorAll(
    ".month-popover:not([hidden]),.exact-date-popover:not([hidden])"
  )){
    if(popover===except)continue;
    popover.hidden=true;
    const field=popover.closest("[data-month-field],[data-exact-date-field]");
    field?.querySelector(".month-trigger,.exact-date-trigger")
      ?.setAttribute("aria-expanded","false");
  }
}

function installOutsideDismiss(documentObject){
  if(!documentObject?.addEventListener||OUTSIDE_DISMISS_INSTALLED.has(documentObject))return;
  OUTSIDE_DISMISS_INSTALLED.add(documentObject);
  documentObject.addEventListener("pointerdown",(event)=>{
    if(event.target.closest?.("[data-month-field],[data-exact-date-field]"))return;
    closeSiblingDatePopovers(documentObject,null);
  },true);
}

function positionPopover(field,popover,width){
  const view=field.ownerDocument?.defaultView;
  const viewportWidth=view?.innerWidth||1024;
  const viewportHeight=view?.innerHeight||768;
  if(viewportWidth<768){
    popover.style.position="fixed";
    popover.style.left="12px";
    popover.style.right="12px";
    popover.style.top="auto";
    popover.style.bottom="calc(68px + env(safe-area-inset-bottom, 0px))";
    popover.style.width="auto";
    return;
  }
  const rect=field.getBoundingClientRect();
  const resolvedWidth=Math.min(width,viewportWidth-16);
  const height=popover.offsetHeight||260;
  const below=rect.bottom+6;
  const top=below+height<=viewportHeight-8
    ?below
    :Math.max(8,rect.top-height-6);
  popover.style.position="fixed";
  popover.style.left=`${Math.max(8,Math.min(rect.left,viewportWidth-resolvedWidth-8))}px`;
  popover.style.right="auto";
  popover.style.top=`${top}px`;
  popover.style.bottom="auto";
  popover.style.width=`${resolvedWidth}px`;
}

export function monthFieldMarkup({
  id,
  label,
  value="",
  required=false,
  optional=false,
  help="",
  disabled=false,
  inputAttributes={},
  error="",
  errorAttributes={}
}){
  const parsed=parseMonth(value);
  const year=parsed?Number(parsed.slice(0,4)):new Date().getFullYear();
  const isFarFuture=!!parsed&&year>new Date().getFullYear()+6;
  const describedBy=[
    help?`${id}-help`:"",
    `${id}-error`
  ].filter(Boolean).join(" ");
  const inputName=String(inputAttributes?.name||id);
  const customAttributes=inputAttributesMarkup(
    Object.fromEntries(
      Object.entries(inputAttributes||{}).filter(([name])=>name!=="name")
    )
  );
  const customErrorAttributes=inputAttributesMarkup(errorAttributes);
  const initialMessage=String(error||"")||(
    isFarFuture?"That's more than 6 years out — double-check the year.":""
  );
  return`<div class="field month-field" data-month-field="${escapeHtml(id)}" data-year="${year}">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}${optional?" <em>Optional</em>":required?'<span class="required-mark" aria-hidden="true"> *</span>':""}</label>
    <div class="month-input-wrap">
      <input type="text" id="${escapeHtml(id)}" name="${escapeHtml(inputName)}" inputmode="text" autocomplete="off" aria-describedby="${escapeHtml(describedBy)}" aria-invalid="${String(!!error)}" value="${escapeHtml(formatMonth(parsed)||value)}" placeholder="Mon YYYY" ${required?"required":""} ${disabled?"disabled":""} ${customAttributes}>
      <button type="button" class="icon-button month-trigger" aria-label="Choose ${escapeHtml(label.toLowerCase())}" aria-controls="${escapeHtml(id)}-popover" aria-expanded="false" ${disabled?"disabled":""}>${icon("calendar",{size:18})}</button>
    </div>
    ${help?`<p class="field-help" id="${escapeHtml(id)}-help">${escapeHtml(help)}</p>`:""}
    <p class="field-error ${!error&&isFarFuture?"field-warning":""}" id="${escapeHtml(id)}-error" aria-live="polite" ${customErrorAttributes}>${escapeHtml(initialMessage)}</p>
    <div class="month-popover" id="${escapeHtml(id)}-popover" role="dialog" aria-label="Choose month and year" hidden>
      <div class="month-year-row">
        <button type="button" class="icon-button year-back" aria-label="Previous year">${icon("chevron-left",{size:18})}</button>
        <strong class="month-year">${year}</strong>
        <button type="button" class="icon-button year-next" aria-label="Next year">${icon("chevron-right",{size:18})}</button>
      </div>
      <div class="month-grid" role="grid">${monthGridMarkup(year,parsed)}</div>
    </div>
  </div>`;
}

export function installMonthFields(root,{onCommit=()=>{}}={}){
  const documentObject=root.ownerDocument||root;
  installOutsideDismiss(documentObject);
  root.querySelectorAll("[data-month-field]").forEach((field)=>{
    if(field.dataset.monthInstalled==="true")return;
    field.dataset.monthInstalled="true";
    const input=field.querySelector("input"),trigger=field.querySelector(".month-trigger"),popover=field.querySelector(".month-popover"),yearLabel=field.querySelector(".month-year"),grid=field.querySelector(".month-grid"),error=field.querySelector(".field-error");
    let year=Number(field.dataset.year);
    let selected=parseMonth(input.value);
    const paint=()=>{
      field.dataset.year=String(year);
      yearLabel.textContent=String(year);
      grid.innerHTML=monthGridMarkup(year,selected);
    };
    const setYear=(value)=>{year=value;paint();};
    const setValidity=(message,{warning=false}={})=>{
      error.classList.toggle("field-warning",warning);
      error.textContent=message;
      input.setAttribute("aria-invalid",String(!!message&&!warning));
    };
    const close=()=>{popover.hidden=true;trigger.setAttribute("aria-expanded","false");};
    const showFutureWarning=(parsed)=>{
      const isFarFuture=Number(parsed.slice(0,4))>new Date().getFullYear()+6;
      setValidity(isFarFuture?"That's more than 6 years out — double-check the year.":"",{warning:isFarFuture});
    };
    const commit=(raw)=>{
      const parsed=parseMonth(raw);
      if(!parsed){
        if(!raw.trim()&&!input.required){
          selected=null;
          setValidity("");
          paint();
          onCommit(field.dataset.monthField,"",input);
          return true;
        }
        setValidity(raw.trim()?"Enter a month and year, like 'Jun 2023'.":"Required.");
        return false;
      }
      selected=parsed;
      input.value=formatMonth(parsed);
      year=Number(parsed.slice(0,4));
      paint();
      showFutureWarning(parsed);
      onCommit(field.dataset.monthField,parsed,input);
      return true;
    };
    trigger.addEventListener("click",()=>{
      const opening=popover.hidden;
      closeSiblingDatePopovers(documentObject,popover);
      popover.hidden=!opening;
      trigger.setAttribute("aria-expanded",String(opening));
      if(opening){
        paint();
        positionPopover(field,popover,300);
        (popover.querySelector('[aria-selected="true"]')||
          popover.querySelector("[data-month]"))?.focus();
      }
    });
    field.querySelector(".year-back").addEventListener("click",()=>setYear(year-1));
    field.querySelector(".year-next").addEventListener("click",()=>setYear(year+1));
    grid.addEventListener("click",(event)=>{
      const button=event.target.closest?.("[data-month]");
      if(!button)return;
      const parsed=`${year}-${String(button.dataset.month).padStart(2,"0")}`;
      selected=parsed;
      input.value=formatMonth(parsed);
      showFutureWarning(parsed);
      close();
      input.focus();
      onCommit(field.dataset.monthField,parsed,input);
    });
    input.addEventListener("blur",()=>commit(input.value));
    input.addEventListener("keydown",(event)=>{if(event.key==="Enter"){event.preventDefault();commit(input.value);close();}if(event.key==="Escape"&&!popover.hidden){event.preventDefault();close();trigger.focus();}});
    popover.addEventListener("keydown",(event)=>{
      if(event.key==="Escape"){event.preventDefault();close();trigger.focus();return;}
      const active=document.activeElement;
      if(!active?.matches?.("[data-month]"))return;
      const months=[...popover.querySelectorAll("[data-month]")],index=months.indexOf(active);
      const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4};
      if(event.key in deltas){
        event.preventDefault();
        months[(index+deltas[event.key]+months.length)%months.length].focus();
      }else if(event.key==="Home"){event.preventDefault();months[0].focus();}
      else if(event.key==="End"){event.preventDefault();months.at(-1).focus();}
    });
  });
}

import {escapeHtml} from "./utils.js";
import {icon} from "./icons.js";

const DAY_MS=86_400_000;
const SAFE_INPUT_ATTRIBUTE=/^(?:name|class|data-[a-z0-9-]+)$/;
const WEEKDAYS=Object.freeze(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]);
const MONTH_NAMES=Object.freeze([
  Object.freeze(["jan","january"]),
  Object.freeze(["feb","february"]),
  Object.freeze(["mar","march"]),
  Object.freeze(["apr","april"]),
  Object.freeze(["may"]),
  Object.freeze(["jun","june"]),
  Object.freeze(["jul","july"]),
  Object.freeze(["aug","august"]),
  Object.freeze(["sep","sept","september"]),
  Object.freeze(["oct","october"]),
  Object.freeze(["nov","november"]),
  Object.freeze(["dec","december"])
]);
const OUTSIDE_DISMISS_INSTALLED=new WeakSet();

function inputAttributesMarkup(attributes={}){
  return Object.entries(attributes||{})
    .filter(([name,value])=>SAFE_INPUT_ATTRIBUTE.test(name)&&value!==false&&value!=null)
    .map(([name,value])=>value===true
      ?escapeHtml(name)
      :`${escapeHtml(name)}="${escapeHtml(value)}"`)
    .join(" ");
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
  const height=popover.offsetHeight||388;
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

function isoFromParts(year,month,day){
  const date=new Date(Date.UTC(year,month-1,day));
  if(
    date.getUTCFullYear()!==year||
    date.getUTCMonth()!==month-1||
    date.getUTCDate()!==day
  )return null;
  return`${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

export function parseExactDate(value){
  const raw=String(value||"").trim();
  if(!raw)return null;
  let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(match)return isoFromParts(Number(match[1]),Number(match[2]),Number(match[3]));
  const cleaned=raw.replace(/[,.-]+/g," ").replace(/\s+/g," ").trim();
  match=cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if(match){
    const month=MONTH_NAMES.findIndex((names)=>
      names.includes(match[1].toLocaleLowerCase())
    );
    return month<0?null:isoFromParts(Number(match[3]),month+1,Number(match[2]));
  }
  match=cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if(match){
    const month=MONTH_NAMES.findIndex((names)=>
      names.includes(match[2].toLocaleLowerCase())
    );
    return month<0?null:isoFromParts(Number(match[3]),month+1,Number(match[1]));
  }
  return null;
}

export function monthFromExactDate(value){
  return parseExactDate(value)?.slice(0,7)||null;
}

export function compareExactDates(left,right){
  const first=parseExactDate(left);
  const second=parseExactDate(right);
  if(!first||!second)return null;
  return first.localeCompare(second);
}

export function shiftExactDateByMonths(value,delta){
  const parsed=parseExactDate(value);
  if(!parsed||!Number.isInteger(delta))return null;
  const [year,month,day]=parsed.split("-").map(Number);
  const target=new Date(Date.UTC(year,month-1+delta,1));
  const lastDay=new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth()+1,
    0
  )).getUTCDate();
  return isoFromParts(
    target.getUTCFullYear(),
    target.getUTCMonth()+1,
    Math.min(day,lastDay)
  );
}

export function formatExactDate(value,{locale}={}){
  const parsed=parseExactDate(value);
  if(!parsed)return"";
  const [year,month,day]=parsed.split("-").map(Number);
  return new Intl.DateTimeFormat(locale||undefined,{
    year:"numeric",
    month:"short",
    day:"numeric",
    timeZone:"UTC"
  }).format(new Date(Date.UTC(year,month-1,day)));
}

function monthHeading(year,month,{locale}={}){
  return new Intl.DateTimeFormat(locale||undefined,{
    year:"numeric",
    month:"long",
    timeZone:"UTC"
  }).format(new Date(Date.UTC(year,month,1)));
}

function calendarDays(year,month,selected){
  const first=new Date(Date.UTC(year,month,1));
  const start=new Date(first.getTime()-first.getUTCDay()*DAY_MS);
  const today=new Date();
  const todayIso=isoFromParts(
    today.getFullYear(),
    today.getMonth()+1,
    today.getDate()
  );
  return Array.from({length:42},(_,index)=>{
    const date=new Date(start.getTime()+index*DAY_MS);
    const iso=isoFromParts(
      date.getUTCFullYear(),
      date.getUTCMonth()+1,
      date.getUTCDate()
    );
    const outside=date.getUTCMonth()!==month;
    return`<button type="button" role="gridcell" data-exact-day="${iso}" aria-label="${escapeHtml(formatExactDate(iso))}" aria-selected="${String(iso===selected)}" data-outside-month="${String(outside)}" ${iso===todayIso?'data-today="true"':""}>${date.getUTCDate()}</button>`;
  }).join("");
}

function calendarMarkup(year,month,selected){
  return`<div class="exact-date-weekdays" aria-hidden="true">${WEEKDAYS.map((day)=>`<span>${day}</span>`).join("")}</div>
    <div class="exact-date-grid" role="grid">${calendarDays(year,month,selected)
      .match(/<button[\s\S]*?<\/button>/g)
      ?.reduce((rows,button,index)=>{
        if(index%7===0)rows.push([]);
        rows.at(-1).push(button);
        return rows;
      },[])
      .map((row)=>`<div role="row">${row.join("")}</div>`)
      .join("")||""}</div>`;
}

export function exactDateFieldMarkup({
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
  const parsed=parseExactDate(value);
  const seed=parsed?new Date(`${parsed}T00:00:00Z`):new Date();
  const year=parsed?seed.getUTCFullYear():seed.getFullYear();
  const month=parsed?seed.getUTCMonth():seed.getMonth();
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
  return`<div class="field exact-date-field" data-exact-date-field="${escapeHtml(id)}" data-year="${year}" data-month="${month}">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}${optional?" <em>Optional</em>":required?'<span class="required-mark" aria-hidden="true"> *</span>':""}</label>
    <div class="exact-date-input-wrap">
      <input type="text" id="${escapeHtml(id)}" name="${escapeHtml(inputName)}" inputmode="text" autocomplete="off" aria-describedby="${escapeHtml(describedBy)}" aria-invalid="${String(!!error)}" value="${escapeHtml(formatExactDate(parsed))}" placeholder="Jun 15, 2023" ${required?"required":""} ${disabled?"disabled":""} ${customAttributes}>
      <button type="button" class="icon-button exact-date-trigger" aria-label="Choose ${escapeHtml(label.toLowerCase())}" aria-controls="${escapeHtml(id)}-popover" aria-expanded="false" ${disabled?"disabled":""}>${icon("calendar",{size:18})}</button>
    </div>
    ${help?`<p class="field-help" id="${escapeHtml(id)}-help">${escapeHtml(help)}</p>`:""}
    <p class="field-error" id="${escapeHtml(id)}-error" aria-live="polite" ${customErrorAttributes}>${escapeHtml(error)}</p>
    <div class="exact-date-popover" id="${escapeHtml(id)}-popover" role="dialog" aria-label="Choose ${escapeHtml(label.toLowerCase())}" hidden>
      <div class="exact-date-month-row">
        <button type="button" class="icon-button exact-date-previous" aria-label="Previous month">${icon("chevron-left",{size:18})}</button>
        <strong class="exact-date-month-heading">${escapeHtml(monthHeading(year,month))}</strong>
        <button type="button" class="icon-button exact-date-next" aria-label="Next month">${icon("chevron-right",{size:18})}</button>
      </div>
      <div data-exact-date-calendar>${calendarMarkup(year,month,parsed)}</div>
    </div>
  </div>`;
}

export function installExactDateFields(root,{onCommit=()=>{}}={}){
  const documentObject=root.ownerDocument||root;
  installOutsideDismiss(documentObject);
  root.querySelectorAll("[data-exact-date-field]").forEach((field)=>{
    if(field.dataset.exactDateInstalled==="true")return;
    field.dataset.exactDateInstalled="true";
    const input=field.querySelector("input");
    const trigger=field.querySelector(".exact-date-trigger");
    const popover=field.querySelector(".exact-date-popover");
    const heading=field.querySelector(".exact-date-month-heading");
    const calendar=field.querySelector("[data-exact-date-calendar]");
    const error=field.querySelector(".field-error");
    let year=Number(field.dataset.year);
    let month=Number(field.dataset.month);
    let selected=parseExactDate(input.value);
    const setValidity=(message)=>{
      error.textContent=message;
      input.setAttribute("aria-invalid",String(!!message));
    };
    const close=()=>{
      popover.hidden=true;
      trigger.setAttribute("aria-expanded","false");
    };
    const paint=()=>{
      field.dataset.year=String(year);
      field.dataset.month=String(month);
      heading.textContent=monthHeading(year,month);
      calendar.innerHTML=calendarMarkup(year,month,selected);
    };
    const shiftMonth=(delta)=>{
      const date=new Date(Date.UTC(year,month+delta,1));
      year=date.getUTCFullYear();
      month=date.getUTCMonth();
      paint();
      calendar.querySelector(
        selected?.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)
          ?`[data-exact-day="${selected}"]`
          :"[data-exact-day]:not([data-outside-month='true'])"
      )?.focus();
    };
    const commit=(raw)=>{
      const parsed=parseExactDate(raw);
      if(!parsed){
        if(!raw.trim()&&!input.required){
          selected=null;
          setValidity("");
          paint();
          onCommit(field.dataset.exactDateField,"",input);
          return true;
        }
        setValidity(raw.trim()?"Enter a complete date, like 'Jun 15, 2023' or '2023-06-15'.":input.required?"Required.":"");
        return false;
      }
      selected=parsed;
      input.value=formatExactDate(parsed);
      const next=new Date(`${parsed}T00:00:00Z`);
      year=next.getUTCFullYear();
      month=next.getUTCMonth();
      setValidity("");
      paint();
      onCommit(field.dataset.exactDateField,parsed,input);
      return true;
    };
    trigger.addEventListener("click",()=>{
      const opening=popover.hidden;
      closeSiblingDatePopovers(documentObject,popover);
      popover.hidden=!opening;
      trigger.setAttribute("aria-expanded",String(opening));
      if(opening){
        paint();
        positionPopover(field,popover,336);
        (calendar.querySelector('[aria-selected="true"]')||
          calendar.querySelector("[data-exact-day]:not([data-outside-month='true'])"))?.focus();
      }
    });
    field.querySelector(".exact-date-previous").addEventListener("click",()=>shiftMonth(-1));
    field.querySelector(".exact-date-next").addEventListener("click",()=>shiftMonth(1));
    calendar.addEventListener("click",(event)=>{
      const day=event.target.closest?.("[data-exact-day]");
      if(!day)return;
      selected=day.dataset.exactDay;
      input.value=formatExactDate(selected);
      setValidity("");
      close();
      input.focus();
      onCommit(field.dataset.exactDateField,selected,input);
    });
    input.addEventListener("blur",()=>commit(input.value));
    input.addEventListener("keydown",(event)=>{
      if(event.key==="Enter"){
        event.preventDefault();
        commit(input.value);
        close();
      }else if(event.key==="Escape"&&!popover.hidden){
        event.preventDefault();
        close();
        trigger.focus();
      }
    });
    popover.addEventListener("keydown",(event)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        close();
        trigger.focus();
        return;
      }
      const active=document.activeElement;
      if(!active?.matches?.("[data-exact-day]"))return;
      const day=new Date(`${active.dataset.exactDay}T00:00:00Z`);
      const deltas={
        ArrowLeft:-1,
        ArrowRight:1,
        ArrowUp:-7,
        ArrowDown:7
      };
      if(event.key in deltas){
        event.preventDefault();
        day.setUTCDate(day.getUTCDate()+deltas[event.key]);
      }else if(event.key==="Home"){
        event.preventDefault();
        day.setUTCDate(day.getUTCDate()-day.getUTCDay());
      }else if(event.key==="End"){
        event.preventDefault();
        day.setUTCDate(day.getUTCDate()+(6-day.getUTCDay()));
      }else if(event.key==="PageUp"){
        event.preventDefault();
        shiftMonth(-1);
        return;
      }else if(event.key==="PageDown"){
        event.preventDefault();
        shiftMonth(1);
        return;
      }else{
        return;
      }
      const next=isoFromParts(
        day.getUTCFullYear(),
        day.getUTCMonth()+1,
        day.getUTCDate()
      );
      if(day.getUTCFullYear()!==year||day.getUTCMonth()!==month){
        year=day.getUTCFullYear();
        month=day.getUTCMonth();
        paint();
      }
      calendar.querySelector(`[data-exact-day="${next}"]`)?.focus();
    });
  });
}

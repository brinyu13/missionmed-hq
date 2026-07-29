import {escapeHtml,formatMonth,parseMonth} from "./utils.js";
import {icon} from "./icons.js";

const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function monthFieldMarkup({id,label,value="",required=false,help="",disabled=false}){
  const parsed=parseMonth(value);
  const year=parsed?Number(parsed.slice(0,4)):new Date().getFullYear();
  const isFarFuture=!!parsed&&year>new Date().getFullYear()+6;
  return`<div class="field month-field" data-month-field="${escapeHtml(id)}" data-year="${year}">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}${required?'<span class="required-mark" aria-hidden="true"> *</span>':""}</label>
    <div class="month-input-wrap">
      <input id="${escapeHtml(id)}" name="${escapeHtml(id)}" inputmode="text" autocomplete="off" aria-describedby="${escapeHtml(id)}-error" aria-invalid="false" value="${escapeHtml(formatMonth(parsed)||value)}" placeholder="Mon YYYY" ${required?"required":""} ${disabled?"disabled":""}>
      <button type="button" class="icon-button month-trigger" aria-label="Choose ${escapeHtml(label.toLowerCase())}" aria-expanded="false" ${disabled?"disabled":""}>${icon("calendar",{size:18})}</button>
    </div>
    ${help?`<p class="field-help">${escapeHtml(help)}</p>`:""}
    <p class="field-error ${isFarFuture?"field-warning":""}" id="${escapeHtml(id)}-error" aria-live="polite">${isFarFuture?"That's more than 6 years out — double-check the year.":""}</p>
    <div class="month-popover" role="dialog" aria-label="Choose month and year" hidden>
      <div class="month-year-row">
        <button type="button" class="icon-button year-back" aria-label="Previous year">${icon("chevron-left",{size:18})}</button>
        <strong class="month-year">${year}</strong>
        <button type="button" class="icon-button year-next" aria-label="Next year">${icon("chevron-right",{size:18})}</button>
      </div>
      <div class="month-grid" role="grid">${MONTHS.map((month,index)=>`<button type="button" role="gridcell" data-month="${index+1}" ${parsed&&Number(parsed.slice(5))===index+1?'aria-selected="true"':""}>${month}</button>`).join("")}</div>
    </div>
  </div>`;
}

export function installMonthFields(root,{onCommit=()=>{}}={}){
  root.querySelectorAll("[data-month-field]").forEach((field)=>{
    const input=field.querySelector("input"),trigger=field.querySelector(".month-trigger"),popover=field.querySelector(".month-popover"),yearLabel=field.querySelector(".month-year"),error=field.querySelector(".field-error");
    let year=Number(field.dataset.year);
    const setYear=(value)=>{year=value;field.dataset.year=String(value);yearLabel.textContent=String(value);};
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
      if(!parsed){setValidity(raw.trim()?"Enter a month and year, like 'Jun 2023'.":input.required?"Required.":"");return false;}
      input.value=formatMonth(parsed);setYear(Number(parsed.slice(0,4)));showFutureWarning(parsed);onCommit(field.dataset.monthField,parsed,input);return true;
    };
    trigger.addEventListener("click",()=>{const opening=popover.hidden;popover.hidden=!opening;trigger.setAttribute("aria-expanded",String(opening));if(opening)(popover.querySelector('[aria-selected="true"]')||popover.querySelector("[data-month]"))?.focus();});
    field.querySelector(".year-back").addEventListener("click",()=>setYear(year-1));
    field.querySelector(".year-next").addEventListener("click",()=>setYear(year+1));
    field.querySelectorAll("[data-month]").forEach((button)=>button.addEventListener("click",()=>{const parsed=`${year}-${String(button.dataset.month).padStart(2,"0")}`;input.value=formatMonth(parsed);showFutureWarning(parsed);close();input.focus();onCommit(field.dataset.monthField,parsed,input);}));
    input.addEventListener("blur",()=>{if(input.value.trim()||input.required)commit(input.value);});
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

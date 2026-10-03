/* IIQ-1203: navigation only, after the normal server-authorized student load. */
(function(){
 'use strict';var observer,done=false;
 function openCalendar(){
  if(done)return;var control=document.querySelector('[data-act="nav"][data-to="calendar"]');
  if(!control)return;done=true;if(observer)observer.disconnect();control.click();
 }
 observer=new MutationObserver(openCalendar);observer.observe(document.documentElement,{childList:true,subtree:true});openCalendar();
 window.setTimeout(function(){observer.disconnect();},30000);
})();

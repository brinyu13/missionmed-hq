import { commandHome, accountProfile, directory, filteredAccounts, esc } from './mission-residency-finance-view';
let data=null, error='', loading=false, principal=null, filter='all', query='', method='all';
const requested=window.__MISSIONACCOUNTS_REQUESTED_HASH||location.hash;
let restore=/^#\/mr-finance(?:\/|$)/.test(requested);
const handles=hash=>/^#\/mr-finance(?:\/|$)/.test(hash);
function identity(){const r=window.MissionAccountsRuntime?.state;return r?.authenticated&&r.capabilities?.finance_read===true?r.user?.id:null;}
async function refresh(){
 const id=identity(); if(!id){data=null;error='This private financial view requires explicit Founder authorization.';window.__XP?.render?.();return;}
 loading=true;error='';
 try { const result=await window.MissionAccountsRuntime.request('/mission-residency-finance/command');if(identity()!==id)return;data=result;principal=id;if(restore){restore=false;location.hash=requested;} }
 catch {data=null;error='Financial records could not be loaded. No cached financial data is shown. Try refreshing your authenticated workspace.';}
 finally {loading=false;if(handles(location.hash))window.__XP?.render?.();}
}
function bind(root){
 root.querySelector('[data-finance-refresh]')?.addEventListener('click',refresh);
 function update(){query=root.querySelector('#finance-search').value;filter=root.querySelector('#finance-status').value;method=root.querySelector('#finance-method').value;root.querySelector('#finance-results').innerHTML=directory(filteredAccounts(data,query,filter,method));}
 root.querySelector('#finance-search')?.addEventListener('input',update);
 root.querySelector('#finance-status')?.addEventListener('change',update);
 root.querySelector('#finance-method')?.addEventListener('change',update);
 root.querySelectorAll('[data-finance-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.financeFilter;root.querySelector('#finance-status').value=filter;update();root.querySelector('.mrf-directory').scrollIntoView({block:'start'});});
}
window.MissionResidencyFinance={handles,renderHost({root,shell,applyTheme}){
 applyTheme();shell();const id=identity();if(!id||principal&&principal!==id){data=null;principal=null;}
 document.title='Mission Residency Financial Accounts · Founder';
 const demo=document.querySelector('#hdr .demo');if(demo)demo.hidden=true;
 const railWho=document.querySelector('#rail .railWho');if(railWho)railWho.innerHTML='<span class="avc adm">B</span><div><div class="nm">Brian</div><div class="rl">Founder finance · read-only</div></div>';
 const brand=document.querySelector('#hdr .brandSub');if(brand)brand.textContent='Mission Residency · Financial Accounts · MissionMed Institute';
 if(!data){root.innerHTML=`<section class="view mrf"><h1>Mission Residency Financial Accounts</h1><p role="status">${esc(error||'Opening your private financial ledger…')}</p>${id?'<button type="button" class="btn primary" data-finance-refresh>Refresh records</button>':''}<p><a href="#/home">MyMissionMed Account</a></p></section>`;bind(root);if(id&&!loading&&!error)refresh();return;}
 const key=decodeURIComponent(location.hash.split('/')[3]||'');const account=key?data.accounts.find(a=>a.subject_key===key):null;
 root.innerHTML=`<section class="view mrf">${key?account?accountProfile(account):'<h1>Account not found</h1><a href="#/mr-finance">Return to financial directory</a>':commandHome(data,filter,query,method)}<footer class="mrf-footer">Read-only · student visibility off · collection off<br>Server read: ${esc(data.observed_at)} · USD</footer></section>`;bind(root);root.scrollTop=0;
}};
const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./mission-residency-finance-style',import.meta.url);document.head.append(stylesheet);
const timer=setInterval(()=>{if(window.MissionAccountsRuntime?.state?.authenticated){clearInterval(timer);if(handles(location.hash)||restore)refresh();}},100);
const observer=new MutationObserver(()=>{if(data&&identity()!==principal){data=null;principal=null;if(handles(location.hash))window.__XP?.render?.();}});
observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-missionaccounts-runtime']});
window.addEventListener('pagehide',()=>{data=null;principal=null;clearInterval(timer);observer.disconnect();if(handles(location.hash)){const root=document.getElementById('main');if(root)root.replaceChildren();}},{once:true});
// A history-cache restore must exchange a fresh authenticated session before displaying finances.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});

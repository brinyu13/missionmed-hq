// Production-only repairs to the immutable 5300A donor. Every seam must match.
export function repairCanon5401(source) {
  let html = source;
  function replace(oldText, newText) {
    if (!html.includes(oldText)) throw new Error(`5401R canon seam missing: ${oldText.slice(0, 110)}`);
    html = html.replaceAll(oldText, newText);
  }
  replace("function route(){ const h=location.hash.replace(/^#\\/?/,''); const [path,qs]=h.split('?'); const parts=path.split('/').filter(Boolean); const q={}; (qs||'').split('&').forEach(p=>{ if(!p) return; const [a,b]=p.split('='); q[decodeURIComponent(a)]=decodeURIComponent(b||''); }); return {parts,q,raw:h}; }",
    "function route(){ const h=location.hash.replace(/^#\\/?/,''); const routeText=h.split('#')[0]; const question=routeText.indexOf('?'); const pathname=question<0?routeText:routeText.slice(0,question); const qs=question<0?'':routeText.slice(question+1); const parts=pathname.split('/').filter(Boolean); const q=Object.fromEntries(new URLSearchParams(qs)); return {parts,q,raw:h}; }");
  replace("const r=route(); let top=r.parts[0]||'';", "let r=route(); if(window.MissionAccountsRuntime?.state?.user?.role==='student'){ WS.lens='student'; WS.ctx='xp'; if(r.parts[0]!=='me'){ history.replaceState(null,'',location.pathname+location.search+'#/me'); r=route(); } } let top=r.parts[0]||'';");
  replace("save(); applyTheme(); shell(); const main=$('#main'); let html='';", "save(); applyTheme(); shell(); const main=$('#main'); let html=''; try {");
  replace("  main.innerHTML=html; main.scrollTop=0;", "  } catch(error){ main.innerHTML='<section class=\"view\"><h1 class=\"h1\">This view could not open.</h1><p class=\"lead\">Your records are safe. Return to your workspace and try again.</p><a class=\"btn primary\" href=\"'+(window.MissionAccountsRuntime?.state?.user?.role==='student'?'#/me':'#/home')+'\">Return to MissionAccounts</a></section>'; document.title='MissionAccounts · View unavailable'; return; }\n  main.innerHTML=html; main.scrollTop=0;");
  replace("function viewAdvanced(tab, q){", "function viewAdvanced(tab, q){ if(tab==='controls')return missionAccountsDataControls(); if(tab==='sessions')return missionAccountsClasses();");
  replace("function missionAccountsApplyCapabilityState(root){", "function missionAccountsApplyCapabilityState(root){ if(window.MissionAccountsRuntime?.state?.user?.role==='student') root.querySelectorAll('.demo,[data-lens]').forEach(node=>node.hidden=true);");
  replace("[data-confirm-group],[data-confirm-all],[data-undecide],[data-policy$=\"|\"]", "[data-confirm-group],[data-confirm-all],[data-undecide]");
  replace("if(document.documentElement.dataset.missionaccountsBuild==='production'&&!v){ window.MissionAccountsRuntime.dispatch('unsupported',{message:'Clearing a cycle policy remains unavailable until its authoritative server transaction is implemented.'}); return; }", "if(document.documentElement.dataset.missionaccountsBuild==='production'){ if(await setPolicy(k,v||'pending')===false)return; render(); return; }");
  replace('entries in this session · durable audit remains on the server', 'server audit entries');
  // All canonical click handlers may await a server transaction. Data is refreshed only after acceptance.
  html = html.replaceAll('onclick=()=>{', 'onclick=async()=>{');
  replace("setComp(e.i, $('#cN').value, $('#cJ').value, $('#cWhy').value.trim(), !!(r&&r.checked));", "if(await setComp(e.i, $('#cN').value, $('#cJ').value, $('#cWhy').value.trim(), !!(r&&r.checked))===false)return;");
  replace("submitExam(e.i, step, $('#exDate').value, student?'student':'admin');", "if(await submitExam(e.i, step, $('#exDate').value, student?'student':'admin')===false)return;");
  replace("if(res==='passed') markPassed(e.i,'admin'); else decideExam(e.i,res,note);", "const saved=res==='passed'?await markPassed(e.i,'admin'):await decideExam(e.i,res,note); if(saved===false)return;");
  replace("decideExam(e.i, action, note, action==='deny'?($('#exNew').value||null):null);", "if(await decideExam(e.i, action, note, action==='deny'?($('#exNew').value||null):null)===false)return;");
  replace("markPassed(e.i,'student');", "if(await markPassed(e.i,'student')===false)return;");
  replace("Wonderful — Dr J has been notified (prototype).", "Passed recorded. Dr J can see your update.");
  replace("On hold — the student has been told you want to talk (prototype).", "On hold — the student can see your request to talk.");
  replace("decide(+si,k,t); render();", "if(await decide(+si,k,t)===false)return; render();");
  replace("decide(+si,k,'other',+amt,note); render();", "if(await decide(+si,k,+amt===300?'fullcycle':'other',+amt,note)===false)return; render();");
  replace("decide(e.i,k,bt,amt,$('#bNote').value.trim());", "if(await decide(e.i,k,bt,amt,$('#bNote').value.trim())===false)return;");
  replace("decideIdent(cl,d); render();", "if(await decideIdent(cl,d)===false)return; render();");
  replace("decideDevice(dv,d); render();", "if(await decideDevice(dv,d)===false)return; render();");
  replace("const nm=$('#eName').value.trim(); const why=$('#eWhy').value.trim(); if(nm && nm!==e.n) addCorr(e.i,'name',{from:e.n,to:nm,reason:why}); const em=$('#eEmail').value.trim();", "const nm=$('#eName').value.trim(); const why=$('#eWhy').value.trim(); const em=$('#eEmail').value.trim(); const phone=$('#ePhone').value.trim(); const contactStudentId=window.MissionAccountsRuntime.getCanonicalModel().ids.students[e.i];");
  replace("setContact(e.i, em, $('#ePhone').value.trim());", "if(nm && nm!==e.n && await addCorr(e.i,'name',{from:e.n,to:nm,reason:why})===false)return; const contactIndex=Object.entries(window.MissionAccountsRuntime.getCanonicalModel().ids.students).find(([,id])=>id===contactStudentId)?.[0]; if(contactIndex==null){toast('This record changed. Reopen it before saving contact details.');return;} if(await setContact(Number(contactIndex), em, phone)===false)return;");
  replace("addCorr(e.i,'note',{k,to:t,from:'',reason:''});", "if(await addCorr(e.i,'note',{k,to:t,from:'',reason:t})===false)return;");
  replace("decideIdent(cl,'same',Number(button.dataset.identityCanonical)); closeSheet(); render();", "if(await decideIdent(cl,'same',Number(button.dataset.identityCanonical))===false)return; closeSheet(); render();");
  // The attendance panel must stay on the selected student until each operation finishes.
  replace("if(cr) undoCorr(cr.id);", "if(cr && await undoCorr(cr.id)===false)return;");
  replace("else addCorr(e.i,'att_remove',{sess:+ss,k,from:before,to:before-1,reason});", "else if(await addCorr(e.i,'att_remove',{sess:+ss,k,from:before,to:before-1,reason})===false)return;");
  replace("else addCorr(e.i,'att_add',{sess:+ss,k,from:before,to:before+1,reason});", "else if(await addCorr(e.i,'att_add',{sess:+ss,k,from:before,to:before+1,reason})===false)return;");
  replace("if(existing) undoCorr(existing.id); if(to!==s.st) addCorr(e.i,'step',{sess:+ss,k,from:s.st,to,reason});", "if(existing && await undoCorr(existing.id)===false)return; if(to!==s.st && await addCorr(e.i,'step',{sess:+ss,k,from:s.st,to,reason})===false)return;");
  replace("decide(si,k,chosen);", "if(await decide(si,k,chosen)===false)return;");
  replace("decide(si,k,chosen,amt,$('#oNote').value.trim());", "if(await decide(si,k,chosen,amt,$('#oNote').value.trim())===false)return;");
  replace("decideDevice(dv,'match',+b.dataset.pick);", "if(await decideDevice(dv,'match',+b.dataset.pick)===false)return;");
  replace("withdrawExam(+b.dataset.examWithdraw);", "if(await withdrawExam(+b.dataset.examWithdraw)===false)return;");
  replace("undoCorr(b.dataset.undoCorr);", "if(await undoCorr(b.dataset.undoCorr)===false)return;");
  replace("undecide(+si,k); render();", "if(await undecide(+si,k)===false)return; render();");
  replace("next:'— · scheduler not registered',", "next:h.zoom_schedule_utc==='30 6 * * *'?'Daily at 06:30 UTC':'Schedule not reported by this deployment',");
  replace("stateLabel:state==='ok'?'Healthy'", "stateLabel:state==='ok'?(Number(h.zoom_review_classes||0)+Number(h.zoom_review_occurrences||0)>0?'Source review needed':'Healthy')");
  replace("stateChip:state==='ok'?'approved'", "stateChip:state==='ok'?(Number(h.zoom_review_classes||0)+Number(h.zoom_review_occurrences||0)>0?'review':'approved')");
  replace("('Last run persisted '+sessions+' classes · '+rows+' source rows')", "('Last run persisted '+sessions+' source classes · '+rows+' source rows. '+Number(h.zoom_review_classes||0)+' classes and '+Number(h.zoom_review_occurrences||0)+' occurrences need source review in Classes.')");
  replace("${esc(l.text)}</span>", "${esc(l.text)}${l.actor?' · '+esc(l.actor):''}${l.reason?' · '+esc(l.reason):''}</span>");
  replace("${esc(l.text.replace(e.n+': ','').replace(e.n+' · ',''))}", "${esc(l.text.replace(e.n+': ','').replace(e.n+' · ',''))}${l.actor?' · '+esc(l.actor):''}");
  // Source reconciliation reflects the authoritative projection, never prototype totals.
  const helpers = `
function missionAccountsEvidenceTabs(){ return '<div class="tabs"><a class="btn ghost" href="#/advanced/controls">Data controls</a><a class="btn ghost" href="#/advanced/sessions">Classes</a><a class="btn ghost" href="#/advanced/working">History</a></div>'; }
function missionAccountsDataControls(){
  const c=D.meta.controls||{};
  return '<section class="view"><div class="eyebrow">Evidence and controls</div><h1 class="h1">Data controls.</h1><p class="lead">Reconciled from the current authorized records. Source evidence and decisions remain separate.</p>'+missionAccountsEvidenceTabs()+'<div class="panel" style="padding:20px;margin-top:14px"><div class="kv"><span class="k">Canonical classes</span><span class="v">'+Number(c.sessions||0)+'</span><span class="k">Visible identity records</span><span class="v">'+Number(c.humans||0)+'</span><span class="k">Effective attendance events</span><span class="v">'+Number(c.events||0)+'</span><span class="k">Open identity clusters</span><span class="v">'+Number(c.clusters||0)+'</span></div><div class="tblWrap"><table class="tbl"><thead><tr><th>Cycle</th><th>Classes</th><th>People</th><th>Events</th><th>Attendance days</th></tr></thead><tbody>'+CY.map(cycle=>'<tr><td>'+esc(cycle.label)+'</td><td>'+Number(cycle.sessions||0)+'</td><td>'+Number(cycle.humans||0)+'</td><td>'+Number(cycle.events||0)+'</td><td>'+Number(cycle.days||0)+'</td></tr>').join('')+'</tbody></table></div><p class="muted">Billing is an approved interpretation, not a raw attendance total. <a href="#/billing?cycle=all#rule">Review billing rules</a>.</p></div></section>';
}
function missionAccountsSourceReview(){
  const sources=D.meta.zoom_class_sources||[]; const unresolved=D.meta.zoom_occurrence_reviews||[];
  return '<section class="panel" style="padding:20px;margin-top:18px"><h2 class="h2">Source reconciliation</h2><p class="muted">Source matches corroborate a preserved class; they do not add attendance or resolve a person automatically. Held occurrences remain available for review.</p><div class="tblWrap"><table class="tbl"><thead><tr><th>Source class</th><th>Disposition</th><th>Canonical class</th><th>Exact matches</th><th>Held occurrences</th></tr></thead><tbody>'+sources.map(x=>'<tr><td>'+esc(fmtDate(x.held_on))+' · '+esc(stepLabel(x.step))+'<br><small>'+esc(x.source_session_id)+'</small></td><td>'+esc(x.disposition)+'</td><td>'+esc(x.canonical_session_id||'Needs class review')+'</td><td>'+Number(x.exact_occurrences||0)+'</td><td>'+Number(x.unresolved_occurrences||0)+'</td></tr>').join('')+'</tbody></table></div><h3 class="h3" style="margin-top:20px">Held source occurrences · '+unresolved.length+'</h3><div class="tblWrap"><table class="tbl"><thead><tr><th>Source name</th><th>Class</th><th>Join / leave</th><th>Source row</th></tr></thead><tbody>'+unresolved.map(x=>'<tr><td>'+esc(x.display_name)+'</td><td>'+esc(fmtDate(x.held_on))+' · '+esc(stepLabel(x.step))+'</td><td>'+esc(x.joined_at||'Missing')+'<br>'+esc(x.left_at||'Missing')+'</td><td>'+esc(x.source_row_id)+'</td></tr>').join('')+'</tbody></table></div>'+(!sources.length?'<p>No source reconciliation records yet.</p>':'')+'</section>';
}
function missionAccountsClasses(){
  return '<section class="view"><div class="eyebrow">Evidence and controls</div><h1 class="h1">Classes.</h1><p class="lead">'+D.sessions.length+' canonical Live Drills classes. Duplicate or unresolved source occurrences do not create a second canonical class.</p>'+missionAccountsEvidenceTabs()+'<div class="tblWrap"><table class="tbl"><thead><tr><th>Date</th><th>Start</th><th>Step</th><th>Cycle</th><th>Source meeting</th><th>Attendees</th></tr></thead><tbody>'+D.sessions.map(s=>'<tr><td>'+esc(fmtDate(s.d))+'</td><td>'+fmtTime(s.t)+'</td><td>'+esc(stepLabel(s.st))+'</td><td>'+esc(cyc(s.c)?.label||s.c)+'</td><td>'+esc(s.m||'Preserved class source')+'</td><td>'+Number(s.n||0)+'</td></tr>').join('')+'</tbody></table></div>'+(!D.sessions.length?'<p class="muted">No canonical classes are available in this view.</p>':'')+missionAccountsSourceReview()+'</section>';
}
`;
  html = html.replace('/* ---------------- ADVANCED ---------------- */', helpers + '/* ---------------- ADVANCED ---------------- */');
  replace("return window.MissionAccountsRuntime.dispatch('unsupported',{message:'Clearing a billing decision remains unavailable until its authoritative server transaction is implemented.'});", "return window.MissionAccountsRuntime.dispatch('billing-decision-reversal',{si,k});");
  replace("return window.MissionAccountsRuntime.dispatch('unsupported',{message:'Batch billing approval remains unavailable until its authoritative transaction is implemented.'});", "return missionAccountsConfirmGroupSheet(k,which);");
  replace("  root.querySelectorAll('[data-confirm-group],[data-confirm-all],[data-undecide]').forEach(control=>missionAccountsDisable(control,'This batch or clear action remains unavailable until its authoritative server transaction is implemented.'));", '');
  const batchHelpers = `
function missionAccountsBatchOutcome(result,k){
  const count=Number(result.approved_count??result.reversed_count??0); const reversing=result.reversed_count!=null;
  const rows=(result.results||[]).map(row=>{ const si=Object.entries(window.MissionAccountsRuntime.getCanonicalModel().ids.students).find(([,id])=>id===row.student_id)?.[0]; const student=D.students[Number(si)]; return '<div class="panel" style="padding:12px;margin-top:8px">'+(si==null?'Record unavailable':'<a href="#/student/'+Number(si)+'?cycle='+k+'">'+esc(student?.n||'Record')+'</a>')+' · '+(row.accepted?(reversing?'Reversed':'Confirmed'):('Needs review: '+esc(String(row.reason||'Record changed').replaceAll('_',' '))))+'</div>'; }).join('');
  openSheet('<div class="t">'+count+' '+(reversing?'reversed':'confirmed')+' · '+Number(result.rejected_count||0)+' need review</div><div class="d">Each result is recorded on the server. Held records keep their prior state. No payment was sent or collected.</div><div style="max-height:40vh;overflow:auto">'+rows+'</div><div class="acts">'+(!reversing&&count?'<button class="btn ghost" id="batchUndo">Undo confirmed records</button>':'')+'<button class="btn primary" id="batchDone">Done</button></div>',()=>{
    $('#batchDone').onclick=closeSheet;
    const undo=$('#batchUndo'); if(undo){ const requestId='ui:'+crypto.randomUUID(); undo.onclick=async()=>{ undo.disabled=true; const receipt=await window.MissionAccountsRuntime.dispatch('billing-batch-reversal',{batchId:result.batch_id,requestId}); if(receipt===false){undo.disabled=false;return;} missionAccountsBatchOutcome(receipt,k); }; }
  });
}
async function missionAccountsConfirmGroupSheet(k,which){
  if(WS.rule==='event'){toast('Switch back to the corrected rule before approving amounts.');return;}
  const lists=window.__lists?.[k]; if(!lists){toast('Reopen the cycle to refresh these records.');return;}
  const all=which==='all'?[...lists.cleanFull,...lists.cleanPer]:(lists[which]||[]);
  const items=all.slice(0,100); if(!items.length){toast('There are no clean records to confirm.');return;}
  const ids=window.MissionAccountsRuntime.getCanonicalModel().ids.students;
  const expectedAmounts=new Map(items.map(x=>[ids[x.e.i],Math.round(suggestionFor(x.e,k).amount*100)]));
  const cycleKey={june:'2026-cycle-1',july:'2026-cycle-2',august:'2026-cycle-3'}[k];
  let controls;
  try { controls=await window.MissionAccountsRuntime.mutation('/admin/billing-batches/controls',{body:{cycle_key:cycleKey,student_ids:[...expectedAmounts.keys()]}}); }
  catch(error){toast(error.message||'These records could not be prepared. Try again.');return;}
  const requestItems=controls.items.map(item=>({...item,expected_amount_cents:expectedAmounts.get(item.student_id)}));
  const total=[...expectedAmounts.values()].reduce((a,b)=>a+b,0)/100;
  const requestId='ui:'+crypto.randomUUID();
  openSheet('<div class="t">Confirm '+items.length+' '+esc(cyc(k).label)+' records?</div><div class="d">Total <b class="money">'+money(total)+'</b>. The server will recheck each record. Changed or held records are reported separately. Nothing is charged.'+(all.length>100?' This batch contains the first 100 of '+all.length+' records; reopen the group for the remainder.':'')+'</div><div class="picker" style="max-height:34vh">'+items.map(x=>'<div style="padding:12px">'+esc(x.e.n)+' · '+money(suggestionFor(x.e,k).amount)+'</div>').join('')+'</div><div class="acts"><button class="btn confirm" id="gGo">Confirm '+items.length+' · '+money(total)+'</button><button class="btn ghost" id="gNo">Cancel</button></div>',()=>{
    $('#gNo').onclick=closeSheet; $('#gGo').onclick=async()=>{ const button=$('#gGo');button.disabled=true;const result=await window.MissionAccountsRuntime.dispatch('billing-batch',{k,items:requestItems,requestId});if(result===false){button.disabled=false;return;} missionAccountsBatchOutcome(result,k); };
  });
}
`;
  html = html.replace('/* ---------------- ADVANCED ---------------- */', batchHelpers + '/* ---------------- ADVANCED ---------------- */');
  return html;
}

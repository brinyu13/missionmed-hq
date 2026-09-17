export function renderWarningPanel(warnings,layout){
  const top=(warnings||[]).slice(0,6);
  const cls=top.length?"d1-407-warn-panel":"d1-407-warn-panel ok";
  const rows=top.length?top.map((warning)=>`<div class="d1-407-warn-row ${warning.severity||"warning"}"><b>${(warning.severity||"warn").toUpperCase()}</b><span>${escapeHtml(warning.message||warning)}</span></div>`).join(""):"<div class=\"d1-407-warn-row info\"><b>OK</b><span>No blocking validation warnings for the current board.</span></div>";
  const stats=layout?.stats?`<div class="d1-407-kpi"><span>VISIBLE<b>${layout.stats.visibleEvents}</b></span><span>LANES<b>${layout.stats.laneCount}</b></span><span>MILESTONES<b>${layout.stats.milestones}</b></span></div>`:"";
  return `<div id="d1_407_warnings" class="${cls}"><div class="subt" style="margin-bottom:8px">407 VALIDATION AND LAYOUT</div>${rows}${stats}</div>`;
}

export function renderVersionTools(versions,fixtures){
  const fixtureOptions=fixtures.map((item)=>`<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("");
  return `<div id="d1_407_tools" class="d1-407-tools">
    <button class="btnD alt sm" data-407-action="save-version">407 SAVE VERSION</button>
    <button class="btnD alt sm" data-407-action="restore-version">RESTORE LATEST</button>
    <button class="btnD alt sm" data-407-action="export-json">EXPORT JSON</button>
    <label class="btnD alt sm" style="cursor:pointer">IMPORT JSON<input type="file" accept="application/json" data-407-file="import-json" style="display:none"></label>
    <select class="btnD alt sm" data-407-action="fixture">${fixtureOptions}</select>
    <button class="btnD alt sm" data-407-action="load-fixture">LOAD FIXTURE</button>
    <button class="btnD alt sm" data-407-action="reset-layout">RESET TO DATES</button>
    <div class="d1-407-json-note">407 DATA MODEL ACTIVE · ${versions.length} CANONICAL VERSION${versions.length===1?"":"S"} · LOCAL MEMORY ONLY</div>
  </div>`;
}

export function markCrowdedElements(layout){
  document.querySelectorAll(".d1-407-crowded").forEach((el)=>el.classList.remove("d1-407-crowded"));
  Object.values(layout?.placements||{}).forEach((placement)=>{
    if(!placement.warnings?.length)return;
    const el=document.querySelector(`[data-ev="${placement.id}"]`);
    if(el)el.classList.add("d1-407-crowded");
  });
}

function escapeHtml(value){
  return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}


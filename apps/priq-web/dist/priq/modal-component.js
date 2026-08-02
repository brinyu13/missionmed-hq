export function openStateMatrix(states) {
  const scrim = document.querySelector("#scrim");
  const modal = document.querySelector("#modal");
  document.querySelector("#mKick").textContent = "Runtime state · backend resolved";
  document.querySelector("#mTitle").innerHTML = "Foundation <em>state matrix</em>";
  const body = document.querySelector("#mBody");
  body.replaceChildren();
  const intro = document.createElement("p");
  intro.className = "lead";
  intro.textContent = "Every state is resolved by the local backend. Active blockers stay inside the application; they never replace it.";
  body.append(intro);
  for (const state of states) {
    const row = document.createElement("div");
    row.className = `recovery-state-row ${state.active ? "active" : "inactive"}`;
    const status = document.createElement("span");
    status.className = "recovery-state-status";
    status.textContent = state.active ? "ACTIVE" : "READY PATH";
    const copy = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = state.code;
    const detail = document.createElement("span");
    detail.textContent = `${state.label} — ${state.detail}`;
    copy.append(title, detail);
    row.append(status, copy);
    body.append(row);
  }
  document.querySelector("#mFoot").innerHTML = '<span class="glassNote">Local provisional state · <b>no production connection</b></span><button class="btnGhost" onclick="closeAll()">Close</button>';
  scrim.classList.add("on");
  modal.classList.add("on");
}
